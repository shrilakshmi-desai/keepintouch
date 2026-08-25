import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import Button from '../components/Button';
import { notify } from '../lib/dialogs';
import {
  LOCAL_NOTIFICATIONS_SUPPORTED,
  getNotificationPermission,
  requestNotificationPermission,
  syncNotifications,
  type PermissionState,
  type SyncResult,
} from '../lib/notifications';
import { deviceTimeZone, getProfile, setTimeZone } from '../lib/profile';
import {
  WEB_PUSH_PLATFORM,
  getWebPushState,
  needsHomeScreenInstall,
  subscribeToWebPush,
  unsubscribeFromWebPush,
  type WebPushState,
} from '../lib/webPush';
import { colors, radius, shadow, spacing, type } from '../theme';

const PERMISSION_COPY: Record<PermissionState, { title: string; body: string }> = {
  granted: {
    title: 'Reminders are on',
    body: 'KeepInTouch will nudge you when it’s time to reach out.',
  },
  undetermined: {
    title: 'Reminders are off',
    body: 'Allow notifications and your schedules will start nudging you.',
  },
  denied: {
    title: 'Reminders are blocked',
    body: 'Notifications are turned off for this app, so nothing will nudge you. You can re-enable them in your device settings.',
  },
  unsupported: {
    title: 'Reminders are mobile-only for now',
    body: 'This browser version can’t schedule reminders yet — they arrive in the mobile app.',
  },
};

const WEB_PUSH_COPY: Record<WebPushState, { title: string; body: string }> = {
  subscribed: {
    title: 'Reminders are on',
    body: 'This device will get a push when it’s time to reach out.',
  },
  unsubscribed: {
    title: 'Reminders are off',
    body: 'Turn them on to get a push when it’s time to reach out.',
  },
  denied: {
    title: 'Reminders are blocked',
    body: 'Notifications are turned off for this site. Re-enable them in your browser settings.',
  },
  unsupported: {
    title: 'Reminders aren’t available here',
    body: 'This browser can’t receive push notifications.',
  },
};

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [pushState, setPushState] = useState<WebPushState | null>(null);
  const [sync, setSync] = useState<SyncResult | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const read = async () => {
        if (WEB_PUSH_PLATFORM) {
          const state = await getWebPushState().catch(() => 'unsupported' as WebPushState);
          if (active) setPushState(state);
        } else {
          const state = await getNotificationPermission().catch(() => null);
          if (active) setPermission(state);
        }
        const profile = await getProfile().catch(() => null);
        if (active && profile) setTimezone(profile.timezone);
      };

      read();
      return () => {
        active = false;
      };
    }, []),
  );

  async function run(action: () => Promise<void>, failureTitle: string) {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      await notify(failureTitle, e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const device = deviceTimeZone();
  const timezoneMismatch = timezone !== null && timezone !== device;

  const copy = WEB_PUSH_PLATFORM
    ? pushState && WEB_PUSH_COPY[pushState]
    : permission && PERMISSION_COPY[permission];
  const blocked = WEB_PUSH_PLATFORM ? pushState === 'denied' : permission === 'denied';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Notifications</Text>

        {copy ? (
          <View style={[styles.card, blocked && styles.cardWarning]}>
            <Text style={[styles.cardTitle, blocked && styles.cardTitleWarning]}>{copy.title}</Text>
            <Text style={styles.cardBody}>{copy.body}</Text>
            {sync && permission === 'granted' ? (
              <Text style={styles.cardBody}>
                {sync.scheduled} reminder{sync.scheduled === 1 ? '' : 's'} scheduled
                {sync.skipped > 0 ? ` · ${sync.skipped} waiting for a free slot` : ''}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.cardBody}>Checking…</Text>
        )}

        {WEB_PUSH_PLATFORM && pushState === 'unsubscribed' ? (
          <Button
            label={busy ? 'Turning on…' : 'Turn on reminders'}
            disabled={busy}
            onPress={() =>
              run(async () => setPushState(await subscribeToWebPush()), 'Could not turn on reminders')
            }
          />
        ) : null}

        {WEB_PUSH_PLATFORM && pushState === 'subscribed' ? (
          <Button
            label={busy ? 'Turning off…' : 'Turn off reminders'}
            variant="secondary"
            disabled={busy}
            onPress={() =>
              run(async () => {
                await unsubscribeFromWebPush();
                setPushState('unsubscribed');
              }, 'Could not turn off reminders')
            }
          />
        ) : null}

        {WEB_PUSH_PLATFORM && pushState === 'unsupported' && needsHomeScreenInstall() ? (
          <Text style={styles.cardBody}>
            On iPhone, tap Share then Add to Home Screen — reminders only reach an installed app.
          </Text>
        ) : null}

        {!WEB_PUSH_PLATFORM && permission === 'undetermined' ? (
          <Button
            label={busy ? 'Asking…' : 'Allow notifications'}
            disabled={busy}
            onPress={() =>
              run(async () => {
                const next = await requestNotificationPermission();
                setPermission(next);
                if (next === 'granted') setSync(await syncNotifications());
              }, 'Something went wrong')
            }
          />
        ) : null}

        {blocked && !WEB_PUSH_PLATFORM ? (
          <Button
            label="Open device settings"
            variant="secondary"
            onPress={() => Linking.openSettings().catch(() => {})}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Time zone</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{timezone ?? 'Checking…'}</Text>
          <Text style={styles.cardBody}>
            Reminder times are worked out in this zone, including when they&rsquo;re sent to you
            while the app is closed.
          </Text>
        </View>
        {timezoneMismatch ? (
          <Button
            label={busy ? 'Updating…' : `Use this device’s zone (${device})`}
            variant="secondary"
            disabled={busy}
            onPress={() =>
              run(async () => {
                await setTimeZone(device);
                setTimezone(device);
              }, 'Could not update time zone')
            }
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account</Text>
        <Text style={styles.email}>{session?.user.email ?? 'Unknown account'}</Text>
        <Button
          label={busy ? 'Working…' : 'Sign out'}
          variant="secondary"
          disabled={busy}
          onPress={() => run(() => signOut(), 'Could not sign out')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...type.label,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadow.card,
  },
  cardWarning: {
    backgroundColor: colors.overdueSoft,
  },
  cardTitle: {
    ...type.heading,
    color: colors.text,
  },
  cardTitleWarning: {
    color: colors.overdue,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  email: {
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.xs,
  },
});
