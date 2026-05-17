# Phase 7: Conformance test suite - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 delivers a **paired conformance test suite** that runs every
StorageAdapter behavior against BOTH MarkdownAdapter (fork) AND BeadsAdapter
(sibling `/Volumes/code/gsd-beads`), proving equivalent outcomes and closing
SYNTHESIS §9's "section-scoped semantics differ across adapters" HIGH-severity
risk through enforced coverage rather than convention.

### What Phase 7 does

**Fork-side (majority of work, this repo):**

- **Wire BeadsAdapter into fork CI.** Add `"gsd-beads": "file:../gsd-beads"`
  to fork `devDependencies`. Fork CI installs bd v1.0.4+ from release binary;
  paired tests skip cleanly if bd is absent locally (developer convenience).
  Import BeadsAdapter + its conformance factory from sibling.
- **Extend the conformance harness to paired execution.** Author a new top-
  level `tests/conformance/paired.test.ts` that calls
  `runAdapterConformanceSuite('markdown', markdownFactory)` and
  `runAdapterConformanceSuite('beads', beadsFactory)` side-by-side. Existing
  ~2766 LOC of MarkdownAdapter-only conformance files stay as the
  single-adapter reference.
- **Author `CONFORMANCE_MANIFEST`.** A typed const in
  `tests/conformance/manifest.ts` enumerating: every Bin B method, every
  (record-type, section-id, mode) tuple, every noun-catalog record type.
  Each entry carries a per-adapter `expected` annotation so documented
  deviations (e.g. D-2026-05-12-OQ06-CREATED-SECTION) are baked into the
  contract, not silent.
- **Ship the coverage meta-test.** A single test file
  (`tests/conformance/meta-coverage.test.ts`) that fails CI if any manifest
  entry lacks a corresponding describe block on any adapter, OR if any
  `adapter.updateSection` / `adapter.getSection` call site in the SDK uses a
  dynamic (non-string-literal) anchor without manifest registration.
- **Section-semantics matrix population via grep.** A script (likely
  `scripts/extract-section-anchors.mjs`) greps fork SDK + workflows for
  `adapter.updateSection(...)` / `adapter.getSection(...)` call sites,
  extracts string-literal anchors, cross-references them with Phase 5's
  canonical-file schemas, writes the section-tuple subset of the manifest.
  Dynamic-anchor callers fail the grep-gate unless registered manually.
- **Property-based round-trip tests (fast-check).** Add `fast-check` as
  devDep. Author per-noun arbitraries (`arbPhase`, `arbPlan`, `arbSummary`,
  `arbUat`, `arbStateEvent`, `arbRoadmap`, `arbDecision`, `arbBlocker`,
  `arbDebugSession`, `arbProject`, `arbSpec`, `arbAiSpec`). Assert
  `normalize(input) === adapter.getRecord(after adapter.putRecord(input))`
  where `normalize` is an adapter-surface method (additive contract change
  — see D-06). Runs with adaptive time budget per noun per adapter.
- **Failure-injection tests (CONFORM-04).** Within a `withTransaction`, the
  caller `fn` throws mid-txn after 2-of-3 writes. Assert rollback
  equivalence: MarkdownAdapter shows byte-identical `.planning/` via
  snapshot diff; BeadsAdapter shows `bd export --json`-diff-identical store
  via snapshot-before vs snapshot-after comparison (modulo non-semantic
  metadata). BeadsAdapter's known Outcome A commit-replay gap
  (Deferred-04) is formally baked into the manifest as an `expected`
  deviation — see D-09.
- **Cross-adapter runtime regression checks.** Lightweight wall-clock
  assertions (vitest timing) catch catastrophic regressions on either
  adapter without becoming flaky.
- **Extend fork `package.json` scripts.** Add `test:conformance:paired`
  script invoking the paired file only; `test:conformance` retains the
  existing MarkdownAdapter-only behavior for fast PR feedback.

