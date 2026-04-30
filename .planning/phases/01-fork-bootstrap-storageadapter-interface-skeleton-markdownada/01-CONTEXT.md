# Phase 1: Fork bootstrap + StorageAdapter interface skeleton + MarkdownAdapter scaffold — Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 ships the **adapter contract**: a locked `StorageAdapter` TypeScript
interface, a `MarkdownAdapter` scaffold that delegates to today's `node:fs` /
CJS code with zero observable behavior change, dependency-injected wiring via
`createRegistry({adapter})`, a written reconciliation against four upstream
seam PRs (#2898 / #2901 / #2908 / #2909), and Phase-1-supporting infra
(rebase leak-grep script + conformance harness skeleton).

The phase **does not** migrate any read or write handlers off direct I/O —
that's Phase 2 (reads) and Phase 3 (writes). It **does not** implement
foundational primitives — that's Phase 5. It **does not** ship BeadsAdapter
— that's Phase 6.

Phase 1's job is to make Phase 2-5 tractable by having one source-of-truth
contract everyone routes through.

</domain>

<decisions>
## Implementation Decisions

### Adapter scaffold strategy

- **D-01 (Module layout):** StorageAdapter interface and MarkdownAdapter live
  at top-level `adapters/` (e.g. `adapters/types.ts`, `adapters/markdown/`),
  outside `sdk/`. Third-party adapters (gsd-beads) import from this clean
  path, not internal SDK shapes. Trade-off accepted: higher rebase risk vs
  upstream's seam work happening under `sdk/` (PR #2898/#2901), in exchange
  for a clean public seam visible at repo root.

- **D-02 (Scaffold delegation):** MarkdownAdapter wraps existing CJS via
  `createRequire`. Each TS adapter method calls into the corresponding
  helper in `get-shit-done/bin/lib/*.cjs` (notably `core.cjs`, `state.cjs`,
  `phase.cjs`, `roadmap.cjs`, `frontmatter.cjs`). Smallest Phase 1 diff,
  rebase-safe (CJS untouched). Cost paid in Phase 2/3/4 as handlers migrate
  one-by-one.

- **D-03 (Lifecycle):** Sync constructor only. `StorageAdapter` declares no
  `init()` / `teardown()` methods in v1.0. If a future adapter needs them,
  they land as capability-gated optional methods (a non-breaking extension).
  MarkdownAdapter has nothing to init.

- **D-04 (Path shape):** Methods take `.planning/`-relative paths
  (`STATE.md`, `phases/01-foo/PLAN.md`). Adapter holds `projectDir`
  internally and resolves. Logical refs (`{kind: 'plan', phase, planId}`)
  deferred — see Deferred Ideas.

### Capabilities flag shape

- **D-05 (Required core capability groups):** Three groups always required
  (`true` literal in the type):
  - `record` — Bin A CRUD: `getRecord`, `putRecord`, `removeRecord`,
    `listCollection`, `exists`
  - `section` — `getSection`, `updateSection`
  - `frontmatter` — `getFrontmatter`, `updateFrontmatter`,
    `mergeFrontmatter`

  An adapter missing any required group fails type-checking, not runtime
  (per D-2026-04-30-05 mandate).

- **D-06 (Adapter identity):** `adapter.name: string`. No `version`, no
  `sdkApiVersion`. Used for diagnostic logging only — never for behavior
  branching (per D-2026-04-30-05 explicit rejection of
  `if (adapter.name === 'beads') ...`).

- **D-07 (createRegistry DI signature):** `createRegistry({adapter})`
  requires explicit adapter parameter — no default, no fallback. Every
  existing zero-arg call site (`createRegistry()`) updates as part of
  Phase 1. Strict-superset invariant satisfied at the install-wiring layer
  (CI/tests construct `new MarkdownAdapter(projectDir)`), not by an
  implicit default.

- **D-08 (Optional capability enum — closed, 6 entries):**
  - `binaryAsset: boolean` — `writeBinaryAsset`
  - `snapshot: boolean` — `snapshot()` / `restore()`
  - `transaction: boolean` — `withTransaction(fn)` / `beginTransaction` /
    `commit` / `rollback`
  - `namedDoc: boolean` — `putNamedDoc(category, key)` /
    `getNamedDoc(category, key)`
  - `commitPlanningState: boolean` — `git`-style commit semantics
  - `markdownLockfile: boolean` — `replaceInCurrentMilestone` and
    `readModifyWriteRoadmapMd` (the Phase-1 OQ-08 helpers)

  Closed enum; future capabilities require an interface bump (deliberate
  evolution, not Record-keyed open extension).

- **Claude's discretion:** `capabilities` is an *instance* property on the
  adapter object (matches D-2026-04-30-05's sketch literally), not a
  `static` class property. Gives forward flexibility if an adapter ever
  needs runtime-detected caps (e.g. a future `MarkdownAdapter` running in
  a read-only filesystem could set `capabilities.commitPlanningState =
  false` in the constructor without affecting other instances).

### Interface visibility & method shape

- **D-09 (OQ-08 resolution):** `replaceInCurrentMilestone` and
  `readModifyWriteRoadmapMd` are **public on the StorageAdapter interface,
  capability-gated by `markdownLockfile`**. (User chose this over the
  SYNTHESIS §6 #1 recommendation of "private to MarkdownAdapter.") Consumers
  type-narrow before calling. BeadsAdapter (Phase 6) declares
  `markdownLockfile: false` and either omits implementations or maps to
  bd-native equivalents.

- **D-10 (Phase 1 interface declares full v1.0 surface):** The
  `StorageAdapter` interface file declares every v1.0 method:
  - 10 Bin A primitives (D-05's three required groups)
  - 2 `markdownLockfile` methods
  - ~9 foundational primitive methods (`writeBinaryAsset`, `snapshot`,
    `restore`, `withTransaction`, `putNamedDoc`, `getNamedDoc`,
    `commitPlanningState`, etc.)

  MarkdownAdapter implements **only** Bin A + `markdownLockfile` +
  `commitPlanningState` in Phase 1. Remaining foundational methods throw
  `UnsupportedCapabilityError` defensively when called with their cap set
  to `false`. Phase 5 fills in the real implementations.

  Rationale: one breaking interface change in Phase 1, not three across
  Phase 1 / 5 / 6. Third-party adapter authors target a stable shape.

- **D-11 (Optional method shape — companion type guards):** Capability-gated
  methods are **required** on the interface (no TypeScript `?:`). Each
  capability group ships a companion type guard, e.g.:
  ```ts
  function hasSnapshot(a: StorageAdapter):
    a is StorageAdapter & { capabilities: { snapshot: true } } {
    return a.capabilities.snapshot;
  }
  ```
  Consumers narrow via the guard before calling. MarkdownAdapter still
  throws `UnsupportedCapabilityError` defensively if a cap=false method is
  called without narrowing — but the ergonomic path is type-guard-then-call.
  TypeScript catches misuse at compile time when consumers respect the
  pattern.

### Phase 1 supporting deliverables

- **D-12 (ADAPTER-05 reconciliation artifact):** Per-PR ADRs appended to
  `.planning/DECISIONS.md` — `D-YYYY-MM-DD-07` through `D-YYYY-MM-DD-10`,
  one per upstream PR (#2898 durable planning runtime, #2901
  planning-workspace seam, #2908 manifest-backed routing seam, #2909
  golden parity matrix). Each entry's verdict is one of:
  - **REUSE** — upstream's seam is reusable foundation; the fork's
    StorageAdapter builds on top of it.
  - **COORDINATE** — parallel work; the fork stays aligned but doesn't
    depend on it.
  - **DIVERGE** — divergent vision; the fork takes a different shape and
    must reconcile at every rebase.
  - **IRRELEVANT** — different layer; no contract impact.

  Each entry records the contract impact (does this change the
  StorageAdapter shape we're locking?) and the rebase risk.

- **D-13 (Strict-superset validation in Phase 1):** Phase 1's CI job runs
  the fork's existing test suite (`tests/`) with MarkdownAdapter wired in
  via `createRegistry({adapter: new MarkdownAdapter(projectDir)})`. SC#1
  reduces to "fork's existing tests pass after MarkdownAdapter wiring." The
  empirical match against upstream's #2909 golden parity matrix is **Phase
  8 (DIST-04)**, not Phase 1. This avoids blocking Phase 1 on PR #2909's
  merge timing.

- **D-14 (Leak-grep rebase script scope):** Phase 1 ships a script
  (`scripts/leak-grep.mjs` or similar) covering full **Rubric R5
  patterns** plus **`<context>`-block detection**:
  - Tool patterns against `.planning/`: `Read`, `Write`, `Edit`
  - Shell patterns against `.planning/`: `cp ... .planning/`,
    `mv ... .planning/`, `rm -rf .planning/`, `>> .planning/`
  - Skill frontmatter scan: `<context>` block `@.planning/...` references
    (the new leak class from SYNTHESIS §1 #4)

  Run on every rebase against `upstream/main` to flag new direct-I/O upstream
  introduces. Matches what Phase 4 (LEAKS-04) will eventually wire as a CI
  gate; Phase 1 ships the engine, Phase 4 wires the gate.

- **D-15 (Conformance harness skeleton + 1 sample test):** Phase 1 ships
  `tests/conformance/` with the harness shape — a test factory that takes
  a `StorageAdapter` instance and asserts equivalent outcomes — plus one
  sample test (`getRecord` round-trip) running against MarkdownAdapter
  only. Phases 2-5 fill in conformance tests as they migrate handlers.
  Phase 7 adds BeadsAdapter to the same matrix, asserting equivalence
  across both adapters.

### Claude's Discretion

- Internal layout under `adapters/markdown/` (e.g. one file vs. one file
  per capability group)
- Exact `UnsupportedCapabilityError` shape and inheritance chain
- TypeScript type-guard authoring style (named functions vs. inline
  predicates)
- Whether the leak-grep script is `.mjs` / `.cjs` / shell — Claude picks
  what matches the existing `scripts/` style
- Test framework wiring details for conformance (vitest config additions)

</decisions>

<specifics>
## Specific Ideas

- User explicitly said: **"don't implement anything around the beads adapter
  yet. we need to get the markdownadapter working first, and then we'll
  worry about other implementations."** Phase 1 (and Phase 2-5) stays
  MarkdownAdapter-first; Phase 6 owns BeadsAdapter end-to-end. Decisions
  about BeadsAdapter shape (e.g. how it maps `markdownLockfile` to bd) are
  **out of scope for this discussion** and deferred to Phase 6.

- User explicitly said: **"i want to use logical refs eventually, so lets
  defer the implementation of that till later. for now, lets go with
  .planning/-relative."** The interface shape is `.planning/`-relative
  string paths in v1.0; logical-ref refactor is a future evolution.

- User chose Public-capability-gated for OQ-08 over the SYNTHESIS-recommended
  "private to MarkdownAdapter." Reflects a preference for an explicit
  uniform contract surface that future adapters can opt into vs. an
  implementation-private workaround that hides the operation entirely.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents (gsd-phase-researcher, gsd-planner) MUST read these
before researching or planning.**

### Project-locked architecture

- `.planning/PROJECT.md` — Fork architecture, two-repo model, strict-superset
  invariant, branch strategy, success criteria, non-goals.
- `.planning/DECISIONS.md` — 6 locked decisions (D-2026-04-30-01 through
  -06): pivot rationale, two-repo model, fork name, rebase strategy,
  capabilities-flag pattern, SYNTHESIS-as-canonical. Phase 1 will append
  D-XX-07 through -10 (per-PR ADRs from D-12).

### Milestone scope

- `.planning/REQUIREMENTS.md` — 42 REQs across 8 phases. Phase 1: ADAPTER-01
  through ADAPTER-07. The Out-of-Scope section (C2 exclusions) defines what
  Phase 1 explicitly does NOT touch.
- `.planning/ROADMAP.md` §"Phase 1" — Goal, dependencies, the five Success
  Criteria. **Phase 1 SC#1 is rephrased per D-13** (local CI run, not
  upstream #2909 dependency).
- `.planning/STATE.md` §"Phase 1 immediate decisions" — six items the user
  flagged as needing lock during this discuss-phase. All resolved by D-01
  through D-15 above.

### Architectural source-of-truth (canonical, locked by D-2026-04-30-06)

- `.planning/research/fork-investigation/SYNTHESIS.md` — 6500 words. **The
  authoritative input for Phase 1.**
  - **§4** — Adapter interface draft: full Bin A primitives (10 methods),
    Bin B catalog (~58 methods), foundational primitives (6 cross-cutting
    shapes). The TS signatures in §4 ARE the starting point for Phase 1's
    interface file.
  - **§6** — 10 open architectural questions. Phase 1 owns OQ-08 only;
    OQ-08 is resolved by D-09 above.
  - **§7** — Suggested next-milestone scope. Phase 1's section is short
    and locks to "Bin A primitives + foundational primitives only."
  - **§9** — Risk register. Phase 1's planning agent should re-read this;
    several risks (Rule 4 demotion, `<context>`-block leak class, dry-run
    hoist) gate later phases.

  The 10 BATCH-NN.md files in the same directory are preserved for
  traceability (~258 artifacts classified, ~334 leaks enumerated) but are
  NOT canonical — synthesis output supersedes.

### Code surfaces Phase 1 touches

- `sdk/src/query/index.ts` — already exports `createRegistry()`. **D-07
  changes its signature** to require `{adapter}`. Every call site
  (handlers, tests, gsd-tools shim, init code) updates in Phase 1.
- `get-shit-done/bin/lib/core.cjs` — main legacy I/O surface that
  MarkdownAdapter wraps via `createRequire` (D-02).
- `get-shit-done/bin/lib/state.cjs`, `phase.cjs`, `roadmap.cjs`,
  `frontmatter.cjs` — additional CJS helpers MarkdownAdapter delegates to.
- `tests/` — existing fork test suite. Phase 1 wires MarkdownAdapter into
  CI (D-13) so SC#1 holds locally.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`createRegistry()` in `sdk/src/query/index.ts`** — Phase 1 modifies this
  to require an adapter parameter (D-07). The handler-dispatch shape
  (`registry.dispatch('dotted.name', args, projectDir)`) stays the same;
  only the construction signature changes.

- **Existing CJS helpers in `get-shit-done/bin/lib/`** — MarkdownAdapter
  wraps these via `createRequire` (D-02). No need to re-implement
  filesystem semantics; the adapter is a typed seam over an already-working
  layer.

- **Existing fork test suite at `tests/`** — already runs against the fork's
  current behavior. Phase 1's wiring (D-13) just routes the suite through
  MarkdownAdapter; new tests for SC#1 are minimal.

### Established Patterns

- **TypeScript handlers under `sdk/src/query/`** — Phase 1 follows this
  pattern for the adapter file structure: typed signatures, async by
  default, error throw rather than null/undefined for unhappy paths.
  `state-mutation.ts` and `phase-lifecycle.ts` are the closest analogs.

- **`createRequire` bridging** already used in `state-project-load.ts`
  (per `sdk/HANDOVER-QUERY-LAYER.md`) to call `core.cjs`'s `loadConfig`
  from TS. MarkdownAdapter follows the same pattern.

- **Capability-flag pattern** is locked at the project level (D-2026-04-30-05).
  Phase 1's interface file is the *first* place this pattern instantiates
  in code — implementing it well sets the bar for D-08's six-entry enum.

### Integration Points

- **Top-level `adapters/` import path** (D-01) — exposed to:
  - `sdk/src/query/index.ts` (consumes `StorageAdapter` type, instantiates
    via `createRegistry({adapter})`)
  - `get-shit-done/bin/install.js` (the install entry — wires
    `MarkdownAdapter` as the default for the install-wired registry)
  - `tests/` (CI wiring per D-13)
  - **Future:** `gsd-beads` (sibling repo) imports `StorageAdapter` type
    from this path

- **Leak-grep script** (D-14) lives under `scripts/` and is invoked
  by the `make rebase` workflow (per D-2026-04-30-04 implication) and by
  Phase 4's eventual CI gate (LEAKS-04).

- **Conformance harness** (D-15) lives at `tests/conformance/`. The
  harness shape is a test factory function — Phase 7's full suite
  reuses it unchanged, just adding BeadsAdapter to the parameter matrix.

</code_context>

<deferred>
## Deferred Ideas

- **Logical-ref shape for Bin A methods** (`{kind: 'plan', phase, planId}`
  vs string paths) — user explicitly wants this eventually but not now.
  Probably lands in Phase 5 (foundational primitive lift) alongside
  `putNamedDoc` / `getNamedDoc` (which already use a logical-ref-ish
  `(category, key)` shape), or as its own v1.1 milestone.

- **BeadsAdapter shape & capability mapping** — Phase 6 owns this end-to-end;
  user explicitly excluded BeadsAdapter implementation thinking from this
  discussion. Phase 6 will decide how `markdownLockfile`, `binaryAsset`,
  `commitPlanningState`, `snapshot/restore`, etc. map (or don't) to bd.

- **Empirical strict-superset proof against upstream's #2909 golden parity
  matrix** — Phase 1 only validates "fork's tests pass after wiring."
  Phase 8 (DIST-04) revisits with the actual upstream matrix once #2909
  merges.

- **Lifecycle methods (`init()` / `teardown()`)** on StorageAdapter — D-03
  defers; if a future adapter needs them, they land as capability-gated
  optionals (e.g. `capabilities.lifecycle: boolean`), a non-breaking
  extension.

- **Open-record/string-keyed capabilities** (`Record<string, boolean>`) for
  third-party-defined caps — rejected at D-08 in favor of closed enum;
  if a real third-party need emerges in v1.x, revisit.

- **Bin B method signatures on the v1.0 interface** — Phase 1 declares
  Bin A + foundational primitives only; the ~58 Bin B named methods
  (`addPhase`, `recordStateEvent`, `recordVerification`, etc.) land
  through Phase 2 (reads) and Phase 3 (writes). Phase 1's interface is
  intentionally smaller than the eventual full SDK surface.

- **CI gate enforcement for the leak-grep script** — D-14 ships the engine;
  Phase 4 (LEAKS-04) wires it as a PR-blocking gate.

- **PR-vs-long-lived-fork distribution decision** (DIST-05) — depends on
  how upstream receives #2898/#2901/#2908. Phase 1's per-PR ADRs (D-12)
  inform but don't decide; Phase 8 owns the decision.

</deferred>

---

*Phase: 01-fork-bootstrap-storageadapter-interface-skeleton-markdownada*
*Context gathered: 2026-04-30*
