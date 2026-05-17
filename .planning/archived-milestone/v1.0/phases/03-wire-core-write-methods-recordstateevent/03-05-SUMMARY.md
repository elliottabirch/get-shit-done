---
phase: 03-wire-core-write-methods-recordstateevent
plan: "05"
subsystem: conformance-tests, decisions
tags: [conformance, write-events, transaction, commit-planning-state, oq-01]
dependency_graph:
  requires: ["03-03", "03-04"]
  provides: ["conformance-write-events", "oq-01-resolution", "commit-planning-state-stub"]
  affects: ["07-conformance-suite"]
tech_stack:
  added: []
  patterns: ["event-family-round-trip-test", "withTransaction-atomicity-test", "git-in-tmpdir-test"]
key_files:
  created:
    - tests/conformance/write-events.test.ts
    - tests/conformance/write-transaction.test.ts
    - tests/conformance/commit-planning-state.test.ts
  modified:
    - .planning/DECISIONS.md
    - vitest.conformance.config.ts
decisions:
  - "D-2026-05-10-01: OQ-01 resolved — always-checkpoint semantics, per-adapter mapping"
  - "D-2026-05-10-02: commitPlanningState promoted from capability-gated to required method"
metrics:
  duration: "7m 30s"
  completed: "2026-05-10"
  tasks: 2
  files_created: 3
  files_modified: 2
---

# Phase 3 Plan 05: Conformance Tests + OQ-01 Resolution Summary

Write-side conformance tests verifying recordStateAppend/Mutation/Signal round-trips, withTransaction atomicity (5 scenarios), and commitPlanningState git commit creation; OQ-01 resolved with always-checkpoint semantics documented in DECISIONS.md.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Write conformance tests for event families + withTransaction + commitPlanningState | 2b2f7cb7 | tests/conformance/write-events.test.ts, write-transaction.test.ts, commit-planning-state.test.ts |
| 2 | Document OQ-01 resolution ADR + leak-grep verification | 9e9773f5 | .planning/DECISIONS.md |

## What Was Built

### Conformance Test Coverage

**write-events.test.ts (12 tests):**
- recordStateAppend: decision entry, metric row, roadmap evolution, session update, quick_task (section creation), forensic_session
- recordStateMutation: blocker add, blocker resolve, todo count update, deferred items add
- recordStateSignal: WAITING.json creation on waiting, WAITING.json removal on resume

**write-transaction.test.ts (5 tests):**
- Mutations persist after transaction completes
- Return value from callback passes through
- Lock released on success (second transaction immediately succeeds)
- Lock released on error (error propagates, lock freed)
- Concurrent transactions serialize (counter reaches 2, not 1)

**commit-planning-state.test.ts (2 tests + 1 Phase 7 stub):**
- Creates a git commit with the given message (full round-trip)
- Specific files parameter only stages those files (selective commit)
- `it.todo` stub for BeadsAdapter paired test (Phase 7 fills)

### OQ-01 Resolution

Two ADRs appended to DECISIONS.md:
- **D-2026-05-10-01:** Every adapter MUST implement `commitPlanningState` as a meaningful save point. Per-adapter mapping: git add+commit (Markdown), bead-hash bookmark (Beads), WAL checkpoint (SQLite).
- **D-2026-05-10-02:** `commitPlanningState` promoted from capability-gated to required method. Type guard removed, call sites simplified.

### Leak-grep Verification

`node scripts/leak-grep.cjs sdk/src/query/state-mutation.ts sdk/src/query/phase-lifecycle.ts` reports 80 matches. These are:
- Non-event state handlers (stateUpdate, stateAdvancePlan, statePrune, etc.) per D-03: these use `updateFrontmatter`/`updateSection` patterns, not `recordState*` events. Their direct-I/O will be addressed progressively in Phases 4-5.
- phase-lifecycle.ts handlers (~55 matches): full lifecycle handlers that compose many Bin A primitives. Their migration pattern was established in Plans 03-03/04 but the deprecated read-modify-write bodies remain until Phase 4 leak-plugging completes.

This is the expected state: Phase 3's scope was event-family collapse + transaction + commitPlanningState, not a full write-surface migration. The event family methods (recordStateAppend/Mutation/Signal) are verified clean by conformance tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest.conformance.config.ts resolve alias for adapter source**
- **Found during:** Task 1
- **Issue:** Compiled adapter at `adapters/dist/markdown/index.js` uses a relative dynamic import path (`../../sdk/src/query/state-mutation.js`) that resolves incorrectly at the dist path depth (3 levels vs 2 levels from repo root). This is a pre-existing build artifact issue.
- **Fix:** Added `resolve.alias` entries to `vitest.conformance.config.ts` to resolve adapter imports directly to TypeScript source files, bypassing the compiled dist entrypoint.
- **Files modified:** `vitest.conformance.config.ts`
- **Commit:** 2b2f7cb7

**2. [Rule 1 - Bug] Test seed data used "(none)" instead of adapter-recognized placeholder**
- **Found during:** Task 1
- **Issue:** The decision test seeded STATE.md with `(none)` but the adapter's `appendToSection` strips `None yet.`, `No decisions yet.`, and `^None.?` — not `(none)` with parentheses.
- **Fix:** Changed seed to `None yet.` and assertion to `not.toContain('None yet')`.
- **Files modified:** `tests/conformance/write-events.test.ts`
- **Commit:** 2b2f7cb7

## Verification Results

- All conformance tests pass: 19 passed, 1 todo (20 total)
- `grep -c "OQ-01" .planning/DECISIONS.md` = 6
- Leak-grep: 80 matches (documented exceptions in non-event/lifecycle handlers; Phase 4/5 scope)
- Phase 3 SC#2 (one call shape works against any adapter): verified via conformance tests exercising MarkdownAdapter
- Phase 3 SC#4 (OQ-01 resolved): D-2026-05-10-01 documents resolution

## Phase 7 Handoff

The `it.todo('commitPlanningState creates identifiable save point on BeadsAdapter')` stub in `commit-planning-state.test.ts` is the explicit Phase 7 integration point. When BeadsAdapter implements `commitPlanningState` as a bead-hash bookmark, Phase 7 fills this test to verify the save point is recoverable via `snapshot()/restore()`.
