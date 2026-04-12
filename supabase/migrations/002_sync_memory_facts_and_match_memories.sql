-- ============================================================
-- SEVEN MYND — Migration 002
-- Sync memory_facts schema with production + add match_memories RPC
-- 
-- Context: Production memory_facts was altered outside of version
-- control to add governance columns (fact_key, canonical_text,
-- status, supersedes_fact_id, evidence_count, updated_at).
-- The original 001 migration does not reflect this.
-- This migration makes the repo reproducible.
-- ============================================================

-- ─── 1. Add missing columns to memory_facts ───
-- These columns exist in production but not in 001_full_schema.sql.
-- Using IF NOT EXISTS pattern via DO blocks for idempotency.

DO $$
BEGIN
  -- fact_key: composite identifier (e.g. "subject::attribute")
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memory_facts' AND column_name = 'fact_key'
  ) THEN
    ALTER TABLE public.memory_facts ADD COLUMN fact_key text NOT NULL DEFAULT '';
  END IF;

  -- canonical_text: human-readable sentence form of the fact
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memory_facts' AND column_name = 'canonical_text'
  ) THEN
    ALTER TABLE public.memory_facts ADD COLUMN canonical_text text NOT NULL DEFAULT '';
  END IF;

  -- status: active | superseded | historical
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memory_facts' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.memory_facts ADD COLUMN status text NOT NULL DEFAULT 'active';
  END IF;

  -- supersedes_fact_id: links to the fact this one replaced
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memory_facts' AND column_name = 'supersedes_fact_id'
  ) THEN
    ALTER TABLE public.memory_facts ADD COLUMN supersedes_fact_id uuid;
  END IF;

  -- evidence_count: how many times this fact has been reinforced
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memory_facts' AND column_name = 'evidence_count'
  ) THEN
    ALTER TABLE public.memory_facts ADD COLUMN evidence_count integer NOT NULL DEFAULT 1;
  END IF;

  -- updated_at: last modification timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memory_facts' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.memory_facts ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- ─── 2. Rename 'value' to match production if needed ───
-- Production has both 'value' (nullable) and 'value_text' (NOT NULL).
-- The original migration only had 'value'. Production was altered to
-- add 'value_text' as the canonical column. Ensure both exist.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memory_facts' AND column_name = 'value_text'
  ) THEN
    -- If value_text doesn't exist, add it and populate from value
    ALTER TABLE public.memory_facts ADD COLUMN value_text text NOT NULL DEFAULT '';
    UPDATE public.memory_facts SET value_text = COALESCE(value, '') WHERE value_text = '';
  END IF;
END $$;

-- ─── 3. Add updated_at trigger for memory_facts ───
DROP TRIGGER IF EXISTS trg_updated_memory_facts ON public.memory_facts;
CREATE TRIGGER trg_updated_memory_facts
  BEFORE UPDATE ON public.memory_facts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 4. Create match_memories RPC function ───
-- Used by the chat endpoint for semantic (vector) memory search.
-- Returns memories ordered by cosine similarity to a query embedding.

CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding extensions.vector(3072),
  match_user_id uuid,
  match_count integer DEFAULT 10,
  match_threshold double precision DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  content text,
  memory_type text,
  importance integer,
  similarity double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ms.id,
    ms.content,
    ms.memory_type,
    ms.importance,
    1 - (ms.embedding <=> query_embedding)::double precision AS similarity
  FROM public.memories_structured ms
  WHERE ms.user_id = match_user_id
    AND ms.embedding IS NOT NULL
    AND 1 - (ms.embedding <=> query_embedding)::double precision > match_threshold
  ORDER BY ms.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ─── 5. Indexes for new columns ───
CREATE INDEX IF NOT EXISTS idx_facts_status
  ON public.memory_facts(user_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_facts_fact_key
  ON public.memory_facts(user_id, fact_key);

-- ============================================================
-- DONE — memory_facts synced, match_memories RPC created
-- ============================================================
