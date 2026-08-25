import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { notify } from '../lib/dialogs';
import {
  LOCAL_NOTIFICATIONS_SUPPORTED,
  getNotificationPermission,
  requestNotificationPermission,
  syncNotifications,
  type PermissionState,
} from '../lib/notifications';
import {
  WEB_PUSH_PLATFORM,
  getWebPushState,
  needsHomeScreenInstall,
  subscribeToWebPush,
  type WebPushState,
} from '../lib/webPush';
import { colors, radius, spacing, type } from '../theme';

/**
 * Tells the user when reminders won't reach them, and offers the one action
 * that fixes it. Renders nothing once reminders are actually working.
 *
 * Native and web have different failure modes: on native it's a permission, on
 * web it's a permission *and* a push subscription, and on an iPhone it's "you
 * haven't installed it yet" — which reads as unsupported but is fixable.
 */
export default function NotificationNotice() {
  const [nativeState, setNativeState] = useState<PermissionState | null>(null);
  const [pushState, setPushState] = useState<WebPushState | null>(null);
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
          if (active) setNativeState(state);
        }
      };

      read();
      return () => {
        active = false;
      };
    }, []),
  );

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      await notify('Could not turn on reminders', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (WEB_PUSH_PLATFORM) {
    if (pushState === null || pushState === 'subscribed') return null;

    if (pushState === 'unsupported') {
      // On iOS this is fixable by installing; elsewhere it genuinely isn't.
      const installable = needsHomeScreenInstall();
      return (
        <Banner
          title={installable ? 'Add to your Home Screen for reminders' : 'Reminders aren’t available here'}
          body={
            installable
              ? 'Tap Share, then Add to Home Screen. iPhone only delivers reminders to an installed app.'
              : 'This browser can’t receive reminders. Everything else works — try Chrome, or the mobile app.'
          }
        />
      );
    }

    if (pushState === 'denied') {
      return (
        <Banner
          title="Reminders are blocked"
          body="Notifications are turned off for this site, so nobody here will nudge you. Re-enable them in your browser settings."
        />
      );
    }

    return (
      <Banner
        title="Reminders are off"
        body="Turn them on and you'll get a nudge when it's time to reach out."
        actionLabel={busy ? 'Turning on…' : 'Turn on'}
        onAction={() => run(async () => setPushState(await subscribeToWebPush()))}
        disabled={busy}
      />
    );
  }

  if (!LOCAL_NOTIFICATIONS_SUPPORTED) return null;
  if (nativeState === null || nativeState === 'granted') return null;

  if (nativeState === 'denied') {
    return (
      <Banner
        title="Reminders are blocked"
        body="Notifications are turned off for this app, so nobody here will nudge you."
        actionLabel="Settings"
        onAction={() => Linking.openSettings().catch(() => {})}
      />
    );
  }

  if (nativeState === 'unsupported') return null;

  return (
    <Banner
      title="Reminders are off"
      body="Allow notifications and your schedules will start nudging you."
      actionLabel={busy ? 'Asking…' : 'Allow'}
      disabled={busy}
      onAction={() =>
        run(async () => {
          const next = await requestNotificationPermission();
          setNativeState(next);
          if (next === 'granted') await syncNotifications();
        })
      }
    />
  );
}

function Banner({
  title,
  body,
  actionLabel,
  onAction,
  disabled,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.banner}>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onAction} disabled={disabled}>
          <Text style={[styles.action, disabled && styles.actionBusy]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.overdueSoft,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  action: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
  },
  actionBusy: {
    color: colors.textMuted,
  },
});
