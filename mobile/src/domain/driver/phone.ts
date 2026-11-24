import type { Card, Level } from './catalog.ts';

/**
 * Lecturas de los sensores del propio teléfono y las tarjetas que se muestran con ellas (origen REAL). Lógica pura: lo que cambia
 * entre iOS y Android es solo qué sensores existen (`PhoneAvailability`). Sin ubicación y sin cámara: no se necesitan y no se piden.
 */

export interface PhoneReadings {
  /** Vibración (RMS en g) del acelerómetro sin gravedad. */
  vibration: number | null;
  /** Giro total del giroscopio en °/s. */
  gyroDps: number | null;
  /** Variación del campo magnético (µT) respecto de la línea base; nulo mientras calibra. */
  magDelta: number | null;
  /** Inclinación (°): la mayor entre cabeceo y alabeo. */
  tiltDeg: number | null;
  pressureHpa: number | null;
  lux: number | null;
  /** Nivel de sonido estimado (dB, sin calibrar). */
  noiseDb: number | null;
  /** Batería 0–1. */
  battery: number | null;
  /** Hora (ISO) de esta lectura. */
  at: string;
}

export type MicState = 'pending' | 'granted' | 'denied' | 'unavailable';

export interface PhoneAvailability {
  accel: boolean;
  gyro: boolean;
  mag: boolean;
  baro: boolean;
  light: boolean;
  motion: boolean;
  mic: MicState;
}

export const NO_SENSORS: PhoneAvailability = { accel: false, gyro: false, mag: false, baro: false, light: false, motion: false, mic: 'pending' };

// ---- Sonido: del PCM del micrófono a un nivel en dB ----

/** Valor eficaz de un bloque de muestras (-1..1). */
export function rms(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!;
  return Math.sqrt(sum / samples.length);
}

/** Nivel respecto del máximo digital (dBFS): 0 es el techo y el silencio total tiende a -140. */
export const dbfsOf = (valueRms: number): number => 20 * Math.log10(Math.max(valueRms, 1e-7));

/**
 * Estimación del nivel de presión sonora a partir de dBFS. El micrófono de un teléfono NO está calibrado (cada modelo y su control
 * automático de ganancia cambian el resultado): es una referencia relativa, no un sonómetro. Por eso la interfaz dice «≈».
 */
export const MIC_OFFSET_DB = 100;
export const approxSpl = (dbfs: number): number => Math.min(120, Math.max(0, dbfs + MIC_OFFSET_DB));

/** Promedio móvil exponencial: suaviza el nivel para que el número no salte. */
export const ema = (prev: number | null, next: number, alpha: number): number => (prev === null ? next : prev + alpha * (next - prev));

// ---- Historial de tendencias ----

export type PhoneHistory = Record<string, number[]>;
export const PHONE_HISTORY_SIZE = 180;

const NUMERIC: (keyof Omit<PhoneReadings, 'at'>)[] = ['vibration', 'gyroDps', 'magDelta', 'tiltDeg', 'pressureHpa', 'lux', 'noiseDb', 'battery'];

export function appendPhoneHistory(history: PhoneHistory, r: PhoneReadings, size = PHONE_HISTORY_SIZE): PhoneHistory {
  const next: PhoneHistory = { ...history };
  for (const key of NUMERIC) {
    const v = r[key];
    if (v === null || !Number.isFinite(v)) continue;
    const prev = next[key] ?? [];
    next[key] = [...prev.slice(Math.max(0, prev.length - size + 1)), v];
  }
  return next;
}

// ---- Tarjetas ----

/** Umbrales de ejemplo (sin calibración de campo): ajustarlos con mediciones reales en el vehículo. */
export const PHONE_THRESHOLDS = {
  noise: { warn: 80, crit: 90 },
  vibration: { warn: 0.3, crit: 0.45 },
  battery: { warn: 0.2, crit: 0.1 },
  magnetPresent: 50,
};

const TEXT: Record<Level, string> = { ok: 'Normal', warn: 'Elevado', crit: 'Alto', unknown: 'Sin datos' };

const fmt = (v: number, d = 0) => new Intl.NumberFormat('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const gauge = (v: number, min: number, max: number, unit = '') => ({
  ratio: Math.min(1, Math.max(0, (v - min) / (max - min))),
  min: `${fmt(min)}${unit}`,
  max: `${fmt(max)}${unit}`,
});
const trendOf = (points: number[] | undefined, domain: [number, number]): Card['trend'] =>
  points && points.length >= 2 ? { points: points.slice(-120), domain, direction: 'flat', text: 'Últimos minutos' } : undefined;

function card(partial: Pick<Card, 'id' | 'title' | 'icon' | 'value' | 'caption' | 'level'> & Partial<Card>, at: string): Card {
  return { statusText: TEXT[partial.level], updatedAt: at, ...partial };
}
const levelAbove = (v: number, t: { warn: number; crit: number }): Level => (v >= t.crit ? 'crit' : v >= t.warn ? 'warn' : 'ok');

const MIC_REASON: Record<MicState, string> = {
  pending: 'Pidiendo permiso del micrófono…',
  granted: 'Escuchando…',
  denied: 'Permite el micrófono en Ajustes del teléfono',
  unavailable: 'Este equipo no permite medir el sonido',
};

