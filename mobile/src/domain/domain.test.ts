import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { BlockCounter, CounterStateError, type KeyValueStore } from './counter.ts';
import { buildAad, buildNonce, encryptBytes, encryptSample, hexToBytes } from './envelope.ts';
import { ADAPT_BAND_UT, MagMeter, VibrationMeter, luxToPct } from './measure.ts';
import { parsePairing } from './pairing.ts';
import { buildSample } from './sample.ts';

const vectors = JSON.parse(readFileSync(new URL('../../spec/test-vectors.json', import.meta.url), 'utf8'));

test('cifrado: mismos bytes que la implementación de referencia (vectores compartidos)', () => {
  for (const v of vectors.vectors) {
    const p = { host: 'h', device: v.device, bus: v.bus, keyHex: v.key_hex, noncePrefixHex: v.nonce_prefix_hex, token: 't' };
    assert.equal(Buffer.from(buildNonce(hexToBytes(v.nonce_prefix_hex), v.ctr)).toString('hex'), v.nonce_hex);
    assert.equal(Buffer.from(buildAad(v.device, v.bus, v.ctr)).toString('hex'), v.aad_hex);
    assert.deepEqual(encryptBytes(p, v.ctr, new TextEncoder().encode(v.plaintext)), v.envelope);
  }
});

test('encryptSample no deja valores en claro en el sobre', () => {
  const v = vectors.vectors[0];
  const p = { host: 'h', device: v.device, bus: v.bus, keyHex: v.key_hex, noncePrefixHex: v.nonce_prefix_hex, token: 't' };
  const env = encryptSample(p, 1, { ts: 1, light_pct: 77.7 });
  assert.ok(!JSON.stringify(env).includes('77.7') && !JSON.stringify(env).includes('light_pct'));
});

test('BlockCounter: estrictamente creciente, techo guardado antes de usar y sin repetir tras reinicio', async () => {
  const mem = new Map<string, string>();
  const writes: string[] = [];
  const store: KeyValueStore = {
    get: async (k) => mem.get(k) ?? null,
    set: async (k, v) => {
      writes.push(v);
      mem.set(k, v);
    },
  };
  const c = new BlockCounter(store, 'k', 100);
  await c.init();
  const a = await Promise.all([c.next(), c.next(), c.next()]);
  assert.deepEqual(a, [0, 1, 2]);
  assert.deepEqual(writes, ['100']); // el techo se guardó antes del primer uso
  const c2 = new BlockCounter(store, 'k', 100); // "reinicio"
  await c2.init();
  assert.equal(await c2.next(), 100);
});

test('BlockCounter rechaza un estado corrupto', async () => {
  const store: KeyValueStore = { get: async () => 'basura', set: async () => undefined };
  await assert.rejects(new BlockCounter(store, 'k').init(), CounterStateError);
});

test('luxToPct: escala logarítmica acotada', () => {
  assert.equal(luxToPct(0), 0);
  assert.equal(Math.round(luxToPct(100)), 50);
  assert.equal(luxToPct(1e9), 100);
});

test('VibrationMeter: quieto ~0, sacudida alta', () => {
  const still = new VibrationMeter();
  for (let i = 0; i < 100; i++) still.push(0, 0, 1);
  assert.ok(still.take() < 0.005);
  const shake = new VibrationMeter();
  for (let i = 0; i < 100; i++) shake.push(0, 0, 1 + (i % 2 ? 0.5 : -0.5));
  assert.ok(shake.take() > 0.05);
});

test('MagMeter: sin calibrar no hay delta; con imán sube', () => {
  const m = new MagMeter();
  m.push(30, 0, 0);
  assert.equal(m.delta, null);
  m.startCalibration();
  for (let i = 0; i < 10; i++) m.push(30, 0, 0);
  assert.ok(m.finishCalibration());
  for (let i = 0; i < 20; i++) m.push(130, 0, 0);
  assert.ok((m.delta ?? 0) > 60);
});

test('MagMeter: la deriva lenta se absorbe, un imán real no', () => {
  const calibrated = () => {
    const m = new MagMeter();
    m.startCalibration();
    for (let i = 0; i < 20; i++) m.push(30, 0, 0);
    m.finishCalibration();
    return m;
  };
  const drift = calibrated(); // el campo se desplaza 45 µT (como se vio con un iPhone real) y se queda ahí
  for (let i = 0; i < 1500; i++) drift.push(75, 0, 0); // 150 s a 10 Hz
  assert.ok((drift.delta ?? 99) < 10, `deriva no absorbida: ${drift.delta}`);

  const magnet = calibrated(); // un imán de 300 µT durante 5 minutos no debe convertirse en la nueva línea base
  for (let i = 0; i < 3000; i++) magnet.push(330, 0, 0);
  assert.ok((magnet.delta ?? 0) > 250, `imán absorbido: ${magnet.delta}`);
  assert.ok(ADAPT_BAND_UT < 60); // por debajo del umbral de "puerta abierta" del backend
});

test('parsePairing acepta el enlace de aprovisionamiento y rechaza lo demás', () => {
  const link = `https://172.20.10.3:8443/#d=phone-1&b=BUS-7700&k=${'a'.repeat(64)}&n=${'b'.repeat(8)}&t=${'c'.repeat(48)}`;
  assert.deepEqual(parsePairing(link), {
    host: '172.20.10.3:8443', device: 'phone-1', bus: 'BUS-7700',
    keyHex: 'a'.repeat(64), noncePrefixHex: 'b'.repeat(8), token: 'c'.repeat(48),
  });
  assert.equal(parsePairing(link.replace('https', 'http')), null);
  assert.equal(parsePairing(link.replace('k=' + 'a'.repeat(64), 'k=zz')), null);
});

test('buildSample respeta rangos del contrato', () => {
  assert.deepEqual(
    buildSample(5, { light: 140, vib: 0.123456, mag: -5, noise: 200, door: false, battery: 0.5 }),
    { ts: 5, light_pct: 100, vib_rms: 0.1235, mag_delta: 0, noise_db: 140, door_manual: false, battery_pct: 50 },
  );
  assert.deepEqual(buildSample(6, { light: null, battery: -1 }), { ts: 6 });
});
