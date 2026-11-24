import type { EdgesPref } from './driver/appearance.ts';

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Margen mínimo aunque el sistema reporte 0 (pantallas sin muesca pero con esquinas redondeadas). */
export const MIN_INSETS: Insets = { top: 12, bottom: 12, left: 16, right: 16 };
/** Margen extra en «bordes amplios»: las esquinas muy curvas recortan lo que queda a menos de ~1 radio del borde. */
export const WIDE_EXTRA: Insets = { top: 6, bottom: 10, left: 14, right: 14 };

/**
 * Zona realmente utilizable: lo que reporta el sistema (muesca, indicador de inicio, borde de la cámara, barras de navegación),
 * al menos un mínimo y, con «bordes amplios», un margen adicional. Los controles y textos se colocan dentro de esta zona.
 */
export function screenInsets(raw: Insets, edges: EdgesPref): Insets {
  const extra = edges === 'wide' ? WIDE_EXTRA : { top: 0, bottom: 0, left: 0, right: 0 };
  const side = (k: keyof Insets) => Math.max(raw[k] + extra[k], MIN_INSETS[k] + extra[k]);
  return { top: side('top'), bottom: side('bottom'), left: side('left'), right: side('right') };
}
