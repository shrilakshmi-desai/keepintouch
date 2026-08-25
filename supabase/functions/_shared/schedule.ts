/**
 * The cadence engine. Single source of truth, imported by both the app
 * (via src/lib/schedule.ts) and the reminder sender Edge Function.
 *
 * Deliberately free of React Native and Deno APIs so it runs unchanged in both.
 * Formatting for display lives in the app; this file is arithmetic only.
 */
import { clockFor, type Clock } from './zonedClock.ts';

export type ScheduleKind = 'recurring' | 'monthly' | 'interval' | 'one_time';

export type ScheduleConfig = {
  weekday?: number;
  hour?: number;
  minute?: number;
  everyWeeks?: number;
  everyDays?: number;
  /** monthly: 1-31, clamped to the last day of shorter months. */
  dayOfMonth?: number;
  everyMonths?: number;
  fireAt?: string;
};

/**
 * A validated schedule. `schedule_config` is jsonb, so anything could be in the
 * column — parseSchedule() is the only way to get one of these, and it clamps
 * every field into range rather than trusting the row.
 */
export type Schedule =
  | {
      kind: 'recurring';
      /** 0 = Sunday. */
      weekday: number;
      hour: number;
      minute: number;
      /** 1 = weekly, 2 = fortnightly, 26 ≈ every six months. */
      everyWeeks: number;
    }
  | {
      kind: 'monthly';
      /** 1-31. Months without that date use their last day. */
      dayOfMonth: number;
      hour: number;
      minute: number;
      /** 1 = every month, 3 = quarterly. */
      everyMonths: number;
    }
  | { kind: 'interval'; everyDays: number; hour: number; minute: number }
  | { kind: 'one_time'; fireAt: string };

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const WEEKDAY_FULL = [
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

function defaultFireAt(): string {
  const at = new Date(Date.now() + 60 * 60 * 1000);
  at.setSeconds(0, 0);
  return at.toISOString();
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
      fireAt: fireAt && !Number.isNaN(fireAt.getTime()) ? fireAt.toISOString() : defaultFireAt(),
    };
  }

  if (kind === 'monthly') {
    return {
      kind: 'monthly',
      dayOfMonth: clamp(readNumber(source, 'dayOfMonth', 1), 1, 31),
      hour: clamp(readNumber(source, 'hour', DEFAULT_HOUR), 0, 23),
      minute: clamp(readNumber(source, 'minute', DEFAULT_MINUTE), 0, 59),
      everyMonths: clamp(readNumber(source, 'everyMonths', 1), 1, 24),
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
    case 'monthly':
      return {
        dayOfMonth: schedule.dayOfMonth,
        hour: schedule.hour,
        minute: schedule.minute,
        everyMonths: schedule.everyMonths,
      };
    case 'interval':
      return { everyDays: schedule.everyDays, hour: schedule.hour, minute: schedule.minute };
    case 'one_time':
      return { fireAt: schedule.fireAt };
  }
}

/**
 * A wall-clock instant `dayOffset` days from `base`, in the clock's zone.
 *
 * Calendar arithmetic, not `+ n * 86400000`: adding days through wall-clock
 * fields keeps the time stable across a DST boundary, so a 9am reminder stays
 * at 9am rather than sliding to 8am or 10am.
 */
function atWallTime(clock: Clock, base: Date, dayOffset: number, hour: number, minute: number): Date {
  const parts = clock.partsOf(base);
  return clock.instantFrom({
    year: parts.year,
    month: parts.month,
    day: parts.day + dayOffset,
    hour,
    minute,
  });
}

/** Day count for a 1-based month. Day 0 of the next month is the last of this one. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export type ComputeOptions = {
  /** The instant the next reminder must fall strictly after. Defaults to now. */
  from?: Date;
  /**
   * True when recomputing because the user just reached out. A one-time reminder
   * has no next occurrence, so it resolves to null.
   */
  afterContact?: boolean;
  /**
   * IANA zone to reason in. Omit on device to use the runtime's own zone; the
   * server passes the owner's saved zone.
   */
  timeZone?: string | null;
};

