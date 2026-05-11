# Phase 6: BeadsAdapter implementation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 06-beadsadapter-implementation
**Areas discussed:** OQ-06 graph scope, bd-native mapping shape, withTransaction + snapshot/restore, binaryAsset degradation, repo bootstrap + dev-link, conformance invocation from sibling, BeadsAdapter.init() failure diagnostic

---

## OQ-06 knowledge-graph scope

### Round 1 — initial framing

| Option | Description | Selected |
|--------|-------------|----------|
| A. Defer + graceful degradation | capabilities.graph: false; agents already skip when graph.json absent. Preserves v1.0 scope; matches SYNTHESIS §6 #5 recommendation. | |
| B. Ship GraphAdapter sub-interface | Full cross-backend parity but contradicts SYNTHESIS §7 scope; upstream graphify is filesystem-coupled. ~8-12 new methods in Phase 6. | |
| C. Path-sniff hybrid | BeadsAdapter intercepts getRecord('graphs/graph.json') and synthesizes from bd issue-graph. Seamless agent UX; implicit path contract; lossy subset vs full graphify schema. | |

**User's choice:** "why do users lose cross-phase concepts? doesnt beadds handle connections between tasks, and task/concept mapping?"

**Notes:** User pushed back on the framing. Clarification: bd's deterministic dep graph (blocks/blocked-by) is different from graphify.cjs's fuzzy confidence-tiered semantic graph (used by gsd-phase-researcher for concept similarity). User then asked: "so why does switching to adapters remove the knowledge graph? i thought the deterministic graph is what beads does well" — prompting re-framing of the options to distinguish semantic vs dependency edge kinds.

### Round 2 — refined framing after clarification

| Option | Description | Selected |
|--------|-------------|----------|
| Defer semantic, keep bd's native dep graph separate | Markdown-only semantic edges; bd's blocks as an independent query path. | |
| Hybrid — synthesize graph.json from bd's dep edges (replace) | Agents query graphs/graph.json, get dep edges only on bd. Different signal, still useful; loses semantic discovery. | |
| Layered — extend graph.json schema with type field; both edge kinds coexist | ✓ |

**User's choice:** "okay, lets go with a layering approach for it then, and these edges can be a separate info pipeline"

**Notes:** Layered-edges (D-OQ06) chosen. graphs/graph.json edge schema extends with `type: 'semantic' | 'dependency'`. Semantic edges remain markdown-only (bd-sourced deferred post-v1.0). Dependency edges are bd-native (confidence 1.0). capabilities gains graphEdges: { semantic, dependency } — only Phase-6 change to the locked contract surface, additive.

---

## bd-native mapping shape

| Option | Description | Selected |
|--------|-------------|----------|
| A. One issue per file + comments everywhere | All sections (L2/L3/L4) as anchor-tagged comments. Minimal issue count; overwrite requires mark-obsolete-append rewrite simulation. | |
| B. Hybrid L2 sub-records + L3/L4 comments | One issue per file; L2 → bd sub-records (native mutability); L3/L4 → anchor-comments (append-only audit). Maximizes spike carry-forward (format module). | ✓ |
| C. One issue per L2 section | Section-atomicity is native but issue-count explodes (50+ per project); whole-file putRecord non-atomic; violates bd semantic model. | |

**User's choice:** B. Hybrid L2 sub-records + L3/L4 comments

**Notes:** Matches Phase 3 D-01 event-family design (append→comment, mutation→sub-record, signal→sidecar) 1:1. Optimizes the ~80% L2-dominant case with bd-native mutability. L3/L4 nested content tolerates append-only comments.

### Follow-up — schema location

| Option | Description | Selected |
|--------|-------------|----------|
| Authored per canonical file | Explicit TS schemas in format module; typed, drift caught at sync time. | ✓ |
| Derived from markdown heading structure | Zero maintenance; loses type safety; collision risk on renames. | |
| Hybrid — authored for canonical, derived for everything else | Best-of-both; format module surfaces the split. | |

**User's choice:** Authored per canonical file

**Notes:** D-MAPPING-SCHEMA. Typed schemas per canonical file (STATE, ROADMAP, PROJECT, REQUIREMENTS, DECISIONS, AI-SPEC, SPEC, UAT, VERIFICATION, PLAN, CONTEXT, debug-session). Drift caught at sync time beats drift masked by auto-derivation.

---

## withTransaction + snapshot/restore

| Option | Description | Selected |
|--------|-------------|----------|
| A. In-memory write-buffer | Simpler (~150 LOC). Queue mutations; apply on commit, discard on rollback. Fails Phase 5 SC#1 if bd lacks multi-issue txn. | |
| B. Staging bd store + bead-hash bookmark | Separate staging bd instance; commit = atomic bookmark swap; rollback = drop staging. Matches bd's content-addressed design. Spike required. | |
| C. Tap bd's SQLite via node bindings | Native BEGIN/COMMIT/SAVEPOINT. Assumes bd exposes SQLite handle publicly; tight coupling to bd internals. | |
| Spike B first, fall back to A if needed | Plan 06-01 spikes bd primitives; ship B if viable, A + Phase 6.1 follow-up if not. | ✓ |

**User's choice:** Spike B first, fall back to A if needed

**Notes:** D-TXN-SPIKE. Plan 06-01 validates bd's store-clone + bead-hash bookmark primitives. Outcome gates impl path. Lowest risk of v1.0 schedule hit while preserving best-case §9 gate closure on BeadsAdapter.

---

## binaryAsset policy

