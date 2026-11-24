import type { MicState, PhoneAvailability, PhoneReadings } from './driver/phone.ts';

/** Una fila de la vista «Sensores»: qué es, para qué sirve, si está disponible y si lo que mide sale del teléfono. */
export interface SensorRow {
  id: string;
  name: string;
  purpose: string;
  /** `true`: ese valor viaja cifrado al sistema; `false`: solo se ve en este teléfono. */
  sent: boolean;
  state: 'ok' | 'unavailable' | 'off' | 'denied' | 'pending' | 'waiting';
  /** Valor actual ya formateado, o texto que explica por qué no hay. */
  value: string;
}

export const STATE_TEXT: Record<SensorRow['state'], string> = {
  ok: 'Midiendo',
  unavailable: 'No disponible',
  off: 'Desactivado',
  denied: 'Sin permiso',
  pending: 'Pidiendo permiso',
  waiting: 'Esperando datos',
};

const n = (v: number, d = 0) => new Intl.NumberFormat('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

function mic(state: MicState, enabled: boolean, db: number | null): Pick<SensorRow, 'state' | 'value'> {
  if (!enabled) return { state: 'off', value: 'Actívalo para medir el ruido' };
  if (state === 'denied') return { state: 'denied', value: 'Permite el micrófono en Ajustes de iOS/Android' };
  if (state === 'unavailable') return { state: 'unavailable', value: '—' };
  if (state === 'pending') return { state: 'pending', value: '—' };
  return db === null ? { state: 'waiting', value: '—' } : { state: 'ok', value: `≈ ${n(db)} dB` };
}

const reading = (available: boolean, v: number | null, fmt: (x: number) => string): Pick<SensorRow, 'state' | 'value'> =>
  !available ? { state: 'unavailable', value: '—' } : v === null ? { state: 'waiting', value: '—' } : { state: 'ok', value: fmt(v) };

/**
 * Todos los sensores que la app conoce, en orden de importancia. Los que el equipo no tiene aparecen como «No disponible» (no se
 * ocultan: así se sabe qué falta, p. ej. la luz en iPhone). Lógica pura: la pantalla solo dibuja.
 */
export function buildSensorRows(r: PhoneReadings, a: PhoneAvailability, micEnabled: boolean): SensorRow[] {
  return [
    { id: 'vibration', name: 'Vibración', purpose: 'Compresor del A/C (acelerómetro)', sent: true, ...reading(a.accel, r.vibration, (v) => `${n(v, 3)} g`) },
    { id: 'magnet', name: 'Campo magnético', purpose: 'Puerta del sanitario (imán)', sent: true, ...reading(a.mag, r.magDelta, (v) => `${n(v)} µT`) },
    { id: 'light', name: 'Luz ambiente', purpose: 'Iluminación interior', sent: true, ...reading(a.light, r.lux, (v) => `${n(v)} lx`) },
    { id: 'battery', name: 'Batería', purpose: 'Carga del teléfono y consumo del envío', sent: true, ...reading(r.battery !== null, r.battery, (v) => `${n(v * 100)} %`) },
    { id: 'noise', name: 'Sonido (micrófono)', purpose: 'Ruido de la cabina; no se graba ni se envía audio', sent: false, ...mic(a.mic, micEnabled, r.noiseDb) },
    { id: 'gyro', name: 'Giroscopio', purpose: 'Giro del teléfono (modo conductor)', sent: false, ...reading(a.gyro, r.gyroDps, (v) => `${n(v)} °/s`) },
    { id: 'tilt', name: 'Inclinación', purpose: 'Cabeceo y alabeo (modo conductor)', sent: false, ...reading(a.motion, r.tiltDeg, (v) => `${n(v)} °`) },
    { id: 'pressure', name: 'Barómetro', purpose: 'Presión del aire (modo conductor)', sent: false, ...reading(a.baro, r.pressureHpa, (v) => `${n(v, 1)} hPa`) },
  ];
}

export type TabId = 'inicio' | 'sensores' | 'ajustes';
export const TABS: { id: TabId; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'sensores', label: 'Sensores' },
  { id: 'ajustes', label: 'Ajustes' },
];
