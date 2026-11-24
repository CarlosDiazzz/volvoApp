import type { Signal, Snapshot, System, TelemetrySource, Vehicle } from './contract.ts';
import { signalKey } from './contract.ts';

/**
 * Simulador local de la telemetría de carrocería. Reproduce los mismos perfiles de vehículo que volvoFirmware
 * (src/vbody/profiles.py) y los mismos nombres de señal, con una historia corta que se repite para que la demo
 * muestre estados normales y avisos:
 *
 * - 9800 foráneo (ciclo de 5 min): una lámpara se funde (1:00), la vibración del compresor sube (2:30), luego el
 *   A/C deja de enfriar y la cabina se calienta (3:20); el tanque del sanitario se llena hasta pedir vaciado.
 * - 7800 Electric biarticulado (ciclo de 6:40, paradas cada 40 s): falla la unidad de clima 2 (2:00), el
 *   convertidor DC/DC se apaga y la batería de 24 V se descarga (5:00); las puertas acumulan ciclos hasta su
 *   servicio. También simula pasajeros y puertas, aunque la pantalla de mantenimiento no los muestra.
 *
 * Todo es determinista dado un generador aleatorio: las pruebas usan una semilla fija.
 */

export type ProfileId = '9800-foraneo' | '7800e-biarticulado';

export const VEHICLES: Record<ProfileId, Vehicle> = {
  '9800-foraneo': {
    profile: '9800-foraneo',
    label: 'Nuevo Volvo 9800 · foráneo 6x2',
    model: 'Volvo 9800',
    service: 'foráneo',
    lengthM: 14,
    modules: 1,
  },
  '7800e-biarticulado': {
    profile: '7800e-biarticulado',
    label: 'Volvo 7800 Electric · biarticulado',
    model: 'Volvo 7800 Electric',
    service: 'urbano',
    lengthM: 25.6,
    modules: 3,
  },
};

export const isProfileId = (v: string | null | undefined): v is ProfileId => v === '9800-foraneo' || v === '7800e-biarticulado';

/** Generador pseudoaleatorio con semilla (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (rnd: () => number): number => {
  const u = Math.max(rnd(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
};
const approach = (cur: number, target: number, rate: number) => cur + (target - cur) * rate;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, digits = 1) => Number(v.toFixed(digits));

export type Values = Record<string, number | boolean>;
export interface SimState {
  tick: number;
  values: Values;
  /** Variables internas que no se publican (temporizadores, etc.). */
  hidden: Record<string, number>;
}

interface SignalDef {
  system: System;
  name: string;
  unit: string | null;
}
const def = (system: System, name: string, unit: string | null = null): SignalDef => ({
  system,
  name,
  unit,
});

export const SIGNALS: Record<ProfileId, SignalDef[]> = {
  '9800-foraneo': [
    def('hvac', 'cabin_temp', 'C'),
    def('hvac', 'cabin_humidity', '%'),
    def('hvac', 'compressor_on'),
    def('hvac', 'fan_on'),
    def('hvac', 'vibration_rms', 'g'),
    def('lighting', 'zone1_on'),
    def('lighting', 'zone2_on'),
    def('lighting', 'zone3_on'),
    def('lighting', 'zone4_on'),
    def('lighting', 'current', 'A'),
    def('lighting', 'ambient_light', '%'),
    def('restroom', 'door_open'),
    def('restroom', 'occupied'),
    def('restroom', 'tank_level', '%'),
  ],
  '7800e-biarticulado': [
    def('hvac', 'zone1_temp', 'C'),
    def('hvac', 'zone2_temp', 'C'),
    def('hvac', 'zone3_temp', 'C'),
    def('hvac', 'cabin_humidity', '%'),
    def('hvac', 'unit1_on'),
    def('hvac', 'unit2_on'),
    def('hvac', 'unit3_on'),
    def('lighting', 'module1_on'),
    def('lighting', 'module2_on'),
    def('lighting', 'module3_on'),
    def('lighting', 'current', 'A'),
    def('lighting', 'ambient_light', '%'),
    def('doors', 'door1_open'),
    def('doors', 'door2_open'),
    def('doors', 'door3_open'),
    def('doors', 'door4_open'),
    def('doors', 'door5_open'),
    def('doors', 'door_cycles'),
    def('occupancy', 'm1_passengers', 'pax'),
    def('occupancy', 'm2_passengers', 'pax'),
    def('occupancy', 'm3_passengers', 'pax'),
    def('occupancy', 'm1_load', '%'),
    def('occupancy', 'm2_load', '%'),
    def('occupancy', 'm3_load', '%'),
    def('electrical', 'battery_24v', 'V'),
    def('electrical', 'dcdc_on'),
    def('electrical', 'dcdc_current', 'A'),
    def('electrical', 'dcdc_temp', 'C'),
  ],
};

