# Fork-Investigation Synthesis

Date: 2026-04-30
Inputs: PILOT.md + 10 BATCH-NN.md files
Total artifacts classified: ~258 (40+36+46+44+37+23+26+34+52+47 row-expanded; ~258 distinct artifacts)
Total direct-I/O leaks found: ~334 enumerated across batches (with heavy dedup at the workflow/adapter-method layer below)
Total adapter methods proposed (deduped, this synthesis): **~96** (Bin A: 38, Bin B: 58)

> The investigation confirms the trigger hypothesis at scale. `/gsd-progress` was not
> a one-off; **every** subsystem leaks direct `.planning/` I/O somewhere. The leaks
> cluster into a few foundational primitive shapes (section-scoped writes,
> discriminated-union event records, named-doc kv) and a long tail of typed
> domain mutations.

## 1. Headline findings

1. **The "Direct I/O" pattern is universal, not exceptional.** 7 of 10 batches found
   workflow/agent leaks of comparable density to `/gsd-progress`. The heaviest are
   `forensics.md` (9), `progress.md` (8), `verify-phase.md` (8), `plan-phase.md` (12),
   `execute-phase.md` (10), `gsd-debugger` (7), `transition.md` (5 structured
   PROJECT.md mutations), `cleanup.md` (5). **Conclusion:** the adapter must be the
   unconditional path; "SDK-only workflow" is currently an aspiration, not a reality.

2. **Section-scoped writes are the dominant Bin B shape.** AI-SPEC.md is written by
   3 separate subagents (gsd-domain-researcher, gsd-ai-researcher, gsd-eval-planner)
   each touching different sections; debug session files have 6 section-update
   modes (overwrite Current Focus, append Evidence, append Eliminated, immutable
   Symptoms, overwrite Resolution, append Specialist Review); STATE.md has 5+
   typed sections; PROJECT.md has structured Validated/Active/Out-of-Scope/Decisions
   blocks. **A foundational `updateSection(file, sectionId, body, mode)` primitive
   would absorb dozens of ad-hoc Bin B methods.**

3. **STATE.md mutations decompose into a discriminated-union event record.**
   state-mutation.js exports 18 handlers; 5 of them (`stateAddRoadmapEvolution`,
   `stateAddDecision`, `stateAddBlocker`, `stateResolveBlocker`, `stateRecordMetric`,
   `stateRecordSession`) and several workflow leaks (`fast.md`'s
   `recordQuickTask`, `next.md`'s `recordBacklogDeferral`, `forensics.md`'s
   `forensic_session` event) all share the shape "append a typed entry to a typed
   section of STATE.md". **One `recordStateEvent({type, payload})` discriminated-
   union method replaces all of them**, with the markdown adapter dispatching on
   `type` and the beads adapter mapping types to issue comments / labels.

4. **`<context>`-block leaks are an entirely new leak class.** Several skills
   (`add-tests.md`, `intel.md`, others Batch 8/9) declare `@.planning/STATE.md` or
   `@.planning/ROADMAP.md` in their frontmatter `<context>` block. Claude Code
   loads these files at **skill-activation time, before any workflow runs**. The
   leak-grep from the original rubric never sees them. **Implication:** the hook
   layer must intercept frontmatter `@`-references too, not just Read/Write/Edit
   tool calls.

5. **Rule 4 ("skills are thin routers") is wrong for at least 8 fat skills.**
   Confirmed exceptions: `intel.md`, `debug.md`, `thread.md`, `quick.md`,
   `set-profile.md` (degenerate SDK-only), `add-backlog.md`, `review-backlog.md`,
   `workstreams.md`, `graphify.md`, `from-gsd2.md`, `reapply-patches.md`,
   `research-phase.md`, `commands/gsd/discuss-phase.md` (multi-route). Auto-
   classification must be **scan-confirmed**, not assumed.

6. **Bin C is two distinct things conflated.** Some operations are obsolete in the
   new architecture (`replaceInCurrentMilestone`, `readModifyWriteRoadmapMd`,
   `intelUpdate` stub, `frontmatterValidate` if reads return typed records,
   worktree-merge protect logic in `quick.md`). Others are **orthogonal** —
   they touch storage outside `.planning/` (`~/.claude/`, `~/.gsd/`, project
   root `CLAUDE.md`, `~/gsd-workspaces/`, runtime install dirs). Both got Bin C
   in the batch reports. **Synthesis splits these as C1 (eliminate) and C2
   (orthogonal/out-of-scope).** The split matters because C2 ops keep working
   under both adapters — they're just not the adapter's job.

7. **Dry-run middleware (`pipeline.js`) doesn't survive the fork.** It implements
   dry-run by `cp -r .planning/ /tmp/`, running the mutation, diffing, and
   discarding. This won't work for any non-filesystem adapter (beads stores in
   SQLite + JSONL). **Dry-run must hoist to an adapter capability:
   `snapshot()/restore()` or `beginTransaction()/rollback()`.** This is a
   non-trivial engineering item that affects every Bin B method's contract.

## 2. Refined rubric (Rubric v2)

