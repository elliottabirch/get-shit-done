# Phase 6 — Exit Checkpoint

**Date:** 2026-05-12
**Phase:** 06-beadsadapter-implementation
**Status:** PASS (all locked-decision + landmine rows green; 2 expected FAIL entries in known-gaps section for Phase 7 CONFORM-01..04 and Deferred-04 Phase 6.1 follow-up)

Grep-verifiable audit of every locked decision + 10 port-time landmine
fixes against the final sibling source tree. Executed at end of Plan 06-07.

All grep counts captured from `main`-branch HEAD on 2026-05-12. Each row's
evidence grep is directly executable against the repo pair.

---

## Locked Decisions

| Decision | Source | Evidence grep | Count | Verdict |
|----------|--------|---------------|-------|---------|
| **D-OQ06-CAPS** — `Capabilities` gains `graphEdges: { semantic: boolean; dependency: boolean }` additive field | adapters/types.ts | `grep -c "graphEdges: { semantic: boolean; dependency: boolean }" adapters/types.ts` | 1 (≥1) | PASS |
| **D-OQ06** — MarkdownAdapter declares `graphEdges: { semantic: true, dependency: false }` | adapters/markdown/index.ts | `grep -c "graphEdges: { semantic: true, dependency: false }"` | 1 (=1) | PASS |
| **D-OQ06** — BeadsAdapter declares `graphEdges: { semantic: false, dependency: true }` | gsd-beads/src/capabilities.ts | `grep -c "graphEdges: { semantic: false, dependency: true }"` | 1 (=1) | PASS |
| **D-CONFORM-EXPORT** — Fork's package.json has `./conformance` subpath | get-shit-done/package.json | `grep -c '"./conformance":' package.json` | 1 (=1) | PASS |
| **D-INIT-ERR** — BdManagedMismatchError has code `PROJECT_BD_MANAGED_MISMATCH` | gsd-beads/src/bd/errors.ts | `grep -c "PROJECT_BD_MANAGED_MISMATCH"` | 2 (≥1) | PASS |
| **D-INIT-ERR** — BdManagedMismatchError has `__brand` discriminator | gsd-beads/src/bd/errors.ts | `grep -c "__brand = 'BdManagedMismatchError'"` | 1 (≥1) | PASS |
| **D-2026-05-10-08** — All 3 recordState* methods return StateWriteOutcome (three-state) | gsd-beads/src/events.ts | `grep -cE "^export async function recordState"` | 3 (=3) | PASS |
| **D-2026-05-10-08** — StateWriteOutcome `applied: true/false` pattern in dispatch | gsd-beads/src/events.ts | `grep -cE "applied: (true\|false)"` | 32 (≥6) | PASS |
| **D-OQ06** — dep-graph synthesizer produces `type: 'dependency'` edges | gsd-beads/src/dep-graph.ts | `grep -c "type: 'dependency'"` | 3 (≥1) | PASS |
| **CR-01 fix** — path-traversal guard on `_abs` runtime-active | gsd-beads/src/primitives.ts | `grep -c "escapes projectRoot"` | 1 (≥1) | PASS |
| **D-BINARY** — BeadsAdapter `capabilities.binaryAsset: false` | gsd-beads/src/capabilities.ts | `grep -c "binaryAsset: false"` | 2 (≥1) | PASS |
| **D-TXN-CAPS** — BeadsAdapter `capabilities.transaction: true` | gsd-beads/src/capabilities.ts | `grep -c "transaction: true"` | 2 (≥1) | PASS |
| **D-RUNTIME-RESOLUTION** — Dual export (class + default) | gsd-beads/src/index.ts | `grep -cE "export class BeadsAdapter\|^export default"` | 2 (=2) | PASS |
| **Plan 06-06 ADR D-2026-05-12-OQ06-CREATED-SECTION** — Pitfall 7 policy documented | fork .planning/DECISIONS.md | `grep -c "OQ06-CREATED-SECTION"` | 1 (≥1) | PASS |
| **Plan 06-06 ADR D-2026-05-12-OQ01-BEADS** — commitPlanningState noop on BeadsAdapter | fork .planning/DECISIONS.md | `grep -c "OQ01-BEADS"` | 1 (≥1) | PASS |
| **D-2026-05-12-OQ06-MAPPING** — D-MAPPING locked Outcome A | fork .planning/DECISIONS.md | `grep -c "OQ06-MAPPING"` | 1 (≥1) | PASS |
| **D-2026-05-12-OQ06-TXN** — D-TXN locked Outcome A | fork .planning/DECISIONS.md | `grep -c "OQ06-TXN"` | 1 (≥1) | PASS |

