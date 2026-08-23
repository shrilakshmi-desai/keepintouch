/**
 * Mirrors supabase/migrations/0001_init.sql.
 *
 * Hand-maintained for now. Once the Supabase CLI is set up this can be replaced
 * with `supabase gen types typescript --linked > src/lib/database.types.ts`.
 */
export type ContactType = 'relative' | 'friend' | 'acquaintance';
export type ScheduleKind = 'recurring' | 'interval' | 'one_time';

/** Shape of `contacts.schedule_config`, discriminated by `schedule_kind`. */
export type ScheduleConfig =
  | { weekday: number; hour: number; minute: number }
  | { everyDays: number }
  | { fireAt: string };

export type Profile = {
  id: string;
  email: string | null;
  created_at: string;
};

export type Contact = {
  id: string;
  user_id: string;
  name: string;
  type: ContactType;
  phone: string | null;
  email: string | null;
  talking_points: string | null;
  schedule_kind: ScheduleKind;
  schedule_config: ScheduleConfig;
  next_reminder_at: string | null;
  last_contacted_at: string | null;
  created_at: string;
};

/** Columns the client supplies on insert; the rest are defaulted by Postgres. */
export type ContactInsert = Omit<Contact, 'id' | 'created_at'>;
export type ContactUpdate = Partial<ContactInsert>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Pick<Profile, 'id'> & Partial<Profile>;
        Update: Partial<Profile>;
      };
      contacts: {
        Row: Contact;
        Insert: ContactInsert;
        Update: ContactUpdate;
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      contact_type: ContactType;
      schedule_kind: ScheduleKind;
    };
    CompositeTypes: Record<never, never>;
  };
};
