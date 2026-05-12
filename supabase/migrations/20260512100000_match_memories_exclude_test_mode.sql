-- ════════════════════════════════════════════════════════════════════════
-- 20260512100000_match_memories_exclude_test_mode.sql
-- ════════════════════════════════════════════════════════════════════════
--
-- C78 — Test-mode flag, server-side filter for the semantic-search RPC.
--
-- Purpose:
--   When the chat function is invoked with `x-seven-test-mode: 1`, it
--   persists messages_structured rows tagged `metadata.test_mode = true`.
--   This migration adds a single WHERE-clause filter to `match_memories`
--   so the RPC's semantic-search results never include those test-tagged
--   rows. This is the only retrieval path that bypasses ordinary
--   PostgREST client-side filters (because the RPC pre-aggregates the
--   cosine-similarity result and we do not want a second round-trip).
--
-- Spec alignment:
--   - C78 (PHASE_BOARD §C78) — test mode is a one-way pollution shield:
--     normal-mode turns must never see test-mode rows in semantic search.
--     Test-mode turns are also blanket-filtered by this RPC (Option A per
--     the 2026-05-12 review packet) — YAGNI on parameterized cross-test
--     visibility until a real use case appears.
--   - §10.13.1 Memory Surface — only governance-grade memories should
--     surface to the user-facing identity model; test pollution must be
--     invisible to all normal-mode reads.
--
-- Why a function update (not a client-side post-filter):
--   `match_memories` returns the columns (id, text, memory_type,
--   importance, similarity, created_at) — it does NOT return `metadata`.
--   A client-side filter would require a second SELECT to fetch metadata
--   for the returned IDs, doubling round-trips on every chat turn. A
--   server-side WHERE-clause filter is single-query and zero extra
--   latency.
--
-- Backwards compatibility:
--   - Signature unchanged (no new parameter, no return-column change).
--   - All existing callers continue to work without modification.
--   - Pre-existing memories_structured rows have `metadata = '{}'::jsonb`
--     (the column default) — `'{}'->>'test_mode'` is NULL, COALESCEd to
--     'false', `'false' != 'true'` is true → row passes filter. No
--     pre-existing data is excluded by this migration.
--
-- Privilege preservation:
--   `CREATE OR REPLACE FUNCTION` in PostgreSQL preserves existing GRANTs.
--   No GRANT / REVOKE statements are issued here. The Phase 1A SECURITY
--   DEFINER hardening pass (separate migration, separate guard review)
--   will revisit anon/authenticated EXECUTE privileges on this function
--   per the PHASE_1A_TRIAGE.md WARN findings.
--
-- Migration scope:
--   - One DDL statement: CREATE OR REPLACE FUNCTION.
--   - One added WHERE-clause term.
--   - No data modification.
--   - No grant/revoke change.
--   - No schema change to any table.
--
-- Rollback:
--   Re-apply `supabase/migrations/20260502000000_fix_match_memories_use_text_with_created_at_and_extensions_search_path.sql`
--   which contains the pre-C78 function body (without the test_mode
--   filter). Idempotent; safe to re-run.
--
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding extensions.vector(3072),
  match_user_id uuid,
  match_count integer DEFAULT 10,
  match_threshold double precision DEFAULT 0.3
)
RETURNS TABLE(
  id uuid,
  text text,
  memory_type text,
  importance real,
  similarity double precision,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ms.id,
    ms.text,
    ms.memory_type,
    ms.importance,
    1 - (ms.embedding <=> query_embedding)::double precision AS similarity,
    ms.created_at
  FROM public.memories_structured ms
  WHERE ms.user_id = match_user_id
    AND ms.embedding IS NOT NULL
    AND 1 - (ms.embedding <=> query_embedding)::double precision > match_threshold
    AND COALESCE(ms.metadata->>'test_mode', 'false') != 'true'
  ORDER BY ms.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════
-- DONE — match_memories now filters out memories_structured rows where
-- metadata.test_mode = 'true'. Existing data unaffected. Signature
-- unchanged. Existing GRANTs preserved.
-- ════════════════════════════════════════════════════════════════════════
