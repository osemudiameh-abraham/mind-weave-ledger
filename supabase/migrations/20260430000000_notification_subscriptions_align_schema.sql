-- ============================================================
-- Migration: 20260430000000_notification_subscriptions_align_schema
-- ============================================================
--
-- Aligns deployed public.notification_subscriptions schema with the
-- declaration in 001_full_schema.sql.
--
-- Phase 0.B Stage B3.4b/B3.4c (Apr 30 2026)
--
-- ─── Problem ───
--
-- During B3.4b smoke test, an INSERT to notification_subscriptions
-- silently returned no rows. CHECK 2 of the diagnostic revealed that
-- the deployed schema differs from the migration file:
--
--   GIT (001_full_schema.sql claims):
--     id uuid PK
--     user_id uuid FK
--     endpoint text NOT NULL
--     p256dh   text NOT NULL    ← separate text column
--     auth_key text NOT NULL    ← separate text column
--     created_at timestamptz
--     UNIQUE (user_id, endpoint)
--
--   DEPLOYED (actual production state today):
--     id uuid PK
--     user_id uuid FK
--     endpoint text NOT NULL
--     keys jsonb NOT NULL       ← single jsonb column
--     created_at timestamptz
--     UNIQUE (endpoint)         ← single-column unique
--
-- This drift originated from an early hand-written DDL that diverged
-- from what the migration file declared. The notify Edge Function
-- (deployed and live) AND the use-notifications hook (about to ship)
-- both already expect the GIT shape. Rather than rewrite both to
-- match the drifted DB, we align the DB to git.
--
-- ─── Why git wins, not the DB ───
--
-- Two architectural reasons:
--   1. notify Edge Function is already deployed reading p256dh/auth_key
--      as separate columns. Rewriting it would mean two more Edge
--      Function redeploys, more risk.
--   2. unique(user_id, endpoint) is multi-user-safe; unique(endpoint)
--      is not. Two users on the same machine could theoretically share
--      a push endpoint (browser/OS edge cases) and the current
--      constraint would prevent both subscribing.
--
-- ─── Safety ───
--
-- This migration is only safe to run when notification_subscriptions
-- is empty. The B3.4a VAPID-key rotation cleared the table; no
-- subscriptions have been created since (B3.4b's first deploy was the
-- silent-failure case). A guard at the top refuses to run if any rows
-- exist — operator must clear or implement a backfill first.
--
-- Reversible: a down migration exists (see bottom of file as comments)
-- that recreates the deployed shape. Down migration is for emergency
-- rollback only; do not use as part of normal flow.

begin;

-- ─── Safety guard — refuse if data present ───
do $$
declare
  row_count int;
begin
  select count(*) into row_count from public.notification_subscriptions;
  if row_count > 0 then
    raise exception 'notification_subscriptions has % rows; data migration not implemented in this DDL. Either clear the table (DELETE FROM public.notification_subscriptions) or extend this migration with a backfill from keys to p256dh/auth.', row_count;
  end if;
end $$;

-- ─── Drop the wrong unique constraint ───
--
-- The deployed constraint was named `notification_subscriptions_endpoint_unique`
-- (NOT the Postgres default `_endpoint_key`). Initial discovery happened
-- during B3.4c's first run when CHECK 2 of the diagnostic listed the
-- actual constraint names — but the migration assumed the default
-- naming and the IF EXISTS guard silently no-op'd. Drop both possible
-- names defensively to handle either origin (default name from a
-- migration tool, or hand-named via SQL Editor).
alter table public.notification_subscriptions
  drop constraint if exists notification_subscriptions_endpoint_key;

alter table public.notification_subscriptions
  drop constraint if exists notification_subscriptions_endpoint_unique;

-- ─── Drop the keys jsonb column ───
-- We're recreating these as separate text columns below.
alter table public.notification_subscriptions
  drop column if exists keys;

-- ─── Add the correct columns ───
-- IF NOT EXISTS guards in case the migration is partially applied
-- and this is a re-run.
alter table public.notification_subscriptions
  add column if not exists p256dh text not null,
  add column if not exists auth_key text not null;

-- ─── Add the correct unique constraint ───
-- IF NOT EXISTS not supported for ADD CONSTRAINT in older Postgres,
-- but we're protected by the empty-table guard above — if the
-- constraint already exists with this name, the migration will fail
-- at this line with a clear "constraint already exists" error.
alter table public.notification_subscriptions
  add constraint notification_subscriptions_user_endpoint_key
  unique (user_id, endpoint);

-- ─── Verify the final shape matches the migration file declaration ───
-- Set-equality check, not sequence-equality. Postgres appends new
-- columns at the end of the table's storage order (so after this
-- migration the on-disk order is id, user_id, endpoint, created_at,
-- p256dh, auth_key — created_at moved up because keys was dropped
-- and new cols were added). Column ORDER is irrelevant to every
-- consumer of this schema (PostgREST, supabase-js, Edge Functions
-- all reference by name). The set of column names is what matters.
--
-- Also verifies the unique-constraint set: there must be exactly ONE
-- unique constraint, on (user_id, endpoint). If a stale (endpoint)-only
-- unique survived (as it did in the first run of this migration when
-- the deployed name didn't match the assumed name), the verifier now
-- catches it instead of leaving the schema in a confused two-unique
-- state.
do $$
declare
  cols text;
  unique_constraints text;
begin
  -- Column set check
  select string_agg(column_name, ',' order by column_name) into cols
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notification_subscriptions';

  if cols != 'auth_key,created_at,endpoint,id,p256dh,user_id' then
    raise exception 'Schema verification failed. Got columns (sorted): %', cols;
  end if;

  -- Unique-constraint set check. Each unique constraint is rendered
  -- as the sorted column-name list it covers.
  select string_agg(cols_for_constraint, ';' order by cols_for_constraint) into unique_constraints
    from (
      select string_agg(a.attname, ',' order by a.attname) as cols_for_constraint
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        join unnest(c.conkey) as colidx(idx) on true
        join pg_attribute a on a.attrelid = t.oid and a.attnum = colidx.idx
       where n.nspname = 'public'
         and t.relname = 'notification_subscriptions'
         and c.contype = 'u'
       group by c.oid
    ) sub;

  if unique_constraints != 'endpoint,user_id' then
    raise exception 'Unique-constraint verification failed. Got unique constraint set: %', unique_constraints;
  end if;

  raise notice 'Schema verified: columns (sorted) = %', cols;
  raise notice 'Schema verified: unique constraints = %', unique_constraints;
end $$;

commit;

-- ============================================================
-- DOWN MIGRATION (for emergency rollback only — do NOT run as
-- part of normal flow, since it would reintroduce the drift)
-- ============================================================
--
-- begin;
-- alter table public.notification_subscriptions
--   drop constraint if exists notification_subscriptions_user_endpoint_key;
-- alter table public.notification_subscriptions
--   drop column if exists p256dh,
--   drop column if exists auth_key;
-- alter table public.notification_subscriptions
--   add column if not exists keys jsonb not null default '{}'::jsonb;
-- alter table public.notification_subscriptions
--   add constraint notification_subscriptions_endpoint_key
--   unique (endpoint);
-- commit;
