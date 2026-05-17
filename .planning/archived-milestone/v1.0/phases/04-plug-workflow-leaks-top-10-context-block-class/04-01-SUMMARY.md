---
phase: 04-plug-workflow-leaks-top-10-context-block-class
plan: 01
subsystem: sdk-query-infrastructure
tags: [leak-grep, sdk-query, adapter, scaffold]
dependency_graph:
  requires: []
  provides: [codebase-docs, named-docs, debug-session, spike-sketch, thread-seed, milestone-ops, tmp-docs, extended-leak-grep]
  affects: [sdk/src/query/index.ts, sdk/src/query/command-manifest.non-family.ts, scripts/leak-grep.cjs]
tech_stack:
  added: []
  patterns: [adapterFor-closure-wrapping, zone-aware-shell-pattern-filtering, path-traversal-validation]
key_files:
  created:
    - scripts/leak-grep.cjs (extended with 5 new shell patterns + zone filter)
    - sdk/src/query/codebase-docs.ts
    - sdk/src/query/named-docs.ts
    - sdk/src/query/debug-session.ts
    - sdk/src/query/spike-sketch.ts
    - sdk/src/query/thread-seed.ts
    - sdk/src/query/milestone-ops.ts
    - sdk/src/query/tmp-docs.ts
  modified:
    - sdk/src/query/index.ts (25 new verb registrations)
    - sdk/src/query/command-manifest.non-family.ts (25 new manifest entries)
decisions:
  - "Zone-aware filter for ls-shell/find-shell (only fires in workflow/agent/command paths)"
  - "gsd-sdk query exclusion line (per assumption A1)"
  - "RecordRef explicit type annotation for strict TS compatibility"
metrics:
  duration_seconds: 398
  completed: "2026-05-10T16:21:20Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 7
  files_modified: 3
---

# Phase 4 Plan 01: Extend leak-grep + scaffold SDK query handlers Summary

Extended leak-grep.cjs with 5 new shell patterns (mkdir/cat/find/ls/git-add) and created 7 new SDK query handler files exposing 25 new adapter-mediated verbs that Waves 2-3 workflow rewrites will call.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Extend leak-grep.cjs with missing shell patterns | b6236d3e | 5 new patterns, zone filter, gsd-sdk query exclusion |
| 2 | Create 7 new SDK query handler files | ac3564d7 | 864 lines across 7 files, all adapter-routed |
| 3 | Register new query verbs in manifest and index.ts | b65b50d8 | 25 verbs in registry + 25 manifest entries |

## Key Implementation Details

### leak-grep Extension (Task 1)

New shell patterns added to SHELL_PATTERNS array:
- `mkdir-shell`: catches `mkdir -p .planning/...`
- `cat-shell`: catches `cat .planning/...`
- `find-shell`: zone-scoped (workflows/agents/commands only)
- `ls-shell`: zone-scoped (workflows/agents/commands only)
- `git-add-shell`: catches `git add .planning/...`

Zone filter (`WORKFLOW_ZONE_RE`) prevents false positives in templates/references where these commands appear as documentation prose. Lines containing `gsd-sdk query` are excluded per Assumption A1 (SDK mediates those).

### SDK Query Handlers (Task 2)

All 7 handler files follow the established `adapterFor(projectDir)` pattern:
- Zero `node:fs` imports (D-09 compliance)
- Path validation guards against traversal (T-04-01, T-04-03)
- `adapter.withTransaction()` used for multi-file operations (D-04)
- Consistent `{ data: { ... } }` return shape

### Verb Registration (Task 3)

25 verbs registered in createRegistry() with adapter closure wrapping. Manifest entries in `command-manifest.non-family.ts` with correct mutation flags enable auto-derivation into `QUERY_MUTATION_COMMAND_LIST`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed implicit 'any' type on RecordRef parameter**
- **Found during:** Task 2
- **Issue:** `refs.map(ref => ref.name)` triggered TS7006 under strict mode because `listCollection` return type was not inferred
- **Fix:** Added explicit `RecordRef` type import and annotation
- **Files modified:** sdk/src/query/codebase-docs.ts
- **Commit:** ac3564d7

## Verification Results

- leak-grep detects 107 new-pattern matches across workflow files (mkdir/cat/find/ls/git-add)
- Zone filter correctly suppresses ls-shell/find-shell outside workflow/agent/command zones
- TypeScript compilation passes for all 7 new handler files (pre-existing TS6305 errors in adapters/dist are unrelated)
- Zero `node:fs` imports in any new handler file
- 25 verbs correctly registered and present in manifest

## Self-Check: PASSED

All created files exist and all commits are present in git log.