| # | Refinement | Motivation | Rule change |
|---|-----------|-----------|-------------|
| R1 | Split Bin C into **C1 (obsolete)** and **C2 (orthogonal/out-of-scope)** | Batches conflated "we don't need this anymore" with "this touches non-`.planning/` storage" | C1 examples: `replaceInCurrentMilestone`, `readModifyWriteRoadmapMd`, `intelUpdate`, `validateAgents`, worktree-merge logic in `quick.md`. C2 examples: all `profile.js` exports targeting `~/.gsd/knowledge/`, `writeProfile`, `generateDevPreferences`, `detectCustomFiles`, `sync-skills.md`, `reapply-patches.md`, `init{New,List,Remove}Workspace` (workspace tree under `~/gsd-workspaces/`) |
| R2 | Add **Bin E (no-I/O / static data)** | `profile-questionnaire-data.js`, `MODEL_PROFILES`, `VALID_CONFIG_KEYS`, `FRONTMATTER_SCHEMAS`, all of `helpers.js` pure functions, `schema-detect.js` pure exports — none fit A/B/C/D | Bin E = pure functions or static tables; not an adapter concern, ship as shared SDK utilities |
| R3 | Add **`<context>`-block leak detection** | Skill frontmatter `@.planning/...` references load files at skill-activation time, invisible to the leak-grep | Mandate: scan every skill's frontmatter for `@.planning/` references; each is a Read leak the adapter must mediate (likely via `getStateSnapshot()`, `getRoadmap()`) |
| R4 | Demote **Rule 4 to "best-effort heuristic"** | Confirmed exceptions: `intel.md`, `debug.md`, `thread.md`, `quick.md`, `add-backlog.md`, `review-backlog.md`, `workstreams.md`, `graphify.md`, `from-gsd2.md`, `reapply-patches.md`, `research-phase.md`, `discuss-phase.md` (multi-route), `set-profile.md` (degenerate). | Always read the skill body. Auto-classify only when body is ≤10 lines AND contains a single `<execution_context>` ref AND has no `## Step` / `<process>` block of substance |
| R5 | Extend **leak-grep to `cp` and `mv`** against `.planning/` | `ai-integration-phase.md` Step 6 uses `cp` to seed AI-SPEC.md from a template; `code-review-fix.md` uses `cp` for iteration backups; `cleanup.md` uses `mv` for milestone archive; `new-milestone.md` uses `mv` for phase archive | Add to grep: `cp ... .planning/`, `mv ... .planning/`, `rm -rf .planning/`, shell append `>> .planning/` |
| R6 | Clarify Rule 6 input boundary | `ingest-docs.md`, `import.md`, `discovery-phase.md`, `ultraplan-phase.md` all read user-supplied source paths outside `.planning/` and produce in-scope `.planning/` output | Clarification: **reads of user-supplied paths outside `.planning/` are out of scope**, but **the writes that result from them (intel, PLAN.md, INGEST-CONFLICTS.md, etc.) are in scope**. Don't propose adapter methods for the input layer; do propose them for the output layer |
| R7 | Add `evolve` verb for structured PROJECT.md/ROADMAP.md evolution | `transition.md`, `complete-milestone.md`, `analyze-dependencies.md` all do structured multi-section mutation that `update` doesn't capture semantically | Convention extension. `evolveProject(changes)`, `evolveRoadmap(edits)` — distinguish from raw `update*` because the operation is "promote/demote/move" of records between buckets, not field assignment |
| R8 | Consolidated noun catalog (see §3 below) | Batches added 30+ new domain nouns | All synthesis-blessed nouns listed below; future investigators must pick from this set |

### Convention-sheet additions (consolidated noun catalog)

Already in original sheet: Phase, Plan, Summary, Uat, Todo, Memory, Handoff,
StateEvent, Roadmap, Requirement, Milestone, Decision, Blocker, DebugSession.

**New nouns approved by this synthesis:** `Project` (PROJECT.md), `Spec`
(SPEC.md), `AiSpec` (AI-SPEC.md), `Discovery` (DISCOVERY.md), `Security` (SECURITY.md),
`Research` (RESEARCH.md), `Verification` (VERIFICATION.md), `Validation`
(VALIDATION.md), `Patterns` (PATTERNS.md), `Context` (phase CONTEXT.md),
`Note`, `Seed`, `Methodology`, `Checkpoint` (DISCUSS-CHECKPOINT.json),
`QuestionsState` (QUESTIONS.json + .html), `ThreatRegister` (derived view),
`DecisionsIndex`, `ContinueHere`, `CodebaseDoc` (`.planning/codebase/*.md`),
`IntelDoc` (`.planning/intel/*`), `Spike`, `Sketch`, `SpikeManifest`,
`SketchManifest`, `Conventions` (spike/sketch CONVENTIONS.md), `Learnings`
(phase LEARNINGS.md), `Workstream`, `Workspace`, `Config`, `Review`, `ReviewFix`,
`UiSpec`, `UiReview`, `EvalReview`, `Reviews` (cross-AI), `ForensicReport`,
`SessionReport`, `MilestoneAudit`, `PhaseManifest`, `SkillManifest`, `Backlog`
(derived: phases numbered 999.x).

## 3. Direct-I/O leak inventory

### By artifact-kind

| Kind | Count | Leaks (sum) | Avg leaks/artifact |
|------|-------|-------------|--------------------|
| Workflows | ~70 | ~205 | ~3 |
| Agents | ~25 | ~60 | ~2.4 |
| Fat skills (non-routers) | ~13 | ~30 | ~2.3 |
| Routers | ~120 | 0 | 0 |
| SDK queries | ~210 exports | n/a (IS the I/O) | — |

### Top 10 heaviest leakers

| # | Path | Leaks | Notes |
|---|------|------:|-------|
| 1 | `workflows/plan-phase.md` | 12 | Largest: phase-dir mkdir, CONTEXT/VALIDATION/PLAN writes, AI-SPEC/RESEARCH grep, requirement aggregation, CONTEXT edit |
| 2 | `workflows/execute-phase.md` | 10 | UAT-gap resolution, debug archive, PROJECT.md evolution, todo auto-close, phase-context check |
| 3 | `workflows/spike.md` | 10 | mkdir, ls, MANIFEST/CONVENTIONS reads, README+MANIFEST writes |
| 4 | `agents/gsd-debugger` | 7+ | The `.planning/debug/*.md` state machine: list/read/write/append per section + archive + knowledge-base append |
| 5 | `workflows/forensics.md` | 9 | STATE/ROADMAP/config reads, phase-artifact existence, SESSION_REPORT read, forensic report write, mkdir |
| 6 | `workflows/progress.md` | 8 | (PILOT — verified by Batch 4: 8, not 7; UAT-gap grep runs unconditionally) |
| 7 | `workflows/verify-phase.md` | 8 | REQUIREMENTS grep, PLAN/SUMMARY/CONTEXT iteration, VERIFICATION write |
| 8 | `workflows/sketch.md` | 8 | Mirror of spike.md, plus theme/CSS asset writes |
| 9 | `workflows/discuss-phase.md` | 8 | Prior-CONTEXT scan, decisions index, spike findings, checkpoint files, CONTEXT/DISCUSSION-LOG writes |
| 10 | `workflows/execute-plan.md` | 8 | Per-plan slot resolution, agent-tracking JSON, PLAN read, SUMMARY write, codebase-map updates |

### Notable patterns

- **All PROJECT.md evolution paths leak** (transition.md, complete-milestone.md). PROJECT.md has zero SDK writers today.
- **Verify pipeline is read-SDK / write-Direct.** Reads (check.completion, check.gates, check.verification-status) are clean SDK; the canonical writes (VERIFICATION.md, UAT.md, VALIDATION.md, PATTERNS.md, EVAL-REVIEW.md, SECURITY.md, REVIEW.md, REVIEW-FIX.md, UI-REVIEW.md, UI-SPEC.md) all bypass SDK via Write tool.
- **Backlog skills (`add-backlog.md`, `review-backlog.md`)** embed inline workflows with direct I/O — they are NOT routers despite living in `commands/gsd/`.
- **state-mutation.js is the densest Bin B file** (17 of 18 exports are coordinated multi-write).
- **2 raw-git outliers:** `spec-phase.md` Step 7 and `eval-review.md` Step ~end use raw `git add` + `git commit` instead of `gsd-sdk query commit`. Inconsistent; recommend upstream fix.
- **`.planning/.next-call-count` and `.planning/tmp/`** are sidecar paths the noun catalog misses. Modeled below as named methods, not generic kv.

