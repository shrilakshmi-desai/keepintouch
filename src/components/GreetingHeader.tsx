import { StyleSheet, Text, View } from 'react-native';
import type { Contact } from '../lib/database.types';
import { describeDue } from '../lib/format';
import { colors, radius, shadow, spacing, type } from '../theme';

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Answers the question the app was opened to answer, before any scrolling.
 *
 * The "all caught up" state matters as much as the count: an app that only ever
 * tells you what you owe people is one you stop wanting to open.
 */
export default function GreetingHeader({ contacts, now }: { contacts: Contact[]; now: Date }) {
  const waiting = contacts.filter(
    (contact) => describeDue(contact.next_reminder_at, now).overdue,
  ).length;

  const dueToday = contacts.filter((contact) => {
    const due = describeDue(contact.next_reminder_at, now);
    return !due.overdue && due.label.startsWith('Due today');
  }).length;

  const caughtUp = waiting === 0 && dueToday === 0;

  const headline = caughtUp
    ? "You're all caught up"
    : waiting > 0
      ? `${waiting} ${waiting === 1 ? 'person is' : 'people are'} waiting to hear from you`
      : `${dueToday} to reach out to today`;

  const sub = caughtUp
    ? contacts.length === 0
      ? 'Add someone you want to stay close to.'
      : 'Nothing due right now — enjoy it.'
    : dueToday > 0 && waiting > 0
      ? `and ${dueToday} more due today`
      : 'A quick message counts.';

  return (
    <View style={[styles.card, caughtUp ? styles.cardCalm : styles.cardActive]}>
      {/* No name: the app never asks for one, and guessing it from the email
          handle produced things like "Good morning, Shrilakshmidesai99". */}
      <Text style={styles.greeting}>{greeting(now)}</Text>
      <Text style={[styles.headline, caughtUp && styles.headlineCalm]}>{headline}</Text>
      <Text style={styles.sub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: 2,
    ...shadow.card,
  },
  cardActive: {
    backgroundColor: colors.accentSoft,
  },
  cardCalm: {
    backgroundColor: colors.calmSoft,
  },
  greeting: {
    ...type.small,
    color: colors.textMuted,
  },
  headline: {
    ...type.title,
    color: colors.accent,
    marginTop: spacing.xs,
  },
  headlineCalm: {
    color: colors.calm,
  },
  sub: {
    ...type.small,
    color: colors.textMuted,
    marginTop: 2,
  },
});
