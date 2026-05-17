---
phase: "03"
plan: "01"
subsystem: adapter-interface
tags: [event-types, withTransaction, phase-helpers, leak-grep, interface-contract]
dependency_graph:
  requires: [Phase 2 adapter interface, D-12 commitPlanningState promotion decision]
  provides: [AppendEvent/MutationEvent/SignalEvent unions, withTransaction implementation, phase-helpers scaffold, SDK_FS_WRITE_PATTERNS]
  affects: [adapters/types.ts, adapters/markdown/index.ts, sdk/src/query/phase-helpers.ts, scripts/leak-grep.cjs]
tech_stack:
  added: []
  patterns: [discriminated-union event types, PID-lockfile-guarded transactions, adapter-first-parameter helpers]
key_files:
  created:
    - adapters/state-event-types.ts
    - sdk/src/query/state-event-types.ts
    - sdk/src/query/phase-helpers.ts
  modified:
    - adapters/types.ts
    - adapters/types.test.ts
    - adapters/markdown/index.ts
    - sdk/src/query/state-mutation.ts
    - scripts/leak-grep.cjs
decisions:
  - "Event types placed in adapters/state-event-types.ts (canonical) with re-export at sdk/src/query/state-event-types.ts — avoids cross-rootDir import in adapters tsconfig"
  - "syncStateFrontmatter exported from state-mutation.ts for use by phase-helpers"
metrics:
  duration: "7m33s"
  completed: "2026-05-10"
  tasks: 3
  files_changed: 8
---

# Phase 03 Plan 01: Foundation Infrastructure for Write Migration

Event type discriminated unions defined, withTransaction implemented with PID-lockfile guard, phase-helpers scaffold created with 7 adapter-first-parameter functions, leak-grep extended with 10 SDK write-side patterns.

## Task Summary

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Define event type unions + modify StorageAdapter interface | c7782bdb | adapters/state-event-types.ts, adapters/types.ts |
| 2 | Implement withTransaction + stub recordState methods | 96e5a893 | adapters/markdown/index.ts |
| 3 | Create phase-helpers scaffold + extend leak-grep | a7f0a17a | sdk/src/query/phase-helpers.ts, scripts/leak-grep.cjs |

## Key Changes

### Event Type System (Task 1)
- Created `adapters/state-event-types.ts` with 3 discriminated unions:
  - `AppendEvent` (6 variants): decision, metric, roadmap_evolution, session, forensic_session, quick_task
  - `MutationEvent` (4 variants): blocker_added, blocker_resolved, todo_count_update, deferred_items
  - `SignalEvent` (3 variants): waiting, resume, milestone_switch
- Added re-export barrel at `sdk/src/query/state-event-types.ts` for SDK-side consumers
- Extended StorageAdapter interface with `recordStateAppend`, `recordStateMutation`, `recordStateSignal`
- Changed `withTransaction` signature to generic `<T>(fn: () => Promise<T>): Promise<T>`
- Removed `commitPlanningState` from `Capabilities` interface (D-12 promotion to required)
- Removed `hasCommitPlanningState` type guard (no longer needed)

### withTransaction Implementation (Task 2)
- PID-based lockfile at `.planning/.adapter.lock` using `O_CREAT | O_EXCL | O_WRONLY`
- 10-retry loop with 200ms + jitter backoff
- Stale lock detection via PID liveness check (`process.kill(pid, 0)`)
- Force-break on final retry (matches proven CJS `state.cjs` behavior)
- Graceful degradation on non-EEXIST errors
- Set `capabilities.transaction = true`

### Phase Helpers Scaffold (Task 3)
- 7 exported functions: `scaffoldPhaseDir`, `insertRoadmapPhase`, `updateRoadmapProgress`, `readModifyWriteState`, `readModifyWriteRoadmap`, `scanNextPhaseNumber`, `removePhaseDir`
- All use adapter-first-parameter pattern (D-10)
- Transaction-wrapping documented per function (some wrap, some expect caller to wrap)
- Exported `syncStateFrontmatter` from state-mutation.ts for phase-helpers to reuse

### Leak-Grep Extension (Task 3)
- 10 new SDK_FS_WRITE_PATTERNS: writeFile-async, writeFileSync, mkdirSync, mkdir-async, unlinkSync, unlink-async, appendFileSync, rename-async, rm-async, fs-write-import
- Combined with existing SDK_FS_READ_PATTERNS in single scanner loop
- Same Stage-2 PLANNING_SCOPE_RE window filter applies

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Event types relocated from sdk/ to adapters/ directory**
- **Found during:** Task 1
- **Issue:** adapters/tsconfig.json has `rootDir: "."` which prevents importing from `../sdk/src/` — TypeScript errors TS6059/TS6307
- **Fix:** Placed canonical event types at `adapters/state-event-types.ts` (within rootDir) and created re-export barrel at `sdk/src/query/state-event-types.ts` for SDK consumers
- **Files modified:** adapters/state-event-types.ts (new), sdk/src/query/state-event-types.ts (re-export)
- **Commit:** c7782bdb

**2. [Rule 3 - Blocking] MarkdownAdapter minimum fixes for interface compliance**
- **Found during:** Task 1
- **Issue:** After modifying StorageAdapter interface, MarkdownAdapter wouldn't compile without matching changes (removed commitPlanningState cap field, withTransaction signature, event method stubs)
- **Fix:** Applied minimum changes to MarkdownAdapter in Task 1 commit so project compiles after each commit; Task 2 then built the full implementation
- **Files modified:** adapters/markdown/index.ts
- **Commit:** c7782bdb

**3. [Rule 3 - Blocking] adapters/types.test.ts referenced removed exports**
- **Found during:** Task 1
- **Issue:** Test file imported `hasCommitPlanningState` and used `commitPlanningState` field in type assertions
- **Fix:** Updated test file to remove references to removed type guard and capability field
- **Files modified:** adapters/types.test.ts
- **Commit:** c7782bdb

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| adapters/markdown/index.ts | 380 | recordStateAppend throws | Intentional — Plan 02 implements |
| adapters/markdown/index.ts | 384 | recordStateMutation throws | Intentional — Plan 02 implements |
| adapters/markdown/index.ts | 388 | recordStateSignal throws | Intentional — Plan 02 implements |

All stubs are intentional per the plan design — they establish the type-level contract that Plans 02-04 fill with real implementations.

## Verification Results

- TypeScript compiles cleanly: `tsc --noEmit --project adapters/tsconfig.json` exits 0
- leak-grep exports 10 SDK_FS_WRITE_PATTERNS
- `recordStateAppend` appears exactly once in adapters/types.ts (interface method)
- `hasCommitPlanningState` count = 0 in adapters/types.ts
- `commitPlanningState: boolean` count = 0 in adapters/types.ts
