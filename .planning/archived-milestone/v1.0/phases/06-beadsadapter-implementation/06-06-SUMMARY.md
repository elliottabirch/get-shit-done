---
phase: 06-beadsadapter-implementation
plan: 06
subsystem: BeadsAdapter
tags: [event-families, state-write-outcome, transaction-outcome-a, dep-graph-synthesizer, oq-01-resolved, oq-06-created-section, feature-complete]
dependency_graph:
  requires: [06-01, 06-02, 06-03, 06-04, 06-05]
  provides:
    - "src/txn.ts (275 LOC) — D-TXN Outcome A in-memory write buffer; withTransaction with reentrancy; BeadsPartialCommitError for mid-txn commit gap"
    - "src/events.ts (536 LOC) — 3 recordState* families with exhaustive-switch + never checks; StateWriteOutcome three-state contract; Landmine 4 --author discipline"
    - "src/dep-graph.ts (114 LOC) — materializeGraphJson producing {type:'dependency', confidence:1.0} edges from bd blocks; spike-014 semantics preserved"
    - "commitPlanningState noop (OQ-01 resolution for BeadsAdapter; D-2026-05-12-OQ01-BEADS)"
    - "primitives.ts::getRecord intercept for path === 'graphs/graph.json' — lazy materialization"
    - "capabilities.snapshot flipped to false (Outcome A has no dedicated snapshot)"
    - "Zero throw-stubs remaining in src/index.ts — BeadsAdapter is feature-complete against the StorageAdapter contract"
    - "4 new smoke test files, 38 new tests (all green); full Phase 6 sweep: 71/71 green"
  affects:
    - "Plan 06-07: per-Bin-B-category smoke tests + conformance invocation wiring (wraps harness around setupFreshAdapter — RESEARCH Open Q #1 A3) + README/CLAUDE.md/CONTRIBUTING.md + Phase 6 exit checkpoint"
    - "Phase 7 CONFORM-04: relaxed-assertion requirement for 4 StateWriteOutcome matrix cells that assert created_section present (BeadsAdapter never emits under D-MAPPING Outcome A — see ADR)"
    - "Phase 6.1 (follow-up): mid-txn commit gap (Deferred-04) resolved by swapping src/txn.ts → src/txn/snapshot.ts if `bd init --no-install-hooks` lands upstream and Outcome C becomes attractive"
tech_stack:
  added:
    - "bd v1.0.4 `bd comments add --author gsd:event:<type>` discipline (Landmine 4 tightened — v1.0.4 hard-rejects `--label`, where v1.0.3 silently dropped)"
    - "bd v1.0.4 `bd remember <json> --key <m>:<type>:<id>` + `bd recall <key>` + `bd forget <key>` (memory-typed state events)"
    - "bd `dep add` blocks-edge export semantics (field name `type`, direction `depends_on_id` = blocker; Spike 014 preserved)"
  patterns:
    - "SP-4 StateWriteOutcome three-state dispatch (applied:true | applied:true+created_section | applied:false+duplicate | applied:false+nothing_to_remove)"
    - "SP-5 exhaustive `const _exhaustive: never = event` check at every switch default — compile-time AppendEvent/MutationEvent/SignalEvent coverage"
    - "TxnBuffer + queueOrRun pattern: writes queued during txn, replayed on commit, discarded on rollback; reads consult buffer for own-writes (peekBuffer/isTxnActive helpers)"
    - "WeakMap<BdRunner, TxnContext> reentrancy — nested withTransaction joins outer buffer"
    - "Lazy graph.json synthesis: single bd export --json spawn per getRecord call; fits ≤2-spawn budget"
