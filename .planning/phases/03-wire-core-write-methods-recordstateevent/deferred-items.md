# Deferred items — Phase 3 (out-of-scope findings)

These items surfaced during Plan 03-06 execution but are NOT caused by
Plan 03-06's changes. Verified against the worktree's base commit
(3e235654, pre-Plan-03-06) using `git stash` / `git stash pop`: the
same six failures exist in both tree states, so they are pre-existing.

## Pre-existing SDK integration test failures (6 tests, 3 files)

Observed on `worktree-agent-*` branch off `feat/storage-adapter`
@ 3e235654 BEFORE any Plan 03-06 edits landed.

| File | Test | Notes |
|------|------|-------|
| `sdk/src/golden/read-only-parity.integration.test.ts` | `state.load golden parity > SDK load payload matches gsd-tools.cjs state load` | Line 94 — subprocess-parity assertion diverges |
| `sdk/src/golden/golden.integration.test.ts` | `phase mutations > phase.add matches gsd-tools.cjs` | Line 341 |
| `sdk/src/golden/golden.integration.test.ts` | `phase mutations > phase.add-batch matches gsd-tools.cjs` | Line 355 |
| `sdk/src/golden/golden.integration.test.ts` | `phase mutations > phase.insert matches gsd-tools.cjs` | Line 368 |
| `sdk/src/golden/golden.integration.test.ts` | `validate.health > SDK JSON matches gsd-tools.cjs` | Line 543 |
| `sdk/src/lifecycle-e2e.integration.test.ts` | `E2E Lifecycle: InitRunner → GSD.runPhase() full lifecycle` | Line 239 — long-running e2e |

**Baseline status:** 3 failed files / 6 failed tests / 90 passed / 4 skipped
(baseline; matches post-Plan-03-06 state exactly — 0 regression).

**Reason not fixed here:** Plan 03-06 scope is the `StateWriteOutcome`
contract; these integration tests hit CJS-vs-SDK subprocess parity
(bundle shape, stdout parsing, phase-mutation output) which is
Phase 8 (DIST-04) scope per Phase 1 D-2026-04-30-10 ("golden parity
matrix is Phase 8 scope"). Not a regression caused by Plan 03-06.

**Recommended action:** Track as a separate gap plan under Phase 8
or file as SDK-side bugs. The Plan 03-06 gate uses `sdk unit` project
(1567 pass, 0 fail) which does not include these.
