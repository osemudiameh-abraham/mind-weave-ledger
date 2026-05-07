-- ============================================================
-- SEVEN MYND -- Migration 20260508000000
-- Extend feedback_signals.surface CHECK to admit 'memory'
--
-- Context: PR #46 (Memory Surface, architecture sec.10.13) writes
-- feedback rows from the Identity Model Card thumbs up/down
-- (sec.10.13.1) via src/hooks/use-identity-card-data.ts. The
-- existing CHECK constraint feedback_signals_surface_check was
-- authored in Phase 0.C Stage 1 when feedback_signals was scoped
-- to message-level surfaces only (chat, voice, live). Inserts
-- with surface='memory' are rejected at the database boundary
-- with check_constraint_violation, surfacing in the UI as a
-- failed thumbs button.
--
-- Per CLAUDE.md sec.9.14 (new domain = new enum value, not
-- overload), we cannot reuse surface='chat' for the Memory
-- Surface -- doing so would corrupt cron-identity-model
-- aggregation along the surface axis. The Memory Surface is a
-- fourth source domain; the allowlist is extended.
--
-- Naming: chose coarse 'memory' over fine 'memory_identity_card'.
-- The Memory Surface (sec.10.13) has six sub-panels (10.13.1
-- Identity Card, 10.13.2 Decision Ledger, 10.13.3 Active Patterns,
-- 10.13.4 Memory Facts Timeline, 10.13.5 Location Panel, 10.13.6
-- What Seven Doesn't Know). The domain is the Memory Surface;
-- panel identity is a sub-distinction carried in
-- response_metadata.target_field. One domain, one CHECK value;
-- panels disambiguate inside the row.
--
-- Existing rows: 'chat', 'voice', 'live' remain valid under the
-- new constraint. No data is mutated.
--
-- Rollback (only if zero 'memory' rows have been written):
--   ALTER TABLE public.feedback_signals
--     DROP CONSTRAINT feedback_signals_surface_check;
--   ALTER TABLE public.feedback_signals
--     ADD CONSTRAINT feedback_signals_surface_check
--     CHECK (surface = ANY (ARRAY['chat'::text, 'voice'::text, 'live'::text]));
--
-- This migration is forward-only-safe; rollback after 'memory'
-- rows exist requires DELETE-then-ALTER. feedback_signals is
-- append-only telemetry consumed by cron-identity-model; no
-- user-visible loss from such a delete.
--
-- Touches one CHECK constraint. Zero rows mutated. No RLS changes.
-- No policies altered. No functions altered.
-- ============================================================

ALTER TABLE public.feedback_signals
  DROP CONSTRAINT feedback_signals_surface_check;

ALTER TABLE public.feedback_signals
  ADD CONSTRAINT feedback_signals_surface_check
  CHECK (surface = ANY (ARRAY['chat'::text, 'voice'::text, 'live'::text, 'memory'::text]));
