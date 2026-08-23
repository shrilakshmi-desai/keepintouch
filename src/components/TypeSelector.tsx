import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CONTACT_TYPES, CONTACT_TYPE_LABELS } from '../lib/contacts';
import type { ContactType } from '../lib/database.types';
import { colors, spacing } from '../theme';

type Props = {
  value: ContactType;
  onChange: (next: ContactType) => void;
};

export default function TypeSelector({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Type</Text>
      <View style={styles.row}>
        {CONTACT_TYPES.map((type) => {
          const selected = type === value;
          return (
            <Pressable
              key={type}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(type)}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {CONTACT_TYPE_LABELS[type]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  optionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  pressed: {
    opacity: 0.7,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  optionTextSelected: {
    color: colors.accent,
  },
});
