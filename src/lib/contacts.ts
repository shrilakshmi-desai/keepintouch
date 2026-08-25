import type { Contact, ContactType, ScheduleConfig, ScheduleKind } from './database.types';
import { nextReminderAfterContact } from './schedule';
import { supabase } from './supabase';

/** The fields the Add/Edit form owns. */
export type ContactDraft = {
  name: string;
  type: ContactType;
  phone: string | null;
  email: string | null;
  talking_points: string | null;
  schedule_kind: ScheduleKind;
  schedule_config: ScheduleConfig;
  next_reminder_at: string | null;
};

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('You are signed out. Sign in again to continue.');
  return data.user.id;
}

/**
 * Soonest-due first, with people who have no reminder set sorted to the bottom
 * rather than the top. Matches the (user_id, next_reminder_at nulls last) index.
 *
 * No user_id filter is needed — RLS scopes the result to the caller.
 */
export async function listContacts(): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('next_reminder_at', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getContact(id: string): Promise<Contact> {
  const { data, error } = await supabase.from('contacts').select('*').eq('id', id).single();

  if (error) throw error;
  return data;
}

export async function createContact(draft: ContactDraft): Promise<Contact> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('contacts')
    .insert({ ...draft, user_id: userId, last_contacted_at: null })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateContact(id: string, draft: ContactDraft): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .update(draft)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Records that the user got in touch and rolls the reminder forward.
 *
 * Both columns move together in one update — a stamped last_contacted_at with a
 * stale next_reminder_at would leave the person permanently overdue.
 */
export async function markReachedOut(contact: Contact, now: Date = new Date()): Promise<Contact> {
  const next = nextReminderAfterContact(contact, now);

  const { data, error } = await supabase
    .from('contacts')
    .update({
      last_contacted_at: now.toISOString(),
      next_reminder_at: next ? next.toISOString() : null,
    })
    .eq('id', contact.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from('contacts').delete().eq('id', id);
  if (error) throw error;
}

export const CONTACT_TYPES: readonly ContactType[] = ['relative', 'friend', 'acquaintance'] as const;

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  relative: 'Relative',
  friend: 'Friend',
  acquaintance: 'Acquaintance',
};

export const CONTACT_TYPE_PLURAL: Record<ContactType, string> = {
  relative: 'Relatives',
  friend: 'Friends',
  acquaintance: 'Acquaintances',
};

/** Section order on the People list. Not alphabetical — most-used first. */
export const CONTACT_TYPE_ORDER: readonly ContactType[] = [
  'friend',
  'relative',
  'acquaintance',
] as const;
