---
phase: 03-wire-core-write-methods-recordstateevent
plan: "06"
subsystem: adapter-interface
tags: [storage-adapter, state-write-outcome, discriminated-union, dedupe, phase-3-gap-closure, beads-adapter-prep]

# Dependency graph
requires:
  - phase: 03-wire-core-write-methods-recordstateevent
    provides: recordStateAppend/Mutation/Signal dispatchers + 2 create-if-missing regression tests (commit 08b4054a)
  - phase: 05-foundational-primitive-lift
    provides: withTransaction shadow-dir journal (D-2026-05-10-07) — recordState* inherits txn semantics unchanged
provides:
  - StateWriteOutcome discriminated union on StorageAdapter (applied:true/false with reason enum + created_section)
  - HelperResult internal type on MarkdownAdapter, used by 7 refactored helpers
  - Adapter-side dedupe as single source of truth (caller-side pre-read loop in stateAddRoadmapEvolution deleted)
  - skip-sync-on-noop behavior (no last_updated frontmatter churn on dedupe hits)
  - resume existence check (distinguishes "removed a real pause" from "nothing to resume")
  - 16 new conformance tests exercising all 4 outcome variants × 3 event families
  - ADR D-2026-05-10-08 documenting the three-state contract and Phase 3 UAT scars
