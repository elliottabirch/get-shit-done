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
- **This fork (`get-shit-done`):** one subpath-export change to `package.json` (D-CONFORM-EXPORT), one additive field in `adapters/types.ts` Capabilities (D-OQ06-CAPS). Fork-side vitest (`sdk/` + `adapters/` + `tests/conformance/`) continues to run.
- **Sibling (`~/code/gsd-beads`):** the majority of Phase 6 code. Fresh `npm init` repo; its own `vitest` config runs the imported conformance harness plus sibling-local smoke tests.
- Both must be green before Phase 7.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (fork side)** | vitest 1.x (already present: `adapters/vitest.config.ts`, `sdk/vitest.config.ts`, `tests/conformance/` suite wired) |
| **Framework (sibling side)** | vitest 1.x — installed by Plan 06-01 scaffold (`npm install -D vitest`) |
| **Config file (fork)** | `adapters/vitest.config.ts`, `sdk/vitest.config.ts`, `tests/conformance/*.test.ts` |
| **Config file (sibling)** | `~/code/gsd-beads/vitest.config.ts` — created by Plan 06-01 |
| **Quick run command (fork)** | `cd adapters && npm test -- --run` |
| **Quick run command (sibling)** | `cd ~/code/gsd-beads && npm test -- --run` |
| **Full suite (fork)** | `npm test -- --run` at fork root (adapters + sdk + conformance) |
| **Full suite (sibling)** | `cd ~/code/gsd-beads && npm test -- --run` — includes `runAdapterConformanceSuite('beads', factory)` imported via `get-shit-done/conformance` subpath |
| **Estimated runtime (fork)** | ~30s (existing baselines) |
| **Estimated runtime (sibling)** | ~15–60s depending on outcome of D-TXN spike (smoke tests smaller than paired conformance) |

---

## Sampling Rate

- **After every task commit:** Run the relevant side's quick command. If the task touched BOTH repos (only Plan 06-01 + Plan 06-02 likely), run both.
- **After every plan wave:** Run the full suite on whichever side(s) the wave touched.
- **Before `/gsd-verify-work`:** Both sides' full suites must be green.
- **Max feedback latency:** 60 seconds (sum of both sides in worst case).

**Cross-repo discipline:** When a sibling test depends on a fork-side change (D-CONFORM-EXPORT subpath, D-OQ06-CAPS type extension), re-run `npm install` in sibling after fork edit so the `file:../get-shit-done` link resolves fresh. Without this, the sibling vitest sees stale .d.ts.

---

## Per-Task Verification Map

