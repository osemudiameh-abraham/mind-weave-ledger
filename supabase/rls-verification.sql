-- RLS Verification Query — Architecture Section 19.13
-- Run this to verify every public table has RLS enabled.
-- Any table showing rls_enabled = false is a security risk.

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  CASE WHEN rowsecurity THEN '✓ SECURE' ELSE '✗ VULNERABLE' END AS status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity ASC, tablename;
