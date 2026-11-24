import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_PREFS, parsePrefs, serializePrefs, type DriverPrefs } from '../domain/driver/appearance.ts';
import { secureKeyValueStore } from '../services/secureStorage';

const KEY = 'volvo.driver.prefs';

/** Preferencias de aspecto del modo conductor: se cargan al abrir y se guardan en cada cambio (si falla guardar, sigue funcionando). */
export function useDriverPrefs() {
  const [prefs, setPrefs] = useState<DriverPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    let alive = true;
    secureKeyValueStore
      .get(KEY)
      .then((raw) => alive && setPrefs(parsePrefs(raw)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const update = useCallback((next: DriverPrefs) => {
    setPrefs(next);
    secureKeyValueStore.set(KEY, serializePrefs(next)).catch(() => undefined);
  }, []);
  return [prefs, update] as const;
}
