---
phase: 02-wire-core-read-methods-to-adapter
verified: 2026-05-01T05:55:00Z
status: gaps_found
score: 2/4 success-criteria fully verified (SC#2 + SC#3 PASS; SC#1 + SC#4 FAIL)
overrides_applied: 0
re_verification: false
gaps:
  - truth: "SC#1 — every SDK read query flows through the adapter"
    status: failed
    reason: "Two ROADMAP-named handlers (`stateJson` in state.ts and `phasesList` in phase-lifecycle.ts) plus their sibling read-only handlers (`stateGet`, `stateSnapshot`, `phaseNextDecimal`) still use raw `node:fs/promises` (`readFile`, `readdir`) for `.planning/` reads. The path-scoped leak-grep returns 0 matches against the migrated set (18 files) but flags 48 matches in phase-lifecycle.ts and 8 in state.ts. The phase explicitly enumerated ~15 SDK read-handler files and decided to defer phase-lifecycle.ts to Phase 3 even though it contains pure read handlers (`phasesList`, `phaseNextDecimal`) that ROADMAP SC#1 explicitly names. state.ts's `stateJson`/`stateGet`/`stateSnapshot` were not migrated nor wired adapter-aware in createRegistry (lines 306-307, 337 of index.ts register them with no adapter closure)."
    artifacts:
      - path: "sdk/src/query/state.ts"
        issue: "stateJson (line 238), stateGet (line 282), stateSnapshot (line 334), buildStateFrontmatter (line ~42) read STATE.md / ROADMAP.md / phases/ via raw `await readFile(...)` and `await readdir(...)`. Leak-grep emits 8 matches. ROADMAP SC#1 explicitly names `stateJson` as a SDK read query that 'must go through adapter'."
      - path: "sdk/src/query/phase-lifecycle.ts"
        issue: "phasesList (line 1548) and phaseNextDecimal (line 1612) are pure read handlers that read planning paths via `existsSync` + `await readdir` + `await readFile`. Leak-grep emits 48 matches. ROADMAP SC#1 explicitly names `phasesList` as a SDK read query that 'must go through adapter'."
      - path: "sdk/src/query/index.ts"
        issue: "Lines 306-307 register `state.json` → `stateJson` and `state.get` → `stateGet` without an adapter-binding closure. Line 337 registers `state-snapshot` → `stateSnapshot` directly. Phase-lifecycle handlers like `phasesList` / `phaseNextDecimal` are also registered without adapter closures."
    missing:
      - "Migrate `stateJson`, `stateGet`, `stateSnapshot`, and `buildStateFrontmatter` in `sdk/src/query/state.ts` to take adapter as first arg and use `adapter.getRecord` / `adapter.listCollection`."
      - "Migrate read-only `phasesList` and `phaseNextDecimal` in `sdk/src/query/phase-lifecycle.ts` per D-14 read-only discipline (or split out to a phase-list-queries.ts that's adapter-aware)."
      - "Wire `state.json`, `state.get`, `state-snapshot`, `phases.list`, `phase.next-decimal` registrations through createRegistry's closure pattern so they receive the closure-captured adapter."
      - "Re-run leak-grep across `sdk/src/query/state.ts` and `sdk/src/query/phase-lifecycle.ts`'s read paths and confirm zero matches in the migrated handlers."
  - truth: "SC#4 — fork test bar held; no NEW failures attributable to Phase 2"
    status: failed
    reason: "Pre-Phase-2 baseline (commit 66d4961c) had 1 vitest failure (validate.health). Post-Phase-2 HEAD has 11 vitest failures — a net regression of 10 tests. Plan 02-04 SUMMARY claimed the 11 failures were 'pre-existing per Plan 1 SUMMARY's Unfixed (deferred to follow-ups)' but Plan 1 SUMMARY itself claimed '1357/1357 tests pass' and the empirical pre-Phase-2 baseline confirms only 1 failure existed. Most new failures are caused by test files calling `new GSDTools({...})` without an adapter parameter — same pattern Plan 02-01 caught and fixed in `ws-flag.test.ts` was MISSED in `phase-runner.integration.test.ts`. Two golden-parity tests fail because Phase 2's closure-captured adapter pattern doesn't support the testing pattern of dispatching to a different `projectDir` than the registry's adapter root (a test like `roadmap.get-phase` against a fresh fixture dir is now broken)."
    artifacts:
      - path: "sdk/src/phase-runner.integration.test.ts"
        issue: "Line 75-79: `new GSDTools({projectDir, gsdToolsPath, timeoutMs})` — no adapter passed. Phase 2's migration of `findPhase`/`phasePlanIndex` to use `adapter.listCollection` causes runtime TypeError 'Cannot read properties of undefined (reading listCollection)'. 7 tests fail with this error: initPhaseOp ×2, PhaseRunner ×2, phasePlanIndex ×3."
      - path: "sdk/src/init-e2e.integration.test.ts"
        issue: "InitRunner test fails because it cascades from the same GSDTools-without-adapter pattern (or related construction). 1 test fail."
      - path: "sdk/src/golden/golden.integration.test.ts"
        issue: "Line 211: `roadmap.get-phase` test dispatches against a temp fixture dir (`sdkDir`) but `makeRegistry(REPO_ROOT)` builds the adapter rooted at REPO_ROOT. The closure-captured adapter reads from REPO_ROOT, returning `found:false` for phase 10. New regression vs baseline."
      - path: "sdk/src/golden/read-only-parity.integration.test.ts"
        issue: "Line 94: `state.load` golden parity fails because Plan 02-01 added `project_exists: true` to state.load output, deviating from CJS shape. Pre-existing per Plan 02-03 SUMMARY's 'Pre-existing issues observed' but the failure lists do not match — pre-Phase-2 baseline had 0 instances of this failure."
    missing:
      - "Add adapter parameter to all `new GSDTools({...})` constructions in test files (especially `phase-runner.integration.test.ts` lines 75-79 and 313-318)."
      - "Decide on architectural fix for the test pattern of dispatching to a different projectDir than the registry's adapter root: either (a) re-construct adapter per-dispatch, (b) thread projectDir-aware adapter rebinding, or (c) accept that the test must construct registry per-projectDir."
      - "Audit ALL test files that construct `GSDTools` or `createRegistry` and verify they pass adapter; this is the same Rule 1 fix applied in Plan 02-01 for ws-flag.test.ts and route-next-action.test.ts but missed for the integration suite."
      - "Either fix or document the `state.load project_exists` deviation: Plan 02-01 added it as 'forward-compatible' but the read-only-parity test still asserts byte-equal-to-CJS shape."

human_verification: []
---

# Phase 2: Wire core read methods to adapter — Verification Report

**Phase Goal:** Every SDK read query — including the ~13 workflow init bundlers and every skill frontmatter `@.planning/...` reference — flows through the adapter, not direct `node:fs`.

**Verified:** 2026-05-01T05:55:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (per Phase 2 Success Criteria)

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| SC#1 | SDK read-surface clean: every read goes through `adapter.*`, including `progressJson`, `roadmapAnalyze`, `stateJson`, `findPhase`, `phasesList`, `phasePlanIndex`, `summaryExtract`, ~40 sibling queries | ✗ FAILED | `stateJson`/`stateGet`/`stateSnapshot` in state.ts and `phasesList`/`phaseNextDecimal` in phase-lifecycle.ts use raw fs. State.ts has 8 leak-grep hits, phase-lifecycle.ts has 48. Index.ts wires them without adapter closures. |
| SC#2 | 16 init bundlers preserve coarse external JSON shape (byte-identical to pre-Plan-1 baselines); internals compose adapter primitives via SDK-side helpers | ✓ VERIFIED | `tests/conformance/init-bundlers.test.ts` — 13/17 pass byte-identical (4 skipped per documented disk-state drift; meets "≥11 of 13" plan acceptance floor). 17 explicit `registry.register('init.X', ...)` closure wrappers in index.ts. init.ts and init-complex.ts have 0 leak-grep matches. Pre-Plan-1 baselines captured at commit `ba17b33b` BEFORE any other Plan 1 mutation (verified via `git show ba17b33b --stat`). |
| SC#3 | `<context>`-block audit register exhaustive: every `@.planning/...` ref classified into 3-bucket disposition (REWRITE-CANDIDATE / INTERCEPT-CANDIDATE / EXCEPTION); no orphan refs | ✓ VERIFIED | `.planning/leaks/context-block-register.md` has 30 rows + bucket counts header (5 REWRITE-CANDIDATE / 0 INTERCEPT-CANDIDATE / 25 EXCEPTION). `node scripts/audit-context-blocks.cjs --check` exits 0 and matches the registered count. Every row has a disposition + rationale. SCAN_DIRS = `commands, agents, get-shit-done, docs` — no `tests/` rows (MED-4 single-deterministic-outcome). 7 vitest assertions pass (`tests/leak-grep/context-block-register.test.ts`). |
| SC#4 | Fork test suite passes with MarkdownAdapter mounted; no NEW failures attributable to Phase 2 commits (pre-existing baseline OK) | ✗ FAILED | Pre-Phase-2 baseline (66d4961c): 1 failure (validate.health). HEAD: 11 failures. **Net regression: 10 new failures.** New failures are: 7 phase-runner integration tests (TypeError 'Cannot read properties of undefined (reading listCollection)'), 1 init-e2e test, 1 roadmap.get-phase golden parity, 1 read-only-parity state.load. Root cause: GSDTools constructions without `adapter` parameter (phase-runner.integration.test.ts lines 75, 313) plus closure-captured adapter rooted at wrong projectDir for golden tests. |

**Score:** 2/4 truths verified.

### Required Artifacts (Bin A contract + tooling + audit deliverable)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `adapters/types.ts` | `stat()` declared as required Bin A primitive | ✓ VERIFIED | Line 38: `stat(path: string): Promise<{ kind: 'file' \| 'dir'; mtime?: string } \| null>;` (not capability-gated) |
| `adapters/markdown/index.ts` | `MarkdownAdapter.stat()` implementation | ✓ VERIFIED | Line 172 implements `async stat(...)`; line 23 imports `stat as fsStat from 'node:fs/promises'` |
| `tests/conformance/stat.test.ts` | stat conformance test exists and passes | ✓ VERIFIED | 5/5 tests pass (mounting `runAdapterConformanceSuite` with MarkdownAdapter) |
| `.planning/DECISIONS.md` ADRs | D-2026-05-01 (stat addition), D-2026-05-01-OQ04 (audit), D-2026-05-01-OQ09 (init bundlers) | ✓ VERIFIED | All 3 ADR headers grep-confirmed |
| `scripts/leak-grep.cjs` | Extended with SDK_FS_READ_PATTERNS + Stage-2 PLANNING_SCOPE_RE | ✓ VERIFIED | 9 patterns at lines 59-69; PLANNING_SCOPE_RE at line 72; module.exports at 234-242; main() gated on `require.main === module` |
| `scripts/audit-context-blocks.cjs` | Plan 5 audit engine, --check flag, reuses leak-grep regexes | ✓ VERIFIED | Script exists; `--check` exits 0; reuses CONTEXT_BLOCK_RE / CONTEXT_PATH_RE from leak-grep.cjs's module.exports |
| `.planning/leaks/context-block-register.md` | 30+ rows, each with disposition + rationale | ✓ VERIFIED | 30 rows; 5 REWRITE-CANDIDATE / 0 INTERCEPT-CANDIDATE / 25 EXCEPTION |
| `.planning/leaks/context-block-register.json` | Machine-readable sidecar | ✓ VERIFIED | Exists; 30 records |
| `sdk/src/query/bootstrap.ts` | findProjectRoot bootstrap exception (raw-fs allowed) | ✓ VERIFIED | Created in commit `5e150168`; documented top-of-file as carve-out per D-15 |
| `sdk/src/query/helpers.ts` | adapter-aware helpers (planningRelativePath etc.); fs-import-clean | ✓ VERIFIED | leak-grep returns 0 matches; planningRelativePath + planningBaseIsDir + adapterFor (transitional) exported |
| `sdk/src/query/index.ts` | createRegistry threads adapter through closure wrappers | ✓ VERIFIED | 17+ explicit closures for init.*, plus closures for state.load, route-next-action, find-phase, phase-plan-index, roadmap.analyze, roadmap.get-phase, progress, audit-open, etc. |

### Key Link Verification (closure wiring)

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| createRegistry({adapter}) | findPhase | closure wrapper at index.ts:339 | ✓ WIRED | `(args, projectDir, ws) => findPhase(adapter, args, projectDir, ws)` |
| createRegistry({adapter}) | roadmap.analyze / roadmap.get-phase | closure wrapper at index.ts:353-354 | ✓ WIRED | adapter threaded into both |
| createRegistry({adapter}) | progress / progress.json | closure wrapper at index.ts:369-373 | ✓ WIRED | adapter threaded |
| createRegistry({adapter}) | state.load | closure wrapper at index.ts:305 | ✓ WIRED | adapter threaded |
| createRegistry({adapter}) | state.json / state.get / state-snapshot | direct register, NO closure | ✗ NOT_WIRED | Lines 306-307, 337 register handlers without binding adapter — these handlers run with `adapter=undefined` from their own scope |
| createRegistry({adapter}) | phases.list / phase-next-decimal | direct register, NO closure | ✗ NOT_WIRED | Wired through STATE_COMMAND_ALIASES loop with no adapter binding |
| createRegistry({adapter}) | init.* (17 bundlers) | explicit closures at index.ts:535-588 | ✓ WIRED | 17 explicit `registry.register('init.X', ...)` closures |
| createRegistry({adapter}) | summary.extract / history-digest / audit.uat / uat.render-checkpoint | closure wrappers (Plan 02-03) | ✓ WIRED | Plan 03 added 14 closures |
| createRegistry({adapter}) | intel.diff / intel.snapshot / intel.validate / intel.status / intel.query / intel.extract-exports / intel.patch-meta / intel.update | closure wrappers (Plan 02-03) | ✓ WIRED | 10 closures threaded |
| createRegistry({adapter}) | docs.init / docs-init | closure wrappers (Plan 02-03) | ✓ WIRED | 2 closures threaded |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `findPhase` (phase.ts) | phase entries | `await adapter.listCollection('phases/')` | yes — MarkdownAdapter wraps fs internally | ✓ FLOWING |
| `init.execute-phase` bundler | STATE/ROADMAP/config existence | `await adapter.exists(...)` | yes | ✓ FLOWING |
| `intelStatus` mtime | `(await adapter.stat(rel))?.mtime` | adapter.stat returns ISO string from fs.statSync | yes | ✓ FLOWING |
| `stateJson` (state.ts:238) | STATE.md content | `await readFile(statePath, 'utf-8')` | yes (raw-fs, NOT adapter) | ⚠️ DISCONNECTED from adapter — bypasses goal |
| `phasesList` (phase-lifecycle.ts:1548) | phases dir entries | `await readdir(phasesDir, ...)` | yes (raw-fs, NOT adapter) | ⚠️ DISCONNECTED from adapter — bypasses goal |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Migrated SDK read-handler files have zero leak-grep matches | `node scripts/leak-grep.cjs sdk/src/query/{phase,roadmap,progress,audit-open,phase-ready,verify,check-verification-status,detect-phase-type,summary,uat,intel,docs-init,skill-manifest,init,init-complex,route-next-action,state-project-load,helpers}.ts` | `leak-grep: 0 match(es) across 18 file(s)`, exit 0 | ✓ PASS |
| Conformance tests pass | `vitest run --config vitest.conformance.config.ts` | 6 files / 61 passed / 4 skipped | ✓ PASS |
| Init-bundlers byte-identical | `vitest run --config vitest.conformance.config.ts tests/conformance/init-bundlers.test.ts` | 17 tests / 13 passed / 4 skipped | ✓ PASS |
| Audit script `--check` exits 0 | `node scripts/audit-context-blocks.cjs --check` | EXIT=0 | ✓ PASS |
| Repo-wide leak-grep shows expected residual | `node scripts/leak-grep.cjs sdk/src/query/` | 125 matches across 18 files (most in Phase 3 territory; **but state.ts and phase-lifecycle.ts contain SC#1-named handlers**) | ✗ FAIL (SC#1 enumerated handlers leak) |
| SDK test suite no regression | `cd sdk && npm test` | 4 files failed / 78 passed; 11 tests failed / 1446 passed | ✗ FAIL (10 net new failures vs pre-Phase-2 baseline) |
| Pre-Phase-2 baseline | `cd sdk && npm test` at commit 66d4961c | 1 file failed / 81 passed; 1 test failed / 1456 passed (validate.health only) | ✓ baseline established |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| READS-01 | 02-01, 02-02, 02-03 | All ~40 SDK read queries call `adapter.*` instead of `node:fs` | ⚠️ PARTIAL | Migration covers ~14 SDK read-handler files (phase, roadmap, progress, audit-open, phase-ready, verify, check-verification-status, detect-phase-type, summary, uat, intel, docs-init, skill-manifest verified C2, route-next-action, state-project-load); helpers and ~50 read sites adapter-routed. **Gap:** state.ts (`stateJson`, `stateGet`, `stateSnapshot`, `buildStateFrontmatter`) and phase-lifecycle.ts (`phasesList`, `phaseNextDecimal`) — both ROADMAP SC#1-enumerated — are still on raw fs. Per CONTEXT.md the latter was deferred ("Phase 2 does NOT: Migrate write paths") but `phasesList`/`stateJson` are pure reads, not writes — the deferral conflicts with SC#1's explicit enumeration. |
| READS-02 | 02-04 | ~13 init bundlers compose adapter primitives (resolves OQ-9) | ✓ SATISFIED | 17 init bundlers (14 in init.ts + 3 in init-complex.ts) all adapter-routed; OQ-09 ADR D-2026-05-01-OQ09 appended; 13/17 byte-identical assertions pass with documented drift on 4. |
| READS-03 | 02-05 | Skill frontmatter `<context>`-block `@.planning/...` references audited; each leak rewritten/intercepted/documented | ✓ SATISFIED | `.planning/leaks/context-block-register.md` + `.json` exist; 30 refs classified across REWRITE-CANDIDATE (5) / EXCEPTION (25); audit script idempotent; 7 vitest tests pass. OQ-04 partial-resolution ADR appended. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `sdk/src/query/state.ts` | 23 | `import { readFile, readdir } from 'node:fs/promises'` | 🛑 Blocker | `stateJson`, `stateGet`, `stateSnapshot` (SC#1-enumerated) read STATE.md/ROADMAP.md/phases via raw fs; `index.ts:306-307` register them without adapter binding |
| `sdk/src/query/state.ts` | 243, 287, 339 | `await readFile(statePath, 'utf-8')` | 🛑 Blocker | Each call site bypasses adapter |
| `sdk/src/query/phase-lifecycle.ts` | 1548-1697 | `existsSync` / `await readdir` / `await readFile` in `phasesList`, `phaseNextDecimal`, `phasesClear` | 🛑 Blocker | `phasesList` is SC#1-enumerated; pure read handler not migrated |
| `sdk/src/phase-runner.integration.test.ts` | 75, 313 | `new GSDTools({projectDir, gsdToolsPath, timeoutMs})` — **no adapter passed** | 🛑 Blocker | Causes runtime TypeError when migrated `findPhase`/`phasePlanIndex` try to call `adapter.listCollection` on `undefined`. Same Rule-1 pattern Plan 02-01 fixed in `ws-flag.test.ts` was missed here. |
| `sdk/src/query/intel.ts` | 232 | `if (!existsSync(dirAbs)) mkdirSync(dirAbs, { recursive: true })` | ℹ️ Info | D-14 deferred to Phase 3 (write-side); annotated correctly with `Phase 2 D-14` markers. Acceptable per phase scope. |
| `sdk/src/query/progress.ts` | 440-624 | `readdirSync` / `readFileSync` / `existsSync` against `todos/pending/` and user-supplied paths | ℹ️ Info | D-14 deferred to Phase 3; marked as such. Acceptable per phase scope. |
| `sdk/src/query/verify.ts` | 405-491 | `existsSync` / `readFileSync` / `statSync` for user-supplied path checks | ℹ️ Info | D-14 audited exception (paths not necessarily `.planning/`-scoped); annotated. Acceptable per phase scope. |
| `sdk/src/query/summary.ts` | 158 | `existsSync` + `readFileSync` for user-supplied path | ℹ️ Info | Audited exception per Plan 02-03 SUMMARY (`summaryExtract` user-path may resolve outside planning tree). Documented. |
| `sdk/src/query/uat.ts` | 87, 91 | `existsSync` + `readFileSync` for `--file` arg | ℹ️ Info | Audited exception, same pattern as summaryExtract. |
| `sdk/src/query/intel.ts` | 337, 341, 452, 456 | user-supplied path reads in `intelExtractExports`, `intelPatchMeta` | ℹ️ Info | Audited exceptions documented. |

### Boundary Verification (Negative Checks)

| Boundary | Expected | Status | Evidence |
| -------- | -------- | ------ | -------- |
| CJS files untouched | No commits to `get-shit-done/bin/lib/*.cjs` since Phase 2 began | ✓ HELD | `git log --oneline 66d4961c..HEAD -- get-shit-done/bin/lib/*.cjs` is empty |
| No new write-path migrations | `writeFileSync`/`mkdirSync`/`unlinkSync` unchanged in mixed-D-14 files | ✓ HELD | `intel.ts:232` mkdir + `intel.ts:236` writeFileSync preserved with D-14 markers; same for `progress.ts` writes; verify.ts writes unchanged |
| No Bin B method additions to StorageAdapter type | Only `stat()` added to types.ts | ✓ HELD | `git diff 66d4961c..HEAD -- adapters/types.ts` shows only `stat(...)` added |
| Phase 5 foundational primitives still throw | `snapshot`, `restore`, `withTransaction`, `putNamedDoc`, `getNamedDoc`, `writeBinaryAsset` throw `UnsupportedCapabilityError` | ✓ HELD | grep on adapters/markdown/index.ts confirms `throw new UnsupportedCapabilityError('snapshot'/'transaction'/'binaryAsset', this.name)` |

### Pre-Existing Baseline Test Failures (acceptable) vs New Failures (must be zero)

| Failure | At Pre-Phase-2 (66d4961c) | At Post-Plan-01 (42e20450) | At HEAD | Verdict |
| ------- | ------------------------- | -------------------------- | ------- | ------- |
| `validate.health > SDK JSON matches gsd-tools.cjs` | ✗ FAIL | ✗ FAIL | ✗ FAIL | Pre-existing — acceptable |
| `state.load golden parity` | ✓ PASS | ✗ FAIL | ✗ FAIL | **Plan 1 introduced** (project_exists addition); should have been caught at Phase 1 close |
| `roadmap.get-phase fixture` | ✓ PASS | (not run separately, but no regression at Plan-1 commit) | ✗ FAIL | **Phase 2 introduced** (closure-captured adapter rooted at REPO_ROOT, not test fixture dir) |
| `init-e2e InitRunner.run()` | ✓ PASS | ✓ PASS | ✗ FAIL | **Phase 2 introduced** (cascading from missing adapter param in test infra) |
| `phase-runner: initPhaseOp returns valid PhaseOpInfo` | ✓ PASS | ✓ PASS | ✗ FAIL | **Phase 2 introduced** (adapter undefined → listCollection error) |
| `phase-runner: initPhaseOp returns phase_found=false` | ✓ PASS | ✓ PASS | ✗ FAIL | **Phase 2 introduced** |
| `phase-runner: PhaseRunner emits lifecycle events` | ✓ PASS | ✓ PASS | ✗ FAIL | **Phase 2 introduced** |
| `phase-runner: PhaseRunner throws PhaseRunnerError` | ✓ PASS | ✓ PASS | ✗ FAIL | **Phase 2 introduced** |
| `phase-runner: phasePlanIndex returns typed PhasePlanIndex` | ✓ PASS | ✓ PASS | ✗ FAIL | **Phase 2 introduced** |
| `phase-runner: phasePlanIndex marks has_summary correctly` | ✓ PASS | ✓ PASS | ✗ FAIL | **Phase 2 introduced** |
| `phase-runner: phasePlanIndex for nonexistent phase` | ✓ PASS | ✓ PASS | ✗ FAIL | **Phase 2 introduced** |

**Pre-existing acceptable:** 1 (validate.health). 
**New failures introduced by Phase 2:** 9 (plus 1 carryover from Plan 1's `state.load`). 
**Total HEAD failures:** 11. 
**Net regression vs pre-Phase-2:** 10 tests.

The Plan SUMMARY pattern of writing "11 vitest integration test failures present at baseline. Pre-existing per Plan 1 SUMMARY's Unfixed (deferred to follow-ups)" (Plan 02-04 SUMMARY) is empirically false. Plan 1 SUMMARY claimed 1357/1357 passing; Plan 2-04 saw 11 failing. The accountable claim should have been: "Phase 2 introduces 10 test failures attributable to migration of `findPhase`/`phasePlanIndex` and the closure-captured adapter pattern."

### Deviations and How They Were Handled

| Deviation | Plan | Handled | Notes |
| --------- | ---- | ------- | ----- |
| HIGH-2 (leak-grep self-flag): `findProjectRoot` triggers Stage-2 PLANNING_SCOPE_RE filter | 02-01 | Physical separation into `bootstrap.ts` (D-15 carve-out) | Documented and tested |
| HIGH-3 (baseline timing): need pre-mutation baselines for SC#2 byte-identical assertion | 02-01 | Task 0 captured baselines in commit `ba17b33b` BEFORE any other Plan 1 mutation | Verified via git show |
| Atomic-task wiring constraint | 02-01, 02-04 | Multi-file commits where signature changes ripple through index.ts | Documented in summaries |
| Stage-2 false positives in JSDoc literals | 02-01, 02-03, 02-04 | Rewrote comments to avoid trigger tokens (`.planning/` → "the planning tree") | Same pattern repeatedly applied |
| `summaryExtract`/`uatRenderCheckpoint`/`intelExtractExports`/`intelPatchMeta` user-supplied paths | 02-03 | Audited-exception annotations; user paths may live outside planning tree | Documented inline; SCAN_DIRS lock prevents tests/ rows from polluting |
| `skill-manifest.ts` C2 vindication | 02-03 | UNMODIFIED — leak-grep zero naturally | D-15 path-scoped filter validated empirically |
| Floor 41 → 30 for context-block register | 02-05 | RESEARCH count was raw `@.planning/` grep; leak class is `<context>`-block-scoped | Documented in OQ-04 ADR |
| `vitest.config.ts` `leak-grep` project added | 02-05 | Auto-fix Rule 3 for acceptance command | Minimal additive change |

---

## Gaps Summary

Phase 2 substantially advanced the StorageAdapter migration: 14 SDK read-handler files are now adapter-routed (>40 read sites), the `<context>`-block audit register exists with full classification coverage, the Bin A contract gained the `stat()` primitive with conformance, and the init-bundler external shape is preserved (13/17 byte-identical, 4 skipped with documented drift). READS-02 and READS-03 are fully satisfied.

However, the phase **does not meet ROADMAP SC#1 as written**. ROADMAP SC#1 explicitly enumerates `stateJson`, `phasesList`, etc. as handlers that "must go through adapter," but state.ts (`stateJson`/`stateGet`/`stateSnapshot`/`buildStateFrontmatter`) and phase-lifecycle.ts (`phasesList`/`phaseNextDecimal`) remain on raw `node:fs/promises`. The CONTEXT.md scope-decision to defer phase-lifecycle.ts to Phase 3 is reasonable for the WRITE handlers in that file, but its pure-read handlers should have been migrated for SC#1 to be true. Similarly state.ts contains pure read handlers that ROADMAP-named SC#1 specifically calls out.

The phase **also does not meet ROADMAP SC#4**. There are 10 net-new test failures introduced by Phase 2 changes:
- 7 test failures in phase-runner integration tests because `phase-runner.integration.test.ts:75` constructs `new GSDTools({...})` without passing an adapter (post Phase 2's findPhase migration this fails at runtime). Plan 02-01 caught the same pattern in `ws-flag.test.ts` and fixed it; this same fix should have been applied to phase-runner.integration.test.ts.
- 1 test failure in init-e2e (cascading from same root cause).
- 1 test failure in `roadmap.get-phase fixture parity` (golden test pattern of dispatching against a different projectDir than registry's adapter root is broken by closure-captured adapter).
- 1 test failure in `state.load golden parity` (Plan 1 added `project_exists` field — Plan 2-03 SUMMARY mistakenly classified as pre-existing).

The 30 context-block refs registered, the 6 conformance test files with 61 passing, and the 17 closure-wired init bundlers are all real artifacts and represent meaningful migration progress. But the goal-statement bar — "every SDK read query flows through the adapter" — is not met because two of the seven explicitly-named ROADMAP read queries don't, and the test bar shows 10 regressions.

### Recommendation

The phase should **not** proceed to Phase 3 until either (a) the gaps are closed in Phase 2 follow-up plans, or (b) the planner explicitly re-scopes Phase 2 by amending ROADMAP SC#1 to exclude `stateJson` and `phasesList` (with a recorded ADR explaining why) and creates pre-Phase-3 follow-ups for the 10 broken tests. The cleanest path is a Phase 2 closure plan (02-06) that:

1. Migrates `state.ts`'s `stateJson`/`stateGet`/`stateSnapshot` and `buildStateFrontmatter` to adapter (or splits into a separate file with adapter-aware reads while leaving write-side state-mutation.ts for Phase 3).
2. Migrates the read-only handlers in `phase-lifecycle.ts` (`phasesList`/`phaseNextDecimal`) to adapter — or extracts them to `phase-list-queries.ts` (which already exists and was migrated).
3. Wires `state.json`/`state.get`/`state-snapshot`/`phases.list`/`phase.next-decimal` registrations through the createRegistry closure pattern.
4. Adds `adapter` parameter to `phase-runner.integration.test.ts:75-79` and `:313-318` (and audits any other `new GSDTools({...})` call sites that don't pass adapter).
5. Decides on the closure-captured adapter testability fix (re-construct adapter per dispatch, or restructure tests).
6. Decides on the `state.load project_exists` deviation (revert the field or get the golden test rebaselined).

Once those land and `cd sdk && npm test` matches the pre-Phase-2 baseline (1 failure: validate.health), SC#4 is empirically held and SC#1 is satisfied for all named handlers.

---

*Verified: 2026-05-01T05:55:00Z*
*Verifier: Claude (gsd-verifier)*
