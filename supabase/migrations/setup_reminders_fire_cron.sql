-- ============================================================
-- Phase 0.B Stage B2 — pg_cron schedule for reminders-fire
-- ============================================================
-- This is a ONE-TIME SETUP SCRIPT, not an auto-applied migration.
-- Run it manually once per environment (production, staging) AFTER:
--   1. The `reminders-fire` Edge Function has been deployed
--   2. The REMINDERS_FIRE_CRON_SECRET secret is set in Supabase Vault
--   3. The reminders-fire URL is stored in Vault
--
-- Why not a migration? Two reasons:
--   • Migrations run on every deploy. `cron.schedule` is idempotent only
--     when combined with a cron.unschedule — cleaner to keep manual.
--   • It reads from Vault (environment-specific secrets). Migrations
--     committed to git can't contain environment-specific values.
-- ============================================================

-- ───────────────────────────────────────────────────────────
-- STEP 1 (in Supabase Dashboard, not SQL):
-- ───────────────────────────────────────────────────────────
-- Navigate: Dashboard → Project Settings → Vault (Secrets)
--
-- Create these two secrets:
--
--   Name: reminders_fire_url
--   Value: https://<PROJECT_REF>.supabase.co/functions/v1/reminders-fire
--   (For this project: https://nopbocezozgcyqrxqamp.supabase.co/functions/v1/reminders-fire)
--
--   Name: reminders_fire_cron_secret
--   Value: <a random 32+ char string, see generation step below>
--
-- To generate a secure secret, run in any terminal:
--   openssl rand -base64 32
--
-- Then in the Edge Function environment variables (separate from Vault):
--   Dashboard → Project Settings → Edge Functions → Secrets
--   Add: REMINDERS_FIRE_CRON_SECRET = <same value as reminders_fire_cron_secret>
--
-- (Vault is for cron/SQL; Edge Function env vars are for the function itself;
--  the two must match, and we verify with curl before scheduling.)

-- ───────────────────────────────────────────────────────────
-- STEP 2: Enable required extensions (idempotent)
-- ───────────────────────────────────────────────────────────
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ───────────────────────────────────────────────────────────
-- STEP 3: Verify the secrets are set (before scheduling)
-- ───────────────────────────────────────────────────────────
-- Run this and confirm both return non-null text; stop here if not.
-- If either is missing, go back to STEP 1.
--
--   select decrypted_secret is not null as has_url
--   from vault.decrypted_secrets
--   where name = 'reminders_fire_url';
--
--   select decrypted_secret is not null as has_secret
--   from vault.decrypted_secrets
--   where name = 'reminders_fire_cron_secret';

-- ───────────────────────────────────────────────────────────
-- STEP 4: Smoke-test the function via curl BEFORE scheduling cron
-- ───────────────────────────────────────────────────────────
-- In your local terminal (not SQL). Substitute the actual cron secret:
--
--   curl -i -X POST https://nopbocezozgcyqrxqamp.supabase.co/functions/v1/reminders-fire \
--        -H "x-cron-secret: <YOUR_SECRET_HERE>" \
--        -H "Content-Type: application/json" \
--        -d '{}'
--
-- Expected response: HTTP 200 with JSON like
--   {"main_fired":0,"pre_fired":0,"main_errors":0,"pre_errors":0,"duration_ms":N}
--
-- If you get 401: secret mismatch. Re-check env var vs Vault secret.
-- If you get 503: REMINDERS_FIRE_CRON_SECRET env var not set on the function.

-- ───────────────────────────────────────────────────────────
-- STEP 5: Unschedule any prior version (idempotent re-runs)
-- ───────────────────────────────────────────────────────────
-- Safe to run even if the job doesn't exist yet; wrapped in do block.
do $$
begin
  perform cron.unschedule('reminders-fire-every-minute');
exception when others then
  null; -- job didn't exist, that's fine
end;
$$;

-- ───────────────────────────────────────────────────────────
-- STEP 6: Schedule the job — every minute
-- ───────────────────────────────────────────────────────────
-- '* * * * *' fires on the first second of every minute. Cron in Supabase
-- uses UTC — matches our reminders table (trigger_at_utc). No conversion.
--
-- The SQL command uses pg_net's http_post to invoke the Edge Function.
-- Reads URL + secret from Vault (never hardcoded in git).
select cron.schedule(
  'reminders-fire-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_fire_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_fire_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) as request_id;
  $$
);

-- ───────────────────────────────────────────────────────────
-- STEP 7: Verify the job is scheduled and actually running
-- ───────────────────────────────────────────────────────────
-- Wait ~90 seconds after scheduling, then run both queries:

-- 7a. Confirm the job is listed as active
select jobid, schedule, command, active
from cron.job
where jobname = 'reminders-fire-every-minute';

-- 7b. Confirm recent runs actually succeeded (look at last 5)
select
  start_time,
  end_time,
  status,
  return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'reminders-fire-every-minute')
order by start_time desc
limit 5;

-- Healthy output of 7b: status = 'succeeded' for recent rows.
-- If you see 'failed': check the return_message column for details.

-- ───────────────────────────────────────────────────────────
-- ROLLBACK (if needed)
-- ───────────────────────────────────────────────────────────
-- To pause the schedule:
--   select cron.unschedule('reminders-fire-every-minute');
--
-- Re-run this script (from STEP 5 onward) to re-enable.
-- ============================================================
