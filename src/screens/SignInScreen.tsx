import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import Button from '../components/Button';
import { colors, radius, shadow, spacing, type } from '../theme';

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
      <View style={styles.hero}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          accessibilityLabel="KeepInTouch"
        />
        <Text style={styles.title}>KeepInTouch</Text>
        <Text style={styles.subtitle}>
          Stay close to the people who matter — a nudge when it&rsquo;s time, and something to talk
          about.
        </Text>
      </View>

      <View style={styles.actions}>
        {busy ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Button label="Continue with Google" onPress={handleSignIn} />
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.footnote}>
          Your people stay private to your account — nobody else can see them.
        </Text>
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
    gap: spacing.xxl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: radius.lg + 6,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  title: {
    ...type.display,
    color: colors.text,
  },
  subtitle: {
    ...type.body,
    lineHeight: 23,
    textAlign: 'center',
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
  },
  actions: {
    gap: spacing.md,
    minHeight: 56,
    justifyContent: 'center',
  },
  error: {
    ...type.small,
    lineHeight: 20,
    color: colors.danger,
    textAlign: 'center',
  },
  footnote: {
    fontSize: 13,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
