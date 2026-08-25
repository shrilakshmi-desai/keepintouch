import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, shadow, spacing, type } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  /** Blocks presses as well as dimming — a fast double-tap on Save would otherwise submit twice. */
  disabled?: boolean;
};

export default function Button({ label, onPress, variant = 'primary', disabled = false }: Props) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, isPrimary ? styles.primaryLabel : styles.secondaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: colors.accent,
    ...shadow.card,
  },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...type.bodyStrong,
  },
  primaryLabel: {
    color: colors.accentText,
  },
  secondaryLabel: {
    color: colors.text,
  },
});
