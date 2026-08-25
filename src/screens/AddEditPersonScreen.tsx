import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../components/Button';
import ScheduleField from '../components/ScheduleField';
import TextField from '../components/TextField';
import TypeSelector from '../components/TypeSelector';
import { CONTACT_IMPORT_SUPPORTED, importFromDeviceContacts } from '../lib/contactImport';
import { confirm, notify } from '../lib/dialogs';
import { createContact, getContact, updateContact, type ContactDraft } from '../lib/contacts';
import { syncNotifications } from '../lib/notifications';
import type { ContactType } from '../lib/database.types';
import {
  computeNextReminder,
  defaultSchedule,
  parseSchedule,
  sameSchedule,
  scheduleToConfig,
  type Schedule,
} from '../lib/schedule';
import { goBackOrHome } from '../navigation/goBackOrHome';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditPerson'>;

/** Empty strings are stored as NULL — an empty phone column shouldn't be "". */
function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default function AddEditPersonScreen({ navigation, route }: Props) {
  const contactId = route.params?.contactId;
  const isEditing = Boolean(contactId);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<ContactType>('friend');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [talkingPoints, setTalkingPoints] = useState('');
  const [schedule, setSchedule] = useState<Schedule>(() => defaultSchedule('recurring'));
  const [nameError, setNameError] = useState<string | null>(null);

  /**
   * The schedule and reminder as loaded. If the user doesn't touch the schedule,
   * an edit shouldn't silently push their next reminder further out.
   */
  const [savedSchedule, setSavedSchedule] = useState<Schedule | null>(null);
  const [savedNextReminderAt, setSavedNextReminderAt] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit person' : 'Add person' });
  }, [navigation, isEditing]);

  useEffect(() => {
    if (!contactId) return;

    let active = true;
    getContact(contactId)
      .then((contact) => {
        if (!active) return;
        const loaded = parseSchedule(contact.schedule_kind, contact.schedule_config);
        setName(contact.name);
        setType(contact.type);
        setPhone(contact.phone ?? '');
        setEmail(contact.email ?? '');
        setTalkingPoints(contact.talking_points ?? '');
        setSchedule(loaded);
        setSavedSchedule(loaded);
        setSavedNextReminderAt(contact.next_reminder_at);
      })
      .catch((e: unknown) => {
        void notify(
          'Could not load this person',
          e instanceof Error ? e.message : 'Please try again.',
        ).then(() => goBackOrHome(navigation));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [contactId, navigation]);

  async function handleImport() {
    setImporting(true);
    try {
      const result = await importFromDeviceContacts();

      if (result.status === 'cancelled') return;

      if (result.status === 'unavailable') {
        await notify('Contact import unavailable', result.reason);
        return;
      }

      const { name: importedName, phone: importedPhone, email: importedEmail } = result.contact;

      // Don't wipe details the user already typed just because this contact card
      // happens to be missing them.
      if (importedName) {
        setName(importedName);
        setNameError(null);
      }
      if (importedPhone) setPhone(importedPhone);
      if (importedEmail) setEmail(importedEmail);

      if (result.limitedByPermission) {
        const openSettings = await confirm({
          title: 'Only the name came through',
          message:
            'KeepInTouch needs contacts access to read phone numbers and emails. Open Settings to enable it, or just type them in.',
          confirmLabel: 'Open Settings',
          cancelLabel: 'Not now',
        });
        if (openSettings) Linking.openSettings();
      } else if (!importedPhone && !importedEmail) {
        await notify(
          'No phone or email',
          `${importedName || 'That contact'} has no phone number or email saved on this device.`,
        );
      }
    } catch (e) {
      await notify('Could not import', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setImporting(false);
    }
  }

  /**
   * Recompute only when the schedule actually changed, or when there was no
   * pending reminder to preserve.
   */
  function resolveNextReminderAt(): string | null {
    const scheduleUnchanged = savedSchedule !== null && sameSchedule(savedSchedule, schedule);
    if (scheduleUnchanged && savedNextReminderAt) return savedNextReminderAt;
    return computeNextReminder(schedule)?.toISOString() ?? null;
  }

  async function handleSave() {
    if (!name.trim()) {
      setNameError('A name is required.');
      return;
    }
    setNameError(null);
    setSaving(true);

    const draft: ContactDraft = {
      name: name.trim(),
      type,
      phone: nullIfBlank(phone),
      email: nullIfBlank(email),
      talking_points: nullIfBlank(talkingPoints),
      schedule_kind: schedule.kind,
      schedule_config: scheduleToConfig(schedule),
      next_reminder_at: resolveNextReminderAt(),
    };

    try {
      if (contactId) {
        await updateContact(contactId, draft);
      } else {
        await createContact(draft);
      }

      // Notification content is captured when it's scheduled, so an edited name,
      // talking points or schedule only reaches the banner after a resync. Doing
      // it here rather than on the People list matters: saving an edit opened
      // from Person detail returns there, never touching the list.
      await syncNotifications().catch((e) =>
        console.warn('[notifications] post-save sync failed:', e),
      );

      goBackOrHome(navigation);
    } catch (e) {
      await notify('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {CONTACT_IMPORT_SUPPORTED ? (
          <View style={styles.importRow}>
            <Button
              label={importing ? 'Opening contacts…' : 'Import from contacts'}
              variant="secondary"
              onPress={handleImport}
              disabled={importing || saving}
            />
            <Text style={styles.hint}>
              Pick someone from your phone to fill in their name, phone and email.
            </Text>
          </View>
        ) : (
          <Text style={styles.hint}>Contact import is available in the mobile app.</Text>
        )}

        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Who is this?"
          autoCapitalize="words"
          error={nameError}
          returnKeyType="next"
        />

        <TypeSelector value={type} onChange={setType} />

        <TextField
          label="Phone (optional)"
          value={phone}
          onChangeText={setPhone}
          placeholder="+1 555 0100"
          keyboardType="phone-pad"
        />

        <TextField
          label="Email (optional)"
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <ScheduleField value={schedule} onChange={setSchedule} />

        <TextField
          label="Talking points (optional)"
          value={talkingPoints}
          onChangeText={setTalkingPoints}
          placeholder="What do you want to bring up?"
          multiline
          numberOfLines={4}
          style={styles.multiline}
        />

        <Button
          label={saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add person'}
          onPress={handleSave}
          disabled={saving}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  importRow: {
    gap: spacing.sm,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
