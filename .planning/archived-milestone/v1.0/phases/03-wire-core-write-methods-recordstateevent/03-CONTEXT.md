# Phase 3: Wire core write methods + recordStateEvent — Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 ships the **write-side migration**: every SDK write handler in
`sdk/src/query/state-mutation.ts` (18 handlers) and
`sdk/src/query/phase-lifecycle.ts` (13 handlers) routes writes through
the adapter instead of direct `node:fs` / `writeFile` / `mkdirSync`.

Phase 3 owns:
- Collapsing 10+ ad-hoc state-mutation handlers into 3 event-family
  methods (`recordStateAppend`, `recordStateMutation`, `recordStateSignal`)
  with discriminated-union payloads
- Migrating `phase-lifecycle.ts` handlers to call shared SDK helper
  functions that compose Bin A adapter primitives
- Implementing `withTransaction(fn)` in MarkdownAdapter (wraps existing
  PID-based lockfile mechanism)
- Making `commitPlanningState` a required adapter method (removed from
  capabilities enum) with checkpoint/snapshot semantics
- Resolving OQ-01 (commitPlanningState semantics across adapters)
- Extending `scripts/leak-grep.cjs` with SDK write-side patterns
  (`writeFileSync`, `mkdirSync`, `unlinkSync`, `appendFileSync` against
  `.planning/` paths)

Phase 3 **does not**:
- Modify CJS files — permanent D-02 (Phase 1)
- Plug workflow leaks (Read/Write/Edit tool calls) — Phase 4
- Implement foundational primitives beyond `withTransaction`
  (`snapshot/restore`, `putNamedDoc`, `getNamedDoc`, `writeBinaryAsset`) — Phase 5
- Implement `getSection`/`updateSection` semantic upgrades — Phase 5
- Touch BeadsAdapter — Phase 6

</domain>

<decisions>
## Implementation Decisions

### recordStateEvent design (3 event families by mutation semantics)

- **D-01 (Family structure):** State events are split into 3 adapter
  methods grouped by mutation semantics, optimized for clean mapping to
  BeadsAdapter's bd primitives:

  1. **`recordStateAppend(event)`** — append-only events that add entries
     to STATE.md sections. Types: `roadmap_evolution`, `decision`,
     `metric`, `session`, `forensic_session`, `quick_task`.
     BeadsAdapter maps to: typed comment/sub-record append.

  2. **`recordStateMutation(event)`** — list add/remove events that modify
     existing lists. Types: `blocker_added`, `blocker_resolved`,
     `todo_count_update`, `deferred_items`.
     BeadsAdapter maps to: sub-record list update (add/remove entry).

  3. **`recordStateSignal(event)`** — stateless flags and control signals.
     Types: `waiting`, `resume`, `milestone_switch`.
     BeadsAdapter maps to: sidecar record write/delete (WAITING.json) or
     metadata field update.

- **D-02 (Discriminated union per family):** Each family has its own
  TypeScript discriminated union with `type` + `payload`. Payload shapes
  are per-type (e.g., `DecisionPayload`, `MetricPayload`). Narrower
  unions per family give tighter type safety than one 13+ variant union.

- **D-03 (Non-event state handlers stay separate):** `stateUpdate`,
  `statePatch`, `stateBeginPhase`, `stateAdvancePlan`, `statePlannedPhase`,
  `stateUpdateProgress`, `stateValidate`, `stateSync`, `statePrune` are
  NOT events — they are field updates or maintenance operations. They
  migrate to adapter calls (`updateFrontmatter`, `mergeFrontmatter`,
  `updateSection`, etc.) but do NOT route through `recordState*`. The
  event families cover only the append/mutate/signal subset.

### Bin B write method surface (hybrid layered)

- **D-04 (Adapter interface stays thin):** The `StorageAdapter` public
  interface gains only the 3 `recordState*` event methods +
  `withTransaction` implementation + `commitPlanningState` as required.
  No `addPhase`, `completePhaseAndCascade`, or other domain-specific
  methods on the interface. Total adapter write surface: Bin A
  (`putRecord`, `removeRecord`, `updateSection`, `updateFrontmatter`,
  `mergeFrontmatter`) + 3 event methods + `withTransaction` +
  `commitPlanningState`.

