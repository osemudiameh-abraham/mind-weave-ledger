# PHASE_BOARD.md — Seven Mynd Current Phase Board

This file is read at the start of every Claude Code session per CLAUDE.md
§15. It states the current phase, what's done, what's pending, what's
blocked. Update at session end as part of the SESSION_LOG handoff.

---

## Current phase

**Phase 0.C — Stage 2 (UI surfacing of substrate intelligence)**

Stage 1 closed 2026-05-05 with PR #41 (per architecture v5.7 §14 build
history). Stage 2 priorities per architecture line 1567 (corrected
labelling):

1. Proactive surfacing in chat (§10.7.A) — **in progress (Stage 2A)**
2. Decision Moments (§10.7.B) — pending Stage 2 mid-cycle
3. Voice-mode parity for new surfaces — pending
4. Memory Surface (§10.13) full build — Identity Card panel shipped
   2026-05-08 (PR #46 merged to **main**, live on sevenmynd.com);
   remaining panels pending §10.13.2-10.13.6
5. Hybrid background + live location subsystem (§17.6.A) full ship —
   pending

## Current sub-stage

**Stage 2A — Proactive Surfacing gates wired onto the existing chat
prototype.**

2A-prereq closed 2026-05-09. Cron infrastructure is now functional:
- `cron-pattern-detection` redeployed (v19, ACTIVE) with the column-drift
  fix (`decisions.text_snapshot`, `outcomes.text_snapshot`)
- `pg_cron` job `cron-pattern-detection-daily-0600-utc` was scheduled,
  then **PAUSED 2026-05-09 03:14 UTC** via `cron.unschedule(...)`
  pending Stage 2A PR-5 (cron `_synthetic`-aware filter — see expanded
  PR-5 scope below). Pause prevents the stale-retire query
  (`is_active=true AND scan_id != current_run_scan_id → set
  is_active=false`) from corrupting the synthetic Stage 2A seeds on
  its next 06:00 UTC firing. Re-schedule happens at the end of PR-5
  via re-running `cron.schedule(...)` from PR #51's setup script with
  the same daily 06:00 UTC timing.
- `CRON_SECRET` rotated and synchronized between vault
  (`pattern_detection_cron_secret`) and the function env var
- Manual trigger returns 200 with `users_processed: 1`,
  `patterns_detected: 0` (function works; LLM detection on real data
  returns empty array — separate Stage 2B investigation)

**2A in flight:**

- **Stage 2A PR-2b — STATUS: deployed but NOT verified** (as of 2026-05-11 EOD).
  Chat function **v74 active on production** with the §10.7.A 5-gate
  chain + observability + passive-listing removal. Tracking issue:
  https://github.com/osemudiameh-abraham/mind-weave-ledger/issues/61
  - 7 / 9 SQL-fidelity phases pass (gate logic at DB query layer +
    in-memory filters all correct).
  - 0 / 2 browser-level Phase A tests produced the `:::pattern :::`
    callout. Pattern-aware prose in responses came from §2.1 memory
    retrieval, not from the §10.7.A gate chain.
  - **Verification blocked by C78** (test-mode flag): cannot
    cleanly distinguish "gate is broken" from "gate is correctly
    silent because §2.1 memory retrieval is dominant" without
    test-mode isolation. Even after clean-slate ops on
    2026-05-11, a genuine 13 April memory entry produced the same
    pattern-aware-prose-without-callout outcome — and that entry
    is real user data we cannot delete.
  - Open PRs that stay draft tonight: **#57** (RPC migration audit
    trail — already applied to production), **#58** (chat gates
    iter-2 — code matches deployed v74), **#59** (PHASE_BOARD
    iter-2 note).
  - Synthetic seeds: pristine. `surfacing_count=0`,
    `last_surfaced_at=null`, `dismissed_at=null`, `_synthetic=true`
    preserved, descriptions clean (no `[SYNTHETIC TEST]` prefix).
  - Founder's substrate today: zero rows in `messages` /
    `memories_structured` / `memory_facts` / `memory_traces` for
    `created_at >= 2026-05-10` (full clean-slate ops 1-5 ran).
- **PR-A** — Stage 2A schema migration: applied to production
  2026-05-09. PR #55 stays open as documentation; merge to develop
  whenever convenient. Identical schema in `identity_profiles` and
  `behaviour_patterns` already live.
- Synthetic patterns seeded for the founder account (2 rows, scan_id =
  `synthetic_2A_smoke_test`, `trigger_conditions._synthetic = true`).
  Cleanup: DELETE after Stage 2A PR-2b verification passes (when test-mode
  flag is in place and gate chain confirmed working).

### Stage 2A open issue — ungoverned passive surfaces (resolved in iter 2)

The pre-PR-2b chat function intervention prototype added eligible
patterns to the system prompt as a "## BEHAVIOUR PATTERNS YOU'VE
DETECTED\nMention these if relevant" block. The main LLM (gpt-4o)
weaved those descriptions into responses, surfacing patterns to the
user **without** going through the §10.7.A gate chain — bypassing
the audit_log INSERT, the cooldown update, the surfacing_count
increment, and the per-pattern dismiss check. The user saw
pattern-aware advice; the substrate didn't record that it surfaced.

