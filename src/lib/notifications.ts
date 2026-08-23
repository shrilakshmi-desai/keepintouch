import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { listContacts } from './contacts';
import type { Contact } from './database.types';
import { reminderBody, reminderTitle } from './reminderContent';
import { nextFireTime } from './schedule';

/**
 * iOS keeps at most 64 pending local notifications and silently drops the rest,
 * so we schedule one per person and stay comfortably under the ceiling. Anything
 * beyond this is picked up on a later sync as nearer reminders are consumed.
 */
const MAX_SCHEDULED = 60;

const ANDROID_CHANNEL_ID = 'reminders';

/**
 * On-device scheduling is a native capability. The browser gets reminders via
 * Web Push instead, which is wired up in a later step — until then the web build
 * deliberately schedules nothing rather than half-working.
 */
export const LOCAL_NOTIFICATIONS_SUPPORTED = Platform.OS !== 'web';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export type SyncResult = {
  permission: PermissionState;
  scheduled: number;
  /** People whose reminder didn't fit under MAX_SCHEDULED. */
  skipped: number;
};

export type SyncOptions = {
  /**
   * Show the system permission prompt if access hasn't been decided yet.
   * Without this, a first-run user is never asked and nothing is ever scheduled.
   */
  requestIfUndetermined?: boolean;
};

let configured = false;

/** Safe to call repeatedly; only the first call does anything. */
export async function configureNotifications(): Promise<void> {
  if (!LOCAL_NOTIFICATIONS_SUPPORTED || configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Keep-in-touch reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

function toState(status: Notifications.PermissionStatus): PermissionState {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function getNotificationPermission(): Promise<PermissionState> {
  if (!LOCAL_NOTIFICATIONS_SUPPORTED) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return toState(status);
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (!LOCAL_NOTIFICATIONS_SUPPORTED) return 'unsupported';
  const { status } = await Notifications.requestPermissionsAsync();
  return toState(status);
}

/**
 * Built fresh on every sync from the row just read. Notification content is a
 * snapshot taken at schedule time, not a live view of the database, so an edit
 * only reaches the banner once its notification is rescheduled.
 */
function buildContent(contact: Contact): Notifications.NotificationContentInput {
  return {
    title: reminderTitle(contact.name),
    body: reminderBody(contact.talking_points),
    data: { contactId: contact.id },
    ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : null),
  };
}

/**
 * Cancels everything and reschedules from current data. Idempotent by design —
 * calling it twice leaves the same set of pending notifications, which matters
 * because it runs on every foreground and after every edit.
 */
export async function syncNotifications(
  contacts?: Contact[],
  { requestIfUndetermined = false }: SyncOptions = {},
): Promise<SyncResult> {
  // Placeholder for the browser until Web Push lands. Scheduling nothing is the
  // honest behaviour: expo-notifications cannot deliver a reminder to a closed
  // tab, so a partial implementation here would look like it worked and silently
  // never fire.
  if (!LOCAL_NOTIFICATIONS_SUPPORTED) {
    return { permission: 'unsupported', scheduled: 0, skipped: 0 };
  }

  await configureNotifications();

  let permission = await getNotificationPermission();
  if (permission === 'undetermined' && requestIfUndetermined) {
    permission = await requestNotificationPermission();
  }

  if (permission !== 'granted') {
    // Don't leave stale notifications pending if access was revoked.
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    return { permission, scheduled: 0, skipped: 0 };
  }

  const rows = contacts ?? (await listContacts());
  const now = new Date();

  const due = rows
    .map((contact) => ({ contact, at: nextFireTime(contact, now) }))
    .filter((entry): entry is { contact: Contact; at: Date } => entry.at !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const scheduling = due.slice(0, MAX_SCHEDULED);

  await Notifications.cancelAllScheduledNotificationsAsync();

  let scheduled = 0;
  for (const { contact, at } of scheduling) {
    // nextFireTime should never return the past; a trigger date that has already
    // passed simply never fires, so it's worth saying so rather than failing mute.
    if (at.getTime() <= now.getTime()) {
      console.warn(`[notifications] skipped ${contact.name}: trigger is not in the future`);
      continue;
    }
    await Notifications.scheduleNotificationAsync({
      content: buildContent(contact),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
    scheduled += 1;
  }

  return {
    permission,
    scheduled,
    skipped: due.length - scheduling.length,
  };
}

export async function cancelAllNotifications(): Promise<void> {
  if (!LOCAL_NOTIFICATIONS_SUPPORTED) return;
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

/** Pulls the contact id out of a tapped notification, if it carries one. */
export function contactIdFromResponse(
  response: Notifications.NotificationResponse | null,
): string | null {
  const data = response?.notification?.request?.content?.data;
  const contactId =
    data && typeof data === 'object' ? (data as Record<string, unknown>).contactId : null;
  return typeof contactId === 'string' ? contactId : null;
}
