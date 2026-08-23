import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import Button from '../components/Button';
import {
  getNotificationPermission,
  requestNotificationPermission,
  syncNotifications,
  type PermissionState,
  type SyncResult,
} from '../lib/notifications';
import { colors, spacing } from '../theme';

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
    body: 'This browser version can’t schedule reminders yet — they arrive in the mobile app. Web notifications are coming.',
  },
};

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [sync, setSync] = useState<SyncResult | null>(null);
  const [busy, setBusy] = useState(false);

  // Rechecked on focus so returning from the OS settings app shows the truth.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getNotificationPermission()
        .then((state) => {
          if (active) setPermission(state);
        })
        .catch(() => {
          if (active) setPermission('undetermined');
        });
      return () => {
        active = false;
      };
    }, []),
  );

  async function handleEnable() {
    setBusy(true);
    try {
      const next = await requestNotificationPermission();
      setPermission(next);
      if (next === 'granted') {
        setSync(await syncNotifications());
      } else {
        // iOS only ever shows the system prompt once; after that it's Settings.
        Alert.alert(
          'Notifications not enabled',
          'You can turn them on for KeepInTouch in your device settings.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
      }
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
    } catch (e) {
      Alert.alert('Could not sign out', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const copy = permission ? PERMISSION_COPY[permission] : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Notifications</Text>
        {copy ? (
          <View style={[styles.card, permission === 'denied' && styles.cardWarning]}>
            <Text style={[styles.cardTitle, permission === 'denied' && styles.cardTitleWarning]}>
              {copy.title}
            </Text>
            <Text style={styles.cardBody}>{copy.body}</Text>
            {sync && permission === 'granted' ? (
              <Text style={styles.cardBody}>
                {sync.scheduled} reminder{sync.scheduled === 1 ? '' : 's'} scheduled
                {sync.skipped > 0 ? ` · ${sync.skipped} waiting for a free slot` : ''}
              </Text>
            ) : null}
          </View>
        ) : null}

        {permission === null ? <Text style={styles.cardBody}>Checking…</Text> : null}

        {permission === 'undetermined' ? (
          <Button
            label={busy ? 'Asking…' : 'Allow notifications'}
            onPress={handleEnable}
            disabled={busy}
          />
        ) : null}
        {permission === 'denied' ? (
          <Button
            label="Open device settings"
            variant="secondary"
            onPress={() => Linking.openSettings()}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account</Text>
        <Text style={styles.email}>{session?.user.email ?? 'Unknown account'}</Text>
        <Button
          label={busy ? 'Working…' : 'Sign out'}
          variant="secondary"
          onPress={handleSignOut}
          disabled={busy}
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
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardWarning: {
    backgroundColor: colors.overdueSoft,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
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
