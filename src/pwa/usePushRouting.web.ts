import { useEffect } from 'react';
import { navigationRef } from '../navigation/navigationRef';

/**
 * Routes a notification tap when the app is already open.
 *
 * Opening a fresh window is handled by the URL itself via the linking config.
 * But when a tab already exists the service worker focuses it instead, and a
 * focused tab does not re-navigate — so the worker posts the target here.
 */
export function usePushRouting(): void {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (!data || data.type !== 'notification-click' || !data.url) return;

      const match = /^\/person\/(.+)$/.exec(data.url);
      if (!match || !navigationRef.isReady()) return;

      navigationRef.navigate('PersonDetail', { contactId: match[1] });
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);
}
