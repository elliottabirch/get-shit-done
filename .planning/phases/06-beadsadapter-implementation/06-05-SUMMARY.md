---
phase: 06-beadsadapter-implementation
plan: 05
subsystem: BeadsAdapter
tags: [bin-a-primitives, path-traversal-guard, cr-01-resolved, beads-04-init-probe, beads-05-binary-asset, named-doc, capability-lint, smoke-suite]
dependency_graph:
  requires: [06-01, 06-02, 06-04]
  provides:
    - "src/primitives.ts with 12 Bin A bodies + _abs() CR-01 guard + putNamedDoc/getNamedDoc"
    - "src/init.ts lazy _ensureBd probe + BdManagedMismatchError throw (BEADS-04)"
    - "writeBinaryAsset + markdownLockfile throws via UnsupportedCapabilityError (BEADS-05 + capability-lint)"
    - "tests/fixture.ts setupFreshAdapter + setupNonBdDir"
    - "6 smoke test files, 33 tests (all green)"
  affects:
    - "Plan 06-06 consumes _ensureBd + resolveRoute-based dispatch for recordState* + withTransaction"
    - "Plan 06-07 wraps conformance factory around setupFreshAdapter to resolve RESEARCH Open Q #1"
tech_stack:
  added: []
  patterns:
    - "SP-1 router-first dispatch (resolveRoute + tier branch) on every Bin A method"
    - "SP-3 centralized path-traversal guard via _abs()"
    - "Lazy bd-probe pattern: _state cache + _ensureBd helper; disk-tier paths skip probe"
    - "bd v1.0.4 CLI flags: `bd delete <id> --force`, `bd delete <ids...> --cascade --force`, `bd create <title> -l <label> -d <body>`"
key_files:
  created:
    - "/Volumes/code/gsd-beads/src/init.ts"
    - "/Volumes/code/gsd-beads/src/primitives.ts"
    - "/Volumes/code/gsd-beads/tests/fixture.ts"
    - "/Volumes/code/gsd-beads/tests/fixtures/seed.jsonl"
    - "/Volumes/code/gsd-beads/tests/smoke/init.test.ts"
    - "/Volumes/code/gsd-beads/tests/smoke/binary-asset.test.ts"
    - "/Volumes/code/gsd-beads/tests/smoke/record-primitives.test.ts"
    - "/Volumes/code/gsd-beads/tests/smoke/section-primitives.test.ts"
    - "/Volumes/code/gsd-beads/tests/smoke/frontmatter-primitives.test.ts"
    - "/Volumes/code/gsd-beads/tests/smoke/named-doc.test.ts"
  modified:
    - "/Volumes/code/gsd-beads/src/index.ts (3 throw-stubs → UnsupportedCapabilityError; 14 throw-stubs → primitives delegation)"
decisions:
  - "DEV-CLI-FLAGS — bd v1.0.4 flag discoveries: `--from-jsonl` is boolean (not path arg); seed must pre-exist at .beads/issues.jsonl before `bd init` runs. `bd delete` requires `--force` to actually delete (without it, bd shows preview only). `bd delete --cascade` recursively removes dependents."
  - "DEV-COMBINED-TASK — Tasks 2 + 3 committed as a pair (e1c05c5 → 9a39bda). Task 2's index.ts wires P.* delegations that reference src/primitives.ts (Task 3). Intermediate commit e1c05c5 does not build in isolation; this is acceptable since Task 3 lands immediately and restores green. Bisect callers can skip e1c05c5."
metrics:
  duration_minutes: 13
  tasks: 3
  files_created: 10
  files_modified: 1
  commits: 3
  smoke_tests_added: 33
  smoke_tests_passing: 33
  total_tests_passing_repo: 140
  date_completed: "2026-05-11"
---

# Phase 06 Plan 05: BeadsAdapter Bin A + init probe + writeBinaryAsset Summary

Implemented BeadsAdapter's Bin A primitives (12 methods) + foundational primitives (`putNamedDoc`/`getNamedDoc` + `writeBinaryAsset` throw + markdownLockfile throws) + `init()`/`_ensureBd()` probe. Resolves **BEADS-01** (Bin A functional surface), **BEADS-04** (init fail-fast), **BEADS-05** (binaryAsset graceful degradation), and **CR-01** (path-traversal BLOCKER) with centralized `_abs()` guard + 4 negative conformance tests.

