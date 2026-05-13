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

## C73 — `vault.update_secret()` (and any side-effecting function call) inside an unreferenced CTE silently no-ops

**Date:** 2026-05-09
**Surface:** Stage 2A-prereq coordinated rotation of `pattern_detection_cron_secret`.
**Context:** I tried to rotate the vault secret AND surface the new value to the founder in one statement. Wrote a CTE chain like:

```sql
WITH new_value AS (SELECT encode(gen_random_bytes(32), 'hex') AS v),
     updated AS (
       SELECT vault.update_secret(
         (SELECT id FROM vault.secrets WHERE name = 'pattern_detection_cron_secret'),
         (SELECT v FROM new_value), 'pattern_detection_cron_secret', '...'
       ) AS r
     )
SELECT (SELECT v FROM new_value) AS new_cron_secret;  -- references new_value but NOT updated
```

The main `SELECT` referenced `new_value` to display the new secret to
the founder. It did **not** reference `updated`. PostgreSQL eliminated
the unreferenced CTE; `vault.update_secret(...)` never executed. The
vault entry stayed at the previous value. The founder pasted the
displayed-but-unstored value into the function env var. The trigger
401'd because vault and env diverged.

**Why it was easy to miss:** the CTE was right there in the SQL. The
result of the main SELECT (the new secret value) looked correct. There's
no error, no warning, no log line — just a silent skip. The first
diagnostic ("did vault update?") was empirical:

```sql
SELECT length(decrypted_secret), LEFT(decrypted_secret, 8)
FROM vault.decrypted_secrets WHERE name = 'pattern_detection_cron_secret';
-- length=44, first8='p0xE/ZOy' (the OLD base64 value, not the hex value displayed)
```

**Same root cause family as C71** but a different symptom. C71: the CTE
runs but its mutations are invisible to other CTEs in the same statement
due to snapshot isolation. C73: the CTE doesn't run at all because the
PostgreSQL planner eliminates unreferenced CTEs. Both gotchas are about
CTE semantics; both bite when you assume "the CTE definitely ran because
it's there."

PostgreSQL documents this behaviour in §7.8.2 — modifying CTEs are
guaranteed to execute exactly once **when the CTE is referenced in the
main query**. An unreferenced WITH clause may be optimised away.

**The discipline:** vault mutations (`vault.create_secret`,
`vault.update_secret`, `vault.delete_secret`) and any function call with
a side effect that the main query doesn't consume must be **standalone
statements**, not CTE-embedded. Use one of:

```sql
-- (a) standalone
SELECT vault.update_secret(...);
-- then the next statement reads the result

-- (b) reference the CTE in the main query
WITH updated AS (SELECT vault.update_secret(...) AS r)
SELECT r FROM updated;
```

**Verification rule:** after any vault mutation, ALWAYS query
`vault.decrypted_secrets` (or appropriate post-state) to confirm the
mutation took effect. Do not trust the SQL ran just because no error
was thrown — for a CTE-embedded mutation that PostgreSQL optimised away,
there IS no error, and there are no side effects either.

**Cross-reference:** C71 (data-modifying CTE snapshot isolation).
PostgreSQL §7.8.2 (modifying CTEs).

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

---

## C76 — MCP `deploy_edge_function` rejects payloads above ~50K tokens; use Supabase CLI for large functions

**Date:** 2026-05-10
**Surface:** Stage 2A PR-2b iter-2 deploy of `supabase/functions/chat/index.ts`
(3,573 lines / ~125 KB).
**Context:** attempted `mcp__supabase__deploy_edge_function` to ship the
iter-2 chat-gates code after editing the function. The tool rejected the
payload — request body exceeded the MCP integration's per-call token
ceiling (approximately 50K tokens at the time, varies by MCP version).

**Why it was easy to miss:** the MCP tool's description doesn't surface
a size limit. The first symptom is a generic protocol error after a
slow upload, with no actionable hint that the function is "too large."
Small functions (under ~1,500 lines) deploy fine, so the limit isn't
visible during normal development.

**The discipline:** for Edge Functions where source file exceeds ~2,500
lines OR ~80KB on disk, default to the local CLI instead of the MCP
tool:

```bash
supabase functions deploy <slug> --project-ref <project_ref>
```

The CLI reads from disk and uploads via the Supabase Functions REST API
directly, which has a much higher (multi-MB) payload limit. Workflow
requirements:

