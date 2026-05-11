# Phase 6: BeadsAdapter implementation — Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 ships a complete `BeadsAdapter` implementation against the `bd`
CLI in a **fresh sibling repo at `~/code/gsd-beads`** (does not yet exist
on disk), targeting the primitive-lifted StorageAdapter interface locked
in Phases 1–5. The adapter satisfies Bin A primitives + foundational
primitives + the 3 `recordState*` event families + `StateWriteOutcome`
three-state contract; its declared `capabilities` match its actual impl
surface; and OQ-06 (knowledge-graph scope) is resolved via a layered
graph-edges pipeline.

Phase 6 also ships a small **fork-side artifact** (`./conformance`
subpath export in this repo's `package.json`) so the sibling repo can
import `runAdapterConformanceSuite` cleanly via
`get-shit-done/conformance`.

Phase 6 owns:
- Scaffolding `~/code/gsd-beads` from scratch (`npm init`; file-link to
  this fork via `"get-shit-done": "file:../get-shit-done"` in dev; `main`
  branch only — no v0.2 carry-forward except the spike findings).
- Implementing every Bin A + foundational primitive + the 3
  `recordState*` families against bd primitives, using the hybrid
  mapping shape (D-MAPPING below).
- Resolving OQ-06 via the layered-edges pipeline (D-OQ06 below).
- Spiking bd's store-clone + bead-hash bookmark primitives in Plan 06-01
  to confirm whether `withTransaction` can be implemented via the
  staging-store cutover (D-TXN Option B); if bd lacks those primitives,
  falling back to in-memory write-buffer (Option A) and flagging the
  sequential-commit gap as a Phase 6.1 follow-up.
- Declaring `capabilities.binaryAsset: false` (D-BINARY: skip-and-warn)
  and throwing `UnsupportedCapabilityError` when called directly.
- Implementing `BeadsAdapter.init()` with a typed `BdManagedMismatchError`
  (BEADS-04) that fails fast when the target dir is not bd-managed.
- Carrying forward the 13 spike findings, format module concept,
  `parsePhaseId` / `deriveDiskStatus` / `loadMilestoneHeading` helpers,
  JSONL roundtrip seed pattern, and blocks-edge sibling-dep modeling
  (spike 014) from the now-superseded v0.2 shadow work.
- Adding `./conformance` subpath export to this fork's `package.json` so
  the sibling can import `runAdapterConformanceSuite` from
  `get-shit-done/conformance` (smoke tests in Phase 6; full paired
  conformance in Phase 7).

Phase 6 **does not**:
- Modify the StorageAdapter contract surface — the interface is LOCKED
  post-Phase 5. If Phase 6 discovers a contract gap, surface it as an
  ADR proposal; do not mutate `adapters/types.ts` silently.
- Ship the adapter-name runtime resolver — that's Phase 8 DIST-01. Phase
  6 designs BeadsAdapter's package export shape to match whatever
  resolution pattern Phase 8 picks (`require("gsd-{name}")` is the
  working assumption; exact export shape is Claude's discretion).
- Ship the markdown→bd migration tool — Phase 8 DIST-02.
- Ship paired conformance tests against MarkdownAdapter — Phase 7
  CONFORM-01..04. Phase 6 ships sibling-side smoke tests only.
- Flip `capabilities.graph` to `true` on MarkdownAdapter or change
  MarkdownAdapter behavior for graph edges — D-OQ06 layering is
  additive on the BeadsAdapter side; MarkdownAdapter retains
  `graphify.cjs`-produced semantic edges only.
- Expand v1.0 scope to include a standalone `GraphAdapter` sub-interface
  — rejected in D-OQ06.

</domain>

<decisions>
## Implementation Decisions

### OQ-06: Knowledge-graph scope — layered edges, separate pipelines

- **D-OQ06 (Layered graph edges):** The `graphs/graph.json` edge schema
  extends to include `type: 'semantic' | 'dependency'` (additive, not
  replacing existing schema). Two separate pipelines feed it:
  - **Semantic edges** (existing pipeline, unchanged in Phase 6):
    `graphify.cjs` continues to produce fuzzy confidence-tiered semantic
    edges from `.planning/` markdown. On MarkdownAdapter: works as
    today. On BeadsAdapter: semantic edges are absent (graphify targets
    markdown only); this is documented but acceptable — the dependency
    edges below compensate with a different signal type.
  - **Dependency edges** (new, BeadsAdapter-native): BeadsAdapter
    exposes bd's `blocks` / `blocked-by` issue-graph edges as
    `{type: 'dependency', confidence: 1.0}` entries in
    `graphs/graph.json` via a small synthesizer. MarkdownAdapter emits
    zero `type: 'dependency'` edges (no native dep graph).
- **D-OQ06-CAPS (Fine-grained capability flag):** Adapter capabilities
  gain `graphEdges: { semantic: boolean; dependency: boolean }`
  (replaces the simpler `graph: boolean` sketched in SYNTHESIS §9).
  MarkdownAdapter: `{ semantic: true, dependency: false }`.
  BeadsAdapter: `{ semantic: false, dependency: true }`.
  This requires a small extension to the `Capabilities` interface in
  `adapters/types.ts` — the only Phase-6 change to the locked contract
  surface, and it is purely additive.
- **D-OQ06-CONSUMERS:** `gsd-phase-researcher` and `graphify.md` filter
  edges by type when they care. Both consumers already tolerate
  missing `graphs/graph.json` entirely (graceful-degradation exists
  today); adding type-aware filtering is a small uplift, not a rewrite.
  Deferred to Phase 8 (or surfaced as a follow-up plan inside Phase 6
  if the planner judges it in-scope).
- **D-OQ06-DEFERRED (bd-sourced semantic edges):** Running `graphify.cjs`
  against bd as a data source (so semantic edges also exist on
  BeadsAdapter) is deferred to post-v1.0 or to Phase 8. In v1.0,
  BeadsAdapter users get dependency edges only, which is a different
  but arguably more reliable signal.

### bd-native mapping shape — hybrid

- **D-MAPPING (Hybrid L2 sub-records + L3/L4 anchor-comments):** Each
  `.planning/*.md` file maps to ONE bd issue. L2 section content
  (`## Foo`) maps to bd sub-records keyed by section name
  (native mutable JSON fields — `updateSection` mode `overwrite`/`append`/
  `prepend` becomes a JSON array/value op). L3 and L4 nested content
  (`### Evidence`, `#### Sub-point`) maps to anchor-tagged comments on
  the issue with labels like `gsd:section:### Evidence` or
  `gsd:section:### Evidence:#### Sub-point` (anchor-path concatenation
  for nesting). `getRecord(path)` composes sub-records + comments back
  into the rendered markdown body via the format module.
- **D-MAPPING-SCHEMA (Authored per canonical file):** L2 sub-record
  schemas are EXPLICITLY AUTHORED in BeadsAdapter's `format` module —
  one schema per canonical file (STATE.md, ROADMAP.md, PROJECT.md,
  REQUIREMENTS.md, DECISIONS.md, AI-SPEC.md, SPEC.md, UAT.md,
  VERIFICATION.md, debug-session docs, PLAN.md, CONTEXT.md, etc.).
  Schemas are TypeScript types with sub-record keys matching L2
  heading text (e.g., STATE.md → `{ decisions: DecisionEntry[],
  blockers: BlockerEntry[], metrics: MetricEntry[], ... }`). Derived
  schemas are NOT used — drift is caught at sync time by schema
  validation, not masked by auto-derivation.
- **D-MAPPING-EVENTS:** The 3 recordState* event families map as:
  - `recordStateAppend` → push to the target L2 sub-record array
    (discriminant-field dedupe for `applied: false, reason:
    'duplicate'`; scaffold sub-record key if absent for
    `applied: true, created_section: '...'`).
  - `recordStateMutation` → add-or-remove from the target L2 sub-record
    array by discriminant. `applied: false, reason: 'nothing_to_remove'`
    when the target entry isn't present.
  - `recordStateSignal` → bd metadata field or tiny marker-issue with
    `gsd:signal:<type>` label. `applied: false, reason:
    'nothing_to_remove'` on `resume` when no WAITING marker exists.
- **D-MAPPING-ROUNDTRIP (Phase 7 equivalence):** Phase 7 CONFORM-02
  asserts `putRecord(x); getRecord(...) === x` modulo (a) L2
  sub-record array order (conformance harness sorts both sides before
  assert — the format module is the source of truth for canonical
  order); (b) whitespace normalization (trailing newline, heading
  depth). The format module is the single authority for
  markdown ↔ sub-record bidirectional transform.

### withTransaction + snapshot/restore — spike then fallback

- **D-TXN-SPIKE (Plan 06-01 validates primitives):** Plan 06-01 spikes
  bd's store-clone + bead-hash bookmark primitives (does bd expose a
  way to create a staging store and atomically point a named bookmark
  at its root hash?). Spike outcome gates the implementation path:
  - **Outcome: primitives available** → ship Option B (staging bd
    store + bead-hash bookmark cutover):
    - `withTransaction` entry creates a staging bd store at a
      derived path; all mutating adapter calls redirect to staging;
      reads merge staging-over-real so callers see own-writes;
      commit = atomic bead-hash bookmark swap of the project's
      canonical pointer; rollback = drop staging store.
    - `dryRun: true` unconditionally drops staging on exit; never
      swaps bookmark. `commitPlanningState` inside dryRun is no-op
      (matches Phase 5 D-05).
    - Nested `withTransaction` JOINs the outer staging store via
      reentrant-lock guard — direct port of Phase 5 D-04/D-10.
    - Architecturally 1:1 with MarkdownAdapter's shadow-dir journal;
      closes SYNTHESIS §9 HIGH-severity dry-run gate on BeadsAdapter
      by construction.
  - **Outcome: primitives unavailable** → ship Option A (in-memory
    write-buffer) as v1.0 fallback:
    - Queue mutations in an `activeTransaction` buffer; apply on
      commit (sequential bd issue edits); discard on rollback;
      reads consult buffer first.
    - Document the "sequential commit, best-effort mid-txn rollback"
      gap — mid-txn failure after 2-of-3 buffered writes apply leaves
      bd partially committed on the Nth issue.
    - Flag as a **Phase 6.1 follow-up** for Phase 7 conformance to
      weigh in on. Phase 7 failure-injection test (CONFORM-04) will
      fail on BeadsAdapter under this fallback — expected; Phase 6.1
      closes the gap if Phase 7 judges it required.
- **D-TXN-CAPS:** `capabilities.transaction: true` in both outcomes
  (pipeline.ts dry-run depends on it unconditionally).
  `capabilities.snapshot: true` only in Outcome B (staging-store case);
  false in Outcome A fallback. Document which variant shipped in
  BeadsAdapter README.

### binaryAsset policy — skip-and-warn

- **D-BINARY (skip-and-warn, capabilities.binaryAsset: false):**
  BeadsAdapter declares `capabilities.binaryAsset: false` and throws
  `UnsupportedCapabilityError` if `writeBinaryAsset` is called
  directly. Consumer workflows (UI-review screenshots, sketch
  PNG/HTML/CSS — none yet shipped in v1.0) MUST guard with
  `hasBinaryAsset(adapter)` per Phase 5 D-18 and skip-with-warning
  when false. Zero BeadsAdapter LOC for this; zero runtime cost; clean
  migration path if bd users later demand asset routing (flip cap to
  `true` + ship blob-store routing — non-breaking).

### BEADS-04: BeadsAdapter.init() failure diagnostic

- **D-INIT-ERR (Typed error class):** BeadsAdapter exports a typed
  error class `BdManagedMismatchError extends Error` with fields:
  - `code: 'PROJECT_BD_MANAGED_MISMATCH'` (literal)
  - `projectDir: string`
  - `hint: string` (human-readable next step — filled by the adapter)
  - `__brand` symbol for cross-module instanceof resilience (mirrors
    `UnsupportedCapabilityError` precedent in `adapters/types.ts`).
  `BeadsAdapter.init()` throws this class when the target dir is not
  bd-managed (no `.bd/` dir, or `bd status` exits non-zero, or
  equivalent validation — exact probe is the planner's call).
  Consumers catch by class or `err.code`.

### Repo bootstrap + dev-link workflow

- **D-SCAFFOLD (Fresh `npm init` + file-link to this fork):** Plan
  06-01 creates `~/code/gsd-beads/` via fresh `npm init -y`.
  `package.json` declares:
  - `"get-shit-done": "file:../get-shit-done"` (dev dependency for
    type imports + conformance harness)
  - Minimal deps (bd node bindings when available; `vitest` for tests)
  - A single entry point `src/index.ts` exporting `BeadsAdapter`
    (exact export shape — default export vs named class — is Claude's
    discretion; must match the convention Phase 8 picks for the
    adapter-name resolver).
  - README stating "BeadsAdapter for get-shit-done fork v1.0; depends
    on locked StorageAdapter contract at `adapters/types.ts` in the
    fork."
  Zero v0.2 archaeology — the v0.2 shadow work is superseded and
  carry-forward is scoped to the 13 spike findings and the format
  module concept, which are ported fresh into the v1.0 BeadsAdapter,
  not inherited as code.

### Conformance harness invocation from sibling

- **D-CONFORM-EXPORT (Fork-side `package.json` subpath export):**
  This fork's `package.json` gains a `"./conformance"` entry in its
  `exports` field pointing at
  `./tests/conformance/adapter.conformance.js` (the compiled JS
  equivalent of `adapter.conformance.ts`). Sibling repo imports via:
  ```ts
  import { runAdapterConformanceSuite } from 'get-shit-done/conformance';
  import { BeadsAdapter } from './src/index.js';
  runAdapterConformanceSuite('beads', (dir) => new BeadsAdapter(dir));
  ```
  This is the single *fork-side* change Phase 6 writes into THIS repo
  before switching to sibling work. The `runAdapterConformanceSuite`
  signature is already locked (Phase 1 D-15 per
  `adapter.conformance.ts` header comment); no harness changes needed
  — only the export wiring.

### Runtime adapter resolution (Phase 8 preview)

- **D-RUNTIME-RESOLUTION (preview of Phase 8 DIST-01):** The fork's
  `createRegistry` resolver will dynamically `require("gsd-{name}")`
  when `storage.adapter: "beads"` is set in `.planning/config.json`.
  Phase 6 designs BeadsAdapter's package export to match this pattern
  — exact export shape (default / named / factory function) is
  Claude's discretion, subject to the constraint that the resolver
  can instantiate with `new Adapter(projectDir)` or
  `Adapter.create(projectDir)`. Document the chosen shape in
  BeadsAdapter README so Phase 8 can wire the resolver against it.
  Phase 8 DIST-01 ships the resolver and wires config-based opt-in;
  until then, tests in sibling-repo construct BeadsAdapter directly.

### Claude's Discretion

- **Spike sequencing within Plan 06-01** — whether the bd store-clone
  spike lives as a standalone markdown doc, a throwaway test file, or
  an executable script. Planner's call.
- **Exact bd primitives invoked** — whether BeadsAdapter shells to
  `bd` CLI, uses node bindings to bd's SQLite, or a mix. Planner
  judges based on spike outcome. (Spike bindings if they exist; fall
  back to CLI shell-out if not.)
- **Plan count and wave structure** — likely 5–7 plans given scope
  (scaffold + txn spike + Bin A impl + foundational primitives impl +
  event families impl + conformance smoke + format module + dep-graph
  synthesizer). Mirror Phase 3/5 wave shape.
- **Format module internal organization** — single file per canonical
  schema, or one big `format.ts`. Schema drift tests live
  alongside whichever module the planner picks.
- **BeadsAdapter.init() exact probe mechanism** — `ls .bd/`, `bd status`
  shell-out, JSON-RPC call to bd daemon, or equivalent. Planner's call
  based on bd's current idioms.
- **Error-class export path** — whether `BdManagedMismatchError` lives
  at `src/errors.ts` or inline in `src/index.ts`. Minor organization
  choice.
- **Dep-edge synthesizer implementation** — whether it runs on every
  `getRecord('graphs/graph.json')` call (lazy) or is materialized on
  writes to bd's blocks-edges (eager-cache). Planner weighs freshness
  vs. cost.
- **Sibling-repo branch strategy** — long-lived `main` vs per-plan
  feature branches. Planner's call, mirroring this repo's strategy.

### Folded Todos

**Folded:** `cjs-sdk-golden-parity-failures.md` — NOT folded. Score
0.4 matched on surface keywords only; actual content is about CJS↔SDK
parity failures in THIS repo (Phase 1 debt per D-2026-04-30-11), not
about Phase 6 sibling-repo work. Reviewed and deferred — belongs to
Phase 8 DIST-04 (strict-superset invariant validation) or a standalone
debt-cleanup plan.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (gsd-phase-researcher, gsd-planner) MUST read these
before researching or planning.**

### Project-locked architecture

- `.planning/PROJECT.md` — Fork architecture, two-repo model (D-2026-
  04-30-02), strict-superset invariant, branch strategy. Phase 6 works
  in the SIBLING repo (`~/code/gsd-beads`); fork-side changes are
  minimal (the `./conformance` subpath export per D-CONFORM-EXPORT).
- `.planning/DECISIONS.md` — Locked decisions D-2026-04-30-01..11
  + D-2026-05-01 (stat primitive) + D-2026-05-01-OQ04, OQ09 +
  D-2026-05-10-01..08. **Phase 6 appends ADRs for OQ-06 resolution
  (D-OQ06) and any BeadsAdapter-specific decisions that affect the
  shared contract.**
- `.planning/STATE.md` — Current state; "Phase 06 — next phase is in
  sibling repo ~/code/gsd-beads — switch repos to continue" (line 24).

### Prior phase outputs (locked, treat as carry-forward facts)

- `.planning/phases/01-fork-bootstrap-storageadapter-interface-skeleton-markdownada/01-CONTEXT.md`
  — D-02 (CJS stays untouched), D-07 (createRegistry DI), D-08
  (capabilities enum), D-10 (full v1.0 surface declared), D-11 (type
  guards). BeadsAdapter implements against the contract Phase 1 locked.
- `.planning/phases/03-wire-core-write-methods-recordstateevent/03-CONTEXT.md`
  — D-01/D-02 (3 event families designed specifically for clean bd
  mapping — append→comment, mutation→sub-record, signal→sidecar —
  this is the PRIMARY DRIVER for D-MAPPING), D-04 (adapter interface
  stays thin — NO domain logic in BeadsAdapter), D-10 (withTransaction
  maps to native concurrency mechanisms: "bd uses append-log ACID").
- `.planning/phases/03-wire-core-write-methods-recordstateevent/03-06-PLAN.md`
  — StateWriteOutcome three-state contract landing (Plan 03-06,
  2026-05-11). Phase 6 MUST return `StateWriteOutcome` from all three
  `recordState*` methods with `applied: true/false + reason/
  created_section` discriminants exactly as locked.
- `.planning/phases/05-foundational-primitive-lift/05-CONTEXT.md`
  — D-01 (shadow-dir journal — architectural analog for D-TXN Option
  B on BeadsAdapter), D-06 (L2/L3/L4 heading-depth walker —
  BeadsAdapter's section atomicity MUST match this depth resolution),
  D-09 (updateSection internally withTransaction-wrapped — BeadsAdapter
  preserves this contract), D-11 ("updateSection dispatches to
  per-section sub-record updates which inherit bd's per-issue
  atomicity" — the seed for D-MAPPING), D-13/D-14 (NamedDocCategory
  + 'root' discriminator — BeadsAdapter MUST honor the closed union),
  D-17/D-18 (writeBinaryAsset primitive + graceful degradation —
  D-BINARY is the direct descendant), D-19 (sidecar SDK-typed verbs —
  BeadsAdapter path-sniffs 2-3 keys per README), D-20 (scratch as
  first-class phase-scoped types — BeadsAdapter maps to typed comments
  with `gsd:scratch:<type>` label).

### Milestone scope

- `.planning/REQUIREMENTS.md` §"BEADS" — BEADS-01..05. Note BEADS-05
  (writeBinaryAsset graceful-degradation) is resolved by D-BINARY
  above.
- `.planning/ROADMAP.md` §"Phase 6" — Goal, depends on (Phase 5 per
  §9 dry-run gate), resolves OQ-06, 5 Success Criteria. SC#4 (OQ-06
  resolved) satisfied by D-OQ06 above. SC#5 (graceful degradation)
  satisfied by D-BINARY.

### Architectural source-of-truth

- `.planning/research/fork-investigation/SYNTHESIS.md` — 723 lines.
  - **§4** — Adapter interface (Bin A primitives + foundational
    primitives + ~58 Bin B methods). BeadsAdapter implements the
    locked Phase-5 surface plus the 3 recordState* families from
    Phase 3.
  - **§6 #5 (OQ-06)** — Knowledge-graph scope. **Resolved by
    D-OQ06:** layered semantic + dependency edges via separate
    pipelines; BeadsAdapter ships dep edges from bd `blocks`; semantic
    edges deferred to post-v1.0 graphify-on-bd work.
  - **§7 Phase 6** — "Implement adapter against `bd` using
    carry-forward from current gsd-beads work (§8). Leverage 13 spike
    findings + format module + helpers. Map domain methods: addPhase
    → bd issue with `gsd:phase` label; recordStateEvent → typed
    comment; updateSection → per-section sub-records or
    comment-with-anchor."
  - **§8** — Recommended carry-forward: 13 spike findings, format
    module concept, `parsePhaseId`/`deriveDiskStatus`/
    `loadMilestoneHeading` helpers, JSONL roundtrip seed pattern,
    blocks-edge sibling-dep modeling (spike 014). All relevant to
    Phase 6.
  - **§9 Risk register** — HIGH: "Don't ship Phase 6 until dry-run is
    stable on MarkdownAdapter." **Phase 5 SC#1 passed (2026-05-11);
    gate CLOSED on MarkdownAdapter.** **D-TXN-SPIKE extends the gate
    to BeadsAdapter** via staging-store outcome (or documents the
    fallback gap for Phase 6.1). HIGH: "Section semantics differ
    across adapters." **D-MAPPING keeps L2/L3/L4 atomicity via hybrid
    split; Phase 7 CONFORM-03 validates.** MEDIUM: "Knowledge-graph
    out of scope." **D-OQ06 resolves via layered pipeline.** MEDIUM:
    "Beads adapter can't model binary asset cleanly." **D-BINARY
    resolves via skip-and-warn.**

### Adapter contract (locked, Phase 6 targets)

- `adapters/types.ts` — The locked StorageAdapter contract. 159 lines.
  Key types Phase 6 implements against:
  - `StorageAdapter` interface (lines 67–121) — all Bin A primitives
    + foundational primitives + 3 recordState* methods.
  - `StateWriteOutcome` (lines 50–52) — three-state discriminated
    union. ALL three recordState* methods return this.
  - `NamedDocCategory` (line 15) + `RootNamedDocKey` (line 26) —
    closed unions BeadsAdapter must honor for `putNamedDoc` /
    `getNamedDoc`.
  - `Capabilities` (lines 54–65) — Phase 6 adds
    `graphEdges: { semantic: boolean; dependency: boolean }` per
    D-OQ06-CAPS (only Phase-6 contract change — additive).
  - `UnsupportedCapabilityError` (lines 123–142) — exemplar for
    BeadsAdapter's `BdManagedMismatchError` (D-INIT-ERR).
- `adapters/markdown/index.ts` — 1452 lines. Reference implementation
  for equivalence; BeadsAdapter produces observably-equivalent
  behavior for every Bin A + foundational + recordState* call
  (conformance-asserted in Phase 7, smoke-tested in Phase 6).
- `adapters/state-event-types.ts` — AppendEvent / MutationEvent /
  SignalEvent payload unions. BeadsAdapter dispatches on
  `event.type` in each `recordState*` method.

### Conformance harness

- `tests/conformance/adapter.conformance.ts` — Factory harness.
  Signature `runAdapterConformanceSuite(adapterName, adapterFactory)`
  is LOCKED (Phase 1 D-15). Phase 6 exports this via the fork's
  `package.json` `./conformance` subpath (D-CONFORM-EXPORT) and
  invokes it from the sibling repo with
  `runAdapterConformanceSuite('beads', (dir) => new BeadsAdapter(dir))`.
- `tests/conformance/markdown.conformance.test.ts` — Pattern reference
  for how a conformance consumer wires its adapter in.
- `tests/conformance/write-outcome.test.ts` — StateWriteOutcome
  conformance tests (16 cases). Phase 6 asserts BeadsAdapter satisfies
  the same 16 cases via smoke tests; Phase 7 makes the parity formal.

### Spike carry-forward (documentation-only; code is written fresh)

- 13 spike findings from superseded gsd-beads v0.2 work (spike 014
  blocks-edge sibling-dep modeling is the primary inspiration for
  D-OQ06 dependency-edges). Spike findings are conceptual carry-
  forward — the code in BeadsAdapter is written fresh against the
  locked v1.0 contract, not copied. If the old v0.2 `gsd-beads` repo
  still exists at `~/code/gsd-beads`, Plan 06-01 archives it (e.g.,
  `git branch v0.2-shadow-archive` then `git reset --hard` to empty)
  before scaffolding v1.0 — preserves history without muddying the
  v1.0 tree.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (from THIS fork, referenced by sibling repo)

- **`adapters/types.ts`** (159 LOC) — the locked contract. BeadsAdapter
  imports types directly: `StorageAdapter`, `StateWriteOutcome`,
  `NamedDocCategory`, `RootNamedDocKey`, `UnsupportedCapabilityError`,
  the 5 capability type guards.
- **`tests/conformance/adapter.conformance.ts`** — factory function
  `runAdapterConformanceSuite(adapterName, adapterFactory)`. Phase 6
  adds a `./conformance` subpath export in `package.json`; sibling
  imports via `from 'get-shit-done/conformance'`.
- **`adapters/markdown/index.ts`** as reference for equivalence —
  particularly:
  - L2/L3/L4 heading-depth walker (lines ~189–241) — BeadsAdapter's
    anchor-tagged comment path-concatenation logic should parallel
    this semantic.
  - `recordStateAppend/Mutation/Signal` implementations (the file's
    latter half) — BeadsAdapter's sub-record dispatcher SHOULD return
    the same `StateWriteOutcome` variants for the same input shapes;
    Phase 7 conformance tests will validate.
  - `acquireAdapterLock` + `lockSet` reentrant pattern — BeadsAdapter's
    staging-store lifecycle OR in-memory write-buffer both need a
    similar reentrancy-guard shape (not the same code — different
    primitive).

### Established Patterns (this milestone's discipline)

- **Adapter stays thin** (Phase 3 D-04 — applies transitively):
  BeadsAdapter has no domain logic. No `addPhase` method on
  BeadsAdapter — `addPhase` lives in the fork's shared SDK helpers
  (`phase-helpers.ts`) which compose Bin A + foundational primitives.
  BeadsAdapter's surface = the contract, nothing more.
- **Explicit adapter first parameter** (Phase 2 D-10): helpers that
  consume BeadsAdapter follow `(adapter: StorageAdapter, ...rest)`.
  Conformance harness already follows this.
- **Capabilities gate optional features** (Phase 1 D-08): consumers
  check `hasBinaryAsset(adapter)`, `hasSnapshot(adapter)` etc. before
  calling optional methods. BeadsAdapter declares `binaryAsset: false`
  per D-BINARY, `snapshot` depends on D-TXN spike outcome.
- **StateWriteOutcome three-state discipline** (D-2026-05-10-08):
  EVERY recordState* call returns `applied: true|false` with the
  correct discriminant. No silent-true no-ops.

### Integration Points

- **Fork-side (THIS repo, Phase 6 minimal footprint):**
  - `package.json` — add `"./conformance"` subpath export (single
    line change). Optionally add `"./adapters/types"` for consumers
    who want to import the types package-relatively (Claude's
    discretion; file-link works without it).
  - `adapters/types.ts` — extend `Capabilities` with
    `graphEdges: { semantic: boolean; dependency: boolean }` per
    D-OQ06-CAPS (additive). MarkdownAdapter's capabilities object gets
    `graphEdges: { semantic: true, dependency: false }`. No behavior
    change for MarkdownAdapter.
  - Both changes land as ONE fork-side plan early in Phase 6 so the
    sibling repo can import a published (or file-linked) version with
    the updated surface.
- **Sibling-side (`~/code/gsd-beads`, Phase 6 majority footprint):**
  - `src/index.ts` — `BeadsAdapter` class implementing `StorageAdapter`.
  - `src/format/*.ts` — per-canonical-file schemas (STATE, ROADMAP,
    PROJECT, REQUIREMENTS, DECISIONS, AI-SPEC, SPEC, UAT, VERIFICATION,
    PLAN, CONTEXT, debug-session). Module organization is Claude's
    discretion.
  - `src/errors.ts` (or inline) — `BdManagedMismatchError`.
  - `src/dep-graph.ts` — synthesizer producing `{type: 'dependency',
    confidence: 1.0}` edges from bd's blocks-edges for
    `getRecord('graphs/graph.json')`.
  - `src/txn/*.ts` — either staging-store impl (Outcome B) or
    in-memory write-buffer (Outcome A), chosen post-spike.
  - `src/init.ts` — `BeadsAdapter.init()` with the fail-fast
    bd-managed-mismatch probe.
  - `tests/conformance.test.ts` — imports and invokes
    `runAdapterConformanceSuite('beads', factory)` from
    `get-shit-done/conformance`.
  - `tests/smoke/*.test.ts` — per-Bin-B-category smoke test
    (one workflow per category) per SC#3 (phase, plan, summary, uat,
    state-event, debug, intel, learnings, etc.).
  - `package.json`, `tsconfig.json`, `vitest.config.ts` — standard
    v1.0 TS package scaffolding.
  - `README.md` — documents D-TXN variant shipped (A or B), sidecar
    path-sniff map per D-19, `gsd:*` label namespace, export shape
    matching Phase 8 resolver convention.

</code_context>

<specifics>
## Specific Ideas

- User chose **layered graph edges over defer-only** for OQ-06
  specifically because bd's `blocks` / `blocked-by` are a deterministic
  graph signal bd does well — deferring it would have thrown away
  bd's strength. The two-pipeline layering (semantic remains markdown-
  only, dependency is bd-native) preserves signal quality AND keeps
  the change additive — no existing consumer breaks.

