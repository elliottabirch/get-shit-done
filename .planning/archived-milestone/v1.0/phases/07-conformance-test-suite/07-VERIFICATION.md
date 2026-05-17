---
phase: 07-conformance-test-suite
verified: 2026-05-13T04:45:00Z
status: human_needed
score: 3/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run full property suite end-to-end (all 12 nouns, both adapters)"
    expected: "All 24 noun-roundtrip tests pass with zero fast-check counterexamples; meta-coverage 3/3 passes with full registry populated"
    why_human: "CI job is cancelled by GitHub's 10-minute per-job limit before properties.test.ts completes. Only 3 of 12 nouns verified locally by debug agent. The remaining 9 MarkdownAdapter nouns and all 12 BeadsAdapter nouns are unverified by any completed run. Cannot verify programmatically without a completed test run."
  - test: "GitHub PR CI first green run (full paired suite on pull_request trigger)"
    expected: "Full paired suite green on PR trigger, including properties (or properties gated behind CONFORMANCE_DEEP=1 and separately green)"
    why_human: "Only workflow_dispatch smoke runs have been done. No pull_request trigger run has completed. PHASE-7-REMAINING.md §E explicitly defers this. The most recent dispatch run (25778206403) was cancelled at the properties step after all non-properties paired tests passed."
gaps:
  - truth: "Every adapter-surface method has a paired conformance test asserting equivalent outcomes on both MarkdownAdapter and BeadsAdapter"
    status: partial
    reason: "commitPlanningState (Bin B10 per SYNTHESIS.md; adapter-surface method per adapters/types.ts) has no BeadsAdapter paired test and is absent from CONFORMANCE_MANIFEST. CONTEXT.md line 494-495 explicitly planned: 'Phase 7 D-07 adds BeadsAdapter NOOP deviation per D-2026-05-12-OQ01-BEADS.' The test file commit-planning-state.test.ts line 85 has only it.todo('commitPlanningState creates identifiable save point on BeadsAdapter')."
    artifacts:
      - path: "tests/conformance/commit-planning-state.test.ts"
        issue: "it.todo at line 85 for BeadsAdapter; only MarkdownAdapter tested"
      - path: "tests/conformance/manifest.ts"
        issue: "No commitPlanningState binB entry in CONFORMANCE_MANIFEST (0 results from grep)"
    missing:
      - "Add commitPlanningState binB entry to CONFORMANCE_MANIFEST with expected: { markdown: { applied: true }, beads: { applied: true } } (NOOP returns void for both)"
      - "Add BeadsAdapter paired test in commit-planning-state.test.ts asserting commitPlanningState returns void (NOOP per D-2026-05-12-OQ01-BEADS) and registers via assertFromManifest"
      - "Wire the test to run via bdPresent() guard (same pattern as paired-core-beads.test.ts)"
---

# Phase 7: Conformance Test Suite — Verification Report

**Phase Goal:** A conformance test suite asserts MarkdownAdapter and BeadsAdapter produce equivalent outcomes for every Bin B method, every record-type round-trip, every section-mode semantic, and every dry-run failure-injection scenario.
**Verified:** 2026-05-13T04:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CONFORM-01: Every Bin B method has a paired test running against both adapters with equivalence assertions | PARTIAL | 32 binB manifest entries implemented and registered. `commitPlanningState` (B10 per SYNTHESIS.md, in `adapters/types.ts`) absent from manifest; `commit-planning-state.test.ts:85` has `it.todo` for BeadsAdapter. CONTEXT.md line 494-495 explicitly planned this. |
| 2 | CONFORM-02: Property-based round-trip tests pass for all 12 noun catalog types | ? UNCERTAIN | All 12 arbitraries exist with substantive implementations. `properties.test.ts` is wired. 3/12 nouns verified locally (Phase, StateEvent, Blocker on MarkdownAdapter). CI run cancelled by 10-min timeout before properties completed. Full pass unconfirmed. |
| 3 | CONFORM-03: Section-semantics matrix enforced — all (record-type, section-id, mode) tuples defined on both adapters | VERIFIED | 9 section-tuple entries in manifest; all covered by `assertFromManifest` calls in write-events and write-outcome suites; `extract-section-anchors.mjs` implements dynamic-anchor CI gate; bidirectional meta-coverage enforced via `meta-coverage.test.ts`. |
| 4 | CONFORM-04: Deliberate failure injection mid-transaction leaves both adapter stores in pre-transaction state | VERIFIED | `failure-injection.test.ts`: MarkdownAdapter byte-identical rollback test passes (SHA-256 tree hash via `markdownSnapshot`); BeadsAdapter record-identical rollback test passes (bd export --json via `beadsSnapshot`); mid-commit-replay known gap formally documented as `it.skip` per D-09, manifest entry `withTransaction:mid-commit-replay` with `expected.beads.kind = 'incomplete-per-Deferred-04'`. |

