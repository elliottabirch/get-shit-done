# Batch 03 — State + session continuity

Date: 2026-04-30
Artifacts assigned: 24
Output by: BATCH-03 fork-investigation classifier

## Classification table

| # | Path | Kind | I/O surface | Bin | Use case (≤15 words) | Direct I/O ops | Adapter methods proposed (with Bin) | Notes |
|---|------|------|-------------|-----|----------------------|----------------|-------------------------------------|-------|
| 1 | sdk/dist/query/state.js::stateJson | sdk-query-export | n/a | B | Read STATE.md, rebuild frontmatter from body+disk scan | n/a | `getState() -> StateRecord` (B) | Joins body extract + disk scan + ROADMAP milestone resolution; preserves frontmatter-only fields |
| 2 | sdk/dist/query/state.js::stateGet | sdk-query-export | n/a | A | Extract a named field/section from STATE.md | n/a | `getStateField(name)` (A) | Bare regex pluck. Could also map to generic `getRecord('STATE.md').field(name)` |
| 3 | sdk/dist/query/state.js::stateSnapshot | sdk-query-export | n/a | B | Structured STATE snapshot: position+decisions+blockers+session | n/a | `getStateSnapshot() -> Snapshot` (B) | Joins many extracts into derived shape; not bare bytes |
| 4 | sdk/dist/query/state.js::buildStateFrontmatter (helper) | sdk-internal | n/a | B | Internal: rebuild fm from body + disk + roadmap | n/a | (internal to `getState`/`updateState`) | Not directly exported as adapter method — backs Bin B handlers |
| 5 | sdk/dist/query/state.js::getMilestonePhaseFilter (helper) | sdk-internal | n/a | B | Internal: list phase dirs in current milestone | n/a | (internal helper for milestone filtering) | Roadmap join — already covered by milestone/roadmap adapter methods |
| 6 | sdk/dist/query/state-mutation.js::stateUpdate | sdk-query-export | n/a | A | Replace single named field in STATE.md | n/a | `updateStateField(name, value)` (A) | Pure field set; lockfile is impl detail |
| 7 | sdk/dist/query/state-mutation.js::statePatch | sdk-query-export | n/a | A | Replace multiple fields atomically | n/a | `patchStateFields(map)` (A) | Same as `updateStateField` over many keys |
| 8 | sdk/dist/query/state-mutation.js::stateBeginPhase | sdk-query-export | n/a | B | Set phase/plan/status/Current Position section | n/a | `beginPhase({phase, name, planCount})` (B) | Today injection + Current Position rewrite + multi-field cascade |
| 9 | sdk/dist/query/state-mutation.js::stateAdvancePlan | sdk-query-export | n/a | B | Increment current plan; detect phase completion | n/a | `advancePlan() -> {advanced, current_plan, total_plans, status}` (B) | Read-modify-write with completion-detection cascade |
| 10 | sdk/dist/query/state-mutation.js::stateRecordMetric | sdk-query-export | n/a | B | Append performance metric row | n/a | `recordPhaseMetric({phase, plan, duration, tasks, files})` (B) | Domain event append; placeholder strip |
| 11 | sdk/dist/query/state-mutation.js::stateUpdateProgress | sdk-query-export | n/a | B | Disk-scan plans/summaries → progress bar string | n/a | `updateStateProgress() -> {percent, completed, total, bar}` (B) | Joins disk scan + bar render + STATE field update |
| 12 | sdk/dist/query/state-mutation.js::stateAddDecision | sdk-query-export | n/a | B | Append decision entry to Decisions section | n/a | `recordDecision({phase, summary, rationale})` (B) | Domain event; section-aware insert; dedupe-by-placeholder-strip |
| 13 | sdk/dist/query/state-mutation.js::stateAddBlocker | sdk-query-export | n/a | B | Append blocker bullet to Blockers section | n/a | `recordBlocker({text})` (B) | Domain event append |
| 14 | sdk/dist/query/state-mutation.js::stateResolveBlocker | sdk-query-export | n/a | B | Remove blocker line by text match | n/a | `resolveBlocker({text})` (B) | Section-aware remove with placeholder fallback |
| 15 | sdk/dist/query/state-mutation.js::stateAddRoadmapEvolution | sdk-query-export | n/a | B | Append `### Roadmap Evolution` entry under Accumulated Context | n/a | `recordStateEvent({type:'roadmap_evolution', phase, action, note, after, urgent})` (B) | Canonical fix for the `add-phase`/`insert-phase` STATE.md leak; dedupe + section auto-create. Naming clash candidate with pilot — use unified `recordStateEvent` |
| 16 | sdk/dist/query/state-mutation.js::stateRecordSession | sdk-query-export | n/a | B | Update Last session/Date/Stopped At/Resume File | n/a | `recordSession({stoppedAt, resumeFile})` (B) | Multi-field cascade with fallback field names |
| 17 | sdk/dist/query/state-mutation.js::statePlannedPhase | sdk-query-export | n/a | B | Mark phase as ready-to-execute after planning | n/a | `markPhasePlanned({phase, planCount})` (B) | Today + multi-field + Current Position update |
| 18 | sdk/dist/query/state-mutation.js::stateMilestoneSwitch | sdk-query-export | n/a | B | Reset STATE for new milestone (fm + body + counters) | n/a | `switchMilestone({version, name})` (B) | Bypasses sync — full fm rebuild; preserves Accumulated Context |
| 19 | sdk/dist/query/state-mutation.js::stateSignalWaiting | sdk-query-export | n/a | B | Write WAITING.json under both `.gsd/` and `.planning/` | n/a | `signalWaiting({type, question, options, phase})` (B) | Dual-path write; structured payload |
| 20 | sdk/dist/query/state-mutation.js::stateSignalResume | sdk-query-export | n/a | A | Delete WAITING.json signal files | n/a | `clearWaitingSignal()` (A) | Bare delete |
| 21 | sdk/dist/query/state-mutation.js::stateValidate | sdk-query-export | n/a | B | Compare STATE counters vs disk; report drift | n/a | `validateState() -> {valid, warnings, drift}` (B) | Cross-source consistency check |
| 22 | sdk/dist/query/state-mutation.js::stateSync | sdk-query-export | n/a | B | Reconcile STATE counters with disk (with `--verify` dry-run) | n/a | `syncState({verify}) -> {synced, changes}` (B) | Multi-field reconcile; dry-run mode |
| 23 | sdk/dist/query/state-mutation.js::statePrune | sdk-query-export | n/a | B | Archive old STATE sections to STATE-ARCHIVE.md | n/a | `pruneState({keepRecent, dryRun}) -> {pruned, sections}` (B) | Read STATE + write STATE + write archive; multi-section cutoff |
| 24 | sdk/dist/query/state-project-load.js::stateProjectLoad | sdk-query-export | n/a | B | Load config + STATE.md raw text + existence flags | n/a | `getProjectLoad() -> {config, state_raw, *_exists}` (B) | Joins config.json + STATE.md + ROADMAP.md existence; loadConfig is shell-out to a CJS module |
| 25 | sdk/dist/query/state-project-load.js::formatStateLoadRawStdout | sdk-internal | n/a | D | Format key=value lines for `--raw` stdout | n/a | (presentation; not adapter) | Pure formatter — out of scope |
| 26 | get-shit-done/workflows/resume-project.md | workflow | Mixed | n/a (consumer) | Restore project context after a session break | 7 enumerated below | 7 methods proposed below | Big leak surface — `cat STATE.md`, `ls phases`, plan-w/o-summary scan, HANDOFF.json read+delete, .continue-here detection, "Update STATE.md" prose |
| 27 | get-shit-done/workflows/pause-work.md | workflow | Mixed | n/a (consumer) | Persist machine+human handoff for cross-session resume | 5 enumerated below | 5 methods proposed below | HANDOFF.json + .continue-here.md writes; multi-context detection (phase/spike/sketch/etc.) |
| 28 | get-shit-done/workflows/session-report.md | workflow | Mixed | n/a (consumer) | Generate post-session SESSION_REPORT.md | 4 enumerated below | 4 methods proposed below | Direct STATE.md/ROADMAP.md reads; reports dir mkdir+write; git log shell-out (out of scope) |
| 29 | get-shit-done/workflows/autonomous.md | workflow | Mixed | n/a (consumer) | Drive milestone phases discuss→plan→execute autonomously | 5 enumerated below | 5 methods proposed below | Heavy SDK use; leaks: `cat STATE.md` for blocker scan, `grep VERIFICATION.md` for status, ls UI-SPEC, write minimal CONTEXT.md, ls audit file |
| 30 | get-shit-done/workflows/next.md | workflow | Mixed | n/a (consumer) | Detect state and route to next workflow command | 6 enumerated below | 6 methods proposed below | Hard-stop gates leak: `[ -f .continue-here.md ]`, STATE.md error scan, VERIFICATION.md FAIL scan, prior-phase completeness scan, spike/sketch grep |
| 31 | get-shit-done/workflows/do.md | workflow | SDK-only | n/a (consumer) | Dispatch freeform text to a `/gsd-*` command | 0 (only `gsd-sdk query state.load`) | None | Pure router-with-rules; no .planning leaks |
| 32 | get-shit-done/workflows/fast.md | workflow | Mixed | n/a (consumer) | Inline trivial task: edit→commit→log STATE | 1 enumerated below | 1 method proposed below | Direct `grep -q "Quick Tasks Completed" STATE.md` then `echo … >> STATE.md` |
| 33 | get-shit-done/workflows/quick.md | workflow | Mixed | n/a (consumer) | Spawn planner+executor for a small ad-hoc task | 4 enumerated below | 4 methods proposed below | Heavy SDK use; leaks: STATE.md "Quick Tasks Completed" insert+row append, mkdir quick/, ls UI-SPEC etc., scan SUMMARY.md placeholders |
| 34 | agents/gsd-user-profiler.md | agent | Direct | n/a (consumer) | Score 8 behavioral dimensions from extracted user messages | 1 enumerated below | 1 method proposed below | Tools: Read only. Reads `~/.claude/get-shit-done/references/user-profiling.md` (out-of-scope: not `.planning/`) and JSONL input from caller (in-memory). No `.planning/` writes. Lone leak: rubric reference is a non-planning Read — out of scope |
| 35 | commands/gsd/resume-work.md | skill | Router | n/a | Skill router → workflows/resume-project.md | n/a | Inherits #26 | Pure router |
| 36 | commands/gsd/pause-work.md | skill | Router | n/a | Skill router → workflows/pause-work.md | n/a | Inherits #27 | Pure router |
| 37 | commands/gsd/session-report.md | skill | Router | n/a | Skill router → workflows/session-report.md | n/a | Inherits #28 | Pure router |
| 38 | commands/gsd/autonomous.md | skill | Router | n/a | Skill router → workflows/autonomous.md | n/a | Inherits #29 | Pure router |
| 39 | commands/gsd/next.md | skill | Router | n/a | Skill router → workflows/next.md | n/a | Inherits #30 | Pure router |
| 40 | commands/gsd/do.md | skill | Router | n/a | Skill router → workflows/do.md | n/a | Inherits #31 | Pure router |
| 41 | commands/gsd/fast.md | skill | Router | n/a | Skill router → workflows/fast.md | n/a | Inherits #32 | Pure router |
| 42 | commands/gsd/quick.md | skill | Mixed | n/a (consumer) | Skill: list/status/resume subcommands + run via workflows/quick.md | 2 enumerated below | 2 methods proposed below | NOT a pure router — `list` and `status` walk `.planning/quick/*/` directly |
| 43 | commands/gsd/thread.md | skill | Mixed | n/a (consumer) | Manage `.planning/threads/*.md` create/list/close/status/resume | 6 enumerated below | 6 methods proposed below | NOT a router — full skill body. Direct ls + Write of `.planning/threads/`. Frontmatter ops via `gsd-sdk query frontmatter.{get,set}` (Bin A SDK ops) |
| 44 | commands/gsd/manager.md | skill | Router | n/a | Skill router → workflows/manager.md | n/a | Inherits manager.md (other batch) | Pure router; manager workflow not in this batch |
| 45 | commands/gsd/set-profile.md | skill | n/a | n/a | One-line bash invocation of `gsd-sdk query config-set-model-profile` | n/a | None (uses SDK only) | Single-shot pass-through, no `.planning/` I/O. Effectively SDK-only |
| 46 | commands/gsd/plan-milestone-gaps.md | skill | Router | n/a | Skill router → workflows/plan-milestone-gaps.md | n/a | Inherits plan-milestone-gaps.md (other batch) | Pure router |

