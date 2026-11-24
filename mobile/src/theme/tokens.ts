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

/** Carbón: negro puro de fondo (en OLED el píxel se apaga), tarjetas apenas más claras y texto casi blanco. */
export const dark: Palette = {
  bg: '#0B0C0D',
  bgBase: '#000000',
  bgVariant: '#16181B',
  text: '#F4F5F7',
  textSubtle: '#B4BAC2',
  textSubtlest: '#8B929C',
  textDisabled: '#5C626B',
  border: '#3A4047',
  borderSubtle: '#1D2126',
  primary: '#FFFFFF',
  primaryPressed: '#B4BAC2',
  onPrimary: '#000000',
  accent: '#8FB4E3',
  accentPressed: '#6F95C8',
  onAccent: '#000000',
  success: '#62C68C',
  warning: '#F0B43C',
  warningText: '#F0B43C',
  error: '#FF6F64',
  onError: '#000000',
  errorSubtle: '#2D1512',
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

/** Esquinas redondeadas (estilo iOS): botones y barra como cápsulas, tarjetas muy suaves. */
export const radius = { sm: 8, md: 16, lg: 24, xl: 28, full: 999 } as const;

export const logo = {
  // Volvo Iron Mark: zona de protección = 1/4 de su altura; siempre centrado en su área.
  ironMarkClearSpace: (height: number) => height / 4,
} as const;
