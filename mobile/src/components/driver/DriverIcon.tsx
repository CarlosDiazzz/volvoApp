import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { IconName } from '../../domain/driver/catalog.ts';

type Glyph = IconName | 'alert' | 'left' | 'right';

/** Iconos de línea propios (decorativos: el texto siempre acompaña). */
const PATHS: Record<Glyph, string[]> = {
  vibration: ['M8 6h8v12H8z', 'M4 9v6', 'M20 9v6', 'M2 11v2', 'M22 11v2'],
  snowflake: ['M12 2v20', 'M4.5 6.5l15 11', 'M19.5 6.5l-15 11', 'M9 3.5l3 2 3-2', 'M9 20.5l3-2 3 2'],
  bulb: ['M9 18h6', 'M10 21h4', 'M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z'],
  tank: ['M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3v12c0 1.7-3.1 3-7 3s-7-1.3-7-3z', 'M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3'],
  door: ['M5 3h10v18H5z', 'M15 5l4 1.5v13L15 21', 'M12 12h.01'],
  battery: ['M3 8h15v8H3z', 'M21 11v2', 'M6 11v2', 'M9 11v2', 'M12 11v2'],
  bolt: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  sensor: ['M7 7h10v10H7z', 'M10 3v4', 'M14 3v4', 'M10 17v4', 'M14 17v4', 'M3 10h4', 'M3 14h4', 'M17 10h4', 'M17 14h4'],
  alert: ['M12 3l10 18H2z', 'M12 10v4', 'M12 17h.01'],
  left: ['M15 5l-7 7 7 7'],
  right: ['M9 5l7 7-7 7'],
};

export function DriverIcon({ name, size = 24, color }: { name: Glyph; size?: number; color: string }) {
  return (
    <View aria-hidden>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {PATHS[name].map((d) => (
          <Path key={d} d={d} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </Svg>
    </View>
  );
}
