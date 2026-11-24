import { StyleSheet, Text, View } from 'react-native';

import { colors } from './theme';

export function InfoRow({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, good && styles.good]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { color: colors.label, flexShrink: 1 },
  value: { color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  good: { color: colors.ok },
});