key_files:
  created:
    - "/Volumes/code/gsd-beads/src/txn.ts"
    - "/Volumes/code/gsd-beads/src/events.ts"
    - "/Volumes/code/gsd-beads/src/dep-graph.ts"
    - "/Volumes/code/gsd-beads/tests/smoke/transaction.test.ts"
    - "/Volumes/code/gsd-beads/tests/smoke/state-events-append.test.ts"
    - "/Volumes/code/gsd-beads/tests/smoke/state-events-mutation.test.ts"
    - "/Volumes/code/gsd-beads/tests/smoke/state-events-signal.test.ts"
    - "/Volumes/code/gsd-beads/tests/smoke/dep-graph.test.ts"
    - "/Volumes/code/gsd-beads/tests/smoke/commit-planning-state.test.ts"
  modified:
    - "/Volumes/code/gsd-beads/src/index.ts (7 NotYetImplementedError throw-stubs replaced: withTransaction + 3 recordState* + commitPlanningState noop; snapshot/restore converted to UnsupportedCapabilityError per D-TXN Outcome A)"
    - "/Volumes/code/gsd-beads/src/primitives.ts (getRecord intercept for graphs/graph.json → dep-graph synthesizer)"
    - "/Volumes/code/gsd-beads/src/capabilities.ts (snapshot: true → false — Outcome A has no dedicated snapshot)"
    - "/Volumes/code/gsd-beads/vitest.config.ts (testTimeout 10s → 30s — Rule 1 deviation for full-sweep sustainability)"
    - "/Volumes/code/get-shit-done/.planning/DECISIONS.md (+2 ADRs: D-2026-05-12-OQ06-CREATED-SECTION, D-2026-05-12-OQ01-BEADS)"
decisions:
  - "D-TXN Outcome A locked pre-execution (D-2026-05-12-OQ06-TXN; user override); shipped as src/txn.ts in-memory buffer. Mid-txn partial-commit gap documented as Deferred-04 (Phase 6.1 follow-up) — structured BeadsPartialCommitError surfaces {committedOps, failedOp, remainingOps, failedKind, cause} when commit-replay fails partway."
  - "D-MAPPING Outcome A locked pre-execution (D-2026-05-12-OQ06-MAPPING); events.ts dispatches high-freq AppendEvents to `bd comments add --author gsd:event:<type>` (Landmine 4), low-freq to `bd remember --key <m>:<t>:<id>`, blocker mutations to `bd update --add-label|--remove-label gsd:blocker:<hash>`, and stateful mutations (todo_count_update, deferred_items) to `bd remember` on keyed memories."
  - "OQ-01 resolved for BeadsAdapter (D-2026-05-12-OQ01-BEADS): commitPlanningState is NOOP. bd's per-write atomicity + withTransaction cover the relevant semantics; the method exists to satisfy the StorageAdapter contract (not capability-gated)."
  - "Pitfall 7 policy locked (D-2026-05-12-OQ06-CREATED-SECTION): BeadsAdapter NEVER emits `created_section` on applied:true. Phase 7 CONFORM-04 needs per-adapter relaxation for the 4 matrix cells that assert created_section present."
  - "vitest.config testTimeout 10s → 30s (Rule 1 deviation): Plan 06-06 added 38 tests; full sweep under pool:forks+singleFork saturates dolt locks and individual tests starve past 10s even though raw work fits. 30s is stable across 3 repeat sweeps."
  - "DEV-REENTRANT-TXN: nested withTransaction JOINS the outer buffer via depth counter (WeakMap<BdRunner, TxnContext>). Matches MarkdownAdapter Phase 5 D-04/D-10 shadow-dir reentrancy semantics; nested commit is a no-op; only the outer-most call replays."
metrics:
  duration_minutes: 95
  tasks: 3
  files_created: 9
  files_modified: 5
  commits: 5
  smoke_tests_added: 38
  smoke_tests_passing_phase6: 71
  smoke_tests_passing_plan6_06: 38
  conformance_tests_baseline: "2/5 (unchanged — harness bd-init wrapper is Plan 06-07 scope)"
  throw_stubs_before: 7
  throw_stubs_after: 0
  date_completed: "2026-05-12"
commits:
  - "6c295c0 — feat(06-06): withTransaction + in-memory buffer per D-TXN Outcome A (BEADS-01)"
  - "a17136f — feat(06-06): 3 recordState* families with StateWriteOutcome (BEADS-02)"
  - "cc2d26e — feat(06-06): dep-graph synthesizer + commitPlanningState noop (BEADS-03; OQ-01)"
  - "0e6faa7a — docs(06-06): ADR D-2026-05-12-OQ06-CREATED-SECTION (fork)"
  - "15b4ef8b — docs(06-06): ADR D-2026-05-12-OQ01-BEADS (fork)"