**Score:** 2/4 truths VERIFIED, 1 PARTIAL (blocker), 1 UNCERTAIN (human needed)

### Deferred Items

Items not yet met but explicitly addressed as non-blocking per PHASE-7-REMAINING.md.

| # | Item | Addressed In | Evidence |
|---|------|-------------|---------|
| 1 | Full property suite end-to-end run (all 12 nouns, both adapters) | Post-phase or Phase 8 | PHASE-7-REMAINING.md §B: "Trusting CI is reasonable given A1-through-CI is now wired" |
| 2 | GitHub PR CI first green run on `pull_request` trigger | Post-phase | PHASE-7-REMAINING.md §E: "User deferred to avoid blocking Phase 7 on the slow suite" |
| 3 | SDK alias-drift CI step re-enabled | Phase 8 Pre-0 | `.github/workflows/test.yml` line 176 `TODO(phase-8)`; PHASE-7-REMAINING.md §C.1 |
| 4 | Sibling `feat/phase-6-reset` graduate to `main` | Post-phase | PHASE-7-REMAINING.md §D |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `tests/conformance/manifest.ts` | 55-entry CONFORMANCE_MANIFEST (32 binB + 12 noun-roundtrip + 9 section-tuple + 2 rollback) | VERIFIED | Exact counts confirmed: `grep -c "kind: 'binB'"` = 32, `grep -c "'noun-roundtrip'"` = 12, `grep -c "'section-tuple'"` = 9, `grep -c "'rollback'"` = 2 |
| `tests/conformance/meta-coverage.test.ts` | Bidirectional manifest<->registration assertion (D-06) | VERIFIED | 3 `it()` blocks: manifest→registration gap check, registration→manifest orphan check, per-adapter expected populated check. File is substantive (79 LOC). |
| `tests/conformance/properties.test.ts` | 12 noun round-trip tests × 2 adapters, adaptive 60s budget (D-14) | VERIFIED (structure) | Imports all 12 arbitraries, iterates `pairedAdapters`, `fc.assert` with `interruptAfterTimeLimit: 60_000`. UNCERTAIN on behavioral pass (no completed run). |
| `tests/conformance/failure-injection.test.ts` | CONFORM-04 throw-before-commit + known-gap documentation | VERIFIED | MarkdownAdapter test passes (byte-identical). BeadsAdapter test passes (record-identical). `it.skip` documents known gap with Deferred-04/05 citations. |
| `tests/conformance/rollback-diff.ts` | `markdownSnapshot` (SHA-256 tree hash) + `beadsSnapshot` (bd export --json) + `assertEqualSnapshots` | VERIFIED | All three exports implemented and substantive (155 LOC). BEADS_ACTOR=seed discipline encoded. Non-semantic strip (updated_at, last_modified). |
| `tests/conformance/paired-adapters.ts` | Shared adapter-tuple + bd probe for parallel-fork test files | VERIFIED | Exports `pairedAdapters`, `bdPresent`, `AdapterFactory`. Imported by properties.test.ts and all paired-*-beads.test.ts files. |
| `tests/conformance/arbitraries/*.ts` | 12 per-noun fast-check arbitraries (D-12) | VERIFIED | All 12 files exist: arbPhase, arbPlan, arbSummary, arbUat, arbStateEvent (130 LOC, full discriminated union), arbRoadmap, arbDecision, arbBlocker, arbDebugSession, arbProject, arbSpec, arbAiSpec. `encode.ts` shared helper. |
| `adapters/types.ts` normalize() | `normalize(body, category?): string` on StorageAdapter (D-13) | VERIFIED | Lines 129-146: full JSDoc + method signature. Idempotency invariant documented. |
| `adapters/markdown/index.ts` normalize() | Identity implementation | VERIFIED | Lines 941-943: `normalize(body: string, _category?: string): string { return body; }` |
| `/Volumes/code/gsd-beads/src/index.ts` normalize() | parseFrontmatter + formatFrontmatter round-trip | VERIFIED | Lines 228+: `normalize(body, _category?) { const parsed = parseFrontmatter(body); return formatFrontmatter(parsed.frontmatter, parsed.body); }` |
| `/Volumes/code/gsd-beads/src/testing/conformance-factory.ts` | `createBeadsAdapter(projectDir)` factory with bd init discipline | VERIFIED | Exports `createBeadsAdapter`. Encodes git init, seed pre-stage, BEADS_ACTOR=seed, chmod 0o700 (Landmines 9+11). |
| `package.json` gsd-beads devDep | `"gsd-beads": "file:../gsd-beads"` | VERIFIED | Line 66 confirmed. |
| `package.json` test:conformance:paired script | Runs paired workers + meta-coverage as two-phase invocation | VERIFIED | Lines 88-91: `pretest:conformance:paired` + `test:conformance:paired` + `:workers` + `:meta` scripts present. |
| `.github/workflows/test.yml` | bd install + sibling checkout + `npm run test:conformance:paired` on ubuntu-22 | VERIFIED | bd install (Linux tarball) + macOS brew steps present; sibling checkout + relocate present; "Run paired conformance" step with `if: matrix.os == 'ubuntu-latest' && matrix.node-version == 22` present. |
| `scripts/extract-section-anchors.mjs` | D-08 section-anchor grep + dynamic-anchor gate | VERIFIED | 146 LOC; three passes (literal, internal, dynamic); exits 1 on dynamic anchors found; exits 0 and emits count on success. |
| `.planning/DECISIONS.md` ADRs | D-2026-05-12-NORMALIZE + D-2026-05-12-CONFORM-MANIFEST | VERIFIED | Both ADR sections present in DECISIONS.md (confirmed by grep). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `paired-core-beads.test.ts` | BeadsAdapter | `createBeadsAdapter` from `gsd-beads/testing` | VERIFIED | Line 6: `import { createBeadsAdapter } from 'gsd-beads/testing'`; line 10: `runAdapterConformanceSuite('beads', createBeadsAdapter)` |
| `properties.test.ts` | `pairedAdapters` | `import { pairedAdapters } from './paired-adapters.js'` | VERIFIED | Line 31; iterates the tuple at line 64 |
| `failure-injection.test.ts` | BeadsAdapter | `createBeadsAdapter` from `gsd-beads/testing` | VERIFIED | Line 24; used in beforeEach at line 103 |
| `meta-coverage.test.ts` | file-based registry | `readRegisteredTests()` from `test-registry.ts` | VERIFIED | Line 35: reads union of worker JSONL files; separate vitest invocation guarantees workers have exited |
| `write-outcome.conformance-suite.ts` | manifest entries | `preRegisterTest` + `assertFromManifest` | VERIFIED | 27 `preRegisterTest` calls at lines 98-130; 26 `assertFromManifest` calls throughout suite |
| `write-events.conformance-suite.ts` | 5 section-tuple entries | `assertFromManifest` | VERIFIED | Lines 181, 247, 352, 384, 460 — all 5 remaining section-tuple names |
| `vitest.conformance.config.ts` | TypeScript source alias (stale-dist bypass) | dual alias keys for `adapters/markdown/index.js` and `adapters/dist/markdown/index.js` | VERIFIED | Lines 21-24: both keys aliased to `adapters/markdown/index.ts` (fix for debug-resolved stale-dist normalize() failure) |
| `gsd-beads/package.json` exports | `./testing` subpath | `dist/testing/conformance-factory.js` | VERIFIED | Lines 14-16 of gsd-beads/package.json: `"./testing": { "import": "./dist/testing/conformance-factory.js", ... }` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `properties.test.ts` | `value` from `arb` | `fc.assert(fc.asyncProperty(arb, ...))` — fast-check generates values | Yes — generative inputs from substantive arbitraries | FLOWING |
| `failure-injection.test.ts` | `before`/`after` snapshots | `markdownSnapshot(tmpDir)` / `beadsSnapshot(tmpDir)` via SHA-256 / bd export | Yes — real filesystem/bd state | FLOWING |
| `write-outcome.conformance-suite.ts` | `outcome` from `adapter.recordStateAppend/Mutation/Signal` | Real adapter calls on fresh tmpDir | Yes — live adapter behavior | FLOWING |
| `meta-coverage.test.ts` | `registered` Set | `readRegisteredTests()` reads `.vitest-tmp/registry/worker-*.jsonl` | Yes — file-based registry written by test workers | FLOWING (when suite has run) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| manifest has 55 entries | `grep -c "kind:" tests/conformance/manifest.ts` | 83 (includes non-kind lines); direct kind counts: 32+12+9+2=55 | PASS |
| normalize() on MarkdownAdapter is identity | `grep -A2 "normalize(body:" adapters/markdown/index.ts` | `return body;` | PASS |
| normalize() on BeadsAdapter composes parse+format | `sed -n '228,232p' /Volumes/code/gsd-beads/src/index.ts` | `parseFrontmatter(body)` + `formatFrontmatter(...)` | PASS |
| All 12 arbitraries exist | `ls tests/conformance/arbitraries/` | 12 arb*.ts + encode.ts | PASS |
| ADR references in manifest resolve | `grep -E "D-2026-05-12-OQ06-CREATED-SECTION|D-2026-05-12-OQ06-TXN" .planning/DECISIONS.md` | Both ADRs present as section headers | PASS |
| CI pipeline reaches "Run paired conformance" | `gh run view 25778206403` | Step starts, registry clears, non-properties tests all pass (visible in log), cancelled by 10-min timeout in properties phase | PARTIAL |
| commitPlanningState in manifest | `grep "commitPlanningState" tests/conformance/manifest.ts` | No output — absent | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|----------|
| CONFORM-01 | 07-04b, 07-06 | Every Bin B method paired-tested on both adapters | PARTIAL | 32 binB entries cover all adapter-surface methods EXCEPT `commitPlanningState`. See gaps section. |
| CONFORM-02 | 07-05a, 07-05b | Property-based round-trips for all 12 noun catalog types | UNCERTAIN | Infrastructure complete (arbitraries + properties.test.ts). Pass status depends on CI completing property suite. |
| CONFORM-03 | 07-02, 07-04b | Section-semantics matrix defined and CI-enforced | VERIFIED | 9 section-tuple entries; dynamic-anchor gate; meta-coverage bidirectional assertion. |
| CONFORM-04 | 07-06 | Failure injection + rollback verification on both adapters | VERIFIED | failure-injection.test.ts passes locally (3 pass, 1 it.skip known-gap). Manifest entry formally documents gap per D-09. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|---------|--------|
| `tests/conformance/commit-planning-state.test.ts` | 85 | `it.todo('commitPlanningState creates identifiable save point on BeadsAdapter')` | BLOCKER | Missing CONFORM-01 coverage for `commitPlanningState` (Bin B10); planned in CONTEXT.md but unimplemented |
| `scripts/extract-section-anchors.mjs` | 130 | `// TODO (future): load CONFORMANCE_MANIFEST and filter out allowlisted callers` | INFO | Non-blocking: current behavior (fail hard on any dynamic anchor) is STRICTER than the TODO goal; does not weaken the gate |
| `.github/workflows/test.yml` | 179 | `if: false` (SDK alias-drift check disabled) | WARNING | Pre-existing SDK generator rot; unrelated to Phase 7 conformance work; tracked as Phase 8 Pre-0 |
| `tests/conformance/init-bundlers.test.ts` | Various | 11 baseline failures on CI | WARNING | Pre-existing baseline drift (Deferred-02); unrelated to Phase 7; PHASE-7-REMAINING.md notes "1 pre-existing init-bundlers baseline failure" |

