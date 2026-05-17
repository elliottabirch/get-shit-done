---
phase: 02-wire-core-read-methods-to-adapter
plan: "02"
subsystem: storage-adapter
tags: [storage-adapter, sdk, reads, phase, state, progress, roadmap, audit-open, verify]

# Dependency graph
requires:
  - phase: 02-wire-core-read-methods-to-adapter
    plan: "01"
    provides: stat() Bin A primitive; planningRelativePath helper; route-next-action.ts migration recipe; createRegistry closure-wrapper pattern
provides:
  - "8 SDK read handlers + 4 helpers fully adapter-routed (findPhase, phasePlanIndex, roadmapAnalyze, roadmapGetPhase, checkPhaseReady, checkVerificationStatus, detectPhaseType, auditOpen, progressJson, getMilestoneInfo, extractCurrentMilestone, extractNextMilestoneSection, parseMilestoneFromState, determinePhaseStatus)"
  - "Adapter-routed read paths in mixed-D-14 files: progress.ts (progressJson body), verify.ts (verifyPhaseCompleteness, verifySchemaDrift); writes deferred to Phase 3"
  - "createRegistry closure wrappers for 12+ Plan 2 handler families (find-phase, phase-plan-index, roadmap.analyze, roadmap.get-phase, check.phase-ready (×2), check.verification-status (×2), detect.phase-type (×2), audit-open (×2), progress, progress.json)"
  - "tests/conformance/phase-reads.test.ts: 17 reproductive tests across 11 describe blocks"
  - "helpers.ts: adapterFor() — transitional Phase 2 helper for unmigrated handlers that need to call adapter-aware helpers (Plans 02-03/04 + Phase 3 will replace these inline constructions)"
affects:
  - "Plan 02-03 (parallel wave) inherits the migrated phase/roadmap helpers when its summary.ts/intel.ts/uat.ts handlers thread adapter; the index.ts handler-registration block has appendage points after the Task 1+2 wrappers"
  - "Plan 02-04 init bundlers compose the adapter-aware helpers (getMilestoneInfo, extractCurrentMilestone, extractNextMilestoneSection) directly instead of constructing inline adapters"
  - "Phase 3 write-side migration removes the adapterFor() inline constructions and threads adapter from the registry closure for all remaining handlers"
  - "Phase 7 BeadsAdapter — phase-reads.test.ts already runs against any StorageAdapter via createRegistry, so BeadsAdapter coverage is automatic"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adapter-as-explicit-first-arg signature applied to 8 handlers + 4 helpers"
    - "Pitfall 2 (Promise.all): all multi-file walks parallelized — audit-open's 8 scanners + per-scanner per-file reads, findPhase's archived-milestone walk, phasePlanIndex's per-plan content read, roadmapAnalyze's per-phase walk, progressJson's per-phase listing, verifySchemaDrift's plan/summary content reads"
    - "Pitfall 3 (redundant exists+list): all migrated callers rely on listCollection's empty-array-on-ENOENT semantics; explanatory comments added at each removed exists() check"
    - "D-14 (per-line read-only discipline) in mixed files: progress.ts and verify.ts top-of-file comments document which fs imports remain for write paths and out-of-scope reads (user-supplied paths in verify.ts; todos/pending writes in progress.ts)"
    - "Transitional adapterFor(projectDir) helper for unmigrated callers (init.ts, init-complex.ts, state.ts, phase-lifecycle.ts, check-gates.ts, check-completion.ts, check-ship-ready.ts, roadmap-update-plan-progress.ts) that consume adapter-aware helpers without yet threading adapter through their own signatures"