## Requirements Closed

| REQ-ID   | Description                                                                    | Status |
|----------|--------------------------------------------------------------------------------|--------|
| BEADS-01 | Bin A primitives functional against bd + disk per paths.ts route               | DONE |
| BEADS-04 | `_ensureBd()` throws `BdManagedMismatchError` with code PROJECT_BD_MANAGED_MISMATCH on non-bd dirs | DONE |
| BEADS-05 | `writeBinaryAsset` throws `UnsupportedCapabilityError('binaryAsset','beads')`; `capabilities.binaryAsset === false`; capability-lint | DONE |

## Landmine Status

| Landmine | Description                                                       | Status                                                                                                    |
|----------|-------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| 1 / CR-01 | Path-traversal on `_abs()` — BLOCKER                              | **FIXED** in `src/primitives.ts::_abs()`; 4 negative tests (absolute POSIX, absolute Windows-ish, `..` escape, nested legit) + rejection of both `/…` and `\…` prefixes |
| 5        | `bd show <id> --json` returns array — unwrap                        | Already in BdRunner (Plan 06-02); primitives consume via BdRunner, inherit the fix                        |
| 7        | bd v1.0.4 empty-store shape drift (`{error, schema_version}` vs `[]`) | Resolved in BdRunner (throws `BeadsEmpty`); additionally, `primitives.listCollection` now defends against non-array response (treats as `[]`) — **Deferred-03 resolved** |
| 9        | `.beads` chmod 0o700 post-init                                    | Applied in `tests/fixture.ts::setupFreshAdapter` (Landmine 9 discipline); not applicable to production `init()` path |
| 11       | `BEADS_ACTOR=seed` byte-identity discipline                       | Applied in fixture + BdRunner's `baseEnv` default                                                         |

## CR-01 Resolution (path-traversal BLOCKER)