| Option | Description | Selected |
|--------|-------------|----------|
| A. Skip-and-warn (capabilities.binaryAsset: false) | Throws UnsupportedCapabilityError; workflows guard with hasBinaryAsset(adapter) per D-18. Zero v1.0 cost; non-breaking upgrade to blob routing later. | ✓ |
| B. External blob store | S3 or fs sidecar; full feature parity; requires config + new dep. Premature for v1.0 audience. | |
| C. Base64-stuff into bd comment | Self-contained but bloats bd sync/clone. Violates bd design intent. | |

**User's choice:** A. Skip-and-warn

**Notes:** D-BINARY. v1.0 prioritizes correctness + conformance over feature parity. No consumer workflow exists yet for writeBinaryAsset. Capability-flag migration path is non-breaking.

---

## Repo bootstrap + dev-link workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh npm init + file-link to this fork | Clean npm init; "get-shit-done": "file:../get-shit-done" in dev; zero v0.2 archaeology. | ✓ |
| Template from this fork's adapters/markdown/ | Copy structure; fastest to parity with locked interface. | |
| Archive v0.2 to branch, reinit on main | git branch v0.2-shadow-archive; git reset --hard; scaffold fresh. Preserves spike history. | |

**User's choice:** Fresh npm init + file-link

**Notes:** D-SCAFFOLD. 13 spike findings are conceptual carry-forward re-authored against locked v1.0 contract, not inherited as code. Plan 06-01 creates the repo.

---

## Conformance invocation from sibling

| Option | Description | Selected |
|--------|-------------|----------|
| Path-dep via file-link | Import from get-shit-done/tests/conformance/... directly via file: dep. Simplest. | |
| Expose conformance via package.json exports | Add "./conformance" subpath export; sibling imports get-shit-done/conformance. Cleaner API boundary. | ✓ |
| Extract conformance to a third package | gsd-adapter-conformance npm package. Rejected in D-2026-04-30-02 (three-repos alternative). | |

**User's choice:** Expose conformance via package.json exports

**Notes:** D-CONFORM-EXPORT. Small one-line change in THIS repo's package.json. Public-API boundary clean; harness internals can refactor without breaking sibling. Single fork-side artifact Phase 6 writes into this repo.

---

## BeadsAdapter.init() failure diagnostic (BEADS-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Typed error class + specific error code | BdManagedMismatchError with code + projectDir + hint + __brand. Mirrors UnsupportedCapabilityError. | ✓ |
| Structured diagnostic object (no throw) | init() returns {ok, code, message, hint}. Aligns with StateWriteOutcome. Breaks constructor-throw convention. | |
| Throw + context-aware hint text | Throw with inspection-generated hint (markdown-tree / bd-store / git state). | |

**User's choice:** Typed error class + specific error code

**Notes:** D-INIT-ERR. Mirrors UnsupportedCapabilityError shape including __brand symbol for cross-module instanceof. Consumers catch by class or err.code.

---

## Mid-discussion clarifications (user questions)

### "why are we having to separate and link these files?"

User surfaced friction with the two-repo ceremony (file-linking, package.json exports, conformance indirection). Re-examined D-2026-04-30-02 (two-repo model locked 2026-04-30). Explained the upstream-PR path + "anyone can write their own adapter" + different-release-cadence rationale. User chose: **keep two-repo**. No pivot. Noted the ceremony friction as a post-v1.0 consideration in deferred ideas.

### "on gsd update, how would the end user have their beads implementation automatically applied?"

User asked about end-to-end distribution + runtime wiring. Explained the Phase 8 DIST-01 story: user installs both packages (`npm install -g get-shit-done gsd-beads`); sets `storage.adapter: "beads"` in `.planning/config.json`; fork's createRegistry dynamically `require("gsd-{name}")` at runtime. Phase 6 designs BeadsAdapter's export to match that resolver convention. User chose: **defer export-shape specifics to the planner** (D-RUNTIME-RESOLUTION captured as a Phase 8 preview in CONTEXT).

---

## Claude's Discretion

- Spike sequencing within Plan 06-01 (standalone doc vs test file vs script)
- bd primitives invocation style (CLI shell-out vs node bindings vs mix)
- Plan count and wave structure (likely 5–7 plans)
- Format module internal organization (per-schema files vs single big module)
- BeadsAdapter.init() exact probe mechanism (`ls .bd/` / `bd status` / JSON-RPC)
- Error-class export path (src/errors.ts vs inline)
- Dep-edge synthesizer strategy (lazy on getRecord vs eager cache on writes)
- Sibling-repo branch strategy (long-lived main vs per-plan feature branches)
- BeadsAdapter package export shape (default export vs named class vs factory)

## Deferred Ideas

- bd-sourced semantic edges (run graphify.cjs against bd) — post-v1.0 or Phase 8
- Phase-8 adapter-name runtime resolver (DIST-01) — previewed as D-RUNTIME-RESOLUTION
- markdown→bd migration tool (DIST-02) — Phase 8
- Type-aware graph-edge filtering in consumers — Phase 6 optional uplift or Phase 8
- Phase 6.1 follow-up: bd multi-record commit atomicity (only if spike forces Option A + conformance flags gap)
- Blob-store routing for binaryAsset on BeadsAdapter — ship when consumer needs
- BeadsAdapter sidecar path-sniff map documentation — planner-level detail
- Publishing gsd-beads to npm (NPM-01) — v1.0 stays at ~/code/gsd-beads
- `gsd update` convenience for adapters — Phase 8 polish or post-v1.0
- Reconsidering two-repo model — deferred; user confirmed keep-two-repos

## Reviewed todos (not folded)

- cjs-sdk-golden-parity-failures.md — belongs to Phase 8 DIST-04 or standalone debt plan, not Phase 6 sibling-repo work
