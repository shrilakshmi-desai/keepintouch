import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import {
  LOCAL_NOTIFICATIONS_SUPPORTED,
  cancelAllNotifications,
  configureNotifications,
  contactIdFromResponse,
  syncNotifications,
} from '../lib/notifications';
import { navigationRef } from '../navigation/navigationRef';

function reportSyncFailure(error: unknown) {
  console.warn('[notifications] sync failed:', error);
}

/**
 * Renders nothing. Keeps the OS notification queue in step with the database and
 * routes taps to the right person.
 */
export default function NotificationBridge() {
  const { session } = useAuth();

  useEffect(() => {
    if (!LOCAL_NOTIFICATIONS_SUPPORTED) return;
    configureNotifications().catch(reportSyncFailure);
  }, []);

  // Reschedule on sign-in and on every return to the foreground. Foreground sync
  // is what replaces "reschedule the moment one fires" — iOS won't wake us for a
  // delivered local notification, so the next app open is the reliable hook.
  useEffect(() => {
    if (!LOCAL_NOTIFICATIONS_SUPPORTED) return;
    if (!session) {
      cancelAllNotifications().catch(reportSyncFailure);
      return;
    }

    // First sync after sign-in is the one that may prompt for permission —
    // otherwise a new user is never asked and nothing is ever scheduled.
    syncNotifications(undefined, { requestIfUndetermined: true }).catch(reportSyncFailure);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncNotifications().catch(reportSyncFailure);
    });
    return () => subscription.remove();
  }, [session]);

  // A notification arriving while the app is open consumes a pending slot, so
  // queue up the following occurrence straight away.
  useEffect(() => {
    if (!LOCAL_NOTIFICATIONS_SUPPORTED || !session) return;
    const subscription = Notifications.addNotificationReceivedListener(() => {
      syncNotifications().catch(reportSyncFailure);
    });
    return () => subscription.remove();
  }, [session]);

  // Tapping a notification opens that person. Web Push taps are handled by the
  // service worker instead, wired up in a later step.
  useEffect(() => {
    if (!LOCAL_NOTIFICATIONS_SUPPORTED || !session) return;
    let cancelled = false;

    const open = (response: Notifications.NotificationResponse | null) => {
      const contactId = contactIdFromResponse(response);
      if (!contactId || !navigationRef.isReady()) return;
      navigationRef.navigate('PersonDetail', { contactId });
    };

    // Covers a cold start: the tap that launched the app has already happened.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!cancelled) open(response);
      })
      .catch(reportSyncFailure);

    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [session]);

  return null;
}
