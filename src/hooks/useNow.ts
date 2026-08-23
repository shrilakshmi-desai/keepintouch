import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * A current time that actually advances.
 *
 * Relative labels ("Due today", "Overdue by 1 day") are derived at render, so
 * without something forcing a re-render they freeze at whatever they said when
 * the screen mounted — a list left open across midnight keeps claiming "today".
 *
 * Ticks on an interval and again whenever the app returns to the foreground,
 * which covers the phone being asleep with the timer suspended.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());

    const timer = setInterval(tick, intervalMs);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [intervalMs]);

  return now;
}
