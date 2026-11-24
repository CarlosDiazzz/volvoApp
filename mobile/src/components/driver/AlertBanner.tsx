import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { ALERT_VISIBLE_S, alertKeyOf } from '../../domain/driver/appearance.ts';
import type { Card } from '../../domain/driver/catalog.ts';
import { useDriverColors, type DriverColors } from './driverTheme';

/**
 * Aviso del componente más grave, discreto y sobrio: una píldora con un punto de color, un rótulo en versalitas y una sola línea
 * de texto. Tras ALERT_VISIBLE_S segundos «cae como una gota»: la píldora se contrae hasta ser un círculo, cae y se desvanece.
 * El mismo aviso con la misma gravedad no vuelve a aparecer; si empeora (o llega otro), entra de nuevo. «Ver» lleva a la tarjeta.
 */
export function AlertBanner({ alerts, onShow }: { alerts: Card[]; onShow: (id: string) => void }) {
  const c = useDriverColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const top = alerts[0];
  const key = alertKeyOf(top);
  const [dismissed, setDismissed] = useState<string | null>(null);

  // Animaciones: entrada (aparece), contracción (la píldora se vuelve gota) y caída.
  const enter = useRef(new Animated.Value(0)).current; // 0 → 1
  const squeeze = useRef(new Animated.Value(0)).current; // 0 = píldora, 1 = gota
  const fall = useRef(new Animated.Value(0)).current; // 0 → 1: cae y se desvanece
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion.current = v)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!key) {
      setDismissed(null); // el componente volvió a la normalidad: un aviso futuro entra de nuevo
      return;
    }
    if (dismissed === key) return;
    enter.setValue(0);
    squeeze.setValue(0);
    fall.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

    const timer = setTimeout(() => {
      const drop = reduceMotion.current
        ? Animated.timing(enter, { toValue: 0, duration: 250, useNativeDriver: true })
        : Animated.sequence([
            Animated.timing(squeeze, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
            Animated.timing(fall, { toValue: 1, duration: 520, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          ]);
      drop.start(() => setDismissed(key));
    }, ALERT_VISIBLE_S * 1000);
    return () => clearTimeout(timer);
    // `dismissed` solo se lee para no repetir un aviso ya retirado; reaccionar a él reiniciaría la animación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!top || dismissed === key) return null;
  const crit = top.level === 'crit';
  const tone = crit ? c.crit : c.warnStrong;
  const more = alerts.length - 1;

  const scaleX = squeeze.interpolate({ inputRange: [0, 1], outputRange: [1, 0.09] });
  const contentOpacity = squeeze.interpolate({ inputRange: [0, 0.45], outputRange: [1, 0], extrapolate: 'clamp' });
  const translateY = Animated.add(
    enter.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }),
    fall.interpolate({ inputRange: [0, 1], outputRange: [0, 70] }),
  );
  const stretch = fall.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }); // la gota se estira al caer
  const opacity = Animated.multiply(enter, fall.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0.8, 0] }));

  return (
    <Animated.View
      accessibilityRole="alert"
      style={[styles.pill, { borderColor: `${tone}66`, opacity, transform: [{ translateY }, { scaleX }, { scaleY: stretch }] }]}
    >
      <Animated.View style={[styles.row, { opacity: contentOpacity }]}>
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
      </Animated.View>
    </Animated.View>
  );
}

const makeStyles = (c: DriverColors) =>
  StyleSheet.create({
    pill: {
      alignSelf: 'center',
      maxWidth: '100%',
      minHeight: 44,
      justifyContent: 'center',
      paddingLeft: 18,
      paddingRight: 8,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: c.mode === 'dark' ? 'rgba(20,22,25,0.94)' : 'rgba(255,255,255,0.96)',
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dot: { width: 8, height: 8, borderRadius: 4, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
    kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
    text: { flexShrink: 1, color: c.text, fontSize: 16, fontWeight: '400' },
    strong: { fontWeight: '700' },
    more: { color: c.muted, fontSize: 13, fontWeight: '600' },
    link: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 18 },
    linkText: { color: c.text, fontSize: 15, fontWeight: '600' },
  });