This was discovered 2026-05-10 when the Phase A end-to-end test
showed the chat response correctly mentioned pattern A's evidence
but no `:::pattern :::` callout markers were present AND
`surfacing_count` stayed at 0 with no `audit_log` row.

**Fix shipped in Stage 2A PR-2b iteration 2 (2026-05-10, chat fn
v74, guard direction option (a)):** the passive listing block was
removed entirely. If the gate chain doesn't trigger, the main LLM
gets NO pattern context — surfacing is a deliberate, governed act,
not an ambient byproduct of context. Also added observability log
lines at every gate-chain decision point so silent fail-closed
paths in `scorePatternRelevance` are now visible in `get_logs`.

**Forward consideration (Stage 2B):** if user-visible "pattern
awareness without explicit callout" is desired, design a governed
"passive surface" code path with its own `surfacing_count_passive`
counter and an `audit_log` action like `pattern_surfaced_passive`.
That would preserve the UX while keeping §10.7.A governance intact.
Decision deferred until Stage 2A surfacing rates show whether the
strict-gate-only behaviour leaves users without enough pattern
awareness in practice.

## Stage 2A scope (5 sub-PRs per the 2026-05-09 review packet)

- **PR-1: Schema migration** — IN FLIGHT (PR-A above)
- PR-2: Chat function gate refinements (confidence ≥ 0.65, hybrid LLM
  relevance scoring, 7-day cooldown, daily cap of 3, per-turn cap of 1,
  fail-closed on relevance LLM failure)
