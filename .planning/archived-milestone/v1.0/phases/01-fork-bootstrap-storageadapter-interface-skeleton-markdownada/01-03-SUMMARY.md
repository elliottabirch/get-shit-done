---
phase: 01-fork-bootstrap-storageadapter-interface-skeleton-markdownada
plan: "03"
subsystem: storage-adapter
tags: [storage-adapter, markdown-adapter, cjs-bridge, scaffold, tdd]
dependency_graph:
  requires:
    - "01-01-SUMMARY.md"  # StorageAdapter interface + UnsupportedCapabilityError
    - "01-02-SUMMARY.md"  # upstream PR reconciliation
  provides:
    - "adapters/markdown/index.ts: MarkdownAdapter class"
    - "adapters/package.json: ESM package descriptor"
    - "adapters/vitest.config.ts: adapter test runner"
    - "vitest.config.ts updated: adapters project entry"
  affects:
    - "adapters/ (new directory with markdown/ subdirectory)"
    - "vitest.config.ts (added adapters project)"
tech_stack:
  added:
    - "adapters/package.json (type: module, private)"
  patterns:
    - "createRequire CJS bridge (mirrors state-project-load.ts pattern)"
    - "line-by-line markdown section parsing (no CJS analog for getSection)"
    - "three-candidate CJS path resolution (bundled / projectDir / homedir)"
key_files:
  created:
    - adapters/markdown/index.ts
    - adapters/markdown/index.test.ts
    - adapters/package.json
    - adapters/vitest.config.ts
  modified:
    - vitest.config.ts
decisions:
  - "D-02 HONORED: MarkdownAdapter wraps CJS via createRequire; zero CJS files modified"
  - "D-04 HONORED: line-by-line section parsing; all methods join planningBase + relPath via this.resolve()"
  - "Section methods use line-by-line parsing (not regex lookahead) for correctness across all SectionMode values"
  - "adapters/package.json added with type:module enabling import.meta in NodeNext compilation"
metrics:
  duration: "~8 minutes (execution time, not wall clock from plan creation)"
  completed: "2026-05-01T00:42:38Z"
  tasks_completed: 1
  files_created: 4
  files_modified: 1
  tests_added: 13
  lines_added: 407
---

# Phase 01 Plan 03: MarkdownAdapter Scaffold Summary

MarkdownAdapter class at `adapters/markdown/index.ts` — wraps CJS helpers via createRequire with line-by-line section parsing for the getSection/updateSection group that has no CJS analog.

## What Was Built

`adapters/markdown/index.ts` (407 lines) — a complete `StorageAdapter` implementation:

- 1 class (`MarkdownAdapter`) implementing 19 public methods
- Constructor: sync (D-03), resolves `planningBase` via `planningDir()` from `planning-workspace.cjs`
- 3 CJS modules pre-resolved in constructor (fail-fast pattern): `planning-workspace.cjs`, `frontmatter.cjs`, `core.cjs`

## Decision Compliance Matrix

| Decision | Status | Implementation |
|----------|--------|----------------|
| D-02: Wrap CJS via createRequire | HONORED | `createRequire(import.meta.url)` in constructor; 3 CJS modules pre-resolved |
| D-03: Sync constructor only | HONORED | Constructor is synchronous; no init/teardown |
| D-04: .planning/-relative paths via planningDir() | HONORED | `this.resolve(relPath)` in every method; 10 call sites |
| D-05: record/section/frontmatter = true literals | HONORED | `record: true, section: true, frontmatter: true` in capabilities |
| D-06: name = 'markdown' | HONORED | `readonly name = 'markdown' as const` |
| D-08: Optional capabilities closed enum | HONORED | All 6 optional caps declared |
| D-09/ADAPTER-07: markdownLockfile methods implemented | HONORED | `replaceInCurrentMilestone` wraps `core.cjs`; `readModifyWriteRoadmapMd` composes read + atomicWriteFileSync |
| D-10: Foundational primitives throw UnsupportedCapabilityError | HONORED | 6 methods throw with correct capability key |
| D-11: Defensive throws use correct capability + adapterName | HONORED | `new UnsupportedCapabilityError(capability, this.name)` |
| Pitfall 1 (literal true types) | MITIGATED | `record: true` satisfies `Capabilities.record: true` — TypeScript infers literal |
| Pitfall 3 (path confusion) | MITIGATED | `this.resolve()` in 10 locations; never passes bare relPath to node:fs |
| Pitfall 5 (no CJS analog for section) | MITIGATED | Line-by-line parsing implemented in `extractSection()` / `replaceSection()` helpers |

## Method Inventory (19 total)

### Bin A — Record group (5 methods, D-05 required)
| Method | Implementation |
|--------|---------------|
| `getRecord` | `readFile(abs, 'utf-8')`, ENOENT → null |
| `putRecord` | `mkdir(dirname, {recursive:true})` + `writeFile` |
| `removeRecord` | `unlink`, ENOENT → silent |
| `listCollection` | `readdir(withFileTypes:true)`, ENOENT → [] |
| `exists` | `existsSync(this.resolve(path))` |

### Bin A — Section group (2 methods, D-05 required)
| Method | Implementation |
|--------|---------------|
| `getSection` | `extractSection()` helper — line-by-line, heading-level-2 only |
| `updateSection` | `extractSection()` + `replaceSection()` — overwrite/append/prepend modes |

### Bin A — Frontmatter group (3 methods, D-05 required)
| Method | CJS Wrap Target |
|--------|----------------|
| `getFrontmatter` | `cmdFrontmatterGet(cwd, abs, field, false)` |
| `updateFrontmatter` | `cmdFrontmatterSet(cwd, abs, field, value, false)` |
| `mergeFrontmatter` | `cmdFrontmatterMerge(cwd, abs, patch, false)` |

