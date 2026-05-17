---
phase: 7
slug: conformance-test-suite
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `07-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.6 (already shipped fork + sibling) |
| **Config file** | `vitest.conformance.config.ts` (existing; Wave 2 extends globs to include paired.test.ts) |
| **Quick run command** | `npm run test:conformance` (existing — MarkdownAdapter-only, fast, no bd required) |
| **Full suite command** | `npm run test:conformance:paired` (NEW in Wave 2 — both adapters; requires bd v1.0.4+ locally or skip-with-warning) |
| **Estimated runtime** | Quick: ~5–10s (MarkdownAdapter). Paired: ~30–60s (adds BeadsAdapter cold-start ~400–700ms per test; fast-check property tests adaptive-budgeted at 60s per noun per adapter per D-14). |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:conformance` (fast; no bd dependency; catches MarkdownAdapter regressions + type errors).
- **After every plan wave:** Run `npm run test:conformance:paired` (full; both adapters + meta-coverage + property round-trips + failure-injection).
- **Before `/gsd-verify-work`:** Paired suite must be green.
- **Max feedback latency:** ~60s (vitest + fast-check adaptive budget).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-01-* | 07-01 | 0 | CONFORM-01, CONFORM-02 | — | normalize() additive; no behavior change | unit | `npm run test -- adapters/markdown/index.test.ts` | ✅ (extend) | ⬜ pending |
| 7-01-* | 07-01 | 0 | CONFORM-01 | — | manifest + test-registry types compile | type | `npm run typecheck` | ❌ W0 (NEW) | ⬜ pending |
| 7-02-* | 07-02 | 0 | CONFORM-01, CONFORM-03 | — | section-anchor grep script emits deterministic JSON; dynamic anchors gated | unit | `node scripts/extract-section-anchors.mjs --check` | ❌ W0 (NEW) | ⬜ pending |
| 7-02-* | 07-02 | 0 | CONFORM-01, CONFORM-03 | — | meta-coverage detects orphans + missing entries | meta | `npm run test:conformance -- tests/conformance/meta-coverage.test.ts` | ❌ W0 (NEW) | ⬜ pending |
| 7-03-* | 07-03 | 1 | CONFORM-01, CONFORM-02 | — | sibling ./testing subpath resolves; BeadsAdapter normalize deterministic round-trip | unit | `cd /Volumes/code/gsd-beads && npm test -- tests/smoke/normalize.test.ts` | ❌ W1 (NEW) | ⬜ pending |
| 7-04-* | 07-04 | 2 | CONFORM-01, CONFORM-03 | — | paired harness runs both adapters; StateWriteOutcome matrix paired | integration | `npm run test:conformance:paired -- tests/conformance/paired.test.ts` | ❌ W2 (NEW) | ⬜ pending |
| 7-04-* | 07-04 | 2 | CONFORM-01 | — | bd install step executes on CI Ubuntu/macOS | ci | `.github/workflows/ci.yml` matrix run | ❌ W2 (NEW/EDIT) | ⬜ pending |
| 7-05-* | 07-05 | 3 | CONFORM-02 | — | per-noun arbitraries + round-trips pass under adaptive budget | property | `npm run test:conformance:paired -- tests/conformance/properties.test.ts` | ❌ W3 (NEW) | ⬜ pending |
| 7-06-* | 07-06 | 3 | CONFORM-04 | — | mid-txn failure → byte-identical rollback on markdown | integration | `npm run test:conformance:paired -- tests/conformance/failure-injection.test.ts -t markdown` | ❌ W3 (NEW) | ⬜ pending |
| 7-06-* | 07-06 | 3 | CONFORM-04 | — | mid-txn failure → record-identical rollback on beads OR documented known-gap entry | integration | `npm run test:conformance:paired -- tests/conformance/failure-injection.test.ts -t beads` | ❌ W3 (NEW) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/conformance/manifest-types.ts` — ManifestEntry + ExpectedOutcome type definitions
- [ ] `tests/conformance/manifest.ts` — CONFORMANCE_MANIFEST const (skeleton; populated in Wave 2)
- [ ] `tests/conformance/test-registry.ts` — registration Set + `assertFromManifest(...)` helper
- [ ] `tests/conformance/meta-coverage.test.ts` — bidirectional coverage meta-test
- [ ] `scripts/extract-section-anchors.mjs` — grep script + dynamic-anchor gate per D-08
- [ ] `.github/workflows/ci.yml` — bd install step (NEW or EDIT depending on existing workflow)
- [ ] Framework install: NONE needed — vitest + fast-check + js-yaml already present or trivially added.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| bd v1.0.4+ available on developer machine | CONFORM-01 | Skip-with-warning path cannot prove presence; only absence | Developer runs `bd --version` and confirms ≥1.0.4 before running paired suite locally |
| CI workflow passes end-to-end on a representative Ubuntu + macOS runner pair | CONFORM-01 | First activation of bd install step can't be unit-tested | PR that triggers paired CI on both runners and observes green |

*All other phase behaviors have automated verification via the per-task map above.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (manifest types, registry, meta-coverage, grep script)
- [ ] No watch-mode flags (vitest runs in `--run` mode; fast-check uses `interruptAfterTimeLimit`)
- [ ] Feedback latency < 60s for paired suite under adaptive budget
- [ ] `nyquist_compliant: true` set in frontmatter at phase exit

**Approval:** pending