## 4. Adapter interface draft (the core deliverable)

### Bin A — Generic CRUD (target: ≤10 methods)

The bare-IO operations. Every adapter must support these; everything else is
implementable on top.

```ts
interface StorageAdapter {
  // Bare records
  getRecord(path: string): Promise<string | null>;
  putRecord(path: string, body: string): Promise<void>;
  removeRecord(path: string): Promise<void>;
  listCollection(prefix: string, filter?: Filter): Promise<RecordRef[]>;
  exists(path: string): Promise<boolean>;

  // Section-scoped (the foundational primitive — see §4 footnote)
  getSection(path: string, anchor: string): Promise<string | null>;
  updateSection(path: string, anchor: string, body: string, mode: 'overwrite' | 'append' | 'prepend'): Promise<void>;

  // Frontmatter (separate because the adapter may store it differently)
  getFrontmatter(path: string, field?: string): Promise<unknown>;
  updateFrontmatter(path: string, field: string, value: unknown): Promise<void>;
  mergeFrontmatter(path: string, patch: Record<string, unknown>): Promise<void>;
}
```

Total: 10 methods. Beads-adapter implements every Bin B method on top of these
plus a small helper layer; markdown-adapter implementations of `getSection` /
`updateSection` are the regex-rewrite primitives that today live in
state-mutation/phase-lifecycle.

### Bin B — Named domain methods (full deduped catalog)

All counts indicate "number of batches that proposed a near-equivalent name".
High counts = strong consensus; low counts = single-batch finds (likely
correct but should be sanity-checked).

#### Phase / Plan lifecycle (mostly already SDK-named)

| Method | Bin | Batches | Conflict notes |
|--------|-----|---------|---------------|
| `addPhase(description, opts?)` | B | 5 | PILOT, B1, B2, B7, B9 |
| `addPhaseBatch(descriptions[])` | B | 1 | B1 only |
| `insertPhase(after, description)` | B | 1 | B1 |
| `removePhase(phase, force?)` | B | 1 | B1 |
| `completePhaseAndCascade(phase)` | B | 2 | B1, B5; PILOT canonical example |
| `completeMilestone(version, opts)` | B | 2 | B1, B2; aggregates SUMMARYs + writes MILESTONES.md |
| `archivePhases(version)` | B | 2 | B1 (`phasesArchive`), B2 (`new-milestone`) — same op |
| `archivePhasesToMilestone({version, phases})` | B | 1 | B10 (`cleanup.md`) — overlaps with `archivePhases`; merge |
| `clearPhases(confirm)` | B | 1 | B1 |
| `findNextDecimalPhase(base)` | B | 1 | B1 |
| `scaffoldPhaseArtifact(type, phase, name?)` | B | 1 | B1 |
| `addBacklogEntry({number, description, slug})` | B | 1 | B1 |
| `promoteBacklogEntry(...)` | B | 1 | B1 |
| `removeBacklogEntry(number)` | B | 1 | B1 |
| `addPhaseDirectory(phase, slug)` | A | 1 | B1; could be subsumed by `putRecord` of an empty marker |
| `getPhase(phase)` / `findPhase(phase)` | A | 4 | B1, B2, B5, B6; merge to one — `getPhase` returns full record incl. archived fallback |
| `listPhases(opts?)` | A | 4 | B1 (`phasesList`), B2 (`roadmapAnalyze`), many — same op |
| `listPhasePlans(phase)` | A | 6+ | B1, B5, B6, B7, B4, B8 — strong consensus |
| `listPhaseSummaries(phase)` | A | 5+ | B2, B4, B6, B5, B7 |
| `listPhaseArtifacts(phase, kind?)` | A | 5 | Subsumes count variants from PILOT |
| `getPlan(phase, planId)` / `getPlan(path)` | A | 4 | B1, B5, B6, B7 |
| `addPlan(phase, plan)` | B | 1 | B2 (import.md) |
| `recordPlanAdded(phase, planId)` | B | 1 | B2 — cascade ROADMAP+STATE; could fold into `addPlan` |
| `addSummary(phase, planId, body)` | B | 1 | B1 (executor); was implicit in PILOT |
| `getSummary(path)` | A | 3 | B2, B5, B6 |
| `getPlanTaskStructure(path)` | A | 1 | B1 |
| `listPhasePlanSummaryPairs(phase)` | B | 1 | B5 (verify completeness) |
| `findPriorSummary(opts?)` | A | 1 | B1 |
| `getSummaryIssues(ref)` | A | 1 | B1 |
| `findNextIncompletePlan(phase)` | B | 1 | B1 |
| `checkPhaseReady(phase)` | B | 1 | B1 |
| `roadmapUpdatePlanProgress(phase)` | B | 1 | B1 |
| `updateRoadmapPhasePlanList(phase, ...)` | B | 1 | B1 (planner-agent leak fix) |
| `phasePlanIndex(phase)` | B | 1 | B1 (kept distinct from listPhasePlans because computes wave + completion) |

#### Roadmap / Milestone (Batch 2 cluster)

| Method | Bin | Batches | Notes |
|--------|-----|---------|-------|
| `getRoadmap()` | A | 7+ | universal |
| `getRoadmapPhase(phase)` | A | 5+ | already SDK |
| `getRoadmapSection(milestone)` | B | 1 | B2 |
| `getCurrentMilestone()` | B | 4 | B2, B3, B7, B9 |
| `getNextMilestone()` | B | 1 | B2 |
| `evolveRoadmap(edits)` | B | 2 | B7 (analyze-dependencies), B2 (complete-milestone reorganize) |
| `updateRoadmapDependencies(edits)` | B | 1 | B7 — likely a subset of `evolveRoadmap` |
| `reorganizeRoadmapForMilestone(...)` | B | 1 | B2; could fold into `evolveRoadmap` |
| `recordBacklogDeferral(...)` | B | 1 | B3 (next.md) |
| `annotateRoadmapDependencies(phase)` | B | 1 | B2 |
| `listMilestones()` | A | 1 | B10 |
| `listMilestoneArchives()` | A | 1 | B10 |
| `getArchivedMilestoneRoadmap(version)` | A | 1 | B10 |
| `getArchivedMilestoneDoc(milestone, kind)` | A | 1 | B2 |
| `getMilestoneAudit(milestone?)` | A | 2 | B2, B3 |
| `writeMilestoneAudit(milestone, audit)` | B | 1 | B2 |
| `addGapClosurePhases(phases[])` | B | 1 | B2 (`plan-milestone-gaps`) |
| `appendRetrospective(milestone, section)` | B | 1 | B2 |
| `getRetrospective()` | A | 2 | B1, B2 |
| `getMilestoneStats()` | B | 1 | B4 (statsJson — pilot) |
| `getMilestoneCompletion()` | B | 1 | B5 |
| `digestPhaseHistory()` | B | 1 | B2 |