## Per-artifact detail

### SDK files (state.js, state-mutation.js, state-project-load.js)

Per-export classifications are in the table. Notes:

- `state-mutation.js` is the densest Bin B file in the codebase: 18 exports, all but `stateUpdate`/`statePatch`/`stateSignalResume` are Bin B. Every mutation goes through a lockfile-protected RMW that re-derives frontmatter from disk.
- `stateAddRoadmapEvolution` is the **canonical fix** for the pilot's `add-phase.md` Roadmap-Evolution leak. **Naming consistency:** keep the pilot's `recordStateEvent({type, payload})` as a unified discriminated union; this export is one payload shape.
- `stateMilestoneSwitch` bypasses `readModifyWriteStateMd` because `getMilestoneInfo` would race the rewrite. Adapter must implement as a single atomic op.
- `stateSignalWaiting` writes `WAITING.json` under BOTH `.gsd/` and `.planning/` — hook-watcher workaround, not design. Adapter can collapse.
- `stateValidate` (read-only) and `stateSync` (corrective writer) overlap conceptually; keep both.
- `stateProjectLoad` shells out to `core.cjs::loadConfig` via `createRequire`. For non-markdown adapters this becomes `adapter.getConfig()`. `formatStateLoadRawStdout` is Bin D.

### get-shit-done/workflows/resume-project.md

