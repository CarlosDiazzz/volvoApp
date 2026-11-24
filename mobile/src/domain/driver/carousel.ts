/**
 * Carrusel infinito: la lista real se repite REPEAT veces y se empieza en el bloque central. Al terminar un deslizamiento, si se
 * llegó cerca de un extremo, se salta (sin animación) a la posición equivalente del centro: el usuario nunca llega a un borde.
 * Lógica pura: se prueba sin pantalla.
 */
export const REPEAT = 5;

/** Índice virtual de arranque: el mismo componente `index`, en el bloque del centro. */
export const startVirtual = (n: number, index: number): number => Math.floor(REPEAT / 2) * n + index;

/** Componente real que corresponde a una posición virtual. */
export const actualOf = (virtual: number, n: number): number => ((virtual % n) + n) % n;

/** Si la posición virtual se acerca a un extremo, la equivalente en el centro; si no, la misma. */
export function recenter(virtual: number, n: number): number {
  if (n <= 0) return 0;
  const low = n; // bloque 0 es el borde izquierdo
  const high = (REPEAT - 1) * n; // último bloque es el borde derecho
  if (virtual >= low && virtual < high) return virtual;
  return startVirtual(n, actualOf(virtual, n));
}

/** Posición virtual más cercana a `from` cuyo componente real es `target` (para ir a un punto por el camino corto). */
export function nearestVirtual(from: number, n: number, target: number): number {
  const base = from - actualOf(from, n) + target;
  return [base - n, base, base + n].reduce((best, v) => (Math.abs(v - from) < Math.abs(best - from) ? v : best));
}

/** ¿Fue un toque (y no un deslizamiento)? Poco movimiento y poco tiempo. */
export function isTap(start: { x: number; y: number; t: number }, end: { x: number; y: number; t: number }): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) < 10 && end.t - start.t < 500;
}
