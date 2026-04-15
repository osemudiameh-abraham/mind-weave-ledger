-- ============================================================
-- SEVEN MYND — Security Hardening Migration
-- Fix memories_structured column name: content → text
--
-- Context: Migration 001 created column as 'content'.
-- All application code (chat, cron-pattern-detection, match_memories RPC)
-- references the column as 'text'. Production was manually altered to match.
-- This migration makes the repo reproducible on fresh databases (staging).
-- Idempotent: only renames if 'content' exists and 'text' does not.
-- ============================================================

DO $$
BEGIN
  -- Only rename if 'content' column exists and 'text' column does not
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'memories_structured'
      AND column_name = 'content'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'memories_structured'
      AND column_name = 'text'
  ) THEN
    ALTER TABLE public.memories_structured RENAME COLUMN content TO text;
    RAISE NOTICE 'memories_structured: renamed column content → text';
  ELSE
    RAISE NOTICE 'memories_structured: column already named text (or content does not exist) — no action needed';
  END IF;
END $$;
