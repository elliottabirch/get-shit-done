---
phase: 05-foundational-primitive-lift
verified: 2026-05-11T09:32:00Z
status: passed
score: 5/5 success criteria + 9/9 requirements verified
retroactive: true
note: |
  Phase 5 shipped 2026-05-11 with UAT complete (7/7 tests pass, status: complete,
  [none yet] gaps). VERIFICATION.md was never produced during normal flow; this
  retroactive verification closes the loop. ROADMAP Phase 5 entry was flipped
  [ ]→[x] by the orchestrator before this run. Any findings here are advisory,
  not blocking.
overrides_applied: 0
---

# Phase 5: Foundational primitive lift — Verification Report

**Phase Goal:** The six foundational primitives are implemented and adopted, and the dry-run pipeline is hoisted off the filesystem so it works on any adapter — gating BeadsAdapter readiness per the SYNTHESIS §9 high-severity risk.

**Verified:** 2026-05-11T09:32:00Z
**Status:** passed (retroactive)
**Re-verification:** No — initial retroactive verification after ship

## Goal Achievement

### Success Criteria (from ROADMAP.md § Phase 5)

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | `gsd-sdk query --dry-run` against MarkdownAdapter + mid-transaction failure leaves `.planning/` byte-identical (dry-run hoisted off `cp -r` to `snapshot()/restore()` / `withTransaction`) — §9 HIGH gate | VERIFIED | `sdk/src/query/pipeline.test.ts:201` `SC#1: dry-run with mid-txn failure leaves .planning/ byte-identical` passes (ran live: 1 passed). `adapters/markdown/index.ts:522-561` implements shadow-dir journal `withTransaction({dryRun})`. `pipeline.ts:116-150` uses `ext.withTransaction(...,{dryRun:true})`; old `collectFiles/copyPlanningTree/readPlanningState` helpers are gone (grep = 0). |
| 2 | Three-author AI-SPEC concurrency: `updateSection` calls reordered/interleaved still produce a valid AI-SPEC.md (OQ-10 resolved by primitive design, not workflow lock-step) | VERIFIED | `tests/conformance/section-depth.test.ts:three-author concurrency: 3 reordered updateSection calls produce valid file (SC#2, PRIMITIVES-06, D-09)` passes (ran live: 1 passed). `adapters/markdown/index.ts:316-359` wraps `updateSection` in `this.withTransaction(async () => {...})`; D-10 reentrant guard at `acquireAdapterLock:567` prevents deadlock. |
| 3 | Every `.planning/` mutation using a kind-tagged getter/writer pair now routes through `putNamedDoc`/`getNamedDoc` with closed-enum categories — SDK-surface grep for old method names returns zero | VERIFIED | Full-surface grep `getResearch\|putIntelDoc\|putCodebaseDoc\|getArchivedMilestoneDoc` across `sdk/src` + `adapters` (excluding regression-test file) returns 0 matches. 8 SDK handlers migrated to `adapter.putNamedDoc/getNamedDoc` (`named-docs.ts`: 8 call-sites, `codebase-docs.ts`: 4). `tmp-docs.ts` kept on `putRecord` per documented D-12 exception (extension-free subdir-permissive paths). |
| 4 | UI-review screenshots + sketch assets write through `writeBinaryAsset(path, bytes)`; capabilities flag reports `binaryAsset: true`; `binaryAsset: false` triggers documented graceful degradation | VERIFIED | `adapters/markdown/index.ts:497-503` implements `writeBinaryAsset` via `fs.writeFile(Buffer.from(bytes))` routed through `resolveWrite`. Capability flag `binaryAsset: true` set at line 94 (`grep -cE "binaryAsset: true" = 1`). `tests/conformance/binary-asset.test.ts:46` exercises D-18 graceful degradation via `hasBinaryAsset(degraded)` guard-before-call with `binaryAsset: false`. No Phase-5 workflow consumes binaryAsset per D-17 — primitive + capability shipped only (consumers land in separate phases). |
| 5 | OQ-02, OQ-05, OQ-07, OQ-10 resolved in DECISIONS.md with section/sidecar/scratch/concurrency resolutions | VERIFIED | `.planning/DECISIONS.md` contains 5 ADRs at `D-2026-05-10-03` through `D-2026-05-10-07` (grep = 5). Mapping: 03 = OQ-02 section atomicity (L2/L3/L4), 04 = OQ-05 sidecar SDK-typed verbs, 05 = OQ-07 scratch first-class verbs, 06 = OQ-10 internally-wrapped updateSection, 07 = shadow-dir journal upgrade (bonus documentation ADR). Each has Trigger/Decision/Alternatives/Evidence/Implication. |

