-- KeepInTouch — Web Push subscriptions + per-user timezone (Step 5)
-- Run in the Supabase dashboard: SQL Editor → New query → paste → Run.

-- ------------------------------------------------------- per-user timezone
-- The mobile app computes cadence in the device's local time. The Step 6 Edge
-- Function runs in UTC and cannot know where the user is, so "every Sunday 9am"
-- would silently become 9am UTC. This column is what the server computes
-- against. Defaulted to UTC so existing rows stay valid; the client overwrites
-- it with the device's real zone on sign-in.
alter table public.profiles
  add column if not exists timezone text not null default 'UTC';

-- Cheap sanity check: reject anything that isn't a zone Postgres recognises.
-- Guards against a garbage value making every reminder fire at the wrong hour.
alter table public.profiles
  drop constraint if exists profiles_timezone_valid;
alter table public.profiles
  add constraint profiles_timezone_valid
  check (now() at time zone timezone is not null);

-- --------------------------------------------------- push_subscriptions
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  -- The endpoint uniquely identifies a browser install. Unique so re-subscribing
  -- on the same device updates one row instead of accumulating dead endpoints
  -- that every send would then have to fail against.
  endpoint     text not null unique,
  -- Full PushSubscription JSON, including the p256dh and auth keys needed to
  -- encrypt a payload for this specific subscriber.
  subscription jsonb not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;

create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using ((select auth.uid()) = user_id);
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check ((select auth.uid()) = user_id);
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using ((select auth.uid()) = user_id);

-- The Step 6 sender runs with the service role, which bypasses RLS — these
-- policies exist so the browser client can manage only its own subscriptions.
