# Batch 02 — Milestone + project init + ingestion

Date: 2026-04-30
Artifacts assigned: 24
Output by: BATCH-02 fork-investigation classifier

## Classification table

| # | Path | Kind | I/O surface | Bin | Use case (≤15 words) | Direct I/O ops | Adapter methods proposed (with Bin) | Notes |
|---|------|------|-------------|-----|----------------------|----------------|-------------------------------------|-------|
| 1 | sdk/dist/query/roadmap.js::stripShippedMilestones | sdk-helper | n/a | A | Strip shipped `<details>` blocks from ROADMAP content | n/a | (utility — consumed by `getRoadmap`) | Pure string transform; not adapter |
| 2 | sdk/dist/query/roadmap.js::getMilestoneInfo | sdk-export | n/a | B | Resolve current milestone version + name from STATE/ROADMAP | n/a | `getCurrentMilestone()` (B) | Joins STATE.md frontmatter + ROADMAP regex fallback chain |
| 3 | sdk/dist/query/roadmap.js::extractCurrentMilestone | sdk-export | n/a | B | Slice ROADMAP content to active milestone section | n/a | `getRoadmapSection(milestone)` (B) | Coordinates STATE read + ROADMAP slicing logic |
| 4 | sdk/dist/query/roadmap.js::extractPhasesFromSection | sdk-helper | n/a | A | Parse phase headings from a roadmap section | n/a | (utility — used by `listPhases`) | Pure string parse |
| 5 | sdk/dist/query/roadmap.js::extractNextMilestoneSection | sdk-export | n/a | B | Find the milestone section after the active one | n/a | `getNextMilestone()` (B) | Joins STATE + ROADMAP, strips shipped, scans |
| 6 | sdk/dist/query/roadmap.js::roadmapGetPhase | sdk-export | n/a | B | Extract one phase section + goal + criteria | n/a | `getPhase(phaseNum)` (B) | Coordinates milestone-slice + full-roadmap fallback search |
| 7 | sdk/dist/query/roadmap.js::roadmapAnalyze | sdk-export | n/a | B | Multi-pass parse of ROADMAP + disk correlation | n/a | `listPhases() -> Phase[]` (B) | Joins ROADMAP regex + per-phase disk readdir + checkbox parse |
| 8 | sdk/dist/query/roadmap.js::roadmapAnnotateDependencies | sdk-export | n/a | B | Annotate ROADMAP plan list with wave deps | n/a | `annotateRoadmapDependencies(phase)` (B) | Spawns gsd-tools.cjs; mutates ROADMAP |
| 9 | sdk/dist/query/roadmap.js::requirementsMarkComplete | sdk-export | n/a | B | Mark REQ-IDs complete in REQUIREMENTS.md (checkbox + table) | n/a | `completeRequirements(reqIds[])` (B) | Read+regex-replace+write; multi-source mutation |
| 10 | sdk/dist/query/requirements-extract-from-plans.js::requirementsExtractFromPlans | sdk-export | n/a | B | Aggregate `requirements` frontmatter across phase plan files | n/a | `listRequirementsByPlan(phase)` (B) | Joins phase dir resolution + per-plan frontmatter parse + dedupe |
| 11 | sdk/dist/query/summary.js::summaryExtract | sdk-export | n/a | A | Extract structured fields from a SUMMARY.md by path | n/a | `getSummary(path, fields?)` (A) | Bare frontmatter read; field projection only |
| 12 | sdk/dist/query/summary.js::historyDigest | sdk-export | n/a | B | Aggregate provides/affects/patterns/decisions across all phase + archived summaries | n/a | `digestPhaseHistory()` (B) | Joins active phases + archived milestones; merges set-typed fields |
| 13 | sdk/dist/query/decisions.js::parseDecisions | sdk-helper | n/a | A | Parse trackable D-NN decisions from CONTEXT.md content | n/a | (utility — used by gates) | Pure string parser; takes content arg |
| 14 | sdk/dist/query/decisions.js::decisionsParse | sdk-export | n/a | A | Read CONTEXT.md, return decisions array | n/a | `getDecisions(path)` (A) | Bare read + parse pass-through |
| 15 | sdk/dist/query/audit-open.js::auditOpenArtifacts | sdk-helper | n/a | B | Scan all open artifact categories for unresolved items | n/a | (internal to `auditOpen`) | 8 directory scans + counts merged |
| 16 | sdk/dist/query/audit-open.js::formatAuditReport | sdk-helper | n/a | D | Format auditOpen result as text report | n/a | (presentation — out of scope) | Pure formatter |
| 17 | sdk/dist/query/audit-open.js::auditOpen | sdk-export | n/a | B | Cross-category open-artifact audit JSON + text | n/a | `auditOpenArtifacts()` (B) | Joins debug/quick/threads/todos/seeds/UAT/verification/context |
| 18 | get-shit-done/workflows/new-project.md | workflow | Mixed | n/a (consumer) | Initialize project: questioning → research → requirements → roadmap | (5 ops; see detail) | (5 methods; see detail) | Subagent-spawning orchestrator; `.gitignore` write is direct |
| 19 | get-shit-done/workflows/new-milestone.md | workflow | Mixed | n/a (consumer) | Start new milestone cycle (brownfield equivalent of new-project) | (4 ops; see detail) | (4 methods; see detail) | SDK for state mutations; direct for seed scan + todo tagging |
| 20 | get-shit-done/workflows/transition.md | workflow | Mixed | n/a (consumer) | Mark current phase done; advance and evolve PROJECT.md | (5 ops; see detail) | (5 methods; see detail) | INTERNAL workflow; lots of PROJECT/STATE direct edits |
| 21 | get-shit-done/workflows/complete-milestone.md | workflow | Mixed | n/a (consumer) | Archive shipped milestone; tag git; full PROJECT evolution | (6 ops; see detail) | (6 methods; see detail) | Heavy direct PROJECT/ROADMAP/RETROSPECTIVE edits + git ops |
| 22 | get-shit-done/workflows/audit-milestone.md | workflow | Mixed | n/a (consumer) | Verify milestone DoD: read VERIFICATIONs + integration check | (4 ops; see detail) | (4 methods; see detail) | Mostly SDK; per-phase VERIFICATION reads are direct |
| 23 | get-shit-done/workflows/milestone-summary.md | workflow | Direct | n/a (consumer) | Generate human-readable project summary from milestone artifacts | (7 ops; see detail) | (7 methods; see detail) | Heavy: reads PROJECT/RETROSPECTIVE/STATE + per-phase quad-artifact scan |
| 24 | get-shit-done/workflows/ingest-docs.md | workflow | Mixed | n/a (consumer) | Scan repo for ADR/PRD/SPEC/DOC → classify → synthesize → bootstrap or merge | (3 ops; see detail) | (3 methods; see detail) | Most I/O delegated to subagents; INGEST-CONFLICTS.md is direct read |
| 25 | get-shit-done/workflows/plan-milestone-gaps.md | workflow | Mixed | n/a (consumer) | Create phases that close audit gaps from MILESTONE-AUDIT.md | (4 ops; see detail) | (4 methods; see detail) | Direct reads of audit YAML + ROADMAP/REQUIREMENTS edits |
| 26 | get-shit-done/workflows/import.md | workflow | Mixed | n/a (consumer) | Import external plan file → conflict-check → write PLAN.md | (4 ops; see detail) | (4 methods; see detail) | Direct PLAN.md write + ROADMAP/STATE edits |
| 27 | agents/gsd-project-researcher.md | agent | Direct | n/a (consumer) | Domain ecosystem research; writes STACK/FEATURES/ARCHITECTURE/PITFALLS | 4 file writes | (1 method; see detail) | Subagent — also calls WebSearch/Context7 (out of scope) |
| 28 | agents/gsd-research-synthesizer.md | agent | Direct | n/a (consumer) | Synthesize 4 research files into SUMMARY.md and commit | 5 ops; see detail | (1 method + 1 reused) | Subagent; commits via SDK at end |
| 29 | agents/gsd-doc-classifier.md | agent | Direct | n/a (consumer) | Classify ONE planning doc → write JSON to intel/classifications/ | 2 ops; see detail | (2 methods; see detail) | Spawned in parallel; classification JSON is intel artifact |
| 30 | agents/gsd-doc-synthesizer.md | agent | Direct | n/a (consumer) | Merge classified docs into per-type intel + INGEST-CONFLICTS.md | 3 ops; see detail | (3 methods; see detail) | Heavy intel dir writes; reads existing CONTEXT.md in merge mode |
| 31 | commands/gsd/new-project.md | skill | Router | n/a | Thin router → `workflows/new-project.md` | None | Inherits from #18 | Pure router |
| 32 | commands/gsd/new-milestone.md | skill | Router | n/a | Thin router → `workflows/new-milestone.md` | None | Inherits from #19 | Pure router |
| 33 | commands/gsd/complete-milestone.md | skill | Router | n/a | Thin router → `workflows/complete-milestone.md` | None | Inherits from #21 | Pure router; NB skill duplicates workflow steps in prose |
| 34 | commands/gsd/audit-milestone.md | skill | Router | n/a | Thin router → `workflows/audit-milestone.md` | None | Inherits from #22 | Pure router |
| 35 | commands/gsd/milestone-summary.md | skill | Router | n/a | Thin router → `workflows/milestone-summary.md` | None | Inherits from #23 | Pure router |
| 36 | commands/gsd/ingest-docs.md | skill | Router | n/a | Thin router → `workflows/ingest-docs.md` | None | Inherits from #24 | Pure router |

