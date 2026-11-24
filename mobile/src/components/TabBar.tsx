import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppearance } from '../appearance/AppearanceProvider';
import { TABS, type TabId } from '../domain/sensorInfo';
import { TAB_BAR_GAP, TAB_BAR_HEIGHT } from '../domain/insets';
import { DriverIcon } from './driver/DriverIcon';
import { useTheme, useThemedStyles, type Theme } from '../theme';

type Slot = { x: number; width: number };

/**
 * Barra flotante en cápsula, como la de iOS: tres vistas dentro de una píldora con un indicador que se desliza hacia la vista activa,
 * y aparte un botón redondo para el modo conductor. Flota sobre el contenido y respeta la zona segura (indicador de inicio, esquinas).
 */
export function TabBar({ tab, onTab, onDriverMode }: { tab: TabId; onTab: (t: TabId) => void; onDriverMode: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const t = useTheme();
  const { insets } = useAppearance();
  const slots = useRef<Partial<Record<TabId, Slot>>>({});
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);

  const moveTo = (id: TabId, animated: boolean) => {
    const s = slots.current[id];
    if (!s) return;
    if (!animated) {
      x.setValue(s.x);
      w.setValue(s.width);
      return;
    }
    Animated.parallel([
      Animated.spring(x, { toValue: s.x, useNativeDriver: false, speed: 18, bounciness: 7 }),
      Animated.spring(w, { toValue: s.width, useNativeDriver: false, speed: 18, bounciness: 7 }),
    ]).start();
  };
  useEffect(() => moveTo(tab, ready), [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, TAB_BAR_GAP), left: Math.max(16, insets.left), right: Math.max(16, insets.right) }]}
    >
      <View style={styles.capsule} accessibilityRole="tablist">
        {ready && <Animated.View style={[styles.indicator, { left: x, width: w }]} />}
        {TABS.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.id }}
            onPress={() => onTab(item.id)}
            onLayout={(e) => {
              slots.current[item.id] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
              if (!ready && TABS.every((i) => slots.current[i.id])) {
                moveTo(tab, false);
                setReady(true);
              }
            }}
            style={styles.item}
          >
            <Text style={[styles.label, tab === item.id && styles.labelOn]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir modo conductor" onPress={onDriverMode} style={styles.driver}>
        <DriverIcon name="gauge" size={26} color={t.colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: t.space[4] },
    capsule: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      height: TAB_BAR_HEIGHT,
      padding: 6,
      borderRadius: t.radius.full,
      backgroundColor: `${t.colors.bg}F2`,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      shadowColor: '#000000',
      shadowOpacity: t.dark ? 0.6 : 0.18,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    indicator: { position: 'absolute', top: 6, bottom: 6, borderRadius: t.radius.full, backgroundColor: t.colors.primary },
    item: { flex: 1, height: '100%', borderRadius: t.radius.full, alignItems: 'center', justifyContent: 'center' },
    label: { ...t.type.caption1, color: t.colors.textSubtle, fontWeight: '600' },
    labelOn: { color: t.colors.onPrimary },
    driver: {
      width: TAB_BAR_HEIGHT,
      height: TAB_BAR_HEIGHT,
      borderRadius: TAB_BAR_HEIGHT / 2,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000000',
      shadowOpacity: t.dark ? 0.6 : 0.18,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
  });