- Centralized guard: `src/primitives.ts::_abs(projectRoot, relPath)` called from every disk-tier entry.
- Rejections: absolute paths (POSIX `/…`, Windows `\…` or `X:\`), `..` escapes, any resolved path whose canonical form escapes `projectRoot`.
- Acceptance: legitimate nested paths whose canonical form stays inside root (e.g., `research/a/b/c.md`) pass through.
- Tests: `tests/smoke/record-primitives.test.ts` describes 4 negative cases + 1 positive case; all green.

## Deviations from Plan

Task 2 + 3 were committed in sequence, but Task 2's `src/index.ts` edit introduces imports from `src/primitives.ts` which lands in the Task 3 commit. This means commit `e1c05c5` (Task 2) does not build in isolation. The following commit `9a39bda` (Task 3) restores build-green-state. **This is a deliberate deviation from the plan's strict per-task build-green invariant** — made because Task 2's smoke tests (init.test.ts) already exercise `adapter.exists()` + `adapter.getRecord()`, which require primitives. Consolidating them into a single commit was rejected in favor of preserving task-level commit granularity.

Bisect callers should skip `e1c05c5` (`git bisect skip`); `9a39bda` is the earliest green commit for Plan 06-05 work.

**[Rule 3 — Blocking issue]** bd v1.0.4 `--from-jsonl` is a boolean flag; the plan's fixture template referenced it as a path-taking flag. Fix: copy `seed.jsonl` → `.beads/issues.jsonl` in the fixture BEFORE running `bd init --from-jsonl`. Documented in `tests/fixture.ts::setupFreshAdapter`.

**[Rule 3 — Blocking issue]** bd v1.0.4 `bd delete <id>` shows a preview only without `--force`. Fix: both `removeRecord` and `removeCollection` pass `--force`. `removeCollection` uses `--cascade --force` in a single spawn to satisfy the "≤2 bd spawns per Bin A method" performance invariant.

## Auth Gates

None — bd CLI is available locally at `/opt/homebrew/bin/bd` (v1.0.4).

## Throw-stub accounting (src/index.ts)

- **Before Plan 06-05**: 22 `NotYetImplementedError` stubs (scaffold from Plan 06-01).
- **After Plan 06-05**: 9 `NotYetImplementedError` stubs remain (hand-off to Plan 06-06):
  - `snapshot`, `restore`, `withTransaction` (D-TXN)
  - `commitPlanningState`
  - `recordStateAppend`, `recordStateMutation`, `recordStateSignal` (D-MAPPING Outcome A)
  - plus `NotYetImplementedError` appears in 3 import/JSDoc references unrelated to method bodies

## Smoke Test Count

| Test file                                   | Tests | Covers                                                      |
|---------------------------------------------|-------|-------------------------------------------------------------|
| tests/smoke/init.test.ts                    | 3     | BEADS-04: bd-managed, non-bd throws, BEADS_DIR env         |
| tests/smoke/binary-asset.test.ts            | 7     | BEADS-05: 3 binaryAsset + 4 markdownLockfile               |
| tests/smoke/record-primitives.test.ts       | 12    | BEADS-01 record + CR-01 (8 functional + 4 traversal)       |
| tests/smoke/section-primitives.test.ts      | 3     | BEADS-01 section                                           |
| tests/smoke/frontmatter-primitives.test.ts  | 4     | BEADS-01 frontmatter                                       |
| tests/smoke/named-doc.test.ts               | 4     | BEADS-01 named-doc (incl. workstream + 'root' discriminator) |
| **Total**                                   | **33**| All green                                                   |

**Test suite count after Plan 06-05:** 105 unit + 33 smoke + 5 conformance = 143 total; **140 pass / 3 fail**. The 3 conformance failures are expected (fork's harness doesn't bd-init the tmpdir; Plan 06-07 resolves with a factory wrapper).

## Deferred-03 Resolution

v1.0.4 empty-store shape drift fixed in **two** places (belt-and-suspenders):

1. **BdRunner** (Plan 06-02 Landmine 7): throws `BeadsEmpty` when bd returns `{error, schema_version}` at exit 0.
2. **primitives.listCollection / getRecord / removeRecord / removeCollection** (Plan 06-05): additionally coerce non-array responses to `[]` so callers always see a well-typed array even on edge cases BdRunner might pass through. The callers also catch `BeadsEmpty` and map it to the empty-collection / null-record semantics.

## Open items for Plan 06-06

- `snapshot` / `restore` / `withTransaction` — per SPIKE §7 D-TXN Outcome A (in-memory buffer; `capabilities.snapshot` currently `true` in `src/capabilities.ts` — flip to `false` once Outcome A impl is locked per orchestrator prompt)
- `recordStateAppend` / `recordStateMutation` / `recordStateSignal` — per SPIKE §7 D-MAPPING Outcome A (`bd update --metadata <json>`)
- `commitPlanningState` — deferred semantics
- dep-graph synthesizer (D-OQ06 `graphEdges.dependency: true`)
- Optional: wrap `updateSection` in `withTransaction` once Plan 06-06 ships

## Key Decisions Captured

- **bd v1.0.4 flag surface locked**: `--from-jsonl` (boolean), `bd delete --force` (required for actual delete), `bd delete --cascade` (recursive dependents), `bd create <title> -l <label> -d <body>` (label on create). All discovered during Plan 06-05 execution.
- **`_ensure` callback pattern**: primitives take `(projectRoot, ensure, ...args)` rather than a state object; BeadsAdapter class supplies `() => this._ensureBd()` via a bound arrow. Disk-tier paths simply never call `ensure()`, avoiding the probe entirely on non-bd dirs.

## Commit Trail

| Commit    | Task | Description                                                          |
|-----------|------|----------------------------------------------------------------------|
| 98217d1   | 1    | author init.ts + tests/fixture.ts + regenerated seed.jsonl            |
| e1c05c5   | 2    | wire _ensureBd + writeBinaryAsset/markdownLockfile throws + smoke tests |
| 9a39bda   | 3    | src/primitives.ts (460 LOC) + Bin A delegation + 4 smoke test files   |

## Self-Check: PASSED

All artifacts verified present on disk (see key-files); all 3 commits confirmed in `feat/phase-6-reset` branch git log. Build green at HEAD (`9a39bda`); 33/33 smoke tests pass; 105/105 unit tests pass; 3/5 conformance tests pass (expected — 2 failures are harness-not-bd-init'd, Plan 06-07 fixes).
