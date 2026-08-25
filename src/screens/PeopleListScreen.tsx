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
import Button from '../components/Button';
import NotificationNotice from '../components/NotificationNotice';
import { useNow } from '../hooks/useNow';
import { CONTACT_TYPE_ORDER, CONTACT_TYPE_PLURAL, listContacts } from '../lib/contacts';
import type { Contact } from '../lib/database.types';
import { describeDue } from '../lib/format';
import { syncNotifications } from '../lib/notifications';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PeopleList'>;

type Section = { title: string; data: Contact[] };

export default function PeopleListScreen({ navigation }: Props) {
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

  // Re-runs on every focus, so returning from Add/Edit or Detail shows fresh data
  // without any shared store.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
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
   * than shown as empty headings — a heading with nothing under it reads like
   * something failed to load. Sorting within each section is untouched:
   * soonest-due first, unscheduled last.
   */
  const sections: Section[] = CONTACT_TYPE_ORDER.map((type) => ({
    title: `${CONTACT_TYPE_PLURAL[type]} · ${contacts.filter((c) => c.type === type).length}`,
    data: contacts.filter((contact) => contact.type === type),
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
        stickySectionHeadersEnabled
        contentContainerStyle={
          contacts.length === 0 ? styles.emptyContent : styles.listContent
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
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

      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
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
      <View style={styles.rowMain}>
        <Text style={styles.name} numberOfLines={1}>
          {contact.name}
        </Text>
        {/* Type isn't repeated per row — the section heading above already says it. */}
        <Text style={styles.meta} numberOfLines={1}>
          {due.label}
        </Text>
      </View>
      {due.overdue ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Overdue</Text>
        </View>
      ) : null}
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
  headerAction: {
    fontSize: 16,
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
    paddingBottom: spacing.sm,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  // Opaque, because it sticks over rows as they scroll beneath it.
  sectionHeader: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  meta: {
    fontSize: 14,
    color: colors.textMuted,
  },
  badge: {
    backgroundColor: colors.overdueSoft,
    borderRadius: 999,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.overdue,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    color: colors.textMuted,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