## Per-artifact detail

### sdk/dist/query/roadmap.js

Most exports are Bin B (regex parse of ROADMAP joined with STATE frontmatter, disk readdir, or REQUIREMENTS mutation). `extractPhasesFromSection` is the only pure-string helper. `requirementsMarkComplete` is surprising-here — it mutates REQUIREMENTS.md by regex-replace despite living in `roadmap.js`.

### sdk/dist/query/summary.js

`summaryExtract` Bin A (bare frontmatter projection). `historyDigest` Bin B — walks active + archived `milestones/v*-phases/`, merges set-typed fields across summaries. Hidden leak: `getArchivedPhaseDirs` does direct `readdirSync(.planning/milestones)`.

### sdk/dist/query/audit-open.js

8 internal scanners (`scanDebugSessions/QuickTasks/Threads/Todos/Seeds/UatGaps/VerificationGaps/ContextQuestions`), each `readdirSync` + per-file frontmatter + status filter. Exported `auditOpen` aggregates → Bin B; each scanner could be split into Bin A `listOpen<X>()` primitives. `formatAuditReport` Bin D.

### get-shit-done/workflows/new-project.md

- **Direct I/O ops enumerated:**
  1. `git init` (when `has_git` false) — out of scope (code repo state)
  2. `mkdir -p .planning/research` — directory creation; covered by adapter `createRoadmap` / `createInitialState` initialization
  3. Write `.gitignore` to add `.planning/` when `commit_docs=No` — out of scope (code repo gitignore)
  4. `find . -maxdepth 1 -type d ... -exec test -d "{}/.git"` — sub-repo detection; out of scope (code repo state)
  5. `ls ./.claude/skills/spike-findings-*/SKILL.md` and `ls ./.claude/skills/sketch-findings-*/SKILL.md` — checks for project-local skills outside `.planning/`; **out of scope per Rule 6**
  6. `ls .planning/spikes/MANIFEST.md` and `ls .planning/sketches/MANIFEST.md` — direct existence check on planning artifacts; **leak**
