---
phase: 02-make-the-seam-real
plan: "04"
subsystem: sdk/query
tags: [seam, handler-migration, phase-lifecycle, spike-sketch, scratch]
dependency_graph:
  requires: ["02-03"]
  provides: ["phase-lifecycle.ts fully adapter-threaded", "spike-sketch.ts fully adapter-threaded", "scratch.ts fully adapter-threaded"]
  affects: ["sdk/src/query/index.ts closure wrappers"]
tech_stack:
  added: []
  patterns: ["adapter-first-arg handler signature", "closure-wrapper registry registration"]
key_files:
  created: []
  modified:
    - sdk/src/query/phase-lifecycle.ts
    - sdk/src/query/spike-sketch.ts
    - sdk/src/query/scratch.ts
    - sdk/src/query/index.ts
decisions:
  - "No StateWriteOutcome layer needed: none of these handlers call recordState* (per RESEARCH.md inventory)"
  - "Used adapter-first-arg function form (not const-arrow QueryHandler) for all 23 migrated handlers, consistent with Phase 2 pattern established in Plan 02-03"
metrics:
  duration: "~45 minutes"
  completed: "2026-05-19T02:48:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 4
  callsites_migrated: 23
---

# Phase 02 Plan 04: Adapter-Threading — phase-lifecycle, spike-sketch, scratch — Summary

**One-liner:** Migrated 23 `adapterFor(projectDir)` callsites across 3 handler-family files (phase-lifecycle.ts, spike-sketch.ts, scratch.ts) to adapter-first-arg signatures, with 3 atomic per-file commits gated by build+test.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate phase-lifecycle.ts (10 callsites) | `33216ee0` | sdk/src/query/phase-lifecycle.ts, sdk/src/query/index.ts |
| 2 | Migrate spike-sketch.ts (7 callsites) | `0b7daf82` | sdk/src/query/spike-sketch.ts, sdk/src/query/index.ts |
| 3 | Migrate scratch.ts (6 callsites) | `8a76f3b5` | sdk/src/query/scratch.ts, sdk/src/query/index.ts |

## What Was Done

Each handler file received the canonical adapter-threading transformation (per D-15/D-17):

**For each handler file:**
- Added `import type { StorageAdapter } from '../../../adapters/types.js';`
- Removed `adapterFor` from the `helpers.js` import destructure
- Changed all exported handler signatures from `(args: string[], projectDir: string, workstream?: string)` to `(adapter: StorageAdapter, args: string[], projectDir: string, workstream?: string)`
- Deleted the `const adapter = await adapterFor(projectDir);` line from each handler body

**In index.ts:** Updated all corresponding registry registrations from direct handler refs to closure wrappers:
```typescript
// Before
registry.register('spike.get-manifest', (args, projectDir, ws) => spikeGetManifest(args, projectDir, ws));
// After
registry.register('spike.get-manifest', (args, pd, ws) => spikeGetManifest(adapter, args, pd, ws));
```

**Callsite count by file:**
- `phase-lifecycle.ts`: 10 callsites (includes 2 internal helper functions `readModifyWriteRoadmapMd` and `findPhaseDir` that were also adapted)
- `spike-sketch.ts`: 7 callsites (spikeGetManifest, spikeGetConventions, spikePutWrapUp, spikePutConventions, sketchGetManifest, sketchGetConventions, sketchPutWrapUp)
- `scratch.ts`: 6 callsites (discussCheckpointPut, discussCheckpointGet, discussCheckpointDelete, discussQuestionsPut, discussQuestionsGet, discussQuestionsDelete)
- **Total: 23 callsites migrated**

## Verification Results

- `grep -c "adapterFor(projectDir)" sdk/src/query/phase-lifecycle.ts` = 0
- `grep -c "adapterFor(projectDir)" sdk/src/query/spike-sketch.ts` = 0
- `grep -c "adapterFor(projectDir)" sdk/src/query/scratch.ts` = 0
- `git log --oneline -3 | grep -c "refactor(02-04)"` = 3
- `npm run build:sdk-only` exits 0 after each commit
- `npm run test:unit` = 33 failures (matches pre-existing baseline from v1.1-pre-scoped-failures.txt) after each commit

## Decisions Made

1. **No StateWriteOutcome layer**: Confirmed via RESEARCH.md inventory — none of these handlers call `recordState*`. They call `putRecord`/`getRecord`/`removeRecord` only. This simplifies migration: no split commit needed per handler.

2. **adapter-first-arg function form**: Used `export async function handler(adapter: StorageAdapter, ...)` (not `export const handler: QueryHandler = ...`) consistently with the Plan 02-03 established pattern.

3. **Internal helpers in phase-lifecycle.ts**: `readModifyWriteRoadmapMd` and `findPhaseDir` are private helpers used by exported handlers. Both were adapted to accept adapter as first param so callsites inside the file pass through the injected adapter rather than calling `adapterFor(projectDir)` again.

## Deviations from Plan

None — plan executed exactly as written. All 3 atomic per-file commits landed independently per D-15/D-17. Build+test gate ran between each commit per D-18.

## Known Stubs

None.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. This is a pure internal refactoring — the same storage operations happen through the injected adapter rather than a locally-resolved one.

## Self-Check: PASSED

- sdk/src/query/phase-lifecycle.ts: FOUND
- sdk/src/query/spike-sketch.ts: FOUND
- sdk/src/query/scratch.ts: FOUND
- .planning/phases/02-make-the-seam-real/02-04-SUMMARY.md: FOUND
- commit 33216ee0 (phase-lifecycle.ts): FOUND
- commit 0b7daf82 (spike-sketch.ts): FOUND
- commit 8a76f3b5 (scratch.ts): FOUND
