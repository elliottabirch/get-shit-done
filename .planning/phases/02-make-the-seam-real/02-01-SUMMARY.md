---
phase: 02-make-the-seam-real
plan: 01
subsystem: storage-adapter-interface
tags: [seam, interface, getTouchedPaths, sibling-repo, conformance, D-02, D-03, D-04, D-10, D-11]
status: complete
completed: 2026-05-18

dependency_graph:
  requires: []
  provides:
    - "StorageAdapter.getTouchedPaths(): Set<string> — declared in adapters/types.ts"
    - "MarkdownAdapter.getTouchedPaths() — union of activeTxn.touchedPaths + removedPaths"
    - "BeadsAdapter.getTouchedPaths() — Option B synthetic bd:// path mapping"
    - "ConformanceManifest seam-realness kind — 2 stub entries (DEFECT-02 + state.milestone-switch)"
    - "paired-seam-{markdown,beads}.test.ts — conformance harness entry points"
    - "seam-realness.conformance-suite.ts — runSeamRealnessSuite skeleton"
  affects:
    - "Plan 02-02 (pipeline.ts refactor) — depends on getTouchedPaths interface"
    - "Plans 02-03..06 (handler family migrations) — depend on manifest schema"
    - "Plan 02-07 (closure plan) — fills seam-realness test bodies"

tech_stack:
  added: []
  patterns:
    - "TDD RED/GREEN across fork + sibling repo in same plan wave"
    - "Cross-repo delivery via file:// symlink (no version bump)"
    - "AsyncLocalStorage-based txn introspection via peekBuffer()"
    - "preRegisterTest() outside it() for meta-coverage bidirectional invariant"
    - "it.todo() stubs for Wave-0 conformance scaffolding"

key_files:
  created:
    - path: tests/conformance/seam-realness.conformance-suite.ts
      description: runSeamRealnessSuite skeleton; it.todo stubs for Plans 03-07
    - path: tests/conformance/paired-seam-markdown.test.ts
      description: 3-line conformance entry (MarkdownAdapter)
    - path: tests/conformance/paired-seam-beads.test.ts
      description: 16-line conformance entry with bdPresent() guard
    - path: /Volumes/code/gsd-beads/tests/unit/getTouchedPaths.test.ts
      description: 4-test unit suite for BeadsAdapter.getTouchedPaths()
  modified:
    - path: adapters/types.ts
      description: Added getTouchedPaths(): Set<string> to StorageAdapter interface
    - path: adapters/markdown/index.ts
      description: Implemented getTouchedPaths(); deleted _txnContextForPipeline + _realReadForPipeline
    - path: tests/conformance/manifest-types.ts
      description: Extended ManifestEntryKind union with 'seam-realness'
    - path: tests/conformance/manifest.ts
      description: Added 2 stub seam-realness entries (DEFECT-02 + state.milestone-switch)
    - path: /Volumes/code/gsd-beads/src/index.ts
      description: Implemented getTouchedPaths() via peekBuffer(this._state.bd)

decisions:
  - "D-02/D-03 honored: underscore escape hatches deleted; getTouchedPaths() is the public interface"
  - "D-04 honored: BeadsAdapter uses Option B synthetic bd://kind/arg0 path scheme"
  - "Sibling-repo delivery via file:// symlink confirmed — no version bump needed"
  - "it.todo() pattern chosen for Wave-0 stubs — preRegisterTest runs at collection time satisfying meta-coverage"
  - "JSDoc comment in getTouchedPaths implementation removed explicit deleted-method name to satisfy grep acceptance criteria"

metrics:
  duration: 17m
  completed: 2026-05-18
  tasks: 3
  files: 9
---

# Phase 02 Plan 01: getTouchedPaths Interface + Adapter Impls + Conformance Scaffolding Summary

**One-liner:** Added `StorageAdapter.getTouchedPaths(): Set<string>` interface method with MarkdownAdapter exact-path impl and BeadsAdapter synthetic-path impl (Option B), deleted underscore escape hatches, and scaffolded the `kind:'seam-realness'` conformance manifest schema with 2 DEFECT-02/SEAM-06 stub entries and paired test harness.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 (RED) | Failing tests for getTouchedPaths + underscore deletion | `8ebbf0b6` | adapters/markdown/index.test.ts |
| 1 (GREEN) | getTouchedPaths interface + MarkdownAdapter impl; delete escape hatches | `a16eed14` | adapters/types.ts, adapters/markdown/index.ts |
| 1 (fix) | JSDoc reference cleanup for deletion acceptance criteria | `d081b025` | adapters/markdown/index.ts |
| 2 (RED) | Failing BeadsAdapter unit tests in sibling repo | `89b608c` (gsd-beads) | gsd-beads/tests/unit/getTouchedPaths.test.ts |
| 2 (GREEN) | BeadsAdapter.getTouchedPaths() impl + sibling dist rebuild | `e08a76e` (gsd-beads) | gsd-beads/src/index.ts |
| 3 | Conformance manifest schema + suite skeleton + paired scaffolds | `e793a423` | tests/conformance/{manifest-types,manifest,seam-realness.conformance-suite,paired-seam-*}.ts |

