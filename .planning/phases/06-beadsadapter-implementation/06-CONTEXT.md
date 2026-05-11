# Phase 6: BeadsAdapter implementation - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 ships **contract-compliance reconciliation** on top of the existing
sibling repo at `/Volumes/code/gsd-beads` (frozen at `main @ 5082d45`,
~15 KLOC shipped adapter code, 71 conformance tests green, 13 concluded
spikes — NOT the greenfield scaffold assumed by the pre-pivot CONTEXT).
The phase delivers a BeadsAdapter that satisfies the fork's locked
StorageAdapter contract (Bin A + foundational primitives + 3
`recordState*` event families + `StateWriteOutcome` three-state return)
running against `bd` v1.0.3, plus a small additive fork-side change.

### What Phase 6 does

**Sibling-side (majority of work, `/Volumes/code/gsd-beads`):**
- **Archive-branch the sibling's full history** (`git branch v0.2-archive`
  from current `main`) to preserve the ~15 KLOC + 6 shipped phases + 13
  spikes without discarding git history (D-SCAFFOLD).
- **Selective prune on `main`:** `git rm -rf` everything except a
  whitelist of proven carry-forward files (D-SCAFFOLD whitelist below).
- **Port every whitelisted `.mjs` → `.ts`** during the reset (D-TECH-STACK).
  Drop `node:test`; adopt `vitest` for both unit + conformance. Fix
  WR-05 atomic-write ms-resolution race via `crypto.randomBytes`; fix
  Landmine 3 by making adapter-context CWD implicit in the bd wrapper.
- **Spike two bd v1.0.3 primitive questions in Plan 06-01:**
  1. **Storage-shape (D-MAPPING):** does bd expose any named-JSON-field
     primitive beyond `--description`? Outcome gates sub-records vs
     labels-first architecture.
  2. **Transaction primitives (D-TXN-SPIKE):** evaluate all three
     outcomes — A (in-memory buffer), B (staging store + bead-hash
     bookmark), C (file-snapshot restore via `bd export` +
     `bd init --from-jsonl`). Ship best-available.
- **Patch sibling's shipped primitives to satisfy fork contract:**
  - 9-key Capabilities shape (sibling has 7; add `frontmatter`,
    `markdownLockfile`, + Phase-6's new `graphEdges: {semantic,
    dependency}`).
  - `StateWriteOutcome` three-state return on every `recordState*` call
    (sibling's `recordStateEvent` returns `{storage, key|bead|author}`
    — informational-only; must migrate to `{applied: true|false,
    reason|created_section}` shape per D-2026-05-10-08).
  - Split single `recordStateEvent` method → 3 families
    `recordStateAppend` / `recordStateMutation` / `recordStateSignal`
    consuming fork's `AppendEvent` / `MutationEvent` / `SignalEvent`
    discriminated unions.
  - Typed `BdManagedMismatchError extends Error` with
    `code: 'PROJECT_BD_MANAGED_MISMATCH'`, `projectDir`, `hint`,
    `__brand` — port sibling's `findBeadsRoot()` probe mechanism
    (proven against 4 topology cases) but use fork's error shape.
  - Path-traversal guard on `_abs()` (fix Landmine 1, BLOCKER CR-01
    in sibling 07-REVIEW.md).
  - Port Landmines 3, 4, 5, 6, 7, 8 fixes.
- **Ship withTransaction per Plan 06-01 spike outcome.**
- **Dep-edge synthesizer** (`src/dep-graph.ts`) producing `{type:
  'dependency', confidence: 1.0}` edges from bd's `blocks` edges
  (per D-OQ06; cites Spike 014).
- **Smoke tests** covering one workflow per Bin B method category (SC#3).
- **Rewrite `README.md` + `CLAUDE.md` + `CONTRIBUTING.md`** for v1.0
  library shape (D-SCAFFOLD).

**Fork-side (minimal footprint, this repo `get-shit-done`):**
- `package.json` — `./conformance` subpath export (D-CONFORM-EXPORT)
  resolving to the compiled JS of `tests/conformance/adapter.conformance.ts`.
- `adapters/types.ts` — additive `graphEdges: { semantic: boolean;
  dependency: boolean }` field on `Capabilities` (D-OQ06-CAPS).
- `adapters/markdown/index.ts` — declare `graphEdges: { semantic: true,
  dependency: false }` on MarkdownAdapter's capabilities object. No
  behavior change; satisfies the new required field.

### What Phase 6 does NOT do

- **Modify the StorageAdapter contract surface** beyond the additive
  `graphEdges` field. The interface is LOCKED post-Phase 5. If Phase 6
  discovers a contract gap, surface it as an ADR proposal; do not
  mutate `adapters/types.ts` silently.
- **Ship the adapter-name runtime resolver** — Phase 8 DIST-01. Phase 6
  designs BeadsAdapter's package export (`export class BeadsAdapter` +
  `export default BeadsAdapter`, matching sibling's already-working
  pattern) to satisfy the resolver's `new Adapter(projectDir)`
  invocation contract, but does not implement the resolver itself.
- **Ship the markdown→bd migration tool** — Phase 8 DIST-02.
- **Ship paired conformance tests against MarkdownAdapter** — Phase 7
  CONFORM-01..04. Phase 6 ships sibling-side smoke tests only, plus
  invokes `runAdapterConformanceSuite('beads', factory)` against
  BeadsAdapter in isolation.
- **Flip `capabilities.graph` / `graphEdges.semantic` to `true` on
  BeadsAdapter** — D-OQ06 is explicit: BeadsAdapter ships
  `graphEdges: {semantic: false, dependency: true}`. Semantic edges on
  bd backend are deferred post-v1.0.
- **Expand v1.0 scope to include a standalone `GraphAdapter`
  sub-interface** — rejected in D-OQ06.
- **Re-author ~1000 LOC of sibling code from scratch.** The carry-forward
  whitelist ports proven code to TS; the rest of the sibling is
  archive-branched.

</domain>

<decisions>
## Implementation Decisions

### D-MAPPING (AMENDED): storage model — spike-first, then fallback

**Original lock:** L2 sections → bd sub-records (native mutable JSON
fields); L3/L4 nested content → anchor-tagged comments.

**Reality:** Sibling empirically could not find a bd v1.0.3 primitive
for JSON sub-records at the CLI level; shipped labels-first +
description-blob (71 tests green). Original D-MAPPING assumes an
unverified bd capability.

**Amendment (new decision):**

- **D-MAPPING-SPIKE:** **Plan 06-01 spikes bd v1.0.3** for any
  named-JSON-field primitive beyond `--description`. Concrete spike
  questions:
  1. Does `bd update <id>` accept arbitrary JSON in a named field
     (not `--description`)?
  2. Do bd sub-records (if they exist) survive `bd export --json`
     round-trip byte-identical?
  3. Can L3/L4 anchor-tagged comments be filtered by `--author` or
     label at query time (note: sibling's Landmine 4 found `bd
     comments add` does NOT accept `--label` in v1.0.3; only
     `--author` is structured)?
- **Outcome A (sub-records available):** original D-MAPPING lives —
  L2 → bd sub-records (native mutability; `updateSection` mode
  overwrite/append/prepend becomes a JSON array/value op); L3/L4 →
  anchor-tagged comments with path-concatenation (`gsd:section:###
  Evidence:#### Sub-point`). Per-canonical-file TS schemas per the
  D-MAPPING-SCHEMA original vision (12+ schemas).
