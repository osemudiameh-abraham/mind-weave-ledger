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

- **PR-A** — Stage 2A schema migration: `identity_profiles.proactive_surfacing_enabled`
  + `behaviour_patterns.{last_surfaced_at, surfacing_count, dismissed_at,
  dismissed_reason}` + supporting index. **Open, awaiting guard review.**
- Synthetic patterns seeded for the founder account (2 rows, scan_id =
  `synthetic_2A_smoke_test`, `trigger_conditions._synthetic = true`).
  Cleanup: DELETE after Stage 2A verification passes.

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

## Open blockers

- Architecture .docx cross-reference rot at line 1567 — flagged to
  founder for Word edit. Independent of any active PR.
- *(2B parallel sub-task, not blocking 2A)* GPT-4o returns 0 patterns
  on real data via cron-pattern-detection. Tracked under "Deferred to
  Stage 2B" above.

---

*Updated: 2026-05-09 mid-session. Next session entry update at the next
session-end SESSION_LOG handoff.*
