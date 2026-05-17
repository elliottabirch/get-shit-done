---
phase: 07-conformance-test-suite
plan: "06"
subsystem: conformance
tags: [conformance, failure-injection, rollback, known-gap, phase-exit, CONFORM-04]
dependency_graph:
  requires: [07-04b, 07-05b]
  provides: [CONFORM-04-tests, rollback-diff-helpers, D-CONFORM-MANIFEST-ADR, Phase-7-exit]
  affects: [tests/conformance/manifest.ts, .planning/DECISIONS.md, .planning/STATE.md, .planning/ROADMAP.md, .planning/REQUIREMENTS.md]
tech_stack:
  added: []
  patterns: [bd-export-json-snapshot, SHA256-tree-hash, beadsSnapshot-strip-pass, assertFromManifest, preRegisterTest]
key_files:
  created:
    - tests/conformance/rollback-diff.ts
    - tests/conformance/failure-injection.test.ts
  modified:
    - tests/conformance/manifest.ts
    - package.json
    - .planning/DECISIONS.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
decisions:
  - "D-2026-05-12-CONFORM-MANIFEST: shipped 55-entry CONFORMANCE_MANIFEST with 4-kind discriminator (binB/section-tuple/noun-roundtrip/rollback), assertFromManifest enforcement, meta-coverage bidirectional invariant"
  - "D-09 known-gap baked as manifest entry: withTransaction:mid-commit-replay expected.beads.kind=incomplete-per-Deferred-04 with adr: D-2026-05-12-OQ06-TXN"
  - "D-10 throw-from-inside-fn: MarkdownAdapter byte-identical + BeadsAdapter record-identical on throw-before-commit path"
  - "D-11 beadsSnapshot: bd export --json with BEADS_ACTOR=seed + stripNonSemantic (updated_at + last_modified), recursive strip for nested comments/memories"
metrics:
  duration: 61m
  completed: 2026-05-12
---

# Phase 7 Plan 06: Failure-injection + Phase 7 exit (ADR D-CONFORM-MANIFEST) Summary

CONFORM-04 failure-injection tests shipped: MarkdownAdapter byte-identical rollback (D-10 + D-11) + BeadsAdapter record-identical rollback (Outcome A buffered-op discard) + mid-commit-replay known-gap formalized as manifest entry per D-09. Phase 7 exit ceremony complete.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Author rollback-diff.ts | 391e8bf7 | tests/conformance/rollback-diff.ts |
| 2 | Author failure-injection.test.ts + manifest entries | b4b1554b | tests/conformance/failure-injection.test.ts, manifest.ts, package.json, .gitignore |
| 3 | Append D-2026-05-12-CONFORM-MANIFEST ADR | 47f6b9ef | .planning/DECISIONS.md |
| 4 | Phase 7 exit ceremony | 2f5cd68a | .planning/STATE.md, ROADMAP.md, REQUIREMENTS.md |

## Final CONFORMANCE_MANIFEST Entry Count

| Kind | Count |
|------|-------|
| `binB` | 32 |
| `noun-roundtrip` | 12 |
| `section-tuple` | 9 |
| `rollback` | 2 |
| **Total** | **55** |

Entries × 2 adapters = 110 manifest keys. `registeredTests` populated with ≥ 110 keys when full suite runs.

## Test Results

**Failure-injection tests (Task 2):**
- `CONFORM-04: failure-injection (markdown)`: 1 test pass — byte-identical rollback via SHA-256 tree hash
- `CONFORM-04: failure-injection (beads)`: 2 tests pass (1 skip) — record-identical rollback via `bd export --json` diff + mid-commit-replay `it.skip` documentation
- Meta-coverage: registration-only test for `withTransaction:mid-commit-replay` passes

**Paired suite (paired.test.ts + failure-injection.test.ts, excluding properties):**
- 119/119 passing, 1 skipped (known-gap `it.skip`)
- Duration: ~553s (BeadsAdapter cold-start × many tests)

**Properties test (properties.test.ts + BeadsAdapter):**
- Pre-existing BeadsAdapter cold-start timeout issue (~24min wall-clock per run). Not caused by Plan 07-06 changes. Tracked as pre-existing — see `07-05b-SUMMARY.md` + debug `resolved/markdown-property-test-failure.md`.

## Adapter Deviations in Manifest (Phase 7 complete set)

| Manifest Entry | Deviation | ADR |
|----------------|-----------|-----|
| `recordStateAppend:decision:scaffold` | beads: `created_section: null` | D-2026-05-12-OQ06-CREATED-SECTION |
| `recordStateAppend:roadmap_evolution:duplicate` | beads: `applied: true` (no markdown dedup vs bd memory) | D-2026-05-12-OQ06-CREATED-SECTION |
| `recordStateMutation:blocker_resolved:existing` | beads: `nothing_to_remove` (markdown seed invisible to bd) | D-2026-05-12-OQ06-CREATED-SECTION |
| `recordStateSignal:resume:applied` | beads: `nothing_to_remove` (WAITING.json invisible to bd) | D-2026-05-12-OQ06-CREATED-SECTION |
| `withTransaction:mid-commit-replay` | beads: `incomplete-per-Deferred-04` | D-2026-05-12-OQ06-TXN |

(+ 6 more `created_section: null` entries per D-2026-05-12-OQ06-CREATED-SECTION)

## Deferred-04 / Deferred-05 Disposition

The BeadsAdapter Outcome A mid-commit-replay gap is formally baked into the manifest:
- Entry: `withTransaction:mid-commit-replay`
- `expected.beads.kind`: `'incomplete-per-Deferred-04'`
- `adr`: `'D-2026-05-12-OQ06-TXN'`
- Documented via `it.skip` in `failure-injection.test.ts` citing Deferred-04, Deferred-05, D-10, D-09

No adapter-internal hook used per D-10. Phase 6.1 remains the candidate path if Outcome C becomes a priority.

## Phase 8 Handoff

Both adapters ship conformance-equivalent with documented deviations:
- `normalize()` method available on both adapters (D-13) for Phase 8 DIST-02 migration tool
- `noun-roundtrip` manifest entries provide the canonical noun catalog for DIST-02 pre-seed normalize pass
- `tests/conformance/` exportable as `./conformance` subpath for third-party adapter authors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Missing adapters/dist in worktree**
- **Found during:** Task 2 test execution
- **Issue:** Worktree lacked `adapters/dist/` — the barrel file `adapters/markdown/index.js` imports from `../dist/markdown/index.js` which doesn't exist in fresh worktrees. Same root cause as the stale-dist issue from 07-05b.
- **Fix:** Created symlink `adapters/dist → /Volumes/code/get-shit-done/adapters/dist` in worktree; added `sdk/node_modules` to `.gitignore` for worktree infrastructure.
- **Files modified:** `.gitignore` (adds `sdk/node_modules`)
- **Commit:** b4b1554b

### Known Stubs

None. All test assertions use real adapter behavior.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `tests/conformance/rollback-diff.ts` exists | FOUND |
| `tests/conformance/failure-injection.test.ts` exists | FOUND |
| `.planning/phases/07-conformance-test-suite/07-06-SUMMARY.md` exists | FOUND |
| Commit `391e8bf7` (Task 1) exists | FOUND |
| Commit `b4b1554b` (Task 2) exists | FOUND |
| Commit `47f6b9ef` (Task 3) exists | FOUND |
| Commit `2f5cd68a` (Task 4) exists | FOUND |