- **Outcome B (sub-records unavailable, labels-first ships):**
  Accept sibling's proven architecture. Frontmatter ↔ bd labels
  (`phase-id:07` ↔ `{phase_id: '07'}`; hyphens-to-underscores); body
  stored as issue's single `description`, re-parsed via section.mjs
  on read. Scope per-canonical-file schemas DOWN to only `ROADMAP.md`
  (port sibling's 251-LOC `phase.mjs` — bidirectional, idempotency
  contract) and `STATE.md` (needs per-type payload typing for
  `AppendEvent` / `MutationEvent` / `SignalEvent` discriminated
  unions). For the other 10 canonical files, use the
  generic-parser-plus-typed-label-enum approach the sibling proved
  works (generic `section.ts` + `frontmatter.ts` parsers).
- **Event-family mapping holds in BOTH outcomes:**
  - `recordStateAppend` high-frequency types → `bd comments add
    --author gsd:event:<type>` (per sibling D-09 amendment; Landmine 4
    forces `--author` over `--label`).
  - `recordStateAppend` low-frequency types → `bd remember <json>
    --key <milestone>:<type>:<id>`.
  - `recordStateMutation` → label add/remove OR memory-key update
    (OR sub-record array op in Outcome A).
  - `recordStateSignal` → memory or label delete.
- **Spike output requirements:** SPIKE-RESULTS.md §§1–9 populated;
  §7 names the locked outcome (A or B) with evidence cites; §9 lists
  the shipped bd CLI commands for the chosen outcome. Spike
  **INCOMPLETE** if these are missing, blocks Plans 06-02+.

### D-TECH-STACK (NEW): full TypeScript migration

- **D-TECH-STACK:** Sibling's stack (`.mjs` + `node:test` +
  `peerDependencies`) migrates to the fork's stack (`.ts` + `vitest` +
  `"get-shit-done": "file:../get-shit-done"` dev-dep with
  `peerDependencies` preserved per sibling's pattern for post-Phase-8
  distribution). Every whitelisted `.mjs` port target becomes `.ts`
  during the port; new adapter-compliance modules are authored
  natively in `.ts`. TypeScript enforces at compile time:
  - `StorageAdapter` interface conformance (Bin A + foundational +
    3 `recordState*` methods).
  - `StateWriteOutcome` three-state return shape on every
    `recordState*` call.
  - `AppendEvent` / `MutationEvent` / `SignalEvent` discriminated-union
    payloads imported from fork (`adapters/state-event-types`) —
    exhaustive dispatch at compile time.
  - `Capabilities` shape including the new `graphEdges: {semantic,
    dependency}` field.
- **Cost:** ~1000 LOC port (≈2× original LOC budget). Offset by
  catching WR-02/WR-03 (frontmatter YAML escape) and several
  WARN-level shape bugs at compile time during the port.
- **Test scripts:** `npm test` runs vitest across unit + conformance
  (adapts sibling's dual-path auto-invoke gate pattern to vitest
  `describe`/`test`). No `node --test` paths remain.
- **Package name stays `gsd-beads`;** `peerDependencies` pattern stays
  for the post-Phase-8 world; during dev, `"get-shit-done":
  "file:../get-shit-done"` is added under `devDependencies`.

### D-SCAFFOLD (AMENDED): archive-branch + selective prune + whitelist port

**Original lock:** `npm init -y`; zero v0.2 carry-forward except spike
findings + format module CONCEPT (not code).

**Reality:** Sibling has proven-correct code + test fixtures that
validated it. Discarding in favor of re-authoring costs more than
porting does.

**Amendment (flips the repo-preparation mechanics):**

Plan 06-01 Task X (the scaffold task):

1. **Archive full history:** `git branch v0.2-archive` on sibling
   main. Preserves all shadow + library-alpha history cheaply (single
   branch pointer; no copy cost).
2. **Selective prune on main:** `git rm -rf` everything EXCEPT the
   carry-forward whitelist.
3. **Port whitelisted `.mjs` → `.ts`** in the same commit (per
   D-TECH-STACK). Amend during the port: fix WR-05 atomic-write
   ms-resolution race (crypto.randomBytes or O_EXCL); fix Landmine 3
   adapter-context CWD propagation.
4. **Delete outright:** `archive/v0.2-shadow/`, `install/memories/`,
   `install/`, `settings.fragment.json`, `recipe/`,
   `gsd-sdk-cc.version.lock`, most of `.planning/` (keep only spike
   014), sibling's own `.claude/skills/spike-findings-gsd-beads/`
   (canonical copy lives in fork).
5. **Init/update `package.json`:** name stays `gsd-beads`; exports
   shape stays (primary class at `./src/adapter.ts` or `./src/index.ts`
   per planner discretion); `peerDependencies: { "get-shit-done-cc":
   "*" }` pattern preserved; `devDependencies: { "get-shit-done":
   "file:../get-shit-done", "vitest": "^1" }`.
6. **Rewrite `README.md` + `CLAUDE.md` + `CONTRIBUTING.md`** for
   v1.0 adapter library shape. Most of the old content is shadow-era
   narrative; replace wholesale.

**Carry-forward whitelist (all paths relative to
`/Volumes/code/gsd-beads/`):**

| File | LOC | Role | Port amendments during migration |
|------|-----|------|----------------------------------|
| `src/bd/findRoot.mjs` | 68 | bd-managed-dir walker (4 topology cases tested) | Direct `.ts` port; preserve 4-case test table |
| `src/bd/helper.mjs` | 65 | spawnSync wrapper + sentinel errors + JSONL fallback | `.ts` port; **amend:** make `cwd` come from adapter context implicitly (Landmine 3) |
| `src/bd/errors.mjs` | ~50 | `BeadsCause` enum + sentinel subclasses | `.ts` port; **amend:** add `BdManagedMismatchError` with fork's locked shape (code/projectDir/hint/__brand per D-INIT-ERR) |
| `src/helpers/parsePhaseId.mjs` | 16 | label normalization | Direct `.ts` port |
| `src/helpers/deriveDiskStatus.mjs` | 24 | 7-value priority chain | Direct `.ts` port |
| `src/helpers/detectDrift.mjs` | 40 | 3-kind drift detector | `.ts` port (narrower than D-MAPPING-SCHEMA vision but useful pattern) |
| `src/helpers/loadMilestoneHeading.mjs` | 25 | milestone-heading formatter | Direct `.ts` port |
| `src/format/phase.mjs` | 251 | bidirectional ROADMAP.md phase parser + idempotency contract | `.ts` port; preserves idempotency contract (`parse(format(parse(x))) === parse(x)` not byte-equality) |
| `src/format/section.mjs` | ~130 | slugify + locateSection + rewriteSection | `.ts` port |
| `src/format/frontmatter.mjs` | 107 | flat-scalar YAML parser | `.ts` port; **conditional escalation:** swap to `js-yaml` IF nested-object frontmatter surfaces in fork's corpus during port |
| `src/adapter/pathRouter.mjs` | 97 | closed-enum path router | `.ts` port as `src/paths.ts`; **amend:** 7 patterns reviewed + extended against fork's canonical-file list (larger than sibling's) |
| `src/adapter/_atomicWrite.mjs` | 30 | tmpfile + POSIX rename | `.ts` port; **fix WR-05** ms-resolution race via `crypto.randomBytes` suffix or `O_EXCL` open flag |
| `tests/fixtures/build-seed.sh` | — | JSONL seed regeneration | Kept as-is; enforces `BEADS_ACTOR=seed` discipline |
| `.planning/spikes/014-bd-blocks-sibling-deps/SPIKE.md` | — | Dep-edges primitive proof | Copied into `.planning/research/spike-014-bd-blocks.md` (D-OQ06 evidence) |

