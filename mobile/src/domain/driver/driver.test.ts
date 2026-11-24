import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AC, BATTERY, CATALOG, DOOR_SERVICE, TANK, VIBRATION, alertsOf, buildCards } from './catalog.ts';
import { applyTelemetry, parseSignal, type Snapshot } from './contract.ts';
import { appendHistory, trendOf } from './history.ts';
import {
  AMPS_PER_ZONE,
  COACH_CYCLE,
  INITIAL_DOOR_CYCLES,
  SIGNALS,
  STOP_EVERY,
  VEHICLES,
  initialState,
  seededRandom,
  snapshotOf,
  step,
  toSignals,
  type ProfileId,
  type SimState,
} from './simulated.ts';

type Values = Record<string, number | boolean>;
const PROFILES: ProfileId[] = ['9800-foraneo', '7800e-biarticulado'];

const run = (profile: ProfileId, ticks: number, seed = 7): SimState[] => {
  const rnd = seededRandom(seed);
  const states = [initialState(profile)];
  for (let i = 0; i < ticks; i++) states.push(step(profile, states[states.length - 1]!, rnd));
  return states;
};
const num = (s: SimState, k: string) => s.values[k] as number;
const snap = (profile: ProfileId, values: Values = {}): Snapshot => {
  const s = initialState(profile);
  return snapshotOf(profile, { ...s, values: { ...s.values, ...values } }, 'BUS-1', 0);
};
const card = (profile: ProfileId, id: string, values: Values = {}) => buildCards(profile, snap(profile, values)).find((c) => c.id === id)!;

// ---- contrato ----

const message = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  type: 'telemetry',
  deviceId: 'gw-bus-001',
  busId: 'BUS-7700',
  seq: 12,
  ts: '2026-11-24T10:00:00.000Z',
  source: 'real',
  signals: [
    {
      system: 'hvac',
      name: 'cabin_temp',
      value: 24.5,
      unit: 'C',
      quality: 'ok',
      ts: '2026-11-24T10:00:00.000Z',
      source: { pgn: 65280, sa: 128, node: 'HVAC_NODE' },
    },
  ],
  ...over,
});
const base = (): Snapshot => ({ busId: 'BUS-7700', vehicle: VEHICLES['9800-foraneo'], origin: 'simulated', signals: {}, receivedAt: 0 });

test('contrato: incorpora un mensaje válido del gateway y adopta su origen', () => {
  const next = applyTelemetry(base(), message(), 1000);
  assert.equal(next.signals['hvac/cabin_temp']?.value, 24.5);
  assert.equal(next.origin, 'real');
  assert.equal(next.receivedAt, 1000);
});

test('contrato: descarta mensajes que no cumplen o son de otra unidad', () => {
  const b = base();
  assert.equal(applyTelemetry(b, message({ schemaVersion: 2 }), 1), b);
  assert.equal(applyTelemetry(b, message({ busId: 'OTRO' }), 1), b);
  assert.equal(applyTelemetry(b, { type: 'telemetry' }, 1), b);
  assert.equal(applyTelemetry(b, message({ signals: [{ system: 'motor', name: 'x', value: 1, quality: 'ok', ts: 'x' }] }), 1), b);
  assert.equal(parseSignal({ system: 'hvac', name: 'x', value: Number.NaN, quality: 'ok', ts: '2026-11-24T10:00:00Z' }), null);
});

// ---- simulador ----

test('simulador: determinista con la misma semilla y no modifica el estado recibido', () => {
  assert.deepEqual(run('9800-foraneo', 50).at(-1), run('9800-foraneo', 50).at(-1));
  const s0 = initialState('9800-foraneo');
  const copy = structuredClone(s0);
  step('9800-foraneo', s0, seededRandom(1));
  assert.deepEqual(s0, copy);
});

test('simulador: cada perfil publica todas sus señales y cumplen el contrato', () => {
  for (const profile of PROFILES) {
    for (const s of run(profile, 120)) {
      const signals = toSignals(profile, s, '2026-11-24T10:00:00.000Z');
      assert.equal(signals.length, SIGNALS[profile].length);
      for (const sig of signals) assert.ok(parseSignal(sig), `${profile}: ${sig.name}`);
    }
  }
});

