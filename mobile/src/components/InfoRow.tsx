import { StyleSheet, Text, View } from 'react-native';

import { useThemedStyles, type Theme } from '../theme';

export function InfoRow({ label, value, good }: { label: string; value: string; good?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, good && styles.good]}>{value}</Text>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: t.space[5] },
    label: { ...t.type.caption1, color: t.colors.textSubtle, flexShrink: 1 },
    value: { ...t.type.subtitle2, color: t.colors.text, flexShrink: 1, textAlign: 'right' },
    good: { color: t.colors.success },
  });