- **D-05 (Shared SDK helper layer):** ~30 mid-level helper functions
  live in a shared SDK module (e.g., `sdk/src/query/phase-helpers.ts` or
  similar). These compose Bin A adapter primitives for reusable patterns:
  `scaffoldPhaseDir`, `insertRoadmapPhase`, `renumberPhases`,
  `scanNextPhaseNumber`, `updateRoadmapProgress`, etc. Handlers call
  helpers, not raw Bin A.

- **D-06 (Handler shape after migration):** `phase-lifecycle.ts` handlers
  (~13) become orchestrators at ~600 LOC total: validation + helper
  composition + result formatting. Domain logic (slug generation, decimal
  math, depends-on cascades) lives in SDK helpers, not adapter impl.
  BeadsAdapter only implements Bin A primitives — never needs to understand
  GSD phase semantics.

### readModifyWrite migration (withTransaction)

- **D-07 (Implement `withTransaction(fn)` now):** The Phase-1-declared
  `withTransaction` primitive is implemented in Phase 3. It's already in
  `adapters/types.ts` (line 57) as capability-gated. Phase 3 implements
  it in MarkdownAdapter and enables the capability flag.

- **D-08 (MarkdownAdapter implementation):** `withTransaction` wraps the
  existing `acquireStateLock`/`releaseStateLock` mechanism (PID-based
  lockfile with stale-lock cleanup, 10-retry backoff). Implementation is
  ~50 LOC: acquire lock → execute fn → release lock (try/finally).

- **D-09 (Caller pattern):** All 18 state-mutation handlers + 13
  phase-lifecycle handlers that currently use `readModifyWriteStateMd` /
  `readModifyWriteRoadmapMd` refactor to explicit transaction blocks:
  ```ts
  await adapter.withTransaction(async () => {
    const content = await adapter.getRecord('STATE.md');
    const modified = transform(content);
    await adapter.putRecord('STATE.md', modified);
  });
  ```
  Multi-file transactions (e.g., ROADMAP.md + phase dir + STATE.md in
  `completePhaseAndCascade`) compose naturally within one txn block.

- **D-10 (Non-markdown adapters):** `withTransaction` maps to native
  concurrency mechanisms: bd uses append-log ACID, sqlite uses
  BEGIN/COMMIT, postgres uses transactions. The primitive is universal.

### OQ-01: commitPlanningState semantics (resolved)

- **D-11 (Always checkpoint/snapshot):** Every adapter MUST implement
  `commitPlanningState` as a meaningful save point. No no-op allowed.
  - MarkdownAdapter: `git add` + `git commit` (current behavior)
  - BeadsAdapter: bead-hash bookmark (record current state hash as a
    named restore point; leverages bd's immutable content-addressed
    architecture)
  - Hypothetical SQLiteAdapter: WAL checkpoint + metadata row

- **D-12 (Required method — remove from capabilities):**
  `commitPlanningState` is removed from the `Capabilities` enum and
  becomes a required method on `StorageAdapter` (like `getRecord`,
  `putRecord`). All adapters must implement it. The `hasCommitPlanningState`
  type guard is removed. Call sites no longer need capability checks.

- **D-13 (Conformance test stub):** Phase 3 adds a conformance test stub
  in `tests/conformance/` asserting that after `commitPlanningState`,
  the adapter can identify the save point. Phase 7 fills in the full
  paired test with BeadsAdapter.

### Claude's Discretion

- Internal naming for the shared SDK helper module (`phase-helpers.ts`,
  `write-helpers.ts`, or split across existing files)
- Exact payload type names and field shapes for each event family member
- Whether `withTransaction` capability flag stays `transaction: boolean`
  or is renamed to reflect it's now partially implemented (Phase 3 = lock
  only; Phase 5 = lock + snapshot/restore for dry-run)
