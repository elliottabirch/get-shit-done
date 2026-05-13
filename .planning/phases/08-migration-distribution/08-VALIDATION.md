---
phase: 8
slug: migration-distribution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node `node:test` (CJS tests) + vitest (conformance/adapter projects) |
| **Config file** | `scripts/run-tests.cjs` (CJS harness); `vitest.conformance.config.ts`; `vitest.config.ts` (adapters + sdk projects) |
| **Quick run command** | `npm run test` (CJS) |
| **Full suite command** | `npm run test:coverage && npm run test:conformance:paired` |
| **Estimated runtime** | ~90s quick / ~4m full on Ubuntu 22 + Node 22 (post Phase 7 CONFORMANCE_DEEP gate) |

Plan-specific validation:
- **Pre-0** (alias generator rewrite): `node sdk/scripts/check-command-aliases-fresh.mjs` must exit 0 after regeneration.
- **DIST-01** (factory + call-site migration): `npm test` (CJS) + `npm run test:conformance:paired` (both adapters via factory). Factory unit tests live in `sdk/src/query/adapter-factory.test.ts` (new file).
- **DIST-02** (fork-side docs): `npm run lint:descriptions` + markdown link check on `docs/MIGRATION.md`.
- **DIST-03** (rebase playbook): `bash -n scripts/sync-upstream.sh` (syntax check) + manual smoke against a no-op rebase.
- **DIST-04** (parity workflow): `.github/workflows/upstream-parity.yml` actionlint; CI smoke on PR.
- **DIST-05** (ADR): prose check only (no automated test — it's a decision record).

---

## Sampling Rate

- **After every task commit:** Run `npm test` (CJS) — quick-path coverage catches SDK regressions under 90s.
- **After every plan wave:** Run `npm run test:conformance:paired` — enforces bidirectional manifest invariant on any factory-touching changes.
- **Before `/gsd-verify-work`:** Full suite + upstream parity must be green. Parity workflow (added in DIST-04) gates PR merges.
- **Max feedback latency:** 90 seconds for CJS; 3-4 minutes for full paired conformance.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD — planner fills this table in each PLAN.md | — | — | — | — | — | — | — | — | ⬜ pending |

*Planner agent populates this table from each PLAN's task list. Leaving scaffolded so the Nyquist contract is visible before planning.*

---

## Wave 0 Requirements

- [ ] `sdk/src/query/adapter-factory.test.ts` — unit tests for `createStorageAdapter()` factory (DIST-01). Covers: default markdown path, `storage.adapter=beads` path, missing-beads fail-fast error, missing-bd-binary fail-fast error.
- [ ] `tests/shared/sanitize.ts` — extracted sanitize helper (shared between `tests/conformance/init-bundlers.test.ts` and DIST-04's parity workflow). No new test needed; existing callers re-import.
- [ ] `.github/workflows/upstream-parity.yml` — new CI workflow (DIST-04). Actionlint gate ensures YAML is valid.
- [ ] `scripts/sync-upstream.sh` — syntax check gate (`bash -n`).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `gsd-beads migrate` end-to-end markdown → bd round-trip | DIST-02 (sibling-owned) | Sibling implementation; fork cannot exercise without real bd store. | In sibling: run migration against a fork-owned `.planning/` fixture, verify conformance manifest round-trips cleanly. Documented in sibling's Phase 8. |
| Real-world rebase against upstream/main post-merge | DIST-03 | Requires live upstream commits post-2026-04-30; cannot script a fake. | Run `scripts/sync-upstream.sh` after next upstream release; confirm leak-grep output + conflict taxonomy match doc. |
| PR-vs-long-lived-fork decision (DIST-05) | DIST-05 | Decision record, not behavior. | Write ADR at phase close citing upstream's reception of #2898/#2901/#2908 and fork's Phase 8 execution outcome. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s (quick) / < 4 min (full)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