test('simulador 9800: lámpara fundida, vibración alta y luego el A/C deja de enfriar', () => {
  const s = run('9800-foraneo', COACH_CYCLE);
  const zonesOn = (x: SimState) => [1, 2, 3, 4].filter((z) => x.values[`zone${z}_on`] === true).length;
  assert.ok(Math.abs(num(s[40]!, 'current') - zonesOn(s[40]!) * AMPS_PER_ZONE) < 0.5);
  assert.ok(zonesOn(s[90]!) * AMPS_PER_ZONE - num(s[90]!, 'current') > 1.5);
  assert.ok(num(s[100]!, 'vibration_rms') < 0.2);
  assert.ok(num(s[180]!, 'vibration_rms') > 0.3);
  assert.equal(s[230]!.values.compressor_on, false);
  assert.ok(num(s[259]!, 'cabin_temp') > 28);
});

test('simulador 7800e: ciclos de puerta, unidad de clima 2 y caída de 24 V', () => {
  const s = run('7800e-biarticulado', 340);
  assert.equal(num(s[STOP_EVERY * 3]!, 'door_cycles') - INITIAL_DOOR_CYCLES, 15);
  assert.equal(s[150]!.values.unit2_on, false);
  assert.ok(num(s[199]!, 'zone2_temp') - num(s[199]!, 'zone1_temp') > 3);
  assert.equal(s[320]!.values.dcdc_on, false);
  assert.ok(num(s[339]!, 'battery_24v') < 24.5);
});

// ---- historial ----

test('historial: solo lecturas numéricas válidas y tamaño máximo; tendencia con tolerancia', () => {
  const one = (value: number | boolean, quality: 'ok' | 'stale' = 'ok'): Snapshot => ({
    ...base(),
    signals: { 'hvac/x': { system: 'hvac', name: 'x', value, unit: null, quality, ts: '2026-11-24T10:00:00Z' } },
  });
  let h = {};
  for (let i = 1; i <= 5; i++) h = appendHistory(h, one(i), 3);
  h = appendHistory(h, one(true), 3);
  h = appendHistory(h, one(99, 'stale'), 3);
  assert.deepEqual(h, { 'hvac/x': [3, 4, 5] });
  assert.equal(trendOf([...Array(30).fill(10), ...Array(10).fill(12)], 0.5), 'up');
  assert.equal(trendOf([...Array(30).fill(10), ...Array(10).fill(10.2)], 0.5), 'flat');
});

// ---- catálogo de mantenimiento ----

test('catálogo: una tarjeta por componente más la de sensores, en orden fijo y con datos', () => {
  for (const profile of PROFILES) {
    const cards = buildCards(profile, snap(profile));
    assert.deepEqual(
      cards.map((c) => c.id),
      [...CATALOG[profile].map((d) => d.id), 'sensors'],
    );
    assert.ok(cards.every((c) => c.level !== 'unknown'));
  }
});

test('catálogo: omite los datos de tiempo real que no hablan del desgaste', () => {
  const ids = PROFILES.flatMap((p) => buildCards(p, snap(p)).map((c) => c.id));
  for (const id of ['occupancy', 'doors', 'ambient_light', 'restroom', 'cabin_humidity']) assert.ok(!ids.includes(id), id);
});

test('catálogo: umbrales y recomendaciones de cada componente', () => {
  assert.equal(card('9800-foraneo', 'compressor', { vibration_rms: VIBRATION.warn }).level, 'warn');
  assert.equal(card('9800-foraneo', 'ac_performance', { compressor_on: false, cabin_temp: AC.hotCabin }).level, 'crit');
  assert.equal(card('9800-foraneo', 'lighting_circuit', { current: 4.4 }).caption, 'Consumo bajo: posible lámpara fundida');
  assert.equal(card('9800-foraneo', 'tank', { tank_level: TANK.warn }).caption, 'Vaciar en la próxima terminal');
  assert.equal(card('7800e-biarticulado', 'door_service', { door_cycles: DOOR_SERVICE.interval }).value, 'Vencido');
  assert.equal(card('7800e-biarticulado', 'climate_units', { unit2_on: false }).caption, 'Unidad 2 sin funcionar: reportar a mantenimiento');
  assert.equal(card('7800e-biarticulado', 'dcdc', { dcdc_on: false }).level, 'crit');
  assert.equal(card('7800e-biarticulado', 'battery_24v', { battery_24v: BATTERY.warnLow }).level, 'warn');
});

