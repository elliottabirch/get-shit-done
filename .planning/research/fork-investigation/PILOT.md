# Pilot Fork-Investigation Findings

Date: 2026-04-30
Purpose: Validate rubric & output format before scaling to ~260 artifacts.

## Classification Table

| # | Path | Kind | I/O surface | Bin | Use case (1 sentence) | Direct I/O ops | Coordination logic | Adapter implications |
|---|------|------|-------------|-----|-----------------------|----------------|---------------------|----------------------|
| 1 | commands/gsd/progress.md | skill | n/a (router) | n/a | Thin router that loads workflow file via `@~/.claude/...` reference and dispatches `/gsd-progress`. | None (pure router; declares Read/Bash/Grep/Glob in allowed-tools, used by workflow). | None — defers to workflow. | Inherits workflow's adapter needs. |
| 2 | workflows/progress.md | workflow | Mixed | n/a (consumer) | Status report + smart routing: loads init/state/roadmap, counts plans/summaries on disk, runs forensic audit. | `ls` of phase dirs (plan/summary/UAT counts); `grep -l "status: diagnosed/partial"` of UAT files; `ls .planning/HANDOFF.json` and `.continue-here.md` and `phases/*/*HANDOFF*.md`; `grep -rl "defer to Phase"` across phase artifacts; `ls .planning/MEMORY.md` and `memory/*.md` + grep for keywords; `ls .planning/todos/pending/*.md` + keyword scan; `git status --porcelain`. | Routes A–F decision tree (pending UAT, plans-vs-summaries, milestone boundary); 6-check forensic audit aggregation; verdict assembly. | Needs adapter methods: `countPhasePlanArtifacts(phase)`, `listUatByStatus(phase, status)`, `listOrphanedHandoffs()`, `findDeferredScopeRefs()`, `listMemoryEntries(filter)`, `listPendingTodos(keywords?)`, `gitStatusForCode()`. (Most map to **Bin A** queries; routing logic stays in workflow.) |
| 3 | sdk/dist/query/progress.js | sdk-query | N/A | A (mostly) + B (statsJson) | Implements `progress`, `progress.bar`, `progress.table`, `stats`, `todoMatchPhase`, `listTodos`, `todoComplete`. | (This IS the I/O implementation.) | `progressJson` = scan dirs + count + per-phase status from VERIFICATION.md (Bin A: bare scan + parse). `progressBar`/`progressTable` = formatting wrappers (Bin A). `statsJson` = Bin B (joins roadmap parse + disk scan + REQUIREMENTS parsing + STATE parsing + git shell-out). `todoMatchPhase` = Bin B (cross-references todos with roadmap-phase + plan files + keyword scoring). `todoComplete` = Bin B (read+rewrite+move file with timestamp injection). `listTodos` = Bin A. | Adapter must expose: `listPhaseArtifacts(phase) -> {plans, summaries, verificationStatus}` (A); separate named methods `getStats()` (B), `matchTodosToPhase()` (B), `completeTodo(id)` (B). Bar/table formatting is **presentation**, not adapter concern — keep out of interface. |
| 4 | commands/gsd/add-phase.md | skill | SDK-only | n/a | Thin router that delegates entirely to `add-phase` workflow. | None. | None. | Inherits workflow's needs. |
| 5 | workflows/add-phase.md | workflow | SDK-only | n/a (consumer) | Add a new integer phase to current milestone: parse args → `gsd-sdk query init.phase-op` → `gsd-sdk query phase.add` → update STATE.md "Roadmap Evolution" section. | None directly — but step "update_project_state" instructs Claude to "Read STATE.md" and append a Roadmap Evolution entry, which in practice is a Read+Edit. **This is a hidden direct-I/O op.** | Args parsing; "create section if missing" guard for Roadmap Evolution. | Needs `adapter.addPhase(description) -> {phase_number, slug, directory}` (B — already named) AND `adapter.appendStateEvent({type: "roadmap_evolution", text})` (B — domain event append, not raw write). Surfacing the STATE.md update as an adapter method removes the only direct-I/O leak in this workflow. |
| 6 | agents/gsd-roadmapper.md | agent | Direct | n/a (consumer) | Subagent spawned by `/gsd-new-project` to derive phases from REQUIREMENTS.md, validate 100% coverage, write ROADMAP.md/STATE.md/update REQUIREMENTS.md traceability. | `Write ROADMAP.md` (full file); `Write STATE.md` (full file from template); `Edit REQUIREMENTS.md` traceability section (read + section append). Tools list: Read, Write, Bash, Glob, Grep. | Phase derivation from requirement categories; goal-backward success criteria; coverage validation; granularity calibration; UI-hint detection (keyword scan). | Major: roadmap creation is the canonical "write ROADMAP.md" path. Needs `adapter.createRoadmap({phases, milestone}) -> void` (B — multi-section structured write) and `adapter.createInitialState(template) -> void` (B). The traceability update is `adapter.updateRequirementsTraceability(mappings)` (B). All three are Bin B because the agent writes structured markdown the adapter must translate to its native form (e.g., bd issues for the beads adapter). |

