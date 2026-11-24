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