- **Direct I/O ops enumerated:**
  1. `cat .planning/STATE.md` (load_state) — full read, parse fields by hand
  2. `cat .planning/PROJECT.md` (load_state) — non-state, but planning-managed
  3. `cat .planning/HANDOFF.json` (check_incomplete_work) — structured handoff read
  4. `ls .planning/phases/*/.continue-here*.md` (check_incomplete_work)
  5. Glob/loop `.planning/phases/*/*-PLAN.md` and check matching `*-SUMMARY.md` (incomplete-execution scan)
  6. **After successful resumption, delete HANDOFF.json** (prose mandate at line 94)
  7. **Update STATE.md "Session Continuity"** (update_session step) — Read+Edit pair, exactly the pilot's leak pattern
- **Adapter methods needed:**
  1. `getState()` (B) — replaces full cat+parse
  2. `getProject()` (A) — bare PROJECT.md getRecord
  3. `getHandoff() -> Handoff | null` (A) — structured read, returns parsed object
  4. `removeHandoff()` (A) — replaces unlink
  5. `listIncompletePlans() -> {plan, missingSummary}[]` (B) — scan derives the "incomplete" set
  6. `listContinueHere() -> ContinueHerePath[]` (A) — bare existence list
  7. `recordSession({stoppedAt, action, resumeFile})` (B) — replaces "Update STATE.md Session Continuity" prose; same shape as SDK `stateRecordSession`
