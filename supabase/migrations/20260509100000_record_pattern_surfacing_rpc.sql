-- ============================================================
-- SEVEN MYND -- Migration 20260509100000
-- Stage 2A PR-2a — record_pattern_surfacing RPC
--
-- Context: Stage 2A PR-2 wires §10.7.A Proactive Surfacing gates onto
-- the existing chat function. When a pattern surfaces, two writes
-- happen atomically:
--   1. UPDATE behaviour_patterns SET last_surfaced_at, surfacing_count
--   2. INSERT INTO audit_log (user_id, action='pattern_surfaced', ...)
--
-- audit_log is service-role-only-write per CLAUDE.md §6.6 (the user's
-- RLS does not allow direct INSERT). Wrapping the two writes in a
-- SECURITY DEFINER PL/pgSQL function is the cleanest way to:
--   (a) get atomic UPDATE+INSERT in one transaction
--   (b) bypass audit_log RLS for the audit write only (defense in depth
--       via auth.uid() ownership check on the pattern row)
--   (c) avoid splitting the chat function across two clients
--       (user-scoped for UPDATE, service-role for audit)
--
-- Companion to chat/index.ts edits in PR-2b. PR-2a (this file) ships
-- first; PR-2b ships only after this migration is applied to production.
--
-- Defense-in-depth design:
--   - SECURITY DEFINER required so the audit_log INSERT can write
--     (audit_log is service-role-only-write).
--   - SET search_path = public, pg_temp at function declaration to
--     pre-empt the function_search_path_mutable advisor (1A backlog
--     C72 discipline — fix as we add new functions, don't accumulate).
--   - REVOKE EXECUTE FROM PUBLIC and FROM anon, GRANT TO authenticated:
--     pre-empts the anon_security_definer_function_executable advisor.
--     Only signed-in users can call this function.
--   - Inside the function: auth.uid() check + WHERE clause matching
--     id AND user_id ensures the caller can only update their own
--     pattern rows. SECURITY DEFINER bypasses RLS, but the explicit
--     WHERE re-establishes ownership verification.
--   - RAISE EXCEPTION on unauthenticated or wrong-owner: closes the
--     function fail-closed.
--
-- Forward-only-safe: CREATE OR REPLACE FUNCTION is idempotent. Drops
-- of the function would not affect existing data (audit_log + behaviour_
-- patterns rows persist).
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.record_pattern_surfacing(uuid, numeric, text);
-- After rollback, chat code calling this function would error on the
-- RPC call; PR-2b is gated on this migration being applied first.
--
-- Cross-references: §10.7.A; §6.6; CLAUDE.md §9.13; lessons C71/C72/C73
-- (CTE/scheduled-job/vault-update discipline) — none of those apply
-- here as this is a standalone CREATE FUNCTION with idempotent semantics
-- and no embedded mutations. Schema-leads-query verified 2026-05-09:
-- audit_log has columns (id, user_id, action, table_name, row_id,
-- details, created_at) — INSERT below uses the actual column names,
-- not the guard's proposed-but-unverified shape.
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_pattern_surfacing(
  p_pattern_id uuid,
  p_relevance_score numeric,
  p_pattern_type text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  -- Verify the pattern is owned by the calling user (defense in depth;
  -- SECURITY DEFINER bypasses RLS, so we re-establish ownership here).
  PERFORM 1
  FROM public.behaviour_patterns
  WHERE id = p_pattern_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pattern not found or not owned by caller'
      USING ERRCODE = '42501';
  END IF;

  -- Atomic UPDATE + audit INSERT inside the function's implicit
  -- transaction. If either statement fails, both roll back.

  UPDATE public.behaviour_patterns
    SET last_surfaced_at = now(),
        surfacing_count  = surfacing_count + 1
    WHERE id = p_pattern_id AND user_id = v_user_id;

  INSERT INTO public.audit_log (user_id, action, table_name, row_id, details)
    VALUES (
      v_user_id,
      'pattern_surfaced',
      'behaviour_patterns',
      p_pattern_id,
      jsonb_build_object(
        'relevance_score', p_relevance_score,
        'pattern_type',    p_pattern_type
      )
    );
END;
$$;

-- Tighten executable scope: only authenticated users can call this.
-- Pre-empts the anon_security_definer_function_executable advisor that
-- would otherwise fire (Phase 1A backlog item; we close it for new
-- functions as we add them so the advisor list doesn't grow).
REVOKE ALL ON FUNCTION public.record_pattern_surfacing(uuid, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_pattern_surfacing(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_pattern_surfacing(uuid, numeric, text) TO authenticated;

COMMENT ON FUNCTION public.record_pattern_surfacing(uuid, numeric, text) IS
  'Stage 2A PR-2: atomic UPDATE behaviour_patterns + INSERT audit_log '
  'when Seven surfaces a pattern in chat. Called by the chat Edge '
  'Function via supabase.rpc. SECURITY DEFINER + auth.uid() ownership '
  'check + REVOKE FROM anon = authenticated-only path. Audit row '
  'records relevance_score and pattern_type for the Stage 2C surfacing '
  'audit panel (Memory Surface §10.13.6).';
