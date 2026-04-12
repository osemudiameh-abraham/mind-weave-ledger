-- ============================================================
-- SEVEN MYND v5 — COMPLETE DATABASE SCHEMA
-- Aligned to Master Architecture v5.0
-- Safe to run in Supabase SQL Editor (idempotent)
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";
create extension if not exists "vector" with schema extensions;

-- ============================================================
-- 1. IDENTITY_PROFILES (onboarding data)
-- ============================================================
create table if not exists public.identity_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  self_name text,
  self_role text,
  self_company text,
  self_city text,
  goals text[] default '{}',
  focus_areas text[] default '{}',
  safe_word text,
  onboarding_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- ============================================================
-- 2. IDENTITY_MODEL (personality & values snapshot)
-- ============================================================
create table if not exists public.identity_model (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  personality_dimensions jsonb default '{}',
  core_values text[] default '{}',
  decision_tendencies jsonb default '{}',
  communication_style jsonb default '{}',
  strengths text[] default '{}',
  blind_spots text[] default '{}',
  built_from_message_count integer default 0,
  last_updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id)
);

-- ============================================================
-- 3. MEMORIES_STRUCTURED (raw memory substrate)
-- v5: vector(3072) for text-embedding-3-large
-- ============================================================
create table if not exists public.memories_structured (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  memory_type text default 'general',
  importance integer default 5 check (importance between 1 and 10),
  source text default 'chat',
  source_message_id text,
  embedding extensions.vector(3072),
  metadata jsonb default '{}',
  captured_at timestamptz default now(),
  ingested_at timestamptz default now()
);

create index if not exists idx_memories_user on public.memories_structured(user_id);
create index if not exists idx_memories_type on public.memories_structured(user_id, memory_type);
create index if not exists idx_memories_importance on public.memories_structured(user_id, importance desc);

-- ============================================================
-- 4. MEMORY_FACTS (canonical truth store)
-- ============================================================
create table if not exists public.memory_facts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  attribute text not null,
  value text not null,
  category text default 'general',
  source_type text default 'inferred' check (source_type in ('explicit', 'inferred', 'corrected')),
  confidence numeric(3,2) default 0.80,
  valid_from timestamptz default now(),
  valid_until timestamptz,
  created_at timestamptz default now()
);

create unique index if not exists idx_facts_active
  on public.memory_facts(user_id, subject, attribute)
  where valid_until is null;

-- ============================================================
-- 5. DECISIONS (canonical decision lifecycle authority)
-- ============================================================
create table if not exists public.decisions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  context_summary text,
  confidence text default 'medium' check (confidence in ('low', 'medium', 'high')),
  status text default 'active' check (status in ('active', 'pending_review', 'reviewed', 'archived')),
  review_due_at timestamptz default (now() + interval '30 days'),
  outcome_count integer default 0,
  source_message_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_decisions_user on public.decisions(user_id);
create index if not exists idx_decisions_review on public.decisions(user_id, status, review_due_at);

-- ============================================================
-- 6. OUTCOMES (immutable ledger — NO UPDATE after insert)
-- ============================================================
create table if not exists public.outcomes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  decision_id uuid not null references public.decisions(id) on delete cascade,
  outcome_label text not null check (outcome_label in ('worked', 'failed', 'mixed')),
  reflection text,
  idempotency_key text,
  created_at timestamptz default now()
);

create unique index if not exists idx_outcomes_idempotent
  on public.outcomes(user_id, idempotency_key);

