# LESSONS.md — Seven Mynd Engineering Lessons

Append-only catalogue of engineering failure modes and the discipline they
produced. Each lesson is identified by a stable `C##` number. Lessons are
never deleted; superseding entries are added with explicit cross-reference.

## Where C1–C69 live

Lessons C1 through C69 were captured during the v5.5 → v5.7 build and are
documented inline in the architecture (`docs/architecture/SEVEN_MYND_Master_Architecture_v5_7.docx`,
Part XV.8 "Engineering Discipline Lessons"). Notable references called out
in `CLAUDE.md` §6:

- **C29 / C63** — Schema must lead query. Verify columns exist before extending `.select()`.
- **C34–C40** — RLS, service role, audit trail patterns.
- **C56–C57** — SQL paste discipline (whitespace + DROP substring traps).
- **C61** — GitHub CodeMirror strips trailing newline on paste.
- **C64** — Supabase JS SDK `functions.invoke()` doesn't send `Accept` header.
- **C65** — Ship surfaces only when value justifies visual interruption.
- **C66** — Never read or mutate outer-scope variables inside `setState` updater callbacks.
- **C67** — framer-motion writes inline transforms; don't compose with Tailwind transform classes on the same element.
- **C68** — Redactor byte-count vs SHA integrity. Trust SHA, not bytes.
- **C69** — Reconstructing a file from a line-prefixed dump must be verbatim, not from prior memory.

This file (LESSONS.md) is the going-forward append surface for C70+. When a
new failure mode appears, add a numbered entry below.

---

## C70 — CHECK constraints become invisible blockers when a shared table is reused for a new domain

**Date:** 2026-05-08
**Surface:** `public.feedback_signals` (Memory Surface §10.13.1 thumbs feedback)
**Context:** PR #46/#48 — extending feedback_signals from chat/voice/live to the Memory Surface.

`feedback_signals_surface_check` was authored in Phase 0.C Stage 1 with
`surface IN ('chat','voice','live')`. The Memory Surface introduced a
fourth source domain. The hook wrote `surface='memory_identity_card'`,
Postgres rejected with `23514 check_constraint_violation`, and the failure
surfaced in the UI as a silent thumbs-button error.

**Why it was invisible:** schema introspection via
`information_schema.columns` returns column types and nullability — not
CHECK definitions. The constraint's allowlist lived in `pg_constraint`
and was easy to miss when planning a new writer against the table.

**The discipline:** when extending a shared table to a new
source/kind/category domain, query `pg_constraint` for CHECK definitions
on the column, not just `information_schema.columns`:

```sql
SELECT con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = '<schema>'
  AND rel.relname = '<table>'
  AND con.contype = 'c';
```

Column type alone does not reveal allowlists. The schema-leads-query
discipline of C29/C63 extends to constraints, not just columns.

**Cross-reference:** CLAUDE.md §9.14 ("New domain = new enum value, not
overload") explains why the fix is to extend the allowlist rather than
reuse `'chat'` from the Memory Surface — overloading domains corrupts
downstream aggregation (here: `cron-identity-model` filtering by surface).

---

## C71 — Postgres data-modifying CTEs cannot see each other's effects on the same target table

**Date:** 2026-05-08
**Surface:** verification smoke test for the C70 fix.
**Context:** trying to atomically insert a smoke-test row and clean it up
in one statement after applying the migration.

The pattern that fails:

```sql
WITH inserted AS (
  INSERT INTO public.feedback_signals (...) VALUES (...) RETURNING id
)
DELETE FROM public.feedback_signals
WHERE id IN (SELECT id FROM inserted)
RETURNING id;
```

Postgres runs all data-modifying CTEs **with the same snapshot**
(`MVCC` semantics, see PostgreSQL docs §7.8.2). The DELETE cannot see
the INSERT's row in the table because that row didn't exist at snapshot
time. The INSERT still executes (rows are created), but the same-statement
DELETE returns zero rows. Result: the smoke test appears to succeed
silently while leaving a real row stranded in production.

**The discipline:** for atomic insert-and-cleanup against the same table,
use one of:

**(a) Two statements in a transaction:**

```sql
BEGIN;
  INSERT INTO public.feedback_signals (...) VALUES (...) RETURNING id;
  -- capture id, then in the same transaction:
  DELETE FROM public.feedback_signals WHERE id = <captured_id>;
COMMIT;
```

**(b) Tag the insert with a known marker, then DELETE by marker in a separate statement:**

```sql
INSERT INTO public.feedback_signals (..., response_metadata)
  VALUES (..., '{"smoke_test": true}'::jsonb);

DELETE FROM public.feedback_signals
  WHERE response_metadata @> '{"smoke_test": true}'::jsonb;
```

Pattern (b) is the safer default when the writer is the Supabase MCP
`execute_sql` tool, which executes each call as its own implicit
transaction — so two `execute_sql` calls cannot share a transaction
across the (a) pattern unless wrapped in explicit BEGIN/COMMIT inside
one call.

**Cross-reference:** the snapshot-isolation behaviour is the same
property that makes RLS WITH CHECK clauses safe under concurrent INSERTs —
not a bug, just a subtle interaction with same-table modifying CTEs.

---

<!--
When adding a new lesson:

1. Pick the next free C## number.
2. Lead with the rule itself in one line, then **Date:**, **Surface:**,
   **Context:** lines.
3. Explain *why* it was easy to miss — that's the part that compounds.
4. Show the discipline as code where possible.
5. Cross-reference related lessons (C29 / C63 / etc.) and CLAUDE.md
   sections so future readers can see the lineage.

Append to the end. Never edit a previous lesson; supersede with a new one
that names the prior C## explicitly.
-->