#### State (Batch 3 cluster)

| Method | Bin | Batches | Notes |
|--------|-----|---------|-------|
| `getState()` | A | 6+ | universal |
| `getStateField(name)` | A | 2 | B3 |
| `getStateSnapshot()` | B | 3 | B3, B7, B8 |
| `updateStateField(name, value)` | A | 1 | B3 |
| `patchStateFields(map)` | A | 1 | B3 |
| **`recordStateEvent({type, payload})`** | B | 8+ | **Discriminated-union over types: roadmap_evolution, decision, blocker_added, blocker_resolved, metric, session, todo_count_update, deferred_items, forensic_session, quick_task. PILOT proposed; subsumes 10+ ad-hoc event methods from B1, B2, B3, B4, B6, B9.** |
| `recordSession({stoppedAt, resumeFile, action?})` | B | 2 | B3, B5 |
| `beginPhase({phase, name, planCount})` | B | 1 | B3 |
| `advancePlan()` | B | 1 | B3 |
| `markPhasePlanned({phase, planCount})` | B | 1 | B3 |
| `switchMilestone({version, name})` | B | 1 | B3 |
| `signalWaiting(payload)` | B | 1 | B3 |
| `clearWaitingSignal()` | A | 1 | B3 |
| `validateState()` | B | 1 | B3 |
| `syncState({verify?})` | B | 1 | B3 |
| `pruneState({keepRecent, dryRun?})` | B | 1 | B3 |
| `updateStateProgress()` | B | 1 | B3 |
| `evolveProject({validated[], invalidated[], emerged[], decisions[]}, scope: 'phase'\|'milestone')` | B | 2 | B2 (transition + complete-milestone) — fold the two into one with a scope param |
| `getProject()` / `getProjectMd()` | A | 4 | B2, B3, B6, B9 |
| `updateProjectValidatedRequirements(phaseId, names)` | B | 1 | B1 |
| `getProjectLoad()` | B | 1 | B3 |
| `getProjectTitle()` | A | 1 | B9 |

#### Verify / Check / UAT / Validation / Patterns / Security / Reviews (Batches 4, 5, 6)

| Method | Bin | Batches | Notes |
|--------|-----|---------|-------|
| `getVerification(phase)` | A | 2 | B2, B5 |
| `getVerificationStatus(phase)` | B | 3 | B3, B4, B5 — distinct from `getVerification` (status vs. full record) |
| `recordVerification(phase, report)` | B | 1 | B5 |
| `listVerificationsAcrossPhases(excludePhase?)` | A | 1 | B1 |
| `getUat(phase)` | A | 2 | B1, B5 |
| `listActiveUat()` | A | 1 | B5 |
| `listOutstandingUat()` | B | 2 | B2, B4 |
| `createUat(phase, init)` | B | 1 | B5 |
| `updateUat(phase, patch)` | B | 1 | B5 |
| `updateUatGap(phase, gapId, status)` | B | 1 | B1 |
| `updateUatStatus(phase, status)` | B | 1 | B1 |
| `updateUatGapDiagnoses(phase, diagnoses[])` | B | 1 | B6 |
| `getValidation(phase)` | A | 2 | B2, B5 |
| `recordValidation(phase, init)` | B | 1 | B5 |
| `appendValidationAudit(phase, audit)` | B | 1 | B5 |
| `recordPatterns(phase, body)` | B | 1 | B5 |
| `getSecurity(phase)` | A | 1 | B7 |
| `putSecurity(phase, body)` | B | 1 | B7 |
| `updateSecurityAuditTrail(phase, audit)` | B | 1 | B7 |
| `getThreatRegister(phase)` | B | 2 | B4 (`getPlanThreatModel` + `getSummaryThreatFlags`), B7 |
| `getReview(phase)` / `addReview(phase, body)` | A/B | 1 | B6 |
| `getReviewFix(phase)` / `addReviewFix(phase, body)` | A/B | 1 | B6 |
| `archiveReviewIteration(phase, iter, kind)` | B | 1 | B6 (replaces `cp` to `.iterN.md`) |
| `getUiSpec(phase)` / `addUiSpec(phase, body)` | A/B | 1 | B6, B7 |
| `getUiReview(phase)` / `addUiReview(phase, body)` | A/B | 1 | B6 |
| `addUiReviewScreenshot(phase, kind, bytes)` | B | 1 | B6 — see `writeBinaryAsset` primitive below |
| `getEvalReview(phase)` / `addEvalReview(phase, body)` | A/B | 1 | B4, B6 |
| `getAiSpec(phase)` | A | 2 | B6, B7 |
| `putAiSpec(phase, body)` | B | 1 | B7 |
| `getAiSpecTemplate()` | A | 1 | B7 |
| `validateAiSpec(phase)` | B | 1 | B7 |
| `updateAiSpecSection(phase, sectionId, body)` | B | 1 | B7 — section primitive (see §4 foundational) |
| `getReviews(phase)` / `addReviews(phase, body)` | A/B | 1 | B6 (cross-AI) |
| `recordDocVerification(docPath, report)` | B | 1 | B5 |
| `verifyPlanArtifacts(planPath)` | B | 1 | B5 — most reads target code repo |
| `verifySummary(summaryPath)` | B | 1 | B5 |
| `checkDecisionCoveragePlan(phase)` | B | 1 | B5 |
| `checkDecisionCoverageVerify(phase)` | B | 1 | B5 |
| `getPhaseCompletion(phase)` | B | 1 | B5 |
| `listSafetyGates(workflow, phase?)` | B | 1 | B5 |
| `routeNextAction()` | B | 1 | B5 |
| `detectPhaseType(phase)` | B | 1 | B5 |
| `getAutoMode()` / `getConfigGates()` | A | 1 | B5 |

#### Discuss / Spec / Research / Discovery / Explore (Batch 7)

