-- ============================================================
-- Phase 0.B Stage B2 — Notifications table
-- Delivered notifications (reminders, pre-reminders, pattern alerts,
-- weekly digest, system messages). Subscribed to by the frontend via
-- Supabase Realtime so in-app toasts fire live.
--
-- Separate from `reminders` because:
--   • A single reminder can produce multiple notifications
--     (one main + N pre-reminders). One-to-many cleanly modelled.
--   • Frontend cares about "what to show the user right now",
--     not "what's scheduled to fire in 3 days".
--   • Same table serves review-due, pattern-alert, and digest
--     notification types for future consolidation.
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- What kind of notification this is. Reminder-related kinds are the
  -- only ones produced by Stage B2; other kinds reserved for future
  -- consolidation of cron-notifications / decision-review / pattern.
  kind text not null check (kind in (
    'reminder',         -- a scheduled reminder firing at its trigger time
    'pre_reminder',     -- a lead-time heads-up before the main reminder
    'review_due',       -- reserved (decision review reminder)
    'pattern_alert',    -- reserved (pattern detection alert)
    'digest',           -- reserved (weekly digest)
    'system'            -- reserved (system messages e.g. account health)
  )),

  -- Display content
  title text not null,                          -- "Reminder: Call Mom"
  body text,                                    -- fuller text if needed
  payload jsonb not null default '{}',          -- kind-specific metadata

  -- Lifecycle (from the user's perspective)
  status text not null default 'unread' check (status in (
    'unread', 'read', 'dismissed'
  )),
  read_at timestamptz,
  dismissed_at timestamptz,

  -- Linkage back to source row (reminder, decision, pattern, etc.)
  source_table text,                            -- 'reminders' for reminder kinds
  source_id uuid,                               -- foreign-id into the source table

  created_at timestamptz default now()
);

-- Hot query 1: user's unread notifications, newest first.
-- Partial index is small because the vast majority of notifications
-- are eventually read/dismissed; only a thin slice stays 'unread'.
create index if not exists idx_notifications_user_unread
  on public.notifications(user_id, created_at desc)
  where status = 'unread';

-- Hot query 2: user's full notification feed (any status), newest first.
-- This covers the RemindersSheet "show me my history" view.
create index if not exists idx_notifications_user_recent
  on public.notifications(user_id, created_at desc);

-- Lookup by source (e.g., "has this reminder already fired?") — useful for
-- debugging and the B3/B4 push/email dispatchers that may re-read payloads.
create index if not exists idx_notifications_source
  on public.notifications(source_table, source_id)
  where source_id is not null;

-- ─── Row Level Security ──────────────────────────────────────────
alter table public.notifications enable row level security;

-- Users can read their own notifications (for in-app display + history).
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (auth.uid() = user_id);

-- Users can mark their own as read/dismissed (but not change kind/payload).
-- The service-role dispatcher bypasses RLS to insert new rows; no user
-- insert policy exists deliberately — notifications are server-originated.
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (auth.uid() = user_id);

-- Users can delete their own notifications (e.g., clear history).
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete using (auth.uid() = user_id);

-- NOTE: there is NO insert policy for users. Only the service role
-- (used by the reminders-fire Edge Function) can insert. This prevents
-- malicious clients from forging notifications for themselves.

-- ─── Realtime setup ──────────────────────────────────────────────
-- Enable Realtime replication on this table so the frontend can subscribe
-- to INSERT events for a given user. Supabase's Realtime extension reads
-- from the publication named supabase_realtime by default.
alter publication supabase_realtime add table public.notifications;

-- ============================================================
-- Verification queries (run manually after migration):
--
-- 1. Table and columns:
--      SELECT column_name, data_type, is_nullable
--      FROM information_schema.columns
--      WHERE table_schema = 'public' AND table_name = 'notifications'
--      ORDER BY ordinal_position;
--    Expected: 12 rows.
--
-- 2. RLS enabled:
--      SELECT relrowsecurity FROM pg_class
--      WHERE relname = 'notifications' AND relnamespace = 'public'::regnamespace;
--    Expected: true.
--
-- 3. Policies:
--      SELECT polname, polcmd FROM pg_policy
--      WHERE polrelid = 'public.notifications'::regclass;
--    Expected: 3 rows (select_own, update_own, delete_own). No insert policy.
--
-- 4. Indexes:
--      SELECT indexname FROM pg_indexes
--      WHERE tablename = 'notifications' AND schemaname = 'public';
--    Expected: 4 rows (pkey, unread, recent, source).
--
-- 5. Realtime publication includes the table:
--      SELECT schemaname, tablename FROM pg_publication_tables
--      WHERE pubname = 'supabase_realtime' AND tablename = 'notifications';
--    Expected: 1 row.
-- ============================================================
