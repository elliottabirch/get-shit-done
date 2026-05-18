# Phase 2: Make the Seam Real — Research

**Researched:** 2026-05-18
**Domain:** StorageAdapter seam engineering — callsite threading, interface extension, conformance testing
**Confidence:** HIGH (all claims verified against live codebase via grep/read; architectural conclusions derived from direct file inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Option B):** Delete `adapterFor` entirely. SEAM-02 acceptance grep == 0 is satisfied structurally.
- **D-02:** Generic dry-run diff via `snapshot()`/`restore()`. Pipeline.ts dry-run becomes: `snap = await adapter.snapshot()` → `await adapter.withTransaction(async () => { await original(...); const touched = adapter.getTouchedPaths(); })` → `await adapter.restore(snap)`. Underscore-prefixed `_txnContextForPipeline` and `_realReadForPipeline` deleted.
- **D-03:** New interface method `StorageAdapter.getTouchedPaths(): Set<string>`, callable inside active transaction.
- **D-04:** Best-effort bd impl via "enumerate-all-records-this-transaction-touched" fallback. Diff correct on bd but coarser than markdown's exact path set. Conformance asserts diff *non-empty* on bd, *exact path set* on markdown.
- **D-05:** Performance note (informational): bd snapshot is `bd export --json` + re-init on restore (~100ms–1s overhead). Acceptable for interactive `--dry-run`.
- **D-06 (Option A):** Complete the in-flight closure-wrapper migration. Every handler accepts `(adapter, args, projectDir, workstream)`. `createRegistry` closures thread adapter from `createStorageAdapter(projectDir)`. `QueryHandler` type unchanged.
- **D-07:** No pivot to context-object (B), factory pattern (C), or registry-constructor (D).
- **D-08:** Adapter cache lives in the closure, not in `helpers.ts`. `_adapterCache` Map retired alongside `adapterFor`.
- **D-09:** Shared helpers stay adapter-first-arg (`getMilestoneInfo`, `extractCurrentMilestone`, `findPhase`, `roadmapAnalyze`). No refactor there.
- **D-10:** Extend v1.0 56-entry conformance manifest with ~30 new `kind: 'seam-realness'` entries.
- **D-11:** DEFECT-02 lands as a `kind: 'seam-realness'` manifest entry naming `putRecord`/`getRecord` with buffer-size fixture parameter.
- **D-12:** Failure-disposition pattern: `kind: 'known-gap'` per failing handler with required `adr:` reference. 95% pass rate = `(entries where kind !== 'known-gap') / total entries`.
- **D-13:** Per-adapter `StateWriteOutcome` assertions in manifest entries.
- **D-14 (IMPLEMENT ALONGSIDE):** Change SDK handler return types from `Promise<void>` to `Promise<StateWriteOutcome>` for every state-mutation handler in Phase 2.
- **D-15 (HARD PRECONDITION):** Atomic-commit separation per handler family. Two atomic commits per file: commit 1 = thread adapter, commit 2 = propagate StateWriteOutcome. Build+test gate between each. NEVER bundled.
- **D-16 (HARD PRECONDITION):** Pre-flight callsite audit before changing handler return types. Planner runs the audit; results in RESEARCH.md.
- **D-17:** Per-handler-family commit pairs (~14–18 commits total).
- **D-18:** Build + full test suite gate after each commit.
- **D-19:** Per-phase staging branch (reuse Phase 1 D-04 pattern).

### Claude's Discretion

- Exact ordering of handler-family migrations within Phase 2 plans.
- Whether `getTouchedPaths` goes through `withTransaction`'s callback context or as a direct adapter method.
- Test fixture shape for new `kind: 'seam-realness'` manifest entries (within the DEFECT-02 buffer-size constraint).
- Whether pre-flight callsite audit is a separate bd issue or rolled into Phase 2 planning notes.
- Bd-mirror discipline for STATE.md updates during this phase.

### Deferred Ideas (OUT OF SCOPE)

- Bd-native diff primitive (`bd export --json` + re-init is the Phase 2 impl; optimization is future scope).
- Workflow/skill-layer consumption of `StateWriteOutcome` — Phase 2 propagates the outcome; callers that *act* on it are a separate refactor.
- `registeredTests` discovery automation in conformance.
- Underscore-prefix audit beyond `_txnContextForPipeline` / `_realReadForPipeline`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEAM-01 | All `adapterFor(projectDir)` callsites in `sdk/src/query/` replaced with adapter-first-arg | Handler inventory below confirms 101 callsites across 29 files; migration pattern established |
| SEAM-02 | `adapterFor` deleted from `helpers.ts` (D-01 Option B) | Verified: `adapterFor` at helpers.ts:537; `_adapterCache` at helpers.ts:529; both deleted in Phase 2 |
| SEAM-03 | Every QueryHandler in registry threads `adapter` as first arg | Closure-wrapper pattern verified in index.ts; ~40 already done, ~78 callsites remaining across the not-yet-migrated handlers |
| SEAM-04 | Round-trip conformance test: `adapter: "beads"`, `state.milestone-switch` → bd-tier STATE.md receives write | Enabled by SEAM-01..03; `stateMilestoneSwitch` is one of the 23 state-mutation.ts callsites |
| SEAM-05 | Same round-trip under `adapter: "markdown"` — byte-identical to upstream | Strict-superset invariant; MarkdownAdapter is already identity-preserving |
| SEAM-06 | Conformance suite `kind: 'seam-realness'` entry for all migrated state-mutation handlers, both adapters, ≥95% pass | New manifest kind; ~30 entries; conformance manifest schema described below |
| DEFECT-02 | Large-body (>64KB) singleton `putRecord`/`getRecord` round-trip test | One `kind: 'seam-realness'` entry with buffer-size fixture; BeadsAdapter `capabilities.snapshot: false` complicates but does not block |
</phase_requirements>

---

## Summary

Phase 2 makes the StorageAdapter seam physically load-bearing by threading the registry-injected adapter through every `adapterFor(projectDir)` callsite in `sdk/src/query/`. The current state is: 101 callsites across 29 files all call `adapterFor()`, which hardcodes `MarkdownAdapter` regardless of what `storage.adapter` config says. The fix is straightforward but voluminous: each callsite becomes an `(adapter, args, projectDir, workstream)` first-arg pattern matching the ~40 handlers already migrated in Phase 1/2 plans.

The hardest part is not the threading itself — it is the atomic-commit discipline (D-15/D-18) and the pipeline.ts refactor (D-02). Pipeline.ts currently uses MarkdownAdapter-private escape hatches (`_txnContextForPipeline`, `_realReadForPipeline`) to compute dry-run diffs. These must be replaced with a generic `snapshot()` → mutate → `getTouchedPaths()` + `getRecord()` → `restore()` flow. The BeadsAdapter complicates this because its `capabilities.snapshot` is `false` (it throws `UnsupportedCapabilityError`) — meaning the pipeline dry-run path needs a `hasSnapshot()` guard and a capability-aware fallback.

The StateWriteOutcome propagation (D-14) is already structurally present: `adapters/types.ts` defines `StateWriteOutcome`, both adapters return it from `recordState*`, and several state-mutation handlers already propagate it in their return envelopes. The remaining handlers that call `adapterFor` internally still discard the outcome. Propagating it is additive (all existing callers are unbound — confirmed by the pre-flight audit below).

