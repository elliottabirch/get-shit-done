---
phase: 2
slug: wire-core-read-methods-to-adapter
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-01
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (SDK), node:test (CJS — `tests/*.test.cjs`), conformance harness factory at `tests/conformance/` |
| **Config file** | `adapters/vitest.config.ts`, `sdk/package.json` (vitest config), `tests/conformance/vitest.config.ts` (Phase 1 D-15) |
| **Quick run command** | `npx vitest run --no-coverage adapters/types.test.ts adapters/markdown sdk/src/query` |
| **Full suite command** | `npm test` (project root — runs both vitest + `node scripts/run-tests.cjs`) |
| **Estimated runtime** | quick: ~25s; full: ~120s |

---

## Sampling Rate

- **After every task commit:** Run quick command (scoped to touched files where possible).
- **After every plan wave:** Run full suite + extended `node scripts/leak-grep.cjs sdk/src/query/` (per D-04 extended SDK fs patterns).
- **Before `/gsd-verify-work`:** Full suite must be green AND extended leak-grep must return zero matches in `sdk/src/query/` (READS-01 SC#1 satisfaction).
- **Max feedback latency:** ~30s for quick command on the file just edited.

---

## Per-Task Verification Map

> Filled in by gsd-planner once Plan 1-5 task IDs exist. Each plan's tasks claim a row here with the conformance test or unit test asserting their migration. The map is updated incrementally; gsd-validate-phase reconciles after planning completes.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-XX | 01 | 0 | READS-01 | — | adapter.stat returns correct kind/mtime | conformance | `npx vitest run tests/conformance/stat.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-XX | 01 | 0 | READS-01 | — | leak-grep extended SDK patterns fire correctly | unit | `node scripts/leak-grep.cjs tests/leak-grep/fixtures/` | ❌ W0 | ⬜ pending |
| 2-01-XX | 01 | 1 | READS-01 | — | helpers.ts adapter-aware; reference handler routes through adapter | conformance + unit | `npx vitest run tests/conformance/helpers.test.ts sdk/src/query/phase.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-XX | 02 | 1 | READS-01 | — | phase/state/progress/roadmap reads return through adapter | conformance | `npx vitest run tests/conformance/phase-reads.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-XX | 03 | 1 | READS-01 | — | document reads (summary/uat/intel/docs-init/skill-manifest) return through adapter | conformance | `npx vitest run tests/conformance/document-reads.test.ts` | ❌ W0 | ⬜ pending |
| 2-04-XX | 04 | 2 | READS-02 | — | init bundlers compose primitives via adapter; coarse JSON shape preserved | golden+conformance | `npx vitest run tests/conformance/init-bundlers.test.ts` + golden compare | ❌ W0 | ⬜ pending |
| 2-05-XX | 05 | 2 | READS-03 | — | `<context>`-block register exhaustive (no orphan refs); 3-bucket disposition for each | unit | `npx vitest run tests/leak-grep/context-block-register.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Planner expands the XX placeholders to per-task IDs (2-01-01..N etc.) when generating plans.

---

## Wave 0 Requirements

- [ ] `tests/conformance/stat.test.ts` — round-trip test for `adapter.stat()` (file/dir/null cases) — Plan 1
- [ ] `tests/conformance/helpers.test.ts` — Plan 1 helper migrations under MarkdownAdapter
- [ ] `tests/conformance/phase-reads.test.ts` — Plan 2 phase/state/progress/roadmap handler reads
- [ ] `tests/conformance/document-reads.test.ts` — Plan 3 summary/uat/intel/docs-init handler reads
- [ ] `tests/conformance/init-bundlers.test.ts` — Plan 4 bundler shape + content reproduction
- [ ] `tests/leak-grep/fixtures/sdk-fs-patterns.ts` — fixture file exercising the extended SDK patterns (Plan 1 leak-grep extension)
- [ ] `tests/leak-grep/context-block-register.test.ts` — assertions that no `<context>`-block `@.planning/...` reference is missing from the register (Plan 5)

*Existing infrastructure (vitest, conformance harness skeleton from Phase 1 D-15, leak-grep.cjs from Phase 1 D-14) covers framework needs. Plan 1 EXTENDS the harness; no new framework install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Strict-superset against upstream — fork's existing test suite passes after migration | D-13 (Phase 1) | The upstream #2909 golden parity is Phase 8; Phase 2's bar is fork-local | Run `node scripts/run-tests.cjs` and `npx vitest run` — both must pass with zero new failures attributable to Phase 2 commits |
| Init bundler JSON byte-identical | READS-02 SC#2 | Bundler outputs are large JSON objects; golden snapshot is the right tool but capturing the pre-migration baseline must happen BEFORE Plan 4 runs | Plan 1 includes a setup task that captures `gsd-sdk query init.<bundler> ...` stdout for each of the 16 bundlers into `tests/golden/init-bundlers/<name>.before.json`; Plan 4 asserts post-migration output diffs to zero |
| Repo-wide `<context>`-block register completeness | READS-03 SC#3 | Subjective check: did we classify every ref? | After Plan 5, run `node scripts/leak-grep.cjs commands/ agents/ get-shit-done/ docs/ | grep "context-block"` and cross-check count against register row count |

*Two of three above migrate to automated as part of Plan 1's golden-snapshot capture and Plan 5's register-completeness test.*

---

## Validation Sign-Off

- [ ] All 5 plan tasks have automated verify (conformance test, leak-grep, or golden compare)
- [ ] Sampling continuity: every plan ends with the extended leak-grep gate (no 3 consecutive tasks without automated verify)
- [ ] Wave 0 fixtures + conformance test stubs are written in Plan 1 before any read-handler migration starts
- [ ] No watch-mode flags (per Nyquist convention)
- [ ] Feedback latency: ~25-30s for the quick command on touched files
- [ ] `nyquist_compliant: true` set in frontmatter (after Plan 1 ships and harness extensions land)

**Approval:** pending — gsd-validate-phase reconciles after gsd-planner expands the per-task ID placeholders
