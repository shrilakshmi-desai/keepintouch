import type { Contact, ScheduleConfig, ScheduleKind } from './database.types';
import { formatDate, formatTime } from './format';

/**
 * A validated schedule. `schedule_config` is jsonb, so anything could be in the
 * column — parseSchedule() is the only way to get one of these, and it clamps
 * every field into range rather than trusting the row.
 */
export type Schedule =
  | {
      kind: 'recurring';
      /** 0 = Sunday, matching Date.getDay(). */
      weekday: number;
      hour: number;
      minute: number;
      /** 1 = weekly, 2 = fortnightly, 26 ≈ every six months. */
      everyWeeks: number;
    }
  | { kind: 'interval'; everyDays: number; hour: number; minute: number }
  | { kind: 'one_time'; fireAt: string };

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAY_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const DEFAULT_HOUR = 9;
const DEFAULT_MINUTE = 0;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function readNumber(source: Record<string, unknown>, key: string, fallback: number): number {
  const raw = source[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
}

export function parseSchedule(kind: ScheduleKind, config: unknown): Schedule {
  const source: Record<string, unknown> =
    config && typeof config === 'object' && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};

  if (kind === 'one_time') {
    const raw = source.fireAt;
    const fireAt = typeof raw === 'string' ? new Date(raw) : null;
    return {
      kind: 'one_time',
      fireAt:
        fireAt && !Number.isNaN(fireAt.getTime()) ? fireAt.toISOString() : defaultFireAt(),
    };
  }

  if (kind === 'interval') {
    return {
      kind: 'interval',
      everyDays: clamp(readNumber(source, 'everyDays', 14), 1, 3650),
      hour: clamp(readNumber(source, 'hour', DEFAULT_HOUR), 0, 23),
      minute: clamp(readNumber(source, 'minute', DEFAULT_MINUTE), 0, 59),
    };
  }

  return {
    kind: 'recurring',
    weekday: clamp(readNumber(source, 'weekday', 0), 0, 6),
    hour: clamp(readNumber(source, 'hour', DEFAULT_HOUR), 0, 23),
    minute: clamp(readNumber(source, 'minute', DEFAULT_MINUTE), 0, 59),
    everyWeeks: clamp(readNumber(source, 'everyWeeks', 1), 1, 52),
  };
}

/**
 * An hour from now, not tomorrow morning.
 *
 * A "tomorrow 09:00" default is a trap in a datetime picker: adjusting only the
 * time leaves the date on tomorrow, so setting "12:10 AM" silently means
 * tomorrow at 12:10 AM and the reminder reads a day later than intended.
 */
function defaultFireAt(): string {
  const at = new Date(Date.now() + 60 * 60 * 1000);
  at.setSeconds(0, 0);
  return at.toISOString();
}

/** Strips the discriminant — `kind` lives in the schedule_kind column. */
export function scheduleToConfig(schedule: Schedule): ScheduleConfig {
  switch (schedule.kind) {
    case 'recurring':
      return {
        weekday: schedule.weekday,
        hour: schedule.hour,
        minute: schedule.minute,
        everyWeeks: schedule.everyWeeks,
      };
    case 'interval':
      return { everyDays: schedule.everyDays, hour: schedule.hour, minute: schedule.minute };
    case 'one_time':
      return { fireAt: schedule.fireAt };
  }
}

/**
 * Builds a local wall-clock instant `dayOffset` days from `base`.
 *
 * Calendar arithmetic, not `+ n * 86400000`: adding days through the Date
 * constructor keeps the wall-clock time stable across a DST boundary, so a 9am
 * reminder stays at 9am rather than sliding to 8am or 10am.
 */
function atLocalTime(base: Date, dayOffset: number, hour: number, minute: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hour, minute, 0, 0);
}

export type ComputeOptions = {
  /** The instant the next reminder must fall strictly after. Defaults to now. */
  from?: Date;
  /**
   * True when recomputing because the user just reached out. A one-time reminder
   * has no next occurrence, so it resolves to null.
   */
  afterContact?: boolean;
};

/**
 * The next moment this schedule should fire, or null when there isn't one.
 */
export function computeNextReminder(
  schedule: Schedule,
  { from = new Date(), afterContact = false }: ComputeOptions = {},
): Date | null {
  switch (schedule.kind) {
    case 'one_time': {
      if (afterContact) return null;
      const fireAt = new Date(schedule.fireAt);
      return Number.isNaN(fireAt.getTime()) ? null : fireAt;
    }

    case 'interval': {
      let candidate = atLocalTime(from, schedule.everyDays, schedule.hour, schedule.minute);
      // Guards the edge where the target time-of-day is early enough to land at
      // or before `from` (only reachable at everyDays === 0, which clamp forbids).
      while (candidate.getTime() <= from.getTime()) {
        candidate = atLocalTime(candidate, schedule.everyDays, schedule.hour, schedule.minute);
      }
      return candidate;
    }

    case 'recurring': {
      const daysUntilWeekday = (schedule.weekday - from.getDay() + 7) % 7;
      let candidate = atLocalTime(from, daysUntilWeekday, schedule.hour, schedule.minute);

      // Today already past that time — go to the following week.
      if (candidate.getTime() <= from.getTime()) {
        candidate = atLocalTime(candidate, 7, schedule.hour, schedule.minute);
      }
      // "Every N weeks" counts from this occurrence onwards.
      if (schedule.everyWeeks > 1) {
        candidate = atLocalTime(
          candidate,
          (schedule.everyWeeks - 1) * 7,
          schedule.hour,
          schedule.minute,
        );
      }
      return candidate;
    }
  }
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

/**
 * When a person's next notification should fire, or null if none should.
 *
 * A reminder that passed without being acted on stays overdue in the UI — we
 * deliberately don't move next_reminder_at — but the person should still be
 * nudged again on their cadence, so we fall back to the next occurrence computed
 * from the schedule. A missed one-time reminder has no next occurrence, so it
 * stays overdue and silent until dealt with.
 */
export function nextFireTime(
  contact: Pick<Contact, 'next_reminder_at' | 'schedule_kind' | 'schedule_config'>,
  now: Date = new Date(),
): Date | null {
  if (contact.next_reminder_at) {
    const at = new Date(contact.next_reminder_at);
    if (!Number.isNaN(at.getTime()) && at.getTime() > now.getTime()) return at;
  }

  const schedule = parseSchedule(contact.schedule_kind, contact.schedule_config);
  if (schedule.kind === 'one_time') return null;

  return computeNextReminder(schedule, { from: now });
}

export function defaultSchedule(kind: ScheduleKind): Schedule {
  return parseSchedule(kind, {});
}

/** Structural equality, so the form can tell whether to recompute next_reminder_at. */
export function sameSchedule(a: Schedule, b: Schedule): boolean {
  if (a.kind !== b.kind) return false;
  return JSON.stringify(scheduleToConfig(a)) === JSON.stringify(scheduleToConfig(b));
}
