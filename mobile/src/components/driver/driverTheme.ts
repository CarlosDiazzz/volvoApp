import { createContext, useContext } from 'react';

import type { Level } from '../../domain/driver/catalog.ts';
import type { Mode } from '../../domain/driver/appearance.ts';

/**
 * Dos paletas del modo conductor. «Carbón» es negro puro (#000): en pantallas OLED el píxel se apaga del todo, el número flota sin fondo y no deslumbra de noche;
 * «Claro» es el blanco de Volvo. Los colores de nivel se re-escogen en cada modo para conservar el contraste, no se invierten.
 */
export interface DriverColors {
  mode: Mode;
  volvoBlue: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  bg: string;
  surface: string;
  surface2: string;
  line: string;
  lineHi: string;
  text: string;
  muted: string;
  ok: string;
  okSoft: string;
  warn: string;
  warnStrong: string;
  warnSoft: string;
  warnBorder: string;
  crit: string;
  critSoft: string;
  critBorder: string;
  unknown: string;
  shadow: string;
  onAccent: string;
}

export const lightColors: DriverColors = {
  mode: 'light',
  volvoBlue: '#003057',
  accent: '#284e80',
  accentSoft: '#e9eff7',
  accentBorder: '#c4d3e6',
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
  warnBorder: '#f2d39b',
  crit: '#b3261e',
  critSoft: '#fbe9e8',
  critBorder: '#f0c2bf',
  unknown: '#737a84',
  shadow: '#141414',
  onAccent: '#ffffff',
};

export const carbonColors: DriverColors = {
  mode: 'dark',
  volvoBlue: '#8fb4e3',
  accent: '#8fb4e3',
  accentSoft: '#142030',
  accentBorder: '#243a55',
  bg: '#000000',
  surface: '#000000',
  surface2: '#0f1113',
  line: '#1b1e22',
  lineHi: '#2a2f35',
  text: '#f4f5f7',
  muted: '#8b929c',
  ok: '#62c68c',
  okSoft: '#0f241a',
  warn: '#f0b43c',
  warnStrong: '#f0b43c',
  warnSoft: '#2a2111',
  warnBorder: '#4a3913',
  crit: '#ff6f64',
  critSoft: '#2d1512',
  critBorder: '#5a2a25',
  unknown: '#6c727b',
  shadow: '#000000',
  onAccent: '#000000',
};

export const paletteOf = (mode: Mode): DriverColors => (mode === 'dark' ? carbonColors : lightColors);

export const DriverColorsContext = createContext<DriverColors>(lightColors);
export const useDriverColors = (): DriverColors => useContext(DriverColorsContext);

/** Color de acento de cada nivel (franja, medidor, punto del carrusel). */
export const levelColorOf = (c: DriverColors): Record<Level, string> => ({
  ok: c.accent,
  warn: c.warnStrong,
  crit: c.crit,
  unknown: c.unknown,
});

/** Insignia del nivel, con contraste suficiente sobre el fondo de cada modo. */
export const levelChipOf = (c: DriverColors): Record<Level, { bg: string; fg: string }> => ({
  ok: { bg: c.okSoft, fg: c.ok },
  warn: { bg: c.warnStrong, fg: '#141414' },
  crit: { bg: c.crit, fg: c.mode === 'dark' ? '#190806' : '#ffffff' },
  unknown: { bg: c.surface2, fg: c.muted },
});

/**
 * Tipografía: la fuente del sistema, que en iOS es San Francisco (SF Pro), sin familia explícita. Los números van en peso fino
 * (Thin/Light) y con cifras tabulares, que es el estilo del reloj y de StandBy del iPhone. En Android se usa Roboto.
 */
export interface DriverFonts {
  numeral: { fontWeight: '200' };
  light: { fontWeight: '300' };
}
export const driverFonts: DriverFonts = { numeral: { fontWeight: '200' }, light: { fontWeight: '300' } };
