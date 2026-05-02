-- ============================================================
-- SEVEN MYND -- Migration 20260502120000
-- Add metadata jsonb column to memories_structured
--
-- Context: chat/index.ts:1318 (storeResearchMemory) attempts to
-- INSERT a metadata jsonb payload but the column does not exist
-- in production (per B1 ground truth Q-V1, 2026-05-02). Every
-- research-memory INSERT has been silently failing with a 400
-- from PostgREST. The error is caught in try/catch and logged
-- as "[RESEARCH] Failed to persist research memory" but no row
-- is stored.
--
-- Effect: research findings from Gemini live web search have
-- not been persisted to long-term memory since the column drift
-- emerged. Architecture sec. 3.5 Step 7 specifies research memories
-- should be stored with a 24-hour TTL via metadata.is_permanent
-- = false. Without the column, the TTL flag has nowhere to live
-- and the deferred cleanup cron (sec. 19.8) has nothing to filter on.
--
-- This migration:
--   1. Adds metadata jsonb column with default '{}'::jsonb
--   2. NOT NULL with default -- safe for the 984 existing rows
--      (they get '{}' on backfill)
--   3. Idempotent via IF NOT EXISTS (safe to re-run)
--
-- Once applied, the storeResearchMemory INSERT (separately fixed
-- in this PR) will succeed and persist the metadata payload that
-- includes is_permanent, query, sources, search_queries_used,
-- and model.
--
-- Future use: this column is also referenced (or potentially
-- referenced) by other writers -- document-process chunks, chat
-- memories -- that would benefit from structured metadata. Adding
-- it now opens the door for those future enhancements without
-- another migration.
--
-- Touches one column. Zero rows mutated by add (default backfills
-- on read for existing rows; jsonb default is a metadata-only
-- operation in modern Postgres). No RLS changes. No functions
-- altered.
-- ============================================================

ALTER TABLE public.memories_structured
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_memories_structured_metadata
ON public.memories_structured USING gin (metadata);
