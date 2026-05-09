-- ============================================================
-- Phase 0.C Stage 2A-prereq — pg_cron schedule for cron-pattern-detection
-- ============================================================
-- This is a ONE-TIME SETUP SCRIPT, not an auto-applied migration.
-- Run it manually once per environment AFTER:
--   1. The `cron-pattern-detection` Edge Function has been deployed with
--      the column-drift fix (companion PR fix/cron-pattern-detection-column-drift)
--   2. The CRON_SECRET env var is set on the cron-pattern-detection
--      Edge Function (Dashboard -> Project Settings -> Edge Functions -> Secrets)
--   3. The vault.secrets entry `pattern_detection_cron_secret` has been
--      seeded with the SAME value as the function's CRON_SECRET env var
--   4. The vault.secrets entry `pattern_detection_url` has been seeded with
--      https://nopbocezozgcyqrxqamp.supabase.co/functions/v1/cron-pattern-detection
--
-- Why not an auto-applied migration? Same reasons as
--   setup_reminders_fire_cron.sql:
--   - cron.schedule needs cron.unschedule for idempotent re-runs
--   - Reads from Vault (environment-specific secrets)
--
-- Convention follows setup_reminders_fire_cron.sql exactly. Future readers:
--   if you're scheduling a new cron, copy this file as a template.
-- ============================================================

-- ───────────────────────────────────────────────────────────
-- STEP 1 (in Supabase Dashboard, not SQL):
-- ───────────────────────────────────────────────────────────
-- Navigate: Dashboard -> Project Settings -> Vault (Secrets)
--
-- Create these two secrets if not present:
--
--   Name: pattern_detection_url
--   Value: https://nopbocezozgcyqrxqamp.supabase.co/functions/v1/cron-pattern-detection
--
--   Name: pattern_detection_cron_secret
--   Value: <reuse the existing CRON_SECRET env var value from the
--          cron-pattern-detection Edge Function -- they MUST match,
--          else the cron will 401 and never write a pattern row>
--
-- Verify the env var is set on the function:
--   Dashboard -> Project Settings -> Edge Functions -> Secrets
--   Confirm CRON_SECRET is set on cron-pattern-detection
--
-- (Vault is for cron/SQL; Edge Function env vars are for the function;
--  the two must match -- we verify with curl in STEP 4 before scheduling.)

-- ───────────────────────────────────────────────────────────
-- STEP 2: Enable required extensions (idempotent)
-- ───────────────────────────────────────────────────────────
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ───────────────────────────────────────────────────────────
-- STEP 3: Verify the secrets are set (before scheduling)
-- ───────────────────────────────────────────────────────────
-- Run this and confirm both return non-null text; stop here if not.
--
--   select decrypted_secret is not null as has_url
--   from vault.decrypted_secrets
--   where name = 'pattern_detection_url';
--
--   select decrypted_secret is not null as has_secret
--   from vault.decrypted_secrets
--   where name = 'pattern_detection_cron_secret';

-- ───────────────────────────────────────────────────────────
-- STEP 4: Smoke-test the function via curl BEFORE scheduling cron
-- ───────────────────────────────────────────────────────────
-- In your local terminal (not SQL). Substitute the actual cron secret:
--
--   curl -i -X POST https://nopbocezozgcyqrxqamp.supabase.co/functions/v1/cron-pattern-detection \
--        -H "x-cron-secret: <YOUR_SECRET_HERE>" \
--        -H "Content-Type: application/json" \
--        -d '{}'
--
-- Expected response: HTTP 200 with JSON like
--   {"status":"ok","users_processed":N,"patterns_detected":M,"patterns_retired":K}
--
-- N may be 0 today (only 2 users in decisions; eligibility threshold is
-- 5+ decisions in last 90d). That is expected -- the function returns
-- ok with users_processed=0. After more user activity accumulates,
-- patterns_detected will grow.
--
-- If you get 401: secret mismatch. Re-check env var vs Vault secret.
-- If you get 503: CRON_SECRET env var not set on the function.
-- If you get 500: function has another bug -- check logs via
--   supabase MCP get_logs(service: "edge-function", function:
--   "cron-pattern-detection")

-- ───────────────────────────────────────────────────────────
-- STEP 5: Unschedule any prior version (idempotent re-runs)
-- ───────────────────────────────────────────────────────────
-- Safe to run even if the job doesn't exist yet; wrapped in do block.
do $$
begin
  perform cron.unschedule('cron-pattern-detection-daily-0600-utc');
exception when others then
  null; -- job didn't exist, that's fine
end;
$$;

-- ───────────────────────────────────────────────────────────
-- STEP 6: Schedule the job — daily at 06:00 UTC
-- ───────────────────────────────────────────────────────────
-- '0 6 * * *' fires at 06:00 UTC every day. Cron in Supabase uses UTC.
--
-- Per architecture v5.5 sec.3.7: pattern detection runs daily over a
-- 90-day rolling window of decisions/outcomes/memories. 06:00 UTC was
-- chosen because:
--   - Off-peak globally (early morning EU, late evening west-coast US,
--     early afternoon NZ -- minimum chat traffic everywhere)
--   - Far enough from midnight UTC that the 90-day window of "yesterday"
--     decisions is fully closed in everyone's local time
--
-- timeout_milliseconds := 540000 (9 minutes) -- the function processes
-- batches of 50 users sequentially with a GPT-4o call per user. At
-- present-day cohort (2 active users with decisions, 1 qualifying for
-- patterns) the call completes in seconds; the timeout is set generous
-- for future scale.
select cron.schedule(
  'cron-pattern-detection-daily-0600-utc',
  '0 6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'pattern_detection_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'pattern_detection_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 540000
  ) as request_id;
  $$
);

-- ───────────────────────────────────────────────────────────
-- STEP 7: Verify the job is scheduled and actually running
-- ───────────────────────────────────────────────────────────
-- Confirm the job is listed as active:
--
-- 7a.
--   select jobid, schedule, command, active
--   from cron.job
--   where jobname = 'cron-pattern-detection-daily-0600-utc';
--
-- 7b. After the next 06:00 UTC firing (or after a manual trigger via
--     STEP 4 curl), confirm a successful run:
--
--   select start_time, end_time, status, return_message
--   from cron.job_run_details
--   where jobid = (select jobid from cron.job
--                  where jobname = 'cron-pattern-detection-daily-0600-utc')
--   order by start_time desc
--   limit 5;
--
-- Healthy: status = 'succeeded'. The return_message is the request_id
-- from net.http_post (success of the dispatch, not of the function
-- response). To confirm the function ITSELF succeeded, check Edge
-- Function logs: get_logs(service: "edge-function",
-- function: "cron-pattern-detection").
--
-- 7c. Confirm the function actually wrote pattern rows:
--   select count(*), max(created_at) from public.behaviour_patterns;
--
--   On a healthy run for an eligible user (5+ decisions in last 90d),
--   this should be > 0 with a recent created_at.

-- ───────────────────────────────────────────────────────────
-- ROLLBACK (if needed)
-- ───────────────────────────────────────────────────────────
-- To pause the schedule:
--   select cron.unschedule('cron-pattern-detection-daily-0600-utc');
--
-- Re-run this script (from STEP 5 onward) to re-enable.
-- ============================================================
