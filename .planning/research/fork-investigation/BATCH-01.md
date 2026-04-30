# Batch 01 — Phase + plan lifecycle

Date: 2026-04-30
Artifacts assigned: 26
Output by: BATCH-01 fork-investigation classifier

## Classification table

| # | Path | Kind | I/O surface | Bin | Use case (≤15 words) | Direct I/O ops | Adapter methods proposed (with Bin) | Notes |
|---|------|------|-------------|-----|----------------------|----------------|-------------------------------------|-------|
| 1 | sdk/dist/query/phase.js::findPhase | sdk-query-export | n/a | A | Locate phase directory by number; archived fallback | n/a | findPhase(phaseId) (A) | Bin A — bare scan, archived list, file-stats join, no derivation |
| 2 | sdk/dist/query/phase.js::phasePlanIndex | sdk-query-export | n/a | B | Plan metadata + wave grouping for phase | n/a | listPhasePlanIndex(phase) (B) | Bin B — frontmatter parse + task counting + wave bucketing + completion derivation |
| 3 | sdk/dist/query/phase-lifecycle.js::phaseAdd | sdk-query-export | n/a | B | Append integer phase to current milestone | n/a | addPhase(description, customId?) (B) | Number compute + slug + dir + roadmap section insert (already named) |
| 4 | sdk/dist/query/phase-lifecycle.js::phaseAddBatch | sdk-query-export | n/a | B | Append multiple phases atomically in one lock | n/a | addPhaseBatch(descriptions[]) (B) | Same as phaseAdd, batched under single roadmap lock |
| 5 | sdk/dist/query/phase-lifecycle.js::phaseInsert | sdk-query-export | n/a | B | Insert decimal phase after target | n/a | insertPhase(afterPhase, description) (B) | Decimal numbering + roadmap insert |
| 6 | sdk/dist/query/phase-lifecycle.js::phaseScaffold | sdk-query-export | n/a | B | Scaffold context/uat/verification/phase-dir templated files | n/a | scaffoldPhaseArtifact(type, phase, name?) (B) | Template injection (date, name) — domain logic |
| 7 | sdk/dist/query/phase-lifecycle.js::phaseRemove | sdk-query-export | n/a | B | Delete phase + renumber subsequent + sync ROADMAP/STATE | n/a | removePhase(phase, force?) (B) | Heavy cascade: dir delete, sibling rename, roadmap rewrite, state decrement |
| 8 | sdk/dist/query/phase-lifecycle.js::phaseComplete | sdk-query-export | n/a | B | Mark phase done; cascade ROADMAP, REQS, STATE | n/a | completePhaseAndCascade(phase) (B) | Pilot's canonical Bin B example |
| 9 | sdk/dist/query/phase-lifecycle.js::phasesClear | sdk-query-export | n/a | B | Delete all non-backlog phase dirs (with --confirm) | n/a | clearPhases(confirm) (B) | Filter + bulk delete; backlog (999.x) preservation is domain logic |
| 10 | sdk/dist/query/phase-lifecycle.js::phasesList | sdk-query-export | n/a | A | List phase dirs/files; optional type filter | n/a | listPhases({type?, phase?, includeArchived?}) (A) | Bare directory listing with filter — fits getRecord/listCollection |
| 11 | sdk/dist/query/phase-lifecycle.js::phaseNextDecimal | sdk-query-export | n/a | B | Next available decimal under base phase | n/a | findNextDecimalPhase(basePhase) (B) | Joins disk + roadmap; computes max+1 |
| 12 | sdk/dist/query/phase-lifecycle.js::phasesArchive | sdk-query-export | n/a | B | Move milestone phase dirs to milestones/{ver}-phases | n/a | archivePhases(version) (B) | Filter by milestone + bulk rename |
| 13 | sdk/dist/query/phase-lifecycle.js::milestoneComplete | sdk-query-export | n/a | B | Archive ROADMAP/REQS/audit + write MILESTONES.md + update STATE | n/a | completeMilestone(version, name?, archivePhases?) (B) | Aggregates accomplishments from SUMMARYs; multi-file write; very heavy |
| 14 | sdk/dist/query/phase-lifecycle.js::replaceInCurrentMilestone | sdk-query-export | n/a | C | String-replace helper internal to roadmap rewrites | n/a | (eliminate; markdown-shape only) | Helper for current adapter; beads adapter doesn't need it |
| 15 | sdk/dist/query/phase-lifecycle.js::readModifyWriteRoadmapMd | sdk-query-export | n/a | C | Locked atomic RMW around ROADMAP.md | n/a | (eliminate; concurrency primitive) | Lock-pattern primitive; per-adapter implementation detail |
| 16 | sdk/dist/query/phase-list-queries.js::phaseListArtifacts | sdk-query-export | n/a | A | List CONTEXT/SUMMARY/VERIFICATION/RESEARCH files in phase | n/a | listPhaseArtifacts(phase, type) (A) | Bare scan + extension filter |
| 17 | sdk/dist/query/phase-list-queries.js::phaseListPlans | sdk-query-export | n/a | A | List PLAN files in a phase with optional schema-key filter | n/a | listPhasePlans(phase, schemaKey?) (A) | Bare scan + frontmatter key existence check |
| 18 | sdk/dist/query/phase-ready.js::checkPhaseReady | sdk-query-export | n/a | B | Phase readiness snapshot + suggested next_step | n/a | checkPhaseReady(phase) (B) | Joins findPhase + roadmapAnalyze + UI-spec scan + dep walk; derived next_step |
| 19 | sdk/dist/query/plan-task-structure.js::planTaskStructure | sdk-query-export | n/a | A | Tasks/checkpoints/wave from PLAN.md frontmatter | n/a | getPlanTaskStructure(planPath) (A) | Bare parse via parsePlan; no cross-record join |
| 20 | sdk/dist/query/roadmap-update-plan-progress.js::roadmapUpdatePlanProgress | sdk-query-export | n/a | B | Sync ROADMAP progress table from disk PLAN/SUMMARY counts | n/a | updateRoadmapPlanProgress(phase) (B) | Disk-derived counts + status compute + atomic ROADMAP rewrite |
| 21 | get-shit-done/workflows/add-phase.md | workflow | Mixed | n/a (consumer) | Add integer phase + log roadmap evolution in STATE | (1 leak below) | addPhase(B) + recordStateEvent(B) | Same hidden Read+Edit STATE.md leak as PILOT |
| 22 | get-shit-done/workflows/insert-phase.md | workflow | SDK-only | n/a (consumer) | Insert decimal phase + STATE pointer + roadmap evolution | None — `state.patch` + `state.add-roadmap-evolution` SDK | insertPhase(B), updateStatePointers(B), recordStateEvent(B) | Already routes through SDK; explicit "no raw Edit" warning |
| 23 | get-shit-done/workflows/remove-phase.md | workflow | SDK-only | n/a (consumer) | Remove future phase + git commit | None | removePhase(B), commit (out of scope) | Reads STATE/ROADMAP for parsing only — handled by init.phase-op |
| 24 | get-shit-done/workflows/plan-phase.md | workflow | Mixed | n/a (consumer) | Plan a phase via researcher/planner/checker w/ many gates | (12 leaks below) | (12 methods below) | The largest leak surface in this batch |
| 25 | get-shit-done/workflows/plan-review-convergence.md | workflow | Mixed | n/a (consumer) | Cross-AI plan↔review loop until HIGH==0 | (2 leaks below) | listPhasePlanFiles(A), getPhaseReviewsFile(A) | Spawns Agents that run other skills; orchestrator-only logic |
| 26 | get-shit-done/workflows/execute-phase.md | workflow | Mixed | n/a (consumer) | Execute all plans in a phase (waves, verify, complete) | (10 leaks below) | (10 methods below) | Heaviest workflow; many SDK calls + several direct ops |
| 27 | get-shit-done/workflows/execute-plan.md | workflow | Mixed | n/a (consumer) | Execute single PLAN.md → SUMMARY.md + state cascade | (8 leaks below) | (8 methods below) | Per-plan executor; lots of disk peeking + SDK state calls |
| 28 | agents/gsd-roadmapper.md | agent | Direct | n/a (consumer) | Derive phases from REQS, write ROADMAP/STATE/REQS | createRoadmap, createInitialState, updateRequirementsTraceability | (3 methods, all Bin B) | Same as PILOT entry — covered for completeness in batch context |
| 29 | agents/gsd-planner.md | agent | Mixed | n/a (consumer) | Subagent that writes PLAN.md files; updates ROADMAP | (4 leaks below) | (4 methods below) | tools: Read, Write, Bash + SDK calls; mixed surface |
| 30 | agents/gsd-plan-checker.md | agent | SDK-only | n/a (consumer) | Subagent that validates PLAN.md frontmatter/structure | None — only SDK queries + Read | (none new) | tools: Read, Bash, Glob, Grep — no Write/Edit; reads phase artifacts |
| 31 | agents/gsd-executor.md | agent | Mixed | n/a (consumer) | Execute PLAN tasks; commit; write SUMMARY.md; cascade state | (5 leaks below) | (5 methods below) | tools: Read, Write, Edit, Bash, Grep, Glob — major write surface |
| 32 | commands/gsd/add-phase.md | skill | Router | n/a | Router → workflows/add-phase.md | n/a | inherits from workflow | |
| 33 | commands/gsd/insert-phase.md | skill | Router | n/a | Router → workflows/insert-phase.md | n/a | inherits from workflow | |
| 34 | commands/gsd/remove-phase.md | skill | Router | n/a | Router → workflows/remove-phase.md | n/a | inherits from workflow | |
| 35 | commands/gsd/plan-phase.md | skill | Router | n/a | Router → workflows/plan-phase.md | n/a | inherits from workflow | |
| 36 | commands/gsd/execute-phase.md | skill | Router | n/a | Router → workflows/execute-phase.md | n/a | inherits from workflow | |
| 37 | commands/gsd/plan-review-convergence.md | skill | Router | n/a | Router → workflows/plan-review-convergence.md | n/a | inherits from workflow | |
| 38 | commands/gsd/plan-milestone-gaps.md | skill | Router | n/a | Router → workflows/plan-milestone-gaps.md | n/a | inherits from workflow (NOT in this batch's workflows) | |
| 39 | commands/gsd/add-backlog.md | skill | **Direct** | n/a (consumer) | Inline workflow that writes ROADMAP + creates dir | (3 leaks below) | listBacklogEntries(A), addBacklogEntry(B), addPhaseDir(B) | NOT a router — full workflow inline; rare among skills |
| 40 | commands/gsd/review-backlog.md | skill | **Direct** | n/a (consumer) | Inline workflow that lists/promotes/removes 999.x | (4 leaks below) | listBacklogEntries(A), promoteBacklogEntry(B), removeBacklogEntry(B), updateRoadmapBacklogSection(B) | NOT a router — inline workflow |

(Total rows: 26 artifacts represented as 40 lines because per-export rows for SDK files inflate the count. Artifact-level: 6 SDK files + 7 workflows + 4 agents + 9 skills = 26.)

## Per-artifact detail

### SDK queries (per-export)

**phase.js** — 2 exports.
- `findPhase`: bare disk scan; archive fallback; no derivation. **Bin A**.
- `phasePlanIndex`: opens each PLAN file, parses frontmatter, counts tasks (XML or markdown), groups by wave, computes `incomplete` from SUMMARY presence. **Bin B** (multi-source coordination).

**phase-lifecycle.js** — 13 exports. The bulk of phase domain logic.
- `phaseAdd`/`phaseAddBatch`/`phaseInsert`: phase-number compute + slug + dir creation + ROADMAP insertion under lock. **Bin B**.
- `phaseScaffold`: template-driven file write with date/name injection (domain logic). **Bin B**.
- `phaseRemove`: cascading delete, sibling renumber on disk, ROADMAP regex rewrite, STATE total_phases decrement. **Bin B**.
- `phaseComplete`: same canonical pattern as PILOT (ROADMAP checkbox + progress table + plan checkboxes + REQUIREMENTS traceability + STATE current/status/last_activity/perf_metrics + frontmatter `completed_phases`/`percent`/`status`). **Bin B**.
- `phasesClear`: filter + bulk delete with backlog (999.x) preservation rule. **Bin B**.
- `phasesList`: bare scan with optional type/phase filter, optional archived merge. **Bin A**.
- `phaseNextDecimal`: joins disk + roadmap to compute max+1. **Bin B**.
- `phasesArchive`: filter + bulk rename to milestones/{version}-phases. **Bin B**.
- `milestoneComplete`: scans phases, reads each SUMMARY for `one-liner` + task counts, copies ROADMAP/REQS/audit, prepends MILESTONES.md entry, updates STATE, optionally archives phases. **Bin B**.
- `replaceInCurrentMilestone` and `readModifyWriteRoadmapMd`: helpers used internally by other handlers. They are **Bin C** (eliminate from adapter interface) — they encode markdown-specific concerns (the `</details>` separator pattern, file-level lockfile primitive). The bd adapter has no equivalent because there's no single "ROADMAP.md" to lock; phases are issues.

**phase-list-queries.js** — 2 exports. Both **Bin A** (bare scan + filter; no derivation).

**phase-ready.js** — 1 export. `checkPhaseReady` joins `findPhase` + `roadmapAnalyze` + UI-indicator regex on ROADMAP heading + UI-SPEC.md existence + dependency walk through prior phases + derived `next_step` enum. **Bin B**.

**plan-task-structure.js** — 1 export. `planTaskStructure` reads one file, calls `parsePlan`, returns derived task list. Single-source parse, no joins. **Bin A**.

**roadmap-update-plan-progress.js** — 1 export. Reads phase via `findPhase`, computes `isComplete`/`status` from disk PLAN/SUMMARY counts, atomically rewrites ROADMAP table row + plan-count text + checkbox + per-summary plan checkboxes. **Bin B**.

### Workflows

#### `workflows/add-phase.md`
- **Direct I/O ops:**
  1. Step `update_project_state`: "Read `.planning/STATE.md`" then add a Roadmap Evolution entry (Read+Edit). Same hidden leak as PILOT.
- **Adapter methods:** `addPhase(description)` (B) + `recordStateEvent({type:"roadmap_evolution", text})` (B). Identical to PILOT entry; included here because the file is in this batch.

#### `workflows/insert-phase.md`
- **Direct I/O ops:** None — workflow explicitly calls `gsd-sdk query state.patch` and `gsd-sdk query state.add-roadmap-evolution` and warns against raw `Edit`/`Write`. Already conforms to the architecture goal.
- **Adapter methods:** `insertPhase(afterPhase, description)` (B); `updateStatePointers({"Current Phase","Next recommended run"})` (B); `recordStateEvent({type:"roadmap_evolution", action:"inserted", urgent})` (B).
- **Notes:** This file is the cleanest example in the batch — proves the leak class is fixable.

#### `workflows/remove-phase.md`
- **Direct I/O ops:** None directly. The workflow says "Also read STATE.md and ROADMAP.md content for parsing current position" but those reads come through `gsd-sdk query init.phase-op` JSON; the workflow consumes parsed data, not files.
- **Adapter methods:** `removePhase(phase, force?)` (B). The git commit step is out-of-scope (source-code adjacent — see Rubric Rule 6).

#### `workflows/plan-phase.md`
- **Direct I/O ops** (each item is a hookable adapter call required by the fork):
  1. `mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"` (step 2). Bypass when init handles it.
  2. PRD path: `cat "$PRD_FILE"` then "Write CONTEXT.md" via Claude tools (step 3.5). PRD file is OUTSIDE `.planning/` so the read is out-of-scope; the **Write to `${phase_dir}/${padded_phase}-CONTEXT.md`** is in-scope.
  3. `ls "${PHASE_DIR}"/*-AI-SPEC.md` (step 4.5).
  4. `grep "Selected Framework:" "${AI_SPEC_FILE}"` (step 4.5).
  5. `grep -l "## Validation Architecture" "${PHASE_DIR}"/*-RESEARCH.md` (step 5.5).
  6. Read template `~/.claude/get-shit-done/templates/VALIDATION.md` (template — out-of-scope) + **Write to `${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md`** (in-scope).
  7. `ls "${PHASE_DIR}"/*-UI-SPEC.md` (steps 5.6/5.7) — used twice.
  8. `ls "${PHASE_DIR}"/*-PLAN.md` (steps 6, 8.5, 9a, 11a, 13).
  9. `ls "${PHASE_DIR}"/*-VALIDATION.md` (step 7.5).
  10. Chunked planning step 8.5: `head -1 "$PLAN_FILE" | grep -q '^---'` and **Write each `${PHASE_DIR}/{plan_id}-PLAN.md`**.
  11. Step 13: `grep -h "requirements_addressed\|requirements:" ${PHASE_DIR}/*-PLAN.md` (cross-plan requirement extraction).
  12. Step 13a: "Edit CONTEXT.md to mark dropped decisions as [informational]" (Read+Edit CONTEXT.md).
- **Adapter methods needed:**
  1. `addPhaseDirectory(phase, slug)` (A) — replaces mkdir bypass.
  2. `putPhaseArtifact(phase, type:"context"|"validation"|"plan"|"plan-outline", id?, body)` (A) — covers all template Writes.
  3. `findAiSpec(phase) -> {path, framework}` (B) — combines existence + frontmatter regex.
  4. `findValidationArchitectureRef(phase) -> bool` (B) — grep for the `## Validation Architecture` heading inside RESEARCH.md.
  5. `findUiSpec(phase) -> path|null` (A).
  6. `listPhasePlanFiles(phase) -> Plan[]` (A) — already covered by `listPhasePlans` (#17). Reuse.
  7. `findValidationArtifact(phase) -> path|null` (A).
  8. `listPlanRequirementClaims(phase) -> {planId, reqIds}[]` (A — bare grep over plan frontmatter; consider B if per-plan parse).
  9. `updatePhaseContext(phase, mutator)` (B) — for "mark dropped decisions [informational]"; injects domain logic.
- **Notes:** Routing logic (gates 5.5/5.55/5.6/5.7/13/13a/13b/13c/13d/13e) stays in workflow — adapter only supplies data.

#### `workflows/plan-review-convergence.md`
- **Direct I/O ops:**
  1. Step 4 verification: `ls ${phase_dir}/${padded_phase}-*-PLAN.md`.
  2. Step 5a verification: `ls ${phase_dir}/${padded_phase}-REVIEWS.md`.
- **Adapter methods needed:**
  1. `listPhasePlanFiles(phase)` (A) — reuse from #17.
  2. `getPhaseReviewsFile(phase) -> path|null` (A) — single existence check.
- **Notes:** Workflow is mostly Agent→Skill orchestration; the orchestrator's only direct disk reads are these two existence checks. All other state goes through `gsd-tools.cjs`/`gsd-sdk` calls.

#### `workflows/execute-phase.md`
- **Direct I/O ops:**
  1. Step `check_blocking_antipatterns`: `ls ${phase_dir}/.continue-here.md` and parse "Critical Anti-Patterns" table (Read of handoff file).
  2. Step `regression_gate` step 1: `find .planning/phases/ -name "*-VERIFICATION.md" ! -path "*${PHASE_NUMBER}*"` (cross-phase scan).
  3. Step 1170s (resolve UAT gaps after gap-closure phase): "Read the parent UAT file's `## Gaps` section" + per-gap section update + frontmatter `status:` mutation (Read+Edit UAT files in parent phase).
  4. Step 1170s: per-debug-session "Read the debug session file" + frontmatter mutation + `mv .planning/debug/{slug}.md .planning/debug/resolved/`.
  5. Step `verify_phase_goal` human_needed branch: "Create `{phase_dir}/{phase_num}-HUMAN-UAT.md`" (Write).
  6. Step `update_project_md`: "Read `.planning/PROJECT.md`" + Edit (Active→Validated, footer).
  7. Step `close_phase_todos`: shell loop over `.planning/todos/pending/*.md` with `awk` extraction + `mv` to completed + git commit.
  8. Step `offer_next` end: `ls .planning/phases/*{next}*/{next}-CONTEXT.md` (existence check).
  9. Step `verify_phase_goal` (`<files_to_read>` in spawned verifier prompt): the prompt instructs the subagent to Read PLAN/SUMMARY/CONTEXT/REQUIREMENTS — the orchestrator doesn't read these directly, but the spawned subagent does (treat as adapter ops at the verifier level).
  10. `git diff --diff-filter=D --name-only HEAD~1 HEAD | grep -vc '^\.planning/'` (step 681) — this is git of source code, OUT OF SCOPE.
- **Adapter methods needed:**
  1. `getPhaseHandoff(phase) -> Handoff|null` (A) — `.continue-here.md` retrieval.
  2. `listVerificationsAcrossPhases(excludePhase?)` (A) — replaces the cross-phase `find`.
  3. `getUat(phase) -> Uat`, `updateUatGap(phase, gapId, status)` (B), `updateUatStatus(phase, status)` (B).
  4. `getDebugSession(slug)`, `archiveDebugSession(slug)` (B) — cascades file move + frontmatter mutation.
  5. `putHumanUat(phase, items)` (B) — template-driven Write; domain logic in shape.
  6. `getProject() / updateProjectValidatedRequirements(phaseId, names)` (B).
  7. `listPendingTodos(filter)` (A — overlaps PILOT) + `closeTodosByResolvesPhase(phase)` (B — cascade move).
  8. `findPhaseContext(phase) -> path|null` (A).
- **Notes:** `phase.complete` is already a single SDK call (#8). The remaining leaks are cascade flows (UAT gap resolution, debug session archive, PROJECT.md evolution, todo auto-close) that should each become a named adapter method.

#### `workflows/execute-plan.md`
- **Direct I/O ops:**
  1. Step `identify_plan`: `ls .planning/phases/XX-name/*-PLAN.md` and `ls *-SUMMARY.md` (per-plan slot resolution).
  2. Step `parse_segments`: `grep -cE '^\s*<task[[:space:]>]'` and `grep -n "type=\"checkpoint"` against PLAN.md (could be replaced by `planTaskStructure` query #19).
  3. Step `init_agent_tracking`: maintains `.planning/agent-history.json` and `.planning/current-agent-id.txt` — Read/Write/append/delete cycle. (Ephemeral runtime state; arguably a separate "AgentRun" record.)
  4. Step `load_prompt`: `cat .planning/phases/XX-name/{phase}-{plan}-PLAN.md` (Read).
  5. Step `create_summary`: Write `{phase}-{plan}-SUMMARY.md` (templated).
  6. Step `extract_decisions_and_issues`/`update_session_continuity`: SDK state mutations — already SDK.
  7. Step `update_codebase_map`: Read/Edit `.planning/codebase/*.md` (STRUCTURE.md / STACK.md / CONVENTIONS.md / INTEGRATIONS.md).
  8. Step `offer_next`: `ls -1 .planning/phases/[current-phase-dir]/*-PLAN.md|*-SUMMARY.md | wc -l` (count check — duplicates SDK).
  9. Step `previous_phase_check`: `gsd-sdk query phases.list --type summaries --raw` then "extract second-to-last summary" — SDK; **but the subsequent "If previous SUMMARY has unresolved 'Issues Encountered'" check requires Reading that summary**.
- **Adapter methods needed:**
  1. `findNextIncompletePlan(phase) -> {planId, planPath}` (B) — scan + diff against summaries.
  2. `getAgentRunRegistry()` / `recordAgentSpawn(record)` / `completeAgentRun(id)` (B) — agent tracking persistence.
  3. `getPlan(phase, planId) -> body` (A).
  4. `putSummary(phase, planId, body)` (A) + `addSummary(phase, planId, body)` (B if it injects timestamps).
  5. `getCodebaseMapDoc(name)` / `updateCodebaseMapDoc(name, mutator)` (B).
  6. `findPriorSummary({offset:1})` (A) + `getSummaryIssues(summaryRef)` (A).
- **Notes:** Several ops here duplicate SDK queries already analyzed (`phaseListPlans`, `phaseListArtifacts`, `planTaskStructure`); the adapter implementation should consolidate.

### Agents

#### `agents/gsd-roadmapper.md` (covered in PILOT)
- tools: `Read, Write, Bash, Glob, Grep`.
- Direct ops: Write ROADMAP.md, Write STATE.md, Edit REQUIREMENTS.md (traceability).
- Adapter methods: `createRoadmap` (B), `createInitialState` (B), `updateRequirementsTraceability` (B).
- Included for completeness; PILOT's analysis stands.

#### `agents/gsd-planner.md`
- tools: `Read, Write, Bash, Glob, Grep, WebFetch, mcp__context7__*`.
- **Direct I/O ops:**
  1. Step "Read existing PLAN.md or DISCOVERY.md in phase directory" (Read of phase artifacts).
  2. Step `cat .planning/phases/{selected-phase}/*-SUMMARY.md` (cross-phase summary read for 1M-context mode).
  3. Step `cat .planning/RETROSPECTIVE.md` (top-level retrospective consumption).
  4. Step `update_roadmap` substeps 1+4: "Read `.planning/ROADMAP.md`" then "Write updated ROADMAP.md" — **direct full ROADMAP rewrite by subagent**, NOT through `gsd-sdk query`. This is a major leak: the planner agent ends each run by overwriting ROADMAP.md from a Read+modify cycle.
- **Adapter methods needed:**
  1. `findExistingPlanArtifact(phase) -> path|null` (A).
  2. `listPhaseSummaries(phaseList) -> body[]` (A).
  3. `getRetrospective() -> body|null` (A).
  4. `updateRoadmapPhasePlanList(phase, {goal?, plans:[{file, objective}]})` (B) — replaces the `Read ROADMAP.md / Write ROADMAP.md` pair with a structured update.
- **Notes:** The planner's ROADMAP rewrite duplicates `roadmapUpdatePlanProgress` (#20) but is invoked at planning time (before plans execute), so it serves a different purpose — populate placeholder plan list. Surfacing it as `updateRoadmapPhasePlanList` distinguishes the two.

#### `agents/gsd-plan-checker.md`
- tools: `Read, Bash, Glob, Grep` (no Write/Edit).
- **Direct I/O ops:** Reads RESEARCH.md, PATTERNS.md, ./CLAUDE.md for context. All reads of `.planning/*` are via Read tool, but they're informational (no mutations). All validation goes through `gsd-sdk query verify.plan-structure`, `frontmatter.get`, `frontmatter.validate`.
- **Adapter methods:** None new. The Read calls map to `getPhaseArtifact(phase, type)` (A) — a generic read, already covered by per-type listers + a `getPhaseArtifact` accessor (which we should add as part of the base interface).
- **Notes:** Cleanest agent in the batch; close to SDK-only.

#### `agents/gsd-executor.md`
- tools: `Read, Write, Edit, Bash, Grep, Glob, mcp__context7__*`.
- **Direct I/O ops:**
  1. Read of PLAN.md (step `load_plan`).
  2. **Write of `{phase}-{plan}-SUMMARY.md`** (step "After all tasks complete"). All STATE.md / ROADMAP.md / REQUIREMENTS.md mutations route through `gsd-sdk query state.*` / `roadmap.update-plan-progress` / `requirements.mark-complete` — these are SDK.
  3. `gsd-sdk query commit-to-subrepo` for commits, `gsd-sdk query commit` for plan commit — SDK.
  4. Code-file Reads/Writes/Edits during task execution — out-of-scope (source code, not `.planning/`).
  5. Implicit Read of CLAUDE.md (out-of-scope — project source).
- **Adapter methods needed:**
  1. `getPlan(phase, planId) -> body` (A) — duplicates execute-plan workflow #3.
  2. `addSummary(phase, planId, body, {timestamp})` (B) — single canonical write path. Adapter for beads stores SUMMARY as bd issue resolution.
  3. (others already SDK).
- **Notes:** SUMMARY.md write is the executor's only `.planning/*` direct mutation that isn't routed through SDK. Surfacing it is high-value because executor agents write summaries on every plan completion, multiplying the leak.

### Skills

| Skill | Type | Notes |
|-------|------|-------|
| add-phase, insert-phase, remove-phase, plan-phase, execute-phase, plan-review-convergence, plan-milestone-gaps | Router | Thin `<execution_context>@~/.claude/get-shit-done/workflows/X.md</execution_context>` files. Inherit from workflow. |
| add-backlog | **Inline workflow (Direct)** | Embeds the full procedure in the skill. Direct ops: `cat .planning/ROADMAP.md` (Read), Write of `## Backlog` section to ROADMAP, `mkdir`/`touch` of phase dir. Adapter methods: `getRoadmap()` (A), `addBacklogEntry({number, description, slug})` (B — section creation if missing + (BACKLOG) marker), `addPhaseDirectory(number, slug)` (B). |
| review-backlog | **Inline workflow (Direct)** | Embeds the full procedure. Direct ops: `ls -d .planning/phases/999*`, `cat .planning/ROADMAP.md`, dir rename + ROADMAP section move on promote, dir delete + ROADMAP entry remove on remove. Adapter methods: `listBacklogEntries() -> Backlog[]` (A), `promoteBacklogEntry({number, newNumber, dependsOn})` (B), `removeBacklogEntry(number)` (B), `updateRoadmapBacklogSection(mutator)` (B). |

The two backlog skills are notable exceptions to the "skills are thin routers" rule — they embed the workflow inline. Flag for synthesis: these need adapter methods even though they live in `commands/gsd/`.

## Cross-cutting observations from this batch

1. **`phase-lifecycle.js` is the single largest Bin B cluster in the codebase.** 11 of its 13 exports are coordinated multi-file mutations (phaseAdd/Insert/Remove/Complete/Scaffold, phasesClear/Archive, milestoneComplete, phaseAddBatch, phaseNextDecimal, roadmap-update-plan-progress). The bd adapter must implement these as named methods because each encodes domain logic the markdown adapter expresses through regex-rewrites.

2. **Two helpers in `phase-lifecycle.js` are Bin C (eliminate from interface):** `replaceInCurrentMilestone` and `readModifyWriteRoadmapMd` are markdown-and-lockfile-specific implementation details. The bd adapter has no `</details>` separator and no file lockfile. They should NOT appear in the adapter contract.

3. **`workflows/insert-phase.md` is the cleanest exemplar in the batch** — it explicitly warns "never raw `Edit`/`Write`" and routes STATE.md mutations through `state.patch` + `state.add-roadmap-evolution`. This is the pattern other phase-lifecycle workflows should converge on; it also proves the leak class is tractable.

4. **`agents/gsd-planner.md` has a hidden ROADMAP.md write leak** at the end of its execution flow ("Read `.planning/ROADMAP.md`" then "Write updated ROADMAP.md"). This is structurally similar to PILOT's gsd-roadmapper finding and was easy to miss because the surrounding bash blocks are all `gsd-sdk query`. Adapter method: `updateRoadmapPhasePlanList`.

5. **`agents/gsd-executor.md` SUMMARY.md write is the only per-plan mutation outside SDK.** Executors run on every plan; that's many writes per phase. Surfacing `addSummary` is high leverage.

6. **Backlog skills (`add-backlog.md`, `review-backlog.md`) are NOT routers** — they embed full workflows. Flag for synthesis dedup; treat them like workflows.

7. **PRD path in `plan-phase.md` reads from outside `.planning/`** (the user's PRD file). That's out of scope per Rubric Rule 6, but the **Write of CONTEXT.md from the PRD** is in scope.

8. **Several SDK queries duplicate workflow-level disk peeking.** `phasesList` (#10), `phaseListPlans` (#17), `phaseListArtifacts` (#16), `planTaskStructure` (#19) cover most of the `ls`/`grep`/`head -1` patterns in the workflows. Workflow refactoring should call these instead of inline shell.

9. **Naming clashes / convention notes:**
   - I used `addBacklogEntry` and `promoteBacklogEntry` — `Backlog` isn't in the noun sheet but maps cleanly to `Phase` (specifically the 999.x subspace). Synthesis may want to fold these into `addPhase({backlog: true})` or keep `Backlog` as a derived noun.
   - `findValidationArchitectureRef` is awkward; consider `hasResearchSection(phase, sectionTitle)` (A) as a more general accessor.
   - `getPhaseHandoff` — `Handoff` is in the noun sheet; verb `get` is fine.
   - `updateRoadmapPhasePlanList` is a long compound; alternative: `setPhasePlans(phase, plans[])`.

10. **Adapter methods in this batch overlapping with PILOT/other batches (flag for synthesis dedup):**
    - `addPhase`, `recordStateEvent`, `findPhase` (PILOT batch).
    - `listPhasePlans` / `listPhaseArtifacts` (likely overlap with progress/check batches).
    - `listPendingTodos` (PILOT mentioned).
    - `getStats` not in this batch but `phasesList` is similar.

## Bin-by-bin counts

- Bin A: 12 operations (findPhase, phasesList, phaseListArtifacts, phaseListPlans, planTaskStructure, listPhasePlanFiles, getPhaseReviewsFile, getPhaseHandoff, listVerificationsAcrossPhases, findPhaseContext, getPlan, getRoadmap, listBacklogEntries, getRetrospective, findExistingPlanArtifact, listPhaseSummaries, findValidationArtifact, findUiSpec — note: some duplicates resolved as single methods)
- Bin B: ~28 operations (phaseAdd, phaseAddBatch, phaseInsert, phaseScaffold, phaseRemove, phaseComplete, phasesClear, phaseNextDecimal, phasesArchive, milestoneComplete, phasePlanIndex, checkPhaseReady, roadmapUpdatePlanProgress, recordStateEvent, updateStatePointers, updatePhaseContext, updateRoadmapPhasePlanList, addSummary, getUat/updateUatGap/updateUatStatus, getDebugSession/archiveDebugSession, putHumanUat, getProject/updateProjectValidatedRequirements, closeTodosByResolvesPhase, addBacklogEntry, promoteBacklogEntry, removeBacklogEntry, updateRoadmapBacklogSection, getCodebaseMapDoc/updateCodebaseMapDoc, findAiSpec, findValidationArchitectureRef, listPlanRequirementClaims, getAgentRunRegistry/recordAgentSpawn/completeAgentRun, findNextIncompletePlan, findPriorSummary, getSummaryIssues)
- Bin C: 2 (replaceInCurrentMilestone, readModifyWriteRoadmapMd — eliminate from interface; markdown/lock primitives)
- Bin D: 0 (no presentation-only exports in this batch)
- Direct I/O leaks found: 41 across workflows + agents + 2 inline-workflow skills (12 plan-phase, 10 execute-phase, 8 execute-plan, 4 planner-agent, 5 executor-agent, 1 add-phase, 0 insert/remove-phase, 2 plan-review-convergence, 3 add-backlog, 4 review-backlog, plus ~2 in roadmapper covered by PILOT).
- Routers auto-classified: 7 (add/insert/remove/plan/execute-phase, plan-review-convergence, plan-milestone-gaps).
- Inline-workflow skills (NOT routers): 2 (add-backlog, review-backlog).