- User chose **hybrid L2 sub-records + L3/L4 anchor-comments** over
  comments-everywhere specifically because the Phase 3 D-01 mapping
  was designed this way from day one (append→comment, mutation→sub-
  record, signal→sidecar). The hybrid shape matches the event-family
  semantics 1:1 — `recordStateMutation` on the hybrid maps directly
  to bd sub-record list ops; on comments-everywhere it would need an
  obsolete-filter simulation layer.

- User chose **authored schemas per canonical file** over derived
  because drift caught at sync time (schema mismatch throws an
  explicit error) is strictly better than drift masked by auto-
  derivation (silently-wrong sub-records that conformance catches
  only late). Typing wins over dynamism at the storage boundary.

- User chose **spike-first with fallback** for D-TXN rather than
  committing upfront to Option A or B. Rationale: bd's native
  primitives for store-clone + bead-hash bookmarks are undocumented at
  the sibling-repo start; Plan 06-01 spikes the primitives and the
  shape of `withTransaction` follows from spike outcome. Worst case
  (Option A fallback) is an acceptable v1.0 with a known gap tracked
  for Phase 6.1. Best case (Option B) closes the §9 dry-run gate on
  BeadsAdapter by construction.

- User chose **skip-and-warn for binaryAsset** over blob-store routing
  because v1.0 prioritizes correctness + conformance over feature
  parity. Consumer workflows (UI-review screenshots) don't exist yet;
  premature blob-store engineering would bloat Phase 6 and waste
  effort if demand never materializes. The capability-flag pattern
  makes post-v1.0 migration to blob-routing non-breaking.