## Cross-Repo Evidence

```
cd /Volumes/code/gsd-beads && git log -1 --oneline
e08a76e feat(getTouchedPaths): D-04 best-effort touched-paths impl for fork Phase 2 SEAM-06
```

Sibling repo `gsd-beads` branch: `feat/phase-6-reset`

Delivery mechanism: `node_modules/gsd-beads -> ../../gsd-beads` (file:// symlink at `/Volumes/code/get-shit-done/node_modules/gsd-beads`). After `npm run build` in gsd-beads, the fork's TypeScript compiler resolves the new method through the symlinked dist.

## Key Implementation Details

### getTouchedPaths in MarkdownAdapter

The existing `_txnContextForPipeline()` escape hatch returned the entire `TxnCtx`. The new `getTouchedPaths()` exposes only the paths from `activeTxn.touchedPaths` union `activeTxn.removedPaths`, returning a fresh `Set<string>` each call to prevent caller mutations from corrupting internal state.

### getTouchedPaths in BeadsAdapter

Uses `peekBuffer(this._state?.bd)` from `txn.ts` which reads the `AsyncLocalStorage`-backed buffer. Each buffered `BufferedOp` maps to a synthetic `bd://kind/arg0` path. Returns empty Set when `this._state` is null (before first `_ensureBd()` call or outside any transaction).

### Conformance Manifest

The `kind: 'seam-realness'` union extension in `manifest-types.ts` is the only change to the manifest type system. The `seam-realness` entries reuse the existing `PresenceExpected` outcome type. The `preRegisterTest()` calls in `runSeamRealnessSuite` run at collection time (outside `it()`) to satisfy `meta-coverage.test.ts`'s bidirectional invariant before the test runner enters the test bodies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSDoc reference to deleted method name**
- **Found during:** Task 1 GREEN acceptance criteria check
- **Issue:** The `getTouchedPaths()` JSDoc in `adapters/markdown/index.ts` mentioned `_txnContextForPipeline()` by name, causing the acceptance criterion `! grep -q "_txnContextForPipeline" adapters/markdown/index.ts` to fail
- **Fix:** Removed the explicit method name from the JSDoc, replacing with "the deleted pipeline escape hatch"
- **Files modified:** adapters/markdown/index.ts
- **Commit:** d081b025

### Scope Notes

The pre-existing SDK unit test failures (12 files, 33 tests) are from `sdk/src/` files unrelated to this plan's scope (state-mutation, init, phase-lifecycle, etc.). These failures existed before this plan began and are tracked as Phase 2 migration work in Plans 02-03 onward.

The `readModifyWriteRoadmapMd` test failure in `adapters/markdown/index.test.ts` is pre-existing (`core.atomicWriteFileSync is not a function` — build artifact isolation issue in worktree context).

## Gates Verification

| Gate | Command | Result |
|------|---------|--------|
| Adapter TypeScript | `tsc -p adapters/tsconfig.json` | PASS (only pre-existing TS2688 node types warning) |
| Adapter unit tests | vitest --project adapters | 23/24 PASS (1 pre-existing failure) |
| gsd-beads TypeScript | `tsc --noEmit` in gsd-beads | PASS (0 errors) |
| gsd-beads unit tests | vitest run tests/unit/getTouchedPaths.test.ts | 4/4 PASS |
| Conformance paired | vitest --config vitest.conformance.config.ts | 193 pass + 4 todo (same pre-existing 4 failures) |
| Meta-coverage | vitest --config vitest.meta-coverage.config.ts | 3/3 PASS |

## Self-Check: PASSED

Checking created files exist:
- adapters/types.ts: FOUND
- adapters/markdown/index.ts: FOUND
- tests/conformance/seam-realness.conformance-suite.ts: FOUND
- tests/conformance/paired-seam-markdown.test.ts: FOUND
- tests/conformance/paired-seam-beads.test.ts: FOUND
- /Volumes/code/gsd-beads/src/index.ts: FOUND

Checking commits exist:
- Fork: 8ebbf0b6 (RED), a16eed14 (GREEN), d081b025 (fix), e793a423 (Task 3), 76d04d5b (SUMMARY): ALL FOUND
- Sibling: 89b608c (RED), e08a76e (GREEN): verified via git log in /Volumes/code/gsd-beads
