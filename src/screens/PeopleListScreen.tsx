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
import Button from '../components/Button';
import { CONTACT_TYPE_LABELS, listContacts } from '../lib/contacts';
import type { Contact } from '../lib/database.types';
import { describeDue } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PeopleList'>;

export default function PeopleListScreen({ navigation }: Props) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    try {
      const rows = await listContacts();
      setContacts(rows);
      setError(null);
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

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()} hitSlop={8}>
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={contacts.length === 0 ? styles.emptyContent : styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />
        }
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
            onPress={() => navigation.navigate('PersonDetail', { contactId: item.id })}
          />
        )}
      />

      <View style={styles.footer}>
        <Button label="Add a person" onPress={() => navigation.navigate('AddEditPerson')} />
      </View>
    </View>
  );
}

function PersonRow({ contact, onPress }: { contact: Contact; onPress: () => void }) {
  const due = describeDue(contact.next_reminder_at);

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
        <Text style={styles.meta} numberOfLines={1}>
          {CONTACT_TYPE_LABELS[contact.type]} · {due.label}
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
