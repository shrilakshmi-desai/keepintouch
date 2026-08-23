/**
 * Reminder wording is computed in whole calendar days in the device's timezone,
 * not in elapsed hours — "due tomorrow" should mean the next calendar day, even
 * if that's only three hours away.
 */
export type DueStatus = {
  label: string;
  overdue: boolean;
  /** No reminder scheduled at all. */
  unscheduled: boolean;
};

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function describeDue(nextReminderAt: string | null, now: Date = new Date()): DueStatus {
  if (!nextReminderAt) {
    return { label: 'No reminder set', overdue: false, unscheduled: true };
  }

  const due = new Date(nextReminderAt);
  if (Number.isNaN(due.getTime())) {
    return { label: 'No reminder set', overdue: false, unscheduled: true };
  }

  const days = Math.round((startOfLocalDay(due) - startOfLocalDay(now)) / MS_PER_DAY);

  if (days < 0) {
    const overdueBy = Math.abs(days);
    return {
      label: overdueBy === 1 ? 'Overdue by 1 day' : `Overdue by ${overdueBy} days`,
      overdue: true,
      unscheduled: false,
    };
  }
  if (days === 0) {
    // Still today, but the moment may already have passed.
    return {
      label: due.getTime() < now.getTime() ? 'Due today' : `Due today, ${formatTime(due)}`,
      overdue: due.getTime() < now.getTime(),
      unscheduled: false,
    };
  }
  if (days === 1) return { label: 'Due tomorrow', overdue: false, unscheduled: false };
  if (days < 7) return { label: `Due in ${days} days`, overdue: false, unscheduled: false };

  return { label: `Due ${formatDate(due)}`, overdue: false, unscheduled: false };
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} at ${formatTime(date)}`;
}