key-files:
  created:
    - tests/conformance/phase-reads.test.ts
  modified:
    - sdk/src/query/phase.ts (findPhase, phasePlanIndex, getPhaseFileStats, searchPhaseInDir adapter-aware; ~6 fs reads → ~7 adapter calls)
    - sdk/src/query/roadmap.ts (parseMilestoneFromState, getMilestoneInfo, extractCurrentMilestone, extractNextMilestoneSection, roadmapGetPhase, roadmapAnalyze adapter-aware; D-14 read-only for requirementsMarkComplete; ~7 fs reads → ~9 adapter calls)
    - sdk/src/query/phase-ready.ts (checkPhaseReady + roadmapPhaseLineHasUiIndicators + hasUiSpecFile adapter-aware; 3 fs reads → 3 adapter calls)
    - sdk/src/query/check-verification-status.ts (checkVerificationStatus adapter-aware; 3 fs reads → 2 adapter calls)
    - sdk/src/query/detect-phase-type.ts (detectPhaseType + roadmapHeadingForPhase adapter-aware; 4 fs reads → 4 adapter calls; Promise.all for sub-dir walk)
    - sdk/src/query/audit-open.ts (8 scanners + auditOpenArtifacts adapter-aware; 16 fs reads → 15 adapter calls; Promise.all top-level + per-scanner)
    - sdk/src/query/progress.ts (progressJson, determinePhaseStatus, statsJson read paths adapter-aware; 6 fs reads → 8 adapter calls; D-14 deferral for writes + todos/pending fall-through)
    - sdk/src/query/verify.ts (verifyPhaseCompleteness, verifySchemaDrift read paths adapter-aware; 6 .planning/-scoped fs reads → 8 adapter calls; D-14 deferral for user-supplied path reads)
    - sdk/src/query/helpers.ts (added adapterFor() transitional helper)
    - sdk/src/query/index.ts (10+ closure wrappers added for migrated handlers)
    - sdk/src/query/route-next-action.ts (callsites of findPhase, roadmapAnalyze updated to pass adapter)
    - sdk/src/query/state.ts (extractCurrentMilestone + getMilestoneInfo callsites — inline adapter via adapterFor)
    - sdk/src/query/init.ts (5 callsites of findPhase/roadmapGetPhase/getMilestoneInfo/extractCurrentMilestone — inline adapter)
    - sdk/src/query/init-complex.ts (4 callsites of getMilestoneInfo/extractCurrentMilestone/extractNextMilestoneSection — inline adapter)
    - sdk/src/query/phase-lifecycle.ts (5 callsites of extractCurrentMilestone — inline adapter)
    - sdk/src/query/check-gates.ts (1 findPhase callsite — inline adapter)
    - sdk/src/query/check-completion.ts (2 findPhase/roadmapAnalyze callsites — inline adapter)
    - sdk/src/query/check-ship-ready.ts (1 checkVerificationStatus callsite — inline adapter)
    - sdk/src/query/roadmap-update-plan-progress.ts (1 findPhase callsite — inline adapter)
    - sdk/src/query/phase.test.ts (18 tests updated for adapter signature)
    - sdk/src/query/roadmap.test.ts (36 tests updated for adapter signature; getMilestoneInfo, extractCurrentMilestone, extractNextMilestoneSection, roadmapAnalyze, roadmapGetPhase)
    - sdk/src/query/phase-ready.test.ts (3 tests updated for adapter signature)
    - sdk/src/query/check-verification-status.test.ts (7 tests updated)
    - sdk/src/query/detect-phase-type.test.ts (9 tests updated)
    - sdk/src/query/progress.test.ts (11 tests updated for adapter signature on progressJson + determinePhaseStatus)