/** Duración de la historia del 9800 (ticks de 1 s). */
export const COACH_CYCLE = 300;
/** Cada cuántos ticks llega el biarticulado a una parada, y cuánto dura detenido. */
export const STOP_EVERY = 40;
export const STOP_TICKS = 8;
/** Pasajeros por módulo que corresponden al 100 % de carga. */
export const MODULE_CAPACITY = 50;
/** Consumo nominal de iluminación: por zona (9800) y por módulo (7800e). */
export const AMPS_PER_ZONE = 2.1;
export const AMPS_PER_MODULE = 3.2;
/** Duración de la historia del 7800e (ticks de 1 s). */
export const URBAN_CYCLE = 400;
/** Ciclos de puerta con los que arranca la simulación (cerca del servicio, para la demo). */
export const INITIAL_DOOR_CYCLES = 8960;

export function initialState(profile: ProfileId): SimState {
  if (profile === '9800-foraneo') {
    return {
      tick: 0,
      values: {
        cabin_temp: 23.6,
        cabin_humidity: 54,
        compressor_on: true,
        fan_on: true,
        vibration_rms: 0.12,
        zone1_on: true,
        zone2_on: true,
        zone3_on: true,
        zone4_on: false,
        current: 6.3,
        ambient_light: 70,
        door_open: false,
        occupied: false,
        tank_level: 62,
      },
      hidden: { doorTimer: 0 },
    };
  }
  return {
    tick: 0,
    values: {
      zone1_temp: 23.2,
      zone2_temp: 23.5,
      zone3_temp: 23.8,
      cabin_humidity: 52,
      unit1_on: true,
      unit2_on: true,
      unit3_on: true,
      module1_on: true,
      module2_on: true,
      module3_on: true,
      current: 9.6,
      ambient_light: 70,
      door1_open: false,
      door2_open: false,
      door3_open: false,
      door4_open: false,
      door5_open: false,
      m1_passengers: 18,
      m2_passengers: 24,
      m3_passengers: 12,
      door_cycles: INITIAL_DOOR_CYCLES,
      m1_load: 36,
      m2_load: 48,
      m3_load: 24,
      battery_24v: 27.6,
      dcdc_on: true,
      dcdc_current: 38,
      dcdc_temp: 46,
    },
    hidden: {},
  };
}

const num = (v: Values, k: string): number => {
  const x = v[k];
  return typeof x === 'number' ? x : 0;
};

