# Phase 5: Foundational primitive lift — Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 implements the **six foundational primitives** that Phase 1 declared
and stubbed as `UnsupportedCapabilityError`, upgrades `withTransaction` from
Phase-3 lock-only to lock-plus-rollback, hoists `pipeline.ts` dry-run off
filesystem `cp -r`, and widens `updateSection` to level-3+ anchors. This is
the final phase in this repo before Phase 6 (BeadsAdapter in sibling
`gsd-beads`).

Phase 5 owns:
- Upgrading `withTransaction` to a **shadow-dir journal**: active txn
  redirects writes to a tmpdir layered over `projectDir`; reads merge
  tmpdir-over-real; commit = rename tmpdir entries into place;
  rollback = `rm -rf` tmpdir.
- Implementing `snapshot()/restore()` on MarkdownAdapter (supporting
  infrastructure for the shadow-dir journal; Phase-5 scope is dry-run
  correctness, not user-facing checkpoint API).
- Rewriting `extractSection`/`replaceSection` to walk heading depth —
  support `##`, `###`, `####` anchors; section terminates at next heading
  of same-or-shallower depth.
- Implementing `putNamedDoc(category, key, body)` / `getNamedDoc` with
  category as a typed TypeScript union; Phase 4 per-category SDK handlers
  delegate path computation to the primitive.
- Implementing `writeBinaryAsset(path, bytes)` in MarkdownAdapter; flipping
  `capabilities.binaryAsset` to `true`.
- Hoisting `sdk/src/query/pipeline.ts` dry-run off `cp -r` onto
  `withTransaction({ dryRun: true })` with shadow-dir rollback.
- Adding SDK verbs for sidecars and scratch artifacts as first-class
  noun-catalog types (no new adapter methods).
- Resolving OQ-02, OQ-05, OQ-07, OQ-10 with ADRs in `.planning/DECISIONS.md`.

Phase 5 **does not**:
- Modify CJS files — permanent D-02 from Phase 1.
- Implement BeadsAdapter — Phase 6.
- Ship user-facing checkpoint/restore API beyond what dry-run needs.
- Add binary-asset consumer workflows (UI-review screenshots, sketch
  PNG/HTML/CSS) — those land in separate phases; Phase 5 ships the
  primitive + capability flag.
- Touch `.planning/` outside `adapters/markdown/` — the Phase 4 zero-leak
  invariant is permanent.

</domain>

<decisions>
## Implementation Decisions

### Dry-run hoist + withTransaction upgrade (resolves §9 HIGH-severity risk)

- **D-01 (withTransaction rollback via shadow-dir journal):** Phase 3's
  lock-only `withTransaction` is upgraded to a shadow-dir journal. When a
  txn is active, all mutating adapter methods (`putRecord`,
  `updateSection`, `updateFrontmatter`, `mergeFrontmatter`, `removeRecord`,
  `putNamedDoc`, `writeBinaryAsset`) redirect writes to a per-txn tmpdir
  layered over `projectDir`. All reads (`getRecord`, `getSection`,
  `getFrontmatter`, `listCollection`, `exists`, `stat`, `getNamedDoc`)
  merge tmpdir-over-real so a caller sees its own pending writes. Commit
  renames tmpdir entries into place atomically; rollback `rm -rf`'s the
  tmpdir. This matches today's `cp -r` semantics but scoped to touched
  paths only (smaller tmp footprint).

- **D-02 (Dry-run = withTransaction with rollback):** `pipeline.ts` calls
  `adapter.withTransaction(fn, { dryRun: true })`. The txn runs the
  mutation against the shadow dir; pipeline computes diff from the shadow
  dir's touched paths (cheaper than today's full `readPlanningState`
  before+after); the txn unconditionally rolls back so the real
  `.planning/` is never mutated. Pipeline no longer calls `cp -r` or
  `readPlanningState` twice.

- **D-03 (snapshot()/restore() are internal supporting methods):** The
  shadow-dir journal needs a way to capture-and-reuse a set of touched
  paths. `snapshot()` returns an opaque snapshot id bound to the shadow
  dir's location; `restore(id)` is callable but primarily used internally
  by `withTransaction` rollback. They fulfill the `capabilities.snapshot`
  contract declared in Phase 1 but are NOT marketed as a user-facing
  checkpoint API in Phase 5. (The BeadsAdapter and future callers may
  re-surface them for `commitPlanningState`-style bookmarks in Phase 6+.)