key-decisions:
  - "D-12 implemented: every .planning/-scoped fs read in the 8 plan-scope files routed through adapter; SDK_FS_READ_PATTERNS leak-grep returns 0 matches per Form C exit gate"
  - "D-14 implemented: write paths in progress.ts (todoComplete) and verify.ts (verifyPlanStructure / verifyArtifacts / verifyReferences / verifySummary / verifyPathExists user-supplied path reads) UNCHANGED — Phase 3 territory"
  - "D-10 implemented: 8 handlers + 4 helpers take adapter as explicit first parameter; closure wrappers register them in createRegistry"
  - "MED-2 fix: count assertion verifies 12 Plan 2 wrappers register correctly (find-phase, phase-plan-index, roadmap.analyze, roadmap.get-phase, check.phase-ready ×2, check.verification-status ×2, detect.phase-type ×2, audit-open ×2, progress, progress.json)"
  - "HIGH-1 fix: every <verify> block uses Form A/C explicit exit-code checks; no broken `[ \"$(...; echo $?)\" = \"0\" ]` idiom"
  - "Pitfall 1 (async ripple): all callsites of newly-async helpers updated to await; cross-file callers update through adapterFor() transitional helper"
  - "Pitfall 2 (Promise.all): audit-open uses 2-level Promise.all (top-level + per-scanner); findPhase, phasePlanIndex, roadmapAnalyze, progressJson, statsJson, verifySchemaDrift, detectPhaseType all parallelize multi-file walks where applicable"
  - "Pitfall 3 (redundant exists-before-list): cleanups applied at every migrated call site with inline `// Pitfall 3:` comments"
  - "Pitfall 10 (workstream paths): planningRelativePath used at every adapter call site in the 8 migrated files"
  - "Architectural decision (Rule 3): the adapterFor() inline helper is a transitional pattern, not the end state — Plans 02-03/04 + Phase 3 will replace inline constructions with proper adapter threading from createRegistry. The choice was made to keep Task 1+2 atomic without scope-exploding into init/state/phase-lifecycle migrations that belong to Plan 02-04 + Phase 3."

requirements-completed: []
requirements-partial:
  - READS-01 (Plan 1 covered the recipe + state.load + route-next-action; Plan 02-02 covers ~50 read sites in 8 files; Plans 02-03/04 cover the remaining document/init reads)

# Metrics
duration: 56min
completed: 2026-05-01
---

# Phase 2 Plan 02: Phase / state / progress / roadmap reads via adapter — Summary

**Migrates the largest concentration of `.planning/`-scoped fs reads in the SDK — 8 handler files, 4 cross-file helpers, ~50 read call sites — through the StorageAdapter seam established by Plan 02-01. After this plan, the per-plan exit gate's leak-grep returns zero matches across all 8 files, and a 17-test conformance suite covers each migrated handler family end-to-end.**

## Performance

- **Duration:** ~56 min
- **Started:** 2026-05-01T09:50:23Z
- **Completed:** 2026-05-01T10:46:00Z
- **Tasks:** 3 (Task 1, Task 2, Task 3)
- **Files created:** 1 (`tests/conformance/phase-reads.test.ts`)
- **Files modified:** 23 (8 plan-scope handlers + 4 cross-file helpers + 8 transitional callers + helpers.ts + index.ts)
- **Adapter call sites added:** ~60 (replacing ~50 fs reads — adapter calls outnumber fs reads because some fs ops fan out into adapter listCollection + stat + getRecord triples)

## Accomplishments

### Task 1 — phase/roadmap/phase-ready/check-verification-status/detect-phase-type migration (commit `cd6ff30d`)

5 read-mostly SDK files migrated:

- **phase.ts**: `findPhase`, `phasePlanIndex`. Inner helpers `getPhaseFileStats` and `searchPhaseInDir` adapter-aware. The archived-milestone walk uses Promise.all of stat probes (Pitfall 2). 6 fs reads → 7 adapter calls (the dir-vs-file probe needs an extra stat per ref).
- **roadmap.ts**: `roadmapAnalyze`, `roadmapGetPhase` migrated. Cross-file helpers `getMilestoneInfo`, `extractCurrentMilestone`, `extractNextMilestoneSection`, `parseMilestoneFromState` migrated to adapter-as-first-arg. `requirementsMarkComplete` retains QueryHandler signature with inline `MarkdownAdapter` for D-14 read-only discipline (its writeFile remains for Phase 3). 7 fs reads → 9 adapter calls.
- **phase-ready.ts**: `checkPhaseReady` + helpers `roadmapPhaseLineHasUiIndicators` + `hasUiSpecFile` adapter-aware. 3 fs reads → 3 adapter calls.
- **check-verification-status.ts**: `checkVerificationStatus` adapter-aware. The redundant `existsSync` before `readdirSync` was removed per Pitfall 3. 3 fs reads → 2 adapter calls.
- **detect-phase-type.ts**: `detectPhaseType` adapter-aware with parallel sub-directory walk via Promise.all (Pitfall 2). 4 fs reads → 4 adapter calls.