---

# Phase 06 Plan 06: BeadsAdapter feature-complete — event families + transaction + dep-graph Summary

BeadsAdapter is feature-complete against the fork's `StorageAdapter` contract. Delivered BEADS-02 (3 `recordState*` families with three-state `StateWriteOutcome`), BEADS-03 (dep-graph synthesizer from bd blocks-type edges), and the final piece of BEADS-01 (`withTransaction` per D-TXN Outcome A in-memory buffer). Resolved OQ-01 for BeadsAdapter (`commitPlanningState` = NOOP). Zero `NotYetImplementedError` throws remain in `src/index.ts`. 71/71 Phase 6 smoke tests pass.

## Requirements Closed

| REQ-ID   | Description                                                                                          | Status |
|----------|------------------------------------------------------------------------------------------------------|--------|
| BEADS-01 | `withTransaction` (last Bin A piece); reentrant in-memory buffer; dry-run via discard                | DONE |
| BEADS-02 | 3 `recordState*` families with exhaustive switch + `never` check; StateWriteOutcome three-state dispatch | DONE |
| BEADS-03 | Dep-graph synthesizer producing `{type:'dependency', confidence:1.0}` edges from bd blocks           | DONE |

Also resolved (secondary):
- **OQ-01** (SYNTHESIS §6) for BeadsAdapter — `commitPlanningState` NOOP; MarkdownAdapter half was resolved in Phase 3.
- **Pitfall 7** policy — BeadsAdapter never emits `created_section` under D-MAPPING Outcome A.

## Task Breakdown

### Task 1 — `src/txn.ts` (withTransaction + buffer) · commit 6c295c0

**Scope:** Author the in-memory write buffer that implements D-TXN Outcome A (locked pre-execution per D-2026-05-12-OQ06-TXN, user override of Task-3 Outcome-C proposal). Replace `withTransaction`/`snapshot`/`restore` throw-stubs in `src/index.ts`; flip `capabilities.snapshot` to `false`.

**Delivered:**

- `src/txn.ts` (275 LOC). Core types: `BufferedOp { kind, args, opts? }`, `TxnContext { depth, buffer, dryRun, finalizing }`, `BeadsPartialCommitError`.
- `withTransaction<T>(state, fn, opts?)` — outer-most call allocates a fresh buffer; nested calls JOIN via `depth++`/`depth--` (reentrancy matches MarkdownAdapter Phase 5 D-04/D-10 shadow-dir semantics). WeakMap<BdRunner, TxnContext> keys the per-adapter context.
- Commit replays ops in order; mid-replay failure throws structured `BeadsPartialCommitError` with `{committedOps, failedOp, remainingOps, failedKind, cause}` — Deferred-04 explicit known gap.
- Rollback discards buffer; bd store untouched (no bd commands issued).
- `dryRun: true` unconditionally discards on exit — satisfies pipeline.ts dry-run requirement without a snapshot.
- `snapshot()` / `restore()` return rejected Promises; BeadsAdapter class throws `UnsupportedCapabilityError('snapshot', 'beads')` (capability-gated per `capabilities.snapshot: false`).
- Exported helpers for `events.ts` consumption: `queueOrRun(bd, kind, args, opts)` (queue if txn active, direct run otherwise), `peekBuffer(bd)`, `isTxnActive(bd)`.

**Test coverage** (tests/smoke/transaction.test.ts — 9 cases):
- capabilities.transaction === true; capabilities.snapshot === false
- snapshot() + restore() reject with UnsupportedCapabilityError
- disk-tier writes pass through; commit/rollback scope boundary documented
- thrown-fn rollback preserves pre-txn state
- nested withTransaction joins outer buffer (both commit + rollback paths)
- withTransaction returns fn() result verbatim

### Task 2 — `src/events.ts` (3 recordState* families) · commit a17136f