1. Ensure all edits are SAVED to disk before invoking the CLI deploy.
2. After deploy, verify via `mcp__supabase__list_edge_functions` that
   the version incremented AND `ezbr_sha256` changed — the CLI's
   "Deployed Functions" success message doesn't include the new hash.
3. The CLI doesn't gate JWT-verify settings on redeploy — existing
   `verify_jwt` is preserved.

**Cross-reference:** CLAUDE.md §8 lists `deploy_edge_function` under
tool boundaries with guard-review-on-dev / founder-approval-on-prod
gating. C76 narrows that to: the MCP path itself only applies to
sub-50K-token functions. For larger functions, the CLI is the only
viable path even with guard approval. Used live on v74 (2026-05-10),
v75 (2026-05-12), v76/v77/v78 (2026-05-13).

---

## C82 — UI toggle can be structurally disconnected from the consuming gate when the consumer's SELECT doesn't include the column

**Date:** 2026-05-13
**Surface:** `supabase/functions/chat/index.ts:1972` (identity_profiles
SELECT) vs Stage 2A PR-3 `Settings.tsx` proactive-surfacing toggle.
**Context:** PR-3 (2026-05-11) added a Settings UI toggle that writes
`identity_profiles.proactive_surfacing_enabled`. The chat function's
§10.7.A Gate 4a (line 2459-2465 post-merge) reads
`identity?.proactive_surfacing_enabled !== false`. But the identity-
profiles SELECT at line 1972 (pre-existing column list) does NOT
include the new column. The JS object has `undefined` for that field;
`undefined !== false` is `true`; the gate always passes regardless of
the user's actual toggle setting.

**Why it was easy to miss:** both halves of the feature ship "working":
- UI side: toggle clicks save to DB ✓
- Server side: chat function still references the property ✓ (in TS,
  reading a missing key returns undefined, not a compile error)
- No runtime error, no log, no failed test, no schema check.

The disconnect is silent. The only way to catch it is to test the
toggle's INTENDED EFFECT (does turning it OFF actually stop pattern
surfacing?) — and Stage 2A's verification target was the gate-chain
plumbing, not the toggle UX, so the disconnect went undiscovered until
2026-05-13 forensic review of why a 0.05-floor sensitivity test still
worked when "the toggle would have to be checked."

**The discipline:** when a feature spans UI-write + server-side-read
of a new column, the test plan must assert BOTH halves of the contract
PLUS the connection between them:

1. UI writes the column ✓
2. The consumer (chat function, RPC, cron, etc.) SELECTs the column ✓
3. **The toggle's intended effect is observable in consumer behaviour ✓**
   ← the assertion that catches C82-class disconnects

Schema-leads-query (C29/C63) extension: when adding a new column on
table X, grep the entire codebase for ALL `.select(` calls against
table X. Each consumer's SELECT must be audited for whether the new
column needs to be included.

```bash
# extending columns on identity_profiles? audit all consumers:
git grep -nE 'from\("identity_profiles"\)\.select' src/ supabase/
```

**Fix:** one-line addition to chat/index.ts:1972 — add
`proactive_surfacing_enabled` to the SELECT column list. Deferred to
next chat redeploy cycle (low priority; toggle is currently always-on
which matches the default state).

**Cross-reference:** C29/C63 (schema-leads-query). PR-3 (Settings
toggle, 2026-05-11). PR-2b iter-2 (gate chain, 2026-05-10).

---

## C83 — Embedding-pre-filter floors must be calibrated against the actual model + text-shape distribution, not inherited from generic guidance

**Date:** 2026-05-13
**Surface:** `supabase/functions/chat/index.ts:1100` — Gate 3a embedding
pre-filter floor in `scorePatternRelevance` for §10.7.A proactive
surfacing.
**Context:** initial calibration was `c.similarity >= 0.4` based on a
mental model that text-embedding-3-large produces 0.4-0.7 cosine for
related-content pairs. Empirical observation during Stage 2A PR-2b
verification: legitimately-related pattern matches produced cosine
0.05-0.20, not 0.4-0.7.

Concretely: Pattern A's description (228 chars, ~45 tokens of mixed
action + statistical commentary: "You attempt all-nighters...5 of 6
attempts last quarter, single success came after a proper night's
sleep") vs the trigger query (71 chars, ~13 tokens of forward-looking
intent: "I'm thinking of pulling an all-nighter to finish this project
tonight") produced cosine **0.066-0.079** — well below the 0.4 floor,
despite clear semantic overlap. Both candidate patterns filtered before
ever reaching the LLM relevance scorer.