- **D-04 (Re-entrant txn handling):** `recordStateAppend/Mutation/Signal`
  already call `withTransaction` internally (Phase 3). Nested
  `withTransaction` calls (e.g., during pipeline dry-run of a command that
  itself uses recordState*) must be reentrant-safe: if a txn is already
  active on the current adapter instance, nested `withTransaction` joins
  the outer txn (no new tmpdir, no new lock acquire — just executes the
  inner fn and returns). The outer txn owns commit/rollback. Tracked via
  `lockSet` (already present) extended with `activeTransaction?: TxnCtx`
  field.

- **D-05 (dryRun flag threading):** The `dryRun` flag on the outer txn
  propagates to all nested calls. When `dryRun: true`, `commitPlanningState`
  inside a txn is a no-op (no `git add`/`commit` against real files);
  shadow-dir rollback restores state. Documented in ADR for OQ-01 follow-up.

### updateSection — level-3+ anchor support (resolves OQ-02 scope)

- **D-06 (Heading-depth walking):** `extractSection`/`replaceSection`
  rewritten from line-scan-for-`## ` to a proper heading-depth parser.
  Anchor syntax: the full heading marker is passed — `"## Foo"`,
  `"### Evidence"`, `"#### Sub-point"`. Section terminates at next
  heading of same-or-shallower depth (a `### Evidence` section ends at
  the next `###` or `##`, not at the next `####`). Atomicity unit is the
  section itself — `updateSection` under a `###` anchor rewrites only
  that subsection, not the parent `##`.

- **D-07 (Anchor disambiguation):** When two subsections under different
  parents share a name (e.g., `### Evidence` under both `## Investigation
  2026-05-01` and `## Investigation 2026-05-05`), anchor resolution is
  document-order first-match. Callers that need the second match use a
  more specific anchor string (e.g., include surrounding heading text).
  Documented in ADR; conformance tests in Phase 7 cover the first-match
  contract.

