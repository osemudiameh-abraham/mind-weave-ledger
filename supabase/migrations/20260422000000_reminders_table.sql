-- ============================================================
-- Phase 0.B Stage B1 — Reminders data layer
-- Creates public.reminders table + indexes + RLS.
-- Firing/dispatch (cron + channels) ships in Stage B2.
--
-- Architecture: ADR-0001 in B1_design_doc.md — use pg_cron + Edge Functions
-- for reminder dispatch (Stage B2), NOT pg-boss, for the current stack.
-- ============================================================

create table if not exists public.reminders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Content
  text_snapshot text not null,                 -- "Call Mom about Sunday lunch"
  original_message text,                       -- raw user utterance, for audit

  -- Timing (UTC absolute + display-friendly mirrors)
  trigger_at_utc timestamptz not null,         -- source of truth for firing
  user_timezone text,                          -- IANA name at creation (e.g. "Europe/London")
  user_local_display text,                     -- "Tuesday, 3:00 PM Luton time"
  pre_reminders integer[] default '{}',        -- lead times in minutes, e.g. [60, 1440]

  -- Importance + delivery
  importance text not null default 'normal'
    check (importance in ('normal', 'important')),
  channels text[] not null default array['in_app','push']::text[],

  -- Lifecycle
  status text not null default 'scheduled'
    check (status in ('scheduled', 'delivered', 'cancelled', 'failed', 'snoozed')),
  delivered_at timestamptz,
  cancelled_at timestamptz,
  snoozed_until timestamptz,
  pre_reminders_fired integer[] default '{}',  -- lead-times already dispatched

  -- Linkage + audit
  section_id uuid references public.sections(id) on delete set null,
  -- NOTE: source_pending_action_id is intentionally NOT a foreign key.
  -- Production's public.pending_actions has schema drift (PK on user_id
  -- instead of id), so a FK to pending_actions(id) fails to create with
  -- "no unique constraint matching given keys". Until that is repaired in a
  -- dedicated migration (pre-requisite for Stage B2), we store the UUID
  -- for audit linkage only, enforced at application level in chat/index.ts.
  source_pending_action_id uuid,
  source text not null default 'chat'
    check (source in ('chat', 'voice', 'manual', 'api')),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index by user for personal list queries
create index if not exists idx_reminders_user
  on public.reminders(user_id);

-- Partial index for the cron dispatcher (Stage B2) — only scheduled rows
-- ordered by trigger time. Massively smaller than a full-table index as
-- delivered/cancelled reminders accumulate.
create index if not exists idx_reminders_due
  on public.reminders(trigger_at_utc)
  where status = 'scheduled';

-- Partial index for pre-reminder dispatch — only scheduled rows that have
-- at least one pre-reminder lead-time configured.
create index if not exists idx_reminders_pre_due
  on public.reminders(trigger_at_utc)
  where status = 'scheduled' and cardinality(pre_reminders) > 0;

-- updated_at trigger (uses existing public.set_updated_at() function defined
-- in 001_full_schema.sql around line 478)
drop trigger if exists set_reminders_updated_at on public.reminders;
create trigger set_reminders_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────
alter table public.reminders enable row level security;

-- Users can read their own reminders
drop policy if exists reminders_select_own on public.reminders;
create policy reminders_select_own on public.reminders
  for select using (auth.uid() = user_id);

-- Users can create reminders for themselves
drop policy if exists reminders_insert_own on public.reminders;
create policy reminders_insert_own on public.reminders
  for insert with check (auth.uid() = user_id);

-- Users can edit their own reminders (cancel, snooze, edit text)
drop policy if exists reminders_update_own on public.reminders;
create policy reminders_update_own on public.reminders
  for update using (auth.uid() = user_id);

-- Users can delete their own reminders
drop policy if exists reminders_delete_own on public.reminders;
create policy reminders_delete_own on public.reminders
  for delete using (auth.uid() = user_id);

-- NOTE: The Stage B2 reminder dispatcher runs with the service_role key,
-- which bypasses RLS by design. No additional policy needed for cron.

-- ============================================================
-- End of migration
-- ============================================================