/** The next moment this schedule should fire, or null when there isn't one. */
export function computeNextReminder(
  schedule: Schedule,
  { from = new Date(), afterContact = false, timeZone }: ComputeOptions = {},
): Date | null {
  const clock = clockFor(timeZone);

  switch (schedule.kind) {
    case 'one_time': {
      if (afterContact) return null;
      const fireAt = new Date(schedule.fireAt);
      return Number.isNaN(fireAt.getTime()) ? null : fireAt;
    }

    case 'monthly': {
      const start = clock.partsOf(from);
      let year = start.year;
      let month = start.month;

      // Step whole months rather than adding days, so the date stays put
      // instead of drifting the way a 28- or 30-day cycle would. The bound is
      // a backstop: with everyMonths >= 1 the first or second pass always hits.
      for (let attempt = 0; attempt < 64; attempt += 1) {
        // Clamped, so "the 31st" lands on the 30th, or the 28th in February,
        // rather than silently rolling into the following month.
        const day = Math.min(schedule.dayOfMonth, daysInMonth(year, month));
        const candidate = clock.instantFrom({ year, month, day, hour: schedule.hour, minute: schedule.minute });

        if (candidate.getTime() > from.getTime()) return candidate;

        month += schedule.everyMonths;
        while (month > 12) {
          month -= 12;
          year += 1;
        }
      }
      return null;
    }

    case 'interval': {
      let candidate = atWallTime(clock, from, schedule.everyDays, schedule.hour, schedule.minute);
      // Guards the edge where the target time-of-day lands at or before `from`.
      while (candidate.getTime() <= from.getTime()) {
        candidate = atWallTime(clock, candidate, schedule.everyDays, schedule.hour, schedule.minute);
      }
      return candidate;
    }

    case 'recurring': {
      const today = clock.partsOf(from);
      const daysUntilWeekday = (schedule.weekday - today.weekday + 7) % 7;
      let candidate = atWallTime(clock, from, daysUntilWeekday, schedule.hour, schedule.minute);

      // Today already past that time — go to the following week.
      if (candidate.getTime() <= from.getTime()) {
        candidate = atWallTime(clock, candidate, 7, schedule.hour, schedule.minute);
      }
      // "Every N weeks" counts from this occurrence onwards.
      if (schedule.everyWeeks > 1) {
        candidate = atWallTime(
          clock,
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

type ScheduleBearing = {
  schedule_kind: ScheduleKind;
  schedule_config: unknown;
};

/**
 * When a person's next notification should fire, or null if none should.
 *
 * A reminder that passed without being acted on keeps its next_reminder_at, so
 * the person stays visibly overdue, but they should still be nudged again on
 * their cadence — hence the fallback to the next computed occurrence. A missed
 * one-time reminder has no next occurrence, so it stays overdue and silent.
 */
export function nextFireTime(
  contact: ScheduleBearing & { next_reminder_at: string | null },
  now: Date = new Date(),
  timeZone?: string | null,
): Date | null {
  if (contact.next_reminder_at) {
    const at = new Date(contact.next_reminder_at);
    if (!Number.isNaN(at.getTime()) && at.getTime() > now.getTime()) return at;
  }

  const schedule = parseSchedule(contact.schedule_kind, contact.schedule_config);
  if (schedule.kind === 'one_time') return null;

  return computeNextReminder(schedule, { from: now, timeZone });
}

/**
 * Where the next reminder lands once the user has been in touch.
 *
 * Measured from the moment of contact, not from the reminder that prompted it —
 * replying three days late shouldn't compress the next gap to four days.
 */
export function nextReminderAfterContact(
  contact: ScheduleBearing,
  now: Date = new Date(),
  timeZone?: string | null,
): Date | null {
  const schedule = parseSchedule(contact.schedule_kind, contact.schedule_config);
  return computeNextReminder(schedule, { from: now, afterContact: true, timeZone });
}

export function defaultSchedule(kind: ScheduleKind): Schedule {
  return parseSchedule(kind, {});
}

/** Structural equality, so the form can tell whether to recompute. */
export function sameSchedule(a: Schedule, b: Schedule): boolean {
  if (a.kind !== b.kind) return false;
  return JSON.stringify(scheduleToConfig(a)) === JSON.stringify(scheduleToConfig(b));
}