-- ============================================================
-- 7. MEMORY_TRACES (governance & explainability)
-- ============================================================
create table if not exists public.memory_traces (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_description text not null,
  reasoning text,
  memory_ids uuid[] default '{}',
  fact_ids uuid[] default '{}',
  decision_ids uuid[] default '{}',
  situation_ids uuid[] default '{}',
  sources text[] default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_traces_user on public.memory_traces(user_id, created_at desc);

-- ============================================================
-- 8. BEHAVIOUR_PATTERNS (longitudinal pattern store)
-- ============================================================
create table if not exists public.behaviour_patterns (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pattern_type text not null,
  description text not null,
  evidence_count integer default 1,
  confidence numeric(3,2) default 0.50,
  trigger_conditions jsonb default '{}',
  last_seen_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_patterns_user on public.behaviour_patterns(user_id);

-- ============================================================
-- 9. SECTIONS (v5: replaces "conversations")
-- ============================================================
create table if not exists public.sections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text default 'New Section',
  is_archived boolean default false,
  is_pinned boolean default false,
  message_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_sections_user on public.sections(user_id, created_at desc);

-- ============================================================
-- 10. MESSAGES (linked to sections, not conversations)
-- v5: role includes user, assistant, system
-- ============================================================
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_messages_section on public.messages(section_id, created_at);

-- ============================================================
-- 11. SITUATIONS (narrative intelligence)
-- v5: vector(3072)
-- ============================================================
create table if not exists public.situations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  narrative text,
  status text default 'active' check (status in ('active', 'resolved', 'archived')),
  entities jsonb default '{}',
  risks jsonb default '{}',
  embedding extensions.vector(3072),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 12. SITUATION_ENTITIES (people, orgs, contacts)
-- ============================================================
create table if not exists public.situation_entities (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  situation_id uuid references public.situations(id) on delete cascade,
  entity_type text not null check (entity_type in ('person', 'organisation', 'contact', 'other')),
  name text not null,
  email text,
  phone text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_situation_entities_user on public.situation_entities(user_id);

-- ============================================================
-- 13. USER_PREFERENCES
-- ============================================================
create table if not exists public.user_preferences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_reminders boolean default true,
  push_enabled boolean default false,
  voice_enabled boolean default true,
  track_decisions boolean default true,
  track_habits boolean default true,
  track_patterns boolean default true,
  theme text default 'system',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- ============================================================
-- 14. OAUTH_TOKENS (external service connections)
-- ============================================================
create table if not exists public.oauth_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  access_token text not null,
  refresh_token text,
  token_type text default 'Bearer',
  expires_at timestamptz,
  scope text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider)
);

-- ============================================================
-- 15. PENDING_ACTIONS (GEL actions awaiting approval)
-- ============================================================
create table if not exists public.pending_actions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  intent_data jsonb default '{}',
  status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'executed', 'failed')),
  result jsonb default '{}',
  source_message_id text,
  created_at timestamptz default now(),
  executed_at timestamptz
);

create index if not exists idx_pending_actions_user on public.pending_actions(user_id, status);

-- ============================================================
-- 16. SUBSCRIPTIONS (Stripe billing state)
-- ============================================================
create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text default 'trial' check (status in ('trial', 'active', 'past_due', 'cancelled', 'expired')),
  plan text default 'trial' check (plan in ('trial', 'pro_monthly', 'pro_annual', 'enterprise')),
  trial_started_at timestamptz default now(),
  trial_expires_at timestamptz default (now() + interval '14 days'),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- ============================================================
-- 17. DEVICES (trusted device records)
-- ============================================================
create table if not exists public.devices (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_fingerprint text not null,
  user_agent text,
  last_verified timestamptz default now(),
  trusted_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '30 days'),
  created_at timestamptz default now()
);

create index if not exists idx_devices_user on public.devices(user_id);

-- ============================================================
-- 18. CONSENT_RECORDS (user consent by data type)
-- ============================================================
create table if not exists public.consent_records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null,
  granted boolean default false,
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_consent_user on public.consent_records(user_id);

-- ============================================================
-- 19. NOTIFICATION_SUBSCRIPTIONS (web push VAPID)
-- ============================================================
create table if not exists public.notification_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);

-- ============================================================
-- 20. NOTIFICATION_LOG (audit trail for notifications)
-- ============================================================
create table if not exists public.notification_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text,
  body text,
  sent_at timestamptz default now(),
  delivered boolean default false
);

-- ============================================================
-- 21. REVIEW_COMPLETION_EVENTS (daily review streaks)
-- ============================================================
create table if not exists public.review_completion_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_date date not null default current_date,
  decisions_reviewed integer default 0,
  created_at timestamptz default now(),
  unique(user_id, completed_date)
);

