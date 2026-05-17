---
phase: 01-fork-bootstrap-storageadapter-interface-skeleton-markdownada
plan: "05"
subsystem: testing
tags: [conformance, vitest, storage-adapter, markdown-adapter, test-harness]

# Dependency graph
requires:
  - phase: 01-fork-bootstrap-storageadapter-interface-skeleton-markdownada
    plan: "01"
    provides: "StorageAdapter interface (adapters/types.ts)"
  - phase: 01-fork-bootstrap-storageadapter-interface-skeleton-markdownada
    plan: "03"
    provides: "MarkdownAdapter implementation (adapters/markdown/index.ts)"
provides:
  - "Parameterized conformance harness factory: runAdapterConformanceSuite(name, factory)"
  - "MarkdownAdapter sample conformance test: getRecord/putRecord round-trip + null-on-missing"
  - "vitest.conformance.config.ts at repo root (independent of sdk vitest config)"
  - "npm script test:conformance for CI-friendly invocation"
affects:
  - Phase 2-5 (add describe blocks inside factory as handlers migrate)
  - Phase 7 (adds BeadsAdapter as a second runAdapterConformanceSuite invocation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parameterized test factory: runAdapterConformanceSuite(name, factory) — Phase 7 reuse without modification"
    - "Per-test isolation: mkdtemp + .planning/ mkdir + afterEach rm"
    - "NODE_PATH=./sdk/node_modules to resolve vitest/config from root-level config file"

key-files:
  created:
    - tests/conformance/adapter.conformance.ts
    - tests/conformance/markdown.conformance.test.ts
    - vitest.conformance.config.ts
  modified:
    - package.json

key-decisions:
  - "D-15 satisfied: harness shape locked as runAdapterConformanceSuite(adapterName, adapterFactory) for Phase 7 reuse"
  - "Separate vitest.conformance.config.ts avoids coupling with root vitest.config.ts or sdk vitest.config.ts"
  - "npm script uses sdk/node_modules/.bin/vitest + NODE_PATH (not npx --yes vitest) to resolve vitest/config import"
  - "Phase 1 scope: getRecord/putRecord round-trip only; Phases 2-5 add more describe blocks"

patterns-established:
  - "Conformance factory pattern: export function runAdapterConformanceSuite(name, factory) then invoke once per adapter in .test.ts file"
  - "Test isolation via mkdtemp + mkdir .planning + afterEach rm — matches adapters/markdown/index.test.ts helper pattern"

requirements-completed:
  - ADAPTER-03

# Metrics
duration: 15min
completed: 2026-05-01
---

# Phase 01 Plan 05: Conformance Harness Factory + Sample Test Summary

**Adapter-parameterized conformance harness factory `runAdapterConformanceSuite(name, factory)` with MarkdownAdapter round-trip test, vitest config at repo root, and `npm run test:conformance` npm script wired and green.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-01T00:36:00Z
- **Completed:** 2026-05-01T00:51:42Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- D-15 satisfied: `tests/conformance/` ships with parameterized factory + one sample test (getRecord round-trip) running against MarkdownAdapter
- Harness shape locked for Phase 7 reuse: `runAdapterConformanceSuite(adapterName, adapterFactory)` — Phase 7 adds BeadsAdapter by calling the factory a second time, no factory modification needed
- `npm run test:conformance` exits 0 with 2 assertions passing (putRecord round-trip, null-on-missing)
- Separate `vitest.conformance.config.ts` at repo root isolates conformance tests from SDK's vitest config

## Task Commits

1. **Task 1: Conformance harness factory + MarkdownAdapter sample test** - `9b12e1ac` (feat)
2. **Task 2: vitest config + npm script + verify suite runs green** - `9b181c5f` (feat)

## Files Created/Modified

- `tests/conformance/adapter.conformance.ts` - Parameterized factory: `runAdapterConformanceSuite(name, factory)` with beforeEach/afterEach isolation and two getRecord/putRecord round-trip assertions
- `tests/conformance/markdown.conformance.test.ts` - Minimal 7-line invocation file: constructs MarkdownAdapter and calls factory once
- `vitest.conformance.config.ts` - Root-level vitest config scoped to `tests/conformance/**/*.test.ts` with 30s timeout
- `package.json` - Added `test:conformance` npm script

## Decisions Made

- **Factory signature locked:** `runAdapterConformanceSuite(adapterName: string, adapterFactory: (projectDir: string) => StorageAdapter)` — two params allow clean output "StorageAdapter conformance: markdown" / "StorageAdapter conformance: beads". Phase 7 reuses unchanged.
- **Separate vitest config:** `vitest.conformance.config.ts` is independent of root `vitest.config.ts` (which has sdk+adapters projects). Avoids coupling and allows conformance to run in isolation.
- **Phase 1 scope:** Only getRecord/putRecord round-trip + null-on-missing. No section or frontmatter conformance tests (those land in Phases 2-5 as handlers migrate).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm script `npx --yes vitest@4.1.5` could not resolve `vitest/config` from root-level config**
- **Found during:** Task 2 (vitest config + npm script)
- **Issue:** The plan specified `npx --yes vitest@4.1.5 run --config vitest.conformance.config.ts`. When vitest is downloaded via npx to a temp dir, it cannot resolve `vitest/config` from the config file because the config file is at repo root where no local vitest is installed. The npx temp dir is not added to module resolution from the config file's location.
- **Fix:** Changed npm script to `NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run --config vitest.conformance.config.ts`. This uses the SDK's already-installed vitest (3.2.4) and sets NODE_PATH so `vitest/config` resolves correctly.
- **Files modified:** `package.json`
- **Verification:** `npm run test:conformance` exits 0 with 2 tests passing
- **Committed in:** `9b181c5f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - Blocking)
**Impact on plan:** The npm script invocation changed but the behavioral outcome is identical. The plan's research note that "vitest is already an SDK devDependency at sdk/package-lock.json version 4.1.5" was inaccurate — actual installed version is 3.2.4 (`^3.1.1` in package.json). No scope creep.

## Issues Encountered

- Pre-existing SDK unit test failures (4 test files, 6 tests) exist at the base commit (`ea3f612f`). These are unrelated to conformance harness work — verified by running tests before and after our changes with identical failure count.

## Known Stubs

None — the factory has real test assertions that run and pass. The comment blocks reserving Phase 2-7 extension points are intentional deferred scope per plan, not stubs.

## Threat Flags

None — this plan adds test files only. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

## Self-Check

- `tests/conformance/adapter.conformance.ts` FOUND
- `tests/conformance/markdown.conformance.test.ts` FOUND
- `vitest.conformance.config.ts` FOUND
- `package.json` test:conformance script FOUND
- Task 1 commit `9b12e1ac` FOUND
- Task 2 commit `9b181c5f` FOUND
- `npm run test:conformance` exits 0: PASSED (2 tests passed)

## Self-Check: PASSED

## Next Phase Readiness

- Conformance harness shape is locked and ready for Phases 2-5 to add describe blocks
- Phase 7 can add BeadsAdapter by calling `runAdapterConformanceSuite('beads', (dir) => new BeadsAdapter(dir))` in a new `.test.ts` file — factory unchanged
- `npm run test:conformance` is the canonical CI invocation

---
*Phase: 01-fork-bootstrap-storageadapter-interface-skeleton-markdownada*
*Completed: 2026-05-01*
