import type { Snapshot } from './contract.ts';

/** Últimos valores numéricos de cada señal (`system/name`), del más viejo al más reciente. */
export type History = Record<string, number[]>;

/** Cuántas lecturas se guardan por señal (a 1 Hz ≈ 3 min): suficiente para ver una tendencia de desgaste. */
export const HISTORY_SIZE = 180;

/** Agrega las lecturas numéricas válidas de la instantánea al historial. Pura: devuelve un objeto nuevo. */
export function appendHistory(history: History, snapshot: Snapshot, size = HISTORY_SIZE): History {
  const next: History = { ...history };
  for (const [key, s] of Object.entries(snapshot.signals)) {
    if (s.quality !== 'ok' || typeof s.value !== 'number') continue;
    const prev = next[key] ?? [];
    next[key] = [...prev.slice(Math.max(0, prev.length - size + 1)), s.value];
  }
  return next;
}

export type Direction = 'up' | 'down' | 'flat';

/**
 * Dirección de la tendencia: compara el promedio de las últimas 10 lecturas con el de las 30 anteriores.
 * Un cambio menor a `tolerance` (en unidades de la señal) se considera estable.
 */
export function trendOf(points: number[], tolerance: number): Direction {
  if (points.length < 20) return 'flat';
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const recent = mean(points.slice(-10));
  const before = mean(points.slice(-40, -10));
  const diff = recent - before;
  if (Math.abs(diff) < tolerance) return 'flat';
  return diff > 0 ? 'up' : 'down';
}