- **Notes:** Reconstruction block (lines 288–306) is mostly orchestration over above methods; PROJECT.md/ROADMAP.md/SUMMARY scans during reconstruction reuse adapter primitives (`listSummaries`, `getRoadmap` from other batches).

### get-shit-done/workflows/pause-work.md

- **Direct I/O ops enumerated:**
  1. `ls -lt .planning/{phases,spikes,sketches,deliberations}/...` (detect step) — multi-context detection
  2. `grep -l "To be filled\|placeholder\|TBD" .planning/phases/*/*.md` (gather step — false-completion scan)
  3. `Write .planning/HANDOFF.json` (write_structured step) — full structured write
  4. `Write {handoff-path}/.continue-here.md` (write step) — full markdown write at one of 5 possible paths
  5. `gsd-sdk query commit "wip: ... paused at X/Y" handoff-path .planning/HANDOFF.json` (commit step) — SDK-managed; not a leak
- **Adapter methods needed:**
  1. `detectActiveContext() -> {kind: 'phase'|'spike'|'sketch'|'deliberation'|'research', id, dir}` (B) — coordination across multiple `.planning/` subtrees
  2. `findPlaceholderSummaries() -> {file, marker}[]` (A) — bare grep
  3. `putHandoff(handoff: HandoffPayload)` (B) — typed write; payload schema is the v1.0 JSON in the workflow
  4. `putContinueHere({contextPath, body})` (A or B) — Bin A if path is supplied; Bin B if context-aware path resolution moves into the adapter
  5. `getCurrentTimestamp()` (A) — already an SDK query (`current-timestamp`); adapter can pass through
