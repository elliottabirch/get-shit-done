# Phase 2: Wire core read methods to adapter — Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 ships the **read-side migration**: every SDK TS read handler in
`sdk/src/query/*.ts` (plus shared helpers in `helpers.ts` / `roadmap.ts` /
`phase.ts`) routes its filesystem reads through `adapter.getRecord` /
`adapter.getSection` / `adapter.getFrontmatter` / `adapter.listCollection` /
`adapter.exists` / `adapter.stat` instead of `node:fs` directly or via
`createRequire`-bridged CJS.

Phase 2 owns:
- ~15 SDK read-handler files (the `.planning/`-bound subset; C2 files reading
  user-global paths excluded by path-scoped leak-grep)
- The ~13 init bundlers in `init.ts` + 3 complex bundlers in `init-complex.ts`
  (coarse external shape preserved per OQ-09 + ROADMAP SC#2; internals
  compose adapter primitives through SDK-side shared helpers)
- One Bin A contract addition: `stat(path)` (re-opens Phase 1's D-05/D-10
  with a new ADR — required, not capability-gated)
- Extension of `scripts/leak-grep.cjs` with SDK-side patterns
  (`from 'node:fs'`, `readFileSync`, `fs.readFile` against `.planning/`)
- A repo-wide `<context>`-block audit register
  (`.planning/leaks/context-block-register.md`) with each `@.planning/`
  reference classified into a 3-bucket disposition

Phase 2 **does not**:
- Migrate write paths (`writeFileSync`/`mkdirSync`/`unlinkSync`) — Phase 3
- Modify CJS files in `get-shit-done/bin/lib/*.cjs` — they stay behind the
  MarkdownAdapter `createRequire` wrap per D-02 (locked permanently)
- Lock the `<context>`-block mitigation strategy — Phase 2 audits + classifies;
  Phase 4 LEAKS-02 chooses uniform vs. mixed strategy and ships it
- Wire the leak-grep CI gate — Phase 4 LEAKS-04 owns the gate
- Implement Phase 5 foundational primitives — `snapshot/restore/withTransaction/
  putNamedDoc/getNamedDoc/writeBinaryAsset` continue to throw
  `UnsupportedCapabilityError` per D-10
- Touch C2 files (profile-* / workstream / detect-custom-files / skill-manifest
  reading user-global paths) — naturally excluded by path-scoped leak-grep

</domain>

<decisions>
## Implementation Decisions

### Migration sequencing

- **D-01 (Plan structure):** 3-5 plans batched by handler family. Mirrors
  Phase 1's 5-plan shape. Each plan ends with leak-grep verification on its
  scope plus added conformance tests.

- **D-02 (Plan order — pattern → leaves → composers):**
  1. **Plan 1 — Foundation + pattern:** add `stat()` to Bin A; implement
     `MarkdownAdapter.stat()`; conformance test; extend leak-grep.cjs with
     SDK patterns; migrate `helpers.ts` to consume adapter; migrate one
     reference handler (e.g. `findPhase`) end-to-end as the migration recipe.
  2. **Plan 2 — Phase / state / progress / roadmap reads:** `phase.ts`,
     `roadmap.ts`, `progress.ts` (reads only), `route-next-action.ts`,
     `audit-open.ts`, `phase-ready.ts`, `verify.ts` (reads only),
     `check-verification-status.ts`, `detect-phase-type.ts`.
  3. **Plan 3 — Document reads:** `summary.ts`, `uat.ts`, `intel.ts` (reads
     only), `docs-init.ts`, `skill-manifest.ts`.
  4. **Plan 4 — Init bundlers (last; they compose the leaves):** `init.ts`
     (13 bundlers) + `init-complex.ts` (3 bundlers). Resolves OQ-09 by
     keeping coarse bundle shape; internals compose primitives via the SDK
     helpers migrated in plans 1-3.
  5. **Plan 5 — `<context>`-block audit register:** repo-wide scan; classify
     each ref; write `.planning/leaks/context-block-register.md`; satisfy
     SC#3 (no orphan refs survive an audit grep).

- **D-03 (Per-plan exit gate):** Each plan must satisfy
  (a) the extended leak-grep returning zero matches in its scope, AND
  (b) added conformance tests in `tests/conformance/` covering the
  handlers it migrated. Lighter gates were considered (existing tests +
  leak-grep only; golden snapshot) but per-plan conformance gives Phase 7
  a head start on read-side coverage.