## Per-artifact detail

### 1. commands/gsd/progress.md (skill)
- **Kind:** skill (router shell)
- **I/O surface:** n/a — pure router; the file is a frontmatter + objective + `@~/.claude/get-shit-done/workflows/progress.md` reference.
- **Bin:** n/a
- **Use case:** Entrypoint for `/gsd-progress`; tells Claude to execute the workflow end-to-end.
- **Direct I/O operations enumerated:** None in this file. (`allowed-tools: Read, Bash, Grep, Glob, SlashCommand` — capabilities granted, not used here.)
- **Coordination logic:** None.
- **Adapter implications:** Whatever the workflow needs.
- **Bin assignment:** n/a.

### 2. workflows/progress.md (workflow)
- **Kind:** workflow (executed by `/gsd-progress`)
- **I/O surface:** **Mixed.** Most state extraction goes through `gsd-sdk query` (`init.progress`, `roadmap.analyze`, `state-snapshot`, `progress.bar`, `audit-uat`, `roadmap.get-phase`, `summary-extract`, `config-get`). But several disk inspections bypass the SDK.
- **Bin:** n/a (consumer)
- **Use case:** Generate progress report + smart-route to next action; `--forensic` flag adds 6-check integrity audit.
- **Direct I/O operations enumerated:**
  - `ls -1 .planning/phases/<dir>/*-PLAN.md|*-SUMMARY.md|*-UAT.md` — count plans/summaries/UATs per phase (route step 1).
  - `grep -l "status: diagnosed\|status: partial" .planning/phases/<dir>/*-UAT.md` — detect UAT gaps for routing (step 1.5).
  - `ls .planning/debug/*.md` and `grep -v resolved | wc -l` — count active debug sessions (position step).
  - `ls .planning/HANDOFF.json .planning/phases/*/.continue-here.md .planning/phases/*/*HANDOFF*.md` — orphaned handoff check (forensic 2).
  - `grep -rl "defer to Phase\|future phase\|out of scope Phase\|deferred to Phase" .planning/phases/` (forensic 3).
  - `ls .planning/MEMORY.md .planning/memory/*.md` then grep for `pending|status|deferred|...` (forensic 4).
  - `ls .planning/todos/pending/*.md` then keyword scan (forensic 5).
  - `git status --porcelain` (forensic 6 — code, not state, but still direct shell I/O).
