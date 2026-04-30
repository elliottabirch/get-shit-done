# Batch 06 — Code/UI review + debug + diagnose

Date: 2026-04-30
Artifacts assigned: 23
Output by: BATCH-06 agent (Theme: Code/UI review + debug + diagnose)

## Classification table

| # | Path | Kind | I/O surface | Bin | Use case (≤15 words) | Direct I/O ops | Adapter methods proposed (with Bin) | Notes |
|---|------|------|-------------|-----|----------------------|----------------|-------------------------------------|-------|
| 1 | workflows/code-review.md | workflow | Mixed | n/a (consumer) | Code review: scope files, spawn reviewer agent, commit REVIEW.md | 4 ops (see detail) | listPhaseSummaries, getReviewArtifact, addReviewArtifact, listPhaseCommits | Heavy git+SUMMARY parsing; many non-`.planning/` git ops out of scope |
| 2 | workflows/code-review-fix.md | workflow | Mixed | n/a (consumer) | Auto-fix REVIEW.md findings via fixer agent, optional --auto re-review loop | 5 ops (see detail) | getReviewArtifact, getReviewFixArtifact, addReviewFixArtifact, archiveReviewIteration | Iteration backups via `cp` are direct I/O |
| 3 | workflows/ui-review.md | workflow | Mixed | n/a (consumer) | Retroactive 6-pillar UI audit, spawn auditor, commit UI-REVIEW.md | 4 ops (see detail) | listPhaseSummaries, listPhasePlans, getUiSpec, getUiReview, addUiReview | UI-SPEC discovery via ls glob |
| 4 | workflows/ui-phase.md | workflow | Mixed | n/a (consumer) | UI design contract: spawn researcher+checker with revision loop | 1 op (UI-SPEC ls) | getUiSpec, addUiSpec | Mostly SDK-only; the existing-spec check is direct |
| 5 | workflows/eval-review.md | workflow | Mixed | n/a (consumer) | Retroactive AI eval coverage audit; spawn eval-auditor; commit EVAL-REVIEW.md | 4 ops + raw `git add`/`git commit` | listPhaseSummaries, getAiSpec, getEvalReview, addEvalReview | Bypasses `gsd-sdk query commit` — direct git for commit |
| 6 | workflows/review.md | workflow | Mixed | n/a (consumer) | Cross-AI peer review of phase plans; collect REVIEWS.md | 5 ops (see detail) | getProjectMeta, getRoadmapPhase, listPhasePlans, getPhaseContext, getPhaseResearch, getRequirements, addReviewsArtifact | Most reads are `.planning/*` direct, not via SDK |
| 7 | workflows/diagnose-issues.md | workflow | Mixed | n/a (consumer) | Spawn parallel debug agents per UAT gap; update UAT.md with diagnoses | 2 ops (see detail) | getUat, updateUatGapDiagnoses | UAT YAML edit = Bin B (cascade/structured) |
| 8 | workflows/node-repair.md | workflow | n/a (in-memory) | n/a | Per-task repair operator (RETRY/DECOMPOSE/PRUNE/ESCALATE) inside execute-plan | None on planning state | None (logging is inside SUMMARY.md owned by execute-plan) | Pure orchestration directive; no `.planning/*` I/O |
| 9 | workflows/undo.md | workflow | Direct | n/a (consumer) | Safe git revert of phase/plan commits with manifest + dependency check | 5 ops (see detail) | getPhaseManifest, getRoadmap (dep parse), listPhasePlans, getPlan | Most ops are git on source — out of scope; only manifest+roadmap+plan reads matter |
| 10 | agents/gsd-code-reviewer.md | agent | Mixed | n/a (consumer) | Adversarial code review; produce REVIEW.md with findings | 1 op (addReview write) + git diff | addReviewArtifact | Source code reads/git diff are out-of-scope |
| 11 | agents/gsd-code-fixer.md | agent | Mixed | n/a (consumer) | Apply fixes per REVIEW.md finding atomically; produce REVIEW-FIX.md | 2 ops (read REVIEW, write REVIEW-FIX) | getReviewArtifact, addReviewFixArtifact | Per-finding source edits + git worktree are out-of-scope |
| 12 | agents/gsd-ui-checker.md | agent | Mixed | n/a (consumer) | Validate UI-SPEC.md across 6 dimensions; return APPROVED/BLOCKED | 1 op (read UI-SPEC + CONTEXT + RESEARCH) | getUiSpec, getPhaseContext, getPhaseResearch | Read-only agent; no writes |
| 13 | agents/gsd-ui-auditor.md | agent | Mixed | n/a (consumer) | 6-pillar visual audit of implemented UI; write UI-REVIEW.md | 2 ops (gitignore guard, write review) | addUiReview, ensureUiReviewDir | Screenshots into `.planning/ui-reviews/` is a new artifact path |
| 14 | agents/gsd-ui-researcher.md | agent | Mixed | n/a (consumer) | Produce UI-SPEC.md design contract; reads upstream artifacts | 1 op (write UI-SPEC) | addUiSpec | Reads CONTEXT/RESEARCH/REQUIREMENTS — covered by other batches' methods |
| 15 | agents/gsd-debugger.md | agent | Direct | n/a (consumer) | Investigate bugs scientifically; manage debug session file; archive on resolve | 7 ops (see detail) | listDebugSessions, addDebugSession, updateDebugSession, archiveDebugSession, getDebugKnowledgeBase, appendDebugKnowledgeBase | Debug file is THE state machine — heavy direct I/O |
| 16 | agents/gsd-debug-session-manager.md | agent | Direct | n/a (consumer) | Run debug checkpoint/continuation loop in isolation; spawn debugger | 1 op (read debug file) + Write to append Specialist Review section | getDebugSession, appendDebugSpecialistReview | Inherits debugger's adapter needs |
| 17 | commands/gsd/code-review.md | skill | Router | n/a | Thin router → workflows/code-review.md | None | (inherits workflow #1) | Auto-classified |
| 18 | commands/gsd/code-review-fix.md | skill | Router | n/a | Thin router → workflows/code-review-fix.md | None | (inherits workflow #2) | Auto-classified |
| 19 | commands/gsd/ui-review.md | skill | Router | n/a | Thin router → workflows/ui-review.md | None | (inherits workflow #3) | Auto-classified |
| 20 | commands/gsd/ui-phase.md | skill | Router | n/a | Thin router → workflows/ui-phase.md | None | (inherits workflow #4) | Auto-classified |
| 21 | commands/gsd/eval-review.md | skill | Router | n/a | Thin router → workflows/eval-review.md | None | (inherits workflow #5) | Auto-classified |
| 22 | commands/gsd/review.md | skill | Router | n/a | Thin router → workflows/review.md | None | (inherits workflow #6) | Auto-classified |
| 23 | commands/gsd/debug.md | skill | Mixed (not pure router) | n/a (consumer) | Subcommand dispatch (list/status/continue) + spawn session manager | 4 ops (see detail) | listDebugSessions, getDebugSession, addDebugSession | NOT a thin router — has its own list/status/continue logic that touches `.planning/debug/` directly |

## Per-artifact detail

### 1. workflows/code-review.md
- **Direct I/O ops:**
  1. `ls "${PHASE_DIR}"/*-SUMMARY.md` — discover phase summaries
  2. `node` parse of YAML frontmatter inside each `*-SUMMARY.md` (Read+regex) to extract `key_files.created/modified`
  3. `[ -f "${REVIEW_PATH}" ]` + `node` parse of REVIEW.md frontmatter for `status` validation after agent run
  4. Git ops: `git log --grep`, `git diff --name-only`, `git rev-parse` — these touch source code, **out of scope** per Rule 6
- **Adapter methods:**
  1. `listPhaseSummaries(phase) -> Summary[]` (A) — replaces `ls *-SUMMARY.md`
  2. `getSummaryKeyFiles(phase, summaryId) -> {created, modified}` (B) — frontmatter parse with derived field; or fold into `getSummary` shape
  3. `getReviewArtifact(phase) -> Review | null` (A)
  4. `addReviewArtifact(phase, body) -> void` (B) — body includes structured frontmatter with status/findings counts
- **Notes:** Three-tier file scoping (--files > SUMMARY > git diff) is workflow logic; adapter only provides SUMMARY artifact. Git diff fallback stays as direct git (source code, not planning state).

### 2. workflows/code-review-fix.md
- **Direct I/O ops:**
  1. `[ -f "${REVIEW_PATH}" ]` — existence check
  2. `node` parse of REVIEW.md frontmatter for `status`, `depth`, `files_reviewed_list`
  3. `cp "${REVIEW_PATH}" "${REVIEW_PATH%.md}.iter${ITERATION}.md"` — backup before re-review (NEW direct write)
  4. `cp "${FIX_REPORT_PATH}" "${FIX_REPORT_PATH%.md}.iter${ITERATION}.md"` — backup of REVIEW-FIX.md
  5. `[ -f "${FIX_REPORT_PATH}" ]` + frontmatter parse for status/findings_in_scope/etc.
- **Adapter methods:**
  1. `getReviewArtifact(phase) -> Review` (A) — exposes structured fields (status, depth, filesReviewedList)
  2. `getReviewFixArtifact(phase) -> ReviewFix | null` (A)
  3. `addReviewFixArtifact(phase, body)` (B) — structured (frontmatter + sections)
  4. `archiveReviewIteration(phase, iteration, kind: "review"|"review-fix") -> void` (B) — replaces `cp` to `.iterN.md` files; for beads, becomes a versioned issue history rather than file copy
- **Notes:** The `.iterN.md` backup pattern is a markdown-specific naming scheme — for the bd adapter it becomes "snapshot the previous review state under iteration N." Worth flagging as adapter responsibility, not workflow.

### 3. workflows/ui-review.md
- **Direct I/O ops:**
  1. `ls "${PHASE_DIR}"/*-SUMMARY.md` — execution detection
  2. `ls "${PHASE_DIR}"/*-UI-SPEC.md | head -1` — baseline spec lookup
  3. `ls "${PHASE_DIR}"/*-UI-REVIEW.md | head -1` — existing review check
  4. PLAN.md path collection (implicit `ls *-PLAN.md`)
- **Adapter methods:**
  1. `listPhaseSummaries(phase)` (A) — shared with #1
  2. `listPhasePlans(phase) -> Plan[]` (A)
  3. `getUiSpec(phase) -> UiSpec | null` (A)
  4. `getUiReview(phase) -> UiReview | null` (A)
  5. `addUiReview(phase, body)` (B) — structured pillar-scored markdown
- **Notes:** All four ops are bare existence/list — Bin A. The Playwright-MCP screenshot block is execution-side, not adapter concern.

### 4. workflows/ui-phase.md
- **Direct I/O ops:**
  1. `ls "${PHASE_DIR}"/*-UI-SPEC.md | head -1` — existing UI-SPEC detection
  2. `ls ./.claude/skills/sketch-findings-*/SKILL.md | head -1` — sketch findings detection (NOT `.planning/`, but project skills — borderline; treat as out-of-scope per Rule 6, it's project-tool state, not planning state)
- **Adapter methods:**
  1. `getUiSpec(phase) -> UiSpec | null` (A) — shared with #3
  2. `addUiSpec(phase, body) -> void` (B) — structured template, multi-section design contract
- **Notes:** Otherwise heavily SDK-only (`init.plan-phase`, `roadmap.get-phase`, `agent-skills`, `resolve-model`, `config-get`, `commit`, `state.record-session`). Just one true planning-state leak.

### 5. workflows/eval-review.md
- **Direct I/O ops:**
  1. `ls "${PHASE_DIR}"/*-SUMMARY.md`
  2. `ls "${PHASE_DIR}"/*-AI-SPEC.md | head -1`
  3. `ls "${PHASE_DIR}"/*-EVAL-REVIEW.md | head -1`
  4. `git add "${EVAL_REVIEW_FILE}" && git commit -m ...` — **bypasses `gsd-sdk query commit`** (a direct git path that other workflows route through SDK)
- **Adapter methods:**
  1. `listPhaseSummaries(phase)` (A) — shared
  2. `getAiSpec(phase) -> AiSpec | null` (A)
  3. `getEvalReview(phase) -> EvalReview | null` (A)
  4. `addEvalReview(phase, body)` (B) — structured score/verdict/gaps
- **Notes:** The raw `git add`/`git commit` here is inconsistent with other workflows; in the new architecture this should route through the adapter+commit-SDK path. Flag for synthesis.

### 6. workflows/review.md
- **Direct I/O ops:**
  1. Read `.planning/PROJECT.md` (first 80 lines) — project context
  2. Read phase section from `.planning/ROADMAP.md`
  3. Read all `*-PLAN.md` files in the phase directory
  4. Read `*-CONTEXT.md` if present
  5. Read `*-RESEARCH.md` if present
  6. Read `.planning/REQUIREMENTS.md`
  7. Write `{phase_dir}/{padded_phase}-REVIEWS.md`
- **Adapter methods:**
  1. `getProjectMeta() -> ProjectMeta` (A) — surfaces PROJECT.md as structured/raw
  2. `getRoadmapPhase(phase) -> RoadmapPhaseSection` (A) — already an SDK query; ensure adapter parity
  3. `listPhasePlans(phase) -> Plan[]` (A) — shared
  4. `getPhaseContext(phase) -> Context | null` (A)
  5. `getPhaseResearch(phase) -> Research | null` (A)
  6. `getRequirements() -> Requirement[]` (A)
  7. `addReviewsArtifact(phase, body)` (B) — multi-reviewer structured aggregate
- **Notes:** The temp-file shell-out to external CLIs (`/tmp/gsd-review-*`) is non-`.planning/` — out of scope. The CLI invocation logic stays in workflow.

### 7. workflows/diagnose-issues.md
- **Direct I/O ops:**
  1. Read UAT.md "Gaps" YAML section
  2. Update UAT.md gaps inline (root_cause, artifacts, missing, debug_session) + frontmatter status to "diagnosed"
  3. (Implicit) Each spawned debug agent reads `.planning/STATE.md` and writes to `.planning/debug/{slug}.md` — covered by debugger agent (#15)
- **Adapter methods:**
  1. `getUat(phase) -> Uat` (A) — already implied by Uat noun
  2. `updateUatGapDiagnoses(phase, gapDiagnoses[]) -> void` (B) — coordinated multi-field structured update on individual gap entries; status transition to "diagnosed"; for beads, this becomes per-gap issue updates with comments
- **Notes:** The agent-spawning loop is workflow-level. Adapter concern is just the UAT mutation.

### 8. workflows/node-repair.md
- **Direct I/O ops:** None on planning state. Repair decisions (RETRY/DECOMPOSE/PRUNE/ESCALATE) are in-memory; logging goes "to SUMMARY.md" but this is the execute-plan workflow's responsibility, not node-repair's.
- **Adapter methods:** None. Inherits SUMMARY.md append from whatever execute-plan uses.
- **Notes:** Pure decision-tree directive. No `.planning/*` reads or writes are issued from this file directly. Marked as `n/a (in-memory)`.

### 9. workflows/undo.md
- **Direct I/O ops (planning-related only):**
  1. Read `.planning/.phase-manifest.json` for `manifest.phases[TARGET_PHASE].commits`
  2. Read `.planning/ROADMAP.md` to find dependent phases (string scan for `Depends on:`)
  3. `[ -d ".planning/phases/${N}-*/" ]` + ls plans/summaries inside — dependent phase has-started check
  4. Read PLAN.md files inside `.planning/phases/${NN}-*/` to check `consumes`/`<files>` references for intra-phase dependency check
  5. (Out-of-scope per Rule 6:) `git log`, `git revert`, `git status --porcelain`, `git commit`
- **Adapter methods:**
  1. `getPhaseManifest() -> PhaseManifest` (A)
  2. `findDependentPhases(phase) -> Phase[]` (B) — joins ROADMAP parse + checks "Depends on:"; computed/derived
  3. `listPhasePlans(phase) -> Plan[]` (A) — shared
  4. `getPlan(phase, plan) -> Plan` (A)
  5. `findIntraPhasePlanDependencies(phase, plan) -> Plan[]` (B) — scans later plans for `consumes` references → derived
- **Notes:** Most of the workflow (git revert, dirty-tree guard, confirmation gate) is git-on-source — out of scope. The `.phase-manifest.json` + ROADMAP dependency analysis is the planning-state portion.

### 10. agents/gsd-code-reviewer.md
- **Direct I/O ops:**
  1. Write REVIEW.md to `review_path` — the agent's primary deliverable
  2. (Read CLAUDE.md, source files, `.claude/skills/`, run grep on src — all source-code reads, **out of scope** per Rule 6)
  3. Fallback `git diff --name-only` — git on source, out of scope
- **Adapter methods:**
  1. `addReviewArtifact(phase, body)` (B) — shared with workflow #1
- **Notes:** Agent receives pre-scoped file list via `<config><files>` from workflow, so it doesn't independently scope. The fallback is described but normally unused.

### 11. agents/gsd-code-fixer.md
- **Direct I/O ops (planning-related):**
  1. Read REVIEW.md (`cat {review_path}` — Bin A get)
  2. Write REVIEW-FIX.md
  3. (Source edits via Edit/Write, `git checkout --` rollback, `git worktree add`, `gsd-sdk query commit` for fix commits — all out of scope; touching source code, not planning state)
- **Adapter methods:**
  1. `getReviewArtifact(phase)` (A) — shared
  2. `addReviewFixArtifact(phase, body)` (B) — shared
- **Notes:** Heavyweight worktree + atomic commit logic stays in agent; not adapter concern.

### 12. agents/gsd-ui-checker.md
- **Direct I/O ops:**
  1. Read UI-SPEC.md (primary input)
  2. Read CONTEXT.md if present
  3. Read RESEARCH.md if present
- **Adapter methods:**
  1. `getUiSpec(phase) -> UiSpec` (A) — shared
  2. `getPhaseContext(phase) -> Context | null` (A) — shared
  3. `getPhaseResearch(phase) -> Research | null` (A) — shared
- **Notes:** Read-only agent. Returns structured verdict to orchestrator; no file writes.

### 13. agents/gsd-ui-auditor.md
- **Direct I/O ops:**
  1. `mkdir -p .planning/ui-reviews` + ensure `.planning/ui-reviews/.gitignore` exists
  2. Write screenshots to `.planning/ui-reviews/${PADDED_PHASE}-${ts}/desktop.png` etc. (binary, but lives under `.planning/`)
  3. Write UI-REVIEW.md to `$PHASE_DIR/$PADDED_PHASE-UI-REVIEW.md`
  4. (Heavy grep over `src/` for Tailwind/strings — source code, out of scope)
  5. (`npx shadcn view`/`diff` — out of scope; tooling)
- **Adapter methods:**
  1. `ensureUiReviewDir() -> void` (B) — creates the storage location with .gitignore convention; adapter-specific (markdown places under `.planning/`, beads adapter likely uses external blob store or noop)
  2. `addUiReviewScreenshot(phase, kind: "desktop"|"mobile"|"tablet", bytes) -> void` (B) — binary asset attached to the review; for markdown adapter writes file, for beads adapter attaches to issue
  3. `addUiReview(phase, body)` (B) — shared with workflow #3
- **Notes:** Screenshot storage is novel — not seen in other artifacts. Flag for synthesis. The `.gitignore` is a markdown-adapter convention; other adapters won't need it.

### 14. agents/gsd-ui-researcher.md
- **Direct I/O ops:**
  1. Write UI-SPEC.md to `$PHASE_DIR/$PADDED_PHASE-UI-SPEC.md`
  2. (Reads CONTEXT.md, RESEARCH.md, REQUIREMENTS.md via `<required_reading>` — covered by other workflow batches; surface here just for completeness)
  3. (Codebase scout grep over `src/`, `tailwind.config.*`, `components.json` — source code, out of scope)
- **Adapter methods:**
  1. `addUiSpec(phase, body)` (B) — shared with workflow #4
- **Notes:** Designed mostly around tool discovery (shadcn, registries). Adapter only owns the UI-SPEC write.

### 15. agents/gsd-debugger.md
- **Direct I/O ops (DEBUG IS A STATE MACHINE STORED IN MARKDOWN):**
  1. `ls .planning/debug/*.md | grep -v resolved` — list active debug sessions
  2. Write initial `.planning/debug/{slug}.md` (status: gathering, frontmatter, sections)
  3. Repeated **field-scoped updates** to the debug file: frontmatter `status`/`updated`, "Current Focus" overwrite, "Symptoms" immutable-after-init, "Eliminated" append, "Evidence" append, "Resolution" overwrite
  4. `mkdir -p .planning/debug/resolved && mv .planning/debug/{slug}.md .planning/debug/resolved/` — archive
  5. Read `.planning/debug/knowledge-base.md` at start of investigation
  6. Append to `.planning/debug/knowledge-base.md` after archive (with conditional header creation)
  7. `gsd-sdk query commit "docs: resolve debug {slug}" .planning/debug/resolved/{slug}.md` — uses SDK for commit ✓
- **Adapter methods (extensive — debug is the most state-heavy area):**
  1. `listDebugSessions(filter?: "active"|"resolved"|"all") -> DebugSession[]` (A)
  2. `getDebugSession(slug) -> DebugSession | null` (A)
  3. `addDebugSession({slug, trigger, symptomsPrefilled?}) -> DebugSession` (B) — initializes with the full structured frontmatter+sections; for beads becomes a `gsd:debug` issue with structured fields
  4. `updateDebugSession(slug, patch: {status?, currentFocus?, appendEvidence?, appendEliminated?, resolution?}) -> void` (B) — granular, semantically-typed update with append vs overwrite per section. **Heavy Bin B** — encapsulates the "Update Rules" table from the debug protocol
  5. `archiveDebugSession(slug) -> void` (B) — state transition (active→resolved), for markdown also a path move; for beads issue close + label
  6. `getDebugKnowledgeBase() -> KnowledgeBaseEntry[]` (A)
  7. `appendDebugKnowledgeBase(entry: {slug, date, errorPatterns, rootCause, fix, filesChanged}) -> void` (B) — typed append with header-creation guard for the markdown adapter
- **Notes:** This agent is the **richest direct-I/O surface in the batch.** The debug file's section-scoped update semantics (overwrite Current Focus, append Evidence, append Eliminated, immutable Symptoms) need a structured `updateDebugSession` method or several specific methods (`recordEvidence`, `recordEliminated`, `setDebugFocus`, `setDebugResolution`). The pilot's `recordStateEvent` precedent suggests preferring named methods per event type. Flag for synthesis.

### 16. agents/gsd-debug-session-manager.md
- **Direct I/O ops:**
  1. Read debug file at `debug_file_path` (the agent's primary input)
  2. Write/append `## Specialist Review` section to debug file after specialist skill runs
  3. (Spawns gsd-debugger via Task — that agent owns the heavy I/O)
- **Adapter methods:**
  1. `getDebugSession(slug) -> DebugSession` (A) — shared with #15
  2. `appendDebugSpecialistReview(slug, content) -> void` (B) — typed section append; another candidate for unifying under `updateDebugSession({appendSpecialistReview: ...})`
- **Notes:** Inherits all debugger needs (#15). Adds one new typed section (Specialist Review).

### 17–22. Skills (router skills — auto-classified)
All six are thin `<execution_context>@~/.claude/get-shit-done/workflows/X.md</execution_context>` references with brief `<process>Execute @workflow end-to-end</process>` blocks. They:
- Declare `allowed-tools` capabilities used by their workflow.
- Parse `$ARGUMENTS` flag descriptors in `<context>` blocks for documentation only.
- Have NO direct I/O of their own.

| # | Skill | Inherits |
|---|-------|----------|
| 17 | commands/gsd/code-review.md | workflow #1 |
| 18 | commands/gsd/code-review-fix.md | workflow #2 |
| 19 | commands/gsd/ui-review.md | workflow #3 |
| 20 | commands/gsd/ui-phase.md | workflow #4 |
| 21 | commands/gsd/eval-review.md | workflow #5 |
| 22 | commands/gsd/review.md | workflow #6 |

### 23. commands/gsd/debug.md (NOT a thin router — exception)
This skill has substantive logic of its own. It implements three subcommands inline before delegating to `gsd-debug-session-manager`:
- **Direct I/O ops:**
  1. `ls .planning/debug/*.md | grep -v resolved` — active session check (`SUBCMD=debug` flow)
  2. `ls .planning/debug/*.md | grep -v resolved | head -5` — list subcommand output formatting
  3. Read `.planning/debug/{SLUG}.md` (or `.planning/debug/resolved/{SLUG}.md`) for `status` subcommand — parse frontmatter, Current Focus, Evidence count, Eliminated count, Resolution
  4. Read `.planning/debug/{SLUG}.md` and Write initial state for `continue`/new session flows (Step 3 explicitly says "Create `.planning/debug/{slug}.md` with initial state using the Write tool")
- **Adapter methods (mostly shared with #15):**
  1. `listDebugSessions(filter)` (A)
  2. `getDebugSession(slug, includeResolved?)` (A)
  3. `addDebugSession({slug, trigger, symptoms})` (B)
- **Notes:** Don't auto-classify this one — it's a real consumer of planning state, not a thin router.

## Cross-cutting observations from this batch

1. **Debug subsystem is a heavy direct-I/O surface, second only to `/gsd-progress`.** The debug session file uses section-scoped semantics (overwrite Current Focus, append Evidence, append Eliminated, immutable Symptoms after gathering). This won't survive a naive `getRecord/putRecord` adapter — a typed `updateDebugSession({appendEvidence?, appendEliminated?, setCurrentFocus?, setResolution?})` is needed, OR several named methods per event type (`recordEvidence`, `recordEliminated`, `setDebugFocus`, `setDebugResolution`). Plus archive transition + knowledge-base append. **Flag for synthesis dedup with any other batch that touches `.planning/debug/`.**

2. **Review/audit artifacts form a parallel family.** REVIEW.md, REVIEW-FIX.md, UI-REVIEW.md, UI-SPEC.md, EVAL-REVIEW.md all follow the same pattern: `get<X>(phase)` + `add<X>(phase, body)` where the body is structured markdown with frontmatter. All `add*` methods are Bin B because they have structured-template requirements; all `get*` are Bin A. The synthesizer might want a higher-order `getPhaseArtifact(phase, kind)` / `addPhaseArtifact(phase, kind, body)` to compress these — but the structured-body validation differs per kind, so per-noun methods may be cleaner.

3. **`workflows/eval-review.md` bypasses `gsd-sdk query commit`** — uses raw `git add` + `git commit -m "docs(...): ..."`. This is inconsistent with peers (code-review.md, ui-review.md, ui-phase.md, review.md all use `gsd-sdk query commit`). In the new architecture this should route through whatever the adapter uses to record artifact additions. Worth noting in the synthesis.

4. **`commands/gsd/debug.md` is the only non-router skill in this batch.** The others (code-review, code-review-fix, ui-review, ui-phase, eval-review, review) are pure thin routers and auto-classify cleanly. `debug.md` has its own list/status/continue logic that touches `.planning/debug/*` directly. The auto-classification rule needs an exception clause for "skill that pre-processes subcommands before delegating." Recommend the synthesizer note that subcommand-dispatcher skills are always non-router.

5. **`workflows/node-repair.md` is unique — no planning-state I/O at all.** It's a pure decision-tree directive describing how `execute-plan` should respond to task-verification failures. The "log to SUMMARY.md" guidance lives in the consumer's protocol, not here. Worth noting because at-a-glance it looks like a workflow that should have I/O.

6. **`undo.md` mostly operates on git-on-source, with three planning-state touchpoints:** `.phase-manifest.json` read, ROADMAP "Depends on:" string scan (Bin B — derived dependency graph), and PLAN.md `consumes` reference scan (Bin B — derived intra-phase dependency). The dependency-detection logic is non-trivial and is probably already needed by some future "blast-radius" tool — flag the proposed `findDependentPhases(phase)` and `findIntraPhasePlanDependencies(phase, plan)` for cross-batch dedup.

7. **UI-auditor introduces a binary-asset path: `.planning/ui-reviews/{phase-ts}/{desktop,mobile,tablet}.png`.** This is the only batch artifact that writes binaries to `.planning/`. The `.gitignore` block is markdown-adapter-specific — for a beads adapter the screenshots would attach to an issue or live in an external blob store. Need an `addUiReviewScreenshot(phase, kind, bytes)` adapter method, NOT a direct file write. Flag for synthesis — likely a unique adapter responsibility for this batch.

8. **Naming consistency check (against the convention sheet):** All proposed methods use convention verbs (`list`, `get`, `add`, `update`, `archive`, `find`, `append`) and convention nouns (`Phase`, `Plan`, `Summary`, `Uat`, `DebugSession`, `Roadmap`, `Requirement`). Two new compound nouns introduced that aren't in the sheet: `UiSpec`, `UiReview`, `Review`, `ReviewFix`, `EvalReview`, `AiSpec`, `Reviews` (cross-AI), `Context` (phase context), `Research` (phase research), `KnowledgeBaseEntry`, `PhaseManifest`, `ProjectMeta`. Recommend the synthesizer extend the noun sheet to canonicalize these.

9. **Adapter methods this batch proposed that overlap with other batches (likely):**
   - `listPhaseSummaries`, `listPhasePlans`, `getRequirements`, `getRoadmap*` — almost certainly proposed by every batch that consumes phase artifacts.
   - `getPhaseContext`, `getPhaseResearch` — likely proposed by discuss/research workflow batches.
   - `getUat`, `updateUatGapDiagnoses` — likely proposed by UAT/verify-work batches.
   - `addPhase`/`addX` artifact creators — likely overlap.
   - The debug-session methods (`listDebugSessions`, `getDebugSession`, `addDebugSession`, `updateDebugSession`, `archiveDebugSession`) — should be unique to this batch (no other batch should touch `.planning/debug/`), but worth confirming.

## Bin-by-bin counts

- Bin A: 19 unique operations (list/get/find queries — bare reads, optionally filtered)
- Bin B: 22 unique operations (structured writes, derived joins, multi-section updates, state transitions, typed appends)
- Bin C: 0 (no operations identified as obsolete in the new architecture)
- Bin D: 0 (no pure presentation formatters surfaced — pillar tables and inline summaries are workflow-formatting concerns, not adapter)
- Direct I/O leaks found across this batch: ~36 distinct hits across 12 artifacts (workflow.code-review: 4, code-review-fix: 5, ui-review: 4, ui-phase: 1, eval-review: 4, review: 7, diagnose-issues: 2, undo: 5, gsd-code-reviewer: 1, gsd-code-fixer: 2, gsd-ui-checker: 3, gsd-ui-auditor: 3, gsd-ui-researcher: 1, gsd-debugger: 7, gsd-debug-session-manager: 2, commands/gsd/debug: 4)
- Routers auto-classified: 6 (skills 17–22)