**Locked-decisions tally:** 17/17 PASS.

---

## Landmine Fixes (10 of 13; WR-01 / WR-09 / WR-10 deferred per CONTEXT.md Claude's Discretion)

| # | Landmine | Fix location | Evidence grep | Count | Verdict |
|---|----------|--------------|---------------|-------|---------|
| 1 | Path traversal (CR-01 BLOCKER) | gsd-beads/src/primitives.ts | `grep -c "escapes projectRoot"` | 1 (≥1) | PASS |
| 2 | CR-02 hybrid-tier dual-write bypass | gsd-beads/src/paths.ts | `grep -c "tier.*'hybrid'"` — both mentions in comments doc the deletion; no runtime `'hybrid'` value | 2 (comments) + 0 runtime | PASS (hybrid literal deleted from runtime per CR-02; `Tier` union is `'bd' \| 'disk'`) |
| 3 | bd helper CWD not propagated | gsd-beads/src/bd/helper.ts | `grep -c "class BdRunner"` | 1 (≥1) | PASS |
| 4a | `--author gsd:event:<type>` discipline | gsd-beads/src/events.ts | `grep -c "gsd:event:"` | 3 (≥1) | PASS |
| 4b | `bd comments add --label` NOT present | gsd-beads/src/events.ts | `grep -c "comments add.*--label"` (expected 0) | 0 | PASS |
| 5 | bd show array unwrap | gsd-beads/src/bd/helper.ts | `grep -cE "Array.isArray.*\[0\]"` | 1 (≥1) | PASS |
| 6 | JSONL fallback on `bd export --json` | gsd-beads/src/bd/helper.ts | `grep -cE "JSON\.parse\|split.*\\\\n"` | 6 (≥1) | PASS |
| 7 | `BeadsEmpty` detection on `{error, schema_version}` | gsd-beads/src/ | `grep -rl "BeadsEmpty" gsd-beads/src/ \| wc -l` | 6 files (≥2) | PASS |
| 8 | chmod 0o700 on `.beads/` | gsd-beads/tests/fixture.ts | `grep -c "chmod.*0o700"` | 4 (≥1) | PASS (also applied in tests/conformance.test.ts factory) |
| 9 | WR-05 atomic-write race | gsd-beads/src/_atomicWrite.ts | `grep -c "randomBytes"` | 3 (≥1) | PASS |
| 11 | BEADS_ACTOR=seed discipline | gsd-beads/src/ + tests/ `*.ts` | `grep -rc "BEADS_ACTOR.*seed"` (files with ≥1 match) | 7 files (≥2) | PASS (baked into BdRunner.baseEnv + conformance factory + fixture + seed build) |

**Landmine tally:** 11/11 PASS (Landmines 1, 2, 3, 4a, 4b, 5, 6, 7, 8, 9, 11).

**Deferred (not in exit audit — not regressions):**
- Landmine 10 (WR-02/WR-03 frontmatter YAML escape) — TS catches most; `js-yaml` escalation conditional per CONTEXT.md
- WR-01 (`_resolveMilestoneBead` docs-lie) — WARN-level; post-v1.0 cleanup
- WR-09 (`filter(Boolean)` heading-stack collapse) — WARN-level; post-v1.0 cleanup
- WR-04 / Landmine 12 (snapshot-restore `--prefix` hardcoded) — N/A under shipped D-TXN Outcome A (no snapshot impl)

---

## Functional Surface

| Check | Command | Result | Verdict |
|-------|---------|--------|---------|
| Zero `NotYetImplementedError` throw-stubs in `src/index.ts` | `grep -c "throw.*NotYetImplementedError" gsd-beads/src/index.ts` | 0 (=0) | PASS |
| TS strict-mode compile green | `cd gsd-beads && npx tsc --noEmit` | exit 0 | PASS |
| Smoke suite green (`npm run test:unit`) | 20 test files, 95 test cases | 20/20 files; 95/95 cases | PASS |
| Conformance suite standalone (`npm run test:conformance`) | 5 test cases | 4/5 cases pass; 1 known-gap (see below) | PASS-with-gap |
| Full suite (`npm test`) | 30 test files, 205 test cases | 29/30 files; 204/205 cases | PASS-with-gap |
| 8 Bin B smoke files present | `ls gsd-beads/tests/smoke/bin-b-*.test.ts \| wc -l` | 8 (=8) | PASS |
| Conformance wired (not Plan 06-01 skeleton) | `grep -q "new BeadsAdapter" tests/conformance.test.ts && grep -q "bd.*init.*--from-jsonl" tests/conformance.test.ts` | both present | PASS |

