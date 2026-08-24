/**
 * Wall-clock arithmetic in a specific IANA time zone.
 *
 * The app computes reminders in the device's local zone. The reminder sender
 * runs on a server whose local zone is UTC, so it has to be told which zone to
 * think in — otherwise "every Sunday 9am" fires at 9am UTC.
 *
 * Both paths go through the same Clock interface so the cadence logic itself
 * stays identical on device and on the server.
 */

export type WallClock = {
  year: number;
  /** 1-12, unlike Date#getMonth. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday, matching Date#getDay. */
  weekday: number;
};

export type Clock = {
  partsOf(date: Date): WallClock;
  /** Day/month overflow is normalised, so day: 32 rolls into the next month. */
  instantFrom(parts: { year: number; month: number; day: number; hour: number; minute: number }): Date;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** The runtime's own zone — what the mobile app has always used. */
const localClock: Clock = {
  partsOf(date) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      weekday: date.getDay(),
    };
  },
  instantFrom({ year, month, day, hour, minute }) {
    return new Date(year, month - 1, day, hour, minute, 0, 0);
  },
};

function zonedClock(timeZone: string): Clock {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    // h23 rather than hour12:false: some ICU builds report midnight as hour 24
    // under hour12:false, which would push every calculation a day forward.
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const read = (date: Date) => {
    const map: Record<string, string> = {};
    for (const part of formatter.formatToParts(date)) map[part.type] = part.value;
    return map;
  };

  /** How far this zone is from UTC at a given instant, in milliseconds. */
  const offsetAt = (date: Date): number => {
    const map = read(date);
    const asIfUtc = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second),
    );
    return asIfUtc - date.getTime();
  };

  return {
    partsOf(date) {
      const map = read(date);
      return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
        hour: Number(map.hour),
        minute: Number(map.minute),
        weekday: WEEKDAY_INDEX[map.weekday] ?? 0,
      };
    },

    instantFrom({ year, month, day, hour, minute }) {
      // Treat the wall-clock reading as if it were UTC, then subtract the zone's
      // offset. Date.UTC normalises overflow, so day + 7 crosses months cleanly.
      const naive = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

      // Two passes: the offset at the naive instant may not be the offset at the
      // real one when the target falls near a DST transition.
      const firstPass = naive - offsetAt(new Date(naive));
      const secondPass = naive - offsetAt(new Date(firstPass));
      return new Date(secondPass);
    },
  };
}

const cache = new Map<string, Clock>();

/**
 * A clock for the given zone, or the runtime's local clock when omitted.
 *
 * An unrecognised zone falls back to local rather than throwing: a bad value in
 * one profile row shouldn't take down a run that's sending everyone's reminders.
 */
export function clockFor(timeZone?: string | null): Clock {
  if (!timeZone) return localClock;

  const cached = cache.get(timeZone);
  if (cached) return cached;

  try {
    // Throws RangeError on an unknown zone.
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    return localClock;
  }

  const clock = zonedClock(timeZone);
  cache.set(timeZone, clock);
  return clock;
}
