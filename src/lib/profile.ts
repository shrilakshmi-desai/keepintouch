import type { Profile } from './database.types';
import { supabase } from './supabase';

/** The zone this device thinks it's in, or UTC if the runtime won't say. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export async function getProfile(): Promise<Profile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function setTimeZone(timezone: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You are signed out.');

  const { error } = await supabase
    .from('profiles')
    .update({ timezone })
    .eq('id', userData.user.id);

  if (error) throw error;
}

/**
 * Adopts the device's timezone on first sign-in.
 *
 * The column defaults to 'UTC', so that value means "never set" — we only
 * overwrite in that case, never a zone the user has chosen. The cost is that
 * someone genuinely in UTC gets re-detected on each sign-in, which is harmless.
 *
 * This matters because the Step 6 sender computes cadence server-side against
 * this column; left at UTC, "every Sunday 9am" fires at the wrong hour.
 */
export async function adoptDeviceTimeZone(): Promise<void> {
  const profile = await getProfile();
  if (!profile) return;

  const device = deviceTimeZone();
  if (profile.timezone !== 'UTC' || device === 'UTC') return;

  await setTimeZone(device);
}
