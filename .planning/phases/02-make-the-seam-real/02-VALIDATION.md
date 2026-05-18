---
phase: 02
slug: make-the-seam-real
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `02-RESEARCH.md` §"Validation Architecture" + CONTEXT.md decisions D-15/D-18 (atomic-commit separation + per-commit build+test gate).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.1.1 [VERIFIED: sdk/package.json] |
| **Config file** | `sdk/vitest.config.ts` (unit + integration projects) |
| **Quick run command** | `npm run build:sdk-only && cd sdk && npm run test:unit` |
| **Full suite command** | `cd sdk && npm test` |
| **Conformance command** | `npm run test:conformance:paired` (from repo root) |
| **Estimated runtime — quick** | ~22 seconds (build ~15s + unit ~7s) |
| **Estimated runtime — full** | ~5 minutes (sdk full suite) |
| **Estimated runtime — conformance** | ~140 seconds [VERIFIED in research session] |
| **Estimated runtime — phase gate** | ~7–8 minutes (build + sdk full + conformance paired) |

---

## Sampling Rate

- **After every task commit (D-15 atomic commit pair):** Run `npm run build:sdk-only && cd sdk && npm run test:unit` (~22s). Each commit in the pair is gated independently — commit 1 (thread adapter) gates green, then commit 2 (propagate StateWriteOutcome) is staged.
- **After every plan wave (end of wave merge):** Run `cd sdk && npm test` (~5 min). Catches regressions across wave boundaries.
- **Before phase cutover (canonical `feat/storage-adapter` advance):** Full phase gate must pass: `npm run build:sdk-only && cd sdk && npm test && npm run test:conformance:paired` (~7–8 min).
- **Max feedback latency (per-commit gate):** ~22 seconds.

**D-18 enforcement:** A commit may NOT land before the per-commit gate is green. NEVER bundled with subsequent work. Gate failure → revert/fix in a new commit on the staging branch, never `--amend` or `--no-verify` past the gate.

---

## Per-Task Verification Map

> One row per phase requirement. Per-plan task-level rows are populated by the planner during plan-phase.

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| SEAM-01 | `grep "adapterFor(projectDir)" sdk/src/query/` returns 0 lines | Structural grep | `[ "$(grep -rn "adapterFor(projectDir)" sdk/src/query/ | wc -l | tr -d ' ')" = "0" ]` | N/A — post-migration assertion | ⬜ pending |
| SEAM-02 | `adapterFor` symbol absent from `sdk/src/query/helpers.ts` | Structural (file content) + build | `! grep -q "^export.*function adapterFor" sdk/src/query/helpers.ts && npm run build:sdk-only` | N/A | ⬜ pending |
| SEAM-03 | All migrated handlers receive `adapter: StorageAdapter` as first arg | Build (TypeScript) | `npm run build:sdk-only` exits 0 | N/A | ⬜ pending |
| SEAM-04 | bd-tier round-trip: `state.milestone-switch` under `adapter: "beads"` reaches bd | Conformance | `npm run test:conformance:paired -- -t "seam-realness"` | ❌ Wave 0 | ⬜ pending |
| SEAM-05 | markdown byte-identical regression vs upstream golden | Conformance | `npm run test:conformance:paired -- -t "seam-realness"` (markdown side) | ❌ Wave 0 | ⬜ pending |
| SEAM-06 | All state-mutation handlers exercised against both adapters; ≥95% pass | Conformance | `npm run test:conformance:paired` full manifest; gate computes `(non-known-gap entries / total) >= 0.95` | ❌ Wave 0 | ⬜ pending |
| DEFECT-02 | >64KB body byte-identical round-trip on both adapters | Conformance (large-body fixture) | `npm run test:conformance:paired -- -t "large-body"` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

These artifacts MUST exist before any production-code task can claim its acceptance criteria. The planner MUST schedule them in Wave 0 (or early Wave 1) and gate subsequent waves on their existence.

- [ ] `adapters/types.ts` — add `getTouchedPaths(): Set<string>` to `StorageAdapter` interface (D-03)
- [ ] `adapters/markdown/index.ts` — implement `getTouchedPaths()` returning the existing `TxnCtx.touchedPaths` set; delete `_txnContextForPipeline` and `_realReadForPipeline` (D-02, same commit or follow-on per planner)
- [ ] **Sibling-repo prerequisite:** `gsd-beads/src/index.ts` — implement `getTouchedPaths()` on BeadsAdapter via best-effort fallback (D-04). Sibling repo must bump semver and this fork's `gsd-beads/testing` consumer must `npm install` to pick up. Planner MUST sequence this BEFORE adapter-threading commits because pipeline.ts and conformance tests will call the new method.
- [ ] `tests/conformance/manifest-types.ts` — extend `ManifestEntryKind` union with `'seam-realness'` (D-10)
- [ ] `tests/conformance/manifest.ts` — add ~30 `kind: 'seam-realness'` entries (stubs acceptable in Wave 0; bodies filled as handler-family commits land)
- [ ] `tests/conformance/paired-seam-markdown.test.ts` — paired runner exercising migrated state-mutation handlers via registry dispatch (markdown side; SEAM-04 markdown, SEAM-05, SEAM-06)
- [ ] `tests/conformance/paired-seam-beads.test.ts` — paired runner (bd side; SEAM-04 bd, SEAM-06 bd column)
- [ ] `tests/conformance/manifest.ts` — add DEFECT-02 large-body entry (>64KB STATE.md body) with byte-identical assertion under both adapters
- [ ] `sdk/src/query/pipeline.test.ts` — replace any direct `adapterFor` / `_adapterCache` usage with registry-dispatched test paths (test will fail-to-compile when D-01 deletes adapterFor; this is intentional)
- [ ] **Pre-flight callsite audit artifact:** `02-CALLSITE-AUDIT.md` (or section in RESEARCH.md) confirming all state-mutation handler callers are unbound — already produced in research; planner re-confirms before wave 1.

