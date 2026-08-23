-- KeepInTouch — initial schema (Step 2)
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.

-- ---------------------------------------------------------------- enums
create type public.contact_type as enum ('relative', 'friend', 'acquaintance');
create type public.schedule_kind as enum ('recurring', 'interval', 'one_time');

-- ------------------------------------------------------------- profiles
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------- contacts
-- Timestamps are timestamptz: "every Sunday 9am" means 9am where the user is,
-- so we store absolute instants and render them in the device's zone.
create table public.contacts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  name             text not null check (length(trim(name)) > 0),
  type             public.contact_type not null default 'friend',
  phone            text,
  email            text,
  talking_points   text,
  schedule_kind    public.schedule_kind not null default 'interval',
  schedule_config  jsonb not null default '{}'::jsonb,
  next_reminder_at timestamptz,
  last_contacted_at timestamptz,
  created_at       timestamptz not null default now()
);

-- The People list sorts by who's due soonest, scoped to one user.
create index contacts_user_id_next_reminder_at_idx
  on public.contacts (user_id, next_reminder_at nulls last);

-- ---------------------------------------------------- row level security
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;

-- auth.uid() is wrapped in a subselect so Postgres evaluates it once per query
-- rather than once per row.
create policy "profiles_select_own" on public.profiles
  for select using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "contacts_select_own" on public.contacts
  for select using ((select auth.uid()) = user_id);
create policy "contacts_insert_own" on public.contacts
  for insert with check ((select auth.uid()) = user_id);
create policy "contacts_update_own" on public.contacts
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "contacts_delete_own" on public.contacts
  for delete using ((select auth.uid()) = user_id);

-- ------------------------------------------- auto-create profile on signup
-- Runs as definer so it can write to public.profiles before any session exists.
-- search_path is pinned empty, hence the fully-qualified names.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
