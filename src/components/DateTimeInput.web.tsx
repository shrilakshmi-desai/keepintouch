import type { DateTimeInputProps } from './DateTimeInput';
import { colors, spacing } from '../theme';

/**
 * Browser date/time control.
 *
 * @react-native-community/datetimepicker renders null on web, so this uses the
 * native HTML inputs instead. Rendered as real DOM rather than RN primitives
 * because there is no react-native-web equivalent of a date picker.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * `datetime-local` and `time` inputs speak local wall-clock strings with no zone.
 * Both directions are built from local getters/setters, so the value the user
 * sees is the value that gets stored — going via toISOString() here would shift
 * the reminder by the UTC offset.
 */
function toInputValue(date: Date, mode: 'datetime' | 'time'): string {
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (mode === 'time') return time;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${time}`;
}

function fromInputValue(raw: string, mode: 'datetime' | 'time', previous: Date): Date | null {
  if (!raw) return null;

  if (mode === 'time') {
    const [hours, minutes] = raw.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    const next = new Date(previous);
    next.setHours(hours, minutes, 0, 0);
    return next;
  }

  const [datePart, timePart] = raw.split('T');
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  if ([year, month, day, hours, minutes].some((n) => !Number.isFinite(n))) return null;

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export default function DateTimeInput({
  value,
  mode,
  onChange,
  accessibilityLabel,
}: DateTimeInputProps) {
  return (
    <input
      type={mode === 'time' ? 'time' : 'datetime-local'}
      aria-label={accessibilityLabel}
      value={toInputValue(value, mode)}
      onChange={(event) => {
        const next = fromInputValue(event.target.value, mode, value);
        // Clearing the field leaves the previous value rather than producing an
        // Invalid Date that would silently disable the reminder.
        if (next) onChange(next);
      }}
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: `${spacing.md}px`,
        fontSize: 16,
        fontFamily: 'inherit',
        color: colors.text,
        background: colors.background,
        minWidth: 180,
      }}
    />
  );
}
