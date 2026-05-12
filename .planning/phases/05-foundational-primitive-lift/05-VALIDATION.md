---
phase: 5
slug: foundational-primitive-lift
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `05-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing in `sdk/node_modules` and `adapters/node_modules`) |
| **Config file** | `vitest.conformance.config.ts` (conformance); `adapters/vitest.config.ts` (adapter unit); `sdk/vitest.config.ts` (sdk unit) |
| **Quick run command** | `cd sdk && npm test` (SDK unit tests) |
| **Full suite command** | `npm run test:conformance && cd sdk && npm test` |
| **Estimated runtime** | ~30s quick, ~60–90s full |

---

## Sampling Rate

- **After every task commit:** `cd sdk && npm test` (≤30s)
- **After every plan wave:** `npm run test:conformance && cd sdk && npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green + grep gates for D-15 (legacy kind-tagged names) and OQ-02/05/07/10 ADRs in DECISIONS.md.
- **Max feedback latency:** 30s

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| PRIMITIVES-01 | `updateSection` heading-depth walker writes at L2/L3/L4 | unit | `cd sdk && npx vitest run ../tests/conformance/section-depth.test.ts` | ❌ Wave 0 | ⬜ pending |
| PRIMITIVES-01 | `updateSection` under fenced code block / HTML comment is safe | unit | same | ❌ Wave 0 | ⬜ pending |
| PRIMITIVES-01 | `updateSection` under three-author reordering stays atomic | integration | `npx vitest run ../tests/conformance/section-depth.test.ts -t "three-author"` | ❌ Wave 0 | ⬜ pending |
| PRIMITIVES-02 | `getSection` returns body at L3/L4 anchors | unit | `npx vitest run ../tests/conformance/section-depth.test.ts -t "getSection L3"` | ❌ Wave 0 | ⬜ pending |
| PRIMITIVES-02 | `getSection` returns null on missing anchor | unit | same | ❌ Wave 0 | ⬜ pending |
| PRIMITIVES-03 | `withTransaction({dryRun:true})` rolls back all writes | unit | `npx vitest run tests/conformance/write-transaction.test.ts -t "dryRun rollback"` | ⚠️ extend | ⬜ pending |
| PRIMITIVES-03 | Mid-txn failure leaves `.planning/` byte-identical | integration | `npx vitest run tests/conformance/write-transaction.test.ts -t "mid-txn failure"` | ⚠️ extend | ⬜ pending |
| PRIMITIVES-03 | Nested `withTransaction` joins outer txn (reentrancy) | unit | `npx vitest run tests/conformance/write-transaction.test.ts -t "reentrant"` | ⚠️ extend | ⬜ pending |
| PRIMITIVES-03 | `snapshot()` returns opaque id; `restore(id)` rolls back | unit | `npx vitest run tests/conformance/write-transaction.test.ts -t "snapshot restore"` | ⚠️ extend | ⬜ pending |
| PRIMITIVES-04 | `putNamedDoc('research', k, body)` → `getNamedDoc` round-trip | unit | `npx vitest run tests/conformance/named-doc.test.ts` | ❌ Wave 0 | ⬜ pending |
| PRIMITIVES-04 | `putNamedDoc('root', 'HANDOFF', body)` writes to `.planning/HANDOFF.md` | unit | same | ❌ Wave 0 | ⬜ pending |
| PRIMITIVES-04 | `@ts-expect-error` on `putNamedDoc('root', 'ARBITRARY', …)` | static | `cd sdk && tsc --noEmit` (inside test file) | ❌ Wave 0 | ⬜ pending |
| PRIMITIVES-04 | All 8 categories round-trip; grep-zero for legacy names (D-15) | unit + grep | above + `! grep -rn "getResearch\|putIntelDoc\|putCodebaseDoc\|getArchivedMilestoneDoc" sdk/src/ adapters/` | ❌ Wave 0 | ⬜ pending |
| PRIMITIVES-05 | `writeBinaryAsset('foo.png', bytes)` writes bytes verbatim | unit | `npx vitest run tests/conformance/binary-asset.test.ts` | ❌ Wave 0 | ⬜ pending |
| PRIMITIVES-05 | `capabilities.binaryAsset === true` post-Phase 5 | unit | same | ❌ Wave 0 | ⬜ pending |
| PRIMITIVES-05 | Graceful degradation when `binaryAsset:false` (monkeypatch) | unit | `npx vitest run tests/conformance/binary-asset.test.ts -t "graceful"` | ❌ Wave 0 | ⬜ pending |
| PRIMITIVES-06 | Concurrent `updateSection` serializes | integration | `npx vitest run tests/conformance/write-transaction.test.ts -t "updateSection concurrency"` | ⚠️ extend | ⬜ pending |
| PRIMITIVES-07 | ADR records OQ-02 resolution in `.planning/DECISIONS.md` | manual | `grep -n "OQ-02" .planning/DECISIONS.md` | N/A doc | ⬜ pending |
| PRIMITIVES-08 | `nextCallCountGet` reads `.next-call-count`; route-next-action.ts:44 uses helper | unit + grep | `cd sdk && npx vitest run src/query/sidecar.test.ts` + `! grep -n "getRecord.*next-call-count" sdk/src/query/route-next-action.ts` | ❌ Wave 0 | ⬜ pending |
| PRIMITIVES-09 | `discuss.checkpoint.*` + `discuss.questions.*` round-trip at `.planning/phases/NN-*/` | unit | `cd sdk && npx vitest run src/query/scratch.test.ts` | ❌ Wave 0 | ⬜ pending |
| SC #1 | pipeline.ts dry-run with mid-txn failure leaves `.planning/` byte-identical | integration | `cd sdk && npx vitest run src/query/pipeline.test.ts -t "mid-txn failure byte-identical"` | ⚠️ extend | ⬜ pending |
| SC #2 | Three-author AI-SPEC concurrency | integration | covered by PRIMITIVES-01 three-author | ❌ Wave 0 | ⬜ pending |
| SC #3 | Legacy kind-tagged grep-zero | grep | covered by PRIMITIVES-04 grep gate | N/A CI | ⬜ pending |
| SC #4 | binaryAsset capability flip + graceful degradation | unit | covered by PRIMITIVES-05 | ❌ Wave 0 | ⬜ pending |
| SC #5 | ADRs for OQ-02, OQ-05, OQ-07, OQ-10 in DECISIONS.md | manual | `grep -n "OQ-02\|OQ-05\|OQ-07\|OQ-10" .planning/DECISIONS.md` | N/A doc | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/conformance/section-depth.test.ts` — PRIMITIVES-01, PRIMITIVES-02, SC#2 (L2/L3/L4 anchors, fenced-code, HTML-comment, three-author concurrency).
- [ ] `tests/conformance/named-doc.test.ts` — PRIMITIVES-04, SC#3 (8-category round-trip, typed-overload compile-time assertion).
- [ ] `tests/conformance/binary-asset.test.ts` — PRIMITIVES-05, SC#4 (write, capability flip, graceful degradation).
- [ ] `sdk/src/query/sidecar.test.ts` — PRIMITIVES-08 (`nextCallCountGet`/`nextCallCountIncr`).
- [ ] `sdk/src/query/scratch.test.ts` — PRIMITIVES-09 (`discuss.checkpoint.*`, `discuss.questions.*`).
- [ ] Extend `tests/conformance/write-transaction.test.ts` — dryRun rollback, mid-txn failure byte-identical, reentrancy, snapshot/restore, updateSection concurrency, nested dryRun propagation.
- [ ] Extend `sdk/src/query/pipeline.test.ts` — dryRun via withTransaction, mid-txn failure byte-identical (SC#1).
- [ ] No new framework install needed — vitest already configured.
- [ ] ADR stubs for OQ-02/05/07/10 in `.planning/DECISIONS.md` (final plan).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ADR text for OQ-02/05/07/10 in DECISIONS.md | PRIMITIVES-07, SC #5 | Prose/documentation artifact — content review, not executable | Read `.planning/DECISIONS.md`, verify ADRs for OQ-02 (section granularity locked to section; L3+ now supported), OQ-05 (sidecar named SDK verbs), OQ-07 (scratch first-class types), OQ-10 (updateSection internally withTransaction-wrapped) — each with alternatives + rationale. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
