import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { TextStyle } from 'react-native';

import { brand, dark, fontFiles, light, radius, space, typeScale, type Palette, type TypeName } from './tokens';

export interface Theme {
  dark: boolean;
  colors: Palette;
  brand: typeof brand;
  space: typeof space;
  radius: typeof radius;
  /** Estilos de texto listos: Noto Sans si ya cargó; si no, la fuente del sistema con el peso equivalente. */
  type: Record<TypeName, TextStyle>;
}

function buildType(fontsLoaded: boolean): Record<TypeName, TextStyle> {
  const out = {} as Record<TypeName, TextStyle>;
  for (const [name, t] of Object.entries(typeScale) as [TypeName, (typeof typeScale)[TypeName]][]) {
    out[name] = {
      fontSize: t.fontSize,
      lineHeight: t.lineHeight,
      letterSpacing: t.letterSpacing,
      // En Android fontWeight no elige el archivo de la fuente: con Noto Sans cargada se usa la familia de cada peso.
      ...(fontsLoaded
        ? { fontFamily: t.bold ? fontFiles.bold : fontFiles.regular }
        : { fontWeight: t.bold ? '700' : '400' }),
    };
  }
  return out;
}

const ThemeContext = createContext<Theme | null>(null);

/** `dark` = Carbón. El aspecto lo decide el usuario (claro / carbón / automático por hora), no el tema del sistema. */
export function ThemeProvider({ fontsLoaded, dark: isDark, children }: { fontsLoaded: boolean; dark: boolean; children: ReactNode }) {
  const theme = useMemo<Theme>(
    () => ({ dark: isDark, colors: isDark ? dark : light, brand, space, radius, type: buildType(fontsLoaded) }),
    [isDark, fontsLoaded],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme requiere <ThemeProvider>');
  return theme;
}

/** Crea los estilos de un componente a partir del tema y los recalcula solo cuando el tema cambia. */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  // factory debe ser una función de módulo (estable): solo el tema invalida los estilos.
  return useMemo(() => factory(theme), [theme]);
}