Cross-file callers updated to thread the adapter through. Where the calling handler hadn't been migrated to take an adapter (init.ts, init-complex.ts, state.ts, phase-lifecycle.ts, check-gates.ts, check-completion.ts, check-ship-ready.ts, roadmap-update-plan-progress.ts), `adapterFor(projectDir)` is constructed inline at the call site as a transitional pattern. This keeps the build green between Task 1 and the eventual full migration of those handlers in Plans 02-03/04 + Phase 3.

createRegistry closure wrappers wired in `sdk/src/query/index.ts` for `find-phase`, `phase-plan-index`, `roadmap.analyze`, `roadmap.get-phase`, `check.phase-ready` (×2 alias), `check.verification-status` (×2 alias), `detect.phase-type` (×2 alias).

Test files updated: `phase.test.ts` (18 tests), `roadmap.test.ts` (36 tests), `phase-ready.test.ts` (3 tests), `check-verification-status.test.ts` (7 tests), `detect-phase-type.test.ts` (9 tests). All 73 tests pass.

### Task 2 — audit-open + progress + verify (D-14) migration (commit `0cce9981`)

3 SDK files with the highest read concentration:

- **audit-open.ts** — the 16-read beast: all 8 scanners (debug/quick/threads/todos/seeds/uat/verification/context) now adapter-aware, threading adapter through every per-file read. The 3 near-identical phase-walk scanners (uat, verification, context) deduplicated through a new `scanPhaseFiles()` helper. Top-level `auditOpenArtifacts()` runs all 8 scanners in parallel via Promise.all. Per-scanner reads parallelize via Promise.all (Pitfall 2). 16 fs reads → 15 adapter calls + 13 Promise.all sites (acceptance criterion: ≥1 Promise.all).
- **progress.ts** — D-14 mixed file: `progressJson`, `determinePhaseStatus`, and `statsJson` read paths migrated. The handler bodies route through adapter; `progressBar` and `progressTable` thread adapter through to `progressJson`. Phase 2 D-14 marker comment block at top of file documents which fs imports remain for write paths (todoComplete: writeFileSync/mkdirSync/unlinkSync) and out-of-scope reads (todoMatchPhase, listTodos: todos/pending — Phase 3 owns this dir end-to-end). 6 fs reads → 8 adapter calls.
- **verify.ts** — D-14 mixed file: `verifyPhaseCompleteness` and `verifySchemaDrift` read paths migrated. Pitfall 2 Promise.all parallelizes plan/summary content reads in verifySchemaDrift. Phase 2 D-14 marker comment documents that user-supplied path reads in `verifyPlanStructure`, `verifyArtifacts`, `verifyReferences`, `verifySummary`, `verifyPathExists` remain on raw fs because their paths are NOT `.planning/`-scoped (the path-scoped leak-grep gate naturally passes them). 6 .planning/-scoped fs reads → 8 adapter calls.

createRegistry closure wrappers wired for `audit-open` (×2 alias) and `progress` / `progress.json`.

`progress.test.ts` updated (11 tests, all pass). `verify.test.ts` and `decomposed-handlers.test.ts` had no signature breaks (verifyPhaseCompleteness + verifySchemaDrift retain QueryHandler shape with inline adapter via adapterFor).

### Task 3 — Conformance test for migrated handlers (commit `90b08e7c`)

`tests/conformance/phase-reads.test.ts` — 17 tests across 11 describe blocks (1 outer + 10 handler-specific). Each describe exercises its handler end-to-end via `createRegistry({adapter}) → registry.dispatch()` against a seeded `.planning/` tree. Read-side coverage:

- `find-phase`: finds existing phase 01, returns not-found for missing
- `phase-plan-index`: wave grouping, error on missing phase
- `roadmap.get-phase`: phase section extraction with goal field
- `roadmap.analyze`: full milestone analysis with disk correlation
- `progress.json`: plan/summary aggregation with percent calc
- `audit-open`: scans 8 artifact categories (todos/threads/debug seeded); has_open_items=false for empty tree
- `check.phase-ready`: existing phase + missing-phase fallback (next_step=discuss)
- `check.verification-status`: passing table parse (status=pass, score=2/2), missing fallback
- `detect.phase-type`: empty-phase + UI-SPEC.md detection
- `verify.phase-completeness`: complete and incomplete phase rollups

