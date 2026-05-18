# Phase 2: Make the seam real - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 makes the StorageAdapter seam load-bearing by replacing every internal `adapterFor(projectDir)` callsite in `sdk/src/query/` with the registry-injected adapter, deleting the helper, and proving end-to-end round-trip parity for both adapters via a new "seam-realness" entry in the v1.0 conformance manifest. Today the helper hardcodes MarkdownAdapter — every migrated handler silently bypasses the configured `storage.adapter`. The fix replaces the helper, threads the adapter through ~133 callsites across 29 files (highest density: `state-mutation.ts` at 23 callsites), refactors `pipeline.ts` dry-run to use the existing `snapshot()`/`restore()` interface methods (not MarkdownAdapter-private escape hatches), and adds a generic `getTouchedPaths()` interface method implemented on both adapters.

Phase 2 also propagates `StateWriteOutcome` upward through SDK handler return types — the contract is already implemented at the adapter layer, but handlers discard it. Since the same handler signatures are being touched anyway, both signature changes happen in the same phase under strict atomic-commit discipline.

**Strict-superset invariant:** With no `storage.adapter` configured, all CLI behavior must be byte-identical to upstream `gsd-build/get-shit-done`.

This phase does NOT port upstream features (Phase 3 / PORT-01..07), close VERIFY/MISC/DEFECT/DIVERGE items (Phase 4), or ship dry-run diff *introspection* on bd beyond a best-effort `getTouchedPaths` fallback (the precise/cheap bd-native diff implementation is sibling-repo / future scope).

</domain>

<decisions>
## Implementation Decisions

### adapterFor disposition + dry-run diff (entangled)

- **D-01 (Option B locked):** **Delete `adapterFor` entirely.** Pipeline.ts and every other callsite receives the adapter via registry injection. SEAM-02 acceptance grep (`grep -rn "adapterFor(projectDir)" sdk/src/query/ | wc -l == 0`) is satisfied structurally, not by renaming.
- **D-02:** **Generic dry-run diff via `snapshot()`/`restore()` instead of MarkdownAdapter-private escape hatches.** Pipeline.ts dry-run flow becomes: `snap = await adapter.snapshot()` → `await adapter.withTransaction(async () => { await original(...); const touched = adapter.getTouchedPaths(); /* compute before/after via snap + getRecord */ })` → `await adapter.restore(snap)`. The underscore-prefixed `_txnContextForPipeline` and `_realReadForPipeline` methods are deleted from MarkdownAdapter — they were a "this is an interface violation" code smell (underscore prefix signals contract leak).
- **D-03:** **New interface method:** `StorageAdapter.getTouchedPaths(): Set<string>`, callable inside the active transaction. Replaces the touched-paths set that today is buried inside MarkdownAdapter's private `TxnCtx`.
- **D-04:** **Best-effort bd implementation of `getTouchedPaths`.** BeadsAdapter implements it via a naive "enumerate-all-records-this-transaction-touched" fallback. Diff is correct on bd but coarser-grained than markdown's exact path set. Conformance test asserts diff *non-empty* on bd, *exact path set* on markdown. No sibling-repo dependency for Phase 2 close.
- **D-05 [informational]:** Performance note (informational, not gated): bd's `snapshot()` uses `bd export --json` + re-init on `restore()` — full DB roundtrip per dry-run mutation (~100ms-1s overhead). Acceptable for interactive `--dry-run`; if pipeline tests run many mutations under dry-run, optimization is filed as a future bd-native primitive (sibling-repo / Phase 4+ scope).

### Handler signature & adapter threading

- **D-06 (Option A locked):** **Complete the in-flight closure-wrapper migration.** Every handler accepts `(adapter, args, projectDir, workstream)`. The `createRegistry` closures in `index.ts` thread the adapter from `createStorageAdapter(projectDir)`. The public `QueryHandler` type in `utils.ts` stays unchanged. ~40 handlers already use this pattern; ~60 remaining.
- **D-07 [informational]:** **No pivot to context-object (B), factory pattern (C), or registry-constructor (D).** Reasons documented in DISCUSSION-LOG.md. The closure-wrapper is itself the migration path if a future phase needs richer context (`dryRun`, `correlationId`, `logger`) — change the closure, not the handler shape.
- **D-08:** **Adapter cache lives in the closure, not in `helpers.ts`.** The current `_adapterCache` Map in helpers.ts is retired alongside `adapterFor`. Each `createRegistry` invocation gets one adapter instance per `projectDir` (cached at the registry-build layer), preserving transaction-state sharing across handlers within one query invocation — the original cache's purpose.
- **D-09 [informational]:** **Shared helpers stay adapter-first-arg.** Functions like `getMilestoneInfo`, `extractCurrentMilestone`, `findPhase`, `roadmapAnalyze` (already adapter-aware per Phase 2 Plan 02-02) keep their `(adapter, ...)` shape. No refactor there.

