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

## C72 — Schema-leads-query (C29/C63) extends to scheduled jobs and Edge Functions; column drift in unrun code is invisible until first execution

**Date:** 2026-05-09
**Surface:** `cron-pattern-detection` Edge Function vs `decisions` / `outcomes` schema.
**Context:** Stage 2A-prereq for Proactive Surfacing (§10.7.A) — discovered that `behaviour_patterns` has 0 rows because the cron-pattern-detection function never produced any.

The function selected `decisions.title` and `outcomes.reflection` — neither
column exists. Real columns are `decisions.text_snapshot` and
`outcomes.text_snapshot`. The function was deployed (visible in
`supabase/functions/`) but **never scheduled in `pg_cron`** — only
`reminders-fire` was. The column-drift bugs sat invisible for months:
deployment passed, git history clean, code review didn't catch it because
nobody ran the function against real data.

**Why it was easy to miss:** lessons C29 and C63 say to verify columns
exist before extending a `.select()`. That discipline applies to
hand-written queries you can see executing. It does *not* automatically
extend to:

- **Scheduled jobs** that haven't fired yet (cron schedule was missing entirely)
- **Edge Functions** that exist in source but aren't being invoked
- **Migration files** in `supabase/migrations/` that aren't applied yet
- **Code paths** behind feature flags that are off

The schema-vs-code gap is invisible without execution. The first
scheduled run is the first time Postgres ever sees the query — and the
first time the column-drift error surfaces.

**The discipline (extends C29/C63):** when fixing or auditing a function
that touches the database, audit pairs of things together:

1. **Cron schedule check:** `SELECT * FROM cron.job WHERE active = true;`
2. **Function source review:** every `.from(...)` and `.select(...)` call.
3. **Schema diff:** for every table referenced, query
   `information_schema.columns` and compare against the `.select()` list.
4. **Function side-effects:** the function should produce observable rows
   within one trigger; absence of rows after a 200 response means
   `try/catch` is silently swallowing an error.

**Engineering rule for new scheduled functions:**

1. Schedule the cron AND trigger once manually before relying on the
   schedule. The first run reveals errors the second run can't.
2. Read the response status code AND the destination table state.
   200 alone is not enough — `try/catch` patterns return ok even when
   the function silently fails. (See chat/index.ts:1318 `[RESEARCH]
   Failed to persist research memory` — same anti-pattern.)
3. Pull `[FUNCTION_NAME]` log lines via `get_logs` to confirm no
   `[ERROR]` lines fired during the trigger.

**Cross-reference:** C29, C63 (column verification before `.select()`).
Architecture Part XV.7 (audit pattern). Discovered while diagnosing
why `behaviour_patterns` was empty after the §10.7.A proactive
surfacing prereqs landed.

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
