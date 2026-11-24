import type { Level } from '../../domain/driver/catalog.ts';

/**
 * Tema del modo conductor: identidad de Volvo en tema claro (en su mayoría blanco), igual que la pantalla del tablero.
 * Tipografía del sistema (SF Pro en iOS, Roboto en Android): es la que exige CarPlay y la más legible al manejar.
 */
export const driverColors = {
  volvoBlue: '#003057',
  accent: '#284e80',
  accentSoft: '#e9eff7',
  bg: '#ffffff',
  surface: '#ffffff',
  surface2: '#f5f6f7',
  line: '#e3e6ea',
  lineHi: '#c7cdd4',
  text: '#141414',
  muted: '#5f6670',
  ok: '#1a7a47',
  okSoft: '#e5f3eb',
  warn: '#8f5200',
  warnStrong: '#e8930c',
  warnSoft: '#fff2db',
  crit: '#b3261e',
  critSoft: '#fbe9e8',
  unknown: '#737a84',
};

/** Color de acento de cada nivel (franja de la tarjeta, medidor, punto del carrusel). */
export const levelColor: Record<Level, string> = {
  ok: driverColors.accent,
  warn: driverColors.warnStrong,
  crit: driverColors.crit,
  unknown: driverColors.unknown,
};

/** Insignia del nivel: fondo y texto con contraste suficiente sobre blanco. */
export const levelChip: Record<Level, { bg: string; fg: string }> = {
  ok: { bg: driverColors.okSoft, fg: driverColors.ok },
  warn: { bg: driverColors.warnStrong, fg: '#141414' },
  crit: { bg: driverColors.crit, fg: '#ffffff' },
  unknown: { bg: driverColors.surface2, fg: driverColors.muted },
};