**Scope:** Author the 3 recordState* families with exhaustive dispatch over `AppendEvent | MutationEvent | SignalEvent` unions. Consume `parseState`/`formatState` from Plan 06-04's `src/format/state.ts` (B6 revision: CONSUME, no edits — verified `grep -cE '// (TODO|EXECUTOR|FIXME)' src/format/state.ts` returns 0 pre- and post- this plan). Append ADR for `created_section` policy.

**Delivered:**

- `src/events.ts` (536 LOC).
- **`recordStateAppend`** — 6 AppendEvent types dispatched:
  - High-freq (`session | quick_task | forensic_session`): `bd comments add <milestoneBead> --author gsd:event:<type> <payload_json>`. **Landmine 4 discipline**: `--author` is the ONLY structured slot for high-freq append-typing; v1.0.4 hard-rejects `--label` with exit 1 (v1.0.3 was silent-drop). Dedupe via `bd comments --json` + author/text match.
  - Low-freq (`decision | metric | roadmap_evolution`): `bd remember <payload_json> --key <milestone>:<type>:<hash>`. Dedupe via `bd recall <key>` with byte-identical content comparison. `_bdRecallOrNull` helper catches `BeadsUnavailableError` with "No memory with key" stderr → returns null (not found).
- **`recordStateMutation`** — 4 MutationEvent types dispatched:
  - `blocker_added` / `blocker_resolved`: `bd update <bead> --add-label|--remove-label gsd:blocker:<hash>`; dedupe via `_getEffectiveLabels` (bd show + pending buffer union).
  - `todo_count_update`: `bd remember ... --key <m>:todo_count:current` with byte-equality dedupe.
  - `deferred_items:add|remove`: merged-list `bd remember` on `<m>:deferred_items:list`; `bd forget` when the remove empties the list; `nothing_to_remove` on items-not-present.
- **`recordStateSignal`** — 2 SignalEvent types dispatched:
  - `waiting`: label add `gsd:waiting:<waitType>` on milestone bead. Duplicate → `applied:false, reason:'duplicate'`.
  - `resume`: label remove ALL `gsd:waiting:*` labels on milestone bead. Missing → `nothing_to_remove`.
- Every switch ends with `const _exhaustive: never = event` — SP-5 compile-time dispatch completeness check.
- All 3 families wrap their bd calls in `withTransaction` so multi-spawn failures roll back (5 `withTransaction` invocations in events.ts).
- "Own-writes-visible-during-txn" invariant: `_bufferContainsRememberKey`, `_bufferContainsCommentFor`, `_bufferContainsLabelOp`, `_getEffectiveLabels` helpers consult `peekBuffer(bd)` during dedupe checks so a second call inside the same txn correctly reports `duplicate` even though bd has not yet seen the first call's output.

**Pitfall 7 / ADR D-2026-05-12-OQ06-CREATED-SECTION** — BeadsAdapter NEVER emits `created_section` under D-MAPPING Outcome A. Rationale documented in ADR + inline comments at each `return { applied: true }` site. Phase 7 CONFORM-04 needs per-adapter relaxation for the 4 StateWriteOutcome-matrix cells that assert `created_section` present.

**Test coverage** (18 cases across 3 files):

- `tests/smoke/state-events-append.test.ts` (8): decision dedupe, metric dedupe, roadmap_evolution distinct-vs-duplicate, session applied:true bare (no created_section assertion per Pitfall 7), session dedupe, quick_task dedupe, forensic_session distinct-sessionIds, Landmine-4 positive assertion.
- `tests/smoke/state-events-mutation.test.ts` (6): blocker round-trip (add+dup+resolve+nothing_to_remove), blocker_resolved-first edge, todo_count_update dedupe-vs-changed, deferred_items:add with duplicate and new-item, deferred_items:remove missing / added / twice.
- `tests/smoke/state-events-signal.test.ts` (4): waiting+resume round-trip, duplicate-waiting, resume-without-waiting, distinct-waitTypes + double-resume.

### Task 3 — `src/dep-graph.ts` + primitives intercept + commitPlanningState noop · commit cc2d26e

**Scope:** Author the dep-graph synthesizer (BEADS-03). Intercept `getRecord('graphs/graph.json')` in `primitives.ts`. Implement `commitPlanningState` as NOOP (OQ-01). Append ADR. Bump vitest timeout (Rule 1 deviation).

