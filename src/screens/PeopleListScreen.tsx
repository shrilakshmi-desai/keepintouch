import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../components/Button';
import NotificationNotice from '../components/NotificationNotice';
import { useNow } from '../hooks/useNow';
import { CONTACT_TYPE_PLURAL, CONTACT_TYPE_TABS, listContacts } from '../lib/contacts';
import type { Contact, ContactType } from '../lib/database.types';
import { describeDue } from '../lib/format';
import { syncNotifications } from '../lib/notifications';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PeopleList'>;

export default function PeopleListScreen({ navigation }: Props) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeType, setActiveType] = useState<ContactType>('friend');
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

  // Counts come from the full list so a tab still shows its total while another
  // is on screen, and the list stays sorted by who's due soonest within a type.
  const countsByType = contacts.reduce<Record<string, number>>((acc, contact) => {
    acc[contact.type] = (acc[contact.type] ?? 0) + 1;
    return acc;
  }, {});
  const visible = contacts.filter((contact) => contact.type === activeType);

  return (
    <View style={styles.container}>
      <NotificationNotice />

      <View style={styles.tabs}>
        {CONTACT_TYPE_TABS.map((type) => {
          const selected = type === activeType;
          return (
            <Pressable
              key={type}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setActiveType(type)}
              style={({ pressed }) => [
                styles.tab,
                selected && styles.tabSelected,
                pressed && styles.tabPressed,
              ]}
            >
              <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]} numberOfLines={1}>
                {CONTACT_TYPE_PLURAL[type]}
              </Text>
              <Text style={[styles.tabCount, selected && styles.tabCountSelected]}>
                {countsByType[type] ?? 0}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()} hitSlop={8}>
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={visible.length === 0 ? styles.emptyContent : styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {contacts.length === 0
                ? 'No one here yet'
                : `No ${CONTACT_TYPE_PLURAL[activeType].toLowerCase()} yet`}
            </Text>
            <Text style={styles.emptyBody}>
              {contacts.length === 0
                ? "Add the people you want to stay close to, and you'll get a nudge when it's time."
                : 'Add someone here, or check the other tabs.'}
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
        {/* Type is no longer repeated per row — the active tab already says it. */}
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
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  tabSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  tabPressed: {
    opacity: 0.7,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    flexShrink: 1,
  },
  tabLabelSelected: {
    color: colors.accent,
  },
  tabCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    opacity: 0.8,
  },
  tabCountSelected: {
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
    paddingVertical: spacing.sm,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
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