- Plan count and sequencing (likely 4-5 plans mirroring Phase 2's shape)
- Conformance test structure for the 3 event families
- Whether `readModifyWriteStateMd`/`readModifyWriteRoadmapMd` are removed
  entirely or kept as deprecated internal aliases during migration

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (gsd-phase-researcher, gsd-planner) MUST read these
before researching or planning.**

### Project-locked architecture

- `.planning/PROJECT.md` — Fork architecture, two-repo model, strict-superset
  invariant, branch strategy.
- `.planning/DECISIONS.md` — Locked decisions D-2026-04-30-01..10 + Phase 2
  ADR (stat extension). **Phase 3 appends ADRs for OQ-01 resolution and
  commitPlanningState promotion to required.**
- `.planning/STATE.md` — Current state; updates on Phase 3 context-gathered
  session.

### Prior phase outputs (locked, treat as carry-forward facts)

- `.planning/phases/01-fork-bootstrap-storageadapter-interface-skeleton-markdownada/01-CONTEXT.md`
  — Especially D-02 (CJS stays untouched), D-07 (createRegistry DI),
  D-08 (capabilities enum), D-10 (full v1.0 surface declared), D-11
  (type guards).
- `.planning/phases/02-wire-core-read-methods-to-adapter/02-CONTEXT.md`
  — Especially D-10 (explicit adapter first parameter), D-12 (CJS bridge
  replacement pattern), D-14 (per-line read-only discipline).

### Milestone scope

- `.planning/REQUIREMENTS.md` §"WRITES" — WRITES-01 (state-mutation
  collapse to event families), WRITES-02 (phase-lifecycle to helpers over
  Bin A), WRITES-03 (~58 Bin B helpers implemented), WRITES-04 (OQ-01
  resolution).
- `.planning/ROADMAP.md` §"Phase 3" — Goal, Depends on, Resolves OQ-01,
  4 Success Criteria.

### Architectural source-of-truth

- `.planning/research/fork-investigation/SYNTHESIS.md` — 6500 words.
  - **§4** — Adapter interface: Bin A primitives + foundational primitives.
    Phase 3 implements `withTransaction` + promotes `commitPlanningState`.
  - **§6 #1 (OQ-01)** — `commitPlanningState` semantics. **Resolved by
    D-11/D-12 above:** always checkpoint, required method.
  - **§7 Phase 3** — "Migrate `state-mutation.js` + `phase-lifecycle.js`
    to adapter writes; introduce the discriminated-union event record."
  - **§9** — Risk register (section semantics, dry-run hoist gate).

### Code surfaces Phase 3 touches

- **Adapter contract:**
  - `adapters/types.ts` — add 3 `recordState*` method signatures +
    payload union types; remove `commitPlanningState` from `Capabilities`;
    make `commitPlanningState` required; implement `withTransaction` cap.
  - `adapters/markdown/index.ts` — implement `withTransaction` (wrap
    lockfile), implement 3 `recordState*` dispatchers.
  - `tests/conformance/` — extend with write-side conformance tests.

- **SDK write surface:**
  - `sdk/src/query/state-mutation.ts` — refactor 18 handlers: 10 event
    handlers → call `adapter.recordState*`; 8 field/maintenance handlers
    → call `adapter.updateFrontmatter`/`updateSection`/etc. inside
    `withTransaction`.
  - `sdk/src/query/phase-lifecycle.ts` — refactor 13 handlers to call
    shared SDK helpers inside `withTransaction`.
  - New: `sdk/src/query/phase-helpers.ts` (or similar) — ~30 helper
    functions composing Bin A primitives.

- **Tooling:**
  - `scripts/leak-grep.cjs` — extend with SDK write-side patterns.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`acquireStateLock`/`releaseStateLock` (state-mutation.ts:179-225)**
  — PID-based lockfile with stale-lock cleanup and 10-retry backoff.
  Phase 3 wraps this inside `MarkdownAdapter.withTransaction`.

- **`readModifyWriteStateMd` (state-mutation.ts:262-288)** — The call
  pattern that all 18 state handlers use. Phase 3 replaces with explicit
  `withTransaction` + `getRecord` + `putRecord` blocks.

- **`readModifyWriteRoadmapMd` (phase-lifecycle.ts:164-179)** — Same
  pattern for ROADMAP.md. Phase 3 replaces with `withTransaction` +
  adapter calls.

- **`adapterFor(projectDir)` pattern** — Already used in both files for
  Phase 2 read-side routing. Phase 3 extends to write calls.

- **`scripts/leak-grep.cjs`** — Already covers read-side SDK patterns.
  Phase 3 extends with write-side patterns (`writeFileSync`,
  `mkdirSync`, `unlinkSync`, `appendFileSync`).

### Established Patterns

- **Handler signature:** `async function handler(args, projectDir)` with
  `opts.adapter` via registry closure. Phase 3 doesn't change the handler
  signature; adds `await adapter.withTransaction(...)` inside.

- **Type→section mapping in state-mutation.ts:** Each handler already
  knows which STATE.md section it appends to (e.g., `stateAddDecision` →
  `### Decisions`). Phase 3 hoists this map into the `recordStateAppend`
  dispatcher.

- **Phase 2's explicit adapter parameter:** `(adapter: StorageAdapter,
  ...rest)` for helpers. Phase 3's shared SDK helpers follow the same
  signature.

### Integration Points

- **`adapters/types.ts`** — Phase 3 modifies the interface: adds 3
  event method signatures, removes `commitPlanningState` from caps enum,
  adds event payload union types.

- **`tests/conformance/`** — Phase 3 extends with write-side paired
  tests (event roundtrips, transaction atomicity, commitPlanningState
  checkpoint verification).

- **`sdk/src/query/index.ts` registry** — Handler registrations stay;
  handlers internally route through adapter instead of direct fs.

</code_context>

<specifics>
## Specific Ideas

- User chose **3 event families by mutation semantics** over single
  monolithic union specifically because it maps cleanly to BeadsAdapter's
  bd primitives (append→comment, mutation→sub-record update,
  signal→sidecar). This is the primary design driver — backend
  portability to beads.

- User chose **withTransaction** over readModifyWrite convenience
  specifically for composability — multi-file transactions (ROADMAP +
  STATE + phase dir) compose naturally in one txn block. Aligns with
  Phase 5 dry-run primitive.

- User chose **always checkpoint/snapshot** for commitPlanningState and
  then promoted it to **required** (removed cap gate) — reflecting a
  philosophy that every storage backend must provide meaningful save
  points. bd's bead-hash architecture makes this nearly free (bookmark
  a hash reference).

- User chose **hybrid layered** for Bin B surface — domain logic in SDK
  helpers not adapter impl — reflecting the same instinct from Phase 1/2:
  adapters are storage, not workflow engines. BeadsAdapter never needs to
  understand slug generation or decimal-phase math.

</specifics>

<deferred>
## Deferred Ideas

- **Foundational primitives** (`snapshot/restore`, `putNamedDoc`,
  `getNamedDoc`, `writeBinaryAsset`) — Phase 5. `withTransaction` is the
  only foundational primitive implemented in Phase 3.

- **`getSection`/`updateSection` semantic upgrade** (append/overwrite/
  prepend modes, section-semantics matrix) — Phase 5 OQ-02.

- **Workflow leak plugging** (Read/Write/Edit tool calls against
  `.planning/`) — Phase 4 LEAKS-01..05.

- **`<context>`-block mitigation strategy** — Phase 4 LEAKS-02.

- **BeadsAdapter implementation** — Phase 6. Phase 3 designs the event
  families with beads mapping in mind but doesn't implement.

- **Conformance test full paired runs** (both adapters) — Phase 7. Phase
  3 adds MarkdownAdapter-only stubs.

- **Transaction nesting / savepoint semantics** — Not needed for v1.0.
  If a future workflow nests transactions, the adapter can flatten or
  reject. Document in ADR.

- **`stateValidate` / `stateSync` / `statePrune` migration** — These
  maintenance handlers may need special treatment (they read + rewrite
  entire STATE.md, not append to a section). Include in Phase 3 scope
  but flag as potentially complex.

</deferred>

---

*Phase: 03-wire-core-write-methods-recordstateevent*
*Context gathered: 2026-05-09*
