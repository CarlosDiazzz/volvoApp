import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

/**
 * Línea de tendencia dibujada sobre el rango del componente (`domain`): el ruido normal se ve plano y un desgaste real
 * se ve como subida o bajada. Decorativa: el texto de la tendencia la acompaña.
 */
export function Sparkline({
  points,
  domain,
  color,
  width = 180,
  height = 32,
}: {
  points: number[];
  domain: [number, number];
  color: string;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;
  const [lo, hi] = domain;
  const span = hi - lo || 1;
  const step = width / (points.length - 1);
  const y = (p: number) => height - 2 - ((Math.min(hi, Math.max(lo, p)) - lo) / span) * (height - 4);
  const d = points.map((p, i) => `${(i * step).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  return (
    <View aria-hidden>
      <Svg width={width} height={height}>
        <Polyline points={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
