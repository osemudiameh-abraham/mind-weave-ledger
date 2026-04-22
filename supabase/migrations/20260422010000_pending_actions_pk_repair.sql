-- ============================================================
-- Schema repair: public.pending_actions primary key
-- ============================================================
-- Background: production's public.pending_actions has PK on (user_id),
-- not (id). This was introduced during an earlier dashboard SQL edit that
-- renamed columns (action_type → kind, intent_data → payload) and appears
-- to have also affected the primary key.
--
-- Effect of the bug: only one pending_actions row can exist per user at
-- any time. Every second INSERT for the same user fails with
--   "duplicate key value violates unique constraint pending_actions_pkey"
-- The chat Edge Function's GEL pipeline catches the error and falls back
-- to memory-only storage, silently breaking all GEL actions (reminders,
-- email drafts, message drafts) for any user who already has a row.
--
-- This migration repairs the constraint. It is designed to be:
--   1. Idempotent — safe to re-run if it fails partway
--   2. Transaction-wrapped — rolls back atomically on any error
--   3. Non-destructive to valid data — preserves existing rows
--
-- After this migration, the reminders table's FK to pending_actions(id)
-- can be added in a separate follow-up migration (not done here, to keep
-- this change small and reversible).
-- ============================================================

begin;

-- Step 1: Ensure every existing row has a non-null id. Any NULL gets a fresh
-- UUID. No-op for rows that already have an id (the current default is
-- gen_random_uuid(), so most rows should be fine).
update public.pending_actions
set id = gen_random_uuid()
where id is null;

-- Step 2: Verify there are no duplicate ids. If duplicates exist, the PK
-- creation below will fail — RAISE an explicit error so the rollback message
-- is meaningful. In a healthy table (id default = gen_random_uuid()),
-- duplicates should be impossible.
do $$
declare
  dup_count integer;
begin
  select count(*) into dup_count
  from (
    select id from public.pending_actions
    group by id
    having count(*) > 1
  ) dups;

  if dup_count > 0 then
    raise exception 'pending_actions has % duplicate id values — cannot create PK. Manual cleanup required before re-running this migration.', dup_count;
  end if;
end$$;

-- Step 3: Drop the bad primary key on (user_id). If the constraint doesn't
-- exist (e.g., migration already ran partially), this is a no-op with a
-- notice, not an error.
alter table public.pending_actions
  drop constraint if exists pending_actions_pkey;

-- Step 4: Make id NOT NULL. Required for PRIMARY KEY. Safe because Step 1
-- backfilled any NULLs.
alter table public.pending_actions
  alter column id set not null;

-- Step 5: Add the correct primary key on (id).
alter table public.pending_actions
  add constraint pending_actions_pkey primary key (id);

-- Step 6: Ensure there's a non-unique index on (user_id, status) for the
-- common lookup query "find pending actions for this user". The original
-- migration (001_full_schema.sql line 279) declared this index, but it may
-- have been dropped along with the original table or never created if the
-- CREATE TABLE IF NOT EXISTS skipped re-creation.
create index if not exists idx_pending_actions_user
  on public.pending_actions(user_id, status);

commit;

-- ============================================================
-- Post-migration verification (run manually to confirm):
--
-- 1. Confirm PK is on (id):
--      SELECT conname, pg_get_constraintdef(oid)
--      FROM pg_constraint
--      WHERE conrelid = 'public.pending_actions'::regclass AND contype = 'p';
--    Expected: one row, "PRIMARY KEY (id)"
--
-- 2. Confirm index on user_id exists:
--      SELECT indexname, indexdef FROM pg_indexes
--      WHERE tablename = 'pending_actions' AND schemaname = 'public';
--    Expected: at least pending_actions_pkey and idx_pending_actions_user
--
-- 3. Confirm id is NOT NULL:
--      SELECT column_name, is_nullable FROM information_schema.columns
--      WHERE table_schema = 'public' AND table_name = 'pending_actions'
--      AND column_name = 'id';
--    Expected: is_nullable = 'NO'
-- ============================================================