| Method | Bin | Notes |
|--------|-----|-------|
| `getContext(phase)` / `putContext(phase, body)` | A/B | B1, B5, B6, B7 — converges across 3 discuss-phase variants |
| `updatePhaseContext(phase, mutator)` | B | B1 (mark dropped decisions [informational]) |
| `getSpec(phase)` / `putSpec(phase, body)` | A/B | B7 |
| `getResearch(kind)` / `writeResearch(kind, body)` | A/B | B2, B5, B7 — `kind` ∈ stack/features/architecture/pitfalls/summary/comparison/feasibility/phase |
| `getDiscovery(phase)` / `putDiscovery(phase, body)` | A/B | B7 |
| `putDiscussionLog(phase, body)` | B | B7 |
| `getCheckpoint(phase)` / `putCheckpoint(phase, json)` / `removeCheckpoint(phase)` | A/A/A | B7 — DISCUSS-CHECKPOINT.json |
| `putQuestionsState(phase, json)` / `getQuestionsState(phase)` | A | B7 — QUESTIONS.json |
| `putQuestionsCompanion(phase, html)` | A | B7 — QUESTIONS.html |
| `getMethodology()` | A | B7 — METHODOLOGY.md (read-only convention) |
| `getDecisionsIndex()` | A | B7 — DECISIONS-INDEX.md |
| `listPriorPhaseContexts(currentPhase, limit?)` | A | B7 |
| `listPhaseDecisions()` | A | B2 |
| `getDecisions(path)` | A | B2 |
| `recordDecision({phase, summary, rationale})` | B | folds into `recordStateEvent({type:'decision'})` |

#### Todos / Notes / Seeds / Memory / Handoff

| Method | Bin | Notes |
|--------|-----|-------|
| `listTodos(area?)` | A | universal (PILOT, B1, B3, B4, B9) |
| `getTodo(id)` | A | B9 |
| `addTodo({title, ...})` | B | B7, B9 |
| `completeTodo(id)` | B | PILOT, B4, B9 |
| `closeTodosByResolvesPhase(phase)` | B | B1 |
| `findNextTodoId()` | A | B9 |
| `tagTodoResolvesPhase(todoId, phase)` | B | B2 — fold into `updateTodo(id, patch)` |
| `listNotes(scope)` | A | B9 (project scope only) |
| `addNote({body, scope, date})` | B | B9 |
| `markNotePromoted(noteId)` | B | B9 |
| `findRelatedTodos(keyword)` | A | B9 |
| `addSeed({trigger, why, scope, breadcrumbs})` | B | B7, B9 |
| `listSeeds(filter?)` | A | B2, B9 |
| `getSeed(id)` | A | B2 |
| `findNextSeedId()` | A | B9 |
| `getHandoff()` | A | B3 |
| `putHandoff(payload)` | B | B3 |
| `removeHandoff()` | A | B3 |
| `listOrphanedHandoffs()` | A | PILOT, B4 |
| `getContinueHere(phase?)` | A | B3, B7 |
| `putContinueHere(...)` | A | B3 |
| `findContinueHere()` | A | B3 |
| `listMemoryEntries(filter?)` | A | PILOT, B4 |
| `findDeferredScopeRefs()` | B | PILOT, B4 — joins phase artifacts vs. roadmap |
| `findPlaceholderSummaries()` | A | B3 |
| `detectActiveContext()` | B | B3 (multi-subtree scan) |
| `listIncompletePlans()` | B | B3 |

#### Workstream / Workspace / Config / Skill manifest (Batch 10)

| Method | Bin | Notes |
|--------|-----|-------|
| `getActiveWorkstream()` | A | B10 |
| `listWorkstreams()` | A | B10 |
| `createWorkstream(name)` | B | B10 |
| `setActiveWorkstream(name)` | B | B10 |
| `getWorkstreamStatus(name)` | A | B10 |
| `archiveWorkstream(name)` | B | B10 (rename `complete→archive` per Rubric R7 verb cleanup; was `workstreamComplete`) |
| `listWorkstreamProgress()` | B | B10 |
| `createWorkspaceShell({path, repos, ...})` | B | B10 — only the WORKSPACE.md + .planning/ init parts; git worktree stays in workflow |
| `removeWorkspaceShell(name)` | B | B10 — adapter owns only the .planning/ subtree teardown |
| `getConfig(keyPath?)` | A | universal — fixes the `intel.md` and `graphify.md` leaks |
| `updateConfig(key, value)` | B | B10 |
| `ensureConfigSection(name)` | A | B10 |
| `createInitialConfig(choices)` | B | B10 |
| `updateModelProfile(profile)` | B | B10 |
| `getConfigPath()` | A | B10 (debatable — could be left as adapter-internal) |
| `writeSkillManifest(manifest)` | A | B9 — the only `.planning/`-touching part of skill discovery |
| `listProjectSkills()` | A | B6 (ui-phase), B9 |
| `listInstalledAgents()` | A | B9 — but Bin C2 (out of scope; targets `~/.claude/agents/`) |
| `getDocsInitContext()` | B | B10 — debatable; mostly C2 |

#### Spike / Sketch / Codebase-doc / Intel-doc / Learnings (Batch 8)

| Method | Bin | Notes |
|--------|-----|-------|
| `addSpike({number, name, type, validates, tags})` | B | B8 |
| `listSpikes(filter?)` | A | B8 |
| `getSpike(number)` | A | B8 (implied) |
| `getSpikeManifest()` | A | B8 |
| `updateSpikeManifest({entry})` | B | B8 |
| `getSpikeConventions()` | A | B8 |
| `updateSpikeConventions(patch)` | B | B8 |
| `recordSpikeResult({number, verdict, evidence})` | B | B8 — frontmatter mutation; could fold into `updateRecordFrontmatter(path, 'verdict', value)` |
| `addSpikeRequirement(text)` | B | B8 |
| `recordSpikeWrapUp(payload)` | B | B8 |
| `markSpikeProcessed(number)` | B | B8 |
| (same set, mirror) `addSketch`, `listSketches`, `getSketchManifest`, `updateSketchManifest`, `recordSketchWinner`, `recordSketchWrapUp`, `markSketchProcessed`, `getSketchTheme`, `putSketchTheme`, `putSketchAsset` | B/A | B8 — note `putSketchAsset` writes binaries; see `writeBinaryAsset` primitive |
| `putCodebaseDoc(name, body)` | A | B4, B8, B9 — closed enum: STACK/INTEGRATIONS/ARCHITECTURE/STRUCTURE/CONVENTIONS/TESTING/CONCERNS |
| `getCodebaseDoc(name)` | A | B4, B6, B8, B9 |
| `listCodebaseDocs()` | A | B4, B7, B9 |
| `addCodebaseDoc(name, body)` | B | folds into `putCodebaseDoc` if `kind` is a closed enum |
| `putIntelDoc(name, body)` | A | B4, B8 — closed enum: stack/files/apis/deps + arch.md |
| `getIntelDoc(name)` | A | B8 |
| `getIntelStatus()` / `getIntelDiff()` / `snapshotIntel()` / `validateIntel()` / `queryIntel(term)` | A | B4 |
| `patchIntelMeta(file)` | B | B4 |
| `recordIntelSnapshot({hashes})` | B | B8 |
| `recordLearnings({phase, decisions, lessons, patterns, surprises, missing})` | B | B8 |
| `markGraduated({phase, item, target, date})` | B | B8 |
| `listLearningSections()` | A | B9 |

