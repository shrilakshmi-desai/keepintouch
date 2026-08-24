/**
 * Mirrors supabase/migrations/0001_init.sql.
 *
 * Hand-maintained for now. Once the Supabase CLI is set up this can be replaced
 * with `supabase gen types typescript --linked > src/lib/database.types.ts`.
 */
export type ContactType = 'relative' | 'friend' | 'acquaintance';
export type ScheduleKind = 'recurring' | 'interval' | 'one_time';

/**
 * Shape of `contacts.schedule_config`. Every key is optional because the column
 * is jsonb and which keys are meaningful depends on `schedule_kind` — parse it
 * through parseSchedule() in lib/schedule.ts rather than reading it directly.
 */
export type ScheduleConfig = {
  /** recurring: 0 = Sunday */
  weekday?: number;
  hour?: number;
  minute?: number;
  /** recurring: 1 = weekly, 2 = fortnightly */
  everyWeeks?: number;
  /** interval */
  everyDays?: number;
  /** one_time: ISO instant */
  fireAt?: string;
};

export type Profile = {
  id: string;
  email: string | null;
  created_at: string;
  /** IANA zone the server computes cadence against. Defaults to 'UTC'. */
  timezone: string;
};

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  subscription: Record<string, unknown>;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
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

/**
 * Only user_id and name are required on insert — Postgres defaults id, created_at,
 * type, schedule_kind and schedule_config, and the rest are nullable.
 */
export type ContactInsert = Pick<Contact, 'user_id' | 'name'> &
  Partial<Omit<Contact, 'id' | 'created_at' | 'user_id' | 'name'>>;

export type ContactUpdate = Partial<ContactInsert>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Pick<Profile, 'id'> & Partial<Profile>;
        Update: Partial<Profile>;
        // supabase-js resolves table types to `never` without this key.
        Relationships: [];
      };
      contacts: {
        Row: Contact;
        Insert: ContactInsert;
        Update: ContactUpdate;
        Relationships: [];
      };
      push_subscriptions: {
        Row: PushSubscriptionRow;
        Insert: Pick<PushSubscriptionRow, 'user_id' | 'endpoint' | 'subscription'> &
          Partial<PushSubscriptionRow>;
        Update: Partial<PushSubscriptionRow>;
        Relationships: [];
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