---

## Validation Beyond "grep == 0"

SEAM-01's grep gate is necessary but not sufficient. A renamed helper would pass the grep but still bypass the configured adapter. The conformance suite is the structural proof.

**Three-layer proof of seam realness:**

1. **TypeScript compile** — every migrated handler accepts `adapter: StorageAdapter` as first arg. The build won't catch a function that internally constructs a MarkdownAdapter via lazy `import()` (the original anti-pattern), but the closure wrapper in `createRegistry` is the single place where the adapter is constructed, so a renamed helper would have to be reachable via that closure to be exercised.

2. **SEAM-04 round-trip via real CLI** — configure `adapter: "beads"` in `.planning/config.json`, invoke `gsd-sdk query state.milestone-switch --milestone vTest --name "SeamTest"` via the real CLI binary (NOT by calling the handler function directly). Assert: bd store contains the written record AND `.planning/STATE.md` on disk does NOT contain the new content. This is the observable evidence that routing actually changed.

3. **Registry-dispatch conformance entries** — `kind: 'seam-realness'` entries exercise handlers via `registry.dispatch(cmd, args, projectDir)`, not by calling handler functions directly. Direct calls bypass the closure wrapper and would pass even if the registry wasn't updated. The runner assertion: dispatch invocation must produce the same observable side-effect under both adapters (within their declared divergence per `adr:` annotations).

**Byte-identical regression test fixtures (SEAM-05):**

- Use existing `tests/conformance/` fixture directory pattern (each test creates its own `mkdtemp` dir).
- The fixture is a minimal `.planning/` tree with a valid `STATE.md` in current-milestone format.
- After `state.milestone-switch`, compare resulting `STATE.md` against an upstream golden output via `===` on string content (not on file mtime/inode).
- "Upstream golden" is computed by running the same handler against a MarkdownAdapter on a clean fixture directory in the same test process — no reference to an upstream binary required.

**95% gate computation rule (SEAM-06):**

```
pass_rate = (entries where kind != 'known-gap' AND test result PASS) / total kind:'seam-realness' entries
gate: pass_rate >= 0.95
```

The rule is reproducible from `tests/conformance/manifest.ts` alone — no out-of-band counter file. Any sub-95% handler MUST be enumerated by name as `kind: 'known-gap'` with a required `adr:` reference (per D-12). Silent skip is impossible because `meta-coverage.test.ts` enforces manifest ↔ test-registry bidirectional invariant.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real CLI integration round-trip under `adapter: "beads"` | SEAM-04 | Conformance suite uses in-process registry dispatch; this verification proves the *external* CLI binary (after build) honors the seam | (1) `npm run build:sdk-only`; (2) Set `storage.adapter: "beads"` in `.planning/config.json`; (3) `gsd-sdk query state.milestone-switch --milestone vTest --name "SeamTest"`; (4) `bd show <singleton-id>` confirms written record; (5) `cat .planning/STATE.md` confirms NO new content on disk |
| Strict-superset invariant under default config | SEAM-05 | The conformance suite tests against an in-process golden, not against the real upstream binary; one manual spot-check confirms there's no drift introduced by the closure-wrapper itself | (1) Remove `storage.adapter` key from `.planning/config.json`; (2) Run any state-mutation CLI command (e.g. `state.add-decision`); (3) Compare `.planning/STATE.md` content against the same operation on `upstream/main` at `ae63cbe5` |

---

## Validation Sign-Off

- [ ] All Wave 0 artifacts exist before Wave 1 begins
- [ ] Per-commit gate (build + test:unit ~22s) passes after every commit in every D-15 commit pair
- [ ] Per-wave gate (sdk full suite ~5 min) passes at end of each wave
- [ ] Phase gate (build + sdk full + conformance paired ~7–8 min) passes before canonical branch cutover
- [ ] Sampling continuity: no commit lands without its per-commit gate green; no wave merges without its per-wave gate green
- [ ] Wave 0 covers all MISSING references in the per-task verification map above
- [ ] No watch-mode flags (no `--watch`, no `vitest dev`)
- [ ] Feedback latency < 30s for per-commit gate
- [ ] Manual verifications above run before phase close
- [ ] `nyquist_compliant: true` set in this file's frontmatter after sign-off

**Approval:** pending
