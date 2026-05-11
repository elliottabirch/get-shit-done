---
phase: 6
slug: beadsadapter-implementation
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-11
last_updated: 2026-05-11
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Repo topology:** Phase 6 produces artifacts in TWO repos:
- **This fork (`get-shit-done`):** additive fork-side changes — `./conformance` subpath export in `package.json` (D-CONFORM-EXPORT), `graphEdges` field on `Capabilities` in `adapters/types.ts` (D-OQ06-CAPS), `graphEdges: { semantic: true, dependency: false }` declaration in `adapters/markdown/index.ts`. Fork-side vitest continues to run.
- **Sibling (`/Volumes/code/gsd-beads`):** the majority of Phase 6 code. Archive-branched at `main @ 5082d45`; selective-pruned to the D-SCAFFOLD whitelist (~750 LOC); whitelisted `.mjs` ported to `.ts` per D-TECH-STACK; new adapter-compliance modules authored in `.ts`; vitest config authored fresh by Plan 06-01.
- Both must be green before Phase 7.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (fork side)** | vitest 1.x (already present: `adapters/vitest.config.ts`, `sdk/vitest.config.ts`, `tests/conformance/` suite wired) |
| **Framework (sibling side)** | vitest 4.1.6 — installed by Plan 06-01 scaffold (`npm install -D vitest@^4 @types/node`); sibling adopts fork's stack per D-TECH-STACK |
| **Config file (fork)** | `adapters/vitest.config.ts`, `sdk/vitest.config.ts`, `tests/conformance/*.test.ts` |
| **Config file (sibling)** | `/Volumes/code/gsd-beads/vitest.config.ts` — created by Plan 06-01 |
| **Quick run command (fork)** | `cd adapters && npm test -- --run` |
| **Quick run command (sibling)** | `cd /Volumes/code/gsd-beads && npm run test:unit` (scopes to `tests/unit/**/*.test.ts`) |
| **Full suite (fork)** | `npm test -- --run` at fork root (adapters + sdk + conformance) |
| **Full suite (sibling)** | `cd /Volumes/code/gsd-beads && npm test` — runs unit + conformance (`runAdapterConformanceSuite('beads', factory)` imported via `get-shit-done/conformance` subpath) |
| **Estimated runtime (fork)** | ~30s (existing baselines) |
| **Estimated runtime (sibling)** | ~60–120s depending on D-TXN spike outcome (bd cold-start dominates; Outcome C adds ~400–700ms per rollback test) |

---

## Sampling Rate

- **After every task commit:** Run the relevant side's quick command. If the task touched BOTH repos (only Plan 06-01 + fork-additive tasks likely), run both.
- **After every plan wave:** Run the full suite on whichever side(s) the wave touched.
- **Before `/gsd-verify-work`:** Both sides' full suites must be green; conformance invocation exercises all 71+ base cases against live bd v1.0.3.
- **Max feedback latency:** 180 seconds (sum of both sides in worst case with bd cold-start).

**Cross-repo discipline:** When a sibling test depends on a fork-side change (D-CONFORM-EXPORT subpath, D-OQ06-CAPS type extension), re-run `npm install` in sibling after fork edit so the `file:../get-shit-done` link resolves fresh. Without this, the sibling vitest sees stale .d.ts.

**bd CLI prerequisite:** Plan 06-03 spike and every sibling-side test that exercises live bd requires `bd v1.0.3` installed on PATH. Task 0 of Plan 06-03 fails fast on `command -v bd` check.

---

## Per-Task Verification Map

> Populated by the planner as plans land. Each task maps to a requirement, a threat (N/A — `workflow.security_enforcement` is `false`), and an automated command.
>
> **W0 status:** `nyquist_compliant: true` remains FALSE until pre-execution validation confirms every row's command resolves on the respective repo side and the test files are scaffolded.

Each plan's `<verify>` block inside each `<task>` element is the canonical per-task automated command — the table below is an index so a reviewer can see the requirement→task→command mapping at a glance. For exact command text + file paths, see the corresponding plan's task block.