- **Notes:** The "Pre-Execution Critique Required" section is workflow-prose only — no I/O. `Blocking constraints` table is part of the markdown payload, not a separate op.

### get-shit-done/workflows/session-report.md

- **Direct I/O ops enumerated:**
  1. `git log --oneline --since="24 hours ago"` (gather_session_data) — **out of scope** (code-repo git, not planning state)
  2. `git diff --stat HEAD~10 HEAD` (gather_session_data) — **out of scope** (same)
  3. Read `.planning/STATE.md` (gather_session_data) — direct cat-and-parse for milestone/phase/blockers/decisions
  4. Read `.planning/ROADMAP.md` (gather_session_data) — direct read for milestone name/goals
  5. `ls -la .planning/reports/SESSION_REPORT*.md` (gather_session_data) — existence scan for filename uniqueness
  6. `mkdir -p .planning/reports` + `Write .planning/reports/SESSION_REPORT*.md` (generate_report)
- **Adapter methods needed:**
  1. `getState()` (B) — already proposed
  2. `getRoadmap() -> RoadmapDoc` (A) — likely covered by another batch's roadmap.js classifications
  3. `listSessionReports() -> ReportRef[]` (A)
  4. `putSessionReport({filename, body})` (A) — bare put under `.planning/reports/`
- **Notes:** Git log/diff are NOT adapter concerns. Token-usage estimation block is in-process logic only. The "previous reports" check is a directory scan at one path.

### get-shit-done/workflows/autonomous.md

- **Direct I/O ops enumerated:**
  1. `cat .planning/STATE.md` (iterate step — re-read for blockers)
  2. `grep "^status:" "${PHASE_DIR}"/*-VERIFICATION.md` (3d, gap-closure retry, audit retry)
  3. `ls "${PHASE_DIR}"/*-UI-SPEC.md` (3a.5, 3d.5)
  4. `Write ${phase_dir}/${padded_phase}-CONTEXT.md` (skip-discuss path) — full markdown body composed inline
  5. `ls .planning/v${milestone_version}-MILESTONE-AUDIT.md` (5b verification — explicit existence check)
- **Adapter methods needed:**
  1. `getState()` (B)
  2. `getVerificationStatus(phase) -> 'passed'|'human_needed'|'gaps_found'|null` (B) — already proposed by other batches; surface here too
  3. `findUiSpec(phase) -> UiSpecRef|null` (A)
  4. `putPhaseContext({phase, body})` (A) — bare write
  5. `getMilestoneAudit(version) -> AuditRef|null` (A)
- **Notes:** Heavy SDK usage (init.milestone-op, roadmap.analyze, roadmap.get-phase, init.phase-op, config-get, commit). Frontend-phase branches (3a.5, 3d.5) are workflow logic on top of adapter data — keep in workflow.

### get-shit-done/workflows/next.md

