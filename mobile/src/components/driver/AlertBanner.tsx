import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Card } from '../../domain/driver/catalog.ts';
import { useDriverColors, type DriverColors } from './driverTheme';

/**
 * Aviso del componente más grave, discreto y sobrio: una píldora con un punto de color, un rótulo en versalitas y una sola línea
 * de texto en peso ligero. Sin bloques de color ni franjas: el color queda para el punto y el borde fino. «Ver» lleva a la tarjeta.
 */
export function AlertBanner({ alerts, onShow }: { alerts: Card[]; onShow: (id: string) => void }) {
  const c = useDriverColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const top = alerts[0];
  if (!top) return null;
  const crit = top.level === 'crit';
  const tone = crit ? c.crit : c.warnStrong;
  const more = alerts.length - 1;
  return (
    <View accessibilityRole="alert" style={[styles.pill, { borderColor: `${tone}66` }]}>
      <View style={[styles.dot, { backgroundColor: tone, shadowColor: tone }]} />
      <Text style={[styles.kicker, { color: tone }]}>{crit ? 'CRÍTICO' : 'AVISO'}</Text>
      <Text style={styles.text} numberOfLines={1}>
        <Text style={styles.strong}>{top.title}</Text>
        {'  '}
        {top.caption}
      </Text>
      {more > 0 && <Text style={styles.more}>+{more}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={`Ver ${top.title}`} onPress={() => onShow(top.id)} style={styles.link} hitSlop={8}>
        <Text style={styles.linkText}>Ver  ›</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: DriverColors) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      alignSelf: 'center',
      maxWidth: '100%',
      paddingLeft: 18,
      paddingRight: 8,
      minHeight: 44,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: c.mode === 'dark' ? 'rgba(20,22,25,0.92)' : 'rgba(255,255,255,0.94)',
    },
    dot: { width: 8, height: 8, borderRadius: 4, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
    kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
    text: { flexShrink: 1, color: c.text, fontSize: 16, fontWeight: '300' },
    strong: { fontWeight: '500' },
    more: { color: c.muted, fontSize: 13, fontWeight: '500' },
    link: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 18 },
    linkText: { color: c.text, fontSize: 15, fontWeight: '500' },
  });
