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

---

# Session 2 — post-hybrid-pivot re-discuss (2026-05-11)

**Trigger:** Previous CONTEXT.md was amendment-appended after the user surfaced that `/Volumes/code/gsd-beads` already exists as a mature repo (~15 KLOC shipped, 71 conformance tests, 13 spikes) rather than the greenfield scaffold the original discussion assumed. Archived to `archive-greenfield/06-CONTEXT-pre-pivot.md`; `/gsd-discuss-phase 6 --chain` re-run for fresh CONTEXT.md.

**Areas discussed:** D-MAPPING, D-TECH-STACK, D-SCAFFOLD, D-TXN-SPIKE

## D-MAPPING — storage model (AMENDED)

| Option | Description | Selected |
|--------|-------------|----------|
| A. Accept sibling's labels-first + description-blob | Proven 71 tests; zero bd-primitive risk; maps cleanly to 3 recordState* families via `--author gsd:event:<type>` + `bd remember --key` + label +/-. | |
| B. Spike sub-records first, fall back to labels-first if unavailable | Plan 06-01 spikes bd v1.0.3 for any named-JSON-field primitive beyond --description. If yes → original D-MAPPING. If no → labels-first fallback. Consolidates with D-TXN-SPIKE into one Plan 06-01. | ✓ |
| C. Force sub-records via structured JSON inside description blob | JSON-in-description workaround; loses human-readability in bd-native views. | |

**User's choice:** B. Spike sub-records first, fall back to labels-first if unavailable

**Notes:** User wants empirical evidence on bd primitives before locking the storage shape. Mirrors D-TXN-SPIKE's spike-then-ship pattern; consolidates both bd-primitive questions ("what does bd v1.0.3 actually expose?") into Plan 06-01's scope. Outcome gates D-MAPPING-SCHEMA schema scope (sub-records → 12+ per-canonical-file schemas; labels-first → just phase.ts + state.ts + generic parsers).

## D-TECH-STACK — language + test runner (NEW)

| Option | Description | Selected |
|--------|-------------|----------|
| A. Stay .mjs + node:test | Sibling's stack; fastest; zero rewrite; loses author-site compile-time type enforcement. | |
| B. Migrate everything to .ts + vitest | ~1000 LOC port; drops node:test; full compile-time type enforcement of StateWriteOutcome + event discriminated unions. | ✓ |
| C. Hybrid — .mjs internals + .ts compliance surface | Port only adapter-compliance modules to .ts; keep .mjs for bd internals. Bounded scope; mental-model split. | |

**User's choice:** B. Migrate everything to .ts + vitest

**Notes:** User prioritized compile-time type safety over hybrid's scope reduction. Reasoning: sibling's Phase 7 shipped WARN-level frontmatter/YAML bugs (WR-02/WR-03/WR-05) that TS would have caught at edit-time; single-stack consumption cleaner than hybrid's mental-model split. ~2× original LOC budget; offset by catching several shape bugs during the port.

## D-SCAFFOLD — repo reset mechanics (AMENDED)

| Option | Description | Selected |
|--------|-------------|----------|
| A. Archive-branch + selective prune + whitelist port to .ts | git branch v0.2-archive; git rm -rf everything except whitelist; port whitelisted .mjs → .ts during reset; delete shadow-era artifacts; rewrite README/CLAUDE.md/CONTRIBUTING.md. | ✓ |
| B. Archive-branch + full reset (re-author ~1000 LOC fresh) | Cleanest separation; loses proven-correct code + validating test fixtures. | |
| C. Keep archive/ in-tree (no archive-branch) | Leave sibling's archive/ where it is; build v1.0 alongside. Clutters working tree. | |
| D. Amend the whitelist — discuss which files port | Adjust the set before locking. | |

**User's choice:** A. Archive-branch + selective prune + whitelist port to .ts

**Notes:** ~750 LOC of proven-correct code (format/phase 251, bd/helper 65, bd/findRoot 68, format/section ~130, format/frontmatter 107, pathRouter 97, helpers 105, _atomicWrite 30) has real port value vs re-author cost. Archive-branch preserves full history essentially free. Combined with D-TECH-STACK: the whitelist drives concrete .mjs → .ts port work in Plan 06-01 (or a Plan 06-02 port task per planner's call). Whitelist also calls out 2 amendments during port: Landmine 3 (adapter-context CWD in bd helper) and WR-05 (atomic-write ms-resolution race).

## D-TXN-SPIKE — withTransaction outcomes (AMENDED, widened to 3)

| Option | Description | Selected |
|--------|-------------|----------|
| A. Widen spike to 3 outcomes (A/B/C) | A: in-memory buffer (~150 LOC, mid-txn partial-commit risk). B: staging store + bead-hash bookmark (closes §9 gate by construction IF bd exposes primitives). C: file-snapshot restore (sibling-proven in 71 tests; slow ~400-700ms per rollback but reliable). Ship best-available; neutral documentation. | ✓ |
| B. Lock Outcome C upfront (sibling-proven, skip spike) | Skip bd-primitive spike; ship C directly. Misses possibility of Outcome B's perf win. | |
| C. Keep original 2 outcomes (A/B), ignore sibling's C | Original plan; ignores Outcome C despite sibling proving it works. | |

**User's choice:** A. Widen spike to 3 outcomes (A/B/C)

**Notes:** Ignoring sibling's proven file-snapshot pattern (Outcome C) just because it's slower than staging-store-cutover would throw away ~800ms-per-rollback verified reliability. Spike evaluates all three; Plan 06-03 (withTransaction impl) ships whichever outcome wins per the spike's §7 locked verdict. `capabilities.transaction: true` in all three outcomes; `capabilities.snapshot: true` in B AND C (both provide snapshot semantics), false in A. Documentation names the shipped outcome neutrally — no "fallback" framing.

## Claude's Discretion (this session)

- Spike sequencing within Plan 06-01 — mapping-spike vs txn-spike order; standalone doc vs test file vs script
- Plan count and wave structure — amendment proposes 4 plans × 4 waves; planner may widen to 5 if Outcome A (sub-records) ships because schema-authoring scope inflates
- Format module internal organization — single file per canonical schema vs one big format.ts
- BeadsAdapter.init() exact probe invocation — default: port findRoot.ts's walk (4 topology cases proven)
- Error-class export path — src/errors.ts vs inline
- Dep-edge synthesizer strategy — lazy vs eager-cache
- Sibling-repo branch strategy — long-lived main vs per-plan feature branches
- BeadsAdapter package export path — preserve sibling's `./src/adapter.*` path during port (minimizes package.json diff)
- WARN-level landmine triage — which of WR-01/WR-09 to fix-during-port vs defer

## Deferred Ideas (this session)

- If D-MAPPING spike lands Outcome B (labels-first): document "sub-records unavailable in bd v1.0.3" as a carry-forward learning + upstream bd feature request
- WARN-level landmines WR-01, WR-09 deferred to planner's budget call
- Systemic planner-subagent-prompt.md + leak-grep scope todo (from STATE.md; not Phase 6 scope)