| Task ID | Plan | Wave | Requirement | Threat Ref | Test Type | Automated Command (summary) | Status |
|---------|------|------|-------------|------------|-----------|-----------------------------|--------|
| 6-01-01 | 01 | 1 | BEADS-03 | — | unit | fork `npm test` green after `graphEdges` Capabilities additive field + MarkdownAdapter capability declaration | ⬜ pending |
| 6-01-02 | 01 | 1 | — | — | unit | `node -e "require('get-shit-done/conformance')"` resolves; `./conformance` subpath compiles | ⬜ pending |
| 6-01-03 | 01 | 1 | — | — | checkpoint:human-verify | user confirms `/Volumes/code/gsd-beads @ main @ 5082d45`; `v0.2-archive` branch exists after ceremony | ⬜ pending |
| 6-01-04 | 01 | 1 | — | — | infra | selective prune committed; `git ls-files` matches D-SCAFFOLD whitelist (~14 files remain) | ⬜ pending |
| 6-01-05 | 01 | 1 | — | — | infra | sibling `package.json` + `tsconfig.json` + `vitest.config.ts` created; `npm install` succeeds | ⬜ pending |
| 6-01-06 | 01 | 1 | — | — | infra | `src/index.ts` BeadsAdapter throw-stub compiles; `npm run typecheck` green | ⬜ pending |
| 6-01-07 | 01 | 1 | — | — | infra | `tests/conformance.test.ts` skeleton scaffolded; placeholder docs in README/CLAUDE.md/CONTRIBUTING.md (Plan 06-07 replaces) | ⬜ pending |
| 6-02-01 | 02 | 2 | BEADS-04 | — | unit (TDD-lite) | `cd /Volumes/code/gsd-beads && git mv _atomicWrite.mjs _atomicWrite.ts && <port>` → `git log --follow src/_atomicWrite.ts` traces back through `.mjs`; WR-05 race fix via `crypto.randomBytes(6)`; unit tests green | ⬜ pending |
| 6-02-02 | 02 | 2 | BEADS-04 | — | unit | Port `bd/helper.mjs → .ts` with BdRunner adapter-context wrapper (Landmines 3/4/5/6/7); `bd/errors.mjs → .ts` with `BdManagedMismatchError` per D-INIT-ERR; `bd/findRoot.mjs → .ts`; 4 helpers ported; all unit tests green | ⬜ pending |
| 6-02-03 | 02 | 2 | BEADS-04 | — | unit | `npx vitest run tests/unit/bd-helper.test.ts tests/unit/findRoot.test.ts tests/unit/_atomicWrite.test.ts` all green; ported code exercises WR-05 + Landmine 3/4/5/6/7 fixes | ⬜ pending |
| 6-03-01 | 03 | 2 | — | — | spike | `scripts/spike-bd-primitives.sh` exits 0; `SPIKE-RESULTS.md §§1-9` populated; §7 names locked D-TXN outcome (A/B/C); §8 names locked D-MAPPING outcome (A/B); §9 lists shipped bd CLI commands; includes `probe_deleteCascade` result | ⬜ pending |
| 6-03-02 | 03 | 2 | — | — | checkpoint:human-verify | user reviews SPIKE-RESULTS.md; confirms D-TXN + D-MAPPING outcomes; `bd --version` logged to SPIKE-RESULTS §1 matches or user acknowledges build-variance | ⬜ pending |
| 6-03-03 | 03 | 2 | — | — | unit | spike-script self-test: `bash scripts/spike-bd-primitives.sh --dry-run` exits 0 without bd installed (fail-fast with documented error code on real run if bd absent) | ⬜ pending |
| 6-03-04 | 03 | 2 | — | — | unit | DECISIONS.md entries for D-TXN-OUTCOME + D-MAPPING-OUTCOME committed with evidence cites to SPIKE-RESULTS §§7-9 | ⬜ pending |
| 6-04-01 | 04 | 3 | BEADS-01 | — | unit (TDD) | `format/phase.mjs → phase.ts` port with bidirectional idempotency contract preserved; `format/section.mjs → section.ts`; `format/frontmatter.mjs → frontmatter.ts`; all green per `npx vitest run tests/unit/format-*.test.ts` | ⬜ pending |
| 6-04-02 | 04 | 3 | BEADS-01 | — | unit | `adapter/pathRouter.mjs → paths.ts` port; extended for fork canonical-file list; CR-02 hybrid-tier resolved (forced through named-doc dispatch OR hybrid tier deleted); `npx vitest run tests/unit/paths.test.ts` green | ⬜ pending |
| 6-04-03 | 04 | 3 | BEADS-01 | — | unit | If D-MAPPING Outcome A ships, 12+ per-canonical-file TS schemas authored; If Outcome B, scoped down to `phase.ts` + `state.ts`; schema validation tests green | ⬜ pending |
| 6-04-04 | 04 | 3 | BEADS-01 | — | unit | `src/format/state.ts` authored per Plan 06-06 contract (no TODO markers); consumed by Plan 06-06 events.ts | ⬜ pending |
| 6-05-01 | 05 | 4 | BEADS-01 | — | unit + conformance | BeadsAdapter Bin A primitives (12 methods) + `init()` probe + capabilities declaration + `writeBinaryAsset` throw-stub authored; CR-01 path-traversal guard on `_abs()` runtime-active; `npm run test:conformance` green for Bin A + capability cases | ⬜ pending |
| 6-05-02 | 05 | 4 | BEADS-04 | — | smoke | `npx vitest run tests/smoke/init.test.ts` — 4 topology cases (worktree / BEADS_DIR env / symlink / non-bd); throws `BdManagedMismatchError` with `code === 'PROJECT_BD_MANAGED_MISMATCH'` + `projectDir` + `__brand` | ⬜ pending |
| 6-05-03 | 05 | 4 | BEADS-05 | — | smoke (capability-lint) | `npx vitest run tests/smoke/binary-asset.test.ts` — 3+ tests: `capabilities.binaryAsset === false`, `writeBinaryAsset` throws `UnsupportedCapabilityError` (fork's class), rationale comment present in source; negative conformance test for `_abs()` path-traversal guard | ⬜ pending |
| 6-06-01 | 06 | 5 | BEADS-01 BEADS-02 | — | unit + conformance | 3 `recordState*` families split from sibling monolithic `recordStateEvent`; `StateWriteOutcome` three-state return on every call; exhaustive `never` switch on event.type; 16-case matrix green (Outcome A) OR 14-case (Outcome B per D-OQ06-CREATED-SECTION ADR) | ⬜ pending |
| 6-06-02 | 06 | 5 | BEADS-01 | — | unit + conformance | `withTransaction` + `snapshot()/restore()` per D-TXN outcome A/B/C from Plan 06-03; `capabilities.snapshot` matches shipped outcome; `capabilities.transaction: true` unconditional; commit/rollback/own-writes/reentrant tests green | ⬜ pending |
| 6-06-03 | 06 | 5 | BEADS-03 | — | smoke + integration | `src/dep-graph.ts` synthesizer authored citing Spike 014; `getRecord('graphs/graph.json')` returns valid JSON with `{type: 'dependency', confidence: 1.0}` edges; merge-preserves-semantic logic green per `npx vitest run tests/smoke/dep-graph.test.ts` (≥7 tests); `capabilities.graphEdges` on BeadsAdapter declares `{semantic: false, dependency: true}` | ⬜ pending |
| 6-07-01 | 07 | 6 | BEADS-02 | — | smoke (8 tests) | `npx vitest run tests/smoke/bin-b-phase.test.ts tests/smoke/bin-b-plan.test.ts tests/smoke/bin-b-summary.test.ts tests/smoke/bin-b-uat.test.ts tests/smoke/bin-b-state-event.test.ts tests/smoke/bin-b-debug.test.ts tests/smoke/bin-b-intel.test.ts tests/smoke/bin-b-learnings.test.ts` — 8 files, one per Bin B category (SC#3) | ⬜ pending |
| 6-07-02 | 07 | 6 | — | — | conformance | `tests/conformance.test.ts` factory replaces Plan 06-01 skeleton with real bd-init-from-seed per test; `runAdapterConformanceSuite('beads', factory)` green against live bd v1.0.3; all 71+ base cases pass | ⬜ pending |
| 6-07-03 | 07 | 6 | — | — | docs | README.md + CLAUDE.md + CONTRIBUTING.md rewritten for v1.0 shipped shape; grep-verifiable: `grep -qE "D-TXN.*(A\|B\|C)"`, `grep -q "capabilities"`, `grep -q "gsd:"`, `grep -q "sidecar"`, `grep -q "UnsupportedCapabilityError"`, landmine-ID table cited by ID | ⬜ pending |
| 6-07-04 | 07 | 6 | — | — | audit | `PHASE-6-EXIT.md` generated with pass/fail per locked decision: capabilities values, BdManagedMismatchError brand+code, StateWriteOutcome three-state on all 3 recordState*, graphEdges field on both adapters, dep-graph type:'dependency', CR-01 path-traversal guard active, 13 landmine rows (10 code-fix + 2 discipline + 1 defensive per CONTEXT.md canonical table) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Phase Requirements → Test Map (per RESEARCH.md §Validation Architecture)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| BEADS-01 | All Bin A primitives (`getRecord`/`putRecord`/`removeRecord`/`removeCollection`/`listCollection`/`exists`/`stat`/`getSection`/`updateSection`/`getFrontmatter`/`updateFrontmatter`/`mergeFrontmatter`) work against bd | conformance + smoke | `npm run test:conformance` (all Bin A methods exercised via fork's `adapter.conformance.ts`) + `npx vitest run tests/smoke/record-primitives.test.ts` | ❌ W0 |
| BEADS-02 | 3 `recordState*` families return correct `StateWriteOutcome`; each dispatches correct bd primitive per D-MAPPING event-family mapping | conformance (16-case matrix) + per-family smoke | `npx vitest run tests/conformance.test.ts -t 'recordStateAppend'` + `.../recordStateMutation` + `.../recordStateSignal` + `npx vitest run tests/smoke/state-events-*.test.ts` | ❌ W0 |
| BEADS-03 | `getRecord('graphs/graph.json')` returns valid JSON with bd `blocks`-derived `{type: 'dependency', confidence: 1.0}` edges; `capabilities.graphEdges` declares `{semantic: false, dependency: true}` | smoke + capability lint | `npx vitest run tests/smoke/dep-graph.test.ts` + capability declaration assert | ❌ W0 |
| BEADS-04 | `BeadsAdapter.init()` (or first bd-using method) against non-bd-managed dir throws `BdManagedMismatchError` with `code === 'PROJECT_BD_MANAGED_MISMATCH'` and `projectDir` populated | smoke | `npx vitest run tests/smoke/init.test.ts` (4 topology cases per findRoot test table) | ❌ W0 |
| BEADS-05 | `writeBinaryAsset` throws fork's `UnsupportedCapabilityError`; `capabilities.binaryAsset === false`; rationale comment present in source | smoke (capability-lint ported from sibling's 4-test pattern) | `npx vitest run tests/smoke/binary-asset.test.ts` | ❌ W0 |

---

## Wave 0 Requirements

**Fork side:**
- [ ] `tests/conformance/adapter.conformance.ts` → compiled output available at `tests/conformance/adapter.conformance.js` (or tsconfig re-emit path) for the subpath export to resolve. If the current tsconfig doesn't emit that target, Plan 06-01 (or the dedicated fork-additive plan) fixes the emit path.
- [ ] `package.json` `"exports"` field extended with `"./conformance"` entry.
- [ ] `adapters/types.ts` — additive `graphEdges: { semantic: boolean; dependency: boolean }` field on `Capabilities`.
- [ ] `adapters/markdown/index.ts` — MarkdownAdapter capabilities object declares `graphEdges: { semantic: true, dependency: false }`.

**Sibling side (all absent post-reset; Plan 06-01 authors):**
- [ ] `/Volumes/code/gsd-beads/package.json` — post-reset; `devDependencies: { "get-shit-done": "file:../get-shit-done", "vitest": "^4" }`; `peerDependencies: { "get-shit-done-cc": "*" }` preserved.
- [ ] `/Volumes/code/gsd-beads/vitest.config.ts` — vitest project config; `threads: false` (bd spawns serialize on `.beads/` root).
- [ ] `/Volumes/code/gsd-beads/tsconfig.json` — extends fork patterns; `strict: true`.
- [ ] `/Volumes/code/gsd-beads/src/index.ts` — BeadsAdapter class skeleton: every `StorageAdapter` method throwing `NotYetImplementedError` or stub (mirrors Phase 1's MarkdownAdapter scaffold pattern). Starting state; Waves 2+ replace stubs with real implementations.
- [ ] `/Volumes/code/gsd-beads/tests/conformance.test.ts` — imports and invokes `runAdapterConformanceSuite('beads', factory)` from `get-shit-done/conformance`.
- [ ] `/Volumes/code/gsd-beads/tests/fixture.ts` (or `tests/conftest.ts`) — shared bd-init-from-seed.jsonl fixture (port sibling's `setupFreshAdapter` pattern); `chmodSync 0o700` post-init (Landmine 9).
- [ ] `/Volumes/code/gsd-beads/tests/fixtures/build-seed.sh` — ported from sibling whitelist (may remain `.sh`; enforces `BEADS_ACTOR=seed` discipline).
- [ ] `/Volumes/code/gsd-beads/tests/fixtures/seed.jsonl` — regenerated from `build-seed.sh` with `BEADS_ACTOR=seed` discipline.
- [ ] `/Volumes/code/gsd-beads/tests/smoke/init.test.ts` — BEADS-04 (4 tests).
- [ ] `/Volumes/code/gsd-beads/tests/smoke/binary-asset.test.ts` — BEADS-05 (3 tests including capability-lint ported from sibling's 4-test pattern).
- [ ] `/Volumes/code/gsd-beads/tests/smoke/record-primitives.test.ts` — BEADS-01 (supplements conformance).
- [ ] `/Volumes/code/gsd-beads/tests/smoke/format.test.ts` — heading-walker + frontmatter + UnknownSectionError; 12+ schemas × 3 scenarios if Outcome A ships, scoped down if Outcome B.
- [ ] `/Volumes/code/gsd-beads/tests/smoke/section-primitives.test.ts` + `frontmatter-primitives.test.ts` — getSection/updateSection/getFrontmatter/updateFrontmatter/mergeFrontmatter live against bd.
- [ ] `/Volumes/code/gsd-beads/tests/smoke/transaction.test.ts` + `commit-planning-state.test.ts` — withTransaction per D-TXN Outcome A/B/C.
- [ ] `/Volumes/code/gsd-beads/tests/smoke/state-events-append.test.ts` + `-mutation.test.ts` + `-signal.test.ts` — BEADS-02 × 3 (16-case StateWriteOutcome matrix).
- [ ] `/Volumes/code/gsd-beads/tests/smoke/named-doc.test.ts` — `putNamedDoc`/`getNamedDoc` closed-enum NamedDocCategory coverage.
- [ ] `/Volumes/code/gsd-beads/tests/smoke/dep-graph.test.ts` — BEADS-03 (≥7 tests: empty bd, populated bd, merge-preserves-semantic, dedupe, orphan-skip, capability declaration, activeTxn-respect).
- [ ] `/Volumes/code/gsd-beads/tests/smoke/bin-b-{phase,plan,summary,uat,state-event,debug,intel,learnings}.test.ts` × 8 — SC#3 (one workflow per Bin B category).
- [ ] Framework install: `npm install --save-dev vitest@^4 @types/node typescript@^5`.

*(Wave 0 gap list is long because sibling's entire test tree is pruned in D-SCAFFOLD step 4.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `git log --follow` preservation for `.mjs` → `.ts` ports | D-SCAFFOLD whitelist integrity | git log behavior across file renames is tool-dependent; verify on one file mechanically before trusting the port strategy | In sibling, after porting one whitelist file: `git log --follow src/bd/findRoot.ts`. If blame traces back through the `.mjs` original, preservation works; if not, document the trade-off in README. |
| Phase 6 exit checkpoint: shipped D-TXN variant (A/B/C) documented in sibling README with evidence citations | D-TXN-SPIKE commit | README is docs, not test-gated | `test -f /Volumes/code/gsd-beads/README.md && grep -qE "D-TXN.*(A\|B\|C)" /Volumes/code/gsd-beads/README.md && grep -q "capabilities" /Volumes/code/gsd-beads/README.md && grep -q "gsd:" /Volumes/code/gsd-beads/README.md && grep -q "sidecar" /Volumes/code/gsd-beads/README.md` |
| bd v1.0.3 build on developer machine matches sibling's empirical pinned build (`1b2dd2cb`) | Spike §1 prerequisite | Requires local bd install inspection | `bd --version` prints `bd v1.0.3 (1b2dd2cb)` or newer stable release; otherwise flag in Plan 06-03 spike output §1. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (see Per-Task Verification Map above; 28 tasks mapped)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (2 checkpoints: 6-01-03 + 6-03-02 — both blocking human-verify, not running-silent)
- [x] Wave 0 covers all MISSING references (Wave 0 Requirements section above enumerates fork-side 4 files + sibling 22 files)
- [x] No watch-mode flags (all commands use `npx vitest run` or `npm test -- --run`)
- [x] Feedback latency < 180s (quick: ~30s fork + ~60s sibling unit; full: bd cold-start dominates at ~400-700ms × ~71 cases ≈ 60s worst case with serialized spawns per `threads: false`)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-11 (Per-Task Verification Map populated from 28 tasks across 7 plans; sampling discipline verified; post-plan-checker revision round 1)