- **Direct I/O ops enumerated:**
  1. `[ -f .planning/.continue-here.md ]` (Gate 1)
  2. STATE.md error-state scan: `grep "status: error\|status: failed" .planning/STATE.md` (Gate 2 — implicit)
  3. VERIFICATION.md FAIL-without-overrides scan (Gate 3 — implicit Read of phase verification)
  4. Prior-phase completeness scan: walks all phases preceding current, looking for plans-without-summaries, FAILs without overrides, CONTEXT.md without PLAN.md
  5. `grep -rl 'verdict: PENDING' .planning/spikes/*/README.md` and `grep -rl 'winner: null' .planning/sketches/*/README.md` (spike_sketch_notice)
  6. Backlog deferral: append "### Phase 999.{N}" entries to ROADMAP.md (continue-and-defer branch)
- **Adapter methods needed:**
  1. `findContinueHere() -> ContinueHereRef|null` (A)
  2. `getStateErrorState() -> 'error'|'failed'|null` (A) — or just reuse `getStateField('status')`
  3. `findVerificationFailures(phase, {includeOverrides}) -> FailItem[]` (B) — domain logic to filter overridden FAILs
  4. `findPriorPhaseIncomplete() -> {phase, kind, items}[]` (B) — multi-source scan + categorize (plans/verification/context)
  5. `findPendingExploratoryWork() -> {spikes, sketches}` (A) — bare grep over filtered sets (Bin A; rubric Rule 5 doesn't trigger because it's pure filter)
  6. `recordBacklogDeferral({sourcePhase, destPhase, items})` (B) — typed roadmap append; cross-document mutation. Belongs with roadmap-mutation methods (likely covered by another batch); flag for synthesis.
- **Notes:** Routing table (Routes 1–8) is decision logic; only the adapter primitives are needed. The find-phase SDK query already exists for prior-phase scan and reduces some leaks at the SDK level.

### get-shit-done/workflows/do.md

- **Direct I/O ops enumerated:** None. The single bash invocation is `gsd-sdk query state.load` (SDK-only).
- **Adapter methods needed:** None.
- **Notes:** Despite extensive routing logic, this workflow does no `.planning/` direct I/O. Pure dispatcher.

### get-shit-done/workflows/fast.md

- **Direct I/O ops enumerated:**
  1. `grep -q "Quick Tasks Completed" .planning/STATE.md` then `echo "| date | fast | $TASK | ✅ |" >> .planning/STATE.md` (log_to_state step)
- **Adapter methods needed:**
  1. `recordQuickTask({date, mode, description, status})` (B) — typed table append; placeholder/header creation if missing. Same family as `recordDecision`/`recordBlocker`. Could share implementation with workflows/quick.md leak below.
- **Notes:** Append-via-`echo` is the worst case for atomicity — direct shell append, no lock, no frontmatter sync. Adapter MUST provide a typed method here.

### get-shit-done/workflows/quick.md

- **Direct I/O ops enumerated:**
  1. `mkdir -p ${task_dir}` and `mkdir -p $QUICK_DIR` (steps 3 & 4) — directory creation in `.planning/quick/`
  2. STATE.md "Quick Tasks Completed" section detection + create-if-missing + table-row append (step 7 — Read+Edit) — the same leak class as `fast.md` but with optional Status column logic
  3. Multiple Read of CONTEXT.md / RESEARCH.md / PLAN.md / SUMMARY.md / VERIFICATION.md inside `.planning/quick/${dir}/` (orchestration reads — these ARE planning-state but quick-task-scoped)
  4. Worktree-merge cleanup mutates `.planning/STATE.md` and `.planning/ROADMAP.md` via backup+restore (out-of-scope: these are git mechanics, not planning storage; flag for synthesis)
- **Adapter methods needed:**
  1. `createQuickTaskDir({quickId, slug}) -> {dir}` (B) — directory + slug bookkeeping
  2. `recordQuickTask({quickId, description, date, commit, status?, dir})` (B) — STATE.md table mutation (shared with fast.md). The optional Status column is domain logic.
  3. `getQuickTaskArtifact({quickId, kind})` (A) — bare get of CONTEXT/RESEARCH/PLAN/SUMMARY/VERIFICATION by quick task
  4. `putQuickTaskArtifact({quickId, kind, body})` (A) — bare put
