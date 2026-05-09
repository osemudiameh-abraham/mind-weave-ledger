-- ============================================================
-- SEVEN MYND -- Migration 20260509000000
-- Stage 2A — Proactive Surfacing (§10.7.A) schema
--
-- Context: chat/index.ts:2271-2336 already has a baseline proactive-
-- surfacing prototype. This migration adds the data-layer columns the
-- §10.7.A trigger gates need:
--
--   1. identity_profiles.proactive_surfacing_enabled — per-user toggle
--      (gate #4 of §10.7.A: "user has not disabled proactive surfacing")
--      Settings UI in PR-3 of Stage 2A.
--
--   2. behaviour_patterns.last_surfaced_at — for the 7-day cooldown OR
--      new-evidence gate (#5 of §10.7.A). Combined with last_seen_at:
--        surface allowed if (last_surfaced_at IS NULL)
--          OR (last_surfaced_at < now() - 7d)
--          OR (last_seen_at > last_surfaced_at)
--
--   3. behaviour_patterns.surfacing_count — cumulative surface counter.
--      Stage 2A increments on every successful surface; analytics use it
--      to spot pattern fatigue.
--
--   4. behaviour_patterns.dismissed_at — user-explicit suppression
--      (gate #4 cont'd / Memory Surface §10.13.3 affordance, UI in 2C).
--      Non-null = never surface again, regardless of cooldown.
--
--   5. behaviour_patterns.dismissed_reason — optional free text from the
--      Memory Surface dismiss affordance (Stage 2C).
--
--   6. idx_patterns_user_surfaced — supports the per-day cap query
--      (count patterns surfaced today for a user) and cooldown lookups.
--      Partial index: only active, non-dismissed rows. Smaller and
--      faster for the hot read path.
--
-- Forward-only-safe: all ADD COLUMNs are nullable or have defaults; no
-- data mutated. Existing rows get default values on read.
--
-- Rollback (only if no Stage 2A code has yet written surfacings):
--   ALTER TABLE public.identity_profiles
--     DROP COLUMN IF EXISTS proactive_surfacing_enabled;
--   ALTER TABLE public.behaviour_patterns
--     DROP COLUMN IF EXISTS last_surfaced_at,
--     DROP COLUMN IF EXISTS surfacing_count,
--     DROP COLUMN IF EXISTS dismissed_at,
--     DROP COLUMN IF EXISTS dismissed_reason;
--   DROP INDEX IF EXISTS public.idx_patterns_user_surfaced;
-- After 2A surfacing data exists, dropping these columns is destructive
-- of telemetry, not user content. Acceptable rollback if needed.
--
-- Cross-references: architecture v5.7 §10.7.A; CLAUDE.md §9.13
-- (migrations ship separately from UI). Companion PRs: 2A PR-2 (chat
-- function gates), PR-3 (settings toggle), PR-4 (dismiss RPC + hook),
-- PR-5 (smoke fixture).
-- ============================================================

ALTER TABLE public.identity_profiles
  ADD COLUMN IF NOT EXISTS proactive_surfacing_enabled boolean
    NOT NULL DEFAULT true;

ALTER TABLE public.behaviour_patterns
  ADD COLUMN IF NOT EXISTS last_surfaced_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS surfacing_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS dismissed_reason text NULL;

CREATE INDEX IF NOT EXISTS idx_patterns_user_surfaced
  ON public.behaviour_patterns (user_id, last_surfaced_at DESC)
  WHERE is_active = true AND dismissed_at IS NULL;

COMMENT ON COLUMN public.identity_profiles.proactive_surfacing_enabled IS
  'Per-user toggle for sec.10.7.A Proactive Surfacing. Default true. '
  'Disabling stops Seven volunteering observations -- pattern detection '
  'continues. Patterns-only scope in Stage 2A; decisions-due-for-review '
  'surfacing remains always-on per guard direction 2026-05-09.';

COMMENT ON COLUMN public.behaviour_patterns.last_surfaced_at IS
  'Timestamp Seven last surfaced this pattern in chat. Combined with '
  'last_seen_at to enforce the sec.10.7.A 7-day cooldown OR new-evidence '
  'gate: surface allowed if (last_surfaced_at IS NULL) '
  'OR (last_surfaced_at < now() - 7d) OR (last_seen_at > last_surfaced_at).';

COMMENT ON COLUMN public.behaviour_patterns.surfacing_count IS
  'Cumulative count of times this pattern has been surfaced in chat. '
  'Stage 2A increments on every successful surface. Used by analytics '
  'and the per-day cap query (count surfacings since start_of_day_utc).';

COMMENT ON COLUMN public.behaviour_patterns.dismissed_at IS
  'User explicitly dismissed this pattern via Memory Surface sec.10.13.3 '
  '(Stage 2C UI). Non-null = never surface again. Pattern remains '
  'is_active=true in the substrate so cron-pattern-detection convergence '
  'is unaffected -- only the chat surfacing is suppressed.';

COMMENT ON COLUMN public.behaviour_patterns.dismissed_reason IS
  'Optional free-text reason captured at dismissal via the Memory '
  'Surface affordance. For analytics; never displayed back to other '
  'users. Stored as plain text -- frontend renders, never as HTML.';