/**
 * Una tarjeta por sensor DISPONIBLE (los que el equipo no tiene no se muestran: no se inventa nada). El sonido va siempre, porque si
 * falta el permiso hay que decirlo. Todo es REAL: lo que mide este teléfono.
 */
export function buildPhoneCards(r: PhoneReadings, h: PhoneHistory, a: PhoneAvailability): Card[] {
  const cards: Card[] = [];

  // Sonido (micrófono)
  if (r.noiseDb === null) {
    cards.push(card({ id: 'noise', title: 'Sonido de la cabina', icon: 'mic', value: '—', caption: MIC_REASON[a.mic], level: 'unknown' }, r.at));
  } else {
    const level = levelAbove(r.noiseDb, PHONE_THRESHOLDS.noise);
    cards.push(
      card(
        {
          id: 'noise',
          title: 'Sonido de la cabina',
          icon: 'mic',
          value: `≈${fmt(r.noiseDb)}`,
          unit: 'dB',
          caption: level === 'ok' ? (r.noiseDb < 60 ? 'Cabina tranquila' : 'Ruido moderado') : level === 'warn' ? 'Ruido alto' : 'Ruido muy alto',
          level,
          gauge: gauge(r.noiseDb, 30, 110, ' dB'),
          details: [{ label: 'Estimado, sin calibrar · no se graba', value: '' }],
          trend: trendOf(h.noiseDb, [30, 110]),
        },
        r.at,
      ),
    );
  }

  if (a.accel) {
    const v = r.vibration;
    cards.push(
      v === null
        ? card({ id: 'vibration', title: 'Vibración', icon: 'vibration', value: '—', caption: 'Midiendo…', level: 'unknown' }, r.at)
        : card(
            {
              id: 'vibration',
              title: 'Vibración',
              icon: 'vibration',
              value: fmt(v, 3),
              unit: 'g',
              caption: levelAbove(v, PHONE_THRESHOLDS.vibration) === 'ok' ? 'Sin vibración anormal' : 'Vibración elevada',
              level: levelAbove(v, PHONE_THRESHOLDS.vibration),
              gauge: gauge(v, 0, 0.6, ' g'),
              trend: trendOf(h.vibration, [0, 0.6]),
            },
            r.at,
          ),
    );
  }

  if (a.mag) {
    const d = r.magDelta;
    cards.push(
      d === null
        ? card({ id: 'magnet', title: 'Campo magnético', icon: 'door', value: '—', caption: 'Calibrando la línea base…', level: 'unknown' }, r.at)
        : card(
            {
              id: 'magnet',
              title: 'Campo magnético',
              icon: 'door',
              value: fmt(d),
              unit: 'µT',
              caption: d >= PHONE_THRESHOLDS.magnetPresent ? 'Imán cerca (puerta)' : 'Sin imán cerca',
              level: 'ok',
              statusText: d >= PHONE_THRESHOLDS.magnetPresent ? 'Detectado' : 'Normal',
              trend: trendOf(h.magDelta, [0, 200]),
            },
            r.at,
          ),
    );
  }

  if (a.gyro && r.gyroDps !== null) {
    cards.push(card({ id: 'gyro', title: 'Giro', icon: 'rotate', value: fmt(r.gyroDps), unit: '°/s', caption: 'Velocidad de rotación del teléfono', level: 'ok', trend: trendOf(h.gyroDps, [0, 120]) }, r.at));
  }

  if (a.motion && r.tiltDeg !== null) {
    cards.push(card({ id: 'tilt', title: 'Inclinación', icon: 'tilt', value: fmt(r.tiltDeg), unit: '°', caption: 'Cabeceo y alabeo del teléfono', level: 'ok', gauge: gauge(r.tiltDeg, 0, 90, '°'), trend: trendOf(h.tiltDeg, [0, 90]) }, r.at));
  }

  if (a.baro && r.pressureHpa !== null) {
    cards.push(card({ id: 'pressure', title: 'Presión del aire', icon: 'gauge', value: fmt(r.pressureHpa, 1), unit: 'hPa', caption: 'Cambia con la altura y el clima', level: 'ok', trend: trendOf(h.pressureHpa, [900, 1100]) }, r.at));
  }

  if (a.light && r.lux !== null) {
    cards.push(card({ id: 'light', title: 'Luz ambiente', icon: 'bulb', value: fmt(r.lux), unit: 'lx', caption: r.lux < 50 ? 'Poca luz' : 'Luz normal', level: 'ok', trend: trendOf(h.lux, [0, 1000]) }, r.at));
  }

  if (r.battery !== null) {
    const level: Level = r.battery <= PHONE_THRESHOLDS.battery.crit ? 'crit' : r.battery <= PHONE_THRESHOLDS.battery.warn ? 'warn' : 'ok';
    cards.push(
      card(
        {
          id: 'battery',
          title: 'Batería del teléfono',
          icon: 'battery',
          value: fmt(r.battery * 100),
          unit: '%',
          caption: level === 'ok' ? 'Carga suficiente' : level === 'warn' ? 'Carga baja' : 'Carga crítica',
          level,
          gauge: gauge(r.battery * 100, 0, 100, ' %'),
          trend: trendOf(h.battery, [0, 1]),
        },
        r.at,
      ),
    );
  }

  return cards;
}