**Delivered:**

- `src/dep-graph.ts` (114 LOC). `materializeGraphJson(bd): Promise<string>` — single `bd export --json` spawn; filter `beads[_type === 'issue'].dependencies[type === 'blocks']`; emit `{from: depends_on_id, to: issue.id, type: 'dependency', confidence: 1.0}`. Empty-store returns `{edges: []}` identity. Spike-014 semantics preserved verbatim (field name `type` not `dependency_type`; direction `depends_on_id` = blocker).
- `src/primitives.ts::getRecord` intercept at top: `if (path === 'graphs/graph.json') { const { bd } = await ensure(); return materializeGraphJson(bd); }` — lazy per-read; one bd spawn per call; fits ≤2-spawn budget.
- `src/index.ts::commitPlanningState` NOOP body with JSDoc citing `D-2026-05-12-OQ01-BEADS`.
- ADR `D-2026-05-12-OQ01-BEADS` appended to `.planning/DECISIONS.md` (commit 15b4ef8b on fork).
- `vitest.config.ts testTimeout: 10_000 → 30_000` (Rule 1 deviation — see Deviations section below).

**Test coverage** (11 cases across 2 files):

- `tests/smoke/dep-graph.test.ts` (8): capability declaration asserts `graphEdges = {semantic:false, dependency:true}`; empty-ish bd store; parent-child-only seed produces zero dep edges (negative assertion of the spike-014 filter); bd dep add round-trip; direction correctness (from=blocker, to=blocked; reverse absent); chained A→B→C produces 2 correct edges; unrelated beads yield zero spurious edges; JSON shape matches fork contract.
- `tests/smoke/commit-planning-state.test.ts` (3): resolves without throwing; does NOT mutate disk state; does NOT mutate bd state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vitest testTimeout 10s → 30s for full-sweep sustainability**

- **Found during:** Task 2 (first manifested at the 4-case blocker/signal round-trip tests); Task 3 full-sweep verification (21 timeouts surfaced)
- **Issue:** The `vitest.config.ts` default `testTimeout: 10_000` was workable on the Plan 06-05 baseline of 33 smoke tests. Plan 06-06 adds 38 tests (9 transaction + 18 state-events + 8 dep-graph + 3 commit-planning-state → 71 total). Under `pool: 'forks', singleFork: true`, vitest 4 runs test files concurrently within the same worker, so tests await on a shared dolt write-lock + bd-spawn queue. Cumulative wait pushed individual tests past the 10s ceiling even though raw `bd` work per test is ~1–2s. Three repeat runs of the 71-test sweep at 30s all passed cleanly.
- **Fix:** `vitest.config.ts` testTimeout bumped 10_000 → 30_000 with JSDoc explanation. Per-test `30_000` overrides kept on the known long-chain tests (mutation round-trip, signal distinct-waitTypes) as defensive-in-depth + documentation-of-intent signals.
- **Files modified:** `/Volumes/code/gsd-beads/vitest.config.ts`, `/Volumes/code/gsd-beads/tests/smoke/state-events-{mutation,signal}.test.ts` (per-test overrides)
- **Commit:** cc2d26e (Task 3) — vitest.config.ts change; per-test overrides are in a17136f (Task 2) and cc2d26e (Task 3)

No Rule 2 (missing critical functionality) or Rule 3 (blocking issue) deviations beyond the above. No Rule 4 (architectural) checkpoints were needed — all pre-execution locks (D-TXN Outcome A, D-MAPPING Outcome A) held through implementation.

### Deliberate Plan Deviations

**2. `src/txn.ts` not `src/txn/buffer.ts`**

The plan mentioned both `src/txn.ts` (in `files_modified`) and `src/txn/buffer.ts` (in the PATTERNS §"src/txn/<A|B|C>.ts" guidance). `files_modified` was authoritative; shipped as single-file `src/txn.ts`. Phase 6.1 migration to Outcome C would be a swap to `src/txn.ts` with new snapshot/restore bodies (or a refactor to a `src/txn/` folder at that time) — the decision is future-proof either way.