### D-TXN-SPIKE (AMENDED): three outcomes evaluated

**Original lock:** Plan 06-01 spikes bd's store-clone + bead-hash
bookmark; outcome gates Option A (in-memory buffer) vs B (staging
store + bookmark cutover).

**Amendment (widens spike, adds C as sibling-proven fallback):**

Plan 06-01 spike evaluates THREE outcomes:

- **Outcome A:** in-memory write-buffer. Queue mutations in an
  `activeTransaction` buffer; apply on commit (sequential bd issue
  edits); discard on rollback; reads consult buffer first. ~150 LOC.
  **Gap:** mid-txn failure after 2-of-3 buffered writes apply leaves
  bd partially committed on the Nth issue. Flagged as Phase 6.1
  follow-up if Phase 7 conformance (CONFORM-04) judges unacceptable.
- **Outcome B:** staging bd store + bead-hash bookmark cutover.
  `withTransaction` entry creates a staging bd store at a derived
  path; all mutating adapter calls redirect to staging; reads merge
  staging-over-real so callers see own-writes; commit = atomic
  bead-hash bookmark swap of the project's canonical pointer;
  rollback = drop staging store. Architecturally 1:1 with
  MarkdownAdapter's shadow-dir journal. **Closes SYNTHESIS §9
  HIGH-severity dry-run gate on BeadsAdapter by construction** — IF
  bd v1.0.3 exposes the primitives.
- **Outcome C (NEW, sibling-proven):** file-snapshot restore. At txn
  entry, take `bd export --json -o <path>` snapshot (JSONL, includes
  memories by default). On rollback, `bd init --from-jsonl
  --prefix <derived> --non-interactive --skip-agents --skip-hooks
  --quiet` into a fresh tmpdir; swap via fs-level `.beads/` directory
  rename (POSIX atomic). **Slow** (bd init cold-start ~400–700ms per
  rollback), but **proven reliable** in sibling's Phase 7 shipping
  code (71 tests). Prefix derivation from snapshot metadata (fix
  Landmine 12 WR-04 sibling hardcoded `'sd'`).