function stepCoach(s: SimState, rnd: () => number): SimState {
  const tick = s.tick + 1;
  const phase = tick % COACH_CYCLE;
  const v = { ...s.values };
  const hidden = { ...s.hidden };

  // Historia del A/C: vibración alta (150–200 s) y después el compresor deja de enfriar (200–260 s).
  const compressor = !(phase >= 200 && phase < 260);
  const vibrating = phase >= 150 && phase < 200;
  v.compressor_on = compressor;
  v.fan_on = true;
  v.cabin_temp = round(approach(num(v, 'cabin_temp'), compressor ? 24 : 31, 0.06) + gauss(rnd) * 0.04);
  v.cabin_humidity = round(clamp(approach(num(v, 'cabin_humidity'), compressor ? 54 : 68, 0.05) + gauss(rnd) * 0.3, 0, 100), 0);
  v.vibration_rms = round(Math.max(0, (vibrating ? 0.36 : 0.12) + gauss(rnd) * 0.01), 3);

  // Luz ambiente: ciclo lento de día a noche; la zona 4 se enciende cuando oscurece.
  v.ambient_light = round(clamp(50 + 35 * Math.cos((2 * Math.PI * tick) / 600) + gauss(rnd), 0, 100), 0);
  v.zone4_on = num(v, 'ambient_light') < 35;
  const zonesOn = [1, 2, 3, 4].filter((z) => v[`zone${z}_on`] === true).length;
  // Lámpara fundida en la zona 2 (60–120 s): la zona sigue encendida pero consume menos.
  const burntLamp = phase >= 60 && phase < 120;
  v.current = round(Math.max(0, AMPS_PER_ZONE * zonesOn - (burntLamp ? 1.9 : 0) + gauss(rnd) * 0.05), 2);

  // Sanitario: alguien entra o sale de vez en cuando; la puerta queda abierta unos segundos.
  if (rnd() < 0.03) {
    v.occupied = !v.occupied;
    hidden.doorTimer = 3;
  }
  hidden.doorTimer = Math.max(0, (hidden.doorTimer ?? 0) - 1);
  v.door_open = (hidden.doorTimer ?? 0) > 0;

  // El tanque se llena poco a poco; al rebasar 96 % se vacía en la terminal.
  const tank = num(v, 'tank_level') + 0.1;
  v.tank_level = round(tank >= 96 ? 20 : tank);

  return { tick, values: v, hidden };
}

