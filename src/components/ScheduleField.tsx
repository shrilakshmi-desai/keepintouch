import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ScheduleKind } from '../lib/database.types';
import { formatDateTime } from '../lib/format';
import DateTimeInput from './DateTimeInput';
import {
  WEEKDAY_LABELS,
  computeNextReminder,
  defaultSchedule,
  describeSchedule,
  type Schedule,
} from '../lib/schedule';
import { colors, radius, spacing, type } from '../theme';

type Props = {
  value: Schedule;
  onChange: (next: Schedule) => void;
};

const KIND_OPTIONS: { kind: ScheduleKind; label: string }[] = [
  { kind: 'monthly', label: 'Monthly' },
  { kind: 'recurring', label: 'Weekly' },
  { kind: 'interval', label: 'Every N days' },
  { kind: 'one_time', label: 'Once' },
];

const MONTH_PRESETS: { months: number; label: string }[] = [
  { months: 1, label: 'Monthly' },
  { months: 2, label: '2 months' },
  { months: 3, label: 'Quarterly' },
  { months: 6, label: '6 months' },
];

const WEEK_PRESETS: { weeks: number; label: string }[] = [
  { weeks: 1, label: 'Weekly' },
  { weeks: 2, label: '2 weeks' },
  { weeks: 4, label: '4 weeks' },
  { weeks: 26, label: '6 months' },
];

function Chip({
  label,
  selected,
  onPress,
  compact,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        compact && styles.chipCompact,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function ScheduleField({ value, onChange }: Props) {
  const preview = computeNextReminder(value);

  function switchKind(kind: ScheduleKind) {
    if (kind === value.kind) return;
    // Carry the time of day across kinds where it makes sense.
    const next = defaultSchedule(kind);
    if (next.kind !== 'one_time' && value.kind !== 'one_time') {
      onChange({ ...next, hour: value.hour, minute: value.minute });
      return;
    }
    onChange(next);
  }

  const timeAsDate =
    value.kind === 'one_time' ? new Date(value.fireAt) : new Date(2000, 0, 1, value.hour, value.minute);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Schedule</Text>

      <View style={styles.row}>
        {KIND_OPTIONS.map((option) => (
          <Chip
            key={option.kind}
            label={option.label}
            selected={value.kind === option.kind}
            onPress={() => switchKind(option.kind)}
          />
        ))}
      </View>

      {value.kind === 'recurring' ? (
        <>
          <Text style={styles.subLabel}>Day</Text>
          <View style={styles.row}>
            {WEEKDAY_LABELS.map((day, index) => (
              <Chip
                key={day}
                label={day}
                compact
                selected={value.weekday === index}
                onPress={() => onChange({ ...value, weekday: index })}
              />
            ))}
          </View>

          <Text style={styles.subLabel}>How often</Text>
          <View style={styles.row}>
            {WEEK_PRESETS.map((preset) => (
              <Chip
                key={preset.weeks}
                label={preset.label}
                selected={value.everyWeeks === preset.weeks}
                onPress={() => onChange({ ...value, everyWeeks: preset.weeks })}
              />
            ))}
          </View>
        </>
      ) : null}

      {value.kind === 'monthly' ? (
        <>
          <View style={styles.inlineRow}>
            <Text style={styles.inlineText}>On day</Text>
            <TextInput
              value={String(value.dayOfMonth)}
              onChangeText={(text) => {
                const digits = text.replace(/[^0-9]/g, '');
                onChange({
                  ...value,
                  dayOfMonth: digits === '' ? 1 : Math.min(31, Math.max(1, Number(digits))),
                });
              }}
              keyboardType="number-pad"
              selectTextOnFocus
              style={styles.numberInput}
              maxLength={2}
              accessibilityLabel="Day of the month"
            />
            <Text style={styles.inlineText}>of the month</Text>
          </View>

          {value.dayOfMonth > 28 ? (
            <Text style={styles.hint}>
              Months without a {value.dayOfMonth}
              {value.dayOfMonth === 31 ? 'st' : 'th'} use their last day instead.
            </Text>
          ) : null}

          <Text style={styles.subLabel}>How often</Text>
          <View style={styles.row}>
            {MONTH_PRESETS.map((preset) => (
              <Chip
                key={preset.months}
                label={preset.label}
                selected={value.everyMonths === preset.months}
                onPress={() => onChange({ ...value, everyMonths: preset.months })}
              />
            ))}
          </View>
        </>
      ) : null}

      {value.kind === 'interval' ? (
        <View style={styles.inlineRow}>
          <Text style={styles.inlineText}>Every</Text>
          <TextInput
            value={String(value.everyDays)}
            onChangeText={(text) => {
              const digits = text.replace(/[^0-9]/g, '');
              onChange({ ...value, everyDays: digits === '' ? 1 : Math.min(3650, Number(digits)) });
            }}
            keyboardType="number-pad"
            selectTextOnFocus
            style={styles.numberInput}
            maxLength={4}
            accessibilityLabel="Number of days between reminders"
          />
          <Text style={styles.inlineText}>days</Text>
        </View>
      ) : null}

      {value.kind === 'one_time' ? (
        <>
          <Text style={styles.subLabel}>When</Text>
          <DateTimeInput
            value={new Date(value.fireAt)}
            mode="datetime"
            accessibilityLabel="Reminder date and time"
            onChange={(selected) => onChange({ ...value, fireAt: selected.toISOString() })}
          />
        </>
      ) : (
        <>
          <Text style={styles.subLabel}>Time of day</Text>
          <DateTimeInput
            value={timeAsDate}
            mode="time"
            accessibilityLabel="Time of day for reminders"
            onChange={(selected) =>
              onChange({ ...value, hour: selected.getHours(), minute: selected.getMinutes() })
            }
          />
        </>
      )}

      <View style={styles.summary}>
        <Text style={styles.summaryLine}>{describeSchedule(value)}</Text>
        <Text style={styles.summaryMuted}>
          {preview ? `First reminder ${formatDateTime(preview)}` : 'No reminder will be scheduled'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    ...type.label,
    color: colors.textMuted,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipCompact: {
    paddingHorizontal: spacing.sm + 2,
    minWidth: 44,
    alignItems: 'center',
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chipTextSelected: {
    color: colors.accent,
  },
  pressed: {
    opacity: 0.7,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inlineText: {
    fontSize: 16,
    color: colors.text,
  },
  numberInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
    minWidth: 72,
    textAlign: 'center',
  },
  summary: {
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    gap: 2,
  },
  summaryLine: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  summaryMuted: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