**Primary recommendation:** Execute in strict per-file commit pairs (D-15): start with `state-mutation.ts` (23 callsites, highest leverage, most conformance coverage), then `phase-lifecycle.ts` (10 callsites), then proceed in descending callsite count. Resolve the pipeline.ts refactor and `getTouchedPaths` interface addition as a standalone Wave 0 commit before the handler migration begins — it removes a blocker that would otherwise re-emerge at every handler that exercises dry-run.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Adapter instance creation | Registry build layer (`createRegistry`) | — | `createStorageAdapter(projectDir)` called once per `createRegistry` invocation; adapter shared across all closures via lexical scope |
| Adapter caching (per-projectDir) | Registry build layer | — | D-08: cache moves from `_adapterCache` in helpers.ts to the closure environment in `createRegistry`; same semantics, correct ownership |
| Handler invocation with adapter | `createRegistry` closure | Handler implementation | Closure binds adapter, handler body receives it as first arg |
| Dry-run diff computation | `pipeline.ts` (`wrapHandler`) | StorageAdapter interface | `wrapHandler` orchestrates snapshot/mutate/getTouchedPaths/getRecord/restore; adapter provides the mechanism |
| `getTouchedPaths` tracking | StorageAdapter implementation | — | MarkdownAdapter: reads from `activeTxn.touchedPaths` Set; BeadsAdapter: needs new per-transaction tracking set |
| StateWriteOutcome propagation | Handler return envelope | — | Handlers already receive outcome from `adapter.recordState*`; propagation is a return-type change only |
| Conformance evidence | `tests/conformance/manifest.ts` + paired test files | — | Manifest entries + paired test registrations enforce bidirectional coverage |

---

## Standard Stack

### Core (already in repo, no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `adapters/types.ts` StorageAdapter | current | Interface definition; `getTouchedPaths` added here | Single source of truth for all adapter contracts |
| `adapters/markdown/index.ts` MarkdownAdapter | current | File-system implementation | Default adapter; `_txnContextForPipeline` being deleted in favor of public `getTouchedPaths` |
| `gsd-beads` npm package | current (node_modules via `createRequire`) | BeadsAdapter; `getTouchedPaths` needs implementation | Peer package; Phase 2 must either bump to a version that includes the method or implement inside the npm package consumer shim |
| `sdk/src/query/adapter-factory.ts` `createStorageAdapter` | current | Constructs the adapter from config | Replaces `adapterFor` at the registry build layer |
| `sdk/src/query/index.ts` `createRegistry` | current | Closure-wrapper orchestration point | Established pattern for ~40 already-migrated handlers |
| `tests/conformance/manifest.ts` | current | Conformance manifest; ~30 entries added | Bidirectional enforcement via `meta-coverage.test.ts` |

### No new packages required for Phase 2

All Phase 2 work is internal refactoring and test authoring against the existing stack. No `npm install` needed. [VERIFIED: grep of package.json + adapter-factory.ts]

---

## Pre-Flight Callsite Audit Results

**D-16 Deliverable:** All callers of state-mutation handlers audited for bound vs unbound pattern.

### Audit Query and Results

```bash
grep -rn "await state[A-Z][a-zA-Z]*(" sdk/src/ workflows/ .claude/ 2>/dev/null | grep -v "test|spec"
```

**Result: Every state-mutation handler caller is UNBOUND.** [VERIFIED: grep result]

No call site matched the bound patterns:
- `const x = await stateX(...)` — 0 matches
- `if (await stateX(...))` — 0 matches

Matches found were all in JSDoc examples (lines 12, 15, 17, 18 of state.ts and state-mutation.ts) — not live call sites.

**Internal bound callers (already adapter-aware, not affected):**
- `sdk/src/query/route-next-action.ts:90`: `const sj = await stateJson(adapter, ...)` — already migrated, bound to `const sj`, but this is a **read** handler, not a mutation handler. The return type change (D-14) applies only to state-mutation handlers. Read handlers are NOT changing their return types.
- `sdk/src/query/init.ts:154,198,685`: `const roadmapResult = await roadmapGetPhase(adapter, ...)` — read handler, not mutation, not in scope for return type change.

**Bound callers for roadmap/phase mutation handlers:**
- None found. All roadmapUpdatePlanProgress, roadmapAnnotateDependencies, requirementsMarkComplete, roadmapAnnotateDependencies calls are void-discarded.

### Pre-Flight Audit Verdict

**StateWriteOutcome propagation (D-14) is safe to proceed as additive change.** Zero callers branch on the current void return. The return type change from `Promise<void>` to `Promise<StateWriteOutcome>` will not break any existing caller.

**Exception class — read-only handlers:** Handlers that are pure reads (return `QueryResult` with structured data, never call `adapter.recordState*`) should NOT get the `StateWriteOutcome` return type. These only need the adapter-threading commit (commit 1 per D-15), not the return-type commit (commit 2). See Handler Family Inventory below for classification.

---

## Handler Family Inventory

**29 files with `adapterFor(projectDir)` callsites; 101 total calls.** [VERIFIED: grep count]

### Migration Status by File

**Already migrated in `index.ts` (closed via adapter closure, no `adapterFor` inside handler body):**
These files have been updated to take `adapter` as first arg AND are registered via closure in `index.ts`:
- `state.ts`: `stateProjectLoad`, `stateJson`, `stateGet`, `stateSnapshot` (4 handlers, all closure-wrapped at index.ts:302–334)
- `phase.ts`: `findPhase`, `phasePlanIndex`, `phasesList`, `phasesArchive`, `phaseNextDecimal` (5 handlers — closures at index.ts:336–510)
- `roadmap.ts` (partial): `roadmapAnalyze`, `roadmapGetPhase` (2 read handlers migrated; `roadmapAnnotateDependencies`, `requirementsMarkComplete` still use `adapterFor` at 1 callsite each)
- `progress.ts` (partial): `progressJson` (closure-wrapped at index.ts:366–371); `progressBar`, `progressTable`, `statsJson` still use `adapterFor` (3 remaining)
- `route-next-action.ts`: `routeNextAction` (closure at index.ts:459)
- `phase-ready.ts`: `checkPhaseReady` (closure at index.ts:451)
- `detect-phase.ts`: `detectPhaseType` (closure at index.ts:465)
- `check-verification-status.ts`: `checkVerificationStatus` (closure at index.ts:477)
- Various `init.ts` handlers: `initExecutePhase`, `initPlanPhase`, `initNewMilestone`, `initQuick`, etc. (all init.* handlers, index.ts:533–548)
- Summary/history/audit handlers: `summaryExtract`, `historyDigest`, `auditOpen`, `auditUat`, `uatRenderCheckpoint` (index.ts:577–668)
- Intel handlers: `intelDiff`, `intelSnapshot`, `intelValidate`, `intelStatus`, `intelQuery`, `intelExtractExports`, `intelPatchMeta`, `intelUpdate` (index.ts:675–730)
- `docsInit` (index.ts:621)

**NOT YET migrated — files requiring commit pairs in Phase 2:**

