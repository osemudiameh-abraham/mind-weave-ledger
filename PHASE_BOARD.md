# PHASE_BOARD.md — Seven Mynd Current Phase Board

This file is read at the start of every Claude Code session per CLAUDE.md
§15. It states the current phase, what's done, what's pending, what's
blocked. Update at session end as part of the SESSION_LOG handoff.

---

## Current phase

**Phase 0.C — Stage 2 (UI surfacing of substrate intelligence)**

Stage 1 closed 2026-05-05 with PR #41 (per architecture v5.7 §14 build
history). Stage 2 priorities per architecture line 1567:

1. Proactive surfacing in chat (§10.7.A) — **in progress**
2. Decision Moments (§10.7.B) — pending Stage 2 mid-cycle
3. Voice-mode parity for new surfaces — pending
4. Memory Surface (§10.13) full build — Identity Card panel shipped
   2026-05-08 (PR #46/47/48 + lessons #49); remaining panels pending
   §10.13.2-10.13.6
5. Hybrid background + live location subsystem (§17.6.A) full ship —
   pending

## Current sub-stage

**Stage 2A-prereq — fix cron-pattern-detection + schedule it**

The chat function already has a baseline proactive-surfacing prototype
(chat/index.ts:2271-2336), but the substrate it depends on
(`behaviour_patterns`) is empty because:

- `cron-pattern-detection` Edge Function has column-drift bugs
  (`decisions.title`, `outcomes.reflection` — neither column exists).
- The function isn't scheduled in pg_cron (only `reminders-fire-every-
  minute` is currently scheduled).

Without seeded patterns, Stage 2A's gates would gate emptiness — a
§1.5 Substrate Visibility violation. Hence the prereq.

### 2A-prereq PRs (in flight)

- **PR-prereq-1** — `fix/cron-pattern-detection-column-drift` —
  4-line code fix correcting `decisions.title` → `text_snapshot` and
  `outcomes.reflection` → `text_snapshot`. Awaiting founder approval
  for `deploy_edge_function` to production (per CLAUDE.md §8).
- **PR-prereq-2** — `chore/schedule-pattern-detection-cron` —
  setup script `supabase/migrations/setup_pattern_detection_cron.sql`
  documenting vault seeding + scheduling (manual, founder-run, follows
  the `setup_reminders_fire_cron.sql` convention).
- **PR-prereq-3** — `chore/2a-prereq-docs` (this PR) — PHASE_BOARD.md
  + SESSION_LOG.md.

Architecture cross-reference rot at line 1567 (mislabels §10.7.A vs
§10.7.B): flagged to founder. Founder edits the .docx in Word
directly per their explicit out (.docx repacking is risky for a
one-phrase change).

### 2A-prereq smoke gate (must pass before Stage 2A starts)

- [ ] PR-prereq-1 merged to develop
- [ ] cron-pattern-detection deployed (Supabase MCP `deploy_edge_function`)
- [ ] PR-prereq-2 merged to develop
- [ ] Vault entries `pattern_detection_url` + `pattern_detection_cron_secret`
      seeded
- [ ] Setup script run manually (or via `execute_sql` MCP) by the
      founder; cron job appears in `cron.job`
- [ ] Manual curl trigger writes ≥1 row to `behaviour_patterns` for an
      active user
- [ ] PR-prereq-3 merged to develop

## Stage 2A scope (after prereq smoke gate passes)

5 sub-PRs per the 2A review packet (2026-05-09):

- PR-1: Schema migration — `identity_profiles.proactive_surfacing_enabled`
  + `behaviour_patterns.{last_surfaced_at, surfacing_count, dismissed_at,
  dismissed_reason}` + index
- PR-2: Chat function gate refinements (confidence ≥ 0.65, hybrid LLM
  relevance scoring, 7-day cooldown, daily cap of 3, per-turn cap of 1,
  fail-closed on relevance LLM failure)
- PR-3: Settings toggle UI ("Bring up patterns before answering when
  relevant")
- PR-4: `dismiss_pattern` RPC + frontend hook (data layer; UI consumed
  in 2C)
- PR-5: Smoke fixture for verification

## Deferred to Stage 2B

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

## Parallel track — Phase 1 Security Audit

Per `SECURITY_AUDIT_PLAN.md`, security runs in parallel with feature
work. New code must pass the §10 security checklist as it ships.

| Sub-phase | Status |
|---|---|
| 1A — Supabase advisor sweep | not started |
| 1B — RLS audit (every table) | partial — confirmed RLS-enabled state of touched tables in Memory Surface + 2A-prereq recon; full sweep pending |
| 1C — Edge Function review | partial — cron-pattern-detection bug surfaced in 2A-prereq recon (independent of audit) |
| 1D — Frontend security review | not started |
| 1E — Dependency vulnerability scan | not started |
| 1F — Auth + session review | not started |
| 1G — Pen test prep | not started (pre-launch only) |

Recommend a 1A advisor sweep next session — fast, finds real issues, and
running a fresh advisor scan is autonomous per CLAUDE.md §8.

---

## Recently shipped (last 7 days)

- 2026-05-08 — Memory Surface §10.13.1 (Identity Card) feedback
  unblocker:
  - PR #47: `feedback_signals_surface_check` migration (extend allowlist
    to admit `'memory'`)
  - PR #48: hook fix (`use-identity-card-data.ts` writes
    `surface: "memory"`)
  - PR #49: lessons C70 + C71 (LESSONS.md created, awaiting merge)
  - PR #46: Memory Surface (develop → main) — **awaiting founder cutover**
- 2026-05-05 — Phase 0.C Stage 1 closed (PR #41 — document staging UX
  rebuild). RDD H1-H6 metrics computable.

## Lessons captured this cycle

- C70 — CHECK constraint allowlists invisible via `information_schema.columns`;
  query `pg_constraint` (LESSONS.md, awaiting PR #49 merge)
- C71 — Postgres data-modifying CTEs cannot see each other's effects on
  the same target table (LESSONS.md, awaiting PR #49 merge)
- C72 — *(pending)* Schema-leads-query (C29/C63) extends to scheduled
  jobs. Column drift in unrun crons is invisible until first scheduled
  run. Will land at session end alongside the 2A-prereq close.

## Open blockers

- `cron-pattern-detection` not producing data — being addressed by the
  three 2A-prereq PRs.
- Architecture .docx cross-reference rot at line 1567 — flagged to
  founder for Word edit.

---

*Updated: 2026-05-09. Update this file at session end with current
phase, sub-stage progress, and any blocker shifts.*
