/**
 * App-facing scheduling API.
 *
 * The cadence engine itself lives in supabase/functions/_shared/schedule.ts so
 * the reminder sender imports the exact same code — Deno can't reach into src/,
 * and duplicating this logic is how the app and the server would silently drift
 * apart on the one thing that has to agree.
 *
 * Only display formatting lives here, because it needs Intl and is never used
 * server-side.
 */
export {
  WEEKDAY_FULL,
  WEEKDAY_LABELS,
  computeNextReminder,
  defaultSchedule,
  nextFireTime,
  nextReminderAfterContact,
  parseSchedule,
  sameSchedule,
  scheduleToConfig,
  type ComputeOptions,
  type Schedule,
} from '../../supabase/functions/_shared/schedule';

import { WEEKDAY_FULL, type Schedule } from '../../supabase/functions/_shared/schedule';
import { formatDate, formatTime } from './format';

/** 1 → "1st", 22 → "22nd". 11-13 are the usual exceptions. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

function timeLabel(hour: number, minute: number): string {
  return formatTime(new Date(2000, 0, 1, hour, minute));
}

export function describeSchedule(schedule: Schedule): string {
  switch (schedule.kind) {
    case 'recurring': {
      const day = WEEKDAY_FULL[schedule.weekday];
      const at = timeLabel(schedule.hour, schedule.minute);
      if (schedule.everyWeeks === 1) return `Every ${day} at ${at}`;
      return `Every ${schedule.everyWeeks} weeks on ${day} at ${at}`;
    }
    case 'monthly': {
      const at = timeLabel(schedule.hour, schedule.minute);
      const day = ordinal(schedule.dayOfMonth);
      if (schedule.everyMonths === 1) return `Monthly on the ${day} at ${at}`;
      return `Every ${schedule.everyMonths} months on the ${day} at ${at}`;
    }
    case 'interval': {
      const at = timeLabel(schedule.hour, schedule.minute);
      const every = schedule.everyDays === 1 ? 'day' : `${schedule.everyDays} days`;
      return `Every ${every} at ${at}`;
    }
    case 'one_time': {
      const fireAt = new Date(schedule.fireAt);
      if (Number.isNaN(fireAt.getTime())) return 'One-off reminder';
      return `Once on ${formatDate(fireAt)} at ${formatTime(fireAt)}`;
    }
  }
}