**Why it was easy to miss:** "0.4 cosine similarity floor" is a
defensible-sounding number from generic embedding-search guidance
(applied to typical query-vs-document retrieval where both are
paragraph-length). But text-embedding-3-large's similarity distribution
for **asymmetric length** pairs (short query, long description) is
materially compressed:

- Short-vs-short related: 0.4-0.7 (matches the inherited mental model)
- Short-vs-long related: 0.05-0.20 (well below the floor)
- Truly-unrelated: ~0.0

The floor needs to match the actual length distribution of the data,
not a generic "wide pre-filter" assumption.

**The discipline:** before locking in any embedding-similarity
threshold, sample representative `(query, candidate)` pairs across all
expected length combinations and measure the distribution:

```typescript
// One-off calibration script: embed strong-match, weak-match, no-match
// pairs and print cosines. Threshold = strong_match_low - 0.05 margin.
const pairs = [
  ["I might pull an all-nighter tonight", "<long pattern description about all-nighters>", "STRONG"],
  ["I might pull an all-nighter tonight", "<short pattern description about all-nighters>", "STRONG"],
  ["I might pull an all-nighter tonight", "<long pattern description about decision reversal>", "WEAK"],
  ["I might pull an all-nighter tonight", "<unrelated pattern>", "NO-MATCH"],
];
// Compute and inspect before deploying any threshold.
```

For chat function v77's calibration: floor 0.05, with top-3 cap as the
real cost guard. The LLM at Gate 3b (0.7 score threshold) is the
authoritative precision gate; the pre-filter is just an N-bounded
shortlist.

**Cross-reference:** scorePatternRelevance at `chat/index.ts:1074`
(2026-05-13 post-fix line numbers). PR-2b iter-2 (gate chain). C84
(same verification cycle, next blocker once C83 cleared).

---

## C84 — OpenAI `response_format: { type: "json_object" }` requires the literal word "json" in messages, AND every non-2xx error handler must log the response body

**Date:** 2026-05-13
**Surface:** `supabase/functions/chat/index.ts:1130` (systemPrompt in
scorePatternRelevance) + `chat/index.ts:1153` (error handler).
**Context:** Stage 2A PR-2b verification on chat function v77 — Gate 3a
passed after C83 calibration (`top_sim=0.503`), but Gate 3b's LLM
scoring call returned HTTP 400 with the body swallowed by a minimal
catch handler. Required a diagnostic deploy to surface the real cause.

**Two findings bundled (both fixed in chat function v78):**

### Finding 1 — OpenAI json_object literal-word requirement

When `response_format: { type: "json_object" }` is set on
`/v1/chat/completions`, OpenAI's API runs a pre-flight check: the
`messages` array must contain the literal word "json" (case-insensitive)
somewhere. If absent, the API returns HTTP 400 with body:

```json
{"error": {"message": "'messages' must contain the word 'json' in some form, to use 'response_format' of type 'json_object'.", ...}}
```

A JSON-shaped response schema *embedded as syntax* in the prompt (e.g.
`Return ONLY {"scores":[...]}`) does NOT satisfy the check — the literal
substring "json" must appear in the text. The pre-flight runs BEFORE
the model executes (so no token cost, no helpful 422 to distinguish from
other 400s).

**Easy to miss because** the prompt visually contains JSON syntax and
the example schema, so a reviewer sees "the prompt clearly asks for
JSON" without noticing the literal word is absent.

**Fix:** include "JSON" as a literal word in either the system or user
message. The hint that worked here: `Return ONLY a JSON object:
{"scores":[{"id":"<uuid>","score":<number>}, ...]}`.

### Finding 2 — Silent error handlers swallow diagnostic information

The prior catch handler was minimal:

```typescript
if (!res.ok) {
  console.error(`[PATTERN_RELEVANCE] OpenAI ${res.status} — fail closed`);
  return [];
}
```

This logs only the status code. The actual error message — which
would have named "json missing" in two seconds — was discarded.
Diagnosing the 400 required a separate diagnostic deploy to add the
body-capture pattern before fail-close.

**Discipline (engineering rule, fleet-wide):**

ANY error path that fail-closes on a non-2xx HTTP response MUST log
the response body (truncated to ~500 chars) alongside the status code:

```typescript
if (!res.ok) {
  const body = await res.text().catch(() => "(body read failed)");
  console.error(
    `[NAME] OpenAI ${res.status} ${res.statusText} — fail closed. body=${body.slice(0, 500)}`,
  );
  return [];
}
```

