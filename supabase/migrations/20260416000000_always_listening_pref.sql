-- 20260416000000_always_listening_pref.sql
-- Adds the `always_listening_enabled` column to user_preferences so the
-- wake-word toggle in Settings can persist per user (Architecture §4.4).
--
-- Engineering Hard Lock #13: DB migrations ALWAYS run before the TypeScript
-- that reads from them. Run this migration in Supabase before deploying the
-- Settings.tsx changes in this commit.
--
-- Idempotent: safe to run multiple times. ADD COLUMN IF NOT EXISTS preserves
-- any existing user rows and their data.

begin;

alter table public.user_preferences
  add column if not exists always_listening_enabled boolean not null default false;

-- Backfill: any existing user_preferences rows will receive the default (false)
-- automatically via the NOT NULL DEFAULT clause. No separate backfill needed.

-- Helpful index for future analytics queries (e.g. "what % of paid users have
-- always listening on"). Partial index keeps it cheap — only indexes the
-- non-default rows.
create index if not exists idx_user_preferences_always_listening
  on public.user_preferences (user_id)
  where always_listening_enabled = true;

commit;