**Score:** 5/5 Success Criteria verified

### Requirements Coverage (PRIMITIVES-01..09)

| REQ-ID | Description | Source Plan(s) | Status | Evidence |
|--------|-------------|----------------|--------|----------|
| PRIMITIVES-01 | `updateSection(file, section, body, mode)` — L2/L3/L4 depth | 05-02 | SATISFIED | `replaceSection` + `parseAnchor` in `adapters/markdown/index.ts:1316-1470`; terminates at same-or-shallower heading. `section-depth.test.ts` has 9 live tests covering L2/L3/L4/fence/comment/setext/first-match. |
| PRIMITIVES-02 | `getSection(file, anchor)` | 05-02 | SATISFIED | `extractSection` heading-depth walker in same file; class method `getSection` unchanged delegates. Live tests in `section-depth.test.ts`. |
| PRIMITIVES-03 | `snapshot()/restore()` or `withTransaction(fn)` — dry-run hoist off `cp -r` | 05-03, 05-05 | SATISFIED | `snapshot()` / `restore(id)` real bodies at `adapters/markdown/index.ts:506-520`; `withTransaction` shadow-dir journal at line 522. `pipeline.ts` dry-run branch at line 116 routes via adapter. SC#1 byte-identity test passes. |
| PRIMITIVES-04 | `putNamedDoc(category, key, body)` / `getNamedDoc(category, key)` replace kind-tagged pairs | 05-01, 05-04, 05-06 | SATISFIED | Typed union `NamedDocCategory` (8 members) + `RootNamedDocKey` (3 keys) at `adapters/types.ts:15-26`. Discriminated overloads at types.ts:107-112 with optional `opts.workstream`. Real bodies at `index.ts:1280-1301`. 8 SDK handlers migrated. `named-doc.test.ts` has 9 live tests including D-15 grep-zero regression guard. |
| PRIMITIVES-05 | `writeBinaryAsset(path, bytes)` in MarkdownAdapter | 05-04 | SATISFIED | Real body at `index.ts:497-503`; `capabilities.binaryAsset: true`; `binary-asset.test.ts` 4 live tests including byte-verbatim write + graceful-degradation. |
| PRIMITIVES-06 | Section-scoped writes atomic across writers (AI-SPEC three-author, resolves OQ-10) | 05-03, 05-07 | SATISFIED | D-09 internal `withTransaction` wrap in `updateSection` (index.ts:322). D-10 reentrant-lock guard at `acquireAdapterLock:567`. Three-author live test in `section-depth.test.ts` passes. ADR D-2026-05-10-06 documents. |
| PRIMITIVES-07 | ROADMAP/STATE/PROJECT section atomicity (resolves OQ-02) | 05-02, 05-07 | SATISFIED | D-06 depth-walker shipped (L2/L3/L4). ADR D-2026-05-10-03 records "section is unit of write atomicity". |
| PRIMITIVES-08 | Sidecar paths as named methods (resolves OQ-05) | 05-05, 05-06, 05-07 | SATISFIED | `sdk/src/query/sidecar.ts` exports `nextCallCountGet`/`nextCallCountIncr` + 2 registry handlers. 2 SDK verbs registered in `index.ts:762-763`. `route-next-action.ts:44` migrated (D-21). ADR D-2026-05-10-04 records SDK-typed verbs. |
| PRIMITIVES-09 | Scratch artifacts as first-class types (resolves OQ-07) | 05-05, 05-07 | SATISFIED | `sdk/src/query/scratch.ts` exports all 6 handlers (checkpoint/questions × put/get/delete). 6 SDK verbs registered in `index.ts:765-770`. ADR D-2026-05-10-05 records first-class SDK verbs at phase-scoped paths. |

