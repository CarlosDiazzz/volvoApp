import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { BlockCounter, CounterStateError, type KeyValueStore } from './counter.ts';
import { buildAad, buildNonce, encryptBytes, encryptSample, hexToBytes } from './envelope.ts';
import { ADAPT_BAND_UT, MagMeter, VibrationMeter, luxToPct } from './measure.ts';
import { buildPairingLink, parsePairing, parsePairingQr, parseRedeemed } from './pairing.ts';
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

test('parsePairingQr acepta solo el formato del tablero y nunca claves', () => {
  const code = 'A'.repeat(32);
  assert.deepEqual(parsePairingQr(`volvopair://10.35.11.211:8444/${code}`), { host: '10.35.11.211:8444', code });
  assert.deepEqual(parsePairingQr(` volvopair://laptop.local:8444/${code} \n`), { host: 'laptop.local:8444', code });
  for (const bad of ['', 'https://x/' + code, `volvopair://h/${code}x`, 'volvopair://h/corto', `volvopair://h:99999999/${code}`, `volvopair://h@evil.com/${code}`, `volvopair://h/${code}/../x`]) {
    assert.equal(parsePairingQr(bad), null, bad);
  }
});

test('parseRedeemed valida estrictamente la respuesta del servidor y arma el enlace histórico', () => {
  const good = { device: 'phone-2', bus: 'BUS-7700', keyHex: 'a'.repeat(64), noncePrefixHex: 'b'.repeat(8), token: 'c'.repeat(48), bridgePort: 8443 };
  assert.deepEqual(parseRedeemed(good), good);
  for (const bad of [null, 'x', {}, { ...good, keyHex: 'zz' }, { ...good, device: 'Phone 2' }, { ...good, bridgePort: 0 }, { ...good, bridgePort: '8443' }, { ...good, token: 'x' }]) {
    assert.equal(parseRedeemed(bad), null);
  }
  const link = buildPairingLink('10.35.11.211:8444', good);
  assert.equal(link, `https://10.35.11.211:8443/#d=phone-2&b=BUS-7700&k=${'a'.repeat(64)}&n=${'b'.repeat(8)}&t=${'c'.repeat(48)}`);
  assert.deepEqual(parsePairing(link)?.host, '10.35.11.211:8443'); // el puente usa su propio puerto, no el del tablero
});

// --- cola de envío con entrega confirmada ---------------------------------------------------
import { SendQueue, parseBridgeReply } from './queue.ts';

const item = (ctr: number) => ({ ctr, json: `{"v":1,"ctr":${ctr}}` });

test('SendQueue envía en orden, solo borra con ack y reenvía lo no confirmado tras reconectar', () => {
  const q = new SendQueue();
  for (const c of [1, 2, 3, 4]) assert.equal(q.enqueue(item(c)), true);
  let cursor = -1;
  const sent: number[] = [];
  for (let i = 0; i < 3; i++) {
    const n = q.next(cursor)!;
    sent.push(n.ctr);
    cursor = n.ctr;
  }
  assert.deepEqual(sent, [1, 2, 3]);
  assert.equal(q.inFlight(cursor), 3);
  assert.equal(q.ack(2), 2); // acumulativo: confirma 1 y 2
  assert.equal(q.length, 2);
  // se corta el enlace: el cursor de la conexión se reinicia y se reenvía desde lo no confirmado
  assert.equal(q.next(-1)!.ctr, 3);
  assert.equal(q.ack(4), 2);
  assert.equal(q.length, 0);
});

test('SendQueue exige contadores crecientes y descarta las más antiguas si se desborda (contándolas)', () => {
  const q = new SendQueue(3);
  assert.equal(q.enqueue(item(5)), true);
  assert.equal(q.enqueue(item(5)), false); // repetido
  assert.equal(q.enqueue(item(4)), false); // fuera de orden
  assert.equal(q.enqueue(item(-1)), false);
  assert.equal(q.enqueue({ ctr: 1.5, json: '{}' }), false);
  for (const c of [6, 7, 8, 9]) q.enqueue(item(c));
  assert.equal(q.length, 3);
  assert.equal(q.dropped, 2);
  assert.equal(q.oldestCtr, 7);
});

