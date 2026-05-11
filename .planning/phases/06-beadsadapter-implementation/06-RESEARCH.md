# Phase 6: BeadsAdapter implementation - Research

**Researched:** 2026-05-11
**Domain:** BeadsAdapter contract-compliance reconciliation against existing sibling at `/Volumes/code/gsd-beads` (frozen at `main @ 5082d45`). TypeScript port of ~750 LOC whitelist + authoring of fork-contract-required surface (Bin A + foundational + 3 `recordState*` families) + 3 additive fork-side changes.
**Confidence:** HIGH (architecture, landmines, carry-forward) / MEDIUM (D-MAPPING-SPIKE Outcome A/B branch until spike runs) / LOW (bd v1.0.3 CLI primitives beyond the 9 the sibling empirically invoked)

## Summary

Phase 6 is **not** a greenfield scaffold. The sibling at `/Volumes/code/gsd-beads` (~15 KLOC, 71 conformance tests green, 13 concluded spikes) ships a working-against-bd-v1.0.3 adapter that fails the fork's **three** locked contract shapes: (1) `Capabilities` interface missing 2 required + `graphEdges`, (2) single `recordStateEvent` instead of 3 families, (3) informational `{storage, key|bead|author}` return instead of `StateWriteOutcome` three-state. The phase delivers contract-compliance by **archive-branching** the sibling, **selectively pruning** to a ~750 LOC carry-forward whitelist, **porting every whitelisted `.mjs` → `.ts`** (D-TECH-STACK), **authoring** the fork-required delta (3 `recordState*` families with `StateWriteOutcome`, 9-key Capabilities, `BdManagedMismatchError`, dep-edge synthesizer), and **spiking** bd v1.0.3 primitives in Plan 06-01 to resolve D-MAPPING (sub-records vs labels-first) and D-TXN (three outcomes). Fork-side: `./conformance` subpath export + `graphEdges` field + MarkdownAdapter capability declaration.

The sibling's 13 landmines are scarred into its code — 8 are CRITICAL and MUST be fixed during the port, not inherited. bd v1.0.3 has nine confirmed CLI subcommands the sibling uses; beyond those is the spike's open surface. The spike outcome branches Plan 06-02+'s schema-authoring scope significantly (Outcome A ships 12+ TS schemas; Outcome B scopes down to `phase.ts` + `state.ts`).

**Primary recommendation:** Amend the ROADMAP's 7-plan structure. Plan 06-01 carries the most delta risk — it combines **scaffold reset + TS port of ~750 LOC + dual-question spike + fork-side changes**. Widening to 4-6 plans with a spike-gated split (Wave 1 fork + reset + port; Wave 2 spike + capabilities; Wave 3-5 primitives + events + txn + dep-graph; Wave 6 smoke + README + conformance) keeps plan-level scope reviewable and makes the spike outcome a true gate.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-MAPPING (AMENDED): storage model — spike-first, then fallback**

