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
- `pg_cron` job `cron-pattern-detection-daily-0600-utc` scheduled
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
- PR-5: Smoke fixture for verification — partially satisfied by the
  synthetic seed already on production

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
| 1A — Supabase advisor sweep | not started |
| 1B — RLS audit (every table) | partial — confirmed RLS-enabled state of touched tables in Memory Surface + 2A-prereq recon; full sweep pending |
| 1C — Edge Function review | partial — cron-pattern-detection column-drift surfaced + fixed in 2A-prereq (lesson C72); other functions not audited |
| 1D — Frontend security review | not started |
| 1E — Dependency vulnerability scan | not started |
| 1F — Auth + session review | not started |
| 1G — Pen test prep | not started (pre-launch only) |

Recommend a 1A advisor sweep next session — fast, finds real issues, and
running a fresh advisor scan is autonomous per CLAUDE.md §8.

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

## Open blockers

- Architecture .docx cross-reference rot at line 1567 — flagged to
  founder for Word edit. Independent of any active PR.
- *(2B parallel sub-task, not blocking 2A)* GPT-4o returns 0 patterns
  on real data via cron-pattern-detection. Tracked under "Deferred to
  Stage 2B" above.

---

*Updated: 2026-05-09 mid-session. Next session entry update at the next
session-end SESSION_LOG handoff.*
