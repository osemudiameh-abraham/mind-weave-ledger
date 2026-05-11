# SESSION_LOG.md — Seven Mynd Engineering Session Handoffs

Append-only log of Claude Code engineering sessions. Per CLAUDE.md §16,
each session ends with an entry written by the standing-down builder
so the next session has the context to pick up cleanly.

Format per entry:

- **Date + duration:** session window
- **Phase + sub-phase:** where in the architecture roadmap
- **What was done:** PRs opened/merged, files changed, schemas migrated,
  edge functions deployed, lessons captured
- **What was learned:** new lessons (C70+ in LESSONS.md), new failure
  modes, drift caught
- **What's blocked:** dependencies, founder approvals pending, side
  findings not yet acted on
- **What next session should pick up:** the concrete first action

Entries are dated descending — newest at top.

---

## 2026-05-09 → 2026-05-11 — Stage 2A Proactive Surfacing implementation cycle

**Phase + sub-phase:** Phase 0.C Stage 2 — Stage 2A (Proactive Surfacing
§10.7.A gates). 2A-prereq closed, PR-1 schema applied, PR-2b deployed
to production but **not yet verified**.

**What was done:**

1. **Stage 2A-prereq closed.** Cron-pattern-detection column-drift fix
   (PR #50), pg_cron schedule (PR #51, then paused 2026-05-09), docs
   bootstrap (PR #52), lesson C72 (PR #53). All merged to develop.
   `cron-pattern-detection` deployed (v19), then paused via
   `cron.unschedule` pending Stage 2A PR-5's `_synthetic`-aware patch.
2. **Stage 2A PR-1 (schema) applied to production** 2026-05-09 via
   `apply_migration`: 5 new columns + partial index on
   `identity_profiles` and `behaviour_patterns`. PR #55 stays open as
   audit trail. All post-apply smoke checks passed.
3. **Stage 2A PR-2a (`record_pattern_surfacing` RPC) applied to
   production** 2026-05-09 via `apply_migration`. PR #57 stays open as
   audit trail. Function permissions verified: authenticated EXECUTE
   granted, anon REVOKEd, ownership check works (42501 on cross-user).
4. **Stage 2A PR-2b iteration 1 (chat function gate refinements)
   deployed to production** 2026-05-09 → 2026-05-10 as chat v73 via
   Supabase CLI (file size exceeded MCP `deploy_edge_function` payload
   ceiling — C76 candidate). PR #58 stays open as draft.
5. **Phase A end-to-end test 2026-05-10** revealed iter-1's passive
   listing path produced ungoverned pattern surfaces — main LLM wove
   pattern descriptions into prose without going through the §10.7.A
   gate audit/cooldown/count machinery. Guard option (a) directed
   removing the passive listing entirely.
6. **Stage 2A PR-2b iteration 2 deployed to production** 2026-05-10 as
   chat v74: removed passive listing, added observability log lines at
   every gate-chain decision point.
7. **Phase A retest 2026-05-10 + 2026-05-11 (3 turns total)** revealed
   v74 STILL produces pattern-aware prose without `:::pattern :::`
   callout. Diagnosis: §2.1 memory retrieval is the dominant ungoverned
   path — surfacing prior pattern-laden responses + extracted facts on
   subsequent turns. The §10.7.A gate chain may or may not be working;
   we cannot distinguish from current observation because memory
   retrieval is producing parallel pattern-aware content.
8. **Clean-slate ops 1-5 ran 2026-05-11** with founder authorization:
   DELETE founder's test messages from today (6 rows from `messages`),
   strip `[SYNTHETIC TEST]` prefix from pattern descriptions (2 rows
   updated), DELETE polluting rows from `memories_structured` (4),
   `memory_facts` (2), `memory_traces` (4). Synthetic seed marker
   (`_synthetic = true` in `trigger_conditions`) preserved.
9. **Post-clean-slate Phase A retest 2026-05-11** STILL produced
   pattern-aware prose without callout — this time pulling from a
   genuine 13 April memory entry. Confirmed: even with substrate
   cleaned of today's pollution, §2.1 memory retrieval can surface
   pattern-related content from real historical data, bypassing
   §10.7.A's gates. **Verification is blocked without C78 (test-mode
   flag) implementation.**

**What was learned:**

- **C70** (LESSONS.md) — CHECK constraint allowlists invisible via
  `information_schema.columns`; query `pg_constraint`. Discovered in
  Memory Surface feedback unblocker.
- **C71** (LESSONS.md) — Postgres data-modifying CTEs cannot see each
  other's effects on the same target table due to MVCC snapshot
  isolation.
- **C72** (LESSONS.md) — Schema-leads-query (C29/C63) extends to
  scheduled jobs and Edge Functions; column drift in unrun code is
  invisible until first execution.
- **C73** (LESSONS.md) — `vault.update_secret()` inside unreferenced
  CTE silently no-ops because PostgreSQL eliminates unreferenced CTEs.
- **C74** (PHASE_BOARD as candidate) — cron consumers must be aware of
  test-data markers, or seeds get corrupted by stale-retire / upsert
  logic. To formalize when Stage 2A PR-5 ships.
- **C75** (PHASE_BOARD as candidate) — service-role writes from edge
  functions on user-scoped tables require audit_log entry in same
  transaction. To formalize when PR-2b verifies.
- **C76** (PHASE_BOARD as candidate) — MCP `deploy_edge_function` has
  ~50K-token payload ceiling for function body; files >2000 lines or
  >40KB should deploy via Supabase CLI directly. To formalize when
  PR-2b verifies.
- **C77** (PHASE_BOARD, merged via PR #60) — Substrate-vs-memory-
  retrieval governance boundary. The substrate indexes its own
  ungoverned output as memory; on subsequent turns, semantic memory
  retrieval surfaces it, effectively bypassing §10.7.A governance via
  the persistence layer. Deferred to v5.8 architecture review.
- **C78** (PHASE_BOARD, merged via PR #60) — Testing in production
  contaminates the substrate. A `x-seven-test-mode: 1` header at chat
  function level should tag generated messages with
  `metadata.test_mode=true` and exclude them from memory retrieval,
  pattern detection inputs, and identity model updates. Deferred to
  v5.8.
- **C79** (PHASE_BOARD, merged via PR #60) — Tier-2/3 memory extraction
  pipeline absorbs test inputs as real identity facts. Within hours of
  testing today, Seven was injecting `user.habit='pulling an
  all-nighter'` and `user.goal='finish this project tonight'` into
  every chat turn's IDENTITY GROUNDING block. Fact extractor doesn't
  distinguish hypothetical phrasings from declarative commitments.
  Deferred to v5.8 alongside C77/C78 (shared data-provenance root).

**What's blocked:**

- **Stage 2A PR-2b verification** — blocked by C78. Tracking issue
  https://github.com/osemudiameh-abraham/mind-weave-ledger/issues/61.
  Cannot cleanly distinguish "§10.7.A gate is broken" from "§10.7.A
  gate is correctly silent because §2.1 memory retrieval is dominant"
  without test-mode flag implementation.
- **PR #57, #58, #59 not merged.** They stay open as drafts pending
  PR-2b verification.
- **Cron-pattern-detection paused.** Re-schedule moved to Stage 2A
  PR-5 (which now also includes `_synthetic`-aware filter patch).
- **Cron infrastructure → main bundle.** 12+ commits ahead of main
  pending Stage 2A stable surfacing baseline. Holding tonight.
- **Architecture v5.7 .docx line 1567 cross-reference rot** — flagged
  to founder 2026-05-09. Not yet edited in Word.

**What next session should pick up:**

1. **Implement minimal C78 test-mode flag in chat function.** Add
   `x-seven-test-mode: 1` header read at chat/index.ts top (~line 1860
   area, after auth check). When set:
   - Pass through to extraction tier-2/3 calls (lines ~1460-1820);
     each should skip when `test_mode === true`.
   - Tag `messages.metadata.test_mode = true` and
     `memories_structured.metadata.test_mode = true` on persistence.
   - Pattern fetch query at line 1965 adds `.is("metadata->>test_mode", null)`
     or equivalent filter (need to handle whether `behaviour_patterns`
     has a metadata column; if not, this is a non-issue since synthetic
     marker is in `trigger_conditions._synthetic`).
   - `match_memories` RPC and `recentMems` query filter out
     `metadata.test_mode = true` rows.
   - `memory_facts` query at line 1949 adds same filter.
2. **Redeploy chat function via CLI** (same canonical-bytes path
   already used twice — pattern is well-established).
3. **Retest Phase A** with the test-mode header set. With memory
   retrieval excluding test data + clean synthetic seeds, the only
   path that can produce pattern-aware content is the §10.7.A gate
   chain. Then either:
   - Gate fires → callout renders + RPC fires + audit row + count++
     → PR-2b verified → merge #57/#58/#59 + formalize C76/C77/C78/C79
     in LESSONS.md.
   - Gate doesn't fire → check the observability logs (now visible
     via Supabase Dashboard / CLI) for `[PATTERN_INTERVENTION]` and
     `[PATTERN_RELEVANCE]` lines from the test turn. Diagnose:
     embedding pre-filter floor too high? Relevance LLM scoring too
     conservative? Bug in helper invocation? Patch + redeploy.
4. **Stage 2A PR-3 (Settings toggle UI)** can be drafted in parallel
   while waiting on PR-2b verification — it's frontend code, no
   substrate dependency.
5. **Phase 1A advisor sweep (parallel security track)** — recommend
   running before any further public-facing surface ships.

**Open architectural questions queued for v5.8 design session:**

C77 (substrate-vs-memory-retrieval boundary), C78 (test-mode flag),
C79 (extraction pipeline absorbing hypothetical phrasings). Shared
root: substrate data-provenance metadata is too sparse. See PHASE_BOARD
"Open architectural questions for v5.8" section for full detail.

---

## 2026-05-08 → 2026-05-09 — Bootstrap session (the build-out of the
guarding protocol + Memory Surface unblocker + Proactive Surfacing recon)

**Phase + sub-phase:** Phase 0.C Stage 2 — closing Memory Surface
§10.13.1 unblocker; opening Stage 2A-prereq for Proactive Surfacing.

**What was done:**

1. **Operating mode bootstrap.** Read CLAUDE.md, GUARDING_CHAT_PROTOCOL.md,
   SECURITY_AUDIT_PLAN.md, architecture v5.7. Established balanced
   guarding protocol working order. Configured `.claude/settings.local.json`
   with autonomous-mode permissions (54 allow rules; `apply_migration`
   and `deploy_edge_function` deliberately excluded — founder retains
   explicit approval on those).
2. **Memory Surface §10.13.1 feedback unblocker** (Identity Card thumbs
   up/down was failing with `23514 check_constraint_violation`):
   - Diagnosed via Supabase MCP read-only schema queries: the
     `feedback_signals_surface_check` allowlist (`chat`/`voice`/`live`)
     rejected the new `memory_identity_card` value the Memory Surface
     hook was writing.
   - **PR #47** (`migration/feedback-signals-memory-surface`): migration
     extending the CHECK to admit a fourth domain `memory`. Applied to
     production via Supabase MCP `apply_migration` after explicit founder
     Category C approval (single-project environment treated as production
     per CLAUDE.md §9.1). Verified via 4 smoke tests including RLS
     unchanged, `memory` accepted, `garbage` rejected. Stranded smoke-test
     row caught and cleaned (the C71 CTE-snapshot lesson).
     **Merged to develop** as commit `aa278e8`.
   - **PR #48** (`fix/memory-surface-thumbs-feedback`): one-file hook
     change in `src/hooks/use-identity-card-data.ts` to write
     `surface: "memory"` (matching the new allowlist) plus a coherent
     comment-block update. Pre-commit gates: tsc clean, ESLint on the
     changed file clean, `pnpm build` success. Pre-existing develop-branch
     lint debt in 4 unrelated files surfaced separately (not in scope).
     `pnpm-lock.yaml` drift surfaced separately (not in scope).
     **Merged to develop** as commit `32d8952`.
   - **PR #49** (`chore/lessons-c70-c71`): LESSONS.md created (the
     forward-going append surface for C70+; prior lessons C1–C69 stay
     in architecture Part XV.8). Captures C70 (CHECK constraints
     invisible via `information_schema.columns`) and C71 (Postgres
     data-modifying CTEs cannot see each other's effects on the same
     target table). **Open, awaiting guard sign-off + merge.**
   - **PR #46** (Memory Surface, develop → main): awaiting founder cutover
     to production. `mergeable_state` was `unknown` immediately after
     PR #48 merged (GitHub recompute lag); resolves to `clean` within
     seconds.

3. **Proactive Surfacing (§10.7.A) recon + Category B review packet.**
   - Read architecture §10.7.A, §10.7.B from
     `docs/architecture/SEVEN_MYND_Master_Architecture_v5_7.docx`
     (extracted to `/tmp/architecture.txt` via `unzip` + python XML
     parse).
   - DB recon: `behaviour_patterns` empty (0 rows), 27 decisions due for
     review NOW for the founder account, `identity_model` populated for 1
     user (last update 2026-04-14), `messages` is the active chat store
     (`conversation_messages` is stale since 2026-02-11), no surfacing/
     dismissal tracking columns exist anywhere, only `reminders-fire-
     every-minute` is scheduled in `pg_cron`.
   - Code recon: chat function ALREADY has a baseline proactive-surfacing
     prototype (`chat/index.ts:2271-2336`) wrapping triggered patterns
     in `:::pattern :::` callouts. Frontend renderer ready
     (`TypewriterBubble.tsx`). Memory Surface dismiss UI not yet shipped
     (Stage 2C).
   - Bugs found: `cron-pattern-detection/index.ts:99` selects
     `decisions.title` (column doesn't exist; real is `text_snapshot`);
     line 104 selects `outcomes.reflection` (also doesn't exist; real is
     `text_snapshot`); both bugs cascade to lines 131 and 135.
   - Architecture cross-reference rot at line 1567 (mislabels §10.7.A
     vs §10.7.B). Flagged to founder for Word edit (Category C).
   - **Category B review packet** sent to guard. Approved with
     modifications 2026-05-08 / strategic-claude-session.

4. **Stage 2A-prereq launched** (per guard's Q1 approval — fix cron
   substrate before wiring proactive-surfacing gates so they don't gate
   emptiness):
   - **PR-prereq-1** (`fix/cron-pattern-detection-column-drift`):
     4-line fix correcting both column drifts. **Pushed**, awaiting
     founder approval for `deploy_edge_function` to production.
   - **PR-prereq-2** (`chore/schedule-pattern-detection-cron`):
     setup script `supabase/migrations/setup_pattern_detection_cron.sql`
     following the `setup_reminders_fire_cron.sql` convention (manual
     run, vault-secret-driven). **Pushed**, founder runs manually after
     vault seeding.
   - **PR-prereq-3** (`chore/2a-prereq-docs`, this PR): PHASE_BOARD.md
     and SESSION_LOG.md created.

**What was learned:**

- C70 — CHECK constraint allowlists must be queried via `pg_constraint`,
  not `information_schema.columns`. Schema-leads-query (C29/C63) extends
  to constraints, not just column existence. (LESSONS.md, PR #49)
- C71 — Postgres data-modifying CTEs cannot see each other's effects on
  the same target table due to MVCC snapshot isolation. The
  insert-and-cleanup pattern requires two separate statements OR
  marker-tagged inserts with a separate cleanup query. (LESSONS.md, PR #49)
- C72 *(to land at session close)* — Schema-leads-query (C29/C63) extends
  to scheduled jobs. Column drift in unrun crons is invisible until
  first scheduled run; audit `pg_cron` jobs against their underlying
  Edge Function source as a pair, not separately.

**What's blocked:**

- **PR #46 (Memory Surface develop → main)** — awaiting explicit founder
  click. URL: https://github.com/osemudiameh-abraham/mind-weave-ledger/pull/46
- **PR #49 (lessons C70/C71)** — open, non-draft; awaiting guard
  sign-off + merge. No code dependencies; can land any time.
- **PR-prereq-1 deploy** — `deploy_edge_function` to production needs
  explicit founder approval per CLAUDE.md §8 (single-project = production).
- **PR-prereq-2 run** — setup script needs vault seeding (founder action
  in Supabase Dashboard) + manual run via SQL editor or `execute_sql`
  MCP after seed verification.
- **Architecture v5.7 .docx line 1567 cross-reference rot** — founder
  edits in Word directly per their explicit out.
- **Phase 1 security audit (1A advisor sweep)** — not started; recommend
  next session opens with this since it's fast and autonomous.

**What next session should pick up:**

1. Verify the 2A-prereq smoke gate (cron has run successfully at least
   once, ≥1 row written to `behaviour_patterns`). Status checklist lives
   in PHASE_BOARD.md.
2. Open the Stage 2A PR-1 migration (CHECK + columns on
   `behaviour_patterns`, `identity_profiles.proactive_surfacing_enabled`).
   This is the next guard-review checkpoint per the 2A review packet.
3. **In parallel:** run Phase 1A advisor sweep via Supabase MCP
   `get_advisors`. Fast, finds real issues, autonomous.
4. Add lesson C72 to LESSONS.md when 2A-prereq smoke gate passes (the
   cron-detected-column-drift insight).

---

*This is the bootstrap entry. Future entries are appended at the top
in reverse chronological order.*