#### Debug subsystem (Batch 6 — heavy)

| Method | Bin | Notes |
|--------|-----|-------|
| `listDebugSessions(filter?)` | A | B1, B6 |
| `getDebugSession(slug, includeResolved?)` | A | B6 |
| `addDebugSession({slug, trigger, symptoms?})` | B | B6 |
| `updateDebugSession(slug, patch)` | B | B6 — heavy: section-scoped semantics (overwrite Current Focus, append Evidence, append Eliminated, immutable Symptoms, overwrite Resolution) |
| `archiveDebugSession(slug)` | B | B1, B6 |
| `getDebugKnowledgeBase()` | A | B6 |
| `appendDebugKnowledgeBase(entry)` | B | B6 |
| `appendDebugSpecialistReview(slug, content)` | B | B6 — could fold into `updateDebugSession({appendSpecialistReview})` |

#### Dependency analysis / undo

| Method | Bin | Notes |
|--------|-----|-------|
| `getPhaseManifest()` | A | B6 (`undo.md`) |
| `findDependentPhases(phase)` | B | B6 |
| `findIntraPhasePlanDependencies(phase, plan)` | B | B6 |

#### Workflow init bundlers (Batch 9 cluster — collapse to one method per workflow)

| Method | Bin | Notes |
|--------|-----|-------|
| `getExecutePhaseInit(phase)` | B | B9 |
| `getPlanPhaseInit(phase)` | B | B9 |
| `getNewMilestoneInit()` | B | B9 |
| `getQuickInit(description)` | B | B9 |
| `getResumeInit()` | A | B9 |
| `getVerifyWorkInit(phase)` | B | B9 |
| `getPhaseOpInit(phase)` | B | B9 |
| `getMilestoneOpInit()` | B | B9 |
| `getMapCodebaseInit()` | A | B9 (`listCodebaseMaps()` already covers this) |
| `getNewProjectInit()` | B | B9 (brownfield detect is C2) |
| `getProgressInit()` | B | B9 (overlaps `listPhaseProgress`) |
| `getManagerInit()` | B | B9 — heaviest |
| `getProjectExistence()` | A | B9 |

These are workflow-init JSON bundles. Many compute the same primitives
internally (model resolution, milestone info, phase fallback). **Decision
needed:** keep as one Bin B method per workflow (current SDK shape) or
expose primitives and compose in workflow code? See §6 open question.

#### Reports / Forensics / Inbox

| Method | Bin | Notes |
|--------|-----|-------|
| `addForensicReport({timestamp, body})` | B | B4 |
| `listSessionReports()` | A | B3 |
| `putSessionReport({filename, body})` | A | B3 |
| `writeInboxTriageReport(content)` | A | B10 |
| `writeReport(name, body)` | A | B2 (generic — overlaps `putSessionReport`; merge under `putReport(kind, name, body)`) |

#### Doc ingestion (Batch 2)

| Method | Bin | Notes |
|--------|-----|-------|
| `writeDocClassification(slug, hash, classification)` | A | B2 |
| `listDocClassifications()` | A | B2 |
| `writeIntel(kind, body)` | A | B2 — overlaps `putIntelDoc`; merge |
| `writeIngestConflicts(report)` | A | B2 |
| `getIngestConflicts()` | A | B2 |
| `bootstrapFromGsd2(sourceDir, options)` | B | B8 — debatable adapter scope |

#### Templates / Commit

| Method | Bin | Notes |
|--------|-----|-------|
| `selectPhaseTemplate(phase)` | A | B10 |
| `fillTemplate(type, path, overrides)` | B | B10 |
| `commitPlanningState({message, files, flags})` | B | B10 — beads adapter likely no-op |
| `commitToSubrepo(payload)` | B | B10 |
| `checkCommitReady()` | A | B10 |

#### Sidecar / counter

| Method | Bin | Notes |
|--------|-----|-------|
| `getNextCallCount()` | A | B5 |
| `incrementNextCallCount()` | B | B5 |
| `recordTempArtifact(name, body)` / `getTempArtifact(name)` | A | B5 — `.planning/tmp/*` |

### Bin D — Presentation methods (out-of-scope; reference impl only)

`progressBar`, `progressTable`, `statsTable`, `formatAuditReport`,
`formatStateLoadRawStdout`, `uatRenderCheckpoint` (the formatted-string part).
These consume adapter data for human display; they live in a view layer
above the adapter, **not** as adapter methods. Markdown-adapter-default GSD
keeps them as today.

### Foundational primitives (cross-cutting)

The investigation surfaced six cross-cutting shapes. **These are the highest-
leverage adapter methods**: implementing them well makes most Bin B methods
trivial.