**Additive contract change (ADR'd):**

- Add optional `normalize(body: string, category?: string): string` method
  to `StorageAdapter` (per D-06). MarkdownAdapter returns body unchanged.
  BeadsAdapter applies its `section.ts` rewrite + `frontmatter.ts`
  canonicalize round-trip. Surfaces the adapter-defined normalization
  contract as API, benefits Phase 8 migration tool.

**Sibling-side (minimal footprint, `/Volumes/code/gsd-beads`):**

- **Export testing factory via subpath.** Add `./testing` entry to
  `package.json` exports pointing at
  `dist/testing/conformance-factory.js` (or equivalent). Fork imports the
  factory; single source of truth for bd init discipline (git init + seed
  copy + `bd init --from-jsonl` + `BEADS_ACTOR=seed` + `chmod 0o700`).
- **Delete `tests/conformance.test.ts`.** Sibling's standalone conformance
  invocation is consolidated to fork. Sibling retains
  `tests/smoke/` + `tests/unit/` + `tests/fixture.ts` for
  bd-primitive-level unit testing only.
- **Implement `normalize()`.** BeadsAdapter's normalize composes
  `parseSection → formatSection` + `parseFrontmatter → formatFrontmatter`
  for the blob round-trip it already does on read.

### What Phase 7 does NOT do

- **Modify adapter behavior.** The only contract change is additive
  `normalize()`. Neither adapter's write/read behavior changes.
- **Close the Outcome A commit-replay gap.** Phase 7 documents and tests
  around the gap (Deferred-04); a potential Phase 6.1 addresses it if
  priority surfaces.
- **Ship the markdown→bd migration tool (DIST-02).** Phase 8.
- **Ship the adapter-name runtime resolver (DIST-01).** Phase 8. Phase 7
  imports BeadsAdapter statically by name from the devDep.
- **Validate upstream golden parity (#2909 SC#1).** Phase 8 (superseded per
  existing Phase 1 CONTEXT D-13).
- **Re-author the MarkdownAdapter conformance tests.** Existing ~2766 LOC
  under `tests/conformance/` stays unchanged except for moving per-test
  assertions into manifest entries where coverage-meta-test demands it.
- **Add a GraphAdapter sub-interface.** Out of scope per D-OQ06.
- **Ship value-equivalence assertions beyond the noun catalog.** If a
  phase introduces a new noun, that phase's work includes the arbitrary +
  manifest entry + paired test.

</domain>

<decisions>
## Implementation Decisions

### Test-repo topology

- **D-01 (Fork runs both adapters):** Fork CI is the single authoritative
  conformance gate. Paired suite invokes
  `runAdapterConformanceSuite('markdown', markdownFactory)` and
  `runAdapterConformanceSuite('beads', beadsFactory)` side-by-side. Sibling
  CI keeps bd-primitive smoke/unit tests only; no standalone conformance
  invocation survives Phase 7.

- **D-02 (Wiring via `file:../gsd-beads` devDep):** Fork
  `package.json` gains `"gsd-beads": "file:../gsd-beads"` under
  `devDependencies`. Mirrors sibling's existing pattern (`"get-shit-done-cc":
  "file:../get-shit-done"`). No workspace ceremony; no submodule. Requires
  local developers and CI runners to have `../gsd-beads` checked out
  alongside the fork. Rebase-risk mitigation: the new devDep is a
  single-line, adapter-interface-seam change; won't conflict with upstream
  business logic.

- **D-03 (bd installed from release binary in CI):** Fork CI adds a
  workflow step installing bd v1.0.4+ from GitHub release tarball (or brew
  on macOS runners). A `bd --version` probe runs before the paired suite;
  paired tests skip with a documented warning if bd is absent (local
  developer convenience); paired tests fail if bd < v1.0.4 (version
  mismatch). Vendoring bd binaries into the fork is REJECTED — bloat +
  license concerns.

- **D-04 (Sibling exports testing factory via `./testing` subpath):**
  Sibling `package.json` gains `"./testing"` entry resolving to
  `dist/testing/conformance-factory.js` (or equivalent path per sibling
  build). Fork imports: `import { createBeadsAdapter } from
  'gsd-beads/testing'`. Single source of truth for bd init discipline
  (Landmines 9 + 11 encoded once). The factory already exists in
  `/Volumes/code/gsd-beads/tests/conformance.test.ts`; Phase 7 sibling-side
  work extracts it to a proper testing subpath.

- **D-05 (Sibling conformance deletion):** After fork paired suite proves
  equivalence, sibling deletes `tests/conformance.test.ts`. Reasoning: two
  invocation sites of the same harness is redundant maintenance burden;
  fork is the canonical gate per D-01. Sibling's `tests/smoke/` and
  `tests/unit/` stay — they test bd-primitive behaviors below the adapter
  surface and don't overlap.

### Pairing enforcement mechanism

- **D-06 (Authored conformance manifest):** A typed TypeScript const
  `CONFORMANCE_MANIFEST` lives in
  `tests/conformance/manifest.ts`. Shape:
  ```ts
  type ManifestEntry = {
    kind: 'binB' | 'section-tuple' | 'noun-roundtrip';
    name: string;              // e.g. 'addPhase', 'ROADMAP.md#Phases:append', 'Phase'
    expected: {
      markdown: ExpectedOutcome;
      beads: ExpectedOutcome;
    };
    adr?: string;              // ADR citation for adapter-specific deviations
  };
  export const CONFORMANCE_MANIFEST: readonly ManifestEntry[] = [...];
  ```
  Every entry MUST have both adapter expectations populated. The meta-test
  asserts: (a) every manifest entry has a corresponding describe block in
  the paired suite; (b) no describe block exists without a manifest entry
  (prevents orphan tests). Adding a new Bin B method requires both sides
  — the manifest entry AND the test.

- **D-07 (Per-adapter `expected` annotation for deviations):** Documented
  adapter-specific deviations live in the manifest, not in skip comments.
  Example: the BeadsAdapter `created_section` deviation per
  `D-2026-05-12-OQ06-CREATED-SECTION` appears as
  ```ts
  { kind: 'binB', name: 'recordStateMutation:updateSection-new-anchor',
    expected: {
      markdown: { applied: true, created_section: 'path/to/#Anchor' },
      beads:    { applied: true }, // no created_section per Outcome A
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION' }
  ```
  The paired-assertion helper reads the suite label (`adapterName`) and
  asserts that adapter's documented expected outcome. Third-party adapters
  MUST add their own expectation rows or the meta-test fails.

- **D-08 (Section-tuple discovery via grep + dynamic-anchor gate):** A
  script greps fork SDK + workflows for
  `adapter.(updateSection|getSection)\(...\)` call sites. String-literal
  anchors populate the section-tuple subset of the manifest automatically
  (with append/overwrite/prepend modes per Phase 5 D-06). Dynamic anchor
  calls (any non-string-literal second argument) emit a CI warning with
  the rule: **dynamic anchors must either be refactored to string
  literals at the call site, OR registered manually in the manifest with
  a justification comment.** Forces the tradeoff to be deliberate. Runtime
  trace instrumentation is REJECTED — adds complexity; grep + gate catches
  the common case.

### CONFORM-04 disposition

- **D-09 (Document known-gap; ship Phase 7):** Phase 6 shipped
  withTransaction Outcome A on BeadsAdapter (per Phase 6 D-TXN-SPIKE
  Outcome A). Known gap: mid-commit-replay failure after N-of-M buffered
  writes are replayed as sequential bd issue edits leaves bd partially
  committed on the Nth issue (Deferred-04, Deferred-05). Phase 7 bakes
  this into the manifest as a `kind: 'binB'` entry with
  `expected: { markdown: {rollback: 'byte-identical'},
  beads: {rollback: 'incomplete-per-Deferred-04', adr: '...'} }`.
  Phase 7 ships v1.0 with the known-gap formally recorded; a potential
  Phase 6.1 addresses the gap only if priority surfaces. Blocking
  Phase 7 on Outcome B/C re-implementation is REJECTED — Outcome A works
  for typical single-write-path usage; the gap is rare.

- **D-10 (Failure injection = throw from inside withTransaction fn):**
  Test pattern:
  ```ts
  await expect(adapter.withTransaction(async () => {
    await adapter.putRecord('a.md', 'x');
    await adapter.putRecord('b.md', 'y');
    throw new Error('boom');
  })).rejects.toThrow('boom');
  // assert: a.md and b.md do not exist / bd store unchanged
  ```
  Uses the real adapter surface, no monkey-patch, matches typical user
  code paths. Adapter-injected `__forceFailAfterNWrites` is REJECTED —
  it tests the commit-replay path specifically but requires adding a
  test-only hook to the adapter; the known Outcome A gap manifests in the
  natural throw case too. A dedicated "commit-replay mid-failure" test
  file documents the Outcome A gap explicitly but doesn't use
  adapter-internal hooks.

- **D-11 (BeadsAdapter rollback check via `bd export --json` diff):**
  Pre-txn: capture `bd export --json` snapshot S1. Post-rollback: capture
  S2. Assert S1 === S2 modulo non-semantic metadata (e.g. seed-record
  timestamps). MarkdownAdapter uses `.planning/`-tree byte-diff (SHA-256
  per file + aggregate). Both adapters have a record-identity equivalence
  of "state looks the same as before". Adapter-mediated
  `readPlanningState` diff is REJECTED — would hide adapter-internal
  drift (bd memory-index inconsistency) that the adapter's own reads
  smooth over.

### Property-based test strategy

- **D-12 (fast-check with per-noun arbitraries):** Add
  `fast-check@^3` as devDep. Author one arbitrary per noun-catalog record
  type in `tests/conformance/arbitraries/`:
  - `arbPhase` — ROADMAP.md phase entry (goal, depends_on,
    requirements[], success_criteria[], tail).
  - `arbPlan` — PLAN.md (frontmatter `must_haves`, waves, tasks).
  - `arbSummary`, `arbUat`, `arbStateEvent` (discriminated union over
    AppendEvent + MutationEvent + SignalEvent), `arbRoadmap`,
    `arbDecision`, `arbBlocker`, `arbDebugSession`, `arbProject`,
    `arbSpec`, `arbAiSpec`.
  - Each arbitrary produces a legal record shape (within Phase 5
    schema constraints) and exercises unicode, fencing, empty-string,
    deep-nesting edge cases. Hand-written exhaustive cases per noun is
    REJECTED — generative coverage catches edge cases imagination misses.

- **D-13 (Adapter-exposed `normalize()` method — additive contract):**
  Extend `StorageAdapter` with:
  ```ts
  /** Canonicalize body per the adapter's storage normalization.
   *  MarkdownAdapter returns body unchanged. BeadsAdapter applies
   *  section + frontmatter round-trip. */
  normalize(body: string, category?: string): string;
  ```
  Property test assertion:
  `expect(await adapter.getRecord(path)).toBe(adapter.normalize(input))`.
  Record an ADR (tentatively `D-2026-05-12-NORMALIZE`) in
  `.planning/DECISIONS.md`. Additive, non-breaking contract change
  following D-OQ06-CAPS precedent. MarkdownAdapter's normalize is
  `(body) => body` (identity). BeadsAdapter composes `parseSection →
  formatSection` + `parseFrontmatter → formatFrontmatter`. Also benefits
  Phase 8 migration tool (can apply normalize before the markdown→bd
  seed step). Per-noun `recordEq` in tests-only is REJECTED — loses the
  API exposure for Phase 8.

- **D-14 (Adaptive iteration budget):** Property test runner uses a
  time-budget strategy: `fast-check.assert(prop, { numRuns: Infinity,
  endOnFailure: true, interruptAfterTimeLimit: 60_000 })` per noun per
  adapter. CI runs as many iterations as fit in 60 seconds per tuple
  (typically 10–50 for BeadsAdapter given bd cold-start, 200+ for
  MarkdownAdapter). Failed cases shrink + report; successful runs log
  iteration count for observability. Uniform 100 iterations per tuple
  is REJECTED (20–28 minute CI runs kill developer feedback loops).
  Tiered 10-in-CI / 100-nightly is REJECTED — adaptive captures both
  strategies' benefits without two CI configurations to maintain.

### Claude's Discretion

- **Plan count and wave structure.** Likely 4–6 plans. Candidate waves:
  1. Manifest scaffold + meta-coverage test + section-anchor grep script
     (foundation — no adapter dep).
  2. Normalize() ADR + MarkdownAdapter normalize impl + StorageAdapter
     contract extension (adapter-side work, fork-only).
  3. Sibling `./testing` subpath export + BeadsAdapter normalize impl
     (sibling-side additive changes — BeadsAdapter-only).
  4. Fork devDep wiring + bd install in CI + paired harness invocation
     (integration — requires sibling exports to exist).
  5. Property-based arbitraries + round-trip tests (12 nouns; may split
     into 2 plans by noun count).
  6. CONFORM-04 failure-injection tests + rollback diff helpers +
     BeadsAdapter known-gap manifest entries (requires paired harness
     wired).

- **Manifest file organization.** Single `manifest.ts` vs split per kind
  (`binB-manifest.ts` + `section-manifest.ts` + `noun-manifest.ts`).
  Planner's call; single file is simpler until grep-extracted section
  tuples push LOC >500.

- **Arbitrary depth for fast-check.** Default shrinking / size settings vs
  explicit `fc.option.fc.maxLength(...)` caps per noun. Experimentation;
  keep shrinking outputs under 100 lines for readability.

- **bd install CI step shape.** Install-on-every-job vs cached bd binary
  in GitHub Actions cache vs install-once-per-matrix. Profile-dependent.

- **Sibling `./testing` export path.** `dist/testing/index.js`,
  `dist/testing/conformance-factory.js`, or subpath per sibling's build
  convention. Sibling planner's call.

- **Snapshot metadata exclusions for BeadsAdapter diff.** Which fields
  to strip before `bd export --json` compare (e.g. `last_modified` on
  unchanged records). Conservative: strip nothing; let real equivalence
  speak. Aggressive: strip known-volatile fields per Landmine discipline.

- **Fast-check version pin policy.** `^3` gives minor updates; `~3.x.0`
  pins more tightly. Low-risk dev dep; `^3` is fine.

- **Section-tuple grep implementation language.** Shell / node script /
  TS script. Planner's call; TS script (runnable via tsx) integrates
  cleanly with the rest of the tooling.

- **BeadsAdapter normalize() internal composition.** Whether it reuses
  sibling's existing description-blob parse/format path, or authors a
  dedicated normalize path. Implementation detail; sibling planner's
  call.

### Folded Todos

None. Todo matcher returned zero matches for Phase 7.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (gsd-phase-researcher, gsd-planner) MUST read these
before researching or planning.**

### Project-locked architecture

- `.planning/PROJECT.md` — Fork architecture, two-repo model
  (D-2026-04-30-02), strict-superset invariant, branch strategy. Phase 7
  spans BOTH repos — paired conformance lives in fork; sibling exports a
  testing subpath.
- `.planning/DECISIONS.md` — Locked decisions D-2026-04-30-* +
  D-2026-05-01-* + D-2026-05-10-* + D-2026-05-12-*. **Phase 7 appends
  ADRs for:**
  - D-07 deviations: the per-adapter `expected` contract.
  - D-13 `normalize()` additive contract (citation from Phase 6 D-OQ06-
    CAPS precedent for additive non-breaking extensions).
  - D-09 CONFORM-04 known-gap formally baked as expected deviation.
  - Conformance-manifest shape + section-anchor grep-gate rule.
- `.planning/STATE.md` — Current state; Phase 6 complete (2026-05-12,
  Plan 06-06/06-07 shipped; 71/71 smoke tests green on BeadsAdapter).

### Prior phase outputs (locked, treat as carry-forward facts)

- `.planning/phases/05-foundational-primitive-lift/05-CONTEXT.md` — D-01
  (shadow-dir journal = MarkdownAdapter withTransaction strategy),
  D-06 (L2/L3/L4 heading-depth walker — section-tuple manifest anchors
  MUST match depth resolution), D-09 (updateSection internally
  withTransaction-wrapped — property test ordering invariant),
  D-13/D-14 (`NamedDocCategory` closed union — nouns arbitrary must
  respect), D-17/D-18 (writeBinaryAsset primitive + graceful
  degradation — paired suite skips when
  `!hasBinaryAsset(adapter)`), D-19/D-20 (sidecar + scratch as
  first-class SDK-typed verbs — NOT new arbitraries; tested at SDK
  level not adapter level).
- `.planning/phases/06-beadsadapter-implementation/06-CONTEXT.md` —
  D-MAPPING (Outcome A labels-first + description-blob shipped),
  D-TXN-CAPS (capabilities.transaction: true; capabilities.snapshot:
  false on Outcome A), D-OQ06 / D-OQ06-CAPS (graphEdges additive
  contract precedent for Phase 7 normalize() extension),
  D-CONFORM-EXPORT (fork's `./conformance` subpath; Phase 7 mirrors
  with sibling's `./testing` export), D-RUNTIME-RESOLUTION (BeadsAdapter
  dual export shape).
- `.planning/phases/06-beadsadapter-implementation/deferred-items.md` —
  Deferred-04 (mid-txn commit-replay gap — CONFORM-04 D-09 target),
  Deferred-05 (CONFORM-04 known-gap flag — now explicit in manifest
  per D-09), Deferred-03 (bd v1.0.4 empty-store shape — handled by
  sibling's BdRunner; relevant to paired test environment setup).
- ADRs `D-2026-05-10-08` (StateWriteOutcome three-state contract —
  Phase 7 asserts the 16-case matrix on both adapters per Phase 3
  Plan 03-06; already partial in `write-outcome.test.ts`),
  `D-2026-05-12-OQ01-BEADS` (commitPlanningState NOOP on BeadsAdapter —
  manifest deviation entry),
  `D-2026-05-12-OQ06-CREATED-SECTION` (BeadsAdapter Outcome A never
  emits `created_section` — manifest `expected.beads` vs
  `expected.markdown`),
  `D-2026-05-12-OQ06-MAPPING` (D-MAPPING Outcome A locked),
  `D-2026-05-12-OQ06-TXN` (D-TXN Outcome A locked).

### Milestone scope

- `.planning/REQUIREMENTS.md` §"CONFORM" — CONFORM-01..04. CONFORM-04
  treated per D-09 (known-gap manifest entry). CONFORM-01 enforced by
  D-06 (authored manifest) + meta-coverage test. CONFORM-02 delivered
  by D-12 + D-13 (fast-check arbitraries + normalize-modulo equality).
  CONFORM-03 delivered by D-06 + D-08 (manifest section-tuple subset
  + grep gate for dynamic anchors).
- `.planning/ROADMAP.md` §"Phase 7" — 4 Success Criteria. SC#1 (zero
  failing assertions across both adapters) = exit gate. SC#2
  (property-based round-trips + CI gate on new nouns) = D-12 + manifest
  meta-test. SC#3 (section-semantics matrix enforcement) = D-06 + D-08.
  SC#4 (failure injection byte-identical / record-identical) = D-09 +
  D-10 + D-11.

### Architectural source-of-truth

- `.planning/research/fork-investigation/SYNTHESIS.md` — 723 lines.
  - **§4** — Adapter interface (Bin A + foundational + ~58 Bin B).
    Phase 7 conformance asserts equivalence of every method on the
    shipped surface.
  - **§7 Phase 7** — "Each Bin B method gets a paired test that runs
    against both adapters and asserts equivalent outcomes. Property-
    based tests for round-trips. Verify dry-run primitive correctness
    on both adapters." Phase 7 delivers all three.
  - **§9 Risk register** — HIGH "section-scoped semantics differ" —
    mitigated by D-06 + D-08 (enforced manifest + grep gate).
    HIGH "dry-run hoist" — mitigated on MarkdownAdapter by Phase 5
    SC#1; mitigated on BeadsAdapter with documented Outcome A gap per
    D-09.

### Adapter contract (post-Phase-5/6 lock, Phase-7 additive extension)

- `adapters/types.ts` — 159 lines. Locked StorageAdapter contract
  (Phase 1 lock + Phase 5 primitive implementations + Phase 6 additive
  `graphEdges` per D-OQ06-CAPS). **Phase 7 adds:** optional
  `normalize(body: string, category?: string): string` method per
  D-13. Record ADR in DECISIONS.md; update type signatures; both
  adapters implement.
- `adapters/markdown/index.ts` — 1452 lines. Reference implementation
  for equivalence. Phase 7 adds: `normalize(body) { return body; }`
  (identity — MarkdownAdapter's storage is byte-preserving).
- `adapters/state-event-types.ts` — AppendEvent/MutationEvent/
  SignalEvent discriminated unions. `arbStateEvent` in D-12
  generates instances of these unions; fast-check arbitrary is a
  `fc.oneof(...)` over the three families with per-family payload
  generators.

### Conformance harness + existing test corpus (~2766 LOC)

- `tests/conformance/adapter.conformance.ts` — 89 LOC. Factory harness.
  `runAdapterConformanceSuite(adapterName, adapterFactory)` signature
  LOCKED (Phase 1 D-15). Phase 7 does NOT change this signature;
  adds paired invocation alongside, not inside.
- `tests/conformance/markdown.conformance.test.ts` — 7 LOC. Reference
  consumer pattern; Phase 7 authors `paired.test.ts` in the same style
  with two invocations.
- `tests/conformance/write-outcome.test.ts` — 453 LOC. Already tests
  the 16-case StateWriteOutcome matrix on MarkdownAdapter. Phase 7
  extends to run against BeadsAdapter with D-07 deviations for
  `created_section` cases per D-2026-05-12-OQ06-CREATED-SECTION.
- `tests/conformance/write-events.test.ts` — 480 LOC. AppendEvent /
  MutationEvent / SignalEvent dispatch tests. Already covers all three
  families; paired extension exercises sibling's native mappings per
  Phase 6 D-MAPPING Outcome A.
- `tests/conformance/write-transaction.test.ts` — 224 LOC. Already
  tests withTransaction commit + rollback on MarkdownAdapter. Phase 7
  D-09 CONFORM-04 failure-injection extensions build on this file
  and/or add `paired-transaction.test.ts` for BeadsAdapter deviations.
- `tests/conformance/section-depth.test.ts` — 202 LOC. L2/L3/L4 anchor
  tests per Phase 5 D-06. Paired extension requires BeadsAdapter-side
  anchor-tagged-comment support (already shipped per Phase 6 D-MAPPING
  Outcome A via format/section.ts).
- `tests/conformance/named-doc.test.ts` — 101 LOC. Category dispatch
  tests. Paired extension exercises `category: 'root'` discriminator
  on both adapters.
- `tests/conformance/binary-asset.test.ts` — 73 LOC. Graceful-
  degradation stub. Paired extension asserts BeadsAdapter throws
  UnsupportedCapabilityError; MarkdownAdapter writes successfully.
- `tests/conformance/commit-planning-state.test.ts` — 86 LOC. Phase 7
  D-07 adds BeadsAdapter NOOP deviation per D-2026-05-12-OQ01-BEADS.
- `tests/conformance/document-reads.test.ts` — 207 LOC;
  `tests/conformance/init-bundlers.test.ts` — 369 LOC;
  `tests/conformance/phase-reads.test.ts` — 392 LOC;
  `tests/conformance/helpers.test.ts` — 74 LOC;
  `tests/conformance/stat.test.ts` — 9 LOC.
  All need paired extensions OR migration to the manifest-driven
  structure.

### Sibling state + sibling-side carry-forward

- `/Volumes/code/gsd-beads` @ `main` (post-Phase-6, 71/71 smoke tests
  green). BeadsAdapter feature-complete per Phase 6 Plan 06-06/06-07
  (zero NotYetImplementedError throw-stubs; withTransaction Outcome A;
  graphEdges dep-graph synthesizer).
- `/Volumes/code/gsd-beads/tests/conformance.test.ts` — 96 LOC.
  Existing standalone BeadsAdapter factory + invocation. Phase 7
  extracts the factory to a `./testing` subpath export and DELETES
  this file.
- `/Volumes/code/gsd-beads/tests/fixture.ts` — setupFreshAdapter
  utility with Landmines 9 + 11 discipline encoded (`chmodSync 0o700`,
  `BEADS_ACTOR=seed`). Phase 7 factory export is derived from this.
- `/Volumes/code/gsd-beads/tests/smoke/*.test.ts` — 8 per-Bin-B-
  category smoke tests. Retained post-Phase-7; bd-primitive level
  tests that don't overlap with paired conformance.
- `/Volumes/code/gsd-beads/package.json` — current exports:
  `"."`, `"./package.json"`. Phase 7 adds `"./testing"`.
- `/Volumes/code/gsd-beads/src/index.ts` — BeadsAdapter class
  (named + default exports per Phase 6 D-RUNTIME-RESOLUTION).
  Phase 7 adds `normalize()` method.

### Spike carry-forward (documentation; skill)

- `./.claude/skills/spike-findings-gsd-beads/` — 6 files, 2696 lines.
  Phase 7-relevant sections:
  - `bd-primitives.md` — bd CLI catalog; relevant to CI install step
    and paired-test bd invocation shape.
  - `conformance.md` — harness patterns carried forward to the fork
    (auto-invoke gate, fixture.mjs pattern, BEADS_ACTOR=seed
    discipline for byte-identity rollback checks per D-11).
  - `landmines.md` — Landmines 9 (chmod 0o700) + 11 (BEADS_ACTOR=seed)
    encoded in the factory via D-04 sibling subpath export.

### Open questions this phase resolves

- **None.** SYNTHESIS §6 OQ-01..OQ-10 are all resolved as of Phase 6
  (OQ-01 per D-2026-05-12-OQ01-BEADS; OQ-06 per D-OQ06). Phase 7 is
  enforcement of prior decisions, not new decisions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (fork-side)

- **`tests/conformance/adapter.conformance.ts`** (89 LOC) — Locked
  factory harness. Phase 7 authors `paired.test.ts` invoking it twice;
  doesn't modify the signature.
- **`tests/conformance/write-outcome.test.ts`** (453 LOC) — Already
  enumerates the 16-case StateWriteOutcome matrix. Structural precedent
  for the manifest — each case is a documented tuple with expected
  outcome. Phase 7 migrates these enumerations into the manifest shape
  and adds BeadsAdapter expectations per D-07.
- **`tests/conformance/write-events.test.ts`** + **`write-transaction.test.ts`** —
  Already exercise the 3 recordState* families + withTransaction commit/
  rollback on MarkdownAdapter. Paired extensions add BeadsAdapter
  invocations + per-case D-07 deviations.
- **`tests/conformance/markdown.conformance.test.ts`** (7 LOC) — Pattern
  reference for consumer invocation. Phase 7's `paired.test.ts` follows
  this style:
  ```ts
  import { runAdapterConformanceSuite } from './adapter.conformance.js';
  import { MarkdownAdapter } from '../../adapters/markdown/index.js';
  import { createBeadsAdapter } from 'gsd-beads/testing';
  runAdapterConformanceSuite('markdown', (dir) => new MarkdownAdapter(dir));
  runAdapterConformanceSuite('beads', createBeadsAdapter);
  ```
- **`adapters/markdown/index.ts`** — Implementation. Phase 7 adds
  `normalize()` method (single-line return-identity).
- **`adapters/types.ts`** — Contract. Phase 7 adds
  `normalize()` signature; touches the locked interface.

### Reusable Assets (sibling-side)

- **`/Volumes/code/gsd-beads/tests/conformance.test.ts`** (96 LOC) —
  Proven BeadsAdapter factory with bd init discipline. Phase 7 extracts
  this factory to a `./testing` subpath export and deletes the file.
- **`/Volumes/code/gsd-beads/tests/fixture.ts`** — setupFreshAdapter
  helper. Landmines 9 + 11 encoded. Used by smoke tests post-Phase-7;
  conformance factory is the subpath export.
- **`/Volumes/code/gsd-beads/tests/fixtures/seed.jsonl`** — deterministic
  seed per CONF-03 byte-identity invariant (BEADS_ACTOR=seed built).
  Used by the factory at `bd init --from-jsonl` time.
- **`/Volumes/code/gsd-beads/src/format/section.ts`** + `frontmatter.ts` —
  Ported format modules. BeadsAdapter's `normalize()` composes
  these (parse → format round-trip).
- **`/Volumes/code/gsd-beads/src/index.ts`** — BeadsAdapter class
  with Capabilities + 10 Bin A + foundational + 3 recordState*
  families. Phase 7 adds `normalize()` method; no other behavior
  changes.

### Established Patterns (this milestone's discipline)

- **Adapter stays thin** (Phase 3 D-04): Phase 7 adds only `normalize()`
  to the adapter surface; any domain logic lives in SDK helpers or test
  helpers. Paired-assertion helpers (manifest lookup + expected-outcome
  dispatch) live in `tests/conformance/`, not on the adapter.
- **Capabilities gate optional features** (Phase 1 D-08): Paired suite
  uses `hasSnapshot(adapter)` / `hasBinaryAsset(adapter)` / etc. to
  skip tests for capabilities an adapter declares unsupported.
  BeadsAdapter's `capabilities.binaryAsset: false` skips writeBinaryAsset
  conformance; `capabilities.snapshot: false` skips snapshot conformance;
  etc.
- **StateWriteOutcome three-state discipline** (D-2026-05-10-08): Every
  recordState* test asserts
  `applied: true + created_section` OR `applied: true` OR
  `applied: false + reason`. Phase 7 adds the per-adapter expected
  variant to the manifest.
- **`BEADS_ACTOR=seed` on every determinism-relevant bd call**
  (Landmine 11): Factory encodes this; Phase 7 doesn't duplicate.
- **`chmodSync(.beads, 0o700)` post-init** (Landmine 9): Factory
  encodes this; Phase 7 doesn't duplicate.
- **`≤2 bd spawns per public method invocation`** (Phase 6 sibling D-21):
  BeadsAdapter internal invariant; Phase 7 conformance doesn't change
  this but observable timing-regression tests can surface drift.

### Integration Points

**Fork-side (this repo):**

- **`package.json`** — add `"gsd-beads": "file:../gsd-beads"` to
  `devDependencies`; add `test:conformance:paired` script.
- **`adapters/types.ts`** — add `normalize(body, category?): string`
  to StorageAdapter interface.
- **`adapters/markdown/index.ts`** — add `normalize(body) { return body;
  }` implementation.
- **`tests/conformance/manifest.ts`** — NEW. Typed
  `CONFORMANCE_MANIFEST` const.
- **`tests/conformance/meta-coverage.test.ts`** — NEW. Asserts every
  manifest entry has corresponding test block; asserts no orphan blocks;
  runs section-anchor grep gate.
- **`tests/conformance/paired.test.ts`** — NEW. Invokes
  `runAdapterConformanceSuite` twice.
- **`tests/conformance/arbitraries/`** — NEW directory. Per-noun
  fast-check arbitrary files (`arbPhase.ts`, `arbPlan.ts`, etc.).
- **`tests/conformance/properties.test.ts`** — NEW. Round-trip property
  tests per noun per adapter. Adaptive time budget per tuple.
- **`tests/conformance/failure-injection.test.ts`** — NEW. CONFORM-04
  tests with paired rollback-identity assertions.
- **`scripts/extract-section-anchors.mjs`** (or `.ts`) — NEW. Greps
  adapter.updateSection/getSection call sites; emits
  section-tuple manifest JSON + dynamic-anchor CI gate.
- **CI workflow** — extend with bd-install step + run
  `test:conformance:paired` on PR.

**Sibling-side (`/Volumes/code/gsd-beads`):**

- **`package.json`** — add `"./testing"` entry to `exports`.
- **`src/testing/conformance-factory.ts`** — NEW. Extracts the existing
  factory from `tests/conformance.test.ts`. Exported as
  `createBeadsAdapter(projectDir)`.
- **`src/index.ts`** — add `normalize()` method on BeadsAdapter class
  (compose `parseSection → formatSection` + frontmatter round-trip).
- **`tests/conformance.test.ts`** — DELETE (per D-05).

### Scripts and tooling

- **`scripts/extract-section-anchors`** — grep-based section-tuple
  extractor. Input: fork SDK + workflows source tree. Output:
  (a) string-literal tuples → manifest auto-entries; (b) dynamic-anchor
  call sites → CI warning + gate failure unless manifest-registered.

</code_context>

<specifics>
## Specific Ideas

- User chose **fork runs both adapters (D-01)** because a single CI surface is
  authoritative for SC#1 "zero failing assertions across both adapters." The
  new devDep is a single-line adapter-seam change — low rebase risk
  against upstream. Keeps paired assertions discoverable in the fork where
  future external adapter authors will look first.

- User chose **file:../gsd-beads devDep (D-02)** mirroring the sibling's
  existing file-link to the fork. No workspace or submodule ceremony.
  Rebase-risk is small and scoped to the adapter-seam; business-logic
  conflicts aren't expected.

- User chose **CI installs bd from release binary (D-03)** over vendoring.
  Vendor bloat + license redistribution concerns; release binary install is
  a standard CI pattern; skip-with-warning-if-absent preserves local-dev
  flow when bd isn't installed.

- User chose **import sibling's factory via `./testing` subpath (D-04)**.
  Single source of truth for bd init discipline (Landmines 9 + 11). Avoids
  two places to maintain the factory code. Small sibling `package.json`
  exports addition.

- User chose **consolidate sibling CI to fork (D-05)**. Sibling deletes
  `tests/conformance.test.ts`; keeps `tests/smoke/` + `tests/unit/` for
  bd-primitive coverage. Two invocation sites is maintenance burden
  without benefit.

- User chose **authored conformance manifest (D-06)** over reflection or
  hybrid. Hand-authored typed enumeration is greppable, clear, and matches
  the sibling's D-04 enum-dispatch pattern. The meta-test asserts
  bidirectional coverage (entry→test AND test→entry) so adding a new Bin B
  method can't silently skip either side.

- User chose **per-adapter `expected` annotation (D-07)** over
  capability-gated skip or strict parity with ADR overrides.
  Adapter-specific deviations (like D-2026-05-12-OQ06-CREATED-SECTION)
  live in the manifest as explicit contract data, not in test-skip
  comments. Third-party adapters MUST add their expectation rows.

- User chose **grep-derived section tuples (D-08)** over Phase 5 schema
  derivation or runtime trace. Grep catches real usage; dynamic-anchor
  gate forces deliberate tradeoffs when dynamic composition is needed.
  Schema derivation was rejected because Phase 5 didn't ship schemas for
  every canonical file.

- User chose **fail on dynamic anchor grep pattern (D-08 cont.)** over
  runtime instrumentation or accepted-drift-with-quarterly-audit. The CI
  warning rule ("refactor to literal OR register manually with
  justification") surfaces the tradeoff at PR time, not after the fact.

- User chose **document known-gap; ship Phase 7 (D-09)** over blocking
  Phase 7 on Outcome B/C or relaxing CONFORM-04 semantics. Outcome A
  covers the typical usage path; the gap is rare; documenting formally
  in the manifest beats both blocking v1.0 and weakening the contract.

- User chose **throw-from-inside-fn failure injection (D-10)** over
  adapter-internal hooks or both. Natural code path; no test-only API
  surface; matches how user bugs actually manifest. The D-09 known-gap
  documentation covers the commit-replay sub-case without requiring
  adapter instrumentation.

- User chose **bd export --json diff (D-11)** for BeadsAdapter rollback
  check. Record-oriented equivalent to byte-identity. Sibling's
  BEADS_ACTOR=seed discipline already gives byte-identity on exports.

- User chose **fast-check with per-noun arbitraries (D-12)** over
  hand-written cases or hybrid. Generative coverage catches edge cases
  imagination misses (unicode, fencing, empty strings, deep nesting).
  ~1000 LOC authoring investment pays off across the noun catalog and
  future third-party adapters.

- User chose **add `normalize()` to StorageAdapter with ADR (D-13)** over
  per-noun recordEq or test-helper-only normalize. Precedent: Phase 6
  D-OQ06-CAPS added `graphEdges` as additive. Exposing normalization as
  API benefits Phase 8 migration tool (pre-seed normalize pass).

- User chose **adaptive time-budget for property tests (D-14)** over
  uniform high iteration count or tiered CI/nightly split. 60s per
  tuple per adapter gives good coverage when the machine is fast and
  graceful degradation when it's not. Single CI config.

- User flagged Phase 6 Deferred-04 + Deferred-05 (mid-txn commit-replay
  gap) as a KNOWN-GAP to formalize, not to block v1.0 on. Phase 6.1
  remains a backlog option if priority surfaces.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 6.1 withTransaction Outcome B or C rescue** — If Phase 7 paired
  testing reveals the Outcome A mid-txn commit-replay gap (Deferred-04)
  is more load-bearing than estimated, a Phase 6.1 plan re-spikes bd
  v1.0.4+ for true atomic rollback. Not blocking v1.0 per D-09.

- **Property-test arbitrary for new nouns** — If a future phase
  introduces a new noun to the catalog, that phase's work includes
  authoring the fast-check arbitrary + manifest entry. Meta-test
  enforces the CI gate — no new noun can ship without a round-trip
  test.

- **Conformance package publication** — If external adapter authors want
  to write their own `StorageAdapter` implementations post-v1.0,
  extracting the `tests/conformance/` tree to a published npm package
  (`@gsd/conformance` or `get-shit-done-conformance`) would let third-
  party authors import + run the full matrix. Deferred unless external
  authors materialize.

- **Dynamic-anchor refactor sweep** — The CI grep gate will surface
  existing dynamic-anchor call sites on first run. Phase 7 registers
  them manually in the manifest with justifications. A follow-up
  cleanup plan could refactor them to string literals — judgment call
  whether that's Phase 7 scope or separate.

- **Runtime trace instrumentation for drift detection** — Rejected in
  D-08 in favor of grep gate. If grep misses enough dynamic-composition
  cases to matter, adding runtime trace instrumentation becomes a
  follow-up.

- **Cross-repo PR triggering for sibling** — If Phase 7's "consolidate
  to fork" CI shape causes sibling PRs to get delayed feedback (because
  sibling CI doesn't run paired tests), a follow-up GitHub Actions
  cross-repo dispatch config can trigger fork paired-conformance runs
  on sibling PRs. Ceremony cost deferred until needed.

- **Migration-tool normalize() usage (Phase 8 DIST-02)** — The Phase 7
  additive `normalize()` method enables Phase 8 migration to apply the
  target adapter's normalization before seeding. Capture of the
  interface here; usage lives in Phase 8.

- **bd perf regression dashboard** — BeadsAdapter cold-start dominates
  property test runtime. Tracking cold-start regressions over time
  would surface bd upstream perf changes. Out of Phase 7 scope;
  candidate for post-v1.0 tooling.

- **Wider per-noun coverage beyond current catalog** — The noun catalog
  from SYNTHESIS §2 is canonical for v1.0. If new noun classes emerge
  (e.g. workstream records, inbox triage records), they each need a
  property arbitrary + manifest entry. Covered by the meta-test gate
  on the day they land.

- **Golden-test parity matrix (#2909)** — Upstream's golden parity is
  Phase 8 DIST-04 (superseded Phase 1 SC#1). Phase 7 doesn't block on
  it; it's validated separately with the fork's strict-superset
  invariant.

- **Systemic: retrofit `planner-subagent-prompt.md` + leak-grep scope**
  (STATE.md pending todo from 2026-05-11) — Planner template emits
  `<context>` blocks tripping Phase 4 leak-gate; leak-grep should skip
  `.planning/phases/**/*-PLAN.md`. Phase 7 is a candidate for folding
  this in since Phase 7 touches leak-grep tooling anyway (section-
  anchor grep script); planner's judgment call based on scope inflation.

### Reviewed Todos (not folded)

- None. Todo matcher returned no matches for Phase 7.

</deferred>

---

*Phase: 07-conformance-test-suite*
*Context gathered: 2026-05-12*
