import * as Contacts from 'expo-contacts';
import { Platform } from 'react-native';

/**
 * The browser has no address book to read, so the import affordance is hidden
 * rather than shown and failing.
 */
export const CONTACT_IMPORT_SUPPORTED = Platform.OS !== 'web';

export type ImportedContact = {
  name: string;
  phone: string | null;
  email: string | null;
};

export type ImportResult =
  | {
      status: 'imported';
      contact: ImportedContact;
      /** True when phone/email were unreadable because contacts access was refused. */
      limitedByPermission: boolean;
    }
  | { status: 'cancelled' }
  | { status: 'unavailable'; reason: string };

/** Prefer the number the OS marks primary, otherwise the first one that has a value. */
function pickPhone(contact: Contacts.Contact): string | null {
  const numbers = contact.phoneNumbers ?? [];
  const usable = numbers.filter((entry) => entry.number ?? entry.digits);
  const chosen = usable.find((entry) => entry.isPrimary) ?? usable[0];
  return chosen?.number ?? chosen?.digits ?? null;
}

function pickEmail(contact: Contacts.Contact): string | null {
  const emails = contact.emails ?? [];
  const usable = emails.filter((entry) => entry.email);
  const chosen = usable.find((entry) => entry.isPrimary) ?? usable[0];
  return chosen?.email ?? null;
}

function pickName(contact: Contacts.Contact): string {
  if (contact.name?.trim()) return contact.name.trim();
  const composed = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
  return composed;
}

function hasDetails(contact: Contacts.Contact): boolean {
  return (contact.phoneNumbers?.length ?? 0) > 0 || (contact.emails?.length ?? 0) > 0;
}

/**
 * The system picker returns a contact without ever prompting for the contacts
 * permission, but on some OS versions it hands back only the identity fields.
 * Only in that case do we ask for access, so the common path stays prompt-free.
 *
 * Returns the original contact plus whether a refusal is why details are missing.
 */
async function enrich(
  picked: Contacts.ExistingContact,
): Promise<{ contact: Contacts.Contact; limitedByPermission: boolean }> {
  if (hasDetails(picked)) return { contact: picked, limitedByPermission: false };

  const current = await Contacts.getPermissionsAsync();
  let granted = current.granted;

  if (!granted && current.canAskAgain) {
    granted = (await Contacts.requestPermissionsAsync()).granted;
  }
  if (!granted) return { contact: picked, limitedByPermission: true };

  try {
    const full = await Contacts.getContactByIdAsync(picked.id, [
      Contacts.Fields.Name,
      Contacts.Fields.FirstName,
      Contacts.Fields.LastName,
      Contacts.Fields.PhoneNumbers,
      Contacts.Fields.Emails,
    ]);
    return { contact: full ?? picked, limitedByPermission: false };
  } catch {
    // Access was granted but the lookup failed — fall back to what we have.
    return { contact: picked, limitedByPermission: false };
  }
}

export async function importFromDeviceContacts(): Promise<ImportResult> {
  const available = await Contacts.isAvailableAsync().catch(() => false);
  if (!available) {
    return { status: 'unavailable', reason: 'This device has no contacts app available.' };
  }

  let picked: Contacts.ExistingContact | null;
  try {
    picked = await Contacts.presentContactPickerAsync();
  } catch (e) {
    return {
      status: 'unavailable',
      reason: e instanceof Error ? e.message : 'The contact picker could not be opened.',
    };
  }

  if (!picked) return { status: 'cancelled' };

  const { contact, limitedByPermission } = await enrich(picked);

  return {
    status: 'imported',
    contact: {
      name: pickName(contact),
      phone: pickPhone(contact),
      email: pickEmail(contact),
    },
    limitedByPermission,
  };
}