| Primitive | Replaces | Adapter cost |
|-----------|---------|--------------|
| `updateSection(file, sectionId, body, mode)` | All STATE.md/PROJECT.md/AI-SPEC.md/SPEC.md/UAT.md/VERIFICATION.md/DEBUG section mutations (~30 ad-hoc Bin B methods if exposed individually) | Markdown adapter: regex-based section locator + atomic rewrite. Beads adapter: per-section sub-record update |
| `getSection(file, anchor)` | UAT "Current Test", SUMMARY "Threat Flags", PLAN "<threat_model>", STATE "Pending Todos", debug "Evidence" — recurring extraction | Markdown adapter: regex extract. Beads adapter: per-section field read |
| `recordStateEvent({type, payload})` | 10+ ad-hoc append-typed-event handlers (state-mutation.js, fast.md, quick.md, next.md, forensics.md, etc.) | Markdown adapter: dispatch on `type` to section appender. Beads adapter: comment + label or typed sub-record |
| `snapshot()/restore()` (or `withTransaction(fn)`) | The whole `pipeline.js` dry-run middleware | Markdown adapter: cp -r to tmpdir (today's behavior, hoisted). Beads adapter: SQLite txn or JSONL append-then-truncate |
| `putNamedDoc(category, key, body)` / `getNamedDoc(category, key)` | All "kind-tagged getter/writer" pairs: `getResearch(kind)`, `putIntelDoc(name)`, `putCodebaseDoc(name)`, `getArchivedMilestoneDoc(milestone, kind)` — closed-enum file-name patterns | Markdown adapter: path computation per (category, key). Beads adapter: typed sub-records |
| `writeBinaryAsset(path, bytes)` | UI-review screenshots (`.planning/ui-reviews/{phase-ts}/desktop.png`), sketch HTML/CSS, sketch theme | Markdown adapter: write binary. Beads adapter: external blob store or attached file on issue |

**Total adapter-method count after consolidation (excluding foundational primitives, including Bin A and B):** approximately **96 methods** (38 Bin A, 58 Bin B). With the foundational primitives factored in, **the practical implementation surface drops to ~60 named methods** (the rest become thin wrappers over the 6 primitives).

## 5. Bin C operations

### C1 (obsolete — eliminate)

These have no place in the new architecture; the adapter writes canonical
records directly so the workaround logic disappears.

- `replaceInCurrentMilestone` (B1) — markdown lock-string-replace primitive
- `readModifyWriteRoadmapMd` (B1) — file-level lockfile primitive
- `intelUpdate` stub (B4) — agent-spawn dispatcher, no real I/O
- `validateAgents` (B4) — checks `~/.claude/agents/` install state, not planning
- `frontmatterValidate` (B8) — once typed reads return validated records, this
  becomes redundant
- Worktree-merge protect logic in `quick.md` (B3) — assumes git tracks `.planning/`
- `verifyCommits` / `verifySchemaDrift` / `verifyCodebaseDrift` / `verifyPathExists` (B5)
  — git/code-repo concerns wrapped as planning queries
- `intelExtractExports` (B4) — parses repo source code, not planning

### C2 (orthogonal — out of adapter scope)

These keep working under both adapters but are not the adapter's job.
The `gsd-beads` fork keeps them as plain SDK utilities.

| Operation | Where data actually lives |
|-----------|---------------------------|
| All `learnings*` exports (5) | `~/.gsd/knowledge/` (user-global) |
| `extractMessages`, `scanSessions`, `profileSample` | `~/.claude/projects/` (Claude Code session log) |
| `writeProfile`, `generateDevPreferences` | `~/.claude/get-shit-done/`, `~/.claude/commands/gsd/` (user-global) |
| `generateClaudeProfile`, `generateClaudeMd` (write side) | `<projectDir>/CLAUDE.md` (project root, not `.planning/`) |
| `init{New,List,Remove}Workspace` | `~/gsd-workspaces/` (sibling to project) |
| `detectCustomFiles` | runtime install dir (`~/.claude/get-shit-done/`) |
| `agentSkills`, `skillManifest` (read side) | `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `~/.claude/skills/` |
| `sync-skills.md`, `update.md`, `reapply-patches.md` | Runtime install dir |
| `inbox.md` GitHub triage | GitHub API (gh CLI) |
| `pr-branch.md` | git index/history rewrite |
| `ship.md` (most ops) | git, gh, REVIEW_CMD pipeline |
| `health.md` `find ~/.claude/tasks/` | runtime task dir |
| `websearch` | network |
| `gsd-user-profiler` rubric Read | install reference |
| `gsd-doc-writer` writes (README, ARCHITECTURE) | project root, `docs/` |
| `code-review-fix` source edits, worktree | source code |
| `gsd-codebase-mapper` upstream Reads | source code |
| `intel-updater` upstream Reads | source code |
| Test runners, build commands, anti-pattern grep | source code |

## 6. Open architectural questions for the next milestone

These need user/main-thread decisions before Phase 1 of the next milestone can lock.

1. **Markdown-and-lockfile helpers** (`replaceInCurrentMilestone`,
   `readModifyWriteRoadmapMd`): keep in markdown adapter as private
   implementation, eliminate from public interface? **Recommendation:** private
   to markdown adapter; not in interface.

2. **Adapter capability negotiation:** how does an adapter declare
   it doesn't support `writeBinaryAsset` (beads adapter), `commitPlanningState`
   (beads adapter no-op), or `snapshot/restore` (might be expensive on some
   backends)? Optional methods? `adapter.capabilities` flag set? Stub-with-throw?

3. **Section-scoped vs whole-file write granularity** for ROADMAP.md, STATE.md,
   PROJECT.md: which level does the adapter own? `putRecord('STATE.md', body)`
   plus `updateSection` is too coarse — concurrent writers can clobber each
   other. Probably: **section is the unit of write atomicity**; whole-file
   writes deprecated for canonical files; markdown adapter implements
   whole-file via merge-locked section writes.

4. **Sidecar paths** (`.planning/.next-call-count`, `.planning/tmp/*`): generic
   kv primitives or named methods? **Recommendation:** named methods
   (`getNextCallCount` / `incrementNextCallCount`, `recordTempArtifact`) — the
   beads adapter can decide the storage shape (issue field, kv table, scratch
   table) without exposing kv to consumers.

5. **Knowledge-graph subsystem** (`.planning/graphs/graph.json`,
   `gsd-tools.cjs graphify`): separate adapter, sub-interface of StorageAdapter,
   or out-of-scope for v1? **Recommendation:** separate `GraphAdapter` (or
   out of scope for v1) — graph queries have a wholly different access pattern
   from records.

6. **"Scratch" record taxonomy** (`*-DISCUSS-CHECKPOINT.json`, `*-QUESTIONS.json`,
   `*-QUESTIONS.html`, `.planning/tmp/*`): first-class types in the noun catalog
   or generic kv? **Recommendation:** first-class — they have lifecycle
   semantics (created, read, removed) that kv hides.

7. **2 raw-git outliers** (`spec-phase.md`, `eval-review.md`): they bypass
   `gsd-sdk query commit` for raw `git add`/`git commit`. **Recommendation:**
   file upstream issue against GSD; fix in fork. (Both are clearly mistakes —
   no other workflow does this.)

8. **`commitPlanningState` semantics across adapters:** for markdown, it's
   `git add` + `git commit`. For beads, what does it mean? **Recommendation:**
   no-op (beads is its own transactional store) OR "checkpoint" (snapshot the
   bd state). Affects how every workflow's "commit at end" step behaves.

9. **AI-SPEC three-author concurrency:** three subagents write three different
   sections of one AI-SPEC.md sequentially in the markdown adapter. In a
   non-filesystem adapter where writes can be concurrent, do we need per-section
   locking? **Recommendation:** the `updateSection` primitive must be atomic;
   the workflow continues to drive sequential calls.

10. **Init-bundle granularity:** keep ~13 `getXxxInit()` Bin B methods or
    decompose to primitives? **Recommendation:** keep coarse — these are
    workflow-shaped contracts. Adapters compose primitives internally.

## 7. Suggested next-milestone scope

Concrete shape based on the investigation:

- **Phase 1 — Fork bootstrap + adapter interface skeleton + MarkdownAdapter
  scaffold.** Bootstrap fork from upstream GSD; define StorageAdapter TypeScript
  interface (Bin A primitives + foundational primitives only); scaffold
  `MarkdownAdapter` that implements primitives by delegating to today's
  `node:fs` code. Wire `createRegistry({adapter})` in `index.js` per Batch 10
  finding. Verify zero behavior change against upstream test suite.

- **Phase 2 — Wire core read methods.** Migrate every SDK-already-exposed read
  query (`progressJson`, `roadmapAnalyze`, `stateJson`, `findPhase`,
  `phasesList`, `phasePlanIndex`, `summaryExtract`, etc. — ~40 methods) to call
  `adapter.*` instead of direct `node:fs`. Batches 1, 2, 3, 4, 5 cover most.

- **Phase 3 — Wire core write methods + recordStateEvent.** Migrate
  state-mutation.js (18 handlers) to use `recordStateEvent({type, payload})`
  + `updateSection`. Migrate phase-lifecycle.js (13 handlers) to use the
  Bin B named methods over primitives. Wire `addPhase`, `completePhaseAndCascade`,
  `recordVerification`, `addSummary`, `createUat`/`updateUat`, etc. Batches
  1, 3, 5 cover this.

- **Phase 4 — Plug workflow leaks.** Refactor the top-10 leaking workflows
  (§3) to call adapter methods instead of Read/Write/Edit/cp/mv. Hold up
  `workflows/insert-phase.md` (Batch 1's cleanest exemplar) as the template:
  no raw `Edit`/`Write`, all mutations via `state.patch` +
  `state.add-roadmap-evolution`. Apply this pattern to all leakers. Demote
  Rule 4 in the codebase: leak-grep all skills' frontmatter `<context>` blocks
  and route `@.planning/...` references through the adapter.

- **Phase 5 — Foundational primitive lift.** Implement `getSection`,
  `updateSection`, `snapshot/restore` (or `withTransaction`),
  `putNamedDoc/getNamedDoc`, `writeBinaryAsset`. Refactor section-scoped
  Bin B methods (debug session updates, AI-SPEC section writes,
  PROJECT.md evolution, UAT lifecycle) onto these primitives. Hoist
  `pipeline.js` dry-run to `withTransaction`.

- **Phase 6 — BeadsAdapter implementation.** Implement adapter against `bd`
  using carry-forward from current gsd-beads work (§8). Leverage 13 spike
  findings + format module + helpers. Map domain methods: `addPhase` → bd
  issue with `gsd:phase` label; `recordStateEvent` → typed comment;
  `updateSection` → per-section sub-records or comment-with-anchor. Sketch
  conformance against MarkdownAdapter's behavior.

- **Phase 7 — Conformance test suite + dry-run hoist completion.** Each
  Bin B method gets a paired test that runs against both adapters and
  asserts equivalent outcomes. Property-based tests for round-trips.
  Verify dry-run primitive correctness on both adapters.

- **Phase 8 — Migration + distribution.** Existing GSD users opt-in to
  `gsd-beads` via config (`storage.adapter: beads`). Migration tool reads
  current `.planning/` and seeds bd issues. Document hooks for fork
  divergence/upstream patch reapply.

## 8. Recommended carry-forward from current gsd-beads work

- **BeadsAdapter implementation:** the 13 spike findings (auto-loaded
  via `Skill("spike-findings-gsd-beads")`); format module concept;
  `parsePhaseId`, `deriveDiskStatus`, `loadMilestoneHeading` helpers;
  JSONL roundtrip seed pattern; blocks-edge sibling-dep modeling
  (spike 014). These translate directly into the BeadsAdapter (Phase 6).
- **Rubric and convention sheet** (this synthesis §2 noun catalog).
- **Test fixtures and helpers** built during the spike work.
- **The "bd-managed detection" memory** (`project_bd_managed_mismatch.md`)
  — the new architecture's adapter-construction step needs to handle this
  cleanly (adapter `init()` validates the store is bd-managed before
  reads/writes).
- **Hook workarounds memory** (`feedback_hook_workarounds.md`) becomes
  unnecessary once leaks are surfaced as adapter calls; review at end
  of Phase 4.

## 9. Risk register

| Risk | Severity | Mitigation |
|------|---------|-----------|
| **Section-scoped semantics differ across adapters.** Markdown's "append" is line-based; beads' "append" might mean comment-add, sub-record append, or no-op. Subtle bugs from semantic drift. | High | Explicit conformance tests (Phase 7) defining "append" / "overwrite" / "prepend" outcomes per (record-type, section-id). Reject any adapter without a defined semantic for each tuple. |
| **Dry-run hoist non-trivial.** `pipeline.js` is referenced by every mutating SDK handler today. Replacing with `withTransaction` requires updating every caller, plus deciding what "rollback" means for partial-write failures. | High | Dedicate Phase 5 to this. Don't ship Phase 6 (BeadsAdapter) until dry-run is stable on MarkdownAdapter. |
| **Rule 4 demotion increases scaling cost.** Every fork author / adapter implementer has to skim every skill body, not trust auto-classification. ~120 skills. | Medium | Tooling: a `verify.fat-skills` SDK query that lists all non-router skills with line-count + leak count. Make the list authoritative; check at CI. |
| **Multi-author files (AI-SPEC.md) imply concurrency.** Markdown adapter today gets away without locks because writes are sequential at the workflow level. A non-filesystem adapter with parallel writers could lose work. | Medium | Mandate atomic `updateSection`. Document the sequential-call assumption in the adapter contract; tests assert it. |
| **2 raw-git outliers (spec-phase, eval-review)** stay raw in the fork unless explicitly fixed. | Low | File upstream issue. Fix in fork during Phase 4. Tracked here. |
| **`<context>`-block leaks evade workflow refactor.** Even after Phase 4, skill frontmatter `@.planning/STATE.md` references still get loaded by Claude Code at activation, before any adapter intercepts. | High | Hook strategy: scan + rewrite skill frontmatter at install time, OR document explicitly that adapter consumers must avoid `@.planning/*` in `<context>` and use SDK calls instead. Affects ~5+ skills (add-tests is confirmed; full audit needed). |
| **Beads adapter can't model "binary asset"** cleanly. Sketches write HTML/CSS; UI auditor writes PNG screenshots. | Medium | `writeBinaryAsset` capability flag; beads adapter declares unsupported and either errors or routes to external blob store. |
| **Workflow-init bundlers (~13 Bin B methods) couple workflow to adapter shape.** If a workflow changes init shape, every adapter must re-implement. | Medium | Decompose where reasonable; keep coarse where workflow shape is stable. Acceptance: ≤15 init bundlers and stable for 1+ minor versions before changes. |
| **Knowledge-graph subsystem out of scope** but heavily referenced by `gsd-phase-researcher` and `graphify.md`. If left out of v1 fork, those skills break under bd-adapter. | Medium | Phase 6 ships with knowledge-graph in markdown-only mode; beads adapter declares graph capability unsupported; phase-researcher gracefully degrades. |
| **`commitPlanningState` semantics ambiguous** for non-git backends. | Low | Decide in §6 question 8 before Phase 3. |