> Populated by the planner as plans land. Each task maps to a requirement, a threat (N/A here — security_enforcement is off per config), and an automated command.
>
> **W12 status:** All 15 tasks across Plans 01-07 are mapped with automated commands (or spike success-criteria for exploratory tasks). `nyquist_compliant: true` remains FALSE until pre-execution validation confirms every row's command resolves on the respective repo side.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | D-CONFORM-EXPORT, D-OQ06-CAPS | — | N/A | unit | `node -e "require('get-shit-done/conformance')"` AND `cd /Volumes/code/get-shit-done && npm test -- --run tests/conformance/` (MarkdownAdapter conformance still green after graphEdges additive field) | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 1 | D-TXN-SPIKE | — | N/A | spike | `~/code/gsd-beads/scripts/spike-bd-primitives.sh` — **success criteria (not pass/fail):** (a) script exits 0; (b) `SPIKE-RESULTS.md` §1-§9 all populated; (c) §7 names a locked outcome A or B; (d) §9 lists carry-forward CLI commands for the chosen outcome. If any of (a)-(d) missing, spike INCOMPLETE and Plan 02+ is BLOCKED. | ❌ W0 | ⬜ pending |
| 6-01-03 | 01 | 1 | BEADS-01..05 infra | — | N/A | infra | `cd ~/code/gsd-beads && npm install && npm run typecheck && npm test -- --run` (smoke-only — passes with stub adapter throwing NotYetImplementedError on every method; conformance test asserts stub-throwing baseline) | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 2 | BEADS-04, BEADS-01 | — | N/A | smoke+integration | `cd ~/code/gsd-beads && npm run typecheck && npm test -- --run tests/smoke/init.test.ts` (4 tests: throw on empty dir, code field, brand instanceof, clean construct on marker). Cross-repo: if option A chosen, `cd /Volumes/code/get-shit-done && npm run test:conformance` still green (harness `.bd/` pre-create additive). | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 2 | BEADS-01 | — | N/A | smoke+conformance | `cd ~/code/gsd-beads && npm run typecheck && npm test -- --run tests/smoke/record-primitives.test.ts && npm test -- --run tests/conformance.test.ts 2>&1 \| grep -q "✓.*stat"` (13 smoke tests + conformance record-level assertions now green vs Plan 01 baseline) | ❌ W0 | ⬜ pending |
| 6-03-01 | 03 | 3 | BEADS-01 | — | N/A | unit (TDD) | `cd ~/code/gsd-beads && npm run typecheck && npm test -- --run tests/smoke/format.test.ts` (heading-walker + frontmatter + UnknownSectionError + findSchema/passthrough — 15-20 assertions covering fence-skip, comment-skip, parent-path disambiguation) | ❌ W0 | ⬜ pending |
| 6-03-02 | 03 | 3 | BEADS-01, BEADS-02 | — | N/A | unit (TDD) | `cd ~/code/gsd-beads && npm run typecheck && npm test -- --run tests/smoke/format.test.ts` (extended with 12 schemas × 3 scenarios ≈ 36 assertions; must verify 12 canonical files present per D-MAPPING-SCHEMA + state.ts imports payload types from fork per W5) | ❌ W0 | ⬜ pending |
| 6-03-03 | 03 | 3 | BEADS-01 | — | N/A | unit+conformance (TDD) | `cd ~/code/gsd-beads && npm run typecheck && npm test -- --run tests/smoke/section-primitives.test.ts && npm test -- --run tests/smoke/frontmatter-primitives.test.ts && npm test -- --run tests/conformance.test.ts 2>&1 \| grep -cE "✓.*(getSection\|updateSection\|Frontmatter)"` ≥ 5 | ❌ W0 | ⬜ pending |
| 6-04-01 | 04 | 4 | BEADS-01 (withTransaction + snapshot per D-TXN outcome) | — | N/A | unit+integration (TDD) | `cd ~/code/gsd-beads && npm run typecheck && npm test -- --run tests/smoke/transaction.test.ts && npm test -- --run tests/smoke/record-primitives.test.ts && npm test -- --run tests/smoke/section-primitives.test.ts` (≥ 6 txn tests covering commit/rollback/own-writes/reentrant/updateSection-no-deadlock + outcome-specific test; Plan 02/03 tests still green) | ❌ W0 | ⬜ pending |
| 6-04-02 | 04 | 4 | BEADS-01 (commitPlanningState) | — | N/A | smoke (TDD) | `cd ~/code/gsd-beads && npm run typecheck && npm test -- --run tests/smoke/commit-planning-state.test.ts && npm test -- --run` (≥ 3 tests for Outcome A, ≥ 4 for Outcome B; full suite regression-check) | ❌ W0 | ⬜ pending |
| 6-05-01 | 05 | 5 | BEADS-01, BEADS-02 (recordState* × 3 families, 16 outcomes) | — | N/A | integration (TDD) | `cd ~/code/gsd-beads && npm run typecheck && npm test -- --run tests/smoke/state-events-append.test.ts tests/smoke/state-events-mutation.test.ts tests/smoke/state-events-signal.test.ts && npm test -- --run tests/conformance.test.ts 2>&1 \| grep -cE "✓.*(recordStateAppend\|Mutation\|Signal)"` — 16 canonical outcome cases covered | ❌ W0 | ⬜ pending |
| 6-05-02 | 05 | 5 | BEADS-01, BEADS-05 (putNamedDoc + getNamedDoc + binaryAsset capability-gate) | — | N/A | smoke | `cd ~/code/gsd-beads && npm run typecheck && npm test -- --run tests/smoke/named-doc.test.ts tests/smoke/binary-asset.test.ts && npm test -- --run` (NamedDocCategory coverage + UnsupportedCapabilityError throw on writeBinaryAsset + markdownLockfile throw-stubs; full suite regression-check) | ❌ W0 | ⬜ pending |
| 6-06-01 | 06 | 6 | BEADS-01, BEADS-02, BEADS-03 (dep-edge synthesizer + D-OQ06) | — | N/A | smoke+integration (TDD) | `cd ~/code/gsd-beads && npm run typecheck && npm test -- --run tests/smoke/dep-graph.test.ts && npm test -- --run` — ≥ 7 tests (empty bd, populated bd, merge-preserves-semantic, dedupe, orphan-skip, capability declaration, activeTxn-respect per W8); full suite regression-check | ❌ W0 | ⬜ pending |
| 6-07-01 | 07 | 7 | BEADS-02 (8 Bin B category smoke tests + SC#3 coverage) | — | N/A | integration | `cd ~/code/gsd-beads && npm run typecheck && npm test -- --run tests/smoke/bin-b-phase.test.ts tests/smoke/bin-b-plan.test.ts tests/smoke/bin-b-summary.test.ts tests/smoke/bin-b-uat.test.ts tests/smoke/bin-b-state-event.test.ts tests/smoke/bin-b-debug.test.ts tests/smoke/bin-b-intel.test.ts tests/smoke/bin-b-learnings.test.ts` (8 smoke tests, one per category in ROADMAP Phase 6 SC#3) | ❌ W0 | ⬜ pending |
| 6-07-02 | 07 | 7 | BEADS-02 (README — docs, not test-gated) | — | N/A | docs | `test -f ~/code/gsd-beads/README.md && grep -qE "D-TXN.*(A\|B)" ~/code/gsd-beads/README.md && grep -q "capabilities" ~/code/gsd-beads/README.md && grep -q "gsd:" ~/code/gsd-beads/README.md && grep -q "sidecar" ~/code/gsd-beads/README.md` (README documents: D-TXN variant, capabilities rationale, label namespace, sidecar map, export shape, known limitations) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Spike task note (6-01-02):** Plan 01 Task 2 is a spike — pass/fail does not apply. The automated "test" is the spike script's successful completion + SPIKE-RESULTS.md population. Execute-plan treats this as a documentation deliverable; plan-checker verifies the `<spike-completion>` criteria listed in the Automated Command column.

**Manual-only verification:** All 15 tasks above have automated commands. No task requires `autonomous: false`. The existing Manual-Only Verifications table below covers behaviors that supplement (not replace) the automated commands.

---

## Wave 0 Requirements

**Fork side:**
- [ ] `tests/conformance/adapter.conformance.ts` → compiled output available at
      `tests/conformance/adapter.conformance.js` (or tsconfig re-emit path) for
      the subpath export to resolve. If the current tsconfig doesn't emit that
      target, Plan 06-01 fixes the emit path.
- [ ] `package.json` `"exports"` field extended with `"./conformance"` entry.

**Sibling side:**
- [ ] `~/code/gsd-beads/package.json` — `npm init -y` output with
      `"get-shit-done": "file:../get-shit-done"` dev dep, `vitest` dev dep,
      TypeScript scaffolding.
- [ ] `~/code/gsd-beads/vitest.config.ts`
- [ ] `~/code/gsd-beads/tsconfig.json`
- [ ] `~/code/gsd-beads/src/index.ts` — BeadsAdapter class skeleton: every
      StorageAdapter method throwing `UnsupportedCapabilityError` or similar
      stub (mirrors Phase 1's MarkdownAdapter scaffold pattern). This is the
      starting state; Waves 2+ replace stubs with real implementations.
- [ ] `~/code/gsd-beads/tests/conformance.test.ts` — imports from
      `get-shit-done/conformance` and calls
      `runAdapterConformanceSuite('beads', (dir) => new BeadsAdapter(dir))`.
      At Wave-0 completion this test is expected to fail every assertion
      against the stub adapter — that is the baseline the rest of Phase 6
      converts to green.
- [ ] bd CLI available on PATH (verified by Plan 06-01 spike script). If
      bd CLI is not available anywhere on the system, Phase 6 is **BLOCKED**
      — surface via `## RESEARCH BLOCKED` escalation protocol; do NOT
      attempt to stub bd itself.

*If none: "N/A" — not applicable here; infra must ship with Plan 06-01.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| BeadsAdapter.init() fails fast with typed BdManagedMismatchError on non-bd-managed dir | BEADS-04 | Automated test covers the happy path + typed catch. Manual spot-check confirms the hint text is useful, not just technically correct. | Run `BeadsAdapter.init('/tmp/empty-dir')` in a REPL; inspect `err.hint` — it should reference `bd init` or document the expected .bd marker. |
| UI-review + sketch workflows skip-and-warn cleanly when run against BeadsAdapter | BEADS-05 | No consumer workflow exists yet in v1.0. The capability guard is a documented contract for future consumers. Verification is the D-18 conformance stub, which is automated — but the "log a warning" part is manual-only until a real consumer lands. | Phase 5's conformance stub runs with monkeypatched `binaryAsset: false`. Confirm that adding `console.warn` paths in sample consumer code flows correctly. Defer full manual to the first phase that actually consumes writeBinaryAsset. |
| D-TXN Outcome A fallback sequential-commit gap behavior | D-TXN-SPIKE (fallback) | If Plan 06-01 spike lands Outcome A, Phase 7 CONFORM-04 will fail on BeadsAdapter (expected). The "partial-commit on mid-txn failure" behavior is a known gap flagged for Phase 6.1 and cannot be hidden in automation. | Inject a throw after 2-of-3 buffered writes in the in-memory buffer; verify bd state has first 2 writes applied, 3rd absent (partial commit). Document the observed state in BeadsAdapter README. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (the
      planner must fill this out per-task — flag any task that has only
      manual verification as `autonomous: false`)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
      (enforced during planning; relaxed only for the D-TXN spike task
      which is inherently exploratory and lands before bulk impl)
- [ ] Wave 0 covers all MISSING references: bd CLI install, sibling repo
      scaffold, fork-side subpath export, `adapters/types.ts` Capabilities
      extension for graphEdges
- [ ] No watch-mode flags (use `--run` in every vitest invocation — CI
      discipline applies even in dev)
- [ ] Feedback latency < 60s for full both-sides run
- [ ] `nyquist_compliant: true` set in frontmatter once the per-task map
      is fully populated with automated commands

**Approval:** pending