- **Notes:** This workflow has heavy SDK use (init.quick, agent-skills, config-get, commit). The `--validate`/`--research`/`--discuss` branches don't add I/O — they spawn subagents. Worktree merge logic is git-mechanics, NOT adapter scope (rubric Rule 6). Submodule check `[ -f .gitmodules ]` is also out-of-scope (project root, not planning).

### agents/gsd-user-profiler.md

- **Direct I/O ops enumerated:**
  1. Read `~/.claude/get-shit-done/references/user-profiling.md` (load_rubric step) — **OUT OF SCOPE**. This is the GSD install reference; not project planning state. Per rubric Rule 6, no adapter method needed.
- **Adapter methods needed:** None. This agent is pure analysis over caller-provided JSONL input. Tools: Read only.
- **Notes:** Surprisingly clean — the agent receives messages as parameter content and returns analysis JSON wrapped in `<analysis>` tags. No `.planning/` writes. The output is consumed (not written) by the orchestrator (`profile-sample` workflow, in another batch).

### Skill router files (auto-classified)

Per Rubric Rule 4, the following are pure routers — `<execution_context>@…workflow.md</execution_context>` + a `<process>` block that says "Execute the workflow end-to-end":

- commands/gsd/resume-work.md → workflows/resume-project.md
- commands/gsd/pause-work.md → workflows/pause-work.md
- commands/gsd/session-report.md → workflows/session-report.md
- commands/gsd/autonomous.md → workflows/autonomous.md
- commands/gsd/next.md → workflows/next.md
- commands/gsd/do.md → workflows/do.md
- commands/gsd/fast.md → workflows/fast.md
- commands/gsd/manager.md → workflows/manager.md (manager workflow is in another batch)
- commands/gsd/plan-milestone-gaps.md → workflows/plan-milestone-gaps.md (also another batch)

Three skills are **NOT pure routers** and need their own classification:

- **commands/gsd/quick.md** has `list`/`status`/`resume` subcommands implemented inline before deferring to the workflow. They `ls -d .planning/quick/*/`, then per directory call `gsd-sdk query frontmatter.get` (SDK-managed) and `stat` (filesystem date). The `ls -d` of the quick subtree is a direct I/O leak. Adapter methods: `listQuickTasks() -> QuickTaskRef[]` (A), `getQuickTaskStatus(slug) -> {status, plan, summary, lastAction}` (B — joins multiple frontmatter reads + display fields).
- **commands/gsd/thread.md** is a fully self-contained skill (227 lines) that creates/lists/closes/resumes `.planning/threads/*.md`. Direct ops: (1) `ls .planning/threads/*.md` (list mode), (2) `gsd-sdk query frontmatter.get/.set` for status/updated/title (SDK; covered by frontmatter exports in another batch), (3) `mkdir -p .planning/threads` (create mode), (4) `Write .planning/threads/{SLUG}.md` (create mode), (5) `gsd-sdk query commit` (SDK), (6) Read of thread file (resume/status modes). Adapter methods needed:
  - `listThreads({status?}) -> ThreadRef[]` (A)
  - `getThread(slug) -> Thread` (A) — body + frontmatter
  - `addThread({slug, title, description, today})` (B) — composite write of templated body + dated frontmatter
  - `updateThreadStatus(slug, status, today)` (A) — single field mutation (frontmatter); SDK has `frontmatter.set` already
  - `findThreadBySlug(slug) -> bool` (A) — existence check
- **commands/gsd/set-profile.md** is a single-shot bash invocation (`gsd-sdk query config-set-model-profile`). Effectively SDK-only. No adapter implications.

## Cross-cutting observations from this batch

1. **state-mutation.js is the densest Bin B file in the codebase.** 18 exports, 17 of them Bin B. Pattern: every mutation goes through a lockfile-protected RMW that re-derives frontmatter from disk. For non-markdown adapters (beads), this whole strategy is replaced by typed-event recording with the database as the lock authority. The synthesizer should expect ~17 named adapter methods from this file alone.