test('SendQueue se respalda y restaura; un respaldo dañado se ignora sin romper', () => {
  const q = new SendQueue(10);
  for (const c of [10, 11, 12]) q.enqueue(item(c));
  q.ack(10);
  const back = SendQueue.restore(q.serialize(), 10);
  assert.equal(back.length, 2);
  assert.equal(back.oldestCtr, 11);
  for (const bad of [null, undefined, '', 'no json', '[]', '{"v":2,"items":[]}', '{"v":1,"items":"x"}', '{"v":1,"items":[{"ctr":"1","json":"{}"},{"ctr":3,"json":"' + 'x'.repeat(3000) + '"}]}']) {
    assert.equal(SendQueue.restore(bad as string).length, 0);
  }
  const mixed = SendQueue.restore('{"v":1,"dropped":4,"items":[{"ctr":2,"json":"{}"},{"ctr":1,"json":"{}"},{"ctr":3,"json":"{}"}]}');
  assert.deepEqual([mixed.length, mixed.dropped], [2, 4]); // el elemento fuera de orden se descarta
});

test('parseBridgeReply interpreta ok, ack y nack y descarta lo demás', () => {
  assert.deepEqual(parseBridgeReply('{"ok":true}'), { kind: 'ok' });
  assert.deepEqual(parseBridgeReply('{"ack":42}'), { kind: 'ack', ctr: 42 });
  assert.deepEqual(parseBridgeReply('{"nack":7,"reason":"unavailable"}'), { kind: 'nack', ctr: 7 });
  for (const bad of ['', 'x', '{}', '{"ack":"1"}', '{"ack":-1}', '{"ack":1.5}', '{"ok":false}', '[]']) assert.equal(parseBridgeReply(bad), null);
});

import { Deadband, DEFAULT_DEADBAND } from './deadband.ts';

test('Deadband: la primera lectura y un cambio de puerta se envían siempre', () => {
  const d = new Deadband();
  assert.equal(d.shouldSend(0, { vib: 0.01, mag: 10, light: 50, door: false }), true);
  assert.equal(d.shouldSend(100, { vib: 0.01, mag: 10, light: 50, door: false }), false);
  assert.equal(d.shouldSend(200, { vib: 0.01, mag: 10, light: 50, door: true }), true);
});

test('Deadband: lo que cambia menos que la banda se omite y se cuenta', () => {
  const d = new Deadband();
  d.shouldSend(0, { vib: 0.01, mag: 10, light: 50, door: false });
  assert.equal(d.shouldSend(500, { vib: 0.02, mag: 20, light: 53, door: false }), false);
  assert.equal(d.skipped, 1);
});

test('Deadband: cada sensor que supera su banda dispara el envío', () => {
  const base = { vib: 0.01, mag: 10, light: 50, door: false };
  for (const change of [{ vib: 0.2 }, { mag: 60 }, { light: 70 }]) {
    const d = new Deadband();
    d.shouldSend(0, base);
    assert.equal(d.shouldSend(100, { ...base, ...change }), true, JSON.stringify(change));
  }
});

test('Deadband: compara con lo último enviado, así un cambio lento acaba enviándose', () => {
  const d = new Deadband();
  d.shouldSend(0, { vib: 0, mag: 0, light: 50, door: false });
  let sent = 0;
  for (let i = 1; i <= 10; i++) {
    if (d.shouldSend(i * 100, { vib: 0, mag: 0, light: 50 + i, door: false })) sent++; // +1 punto por paso: 6 supera la banda de 5
  }
  assert.ok(sent >= 1, 'un deslizamiento sostenido debe acabar superando el umbral');
});

test('Deadband: el latido garantiza una muestra aunque nada cambie', () => {
  const d = new Deadband();
  const r = { vib: 0, mag: 5, light: 40, door: false };
  d.shouldSend(0, r);
  assert.equal(d.shouldSend(DEFAULT_DEADBAND.heartbeatMs - 1, r), false);
  assert.equal(d.shouldSend(DEFAULT_DEADBAND.heartbeatMs, r), true);
  assert.ok(DEFAULT_DEADBAND.heartbeatMs < 5000, 'el latido debe ser menor que el hueco mínimo de la confiabilidad (5 s)');
});

test('Deadband: un sensor que aparece o desaparece es un cambio; reset reinicia', () => {
  const d = new Deadband();
  d.shouldSend(0, { vib: 0, mag: null, light: null, door: false });
  assert.equal(d.shouldSend(100, { vib: 0, mag: null, light: null, door: false }), false);
  assert.equal(d.shouldSend(200, { vib: 0, mag: 12, light: null, door: false }), true);
  d.reset();
  assert.equal(d.skipped, 0);
  assert.equal(d.shouldSend(300, { vib: 0, mag: 12, light: null, door: false }), true);
});