**Spike output expectations:**
- § "bd CLI primitives discovered" — full CLI command catalog of
  what bd v1.0.3 actually exposes (extends sibling helper's set).
- § "Store-clone + bead-hash bookmark availability" — PASS/PARTIAL/
  FAIL verdict with commands attempted + outputs.
- § "Named-JSON-field availability" (D-MAPPING spike question) —
  PASS/PARTIAL/FAIL verdict with commands attempted + outputs.
- § "Chosen txn outcome" — A / B / C with justification. Neutral
  language — no "fallback" framing.
- § "Chosen mapping outcome" — A (sub-records) or B (labels-first)
  with justification.

**Plan 06-03 (withTransaction impl) has three implementation paths,
selected post-spike.** Documentation names the shipped outcome
neutrally.

### D-TXN-CAPS (RE-AFFIRMED): capabilities report per outcome

- `capabilities.transaction: true` in ALL THREE outcomes (pipeline.ts
  dry-run depends on it unconditionally).
- `capabilities.snapshot: true` in Outcome B AND Outcome C (both
  provide snapshot semantics — B via bookmark, C via file-snapshot);
  `false` in Outcome A. Document which variant shipped in
  BeadsAdapter README.

### D-OQ06 (RE-AFFIRMED): layered graph edges + fine-grained capability

**Evidence:** Spike 014 in sibling (`.planning/spikes/014-bd-blocks-sibling-deps/`)
independently validated every property D-OQ06 needs:
- `bd dep add` (default `blocks` type) works.
- Field name in `bd export --json` is `type` (NOT `dependency_type`
  — that's `bd show` shape).
- `depends_on_id` is the blocker direction.
- Single `bd export --json` surfaces all edges (fits ≤2-spawn
  budget).
- Cascade-loop IGNORES blocks-edges (only walks parent-child) — so
  dep-edges don't accidentally trigger phase close.

- **D-OQ06:** `graphs/graph.json` edge schema extends to include
  `type: 'semantic' | 'dependency'` (additive, not replacing).
  Two separate pipelines feed it:
  - **Semantic edges** (unchanged): `graphify.cjs` continues to
    produce fuzzy confidence-tiered semantic edges from `.planning/`
    markdown. Works as today on MarkdownAdapter; ABSENT on
    BeadsAdapter (graphify targets markdown only; deferred post-v1.0).
  - **Dependency edges** (new, BeadsAdapter-native): BeadsAdapter
    exposes bd's `blocks` / `blocked-by` issue-graph edges as
    `{type: 'dependency', confidence: 1.0}` entries via a small
    synthesizer (`src/dep-graph.ts`). MarkdownAdapter emits zero
    `type: 'dependency'` edges.
- **D-OQ06-CAPS:** `Capabilities` gains
  `graphEdges: { semantic: boolean; dependency: boolean }` (replaces
  the simpler `graph: boolean` sketched in SYNTHESIS §9).
  MarkdownAdapter: `{ semantic: true, dependency: false }`.
  BeadsAdapter: `{ semantic: false, dependency: true }`.
  **Only Phase-6 change to the locked contract surface — additive.**
- **D-OQ06-CONSUMERS:** `gsd-phase-researcher` and `graphify.md`
  filter edges by `type` when they care. Both consumers already
  tolerate missing `graphs/graph.json`; adding type-aware filtering
  is a small uplift. Deferred to Phase 8 unless the planner judges
  it in-scope.
- **D-OQ06-DEFERRED:** Running `graphify.cjs` against bd as a data
  source (so semantic edges also exist on BeadsAdapter) is deferred
  to post-v1.0 or Phase 8.

### D-BINARY (RE-AFFIRMED): skip-and-warn

- **D-BINARY:** `capabilities.binaryAsset: false` on BeadsAdapter.
  `writeBinaryAsset` throws `UnsupportedCapabilityError` (use the
  fork's class from `adapters/types.ts:123` — NOT sibling's
  `UnsupportedOperationError`). Consumer workflows guard with
  `hasBinaryAsset(adapter)` per Phase 5 D-18 and skip-with-warning.
  Zero BeadsAdapter LOC beyond the throw; zero runtime cost.
- Port sibling's 4-test capability-lint pattern from
  `capabilities.test.mjs` into Phase 6 smoke coverage.

### D-INIT-ERR (RE-AFFIRMED): typed error class + port sibling's probe

- **D-INIT-ERR:** BeadsAdapter exports
  `BdManagedMismatchError extends Error` with fields:
  - `code: 'PROJECT_BD_MANAGED_MISMATCH'` (literal)
  - `projectDir: string`
  - `hint: string` (human-readable next step)
  - `__brand` symbol for cross-module instanceof resilience (mirrors
    `UnsupportedCapabilityError` precedent).

  `BeadsAdapter.init()` (or lazy `_ensureBd()` per sibling D-18
  pattern) throws this class when target dir is not bd-managed.
- **Probe mechanism:** port sibling's `findBeadsRoot()` walk
  (`src/bd/findRoot.mjs`, 68 LOC, proven against 4 topology cases:
  worktree / `BEADS_DIR` env / symlink / non-bd). Direct `.ts` port.

### D-CONFORM-EXPORT (RE-AFFIRMED): fork `./conformance` subpath

- **D-CONFORM-EXPORT:** Fork's `package.json` gains `"./conformance"`
  entry in its `exports` field pointing at the compiled JS of
  `tests/conformance/adapter.conformance.ts`. Verify the TS emit
  path matches during Plan 06-01; fix emit config if not.
- Sibling imports via:
  ```ts
  import { runAdapterConformanceSuite } from 'get-shit-done/conformance';
  import { BeadsAdapter } from './src/index.js';
  runAdapterConformanceSuite('beads', (dir) => new BeadsAdapter(dir));
  ```
- `runAdapterConformanceSuite` signature is LOCKED (Phase 1 D-15);
  no harness changes needed.
- Sibling's own `tests/conformance/` harness is DELETED in the
  selective-prune step (D-SCAFFOLD). Retire it; fork's wins.
- Port sibling's conformance test-writing patterns (dynamic test
  names over enum constants; `spawnSync` direct bd read-backs per
  sibling D-12; array-unwrap on `bd show --json`; `chmodSync 0o700`
  post-init; auto-invoke gate adapted to vitest `describe`/`test`).

### D-RUNTIME-RESOLUTION (RE-AFFIRMED): dual export shape

- **D-RUNTIME-RESOLUTION (Phase 8 preview):** BeadsAdapter exports
  BOTH:
  ```ts
  export class BeadsAdapter { ... }
  export default BeadsAdapter;
  ```
  Satisfies Phase 8 DIST-01 resolver's
  `const Adapter = (await import('gsd-beads')).default; new Adapter(projectDir)`
  (default export) AND TS consumers'
  `import { BeadsAdapter } from 'gsd-beads'` (named, for type
  inference). Sibling already does this at `src/adapter.mjs:96`;
  preserve during the port.

### Landmines fixed during the port (NOT inherited) — Canonical ID table

**Source of truth for Phase 6 landmine numbering.** All plans (06-01..06-07),
CLAUDE.md template, and PHASE-6-EXIT.md audit grep map MUST cite these IDs.
Column **Landmine #** matches SKILL.md §9 numbering exactly. Column **Phase 6
item** is the sequential fix-register position (used in doc prose for
readability only — NOT the canonical ID).

| Landmine # | Phase 6 item | Shorthand | What breaks | Fix (during port) | Owning plan |
|-----------:|-------------:|-----------|-------------|-------------------|-------------|
| **1 / CR-01 BLOCKER** | 1 | `_abs()` path traversal | `putRecord('/etc/passwd', body)` or `../` escapes repo root | Runtime guard: `startsWith(root + sep)` check + throw `TypeError`; negative conformance tests | 06-05 (primitives) |
| **2 / CR-02 BLOCKER** | 2 | `putRecord` hybrid-tier bypass | `putRecord('.planning/intel/foo.md')` writes disk but misses `bd remember` index entry | Force hybrid through named-doc dispatch in `paths.ts` OR delete hybrid tier entirely | 06-04 (paths.ts) |
| **3** | 3 | bd helper `cwd` not propagated | `spawnSync('bd')` uses `process.cwd()`; wrong `.beads/` found during conformance tests | Bake adapter-context CWD implicitly in `BdRunner` wrapper constructor | 06-02 (bd/helper.ts port) |
| **4** | 4 | `bd comments add --label` unsupported in v1.0.3 | Labels silently dropped on comments | Use `--author gsd:event:<type>` exclusively for high-freq append event types | 06-06 (recordStateAppend) |
| **5** | 5 | `bd show <id> --json` returns single-element array | `JSON.parse(stdout)` consumers unwrap wrong | `Array.isArray(shown) ? shown[0] : shown` unwrap in `BdRunner` | 06-02 (bd/helper.ts port) |
| **6** | 6 | `bd export --json` is JSONL, not JSON array | `JSON.parse(stdout)` throws | Try `JSON.parse` first; on throw, split by newline + parse each line | 06-02 (bd/helper.ts port) |
| **7** | 7 | "no issues found" returns `{error, schema_version}` exit 0 | Looks like success; actually empty | Detect + map to `BeadsEmpty` sentinel in `BdRunner` | 06-02 (bd/helper.ts port) |
| **8** | — (out of scope) | `listCollection` on bd-routed singleton silently returns `[]` (WR-08) | Misroute doesn't error | Throw on misroute (defensive — WR-08 sibling bug; Plan 06-05 `listCollection` does this) | 06-05 (primitives) |
| **9** | 8 | `.beads` mode warnings every bd call | Warn text pollutes stdout; bd nags | `chmodSync(0o700)` immediately after bd init | 06-07 (conformance fixture) + 06-06 (snapshot/restore) |
| **10** | — (discipline, not code fix) | `tests/fixtures/seed.jsonl` uncommitted-dirty | Seed regeneration not reproducible | Enforce seed-regenerated-in-CI from `build-seed.sh`; NOT hand-edited | 06-07 (tests/fixtures) |
| **11** | — (discipline) | `BEADS_ACTOR` leak breaks CONF-03 byte-identity | `created_by` flips to dev's actor identity | `BEADS_ACTOR=seed` on EVERY bd call during seed rebuild | 06-07 (tests/fixtures/build-seed.sh) |
| **12 / WR-04** | 11 | `restore()` hardcodes `--prefix 'sd'` | Breaks for non-sd prefixes | Derive prefix from snapshot metadata or first issue's id format | 06-06 (withTransaction Outcome C) |
| **13 / WR-05** | 10 | atomic-write tmpfile ms-resolution race | `${pid}.${Date.now()}` collision | `process.pid + crypto.randomBytes(6)` suffix OR `O_EXCL` open flag | 06-02 (_atomicWrite.ts port) |
| **13-WR02/03 (subset)** | 9 | `formatFrontmatter` YAML escape bugs | Nested/escaped values mangled | TS port's type system catches many; escalate to `js-yaml` if nested-object frontmatter surfaces in fork corpus | 06-04 (format/frontmatter.ts port) |

**Audit invariant (Plan 06-07 PHASE-6-EXIT.md):** Every row above must have a
corresponding grep-verifiable proof in the ported source. 10 landmines are
CODE-fix rows (1, 2, 3, 4, 5, 6, 7, 9, 12, 13); 2 are DISCIPLINE rows (10, 11);
1 is DEFENSIVE-check (8). Plan 06-07 Task 4 PHASE-6-EXIT.md checklist cites
this table by landmine # + "Phase 6 item" where applicable.

### Claude's Discretion

- **Spike sequencing within Plan 06-01** — standalone doc vs test
  file vs script; mapping-spike + txn-spike order.
- **Exact bd primitives invoked** — CLI shell-out everywhere (sibling's
  pattern; no node bindings exist in bd v1.0.3 per research) is the
  default; revisit only if spike surfaces alternatives.
- **Plan count and wave structure** — amendment proposes 4 plans ×
  4 waves (01 scaffold+spike+fork-side, 02 primitives compliance,
  03 withTransaction outcome, 04 dep-edge + conformance + README).
  Planner's call — may widen to 5 if the D-MAPPING spike Outcome A
  (sub-records) ships, because schema-authoring scope inflates.
- **Format module internal organization** — single file per canonical
  schema, or one big `format.ts`.
- **BeadsAdapter.init() exact probe invocation** — `ls .bd/` /
  `bd status` / port findRoot.ts's walk. Sibling's port is
  recommended.
- **Error-class export path** — `src/errors.ts` vs inline in
  `src/index.ts`.
- **Dep-edge synthesizer strategy** — lazy on
  `getRecord('graphs/graph.json')` vs eager cache on writes to bd's
  blocks-edges.
- **Sibling-repo branch strategy** — long-lived `main` vs per-plan
  feature branches. Planner's call, mirroring this fork's strategy.
- **BeadsAdapter package export path** — `./src/adapter.ts` vs
  `./src/index.ts`. Sibling uses `./src/adapter.mjs`; preserving
  the path during port is cleanest for minimizing `package.json`
  diff.
- **WARN-level landmine triage** — which of WR-01/WR-09 inherit vs
  fix during port. Planner weighs against Phase 6 LOC budget.

### Folded Todos

None. The only candidate (`cjs-sdk-golden-parity-failures.md`) was
reviewed and NOT folded — belongs to Phase 8 DIST-04 or standalone
debt plan (see Reviewed Todos below).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (gsd-phase-researcher, gsd-planner) MUST read
these before researching or planning.**

### Project-locked architecture

- `.planning/PROJECT.md` — Fork architecture, two-repo model
  (D-2026-04-30-02), strict-superset invariant, branch strategy.
  Phase 6 works in the SIBLING repo at `/Volumes/code/gsd-beads`;
  fork-side changes are minimal (`./conformance` subpath export +
  `graphEdges` additive Capabilities field).
- `.planning/DECISIONS.md` — Locked decisions D-2026-04-30-01..11 +
  D-2026-05-01 (stat primitive) + D-2026-05-01-OQ04 + D-2026-05-01-OQ09
  + D-2026-05-10-01..08. **Phase 6 appends ADRs for:**
  - D-MAPPING spike-first outcome (post Plan 06-01 spike)
  - D-TXN-SPIKE chosen outcome (post Plan 06-01 spike)
  - D-TECH-STACK full TS migration
  - D-SCAFFOLD archive-branch + selective prune
  - OQ-06 resolution (D-OQ06 layered edges)
- `.planning/STATE.md` — Current state; "Phase 06 — next phase is in
  sibling repo `/Volumes/code/gsd-beads` — switch repos to continue".

### Prior phase outputs (locked, treat as carry-forward facts)

- `.planning/phases/01-fork-bootstrap-storageadapter-interface-skeleton-markdownada/01-CONTEXT.md`
  — D-02 (CJS stays untouched), D-07 (`createRegistry` DI), D-08
  (capabilities enum), D-10 (full v1.0 surface declared), D-11 (type
  guards), D-15 (`runAdapterConformanceSuite` signature lock).
  BeadsAdapter implements against the contract Phase 1 locked.
- `.planning/phases/03-wire-core-write-methods-recordstateevent/03-CONTEXT.md`
  — D-01/D-02 (3 event families designed specifically for clean bd
  mapping — append→comment, mutation→sub-record, signal→sidecar —
  this is the PRIMARY DRIVER for D-MAPPING), D-04 (adapter interface
  stays thin — NO domain logic in BeadsAdapter), D-10 (withTransaction
  maps to native concurrency mechanisms).
- `.planning/phases/03-wire-core-write-methods-recordstateevent/03-06-PLAN.md`
  + ADR D-2026-05-10-08 — `StateWriteOutcome` three-state contract
  (2026-05-11 ship). Phase 6 MUST return `StateWriteOutcome` from
  all three `recordState*` methods with `applied: true/false +
  reason/created_section` discriminants exactly as locked.
- `.planning/phases/05-foundational-primitive-lift/05-CONTEXT.md`
  — D-01 (shadow-dir journal — architectural analog for D-TXN
  Outcome B), D-06 (L2/L3/L4 heading-depth walker — BeadsAdapter's
  section atomicity MUST match this depth resolution), D-09
  (`updateSection` internally `withTransaction`-wrapped — BeadsAdapter
  preserves this contract), D-11 ("`updateSection` dispatches to
  per-section sub-record updates which inherit bd's per-issue
  atomicity" — original seed for D-MAPPING; now conditional on
  spike outcome), D-13/D-14 (`NamedDocCategory` + 'root'
  discriminator — BeadsAdapter MUST honor the closed union), D-17/D-18
  (`writeBinaryAsset` primitive + graceful degradation — D-BINARY
  descendant), D-19 (sidecar SDK-typed verbs — BeadsAdapter
  path-sniffs 2–3 keys per README), D-20 (scratch as first-class
  phase-scoped types).

### Milestone scope

- `.planning/REQUIREMENTS.md` §"BEADS" — BEADS-01..05. BEADS-05
  (writeBinaryAsset graceful-degradation) is resolved by D-BINARY.
- `.planning/ROADMAP.md` §"Phase 6" — Goal, depends on Phase 5 per
  SYNTHESIS §9 dry-run gate, resolves OQ-06, 5 Success Criteria.
  SC#4 (OQ-06) resolved by D-OQ06. SC#5 (graceful degradation)
  resolved by D-BINARY.

### Architectural source-of-truth

- `.planning/research/fork-investigation/SYNTHESIS.md` — 723 lines.
  - **§4** — Adapter interface (Bin A + foundational + ~58 Bin B).
    BeadsAdapter implements the locked Phase-5 surface + 3
    `recordState*` families from Phase 3.
  - **§6 #5 (OQ-06)** — Resolved by D-OQ06.
  - **§7 Phase 6** — Canonical phase scope; maps domain methods to
    bd-native shape. Amended by hybrid pivot (this repo becomes
    CONTEXT.md rather than greenfield plans).
  - **§8** — Recommended carry-forward: 13 spike findings, format
    module concept, `parsePhaseId`/`deriveDiskStatus`/
    `loadMilestoneHeading` helpers, JSONL roundtrip seed pattern,
    blocks-edge sibling-dep modeling (spike 014). All relevant.
  - **§9 Risk register** — HIGH dry-run gate closed on
    MarkdownAdapter (Phase 5 SC#1, 2026-05-11); D-TXN-SPIKE extends
    to BeadsAdapter. HIGH section semantics — D-MAPPING spike +
    Phase 7 CONFORM-03 validates. MEDIUM knowledge-graph — D-OQ06
    resolves. MEDIUM binary asset — D-BINARY resolves.

### Adapter contract (locked, Phase 6 targets)

- `adapters/types.ts` — 159 lines. Locked StorageAdapter contract.
  Phase 6 targets:
  - `StorageAdapter` interface (lines 67–121) — Bin A + foundational
    + 3 `recordState*` methods.
  - `StateWriteOutcome` (lines 50–52) — three-state discriminated
    union. All three `recordState*` return this.
  - `NamedDocCategory` (line 15) + `RootNamedDocKey` (line 26) —
    closed unions BeadsAdapter must honor.
  - `Capabilities` (lines 54–65) — Phase 6 adds
    `graphEdges: { semantic: boolean; dependency: boolean }` per
    D-OQ06-CAPS (only contract change — additive).
  - `UnsupportedCapabilityError` (lines 123–142) — exemplar for
    `BdManagedMismatchError` shape (D-INIT-ERR).
- `adapters/markdown/index.ts` — 1452 lines. Reference implementation
  for equivalence; Phase 6 adds `graphEdges: { semantic: true,
  dependency: false }` to its capabilities object (additive; no
  behavior change).
- `adapters/state-event-types.ts` — `AppendEvent` / `MutationEvent` /
  `SignalEvent` payload unions. BeadsAdapter dispatches on
  `event.type` in each `recordState*` method.

### Conformance harness

- `tests/conformance/adapter.conformance.ts` — Factory harness.
  Signature `runAdapterConformanceSuite(adapterName, adapterFactory)`
  LOCKED (Phase 1 D-15). Phase 6 exports via the fork's
  `package.json` `./conformance` subpath (D-CONFORM-EXPORT).
- `tests/conformance/markdown.conformance.test.ts` — Pattern
  reference for how a conformance consumer wires its adapter in.
- `tests/conformance/write-outcome.test.ts` — `StateWriteOutcome`
  conformance tests (16 cases). Phase 6 asserts BeadsAdapter
  satisfies the same 16 cases via smoke tests; Phase 7 makes parity
  formal.

### Spike carry-forward (documentation; skill)

- `./.claude/skills/spike-findings-gsd-beads/` (in the fork) —
  6 files, 2696 lines (SKILL.md + 5 reference files):
  - `SKILL.md` — overview + decisions-to-carry-forward table +
    rejected-decisions + tech-stack deltas + landmines + files-to-
    preserve-vs-delete catalog.
  - `bd-primitives.md` — bd CLI call-site catalog (exact flag table
    + call-site examples + `BEADS_ACTOR` discipline).
  - `format-modules.md` — file-by-file walk of sibling's format
    modules (phase/section/frontmatter).
  - `conformance.md` — conformance harness + test patterns (harness
    shape, auto-invoke gate, per-test fixture setup).
  - `decisions-carry-forward.md` — sibling D-ID → fork D-ID mapping.
  - `landmines.md` — 13 detailed bug scars (CR-01/02 BLOCKERs,
    WR-01..11 WARNings).
  **MUST be read by Phase 6 researcher + planner + executor.**

### Sibling repo state (frozen for Phase 6)

- `/Volumes/code/gsd-beads` @ `main @ 5082d45` — frozen by user
  confirmation; no parallel work until Phase 6 completes.
- ~15 KLOC shipped code: `src/bd/`, `src/helpers/`, `src/format/`,
  `src/adapter/`, `src/adapter.mjs`, `tests/unit/`, `tests/conformance/`,
  `tests/fixtures/`.
- 71 conformance tests green against live bd v1.0.3.
- 13 concluded spikes under `.planning/spikes/` (spike 014 is primary
  D-OQ06 evidence).
- `package.json` has `"type": "module"`, `"main": "./src/adapter.mjs"`,
  `"exports"` declaring adapter + bd helper + errors + findRoot +
  helpers + format/phase subpaths (port exports to `.ts`-compiled
  equivalents), `peerDependencies: { "get-shit-done-cc": "*" }`
  with `optional: true`.
- bd CLI dependency: user will install bd v1.0.3 before Plan 06-01
  spike executes. Replanning proceeds without bd installed.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (fork-side, consumed by sibling)

- **`adapters/types.ts`** (159 LOC) — locked contract. BeadsAdapter
  imports: `StorageAdapter`, `StateWriteOutcome`, `NamedDocCategory`,
  `RootNamedDocKey`, `UnsupportedCapabilityError`, 5 capability type
  guards. Phase 6 adds `graphEdges` field.
- **`tests/conformance/adapter.conformance.ts`** — factory
  `runAdapterConformanceSuite(adapterName, adapterFactory)`. Phase 6
  adds `./conformance` subpath; sibling imports.
- **`adapters/markdown/index.ts`** — reference for equivalence:
  - L2/L3/L4 heading-depth walker (lines ~189–241) —
    BeadsAdapter's anchor-tagged comment path-concatenation (Outcome A)
    or section-rewrite (Outcome B) must match depth resolution.
  - `recordStateAppend`/`Mutation`/`Signal` — Phase 6 smoke tests
    assert same `StateWriteOutcome` variants for same input shapes.
  - `acquireAdapterLock` + `lockSet` reentrant pattern — BeadsAdapter
    staging-store lifecycle (Outcome B) or in-memory buffer (A) or
    fs-rename cutover (C) all need reentrancy-guard shape.

### Reusable Assets (sibling-side, ported to `.ts`)

Per D-SCAFFOLD whitelist — all in port scope:

- `src/bd/findRoot.ts` — `findBeadsRoot()` walk for
  `.beads/metadata.json` (68 LOC; 4 topology cases tested). Used by
  `BeadsAdapter.init()` probe.
- `src/bd/helper.ts` — `spawnSync('bd', args, {cwd, env, encoding})`
  wrapper; JSONL-fallback for `bd export --json`; sentinel-error
  mapping for `BeadsEmpty`, `BeadsNotInstalled`, `BeadsCorrupt`,
  `BeadsVersionMismatch`, `UnsupportedOperationError`. **Amend for
  adapter-context CWD (Landmine 3) during port.**
- `src/bd/errors.ts` — `BeadsCause` enum + sentinel subclasses;
  name-fallback discipline for cross-module instanceof. **Add
  `BdManagedMismatchError`** per D-INIT-ERR during port.
- `src/helpers/parsePhaseId.ts` — label normalization (`phase-id:07`
  → `'07'`; decimal preserved).
- `src/helpers/deriveDiskStatus.ts` — 7-value priority chain
  reducer (`no_directory` → `complete` → `partial` → `planned` →
  `researched` → `discussed` → `empty`).
- `src/helpers/detectDrift.ts` — 3-kind drift detector.
- `src/helpers/loadMilestoneHeading.ts` — milestone-heading formatter.
- `src/format/phase.ts` — bidirectional ROADMAP.md phase parser
  (251 LOC; preserves idempotency contract `parse(format(parse(x)))
  === parse(x)` not byte-equality).
- `src/format/section.ts` — slugify + locateSection + rewriteSection
  (anchors: slash-separated slug paths from H1 down; code-fence guard).
- `src/format/frontmatter.ts` — flat-scalar YAML parser (107 LOC;
  escalate to `js-yaml` IF nested-object frontmatter surfaces).
- `src/paths.ts` (ported from `src/adapter/pathRouter.mjs`) —
  closed-enum path router. 7 patterns reviewed + extended for fork's
  larger canonical-file list.
- `src/_atomicWrite.ts` — tmpfile + POSIX rename. **Fix WR-05**
  ms-resolution race during port.
- `tests/fixtures/build-seed.sh` — JSONL seed regeneration script;
  enforces `BEADS_ACTOR=seed` discipline.

### Established Patterns (this milestone's discipline)

- **Adapter stays thin** (Phase 3 D-04): BeadsAdapter has no domain
  logic. No `addPhase` method on BeadsAdapter — `addPhase` lives in
  fork's shared SDK helpers (`phase-helpers.ts`) composing Bin A +
  foundational primitives. BeadsAdapter surface = the contract.
- **Explicit adapter first parameter** (Phase 2 D-10): helpers
  consuming BeadsAdapter follow `(adapter: StorageAdapter, ...rest)`.
  Conformance harness already follows this.
- **Capabilities gate optional features** (Phase 1 D-08): consumers
  check `hasBinaryAsset(adapter)`, `hasSnapshot(adapter)`, etc.
  before calling optional methods.
- **StateWriteOutcome three-state discipline** (D-2026-05-10-08):
  every `recordState*` call returns `applied: true|false` with correct
  discriminant. No silent-true no-ops.
- **≤2 bd spawns per public method invocation** (sibling D-21) —
  performance budget; architectural invariant.
- **`BEADS_ACTOR=seed` on every determinism-relevant bd call**
  (sibling D-20; CONF-03 byte-identity invariant). Carry forward.
- **`chmodSync(.beads, 0o700)` post-init** (Landmine 9) —
  conformance fixtures + snapshot/restore enforce.
- **`bd show <id> --json` returns array** (Landmine 5) — wrapper
  unwraps.
- **`bd list --all`** — essential for conformance fixtures with
  closed records (Landmine).

### Integration Points

**Fork-side (this repo, Phase 6 minimal footprint):**

- `package.json` — add `"./conformance"` subpath export (single line).
- `adapters/types.ts` — extend `Capabilities` with `graphEdges:
  { semantic: boolean; dependency: boolean }` per D-OQ06-CAPS
  (additive).
- `adapters/markdown/index.ts` — declare `graphEdges: { semantic:
  true, dependency: false }` in MarkdownAdapter's capabilities
  object. No behavior change.
- Both changes land as ONE fork-side plan early in Phase 6 so the
  sibling repo imports a file-linked version with updated surface.

**Sibling-side (`/Volumes/code/gsd-beads`, Phase 6 majority):**

- `src/index.ts` (or `src/adapter.ts` preserving sibling's path) —
  `BeadsAdapter` class implementing `StorageAdapter`. Export shape:
  ```ts
  export class BeadsAdapter { ... }
  export default BeadsAdapter;
  ```
- `src/primitives.ts` — Bin A primitives + foundational primitives.
- `src/events.ts` — 3 `recordState*` family implementations
  consuming `AppendEvent`/`MutationEvent`/`SignalEvent` discriminated
  unions from fork; returning `StateWriteOutcome` per case.
- `src/capabilities.ts` — `Capabilities` declaration (9-key shape
  including `graphEdges`).
- `src/format/*.ts` — ported from sibling's `.mjs` per D-SCAFFOLD
  whitelist. If D-MAPPING spike Outcome A (sub-records) ships,
  adds per-canonical-file schemas (12+ schemas). If Outcome B
  (labels-first), scopes down to just `phase.ts` + `state.ts`.
- `src/errors.ts` — ported `src/bd/errors.mjs` + `BdManagedMismatchError`
  per D-INIT-ERR.
- `src/dep-graph.ts` — synthesizer producing `{type: 'dependency',
  confidence: 1.0}` edges from bd `blocks`/`blocked-by` for
  `getRecord('graphs/graph.json')`. Lazy vs eager-cache is Claude's
  discretion.
- `src/txn/*.ts` — A, B, or C implementation selected post-spike.
- `src/init.ts` — `BeadsAdapter.init()` with `findBeadsRoot()`
  walk + fail-fast `BdManagedMismatchError` on non-bd-managed dir.
- `tests/conformance.test.ts` — imports + invokes
  `runAdapterConformanceSuite('beads', factory)` from
  `get-shit-done/conformance`.
- `tests/smoke/*.test.ts` — per-Bin-B-category smoke test (one
  workflow per category) per SC#3 (phase, plan, summary, uat,
  state-event, debug, intel, learnings).
- `package.json`, `tsconfig.json`, `vitest.config.ts` — standard
  v1.0 TS package scaffolding.
- `README.md` — documents D-TXN variant shipped (A/B/C), D-MAPPING
  outcome, capabilities rationale, `gsd:*` label namespace, sidecar
  path-sniff map (per Phase 5 D-19), export shape, known limitations.

### Script/spike scaffolding

- `scripts/spike-bd-primitives.sh` (or `.ts` per D-TECH-STACK) —
  executable bd-primitive evidence gatherer. Writes
  `SPIKE-RESULTS.md` with the 5 required sections: bd CLI catalog,
  store-clone + bead-hash bookmark availability, named-JSON-field
  availability, chosen txn outcome, chosen mapping outcome. Spike
  **INCOMPLETE** if any section missing — blocks Plans 06-02+.

</code_context>

<specifics>
## Specific Ideas

- User chose **spike-first for D-MAPPING** because the original lock
  assumed a bd primitive (JSON sub-records) that the sibling couldn't
  find in 71 tests of use. The spike isn't "skip the hard decision";
  it's "the evidence needed to pick correctly has a bounded cost and
  lives inside Plan 06-01 already." Mirrors the D-TXN-SPIKE pattern
  exactly; consolidating both bd-primitive spikes into one plan
  keeps Plan 06-01's scope coherent ("what does bd v1.0.3 actually
  expose?") rather than spreading it.

- User chose **full TS migration (D-TECH-STACK Option B)** over the
  recommended hybrid (Option C) because compile-time enforcement of
  `StateWriteOutcome` + event discriminated unions at AUTHOR SITE is
  worth the ~1000 LOC port cost. The sibling's Phase 7 had WARN-level
  frontmatter/YAML bugs (WR-02/WR-03/WR-05) that TS would have caught
  — bugs surface at runtime is expensive, bugs surface at edit-time
  is cheap. Single-stack consumption is cleaner than hybrid's
  mental-model split.

- User chose **archive-branch + selective prune + whitelist port
  (D-SCAFFOLD amendment)** over fresh `npm init`/full-rewrite because
  ~750 LOC of proven-correct code (format/phase 251, bd/helper 65,
  bd/findRoot 68, format/section ~130, format/frontmatter 107,
  pathRouter 97, helpers 105, _atomicWrite 30) has real port value
  vs re-author cost. Archive-branch preserves full history
  essentially free (single branch pointer); prune leaves a clean
  working tree. Port-not-reauthor respects the spike-findings skill's
  explicit guidance on "files to preserve vs delete."

- User chose **3 txn outcomes (D-TXN-SPIKE amendment, Outcome C
  added)** because ignoring the sibling's proven file-snapshot
  pattern just because it's slower than staging-store-cutover would
  throw away ~800ms-per-rollback verified reliability. Outcome C is
  the "definitely works" option; A is "fast but leaky"; B is "fast
  + leak-free IFF bd exposes primitives we haven't found yet."
  Spiking all three lets the evidence pick.

- User previously reaffirmed D-2026-04-30-02 (two-repo model) when
  asked about the ceremony. Not re-opened here.

- User previously chose **skip-and-warn for binaryAsset** over blob-
  store routing because v1.0 prioritizes correctness + conformance
  over feature parity (D-BINARY; sibling already ships this pattern;
  port the 4-test capability-lint).

- User previously chose **typed error class** for BEADS-04 (D-INIT-
  ERR): `BdManagedMismatchError` with `code` + `projectDir` + `hint`
  + `__brand`, sharing `UnsupportedCapabilityError`'s shape. Port
  sibling's `findBeadsRoot()` walk as the probe mechanism (proven
  against 4 topology cases).

- User previously chose **subpath export in fork's `package.json`**
  (D-CONFORM-EXPORT) over raw path-dep; marks the public-API
  boundary cleanly.

- User previously asked **"why are we having to separate and link
  these files?"** (mid-prior-discussion) — concern about two-repo
  ceremony. Reaffirmed the two-repo model after re-surfacing the
  upstream-PR path + adapter-pluggability rationale.

- User previously asked **"on gsd update, how would the end user
  have their beads implementation automatically applied?"** —
  prompting D-RUNTIME-RESOLUTION: user installs both packages; sets
  `storage.adapter: "beads"` in config; fork's `createRegistry`
  dynamically `require`s `gsd-beads`. Phase 8 ships the resolver;
  Phase 6 designs export shape (dual default+named class) to
  satisfy it.

</specifics>

<deferred>
## Deferred Ideas

- **bd-sourced semantic edges** — Running `graphify.cjs` against bd
  so BeadsAdapter also produces semantic edges. Requires graphify to
  accept an adapter-mediated input path. Post-v1.0 or Phase 8.

- **Phase-8 adapter-name runtime resolver (DIST-01)** — dynamic
  `createRegistry` resolving `gsd-{name}` from user's `node_modules`.
  Previewed in D-RUNTIME-RESOLUTION; full impl is Phase 8.

- **markdown→bd migration tool (DIST-02)** — Phase 8 ships; Phase 6
  does NOT author migration.

- **Type-aware graph-edge filtering in consumers** — Teaching
  `gsd-phase-researcher` and `graphify.md` to filter by
  `type: 'semantic' | 'dependency'`. Small uplift; may land inside
  Phase 6 at planner's discretion or slip to Phase 8.

- **Phase 6.1 follow-up: bd multi-record commit atomicity** — Only
  needed if D-TXN-SPIKE forces Outcome A (in-memory buffer) AND
  Phase 7 conformance (CONFORM-04) judges the sequential-commit gap
  unacceptable. Tracked so Phase 7 planner finds the breadcrumb.

- **Blob-store routing for binaryAsset on BeadsAdapter** — Ship when
  a consumer workflow actually needs UI-review screenshots on bd
  backend. Non-breaking flip of `capabilities.binaryAsset` when it
  lands.

- **BeadsAdapter-specific sidecar path-sniff map documentation** —
  Closed set of 2–3 keys (per Phase 5 D-19) documented in sibling
  README. Planner-level detail.

- **Publishing `gsd-beads` to npm registry (NPM-01)** — already
  deferred. v1.0 keeps at `/Volumes/code/gsd-beads`; publish only if
  external adopters appear.

- **`gsd update` convenience for adapters** — `npm update -g gsd-*`
  for installed adapter packages when user runs `gsd update`. Polish
  for Phase 8 or post-v1.0.

- **Reconsidering two-repo model (D-2026-04-30-02)** — user asked
  mid-prior-discussion and confirmed keep-two-repos. Flagging
  ceremony friction as a post-v1.0 consideration if painful during
  Phase 7 cross-repo work.

- **If D-MAPPING spike lands Outcome B (labels-first)** — Document
  the "sub-records unavailable in bd v1.0.3" finding as a carry-
  forward learning + upstream bd feature request. Could unblock a
  future BeadsAdapter v2 with richer mapping if bd adds the primitive.

- **WARN-level landmines deferred (WR-01/09)** — `_resolveMilestoneBead`
  docs-lie + `filter(Boolean)` heading-stack collapse. Neither is
  load-bearing for Phase 6; fix-or-defer is planner's call based on
  LOC budget.

- **Systemic: retrofit `planner-subagent-prompt.md` + leak-grep
  scope** (STATE.md pending todo from 2026-05-11) — planner template
  emits `<context>` blocks tripping Phase 4 leak-gate; leak-grep should
  skip `.planning/phases/**/*-PLAN.md` (generated artifacts). Not
  blocking v1.0; Phase 7 or standalone cleanup plan.

### Reviewed Todos (not folded)

- **`cjs-sdk-golden-parity-failures.md`** — Todo matcher scored 0.6
  but content is about CJS↔SDK parity in THIS fork's SDK (Phase 1
  debt per D-2026-04-30-11), not sibling-repo Phase 6 work.
  Appropriate home: Phase 8 DIST-04 (strict-superset invariant
  validation) or standalone debt-cleanup plan.

</deferred>

---

*Phase: 06-beadsadapter-implementation*
*Context gathered: 2026-05-11 (fresh, post-hybrid-pivot)*
*Supersedes: archive-greenfield/06-CONTEXT-pre-pivot.md (amendment-appended, pre-reset)*