- **Coordination logic:** Decision-tree routing across A/B/C/D/E/E.2/F branches (UAT-incomplete, UAT-gaps, unexecuted plans, milestone boundary, between-milestones); aggregation + verdict for forensic checks; report assembly.
- **Adapter implications:** Each direct ls/grep above is a hookable operation in the new architecture. Proposed:
  - `adapter.countPhaseArtifacts(phase) -> {plans, summaries, uats}` — Bin A (bare count over a record set).
  - `adapter.listUat(phase, status?) -> Uat[]` — Bin A (filtered query).
  - `adapter.listDebugSessions(active?) -> DebugSession[]` — Bin A.
  - `adapter.listOrphanedHandoffs() -> HandoffRef[]` — Bin A (existence query over known paths).
  - `adapter.findDeferredScopeRefs() -> {file, ref, missingPhase}[]` — Bin B (cross-references phase artifacts with roadmap to compute "missing"; coordination logic).
  - `adapter.listMemoryEntries(keywordFilter) -> Entry[]` — Bin A.
  - `adapter.listPendingTodos(keywordFilter?) -> Todo[]` — Bin A (already exists as `listTodos` in SDK; needs filter param).
  - `gitStatusOutsidePlanning() -> string[]` — **NOT an adapter concern.** It's git on the user's source code, orthogonal to planning storage. Keep as a separate utility.
- **Bin assignment:** Mostly Bin A. `findDeferredScopeRefs` is Bin B because it joins phase artifacts with ROADMAP and computes a derived "missing" set.

### 3. sdk/dist/query/progress.js (SDK query)
- **Kind:** sdk-query (the I/O implementation itself)
- **I/O surface:** N/A — it IS the SDK.
- **Bin:** Per-export (file contains 7 exports):
  - `progressJson` — **Bin A.** `readdir(phasesDir)` → per-dir `readdir` → count `*-PLAN.md`/`*-SUMMARY.md` → `determinePhaseStatus` reads VERIFICATION.md regex-match. Bare scan + parse + return. Maps cleanly to `adapter.listPhaseProgress() -> PhaseProgress[]`.
  - `progressBar` / `progressTable` — **Bin A** (or even out-of-scope: pure presentation over `progressJson` data; not adapter concerns).
  - `determinePhaseStatus` — internal helper (file read + regex). Bin A.
  - `statsJson` — **Bin B.** Joins (a) milestone extraction from ROADMAP, (b) disk scan of phases (filtered by milestone), (c) REQUIREMENTS.md `[x]/[ ]` checkbox parsing, (d) STATE.md `last_activity` regex, (e) git shell-out for commit count + first-commit date. Five sources merged into one structured result with derived percent — clearly named coordination.
  - `todoMatchPhase` — **Bin B.** Lists pending todos, fetches phase via `roadmapGetPhase`, fetches phase plans via `findPhase`, then keyword-scores todos against phase + tracks file overlap. Coordination + scoring logic.
  - `listTodos` — **Bin A.** Read pending dir, parse frontmatter, optional area filter.
  - `todoComplete` — **Bin B.** Move-with-mutation: read source, prepend `completed:` timestamp, write to `completed/`, unlink source. Three I/O ops + a state transition. (Could argue Bin A "putRecord(todos/completed/X, body); deleteRecord(todos/pending/X)" but the timestamp injection is domain logic the adapter must own.)
- **Use case:** Implements `progress.json`, `progress.bar`, `progress.table`, `stats`, `todo match-phase`, `list-todos`, `todo complete`.
- **Direct I/O operations enumerated:** All node:fs reads/writes; one `execGit` shell-out in `statsJson`.
- **Coordination logic:** See per-export Bin assignments.
- **Adapter implications:** Shape adapter interface like:
  - `listPhaseProgress()` (A) — replaces `progressJson`.
  - `getStats()` (B) — replaces `statsJson`; for non-markdown adapters (beads), git-commit metrics either move to a separate utility or become a no-op.
  - `listTodos(area?)` (A), `completeTodo(id)` (B), `matchTodosToPhase(phase)` (B).
- **Bin assignment:** A for bare scans, B for the three coordinated operations.

### 4. commands/gsd/add-phase.md (skill)
- **Kind:** skill (router)
- **I/O surface:** n/a (router) — but inherits SDK-only from its workflow.
- **Bin:** n/a
- **Use case:** Entry point for `/gsd-add-phase <description>`; defers to workflow.
- **Direct I/O operations enumerated:** None.
- **Coordination logic:** None.
- **Adapter implications:** Inherited from workflow #5.