- User chose **typed error class** for BEADS-04 over structured-
  diagnostic-object because adapter constructor failure is a throw-
  level event (invariant violation — "you called me with a dir I can't
  manage"), not a normal-flow return. `BdManagedMismatchError` mirrors
  `UnsupportedCapabilityError`'s shape including the `__brand` symbol
  for cross-module `instanceof` resilience.

- User chose **fresh `npm init` + file-link** for sibling bootstrap
  over copy-from-markdown-template because the v0.2 work in the old
  `~/code/gsd-beads` repo is superseded — carrying it forward as code
  (not concepts) risks polluting v1.0 with dead architecture. The 13
  spike findings are conceptual carry-forward, re-authored against
  the locked v1.0 contract.

- User chose **subpath export in fork's `package.json`** for
  conformance invocation over raw path-dep because it cleanly marks
  the public-API boundary. Sibling imports `get-shit-done/conformance`
  — if Phase 7+ refactors the harness internally, the public entry
  point stays stable. Small one-line change in this repo; zero
  runtime cost.

- User asked mid-discussion **"why are we having to separate and link
  these files?"** — prompting re-surface of D-2026-04-30-02 (two-repo
  model). User reaffirmed the two-repo decision after understanding
  the ceremony is in service of the upstream-PR path and the "anyone
  can write their own adapter" pattern. No pivot — proceed as
  two-repo.

