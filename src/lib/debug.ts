/**
 * Temporary reminder/notification tracing for diagnosing Step 6 on device.
 * Flip to false (or delete this module and its call sites) once reminders are
 * confirmed working end to end.
 */
export const DEBUG_REMINDERS = true;

export function debugLog(scope: string, ...args: unknown[]): void {
  if (!DEBUG_REMINDERS) return;
  console.log(`[${scope}]`, ...args);
}

/** Local wall-clock rendering — the ISO string alone hides timezone mistakes. */
export function localStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}