Per Phase 1 D-15, the conformance harness pattern is locked: when Phase 7 adds BeadsAdapter, this test file runs unchanged against any `StorageAdapter` via createRegistry — no changes needed for cross-adapter coverage.

## Task Commits

| Task | Commit hash | Description |
|------|-------------|-------------|
| 1    | `cd6ff30d`  | refactor(02-02): migrate phase/roadmap reads through adapter |
| 2    | `0cce9981`  | refactor(02-02): migrate audit-open/progress/verify reads through adapter |
| 3    | `90b08e7c`  | test(02-02): add phase-reads conformance tests |

## Plan-level verification

All 6 verifications pass:

1. `cd sdk && npm run build` — SDK builds with all 8 migrated files
2. `npm test` — 6074/6105 tests pass; 31 failing tests are the pre-Plan-2 baseline (unchanged) — no regression introduced by Plan 2
3. **Per-plan exit gate (HIGH-1 Form C)** — leak-grep loop over all 8 files exits 0:
   ```bash
   for f in sdk/src/query/{phase,roadmap,progress,audit-open,phase-ready,verify,check-verification-status,detect-phase-type}.ts; do
     node scripts/leak-grep.cjs "$f" >/dev/null 2>&1 || { echo "leak-grep failed for $f"; exit 1; }
   done
   ```
   Result: `all 8 files clean`
4. `vitest run tests/conformance/phase-reads.test.ts` — 17/17 tests pass (per-plan exit gate D-03 part b)
5. **MED-2 count assertion**: `grep -cE "registry\.register\('(find-phase|phase-plan-index|roadmap\.(analyze|get-phase)|phase-ready|check\.phase-ready|check phase-ready|check\.verification-status|check verification-status|detect\.phase-type|detect phase-type|audit-open|audit open|progress|progress\.json)'" sdk/src/query/index.ts` returns 12 (≥8 required)
6. `vitest run tests/conformance/` — 4/4 conformance test files pass (35 total: 8 helpers + 5 markdown + 5 stat + 17 phase-reads)

## Decisions Made

- **adapterFor() transitional helper**: cross-file callers in unmigrated handlers (init.ts, init-complex.ts, state.ts, phase-lifecycle.ts, check-gates.ts, check-completion.ts, check-ship-ready.ts, roadmap-update-plan-progress.ts) need to call now-adapter-aware helpers like `getMilestoneInfo`. Two options: (a) migrate ALL those handlers in Task 1 — would explode scope into Plans 02-04 + Phase 3 territory; (b) construct adapter inline at call sites. Chose (b) with `helpers.ts:adapterFor(projectDir)` for grep-ability and consistent pattern. Plans 02-03/04 + Phase 3 replace these inline constructions when they migrate the calling handlers.

- **D-14 split for progress.ts**: the file has THREE classes of reads — (1) progressJson/statsJson body (in scope, migrated), (2) todoMatchPhase/listTodos read fall-throughs against `todos/pending/` (out of scope per plan; Phase 3 owns todos/), (3) user-supplied path reads in todoComplete (write-side, Phase 3). Documented at top of file via Phase 2 D-14 comment block.

- **D-14 split for verify.ts**: similar pattern. Read paths in verifyPhaseCompleteness and verifySchemaDrift (both .planning/-scoped) migrated. Read paths in verifyPlanStructure, verifyArtifacts, verifyReferences, verifySummary, verifyPathExists are NOT .planning/-scoped (user-supplied paths) — left on raw fs. The path-scoped leak-grep gate naturally passes them without explicit allowlisting.

- **Skipped statSync→adapter.stat in verifyPathExists**: the plan acceptance criterion `grep -cE "await\s+adapter\.stat" sdk/src/query/verify.ts` returns ≥1 was satisfied by the two adapter.stat call sites in verifyPhaseCompleteness and verifySchemaDrift. The line-544 statSync in verifyPathExists is on a user-supplied (potentially non-.planning/) path — adapter.stat is rooted at .planning/ and would change semantics. Left unchanged with the two satisfying matches elsewhere.

