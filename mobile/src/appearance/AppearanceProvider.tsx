import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEFAULT_PREFS, parsePrefs, resolveMode, serializePrefs, type DriverPrefs, type Mode } from '../domain/driver/appearance.ts';
import { screenInsets, type Insets } from '../domain/insets.ts';
import { secureKeyValueStore } from '../services/secureStorage';

const KEY = 'volvo.driver.prefs'; // misma clave que antes: lo ya elegido en el modo conductor se conserva
const CLOCK_MS = 30_000;

interface Appearance {
  prefs: DriverPrefs;
  setPrefs: (p: DriverPrefs) => void;
  /** Claro o carbón YA resuelto (si es automático, según la hora local). Vale para toda la app y para el modo conductor. */
  mode: Mode;
  /** Zona utilizable de la pantalla: zonas seguras del sistema + mínimo + «bordes amplios». */
  insets: Insets;
}

const Ctx = createContext<Appearance | null>(null);

/**
 * Un solo aspecto para TODA la app (Inicio, Sensores, Ajustes, emparejamiento y modo conductor): claro, carbón (negro puro) o
 * automático por hora. Se guarda en el teléfono. También calcula los márgenes para pantallas con bordes curvos.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<DriverPrefs>(DEFAULT_PREFS);
  const [now, setNow] = useState(() => Date.now());
  const raw = useSafeAreaInsets();

  useEffect(() => {
    let alive = true;
    secureKeyValueStore
      .get(KEY)
      .then((v) => alive && setPrefsState(parsePrefs(v)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), CLOCK_MS); // el modo automático cambia solo al pasar las 7:00 / 19:00
    return () => clearInterval(t);
  }, []);

  const setPrefs = useCallback((next: DriverPrefs) => {
    setPrefsState(next);
    secureKeyValueStore.set(KEY, serializePrefs(next)).catch(() => undefined);
  }, []);

  const mode = resolveMode(prefs.mode, new Date(now));
  const insets = useMemo(() => screenInsets(raw, prefs.edges), [raw, prefs.edges]);
  const value = useMemo(() => ({ prefs, setPrefs, mode, insets }), [prefs, setPrefs, mode, insets]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppearance(): Appearance {
  const a = useContext(Ctx);
  if (!a) throw new Error('useAppearance requiere <AppearanceProvider>');
  return a;
}
