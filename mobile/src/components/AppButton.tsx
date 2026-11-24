import { Pressable, StyleSheet, Text } from 'react-native';

import { useThemedStyles, type Theme } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  selected?: boolean;
}

export function AppButton({ label, onPress, disabled, danger, selected }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        danger && styles.danger,
        selected && styles.selected,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, danger && styles.dangerLabel, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    button: {
      backgroundColor: t.colors.primary,
      paddingVertical: t.space[5],
      paddingHorizontal: t.space[8],
      borderRadius: t.radius.full,
      minHeight: 52,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pressed: { opacity: 0.8 },
    danger: { backgroundColor: t.colors.error },
    selected: { backgroundColor: t.colors.accent },
    disabled: { opacity: 0.4 },
    label: { ...t.type.button, color: t.colors.onPrimary },
    dangerLabel: { color: t.colors.onError },
    selectedLabel: { color: t.colors.onAccent },
  });
