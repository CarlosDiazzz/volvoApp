import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useThemedStyles, type Theme } from '../theme';

export function Card({ title, children }: { title: string; children: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.colors.bg,
      borderColor: t.colors.borderSubtle,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: t.radius.xl,
      padding: t.space[6],
      gap: t.space[4],
    },
    title: { ...t.type.subtitle1, color: t.colors.text },
  });