### Conformance suite shape (SEAM-06)

- **D-10 (manifest-listed locked):** **Extend the v1.0 56-entry manifest** at `tests/conformance/manifest.ts` with ~30 new `kind: 'seam-realness'` entries — one per migrated state-mutation handler. Each entry has explicit per-adapter expected outcomes. Reuses the existing bidirectional `meta-coverage.test.ts` invariant (manifest ↔ registeredTests) which catches both silent omissions and orphan tests.
- **D-11:** **DEFECT-02 (>64KB body byte-identical round-trip)** lands as a `kind: 'seam-realness'` manifest entry naming `putRecord`/`getRecord` with a buffer-size fixture parameter. No new infrastructure.
- **D-12:** **Failure-disposition pattern: `kind: 'known-gap'` per failing handler with required `adr:` reference.** Matches v1.0's existing pattern (e.g. `withTransaction:mid-commit-replay`). The 95% pass rate is computed as `(entries where kind !== 'known-gap') / total entries`. Any sub-95% handler is enumerated by name in the manifest with an ADR citation — silent skip is impossible.
- **D-13:** **Per-adapter `StateWriteOutcome` assertions in manifest entries.** Because D-14 propagates `StateWriteOutcome` through handlers, manifest entries can assert on the outcome shape per adapter (`{ applied: true, created_section: 'Decisions' }` vs `{ applied: false, reason: 'duplicate' }`). The `adr:` annotation becomes richer: per-adapter outcome divergences are documented as expected outcome values, not just prose.

### StateWriteOutcome propagation through SDK handlers

- **D-14 (IMPLEMENT ALONGSIDE locked):** **In Phase 2, change SDK handler return types from `Promise<void>` to `Promise<StateWriteOutcome>` for every state-mutation handler.** The contract is already implemented at the adapter layer (both MarkdownAdapter and BeadsAdapter return `StateWriteOutcome` from `recordState*`); handlers currently discard it. One refactor pass per handler family covers both signature changes (adapter threading + return type).
- **D-15 (PRECONDITION — atomic-commit separation):** **Adapter-threading commits and return-type-change commits are separate per handler family.** For each file (e.g. `state-mutation.ts`): commit 1 = "thread adapter through state-mutation handlers", commit 2 = "propagate StateWriteOutcome through state-mutation handlers". Two atomic commits per family, build+test gate between each. NEVER bundled. This directly mitigates the v1.0 Wave 6 anti-pattern (bundled-corruption commit).
- **D-16 (PRECONDITION — pre-flight callsite audit):** **Before changing handler return types, audit every caller of every state-mutation handler.** Concrete check: `grep -rn "await state[A-Z][a-zA-Z]*(" sdk/src/ workflows/ .claude/`. Confirm every match is unbound (no `const x = await ...`, no `if (await ...)`). If any caller branches on the return value today, the change is no longer additive and that caller must be updated in lockstep — file as a planning-time finding, not an execution surprise. The planner-agent runs this audit; results land in RESEARCH.md or as a planning-stage bd note.

### Migration staging strategy (constrained by D-15 + anti-pattern 2)

- **D-17:** **Per-handler-family commit pairs.** Each file gets two atomic commits (D-15). Estimated total: ~14-18 commits across the migration. Distribution by file (callsite count from `adapterFor(projectDir)` grep):
  - `state-mutation.ts` (23) — heaviest; one commit pair
  - `phase-lifecycle.ts` (10) — one commit pair
  - `spike-sketch.ts` (7), `scratch.ts` (6), `named-docs.ts` (6) — one pair each
  - `workstream.ts`, `progress.ts`, `config-mutation.ts` (4 each) — one pair each
  - `thread-seed.ts`, `milestone-ops.ts`, `commit.ts`, `codebase-docs.ts` (3 each) — one pair each
  - Long tail (1-2 callsites each) — pairs grouped by domain affinity where it doesn't violate atomicity