### Human Verification Required

#### 1. Full Property Suite End-to-End Run

**Test:** Run `npm run test:conformance:paired` with both bd installed and beads adapter available; allow up to 45-60 minutes to complete the properties phase.
**Expected:** All 24 noun-roundtrip tests (12 nouns × 2 adapters) report "passed" or "interrupted (no counterexamples found)". Meta-coverage 3/3 passes. Zero fast-check counterexamples printed.
**Why human:** GitHub Actions 10-minute per-job limit terminates the properties phase before it finishes. Only Phase (MarkdownAdapter), StateEvent (MarkdownAdapter), and Blocker (MarkdownAdapter) were verified locally by the debug agent. The remaining 9 MarkdownAdapter nouns and all 12 BeadsAdapter nouns are unverified. CI run 25778206403 was cancelled at this step. If any arbitrary produces an encoding the adapter doesn't round-trip cleanly, the fix is typically a small arbitrary tweak. Per PHASE-7-REMAINING.md §B: "One of the remaining 9 markdown nouns could fail; the fix would probably be a small arbitrary tweak."

#### 2. GitHub PR CI First Green Run

**Test:** Push a PR against `feat/storage-adapter` from `test/phase-7-ci-smoke` and let the `pull_request` CI trigger run to completion (or configure the property test job with a longer timeout / gate behind `CONFORMANCE_DEEP=1`).
**Expected:** Non-properties paired suite green. Properties suite either green or separately validated via a scheduled nightly run.
**Why human:** Only `workflow_dispatch` runs have been done. The most recent dispatch (run 25778206403) shows: lint + test (macos/24) + test (ubuntu/24) all pass; test (ubuntu/22 — the paired conformance slot) cancelled by timeout mid-property-test. The CI wiring is correct (all build steps, bd install, sibling checkout all pass). This is a suite-runtime problem, not a correctness problem. PHASE-7-REMAINING.md §E explicitly defers this.

### Gaps Summary

One non-optional gap was found: `commitPlanningState` (Bin B10 per SYNTHESIS.md, defined in `adapters/types.ts`) lacks a BeadsAdapter paired test and a manifest entry. CONTEXT.md line 494-495 explicitly planned: "Phase 7 D-07 adds BeadsAdapter NOOP deviation per D-2026-05-12-OQ01-BEADS." The fix is minimal — add a 2-line manifest entry and a ~15-line BeadsAdapter test. The deviation is already ADR'd (BeadsAdapter commitPlanningState is a NOOP per D-2026-05-12-OQ01-BEADS). This blocks CONFORM-01 from being fully satisfied.

The two human-verification items (property suite run and PR CI green) are substantiated infrastructure items — the code is correct, the CI wiring is verified through the non-properties portion of run 25778206403, and the deferred status is explicitly documented in PHASE-7-REMAINING.md.

If `commitPlanningState` is closed (small gap) and the property suite runs clean (human verification), the phase achieves all 4 CONFORM requirements and all 4 ROADMAP SC.

---

_Verified: 2026-05-13T04:45:00Z_
_Verifier: Claude (gsd-verifier)_
