-- feedback_signals table
--
-- Architecture v5.7 sec.10.10.8 (per-message affordances) + sec.10.13.1
-- (Identity Card affordances). The substrate captures every user feedback
-- click on inferred or generated content -- thumbs up/down on responses,
-- "this is right / not right" on identity model fields, "accurate /
-- misframed / noise" on patterns. cron-identity-model and
-- cron-pattern-detection consume these rows to update confidence scores
-- with drift-clamped semantics.
--
-- The table was specified across multiple v5.7 sections but never landed
-- as a migration. Phase 0.C Stage 1 instrumentation (PR #28 era) wrote
-- feedback to a placeholder; this migration creates the canonical home.

create table if not exists public.feedback_signals (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,

  -- The kind of feedback. Each consumer cron filters by kind to find
  -- the signals relevant to the surface it's updating.
  --   response_helpful      -- thumbs-up on a chat response
  --   response_unhelpful    -- thumbs-down on a chat response
  --   identity_correct      -- "Right" on an identity_model field
  --   identity_misframed    -- "Not right" on an identity_model field
  --   pattern_accurate      -- "Accurate" on a detected pattern
  --   pattern_misframed     -- "Misframed" on a detected pattern
  --   pattern_noise         -- "Noise" on a detected pattern
  kind          text not null check (kind in (
    'response_helpful',
    'response_unhelpful',
    'identity_correct',
    'identity_misframed',
    'pattern_accurate',
    'pattern_misframed',
    'pattern_noise'
  )),

  -- The thing the feedback is about. Use whichever target_* matches the
  -- kind. Multiple may be null. The consumer cron knows which target to
  -- read based on kind.
  target_message_id    uuid references public.messages(id) on delete cascade,
  target_pattern_id    uuid references public.behaviour_patterns(id) on delete cascade,

  -- For identity_model feedback: which field was being judged.
  -- Examples: 'communication_style.warmth', 'core_values',
  --           'decision_tendencies.execution_rate'.
  -- Null for response_* and pattern_* kinds.
  target_field         text,

  -- Optional freeform context (e.g., the value the user was judging,
  -- so future audit can reconstruct what they saw without joining back
  -- to a possibly-superseded source row).
  context_snapshot     jsonb default '{}'::jsonb,

  created_at    timestamptz not null default now()
);

create index if not exists idx_feedback_signals_user_kind_created
  on public.feedback_signals (user_id, kind, created_at desc);

create index if not exists idx_feedback_signals_user_target_field
  on public.feedback_signals (user_id, target_field, created_at desc)
  where target_field is not null;

-- RLS: own-only (canonical pattern from sec.6.5).
alter table public.feedback_signals enable row level security;

create policy users_select_own_feedback_signals
  on public.feedback_signals for select
  using (auth.uid() = user_id);

create policy users_insert_own_feedback_signals
  on public.feedback_signals for insert
  with check (auth.uid() = user_id);

-- Append-only from the user's side: no update or delete policies.
-- Service role can update (e.g., cron-identity-model marking a signal as
-- consumed) via the bypass-RLS service-role connection per sec.6.6.

comment on table public.feedback_signals is
  'User feedback clicks on substrate-visible content. Append-only from user side. Consumed by cron-identity-model and cron-pattern-detection to update confidence scores with drift-clamped semantics. Architecture v5.7 sec.10.10.8 + sec.10.13.1.';
