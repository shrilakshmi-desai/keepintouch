-- KeepInTouch — monthly schedules (calendar day-of-month)
-- Run in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- Distinct from "every 4 weeks", which the recurring kind already covers:
-- monthly means the same date each month, so it doesn't drift through the
-- calendar the way a 28-day cycle does.

alter type public.schedule_kind add value if not exists 'monthly';

-- Nothing else changes: dayOfMonth and everyMonths live in the existing
-- schedule_config jsonb, and parseSchedule clamps them.