- User asked **"on gsd update, how would the end user have their
  beads implementation automatically applied?"** — prompting the
  Phase-8 preview (D-RUNTIME-RESOLUTION). End user installs both
  packages (`npm install -g get-shit-done gsd-beads`), sets
  `storage.adapter: "beads"` in `.planning/config.json`, fork
  dynamically `require`s `gsd-beads` at runtime via an adapter-name
  resolver Phase 8 ships. Phase 6 designs BeadsAdapter's package
  export shape to match the resolver contract.

</specifics>

<deferred>
## Deferred Ideas

- **bd-sourced semantic edges** — Running `graphify.cjs` against bd
  as a data source so BeadsAdapter also produces semantic edges.
  Requires graphify to accept an adapter-mediated input path, not
  just a markdown tree. Post-v1.0 or Phase 8.

- **Phase-8 adapter-name runtime resolver (DIST-01)** — `createRegistry`
  dynamically resolving `gsd-{name}` from user's node_modules.
  Previewed in D-RUNTIME-RESOLUTION; full impl is Phase 8.

- **markdown→bd migration tool (DIST-02)** — Phase 8 ships this; Phase
  6 does NOT need to author migration.

- **Type-aware graph-edge filtering in consumers** — Teaching
  `gsd-phase-researcher` and `graphify.md` to filter by
  `type: 'semantic' | 'dependency'` and handle both-missing
  gracefully. May land inside Phase 6 at planner's discretion
  (small uplift) or slip to Phase 8.

