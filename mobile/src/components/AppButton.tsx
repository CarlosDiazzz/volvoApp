import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from './theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  selected?: boolean;
}

export function AppButton({ label, onPress, disabled, danger, selected }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, danger && styles.danger, selected && styles.selected, disabled && styles.disabled]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, minHeight: 44, justifyContent: 'center' },
  danger: { backgroundColor: colors.danger },
  selected: { backgroundColor: colors.selected },
  disabled: { opacity: 0.4 },
  label: { color: colors.text, fontWeight: '600' },
});
