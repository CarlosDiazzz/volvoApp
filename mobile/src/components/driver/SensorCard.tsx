import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { statusOf, type Card } from '../../domain/driver/catalog.ts';
import type { ViewPref } from '../../domain/driver/appearance.ts';
import { DriverIcon } from './DriverIcon';
import { Sparkline } from './Sparkline';
import { levelColorOf, useDriverColors, type DriverColors, type DriverFonts } from './driverTheme';

export function formatAge(iso: string | null, now: number): string {
  if (!iso) return 'sin lecturas';
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 3) return 'ahora';
  if (s < 60) return `hace ${s} s`;
  return `hace ${Math.floor(s / 60)} min`;
}

/**
 * Un componente, legible de un vistazo y a un metro de distancia: el número ocupa la pantalla (tipografía fina, estilo StandBy)
 * y todo lo demás es secundario. En la vista «solo números» no queda nada más que el título, el número y el estado.
 */
export function SensorCard({ card, now, height, view, fonts }: { card: Card; now: number; height: number; view: ViewPref; fonts: DriverFonts }) {
  const c = useDriverColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const minimal = view === 'minimal';
  const compact = height < 300;
  const accent = levelColorOf(c)[card.level];
  const chipText = card.level === 'warn' ? c.warn : card.level === 'crit' ? c.crit : c.muted;
  // Más grande cuanto menos hay alrededor: en «solo números» el valor llena la tarjeta.
  const valueSize = Math.max(64, Math.min(minimal ? 340 : 230, height * (minimal ? 0.62 : 0.46)));
  const captionColor = card.level === 'warn' ? c.warn : card.level === 'crit' ? c.crit : card.level === 'unknown' ? c.muted : c.text;

  return (
    <View
      style={[styles.card, compact && styles.cardCompact]}
      accessible
      accessibilityLabel={`${card.title}. ${statusOf(card)}. ${card.value}${card.unit ? ` ${card.unit}` : ''}. ${card.caption}`}
    >
      <View style={styles.head}>
        <DriverIcon name={card.icon} size={compact ? 20 : 24} color={c.muted} />
        <Text style={styles.title} numberOfLines={1}>
          {card.title}
        </Text>
        <View style={[styles.chip, card.level !== 'ok' && { borderColor: `${accent}66` }]}>
          <View style={[styles.chipDot, { backgroundColor: accent }]} />
          <Text style={[styles.chipText, { color: chipText }]}>{statusOf(card)}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text
          style={[styles.value, fonts.numeral, { fontSize: valueSize, lineHeight: valueSize * 1.04 }, card.level === 'crit' && { color: c.crit }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {card.value}
          {card.unit ? <Text style={[styles.unit, fonts.light, { fontSize: valueSize * 0.3 }]}> {card.unit}</Text> : null}
        </Text>
        <Text style={[styles.caption, fonts.light, { color: captionColor }, card.level !== 'ok' && styles.captionStrong]}>{card.caption}</Text>

        {!minimal && card.gauge && (
          <View style={styles.gaugeBox}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(card.gauge.ratio * 100)}%`, backgroundColor: accent }]} />
            </View>
            {!compact && (
              <View style={styles.scale}>
                <Text style={styles.small}>{card.gauge.min}</Text>
                <Text style={styles.small}>{card.gauge.max}</Text>
              </View>
            )}
          </View>
        )}

        {!minimal && card.segments && (
          <View style={styles.segments}>
            {card.segments.map((s) => (
              <View
                key={s.label}
                style={[styles.segment, s.on ? styles.segmentOn : card.level === 'warn' ? styles.segmentWarn : null]}
                accessibilityLabel={`${s.label}: ${s.on ? 'sí' : 'no'}`}
              >
                <View style={[styles.led, { backgroundColor: s.on ? c.accent : card.level === 'warn' ? c.warnStrong : c.unknown }]} />
                <Text style={[styles.segmentText, s.on && { color: c.text }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {!minimal && card.details && (
          <View style={styles.details}>
            {card.details.map((d) => (
              <Text key={d.label} style={styles.small}>
                {d.label} <Text style={styles.detailValue}>{d.value}</Text>
              </Text>
            ))}
          </View>
        )}

        {!minimal && card.trend && (
          <View style={styles.trend}>
            <Sparkline points={card.trend.points} domain={card.trend.domain} color={accent} height={compact ? 24 : 32} />
            <Text style={styles.small}>{card.trend.text}</Text>
          </View>
        )}
      </View>

      {!minimal && !compact && <Text style={styles.small}>Actualizado {formatAge(card.updatedAt, now)}</Text>}
    </View>
  );
}

const makeStyles = (c: DriverColors) =>
  StyleSheet.create({
    // Sin marco ni sombra: la tarjeta es el propio fondo; solo el estado crítico dibuja un borde.
    // Pantalla completa: sin marco, sin esquinas, sin sombra; el número es la pantalla.
    card: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 44, paddingTop: 18, paddingBottom: 34, gap: 8 },
    cardCompact: { paddingHorizontal: 28, paddingTop: 10, paddingBottom: 26, gap: 4 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { flex: 1, color: c.muted, fontSize: 15, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
    // Estado sobrio: un punto y una palabra; solo los avisos llevan un borde fino del color del nivel.
    chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'transparent' },
    chipDot: { width: 7, height: 7, borderRadius: 4 },
    chipText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6 },
    body: { flex: 1, justifyContent: 'center', gap: 6 },
    value: { color: c.text, letterSpacing: -3, fontVariant: ['tabular-nums'] },
    unit: { color: c.muted, letterSpacing: 0, fontWeight: '600' },
    caption: { fontSize: 22 },
    captionStrong: { fontWeight: '600' },
    gaugeBox: { marginTop: 4 },
    track: { height: 4, borderRadius: 999, backgroundColor: c.line, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 999 },
    scale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    segments: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    segment: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line },
    segmentOn: { backgroundColor: c.accentSoft, borderColor: c.accentBorder },
    segmentWarn: { backgroundColor: c.warnSoft, borderColor: c.warnBorder },
    led: { width: 9, height: 9, borderRadius: 5 },
    segmentText: { color: c.muted, fontSize: 15 },
    details: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 4 },
    detailValue: { color: c.text, fontWeight: '500' },
    trend: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    small: { color: c.muted, fontSize: 14, fontWeight: '500' },
  });