test('catálogo: un sensor que no reporta se avisa y su tarjeta dice «Sin datos»', () => {
  const s = snap('9800-foraneo');
  delete s.signals['restroom/tank_level'];
  const cards = buildCards('9800-foraneo', s);
  const sensors = cards.find((c) => c.id === 'sensors')!;
  assert.equal(sensors.value, '13 de 14');
  assert.equal(sensors.level, 'warn');
  assert.equal(cards.find((c) => c.id === 'tank')!.level, 'unknown');
});

test('catálogo: tendencia desde el historial y avisos del más grave al menos grave', () => {
  const history = { 'hvac/vibration_rms': [...Array(30).fill(0.12), ...Array(10).fill(0.3)] };
  const c = buildCards('9800-foraneo', snap('9800-foraneo'), history).find((x) => x.id === 'compressor')!;
  assert.equal(c.trend?.direction, 'up');
  const cards = buildCards('9800-foraneo', snap('9800-foraneo', { tank_level: 95, vibration_rms: VIBRATION.warn }));
  assert.deepEqual(
    alertsOf(cards).map((x) => x.id),
    ['tank', 'compressor'],
  );
});

import { DEFAULT_PREFS, autoHint, parsePrefs, resolveMode, serializePrefs } from './appearance.ts';

test('Aspecto: el modo automático es claro de día y carbón de noche (hora local)', () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 24, h, m);
  assert.equal(resolveMode('auto', at(6, 59)), 'dark');
  assert.equal(resolveMode('auto', at(7)), 'light');
  assert.equal(resolveMode('auto', at(12)), 'light');
  assert.equal(resolveMode('auto', at(18, 59)), 'light');
  assert.equal(resolveMode('auto', at(19)), 'dark');
  assert.equal(resolveMode('auto', at(0)), 'dark');
});

test('Aspecto: elegir claro u oscuro manda sobre la hora', () => {
  const noche = new Date(2026, 10, 24, 23);
  const dia = new Date(2026, 10, 24, 12);
  assert.equal(resolveMode('light', noche), 'light');
  assert.equal(resolveMode('dark', dia), 'dark');
});

test('Aspecto: las preferencias guardadas se leen sin confiar en ellas', () => {
  assert.deepEqual(parsePrefs(null), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs('no es json'), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs('42'), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs('{"mode":"neón","view":"x"}'), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs('{"mode":"dark","view":"minimal","extra":1}'), { mode: 'dark', view: 'minimal' });
  assert.deepEqual(parsePrefs(serializePrefs({ mode: 'light', view: 'full' })), { mode: 'light', view: 'full' });
});

test('Aspecto: el aviso del modo automático dice a qué hora cambia', () => {
  assert.match(autoHint(new Date(2026, 10, 24, 12)), /19:00/);
  assert.match(autoHint(new Date(2026, 10, 24, 22)), /7:00/);
});

import { nextMode } from './appearance.ts';

test('Aspecto: el botón rápido recorre automático → claro → carbón → automático', () => {
  assert.equal(nextMode('auto'), 'light');
  assert.equal(nextMode('light'), 'dark');
  assert.equal(nextMode('dark'), 'auto');
});

import { REPEAT, actualOf, isTap, nearestVirtual, recenter, startVirtual } from './carousel.ts';

test('Carrusel: se empieza en el bloque central y el componente real no cambia', () => {
  for (const n of [1, 2, 6, 7]) for (let i = 0; i < n; i++) assert.equal(actualOf(startVirtual(n, i), n), i);
  assert.equal(startVirtual(6, 0), Math.floor(REPEAT / 2) * 6);
});

test('Carrusel: es infinito, al pasar el último se vuelve al primero (y al revés)', () => {
  const n = 6;
  assert.equal(actualOf(startVirtual(n, n - 1) + 1, n), 0);
  assert.equal(actualOf(startVirtual(n, 0) - 1, n), n - 1);
});

test('Carrusel: cerca de un borde salta al centro sin cambiar de componente', () => {
  const n = 6;
  for (let v = 0; v < REPEAT * n; v++) {
    const r = recenter(v, n);
    assert.equal(actualOf(r, n), actualOf(v, n), `v=${v}`);
    assert.ok(r >= n && r < (REPEAT - 1) * n, `v=${v} → ${r} debe quedar en la banda central`);
  }
  assert.equal(recenter(startVirtual(n, 2), n), startVirtual(n, 2));
});