- **Adapter methods needed:**
  1. `findExplorationArtifacts() -> {spikes?, sketches?}` (A) — replaces step 6 ls (existence under `.planning/`)
  2. `createInitialState(template)` (B) — already proposed by pilot; reused here
  3. `createRoadmap(spec)` (B) — already proposed by pilot; reused here (delegated to `gsd-roadmapper` agent)
- **Notes:** State writes mostly go through `gsd-sdk query commit` / `state.milestone-switch`. `init.new-project` is the I/O init-detector (assumed in another batch). Subagent spawns push direct-I/O into agents #27, #28, etc.

### get-shit-done/workflows/new-milestone.md

- **Direct I/O ops enumerated:**
  1. `ls .planning/seeds/SEED-*.md` (Step 2.5) — seed file discovery; **leak**
  2. `Read` each `SEED-*.md` for frontmatter + body — **leak**
  3. `find .planning/phases -mindepth 1 -maxdepth 1 -type d -exec mv {} "${phase_archive_path}/" \;` (Step 7.5) — manual archive-phase move when `--reset-phase-numbers`; **leak**
  4. `ls .planning/todos/pending/*.md` (Step 10.5) + Read each + Edit YAML frontmatter to add `resolves_phase: N` — **3 sub-leaks** (list, read, edit)