- **D-18:** **Build + full test suite gate after each commit.** Per `.continue-here.md` blocking anti-pattern 2: bundled commits with file corruption shipped in v1.0 Wave 6 because no build/test ran between bundled changes. Each commit in this phase must `npm run build:sdk-only && npm test` clean before the next commit lands.
- **D-19:** **Per-phase staging branch.** Reuse Phase 1's pattern (D-04 from 01-CONTEXT): work happens on a `feat/storage-adapter-staging` branch (or per-plan staging branch); canonical `feat/storage-adapter` advances only when SEAM-01..06 + DEFECT-02 acceptance evidence is captured.

### Claude's Discretion

- Exact ordering of handler-family migrations within Phase 2 plans (state-mutation.ts is highest-leverage and likely first; long-tail ordering is planner-chosen).
- Whether the `getTouchedPaths` interface method goes through `withTransaction`'s callback context or as a direct method on the adapter — implementation detail, not contract-shape decision.
- Test fixture shape for the new `kind: 'seam-realness'` manifest entries (within the constraint that DEFECT-02 buffer-size fixture is one of them).
- Whether the pre-flight callsite audit (D-16) is a separate bd issue or rolled into Phase 2 planning notes.
- Bd-mirror discipline for STATE.md updates during this phase (continuing v1.0 pattern until SEAM lands — meta-recursive: this phase is what unblocks dropping the manual mirror).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and acceptance

- `.planning/REQUIREMENTS.md` §"v1.1 — SEAM" — defines SEAM-01..06 + DEFECT-02 with success criteria. Read before plan-phase.
- `.planning/ROADMAP.md` §"Phase 2: Make the seam real" — phase goal + dependencies + 5 success-criterion observable outcomes (grep returns 0; bd round-trip; markdown byte-identical; conformance suite ≥95%; adapterFor deleted/stubbed).
- `.planning/PROJECT.md` "Branch strategy" + "Strict superset invariant" — operating constraints.

### Bug origin and acceptance

- bd `get-shit-done-qt2` (P0, OPEN) — root-cause description for SEAM-01..03; explicit reproduction steps; lists "delete adapterFor OR rewrite to honor config" as acceptance. **Read before planning.**

### Codebase entry points

- `sdk/src/query/helpers.ts` lines 504-545 — `adapterFor` definition, `_adapterCache` Map, JSDoc explaining the pipeline-dry-run dependency on MarkdownAdapter-specific methods. This is the file that gets the deletion.
- `sdk/src/query/pipeline.ts` lines 100-177 — pipeline dry-run dispatcher. Lines 117-150 contain the cast-to-`ext` block that exposes `_txnContextForPipeline` / `_realReadForPipeline`. This block is what D-02's snapshot/restore-based diff replaces.
- `sdk/src/query/index.ts` lines 282-722 — `createRegistry` closures (the in-flight Option A pattern). New handlers being migrated must follow this pattern.
- `sdk/src/query/utils.ts` — `QueryHandler` type definition (stays unchanged per D-06).
- `sdk/src/query/state-mutation.ts` — heaviest single file (23 callsites + ~30 state-mutation handlers); also where StateWriteOutcome propagation matters most.
- `adapters/types.ts` lines 61, 76, 111-115, 174-184 — StorageAdapter interface, `Capabilities`, `withTransaction`, `snapshot`/`restore`, `hasSnapshot`/`hasTransaction` typeguards. The `getTouchedPaths` method gets added here.
- `adapters/markdown/index.ts` lines 506-660 — MarkdownAdapter `snapshot`/`restore`/`withTransaction` + the underscore-prefixed escape hatches that D-02 deletes.

### Conformance suite (extension target)

- `tests/conformance/manifest.ts` — v1.0's 56-entry conformance manifest. ~30 new `kind: 'seam-realness'` entries land here.
- `tests/conformance/meta-coverage.test.ts` — bidirectional invariant (manifest ↔ registeredTests). Catches silent omissions.
- `tests/conformance/paired-adapters.ts` — paired runner that exercises both adapters. Imports BeadsAdapter from npm package `gsd-beads/testing`.
- `tests/conformance/paired-outcome-{markdown,beads}.test.ts` — existing pattern for outcome-shape assertions; the model for D-13's per-adapter `StateWriteOutcome` assertions.

### Locked decisions still in force

