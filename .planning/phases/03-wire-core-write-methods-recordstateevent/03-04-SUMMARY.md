---
phase: "03"
plan: "04"
subsystem: phase-lifecycle-adapter-migration
tags: [adapter-writes, phase-helpers, withTransaction, thin-orchestrators, WRITES-02]
dependency_graph:
  requires: [Phase 03 Plan 01 phase-helpers scaffold, Phase 2 adapter reads]
  provides: [All 13 phase-lifecycle handlers routed through adapter, 20 shared adapter-first helpers]
  affects: [sdk/src/query/phase-lifecycle.ts, sdk/src/query/phase-helpers.ts]
tech_stack:
  added: []
  patterns: [adapter-first-parameter helpers, withTransaction wrapping, thin orchestrator handlers]
key_files:
  created: []
  modified:
    - sdk/src/query/phase-helpers.ts
    - sdk/src/query/phase-lifecycle.ts
decisions:
  - "Deprecated functions (readModifyWriteRoadmapMd, findPhaseDir) kept in place with @deprecated annotation for backward compat; removal deferred to Phase 4"
  - "renumberDecimalPhases/renumberIntegerPhases/updateRoadmapAfterPhaseRemoval extracted to phase-helpers.ts with adapter-first signatures; inline versions removed"
  - "milestoneComplete fully migrated to adapter (was the most complex handler at ~195 LOC)"
metrics:
  duration: "11m57s"
  completed: "2026-05-10"
  tasks: 2
  files_changed: 2
---

# Phase 03 Plan 04: Phase-Lifecycle Handler Migration to Adapter-Routed Writes

All 13 phase-lifecycle handlers refactored from direct fs operations to thin orchestrators composing adapter-first-parameter helpers via adapter.withTransaction. Domain logic (slug generation, renumbering, metrics) preserved exactly in phase-helpers.ts.

## Task Summary

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Extract domain helpers from phase-lifecycle into phase-helpers.ts | 15aba37d | sdk/src/query/phase-helpers.ts |
| 2 | Refactor 13 phase-lifecycle handlers to use shared helpers + adapter.withTransaction | 25f65d51 | sdk/src/query/phase-lifecycle.ts |

## Key Changes

### Task 1: Helper Extraction (13 new functions)

Added 13 adapter-first-parameter helper functions to `sdk/src/query/phase-helpers.ts`:

**Phase directory operations:**
- `scaffoldPlanFiles` - Creates template files (PLAN.md/CONTEXT.md) via adapter.putRecord
- `removePhaseFiles` - Lists+removes all files in a phase dir via adapter.listCollection/removeRecord
- `archivePhaseDir` - Copies files to archive location, removes originals

**ROADMAP manipulation:**
- `removeRoadmapPhase` - Removes phase entry from ROADMAP.md (section + checkboxes + table rows)
- `markRoadmapPhaseComplete` - Marks checkbox as [x], updates progress table row
- `markRoadmapRequirementsComplete` - Marks requirement checkboxes and traceability table

**Renumbering (complex domain logic):**
- `renumberDecimalPhases` - Renumbers sibling decimal phases after removal (adapter read+write+remove pattern)
- `renumberIntegerPhases` - Renumbers all integer phases after removal
- `updateRoadmapAfterRemoval` - Removes phase section + renumbers references in ROADMAP

**STATE.md operations:**
- `updateStatePhaseFields` - Updates Current Position fields
- `updateStateProgressFields` - Updates progress frontmatter via adapter.mergeFrontmatter
- `updatePerformanceMetrics` - Updates velocity counters and By Phase table
- `decrementStateTotalPhases` - Decrements total_phases after phase removal

Total exported async functions: 20 (7 from Plan 01 + 13 new).

### Task 2: Handler Refactoring (854 lines removed, 379 added)

Each handler became a thin orchestrator: validation + helper composition + result formatting.

| Handler | Before | After | Key Changes |
|---------|--------|-------|-------------|
| phaseAdd | ~115 LOC | ~45 LOC | Uses scanNextPhaseNumber + scaffoldPhaseDir + insertRoadmapPhase |
| phaseAddBatch | ~130 LOC | ~55 LOC | Single withTransaction wrapping all phase additions |
| phaseInsert | ~115 LOC | ~60 LOC | Validates via adapter.getRecord, creates via scaffoldPhaseDir |
| phaseScaffold | ~115 LOC | ~60 LOC | Uses findPhaseDirAdapter + adapter.putRecord |
| phaseRemove | ~125 LOC | ~50 LOC | Uses removePhaseFiles + renumberDecimalPhases/renumberIntegerPhases |
| phaseComplete | ~315 LOC | ~100 LOC | Single withTransaction wrapping markRoadmapPhaseComplete + markRoadmapRequirementsComplete + updateStatePhaseFields + updatePerformanceMetrics |
| phasesClear | ~25 LOC | ~20 LOC | Uses removePhaseFiles in withTransaction loop |
| phasesArchive | ~40 LOC | ~20 LOC | Uses archivePhaseDir via adapter |
| milestoneComplete | ~195 LOC | ~100 LOC | Full adapter migration: getRecord/putRecord for archives, readModifyWriteState for STATE.md |
| phasesList | (unchanged) | (unchanged) | Already adapter-migrated in Phase 2 |
| phaseNextDecimal | (unchanged) | (unchanged) | Already adapter-migrated in Phase 2 |

**Deprecated (kept for backward compat, removed in Phase 4):**
- `readModifyWriteRoadmapMd` - Annotated with @deprecated
- `findPhaseDir` - Annotated with @deprecated (replaced by findPhaseDirAdapter)
- Inline `renameDecimalPhases`/`renameIntegerPhases`/`updateRoadmapAfterPhaseRemoval` - Removed entirely (extracted to phase-helpers.ts)

## Verification Results

- TypeScript: `tsc --noEmit` exits 0 (zero errors)
- `adapter.withTransaction` count in phase-lifecycle.ts: 11 (exceeds minimum 6)
- `grep -c "export async function" phase-helpers.ts`: 20 (exceeds minimum 15)
- leak-grep: 3 matches, all in deprecated function definitions only
- No `mkdir(`, `writeFile(`, `readFile(`, `unlink(` in any handler body

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] findPhaseDirAdapter needed for phaseComplete/phaseScaffold**
- **Found during:** Task 2
- **Issue:** phaseComplete and phaseScaffold needed to find phase directories without filesystem access
- **Fix:** Created `findPhaseDirAdapter` using adapter.listCollection + phaseTokenMatches
- **Files modified:** sdk/src/query/phase-lifecycle.ts

**2. [Rule 2 - Missing] decrementStateTotalPhases helper needed for phaseRemove**
- **Found during:** Task 1 (while extracting domain logic)
- **Issue:** phaseRemove's STATE.md update logic needed an adapter-routed equivalent
- **Fix:** Added `decrementStateTotalPhases` to phase-helpers.ts combining frontmatter decrement + body "of N" pattern update
- **Files modified:** sdk/src/query/phase-helpers.ts

## Self-Check: PASSED
