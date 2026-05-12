---
phase: "03"
plan: "03"
subsystem: adapter-interface
tags: [state-mutation, non-event-handlers, adapter-migration, withTransaction, deprecated-legacy]
dependency_graph:
  requires: [03-01 phase-helpers scaffold, 03-01 withTransaction, 03-02 event handler migration]
  provides: [All 18 state-mutation handlers fully adapter-routed, readModifyWriteStateMd deprecated, WRITES-01 complete]
  affects: [sdk/src/query/state-mutation.ts]
tech_stack:
  added: []
  patterns: [readModifyWriteState helper reuse, adapter.withTransaction for multi-file atomicity, planningRelativePath for workstream-aware paths]
key_files:
  created: []
  modified:
    - sdk/src/query/state-mutation.ts
decisions:
  - "stateValidate is read-only (no write path) so no migration needed for it"
  - "withTransaction is reentrant for MarkdownAdapter (single-lock model); nested calls from readModifyWriteState inside handler-level adapter calls are no-ops"
  - "stateUpdateProgress disk-scan reads (async readdir) left in place -- they are not readdirSync and Phase 2 scope already handles read migration"
  - "statePrune archive write routed through adapter.getRecord/putRecord within withTransaction for full atomicity"
metrics:
  duration: "6m47s"
  completed: "2026-05-10"
  tasks: 2
  files_changed: 1
---

# Phase 03 Plan 03: Non-Event Handler Migration to Adapter

All 8 non-event state-mutation handlers migrated from readModifyWriteStateMd to adapter-routed writes via readModifyWriteState helper or direct adapter.withTransaction + getRecord/putRecord. WRITES-01 requirement fully satisfied: all 18 handlers in state-mutation.ts now route through the adapter.

## Task Summary

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Migrate stateUpdate, statePatch, stateBeginPhase, stateAdvancePlan, statePlannedPhase to adapter | b72ef94f | sdk/src/query/state-mutation.ts |
| 2 | Migrate stateUpdateProgress, stateSync, stateMilestoneSwitch, statePrune + deprecate readModifyWriteStateMd | 855121fd | sdk/src/query/state-mutation.ts |

## Key Changes

### Task 1: Five Simple Handler Migrations

Each handler received the same transformation pattern:
1. `const adapter = await adapterFor(projectDir);`
2. Replace `await readModifyWriteStateMd(projectDir, modifier, workstream)` with `await readModifyWriteState(adapter, workstream, modifier, projectDir)`

**Handlers migrated:** stateUpdate, statePatch, stateBeginPhase, stateAdvancePlan, statePlannedPhase

All validation, arg parsing, and field-manipulation logic unchanged. Only the I/O routing replaced.

### Task 2: Complex Handler Migrations + Deprecation

**stateUpdateProgress** -- Same readModifyWriteState pattern. Disk-scan reads (async readdir) left as-is per scope boundary.

**stateSync** -- Same readModifyWriteState pattern. Variable named `syncAdapter` to avoid shadowing with existing `syncAdapter` in syncStateFrontmatter scope.

**stateMilestoneSwitch** -- Refactored from manual acquireStateLock + readFile + writeFile to `adapter.withTransaction` wrapping the entire wholesale-rewrite operation. Uses `adapter.getRecord`/`adapter.putRecord` directly (does NOT use readModifyWriteState because it bypasses syncStateFrontmatter intentionally per bug #2630 fix).

**statePrune** -- Refactored to `adapter.withTransaction` wrapping both STATE.md pruning and STATE-ARCHIVE.md write. Both files use `adapter.getRecord`/`adapter.putRecord`. Archive path constructed via `planningRelativePath` (T-03-08 mitigation: not user-controllable).

**stateValidate** -- Read-only handler (no write path). No migration needed. The plan explicitly states: "If read-only, leave the read path as-is."

### Deprecation Annotations

Four functions marked `@deprecated`:
- `readModifyWriteStateMd` -- "Use readModifyWriteState from phase-helpers.ts"
- `readModifyWriteStateMdFull` -- Same deprecation message
- `acquireStateLock` -- "Internalized into MarkdownAdapter.withTransaction"
- `releaseStateLock` -- "Internalized into MarkdownAdapter.withTransaction"

All retained temporarily for external callers outside state-mutation.ts. Will be removed in Phase 4.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical] Added planningRelativePath import for stateMilestoneSwitch/statePrune**
- **Found during:** Task 2
- **Issue:** stateMilestoneSwitch and statePrune needed workstream-aware relative paths for adapter.getRecord/putRecord calls, but planningRelativePath was not imported
- **Fix:** Added `planningRelativePath` to the imports from `./helpers.js`
- **Files modified:** sdk/src/query/state-mutation.ts
- **Commit:** 855121fd

### Plan Adjustments

- Plan listed "stateUpdateProgress, stateValidate, stateSync, stateMilestoneSwitch, statePrune" as 5 handlers to migrate. stateValidate is read-only (no write path), so effectively 4 handlers needed write-path migration. This matches acceptance criteria: "stateValidate does NOT call readModifyWriteStateMd" (it never did).
- Module doc comment updated to reflect new adapter-based architecture.
- stateAddRoadmapEvolution doc comment updated to reference adapter.recordStateAppend instead of readModifyWriteStateMd.

## Verification Results

- TypeScript compiles cleanly: `tsc --noEmit --project adapters/tsconfig.json` exits 0
- `grep -c "await readModifyWriteStateMd"` = 0 (zero active callers)
- `grep -c "@deprecated"` = 4 (all legacy functions annotated)
- All 18 handlers route through adapter: stateUpdate, statePatch, stateBeginPhase, stateAdvancePlan, stateUpdateProgress, stateRecordMetric, stateAddDecision, stateAddBlocker, stateResolveBlocker, stateAddRoadmapEvolution, stateRecordSession, statePlannedPhase, stateMilestoneSwitch, stateSignalWaiting, stateSignalResume, stateValidate (read-only), stateSync, statePrune
- leak-grep write-side: deprecated function bodies retain writeFile calls (dead code, acceptable)

## Known Stubs

None -- all handlers fully implemented with adapter-routed writes.

## Threat Flags

None -- no new network endpoints, auth paths, file access patterns, or schema changes introduced. Archive path (T-03-08) is constructed from planningRelativePath + constant "STATE-ARCHIVE.md" prefix; not user-controllable.

## Self-Check: PASSED
