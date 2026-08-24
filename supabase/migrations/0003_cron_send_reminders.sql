-- KeepInTouch — schedule the reminder sender (Step 6)
--
-- Run in the Supabase dashboard: SQL Editor → New query.
-- REPLACE the two placeholders below before running:
--   <PROJECT_REF>  → awnhnwedjkndbijcvbyw
--   <CRON_SECRET>  → the same value set as the CRON_SECRET function secret
--
-- The secret is stored in Vault rather than inline in the job definition, so it
-- isn't sitting in cron.job in plain text where any dashboard query would show it.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ------------------------------------------------------------------ secret
-- Re-running replaces the stored value rather than erroring on a duplicate name.
do $$
begin
  if exists (select 1 from vault.secrets where name = 'keepintouch_cron_secret') then
    perform vault.update_secret(
      (select id from vault.secrets where name = 'keepintouch_cron_secret'),
      '<CRON_SECRET>'
    );
  else
    perform vault.create_secret('<CRON_SECRET>', 'keepintouch_cron_secret');
  end if;
end $$;

-- -------------------------------------------------------------------- job
-- Unschedule first so this file is safe to re-run after an edit.
select cron.unschedule('keepintouch-send-reminders')
where exists (select 1 from cron.job where jobname = 'keepintouch-send-reminders');

select cron.schedule(
  'keepintouch-send-reminders',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'keepintouch_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    -- Well under the 60s gap between runs, so a hung request can't pile up.
    timeout_milliseconds := 20000
  );
  $job$
);

-- ---------------------------------------------------------------- checking
-- Is it scheduled?
--   select jobid, jobname, schedule, active from cron.job;
--
-- Did the last runs succeed? (this is the cron side, not the function's own logs)
--   select runid, status, return_message, start_time
--   from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'keepintouch-send-reminders')
--   order by start_time desc limit 10;
--
-- What did pg_net get back from the function?
--   select id, status_code, content, created
--   from net._http_response order by created desc limit 10;
--
-- To stop it:
--   select cron.unschedule('keepintouch-send-reminders');