affects: [phase-06-beads-adapter, phase-07-conformance-suite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union result type for adapter operations with semantically-distinct no-op reasons"
    - "HelperResult internal type as pre-conversion stage before user-facing outcome"
    - "Adapter-side dedupe via reason:'duplicate' (replaces caller-side pre-read loops)"

key-files:
  created:
    - tests/conformance/write-outcome.test.ts
  modified:
    - adapters/types.ts
    - adapters/markdown/index.ts
    - sdk/src/query/state-mutation.ts
    - tests/conformance/write-events.test.ts
    - .planning/DECISIONS.md
    - .planning/ROADMAP.md

key-decisions:
  - "StateWriteOutcome is a discriminated union — applied:true (optionally with created_section) vs applied:false with reason:'duplicate'|'nothing_to_remove'"
  - "Dedupe lives in the adapter (single source of truth); caller-side pre-read loop in stateAddRoadmapEvolution deleted"
  - "skip-sync-on-noop — !applied paths skip syncFrontmatter+normalizeMd+putRecord (eliminates last_updated churn on dedupe hits)"
  - "resume existence check — recordStateSignal({type:'resume'}) stats WAITING.json before unlink so callers can distinguish nothing_to_remove"
  - "updateSessionFields create-if-missing extension — scaffolds ## Session Continuity when no session field matches (flagged in <scope_concerns>, surfaced in ADR)"
  - "appendToSection legacy helper deleted (0 callers) rather than refactored to HelperResult"

patterns-established:
  - "HelperResult → StateWriteOutcome translation: private helpers return {body, applied, created_section?, reason?}; public methods unwrap to the user-facing outcome before returning"
  - "Exact-shape toEqual assertions on outcomes (catches field-shape drift that bare applied:true asserts would miss)"

requirements-completed: [WRITES-01, WRITES-02, WRITES-03, WRITES-04]

# Metrics
duration: 52min
completed: 2026-05-10
---

# Phase 3 Plan 06: StateWriteOutcome three-state contract gap closure Summary

**StateWriteOutcome discriminated union lands across StorageAdapter + MarkdownAdapter + 8 SDK callsites; caller-side dedupe in stateAddRoadmapEvolution deleted; 16 new conformance tests cover every outcome variant per event family; ADR D-2026-05-10-08 records the contract and Phase 3 UAT scars.**

## Performance

- **Duration:** ~52 min (2026-05-11T04:20:26Z → ~05:12Z)
- **Started:** 2026-05-11T04:20:26Z
- **Completed:** 2026-05-11T05:12:00Z (approximate)
- **Tasks:** 9
- **Files modified:** 6 (1 created, 5 modified) + 1 deferred-items.md logging out-of-scope findings

## Accomplishments

- Three-state `StateWriteOutcome` discriminated union shipped on `StorageAdapter` (`adapters/types.ts`) — replaces `Promise<void>` on `recordStateAppend/Mutation/Signal`.
- `MarkdownAdapter` refactored: 7 internal helpers now return `HelperResult`; dispatchers translate to `StateWriteOutcome`; `appendToRoadmapEvolution` dedupe branch surfaces `reason:'duplicate'` instead of lying to the caller; `recordStateSignal({type:'resume'})` gains an existence check for `nothing_to_remove`.
- 8 SDK callsites in `sdk/src/query/state-mutation.ts` consume the outcome and surface `reason` / `created_section` in their response JSON. Caller-side dedupe loop in `stateAddRoadmapEvolution` (lines 929-938 pre-edit) deleted — adapter is the single source of truth.
- Two Phase-3 UAT regression tests (commit 08b4054a) migrated to additionally assert on `outcome.created_section === '## Performance Metrics'` / `'## Blockers'` — content assertions preserved; type assertions added.
- New `tests/conformance/write-outcome.test.ts` with 16 tests covering every point in the coverage matrix (applied:true bare / applied:true + created_section / applied:false duplicate / applied:false nothing_to_remove × 3 event families).
- ADR `D-2026-05-10-08` filed in `.planning/DECISIONS.md` citing the Phase 3 UAT commits (e7c0806a, e325d561, 08b4054a) and documenting the two subtle behavior changes.
- Phase 6 (BeadsAdapter in sibling `gsd-beads` repo) now has a clean contract target from day one.

## Task Commits

This plan used a single atomic commit per `<action>` directive in Task 9
(D-2026-05-01 rollback lessons from Phase 5). All nine tasks squash into
one commit.

1. **Task 1:** Add `StateWriteOutcome` type + update `StorageAdapter` interface signatures (`adapters/types.ts`).
2. **Task 2:** Refactor 7 MarkdownAdapter helpers to return `HelperResult`, delete dead `appendToSection`, migrate `recordStateAppend` dispatcher.
3. **Task 3:** Refactor `recordStateMutation` + `recordStateSignal` (with resume existence check) to return `StateWriteOutcome`.
4. **Task 4:** Update 8 SDK callers in `state-mutation.ts` to consume outcomes + delete caller-side dedupe in `stateAddRoadmapEvolution`.
5. **Task 5:** Migrate 2 existing regression tests in `write-events.test.ts` to assert on `outcome.created_section`.
6. **Task 6:** Add new `tests/conformance/write-outcome.test.ts` with 16 outcome-variant tests.
7. **Task 7:** Verification gate — all 6 gates green (see table below).
8. **Task 8:** Write ADR `D-2026-05-10-08` in `DECISIONS.md`.
9. **Task 9:** Update `ROADMAP.md` Phase 3 Wave 5 entry + atomic commit of Tasks 1-9.

**Plan metadata + all task content:** committed as `bcbb1e49` in a single
Task 9 atomic commit (`feat(adapter): land StateWriteOutcome three-state contract (03-06 gap)`).

## Files Created/Modified

- `adapters/types.ts` — +1 exported `StateWriteOutcome` type (4-branch discriminated union); 3 method signatures on `StorageAdapter` return `Promise<StateWriteOutcome>` instead of `Promise<void>`.
- `adapters/markdown/index.ts` — +1 module-level `HelperResult` type; `StateWriteOutcome` added to imports; 7 private helpers refactored (`appendToOrCreateSection`, `appendToMetricsTable`, `appendToRoadmapEvolution`, `updateSessionFields`, `removeFromBlockersList`, `updateTodoCount`, `mutateDeferredItems`); legacy `appendToSection` deleted (zero callers after refactor); `recordStateAppend`/`recordStateMutation`/`recordStateSignal` translate HelperResult → StateWriteOutcome; resume case gains existence check.
- `sdk/src/query/state-mutation.ts` — `StateWriteOutcome` imported; 8 callsites (`stateRecordMetric`, `stateAddDecision`, `stateAddBlocker`, `stateResolveBlocker`, `stateAddRoadmapEvolution`, `stateRecordSession`, `stateSignalWaiting`, `stateSignalResume`) capture and branch on `outcome.applied`; caller-side dedupe loop in `stateAddRoadmapEvolution` deleted; response JSON gains `reason` and `created_section` fields where applicable.
- `tests/conformance/write-events.test.ts` — 2 existing regression tests migrated to additionally assert on `outcome.created_section`. Total `it()` count unchanged at 16; 16/16 pass.
- `tests/conformance/write-outcome.test.ts` — NEW. 16 tests (exceeds the ≥14 plan target). Three `describe` blocks (Append outcomes, Mutation outcomes, Signal outcomes). All assertions use exact-shape `toEqual` form.
- `.planning/DECISIONS.md` — ADR `D-2026-05-10-08` appended. 4 occurrences of discriminant literals (`'duplicate'`/`'nothing_to_remove'`); 9 citations of Phase 3 UAT commits; full type definition included.
- `.planning/ROADMAP.md` — Phase 3 Wave 5 `03-06-PLAN.md` line marked `[x]`; checkbox flipped from `[ ]`. Plan count of `6 plans` preserved.
- `.planning/phases/03-wire-core-write-methods-recordstateevent/deferred-items.md` — NEW. Logs 6 pre-existing SDK integration test failures verified out-of-scope (same failure count on baseline commit).

## SDK callers updated (enumerated)

The 8 callers (not 9 — JSDoc mention at line 901 pre-edit was not a real
callsite) consuming `StateWriteOutcome`:

| # | Handler | Event family | No-op response shape |
|---|---------|--------------|----------------------|
| 1 | `stateRecordMetric` | recordStateAppend/metric | `{recorded:false, reason, phase, plan, duration}` |
| 2 | `stateAddDecision` | recordStateAppend/decision | `{added:false, reason, decision}` |
| 3 | `stateAddBlocker` | recordStateMutation/blocker_added | `{added:false, reason, blocker}` |
| 4 | `stateResolveBlocker` | recordStateMutation/blocker_resolved | `{resolved:false, reason, blocker}` |
| 5 | `stateAddRoadmapEvolution` | recordStateAppend/roadmap_evolution | `{added:false, reason, entry}` |
| 6 | `stateRecordSession` | recordStateAppend/session | `{recorded:false, reason}` |
| 7 | `stateSignalWaiting` | recordStateSignal/waiting | `{signaled:false, reason}` (defensive — waiting always applies) |
| 8 | `stateSignalResume` | recordStateSignal/resume | `{resumed:false, reason, removed:false}` |

Success responses (applied:true) additionally include `created_section`
when the adapter scaffolded a heading. No additional handlers beyond the
enumerated 9 were found — Task 4's paranoid re-grep confirmed 8 captured
callsites and no uncaptured bare `await adapter.recordState*` calls.

## `appendToSection` disposition

DELETED. Grep (`this.appendToSection(`) returned 0 callers before Task 2's
refactor: the other six helpers were already the primary dispatch targets
(`appendToOrCreateSection`, `appendToMetricsTable`, etc.). Replaced by a
comment marker citing Plan 03-06 so future archaeology finds the context.

## Handler response-shape additions

Backward-compatible. No existing field removed or renamed.

- All success responses gain optional `created_section?: string` when the
  adapter scaffolded a missing heading.
- All no-op responses gain `reason: 'duplicate' | 'nothing_to_remove'`
  narrowing the failure cause.
- `stateSignalWaiting` and `stateSignalResume` gain defensive `signaled:false`
  / `resumed:false` branches (waiting should always apply; resume maps
  `nothing_to_remove` to `resumed:false`).

## Behavior changes (documented in ADR D-2026-05-10-08)

1. **skip-sync-on-noop** — when `outcome.applied === false`, the adapter
   skips `syncFrontmatter + normalizeMd + putRecord`. Prior behavior
   rewrote the file unchanged on dedupe hits, which ticked `last_updated`
   in the frontmatter. The new behavior is cleaner but visible. If any
   downstream test ASSERTED that `last_updated` changed on a dedupe-hit
   call, it would regress — search turned up zero such assertions.
2. **resume existence check** — `recordStateSignal({type:'resume'})` now
   calls `getRecord('WAITING.json')` before unlinking so the outcome
   distinguishes "removed a real pause" (`applied:true`) from "nothing
   to resume" (`applied:false, reason:'nothing_to_remove'`). Prior
   behavior was blind-unlink; test `removes WAITING.json on resume signal`
   in write-events.test.ts continues to pass unchanged because it seeds
   WAITING.json before calling resume.
3. **updateSessionFields create-if-missing** — flagged in Plan 03-06
   `<scope_concerns>`. The HelperResult discipline forces every branch
   to produce a typed outcome; making the no-match branch return
   `applied:true + created_section:'## Session Continuity'` is
   consistent with decision/metric/blocker parity and is explicitly
   surfaced (not silently absorbed). Documented in the ADR.

Both/all behavior changes cited in the ADR Rationale + Consequences
sections, with the ADR noting the invariants they preserve.

## Decisions Made

All decisions track HANDOFF `decisions[3]` verbatim, plus three scope
decisions flagged during execution:

1. **Single atomic commit (D-2026-05-01 rollback pattern from Phase 5)** —
   Tasks 1-9 squash into one commit per plan Task 9 directive. Deviates
   from the default per-task commit pattern; matches the plan spec.
2. **updateSessionFields create-if-missing extended (Plan `<scope_concerns>`)** —
   flagged rather than silently absorbed. Surfaced in ADR Rationale.
3. **appendToSection deleted (not refactored)** — 0 callers at audit
   time. Comment marker retained in place of the old method.

## Deviations from Plan

None — plan executed exactly as written.

The plan's `<scope_concerns>` block explicitly called for the
`updateSessionFields` extension to be flagged rather than silently
absorbed; that was done (see Decisions #2 above and ADR Rationale).
This does not count as a deviation; it IS the planned scope.

## Task 7 Gate Summary

| Gate                         | Baseline | Post-refactor | Delta  |
|------------------------------|----------|---------------|--------|
| SDK tsc (`--noEmit`)         | 0 err    | 0 err         | 0      |
| Adapter tsc (`--noEmit`)     | 0 err    | 0 err         | 0      |
| SDK unit (`vitest --project unit`) | 1567 pass / 0 fail | 1567 pass / 0 fail | 0 |
| Conformance suite (`vitest`) | 117 pass / 4 skip / 1 todo / 0 fail | 133 pass / 4 skip / 1 todo / 0 fail | +16 |
| Leak-grep (`leak-grep.cjs state-mutation.ts phase-lifecycle.ts`) | 0 matches | 0 matches | 0 |

All gates green. Conformance gain (+16) exceeds the plan's ≥14 target.

## Issues Encountered

- **Pre-existing SDK integration test failures (6/1667).** The
  `sdk/src/golden/*.integration.test.ts` + `lifecycle-e2e.integration.test.ts`
  files have 6 failing tests on baseline (verified via `git stash` at
  commit 3e235654 BEFORE any Plan 03-06 edits). These are NOT caused by
  Plan 03-06. Logged in
  `.planning/phases/03-wire-core-write-methods-recordstateevent/deferred-items.md`
  per the executor's SCOPE BOUNDARY rule. Phase 8 (DIST-04) owns golden
  parity per D-2026-04-30-10.
- **First SDK test run showed 12 flaky failures.** Re-running the same
  suite produced 7505/7505 passing. Attributed to test concurrency race;
  no pattern in affected suites. Does not affect gate since gate uses
  `vitest --project unit` which was consistent across runs at 1567/0.

## User Setup Required

None — no external service configuration.

## Next Phase Readiness

- **Phase 6 BeadsAdapter (sibling `gsd-beads` repo):** unblocked. The
  interface now has the three-state contract from day one; BeadsAdapter
  does not inherit the two-state contract and does not need a later
  refactor to catch up.
- **Phase 7 Conformance suite:** the new `write-outcome.test.ts` file
  is already adapter-parameterizable (imports `MarkdownAdapter` via the
  `StorageAdapter` type). Phase 7 can lift the `new MarkdownAdapter(...)`
  line into a shared factory and run the same 16 tests against both
  backends unchanged.
- **No blockers or concerns for subsequent phases.**

## Self-Check: PASSED

Files verified to exist:
- FOUND: `adapters/types.ts` (modified; StateWriteOutcome + 3 signatures)
- FOUND: `adapters/markdown/index.ts` (modified; HelperResult + 7 helpers + 3 public methods)
- FOUND: `sdk/src/query/state-mutation.ts` (modified; 8 callsites)
- FOUND: `tests/conformance/write-events.test.ts` (modified; 2 migrated tests)
- FOUND: `tests/conformance/write-outcome.test.ts` (created; 16 tests)
- FOUND: `.planning/DECISIONS.md` (modified; ADR D-2026-05-10-08)
- FOUND: `.planning/ROADMAP.md` (modified; Phase 3 Wave 5 flipped to [x])
- FOUND: `.planning/phases/03-wire-core-write-methods-recordstateevent/03-06-SUMMARY.md` (this file)
- FOUND: `.planning/phases/03-wire-core-write-methods-recordstateevent/deferred-items.md` (created)

Commits verified:
- FOUND: `bcbb1e49` (`feat(adapter): land StateWriteOutcome three-state contract (03-06 gap)`) via `git log --oneline | grep bcbb1e49`.

---
*Phase: 03-wire-core-write-methods-recordstateevent*
*Completed: 2026-05-10*
