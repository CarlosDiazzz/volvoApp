import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TABS, type TabId } from '../domain/sensorInfo';
import { useThemedStyles, type Theme } from '../theme';

/** Barra inferior: tres vistas separadas y, aparte, el acceso al modo conductor. */
export function TabBar({ tab, onTab, onDriverMode }: { tab: TabId; onTab: (t: TabId) => void; onDriverMode: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {TABS.map((t) => (
        <Pressable
          key={t.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === t.id }}
          onPress={() => onTab(t.id)}
          style={[styles.item, tab === t.id && styles.itemOn]}
        >
          <Text style={[styles.label, tab === t.id && styles.labelOn]}>{t.label}</Text>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir modo conductor" onPress={onDriverMode} style={[styles.item, styles.driver]}>
        <Text style={styles.driverLabel}>Conductor ▸</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    bar: { flexDirection: 'row', gap: t.space[3], padding: t.space[4], backgroundColor: t.colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.borderSubtle },
    item: { flex: 1, minHeight: 48, borderRadius: t.radius.md, alignItems: 'center', justifyContent: 'center' },
    itemOn: { backgroundColor: t.colors.bgVariant },
    label: { ...t.type.caption1, color: t.colors.textSubtle },
    labelOn: { color: t.colors.text, fontWeight: '700' },
    driver: { backgroundColor: t.colors.primary },
    driverLabel: { ...t.type.caption1, color: t.colors.onPrimary, fontWeight: '700' },
  });
