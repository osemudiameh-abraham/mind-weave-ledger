-- ════════════════════════════════════════════════════════════════════════
-- 20260514100000_behaviour_patterns_consecutive_miss_count.sql
-- ════════════════════════════════════════════════════════════════════════
--
-- Per Architecture v5.7 §3.8 — retire after 3 consecutive misses.
--
-- cron-pattern-detection previously used 1-miss retire (the code comment
-- at line 263-265 admitted the deviation: "A production system would
-- track scan count per pattern"). This column enables spec-correct
-- semantics: increment on miss, reset on detection, retire when count
-- reaches 3.
--
-- Backwards compatibility: defaults to 0 for all existing rows. Existing
-- active patterns get a clean start under the new retire rule on the
-- next cron run. (Currently there are zero active patterns in
-- production — see PHASE_BOARD "2026-05-13 — Pattern detection
-- substrate-shape gap" — so this migration is structurally a no-op for
-- live data; it enables correct behaviour for the upcoming first real
-- successful scan.)
--
-- No data migration needed. No RLS changes. No grant changes. Single
-- DDL statement.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.behaviour_patterns
  ADD COLUMN consecutive_miss_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.behaviour_patterns.consecutive_miss_count IS
  'Number of consecutive cron-pattern-detection scans where this pattern was not detected. Reset to 0 on detection. At 3, is_active is set to false. Per Architecture v5.7 §3.8.';

-- ════════════════════════════════════════════════════════════════════════
-- DONE — new column ready for cron-pattern-detection's spec-correct
-- retire logic. No active patterns affected (column default 0).
-- ════════════════════════════════════════════════════════════════════════