test('Carrusel: ir a un componente toma el camino más corto', () => {
  const n = 6;
  const from = startVirtual(n, 5); // en el último
  assert.equal(nearestVirtual(from, n, 0), from + 1); // el siguiente es el primero: un paso adelante, no cinco atrás
  assert.equal(nearestVirtual(startVirtual(n, 0), n, 5), startVirtual(n, 0) - 1);
  assert.equal(nearestVirtual(from, n, 5), from);
});

test('Carrusel: un deslizamiento no cuenta como toque', () => {
  assert.equal(isTap({ x: 100, y: 100, t: 0 }, { x: 103, y: 102, t: 120 }), true);
  assert.equal(isTap({ x: 100, y: 100, t: 0 }, { x: 240, y: 104, t: 150 }), false, 'se movió: es un swipe');
  assert.equal(isTap({ x: 100, y: 100, t: 0 }, { x: 101, y: 100, t: 900 }), false, 'pulsación larga');
});

import { ALERT_VISIBLE_S, alertKeyOf } from './appearance.ts';

test('Aviso: el mismo aviso con la misma gravedad no reaparece; si empeora, sí', () => {
  assert.equal(alertKeyOf(undefined), null);
  assert.equal(alertKeyOf({ id: 'hvac', level: 'warn' }), alertKeyOf({ id: 'hvac', level: 'warn' }));
  assert.notEqual(alertKeyOf({ id: 'hvac', level: 'warn' }), alertKeyOf({ id: 'hvac', level: 'crit' }));
  assert.notEqual(alertKeyOf({ id: 'hvac', level: 'warn' }), alertKeyOf({ id: 'doors', level: 'warn' }));
  assert.ok(ALERT_VISIBLE_S >= 4 && ALERT_VISIBLE_S <= 15, 'el aviso debe verse el tiempo suficiente para leerlo');
});

import { NO_SENSORS, appendPhoneHistory, approxSpl, buildPhoneCards, dbfsOf, ema, rms, type PhoneReadings } from './phone.ts';
import { statusOf } from './catalog.ts';

const AT = '2026-11-24T20:00:00.000Z';
const readings = (over: Partial<PhoneReadings> = {}): PhoneReadings => ({
  vibration: 0.02, gyroDps: 3, magDelta: 4, tiltDeg: 2, pressureHpa: 1013.2, lux: 120, noiseDb: 55, battery: 0.8, at: AT, ...over,
});
const ALL = { accel: true, gyro: true, mag: true, baro: true, light: true, motion: true, mic: 'granted' as const };

test('Teléfono: el nivel de sonido sale del PCM (RMS → dBFS → dB estimados)', () => {
  assert.equal(rms([]), 0);
  assert.ok(Math.abs(rms([0.5, -0.5, 0.5, -0.5]) - 0.5) < 1e-9);
  const sine = Array.from({ length: 4800 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / 48000));
  assert.ok(Math.abs(rms(sine) - 0.5 / Math.SQRT2) < 1e-3, 'el RMS de una senoide es A/√2');
  assert.equal(dbfsOf(1), 0);
  assert.ok(Math.abs(dbfsOf(0.1) - -20) < 1e-9);
  assert.equal(approxSpl(dbfsOf(0)), 0, 'el silencio total no da dB negativos');
  assert.equal(approxSpl(0), 100);
  assert.equal(approxSpl(50), 120, 'tope en 120');
  assert.equal(ema(null, 40, 0.3), 40);
  assert.equal(ema(40, 50, 0.5), 45);
});

test('Teléfono: sin permiso del micrófono la tarjeta de sonido lo dice y no inventa un número', () => {
  const cards = buildPhoneCards(readings({ noiseDb: null }), {}, { ...ALL, mic: 'denied' });
  const noise = cards.find((c) => c.id === 'noise')!;
  assert.equal(noise.level, 'unknown');
  assert.equal(noise.value, '—');
  assert.match(noise.caption, /Permite el micrófono/);
});

test('Teléfono: el ruido de la cabina sube de nivel con los umbrales', () => {
  const level = (db: number) => buildPhoneCards(readings({ noiseDb: db }), {}, ALL).find((c) => c.id === 'noise')!.level;
  assert.equal(level(55), 'ok');
  assert.equal(level(82), 'warn');
  assert.equal(level(95), 'crit');
});