function stepUrban(s: SimState, rnd: () => number): SimState {
  const tick = s.tick + 1;
  const v = { ...s.values };
  const stopPhase = tick % STOP_EVERY;
  const atStop = stopPhase < STOP_TICKS;

  // Puertas: abren al llegar a la parada y cierran antes de arrancar (la 5 cierra al final).
  // Cada apertura suma un ciclo, igual que el nodo DOOR_NODE del firmware.
  let cycles = num(v, 'door_cycles');
  for (let d = 1; d <= 5; d++) {
    const closeAt = d === 5 ? STOP_TICKS - 1 : STOP_TICKS - 2;
    const open = stopPhase >= 1 && stopPhase < closeAt;
    if (open && v[`door${d}_open`] !== true) cycles += 1;
    v[`door${d}_open`] = open;
  }
  v.door_cycles = cycles;

  // Pasajeros: suben y bajan mientras las puertas están abiertas. A la mitad del recorrido hay hora pico.
  const rush = Math.floor(tick / (STOP_EVERY * 4)) % 2 === 1;
  for (let m = 1; m <= 3; m++) {
    let pax = num(v, `m${m}_passengers`);
    if (atStop && v.door1_open === true) {
      const up = Math.floor(rnd() * (rush ? 6 : 3));
      const down = Math.floor(rnd() * (rush ? 2 : 4));
      pax = clamp(pax + up - down, 0, Math.round(MODULE_CAPACITY * 1.2));
    }
    v[`m${m}_passengers`] = pax;
    v[`m${m}_load`] = Math.round((pax / MODULE_CAPACITY) * 100);
  }

  // Clima por módulo: con puertas abiertas entra aire caliente. La unidad 2 falla entre 2:00 y 3:20 de cada
  // ciclo de 6:40 y su módulo se calienta.
  const cycle = tick % URBAN_CYCLE;
  const unit2Down = cycle >= 120 && cycle < 200;
  v.unit1_on = true;
  v.unit2_on = !unit2Down;
  v.unit3_on = true;
  const doorsOpen = [1, 2, 3, 4, 5].some((d) => v[`door${d}_open`] === true);
  for (let z = 1; z <= 3; z++) {
    const target = z === 2 && unit2Down ? 29.5 : (doorsOpen ? 26 : 23) + (z - 2) * 0.3;
    v[`zone${z}_temp`] = round(approach(num(v, `zone${z}_temp`), target, 0.08) + gauss(rnd) * 0.04);
  }
  v.cabin_humidity = round(clamp(52 + gauss(rnd) * 0.6, 0, 100), 0);

  v.ambient_light = round(clamp(50 + 35 * Math.cos((2 * Math.PI * tick) / 600) + gauss(rnd), 0, 100), 0);
  const modulesOn = [1, 2, 3].filter((m) => v[`module${m}_on`] === true).length;
  v.current = round(AMPS_PER_MODULE * modulesOn + gauss(rnd) * 0.08, 2);

  // Sistema de 24 V: el convertidor DC/DC se apaga entre 5:00 y 5:40 de cada ciclo y la batería se descarga
  // (como en el firmware: sin DC/DC el voltaje cae hacia ~24 V).
  const dcdcDown = cycle >= 300 && cycle < 340;
  const load = (num(v, 'm1_load') + num(v, 'm2_load') + num(v, 'm3_load')) / 3;
  v.dcdc_on = !dcdcDown;
  v.battery_24v = round(approach(num(v, 'battery_24v'), dcdcDown ? 23.6 : 27.6, dcdcDown ? 0.06 : 0.15) + gauss(rnd) * 0.03, 2);
  v.dcdc_current = dcdcDown ? 0 : round(30 + load * 0.2 + gauss(rnd) * 0.4);
  v.dcdc_temp = round(approach(num(v, 'dcdc_temp'), dcdcDown ? 30 : 42 + load * 0.15, 0.05) + gauss(rnd) * 0.05);

  return { tick, values: v, hidden: s.hidden };
}

/** Avanza un segundo de simulación. Pura: no modifica el estado recibido. */
export function step(profile: ProfileId, state: SimState, rnd: () => number): SimState {
  return profile === '9800-foraneo' ? stepCoach(state, rnd) : stepUrban(state, rnd);
}

/** Convierte el estado a señales del contrato. */
export function toSignals(profile: ProfileId, state: SimState, ts: string): Signal[] {
  return SIGNALS[profile].map((d) => ({
    system: d.system,
    name: d.name,
    value: state.values[d.name] ?? null,
    unit: d.unit,
    quality: 'ok',
    ts,
  }));
}

export function snapshotOf(profile: ProfileId, state: SimState, busId: string, now: number): Snapshot {
  const ts = new Date(now).toISOString();
  const signals: Snapshot['signals'] = {};
  for (const s of toSignals(profile, state, ts)) signals[signalKey(s)] = s;
  return { busId, vehicle: VEHICLES[profile], origin: 'simulated', signals, receivedAt: now };
}

export interface SimulatedOptions {
  profile: ProfileId;
  busId?: string;
  intervalMs?: number;
  seed?: number;
  now?: () => number;
}

export function createSimulatedSource({
  profile,
  busId = profile === '9800-foraneo' ? 'BUS-7700' : 'BUS-7800E',
  intervalMs = 1000,
  seed = Date.now(),
  now = Date.now,
}: SimulatedOptions): TelemetrySource {
  return {
    start(onSnapshot) {
      const rnd = seededRandom(seed);
      let state = initialState(profile);
      onSnapshot(snapshotOf(profile, state, busId, now()));
      const timer = setInterval(() => {
        state = step(profile, state, rnd);
        onSnapshot(snapshotOf(profile, state, busId, now()));
      }, intervalMs);
      return () => clearInterval(timer);
    },
  };
}
