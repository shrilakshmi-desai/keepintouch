import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import Button from '../components/Button';
import { colors, spacing } from '../theme';

export default function SignInScreen() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Keep In Touch</Text>
        <Text style={styles.subtitle}>
          Stay close to the people who matter — a nudge when it's time, and something to talk about.
        </Text>
      </View>

      <View style={styles.actions}>
        {busy ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Button label="Continue with Google" onPress={handleSignIn} />
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.md,
    minHeight: 56,
    justifyContent: 'center',
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.overdue,
  },
});
