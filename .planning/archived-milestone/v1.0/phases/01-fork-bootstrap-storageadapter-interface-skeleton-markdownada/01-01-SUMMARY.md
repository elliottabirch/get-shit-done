---
phase: 01-fork-bootstrap-storageadapter-interface-skeleton-markdownada
plan: "01"
subsystem: adapter-interface
tags: [storage-adapter, typescript, interface, capabilities, tdd]
dependency_graph:
  requires: []
  provides:
    - adapters/types.ts (StorageAdapter interface, Capabilities, UnsupportedCapabilityError, 6 type guards)
    - adapters/tsconfig.json (TypeScript build config with composite: true)
    - tsconfig.json (root project references updated)
    - package.json (files array updated)
  affects:
    - Plans 03/04/05 (import StorageAdapter from adapters/types.ts)
    - gsd-beads sibling repo (import StorageAdapter type)
tech_stack:
  added: []
  patterns:
    - TypeScript project references (composite: true)
    - Literal-true required capability groups (D-05)
    - Companion type guards for capability narrowing (D-11)
    - UnsupportedCapabilityError extends Error pattern
key_files:
  created:
    - adapters/types.ts
    - adapters/tsconfig.json
    - adapters/types.test.ts
  modified:
    - tsconfig.json
    - package.json
decisions:
  - "D-01 satisfied: adapters/ at repo root, not under sdk/"
  - "D-05 satisfied: record/section/frontmatter typed as literal true"
  - "D-06 satisfied: adapter.name only identity field, no version"
  - "D-08 satisfied: exactly 6 optional capabilities (closed enum)"
  - "D-09 satisfied: replaceInCurrentMilestone + readModifyWriteRoadmapMd are public required methods"
  - "D-10 satisfied: full v1.0 surface declared (10 Bin A + 2 markdownLockfile + 7 foundational primitives)"
  - "D-11 satisfied: zero optional methods, 6 companion type guards"
metrics:
  duration: "163s (2m 43s)"
  completed: "2026-05-01"
  tasks_completed: 2
  files_changed: 5
---

# Phase 1 Plan 01: StorageAdapter Interface Skeleton Summary

**One-liner:** TypeScript-first StorageAdapter interface with 19 required methods, 9-key Capabilities type, UnsupportedCapabilityError, and 6 companion type guards locked in top-level adapters/ directory.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| TDD RED | Failing type-level tests for StorageAdapter interface | 419078b8 | adapters/types.test.ts |
| TDD GREEN | StorageAdapter interface + Capabilities + type guards + error class | 78fab992 | adapters/types.ts |
| 2 | TypeScript build infrastructure | 8e13e947 | adapters/tsconfig.json, tsconfig.json, package.json |

## What Was Built

### adapters/types.ts (89 lines)

The locked StorageAdapter v1.0 interface, satisfying all D-01 through D-11 constraints:

- **19 required methods** (no `?:` anywhere):
  - 5 Bin A record: `getRecord`, `putRecord`, `removeRecord`, `listCollection`, `exists`
  - 2 Bin A section: `getSection`, `updateSection`
  - 3 Bin A frontmatter: `getFrontmatter`, `updateFrontmatter`, `mergeFrontmatter`
  - 2 markdownLockfile: `replaceInCurrentMilestone`, `readModifyWriteRoadmapMd`
  - 7 foundational primitives: `writeBinaryAsset`, `snapshot`, `restore`, `withTransaction`, `putNamedDoc`, `getNamedDoc`, `commitPlanningState`

- **Capabilities interface** (9 keys):
  - 3 required as literal `true`: `record`, `section`, `frontmatter`
  - 6 optional as `boolean` (closed enum D-08): `binaryAsset`, `snapshot`, `transaction`, `namedDoc`, `commitPlanningState`, `markdownLockfile`

- **UnsupportedCapabilityError** extending Error with `capability` and `adapterName` readonly fields

- **6 companion type guards** (D-11): `hasBinaryAsset`, `hasSnapshot`, `hasTransaction`, `hasNamedDoc`, `hasCommitPlanningState`, `hasMarkdownLockfile`

### adapters/tsconfig.json

TypeScript project reference config with `composite: true`, ES2022 target, NodeNext module resolution, matching sdk/tsconfig.json settings. Test files excluded from production build.

### Root tsconfig.json

Added `{ "path": "adapters" }` to references array alongside existing `{ "path": "sdk" }`.

### package.json

Added `"adapters"` to the `files` array so the directory is included in npm tarball.

## Downstream Import Path

Plans 03/04/05 and the gsd-beads sibling repo can now import:

```typescript
import type { StorageAdapter, Capabilities, RecordRef, RecordFilter, SectionMode } from '../../adapters/types.js';
import { UnsupportedCapabilityError, hasSnapshot, hasMarkdownLockfile } from '../../adapters/types.js';
```

## Decisions Made

1. **Literal `true` on required capabilities (D-05):** `Capabilities.record`, `.section`, `.frontmatter` typed as `true` literal (not `boolean`). Adapter declaring `record: false` is a compile-time type error, not a runtime check.

2. **markdownLockfile methods public (D-09):** `replaceInCurrentMilestone` and `readModifyWriteRoadmapMd` are required (no `?:`) on the public StorageAdapter interface, overriding the SYNTHESIS §6 OQ-08 recommendation of "private to MarkdownAdapter."

3. **Closed enum of 6 optional capabilities (D-08):** Exactly `binaryAsset | snapshot | transaction | namedDoc | commitPlanningState | markdownLockfile`. No lifecycle capability (D-03 deferred).

4. **Companion type guards not optional methods (D-11):** All 19 interface methods are required. Callers use `hasSnapshot(a)` etc. to narrow before calling capability-gated methods.

5. **TypeScript 5.9.3 (from sdk/node_modules):** Used the SDK's installed TypeScript for type-checking. Compatible with the 5.7.x minimum specified in research.

6. **adapters/tsconfig.json excludes test files:** `types.test.ts` excluded from production build via `"exclude": ["**/*.test.ts", ...]`. The `composite: true` flag satisfies project references requirement.

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

- RED gate: commit `419078b8` (`test(01-01):...`) — type-check failed because `types.ts` did not exist
- GREEN gate: commit `78fab992` (`feat(01-01):...`) — type-check passes after implementation
- No REFACTOR phase needed (interface file is already minimal and clean)

## Self-Check: PASSED

Files exist:
- FOUND: adapters/types.ts
- FOUND: adapters/tsconfig.json

Commits exist:
- FOUND: 419078b8 (test RED)
- FOUND: 78fab992 (feat GREEN)
- FOUND: 8e13e947 (chore build infra)

Type-check: PASS (adapters tsc --noEmit exits 0)
SDK build: PASS (cd sdk && npm run build exits 0)
Acceptance greps: all 11 criteria pass
No optional methods: PASS (grep -E "^\s+\w+\?:" returns no matches)