**Score:** 9/9 requirements satisfied. No orphaned requirements (REQUIREMENTS.md traceability table maps all PRIMITIVES-01..09 to Phase 5; all present in at least one plan's `requirements:` frontmatter).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `adapters/types.ts` | NamedDocCategory union, RootNamedDocKey union, discriminated overloads, capability flags | VERIFIED | `NamedDocCategory` (8 members) + `RootNamedDocKey` (3 keys) exported; 4 overload signatures with `opts?.workstream`; `hasBinaryAsset`/`hasSnapshot`/`hasNamedDoc` type guards present. |
| `adapters/markdown/index.ts` | TxnCtx, activeTxn, shadow-dir resolvers, commitShadowDir, reentrant lock, real snapshot/restore, real put/getNamedDoc, real writeBinaryAsset, capabilities flipped, updateSection wrapped, commitPlanningState dryRun guard, _txnContextForPipeline, _realReadForPipeline | VERIFIED | All present at expected line ranges. 0 `UnsupportedCapabilityError` stubs for phase-5 primitives. All 4 capability flags (`transaction`, `snapshot`, `namedDoc`, `binaryAsset`) = true. |
| `sdk/src/query/pipeline.ts` | dry-run via `withTransaction({dryRun:true})`; obsolete helpers removed | VERIFIED | `collectFiles`/`copyPlanningTree`/`readPlanningState` count = 0. `diffPlanningState` retained. Uses `ext.withTransaction(...,{dryRun:true})` + `_txnContextForPipeline` + `_realReadForPipeline` escape hatches. |
| `sdk/src/query/sidecar.ts` | `nextCallCountGet`, `nextCallCountIncr` + 2 registry handlers | VERIFIED | All 4 exports present; path literal `NEXT_CALL_COUNT = '.next-call-count'` centralized. |
| `sdk/src/query/scratch.ts` | 6 handlers (discuss.checkpoint.{put,get,delete} + discuss.questions.{put,get,delete}) + validators | VERIFIED | All 6 exports present; `validatePhaseDir`/`validatePhaseNum` guards defined. |
| `sdk/src/query/index.ts` | 8 registry.register lines for new SDK verbs | VERIFIED | 2 `next-call-count.*` + 6 `discuss.*` registrations at lines 762-770. |
| `sdk/src/query/named-docs.ts` | 5 handlers delegate to putNamedDoc/getNamedDoc | VERIFIED | `adapter.putNamedDoc` calls = 4, `adapter.getNamedDoc` calls = 4. `namedDocDisplayPath` helper present. `decisionsIndexGet` fallback-to-DECISIONS.md preserved. |
| `sdk/src/query/codebase-docs.ts` | codebasePut/Get delegate; codebaseList unchanged | VERIFIED | 4 `adapter.(put/get)NamedDoc` calls; `adapter.listCollection` call preserved for codebaseList. |
| `sdk/src/query/tmp-docs.ts` | D-12 exception documented; tmpPut/tmpGet kept on putRecord | VERIFIED | 0 `putNamedDoc` calls (documented exception). Inline comment present. |
| `sdk/src/query/route-next-action.ts` | migrated to nextCallCountGet from sidecar.ts | VERIFIED | 2 `nextCallCountGet` references (import + call); 0 raw `adapter.getRecord` on `.next-call-count`. |
| `tests/conformance/section-depth.test.ts` | 9 live tests (L2/L3/L4 + fence/comment/setext + first-match + three-author) | VERIFIED | 9 `it()` (no `it.todo`); three-author test passes. |
| `tests/conformance/named-doc.test.ts` | 9 live tests (8-category round-trip + root literals + workstream + capability + D-15 grep-zero + @ts-expect-error) | VERIFIED | 9 `it()`; D-15 regression guard invoking `execFileSync('grep', ...)` present. |
| `tests/conformance/binary-asset.test.ts` | 4 live tests (byte-verbatim + capability + intermediate dirs + D-18 graceful degradation) | VERIFIED | 4 `it()`; graceful-degradation guard-before-call pattern at line 46. |
| `tests/conformance/write-transaction.test.ts` | 12 tests covering dryRun/rollback/reentrancy/snapshot/concurrency | VERIFIED | 12 `it()` live tests including `mid-txn failure` byte-identity (+ `hashDir` helper), `reentrant`, `snapshot()/restore(id)`, `updateSection concurrency`. |
| `sdk/src/query/sidecar.test.ts` | 4+ live tests | VERIFIED | 4 `it()`. |
| `sdk/src/query/scratch.test.ts` | 6+ live tests including path-traversal guard | VERIFIED | 6 `it()` including `rejects phaseDir with ".."` guard. |
| `.planning/DECISIONS.md` | 5 new ADRs for OQ-02/05/07/10 + shadow-dir journal | VERIFIED | 5 ADRs present at D-2026-05-10-03..07 (renumbered from plan-drafted D-2026-05-01..05 due to ID collision; documented in 05-07-SUMMARY.md). |
| `.gitignore` | entries for `.tmp-txn-*` and `.tmp-snap-*` | VERIFIED | 2 matching entries (one per prefix). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `updateSection` class method | `withTransaction` internal wrap | `await this.withTransaction(async () => {...})` | WIRED | index.ts:322 |
| Every mutating Bin A | shadow-dir via `resolveWrite` | `this.resolveWrite(path)` in put/remove paths | WIRED | index.ts:166 (helper) + used in `putRecord` (202), `writeBinaryAsset` (500) |
| Every reading Bin A | shadow-over-real via `resolveRead` | `await this.resolveRead(path)` | WIRED | index.ts:176 (helper) + used in `getRecord` (192), `exists` (286), `stat` (292) |
| `commitPlanningState` | dryRun guard | `if (this.activeTxn?.dryRun) return;` | WIRED | index.ts:475 |
| `acquireAdapterLock` | reentrant guard | `if (this.activeTxn) return;` | WIRED | index.ts:567 |
| `pipeline.ts` dry-run branch | `ext.withTransaction(fn,{dryRun:true})` | cast to MarkdownAdapter-shaped type + `_txnContextForPipeline`/`_realReadForPipeline` escape hatches | WIRED | pipeline.ts:116-150 |
| `route-next-action.ts` readConsecutiveCallCount | `nextCallCountGet(adapter, ws)` | `import { nextCallCountGet } from './sidecar.js'` | WIRED | 2 references; 0 raw `.next-call-count` paths |
| `named-docs.ts` 5 handlers | `adapter.(put/get)NamedDoc(category, key, body, {workstream})` | direct call | WIRED | 8 call-sites total across put + get |
| `codebase-docs.ts` codebasePut/Get | `adapter.(put/get)NamedDoc('codebase', name, ...)` | direct call | WIRED | 4 call-sites |
| `index.ts` registry | 8 new SDK verbs | `registry.register('next-call-count.*' | 'discuss.*.*', ...)` | WIRED | 8 registrations at lines 762-770 |

### Data-Flow Trace (Level 4)

Phase 5 ships primitive implementations + test harness — no dynamic UI surface to trace. Test-layer verification (below) exercises real data flow.

### Behavioral Spot-Checks

| # | Check | Command | Result | Status |
|---|-------|---------|--------|--------|
| 1 | SC#1 pipeline byte-identity | `cd sdk && npx vitest run src/query/pipeline.test.ts -t "mid-txn failure"` | `1 passed \| 11 skipped` | PASS |
| 2 | SC#2 three-author concurrency | `npm run test:conformance -- -t "three-author"` | `1 passed \| 146 skipped` | PASS |
| 3 | D-21 grep-zero (raw `.next-call-count`) | `grep -rnE "adapter\.getRecord.*'\.next-call-count'" sdk/src` (excluding sidecar.ts) | empty | PASS |
| 4 | D-15 grep-zero (legacy kind-tagged names) | `grep -rnE 'getResearch\|putIntelDoc\|putCodebaseDoc\|getArchivedMilestoneDoc' sdk/src adapters` (excluding named-doc.test.ts) | empty | PASS |
| 5 | Capability flags all true | `grep -cE 'binaryAsset: true\|namedDoc: true\|snapshot: true\|transaction: true' adapters/markdown/index.ts` | 4 | PASS |
| 6 | Phase-5 ADRs present | `grep -cE '^## D-2026-05-10-0[3-7]' .planning/DECISIONS.md` | 5 | PASS |
| 7 | No UnsupportedCapabilityError stubs for Phase-5 primitives | `grep -cE "UnsupportedCapabilityError\('(binaryAsset\|snapshot\|namedDoc)'" adapters/markdown/index.ts` | 0 | PASS |
| 8 | Obsolete pipeline helpers removed | `grep -cE '^function collectFiles\|^async function copyPlanningTree\|^async function readPlanningState' sdk/src/query/pipeline.ts` | 0 | PASS |
| 9 | .gitignore shadow-dir entries | `grep -cE '\.planning/\.tmp-txn-\*\|\.planning/\.tmp-snap-\*' .gitignore` | 2 | PASS |
| 10 | SDK unit suite | `cd sdk && npx vitest run --project unit` | `1567 passed (1567)` | PASS |
| 11 | Conformance suite (Phase-5 subset) | `npm run test:conformance` (all test files except init-bundlers) | 141 passed / 0 failed / 4 skipped / 1 todo in 12 files; 1 failed in init-bundlers (see anti-patterns) | PASS-with-note |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `tests/conformance/init-bundlers.test.ts > init-todos.before.json` byte-identity baseline | Baseline drift: live `.planning/todos/pending/cjs-sdk-golden-parity-failures.md` causes the init-todos bundler to return a non-empty `todos` array while the baseline snapshot expects empty. | Info | Pre-existing, NOT a Phase-5 regression. The todo file was committed on 2026-05-10 (commit `56208a04`, "after Phase 3 gap closure") before Phase 5 planning began. UAT recorded `113 passed \| 0 failed \| 4 skipped \| 1 todo` — the UAT capture was against a cleaner tree (or different baseline state). Not blocking Phase 5 goal. |
| SDK integration suite (`golden.integration.test.ts`, `read-only-parity.integration.test.ts`, `lifecycle-e2e.integration.test.ts`) | 7 test failures in CJS-vs-SDK parity / lifecycle-e2e | Info | These are the CJS golden-parity failures captured in the tracked todo `cjs-sdk-golden-parity-failures.md` (Phase 3 gap-closure era). UAT ran with `--project unit` (1567 passed) which matches the UAT's recorded "1567 passed" and explicitly excludes these integration tests. Not a Phase-5-introduced regression. Listed in `.planning/todos/pending/`. |
| `.planning/phases/05-foundational-primitive-lift/05-07-SUMMARY.md` | ADR ID renumbering from plan-drafted D-2026-05-01..05 to D-2026-05-10-03..07 | Info | Planner drafted ADR IDs that collided with existing Phase 2/3/4 entries. Resolution: extend the existing D-2026-05-10-NN sequence. Content and acceptance semantics preserved. User approved mid-session. |

### Human Verification Required

None. UAT was run by the user on 2026-05-11 (7/7 tests pass) and approval was recorded. All behavioral spot-checks passed programmatically in this verification run. No visual, real-time, or external-service behaviors in scope.

### Gaps Summary

No gaps blocking goal achievement. All 5 Success Criteria verified with live test evidence; all 9 PRIMITIVES requirements satisfied; all key links wired; all 5 open questions (OQ-02/05/07/10 + bonus OQ-01 follow-up shadow-dir ADR) resolved in DECISIONS.md.

**Advisory notes (retroactive — not blocking):**

1. **init-bundlers baseline drift** — `init-todos.before.json` byte-identity test fails because live `.planning/todos/pending/cjs-sdk-golden-parity-failures.md` exists in the tree that the baseline doesn't capture. Consider regenerating the baseline post-Phase-5, or sanitizing the `todos` array in the test's path-sanitization logic. Rationale for not blocking: pre-existing (todo committed before Phase 5), orthogonal concern (CJS-parity work), and the init-bundlers structural tests all pass (the byte-identity skip note in the baseline already acknowledges this pattern).

2. **SDK `npm test` vs `npm run test:unit` discrepancy vs UAT** — The UAT recorded `1567 passed \| 0 failed \| 0 skipped` under `cd sdk && npm test`. Live re-execution of `cd sdk && npm test` (which runs `vitest run` without `--project` filter) shows 1656 passed / 7 failed / 4 skipped — the 7 failures are in the `golden/` integration suite. Running `cd sdk && npx vitest run --project unit` (the UAT's apparent actual scope) matches the UAT's recorded counts. No Phase-5 test regressed. Consider either (a) updating the UAT note to specify `--project unit`, or (b) migrating or fixing the 7 golden-parity tests in a CJS-parity cleanup (tracked in `cjs-sdk-golden-parity-failures.md`).

3. **ADR ID renumbering note** — The 05-07-SUMMARY.md already documents the D-2026-05-01..05 → D-2026-05-10-03..07 renumber due to ID collision. No action needed; advisory for future planners to check DECISIONS.md before drafting ADR IDs.

---

*Retroactive verification — Phase 5 was marked complete in ROADMAP on 2026-05-11 after UAT. This report formalizes the goal-backward evidence trail.*

*Verified: 2026-05-11T09:32:00Z*
*Verifier: Claude (gsd-verifier)*