This pattern is already followed by 4 of 5 other OpenAI catch handlers
in chat/index.ts (lines 511, 600, 954, 1009, 1380 in v78). The
PATTERN_RELEVANCE handler was the outlier — likely copy-paste from a
boilerplate without inheriting the body-capture from the surrounding
handlers. Engineering rule: when introducing new fail-close handlers,
audit the file's existing handlers for the established pattern and
match it.

**Cross-reference:** scorePatternRelevance at `chat/index.ts:1074`.
C83 (same verification cycle, the immediately-prior blocker). C72
(audit pattern for new scheduled functions, similar "absence of
observable rows ≠ success" principle).

---

## C85 — Pipeline verification ≠ product working when the substrate doesn't carry the signal the consumer needs

**Date:** 2026-05-13
**Surface:** `supabase/functions/cron-pattern-detection/index.ts` +
`supabase/functions/chat/index.ts:1593` (`decisionSignals` regex) +
all downstream consumers of `behaviour_patterns`.
**Context:** Stage 2A PR-2b sealed 2026-05-13 after a full
verification cycle against synthetic seeds (Pattern A `energy_depletion`
+ Pattern B `decision_reversal`). The §10.7.A gate chain works
end-to-end: gates fire, `:::pattern :::` callouts render,
`record_pattern_surfacing` RPC updates `surfacing_count` and writes
`audit_log` atomically, cooldown filters repeat surfaces within 7
days. Post-seal forensics revealed **zero real patterns have ever
existed for any user across all time** — including the founder despite
15 decisions and ample chat activity over 90+ days.

**Why it was easy to miss:** synthetic-seed verification gives a
green checkmark on every structural test you can write — gates,
callouts, audit, cooldown, persistence, RPC atomicity. The structural
correctness is real. But the seeds bypass the substrate-to-detection
step entirely: they're INSERTed directly into `behaviour_patterns` to
test downstream gates, not produced by `cron-pattern-detection` from
a real chat→decision→scanner path. Real users traverse:

```
chat input  →  decisionSignals regex  →  decisions row  →  cron scanner  →  pattern row
              (chat/index.ts:1593)        (decisions table)   (cron-pattern-detection)
```

If the substrate at any step doesn't carry the behaviour shape the
next step's classifier expects, the gate chain at the end has nothing
to fire on. You only discover that AFTER the verification cycle that
gave you a clean shipping signal.

The deceptive thing is that synthetic-seed verification is *necessary* —
without it, the structural correctness of the gate chain is unproven
and the v5.8 architecture work below it has no foundation. It's just
not *sufficient* for declaring the feature works for real users.

**The discipline:** every verification cycle that uses synthetic
seeds at any layer must be paired with a verification cycle on real
production substrate BEFORE declaring the feature shippable.
Synthetic verification proves the pipeline is correct;
real-substrate verification proves the feature produces value. Both
are required. One without the other = unknown state.

Concretely for Memori's pattern-detection surface, every verification
going forward must include:

```sql
SELECT
  COUNT(*) FILTER (
    WHERE trigger_conditions->>'_synthetic' IS DISTINCT FROM 'true'
  ) AS real_patterns,
  COUNT(DISTINCT user_id) FILTER (
    WHERE trigger_conditions->>'_synthetic' IS DISTINCT FROM 'true'
  ) AS users_with_real_patterns
FROM public.behaviour_patterns;
```

**`real_patterns` must be > 0 for the feature to be considered
working.** If it's 0, the feature is silent for real users regardless
of how many synthetic tests pass.

This generalises beyond pattern detection. Any feature where the path
from user input → substrate → consumer involves an extraction step or
classifier (decision detection, fact extraction, situation detection,
outcome capture, identity model updates) needs the same real-substrate
gate. Synthetic test at one end + verified consumer at the other end
DOES NOT prove the middle is producing the right shape of substrate
for the consumer.

**Cross-reference:** C79 (extraction asymmetry — hypotheticals
over-claimed as facts, under-claimed as decisions; the decision side
is what hides recurring-intent patterns from the scanner). C82
(UI-to-consumer disconnect — same family of "verified at endpoints,
broken in middle" disease). PHASE_BOARD entry "2026-05-13 — Pattern
detection substrate-shape gap" (same finding, with α/β/γ remediation
paths). Stage 2A PR-2b verification cycle, chat function v78.

---