- **D-08 (Edge cases):** Parser must skip headings inside fenced code
  blocks (\`\`\`\`text\n## Not a heading\n\`\`\`\`). Setext-style headings
  (\`Foo\n===\`) are NOT supported — GSD docs use ATX style only; detected
  setext raises a warning. Heading-like text inside `<!-- comments -->`
  is skipped.

### Multi-author concurrency (resolves OQ-10)

- **D-09 (updateSection internally withTransaction-wrapped):** Every
  `updateSection` call acquires the PID lockfile via an internal
  `withTransaction` wrap. Parallel callers serialize. Zero caller burden —
  AI-SPEC three-author workflow is safe under arbitrary reordering or
  interleaving without workflow-layer sequencing.

- **D-10 (Reentrant-lock guard):** `acquireAdapterLock` extended with a
  `lockSet` check (already tracks held locks). When `withTransaction` is
  called and the current file lock is already held by the same adapter
  instance, the call joins the outer txn (D-04) rather than re-acquiring.
  `recordStateAppend/Mutation/Signal` — which already wrap
  `withTransaction` — continue to work without deadlock when they call
  `updateSection` internally. ~10 LOC addition to `acquireAdapterLock`.

- **D-11 (BeadsAdapter mapping):** `withTransaction` maps to bd's native
  transaction mechanism (or no-op if bd has none at sibling-repo time);
  `updateSection` dispatches to per-section sub-record updates which
  inherit bd's per-issue atomicity. The "atomic updateSection" contract
  holds across both adapters via different mechanisms — MarkdownAdapter
  through file-level PID lock, BeadsAdapter through bd issue-edit
  atomicity. Phase 6 ships the mapping.

### putNamedDoc design (resolves PRIMITIVES-04 / ROADMAP §142)

- **D-12 (Primitive-first framing):** `putNamedDoc(category, key, body)`
  and `getNamedDoc(category, key)` are the primary named-doc contract.
  Phase 4's per-category SDK handlers (`named-docs.ts`, `codebase-docs.ts`,
  `tmp-docs.ts`) keep their typed SDK signatures but delegate path
  computation to the adapter primitive: internal calls to
  `adapter.putRecord(path)` become `adapter.putNamedDoc(category, key)`.
  Handlers remain thin wrappers (~5 LOC each) that layer workflow
  concerns (forensics timestamping, DECISIONS-INDEX.md fallback, codebase
  listing, tmp's relaxed validation) over the uniform primitive call.

- **D-13 (Category is a typed TypeScript union):**
  ```ts
  type NamedDocCategory =
    | 'research'
    | 'intel'
    | 'codebase'
    | 'archived-milestone'
    | 'reports'
    | 'sketches'
    | 'tmp'
    | 'root';
  ```
  The union is exported from `adapters/types.ts`. New categories require
  an interface change (intentional gate — prevents typo-driven drift).

- **D-14 (Root category + fixed-key discriminator):** Category `'root'`
  is reserved for singletons at `.planning/` root that are not
  collection-keyed. When `category === 'root'`, the `key` parameter is
  typed as a literal union: `'HANDOFF' | 'CONTINUE-HERE' |
  'DECISIONS-INDEX'` (no arbitrary strings accepted). Discriminated union
  signature:
  ```ts
  putNamedDoc(category: 'root', key: 'HANDOFF' | 'CONTINUE-HERE' | 'DECISIONS-INDEX', body: string): Promise<void>;
  putNamedDoc(category: Exclude<NamedDocCategory, 'root'>, key: string, body: string): Promise<void>;
  ```
  MarkdownAdapter path formula:
  `category === 'root' ? \`${key}.md\` : \`${category}/${key}.md\``
  BeadsAdapter maps `category` → issue label / sub-record type;
  `key` → issue summary or typed field.

- **D-15 (ROADMAP §142 acceptance):** After Phase 5 migration, SDK-surface
  grep for the legacy kind-tagged names (`getResearch`, `putIntelDoc`,
  `putCodebaseDoc`, `getArchivedMilestoneDoc`) returns zero call-sites.
  Phase-4 handlers may retain the external names as their registered SDK
  query verbs (backwards-compatible with workflows), but their internal
  `adapter.*` call MUST be the primitive.

- **D-16 (capabilities.namedDoc flips to true):** MarkdownAdapter's
  `Capabilities` object sets `namedDoc: true`. The `hasNamedDoc` type
  guard now reports true for MarkdownAdapter.

### writeBinaryAsset scope (resolves PRIMITIVES-05)

- **D-17 (Interface + MarkdownAdapter only; no consumer workflows):**
  Phase 5 implements `writeBinaryAsset(path, bytes)` on MarkdownAdapter
  (delegates to `fs.writeFile` with `Buffer` body) and flips
  `capabilities.binaryAsset: true`. No Phase-5 workflow consumes it —
  UI-review screenshots and sketch assets land in separate phases when
  those features build out. The capability is available as soon as Phase 5
  ships.

- **D-18 (Conformance stub for graceful degradation):** A conformance test
  stub asserts that a hypothetical adapter with `binaryAsset: false`
  triggers the documented graceful-degradation path (workflow logs warn +
  skips the write, does not throw). Tested against MarkdownAdapter with
  `capabilities.binaryAsset` temporarily monkeypatched to `false`; Phase 7
  fills in the real paired test against BeadsAdapter.

### Sidecar + scratch taxonomy (resolves OQ-05 + OQ-07)

- **D-19 (SDK-typed handlers, adapter stays Bin A — OQ-05):** Sidecar
  paths (`.planning/.next-call-count`) get dedicated SDK verbs: e.g.,
  `next-call-count.get`, `next-call-count.incr`. No new adapter methods —
  handlers internally call `adapter.getRecord`/`putRecord` against the
  known path. BeadsAdapter path-sniffs a tiny documented set (2-3 keys)
  — the set is closed and tracked in the BeadsAdapter README.

- **D-20 (Scratch artifacts are first-class noun-catalog types — OQ-07):**
  `*-DISCUSS-CHECKPOINT.json` and `*-QUESTIONS.json` / `*-QUESTIONS.html`
  are first-class types with dedicated SDK verbs (e.g.,
  `discuss.checkpoint.put/get/delete`, `discuss.questions.put/get/delete`).
  They live at `.planning/phases/NN-*/` alongside canonical phase
  artifacts (NOT under `.planning/tmp/`) — they are phase-scoped, not
  tmp-lifecycle. Lifecycle (create mid-workflow, read on resume,
  delete-on-commit) is orchestrated by the workflow layer; adapter only
  needs `getRecord`/`putRecord`/`removeRecord`.

- **D-21 (route-next-action.ts migration):** The existing raw
  `adapter.getRecord('.next-call-count')` call at
  `sdk/src/query/route-next-action.ts:44` is migrated to call the new
  SDK helper `nextCallCountGet` — path literals centralized in one
  place (`sdk/src/query/sidecar.ts` or similar).

### Claude's Discretion

- Plan count and sequencing — likely 5-7 plans given cross-cutting scope
  (withTransaction upgrade touches every mutating adapter method).
- Exact module layout for new SDK verbs (one `sidecar.ts` + `scratch.ts`,
  or fold into existing `route-next-action.ts` / `named-docs.ts`).
- Tmpdir location for the shadow-dir journal (`os.tmpdir()` vs
  `.planning/.tmp-txn/`).
- Whether the shadow-dir journal uses symlinks, hard-links, or copy-on-write
  for large files — subject to performance testing.
- Whether to ship a one-shot `gsd-sdk migrate-named-docs` script that
  rewrites callers, or hand-edit per SDK handler.
- Exact text of the ADRs appended to `.planning/DECISIONS.md` for OQ-02,
  OQ-05, OQ-07, OQ-10.
- Conformance test structure — extension of Phase 3's stubs or new
  test file per primitive.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (gsd-phase-researcher, gsd-planner) MUST read these
before researching or planning.**

### Project-locked architecture

- `.planning/PROJECT.md` — Fork architecture, two-repo model, strict-superset
  invariant, branch strategy.
- `.planning/DECISIONS.md` — Locked decisions D-2026-04-30-01..07 + Phase
  2/3/4 ADRs. **Phase 5 appends ADRs for OQ-02, OQ-05, OQ-07, OQ-10 and
  for the shadow-dir journal upgrade.**
- `.planning/STATE.md` — Current state; updates on Phase 5 context-gathered
  session.

### Prior phase outputs (locked, treat as carry-forward facts)

- `.planning/phases/01-fork-bootstrap-storageadapter-interface-skeleton-markdownada/01-CONTEXT.md`
  — D-02 (CJS stays untouched), D-07 (createRegistry DI), D-08
  (capabilities enum), D-10 (full v1.0 surface declared, foundational
  primitives throw UnsupportedCapabilityError), D-11 (type guards).
- `.planning/phases/02-wire-core-read-methods-to-adapter/02-CONTEXT.md`
  — D-10 (explicit adapter first parameter), D-12 (CJS bridge pattern).
- `.planning/phases/03-wire-core-write-methods-recordstateevent/03-CONTEXT.md`
  — D-01/D-02 (3 event families), D-04 (adapter interface stays thin),
  D-05 (shared SDK helper layer), D-07/D-08 (withTransaction as single
  concurrency primitive), D-09 (explicit-txn caller pattern), D-11/D-12
  (commitPlanningState required).
- `.planning/phases/04-plug-workflow-leaks-top-10-context-block-class/04-CONTEXT.md`
  — D-01 (Rewrite to SDK queries), D-09/D-10 (broad leak definition,
  full zero-leak state — MarkdownAdapter is the only code allowed to
  touch `.planning/` directly).

### Milestone scope

- `.planning/REQUIREMENTS.md` §"PRIMITIVES" — PRIMITIVES-01..09. Note
  Phase-5 scope includes PRIMITIVES-06 (multi-author concurrency via
  atomic updateSection — resolved by D-09 internal withTransaction wrap),
  PRIMITIVES-07 (section-vs-whole-file granularity — already locked
  "section is atomic" by Phase 3; D-06 extends to L3+ sections),
  PRIMITIVES-08 (sidecars named methods — D-19), PRIMITIVES-09 (scratch
  first-class — D-20).
- `.planning/ROADMAP.md` §"Phase 5" — Goal, Depends on (Phase 3),
  Resolves OQ-02/OQ-05/OQ-07/OQ-10, 5 Success Criteria (note SC#1 is the
  §9 HIGH-severity dry-run gate — mid-transaction failure leaves
  `.planning/` byte-identical).

### Architectural source-of-truth

- `.planning/research/fork-investigation/SYNTHESIS.md` — 6500 words.
  - **§4 (lines 520-533)** — Foundational primitive table (`updateSection`,
    `getSection`, `snapshot/restore` or `withTransaction`, `putNamedDoc/
    getNamedDoc`, `writeBinaryAsset`). Phase 5 implements all of these.
  - **§6 #3 (OQ-02)** — Section-vs-whole-file granularity. **Resolved:
    section is atomic (locked by Phase 3); D-06 extends to L3+ anchors.**
  - **§6 #4 (OQ-05)** — Sidecar paths kv-vs-named. **Resolved by D-19:
    named SDK verbs, adapter stays Bin A.**
  - **§6 #6 (OQ-07)** — Scratch record taxonomy. **Resolved by D-20:
    first-class SDK verbs co-located with phase artifacts.**
  - **§6 #9 (OQ-10)** — AI-SPEC three-author concurrency. **Resolved by
    D-09: updateSection internally withTransaction-wrapped.**
  - **§7 Phase 5** — "Implement `getSection`, `updateSection`,
    `snapshot/restore` (or `withTransaction`), `putNamedDoc/getNamedDoc`,
    `writeBinaryAsset`. Refactor section-scoped Bin B methods onto these
    primitives. Hoist `pipeline.js` dry-run to `withTransaction`."
  - **§9 Risk register** — HIGH: "Dry-run hoist non-trivial. Don't ship
    Phase 6 until dry-run is stable on MarkdownAdapter." **Phase 5 SC#1
    is the gate test.** HIGH: "Section-scoped semantics differ across
    adapters." **D-06 + Phase 7 conformance matrix mitigate.** MEDIUM:
    "Multi-author files imply concurrency." **D-09 mitigates.** MEDIUM:
    "Beads adapter can't model binary asset cleanly." **D-17 + D-18
    capability flag path.**

### Code surfaces Phase 5 touches

- **Adapter contract:**
  - `adapters/types.ts` — Export `NamedDocCategory` union (D-13); tighten
    `putNamedDoc` signature to discriminated overloads (D-14). No new
    methods; foundational primitives already declared in Phase 1.
  - `adapters/markdown/index.ts` — Upgrade `withTransaction` to shadow-dir
    journal (D-01); implement `snapshot`/`restore` as supporting methods
    (D-03); rewrite `extractSection`/`replaceSection` to walk heading depth
    (D-06); make `updateSection` internally `withTransaction`-wrapped
    (D-09); extend `acquireAdapterLock` with reentrant guard (D-10);
    implement `putNamedDoc`/`getNamedDoc` with category dispatch (D-12,
    D-14); flip `capabilities.namedDoc: true` (D-16); implement
    `writeBinaryAsset` (D-17); flip `capabilities.binaryAsset: true`;
    thread reads through shadow-dir merge when txn active (D-01 reads
    merge tmpdir-over-real).
  - `tests/conformance/` — add snapshot/restore stub, binaryAsset
    graceful-degradation stub (D-18), L3+ anchor section tests, reentrant
    txn tests.

- **SDK write surface:**
  - `sdk/src/query/pipeline.ts` — Replace `cp -r`/`copyPlanningTree`/
    double `readPlanningState` with `adapter.withTransaction(fn, { dryRun:
    true })`; diff from shadow-dir touched paths (D-02).
  - `sdk/src/query/named-docs.ts` — Delegate path computation in 5 handlers
    (reportPut/Get, handoffPut, continueHerePut, forensicsPut,
    decisionsIndexGet) to `adapter.putNamedDoc`/`getNamedDoc` (D-12).
    handoff/continueHere/decisionsIndex use category `'root'` (D-14).
  - `sdk/src/query/codebase-docs.ts` — Delegate codebasePut/Get/List to
    primitive with `category: 'codebase'`.
  - `sdk/src/query/tmp-docs.ts` — Delegate tmpPut/Get with `category: 'tmp'`.
  - `sdk/src/query/route-next-action.ts` — Replace raw
    `adapter.getRecord('.next-call-count')` at line 44 with new
    `nextCallCountGet` helper (D-21).
  - **New module:** `sdk/src/query/sidecar.ts` (or inline to route-next-action)
    — `nextCallCountGet`, `nextCallCountIncr` SDK verbs (D-19).
  - **New module:** `sdk/src/query/scratch.ts` —
    `discuss.checkpoint.put/get/delete`, `discuss.questions.put/get/delete`
    SDK verbs targeting `.planning/phases/NN-*/` (D-20).

- **Tooling:**
  - `scripts/leak-grep.cjs` — no changes expected (Phase 4 zero-leak
    invariant already covers everything Phase 5 touches).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`extractSection`/`replaceSection` helpers (adapters/markdown/index.ts
  ~lines 189-241)** — Current line-scan impl for `## anchors`. D-06
  rewrites these into a heading-depth walker. The line-by-line parse
  skeleton can stay; termination condition is what changes.

- **`acquireAdapterLock`/`lockSet` (adapters/markdown/index.ts line 103,
  called from `withTransaction` at line 321)** — PID-based lockfile with
  stale-lock cleanup and 10-retry backoff from Phase 3. D-10 extends
  `lockSet` with `activeTransaction?: TxnCtx` field for reentrancy.

- **`pipeline.ts collectFiles`/`copyPlanningTree`/`readPlanningState`/
  `diffPlanningState` (sdk/src/query/pipeline.ts 255 lines)** — Current
  `cp -r` based dry-run. D-02 replaces with shadow-dir txn; `diffPlanningState`
  survives (operates on the shadow's touched-paths set instead of a tmp
  clone).

- **Phase 4 per-category SDK handlers (349 LOC combined):**
  - `sdk/src/query/named-docs.ts` (171 LOC) — reportPut/Get, handoffPut,
    continueHerePut, forensicsPut, decisionsIndexGet, validateName helper.
  - `sdk/src/query/codebase-docs.ts` (96 LOC) — codebasePut/Get/List.
  - `sdk/src/query/tmp-docs.ts` (82 LOC) — tmpPut/Get with relaxed
    validation (allows subdirs).
  - All follow the same pattern: validate name → compute path via
    `planningRelativePath(workstream, category/{name}.md)` → call
    `adapter.putRecord/getRecord`. D-12 changes only the last step.

- **`sdk/src/query/route-next-action.ts:44`** — The one existing sidecar
  call site; direct `adapter.getRecord('.next-call-count')`. D-21 migrates.

- **`commitPlanningState` existing impl in MarkdownAdapter** — `git add`
  + `git commit`. D-05 makes this a no-op inside a dryRun:true txn.

### Established Patterns

- **Adapter interface stays thin (Phase 3 D-04):** Domain logic lives in
  SDK helpers. Phase 5 preserves this — `putNamedDoc` is a path-dispatch
  primitive, not a domain method. Category enum lives in adapter, but
  forensics timestamping and DECISIONS-INDEX fallback stay in SDK handlers.

- **Explicit adapter first parameter in helpers (Phase 2 D-10):** New SDK
  verbs in `sidecar.ts` / `scratch.ts` follow `(adapter: StorageAdapter,
  ...rest)` signature.

- **Capabilities flag gating (Phase 1 D-08):** Phase 5 flips
  `namedDoc: true`, `binaryAsset: true`, `snapshot: true`. Each flip
  requires the adapter methods to be real implementations (not
  UnsupportedCapabilityError throws).

- **Zero-leak invariant (Phase 4 D-09/D-10):** Only `adapters/markdown/`
  touches `.planning/` directly. Phase 5 must not regress this —
  `pipeline.ts` stops using `node:fs` for `.planning/` reads/writes;
  shadow-dir tmpdir logic may use `node:fs` against `os.tmpdir()` (outside
  `.planning/`) without triggering the gate.

### Integration Points

- **`adapters/types.ts`** — Export `NamedDocCategory` union; refine
  `putNamedDoc` signature. No other interface changes.
- **`sdk/src/query/index.ts` registry** — Register new SDK verbs for
  sidecar (`next-call-count.*`) and scratch (`discuss.checkpoint.*`,
  `discuss.questions.*`). Existing per-category handler registrations
  stay.
- **`adapters/markdown/index.ts`** — Largest Phase-5 diff; every mutating
  method gains shadow-dir awareness when a txn is active; `extractSection`/
  `replaceSection` rewrite; four stub-throw methods become real.
- **`sdk/src/query/pipeline.ts`** — Largest SDK diff; ~40 LOC replacement
  of the `cp -r` branch with a `withTransaction({ dryRun: true })` call.
- **`tests/conformance/`** — Extended with Phase-5 primitive tests
  (MarkdownAdapter only; paired tests land in Phase 7).

</code_context>

<specifics>
## Specific Ideas

- User chose **withTransaction rollback with shadow-dir journal** over
  snapshot/restore primitives — the single primitive covers both
  concurrency and rollback, maps to SQLite transaction semantics 1:1 for
  future adapters, and keeps the adapter surface tight. The shadow-dir
  mechanism is "what `cp -r` was simulating anyway, scoped to touched
  paths."

- User chose **depth-walking updateSection** (##, ###, ####) — keeps
  MarkdownAdapter and BeadsAdapter atomicity units aligned at whatever
  depth the caller targets; SYNTHESIS §4 row 527 explicitly names
  `### Evidence`, `### Threat Flags`, nested PLAN sections as recurring
  extraction targets, so L2-only would force awkward whole-parent
  rewrites.

- User chose **updateSection internally withTransaction-wrapped** for
  OQ-10 — safe-by-default matches the "thinking-partner-not-interviewer"
  philosophy; workflow authors never need to remember to wrap; AI-SPEC
  three-author scenario works under arbitrary reordering per SC§2. The
  ~10-LOC reentrant-lock guard is the only added complexity.

- User chose **primitive-first framing for putNamedDoc** (Option D)
  over additive — frames Phase 4 handlers explicitly as wrappers over
  the primitive, aligning with SYNTHESIS §4's "96 → ~60 methods" claim
  that foundational primitives collapse the implementation surface.

- User chose **synthetic `'root'` category with fixed-key literal union**
  over keeping HANDOFF/CONTINUE-HERE/DECISIONS-INDEX on raw `putRecord` —
  unified contract through a single primitive; the literal-union key
  preserves the grep-zero guarantee (can't pass arbitrary strings to
  `'root'`).

- User chose **SDK-typed handlers for sidecars + first-class scratch
  types** — adapter surface stays frozen for Phase 6 BeadsAdapter work;
  lifecycle stays at workflow layer; phase-scoped scratch lives at
  `.planning/phases/NN-*/` not `.planning/tmp/`.

</specifics>

<deferred>
## Deferred Ideas

- **BeadsAdapter `withTransaction` mapping** — Maps to bd's native txn
  mechanism or no-op if bd lacks one. Phase 6.

- **`snapshot()/restore()` as user-facing checkpoint API** — Phase 5
  scopes them to internal dry-run support. A future phase may surface
  them for manual save points, `commitPlanningState` alternates, or
  multi-step workflow undo.

- **UI-review screenshots and sketch HTML/CSS/PNG consumer workflows** —
  Phase 5 ships the `writeBinaryAsset` primitive + `capabilities.binaryAsset:
  true`. The consuming workflows land when those features build out
  (post-v1.0 or in separate phases).

- **Conformance suite paired tests (MarkdownAdapter + BeadsAdapter)** —
  Phase 7. Phase 5 adds MarkdownAdapter-only stubs.

- **BeadsAdapter sidecar/scratch path-sniff map** — Phase 6 BeadsAdapter
  README documents the closed set of 2-3 sidecar keys it pattern-matches.

- **ROADMAP §142 grep verification script** — Automated check that
  legacy kind-tagged names (`getResearch`, `putIntelDoc`, `putCodebaseDoc`,
  `getArchivedMilestoneDoc`) return zero SDK-surface call-sites. Could
  fold into leak-grep or stand alone. Planner's call.

- **Setext heading support** — GSD uses ATX; setext raises a warning in
  D-08. If user-imported content has setext, Phase-N future work can
  add a migration script.

- **Category-enum growth procedure** — Adding a new `NamedDocCategory`
  member requires interface change. If growth becomes common, introduce
  a registration mechanism; for v1.0 the intentional friction is a
  feature (prevents typo drift).

- **`commitPlanningState` no-op semantics inside dryRun txns** — D-05
  documents this; a follow-up ADR in `.planning/DECISIONS.md` ties it
  to the OQ-01 resolution.

</deferred>

---

*Phase: 05-foundational-primitive-lift*
*Context gathered: 2026-05-10*