- **Adapter methods needed:**
  1. `listSeeds(filter?) -> Seed[]` (A) — replaces #1
  2. `getSeed(id) -> Seed` (A) — replaces #2 (or `listSeeds` returns full body)
  3. `archivePhases(milestoneVersion)` (B) — replaces #3; coordinates dir create + multi-mv with collision check
  4. `listPendingTodos()` (A) — replaces #4 list (already proposed by pilot for `progress.md`)
  5. `tagTodoResolvesPhase(todoId, phase)` (B) — replaces #4 frontmatter mutation; domain-typed update
- **Notes:** Milestone-state mutation goes through SDK (`state.milestone-switch`, `phases.clear`, `commit`). Seed-scan and todo-tag are pure direct I/O.

### get-shit-done/workflows/transition.md

- **Direct I/O ops enumerated:**
  1. `cat .planning/STATE.md` and `cat .planning/PROJECT.md` (`load_project_state`) — **leak**
  2. `ls .planning/phases/XX-current/*-PLAN.md|*-SUMMARY.md` + `ls .continue-here*.md` — **leak**
  3. `for f in .planning/phases/XX-current/*-UAT.md *-VERIFICATION.md; ... grep "result: pending|blocked|status: partial|human_needed|diagnosed"` — **leak** (verification-debt scan)
  4. `cat .planning/phases/XX-current/*-SUMMARY.md` (`evolve_project`) + Edit `PROJECT.md` to move requirements between Validated/Active/Out-of-Scope and add Key Decisions — **major leak: structured PROJECT.md mutation**
  5. STATE.md edits for `Project Reference`, `Accumulated Context`, `Session Continuity` sections — **leak: structured STATE.md section rewrite**
- **Adapter methods needed:**
  1. `getProjectState() -> ProjectState` (A) — replaces #1 (raw read of PROJECT + STATE; could be split per-doc)
  2. `countPhaseArtifacts(phase)` (A) — replaces #2 (already proposed by pilot)
  3. `listPhaseDebt(phase) -> {file, kind}[]` (A) — replaces #3 (UAT pending/blocked + VERIFICATION partial/human_needed/diagnosed; structured filter)
  4. `evolveProject(changes: {validated[], invalidated[], emerged[], decisions[]})` (B) — replaces #4; domain-typed PROJECT.md evolution
  5. `updateStateContext({reference, decisions[], blockers[], session})` (B) — replaces #5; structured STATE section update
- **Notes:** Most analogous to `/gsd-progress` from pilot — heavy direct PROJECT/STATE mutation. Sub-steps go through `phase.complete` / `progress.bar` SDK queries, but PROJECT.md evolution is fully manual. Routing logic (Route A/B/B1) stays in workflow.

### get-shit-done/workflows/complete-milestone.md

- **Direct I/O ops enumerated:**
  1. `cat .planning/config.json` (`config-check`) — **leak** (but also covered by `init.milestone-op`)
  2. `cat .planning/phases/*-*/*-SUMMARY.md` (`evolve_project_full_review`) — **leak**: read all summaries
  3. **Major:** Edit `PROJECT.md` for full evolution review (What This Is / Core Value / Validated / Active / Out of Scope / Context / Key Decisions / Constraints) — **leak: structured PROJECT.md rewrite**
  4. `awk '/^## Backlog/{found=1} found{print}' .planning/ROADMAP.md` + Write rewritten ROADMAP.md with milestone groupings + re-append Backlog — **leak: structured ROADMAP.md rewrite**
  5. `ls .planning/RETROSPECTIVE.md` + Read + Append milestone section, OR Create from template — **leak: structured RETROSPECTIVE.md mutation**
  6. STATE.md `## Deferred Items` section append (when user `[A]`cknowledges audit items) — **leak: STATE.md typed section write**