**3. No `src/format/state.ts` edits in this plan (B6 revision honored)**

Plan 06-04 shipped `src/format/state.ts` with FULL `parseState`/`formatState` bodies (verified `grep -cE "// (TODO|EXECUTOR|FIXME)" src/format/state.ts` returns 0 both pre- and post- Plan 06-06). Plan 06-06 IMPORTS via `import { parseState, formatState } from './format/state.js'` in downstream consumers — specifically: `src/events.ts` imports them (pre-imports landed) but does not actually call them in the shipped dispatch because D-MAPPING Outcome A routes through bd primitives (comments / memories / labels) rather than through STATE.md parse/format cycles. The imports are retained for forward-compatibility with potential Phase 6.1 / Phase 7 consumers that may want to serialize to/from STATE.md format from a recordState call-site. No B6 violation.

## Authentication Gates

None encountered. bd is a local CLI with no auth; BEADS_ACTOR=seed discipline (Landmine 11) is configured via BdRunner's baseEnv.

## Landmine Status (Plan 06-06 touchpoints)

| Landmine | Description                                                                 | Status                                                                                                             |
|----------|-----------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| 4        | `bd comments add --label` silently dropped in v1.0.3; HARD-REJECTS in v1.0.4 | `src/events.ts` dispatch for high-freq AppendEvents uses `--author gsd:event:<type>` exclusively. Positive smoke assertion in `state-events-append.test.ts` (Landmine-4 check) — would fail loudly if dispatch ever regressed. |
| 5        | `bd show <id> --json` returns array — unwrap                                  | Consumed through `BdRunner.show()` (Plan 06-02); `_getEffectiveLabels` in events.ts calls `state.bd.show(beadId)` directly. |
| 6        | `bd export --json` is JSONL, not JSON array                                  | Consumed through `BdRunner.run` (Plan 06-02 fallback); `dep-graph.ts::materializeGraphJson` receives an array either way. |
| 7        | bd v1.0.4 empty-store shape drift                                           | Consumed via `BdRunner` throwing `BeadsEmpty`. `dep-graph.ts` catches `BeadsEmpty` → returns `{edges: []}` identity. |
| 11       | `BEADS_ACTOR=seed` byte-identity                                             | Inherited via BdRunner's baseEnv; events.ts/txn.ts/dep-graph.ts do NOT override env.                                 |

## ADRs Appended to DECISIONS.md

1. **`D-2026-05-12-OQ06-CREATED-SECTION`** — BeadsAdapter never emits `created_section` under D-MAPPING Outcome A. Commit 0e6faa7a (fork).
2. **`D-2026-05-12-OQ01-BEADS`** — BeadsAdapter's commitPlanningState is a NOOP. Commit 15b4ef8b (fork).

## StateWriteOutcome Matrix Coverage

The fork's 16-case matrix at `tests/conformance/write-outcome.test.ts` is the canonical contract. Plan 06-06 smoke tests mirror the same dispatch structure with adjustments for Outcome A mapping (labels + memories instead of markdown headings). Tested analogs — 16 of 16 matrix cells covered, with the 4 `created_section`-asserting cells rewritten as `applied: true` bare per the ADR policy (Phase 7 CONFORM-04 scope to mark those 4 cells as "per-adapter relaxation" in the shared conformance suite).

## Test Counts