2. **Naming clash with PILOT.md `recordStateEvent`.** The pilot proposed a single `recordStateEvent({type, text})` for typed STATE.md events. This batch has at least 5 candidate event types in distinct exports: `roadmap_evolution` (stateAddRoadmapEvolution), `decision` (stateAddDecision), `blocker_added`/`blocker_resolved` (stateAddBlocker/stateResolveBlocker), `metric` (stateRecordMetric), `session` (stateRecordSession). **Recommendation for synthesis:** keep the unified `recordStateEvent({type, payload})` shape but enumerate the 5+ payload types as a discriminated union. This matches the SDK's existing per-event-type handlers without forcing every adapter to implement 5 separate methods.

3. **The dual `.gsd/` and `.planning/` write in `stateSignalWaiting` is a hook-watcher workaround**, not a fundamental design. The adapter abstraction can collapse this to a single op; the markdown adapter can implement the dual-path internally if hook compatibility is required.

4. **Skill files that are NOT routers (thread.md, quick.md) have direct `.planning/` I/O.** This contradicts the pilot's blanket "skills are routers" assumption. The rubric Rule 4 already covers this ("if the skill body is essentially…"), but synthesis should expect a handful of "fat skill" exceptions. In this batch: thread.md (full workflow inline), quick.md (subcommands inline), set-profile.md (single SDK shell-out — effectively `n/a`).

5. **`agents/gsd-user-profiler.md` is the cleanest agent in the codebase.** Tools: Read only. No `.planning/` writes. The Read of `~/.claude/get-shit-done/references/user-profiling.md` is a non-`.planning/` reference doc and per Rule 6 is out of scope. This is a calibration point for "agent that does not need adapter methods" — different from `gsd-roadmapper` (Direct, 3 leaks) in the pilot.

6. **`workflows/do.md` is the cleanest workflow in this batch.** Despite 100+ lines of routing rules, the only state I/O is `gsd-sdk query state.load`. Other batches likely contain similar pure dispatchers — synthesis should not propose adapter methods for them.

7. **Worktree merge logic in `quick.md` mutates `.planning/STATE.md` and `.planning/ROADMAP.md` via cp+restore.** This is git-mechanics implementing a "main always wins" policy on planning files during worktree merges. Per Rule 6 it's not adapter scope, BUT the beads adapter changes the semantics: planning state is not in git tracked files, so this whole "backup→merge→restore" dance becomes moot. Flag for synthesis: when adapter is bd-managed, the worktree-protect logic in quick.md (lines 644–719) is **Bin C — eliminate**.

8. **Hidden leak count.** Per rubric, leaks-grep mandate: this batch found 39 direct-I/O ops across 9 workflows + 2 fat skills. The pilot's 7-in-progress.md / 1-in-add-phase.md / 3-in-roadmapper.md ratio is roughly preserved.

9. **Adapter method overlaps with other batches (flag for synthesis dedup):**
   - `getState()` / `updateStateField()` — anchored here, used by progress.md (Batch X), add-phase.md (Batch X), etc.
   - `recordStateEvent({type, payload})` — same canonical method covers stateAddRoadmapEvolution, stateAddDecision, stateAddBlocker, etc. and the pilot's add-phase Roadmap-Evolution leak.
   - `getVerificationStatus(phase)` — appears in autonomous.md and next.md here; almost certainly also in execute-phase / verify workflows (other batches).
   - `findContinueHere()` / `getHandoff()` — handoff family appears in resume-project.md and next.md here, plus pause-work.md (writer side); progress.md (Batch X — pilot found) reads them too.
   - `recordQuickTask` — fast.md and quick.md both append the same STATE.md table.
   - `getRoadmap()` — gather_session_data here also reads ROADMAP for milestone metadata; many batches will. Anchor in roadmap batch.

## Bin-by-bin counts

- Bin A: 17 operations (across SDK exports + workflow leaks + fat-skill ops)
- Bin B: 24 operations
- Bin C: 1 (worktree-merge protect logic in quick.md when adapter is bd-managed)
- Bin D: 1 (formatStateLoadRawStdout)
- Direct I/O leaks found: 39 (across 9 workflows + thread.md + quick.md fat-skill subcommands)
- Routers auto-classified: 9 (resume-work, pause-work, session-report, autonomous, next, do, fast, manager, plan-milestone-gaps)