- **Test signatures for QueryHandler-shaped handlers vs adapter-first handlers**: handlers that took a fresh adapter signature (findPhase, phasePlanIndex, roadmapAnalyze, roadmapGetPhase, checkPhaseReady, checkVerificationStatus, detectPhaseType, auditOpen, progressJson) had their direct-call test signatures updated. Handlers that retained QueryHandler shape (verifyPhaseCompleteness, verifySchemaDrift, requirementsMarkComplete, plus all the cross-file callers in init.ts/init-complex.ts/etc.) construct adapter inline via adapterFor and don't need test signature changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Pre-Task-1 worktree was on upstream main, not feat/storage-adapter**
- **Found during:** initial state load
- **Issue:** The worktree `worktree-agent-acc4dc42640dfe9df` had its branch HEAD pointing at upstream's `006cdafe` (post-PR #2910) rather than feat/storage-adapter's `42e20450`. This meant Plan 02-01's foundation work was not visible at the worktree's HEAD, even though the orchestrator's spawn message claimed "Plan 02-01 just merged".
- **Fix:** `git reset --hard feat/storage-adapter` from inside the worktree (allowed per the destructive_git_prohibition's worktree_branch_check exception at agent startup).
- **Documented in:** This summary (no commit needed — the reset put the worktree on the correct HEAD)

**2. [Rule 3 — Blocking] Edit/Write tools needed full worktree absolute paths**
- **Found during:** Task 1 phase.ts initial migration
- **Issue:** Calling Edit/Write with `/home/ellio/code/get-shit-done/sdk/...` (the main-worktree resolved path) reported success but did NOT persist changes — the file remained on its pre-migration content. The project's symbolic link layout means tool writes need the explicit `/home/ellio/code/get-shit-done/.claude/worktrees/agent-acc4dc42640dfe9df/sdk/...` worktree path.
- **Fix:** Use the full worktree-specific absolute path for every Write/Edit call.
- **Verified by:** `head -3 sdk/src/query/phase.ts` showing the migrated content + `wc -l` showing line count diff from baseline + leak-grep passing.

**3. [Rule 3 — Blocking] adapters/dist not present in this worktree**
- **Found during:** initial SDK build attempt
- **Issue:** SDK build (`npm run build` in sdk/) errored with `TS6305 Output file '...adapters/dist/markdown/index.d.ts' has not been built from source file '...adapters/markdown/index.ts'`. The adapters dist wasn't built in this worktree, only in the main repo.
- **Fix:** `cd adapters && ../sdk/node_modules/.bin/tsc` to build adapters' dist directly. SDK's tsc project-reference now resolves correctly.

**4. [Rule 1 — Bug] requirementsMarkComplete signature kept QueryHandler shape**
- **Found during:** Task 1 roadmap.ts migration
- **Issue:** roadmap.ts's `requirementsMarkComplete` is a write handler (writeFile on REQUIREMENTS.md) but has a read at the top (existsSync + readFile). Migrating it to take adapter as first arg would conflict with the registry registration (it's currently registered as a QueryHandler). Keeping it on the QueryHandler signature preserves its Phase 3 migration boundary; the read just gets adapter inline.
- **Fix:** Used `adapterFor(projectDir)` inline within requirementsMarkComplete to satisfy D-14 read migration; left the writeFile (Phase 3) and the QueryHandler signature unchanged.

### Unfixed (deferred to follow-ups)

- **adapterFor() inline constructions in 8 cross-file callers** are transitional. Plans 02-03/04 + Phase 3 will replace these with proper adapter threading when they migrate the calling handlers' signatures. No correctness impact — same MarkdownAdapter is constructed; the seam is just less elegant pre-Phase-3.

## Threat Flags

None — Plan 02-02 is a pure read-side refactor. No new network endpoints, auth paths, file access patterns at trust boundaries, or schema changes. The single new helper (`adapterFor`) constructs the same MarkdownAdapter that's already in createRegistry's closure; the inline construction has no security implication beyond what already exists.

## Known Stubs

