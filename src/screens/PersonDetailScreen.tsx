import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../components/Button';
import { useNow } from '../hooks/useNow';
import { CONTACT_TYPE_LABELS, deleteContact, getContact, markReachedOut } from '../lib/contacts';
import { confirm, notify } from '../lib/dialogs';
import type { Contact } from '../lib/database.types';
import { describeDue, formatDateTime } from '../lib/format';
import { syncNotifications } from '../lib/notifications';
import { describeSchedule, parseSchedule } from '../lib/schedule';
import { goBackOrHome } from '../navigation/goBackOrHome';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonDetail'>;

export default function PersonDetailScreen({ navigation, route }: Props) {
  const { contactId } = route.params;
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reachingOut, setReachingOut] = useState(false);
  const now = useNow();
  const insets = useSafeAreaInsets();

  // Refetches on focus so edits are reflected when the form pops back.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getContact(contactId)
        .then((row) => {
          if (active) {
            setContact(row);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (active) setError(e instanceof Error ? e.message : 'Could not load this person.');
        });
      return () => {
        active = false;
      };
    }, [contactId]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: contact?.name ?? 'Detail',
      headerRight: contact
        ? () => (
            // Same flush-edge clipping as the People list's Settings button.
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              style={styles.headerButton}
              onPress={() => navigation.navigate('AddEditPerson', { contactId })}
            >
              <Text style={styles.headerAction}>Edit</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, contact, contactId]);

  async function handleReachedOut() {
    if (!contact) return;
    setReachingOut(true);
    try {
      const updated = await markReachedOut(contact);
      setContact(updated);
      // The pending notification was scheduled against the old reminder time.
      await syncNotifications();
    } catch (e) {
      await notify('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setReachingOut(false);
    }
  }

  async function confirmDelete() {
    if (!contact) return;

    const ok = await confirm({
      title: `Delete ${contact.name}?`,
      message: "They'll be removed along with their reminders. This can't be undone.",
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    try {
      await deleteContact(contact.id);
      goBackOrHome(navigation);
    } catch (e) {
      await notify('Could not delete', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const due = describeDue(contact.next_reminder_at, now);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.lg + insets.bottom }]}
    >
      <View style={styles.header}>
        <Text style={styles.name}>{contact.name}</Text>
        <Text style={styles.type}>{CONTACT_TYPE_LABELS[contact.type]}</Text>
      </View>

      <View style={[styles.card, due.overdue && styles.cardOverdue]}>
        <Text style={styles.cardLabel}>Next reminder</Text>
        <Text style={[styles.cardValue, due.overdue && styles.cardValueOverdue]}>{due.label}</Text>
        {contact.next_reminder_at && !due.unscheduled ? (
          <Text style={styles.cardSub}>{formatDateTime(new Date(contact.next_reminder_at))}</Text>
        ) : null}
        <Text style={styles.cardSub}>
          {describeSchedule(parseSchedule(contact.schedule_kind, contact.schedule_config))}
        </Text>
      </View>

      {contact.talking_points ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Talking points</Text>
          <Text style={styles.body}>{contact.talking_points}</Text>
        </View>
      ) : null}

      {contact.phone || contact.email ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Reach them</Text>
          {contact.phone ? (
            <ContactLink label={contact.phone} url={`tel:${contact.phone}`} />
          ) : null}
          {contact.email ? (
            <ContactLink label={contact.email} url={`mailto:${contact.email}`} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Last contacted</Text>
        <Text style={styles.body}>
          {contact.last_contacted_at
            ? formatDateTime(new Date(contact.last_contacted_at))
            : 'Not yet recorded'}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label={reachingOut ? 'Saving…' : 'I reached out'}
          onPress={handleReachedOut}
          disabled={reachingOut}
        />
        <Button
          label="Edit"
          variant="secondary"
          onPress={() => navigation.navigate('AddEditPerson', { contactId })}
          disabled={reachingOut}
        />
        <Pressable accessibilityRole="button" onPress={confirmDelete} hitSlop={8}>
          <Text style={styles.delete}>Delete person</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ContactLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      hitSlop={4}
      onPress={() => {
        Linking.openURL(url).catch(() => {
          void notify('Could not open', `Nothing on this device can handle ${url}.`);
        });
      }}
    >
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  headerButton: {
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  headerAction: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
  },
  header: {
    gap: spacing.xs,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  type: {
    fontSize: 15,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardOverdue: {
    backgroundColor: colors.overdueSoft,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  cardValueOverdue: {
    color: colors.overdue,
  },
  cardSub: {
    fontSize: 14,
    color: colors.textMuted,
  },
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.accent,
  },
  actions: {
    gap: spacing.md,
    alignItems: 'stretch',
    marginTop: spacing.sm,
  },
  delete: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: colors.danger,
    paddingVertical: spacing.sm,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    color: colors.overdue,
  },
});