### 5. workflows/add-phase.md (workflow)
- **Kind:** workflow
- **I/O surface:** **SDK-only** *as written*, **but with a hidden Direct leak.** Steps 1–3 use `gsd-sdk query init.phase-op` and `gsd-sdk query phase.add`. Step `update_project_state` says "Read `.planning/STATE.md` … add entry … create section if missing" — this is a Read+Edit pair Claude executes via tools, bypassing the SDK.
- **Bin:** n/a (consumer)
- **Use case:** Add a new integer phase to current milestone (next-int compute, slug, dir create, ROADMAP insertion, STATE event log).
- **Direct I/O operations enumerated:**
  - **Implicit:** Read STATE.md + Edit STATE.md to append a "Roadmap Evolution" entry. This is the only direct op, and it's the same class of leak as `/gsd-progress`.
- **Coordination logic:** Argument validation; presence-of-section check before insert.
- **Adapter implications:**
  - `adapter.addPhase(description) -> {number, slug, directory}` — **Bin B** (already named; phase-number compute + slug + dir + roadmap insert are coordinated multi-write).
  - `adapter.recordStateEvent({type: "roadmap_evolution", text})` — **Bin B** (domain-typed append, not a raw STATE.md write; for beads adapter this becomes an issue comment / status note).
- **Bin assignment:** Both Bin B.

### 6. agents/gsd-roadmapper.md (agent)
- **Kind:** agent (subagent spawned by `/gsd-new-project`)
- **I/O surface:** **Direct.** Tools list: Read, Write, Bash, Glob, Grep. Step 7 `Write Files Immediately` explicitly mandates "ALWAYS use the Write tool to create files — never use Bash heredoc" for ROADMAP.md, STATE.md, and updates REQUIREMENTS.md. No `gsd-sdk query` invocations to write state.
- **Bin:** n/a (consumer)
- **Use case:** Derive phase structure from REQUIREMENTS.md, validate 100% coverage, write initial ROADMAP.md/STATE.md and update REQUIREMENTS.md traceability.
- **Direct I/O operations enumerated:**
  - `Read` of PROJECT.md, REQUIREMENTS.md, research/SUMMARY.md (if exists), config.json, `.claude/skills/`/`.agents/skills/` SKILL.md.
  - `Write` of `.planning/ROADMAP.md` (full file).
  - `Write` of `.planning/STATE.md` (full file from template).
  - `Edit` of `.planning/REQUIREMENTS.md` (insert/update Traceability section).
- **Coordination logic:** Phase identification (group→deps→boundaries→assign); goal-backward success-criteria derivation (2–5 per phase, cross-checked); coverage validation (no orphans, no dupes); granularity calibration (coarse/standard/fine → phase-count compression); UI-hint keyword scan; gap resolution decision tree.
- **Adapter implications:** This is the heavyweight write path. Three named methods needed:
  - `adapter.createRoadmap({milestoneVersion, milestoneName, phases: PhaseSpec[]}) -> void` — **Bin B.** Phases include goal/depends/requirements/criteria/UI-hint; the markdown adapter writes the dual checklist+detail+progress-table structure, the beads adapter creates issues with deps + labels.
  - `adapter.createInitialState({projectCode, projectTitle, ...}) -> void` — **Bin B.** Template-driven structured write; for beads, becomes config + project-meta record.
  - `adapter.updateRequirementsTraceability(mappings: {reqId, phase, status}[]) -> void` — **Bin B.** Coordinated section update; for beads, attaches `phase:N` labels to requirement issues.
- **Bin assignment:** All three Bin B. None decomposes to bare put/get because the markdown structure (dual representations + UI hint + traceability table) IS the domain logic.

## Cross-cutting observations

