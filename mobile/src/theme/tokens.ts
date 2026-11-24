// Tokens de marca Volvo: Volvo Experience System (paleta, logo) y VCDK `.vcdk-theme-volvo` (UI, tipografía, espaciado).
// Fuente: VOLVO_BRAND_SPEC.md §5.2. Volvo Novum es propietaria; se usa su fallback oficial, Noto Sans.

export const brand = {
  darkBlue: '#202A44', // Volvo Dark Blue: superficies de marca (cabecera, splash)
  black: '#141414',
  white: '#FFFFFF',
  grey1: '#E1DFDD',
  grey2: '#A7ABA9',
  grey3: '#888B8D',
  grey4: '#53565A',
} as const;

export interface Palette {
  bg: string;
  bgBase: string;
  bgVariant: string;
  text: string;
  textSubtle: string;
  textSubtlest: string;
  textDisabled: string;
  border: string;
  borderSubtle: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  accent: string;
  accentPressed: string;
  onAccent: string;
  success: string;
  warning: string;
  warningText: string;
  error: string;
  onError: string;
  errorSubtle: string;
}

export const light: Palette = {
  bg: '#FFFFFF',
  bgBase: '#F7F7F7',
  bgVariant: '#EDEDED',
  text: '#212121',
  textSubtle: '#575757',
  textSubtlest: '#6B6B6B',
  textDisabled: '#A9A9A9',
  border: '#A9A9A9',
  borderSubtle: '#E1E1E1',
  primary: '#212121',
  primaryPressed: '#3D3D3D',
  onPrimary: '#FFFFFF',
  accent: '#2A609D',
  accentPressed: '#234D7D',
  onAccent: '#FFFFFF',
  success: '#177844',
  warning: '#FFA000',
  warningText: '#AD5100',
  error: '#BF2012',
  onError: '#FFFFFF',
  errorSubtle: '#F8DDDB',
};

export const dark: Palette = {
  bg: '#212121',
  bgBase: '#1A1A1A',
  bgVariant: '#333333',
  text: '#FFFFFF',
  textSubtle: '#D0D0D0',
  textSubtlest: '#A9A9A9',
  textDisabled: '#6B6B6B',
  border: '#6B6B6B',
  borderSubtle: '#3D3D3D',
  primary: '#FFFFFF',
  primaryPressed: '#A9A9A9',
  onPrimary: '#212121',
  accent: '#61A0E8',
  accentPressed: '#4781C4',
  onAccent: '#212121',
  success: '#6CC17A',
  warning: '#FFB54D',
  warningText: '#FFB54D',
  error: '#FF6B54',
  onError: '#212121',
  errorSubtle: '#4C2821',
};

/** Archivos de Noto Sans registrados con expo-font (ver App.tsx). */
export const fontFiles = {
  regular: 'NotoSans_400Regular',
  bold: 'NotoSans_700Bold',
} as const;

interface TypeToken {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  bold: boolean;
}

/** Escala small-screens de VCDK (px). */
export const typeScale = {
  h1: { fontSize: 38, lineHeight: 46, letterSpacing: -0.38, bold: true },
  h2: { fontSize: 30, lineHeight: 36, letterSpacing: -0.3, bold: true },
  h3: { fontSize: 22, lineHeight: 28, letterSpacing: -0.22, bold: true },
  h4: { fontSize: 20, lineHeight: 26, letterSpacing: -0.2, bold: true },
  subtitle1: { fontSize: 16, lineHeight: 24, letterSpacing: 0, bold: true },
  subtitle2: { fontSize: 14, lineHeight: 20, letterSpacing: 0, bold: true },
  body: { fontSize: 16, lineHeight: 24, letterSpacing: 0, bold: false },
  bodyBold: { fontSize: 16, lineHeight: 24, letterSpacing: 0, bold: true },
  button: { fontSize: 14, lineHeight: 20, letterSpacing: 0.28, bold: false },
  caption1: { fontSize: 14, lineHeight: 20, letterSpacing: 0.28, bold: false },
  caption2: { fontSize: 12, lineHeight: 16, letterSpacing: 0.24, bold: false },
} satisfies Record<string, TypeToken>;

export type TypeName = keyof typeof typeScale;

export const space = { 1: 2, 2: 4, 3: 6, 4: 8, 5: 12, 6: 16, 7: 20, 8: 24, 9: 32, 10: 40, 11: 48, 12: 64 } as const;

/** Radios del tema volvo: esquinas casi rectas. */
export const radius = { sm: 2, md: 4, lg: 8, xl: 20, full: 99 } as const;

export const logo = {
  // Volvo Iron Mark: zona de protección = 1/4 de su altura; siempre centrado en su área.
  ironMarkClearSpace: (height: number) => height / 4,
} as const;
