---
phase: 1
slug: fork-bootstrap-storageadapter-interface-skeleton-markdownada
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — `sdk/vitest.config.ts`, fork-root `vitest.config.ts`) |
| **Config file** | `sdk/vitest.config.ts` (sdk tests), `vitest.config.ts` (fork-level integration) |
| **Quick run command** | `cd sdk && npm test -- --run --reporter=dot` |
| **Full suite command** | `npm test` (fork root — runs `node scripts/run-tests.cjs`) |
| **Estimated runtime** | ~30s quick / ~2-3 min full |

---

## Sampling Rate

- **After every task commit:** `cd sdk && npm test -- --run` (only re-run tests touching changed files when feasible)
- **After every plan wave:** Full suite (`npm test` at fork root)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds (quick), ~3 minutes (full)

---

## Per-Task Verification Map

*Filled in during/after planning — one row per planned task. Each task should have an automated verify command or a Wave 0 dependency that delivers the test infrastructure.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD     | TBD  | TBD  | TBD         | —          | N/A             | TBD       | TBD               | ⬜          | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/conformance/harness.ts` — adapter-parameterized test factory (D-15)
- [ ] `tests/conformance/markdown-adapter.test.ts` — sample `getRecord` round-trip test against MarkdownAdapter (D-15)
- [ ] `adapters/types.ts` — `StorageAdapter` interface + `Capabilities` type + `UnsupportedCapabilityError` class + companion type guards (D-10, D-11)
- [ ] `adapters/markdown/index.ts` — `MarkdownAdapter` class (Bin A + markdownLockfile + commitPlanningState implementations; foundationals throw)
- [ ] `tsconfig.json` adjustments (or new `adapters/tsconfig.json`) so `adapters/` compiles cleanly per researcher finding #4

*Wave 0 delivers the test infrastructure (`tests/conformance/`) plus the type surface that everything else builds on.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Per-PR ADRs in DECISIONS.md (D-12) | ADAPTER-05 | Requires reading upstream PR descriptions / merge state, not testable from code | Verify `.planning/DECISIONS.md` contains 4 new entries (one per PR #2898/#2901/#2908/#2909) each with verdict, contract impact, rebase risk |
| OQ-08 resolution captured | ADAPTER-07 | Documentary requirement | Verify CONTEXT.md D-09 + DECISIONS.md cross-reference each other |
| `markdownLockfile` capability shape correctness | ADAPTER-02, ADAPTER-07 | TypeScript type-correctness + the actual call sites that today use `replaceInCurrentMilestone` / `readModifyWriteRoadmapMd` route through the adapter | Type-check passes; grep shows zero direct CJS imports of these helpers from non-adapter code |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (quick) / 3min (full)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---

## Failure Modes Phase 1 Validation Catches

Per RESEARCH §"Validation Architecture":

1. **Interface drift between TS and CJS shapes** — wrap-strategy MarkdownAdapter calls into CJS via `createRequire`. If a CJS function's signature drifts (e.g. extra parameter added during rebase), the adapter call breaks. Validation: per-method round-trip tests in conformance harness; type assertions on the wrapped-CJS return shapes.

2. **Call-site breakage from `createRegistry()` signature change** — D-07 makes `adapter` required, so all 4 production sites + ~79 test sites must update. Missing one = runtime crash. Validation: TypeScript compile-error budget = 0 after wave 1; CI runs the full test suite to catch any test that constructs `createRegistry()` without arguments.

3. **Leak-grep false positives/negatives** — D-14 ships a script that scans for direct I/O patterns. False positives block legitimate work; false negatives let regressions through. Validation: ship known-good and known-bad fixture files in `tests/leak-grep/`; assert script flags the bad ones and ignores the good ones.

4. **Capability flag misuse** — Consumers calling `adapter.snapshot()` without checking `capabilities.snapshot`. Defensive throw in MarkdownAdapter catches it at runtime; companion type guards (`hasSnapshot`) catch it at compile time. Validation: TypeScript-strict tests asserting that calling capability-gated methods without the type guard produces a type error (or accept the runtime guard if user types the value as `StorageAdapter`).

5. **getSection/updateSection regex correctness** — Researcher finding #2: these have NO CJS analog and must be implemented via regex in MarkdownAdapter. Risks: section anchor false-matches, append/prepend/overwrite mode confusion, atomicity violations. Validation: round-trip tests for each (mode, section-id) tuple on representative files (STATE.md, PROJECT.md, ROADMAP.md, AI-SPEC.md, debug session files).

6. **`<context>`-block frontmatter leak detection** — D-14's leak-grep must scan skill `<context>` block `@.planning/...` references. Risks: missing frontmatter, malformed YAML, unicode edge cases. Validation: fixture skills in `tests/leak-grep/skills/` covering each pattern.

