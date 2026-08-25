import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import Avatar from '../components/Avatar';
import Button from '../components/Button';
import GreetingHeader from '../components/GreetingHeader';
import NotificationNotice from '../components/NotificationNotice';
import { useNow } from '../hooks/useNow';
import { CONTACT_TYPE_ORDER, CONTACT_TYPE_PLURAL, listContacts } from '../lib/contacts';
import type { Contact } from '../lib/database.types';
import { describeDue } from '../lib/format';
import { syncNotifications } from '../lib/notifications';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, type } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PeopleList'>;
type Section = { title: string; data: Contact[] };

/** First name only — "Good morning, Shri" reads better than a full name. */
function firstNameFrom(email?: string | null): string | null {
  if (!email) return null;
  const handle = email.split('@')[0]?.split(/[._+-]/)[0];
  if (!handle) return null;
  return handle.charAt(0).toUpperCase() + handle.slice(1);
}

export default function PeopleListScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Keeps "Due today" / "Overdue" honest as time passes without a reload.
  const now = useNow();
  const insets = useSafeAreaInsets();

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    try {
      const rows = await listContacts();
      setContacts(rows);
      setError(null);
      // This screen is focused after every add, edit and delete, so it's the one
      // place that reliably sees fresh data — reuse it rather than refetching.
      syncNotifications(rows).catch((e) => console.warn('[notifications] sync failed:', e));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your people.');
      setContacts((current) => current ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        // Native stack has no headerRightContainerStyle, so the padding that
        // keeps the last glyph off the screen edge goes on the button itself.
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          style={styles.headerButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.headerAction}>Settings</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  if (contacts === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  /**
   * A section per type, in CONTACT_TYPE_ORDER. Empty types are dropped rather
   * than shown as bare headings. Sorting within a section is unchanged:
   * soonest-due first, unscheduled last.
   */
  const sections: Section[] = CONTACT_TYPE_ORDER.map((type_) => ({
    title: `${CONTACT_TYPE_PLURAL[type_]} · ${contacts.filter((c) => c.type === type_).length}`,
    data: contacts.filter((contact) => contact.type === type_),
  })).filter((section) => section.data.length > 0);

  return (
    <View style={styles.container}>
      <NotificationNotice />

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()} hitSlop={8}>
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={contacts.length === 0 ? styles.emptyContent : styles.listContent}
        ListHeaderComponent={
          contacts.length > 0 ? (
            <GreetingHeader
              contacts={contacts}
              now={now}
              name={firstNameFrom(session?.user.email)}
            />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load('refresh')}
            tintColor={colors.accent}
          />
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>No one here yet</Text>
            <Text style={styles.emptyBody}>
              Add the people you want to stay close to, and you'll get a nudge when it's time.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <PersonRow
            contact={item}
            now={now}
            onPress={() => navigation.navigate('PersonDetail', { contactId: item.id })}
          />
        )}
        extraData={now}
      />

      <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
        <Button label="Add a person" onPress={() => navigation.navigate('AddEditPerson')} />
      </View>
    </View>
  );
}

function PersonRow({
  contact,
  now,
  onPress,
}: {
  contact: Contact;
  now: Date;
  onPress: () => void;
}) {
  const due = describeDue(contact.next_reminder_at, now);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Avatar name={contact.name} />
      <View style={styles.rowMain}>
        <Text style={styles.name} numberOfLines={1}>
          {contact.name}
        </Text>
        {/* Type isn't repeated per row — the section heading already says it. */}
        <Text
          style={[styles.meta, due.overdue && styles.metaOverdue]}
          numberOfLines={1}
        >
          {due.label}
        </Text>
      </View>
      {due.overdue ? <View style={styles.dot} /> : null}
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
    backgroundColor: colors.background,
  },
  headerButton: {
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  headerAction: {
    ...type.bodyStrong,
    color: colors.accent,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.overdueSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.overdue,
  },
  retry: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.overdue,
  },
  listContent: {
    paddingBottom: spacing.md,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  sectionTitle: {
    ...type.label,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  // Rows are cards now: separators would fight the gaps between them.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    ...shadow.card,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  rowMain: {
    flex: 1,
    gap: 3,
  },
  name: {
    ...type.bodyStrong,
    color: colors.text,
  },
  meta: {
    ...type.small,
    color: colors.textMuted,
  },
  metaOverdue: {
    color: colors.overdue,
    fontWeight: '600',
  },
  // A dot instead of an "Overdue" pill: the row text already says how overdue,
  // so the badge was repeating itself.
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.overdue,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    ...type.title,
    color: colors.text,
  },
  emptyBody: {
    ...type.small,
    lineHeight: 21,
    textAlign: 'center',
    color: colors.textMuted,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