- **D-04 (leak-grep extension):** `scripts/leak-grep.cjs` adds an SDK
  pattern category in Plan 1 covering `from 'node:fs'`, `require('node:fs')`,
  `fs.readFile*`, `readFileSync`, `readdirSync`, `existsSync`, `statSync`
  when applied against `.planning/`-prefixed paths or paths derived through
  `planningPaths()` / `relPlanningPath()`. Path-scoped, so C2 files reading
  `~/.claude/projects/`, `~/gsd-workspaces/`, etc. naturally pass. One
  script, all categories — Phase 4 inherits the extended engine for the
  CI gate (LEAKS-04).

### `<context>`-block audit (READS-03 / OQ-04 partial)

- **D-05 (Phase-2-deliverable scope):** Phase 2 produces an exhaustive
  audit register with each `<context>`-block `@.planning/` reference
  classified. Phase 2 does NOT lock the mitigation strategy — that lives
  in Phase 4 LEAKS-02 alongside the CI gate. SC#3 is satisfied by ensuring
  no orphans (every ref is registered with a proposed disposition).

- **D-06 (Register location):** `.planning/leaks/context-block-register.md`
  — new top-level register directory. One markdown file with a row per
  reference: `file:line | <context>-block excerpt | proposed disposition |
  rationale`. Visible at repo root; Phase 4 reads this directly. Sets
  precedent for future leak-class registers (e.g. workflow tool calls in
  Phase 4 LEAKS-01).

- **D-07 (Classification taxonomy — 3-bucket disposition):** Each ref tagged:
  - **REWRITE-CANDIDATE:** the skill/workflow body can invoke the adapter
    (via `gsd-sdk query`) to load the doc at runtime; the frontmatter ref
    is removable.
  - **INTERCEPT-CANDIDATE:** the doc must be present at frontmatter-load
    time; needs an install-time hook to materialize it from the adapter
    before the skill activates.
  - **EXCEPTION:** the doc fundamentally needs to load at activation and
    can't be intercepted (e.g. it IS the adapter contract, or it's a
    template the user edits manually); document why.

  Phase 4 LEAKS-02 may choose uniform-across-refs (e.g. "rewrite all") or
  mixed (per-ref disposition). Phase 2 just tags each ref with its proposed
  bucket so Phase 4 has a starting point.

- **D-08 (Audit scope — repo-wide):** scan `commands/` + `agents/` +
  `get-shit-done/` + `docs/`. ~20 known files contain `<context>` blocks;
  the `@.planning/` subset is the leak class. Test fixtures
  (`tests/leak-grep/fixtures/leaky-skill-context.md`) and `zh-CN/` translated
  docs are scanned for thoroughness; intentional-leak fixtures get
  EXCEPTION classification with a `// fixture` rationale.

### Init-bundler internal helpers (OQ-09 resolution)

