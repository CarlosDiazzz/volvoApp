import { clamp, round } from './math.ts';

/** Texto plano de una muestra (rangos idénticos al contrato `sample-envelope`). */
export interface Sample {
  ts: number;
  light_pct?: number;
  vib_rms?: number;
  mag_delta?: number;
  noise_db?: number;
  door_manual?: boolean;
  battery_pct?: number;
}

export interface Readings {
  light?: number | null;
  vib?: number | null;
  mag?: number | null;
  noise?: number | null;
  door?: boolean;
  /** Nivel de batería 0..1 (o -1 si no se conoce). */
  battery?: number | null;
}

export function buildSample(ts: number, r: Readings): Sample {
  const s: Sample = { ts };
  if (r.light != null) s.light_pct = round(clamp(r.light, 0, 100), 1);
  if (r.vib != null) s.vib_rms = round(clamp(r.vib, 0, 20), 4);
  if (r.mag != null) s.mag_delta = round(clamp(r.mag, 0, 5000), 1);
  if (r.noise != null) s.noise_db = round(clamp(r.noise, 0, 140), 1);
  if (r.door !== undefined) s.door_manual = r.door;
  if (r.battery != null && r.battery >= 0) s.battery_pct = round(clamp(r.battery * 100, 0, 100), 1);
  return s;
}
