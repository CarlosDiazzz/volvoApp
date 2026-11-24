import { StyleSheet, Text, View } from 'react-native';

import { LEVEL_TEXT, type Card } from '../../domain/driver/catalog.ts';
import { DriverIcon } from './DriverIcon';
import { Sparkline } from './Sparkline';
import { driverColors as c, levelChip, levelColor } from './driverTheme';

export function formatAge(iso: string | null, now: number): string {
  if (!iso) return 'sin lecturas';
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 3) return 'ahora';
  if (s < 60) return `hace ${s} s`;
  return `hace ${Math.floor(s / 60)} min`;
}

/** Una tarjeta del carrusel: el estado de mantenimiento de un componente, legible de un vistazo. */
export function SensorCard({ card, now, height }: { card: Card; now: number; height: number }) {
  const compact = height < 300;
  const accent = levelColor[card.level];
  const chip = levelChip[card.level];
  const valueSize = Math.max(44, Math.min(132, height * 0.26));
  const captionColor = card.level === 'warn' ? c.warn : card.level === 'crit' ? c.crit : card.level === 'unknown' ? c.muted : c.text;

  return (
    <View
      style={[styles.card, { borderTopColor: accent }, card.level === 'crit' && styles.cardCrit, compact && styles.cardCompact]}
      accessible
      accessibilityLabel={`${card.title}. ${LEVEL_TEXT[card.level]}. ${card.value}${card.unit ? ` ${card.unit}` : ''}. ${card.caption}`}
    >
      <View style={styles.head}>
        <View style={[styles.iconTile, compact && styles.iconTileCompact]}>
          <DriverIcon name={card.icon} size={compact ? 22 : 28} color={c.accent} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {card.title}
        </Text>
        <View style={[styles.chip, { backgroundColor: chip.bg }]}>
          {(card.level === 'warn' || card.level === 'crit') && <DriverIcon name="alert" size={16} color={chip.fg} />}
          <Text style={[styles.chipText, { color: chip.fg }]}>{LEVEL_TEXT[card.level]}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={[styles.value, { fontSize: valueSize, lineHeight: valueSize * 1.05 }]} numberOfLines={1} adjustsFontSizeToFit>
          {card.value}
          {card.unit ? <Text style={[styles.unit, { fontSize: valueSize * 0.36 }]}> {card.unit}</Text> : null}
        </Text>
        <Text style={[styles.caption, { color: captionColor }, card.level !== 'ok' && styles.captionStrong]}>{card.caption}</Text>

        {card.gauge && (
          <View>
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

        {card.segments && (
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

        {card.details && (
          <View style={styles.details}>
            {card.details.map((d) => (
              <Text key={d.label} style={styles.small}>
                {d.label} <Text style={styles.detailValue}>{d.value}</Text>
              </Text>
            ))}
          </View>
        )}

        {card.trend && (
          <View style={styles.trend}>
            <Sparkline points={card.trend.points} domain={card.trend.domain} color={accent} height={compact ? 24 : 32} />
            <Text style={styles.small}>{card.trend.text}</Text>
          </View>
        )}
      </View>

      {!compact && <Text style={styles.small}>Actualizado {formatAge(card.updatedAt, now)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.line,
    borderTopWidth: 4,
    paddingHorizontal: 28,
    paddingVertical: 20,
    gap: 10,
    shadowColor: '#141414',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardCrit: { borderColor: '#f0c2bf' },
  cardCompact: { paddingHorizontal: 18, paddingVertical: 12, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: { width: 48, height: 48, borderRadius: 10, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  iconTileCompact: { width: 38, height: 38 },
  title: { flex: 1, color: c.text, fontSize: 20, fontWeight: '500' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  chipText: { fontSize: 14, fontWeight: '600' },
  body: { flex: 1, justifyContent: 'center', gap: 8 },
  value: { color: c.text, fontWeight: '300', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  unit: { color: c.muted, fontWeight: '400', letterSpacing: 0 },
  caption: { fontSize: 20 },
  captionStrong: { fontWeight: '500' },
  track: { height: 8, borderRadius: 999, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  scale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  segments: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: c.surface2,
    borderWidth: 1,
    borderColor: c.line,
  },
  segmentOn: { backgroundColor: c.accentSoft, borderColor: '#c4d3e6' },
  segmentWarn: { backgroundColor: c.warnSoft, borderColor: '#f2d39b' },
  led: { width: 10, height: 10, borderRadius: 5 },
  segmentText: { color: c.muted, fontSize: 15 },
  details: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 4 },
  detailValue: { color: c.text, fontWeight: '500' },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  small: { color: c.muted, fontSize: 14 },
});