test('Teléfono: solo hay tarjetas de los sensores que el equipo tiene', () => {
  const iphone = buildPhoneCards(readings(), {}, { ...ALL, light: false }).map((c) => c.id);
  assert.ok(!iphone.includes('light'), 'iOS no expone el sensor de luz');
  assert.ok(iphone.includes('noise') && iphone.includes('pressure') && iphone.includes('battery'));
  const bare = buildPhoneCards(readings({ battery: null }), {}, { ...NO_SENSORS, mic: 'unavailable' }).map((c) => c.id);
  assert.deepEqual(bare, ['noise'], 'sin sensores solo queda el sonido, explicando por qué no hay dato');
});

test('Teléfono: el estado usa palabras de sensor, no de mantenimiento', () => {
  const cards = buildPhoneCards(readings({ battery: 0.08, vibration: 0.5 }), {}, ALL);
  assert.equal(statusOf(cards.find((c) => c.id === 'battery')!), 'Alto');
  assert.equal(cards.find((c) => c.id === 'battery')!.level, 'crit');
  assert.equal(statusOf(cards.find((c) => c.id === 'vibration')!), 'Alto');
  assert.equal(statusOf(cards.find((c) => c.id === 'pressure')!), 'Normal');
});

test('Teléfono: el imán se declara cerca solo sobre la banda y calibra antes de medir', () => {
  const magnet = (d: number | null) => buildPhoneCards(readings({ magDelta: d }), {}, ALL).find((c) => c.id === 'magnet')!;
  assert.equal(magnet(null).level, 'unknown');
  assert.match(magnet(null).caption, /Calibrando/);
  assert.equal(magnet(20).caption, 'Sin imán cerca');
  assert.equal(magnet(300).caption, 'Imán cerca (puerta)');
});

test('Teléfono: el historial guarda lo numérico y se acota', () => {
  let h = {};
  for (let i = 0; i < 400; i++) h = appendPhoneHistory(h, readings({ noiseDb: i, lux: null }));
  const noise = (h as Record<string, number[]>).noiseDb!;
  assert.equal(noise.length, 180);
  assert.equal(noise.at(-1), 399);
  assert.equal((h as Record<string, number[]>).lux, undefined, 'lo que no se midió no se guarda');
});

import { STATE_TEXT, TABS, buildSensorRows } from '../sensorInfo.ts';

test('Sensores: la vista lista todos y dice cuáles viajan al sistema y cuáles solo se ven en el teléfono', () => {
  const rows = buildSensorRows(readings(), ALL, true);
  const sent = rows.filter((r) => r.sent).map((r) => r.id);
  assert.deepEqual(sent, ['vibration', 'magnet', 'light', 'battery'], 'solo los cuatro del contrato viajan cifrados');
  for (const id of ['noise', 'gyro', 'tilt', 'pressure']) assert.equal(rows.find((r) => r.id === id)!.sent, false, id);
  assert.equal(rows.length, 8);
});

test('Sensores: lo que el equipo no tiene se muestra como no disponible, no se oculta', () => {
  const rows = buildSensorRows(readings({ lux: null }), { ...ALL, light: false }, true);
  assert.equal(rows.find((r) => r.id === 'light')!.state, 'unavailable');
  assert.equal(STATE_TEXT.unavailable, 'No disponible');
});

test('Sensores: el micrófono no se enciende solo y explica cada estado', () => {
  const noise = (enabled: boolean, mic: PhoneAvailabilityMic, db: number | null) => buildSensorRows(readings({ noiseDb: db }), { ...ALL, mic }, enabled).find((r) => r.id === 'noise')!;
  assert.equal(noise(false, 'granted', 60).state, 'off');
  assert.equal(noise(true, 'denied', null).state, 'denied');
  assert.match(noise(true, 'denied', null).value, /Permite el micrófono/);
  assert.equal(noise(true, 'pending', null).state, 'pending');
  assert.equal(noise(true, 'granted', null).state, 'waiting');
  assert.equal(noise(true, 'granted', 61.4).value, '≈ 61 dB');
});

test('Sensores: la navegación tiene tres vistas separadas', () => {
  assert.deepEqual(TABS.map((t) => t.id), ['inicio', 'sensores', 'ajustes']);
});

type PhoneAvailabilityMic = 'pending' | 'granted' | 'denied' | 'unavailable';