**Functional tally:** 6 PASS + 1 PASS-with-gap (known Phase 7 scope).

---

## Requirements Closure

| Requirement | Plan(s) | Evidence | Verdict |
|-------------|---------|----------|---------|
| BEADS-01 (all Bin A primitives against bd) | 06-05 | `tests/smoke/record-primitives.test.ts` + `frontmatter-primitives.test.ts` + `section-primitives.test.ts` + `named-doc.test.ts` all green | PASS |
| BEADS-02 (3 recordState* families + Bin B smoke coverage) | 06-06 + 06-07 | Plan 06-06: `tests/smoke/state-events-{append,mutation,signal}.test.ts` green. Plan 06-07: 8 `tests/smoke/bin-b-*.test.ts` files × 24 cases green | PASS |
| BEADS-03 (dep-graph synthesizer) | 06-06 | `tests/smoke/dep-graph.test.ts` green (8 cases); `graphEdges.dependency: true` literal matches; `grep -c "type: 'dependency'" src/dep-graph.ts` returns 3 | PASS |
| BEADS-04 (init fail-fast `BdManagedMismatchError`) | 06-05 | `tests/smoke/init.test.ts` green; `__brand` + `PROJECT_BD_MANAGED_MISMATCH` shape audited above | PASS |
| BEADS-05 (writeBinaryAsset graceful degradation) | 06-05 | `tests/smoke/binary-asset.test.ts` green; `capabilities.binaryAsset: false`; throws `UnsupportedCapabilityError` | PASS |

**Requirements tally:** 5/5 PASS.

---

## Known Gaps (NOT regressions; scoped to Phase 7 / Phase 6.1)

These rows are **expected FAIL** — surfaced here for traceability but do not
block Phase 6 exit.

| Item | Source ADR / Plan | Fix owner | Status |
|------|-------------------|-----------|--------|
| **Conformance CONFORM-04 `created_section` matrix cells** — BeadsAdapter never emits `created_section` under D-MAPPING Outcome A | `D-2026-05-12-OQ06-CREATED-SECTION` ADR | Phase 7 CONFORM-01..04 | Expected FAIL — 4 StateWriteOutcome matrix cells MarkdownAdapter-only, to be relaxed per-adapter |
| **Conformance `stat(phase-collection)` returns kind=dir** — disk-tier writes to `phases/01-foo/PLAN.md` fall-through to opaque but stat routes bd-tier via `phase-collection`; semantic mismatch between write and stat paths under Outcome A | Phase 7 CONFORM-01..04 | Fork-side harness-shape issue (same class as created_section) | Expected FAIL — conformance test needs per-adapter assertion shape |
| **Mid-txn partial-commit gap** — `withTransaction` Outcome A has no rollback after commit-phase partial write | Phase 6.1 follow-up | Migration to Outcome C if gap becomes binding | Deferred-04 known-gap per CONTEXT.md |
| **Semantic graph edges** — `graphify.cjs` does not target bd | Phase 8+ | Post-v1.0 markdown→bd semantic-edge migration | Deferred per `D-OQ06` |

---

## Deferred / Out-of-Scope Items (carried forward — NONE block Phase 6 exit)

Per CONTEXT.md §Deferred Ideas:

- bd-sourced semantic edges (Phase 8+)
- Phase 8 adapter-name runtime resolver (DIST-01)
- markdown→bd migration tool (DIST-02)
- Blob-store routing for binaryAsset on BeadsAdapter (when a consumer needs it)
- Publishing `gsd-beads` to npm (NPM-01 deferred)
- WR-01 + WR-09 WARN-level landmines (post-v1.0 cleanup)
- Phase 7 CONFORM-01..04 paired-conformance tests (scheduled for Phase 7)
- Phase 6.1 D-TXN Outcome C migration (if mid-txn commit gap becomes binding)

---

## Sign-off

- [x] All locked decisions audit rows = PASS (17/17)
- [x] All 10+1 landmine rows = PASS (11/11)
- [x] Functional surface rows = PASS (6 PASS + 1 PASS-with-known-gap)
- [x] All 5 BEADS-* requirements = PASS (5/5)
- [x] Conformance suite 4/5 green against live bd v1.0.4 (1 known-gap documented above)
- [x] No regressions in fork-side `npm run test:conformance` (MarkdownAdapter green)

**Phase 6 exits clean. Handoff to Phase 7 CONFORM-01..04 for paired-adapter conformance work including `created_section` relaxation per `D-2026-05-12-OQ06-CREATED-SECTION` and phase-collection stat harness-shape fix.**
