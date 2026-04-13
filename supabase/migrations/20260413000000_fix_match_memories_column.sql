DROP FUNCTION IF EXISTS public.match_memories(extensions.vector, uuid, integer, double precision);

CREATE OR REPLACE FUNCTION public.match_memories(
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
    ms.text,
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