- **D-09 (Helper location — SDK-side shared helpers):** Shared logic
  (model resolution, milestone info, phase fallback, path computation,
  runtime detection) lives in `sdk/src/query/helpers.ts`, `roadmap.ts`,
  `phase.ts`, `config-query.ts` — same locations as today. Helpers call
  `adapter.getRecord` / `adapter.getSection` / `adapter.getFrontmatter` /
  `adapter.listCollection` / `adapter.exists` / `adapter.stat` internally.
  Init bundlers call these adapter-aware helpers. Adapter contract surface
  stays Bin A only (D-10 from Phase 1 preserved); no new Bin B reads.

  This resolves OQ-09 by keeping the **coarse external init-bundle shape**
  (per SYNTHESIS §6 #10 + ROADMAP SC#2) AND the **flat adapter contract**
  (no Bin B inflation).

- **D-10 (Adapter DI shape — explicit first parameter):** Every
  adapter-aware helper signature is `(adapter: StorageAdapter, ...rest)`.
  No module-state, no hidden context, no factory closure. Trivial to grep
  for adapter usage; matches the `(args, projectDir)` handler shape with
  one extra leading arg. Module-scoped adapter was rejected per D-2026-04-30-05's
  intent of no global filesystem coupling.

- **D-11 (Bin A contract addition — `stat()`):** Add a new required Bin A
  primitive:
  ```ts
  stat(path: string): Promise<{ kind: 'file' | 'dir'; mtime?: string } | null>;
  ```
  Returns `null` for non-existent paths (matches `getRecord` null-on-miss
  semantics). `mtime` is optional in the return shape — adapters that can't
  cheaply compute mtime omit the field; consumers who need mtime degrade
  gracefully.

  **Re-opens Phase 1's D-05/D-10** with a new ADR (D-2026-05-XX): the v1.0
  contract surface gains one more required method. Justification:
  - Six current call sites need `isDirectory()` checks (`helpers.ts:478,512`,
    `docs-init.ts:94,99`, `init-complex.ts:450`) and `mtime` (`intel.ts:138`).
  - `listCollection`-as-isDirectory was considered but rejected as fragile
    (relies on call success vs. throw to distinguish dir from file).
  - Capability-gating `stat` was considered but rejected — `isDirectory` is
    fundamental enough that every backend must support it. `mtime` is
    optional in the return shape so non-mtime backends still satisfy the
    required method.

  **Affected files in Plan 1:** `adapters/types.ts` (interface), 
  `adapters/types.test.ts` (type-check tests), `adapters/markdown/index.ts`
  (`MarkdownAdapter.stat()` implementation), `tests/conformance/`
  (stat conformance test), `.planning/DECISIONS.md` (Phase 2 contract-extension
  ADR).

### Phase 2 boundary

- **D-12 (CJS bridge handling — replace with adapter calls):** Where SDK
  TS handlers currently `createRequire`/import CJS helpers from
  `get-shit-done/bin/lib/` for filesystem-bound calls (e.g. `core.cjs.readState()`
  to load STATE.md), replace with `await adapter.getRecord('STATE.md')`
  + parse. The MarkdownAdapter implementation **already wraps the same CJS
  helpers internally** (per Phase 1 D-02), so net behavior is byte-identical
  — but the seam is now at the TS layer. After Phase 2, `sdk/src/query/*.ts`
  contains zero `createRequire` calls or CJS imports for fs-bound logic.
  Pure-CJS calls (parsing, validation, normalization with no fs touch) may
  remain.

- **D-13 (CJS files stay untouched):** `get-shit-done/bin/lib/core.cjs`,
  `state.cjs`, `phase.cjs`, `roadmap.cjs`, `frontmatter.cjs` are NOT
  modified in Phase 2. They continue to use `node:fs` directly — the seam
  is the MarkdownAdapter wrap (D-02 from Phase 1, locked permanently).
  Pushing the seam into CJS was considered + rejected: contradicts D-02
  intent ("keep CJS as upstream for clean rebase") and inverts the wrap
  pattern.

- **D-14 (Per-line read-only discipline in mixed files):** For files that
  contain both reads and writes (`progress.ts`, `intel.ts`, `verify.ts`,
  `state-mutation.ts`-read-paths), Phase 2 migrates ONLY the read calls
  (`readFileSync` / `readdirSync` / `existsSync` / `statSync`). Write calls
  (`writeFileSync` / `mkdirSync` / `unlinkSync` / `appendFileSync`) stay
  until Phase 3. Files end up in mixed state for the duration between
  Phase 2 ship and Phase 3 ship; leak-grep enforces read-side only because
  the SDK pattern category lists only read fs functions. Splitting files
  upfront into `xxx-read.ts` / `xxx-write.ts` was considered but rejected
  — adds refactor cost and disturbs git blame for upstream rebase.

- **D-15 (C2 file handling — path-scoped, naturally excluded):** Profile-*,
  workstream, detect-custom-files, and skill-manifest read user-global
  paths (`~/.claude/projects/`, `~/gsd-workspaces/`, `~/.claude/get-shit-done/`,
  `.claude/skills/`) — none of which start with `.planning/` or pass through
  `planningPaths()`. The extended leak-grep is path-scoped, so these files
  pass without an explicit allowlist. If a future bug introduces a
  `.planning/` read inside one of these files, the gate fires correctly.

### Claude's Discretion

- Internal naming for the Plan 1 reference handler (likely `findPhase`
  but `roadmapGetPhase` or `getRecord` direct in helpers.ts could also
  serve as the recipe exemplar).
- Exact extended leak-grep pattern regex (Claude picks; pattern lives
  alongside R5 / SHELL_PATTERNS / CONTEXT_BLOCK_RE in `scripts/leak-grep.cjs`).
- Conformance test naming convention (`stat-roundtrip.test.ts`,
  `helpers-progress-input.test.ts`, etc.).
- Whether to ship a small migration recipe doc (e.g. `adapters/MIGRATION-RECIPE.md`)
  alongside Plan 1 to anchor the Plan 2-4 mechanical work.
- Whether the `<context>`-block audit register file is markdown-only or
  ships an accompanying machine-readable JSON sidecar (Phase 4 picks the
  consumption shape; Phase 2 ships md by default).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (gsd-phase-researcher, gsd-planner) MUST read these
before researching or planning.**

### Project-locked architecture

- `.planning/PROJECT.md` — Fork architecture, two-repo model, strict-superset
  invariant, branch strategy.
- `.planning/DECISIONS.md` — 6 baseline decisions (D-2026-04-30-01..06)
  + Phase 1's per-PR ADRs (D-2026-04-30-07..10). **Phase 2 will append
  one new ADR** for the Bin A `stat()` extension (D-11 above).
- `.planning/STATE.md` — Current state; updates on Phase 2 context-gathered
  session.

### Phase-1 outputs (locked, treat as carry-forward facts)

- `.planning/phases/01-fork-bootstrap-storageadapter-interface-skeleton-markdownada/01-CONTEXT.md`
  — D-01..D-15 from Phase 1. Especially:
  - **D-02:** MarkdownAdapter wraps CJS via `createRequire`; CJS files stay
  - **D-07:** `createRegistry({adapter})` is required; `opts.adapter` is in
    handler closure (Phase 2 just consumes it)
  - **D-10:** Phase 1 declared full v1.0 surface; only Bin A
    + markdownLockfile + commitPlanningState implemented. **Phase 2's
    `stat()` addition extends the required surface.**
  - **D-13:** Test bar = "fork's existing tests pass with MarkdownAdapter
    mounted" (not upstream #2909).
  - **D-14:** `scripts/leak-grep.cjs` ships with R5 + `<context>`-block
    coverage; **Phase 2 extends with SDK fs patterns**.
  - **D-15:** `tests/conformance/` harness skeleton + 1 sample test exists;
    Phase 2 extends per-plan.
- `.planning/phases/01-fork-bootstrap-storageadapter-interface-skeleton-markdownada/01-04-SUMMARY.md`
  — Phase 1 Plan 4 (createRegistry DI). Critical: handlers receive
  `opts.adapter` from `createRegistry` closure but **don't yet consume it**.
  Phase 2's job is to make them consume it.

### Milestone scope

- `.planning/REQUIREMENTS.md` §"READS" — READS-01 (~40 SDK queries route
  through adapter), READS-02 (~13 init bundlers compose primitives),
  READS-03 (`<context>`-block audit).
- `.planning/ROADMAP.md` §"Phase 2" — Goal, Depends on, Resolves OQ-09,
  4 Success Criteria. **SC#3** is the audit-register satisfaction bar.

### Architectural source-of-truth (locked by D-2026-04-30-06)

- `.planning/research/fork-investigation/SYNTHESIS.md` — 6500 words.
  - **§4** — Adapter interface: Bin A primitives (incl. the read surface
    `getRecord`/`getSection`/`getFrontmatter`/`listCollection`/`exists`).
    **Phase 2 adds `stat()` to this surface.**
  - **§5 C2** — Out-of-adapter-scope files (profile-*, workstream, etc.).
    Path-scoped leak-grep naturally excludes them.
  - **§6 #10 (OQ-09)** — Init-bundle granularity. Phase 2 resolves by
    keeping coarse external shape, composing primitives internally via
    SDK helpers (D-09 above).
  - **§6 #4 (OQ-04)** — `<context>`-block leak class. Phase 2 audits +
    classifies (D-05/D-06/D-07/D-08); Phase 4 LEAKS-02 picks the
    mitigation strategy.
  - **§7 Phase 2** — "Migrate every SDK-already-exposed read query
    (`progressJson`, `roadmapAnalyze`, `stateJson`, `findPhase`,
    `phasesList`, `phasePlanIndex`, `summaryExtract`, etc. — ~40 methods)"
  - **§9** — Risk register (Rule 4 demotion, `<context>`-block leak class,
    workflow-init bundler coupling).

### Code surfaces Phase 2 touches

- **Adapter contract:**
  - `adapters/types.ts` — extend `StorageAdapter` interface with `stat()`
    in Bin A; update `Capabilities` if needed (likely no change — `stat`
    is required, not gated).
  - `adapters/types.test.ts` — type-check coverage for the new method.
  - `adapters/markdown/index.ts` — implement `MarkdownAdapter.stat()`
    (likely delegates to `node:fs.statSync` — adapter is allowed to use
    fs directly).

- **SDK read surface (Plan 1-4):**
  - `sdk/src/query/helpers.ts` — adapter-aware helpers (Plan 1).
  - `sdk/src/query/phase.ts`, `roadmap.ts`, `progress.ts` (reads),
    `route-next-action.ts`, `audit-open.ts`, `phase-ready.ts`, `verify.ts`
    (reads), `check-verification-status.ts`, `detect-phase-type.ts` (Plan 2).
  - `sdk/src/query/summary.ts`, `uat.ts`, `intel.ts` (reads), `docs-init.ts`,
    `skill-manifest.ts` (Plan 3).
  - `sdk/src/query/init.ts`, `init-complex.ts` (Plan 4).

- **Out-of-scope code surfaces (do NOT modify):**
  - `get-shit-done/bin/lib/core.cjs`, `state.cjs`, `phase.cjs`, `roadmap.cjs`,
    `frontmatter.cjs` — D-13 above; D-02 wrap pattern is permanent.
  - `sdk/src/query/state-mutation.ts` (write paths), `phase-lifecycle.ts`
    write paths — Phase 3.
  - C2 files: `profile-*.ts`, `workstream.ts`, `detect-custom-files.ts`,
    `skill-manifest.ts` (its `~/.claude/skills/` reads — but its
    `.planning/` reads if any are in-scope).

- **Tooling:**
  - `scripts/leak-grep.cjs` — extend with SDK pattern category (Plan 1).
  - `tests/conformance/` — extend with per-plan read conformance tests
    (Plan 1-4).

- **Audit deliverable:**
  - `.planning/leaks/context-block-register.md` — new (Plan 5).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (carry-forward from Phase 1)

- **`createRegistry({adapter})` and the handler closure pattern.** Every
  handler in `sdk/src/query/index.ts`'s registry already receives
  `opts.adapter` in scope; Phase 2's mechanical work is replacing
  `readFileSync(...)` / `core.cjs.someFunc(...)` with
  `await opts.adapter.getRecord(...)` / `await opts.adapter.stat(...)`.

- **`MarkdownAdapter.getRecord` / `getSection` / `getFrontmatter` /
  `listCollection` / `exists`** are implemented and wrap the existing CJS
  helpers via `createRequire`. Phase 2 doesn't re-implement filesystem
  semantics; it just routes call sites through this typed seam.

- **`tests/conformance/` harness** (Phase 1 D-15) — a test factory taking
  a `StorageAdapter` instance and asserting equivalent outcomes. Phase 2
  extends it per-plan; Phase 7 reuses unchanged with BeadsAdapter as the
  second parameter.

- **`scripts/leak-grep.cjs`** (Phase 1 D-14) — already covers R5 + `<context>`-block
  patterns. Phase 2 adds an SDK-fs pattern category in Plan 1.

### Established Patterns

- **Handler signature:** `async function handler(args, projectDir)
  { ... }` with `opts.adapter` available via the registry closure (per
  Phase 1 D-07). Phase 2 doesn't change the handler signature; it adds
  `await adapter.*` calls inside.

- **Helper bridging via createRequire:** `sdk/src/query/state-project-load.ts`
  shows the pattern. Phase 2 **removes** these for fs-bound calls (D-12)
  and replaces with adapter calls.

- **Path resolution:** `planningPaths(projectDir)` and `relPlanningPath`
  produce `.planning/`-relative paths matching `adapter.getRecord`'s
  expected shape (D-04 from Phase 1). Helpers continue to use these.

- **Capability flag pattern:** Phase 1's D-08 closed-enum capabilities.
  Phase 2 does NOT add a new capability — `stat` is required.

### Integration Points

- **`adapters/` directory** (Phase 1 D-01 module layout) — Phase 2
  modifies `adapters/types.ts` (interface) + `adapters/markdown/index.ts`
  (impl) + `adapters/types.test.ts` (type tests). Third-party adapters
  importing `StorageAdapter` see one new required method on next minor
  bump.

- **`tests/conformance/` factory** — Plan 1's stat conformance test
  follows the existing `getRecord` roundtrip sample. Plans 2-4 add per-handler
  reproductive tests.

- **`scripts/leak-grep.cjs` exit-zero behavior** — Phase 2's per-plan
  exit gate runs the script over the touched scope. Phase 4's CI gate
  (LEAKS-04) inherits the extended engine and runs it over the full repo.

- **`.planning/leaks/` directory** — new in Phase 2; Phase 4 may add
  sibling registers (e.g. `workflow-tool-call-register.md` for LEAKS-01).

</code_context>

<specifics>
## Specific Ideas

- User chose **SDK-side shared helpers** over per-bundler primitive
  composition (the SYNTHESIS-recommended-style "pure" choice) AND over
  Bin B reads on the adapter (the "fattest" choice). Reflects the working
  principle "expand the adapter contract only when the call shape is
  fundamental, not when it's convenient" — same instinct as Phase 1 OQ-08
  (where lockfile helpers became public + capability-gated rather than
  private).

- User chose **stat() as required Bin A** over capability-gated. Reflects
  a preference for a flat, predictable read contract (`isDirectory` /
  `mtime` are concepts every backend must support) rather than capability
  guard noise at every call site.

- User chose **audit + classify, defer mitigation strategy to Phase 4**
  for the `<context>`-block register. Splits classification (Phase 2,
  catalog the surface) from strategy (Phase 4, decide what to do about
  it). Reflects the working principle of binding decisions to the phase
  with the most context.

- User confirmed (after a flagged misclick) that Phase 2's boundary stays
  SDK-TS-reads-only — write paths stay for Phase 3, CJS files stay
  untouched permanently per D-02, `<context>`-block mitigation strategy
  stays for Phase 4. **The misclick check itself is a useful precedent:**
  when a multi-select answer reverses recently-locked decisions, downstream
  agents should reflect back before acting on the reversal.

</specifics>

<deferred>
## Deferred Ideas

- **`<context>`-block mitigation strategy lock (OQ-04 final resolution)**
  — Phase 4 LEAKS-02. Phase 2 ships the audit register with proposed
  dispositions; Phase 4 picks uniform vs. mixed and ships the actual
  rewrite/intercept code.

- **Leak-grep CI gate wiring** — Phase 4 LEAKS-04. Phase 2 extends the
  script engine; Phase 4 wires it to PR pre-merge checks.

- **Write-path migration in mixed files** (`progress.ts`, `intel.ts`,
  `verify.ts`, etc.) — Phase 3.

- **CJS file migration** (`core.cjs`, `state.cjs`, `roadmap.cjs`,
  `frontmatter.cjs`) — **NEVER**. D-02 from Phase 1 is permanent: CJS
  stays as upstream-clean-rebase territory; the adapter wrap is the seam.

- **Foundational primitive implementations** (`snapshot/restore`,
  `withTransaction`, `putNamedDoc`, `getNamedDoc`, `writeBinaryAsset`) —
  Phase 5. They continue to throw `UnsupportedCapabilityError` per D-10.

- **Bin B method signatures on the adapter interface** (`addPhase`,
  `recordStateEvent`, etc.) — Phase 3 (writes) and Phase 5 (foundational
  primitives). Phase 2's interface change is `stat()` only.

- **Empirical strict-superset proof against upstream's #2909 golden parity
  matrix** — Phase 8 DIST-04 (per Phase 1 D-13).

- **Logical-ref method shapes** (`{kind: 'plan', phase, planId}` instead
  of string paths) — explicitly deferred from Phase 1; potential v1.1 or
  Phase 5 alongside `putNamedDoc`/`getNamedDoc`.

- **A potential read-side migration recipe doc** (`adapters/MIGRATION-RECIPE.md`)
  — Claude's discretion to ship alongside Plan 1 if the mechanical pattern
  is worth documenting; not required by Phase 2 scope.

</deferred>

---

*Phase: 02-wire-core-read-methods-to-adapter*
*Context gathered: 2026-05-01*
