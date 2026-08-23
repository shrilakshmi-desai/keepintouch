import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getNotificationPermission,
  requestNotificationPermission,
  syncNotifications,
  type PermissionState,
} from '../lib/notifications';
import { colors, spacing } from '../theme';

/**
 * Without notification access the app still tracks people but never nudges,
 * which looks like it's simply broken. This says so on the main screen rather
 * than leaving it buried in Settings.
 *
 * Renders nothing when permission is granted or still unknown.
 */
export default function NotificationNotice() {
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [busy, setBusy] = useState(false);

  // Rechecked on focus so returning from the OS settings app clears the banner.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getNotificationPermission()
        .then((state) => {
          if (active) setPermission(state);
        })
        .catch(() => {
          if (active) setPermission(null);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  // 'unsupported' is the web build before Web Push lands — say so plainly rather
  // than offering an Allow button that cannot do anything.
  if (permission === null || permission === 'granted') return null;

  if (permission === 'unsupported') {
    return (
      <View style={styles.banner}>
        <View style={styles.text}>
          <Text style={styles.title}>Reminders aren&rsquo;t on yet here</Text>
          <Text style={styles.body}>
            Everything else works in the browser. Reminder notifications currently arrive in the
            mobile app.
          </Text>
        </View>
      </View>
    );
  }

  const denied = permission === 'denied';

  async function handlePress() {
    if (denied) {
      Linking.openSettings().catch(() => {});
      return;
    }
    setBusy(true);
    try {
      const next = await requestNotificationPermission();
      setPermission(next);
      if (next === 'granted') await syncNotifications();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.banner}>
      <View style={styles.text}>
        <Text style={styles.title}>Reminders are off</Text>
        <Text style={styles.body}>
          {denied
            ? 'Notifications are blocked for this app, so nobody here will nudge you.'
            : 'Allow notifications and your schedules will start nudging you.'}
        </Text>
      </View>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={handlePress} disabled={busy}>
        <Text style={[styles.action, busy && styles.actionBusy]}>
          {denied ? 'Settings' : busy ? 'Asking…' : 'Allow'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
