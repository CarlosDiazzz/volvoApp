/** Preferencias de aspecto del modo conductor. Lógica pura: se prueba sin pantalla. */

export type ModePref = 'auto' | 'light' | 'dark';
export type Mode = 'light' | 'dark';
/** `full`: valor, medidor, estados y tendencia. `minimal`: solo el número grande (estilo StandBy). */
export type ViewPref = 'full' | 'minimal';

export interface DriverPrefs {
  mode: ModePref;
  view: ViewPref;
}

export const DEFAULT_PREFS: DriverPrefs = { mode: 'auto', view: 'full' };

/** Automático: claro de día, carbón de noche, según la hora LOCAL del teléfono. */
export const LIGHT_FROM_HOUR = 7;
export const DARK_FROM_HOUR = 19;

export function resolveMode(pref: ModePref, at: Date): Mode {
  if (pref !== 'auto') return pref;
  const h = at.getHours();
  return h >= LIGHT_FROM_HOUR && h < DARK_FROM_HOUR ? 'light' : 'dark';
}

const MODES: readonly ModePref[] = ['auto', 'light', 'dark'];
const VIEWS: readonly ViewPref[] = ['full', 'minimal'];

/** Lee lo guardado sin confiar en ello: cualquier valor raro vuelve al valor por defecto. */
export function parsePrefs(raw: string | null | undefined): DriverPrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return DEFAULT_PREFS;
    const o = v as Record<string, unknown>;
    return {
      mode: MODES.includes(o.mode as ModePref) ? (o.mode as ModePref) : DEFAULT_PREFS.mode,
      view: VIEWS.includes(o.view as ViewPref) ? (o.view as ViewPref) : DEFAULT_PREFS.view,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export const serializePrefs = (p: DriverPrefs): string => JSON.stringify({ mode: p.mode, view: p.view });

export const MODE_LABEL: Record<ModePref, string> = { auto: 'Automático', light: 'Claro', dark: 'Carbón' };
export const VIEW_LABEL: Record<ViewPref, string> = { full: 'Completa', minimal: 'Solo números' };

/** Texto que explica qué hará el modo automático ahora mismo. */
export function autoHint(at: Date): string {
  const m = resolveMode('auto', at);
  return m === 'light'
    ? `Ahora es de día: claro. Pasa a carbón a las ${DARK_FROM_HOUR}:00.`
    : `Ahora es de noche: carbón. Pasa a claro a las ${LIGHT_FROM_HOUR}:00.`;
}
