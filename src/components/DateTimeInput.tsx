import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateTime, formatTime } from '../lib/format';
import { colors, spacing } from '../theme';

export type DateTimeInputProps = {
  value: Date;
  mode: 'datetime' | 'time';
  onChange: (next: Date) => void;
  accessibilityLabel?: string;
};

/**
 * Native date/time control: a button showing the current value that reveals the
 * system picker inline. See DateTimeInput.web.tsx for the browser version —
 * @react-native-community/datetimepicker renders null on web.
 */
export default function DateTimeInput({
  value,
  mode,
  onChange,
  accessibilityLabel,
}: DateTimeInputProps) {
  const [open, setOpen] = useState(false);
  const label = mode === 'time' ? formatTime(value) : formatDateTime(value);

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.value}>{label}</Text>
      </Pressable>

      {open ? (
        <DateTimePicker
          value={value}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selected) => {
            if (Platform.OS !== 'ios') setOpen(false);
            if (event.type === 'dismissed' || !selected) return;
            onChange(selected);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minWidth: 140,
  },
  pressed: {
    opacity: 0.7,
  },
  value: {
    fontSize: 16,
    color: colors.text,
  },
});
