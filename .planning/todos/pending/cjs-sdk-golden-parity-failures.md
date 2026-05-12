---
title: CJS-vs-SDK golden parity test failures (6 tests, 3 files)
created: 2026-05-11
source: .planning/phases/03-wire-core-write-methods-recordstateevent/deferred-items.md
resolves_phase: "8"
scope: Phase 8 DIST-04 (golden parity matrix)
severity: non-blocking
---

# CJS-vs-SDK golden parity test failures

Promoted from Phase 3 Plan 03-06 deferred-items.md (executor flagged these as
pre-existing, verified against the base commit 3e235654 BEFORE 03-06 edits).

## Affected tests

| File | Test | Notes |
|------|------|-------|
| `sdk/src/golden/read-only-parity.integration.test.ts` | `state.load golden parity > SDK load payload matches gsd-tools.cjs state load` | Line 94 — subprocess-parity assertion diverges |
| `sdk/src/golden/golden.integration.test.ts` | `phase mutations > phase.add matches gsd-tools.cjs` | Line 341 |
| `sdk/src/golden/golden.integration.test.ts` | `phase mutations > phase.add-batch matches gsd-tools.cjs` | Line 355 |
| `sdk/src/golden/golden.integration.test.ts` | `phase mutations > phase.insert matches gsd-tools.cjs` | Line 368 |
| `sdk/src/golden/golden.integration.test.ts` | `validate.health > SDK JSON matches gsd-tools.cjs` | Line 543 |
| `sdk/src/lifecycle-e2e.integration.test.ts` | `E2E Lifecycle: InitRunner → GSD.runPhase() full lifecycle` | Line 239 — long-running e2e |

## Baseline (observed both before and after 03-06)

3 failed files / 6 failed tests / 90 passed / 4 skipped — 0 regression.

## Root-cause scope

These tests hit CJS-vs-SDK subprocess parity: bundle shape, stdout parsing,
phase-mutation output. Phase 1 ADR D-2026-04-30-10 scoped the golden parity
matrix to Phase 8 (DIST-04).

## Resolution path

Phase 8 is when the golden parity matrix lands. Options there:

1. Fix the SDK subprocess output to match CJS shape.
2. Delete the CJS comparison (if the fork drops `gsd-tools.cjs` entirely).
3. Mark these as `.skip` with a deadcode-until-Phase-8 comment if the failing
   assertions are known-expected fork divergences.

Do NOT fix these earlier — the fix direction depends on Phase 8's distribution
decision (PR upstream vs long-lived fork).

## Verification

Run:
```
NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run \
  sdk/src/golden/read-only-parity.integration.test.ts \
  sdk/src/golden/golden.integration.test.ts \
  sdk/src/lifecycle-e2e.integration.test.ts
```

Should report 6 failures across 3 files until Phase 8 addresses them.
