---
phase: 6
slug: beadsadapter-implementation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _Planner to fill after PLAN.md files are generated._ | | | | | | | | | |

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (test files absent post-reset)
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s (bd cold-start budget included)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