- **D-MAPPING-SPIKE:** Plan 06-01 spikes bd v1.0.3 for any named-JSON-field primitive beyond `--description`. Concrete spike questions:
  1. Does `bd update <id>` accept arbitrary JSON in a named field (not `--description`)?
  2. Do bd sub-records (if they exist) survive `bd export --json` round-trip byte-identical?
  3. Can L3/L4 anchor-tagged comments be filtered by `--author` or label at query time? (note: sibling's Landmine 4 found `bd comments add` does NOT accept `--label` in v1.0.3; only `--author` is structured)
- **Outcome A (sub-records available):** original D-MAPPING lives — L2 → bd sub-records (native mutability; `updateSection` mode overwrite/append/prepend becomes a JSON array/value op); L3/L4 → anchor-tagged comments with path-concatenation (`gsd:section:### Evidence:#### Sub-point`). Per-canonical-file TS schemas per the D-MAPPING-SCHEMA original vision (12+ schemas).
- **Outcome B (sub-records unavailable, labels-first ships):** Accept sibling's proven architecture. Frontmatter ↔ bd labels (`phase-id:07` ↔ `{phase_id: '07'}`; hyphens-to-underscores); body stored as issue's single `description`, re-parsed via section.mjs on read. Scope per-canonical-file schemas DOWN to only `ROADMAP.md` (port sibling's 251-LOC `phase.mjs` — bidirectional, idempotency contract) and `STATE.md` (needs per-type payload typing for `AppendEvent` / `MutationEvent` / `SignalEvent` discriminated unions). For the other 10 canonical files, use the generic-parser-plus-typed-label-enum approach the sibling proved works (generic `section.ts` + `frontmatter.ts` parsers).
- **Event-family mapping holds in BOTH outcomes:**
  - `recordStateAppend` high-frequency types → `bd comments add --author gsd:event:<type>` (per sibling D-09 amendment; Landmine 4 forces `--author` over `--label`).
  - `recordStateAppend` low-frequency types → `bd remember <json> --key <milestone>:<type>:<id>`.
  - `recordStateMutation` → label add/remove OR memory-key update (OR sub-record array op in Outcome A).
  - `recordStateSignal` → memory or label delete.
- **Spike output requirements:** SPIKE-RESULTS.md §§1–9 populated; §7 names the locked outcome (A or B) with evidence cites; §9 lists the shipped bd CLI commands for the chosen outcome. Spike **INCOMPLETE** if these are missing, blocks Plans 06-02+.

**D-TECH-STACK (NEW): full TypeScript migration**

- Sibling's stack (`.mjs` + `node:test` + `peerDependencies`) migrates to fork's stack (`.ts` + `vitest` + `"get-shit-done": "file:../get-shit-done"` dev-dep with `peerDependencies` preserved).
- Every whitelisted `.mjs` port target becomes `.ts` during the port; new adapter-compliance modules are authored natively in `.ts`.
- TypeScript enforces at compile time: `StorageAdapter` interface conformance, `StateWriteOutcome` three-state return shape, `AppendEvent` / `MutationEvent` / `SignalEvent` discriminated-union payloads (exhaustive dispatch at compile time), `Capabilities` shape including `graphEdges: {semantic, dependency}`.
- Cost: ~1000 LOC port (≈2× original LOC budget). Offset by catching WR-02/WR-03 at compile time.
- Test scripts: `npm test` runs vitest across unit + conformance. No `node --test` paths remain.
- Package name stays `gsd-beads`; `peerDependencies` pattern preserved; during dev `"get-shit-done": "file:../get-shit-done"` added under `devDependencies`.

**D-SCAFFOLD (AMENDED): archive-branch + selective prune + whitelist port**

Plan 06-01 task X mechanics:
1. Archive full history: `git branch v0.2-archive` on sibling main (preserves all shadow + library-alpha history cheaply).
2. Selective prune on main: `git rm -rf` everything EXCEPT the carry-forward whitelist.
3. Port whitelisted `.mjs` → `.ts` in the same commit (per D-TECH-STACK). Amend during port: fix WR-05 atomic-write ms-resolution race (crypto.randomBytes or O_EXCL); fix Landmine 3 adapter-context CWD propagation.
4. Delete outright: `archive/v0.2-shadow/`, `install/memories/`, `install/`, `settings.fragment.json`, `recipe/`, `gsd-sdk-cc.version.lock`, most of `.planning/` (keep only spike 014), sibling's own `.claude/skills/spike-findings-gsd-beads/` (canonical copy lives in fork).
5. Init/update `package.json`: name stays `gsd-beads`; exports shape stays (primary class at `./src/adapter.ts` or `./src/index.ts`); `peerDependencies: { "get-shit-done-cc": "*" }` preserved; `devDependencies: { "get-shit-done": "file:../get-shit-done", "vitest": "^1" }`.
6. Rewrite `README.md` + `CLAUDE.md` + `CONTRIBUTING.md` for v1.0 adapter library shape.

**Carry-forward whitelist** (all paths relative to `/Volumes/code/gsd-beads/`):

| File | LOC | Role | Port amendments during migration |
|------|-----|------|----------------------------------|
| `src/bd/findRoot.mjs` | 67 | bd-managed-dir walker (4 topology cases tested) | Direct `.ts` port; preserve 4-case test table |
| `src/bd/helper.mjs` | 64 | spawnSync wrapper + sentinel errors + JSONL fallback | `.ts` port; **amend:** make `cwd` come from adapter context implicitly (Landmine 3); **fix:** forward `env` into spawnSync (Landmine 4 CRITICAL). Default `BEADS_ACTOR=seed`. |
| `src/bd/errors.mjs` | 73 | `BeadsCause` enum + sentinel subclasses | `.ts` port; **amend:** add `BdManagedMismatchError` with fork's locked shape (code/projectDir/hint/__brand per D-INIT-ERR) |
| `src/helpers/parsePhaseId.mjs` | 17 | label normalization | Direct `.ts` port |
| `src/helpers/deriveDiskStatus.mjs` | 24 | 7-value priority chain | Direct `.ts` port |
| `src/helpers/detectDrift.mjs` | 40 | 3-kind drift detector | `.ts` port (narrower than D-MAPPING-SCHEMA vision but useful pattern) |
| `src/helpers/loadMilestoneHeading.mjs` | 25 | milestone-heading formatter | Direct `.ts` port |
| `src/format/phase.mjs` | 250 | bidirectional ROADMAP.md phase parser + idempotency contract | `.ts` port; preserves idempotency contract (`parse(format(parse(x))) === parse(x)` not byte-equality) |
| `src/format/section.mjs` | 129 | slugify + locateSection + rewriteSection | `.ts` port |
| `src/format/frontmatter.mjs` | 106 | flat-scalar YAML parser | `.ts` port; **conditional escalation:** swap to `js-yaml` IF nested-object frontmatter surfaces in fork's corpus during port |
| `src/adapter/pathRouter.mjs` | 97 | closed-enum path router | `.ts` port as `src/paths.ts`; **amend:** 7 patterns reviewed + extended against fork's canonical-file list (larger than sibling's) |
| `src/adapter/_atomicWrite.mjs` | 29 | tmpfile + POSIX rename | `.ts` port; **fix WR-05** ms-resolution race via `crypto.randomBytes` suffix or `O_EXCL` open flag |
| `tests/fixtures/build-seed.sh` | — | JSONL seed regeneration | Kept as-is; enforces `BEADS_ACTOR=seed` discipline |
| `.planning/spikes/014-bd-blocks-sibling-deps/SPIKE.md` | — | Dep-edges primitive proof | Copied into `.planning/research/spike-014-bd-blocks.md` (D-OQ06 evidence) |

**Total whitelist LOC:** ≈ 1008 LOC (sibling `.mjs`) [VERIFIED: `wc -l src/bd/*.mjs src/helpers/*.mjs src/format/*.mjs src/adapter/pathRouter.mjs src/adapter/_atomicWrite.mjs`]. After TS port with type annotations + interface-import headers this likely lands at 1200–1400 LOC of `.ts`.

**D-TXN-SPIKE (AMENDED): three outcomes evaluated**

Plan 06-01 spike evaluates THREE outcomes:
- **Outcome A:** in-memory write-buffer. ~150 LOC. Mid-txn failure after 2-of-3 buffered writes leaves bd partially committed on the Nth issue. `capabilities.snapshot: false`.
- **Outcome B:** staging bd store + bead-hash bookmark cutover. Architecturally 1:1 with MarkdownAdapter's shadow-dir journal. Closes SYNTHESIS §9 HIGH-severity dry-run gate by construction — IF bd v1.0.3 exposes the primitives. `capabilities.snapshot: true`.
- **Outcome C (sibling-proven):** file-snapshot restore. `bd export --json -o <path>` at txn entry; on rollback `bd init --from-jsonl --prefix <derived> --non-interactive --skip-agents --skip-hooks --quiet` into fresh tmpdir; swap via fs-level `.beads/` directory rename (POSIX atomic). Slow (400-700ms per rollback) but proven reliable. Prefix derivation from snapshot metadata (fix Landmine 12 WR-04). `capabilities.snapshot: true`.

All three outcomes: `capabilities.transaction: true` (pipeline.ts dry-run depends on it unconditionally). Documentation names shipped outcome neutrally — no "fallback" framing. Plan 06-03 has three implementation paths; selected post-spike.

**D-OQ06 (RE-AFFIRMED): layered graph edges + fine-grained capability**

- `graphs/graph.json` edge schema extends to include `type: 'semantic' | 'dependency'` (additive).
- Semantic edges (unchanged): `graphify.cjs` produces from `.planning/` markdown. ABSENT on BeadsAdapter (deferred post-v1.0).
- Dependency edges (new, BeadsAdapter-native): `src/dep-graph.ts` synthesizer emits `{type: 'dependency', confidence: 1.0}` from bd's `blocks`/`blocked-by` edges.
- **D-OQ06-CAPS:** `Capabilities` gains `graphEdges: { semantic: boolean; dependency: boolean }`. MarkdownAdapter: `{semantic: true, dependency: false}`. BeadsAdapter: `{semantic: false, dependency: true}`.
- **Only Phase-6 change to locked contract surface — additive.**

**D-BINARY (RE-AFFIRMED): skip-and-warn**

- `capabilities.binaryAsset: false`. `writeBinaryAsset` throws `UnsupportedCapabilityError` (use fork's class from `adapters/types.ts:123`, NOT sibling's `UnsupportedOperationError`). Port sibling's 4-test capability-lint pattern.

**D-INIT-ERR (RE-AFFIRMED): typed error class + port sibling's probe**

- `BdManagedMismatchError extends Error` with `code: 'PROJECT_BD_MANAGED_MISMATCH'`, `projectDir`, `hint`, `__brand` (mirrors `UnsupportedCapabilityError` precedent).
- `BeadsAdapter.init()` (or lazy `_ensureBd()` per sibling D-18) throws when target dir is not bd-managed.
- Probe mechanism: port sibling's `findBeadsRoot()` walk (`src/bd/findRoot.mjs`, 67 LOC, proven against 4 topology cases). Direct `.ts` port.

**D-CONFORM-EXPORT (RE-AFFIRMED): fork `./conformance` subpath**

- Fork's `package.json` gains `"./conformance"` entry in `exports` field pointing at compiled JS of `tests/conformance/adapter.conformance.ts`.
- `runAdapterConformanceSuite(adapterName, adapterFactory)` signature LOCKED (Phase 1 D-15).
- Sibling's own `tests/conformance/` DELETED in selective-prune (D-SCAFFOLD).

**D-RUNTIME-RESOLUTION (RE-AFFIRMED): dual export shape**

- BeadsAdapter exports BOTH `export class BeadsAdapter { ... }` AND `export default BeadsAdapter`.

### Claude's Discretion

- Spike sequencing within Plan 06-01 — standalone doc vs test file vs script; mapping-spike + txn-spike order.
- Exact bd primitives invoked — CLI shell-out everywhere is default; revisit only if spike surfaces alternatives.
- Plan count and wave structure — amendment proposes 4 plans × 4 waves; Planner may widen to 5-7 if D-MAPPING Outcome A ships (schema-authoring scope inflates).
- Format module internal organization — single file per canonical schema, or one big `format.ts`.
- BeadsAdapter.init() exact probe invocation — `ls .bd/` / `bd status` / port findRoot.ts's walk (recommended).
- Error-class export path — `src/errors.ts` vs inline in `src/index.ts`.
- Dep-edge synthesizer strategy — lazy on `getRecord('graphs/graph.json')` vs eager cache on writes.
- Sibling-repo branch strategy — long-lived `main` vs per-plan feature branches.
- BeadsAdapter package export path — `./src/adapter.ts` vs `./src/index.ts`.
- WARN-level landmine triage — which of WR-01/WR-09 inherit vs fix.

### Deferred Ideas (OUT OF SCOPE)

- bd-sourced semantic edges (graphify against bd as a data source) — post-v1.0 or Phase 8.
- Phase-8 adapter-name runtime resolver (DIST-01) — full impl is Phase 8.
- markdown→bd migration tool (DIST-02) — Phase 8.
- Type-aware graph-edge filtering in consumers (`gsd-phase-researcher`, `graphify.md`) — may land Phase 6 or slip to Phase 8.
- Phase 6.1 follow-up: bd multi-record commit atomicity — only if D-TXN-SPIKE forces Outcome A AND Phase 7 CONFORM-04 judges the gap unacceptable.
- Blob-store routing for binaryAsset on BeadsAdapter — when a consumer workflow actually needs UI-review screenshots on bd backend.
- BeadsAdapter-specific sidecar path-sniff map documentation — planner-level detail; in README.
- Publishing `gsd-beads` to npm (NPM-01) — deferred; v1.0 keeps at `/Volumes/code/gsd-beads`.
- `gsd update` convenience for adapters — polish for Phase 8 or post-v1.0.
- Reconsidering two-repo model — post-v1.0 consideration if ceremony is painful.
- "Sub-records unavailable in bd v1.0.3" upstream feature request (if Outcome B lands) — carry-forward learning for bd v2.
- WR-01 (`_resolveMilestoneBead` docs-lie) + WR-09 (`filter(Boolean)` heading-stack collapse) — fix-or-defer is planner's call.
- Systemic `planner-subagent-prompt.md` + leak-grep scope retrofit — Phase 7 or standalone cleanup.

## Phase Requirements

| ID | Description (from REQUIREMENTS.md §BEADS) | Research Support |
|----|-------------|------------------|
| BEADS-01 | `BeadsAdapter` implements all 10 Bin A primitives against `bd` CLI (carries forward 13 spike findings, format module, JSONL roundtrip seed pattern from `gsd-beads` v0.2 work) | D-MAPPING-SPIKE outcome gates mapping; sibling's 10 Bin A primitives [CITED: `src/adapter/primitives.mjs` lines 64–350] are the port target, restructured for fork's (11-method — adds `stat`, `removeCollection`, `replaceInCurrentMilestone`, `readModifyWriteRoadmapMd`) Bin A surface. Note fork's contract has `stat` and `removeCollection` that sibling does NOT implement [VERIFIED: `adapters/types.ts:82-87`]. |
| BEADS-02 | `BeadsAdapter` implements ~58 Bin B methods with bd-native mappings (`addPhase` → bd issue with `gsd:phase` label; `recordStateEvent` → typed comment or label; `updateSection` → per-section sub-records or comment-with-anchor) | Fork's contract actually has only 3 `recordState*` families + foundational primitives as adapter surface (domain methods stay thin per Phase 3 D-04). The "~58 Bin B methods" from SYNTHESIS §4 are **in fork SDK helpers**, not on the adapter. BeadsAdapter surface is: 11 Bin A + 2 markdownLockfile + 6 foundational + 3 recordState* = **22 methods** [VERIFIED: `adapters/types.ts:67-121`]. Each `recordState*` dispatches on the discriminated-union `type` field per D-MAPPING event-family mapping. 16-case `StateWriteOutcome` matrix from `tests/conformance/write-outcome.test.ts`. |
| BEADS-03 | Knowledge-graph subsystem scope decided (resolves OQ-06) | Resolved by D-OQ06: layered edges with `graphEdges: {semantic, dependency}` capability. BeadsAdapter ships `{semantic: false, dependency: true}`. Dep-edge synthesizer at `src/dep-graph.ts` produces `{type: 'dependency', confidence: 1.0}` edges from bd's `blocks` edges [CITED: Spike 014 in `gsd-beads/.planning/spikes/014-bd-blocks-sibling-deps/`]. Field name in `bd export --json` is `type` NOT `dependency_type` (that's `bd show` shape). |
| BEADS-04 | `BeadsAdapter.init()` validates the store is bd-managed before any read/write | Resolved by D-INIT-ERR: typed `BdManagedMismatchError` with `code`/`projectDir`/`hint`/`__brand`. Probe via sibling's `findBeadsRoot()` walk (67 LOC; 4 topology cases: worktree / `BEADS_DIR` env / symlink / non-bd) ported directly to TS. Lazy `_ensureBd()` per sibling D-18 — capability flag statically readable without bd. |
| BEADS-05 | `BeadsAdapter` declares `writeBinaryAsset` capability as unsupported; UI-review and sketch workflows degrade gracefully | Resolved by D-BINARY: `capabilities.binaryAsset: false`; `writeBinaryAsset` throws `UnsupportedCapabilityError` (fork's class, NOT sibling's `UnsupportedOperationError`). Consumer workflows guard with `hasBinaryAsset(adapter)` per Phase 5 D-18. Port sibling's 4-test capability-lint pattern. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| bd CLI invocation (spawnSync wrapper) | Node library (sibling repo) | — | BeadsAdapter shells out to system `bd` binary; no node bindings exist [VERIFIED: sibling `bd-primitives.md`]. |
| Path routing (bd-routed vs disk-routed vs named-doc) | Node library (sibling `src/paths.ts`) | — | Closed-enum router; fork's contract is filesystem-path-addressed so router is per-adapter-internal. |
| Section / frontmatter / record primitives | Node library (sibling) | — | Fork Bin A contract [VERIFIED: `adapters/types.ts:67-96`]; adapter maps to bd or disk per path router. |
| `StorageAdapter` contract types + conformance harness | Fork library (this repo) | — | Fork owns `adapters/types.ts`, `adapters/state-event-types.ts`, and `tests/conformance/` [VERIFIED]. |
| `Capabilities` interface (including new `graphEdges`) | Fork library (this repo) | — | Only phase-6 fork-side delta: `graphEdges: {semantic, dependency}` additive field on `Capabilities`. |
| Conformance test invocation | Sibling (imports fork's subpath) | — | `get-shit-done/conformance` subpath (D-CONFORM-EXPORT); sibling authors `tests/conformance.test.ts` that invokes `runAdapterConformanceSuite('beads', factory)`. |
| Dep-edge synthesis from bd `blocks` → `graph.json` | Sibling (`src/dep-graph.ts`) | Fork consumer (future) | BeadsAdapter overrides `getRecord('graphs/graph.json')` to merge synthesized edges with any existing file; fork's `graphify.md` consumer is Phase 8+. |
| Transaction primitive (`withTransaction`) | Sibling (outcome A/B/C per spike) | — | Architectural invariant: matches MarkdownAdapter shadow-dir journal semantics via different mechanism (Phase 5 D-11). |
| Test framework (vitest) | Sibling adopts | Fork provides | Fork's test stack is vitest [VERIFIED: `package.json:71` `test:conformance` uses vitest]; D-TECH-STACK migrates sibling off `node:test`. |
| TypeScript compilation | Sibling authors | Fork provides types | Sibling's `tsconfig.json` extends/consumes fork's type contract; compile-time enforcement is the migration's raison d'être. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 6.0.3 [VERIFIED: `npm view typescript version`] | Compile-time enforcement of `StorageAdapter` + `StateWriteOutcome` + event discriminated unions | D-TECH-STACK requirement; catches WR-02/WR-03 YAML-escape bugs at edit-time [CITED: spike-findings-gsd-beads/landmines.md:437-467] |
| vitest | 4.1.6 [VERIFIED: `npm view vitest version`] | Unit + conformance test runner | Fork already uses vitest [VERIFIED: `/Volumes/code/get-shit-done/package.json:71,79`]; D-TECH-STACK consistency |
| Node ≥22 | — | Runtime | Fork's `engines.node` declares ≥22 [VERIFIED: `/Volumes/code/get-shit-done/package.json:47-49`]; vitest 4.x requires modern Node |
| bd CLI | v1.0.3 (1b2dd2cb) [CITED: sibling 07-RESEARCH.md lines 178-184] | External storage backend | Frozen pinned version in sibling; fork Phase 6 targets same. User must install before spike. **NOT currently installed on researcher machine** [VERIFIED: `which bd` returns "bd not found"] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| js-yaml | 4.1.1 [VERIFIED: `npm view js-yaml version`] | Frontmatter escape-safe YAML serialize/parse | **Conditional escalation:** swap in during `src/format/frontmatter.ts` port IF nested-object frontmatter surfaces (WR-02/WR-03 fix per Landmines 16-17). Sibling hand-rolled 106-LOC flat-scalar parser; fork may have nested-object frontmatter (e.g., plan `must_haves.truths`) |
| @types/js-yaml | 4.0.9 [VERIFIED] | TS typings for js-yaml | Pairs with js-yaml if escalation lands |
| `node:child_process.spawnSync` | builtin | bd CLI invocation | Sibling pattern: `spawnSync('bd', args, {cwd, env, encoding: 'utf-8'})` [CITED: `src/bd/helper.mjs:22`]; NOT `execSync` (Pitfall 2 sentinel-error discipline) |
| `node:crypto.randomBytes` | builtin | Atomic-write tmpfile race fix (WR-05) | Replace sibling's `${pid}.${Date.now()}` with `${pid}.${randomBytes(6).toString('hex')}` during port [CITED: Landmine 15] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled flat-scalar frontmatter parser (sibling approach) | `js-yaml` or `gray-matter` | Sibling rejected: "hand-rolled 40-line parser sufficient for fixed PLAN.md corpus" [CITED: sibling Phase 7 RESEARCH]. Fork may need escalation if corpus has nested objects — escalate DURING port, don't wait for WR-02 to re-manifest |
| `node:test` | `vitest` | Sibling chose `node:test` for zero-dep; fork's vitest is already the stack. D-TECH-STACK locks vitest |
| Single-file mixin via `Object.assign(prototype, ...methodBags)` (sibling D-17) | Regular class with methods | Sibling used mixin to split 75-method surface across 8 cluster files. Fork Phase 6's surface is only 22 methods — regular class is simpler. Claude's discretion |
| File-based `snapshot/restore` (sibling D-11; Outcome C) | Staging-store + bead-hash bookmark (Outcome B) | Outcome B is architecturally 1:1 with MarkdownAdapter shadow-dir journal AND closes §9 dry-run gate by construction, IF bd exposes primitives. Outcome C is proven reliable (400-700ms/rollback). D-TXN-SPIKE picks based on evidence |
| `bd` CLI shell-out | Node bindings to bd | Node bindings do not exist in bd v1.0.3 [VERIFIED: sibling 07-RESEARCH + `bd-primitives.md`]. Shell-out is only option |
| `bd comments add --label` | `bd comments add --author` | `--label` is silently rejected by bd v1.0.3 on comments [CITED: Landmine 4; sibling D-09 amendment]. `--author` is the only structured filterable slot |

**Installation (sibling-side during Plan 06-01 scaffold):**

```bash
# In /Volumes/code/gsd-beads after archive-branch + selective prune:
npm init -y  # (or preserve existing package.json per carry-forward whitelist)
npm install --save-dev typescript@^6 vitest@^4 @types/node
npm install --save-dev "file:../get-shit-done"
# Conditional:
npm install --save-dev js-yaml @types/js-yaml  # if frontmatter escalation lands
```

**Version verification:** All versions above verified against npm registry on 2026-05-11. Do not inject version numbers into package.json until Plan 06-01 confirms compatibility against fork's TS + vitest versions (fork currently declares `engines.node >=22.0.0`).

## Runtime State Inventory

Phase 6 involves a **rename-adjacent scenario** (sibling reset + TS port of `.mjs` files) but the destination machine state is primarily the sibling git repo, bd's `.beads/` store (under test dirs only), and local `/Volumes/code/gsd-beads/node_modules/`. There is NO production user data affected.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None in production. Test seed `tests/fixtures/seed.jsonl` is byte-identity fixture regenerated by `build-seed.sh` [CITED: sibling `.gsd-beads/tests/fixtures/build-seed.sh`]. Sibling's `.beads/` at repo root is **sibling's own workspace bd store** containing v0.1/v0.2 phases — must NOT be touched during port (Landmine 3 concerns show why: adapter-context CWD bleed-through caused tests to read from this store). | Code edit only: port path-routing + adapter-context CWD binding correctly. Seed JSONL regenerates; no migration. |
| Live service config | None. bd v1.0.3 has no external service state; it's a CLI over a local SQLite (dolt) + JSONL. No Datadog / Cloudflare / etc. | None. |
| OS-registered state | None. No Task Scheduler / systemd / launchd / pm2 registrations. | None. |
| Secrets/env vars | `BEADS_ACTOR=seed` (env var discipline; not a secret, but a determinism requirement). `BEADS_DIR` (optional env override for cross-worktree bd root discovery — port via `findBeadsRoot()`). No SOPS keys, no secret files. | Code edit: bake `BEADS_ACTOR=seed` into adapter-bound wrapper default [CITED: Landmine 11]. Landmine 4 also surfaces: sibling's `bd()` helper accepts `env` option but does NOT forward to `spawnSync` (deferred-items.md item 2, still open). **Fix during port.** |
| Build artifacts | Sibling currently has: `src/**/*.mjs` compiled by nothing (Node ESM directly). After port: `src/**/*.ts` → `src/**/*.js` via `tsc` (emit path TBD by Plan 06-01). Sibling has NO `dist/` directory currently. Fork's `adapters/dist/` exists [VERIFIED: `ls /Volumes/code/get-shit-done/adapters/` shows `dist/`] — the `./conformance` subpath export must resolve to compiled JS. | Code edit during port: configure `tsconfig.json` emit; update `package.json` `main` / `exports` / `types` fields. Delete sibling's old `.mjs` files (not needed since `v0.2-archive` branch preserves). |

**Carry-forward repo state that MUST be preserved:**

- `git log --follow` on ported files — use `git mv` discipline [CITED: decisions-carry-forward.md — sibling Plan 06-04 D-11 preserves history via verbatim extraction]. In the port, `git mv src/bd/findRoot.mjs src/bd/findRoot.ts` preserves `--follow`; then edit in place.
- `.planning/spikes/014-bd-blocks-sibling-deps/SPIKE.md` — copied into fork's `.planning/research/` before sibling reset [CITED: D-SCAFFOLD whitelist step 4].
- 11 fixture files at `tests/unit/fixtures/phase-format/` — round-trip identity corpus for `phase.ts` [CITED: decisions-carry-forward.md Plan 06-05 D-17].

**Explicit "nothing found" confirmations:**
- No bd sub-records: sibling empirically found none in 71 tests of use [CITED: SKILL.md §11 D-MAPPING amendment]. Spike re-confirms.
- No store-clone or bead-hash-bookmark primitive invocation anywhere in sibling shipped code [CITED: `bd-primitives.md` §"Store-clone + bead-hash bookmark primitives"].
- No `npm`-published `gsd-beads` package exists — local file-link only (sibling stayed at `1.0.0-alpha.0`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node` ≥22 | vitest 4.x, fork compatibility | Presumed (fork's `engines.node: ">=22.0.0"`) | unverified in this session | — |
| `git` ≥2.x | Archive-branch, selective-prune, seed fixtures | Presumed (fork is a git repo) | unverified in this session | — |
| `bd` v1.0.3 | All spike + plan work after Plan 06-01 reset task | ✗ [VERIFIED: `which bd` returned "bd not found"] | — | **NO FALLBACK.** bd MUST be installed before Plan 06-01 spike executes. Planning can proceed without bd; execution cannot. User confirmed will install. |
| sibling repo at `/Volumes/code/gsd-beads` | All sibling-side work | ✓ [VERIFIED: directory exists; `git log -1` returned `5082d45f... docs(07): add phase verification report`] | `main @ 5082d45f13f...` | — |
| sibling working tree clean | Reset must be non-destructive | ✓ [VERIFIED: `git status --short` returned empty] | — | — |
| `js-yaml` | Conditional frontmatter escalation | Not installed in sibling | — | Hand-rolled parser (sibling pattern) works for flat-scalar |

**Missing dependencies with no fallback:**
- `bd` v1.0.3 — install command: follow bd project install instructions (user to confirm installation source; package manager varies by OS). **PLAN 06-01 EXECUTION BLOCKED until bd is on PATH.** Plan 06-01 spike task MUST include a precondition check (`command -v bd && bd --version | grep -F '1.0.3'`).

**Missing dependencies with fallback:**
- `js-yaml` — fallback is to keep sibling's hand-rolled 106-LOC flat-scalar parser; only escalate if fork's frontmatter corpus contains nested objects during port.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Consumer: fork's SDK (gsd-sdk query ...) OR workflow/agent           │
│    ↓                                                                 │
│ createRegistry({ adapter: BeadsAdapter })                            │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ BeadsAdapter (sibling gsd-beads package)                             │
│ ┌──────────────────────────────────────────────────────────────┐    │
│ │ Public surface (22 methods total, per fork contract):          │    │
│ │ • Bin A: getRecord, putRecord, removeRecord, removeCollection, │    │
│ │   listCollection, exists, stat, getSection, updateSection,     │    │
│ │   getFrontmatter, updateFrontmatter, mergeFrontmatter          │    │
│ │ • markdownLockfile: replaceInCurrentMilestone,                 │    │
│ │   readModifyWriteRoadmapMd (throw; capability=false)           │    │
│ │ • Foundational: writeBinaryAsset (throw; cap=false),           │    │
│ │   snapshot, restore, withTransaction, putNamedDoc, getNamedDoc,│    │
│ │   commitPlanningState                                          │    │
│ │ • Event families: recordStateAppend/Mutation/Signal            │    │
│ │   → StateWriteOutcome                                           │    │
│ └──────────────────────────────────────────────────────────────┘    │
│                                 │                                    │
│     ┌───────────────────────────┼───────────────────────────┐       │
│     ▼                           ▼                           ▼       │
│ ┌──────────┐            ┌──────────────┐           ┌──────────────┐ │
│ │ paths.ts │            │ format/*.ts  │           │ dep-graph.ts │ │
│ │ (router) │            │ (parser)     │           │ (synthesizer)│ │
│ └──────────┘            └──────────────┘           └──────────────┘ │
│     │ kind/tier                  │ slug/anchor            │ edges   │
│     ▼                            ▼                        ▼         │
│ ┌──────────────────────────────────────────────────────────────┐    │
│ │ bd helper (spawnSync wrapper, adapter-context bound)          │    │
│ │  • `bd list -l <label> --json --all -n 0`                     │    │
│ │  • `bd update <id> --description <body>`                      │    │
│ │  • `bd label add/remove`                                      │    │
│ │  • `bd remember <json> --key <k>`                             │    │
│ │  • `bd comments add --author gsd:event:<type>`                │    │
│ │  • `bd export --json -o <path>` (JSONL!)                      │    │
│ │  • `bd init --from-jsonl --prefix <px> ...`                   │    │
│ │  • `bd dep add` (blocks edges for dep-graph)                  │    │
│ └──────────────────────────────────────────────────────────────┘    │
│                                 │                                    │
│     ┌───────────────────────────┼───────────────────────────┐       │
│     ▼                           ▼                           ▼       │
│ BeadsEmpty          BeadsCorrupt              BdManagedMismatchError│
│ (empty coll)        (bd missing/db err)       (init() probe failure)│
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ system `bd` CLI │ (v1.0.3 pinned)
                        │  ↓              │
                        │ .beads/         │ (SQLite + JSONL)
                        │ + disk files    │ (hybrid tier → .planning/)
                        └─────────────────┘

                         ┌──────────────────────┐
                         │ withTransaction      │
                         │ (Outcome A/B/C per   │
                         │  Plan 06-01 spike)   │
                         └──────────────────────┘
```

### Component Responsibilities

| Component | File (TS port target) | Responsibility | Input | Output |
|-----------|----------------------|----------------|-------|--------|
| `BeadsAdapter` class | `src/adapter.ts` or `src/index.ts` | Public contract implementation; dispatches to bd-helper + format + paths | Bin A + foundational method calls | Bin A return types + StateWriteOutcome |
| Path router | `src/paths.ts` (ported from `pathRouter.mjs`) | Classify `.planning/` path → `{kind, tier, label, singleton?, collection?}` | Filesystem path string | Closed-enum routing record |
| bd helper | `src/bd/helper.ts` (ported from `helper.mjs`) | spawnSync wrapper; adapter-context-bound; JSONL fallback; sentinel mapping | CLI args + env | Parsed JSON / JSONL / string; throws typed errors |
| findRoot | `src/bd/findRoot.ts` (ported from `findRoot.mjs`) | Probe: BEADS_DIR env → parent walk → `.beads/metadata.json` → return or null | Directory path | `string | null` (`.beads/` root or null) |
| Errors | `src/bd/errors.ts` (ported from `errors.mjs`) | Typed sentinels + `BdManagedMismatchError` (new, per D-INIT-ERR) | Error data | Thrown exceptions |
| Format/phase | `src/format/phase.ts` (ported from `phase.mjs`) | Bidirectional ROADMAP.md phase parser; idempotency-not-byte-equality contract | Markdown phase entry text | `{goal, depends_on, requirements, success_criteria[], tail}` |
| Format/section | `src/format/section.ts` (ported from `section.mjs`) | `slugify()`, `locateSection(text, anchor)`, `rewriteSection(text, anchor, body, mode)`; code-fence guard | Markdown text + slug-path anchor | Section bounds / rewritten text |
| Format/frontmatter | `src/format/frontmatter.ts` (ported from `frontmatter.mjs`) | Flat-scalar YAML parser; conditional js-yaml escalation | YAML frontmatter text | Object |
| Atomic write | `src/adapter/_atomicWrite.ts` (ported from `_atomicWrite.mjs`) | tmpfile + POSIX rename; **WR-05 race fix** via `crypto.randomBytes` | Path + body | Write effect on disk |
| Dep-graph synthesizer | `src/dep-graph.ts` (new) | Produce `{type: 'dependency', confidence: 1.0}` edges from bd `blocks` | bd export JSONL | `graph.json` edges slice |
| withTransaction impl | `src/txn/<A|B|C>.ts` (new, per spike outcome) | Staging-store / in-memory buffer / file-snapshot semantics | `fn: () => Promise<T>` | `T` or rollback |

### Pattern 1: Lazy `_ensureBd()` validation on first bd-using method call

**What:** Capabilities flag is statically readable (no bd probe at construction). Any method that uses bd calls `_ensureBd()` lazily on first use; `_ensureBd()` invokes `findBeadsRoot()` and throws `BdManagedMismatchError` if null.

**When to use:** Every method in `BeadsAdapter` that spawns `bd` — start of method body.

**Example:**

```ts
// Source: sibling src/adapter.mjs:40-44 + decisions-carry-forward.md D-18/D-02
class BeadsAdapter implements StorageAdapter {
  readonly name = 'beads';
  readonly capabilities: Capabilities = Object.freeze({
    record: true, section: true, frontmatter: true,
    binaryAsset: false, snapshot: /* per spike */, transaction: true,
    namedDoc: true, markdownLockfile: false,
    graphEdges: { semantic: false, dependency: true },
  });

  private _beadsRoot: string | null = null;
  private _bd: BdRunner | null = null;

  constructor(public readonly projectRoot: string) {
    // D-03 sync constructor only; no bd probe here
  }

  private async _ensureBd(): Promise<BdRunner> {
    if (this._bd) return this._bd;
    const root = findBeadsRoot(this.projectRoot);
    if (!root) {
      throw new BdManagedMismatchError(this.projectRoot,
        'Expected .beads/metadata.json at or above projectRoot. Run `bd init` or set BEADS_DIR.');
    }
    this._beadsRoot = root;
    this._bd = new BdRunner(root); // wrapper that bakes cwd + BEADS_ACTOR=seed
    return this._bd;
  }

  async getRecord(path: string): Promise<string | null> {
    const route = routerResolve(path);
    if (route.tier === 'bd') {
      const bd = await this._ensureBd();
      // ...
    }
    // disk-routed fallthrough
  }
}
```

### Pattern 2: Adapter-context-bound bd wrapper (Landmine 3 + 4 fix)

**What:** Wrap `spawnSync` so `cwd` and `env.BEADS_ACTOR` are baked in at construction time. Eliminates the per-call-site discipline burden that made Landmine 3 (cwd leak) and Landmine 4 (env not forwarded) possible.

**When to use:** All bd invocations from BeadsAdapter go through this wrapper. Conformance tests use `spawnSync` directly (per sibling D-12) for read-backs — that's fine; test code owns its own env discipline.

**Example:**

```ts
// Source: landmines.md §CRITICAL 3 + 4 + decisions-carry-forward.md D-20
export class BdRunner {
  constructor(
    private readonly cwd: string,
    private readonly baseEnv: NodeJS.ProcessEnv = { ...process.env, BEADS_ACTOR: 'seed' },
  ) {}

  run(args: string[], opts?: { parseJson?: boolean; env?: Record<string, string> }): unknown {
    const env = { ...this.baseEnv, ...opts?.env };
    const result = spawnSync('bd', args, { cwd: this.cwd, env, encoding: 'utf-8' });
    // ... (JSONL fallback + sentinel mapping per Landmines 6/7/8)
    return parsed;
  }

  show(id: string): Record<string, unknown> {
    const result = this.run(['show', id, '--json']) as unknown;
    // Landmine 5: bd v1.0.3 returns single-element array
    return Array.isArray(result) ? result[0] : (result as Record<string, unknown>);
  }
}
```

### Pattern 3: `StateWriteOutcome` three-state dispatch in `recordState*`

**What:** Every `recordState*` call returns `StateWriteOutcome` per the three-state contract (ADR D-2026-05-10-08). No silent `applied: true` no-ops.

**When to use:** All three event family methods. The discriminated-union `type` field on `AppendEvent` / `MutationEvent` / `SignalEvent` drives dispatch.

**Example:**

```ts
// Source: adapters/types.ts:50-52 (StateWriteOutcome) + tests/conformance/write-outcome.test.ts (16 cases)
// + adapters/state-event-types.ts (AppendEvent/MutationEvent/SignalEvent)

async recordStateAppend(event: AppendEvent): Promise<StateWriteOutcome> {
  const bd = await this._ensureBd();
  switch (event.type) {
    case 'session':
    case 'quick_task':
    case 'forensic_session': {
      // High-frequency → comment (Landmine 4: --author, NOT --label)
      const milestoneBead = await this._resolveMilestoneBead();
      const existing = bd.run(['comments', milestoneBead, '--json']) as Array<{ author: string; text: string }>;
      const dupeCheck = existing.find(c =>
        c.author === `gsd:event:${event.type}` &&
        JSON.parse(c.text)?.sessionId === (event.payload as any).sessionId
      );
      if (dupeCheck) return { applied: false, reason: 'duplicate' };
      bd.run(['comments', 'add', milestoneBead, '--author', `gsd:event:${event.type}`,
             JSON.stringify(event.payload)]);
      return { applied: true };
    }
    case 'decision':
    case 'metric':
    case 'roadmap_evolution': {
      // Low-frequency → memory (bd remember)
      const key = `${this.currentMilestone}:${event.type}:${deriveId(event.payload)}`;
      const existing = bd.run(['recall', key], { parseJson: false });
      if (existing !== null) return { applied: false, reason: 'duplicate' };
      bd.run(['remember', JSON.stringify(event.payload), '--key', key], { parseJson: false });
      return { applied: true };
    }
    // TS exhaustive: `never` branch catches unhandled types at compile time
    default: {
      const _: never = event;
      throw new Error(`unhandled AppendEvent: ${(event as any).type}`);
    }
  }
}
```

Note: The 16-case matrix in `write-outcome.test.ts` requires BeadsAdapter to also handle `created_section` (only possible in Outcome A sub-records per D-MAPPING) — in Outcome B (labels-first), `created_section` is never emitted because there are no discrete sub-records to scaffold. Planner must write BeadsAdapter's tests to match the shipping outcome.

### Pattern 4: Dep-edge synthesizer with `getRecord('graphs/graph.json')` interception

**What:** BeadsAdapter's `getRecord('graphs/graph.json')` is special-cased to merge bd-synthesized dependency edges with whatever (if any) existing file content. Edges are `{type: 'dependency', confidence: 1.0}` per D-OQ06.

**When to use:** Only this path. All other paths fall through to standard get/put/dispatch.

**Example:**

```ts
// Source: decisions-carry-forward.md D-23 + spike-014 evidence + CONTEXT.md D-OQ06

async getRecord(path: string): Promise<string | null> {
  if (path === 'graphs/graph.json') {
    return this._materializeGraphJson();
  }
  // ... standard dispatch
}

private async _materializeGraphJson(): Promise<string> {
  const bd = await this._ensureBd();
  // Single `bd export --json` surfaces all edges (fits ≤2-spawn budget per sibling D-21 + QUAL-07)
  const beads = bd.run(['export', '--json']) as Array<{
    _type: string;
    id: string;
    dependencies?: Array<{ depends_on_id: string; type: string }>;
  }>;
  const issues = beads.filter(b => b._type === 'issue');
  const depEdges = issues.flatMap(issue =>
    (issue.dependencies ?? [])
      .filter(d => d.type === 'blocks') // NOT dependency_type — spike-014 finding
      .map(d => ({
        from: d.depends_on_id,           // blocker direction per sibling DP-02
        to: issue.id,
        type: 'dependency' as const,
        confidence: 1.0,
      }))
  );
  // If an on-disk graph.json exists (unlikely on BeadsAdapter but possible),
  // merge preserving semantic edges from other sources
  const existing = await this._diskGetRecord('graphs/graph.json');
  const existingGraph = existing ? JSON.parse(existing) : { edges: [] };
  const semanticEdges = (existingGraph.edges ?? []).filter((e: { type: string }) => e.type === 'semantic');
  return JSON.stringify({ ...existingGraph, edges: [...semanticEdges, ...depEdges] });
}
```

**Claude's discretion on lazy-vs-eager:** Lazy (materialize on every `getRecord` call) is simplest — bd export is ~0.32s per spike-014 perf data. Eager (cache on writes to bd's blocks-edges) needs cache invalidation logic. Recommend **lazy-with-memoization-within-txn** — cache the `_type === 'issue'` export result during an active `withTransaction` only, so a workflow that reads graph.json multiple times during one txn pays one spawn.

### Anti-Patterns to Avoid

- **Treating bd CLI as trusted:** bd v1.0.3 has 4 confirmed behavioral quirks (Landmines 5, 6, 7, 8) where exit code 0 + JSON-looking output hides failure. **Never** skip the JSONL fallback, the array-unwrap on `bd show`, or the empty-shape detection.
- **Omitting `BEADS_ACTOR=seed` on ANY bd call that affects determinism:** single missed call breaks CONF-03 byte-identity [CITED: Landmine 11]. Pattern: bake into adapter-bound wrapper default.
- **Inheriting sibling's `UnsupportedOperationError`:** fork has its own `UnsupportedCapabilityError` with `__brand` for cross-module `instanceof`. Port the message format convention, not the class.
- **Path-traversal via `pathResolve(projectRoot, path)` without guard:** CR-01 BLOCKER. Every Bin A primitive needs the `startsWith(projectRoot + sep)` guard. Add negative conformance tests.
- **Letting hybrid-tier paths fall through to disk in `putRecord`:** CR-02 BLOCKER. Fork's path router must explicitly handle every tier; no default fallthrough.
- **Hardcoding `--prefix 'sd'`:** WR-04. Derive from snapshot metadata or first issue's id format during port.
- **Using `bd comments add --label`:** silently rejected. Always `--author gsd:event:<type>` [CITED: Landmine 4].
- **Trusting `bd list` without `--all` + `-n 0`:** closed records are hidden by default; 50-row limit is default. Always specify both [CITED: bd-primitives.md §1].
- **Touching `StorageAdapter` contract surface** beyond the additive `graphEdges` field. If Phase 6 discovers a contract gap, surface as ADR proposal; do not mutate `adapters/types.ts` silently (per CONTEXT.md "What Phase 6 does NOT do").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| bd CLI invocation | Custom child_process wrapper | Port sibling's `src/bd/helper.mjs` verbatim (with Landmine 3/4 fixes) | 64 LOC of battle-tested sentinel dispatch + JSONL fallback + empty-shape detection. Re-authoring repeats Landmines 6/7/8. |
| bd-managed-dir detection | fs.readdirSync loop | Port sibling's `src/bd/findRoot.mjs` (67 LOC, 4 topology cases tested) | Worktree resolution + `.git`-as-file + symlink follow + BEADS_DIR precedence are all corners. [CITED: spike-003 VALIDATED] |
| Bidirectional ROADMAP.md phase parser | Hand-rolled regex | Port sibling's `src/format/phase.mjs` (250 LOC, 11 fixture tests) | Idempotency contract (`parse(format(parse(x))) === parse(x)`) is non-obvious; 11 round-trip fixtures already exist. |
| Slug/section location | Ad-hoc regex | Port sibling's `src/format/section.mjs` (129 LOC) | Code-fence guard + heading-depth walk + path-concatenation (`slug1/slug2/slug3`) is fiddly. |
| Path traversal guard | Inline `path.startsWith` | Centralize in `_abs()` with thrown TypeError + conformance negative tests | CR-01 scar shows the cost of "inline the check everywhere" — one missed site = filesystem escape primitive. |
| Atomic file write | `fs.writeFileSync` + rename | Port sibling's `_atomicWrite.mjs` (29 LOC, POSIX-rename in-same-dir) + **fix WR-05** via `crypto.randomBytes` | Same-dir rename is load-bearing for POSIX atomicity guarantee; ms-resolution race is Landmine 15. |
| Frontmatter YAML parsing | Roll your own | Sibling's `frontmatter.mjs` (106 LOC flat-scalar) if corpus fits; else `js-yaml@4.1.1` | WR-02/WR-03 YAML-escape bugs bit sibling; TS + nested-object corpus may force escalation. Decide at port time. |
| Conformance harness | Author new harness | Import from fork via `get-shit-done/conformance` subpath | D-CONFORM-EXPORT locks the boundary; sibling's own harness deletes in selective-prune. |
| Store-clone / bead-hash bookmark | Invent a primitive | **Spike the primitive in Plan 06-01 first**; if absent, Outcome A or C | D-TXN-SPIKE 3-outcome evaluation is the correct process. [CITED: SKILL.md §11 amendment] |
| Snapshot/restore | Custom diff tool | Port sibling's Outcome-C pattern (`bd export --json -o <path>` + `bd init --from-jsonl`) — it's proven in 71 tests | 400-700ms cold-start is acceptable cost for reliability; Outcome B would be faster if primitives exist. |
| Seed JSONL regeneration | Manual JSONL hand-editing | Port `tests/fixtures/build-seed.sh` + enforce `BEADS_ACTOR=seed` discipline on EVERY bd call | Landmine 10/11 show what happens when this is skipped. |
| Test-writing patterns | Copy ad-hoc from MarkdownAdapter | Port sibling's patterns: dynamic test names over enum constants, direct `spawnSync` read-backs (D-12), array-unwrap on `bd show`, `chmodSync 0o700` post-init, auto-invoke gate adapted to vitest `describe`/`test` | 71 tests of pattern-polish. [CITED: conformance.md §"Test-writing patterns"] |

**Key insight:** Sibling has ~1000 LOC of proven-correct code with 13 landmine scars PLUS 13 validated spike findings. Ignoring this carry-forward costs more than porting does. The whitelist is not an endorsement of sibling's architecture (D-MAPPING / D-TXN / capabilities shape differ); it's a bug-budget transfer. Porting inherits the fixes FOR the landmines; re-authoring repeats them.

## Common Pitfalls

### Pitfall 1: D-MAPPING-SPIKE outcome not BLOCKING Plan 06-02+

**What goes wrong:** Spike incomplete or outcome ambiguous, planner proceeds with "assume Outcome A" schema authoring, then spike finds B is reality, 12+ schemas become 2 schemas + wasted work. Or inverse: assume B, find A, lose 12+ schema authoring opportunity.

**Why it happens:** D-MAPPING-SPIKE has concrete gate criteria (SPIKE-RESULTS.md §7 outcome + §9 CLI command catalog), but gates aren't enforced if Plan 06-02 doesn't include a precondition check.

**How to avoid:** Plan 06-01's last task MUST be a "spike-gate" task that writes the outcome verdict to a known path (`.planning/phases/06-*/06-01-SPIKE-OUTCOME.md`). Plan 06-02's first task's acceptance criteria MUST include "spike outcome file exists AND §7 names A or B."

**Warning signs:** Plan 06-02 authors schemas before Plan 06-01 ships; commit history shows 06-02 tasks interleaved with 06-01 spike work.

### Pitfall 2: Sibling drift at `/Volumes/code/gsd-beads`

**What goes wrong:** User commits to sibling between CONTEXT.md (2026-05-11) and Plan 06-01 execution; archive-branch no longer captures "everything the CONTEXT snapshot referenced."

**Why it happens:** Sibling is a live repo with commits; freeze is by convention, not enforcement.

**How to avoid:** Plan 06-01 task 0 MUST be `cd /Volumes/code/gsd-beads && git log -1 --format='%H'` and assert it equals `5082d45f13f39d4e1a694936788f5b362ad1ba36`. If not, halt and ask user to reconcile.

**Warning signs:** `git status --short` on sibling shows any modification; `git log 5082d45..HEAD` non-empty.

### Pitfall 3: TS migration inflates Plan 06-01 beyond reviewability

**What goes wrong:** Plan 06-01 = archive-branch + selective prune + port 14 files (~1000 LOC .mjs → ~1200-1400 LOC .ts) + fork-side 3 additive changes + bd CLI spike. Single plan cannot be meaningfully code-reviewed.

**Why it happens:** Amendment proposes "4 plans × 4 waves" which under-allocates scope to Plan 06-01.

**How to avoid:** Widen to 5-7 plans. Suggested breakdown:
- Plan 06-01: Fork-side changes + sibling archive-branch + selective prune + EMPTY .ts scaffold (no LOC ports yet).
- Plan 06-02: Port `bd/`+`helpers/`+`_atomicWrite` (~330 LOC) as mechanical .ts conversion + landmine fixes (WR-05, Landmine 3, Landmine 4).
- Plan 06-03: bd v1.0.3 dual spike (D-MAPPING + D-TXN) — dedicated plan; produces SPIKE-RESULTS.md with evidence; BLOCKS subsequent plans.
- Plan 06-04: Port `format/` modules (~485 LOC) + `paths.ts` + `BdManagedMismatchError`; schema scope determined by 06-03 outcome.
- Plan 06-05: BeadsAdapter primitives (Bin A + foundational) + `writeBinaryAsset` throw + `init()` probe.
- Plan 06-06: 3 `recordState*` families + `StateWriteOutcome` dispatch (16-case coverage) + withTransaction (A/B/C per spike) + dep-graph synthesizer.
- Plan 06-07: Smoke tests (1 per Bin B SDK-helper category — 8 tests) + conformance-suite invocation + README/CLAUDE.md/CONTRIBUTING.md rewrite + Phase 6 exit checkpoint.

**Warning signs:** Plan 06-01 file would exceed ~400 lines; any single task touches >200 LOC.

### Pitfall 4: Fork-side changes landing out of sequence

**What goes wrong:** Sibling Plan 06-05's BeadsAdapter declares `capabilities.graphEdges: {...}` but fork's `adapters/types.ts` hasn't added the field yet. TS compile error.

**Why it happens:** Two repos, file-link dev dep; sibling picks up fork changes only after fork commits.

**How to avoid:** Fork-side changes (3 items) MUST land in Plan 06-01 **before** any sibling port work begins. Sequence: (1) `adapters/types.ts` adds `graphEdges`; (2) `adapters/markdown/index.ts` declares `{semantic: true, dependency: false}`; (3) `package.json` adds `./conformance` subpath; (4) verify `npm run test:conformance` still passes on fork; (5) commit fork; (6) THEN sibling Plan 06-01 task 0 validates fork HEAD.

**Warning signs:** MarkdownAdapter's conformance tests start failing mid-Phase-6; sibling `.ts` compile errors referencing `graphEdges`.

### Pitfall 5: `runAdapterConformanceSuite` subpath resolution fails at runtime

**What goes wrong:** Fork's `package.json` `./conformance` entry points at a path that TS hasn't emitted, or the compiled JS lives at a different path than declared.

**Why it happens:** Fork's `adapters/dist/` exists [VERIFIED] but `tests/conformance/` may not be compiled into the published package — this is test-only code. Subpath-export path depends on `"files"` and `"exports"` resolution.

**How to avoid:** Plan 06-01 fork-side task MUST:
1. Add `"./conformance"` to `"exports"` in `package.json`.
2. Verify TS emit path matches the declared subpath target (likely `./dist/tests/conformance/adapter.conformance.js` or similar).
3. Add `tests` (or `tests/conformance`) to `"files"` if needed to ship with the package.
4. Run a smoke test: `node -e "import('get-shit-done/conformance').then(m => console.log(Object.keys(m)))"` from a tmp dir with fork installed.

**Warning signs:** Sibling conformance test errors with `Cannot find package 'get-shit-done/conformance'` at runtime.

### Pitfall 6: bd cold-start dominates wall-clock; <500ms budgets fail

**What goes wrong:** Conformance tests with tight wall-clock budgets (e.g., `<500ms per bd call`) fail against real bd because `bd list --json` alone is 400-700ms (dolt warm-up) [CITED: Landmine 18].

**Why it happens:** Local dev may have warm dolt caches; CI and fresh machines hit cold-start.

**How to avoid:** Wall-clock budget in conformance is `<2000ms per call` (sibling convention). Real architectural budget: `≤2 bd spawns per public method invocation` (QUAL-07). Test spawn count structurally, not timing.

**Warning signs:** Intermittent test flakes on CI but not locally; timings stratify bimodally around 500ms.

### Pitfall 7: `StateWriteOutcome created_section` variant unimplementable in Outcome B

**What goes wrong:** Fork's 16-case matrix includes `applied: true + created_section` cases for scaffolding scenarios (metric creates `## Performance Metrics`; decision creates `## Decisions Made`). In Outcome B (labels-first), there are no discrete sub-records to scaffold — the entire issue body is one description blob.

**Why it happens:** The `created_section` signal is fundamentally a MarkdownAdapter affordance tied to heading-walker scaffolding (Phase 5 D-06). BeadsAdapter's bd-routed path has no structural analog unless Outcome A ships sub-records.

**How to avoid:** Planner must explicitly document how Outcome B handles `created_section` in Plan 06-06. Two options:
- (a) Never emit — always return `applied: true` bare when a labels-first write lands (even if the issue is new — "new issue" != "created section").
- (b) Emit synthetic `created_section` string that names the label that was created (`phase-id:07` → `created_section: 'label:phase-id'`).

Option (a) is cleaner; fork's 16-case matrix tests should be adjusted to skip `created_section` assertions on BeadsAdapter-in-Outcome-B or to accept `created_section: undefined`.

**Warning signs:** Sibling fails 4-6 of the 16 StateWriteOutcome conformance cases and nobody understands why.

### Pitfall 8: `removeCollection` and `stat` surface missing in sibling

**What goes wrong:** Fork's `StorageAdapter` contract [VERIFIED: `adapters/types.ts:82,87`] requires `removeCollection(prefix)` and `stat(path)` — sibling has neither.

**Why it happens:** These methods were added post-Phase-5 (D-2026-05-01 stat primitive; removeCollection is implicit in collection removal). Sibling is frozen at a state that predates them.

**How to avoid:** Plan 06-05 MUST include explicit tasks to author these two methods from scratch (no carry-forward). `stat` is simple — `bd show <id>` + Array-unwrap or disk-stat per tier. `removeCollection` is harder on bd — depends on cascade semantics (sibling's Spike 002 cascade-loop walks parent-child only, NOT `blocks`) and may need per-tier branching.

**Warning signs:** TS compile error "Class 'BeadsAdapter' does not implement interface 'StorageAdapter'. Property 'stat' is missing." / same for `removeCollection`.

## Code Examples

### Example 1: findBeadsRoot probe (port target)

```ts
// Source: sibling src/bd/findRoot.mjs (67 LOC) ported to TS; 4 topology cases tested
// Carry-forward: spike 003 VALIDATED (worktree / BEADS_DIR env / symlink / non-bd)
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function findBeadsRoot(startDir: string): string | null {
  // 1. BEADS_DIR env override
  if (process.env.BEADS_DIR) {
    const candidate = resolve(process.env.BEADS_DIR);
    if (existsSync(join(candidate, 'metadata.json'))) return candidate;
    return null;
  }
  // 2. Parent-walk for .beads/metadata.json, bounded at filesystem root or .git sentinel
  let dir = realpathSync(startDir);
  const rootBoundary = '/';
  while (dir !== rootBoundary) {
    const beadsDir = join(dir, '.beads');
    if (existsSync(join(beadsDir, 'metadata.json'))) return beadsDir;
    // 3. Handle .git-as-file (worktree case)
    const gitPath = join(dir, '.git');
    if (existsSync(gitPath)) {
      // Reached primary repo boundary; if no .beads above here, give up
      // (worktree case: sibling spike-003 found bd's primary .beads/ is in the primary worktree)
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
```

### Example 2: BdManagedMismatchError shape (per D-INIT-ERR)

```ts
// Source: mirrors fork's UnsupportedCapabilityError shape [VERIFIED: adapters/types.ts:123-142]
export class BdManagedMismatchError extends Error {
  override readonly name = 'BdManagedMismatchError';
  readonly code = 'PROJECT_BD_MANAGED_MISMATCH' as const;
  readonly projectDir: string;
  readonly hint: string;
  readonly __brand = 'BdManagedMismatchError' as const;

  constructor(projectDir: string, hint: string) {
    super(
      `Project directory '${projectDir}' is not bd-managed. ${hint}`,
    );
    this.projectDir = projectDir;
    this.hint = hint;
  }

  static [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance != null &&
      typeof instance === 'object' &&
      (instance as Record<string, unknown>).__brand === 'BdManagedMismatchError'
    );
  }
}
```

### Example 3: Conformance invocation from sibling

```ts
// Source: CONTEXT.md D-CONFORM-EXPORT + adapters/tests/conformance/adapter.conformance.ts:24-27
// File: /Volumes/code/gsd-beads/tests/conformance.test.ts
import { runAdapterConformanceSuite } from 'get-shit-done/conformance';
import { BeadsAdapter } from '../src/index.js';

runAdapterConformanceSuite('beads', (projectDir: string) => {
  // Fixture setup equivalent to sibling's setupFreshAdapter inside the harness
  // (bd init from seed.jsonl + chmodSync 0o700 + git identity) is handled by the
  // harness OR by BeadsAdapter's constructor + lazy _ensureBd(). For fork's
  // harness (which currently does mkdtemp + creates a planning dir), BeadsAdapter
  // needs a pre-test hook OR the harness needs per-adapter fixture callbacks.
  // See Plan 06-07 design: either extend harness with a beforeEach callback
  // argument OR author a `src/test-fixture.ts` helper that sibling smoke tests
  // + the conformance invocation both use.
  return new BeadsAdapter(projectDir);
});
```

**Open concern:** The fork's `runAdapterConformanceSuite` [VERIFIED: `tests/conformance/adapter.conformance.ts:32-38`] pre-creates `.planning/` and constructs adapter with bare path — no hook for bd init. BeadsAdapter either needs to tolerate an uninitialized directory (and do bd init lazily) OR the harness signature needs extension. The latter would break Phase 1 D-15 signature lock; the former is possible if `BeadsAdapter.init()` / `_ensureBd()` is reworked to initialize-if-absent. **This is an open architectural question that Plan 06-07 (or earlier) must resolve.** Current CONTEXT.md does not address it.

### Example 4: Fork-side `Capabilities` extension (the only fork contract change)

```ts
// Source: fork's adapters/types.ts:54-65 current + D-OQ06-CAPS extension
// Diff summary: add `graphEdges` field (additive; non-breaking existing code compiles)
export interface Capabilities {
  record: true;
  section: true;
  frontmatter: true;
  binaryAsset: boolean;
  snapshot: boolean;
  transaction: boolean;
  namedDoc: boolean;
  markdownLockfile: boolean;
  // NEW (Phase 6 D-OQ06-CAPS):
  graphEdges: { semantic: boolean; dependency: boolean };
}
```

```ts
// adapters/markdown/index.ts — add `graphEdges` to capabilities literal
readonly capabilities: Capabilities = Object.freeze({
  record: true,
  section: true,
  frontmatter: true,
  binaryAsset: true,      // post Phase 5
  snapshot: true,          // post Phase 5
  transaction: true,
  namedDoc: true,
  markdownLockfile: true,
  graphEdges: { semantic: true, dependency: false },  // NEW
});
```

### Example 5: Spike output template (D-MAPPING-SPIKE + D-TXN-SPIKE)

```md
<!-- .planning/phases/06-*/06-0N-SPIKE-RESULTS.md template -->
# Plan 06-0N: bd v1.0.3 Primitives Spike — Results

## §1. bd CLI catalog discovered

<!-- Every `bd <subcommand> --help` output + notable flags -->

## §2. Named-JSON-field availability (D-MAPPING)

- [ ] Does `bd update <id>` accept a named field beyond `--description`? (YES/NO/PARTIAL with command + output)
- [ ] Do sub-records (if exposed) round-trip byte-identical via `bd export --json`? (YES/NO + evidence)
- [ ] Can L3/L4 comments be filtered by label or author at query time? (YES: `--author` only; `--label` rejected per v1.0.3 per sibling Landmine 4)

## §3. Store-clone + bead-hash bookmark primitives (D-TXN Outcome B)

- [ ] Does bd expose a primitive to clone `.beads/` state at a content-address? (YES/NO)
- [ ] Does bd expose a primitive for atomic bookmark swap? (YES/NO)
- [ ] Does embedded-Dolt `bd dolt <cmd>` expose these? (YES/NO)

## §4. File-snapshot primitives (D-TXN Outcome C)

- [ ] `bd export --json -o <path>` writes JSONL with all beads + memories? (YES — sibling proven)
- [ ] `bd init --from-jsonl --prefix <px> ...` round-trips byte-identical? (YES — sibling proven with BEADS_ACTOR=seed)
- [ ] Cold-start timing? (400-700ms per sibling measurements)

## §5. Comment structure (re-verify Landmine 4)

- [ ] `bd comments add --label` → silent reject? (YES per sibling — confirm)
- [ ] `bd comments add --author` → structured slot in export? (YES per sibling — confirm)

## §6. Memory API (re-verify)

- [ ] `bd remember <json> --key <k>` + `bd recall <k>` round-trip? (YES per sibling — confirm)

## §7. CHOSEN OUTCOMES

### D-MAPPING: [A — sub-records available / B — labels-first ships]

Evidence: [cite §2]

### D-TXN: [A — in-memory / B — staging + bookmark / C — file-snapshot]

Evidence: [cite §3 and §4]

## §8. Landmines re-verified for v1.0.3

- [ ] Landmine 5: `bd show <id> --json` returns single-element array? (YES/NO)
- [ ] Landmine 6: `bd export --json` is JSONL not array? (YES/NO)
- [ ] Landmine 7: "no issues found" returns `{error, schema_version}` exit 0? (YES/NO)

## §9. Shipped bd CLI commands for chosen outcomes

<!-- Full invocation catalog with exact flag strings, ready to drop into TS wrapper -->
```

Spike INCOMPLETE if any §2–§7 question is unanswered. Blocks Plans 06-04+.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.mjs` + `node:test` + `peerDependencies` (sibling v0.x) | `.ts` + `vitest` + `"get-shit-done": "file:../"` dev-dep | Phase 6 D-TECH-STACK (2026-05-11) | Compile-time `StorageAdapter` + `StateWriteOutcome` + discriminated-union enforcement |
| Single `recordStateEvent({type, payload})` method (sibling) | 3 families: `recordStateAppend` / `recordStateMutation` / `recordStateSignal` | Phase 3 D-01/D-02 (2026-05) | Clean bd mapping: append→comment, mutation→label/memory, signal→delete |
| `{storage, key|bead|author}` informational return (sibling) | `StateWriteOutcome` three-state (`applied: true/false`) | Phase 3 gap-closure ADR D-2026-05-10-08 (2026-05-11) | Callers can distinguish duplicate / nothing_to_remove / applied |
| 7-bit `capabilities` (sibling) | 9-key `Capabilities` + `graphEdges: {semantic, dependency}` | Phase 1 D-08 + Phase 6 D-OQ06-CAPS | `frontmatter` + `markdownLockfile` required groups + fine-grained graph |
| `UnsupportedOperationError` with `{method, flag, hint}` (sibling) | Fork's `UnsupportedCapabilityError` with `__brand` + `capability` + `adapterName` | Phase 1 D-10 | Cross-module `instanceof` resilience (dual-package / vitest transform) |
| Hardcoded `--prefix 'sd'` in restore (sibling WR-04) | Derive prefix from snapshot metadata OR first issue's id | Phase 6 Plan 06-06 port | Correctness for non-`sd`-prefixed snapshots |
| `${pid}.${Date.now()}` tmpfile names (sibling WR-05) | `${pid}.${crypto.randomBytes(6).toString('hex')}` | Phase 6 Plan 06-02 port | Eliminates ms-resolution race |
| Labels-first `frontmatter` (sibling D-03) | **Outcome-dependent:** D-MAPPING Outcome A → sub-records; Outcome B → labels-first continues | Phase 6 Plan 06-03 spike | Resolves bd v1.0.3 primitive uncertainty |
| File-snapshot-only `snapshot/restore` (sibling; `capabilities.transaction: false`) | **Outcome-dependent:** A/B/C per spike; **all three ship `capabilities.transaction: true`** | Phase 6 Plan 06-03 spike | pipeline.ts dry-run depends on transaction unconditionally |
| Sibling's own conformance harness (`tests/conformance/run.mjs`) | Fork's `runAdapterConformanceSuite` via `get-shit-done/conformance` subpath | Phase 6 D-CONFORM-EXPORT | Harness authored once, consumed by N adapters |

**Deprecated/outdated (do not carry forward from sibling):**

- `archive/v0.2-shadow/` (all shadow-architecture artifacts — hooks, scripts, shadow binary, shadow tests)
- `install/memories/*.md` (shadow-install memory seeding content)
- `settings.fragment.json` + `recipe/gsd-beads-recipe.md` (shadow Claude Code install config)
- v0.2 milestone requirements (REQ-READ-01..14, REQ-QUAL-01..07, REQ-VERIFY-01..02 — canceled per sibling D-2026-04-30-01)
- `gsd-sdk-cc.version.lock` (shadow-era version pin)
- `docs/WORKTREES.md` + `WORKTREES-EVIDENCE.md` (user-workflow docs; re-author if needed)
- Sibling's own `.claude/skills/spike-findings-gsd-beads/` (canonical version lives in fork)
- Phase 2/3/5 plan artifacts (shadow-era, historical only)
- `tests/unit/docs-content.test.mjs`, `package-json-shape.test.mjs`, `structural-*.test.mjs`, `memories-seeded.test.mjs`, `milestone-scoping.test.mjs`, `seed-determinism.test.sh` (sibling-specific structural invariants)
- `capabilities.transaction: false` stance (fork forces true per D-TXN-CAPS)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | bd v1.0.3 cold-start is 400-700ms | Performance budget, Pitfall 6 | [CITED: sibling Plan 07-09 SUMMARY]; if bd 1.0.3 behavior differs on user's OS, budget becomes mis-calibrated — wall-clock tests may flake. **Mitigation:** Plan 06-03 spike measures live. |
| A2 | Fork's `./conformance` subpath can resolve to compiled JS at the path declared in `package.json` `"exports"` field | Code Example 3 + Pitfall 5 | [ASSUMED] — fork's TS emit path for `tests/conformance/*.ts` is not verified in this session. If TS emits to a path that doesn't match the exports declaration, sibling import fails at runtime. **Mitigation:** Plan 06-01 task MUST smoke-test the import. |
| A3 | `runAdapterConformanceSuite` harness [VERIFIED: `adapter.conformance.ts:22-88`] works with BeadsAdapter's lazy `_ensureBd()` without bd being initialized at construction time | Code Example 3 + open concern | [ASSUMED] — harness pre-creates `.planning/` but not `.beads/`. BeadsAdapter may need to tolerate uninitialized dir OR harness needs extension. **Mitigation:** Plan 06-07 resolves; may need ADR. |
| A4 | Fork's 16-case `StateWriteOutcome` matrix [VERIFIED: `tests/conformance/write-outcome.test.ts` comments] can be satisfied by BeadsAdapter in Outcome B | Pitfall 7 | [ASSUMED] — `created_section` variant may be unimplementable without sub-records. **Mitigation:** explicit `applied: true` bare mapping; planner documents in Plan 06-06. |
| A5 | `bd dep add` default `blocks` semantics are stable across bd v1.0.3 patch releases | Pattern 4 dep-graph | [CITED: spike-014]; small risk if user's bd is a later patch with different defaults. **Mitigation:** spike re-verifies at Plan 06-03. |
| A6 | User will install bd v1.0.3 before Plan 06-01 spike executes | Environment Availability | [VERIFIED per CONTEXT.md + user confirmation]; no install path documented in this session. **Mitigation:** Plan 06-01 precondition task MUST fail-fast if `command -v bd` returns nothing. |
| A7 | Sibling repo at `/Volumes/code/gsd-beads` remains at `main @ 5082d45f...` between CONTEXT.md (2026-05-11) and Plan 06-01 execution | Pitfall 2 | [VERIFIED at research time via `cd /Volumes/code/gsd-beads && git log -1`]; user commits between now and execution invalidate the freeze. **Mitigation:** Plan 06-01 task 0 asserts commit SHA. |
| A8 | TypeScript 6.0.3 + vitest 4.1.6 are the versions fork consumes (and sibling must match) | Standard Stack | [VERIFIED via `npm view`]; fork's actual installed versions may lag. **Mitigation:** sibling `package.json` uses `^` caret or `^6 / ^4`; pin only if compat breaks. |
| A9 | WR-01 + WR-09 sibling WARN landmines are safely deferrable under Phase 6 LOC budget | CONTEXT.md Claude's Discretion bullet | [ASSUMED]; no new evidence. Planner judges per scope. |
| A10 | BeadsAdapter surface = 22 methods (not ~58 per REQUIREMENTS.md BEADS-02 wording) because fork's contract has Bin B in SDK helpers, not adapter | Phase Requirements BEADS-02 mapping | [VERIFIED: `adapters/types.ts:67-121`]; REQUIREMENTS.md wording predates Phase 3 D-04 ("adapter stays thin"). Planner must cross-reference against fork contract, not REQUIREMENTS.md prose. |
| A11 | The hybrid tier at sibling's `pathRouter.mjs` (CR-02 BLOCKER) gets resolved in fork by either deleting hybrid tier or forcing `putRecord` on hybrid paths through named-doc dispatch | Common Pitfalls + Landmines fixed | [ASSUMED] — fork's canonical-file list may not map 1:1 to sibling's 7 patterns. Plan 06-04 resolves during `paths.ts` authoring. |

## Open Questions

1. **Does fork's `runAdapterConformanceSuite` harness give BeadsAdapter enough pre-test hooks for bd initialization?**
   - What we know: harness does `mkdtemp + mkdir .planning + new Adapter(tmpDir)` [VERIFIED: `adapter.conformance.ts:32-38`]. Does NOT do bd init.
   - What's unclear: whether BeadsAdapter's `_ensureBd()` can lazily bd-init (Outcome C pattern: `bd init --from-jsonl` from seed fixture) or whether harness needs a per-adapter beforeEach callback.
   - Recommendation: Plan 06-07 explicitly resolves. If harness extension is needed, it's a fork-side change (ADR required since signature is D-15 locked). If BeadsAdapter can self-init, document the pattern.

2. **Does `removeCollection` on bd-routed paths need cascade semantics that sibling's Spike 002 rejected for phase completion?**
   - What we know: sibling's cascade-loop walks parent-child only, NOT `blocks`. `bd dep add` (default type) IS blocks. Collection removal via cascade would need `bd delete <id> --cascade` semantics that bd may or may not expose.
   - What's unclear: whether bd v1.0.3 has a cascade-delete primitive, or whether `removeCollection` enumerates + deletes per-issue.
   - Recommendation: Plan 06-03 spike adds `bd delete` + `--cascade` to the CLI catalog investigation. If absent, Plan 06-05 implements as `listCollection + remove each`.

3. **How does the 16-case `StateWriteOutcome` matrix map to Outcome B (labels-first)?**
   - What we know: `created_section` is a MarkdownAdapter affordance tied to heading-walker scaffolding.
   - What's unclear: whether BeadsAdapter in Outcome B should never emit `created_section`, always emit a synthetic marker, or the test matrix is relaxed for this adapter.
   - Recommendation: Plan 06-06 documents the mapping as an ADR; conformance test behavior is explicit.

4. **Which of the sibling's 8 cluster files (discussTodos, initBundlers, longTail, phaseLifecycle, primitives, roadmapMilestone, state, verifyReviews — total ~1000 LOC) does NOT carry forward under fork's Phase 3 D-04 ("adapter stays thin")?**
   - What we know: sibling has domain methods on the adapter (addPhase, etc.); fork puts those in SDK helpers.
   - What's unclear: whether any of those cluster files contain *primitive* code that carries forward vs pure domain logic that's already in fork's SDK helpers.
   - Recommendation: Plan 06-04 task audits each cluster file with "is this domain logic (discard) or primitive plumbing (port)?". Likely all 8 discard because fork's SDK helpers own the domain layer.

5. **Is there a clean way to preserve `git log --follow` history for the `/Volumes/code/gsd-beads` → `.ts` port?**
   - What we know: sibling's Plan 06-04 D-11 used verbatim extraction to preserve `--follow`; `git mv foo.mjs foo.ts` preserves follow for rename detection.
   - What's unclear: whether `git mv + in-place content rewrite (mjs → ts)` in the same commit preserves follow, or splits it into 2 commits (mv first, then rewrite).
   - Recommendation: Plan 06-02 tests this mechanically on one file; if split-commit is needed, document the discipline for all 14 files.

6. **Does the user's bd v1.0.3 install match `1b2dd2cb` build exactly, or a different v1.0.3 point release?**
   - What we know: sibling's verified version string is `bd v1.0.3 (1b2dd2cb)`.
   - What's unclear: whether point-release builds of v1.0.3 have identical CLI behavior for the 9 subcommands sibling uses.
   - Recommendation: Plan 06-03 spike's §1 first task is `bd --version` assertion. If mismatch, reconcile with user.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.6 (sibling adopts fork's stack per D-TECH-STACK) |
| Config file | `/Volumes/code/gsd-beads/vitest.config.ts` (new, authored Plan 06-01) + fork's `vitest.conformance.config.ts` consumed via `get-shit-done/conformance` |
| Quick run command | `npm run test:unit` (sibling-authored; scopes to `tests/unit/**/*.test.ts`) |
| Full suite command | `npm test` (runs unit + conformance) |
| Conformance invocation | `npm run test:conformance` — invokes `runAdapterConformanceSuite('beads', factory)` from fork's harness |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BEADS-01 | All Bin A primitives (`getRecord`/`putRecord`/`removeRecord`/`removeCollection`/`listCollection`/`exists`/`stat`/`getSection`/`updateSection`/`getFrontmatter`/`updateFrontmatter`/`mergeFrontmatter`) work against bd | conformance + smoke | `npm run test:conformance` (all 11 Bin A methods exercised via fork's `adapter.conformance.ts`) + `npx vitest run tests/smoke/record-primitives.test.ts` | ❌ Plan 06-01 scaffolds conformance invocation; Plan 06-02 adds smoke |
| BEADS-02 | 3 `recordState*` families return correct `StateWriteOutcome`; each dispatches correct bd primitive per D-MAPPING event-family mapping | conformance (16-case matrix) + per-family smoke | `npx vitest run tests/conformance.test.ts -t 'recordStateAppend'` + `.../recordStateMutation` + `.../recordStateSignal` | ❌ Plan 06-06 |
| BEADS-03 | `getRecord('graphs/graph.json')` returns valid JSON with bd `blocks`-derived `{type: 'dependency', confidence: 1.0}` edges; `capabilities.graphEdges` declares `{semantic: false, dependency: true}` | smoke + capability lint | `npx vitest run tests/smoke/dep-graph.test.ts` | ❌ Plan 06-06 |
| BEADS-04 | `BeadsAdapter.init()` (or first bd-using method) against non-bd-managed dir throws `BdManagedMismatchError` with `code === 'PROJECT_BD_MANAGED_MISMATCH'` and `projectDir` populated | smoke | `npx vitest run tests/smoke/init.test.ts` (4 topology cases per findRoot test table) | ❌ Plan 06-05 |
| BEADS-05 | `writeBinaryAsset` throws `UnsupportedCapabilityError` with fork's shape; `capabilities.binaryAsset === false`; rationale comment present in source | smoke (capability-lint ported from sibling) | `npx vitest run tests/smoke/binary-asset.test.ts` | ❌ Plan 06-05 |

### Sampling Rate

- **Per task commit:** `npm run test:unit` (fast; scoped to ported module's unit tests)
- **Per wave merge:** `npm test` (full suite — unit + conformance; bd-cold-start tolerance per QUAL-07 budget)
- **Phase gate:** Full suite green + `runAdapterConformanceSuite` all 71+ cases pass against live bd v1.0.3 before `/gsd-verify-work`

### Wave 0 Gaps

All test infrastructure is currently **absent** in the sibling post-reset. Plan 06-01 authors:

- [ ] `/Volumes/code/gsd-beads/vitest.config.ts` — vitest project config; threaded per-file concurrency (bd spawns serialize on dolt; keep `threads: false` or max 1 per `.beads/` root)
- [ ] `/Volumes/code/gsd-beads/tests/conformance.test.ts` — imports `runAdapterConformanceSuite`; constructs BeadsAdapter factory
- [ ] `/Volumes/code/gsd-beads/tests/conftest.ts` (or per-test fixtures) — shared bd-init-from-seed.jsonl fixture (port sibling's `setupFreshAdapter` pattern)
- [ ] `/Volumes/code/gsd-beads/tests/fixtures/seed.jsonl` — regenerated from `build-seed.sh` with `BEADS_ACTOR=seed` discipline
- [ ] `/Volumes/code/gsd-beads/tests/fixtures/build-seed.sh` — ported from sibling whitelist (may remain `.sh`)
- [ ] `/Volumes/code/gsd-beads/tests/smoke/init.test.ts` — BEADS-04
- [ ] `/Volumes/code/gsd-beads/tests/smoke/binary-asset.test.ts` — BEADS-05
- [ ] `/Volumes/code/gsd-beads/tests/smoke/record-primitives.test.ts` — BEADS-01 (supplements conformance)
- [ ] `/Volumes/code/gsd-beads/tests/smoke/state-events-append.test.ts`, `-mutation.test.ts`, `-signal.test.ts` — BEADS-02 × 3
- [ ] `/Volumes/code/gsd-beads/tests/smoke/dep-graph.test.ts` — BEADS-03
- [ ] `/Volumes/code/gsd-beads/tests/smoke/<per-Bin-B-category>.test.ts` × 8 (phase, plan, summary, uat, state-event, debug, intel, learnings per SC#3 of ROADMAP Phase 6)
- [ ] Framework install: `npm install --save-dev vitest@^4 @types/node`

*(Wave 0 gap list is long because sibling's entire test tree is pruned in D-SCAFFOLD step 4.)*

## Sources

### Primary (HIGH confidence)

- `/Volumes/code/get-shit-done/adapters/types.ts` (160 LOC) — locked StorageAdapter contract [VERIFIED: file read 2026-05-11]
- `/Volumes/code/get-shit-done/adapters/state-event-types.ts` (105 LOC) — AppendEvent/MutationEvent/SignalEvent unions [VERIFIED]
- `/Volumes/code/get-shit-done/tests/conformance/adapter.conformance.ts` — locked harness signature [VERIFIED]
- `/Volumes/code/get-shit-done/tests/conformance/write-outcome.test.ts` — 16-case StateWriteOutcome matrix [VERIFIED]
- `/Volumes/code/get-shit-done/.claude/skills/spike-findings-gsd-beads/` (6 files, 2696 LOC) — canonical carry-forward reference [VERIFIED via Read + wc]
  - SKILL.md (953 LOC) — overview + 11 amendments + files-to-preserve-vs-delete catalog
  - bd-primitives.md (349 LOC) — bd CLI call-site catalog with line references
  - conformance.md (377 LOC) — harness patterns + seed.jsonl invariant
  - decisions-carry-forward.md (175 LOC) — sibling D-ID → fork D-ID mapping
  - format-modules.md (292 LOC) — phase/section/frontmatter walk
  - landmines.md (550 LOC) — 13 scars with file:line citations + mitigations
- `/Volumes/code/get-shit-done/.planning/phases/06-beadsadapter-implementation/06-CONTEXT.md` (934 LOC) — 4 fresh decisions post-hybrid-pivot + re-affirmed decisions [VERIFIED]
- `/Volumes/code/get-shit-done/.planning/REQUIREMENTS.md` — BEADS-01..05 + traceability [VERIFIED]
- `/Volumes/code/get-shit-done/.planning/ROADMAP.md` §Phase 6 — 5 success criteria [VERIFIED]
- `/Volumes/code/get-shit-done/.planning/PROJECT.md` — fork architecture + two-repo model [VERIFIED]
- `/Volumes/code/get-shit-done/.planning/research/fork-investigation/SYNTHESIS.md` §4/§7/§9 — canonical interface + phase scope + risk register [VERIFIED]
- `/Volumes/code/get-shit-done/.planning/phases/03-wire-core-write-methods-recordstateevent/03-CONTEXT.md` — 3 event-family design [VERIFIED]
- `/Volumes/code/get-shit-done/.planning/phases/05-foundational-primitive-lift/05-CONTEXT.md` — D-01..D-21 primitive-lift decisions [VERIFIED]
- `/Volumes/code/gsd-beads` at `main @ 5082d45f` — sibling source tree [VERIFIED: `git log -1`, `git status --short`, `wc -l src/**/*.mjs`]
- npm registry queries for `vitest`, `typescript`, `js-yaml`, `@types/js-yaml` [VERIFIED: `npm view <pkg> version` on 2026-05-11]

### Secondary (MEDIUM confidence)

- bd v1.0.3 CLI behavior — sibling empirical (71 tests, 13 spikes against live bd) [CITED: bd-primitives.md §1-9] — LIMITED to the 9 subcommands sibling invoked. Plan 06-03 spike probes beyond.
- Spike 014 `bd dep add` field semantics — single-source empirical evidence in sibling `.planning/spikes/014-bd-blocks-sibling-deps/SPIKE.md`, validated against bd v1.0.3 but not cross-verified with bd upstream docs.

### Tertiary (LOW confidence)

- bd v1.0.3 upstream public documentation / changelog — NOT consulted in this session. A Context7 or WebFetch pass on bd's GitHub README + CHANGELOG would verify whether v1.0.3 has any primitives the sibling didn't discover (D-MAPPING-SPIKE / D-TXN-SPIKE could be partially front-loaded with this). **Recommendation:** Plan 06-01 spike task includes a pre-experiment WebFetch of bd's current CLI reference docs — cheap; reduces spike scope.
- Exact bd install procedure for user's machine — NOT documented in CONTEXT.md. User may install via cargo, brew, standalone binary, etc.; affects bin path resolution.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm registry; fork's current stack is vitest already confirmed from `package.json`.
- Architecture: HIGH — locked by CONTEXT.md D-* decisions; only open branch is D-MAPPING-SPIKE outcome (A/B) and D-TXN-SPIKE outcome (A/B/C), both deliberately gated to Plan 06-01.
- Landmines + carry-forward: HIGH — 2696 lines of canonical skill reference + file:line citations in every landmine.
- bd v1.0.3 primitive surface: MEDIUM — 9 subcommands empirically verified by sibling; behavior beyond those is spike-gated.
- Fork-side subpath export mechanics: MEDIUM — pattern is standard (npm subpath exports) but fork's specific TS emit configuration is unverified in this session.

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (30 days — bd v1.0.3 is stable; sibling is frozen; fork contract is locked). If the spike outcome in Plan 06-01 surfaces **any** primitive the sibling's 71-test base didn't discover, this RESEARCH.md's Outcome-B assumptions are not invalidated — Outcome A becomes viable, which changes **Plan 06-02+ schema authoring scope but not the core architecture map**.

## Project Constraints (from CLAUDE.md)

- **Fork name:** keep `get-shit-done` (D-2026-04-30-03). Don't rename.
- **Branch strategy:** `main` mirrors `upstream/main` — never modify directly. All adapter work on `feat/storage-adapter`. Per-phase feature branches OK off `feat/storage-adapter`. **Phase 6 may create a `feat/phase-6-beadsadapter` branch but the majority of work is in the sibling repo, not this fork.**
- **Upstream sync:** periodic rebase against `upstream/main`; conflicts should only happen in adapter-interface seam patches. Business-logic conflicts indicate a leak — route through the adapter.
- **Sibling repo location:** `/Volumes/code/gsd-beads` [CORRECTION per CONTEXT.md environment note; CLAUDE.md's `~/code/gsd-beads` is stale]. Research uses `/Volumes/code/gsd-beads`.
- **Recent upstream activity:** `feat(sdk): add durable planning runtime (#2898)`, `refactor: extract planning-workspace seam from core.cjs (#2901)`, `refactor(query): manifest-backed routing seam + family adapters (#2908)` — investigated in Phase 1 (resolved via per-PR ADRs). Phase 6 does not revisit.

**Fork-side commits for Phase 6 (this repo) must land BEFORE any sibling `gsd-beads` plan-work starts** (Pitfall 4). Expected fork-side commits:

1. `feat(adapter): add graphEdges field to Capabilities (D-OQ06-CAPS)` — touches `adapters/types.ts`, `adapters/markdown/index.ts`, affected type guards/tests.
2. `feat(exports): add ./conformance subpath for adapter consumers (D-CONFORM-EXPORT)` — touches `package.json`, possibly TS emit config.
3. Optional: `docs(06): reconcile plan structure post-pivot` — if planner widens ROADMAP's 7 plans.

All three should be reviewable in a single PR or sequential PRs against `feat/storage-adapter`.