### markdownLockfile group (2 methods, D-09 implemented since cap=true)
| Method | Implementation |
|--------|---------------|
| `replaceInCurrentMilestone` | read ROADMAP.md → `core.cjs::replaceInCurrentMilestone` → `atomicWriteFileSync` |
| `readModifyWriteRoadmapMd` | read ROADMAP.md → apply mutator → `atomicWriteFileSync` |

### commitPlanningState (1 method, D-08 implemented since cap=true)
| Method | Implementation |
|--------|---------------|
| `commitPlanningState` | `execFileSync('git', ['add', ...])` + `execFileSync('git', ['commit', '-m', ...])` |

### Foundational primitives — defensive throws (6 methods, D-10 / D-11)
| Method | Capability Key |
|--------|---------------|
| `writeBinaryAsset` | `'binaryAsset'` |
| `snapshot` | `'snapshot'` |
| `restore` | `'snapshot'` (same cap gates both snapshot methods) |
| `withTransaction` | `'transaction'` |
| `putNamedDoc` | `'namedDoc'` |
| `getNamedDoc` | `'namedDoc'` |

## CJS Files Wrapped (D-02)

| CJS File | Functions Used |
|----------|---------------|
| `planning-workspace.cjs` | `planningDir(cwd)` — constructor path resolution |
| `frontmatter.cjs` | `cmdFrontmatterGet`, `cmdFrontmatterSet`, `cmdFrontmatterMerge` |
| `core.cjs` | `replaceInCurrentMilestone`, `atomicWriteFileSync` |

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (failing tests) | `9c01210c` | PASSED — 13 tests fail with "Cannot find module './index.js'" |
| GREEN (all tests pass) | `4c2a8f51` | PASSED — 13/13 tests pass |
| REFACTOR | n/a | No refactor commit needed; implementation was clean |

## Verification Results

```
TypeScript --noEmit: PASS (0 errors)
vitest run --project adapters: 13/13 PASS
SDK build (cd sdk && npm run build): PASS
git diff --name-only main...HEAD -- get-shit-done/bin/lib/: (empty — no CJS modified)
grep -c "createRequire" adapters/markdown/index.ts: 2 (>= 1 required)
grep -c "throw new UnsupportedCapabilityError" adapters/markdown/index.ts: 6 (exactly 6)
grep -c "this.resolve" adapters/markdown/index.ts: 10 (>= 6 required)
wc -l adapters/markdown/index.ts: 407 (>= 200 required)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Regex lookahead approach replaced with line-by-line section parsing**
- **Found during:** Task 1 GREEN phase (tests failing after initial implementation)
- **Issue:** JavaScript's `RegExp` with `\Z` lookahead (from plan's code sketch) is a PCRE-only construct. The `(?=^##\s|\Z)` pattern in multiline mode matched `$` at end of each line rather than end of string, causing `getSection` to return an empty string and `updateSection` to corrupt the sibling section.
- **Fix:** Replaced with `extractSection()` / `replaceSection()` helpers using line-by-line iteration, which is more readable and correct for all edge cases.
- **Files modified:** `adapters/markdown/index.ts`
- **Commit:** `4c2a8f51`

**2. [Rule 2 - Missing Critical] Added `adapters/package.json` with `"type": "module"`**
- **Found during:** Task 1 TypeScript compilation check
- **Issue:** TypeScript's `NodeNext` module resolution requires either `.mts` extension or a `package.json` with `"type": "module"` to allow `import.meta.url`. Without it, tsc reported `TS1470: The 'import.meta' meta-property is not allowed in files which will build into CommonJS output.`
- **Fix:** Created `adapters/package.json` with `"type": "module"` and proper exports.
- **Files modified:** `adapters/package.json` (created)
- **Commit:** `4c2a8f51`

**3. [Rule 2 - Missing Critical] Added `adapters/vitest.config.ts` to exclude `types.test.ts`**
- **Found during:** Task 1 test run
- **Issue:** `types.test.ts` is a compile-time-only type assertion file with no `describe`/`it` vitest suites. Vitest reported "No test suite found" as a failure.
- **Fix:** Created `adapters/vitest.config.ts` with `include: ['markdown/**/*.test.ts']` to target only runtime tests.
- **Files modified:** `adapters/vitest.config.ts` (created), `vitest.config.ts` (updated)
- **Commit:** Addressed in both RED (`9c01210c`) and GREEN (`4c2a8f51`) commits

## Known Stubs

None. All 19 implemented/declared methods are either fully functional or explicitly documented as Phase 5 deferred (the 6 UnsupportedCapabilityError throws). The defensive-throw methods are intentional stubs with the correct error type, not data-flow stubs.

## Threat Flags

None. This plan creates no network endpoints, authentication paths, or new trust boundaries. The `commitPlanningState` method executes `git add/commit` in `projectDir` (user-controlled), consistent with existing GSD behavior.

## Notes on Conformance Testing

`adapters/markdown/index.test.ts` provides 13 unit tests covering the core behavioral contract. The full conformance harness (D-15) with the test factory at `tests/conformance/adapter.conformance.ts` is Phase 5 scope. These 13 tests are sufficient for the Phase 1 gate per plan requirements.

## Self-Check: PASSED

- `adapters/markdown/index.ts` EXISTS
- `adapters/markdown/index.test.ts` EXISTS
- `adapters/package.json` EXISTS
- `adapters/vitest.config.ts` EXISTS
- RED commit `9c01210c` EXISTS in git log
- GREEN commit `4c2a8f51` EXISTS in git log
- TypeScript noEmit: 0 errors
- 13/13 tests pass
- SDK build: 0 errors
- No CJS files modified