| Scope                            | Count | Status                           |
|----------------------------------|-------|----------------------------------|
| Plan 06-06 new smoke tests       | 38    | All green                        |
| Plan 06-05 baseline smoke tests  | 33    | All green (unchanged)            |
| **Total Phase 6 smoke**          | **71**| **71/71 green**                  |
| Conformance tests                | 5     | 2 pass / 3 fail — Plan 06-07 scope (harness bd-init wrap per RESEARCH Open Q #1 A3) |
| Unit tests                       | 0     | None added by Plan 06-06         |

## Throw-stub Inventory

**Before Plan 06-06:** 7 `throw new NotYetImplementedError` in `src/index.ts`:
- `snapshot`, `restore`, `withTransaction`
- `commitPlanningState`
- `recordStateAppend`, `recordStateMutation`, `recordStateSignal`

**After Plan 06-06:** 0 `throw new NotYetImplementedError` in `src/index.ts`.

- `withTransaction` → delegates to `T.withTransaction(state, fn)`.
- `snapshot` / `restore` → throw `UnsupportedCapabilityError('snapshot', 'beads')` (capability-gated; `capabilities.snapshot === false`).
- `commitPlanningState` → NOOP body with JSDoc citing `D-2026-05-12-OQ01-BEADS`.
- 3 `recordState*` methods → delegate to `E.recordState{Append,Mutation,Signal}(state, event)`.

**BeadsAdapter is feature-complete against the StorageAdapter contract.**

## Handoff for Plan 06-07

Plan 06-07 scope (unchanged from plan):

1. **Per-Bin-B-category smoke tests (8 categories):** phase / plan / summary / uat / debug / intel / learnings / spike-results. Each file exercises the Bin A primitive stack (getRecord/putRecord/getSection/updateSection/getFrontmatter/updateFrontmatter) against a representative sample of that category's paths. No new dispatch logic; these are coverage-breadth tests.
2. **Conformance invocation wiring:** resolve RESEARCH Open Q #1 A3 by wrapping the fork's `runAdapterConformanceSuite` factory around `setupFreshAdapter` so the harness tmpdir is bd-initialized before the adapter construction. Currently the 3 failing conformance tests all fail on `BdManagedMismatchError` from `_ensureBd` against an un-bd-initialized tmpdir.
3. **README/CLAUDE.md/CONTRIBUTING.md:** finalization. Document the Outcome A variant shipped + the mid-txn partial-commit gap + the Phase 6.1 follow-up plan (Deferred-04). Cross-ref all ADRs. Include quick-start for BeadsAdapter consumers.
4. **Phase 6 exit checkpoint:** verify BEADS-01/02/03/04/05 all green; deferred-items inventory; Phase 7 intake notes (CONFORM-04 known gap, `created_section` relaxation scope).

Plan 06-07 should NOT need to touch `src/*.ts` at all — any edit signals a Plan 06-06 regression and should be surfaced.

## Self-Check

Executed after SUMMARY write. Items verified:

### Files created (9)
- `/Volumes/code/gsd-beads/src/txn.ts` — FOUND (275 LOC)
- `/Volumes/code/gsd-beads/src/events.ts` — FOUND (536 LOC)
- `/Volumes/code/gsd-beads/src/dep-graph.ts` — FOUND (114 LOC)
- `/Volumes/code/gsd-beads/tests/smoke/transaction.test.ts` — FOUND (9 tests)
- `/Volumes/code/gsd-beads/tests/smoke/state-events-append.test.ts` — FOUND (8 tests)
- `/Volumes/code/gsd-beads/tests/smoke/state-events-mutation.test.ts` — FOUND (6 tests)
- `/Volumes/code/gsd-beads/tests/smoke/state-events-signal.test.ts` — FOUND (4 tests)
- `/Volumes/code/gsd-beads/tests/smoke/dep-graph.test.ts` — FOUND (8 tests)
- `/Volumes/code/gsd-beads/tests/smoke/commit-planning-state.test.ts` — FOUND (3 tests)

### Files modified (5)
- `/Volumes/code/gsd-beads/src/index.ts` — verified zero `throw new NotYetImplementedError`; 3 wiring blocks (T.* + E.* + commitPlanningState noop)
- `/Volumes/code/gsd-beads/src/primitives.ts` — verified `graphs/graph.json` intercept present
- `/Volumes/code/gsd-beads/src/capabilities.ts` — verified `snapshot: false`
- `/Volumes/code/gsd-beads/vitest.config.ts` — verified `testTimeout: 30_000`
- `/Volumes/code/get-shit-done/.planning/DECISIONS.md` — verified both ADRs present (`OQ06-CREATED-SECTION`, `OQ01-BEADS`)

### Commits found in git log
- `6c295c0` — FOUND
- `a17136f` — FOUND
- `cc2d26e` — FOUND
- `0e6faa7a` — FOUND (fork)
- `15b4ef8b` — FOUND (fork)

## Self-Check: PASSED
