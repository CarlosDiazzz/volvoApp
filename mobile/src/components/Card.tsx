import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, layout } from './theme';

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={layout.subtitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 6 },
});
