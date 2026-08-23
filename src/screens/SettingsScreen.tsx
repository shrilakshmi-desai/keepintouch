import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import Button from '../components/Button';
import Placeholder from '../components/Placeholder';
import { colors, spacing } from '../theme';

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

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

  return (
    <Placeholder
      title="Settings"
      description="Notification permission status lands here."
      step="Step 6 — notification permissions"
    >
      <View style={styles.account}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.email}>{session?.user.email ?? 'Unknown account'}</Text>
      </View>
      <Button
        label={busy ? 'Signing out…' : 'Sign out'}
        variant="secondary"
        onPress={handleSignOut}
      />
    </Placeholder>
  );
}

const styles = StyleSheet.create({
  account: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  email: {
    fontSize: 16,
    color: colors.text,
  },
});