- **Adapter methods needed:**
  1. (covered by `init.milestone-op` — assume in another batch)
  2. `listPhaseSummaries(milestone?) -> Summary[]` (A) — replaces #2
  3. `evolveProjectMilestone(changes)` (B) — replaces #3; same shape as transition.md's `evolveProject` but milestone-scoped (extra Constraints/Context fields)
  4. `reorganizeRoadmapForMilestone(milestone, archive)` (B) — replaces #4; preserves Backlog automatically; for beads adapter, becomes label changes on phase issues
  5. `appendRetrospective(milestone, section)` (B) — replaces #5; idempotent template-init + section append
  6. `recordDeferredItems(items[])` (B) — replaces #6; same shape as `recordStateEvent` from pilot but with category-typed payload
- **Notes:** Heavy direct I/O. Git ops (tag, branch merge, push) out of scope per Rule 6. `milestone.complete` SDK does archive moves + MILESTONES.md; PROJECT.md evolution + ROADMAP rewrite remain manual. `pre_close_artifact_audit` step covered by `auditOpen` (#17).

### get-shit-done/workflows/audit-milestone.md

- **Direct I/O ops enumerated:**
  1. Per-phase `Read VERIFICATION.md` (Step 2) — **leak**: status / critical_gaps / non_critical_gaps / anti_patterns / requirements_coverage extraction
  2. Per-phase `Read SUMMARY.md` frontmatter for `requirements-completed` — covered by SDK `summary-extract` (#11) ✓
  3. Per-phase `*-VALIDATION.md` Read (Step 5.5 Nyquist) — **leak**
  4. Write `.planning/v{version}-MILESTONE-AUDIT.md` (Step 6) — **leak: structured audit report write**
- **Adapter methods needed:**
  1. `getVerification(phase) -> Verification` (B) — replaces #1; structured extraction of typed fields, not raw read
  2. (already covered by `getSummary`)
  3. `getValidation(phase) -> Validation | null` (A) — replaces #3; bare frontmatter read with optional return
  4. `writeMilestoneAudit(milestone, audit)` (B) — replaces #4; structured YAML+markdown write
- **Notes:** REQUIREMENTS traceability parse covered by other SDK. Integration-checker subagent in another batch. 3-source cross-reference stays in workflow.

### get-shit-done/workflows/milestone-summary.md

- **Direct I/O ops enumerated:**
  1. `git tag -l "v${VERSION}"` and `git log v${VERSION} --oneline | wc -l` and `git diff --stat` — out of scope (git/code repo state per Rule 6)
  2. Read `STATE.md` for `started_at` (Method 2 fallback) — **leak**
  3. `git log --oneline --diff-filter=A -- ".planning/phases/"` (Method 3 fallback) — git, but on `.planning/` paths (out of scope per Rule 6 — git history is external)
  4. Per-phase Read `*-SUMMARY.md` (one_liner, accomplishments, decisions) — covered by SDK `summary-extract` (#11) ✓
  5. Per-phase Read `*-VERIFICATION.md` (status, gaps, deferred) — same as audit-milestone #1
  6. Per-phase Read `*-CONTEXT.md` `<decisions>` — covered by SDK `decisions.parse` (#14) ✓
  7. Per-phase Read `*-RESEARCH.md` (existence + topic note) — **leak**
  8. Read `.planning/PROJECT.md`, `.planning/RETROSPECTIVE.md`, `.planning/STATE.md` for top-level fields — **leak**
  9. Read `.planning/milestones/v${VERSION}-ROADMAP.md`, `…-REQUIREMENTS.md`, `…-MILESTONE-AUDIT.md` for archived milestones — **leak**
  10. Write `.planning/reports/MILESTONE_SUMMARY-v${VERSION}.md` — **leak**
- **Adapter methods needed:**
  1. (out of scope; git utility)
  2. `getProject()`, `getRetrospective()`, `getState()` (A each) — replaces #2 + #8
  3. (out of scope; git)
  4. (covered by `getSummary`)
  5. (covered by `getVerification`)
  6. (covered by `getDecisions`)
  7. `getResearch(phase) -> Research | null` (A) — replaces #7
  8. (covered above)
  9. `getArchivedMilestoneDoc(milestone, kind: 'roadmap'|'requirements'|'audit')` (A) — replaces #9
  10. `writeReport(name, body)` (A) — replaces #10; bare put under `.planning/reports/`
- **Notes:** Marked "Direct" — pure aggregation across many planning files, most reads consolidate into a few adapter getters. Markdown adapter does file reads; beads adapter projects from issue queries.

### get-shit-done/workflows/ingest-docs.md

- **Direct I/O ops enumerated:**
  1. `find {SCAN_PATH} -type f \( -path '*/adr/*' ... \)` and friends (Step `discover_docs`) — out of scope (scanning a user-supplied SCAN_PATH outside `.planning/`); **NOT an adapter concern per Rule 6**
  2. `mkdir -p .planning/intel/classifications/` (Step `classify_parallel`) — covered by adapter init (intel directory is `.planning/` planning state)
  3. Read `.planning/INGEST-CONFLICTS.md` to count BLOCKER/WARNING/INFO bucket sizes (Step `conflict_gate`) — **leak**
- **Adapter methods needed:**
  1. (out of scope)
  2. `createIntelDirectory()` (A) — or absorbed into the classifier/synthesizer agent's `writeClassification` / `writeIntel` methods (see #29, #30)
  3. `getIngestConflicts() -> {blockers, warnings, info}` (A) — replaces #3; structured bucket counts, no raw markdown
- **Notes:** Heavy lifting (classification, synthesis) delegated to subagents #29, #30. Manifest YAML parse (user-supplied path) out of scope.

### get-shit-done/workflows/plan-milestone-gaps.md

- **Direct I/O ops enumerated:**
  1. `(ls -t .planning/v*-MILESTONE-AUDIT.md ...) | head -1` + Read its YAML frontmatter for `gaps.requirements/integration/flows` — **leak**
  2. Edit `.planning/ROADMAP.md` to append new phase sections (Step 6) — **leak: structured ROADMAP append**
  3. Edit `.planning/REQUIREMENTS.md` traceability table (reset Phase + Status + change `[x]→[ ]` for unsatisfied) (Step 7) — **leak: structured REQUIREMENTS update**
  4. `mkdir -p .planning/phases/{NN}-{name}` (Step 8) — covered by `addPhase` (B) from pilot
- **Adapter methods needed:**
  1. `getMilestoneAudit(milestone?)` (A) — replaces #1; returns parsed YAML frontmatter (latest if no arg)
  2. `addGapClosurePhases(phases[])` (B) — replaces #2; multi-phase append; same shape family as `addPhase` from pilot but bulk
  3. `resetRequirementsForGapClosure(reqIds[], newPhase)` (B) — replaces #3; coordinated traceability + checkbox reset; same family as `requirementsMarkComplete` (#9) but reverse direction
  4. (covered by `addPhase`)
- **Notes:** "Create N phases from audit gaps" coordinator. `phases.list` SDK covers phase-number-determination.

### get-shit-done/workflows/import.md

- **Direct I/O ops enumerated:**
  1. Read `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md` — covered by `getProject/getRoadmap/...` (proposed elsewhere)
  2. `find .planning/phases/ -name "*-CONTEXT.md" ...` + Read each for `<decisions>` blocks (Step `plan_load_context`) — covered by `getDecisions` per phase, but list-of-phases is needed: `listPhaseContexts() -> {phase, decisions}[]` (A)
  3. Write `.planning/phases/{NN}-{slug}/{NN}-{MM}-PLAN.md` (Step `plan_convert`) — **leak: structured plan write**
  4. Edit `.planning/ROADMAP.md` to add plan to phase's plans list + Edit `.planning/STATE.md` to increment plan count (Step `plan_finalize`) — **leak: structured ROADMAP/STATE updates**
- **Adapter methods needed:**
  1. (covered by getters elsewhere)
  2. `listPhaseDecisions() -> {phase, decisions[]}[]` (A) — replaces #2
  3. `addPlan(phase, plan: PlanSpec)` (B) — replaces #3; coordinates dir-create + frontmatter normalization + content write
  4. `recordPlanAdded(phase, planId)` (B) — replaces #4; updates ROADMAP plan list + STATE counter together (cascade)
- **Notes:** BLOCKER/WARNING/INFO routing is consumer-level. `--from <path>` is user-supplied → reading source plan is out of scope.

### agents/gsd-project-researcher.md

- **Tools:** Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__firecrawl__*, mcp__exa__*
- **Direct I/O ops enumerated:**
  1. Write `.planning/research/STACK.md` (Step 5) — **leak**
  2. Write `.planning/research/FEATURES.md` — **leak**
  3. Write `.planning/research/ARCHITECTURE.md` — **leak**
  4. Write `.planning/research/PITFALLS.md` — **leak**
  5. Write `.planning/research/SUMMARY.md` (or COMPARISON.md / FEASIBILITY.md per mode) — **leak**
  - WebSearch/Context7/Firecrawl/Brave calls — out of scope per Rule 6
- **Adapter methods needed:**
  1. `writeResearch(kind: 'stack'|'features'|'architecture'|'pitfalls'|'summary'|'comparison'|'feasibility', body)` (A) — replaces all 5 writes; bare put-record under `.planning/research/{KIND}.md`
- **Notes:** Spawned 4× in parallel. Subagent boundary fragile for hooks. Does NOT commit (synthesizer does). Reads PROJECT.md (covered by `getProject` (A)).

### agents/gsd-research-synthesizer.md

- **Tools:** Read, Write, Bash
- **Direct I/O ops enumerated:**
  1. `cat .planning/research/STACK.md` (Step 1) — **leak** (covered by `getResearch('stack')` (A))
  2. `cat .planning/research/FEATURES.md` — **leak**
  3. `cat .planning/research/ARCHITECTURE.md` — **leak**
  4. `cat .planning/research/PITFALLS.md` — **leak**
  5. Write `.planning/research/SUMMARY.md` — covered by `writeResearch('summary', body)` from #27
- **Adapter methods needed:**
  1. `getResearch(kind)` (A) — replaces #1–4; partner of `writeResearch`
  2. (covered by `writeResearch` above)
  - Plus: `commit(msg, paths[])` SDK call at end (Step 7) — covered by SDK in another batch
- **Notes:** Sequential after the 4 researchers. Only commit point for `.planning/research/`.

### agents/gsd-doc-classifier.md

- **Tools:** Read, Write, Grep, Glob
- **Direct I/O ops enumerated:**
  1. Read `FILEPATH` (the assigned source doc) — **out of scope per Rule 6**: source doc lives outside `.planning/` (in `docs/adr/...` etc., or wherever user-supplied)
  2. Write `{OUTPUT_DIR}/{slug}-{source_hash}.json` to `.planning/intel/classifications/` — **leak**
- **Adapter methods needed:**
  1. (out of scope; arbitrary user-doc reads)
  2. `writeDocClassification(slug, sourceHash, classification)` (A) — replaces #2; bare put-record into intel directory
- **Notes:** Spawned one-per-doc in parallel. Output JSON is exchange format; manifest reads out of scope.

### agents/gsd-doc-synthesizer.md

- **Tools:** Read, Write, Grep, Glob, Bash
- **Direct I/O ops enumerated:**
  1. Read every `*.json` in `CLASSIFICATIONS_DIR` (Step `load_classifications`) — **leak**
  2. Read `EXISTING_CONTEXT` paths (merge mode: existing ROADMAP/PROJECT/REQUIREMENTS + every `phases/*/*-CONTEXT.md`) — covered by `getProject/getRoadmap/...` and `listPhaseDecisions` from earlier
  3. Write `INTEL_DIR/decisions.md`, `requirements.md`, `constraints.md`, `context.md` (Step `extract_per_type`) — **leak**: 4 typed intel writes
  4. Write `CONFLICTS_PATH` (`.planning/INGEST-CONFLICTS.md`) — **leak**: structured conflict report
  5. Write `INTEL_DIR/SYNTHESIS.md` — **leak**: synthesis summary
- **Adapter methods needed:**
  1. `listDocClassifications() -> Classification[]` (A) — replaces #1; partner of `writeDocClassification`
  2. (covered by getters above)
  3. `writeIntel(kind: 'decisions'|'requirements'|'constraints'|'context', body)` (A) — replaces #3; mirror of `writeResearch`
  4. `writeIngestConflicts(report)` (A) — replaces #4
  5. `writeIntel('synthesis', body)` (A) — same family as #3 (or split; either acceptable)
- **Notes:** Heavy intel producer. Conflict-report format contract lives in `references/doc-conflict-engine.md` (shared with import). Cycle detection / precedence are domain logic.

### Routers (#31–#36)

All six skill files in this batch are pure routers (`<execution_context>@~/.claude/get-shit-done/workflows/X.md</execution_context>` plus an `<objective>` block). They declare `allowed-tools` (Read/Write/Bash/Task/AskUserQuestion variants) but invoke none directly — every action is delegated to the workflow file. Inherit classification from the corresponding workflow.

One observation: `commands/gsd/complete-milestone.md` includes a `<process>` block that re-states the workflow steps in prose (vs. just `@`-referencing the workflow). This duplicates content but doesn't add I/O — still a router.

## Cross-cutting observations from this batch

1. **Workflow PROJECT.md evolution is the dominant Bin B pattern.** `transition.md` and `complete-milestone.md` both contain large structured PROJECT.md mutation steps — moving requirements between Validated/Active/Out-of-Scope, appending Key Decisions, updating Constraints, refreshing the "Last updated" footer. Both share enough structure that a single `evolveProject(changes, scope: 'phase'|'milestone')` Bin B method probably suffices for both, with the milestone-scope variant carrying extra fields (Constraints check, Context update). Flag for synthesis dedup with whichever batch owns `transition.md` if it ends up in another slice — but in this batch they're both here.

2. **Adapter "kind"-tagged getter/writer pair is a recurring shape.** `getResearch(kind)` / `writeResearch(kind)`, `writeIntel(kind)`, `getArchivedMilestoneDoc(milestone, kind)` — all follow the same name pattern. If we lock this convention it deduplicates a lot of ad-hoc reads. Suggest synthesis pass adopt: **`getNamedDoc(category, key)` / `putNamedDoc(category, key, body)`** as the meta-shape for Bin A artifact reads where the file name is essentially an enum.

3. **The "leak grep" caught structured PROJECT.md / STATE.md edits, not just raw cats.** Most leaks in this batch are `Read X then Edit X with section logic` rather than bare `cat`. The pilot's `recordStateEvent({type, text})` pattern generalizes well — this batch reuses the shape for `recordDeferredItems`, `recordPlanAdded`, `tagTodoResolvesPhase`. All Bin B because of the typed-mutation requirement.

4. **The ingest-docs / import workflows have a non-`.planning/` input boundary that needs explicit treatment in the rubric.** They read user-supplied paths (a manifest YAML, a `--from <plan>` file, `SCAN_PATH`). Per Rule 6 these aren't adapter concerns — but the *output* of those reads (intel files, written PLAN.md, INGEST-CONFLICTS.md) is `.planning/` territory and IS the adapter's concern. Synthesis should explicitly note: ingest's input layer stays in workflow code; output layer becomes adapter methods.

5. **Two helpers that look like exports aren't.** `stripShippedMilestones` and `extractPhasesFromSection` (in roadmap.js) are exported but consumed only internally. They're string-only, no I/O. I marked them `sdk-helper` (Bin A) for transparency but they don't need to be adapter methods.

6. **`audit-open` is the "everything-scanner" dual of `progress.js::progressJson`.** It walks 8 different artifact categories with the same `readdir + frontmatter + status filter` pattern. If beads stores all these as different issue types/labels, the entire `auditOpen` collapses to one `listOpenIssues({statuses?})` query — but the markdown adapter has to do 8 directory walks. Bin B at the aggregate; each scanner is independently Bin A.

7. **Convention sheet gap:** I introduced `evolveProject` (B) and `appendRetrospective` (B) — neither verb is in the convention sheet. `evolve` is meaningful here because it's the canonical workflow word, but if the convention sheet wants strictness, `update` or `record` would be acceptable. Flag for synthesis. Also: `tagTodoResolvesPhase` uses an ad-hoc verb `tag` — suggest `update` per the convention sheet (i.e., `updateTodo(id, {resolvesPhase: N})`).

8. **`gitStatusOutsidePlanning` / git tag / branch merge / `git diff` are aggressively out of scope.** This batch contains a *lot* of git operations (mostly in `complete-milestone.md` and `milestone-summary.md`). Per Rule 6 none are adapter methods.

## Bin-by-bin counts

- Bin A: 16 operations (11 SDK exports/helpers + 5 workflow/agent leaks resolved by getters/putters)
- Bin B: 23 operations (8 SDK exports + 15 workflow/agent coordinated mutations)
- Bin C: 0 operations (none in this batch are obsolete in the new architecture)
- Bin D: 1 operation (`formatAuditReport` — pure formatter)
- Direct I/O leaks found: 49 (across 11 workflows + 4 agents; some collapse via getter dedup)
- Routers auto-classified: 6