1. **The "Direct" I/O leak pattern repeats.** `/gsd-progress` was the trigger case, but `/gsd-add-phase` and `gsd-roadmapper` show the same pattern: workflow says "now Read X and append/Edit it" outside SDK. Any classifier that only counts `gsd-sdk query` won't catch these. The fork's adapter must surface every "Read/Write/Edit of `.planning/*`" as a named method.
2. **Skill files are uniformly thin routers.** Both skill files in this pilot delegate entirely to a workflow. Classifying skills can be automated: if the file is essentially `<execution_context>@~/.claude/...workflows/X.md</execution_context>`, mark it `n/a (router)` and inherit from the workflow. This will save effort at scale.
3. **SDK queries decompose into A and B at function granularity, not file granularity.** `progress.js` contains both pure-scan (Bin A) and coordinated (Bin B) operations. Scaling to 260 artifacts means tabling at the **export** level for SDK files, not the file level.
4. **Presentation logic is not an adapter concern.** `progressBar`/`progressTable` format the output of `progressJson` for human display. They should NOT be adapter methods — they're consumers of the adapter. The rubric should add this as an explicit "out-of-scope" category to avoid creating noisy bare-formatter adapter calls.
5. **`git status` and similar non-`.planning/` shell-outs are orthogonal to the adapter.** They exist in the workflow but are about source code, not planning state. The forensic audit's check 6 is in this category. Don't bin these.

## Rubric stress-test

- **A/B/C clarity:** Mostly clear. The judgment edge: `todoComplete` (file rename + timestamp injection) is technically two bare ops + a string mutation, but the mutation is domain logic, so I called it B. A purist might call it "A + A with the rename mutation handled by caller." Recommend explicit rule: **if the operation injects derived data (timestamps, computed slugs, phase numbers) between read and write, it's B**.
- **I/O surface ambiguity:** `workflows/add-phase.md` looked SDK-only on first scan but has a Read+Edit STATE.md leak in step 4. Recommend a search rule: **for every workflow, grep for "Read .planning/" or "edit/update STATE.md/ROADMAP.md/REQUIREMENTS.md" outside `gsd-sdk query` blocks**. These are the leaks. (`workflows/progress.md` had ~7 of them; `workflows/add-phase.md` had 1; `gsd-roadmapper.md` had 3.)
- **Adapter method naming obviousness:** Mostly obvious for SDK exports (already named `progress`, `stats`, `add-phase` etc.). Less obvious for direct-I/O leaks: I had to invent names like `recordStateEvent`, `findDeferredScopeRefs`, `listOrphanedHandoffs`. Different classifiers might invent slightly different names — recommend a **convention sheet** before scaling: verbs (`list`, `count`, `get`, `add`, `update`, `record`, `complete`), domain nouns (`Phase`, `Plan`, `Summary`, `Uat`, `Todo`, `Memory`, `Handoff`, `StateEvent`).
- **Missing/redundant columns:** "Use case" and "Direct I/O ops" sometimes overlap; "Coordination logic" and "Adapter implications" overlap when coordination IS the named-method rationale. Suggest collapsing per-artifact-detail into 5 fields: **Kind / I/O surface / Operations (with Bin per op) / Adapter methods proposed (with Bin) / Notes**. Drop the standalone "Coordination logic" block; surface that information per-operation.
- **Missing dimension — the agent/subagent layer.** `gsd-roadmapper` is a different consumer kind than `commands/gsd/*` skill or `workflows/*`. Subagents are spawned by orchestrator slash commands; their direct-I/O is dangerous because hook interception is more fragile across subagent spawn. Recommend adding **Kind = `agent`** as a top-level type with a flag: "spawned-by orchestrator" — this affects hook strategy.

## Recommendations

**Status: ready to scale, with three small refinements first.**

1. **Add a "presentation/out-of-scope" bin** (Bin D? or just leave blank with reason) for pure formatters like `progressBar`/`progressTable`. Don't propose adapter methods for them.
2. **Adopt operation-level (not file-level) Bin assignment for SDK files.** Table SDK exports as one row per export.
3. **Codify the "leak grep" rule:** for every workflow/agent, explicitly grep for direct Read/Write/Edit of `.planning/*` outside SDK calls. Treat every hit as a direct-I/O op requiring an adapter method. This was where surprises lived in this pilot.
4. **Convention sheet before scaling:** verbs + domain nouns table, so 260 artifacts produce consistent method names.

With (1)–(4), the rubric is solid and scales.
