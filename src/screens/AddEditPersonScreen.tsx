import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Button from '../components/Button';
import TextField from '../components/TextField';
import TypeSelector from '../components/TypeSelector';
import { createContact, getContact, updateContact, type ContactDraft } from '../lib/contacts';
import type { ContactType } from '../lib/database.types';
import { formatDateTime } from '../lib/format';
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

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<ContactType>('friend');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [talkingPoints, setTalkingPoints] = useState('');
  const [reminderAt, setReminderAt] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit person' : 'Add person' });
  }, [navigation, isEditing]);

  useEffect(() => {
    if (!contactId) return;

    let active = true;
    getContact(contactId)
      .then((contact) => {
        if (!active) return;
        setName(contact.name);
        setType(contact.type);
        setPhone(contact.phone ?? '');
        setEmail(contact.email ?? '');
        setTalkingPoints(contact.talking_points ?? '');
        setReminderAt(contact.next_reminder_at ? new Date(contact.next_reminder_at) : null);
      })
      .catch((e: unknown) => {
        Alert.alert(
          'Could not load this person',
          e instanceof Error ? e.message : 'Please try again.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [contactId, navigation]);

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
      next_reminder_at: reminderAt ? reminderAt.toISOString() : null,
    };

    try {
      if (contactId) {
        await updateContact(contactId, draft);
      } else {
        await createContact(draft);
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
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
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
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

        <View style={styles.field}>
          <Text style={styles.label}>Next reminder</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPickerOpen((open) => !open)}
            style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}
          >
            <Text style={reminderAt ? styles.dateValue : styles.datePlaceholder}>
              {reminderAt ? formatDateTime(reminderAt) : 'No reminder set'}
            </Text>
          </Pressable>

          <View style={styles.dateActions}>
            {!reminderAt ? (
              <Pressable
                onPress={() => {
                  setReminderAt(new Date());
                  setPickerOpen(true);
                }}
                hitSlop={6}
              >
                <Text style={styles.link}>Set a date</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  setReminderAt(null);
                  setPickerOpen(false);
                }}
                hitSlop={6}
              >
                <Text style={styles.linkMuted}>Clear</Text>
              </Pressable>
            )}
          </View>

          {pickerOpen && reminderAt ? (
            <DateTimePicker
              value={reminderAt}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selected) => {
                if (Platform.OS !== 'ios') setPickerOpen(false);
                if (event.type === 'dismissed') return;
                if (selected) setReminderAt(selected);
              }}
            />
          ) : null}

          <Text style={styles.hint}>
            A one-off date for now. Recurring schedules arrive in Step 5.
          </Text>
        </View>

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
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  dateValue: {
    fontSize: 16,
    color: colors.text,
  },
  datePlaceholder: {
    fontSize: 16,
    color: colors.textMuted,
  },
  dateActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  linkMuted: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
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
