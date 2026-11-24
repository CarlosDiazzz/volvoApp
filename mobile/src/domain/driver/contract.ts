/**
 * Contrato de telemetría que consume el modo conductor: el mismo que publica el gateway
 * (volvoFirmware/contracts/telemetry.schema.json). La pantalla consume exactamente esta forma, venga del simulador
 * local o, más adelante, del sistema real. Sin dependencias: lo valida `parseTelemetryMessage`.
 */

export const SYSTEMS = ['hvac', 'lighting', 'restroom', 'doors', 'occupancy', 'electrical'] as const;
export type System = (typeof SYSTEMS)[number];

export const QUALITIES = ['ok', 'error', 'not_available', 'stale'] as const;
export type Quality = (typeof QUALITIES)[number];

export interface Signal {
  system: System;
  name: string;
  value: number | boolean | null;
  unit?: string | null;
  quality: Quality;
  ts: string;
}

/** Origen de los datos: siempre visible para el conductor (nunca se mezclan sin etiqueta). */
export type Origin = 'simulated' | 'real';

/** Descripción del vehículo (bloque `vehicle` del mensaje de estado del gateway). */
export interface Vehicle {
  profile: string;
  label: string;
  model: string;
  service: string;
  lengthM: number;
  modules: number;
}

export interface TelemetryMessage {
  schemaVersion: 1;
  type: 'telemetry';
  busId: string;
  source: Origin;
  ts: string;
  signals: Signal[];
}

/** Todo lo que la pantalla necesita en un instante. */
export interface Snapshot {
  busId: string;
  vehicle: Vehicle;
  origin: Origin;
  /** Última lectura de cada señal, por `system/name`. */
  signals: Record<string, Signal>;
  /** Hora local (ms) de la última actualización recibida. */
  receivedAt: number;
}

export const signalKey = (s: Pick<Signal, 'system' | 'name'>): string => `${s.system}/${s.name}`;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isIsoDate = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v)) && /^\d{4}-\d{2}-\d{2}T/.test(v);

export function parseSignal(v: unknown): Signal | null {
  if (!isObject(v)) return null;
  const { system, name, value, unit, quality, ts } = v;
  if (typeof system !== 'string' || !(SYSTEMS as readonly string[]).includes(system)) return null;
  if (typeof name !== 'string' || name.length === 0) return null;
  if (!(value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))) return null;
  if (!(unit === undefined || unit === null || typeof unit === 'string')) return null;
  if (typeof quality !== 'string' || !(QUALITIES as readonly string[]).includes(quality)) return null;
  if (!isIsoDate(ts)) return null;
  return { system: system as System, name, value, unit: unit ?? null, quality: quality as Quality, ts };
}

/** Valida un mensaje `telemetry` del gateway. Si una sola señal no cumple, se rechaza el mensaje completo. */
export function parseTelemetryMessage(v: unknown): TelemetryMessage | null {
  if (!isObject(v)) return null;
  if (v.schemaVersion !== 1 || v.type !== 'telemetry') return null;
  if (typeof v.busId !== 'string' || (v.source !== 'simulated' && v.source !== 'real') || !isIsoDate(v.ts)) return null;
  if (!Array.isArray(v.signals)) return null;
  const signals: Signal[] = [];
  for (const raw of v.signals) {
    const s = parseSignal(raw);
    if (!s) return null;
    signals.push(s);
  }
  return { schemaVersion: 1, type: 'telemetry', busId: v.busId, source: v.source, ts: v.ts, signals };
}

/**
 * Aplica un mensaje de telemetría a la instantánea actual. Si no cumple el contrato o es de otra unidad, se descarta
 * y la pantalla conserva lo último válido (no muestra datos dudosos).
 */
export function applyTelemetry(current: Snapshot, message: unknown, now: number): Snapshot {
  const parsed = parseTelemetryMessage(message);
  if (!parsed || parsed.busId !== current.busId) return current;
  const signals = { ...current.signals };
  for (const s of parsed.signals) signals[signalKey(s)] = s;
  return { ...current, origin: parsed.source, signals, receivedAt: now };
}

/** Fuente de datos del modo conductor. Hoy solo existe la simulada; la real implementará esta misma interfaz. */
export interface TelemetrySource {
  /** Empieza a entregar instantáneas; devuelve la función para detenerse. */
  start(onSnapshot: (snapshot: Snapshot) => void): () => void;
}