- `.planning/DECISIONS.md` D-2026-04-30-04 — periodic rebase against upstream/main; conflicts only in adapter-seam files. Phase 2's seam work is exactly this constraint becoming load-bearing.
- `.planning/DECISIONS.md` D-2026-05-12-OQ06-CREATED-SECTION — BeadsAdapter never emits `created_section` under D-MAPPING Outcome A. Relevant to D-13 per-adapter assertions on `StateWriteOutcome` shape.
- `.planning/DECISIONS.md` D-2026-05-12-NORMALIZE — `StorageAdapter.normalize()` additive contract (Plan 07-01). Relevant when comparing snapshot vs current state in dry-run diff.

### v1.0 anti-patterns (mandatory pre-execution reading)

- `.planning/.continue-here.md` "Critical Anti-Patterns" table — both blocking patterns apply directly to this phase. Pattern 1 (silent-noop on pattern-match fail) is what `StateWriteOutcome` propagation surfaces. Pattern 2 (bundled executor commit with file corruption) is what D-15 + D-18 prevent.

### Phase 1 carry-forward

- `.planning/phases/01-land-the-rebase/01-CONTEXT.md` — staging-branch flow (D-04), bd-mirror discipline (still active until SEAM lands).
- `.planning/phases/01-land-the-rebase/01-02-SUMMARY.md` — Phase 1 close-out; canonical `feat/storage-adapter` at `332f9efe` (369-commit rebase window above `ae63cbe5`); 1 surprise routed to Phase 4 (bd `get-shit-done-9b9`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Closure-wrapper pattern in `createRegistry`** (`sdk/src/query/index.ts` lines 282-722) — already adopted for ~40 handlers. New migrations follow the existing pattern; no new infrastructure.
- **`StorageAdapter.snapshot()` / `restore()`** — first-class on the interface (types.ts:111-112) with `capabilities.snapshot` flag and `hasSnapshot()` typeguard. MarkdownAdapter implementation lives at `adapters/markdown/index.ts:506-518`. BeadsAdapter implementation lives in the sibling repo (consumed via `gsd-beads/testing` npm package); spike-findings confirm it's file-based via `bd export --json` + `bd init --from-jsonl`.
- **`StorageAdapter.withTransaction()`** — first-class on the interface (types.ts:113) with `capabilities.transaction` flag. Both adapters implement.
- **v1.0 conformance manifest pattern** (`tests/conformance/manifest.ts`) — 56 entries with `kind: 'binA'/'binB'/'known-gap'` + `adr:` field for divergences. Bidirectional meta-coverage gate at `meta-coverage.test.ts`.
- **`paired-outcome-{markdown,beads}.test.ts`** — existing pattern for outcome-shape assertions (`StateWriteOutcome` already returned at adapter layer). The model for D-13's per-adapter assertions in new `kind: 'seam-realness'` entries.
- **`createStorageAdapter(projectDir, config)`** — existing config-driven factory at `sdk/src/query/adapter-factory.ts`. Returns the configured adapter. This is the function that replaces every `adapterFor` callsite via the registry-injection layer.

### Established Patterns

- **Adapter-aware shared helpers stay adapter-first-arg** — `getMilestoneInfo(adapter, ...)`, `extractCurrentMilestone(adapter)`, `findPhase(adapter, ...)`, `planningBaseIsDir(adapter)` (helpers.ts:499). Phase 2 doesn't change these; new helpers in Phase 2 follow the same shape.
- **Per-projectDir adapter caching for transaction sharing** — today via `_adapterCache` Map in helpers.ts (Phase 5 Plan 05); after deletion, cache moves into the registry-build layer (D-08).
- **Strict-superset invariant testing** — under default config (no `storage.adapter`), CLI output is byte-identical to upstream. Phase 2 maintains this; the conformance suite's `kind: 'seam-realness'` entries assert it.
- **Bd singleton mirror discipline** — manual `bd update --description` mirroring of STATE.md/ROADMAP.md/REQUIREMENTS.md/DECISIONS.md updates is in force until SEAM-01..03 land. Meta-recursive: this phase is what unblocks dropping the mirror.
- **Per-phase staging branch + force-with-lease cutover** — Phase 1 D-04 pattern; reused for Phase 2 (D-19).

### Integration Points

- `sdk/src/query/registry.ts` — `QueryRegistry` class; `register(cmd, handler)`, `getHandler(cmd)`, `dispatch(...)`. Stays unchanged (D-06 ruled out Option D).
- `sdk/src/query/registry-assembly.ts` + `registry-assembly-descriptor.ts` — the assembly layer that wires handlers. New migrations of the closure-wrapper happen here in concert with handler-file changes.
- `sdk/src/query/pipeline.ts` (full file) — dry-run wrapper. Refactored per D-02. Removes the lazy `import('./helpers.js')` at line 118 and the underscore-method cast at line 125.
- `sdk/src/query/adapter-factory.ts` — `createStorageAdapter(projectDir, config)` is the seam's entry point; called from `createRegistry` to get the adapter that the closures inject into handlers.
- `sdk/src/query/utils.ts` — `QueryHandler` type. Stays unchanged externally; internal handler bodies use `(adapter, args, projectDir, ws)` shape via closure-wrapper.

### Files Touched (estimated, planning-time grep)

- 29 files in `sdk/src/query/` contain `adapterFor(projectDir)` callsites (133 calls total per researcher count; 101 per bd issue — the bd issue is older).
- 1 file deleted (`adapterFor` body removed; helpers.ts retains other utilities).
- ~3 conformance test files added/extended.
- 2 interface files updated (`adapters/types.ts` for `getTouchedPaths`; `adapters/markdown/index.ts` for impl + escape-hatch removal).
- 1 sibling-repo dep (`gsd-beads/testing`) — no version bump required for Phase 2 close (best-effort `getTouchedPaths` is implemented in this repo's BeadsAdapter consumer code, OR the npm package gets a version bump that ships the impl — planner decides).

</code_context>

<specifics>
## Specific Ideas

- The user pushed back on the conformance researcher's "dry-run not supported on bd" framing — correctly noted that `withTransaction` is first-class on the interface and bd supports rollback. The locked decision (Option B with snapshot/restore-based diff) was a direct consequence of that pushback. **Lesson for downstream agents:** when describing dry-run behavior, distinguish *transactional rollback* (works on both adapters, always) from *diff introspection* (works on both after Phase 2, with bd's diff being coarser-grained per D-04).
- The user accepted IMPLEMENT-ALONGSIDE for `StateWriteOutcome` propagation (researcher's more aggressive option) over DEFER-TO-PHASE-2.1 (researcher's recommendation). The trade-off is documented in D-15 + D-16 — atomic-commit separation and pre-flight audit are non-negotiable preconditions, not soft suggestions.
- The user said "do whatever fits" on handler signature shape. Locked Option A (closure-wrapper) for the reasons in DISCUSSION-LOG.md — no contradiction with that framing.
- The user's instinct from v1.0 — push back on "everything passed" claims and demand observable evidence — is what caught the silent-noop class. The conformance suite's per-adapter `StateWriteOutcome` assertions (D-13) are the structural answer: claims of success are typed values, not green-test-count handwave.

</specifics>

<deferred>
## Deferred Ideas

- **Bd-native diff primitive** — `bd export --json` + re-init is correct but expensive. A future optimization (sibling-repo or Phase 4+) could ship a bd-native `getTransactionDiff(snapshotId)` interface method that uses bd's own bookmark/store-clone primitives if those become available. Not blocking v1.1.
- **Workflow/skill-layer consumption of `StateWriteOutcome`** — Phase 2 propagates the outcome through SDK handlers; any callsite that wants to *act* on the outcome (e.g. surface "duplicate" to the user, retry on `nothing_to_remove`) is a separate refactor. Phase 2 keeps callers void-discarding (D-16); a future phase or bd issue picks up actual consumption.
- **`registeredTests` discovery automation in conformance** — researcher's hybrid option (manifest entries + `FAMILY_HANDLERS ⊆ manifest` subset check) was deferred. If Phase 3/4 adds more state-mutation handlers and silent-omission becomes a real risk, revisit.
- **Underscore-prefix audit across the codebase** — the `_txnContextForPipeline` / `_realReadForPipeline` underscore prefix was a "this is an interface violation" code smell. Phase 2 removes these specific instances; a broader audit for similar leaks elsewhere in the adapter codebase is deferred.

### Reviewed Todos (not folded)

- `cjs-sdk-golden-parity-failures.md` — 6 CJS-vs-SDK parity failures originally inherited from v1.0 Phase 3, folded into Phase 1's inherited-skip set, scoped to v1.0 Phase 8 / DIST-04. Not Phase 2 scope. Already on the Phase 1 allow-list; remains there for Phase 2.

</deferred>

---

*Phase: 02-make-the-seam-real*
*Context gathered: 2026-05-18*