- **Phase 6.1 follow-up: bd multi-record commit atomicity** — Only
  needed if D-TXN spike forces Option A fallback AND Phase 7
  conformance judges the sequential-commit gap unacceptable. Tracked
  here so Phase 7 planner finds the breadcrumb.

- **Blob-store routing for binaryAsset on BeadsAdapter** — Ship when
  a consumer workflow actually needs UI-review screenshots on bd
  backend. Non-breaking flip of `capabilities.binaryAsset` when it
  lands.

- **BeadsAdapter-specific sidecar path-sniff map documentation** —
  Closed set of 2–3 keys (per Phase 5 D-19) documented in BeadsAdapter
  README. Planner-level detail for Plan 06-0N.

- **Publishing `gsd-beads` to npm registry** — Already deferred to
  NPM-01 (REQUIREMENTS.md "Future Requirements"). v1.0 keeps at
  `~/code/gsd-beads`; publish only if external adopters appear.

- **`gsd update` convenience for adapters** — Running `npm update -g
  gsd-*` for installed adapter packages when user runs `gsd update`.
  Polish for Phase 8 or post-v1.0; not required for functional v1.0.

- **Reconsidering two-repo model (D-2026-04-30-02)** — User asked
  mid-discussion and confirmed keep-two-repos. Not re-opened here,
  but flagging the ceremony friction as a post-v1.0 consideration if
  it proves painful during Phase 7 cross-repo work.

### Reviewed Todos (not folded)

- **cjs-sdk-golden-parity-failures.md** — Todo matcher scored 0.6
  but content is about CJS↔SDK parity in THIS fork's SDK (Phase 1
  debt per D-2026-04-30-11), not sibling-repo Phase 6 work.
  Appropriate home is Phase 8 DIST-04 (strict-superset invariant
  validation) or a standalone debt-cleanup plan.

</deferred>

---

*Phase: 06-beadsadapter-implementation*
*Context gathered: 2026-05-11*
