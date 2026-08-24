/**
 * Notification text. Kept free of expo imports so it can be tested directly.
 */

export const GENERIC_REMINDER_BODY = 'Tap to see their details and mark that you got in touch.';

export function reminderTitle(name: string): string {
  const trimmed = name?.trim();
  return trimmed ? `Time to reach out to ${trimmed}` : 'Time to reach out';
}

/**
 * The person's talking points, or a generic prompt.
 *
 * Guards every shape the column can hold — null, undefined, empty, or
 * whitespace-only — so the literal text "null" or "undefined" can never appear
 * in a banner. Non-string values are treated as absent rather than coerced.
 */
export function reminderBody(talkingPoints: unknown): string {
  if (typeof talkingPoints !== 'string') return GENERIC_REMINDER_BODY;
  const trimmed = talkingPoints.trim();
  if (!trimmed) return GENERIC_REMINDER_BODY;
  return trimmed;
}