None — every migrated callsite delegates to a real adapter method backed by MarkdownAdapter. The conformance test seeds real fixture data for each handler family.

## Next-phase Readiness

- **Plan 02-03 (parallel) entry**: When Plan 02-03 (summary.ts/uat.ts/intel.ts/docs-init.ts/skill-manifest.ts) merges, its handler-registration appendage in `index.ts` lands cleanly after the Task 1+2 wrappers (no merge conflict expected — the createRegistry block is the only shared file, and Plan 02-03's edits append in a different region).

- **Plan 02-04 init bundlers ready**: All adapter-aware helpers (`getMilestoneInfo`, `extractCurrentMilestone`, `extractNextMilestoneSection`, `findPhase`, `phasePlanIndex`, `roadmapAnalyze`, `roadmapGetPhase`, `progressJson`, `auditOpen`) take adapter as first arg. Plan 02-04's init bundlers will replace the 8 inline `adapterFor(projectDir)` constructions with adapter-threaded handler signatures.

- **Phase 3 write-side migration ready**: progress.ts, verify.ts, roadmap.ts have explicit Phase 2 D-14 markers documenting which fs imports stay until Phase 3. The write-side handlers (todoComplete, requirementsMarkComplete, the writeFile in verify.ts artifacts handlers) are untouched — Phase 3 adds Bin B mutation primitives and migrates them.

- **Phase 7 BeadsAdapter implication**: tests/conformance/phase-reads.test.ts uses `createRegistry({adapter: new MarkdownAdapter(tmpDir)})` directly. Phase 7's BeadsAdapter test file is a 1-line change (swap MarkdownAdapter for BeadsAdapter) — every migrated handler family gets reproductive coverage on day one.

- **Open follow-ups for Plan 4 (init bundlers)**:
  - audit-open.ts's `auditOpenArtifacts` is now `async` (was sync). Any init bundler that called the sync version needs to await — Plan 4 will catch this.
  - The `adapterFor()` helper has a lazy import to avoid circular deps. Plan 4 should evaluate whether the import can be hoisted to a static import once init bundlers are migrated (helpers.ts → adapters/markdown is currently dynamic to avoid an early-init cycle).

---
*Phase: 02-wire-core-read-methods-to-adapter*
*Plan: 02 (Wave B — phase/state/progress/roadmap reads; runs in parallel with Plan 02-03)*
*Completed: 2026-05-01*

## Self-Check: PASSED

Files verified (all FOUND):
- `sdk/src/query/phase.ts` — adapter-routed; 411 lines (was 343); leak-grep clean
- `sdk/src/query/roadmap.ts` — adapter-routed reads; D-14 read-only for requirementsMarkComplete; leak-grep clean
- `sdk/src/query/phase-ready.ts` — adapter-routed; leak-grep clean
- `sdk/src/query/check-verification-status.ts` — adapter-routed; leak-grep clean
- `sdk/src/query/detect-phase-type.ts` — adapter-routed; leak-grep clean
- `sdk/src/query/audit-open.ts` — adapter-routed (8 scanners); 13 Promise.all sites; leak-grep clean
- `sdk/src/query/progress.ts` — adapter-routed reads; D-14 markers present; leak-grep clean
- `sdk/src/query/verify.ts` — adapter-routed reads in verifyPhaseCompleteness/verifySchemaDrift; D-14 markers present; leak-grep clean
- `sdk/src/query/helpers.ts` — adapterFor() exported
- `sdk/src/query/index.ts` — 12+ closure wrappers wired
- `tests/conformance/phase-reads.test.ts` — 17 tests, 11 describes, all pass

Commits verified (all FOUND):
- `cd6ff30d` — Task 1: phase/roadmap/phase-ready/check-verification-status/detect-phase-type
- `0cce9981` — Task 2: audit-open + progress + verify (D-14)
- `90b08e7c` — Task 3: phase-reads conformance tests

All 6 plan-level verifications pass (sdk build, npm test ≥6074 pass / 31 fail unchanged, per-plan leak-grep Form C across 8 files, phase-reads.test.ts 17/17, MED-2 count assertion 12, full conformance suite 35/35).