-- ============================================================
-- 22. AUDIT_LOG (immutable governance trail)
-- ============================================================
create table if not exists public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  table_name text,
  row_id uuid,
  details jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_audit_user on public.audit_log(user_id, created_at desc);

-- ============================================================
-- 23. DIGEST_ENTRIES (weekly digest snapshots)
-- ============================================================
create table if not exists public.digest_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  summary text,
  decisions_made integer default 0,
  patterns_detected integer default 0,
  facts_learned integer default 0,
  highlights jsonb default '[]',
  created_at timestamptz default now()
);

-- ============================================================
-- VECTOR INDEXES
-- NOTE: pgvector index types (ivfflat, hnsw) support max 2000 dimensions.
-- text-embedding-3-large produces 3072 dimensions.
-- Vector search works via sequential scan without indexes.
-- At scale (10K+ memories), migrate to either:
--   1. text-embedding-3-large with dimensions=2000 (OpenAI supports this)
--   2. halfvec casting for HNSW indexing (pgvector 0.7.0+)
--   3. Dedicated vector database (Pinecone)
-- For now, sequential scan is sufficient and correct.
-- ============================================================

-- ============================================================
-- ROW LEVEL SECURITY — every table locked to owner
-- ============================================================
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'identity_profiles', 'identity_model', 'memories_structured',
    'memory_facts', 'decisions', 'outcomes', 'memory_traces',
    'behaviour_patterns', 'sections', 'messages', 'situations',
    'situation_entities', 'user_preferences', 'oauth_tokens',
    'pending_actions', 'subscriptions', 'devices', 'consent_records',
    'notification_subscriptions', 'notification_log',
    'review_completion_events', 'audit_log', 'digest_entries'
  ]) loop
    -- Enable RLS
    execute format('alter table public.%I enable row level security', t);
    -- Drop policy if exists (makes this rerunnable)
    execute format('drop policy if exists "users_own_%1$s" on public.%1$s', t);
    -- Create policy
    execute format('
      create policy "users_own_%1$s" on public.%1$s
        for all using (auth.uid() = user_id)
        with check (auth.uid() = user_id)
    ', t);
  end loop;
end $$;

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-increment outcome_count
create or replace function public.increment_outcome_count()
returns trigger as $$
begin
  update public.decisions
  set outcome_count = outcome_count + 1, updated_at = now()
  where id = NEW.decision_id;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_outcome_count on public.outcomes;
create trigger trg_outcome_count
  after insert on public.outcomes
  for each row execute function public.increment_outcome_count();

-- Auto-increment message_count on sections
create or replace function public.increment_message_count()
returns trigger as $$
begin
  update public.sections
  set message_count = message_count + 1, updated_at = now()
  where id = NEW.section_id;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_message_count on public.messages;
create trigger trg_message_count
  after insert on public.messages
  for each row execute function public.increment_message_count();

-- Generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_updated_identity_profiles on public.identity_profiles;
create trigger trg_updated_identity_profiles
  before update on public.identity_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_updated_identity_model on public.identity_model;
create trigger trg_updated_identity_model
  before update on public.identity_model
  for each row execute function public.set_updated_at();

drop trigger if exists trg_updated_decisions on public.decisions;
create trigger trg_updated_decisions
  before update on public.decisions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_updated_sections on public.sections;
create trigger trg_updated_sections
  before update on public.sections
  for each row execute function public.set_updated_at();

drop trigger if exists trg_updated_user_preferences on public.user_preferences;
create trigger trg_updated_user_preferences
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

drop trigger if exists trg_updated_oauth_tokens on public.oauth_tokens;
create trigger trg_updated_oauth_tokens
  before update on public.oauth_tokens
  for each row execute function public.set_updated_at();

drop trigger if exists trg_updated_subscriptions on public.subscriptions;
create trigger trg_updated_subscriptions
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ============================================================
-- DONE — 23 tables, RLS on all, vector indexes, triggers
-- ============================================================
