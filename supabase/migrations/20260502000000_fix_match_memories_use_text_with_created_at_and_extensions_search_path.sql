-- ============================================================
-- SEVEN MYND — Migration 20260502000000
-- Fix match_memories RPC: use ms.text + add created_at + 
-- include extensions in search_path
--
-- Context: Vector search has been silently broken since the
-- column rename (20260415_fix_memories_column_name).
--
-- Two compounding issues:
--   1. The RPC body referenced ms.content but the column was
--      renamed to ms.text by 20260415. Every invocation errored
--      with: 42703: column "ms.content" does not exist
--
--   2. After fixing (1), the RPC errored with:
--      42883: operator does not exist: extensions.vector <=> 
--      extensions.vector
--      pgvector installs the <=>, <->, <#> operators in the
--      'extensions' schema. The previous SET search_path = public
--      did not allow the operators to resolve.
--
-- Effect (combined): chat context assembly (Architecture §3.6)
-- has been operating without past-memory recall on every user
-- message since the column rename.
--
-- This migration:
--   1. DROPs the old function (signature change requires DROP+
--      CREATE — CREATE OR REPLACE rejects return-type changes)
--   2. CREATEs the corrected RPC with:
--      - ms.text in body SELECT (canonical column post-rename)
--      - importance real (matches live column type)
--      - created_at in RETURNS TABLE (matches caller at 
--        chat/index.ts:2274 reading m.created_at)
--      - SET search_path = public, extensions (pgvector operators
--        resolve in extensions schema per Supabase standard)
--   3. Wraps DROP + CREATE in BEGIN/COMMIT — atomic swap. 
--      Concurrent callers see EITHER the old function OR the new,
--      never a missing function (Postgres MVCC).
--
-- This was applied to production via Supabase SQL editor on
-- 2026-05-02 with verification. Production smoke test returned
-- 5 rows with descending similarity (top match 1.0 = self-match).
-- This commit makes the fix reproducible on staging-from-git.
-- ============================================================

BEGIN;
DROP FUNCTION public.match_memories(vector, uuid, integer, double precision);
CREATE FUNCTION public.match_memories(
  query_embedding extensions.vector(3072),
  match_user_id uuid,
  match_count integer DEFAULT 10,
  match_threshold double precision DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  text text,
  memory_type text,
  importance real,
  similarity double precision,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
  ORDER BY ms.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
COMMIT;
