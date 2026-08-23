import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

type Props = {
  title: string;
  description: string;
  /** Which build step fills this screen in, shown as a reminder while scaffolding. */
  step: string;
  children?: ReactNode;
};

/**
 * Shared body for the Step 1 placeholder screens. Each screen replaces this with
 * its real content as its milestone lands.
 */
export default function Placeholder({ title, description, step, children }: Props) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{step}</Text>
      </View>
      {children ? <View style={styles.children}>{children}</View> : null}
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
    gap: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.textMuted,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  children: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});
