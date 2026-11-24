import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Card } from '../../domain/driver/catalog.ts';
import { DriverIcon } from './DriverIcon';
import { driverColors as c } from './driverTheme';

/** Aviso del componente más grave. «Ver» lleva a su tarjeta. Sin avisos, no ocupa espacio. */
export function AlertBanner({ alerts, onShow }: { alerts: Card[]; onShow: (id: string) => void }) {
  const top = alerts[0];
  if (!top) return null;
  const crit = top.level === 'crit';
  const more = alerts.length - 1;
  return (
    <View accessibilityRole="alert" style={[styles.box, crit ? styles.crit : styles.warn]}>
      <DriverIcon name="alert" size={26} color={crit ? c.crit : c.warn} />
      <Text style={styles.text} numberOfLines={2}>
        <Text style={styles.strong}>{top.title}:</Text> {top.caption}
        {more > 0 ? <Text style={styles.more}>{` · ${more} aviso${more === 1 ? '' : 's'} más`}</Text> : null}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Ver ${top.title}`} onPress={() => onShow(top.id)} style={styles.button}>
        <Text style={styles.buttonText}>Ver</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, paddingRight: 8, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderLeftWidth: 5 },
  warn: { backgroundColor: c.warnSoft, borderColor: '#f2d39b', borderLeftColor: c.warnStrong },
  crit: { backgroundColor: c.critSoft, borderColor: '#f0c2bf', borderLeftColor: c.crit },
  text: { flex: 1, color: c.text, fontSize: 16 },
  strong: { fontWeight: '600' },
  more: { color: c.muted },
  button: { minHeight: 48, minWidth: 88, borderRadius: 8, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
});