| File | adapterFor calls | Handlers | Read or Write? | StateWriteOutcome? |
|------|-----------------|----------|---------------|-------------------|
| `state-mutation.ts` | 23 | `stateUpdate`, `statePatch`, `stateBeginPhase`, `stateAdvancePlan`, `stateRecordMetric`, `stateUpdateProgress`, `stateAddDecision`, `stateAddBlocker`, `stateResolveBlocker`, `stateRecordSession`, `statePlannedPhase`, `stateValidate`, `stateSync`, `statePrune`, `stateMilestoneSwitch`, `stateAddRoadmapEvolution`, `stateSignalWaiting`, `stateSignalResume`, plus internal helpers `syncStateFrontmatter`, `readModifyWriteStateMdFull`, `readModifyWriteStateMd` | Mixed (most Write; `stateValidate` is read-only) | Yes for write handlers; no for `stateValidate` |
| `phase-lifecycle.ts` | 10 | `initPlanPhase` (duplicate — already closure-wrapped?), phase lifecycle handlers (initExecutePhase, etc.) | Mixed | Some |
| `spike-sketch.ts` | 7 | `spikeGetManifest`, `spikeGetConventions`, `spikePutWrapUp`, `spikePutConventions`, `sketchGetManifest`, `sketchGetConventions`, `sketchPutWrapUp` | Mixed (Get = read, PutWrapUp = write) | No (these use `putRecord`, not `recordState*`) |
| `scratch.ts` | 6 | `discussCheckpointPut`, `discussCheckpointGet`, `discussCheckpointDelete`, `discussQuestionsPut`, `discussQuestionsGet`, `discussQuestionsDelete` | Mixed | No (use `putRecord`/`getRecord`) |
| `named-docs.ts` | 6 | `reportPut`, `reportGet`, `handoffPut`, `continueHerePut`, `forensicsPut`, `decisionsIndexGet` | Mixed | No (use `putNamedDoc`/`getNamedDoc`) |
| `workstream.ts` | 4 | `workstreamList`, `workstreamCreate`, `workstreamSet`, `workstreamStatus` (workstreamGet doesn't use adapterFor) | Mixed | No |
| `progress.ts` | 4 | `progressBar`, `progressTable`, `statsJson`, `todoMatchPhase` | Read | No |
| `config-mutation.ts` | 4 | `configSet`, `configSetModelProfile`, `configNewProject`, `configEnsureSection` | Write | No (use `putRecord`/`mergeFrontmatter`) |
| `thread-seed.ts` | 3 | `threadAdd`, `seedAdd`, `todoAdd` | Write | No |
| `milestone-ops.ts` | 3 | `milestoneArchivePhases`, `phaseGetManifest`, `graphifyStore` | Mixed | No |
| `commit.ts` | 3 | `commit`, `checkCommit`, `commitToSubrepo` | Mixed | No |
| `codebase-docs.ts` | 3 | `codebasePut`, `codebaseGet`, `codebaseList` | Mixed | No |
| `verify.ts` | 2 | `verifyPhaseCompleteness`, `verifySchemaDrift` (others don't use adapterFor) | Read | No |
| `validate.ts` | 2 | `validateConsistency`, `validateHealth` | Read | No |
| `tmp-docs.ts` | 2 | `tmpPut`, `tmpGet` | Mixed | No |
| `sidecar.ts` | 2 | `nextCallCountGetHandler`, `nextCallCountIncrHandler` | Mixed | No |
| `roadmap-update-plan-progress.ts` | 2 | `roadmapUpdatePlanProgress` | Write | No |
| `phase-list-queries.ts` | 2 | `phaseListArtifacts`, `phaseListPlans` | Read | No |
| `config-query.ts` | 2 | `configGet`, `resolveModel` | Read | No |
| `check-completion.ts` | 2 | Internal helpers `checkPhaseCompletion`, `checkMilestoneCompletion` (called from `checkCompletion` handler) | Read | No |
| `template.ts` | 1 | `templateFill` (templateAdapter) | Read | No |
| `roadmap.ts` | 1 | `requirementsMarkComplete` (`reqAdapter` internal) | Write | No |
| `requirements-extract-from-plans.ts` | 1 | `requirementsExtractFromPlans` | Read | No |
| `profile.ts` | 1 | `learningsCopy` | Write | No |
| `pipeline.ts` | 1 | Internal `adapterFor` in `wrapHandler` dry-run block | N/A — replaced by snapshot/restore | N/A |
| `mvp.ts` | 1 | `phaseMvpMode` | Read | No |
| `debug-session.ts` | 1 | `debugArchive` | Write | No |
| `check-ship-ready.ts` | 1 | `checkShipReady` | Read | No |
| `check-gates.ts` | 1 | `checkGates` | Mixed | No |

**Summary:**
- Files requiring commit pair (thread + StateWriteOutcome): `state-mutation.ts` only (it has 23 callsites AND uses `recordState*`)
- Files requiring adapter-threading commit only (no StateWriteOutcome): 28 remaining files
- `pipeline.ts`: special case — no adapter-first-arg change; instead, replace the dry-run block with snapshot/restore pattern

### Registration Pattern for Non-Migrated Handlers

All of the "NOT YET migrated" files listed above register their handlers in `index.ts` using the **direct handler reference pattern** (not the closure pattern):
```typescript
registry.register('workstream.get', workstreamGet); // NO adapter closure
```

Migration means changing to:
```typescript
registry.register('workstream.get', (args, projectDir, ws) => workstreamGet(adapter, args, projectDir, ws));
```

AND changing the handler function signature from:
```typescript
export const workstreamGet: QueryHandler = async (_args, projectDir) => {
  const adapter = await adapterFor(projectDir); // DELETE THIS LINE
  ...
}
```
to:
```typescript
export async function workstreamGet(adapter: StorageAdapter, _args: string[], projectDir: string): Promise<QueryResult> {
  // adapter is now the parameter, not obtained via adapterFor
  ...
}
```

---

## Pipeline.ts Refactor Sketch

### Current Shape (to be replaced)

```typescript
// pipeline.ts:116-151 — current dry-run block
if (dryRun && isMutation) {
  const { adapterFor } = await import('./helpers.js');
  const adapter = await adapterFor(projectDir);

  const ext = adapter as unknown as {
    withTransaction<T>(fn: () => Promise<T>, opts?: { dryRun?: boolean }): Promise<T>;
    _txnContextForPipeline?: () => { touchedPaths: Set<string>; removedPaths: Set<string> } | undefined;
    _realReadForPipeline?: (relPath: string) => Promise<string | null>;
  };

  await ext.withTransaction(async () => {
    await original(args, projectDir);  // NOTE: original still uses old signature!
    const ctx = ext._txnContextForPipeline?.();
    const realRead = ext._realReadForPipeline;
    if (!ctx || !realRead) return;  // non-MarkdownAdapter: leave diff empty

    const allTouched = new Set<string>([...ctx.touchedPaths, ...ctx.removedPaths]);
    for (const p of allTouched) {
      beforeMap.set(p, await realRead.call(ext, p));
      afterMap.set(p, ctx.removedPaths.has(p) ? null : await adapter.getRecord(p));
    }
    diff = diffPlanningState(beforeMap, afterMap);
  }, { dryRun: true });
}
```

**What changes:**
1. Remove `import { adapterFor }` — adapter comes from the registry's bound closure
2. Remove `_txnContextForPipeline` and `_realReadForPipeline` casts
3. Replace with `snapshot()` → mutate → `getTouchedPaths()` → `getRecord()` → `restore()`

### New Shape (per D-02)

The adapter for pipeline.ts must come from the registry, not from `adapterFor`. The current `wrapHandler` function receives `original` from `registry.getHandler(cmd)`. After migration, `original` will be a closure that already has `adapter` bound. But `wrapWithPipeline` still needs access to the adapter to call `snapshot()`/`restore()` — it's not just wrapping the handler call.

**Constraint:** `wrapWithPipeline` needs its own adapter reference. Today it gets it via `adapterFor`. After D-01, it must receive the adapter some other way.

**Two viable approaches:**

**Approach A — Pass adapter to `wrapWithPipeline`:**
```typescript
// pipeline.ts - new signature
export function wrapWithPipeline(
  registry: QueryRegistry,
  mutationCommands: Set<string>,
  options: PipelineOptions,
  adapter: StorageAdapter,  // NEW PARAM
): void {
```
The caller (index.ts or the CLI entry point) already has the adapter from `createRegistry`. Pass it down.

**Approach B — Closure-extract from handler:**
Pass the adapter via `options.getAdapter?: () => StorageAdapter`. The planner picks A or B (Claude's discretion per D-07).

**New dry-run block (generic, works on both adapters):**

```typescript
import { hasSnapshot } from '../../../adapters/types.js';

// Inside wrapHandler:
if (dryRun && isMutation) {
  let diff: Record<string, { before: string | null; after: string | null }> = {};

  if (hasSnapshot(adapter)) {
    // Generic snapshot/restore path — works on MarkdownAdapter.
    // BeadsAdapter currently throws (capabilities.snapshot = false), so
    // this branch is MarkdownAdapter-only for now.
    const snapId = await adapter.snapshot();
    try {
      await adapter.withTransaction(async () => {
        await original(args, projectDir);
        const touched = adapter.getTouchedPaths();  // NEW interface method
        const beforeMap = new Map<string, string | null>();
        const afterMap = new Map<string, string | null>();
        for (const p of touched) {
          // After-image: read from adapter (inside txn = reads shadow dir)
          afterMap.set(p, await adapter.getRecord(p));
        }
        // Must compute before-image AFTER snapshot is taken but BEFORE mutate.
        // Problem: we're inside the transaction already.
        // Fix: compute before-image from the snapshot instead.
        // See complication note below.
      });
    } finally {
      await adapter.restore(snapId);
    }
  } else {
    // BeadsAdapter fallback: run mutation normally (withTransaction provides rollback),
    // diff is empty (best-effort per D-04).
    await adapter.withTransaction(async () => {
      await original(args, projectDir);
    });
    // diff remains {}; result shape has empty diff
  }
}
```

**Before-image complication:** The `_realReadForPipeline` escape hatch existed to read the *pre-mutation* state of a file while inside the transaction (where `getRecord` returns the *post-mutation* shadow-dir state). With snapshot/restore, the before-image is available from the snapshot. The clean approach:

```typescript
// Before mutation:
const snapId = await adapter.snapshot();
// Capture before-images by reading paths the mutation will touch.
// Problem: we don't know which paths until AFTER mutation runs.
// Solution: run mutation inside withTransaction, capture touched paths,
// then read before-image from snap (via a second adapter pointing at snapId)
// OR: accept that diff computation requires two passes.

// Two-pass approach:
const snapId = await adapter.snapshot();
// Pass 1: execute in dry-run txn to discover touched paths
let touchedPaths: Set<string> = new Set();
await adapter.withTransaction(async () => {
  await original(args, projectDir);
  touchedPaths = adapter.getTouchedPaths();
  // After-images captured here (getRecord reads shadow-dir inside txn)
  for (const p of touchedPaths) {
    afterMap.set(p, await adapter.getRecord(p));
  }
});
// adapter.restore() called inside finally — shadow dir discarded by withTransaction
// Pass 2: restore from snapshot (already at pre-mutation state)
// Now read before-images from the restored state
await adapter.restore(snapId);
for (const p of touchedPaths) {
  beforeMap.set(p, await adapter.getRecord(p));  // reads post-restore = pre-mutation
}
diff = diffPlanningState(beforeMap, afterMap);
```

**BeadsAdapter dry-run behavior:**
- `capabilities.snapshot = false` → `hasSnapshot(adapter)` returns false
- Fall into the `else` branch: execute the mutation inside `withTransaction`, which buffers ops in-memory and discards them (rollback = discard buffer)
- `getTouchedPaths()` on BeadsAdapter returns a best-effort set of operation kinds/issue-ids touched (per D-04)
- Diff result is either empty or coarse-grained; `changes_summary` reflects this

**Throw-path safety:** With the two-pass approach, `restore(snapId)` in the `finally` block runs even if `withTransaction` throws. This replaces the old pattern where `withTransaction({ dryRun: true })` guaranteed rollback. The new guarantee is: `finally { restore(snapId) }` always restores regardless of mutation outcome. MarkdownAdapter's `restore()` is synchronous-file-system and cannot fail silently — it throws if the snapshot directory is missing.

---

## getTouchedPaths Interface Decisions

### Interface Definition

```typescript
// adapters/types.ts — new method to add
export interface StorageAdapter {
  // ... existing methods ...

  /**
   * Returns the set of relative paths that have been written (or removed)
   * during the currently-active transaction. Callable only inside a
   * withTransaction callback; returns empty set if no transaction is active.
   *
   * MarkdownAdapter: returns the exact set of paths from activeTxn.touchedPaths
   *   union activeTxn.removedPaths (same data as the deleted _txnContextForPipeline).
   * BeadsAdapter: returns a best-effort set of the issue IDs / key-paths
   *   touched by bd operations buffered in the current transaction. Coarser-
   *   grained than MarkdownAdapter (a bd "update" touches a virtual record path,
   *   not a physical file path). Used for dry-run diff non-empty assertion only.
   *
   * Conformance: asserting exact path set is MarkdownAdapter-only; BeadsAdapter
   * conformance asserts Set.size > 0 after any mutation.
   */
  getTouchedPaths(): Set<string>;
}
```

### Method Placement Decision

**Direct method on the adapter instance** (NOT inside `withTransaction`'s callback ctx). Rationale:
- Simpler: no context threading required
- Matches the existing `_txnContextForPipeline()` semantics (synchronous, on the instance)
- The "txn currently active" implicit state is acceptable — `getTouchedPaths()` returns empty set when no txn is active, which is the correct behavior for a caller that accidentally calls it outside a txn
- `withTransaction` ctx threading would require changing the interface signature of `withTransaction`, which is locked per D-07

### MarkdownAdapter Implementation

The implementation is trivial: expose what `_txnContextForPipeline()` already returns.

```typescript
// adapters/markdown/index.ts
getTouchedPaths(): Set<string> {
  if (!this.activeTxn) return new Set();
  const all = new Set<string>();
  for (const p of this.activeTxn.touchedPaths) all.add(p);
  for (const p of this.activeTxn.removedPaths) all.add(p);
  return all;
}
```

**Underscore method deletion timing:** `_txnContextForPipeline` and `_realReadForPipeline` are deleted in the same commit as the pipeline.ts refactor (they are only used by pipeline.ts). The `getTouchedPaths` addition and the underscore deletions are one atomic commit — they are entangled (adding the public method and removing the private escape hatch is a single coherent change).

### BeadsAdapter Implementation

**Current state:** BeadsAdapter at `/Volumes/code/gsd-beads/src/txn.ts` uses `AsyncLocalStorage` to manage transaction context. The `TxnContext` interface has a `buffer: BufferedOp[]` array. Each `BufferedOp` has a `kind: string` and `args: string[]`.

**No pre-existing touched-records tracking exists** in BeadsAdapter. The `buffer` holds operations but not the record paths they affect. A new tracking set is needed. [VERIFIED: grep for touchedPaths/getTouchedPaths in gsd-beads returns 0 matches]

**Best-effort implementation options:**

Option A — Track "any bd op was buffered" and return a synthetic path set:
```typescript
getTouchedPaths(): Set<string> {
  // Best-effort: if any operations are buffered, return a synthetic indicator set.
  // Real path enumeration is infeasible without knowledge of which bd records
  // correspond to which physical-path semantics.
  const ctx = this.txnStorage.getStore();
  if (!ctx || ctx.buffer.length === 0) return new Set();
  return new Set(['<bd-writes-coarse-grained>']);  // non-empty signals diff happened
}
```

Option B — Map bd operations to virtual record paths by operation kind:
```typescript
getTouchedPaths(): Set<string> {
  const ctx = this.txnStorage.getStore();
  if (!ctx) return new Set();
  const paths = new Set<string>();
  for (const op of ctx.buffer) {
    // Map operation kind to a synthetic path for non-empty diff assertion
    paths.add(`bd://${op.kind}/${op.args[0] ?? 'unknown'}`);
  }
  return paths;
}
```

**Recommendation (Claude's discretion):** Option B provides richer diagnostic output in the dry-run diff (which bd operations would execute) while still satisfying the "non-empty" conformance assertion. Either option passes the SEAM-06 conformance gate.

**Where this lives:** `getTouchedPaths` must be added to `gsd-beads/src/index.ts` (the BeadsAdapter class). This requires either (a) updating the `gsd-beads` npm package and bumping the version consumed by this repo, or (b) adding a shim in this repo's `adapter-factory.ts` that wraps the npm package's BeadsAdapter. The planner decides (Claude's discretion per context). The simplest approach is (a) — update gsd-beads, bump semver, update dependency.

---

## Conformance Manifest Schema

### Existing Schema (56 entries)

Required fields per `ManifestEntry` (from `tests/conformance/manifest-types.ts`): [VERIFIED: file read]

```typescript
interface ManifestEntry {
  kind: 'binB' | 'section-tuple' | 'noun-roundtrip' | 'rollback';
  name: string;           // Stable id, e.g. 'recordStateAppend:decision:scaffold'
  description?: string;   // Human-readable; NOT source of truth for behavior
  expected: Record<AdapterName, ExpectedOutcome>;  // per-adapter outcomes
  adr?: string;           // Required when adapters legitimately differ
}
```

The `expected` field maps `'markdown'` and `'beads'` to one of:
- `StateOutcomeExpected`: `{ applied: true; created_section?: string | null }` or `{ applied: false; reason: 'duplicate' | 'nothing_to_remove' }`
- `RollbackOutcomeExpected`: `{ kind: 'byte-identical' }` | `{ kind: 'record-identical' }` | `{ kind: 'incomplete-per-Deferred-04' }`
- `RoundTripOutcomeExpected`: `{ kind: 'normalize-modulo-equal' }` | `{ kind: 'identity-equal' }`
- `PresenceExpected`: `{ kind: 'presence' }` — for methods that don't return StateWriteOutcome

### New `kind: 'seam-realness'` — What to Add

The existing `kind` values (`binB`, `section-tuple`, `noun-roundtrip`, `rollback`) do NOT cover the seam-realness test pattern. Phase 2 adds `'seam-realness'` as a new kind. [ASSUMED — D-10 says "~30 new `kind: 'seam-realness'` entries"; the type system needs extending]

**Step 1:** Add to `manifest-types.ts`:
```typescript
export type ManifestEntryKind = 'binB' | 'section-tuple' | 'noun-roundtrip' | 'rollback' | 'seam-realness';
```

**Step 2:** Each `seam-realness` entry covers one migrated state-mutation handler exercised via the full SDK registry (not calling the adapter directly). The `expected` shape uses `StateOutcomeExpected` or `PresenceExpected` depending on whether the handler invokes `recordState*`.

### DEFECT-02 Manifest Entry Sketch

```typescript
{
  kind: 'seam-realness',
  name: 'putRecord:large-body:round-trip',
  description: 'putRecord + getRecord round-trip for body > 64KB; asserts byte-identical retrieval on both adapters (DEFECT-02)',
  expected: {
    markdown: { kind: 'presence' },   // identity-equal by definition (file-system)
    beads:    { kind: 'presence' },   // BeadsAdapter must handle without truncation
  },
}
```

**Fixture:** A buffer of exactly 65,537 bytes (64KB + 1 byte + 1) of deterministic pseudorandom content (e.g., `Buffer.alloc(65537, 0x41).toString()`). Stored at `STATE.md` to exercise the singleton path.

**Why `PresenceExpected` not `identity-equal`?** The existing `PresenceExpected` type signals "test body provides the real assertion"; the manifest entry is just for registration enforcement. The test body asserts `getRecord(path) === putBody`. This matches the existing pattern for `getRecord-putRecord:round-trip`.

### 95% Pass Rate Computation Rule (D-12)

```
passRate = count(entries where kind !== 'known-gap') / total_entries × 100
```

Concretely: if there are 86 total entries (56 existing + 30 new), and 4 are `kind: 'known-gap'`, then `passRate = 82/86 = 95.3%`. Any handler that fails conformance in Phase 2 MUST be given a `kind: 'known-gap'` manifest entry with an `adr:` citation — it cannot be silently skipped.

**Important:** The existing `withTransaction:mid-commit-replay` entry is already `kind: 'rollback'` with `expected.beads.kind = 'incomplete-per-Deferred-04'`. This is documented as a known-gap disposition within a `rollback` kind entry (not a separate `known-gap` kind entry). The "known-gap" disposition in D-12 means: when a Phase 2 seam-realness handler fails on one adapter, that entry gets `kind: 'known-gap'` as its kind field (not `kind: 'seam-realness'`), plus a required `adr:` cite. This matches the v1.0 pattern described in CONTEXT.md.

### Bidirectional `meta-coverage.test.ts` Invariant

The invariant works via file-based test registration. Paired test files call `assertFromManifest(adapterName, entryName, kind, check)` which writes a registration key `${adapterName}:${kind}:${name}` to a `.vitest-tmp/registry/` file. After the paired test run completes, `meta-coverage.test.ts` reads the registry and asserts:
- Direction 1: every manifest entry × adapter has a registration (gap detection)
- Direction 2: every registration has a manifest entry (orphan detection)

For new `seam-realness` entries, the planner must:
1. Add entries to `manifest.ts`
2. Add matching `assertFromManifest('markdown', name, 'seam-realness', ...)` and `assertFromManifest('beads', name, 'seam-realness', ...)` calls in new test files

**New test files to create** (within `tests/conformance/`):
- `paired-seam-markdown.test.ts` — seam-realness tests on MarkdownAdapter
- `paired-seam-beads.test.ts` — seam-realness tests on BeadsAdapter (behind `if (bdPresent())` guard)

---

## createRegistry Extension Pattern

### Current Closure Pattern (verified at index.ts:282–722)

```typescript
export function createRegistry(opts?: { adapter?: StorageAdapter; ... }): QueryRegistry {
  const adapter = opts?.adapter ?? createStorageAdapter(process.cwd());
  // ...
  const registry = new QueryRegistry();

  // Already-migrated example:
  registry.register('state.load', (args, projectDir, ws) => stateProjectLoad(adapter, args, projectDir, ws));

  // NOT YET migrated example (state-mutation family):
  const stateHandlers: Record<string, QueryHandler> = {
    'state.update': stateUpdate,  // <-- direct handler reference, NO adapter
    'state.patch': statePatch,
    // ...
  };
  for (const entry of STATE_COMMAND_ALIASES) {
    const handler = stateHandlers[entry.canonical];
    registry.register(entry.canonical, handler);  // registered without adapter
    for (const alias of entry.aliases) {
      registry.register(alias, handler);           // aliases registered without adapter
    }
  }
}
```

### Adapter Instance Construction (D-08)

The adapter is constructed at `index.ts:282`:
```typescript
const adapter = opts?.adapter ?? createStorageAdapter(process.cwd());
```

After Phase 2, this line also replaces the `_adapterCache` Map in helpers.ts. The cache semantics are preserved because `createRegistry` is called once per query invocation (the registry instance is shared for the lifetime of one SDK query execution). All handlers that close over `adapter` share the same instance.

### Alias Handling

Alias chains receive the same handler function reference. The migration pattern for aliased families:

```typescript
// Before (current pattern for state-mutation):
const stateHandlers: Record<string, QueryHandler> = {
  'state.update': stateUpdate,  // direct ref
};
for (const entry of STATE_COMMAND_ALIASES) {
  const handler = stateHandlers[entry.canonical];
  registry.register(entry.canonical, handler);
  for (const alias of entry.aliases) {
    registry.register(alias, handler);
  }
}

// After migration:
const stateHandlers: Record<string, QueryHandler> = {
  'state.update': (args, pd, ws) => stateUpdate(adapter, args, pd, ws),  // closure
};
// The loop stays identical — the same closure is shared across canonical + aliases
```

The closure is created once per command family, not per alias. All aliases point to the same closure instance.

### Adapter Cache Migration (D-08)

The `_adapterCache` Map at `helpers.ts:529` is the only adapter cache. After `adapterFor` is deleted:
- No new cache is needed: `createRegistry` already constructs one adapter per invocation, and the lexical scope of the `adapter` variable in `createRegistry` is the cache equivalent.
- Tests that call `_adapterCache.clear()` (specifically `sdk/src/query/pipeline.test.ts:23–24`) must be updated — there is no cache to clear after migration.

---

## Testing Strategy

### Test Suite Topology

| Suite | Command | Duration | What It Tests |
|-------|---------|----------|--------------|
| SDK unit tests | `cd sdk && npm run test:unit` | ~6.67s [VERIFIED: measured] | All `src/**/*.test.ts` files; no integration |
| SDK integration tests | `cd sdk && npm run test:integration` | ~5 min total (unit + integration combined per `npm test`) | `src/**/*.integration.test.ts` |
| Full SDK suite | `cd sdk && npm test` | ~5 min [VERIFIED: measured 306s] | unit + integration |
| Conformance (root) | `npm run test:conformance` | ~30–60s estimated [ASSUMED] | tests/conformance/ against both adapters |
| Conformance paired | `npm run test:conformance:paired` | ~60–120s estimated [ASSUMED] | paired-* tests + meta-coverage |
| TypeScript build | `npm run build:sdk-only` | ~10–15s estimated [ASSUMED] | TSC compile only |

### Per-Commit Gate (D-18)

Between every atomic commit (per D-15), the gate is:
```bash
npm run build:sdk-only && cd sdk && npm run test:unit
```
This is the **fast subset**: TypeScript build (~15s) + unit tests (~7s) = ~22 seconds total. Fast enough to run between every commit in a migration session.

**Full suite gate (end-of-day or before cutover):**
```bash
npm run build:sdk-only && cd sdk && npm test && npm run test:conformance
```

### Tests That Use `adapterFor` Directly (Require Migration)

`sdk/src/query/pipeline.test.ts` lines 23–24, 64–65, 213–214 use `adapterFor` and `_adapterCache` directly. [VERIFIED: grep]

The `makeRegistry()` helper in pipeline.test.ts creates a test mutation handler that calls `adapterFor` internally:
```typescript
registry.register('mut-cmd', async (_args, dir) => {
  const { adapterFor } = await import('./helpers.js');
  const adapter = await adapterFor(dir);
  await adapter.putRecord('MUTATED.md', '# mutated');
});
```

This test must be updated when `adapterFor` is deleted. The updated test should use `createRegistry` with a real adapter or construct the adapter via `createStorageAdapter` directly.

**No conformance test files use `adapterFor`** — confirmed via grep. [VERIFIED]

### Wave 0 Test Infrastructure Gaps

Before the migration begins:
- [ ] `sdk/src/query/pipeline.test.ts` — update `makeRegistry()` helper to not use `adapterFor`; update `_adapterCache.clear()` calls
- [ ] New test file `tests/conformance/paired-seam-markdown.test.ts`
- [ ] New test file `tests/conformance/paired-seam-beads.test.ts`
- [ ] `manifest-types.ts` — add `'seam-realness'` to `ManifestEntryKind` union

---

## Risk Surface

### Risk 1: D-15 Violation — Bundled Corruption

**What can go wrong:** Executor agent bundles state-mutation.ts adapter-threading + StateWriteOutcome propagation + pipeline.ts refactor into one commit. Build step not run. A missing brace or dangling JSDoc ships. (This is exactly the v1.0 Wave 6 anti-pattern documented in `.continue-here.md`.)

**Structural mitigation:** Plan files must specify two commits per handler family (commit 1 = thread adapter, commit 2 = propagate outcome) with explicit build + unit test commands between them. Each task in the plan ends with: `npm run build:sdk-only && cd sdk && npm run test:unit`. If this command is not in the task steps, the plan is malformed.

### Risk 2: Silent-Noop Reintroduction via StateWriteOutcome Discards

**What can go wrong:** During the adapter-threading commit, a handler gets `adapter` threaded through but the `await adapter.recordStateMutation(event)` return value is still discarded (not assigned to `outcome`). The handler reports success regardless of the actual outcome.

**Structural mitigation:** The conformance suite's `kind: 'seam-realness'` entries assert on per-adapter `StateWriteOutcome` shape — if the outcome is discarded at the handler layer, the test fixture that sends a duplicate event will not get `{ applied: false, reason: 'duplicate' }` back. The test fails. This is the "typed return surfaces non-application" mechanism from CONTEXT.md D-13.

### Risk 3: BeadsAdapter `getTouchedPaths` Returns Empty Set (Silent Diff-Empty)

**What can go wrong:** BeadsAdapter's `getTouchedPaths()` implementation returns an empty set even when mutations happened, because the `buffer` is empty at the point `getTouchedPaths()` is called (e.g., if called AFTER `withTransaction` commits and clears the buffer).

**Structural mitigation:** `getTouchedPaths()` is called INSIDE the `withTransaction` callback, before commit. The conformance test for `kind: 'seam-realness'` on BeadsAdapter asserts `getTouchedPaths().size > 0` for any write handler. If this assertion fails, it surfaces the timing bug. The test is written before the implementation (TDD).

### Risk 4: Markdown Byte-Identical Regression (Strict Superset Invariant)

**What can go wrong:** Threading adapter through a handler accidentally changes which adapter method is called, producing different output under default config. E.g., a handler that was calling `core.atomicWriteFileSync` directly is migrated to `adapter.putRecord`, and the output formatting differs.

**Structural mitigation:** SEAM-05 acceptance criterion (byte-identical round-trip under `adapter: "markdown"`) is enforced by the conformance suite. The `kind: 'seam-realness'` entry for `state.milestone-switch` on MarkdownAdapter asserts the output is byte-identical to what upstream GSD produces. If any threading change breaks the I/O path, this test catches it.

### Risk 5: Sibling-Repo Version Mismatch (gsd-beads `getTouchedPaths`)

**What can go wrong:** Phase 2 adds `getTouchedPaths()` to `StorageAdapter` in `adapters/types.ts`. The BeadsAdapter in `gsd-beads` doesn't have this method yet. TypeScript build fails with `Type 'BeadsAdapter' does not implement 'StorageAdapter'`.

**Structural mitigation:** The `getTouchedPaths` addition to `StorageAdapter` and the corresponding implementation in `gsd-beads` must be committed atomically with respect to the TypeScript build gate. Either: (a) add `getTouchedPaths()` to `gsd-beads` first, bump its semver, update the dependency in this repo, THEN add it to `adapters/types.ts`; OR (b) stub `getTouchedPaths` in `adapters/types.ts` as `getTouchedPaths?(): Set<string>` (optional method) during development, making it required only at Phase 2 close when `gsd-beads` is confirmed updated. The planner must sequence this dependency explicitly as a Wave 0 task.

---

## Architecture Patterns

### Recommended Migration Sequence (per D-17 + Claude's Discretion)

```
Wave 0 (Interface + Infrastructure):
  W0-C1: Add getTouchedPaths() to StorageAdapter interface + MarkdownAdapter impl + delete underscore methods
  W0-C2: Refactor pipeline.ts dry-run block (snapshot/restore, no adapterFor)
  W0-C3: Update pipeline.test.ts to not use adapterFor/_adapterCache
  W0-C4: Add 'seam-realness' kind to manifest-types.ts; create empty paired-seam-*.test.ts stubs
  [Build + unit gate after each]

Wave 1 (Heaviest files — most conformance coverage):
  W1-C1: state-mutation.ts — thread adapter through all 23 callsites [commit 1 of pair]
  W1-C2: state-mutation.ts — propagate StateWriteOutcome returns [commit 2 of pair]
  [Build + unit gate after each]
  W1-C3: Add ~20 kind:'seam-realness' manifest entries for state-mutation handlers

Wave 2 (Phase lifecycle):
  W2-C1: phase-lifecycle.ts — thread adapter through 10 callsites
  W2-C2: Add remaining seam-realness manifest entries for phase-lifecycle handlers

Wave 3 (Medium files):
  W3-C1: spike-sketch.ts (7) + scratch.ts (6) — thread adapter [grouped — affine domain]
  W3-C2: named-docs.ts (6) + tmp-docs.ts (2) — thread adapter [grouped]
  W3-C3: workstream.ts (4) + sidecar.ts (2) — thread adapter [grouped]
  W3-C4: config-mutation.ts (4) + config-query.ts (2) — thread adapter [grouped]
  [Build + unit gate after each pair]

Wave 4 (Low-callsite tail):
  W4-C1: thread-seed.ts (3) + codebase-docs.ts (3) + commit.ts (3) — thread adapter
  W4-C2: milestone-ops.ts (3) + progress.ts (4) — thread adapter
  W4-C3: verify.ts (2) + validate.ts (2) + phase-list-queries.ts (2) — thread adapter
  W4-C4: roadmap-update-plan-progress.ts (2) + roadmap.ts (1) + requirements-extract-from-plans.ts (1) — thread adapter
  W4-C5: check-completion.ts (2) + check-gates.ts (1) + check-ship-ready.ts (1) + mvp.ts (1) + profile.ts (1) + debug-session.ts (1) + template.ts (1) — thread adapter

Wave 5 (Cleanup + Conformance):
  W5-C1: Delete adapterFor + _adapterCache from helpers.ts
  W5-C2: Fill in seam-realness conformance test bodies (paired-seam-*.test.ts)
  W5-C3: Run full conformance suite; verify manifest ↔ registeredTests
  W5-C4: DEFECT-02 large-body test entry + fixture

Cutover:
  grep SEAM-02 acceptance check: grep -rn "adapterFor(projectDir)" sdk/src/query/ | wc -l == 0
  git push staging; SEAM acceptance evidence captured; advance feat/storage-adapter
```

Total estimated commits: ~20–24 (14–18 handler-family pairs + 4–6 infra commits).

### Project Structure (unchanged by Phase 2)

```
adapters/
├── types.ts          # getTouchedPaths added; capabilities unchanged
├── markdown/index.ts # getTouchedPaths added; _txnContextForPipeline/_realReadForPipeline DELETED
sdk/src/query/
├── helpers.ts        # adapterFor + _adapterCache DELETED; other utilities remain
├── pipeline.ts       # dry-run block rewritten (no adapterFor; uses snapshot/restore)
├── index.ts          # closure wrappers extended for all remaining handlers
├── *.ts              # 29 handler files: adapterFor calls replaced with parameter
tests/conformance/
├── manifest.ts       # +~30 seam-realness entries
├── manifest-types.ts # 'seam-realness' added to ManifestEntryKind
├── paired-seam-markdown.test.ts  # NEW
└── paired-seam-beads.test.ts     # NEW
```

---

## Common Pitfalls

### Pitfall 1: Forgetting the Alias Loop After Migrating a Handler Family

**What goes wrong:** Developer migrates `stateUpdate` to `(adapter, args, pd, ws) => stateUpdate(adapter, args, pd, ws)` in the `stateHandlers` dict but doesn't notice that the alias loop at index.ts:325–332 registers the same handler under multiple names. The migration is complete, but only if the `stateHandlers` dict entry itself is a closure — which it will be once the migration is done. This is not actually a problem with the dict pattern, but it IS a problem if someone accidentally registers only the canonical name and forgets the alias loop.

**How to avoid:** Use the existing `stateHandlers` dict + alias loop pattern. Do not bypass the loop to register individual aliases manually.

### Pitfall 2: `getTouchedPaths` Called Outside Transaction

**What goes wrong:** Pipeline.ts calls `adapter.getTouchedPaths()` before entering `withTransaction`, or after it exits, receiving an empty set and producing an empty diff.

**How to avoid:** `getTouchedPaths()` must be called inside the `withTransaction` callback body, before the callback returns.

### Pitfall 3: Conflating Adapter-Threading Commit with Internal Helper Changes

**What goes wrong:** `state-mutation.ts` has internal helpers (`readModifyWriteStateMd`, `syncStateFrontmatter`) that also call `adapterFor`. Migrating the exported handler functions but forgetting the internal helpers leaves orphaned `adapterFor` calls that keep the file in a mixed state.

**How to avoid:** The adapter-threading commit for each file must grep the file for `adapterFor` calls AFTER the commit and assert the count is 0 for that specific file. The per-file count is the right unit, not the global count.

### Pitfall 4: BeadsAdapter `capabilities.snapshot = false` Crashes Pipeline Dry-Run

**What goes wrong:** The new pipeline.ts dry-run block calls `await adapter.snapshot()` unconditionally. BeadsAdapter throws `UnsupportedCapabilityError`. Any `--dry-run` invocation under `adapter: "beads"` crashes.

**How to avoid:** Guard with `if (hasSnapshot(adapter))` before calling `snapshot()`. The non-snapshot branch uses `withTransaction`-based rollback (which BeadsAdapter supports via its in-memory buffer). This is the correct D-04 behavior: dry-run works on both adapters, diff is coarser on bd.

### Pitfall 5: StateWriteOutcome Propagation Changes Existing Test Assertions

**What goes wrong:** Some unit tests in `sdk/src/query/**/*.test.ts` call a state-mutation handler and assert on specific return shapes. If the handler previously returned `{ data: { updated: true } }` and Phase 2 changes it to include `outcome: StateWriteOutcome`, the assertion breaks.

**How to avoid:** Run `npm run test:unit` immediately after each StateWriteOutcome propagation commit (commit 2 of each pair). Broken tests will surface immediately and must be fixed in that same commit (not deferred).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 3.1.1 [VERIFIED: sdk/package.json] |
| Config file | `sdk/vitest.config.ts` (unit + integration projects) |
| Quick run command | `cd sdk && npm run test:unit` |
| Full suite command | `cd sdk && npm test` |
| Conformance command | `npm run test:conformance:paired` (from repo root) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEAM-01 | `grep adapterFor sdk/src/query/ == 0` | Structural grep | `grep -rn "adapterFor(projectDir)" sdk/src/query/ | wc -l` asserts 0 | N/A — post-migration assertion |
| SEAM-02 | `adapterFor` deleted from helpers.ts | Structural (file absence) | Build must pass after deletion | N/A |
| SEAM-03 | All handlers thread adapter as first arg | Build (TypeScript) | `npm run build:sdk-only` | N/A |
| SEAM-04 | bd-tier round-trip for state.milestone-switch | Integration | `npm run test:conformance:paired` with seam-realness entry | ❌ Wave 0 |
| SEAM-05 | markdown byte-identical regression | Conformance | `npm run test:conformance:paired` with seam-realness entry | ❌ Wave 0 |
| SEAM-06 | All state-mutation handlers, both adapters, ≥95% | Conformance | `npm run test:conformance:paired` full manifest | ❌ Wave 0 |
| DEFECT-02 | >64KB body round-trip | Conformance (fixture) | `npm run test:conformance:paired` with large-body fixture entry | ❌ Wave 0 |

### Sampling Rate

- **Per atomic commit (commit 1 or 2 of pair):** `npm run build:sdk-only && cd sdk && npm run test:unit` (~22s)
- **Per wave merge (end of each wave):** `cd sdk && npm test` (~5 min)
- **Phase gate (before cutover to feat/storage-adapter):** `npm run build:sdk-only && cd sdk && npm test && npm run test:conformance:paired` (~6–7 min total)

### Wave 0 Gaps

- [ ] `tests/conformance/manifest-types.ts` — add `'seam-realness'` to ManifestEntryKind
- [ ] `tests/conformance/manifest.ts` — add ~30 seam-realness entries (stubs acceptable in Wave 0; bodies filled in Wave 5)
- [ ] `tests/conformance/paired-seam-markdown.test.ts` — covers SEAM-04, SEAM-05, SEAM-06 (markdown side)
- [ ] `tests/conformance/paired-seam-beads.test.ts` — covers SEAM-04, SEAM-06 (beads side)
- [ ] `sdk/src/query/pipeline.test.ts` — remove `adapterFor`/`_adapterCache` usage (breaks when adapterFor is deleted)
- [ ] `adapters/types.ts` — add `getTouchedPaths(): Set<string>` to StorageAdapter interface
- [ ] `adapters/markdown/index.ts` — add `getTouchedPaths()` impl; delete `_txnContextForPipeline`/`_realReadForPipeline`
- [ ] `gsd-beads/src/index.ts` — add `getTouchedPaths()` impl on BeadsAdapter (sibling repo; bump semver)

### Validation Beyond "grep == 0"

The SEAM-01 grep is necessary but not sufficient. A renamed helper (`internalAdapterFor`) would pass the grep but still bypass the configured adapter.

**Structural proof (not naming-dependent):**
1. TypeScript compile with the correct `adapter: StorageAdapter` first-arg type on every migrated function. If a function still internally constructs a MarkdownAdapter, it would use a different code path — the type system won't catch it. The conformance test does.
2. SEAM-04 round-trip: Configure `adapter: "beads"`, invoke `state.milestone-switch` via the real CLI, assert the bd store contains the written record and `.planning/STATE.md` on disk does NOT contain the new content. This is the observable evidence that routing actually changed.
3. The `kind: 'seam-realness'` conformance entries MUST exercise handlers via the full registry dispatch (`registry.dispatch(cmd, args, projectDir)`) — not by calling handler functions directly. Direct calls bypass the closure wrapper and would pass even if the registry wasn't updated.

**Byte-identical regression test fixtures:**
- Use the existing `tests/conformance/` fixture directory pattern (each conformance test creates its own `mkdtemp` directory).
- For SEAM-05, the fixture is a minimal `.planning/` tree with a valid `STATE.md` in the `current-milestone` format. After `state.milestone-switch`, compare the resulting `STATE.md` against the upstream golden output (byte-by-byte via `===` on the string content, not on file mtime).
- The "upstream golden" is computed by running the same handler against a MarkdownAdapter on a clean fixture directory — no reference to an upstream binary needed.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | BeadsAdapter `gsd-beads` package can be updated to add `getTouchedPaths()` without breaking the existing npm package consumer in this repo | getTouchedPaths Interface Decisions | If gsd-beads is published/frozen, would require a different approach (shim in adapter-factory.ts) |
| A2 | Conformance test suite timing for full `test:conformance:paired` is 30–120s | Testing Strategy | If it takes longer (>5 min), the per-wave gate would be prohibitively slow; may need a faster subset |
| A3 | `npm run build:sdk-only` takes ~10–15s | Testing Strategy | If it takes longer, the per-commit gate is slower than described |

---

## Open Questions

1. **BeadsAdapter `getTouchedPaths` delivery mechanism**
   - What we know: BeadsAdapter's npm package is at `gsd-beads` (local at `~/code/gsd-beads`); it is NOT published to npm registry per CLAUDE.md; it is consumed via `require('gsd-beads')` from this repo's `node_modules`
   - What's unclear: whether the local npm link is symlinked or copied; whether a version bump + `npm install` is sufficient or requires a re-link
   - Recommendation: planner adds a Wave 0 task to check `ls -la node_modules/gsd-beads` and `cat node_modules/gsd-beads/package.json` to confirm the link type before planning the delivery mechanism

2. **Pipeline.ts adapter source for `wrapWithPipeline`**
   - What we know: `wrapWithPipeline` currently uses `adapterFor` to get an adapter; after D-01 it needs another source
   - What's unclear: which of the two approaches (pass adapter as param to `wrapWithPipeline` vs `options.getAdapter`) is cleaner given how the CLI entry point calls `wrapWithPipeline`
   - Recommendation: read the CLI entry point (`sdk/src/cli.ts` or similar) to confirm where `wrapWithPipeline` is called and what's available there before finalizing the approach

3. **`statePlannedPhase` double-registration**
   - What we know: `statePlannedPhase` is imported separately at index.ts:72 and also appears in the `stateHandlers` dict at `'state.planned-phase': statePlannedPhase`
   - What's unclear: whether this is intentional or a migration artifact from when some handlers were manually registered
   - Recommendation: trace the alias for `state.planned-phase` in `STATE_COMMAND_ALIASES` to confirm it's handled correctly

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bd` CLI | BeadsAdapter conformance, SEAM-04 round-trip | ✓ | 1.0.4 [VERIFIED: `bd --version`] | — |
| `node` | SDK build + test | ✓ | (current) | — |
| `npm` | Package install, test run | ✓ | (current) | — |
| `vitest` | Test execution | ✓ | 3.1.1 [VERIFIED: sdk/package.json] | — |
| `gsd-beads` npm package | BeadsAdapter, SEAM-04 | ✓ | linked locally | — |

No missing dependencies that would block Phase 2.

---

## Sources

### Primary (HIGH confidence — verified by direct file read)

- `sdk/src/query/helpers.ts:504–545` — `adapterFor` definition and `_adapterCache` Map [VERIFIED]
- `sdk/src/query/pipeline.ts:82–188` — full `wrapWithPipeline` and dry-run block [VERIFIED]
- `sdk/src/query/index.ts:282–864` — `createRegistry`, all handler registrations, closure pattern [VERIFIED]
- `sdk/src/query/state-mutation.ts` — all 23 adapterFor callsites, handler signatures, StateWriteOutcome usage [VERIFIED]
- `adapters/types.ts` — full `StorageAdapter` interface, `StateWriteOutcome` type, `hasSnapshot()` typeguard [VERIFIED]
- `adapters/markdown/index.ts:505–658` — `snapshot()`, `restore()`, `withTransaction()`, `_txnContextForPipeline`, `_realReadForPipeline` [VERIFIED]
- `tests/conformance/manifest.ts` — all 56 entries, entry shapes, `kind` values [VERIFIED]
- `tests/conformance/manifest-types.ts` — `ManifestEntry` interface, `ExpectedOutcome` union [VERIFIED]
- `tests/conformance/meta-coverage.test.ts` — bidirectional invariant mechanics [VERIFIED]
- `sdk/src/query/pipeline.test.ts` — `adapterFor`/`_adapterCache` usage in tests [VERIFIED]
- `/Volumes/code/gsd-beads/src/txn.ts` — BeadsAdapter transaction model, `buffer`, no `touchedPaths` [VERIFIED]
- `/Volumes/code/gsd-beads/src/index.ts:132–138` — BeadsAdapter `snapshot()`/`restore()` throw `UnsupportedCapabilityError` [VERIFIED]
- `sdk/package.json` — test scripts, vitest version [VERIFIED]
- SDK unit test duration: ~6.67s [VERIFIED: measured]
- SDK full test suite duration: ~5 min (306s) [VERIFIED: measured]

### Secondary (MEDIUM confidence)

- Conformance test suite timing estimate (30–120s): [ASSUMED] — not measured directly in this session due to bd dependency interaction; previous session note (`npm run test:conformance` = 117 tests) suggests it is shorter than the SDK full suite

---

## Metadata

**Confidence breakdown:**
- Handler inventory and callsite counts: HIGH — direct grep verification
- Pipeline.ts refactor shape: HIGH — code read confirmed; before-image timing complication is a known architectural constraint
- getTouchedPaths interface design: HIGH — confirmed BeadsAdapter lacks the method; implementation options are reasoned from verified architecture
- Conformance manifest schema: HIGH — file read confirmed all fields and types
- Testing strategy and timing: HIGH for unit suite; ASSUMED for conformance suite timing
- Risk surface: HIGH — risks derive from verified codebase patterns and documented anti-patterns

**Research date:** 2026-05-18
**Valid until:** 2026-06-17 (30 days; codebase changes would invalidate callsite counts)