- PR-3: Settings toggle UI ("Bring up patterns before answering when
  relevant")
- PR-4: `dismiss_pattern` RPC + frontend hook (data layer; UI consumed
  in 2C)
- **PR-5: Smoke fixture for verification + cron `_synthetic`-aware patch
  + cron re-schedule** (scope expanded by guard 2026-05-09):
  1. Smoke fixture: synthetic seed lifecycle (create → verify gates pass
     → cleanup). Partially satisfied by the production seeds already in
     place (cleanup query is the new piece).
  2. `cron-pattern-detection/index.ts` patch: filter out rows where
     `trigger_conditions->>'_synthetic' = 'true'` from BOTH the upsert
     collision lookup (`~line 211`) AND the stale-retire query
     (`~line 254`). Two added `.is(...)` filters in the function source.
     Deploy via `mcp__supabase__deploy_edge_function`.
  3. Test that demonstrates: with the patch live, a scheduled cron
     triggered against a user that has BOTH a real cron-produced pattern
     AND a `_synthetic=true` seeded pattern leaves the synthetic row
     untouched (`is_active=true`, `scan_id` and `trigger_conditions`
     unchanged) while the real pattern follows the normal lifecycle.
  4. Cron re-schedule SQL (final step): re-run the `cron.schedule(...)`
     block from PR #51's setup script, daily 06:00 UTC. Run via
     `execute_sql` after the patch ships and the test passes.
  5. Synthetic cleanup: `DELETE FROM behaviour_patterns WHERE scan_id =
     'synthetic_2A_smoke_test' AND trigger_conditions @>
     '{"_synthetic":true}'::jsonb;` Idempotent; runs once at the end of
     2A verification.

## Deferred to Stage 2B

- **Investigate why cron-pattern-detection's GPT-4o returned 0 patterns
  on real data.** Could be prompt tuning, pattern_type allowlist
  breadth, or genuine data heterogeneity (founder has 11 decisions,
  the other test account has 33). Decision driven by Stage 2A
  surfacing rates after wiring gates against real-shaped data.
- Per-session surfacing cap
- `pattern_embedding vector(3072)` column for embedding cache
- Threshold tuning with real data (relevance floor, daily cap, embedding
  pre-filter floor)
- Chat-meta dismissal ("don't bring this up again" detected from user
  reply)
- §10.7.B Decision Moments (high-stakes intervention) — gets its own
  Category B packet

## Deferred to Stage 2C — substrate visibility commitment

**Must ship within 2 sub-stages of 2A landing** per the 2A review:

- Memory Surface §10.13.3 dismiss UI consuming the PR-4 hook
- Surfacing audit panel on `/memory` ("what Seven chose to surface vs
  suppress and why") — the §1.5 substrate-visibility complement to the
  chat surface
- "Recently surfaced" pattern badge on `Memory.tsx`

If 2C slips beyond 2A+2 sub-stages, that's a §1.5 quality-gate failure
that requires explicit founder + guard review.

---

## Open architectural questions for v5.8

### C77 (candidate) — substrate-vs-memory-retrieval governance boundary

**Discovered:** 2026-05-10, during Stage 2A PR-2b end-to-end testing.

**Finding:** the substrate has indexed its own ungoverned output as
memory. Pattern-aware prose generated through an ungoverned path
(passive listing, chat function v73) was persisted in the `messages`
table and is now being retrieved by semantic memory on subsequent turns
as "relevant past context." The substrate effectively remembers what
to say about a topic without going through pattern governance.

This is **not a code bug.** It's a category confusion between two
distinct surfaces:

- **§2.1 Total Recall (memory retrieval)** — supposed to surface prior
  context, ungoverned by design.
- **§10.7.A Proactive Surfacing (pattern gates)** — governed surface
  with audit/cooldown/dismiss/count.

When the §10.7.A path produces output that gets persisted, that output
becomes §2.1 fodder on future turns. **Governance erodes over time as
ungoverned outputs accumulate in message history.**

**Engineering implications:**

1. Stage 2A PR-2b's verification criteria (callout marker + `surfacing_count`
   + `audit_log`) test the §10.7.A path in isolation. They cannot
   distinguish "§10.7.A working correctly with empty substrate" from
   "§10.7.A working correctly but §2.1 producing parallel content."
2. Cleaning up memory history is a one-time fix that doesn't address
   the architectural question.
3. **Long-term:** assistant response persistence should distinguish
   substrate-derived content from gate-derived content. Pattern callouts
   (governed) should be persisted with metadata flagging their origin;
   pattern-aware prose from any path should NOT be indexed as
   patternable memory.

**Resolution path:** assistant response persistence should flag whether
output came from a governed surface so memory retrieval can decide
whether to suppress, flag, or surface neutrally. **Deferred to v5.8
architecture review as a design session — not a Stage 2A fix.**

**Revised Stage 2A PR-2b acceptance criteria** (per this finding,
guard direction 2026-05-10):

Stage 2A PR-2b is verified when:
1. The gate chain fires correctly when conditions are met (the
   `:::pattern :::` callout IS rendered, RPC IS called, audit row IS
   written, `surfacing_count` IS incremented).
2. The gate chain does NOT fire when conditions are not met (no callout
   when toggle off, cooldown active, dismissed, etc.).
3. The presence of pattern-aware prose from §2.1 memory retrieval is
   **out of scope** for Stage 2A PR-2b verification — that's the
   §10.7.A vs §2.1 boundary question for v5.8.

### C78 (candidate) — testing in production contaminates the substrate

**Discovered:** 2026-05-11, during Stage 2A PR-2b iteration 2 testing.

**Finding:** Behavioral intelligence systems testing in production
contaminates the substrate's understanding of the user. Across three
Phase A retest turns (05:36, 21:16, 22:02, 23:59 UTC), the founder
sent variants of "I'm thinking of pulling an all-nighter to finish
this project tonight." Each turn was persisted to `messages` with no
distinguishing marker. The substrate now treats those test inputs as
**real stated intentions**: Seven's most recent response opened with
"You've decided to pull an all-nighter tonight, as you've mentioned a
few times today" — pure memory-retrieval content, treating synthetic
test phrasings as genuine user data.

Every additional test turn deepens the contamination:
- `messages.metadata` doesn't mark test-mode origin
- Semantic memory retrieval surfaces test phrasings as "relevant past context"
- Pattern detection (when running) would include test inputs in 90-day windows
- `identity_model` updates (when running) would weight test inputs as real signal
- `cron-identity-model.communication_style` would learn from test interactions

**Resolution path:** a `test mode` flag at the chat function level —
passed via header (`x-seven-test-mode: 1`) or query param — should mark
generated messages with `metadata.test_mode = true` and exclude them
from:
- Memory retrieval (`match_memories` RPC + `recentMems` queries)
- Pattern detection inputs (`cron-pattern-detection`'s decision/outcome/
  memory data fetches)
- Identity model updates (`cron-identity-model`)
- Feedback signal aggregation (`cron-identity-model` reading
  `feedback_signals`)

Without this, founders and engineers cannot test substrate response to
synthetic situations without polluting their own behavioral data —
making the substrate worse than it would be if testing happened on
isolated accounts.

**Engineering implications:**

1. Stage 2A test history needs a one-time cleanup (DELETE founder's
   2026-05-10/11 test turns from `messages`) to restore a clean baseline
   before further testing. **Awaiting explicit founder approval; not
   executed yet.**
2. Stage 2A's synthetic pattern seeds (in `behaviour_patterns`) have a
   `_synthetic = true` marker via `trigger_conditions` JSONB — that's
   the right pattern. Apply the same discipline to test messages.
3. Long-term: test mode is an v5.8 architectural addition, not a fix
   we can backport surgically in 2A. **Deferred to v5.8 architecture
   review** alongside C77.

**Linked C77 dependency:** C77's resolution ("flag governed vs
ungoverned surface origin in persisted output") naturally extends to
C78's resolution ("flag test-mode origin in persisted input"). Both
require persistence-layer metadata that distinguishes data provenance.
A v5.8 design session should address both together.

### C79 (candidate) — extraction pipeline absorbs test inputs as real identity data

**Discovered:** 2026-05-11, during Stage 2A PR-2b clean-slate scoping.

**Finding:** the chat function's tier-2 / tier-3 memory-extraction
pipeline (fact extractor, memory persistence, importance scorer) does
not distinguish hypothetical phrasings from declarative commitments.
Within hours of starting Phase A testing today, the substrate had:

- 4 polluted rows in `memories_structured` (verbatim test phrasings
  stored as `memory_type='chat'`, `importance=5`)
- **2 polluted facts in `memory_facts` (status='active', confidence=0.8):**
  - `user.goal = "finish this project tonight"` (category=goals)
  - `user.action = "pulling an all-nighter"` (category=habits)
- 4 trace rows in `memory_traces` (access logs)

The two `memory_facts` rows are the most concerning. They were
extracted from messages like *"I'm thinking of pulling an all-nighter
to finish this project tonight"* — a hypothetical/exploratory framing.
The extractor treated this as a **declarative statement of habit and
goal**, persisted as active facts with 0.8 confidence, and injected
them into the system prompt's IDENTITY GROUNDING block on every
subsequent chat turn (line ~2000-area in `chat/index.ts`,
`memory_facts WHERE status='active' AND valid_until IS NULL`).

So for the entire period between this morning's first test and the
clean-slate operations: every chat turn — including unrelated ones —
told Seven that the founder's user-level habits include "pulling an
all-nighter" and goals include "finish this project tonight." This is
**substrate-level identity pollution** propagating from test inputs
in <1 turn cycle: `messages` → `memories_structured` (importance scorer)
→ `memory_facts` (tier-2/3 extractor) → `system_prompt.IDENTITY_GROUNDING`
on the very next turn.

This compounds **C78** (test-mode flag at persistence layer) with a
second independent concern: even when an input is real-mode, the
fact extractor should not treat hypothetical phrasings as declarative.

**v5.8 design requirements:**

1. **C78 test-mode flag must propagate through the extraction pipeline.**
   Tier-2/3 extractors (in `chat/index.ts:1460-1820` area —
   factExtract, memExtract, decExtract, outcomeExtract, sitExtract,
   resolveExtract paths) must check `metadata.test_mode` on the source
   message and **skip extraction entirely** for test inputs. Without
   this, even a perfect `messages.metadata.test_mode=true` flag at the
   persistence layer doesn't stop the substrate from extracting test
   inputs as facts.

2. **Hypothetical-vs-declarative classification (separate quality
   concern).** Fact extraction should distinguish:
   - Hypothetical: *"I'm thinking of...", "Should I...", "I might...",
     "What if I..."*
   - Declarative: *"I plan to...", "I've decided to...", "I do this..."*
   Only declarative phrasings should produce active facts in
   `memory_facts`. This is independent of test mode — it's a
   precision-of-extraction concern that affects real-mode inputs too.
   Real users frame intentions hypothetically more often than not;
   the current extractor over-claims.

3. **Audit trail on extracted facts.** Every fact row should have a
   `source_message_id` AND a `source_phrasing_type` (hypothetical /
   declarative / observed-behaviour / user-stated-belief) so the
   Memory Surface §10.13.4 can show the user what was extracted and
   why, with the ability to dispute the extraction. The current
   `feedback_signals` infrastructure (Stage 2A PR-1) extends naturally.

**Linked C77/C78 dependency:** all three findings (C77 governed-vs-
ungoverned surface origin, C78 test-mode flag at persistence, C79
extraction pipeline test-mode propagation + hypothetical detection)
share a common architectural root: the substrate's data-provenance
metadata is too sparse. Every persisted unit (message, memory, fact,
trace, audit row) needs richer provenance: who generated it, in what
mode, from what source phrasing, with what governance gate. The v5.8
design session should treat these three as one design surface.

**v5.8 design item — memory_traces test_mode propagation (banked
2026-05-13):** memory_traces lacks a metadata column, so C78's
test_mode flag cannot propagate to traces. C78's Q5 deferred this by
design. v5.8 should either add a metadata column + thread test_mode
through the chat function's memory_traces insert (line 1810), OR fold
test_mode into strategy_history as a top-level key. Either path
enables full-stack test-mode isolation.

**Engineering implications for Stage 2A:**

- Stage 2A PR-2b acceptance criteria unchanged — gate-chain isolation
  test is the verification target. Clean-slate operations on 2026-05-11
  removed today's test pollution; future tests should be one-shot to
  minimize re-pollution while v5.8's test-mode flag is unbuilt.
- Until v5.8 ships test-mode + extraction discipline, **engineering
  testing of Seven Mynd's substrate must happen on a non-production
  test account** or with one-shot tests followed by immediate cleanup.
  Founder's primary account should not be used for repeated synthetic
  testing.

### C80 (candidate) — document-process writes orphan facts (no provenance link)

**Discovered:** 2026-05-12 during Phase 1A forensic investigation
into 8 unexplained `memory_facts` rows (UK Ltd-company compliance
costs, founder account, 2026-05-11 14:08:50 UTC). Writer was
positively identified as `document-process` via payload fingerprint
(confidence=0.7 + source_type="inferred" + category="cost" — unique
to that writer; chat uses 0.8/0.9, Vault UI uses 1.0/"corrected").

**Finding:** `document-process/index.ts:328` inserts `memory_facts`
rows with `evidence_count = 1` (hardcoded literal) but **never writes
the corresponding `memory_fact_evidence` rows** that would link each
fact back to its source document chunk in `memories_structured`.
Confirmed empirically: `memory_fact_evidence` has zero rows linked to
the 8 facts. By contrast, `document-process` DOES write source
provenance for chunks (`memories_structured.source_message_id =
'doc_${document_id}_chunk_${i}'`, line 305) and decisions
(`decisions.source_message_id = 'doc_${document_id}_decision'`, line
351). The fact-write path simply omits the evidence-row insert.

Result: every fact written by `document-process` is orphan in the
provenance graph. Cannot trace facts back to source documents from
the database alone. The `evidence_count = 1` value is a misleading
literal, not a count of actual evidence rows.

**Affected surfaces:**

- **Memory Surface §10.13.4 — "Where did Seven learn this?"** UX
  cannot show the source for any document-derived fact. The Memory
  panel will display orphan facts with no traceable origin, breaking
  the audit-trail promise of §10.13.
- **Fact-dispute flow.** Without evidence linkage, a user disputing
  a fact has no way to see the source document/chunk that produced
  it. This blocks Memory Surface §10.13.6 (audit panel) for any
  document-derived fact.
- **C79 v5.8 design.** C79's "Audit trail on extracted facts"
  requirement (source_message_id + source_phrasing_type on every
  fact row) needs to extend to document-derived facts too. C80 is
  the document-process-specific instance of the C79 provenance
  problem.

**Fix:** `document-process` should, immediately after each
`memory_facts.insert`, also insert a `memory_fact_evidence` row
linking the returned fact_id to the chunk's `memories_structured.id`.
Or restructure the doc-process pipeline to write facts via a
canonical helper that owns both inserts atomically.

**Effort estimate:** medium. The chunk → fact linkage is not 1:1 in
the current pipeline (doc-process produces a flat list of facts +
chunks; figuring out which chunk supports which fact requires either
re-running the LLM extraction with per-fact source-chunk attribution
OR a post-hoc nearest-chunk match by embedding). Defer to v6
document-process refactor where the per-fact source attribution can
be designed in from the start.

**Action:** captured here for v5.8 design session alongside C79. Not
fixed in Phase 1A — purely an observability gap, not a security
finding.

### C81 (candidate) — audit_log silent since 2026-05-05 (recently broken, not legacy)

**Discovered:** 2026-05-12 during Phase 1A diagnostic. Empty
`audit_log` query on 2026-05-11 (zero rows for the entire day despite
document processing, RPC deploy, and Memory Surface feedback writes)
prompted the diagnostic.

**Diagnostic result:**

```
most_recent_audit:  2026-05-05 14:28:46 UTC
earliest_audit:     2026-04-17 13:24:13 UTC
total_rows:         78
rows since May 1:   12 (all between May 1 and May 5)
rows since Apr 1:   78 (= all rows in the table)
```

**Verdict: recently broken, not legacy.** `audit_log` was actively
being written from 2026-04-17 through 2026-05-05 (78 rows in ~18
days, ~4 rows/day). **Writes stopped abruptly on 2026-05-05.** No
audit rows have been written in the 7 days since, despite:

- 2026-05-05 PR #41 (document staging UX rebuild) ship
- 2026-05-08 Memory Surface §10.13.1 feedback unblocker (PRs #47,
  #48, #49) — Memory Surface §10.13.6 audit panel design EXPECTS
  feedback-write actions to land in `audit_log`
- 2026-05-09 Stage 2A-prereq (PRs #50, #51, #52, #53)
- 2026-05-09 Stage 2A PR-1 (schema migration to production)
- 2026-05-09 Stage 2A PR-2a (`record_pattern_surfacing` RPC deploy —
  this RPC's design explicitly writes to `audit_log` per §10.7.A)
- 2026-05-11 PR #64 (Stage 2A PR-3 settings toggle)
- 2026-05-11 document-process invocation (the 8 compliance facts)

The 2026-05-05 cutoff correlates with PR #41 ship — investigate
whether something in that PR (or its post-merge schema/permissions
state) broke `audit_log` writes silently.

**Hypotheses (to investigate in Phase 1B/1C):**

1. **RLS regression.** `audit_log` has RLS enabled with 1 policy
   (confirmed via `pg_class` scan). If the policy's `WITH CHECK`
   clause was tightened around 2026-05-05 in a way that excludes
   the writers' role (e.g., now requires `auth.uid() = user_id` for
   a write that runs as service_role with no JWT), writes would
   fail silently because most callers don't surface insert errors.
2. **Schema drift.** A column was added/renamed/CHECKed in a way
   that breaks the writers' `INSERT (...)` shape, and the failure
   is being swallowed.
3. **Code regression.** A helper that wraps `audit_log.insert(...)`
   was refactored on 2026-05-05 in PR #41 and now no-ops silently.
4. **Audit writes were never wired up after PR-2a's RPC pattern.**
   The `record_pattern_surfacing` RPC was designed to write
   `audit_log` rows but may have shipped without that path. (Less
   likely — predates the 2026-05-05 cutoff in design intent.)

**Affected surfaces:**

- **Memory Surface §10.13.6 audit panel.** UX cannot be built — no
  data to display.
- **§10.7.A Proactive Surfacing observability.** The gate-chain
  audit row is part of the verification criteria for Stage 2A PR-2b.
  If audit writes are silently failing across the board,
  `record_pattern_surfacing`'s audit row would also fail —
  potentially explaining part of the Stage 2A PR-2b verification
  difficulty (though C77/C78 are the main blockers).
- **Phase 1 security audit trail.** No audit record of any sensitive
  action since 2026-05-05. Six days of writes, RPC calls, and
  Memory Surface feedback have produced zero audit rows. This is a
  compliance-flavoured gap.

**Phase 1A interaction:** C81 does NOT block the RLS migrations M1/
M2/M3. But it does suggest that when M3 enables RLS on
`memory_fact_evidence`, we should pre-flight whether `audit_log`'s
RLS state (already enabled, 1 policy) is the same kind of writer-
excluding policy. If so, the same fix pattern can apply.

**Action:** Phase 1B/1C investigation. Pull PR #41's diff against
the `audit_log` writers (find every `from("audit_log").insert(...)`
in the codebase, compare against the table schema as of 2026-05-04
vs current). Captured here so it doesn't get lost in the Phase 1A
migration work.

---

## Deferred deliberate cutovers

These are bundles intentionally held off `main` until they have a
deliberate production deploy moment:

- **Cron infrastructure → main:** PRs #49 (lessons C70/C71), #50 (cron
  column-drift fix), #51 (pg_cron setup script), #52 (PHASE_BOARD/
  SESSION_LOG bootstrap), #53 (lesson C72), plus C73 + this PHASE_BOARD
  update + Stage 2A PR-1 once it lands. As of 2026-05-09 develop is 10
  commits ahead of main, status `diverged`. The cutover happens after
  Stage 2A produces a stable surfacing baseline AND the C72-class audit
  passes for cron-pattern-detection on real data. Verification before
  cutover: re-run the manual cron trigger, confirm function still
  returns 200, confirm `behaviour_patterns` writes succeed.

---

## Parallel track — Phase 1 Security Audit

Per `SECURITY_AUDIT_PLAN.md`, security runs in parallel with feature
work. New code must pass the §10 security checklist as it ships.

| Sub-phase | Status |
|---|---|
| **1A — Supabase advisor sweep** | **ELEVATED PRIORITY (3 ERROR-level RLS findings discovered during Stage 2A PR-1 smoke check 2026-05-09)** |
| 1B — RLS audit (every table) | partial — confirmed RLS-enabled state of touched tables in Memory Surface + 2A-prereq recon; full sweep pending |
| 1C — Edge Function review | partial — cron-pattern-detection column-drift surfaced + fixed in 2A-prereq (lesson C72); other functions not audited |
| 1D — Frontend security review | not started |
| 1E — Dependency vulnerability scan | not started |
| 1F — Auth + session review | not started |
| 1G — Pen test prep | not started (pre-launch only) |

### Phase 1A — critical findings to investigate FIRST (per guard 2026-05-09)

The `get_advisors` security scan run during Stage 2A PR-1 surfaced
**3 ERROR-level RLS findings + 23 WARN-level findings** (24 advisories
total — `function_search_path_mutable` ×10, `anon_security_definer_function_executable` ×6,
`authenticated_security_definer_function_executable` ×6, `auth_leaked_password_protection` ×1,
plus the 3 ERRORs below). All are pre-existing (not introduced by the
2A-PR-1 migration), but the ERROR-level RLS findings are public-launch
blockers and the `public.users` finding may be data-exposure-now-active
depending on table contents.

**Critical findings to investigate FIRST in 1A:**

1. **`public.users` — RLS disabled.** Highest urgency. Verify:
   - Is this a Supabase-auto-created mirror table, OR a custom user
     table? The latter is much more concerning.
   - What columns/data are actually in it? (`SELECT column_name FROM
     information_schema.columns WHERE table_schema='public' AND
     table_name='users'`).
   - If it contains user PII (email, full name, phone, etc.) and RLS
     is off, every authenticated user with API access can read every
     other user's row right now. ERROR-critical.
   - If it's auto-created and only contains opaque IDs, lower urgency
     — but still needs RLS for defense-in-depth.

2. **`public.memory_fact_evidence` — RLS disabled** on user-scoped
   evidence rows. Cross-user leakage risk: every authenticated user
   could query any other user's memory evidence today. Immediate
   public-launch blocker.

3. **`public.memories_raw` — RLS disabled** on user-scoped memory data.
   Same cross-user leakage risk. The most personal data surface in
   Seven Mynd. Immediate public-launch blocker.

**Schedule:** Phase 1A session within 48 hours of Stage 2A PR-2 ship.
Until 1A is sub-phase-clean, no marketing push, no broader user
onboarding. Existing 3 active users + founder account is the bound.

Other Phase 1A WARN-level items (search_path, SECURITY DEFINER,
leaked-password protection) can be triaged in the same session but
are second-priority to the 3 ERROR-level RLS findings.

---

## Recently shipped (last 7 days)

- 2026-05-09 — Stage 2A-prereq closed:
  - PR #50: cron-pattern-detection column-drift fix (`text_snapshot`)
  - PR #51: `pg_cron` setup script for `cron-pattern-detection`
  - PR #52: PHASE_BOARD.md + SESSION_LOG.md bootstrap
  - PR #53: lesson C72 (schema-leads-query extends to scheduled jobs)
  - Function deployed (v19), pg_cron scheduled, manual trigger returns
    200, function logic verified end-to-end
  - Synthetic patterns seeded for Stage 2A verification
- 2026-05-09 — PR #46 (Memory Surface §10.13.1) merged to **main**.
  Live on sevenmynd.com.
- 2026-05-08 — Memory Surface §10.13.1 feedback unblocker:
  - PR #47: `feedback_signals_surface_check` migration (admit `'memory'`)
  - PR #48: hook fix (`use-identity-card-data.ts` writes `surface: "memory"`)
  - PR #49: lessons C70 + C71 (LESSONS.md created)
- 2026-05-05 — Phase 0.C Stage 1 closed (PR #41 — document staging UX
  rebuild). RDD H1-H6 metrics computable.

## Lessons captured this cycle

- **C70** — CHECK constraint allowlists invisible via `information_schema.columns`;
  query `pg_constraint` (LESSONS.md, merged via PR #49)
- **C71** — Postgres data-modifying CTEs cannot see each other's effects on
  the same target table due to MVCC snapshot isolation (LESSONS.md, merged via PR #49)
- **C72** — Schema-leads-query (C29/C63) extends to scheduled jobs and
  Edge Functions; column drift in unrun code is invisible until first
  execution (LESSONS.md, merged via PR #53)
- **C73** — `vault.update_secret()` inside an unreferenced CTE silently
  no-ops because PostgreSQL eliminates unreferenced CTEs. Vault
  mutations must be standalone statements. (LESSONS.md, in this PR)
- **C74 (candidate, formalize when PR-5 lands and verifies):** when
  seeding test data into a production table that has a cron consumer,
  the cron MUST be aware of test-data markers. Otherwise the cron's
  data-lifecycle logic (upsert, retire, archive, ALL `.neq/.lt/.gt`
  filters) silently corrupts the test data on its next scheduled run.
  Discovered 2026-05-09 when the synthetic Stage 2A seeds would have
  been retired by `cron-pattern-detection` stale-retire query on the
  06:00 UTC firing. Engineering rule:
  1. Read the cron's full data-modification path (upsert + retire/
     archive + ALL `.neq/.lt/.gt` filters) before seeding.
  2. Confirm the test marker excludes test rows from EVERY modification
     path the cron exercises.
  3. If exclusion isn't possible, pause the cron during the test window
     and re-schedule after cleanup.
  4. Document the test/cron interaction in PHASE_BOARD or runbook so
     future operators understand why the cron is paused.

## Deferred tech-debt

### C82 (candidate) — Gate 4a toggle is structurally broken in chat function

**Discovered:** 2026-05-13 during Scenario 2 v76 verification gate-chain
diagnosis.

**Finding:** the §10.7.A 5-gate chain's toggle gate (Gate 4a, at
`supabase/functions/chat/index.ts:2459-2465`) reads
`identity?.proactive_surfacing_enabled !== false` from the `identity`
object. But the identity-profiles SELECT at line 1972 **does NOT
include `proactive_surfacing_enabled` in its column list** — the SELECT
fetches only `display_name, self_role, self_company, self_city, goals,
focus_areas`. So `identity.proactive_surfacing_enabled` is always
`undefined`, and `undefined !== false` evaluates to `true` — **the
gate always passes regardless of the user's actual setting**.

**Impact:** PR-3's Settings toggle ("Bring up patterns before answering
when relevant") has zero effect on the gate chain. A user who toggles
the setting OFF still gets pattern surfacing (subject to the other
gates). The toggle works as a UI element + database write but is
disconnected from the surfacing decision.

**Fix:** one-line addition to the identity_profiles SELECT at
line 1972:
```typescript
.select("display_name, self_role, self_company, self_city, goals, focus_areas, proactive_surfacing_enabled")
```
Then Gate 4a will read the actual value.

**Effort:** ~5 min implementation, but bundles with a chat function
redeploy and re-verification. Defer until next chat function deploy
cycle to avoid a one-line-change-only redeploy.

**Action:** captured here for the next Stage 2A maintenance pass.
Not blocking current Stage 2A PR-2b verification (which targets the
gate-chain plumbing end-to-end, not the toggle's UX effect).

### C83 — Embedding pre-filter calibration (applied 2026-05-13)

**Discovered:** 2026-05-13 during Stage 2A PR-2b verification on v76.

**Finding:** Gate 3a's embedding pre-filter floor of 0.4 was inherited
from generic guidance; not empirically validated against
text-embedding-3-large + long-description-vs-short-query pairs.
Production observation via iter-2 instrumentation: legitimately-related
patterns score 0.05-0.20 cosine. Both synthetic patterns scored
0.066-0.079 against the trigger phrase "I'm thinking of pulling an
all-nighter to finish this project tonight" despite clear semantic
match — confirmed by `[PATTERN_RELEVANCE] preFiltered=0/2 top_sim=n/a
all_sims=[0.079, 0.066]` log line from v76 chat function.

**Fix applied:** Lowered floor 0.4 → 0.05 (`chat/index.ts:1100`).
Pre-filter retained as cost guard. Top-3 cap intact for cost control
at high N. Companion stale-comment sync at lines 1091, 1105, 2492.

**Future watch:** If pattern count per user grows to 50+, revisit
floor + cap empirically. Current calibration is for the N=2-20 range.
Distribution of legitimate-related cosine values may differ at higher
N or with different pattern description structures (shorter, more
keyword-dense descriptions may score higher; statistics-heavy
descriptions like Pattern A's pre-edit form may score lower).

### C84 — OpenAI json_object mode + verbose error handlers (applied 2026-05-13)

**Discovered:** 2026-05-13 during Stage 2A PR-2b verification on v77,
after the C83 calibration unblocked Gate 3a (top_sim=0.503 passed the
new floor). Dashboard log surfaced: `[PATTERN_RELEVANCE] OpenAI 400 —
fail closed`. The response body was swallowed by the prior catch
handler — required a diagnostic edit before the root cause was visible.

**Two findings, both fixed in the same commit:**

1. **OpenAI `response_format: { type: "json_object" }` mode requires
   the literal word "json" (case-insensitive) somewhere in the
   `messages` array.** Pre-flight 400 if absent — even with a valid
   JSON-shaped response schema embedded in the prompt. Discovered when
   v77's Gate 3b LLM scoring call at `chat/index.ts:1135` failed for
   this reason despite the systemPrompt at line 1128 showing
   `{"scores":[...]}` as the response schema without using the word
   "JSON" elsewhere. Fix: added literal "JSON" to the systemPrompt
   (`Return ONLY a JSON object: {...}`).

2. **Silent error handlers swallow diagnostic information.** The
   prior `[PATTERN_RELEVANCE] OpenAI ${status} — fail closed` log
   line at `chat/index.ts:1153` didn't include statusText or response
   body. Diagnosing required adding a one-edit diagnostic before
   fixing the root cause. **Engineering rule:** any error path that
   fail-closes on a non-2xx HTTP response MUST log the response body
   (truncated to ~500 chars) alongside the status code. Future audits
   of other OpenAI catch handlers in `chat/index.ts` (lines 493, 931,
   1608, 1746, 1793, 1854) should apply the same pattern — out of
   scope for this fix, banked for next maintenance pass.

**Fix applied:** chat/index.ts:1128 (systemPrompt with JSON literal) +
chat/index.ts:1152-1158 (error handler captures body).

### Pre-existing lint debt (logged 2026-05-12)

`pnpm lint` exits 1 with 25 problems (8 errors + 17 warnings) across
`src/` and `tailwind.config.ts`. Surfaced during C78 chat function
pre-commit gates 2026-05-12. **C78 introduced zero new lint issues** —
all 25 problems predate this work. Production chat function v74 (and
now v75) was deployed with the lint state already in this condition;
the lint bar has effectively been bypassed at deploy time for an
unknown duration prior to 2026-05-12.

**Errors (8):**
- `src/components/ui/command.tsx:24` — `@typescript-eslint/no-empty-object-type`
- `src/components/ui/textarea.tsx:5` — `@typescript-eslint/no-empty-object-type`
- `src/hooks/use-deepgram-dictation.ts:60,137,199` — `no-empty` (×3)
- `src/hooks/use-frame-capture.ts:46` — `prefer-const` (×2)
- `tailwind.config.ts:116` — `@typescript-eslint/no-require-imports`

**Warnings (17):** mostly `react-refresh/only-export-components` on
shadcn primitives (×10 across `button.tsx`, `badge.tsx`, `form.tsx`,
`navigation-menu.tsx`, `sidebar.tsx`, `sonner.tsx`, `toggle.tsx`,
`AlwaysListeningContext.tsx`, `AuthContext.tsx`), plus
`react-hooks/exhaustive-deps` (×2 in `LiveScreenShare.tsx` /
`LiveVideoFeed.tsx`), plus unused-eslint-disable directives (×5 in
`PageError.tsx`, `AlwaysListeningContext.tsx`, `Splash.tsx`,
`PorcupineWakeWordService.ts`).

**GH issue not filed:** `gh` CLI not installed in this environment as
of 2026-05-12. Logged here pending gh availability for formal issue;
guard direction was Option 3 of the C78 deploy report (defer rather
than detour to install gh at the verification finish line).

**Fix path:** 8 errors are mechanical 1-2 line fixes (~30-60 min
total). Warnings are triage-required — some Fast Refresh hints on
shadcn primitives may be acceptable given the library's design
(utility re-exports alongside components is a shadcn pattern).
Contained cleanup PR when bandwidth allows.

## Open blockers

- Architecture .docx cross-reference rot at line 1567 — flagged to
  founder for Word edit. Independent of any active PR.
- *(2B parallel sub-task, not blocking 2A)* GPT-4o returns 0 patterns
  on real data via cron-pattern-detection. Tracked under "Deferred to
  Stage 2B" above.

---

*Updated: 2026-05-09 mid-session. Next session entry update at the next
session-end SESSION_LOG handoff.*
