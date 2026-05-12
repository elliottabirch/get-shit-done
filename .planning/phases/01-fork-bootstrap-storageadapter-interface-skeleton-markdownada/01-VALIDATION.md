---
phase: 1
slug: fork-bootstrap-storageadapter-interface-skeleton-markdownada
status: approved
nyquist_compliant: true
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | ADAPTER-01, -02, -06, -07 | — | N/A | unit (type-check) | `cd sdk && npm run build` | ⬜ → ✅ on Wave 0 (`adapters/types.ts`) | ⬜ pending |
| 01-01-02 | 01 | 1 | ADAPTER-06 | — | N/A | unit (build) | `npm run build:sdk && test -d adapters/dist` | ⬜ → ✅ on Wave 0 (`adapters/tsconfig.json`, root `tsconfig.json`, `package.json`) | ⬜ pending |
| 01-02-01 | 02 | 1 | ADAPTER-05 | — | N/A | doc/grep | `grep -c "D-2026-04-30-0[7-9]\|D-2026-04-30-10" .planning/DECISIONS.md` ≥ 4 | ⬜ → ✅ on Wave 0 (`.planning/DECISIONS.md`) | ⬜ pending |
| 01-02-02 | 02 | 1 | ADAPTER-05 | — | N/A | unit + fixtures | `node tests/leak-grep.test.cjs` exits 0 | ⬜ → ✅ on Wave 0 (`scripts/leak-grep.cjs`, `tests/leak-grep.test.cjs`, fixtures) | ⬜ pending |
| 01-03-01 | 03 | 2 | ADAPTER-03, -07 | — | N/A | unit (impl + section regex) | `cd sdk && npx vitest run --root .. tests/conformance/` | ⬜ → ✅ on Wave 0 (`adapters/markdown/index.ts`) | ⬜ pending |
| 01-04-01 | 04 | 3 | ADAPTER-04 | — | N/A | unit (signature change) | `cd sdk && npm run build` (TS error if zero-arg call site remains) | ⬜ → ✅ (`sdk/src/query/index.ts` signature) | ⬜ pending |
| 01-04-02 | 04 | 3 | ADAPTER-04 | — | N/A | unit (production sites) | `grep -rE "createRegistry\(\)" sdk/src/ \| wc -l` == 0 | ⬜ → ✅ (`cli.ts`, `gsd-tools.ts`, `golden/registry-canonical-commands.ts`) | ⬜ pending |
| 01-04-03 | 04 | 3 | ADAPTER-04 | — | N/A | unit (test-site sweep) | `cd sdk && npm test -- --run` exits 0 | ⬜ → ✅ (7 test files updated) | ⬜ pending |
| 01-05-01 | 05 | 3 | ADAPTER-03 | — | N/A | conformance harness | `cd sdk && npx vitest run --config ../vitest.conformance.config.ts` | ⬜ → ✅ on Wave 0 (`tests/conformance/adapter.conformance.ts`) | ⬜ pending |
| 01-05-02 | 05 | 3 | ADAPTER-03 | — | N/A | sample test (round-trip) | `npm run test:conformance` exits 0 | ⬜ → ✅ on Wave 0 (`tests/conformance/markdown.conformance.test.ts`, `vitest.conformance.config.ts`, `package.json` scripts entry) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `adapters/types.ts` — `StorageAdapter` interface + `Capabilities` type + `UnsupportedCapabilityError` class + 6 companion type guards (D-10, D-11) — Plan 01 Task 1
- [ ] `adapters/tsconfig.json` + root `tsconfig.json` references update + `package.json` `files` array — Plan 01 Task 2
- [ ] `adapters/markdown/index.ts` — `MarkdownAdapter` class (Bin A + markdownLockfile + commitPlanningState implementations; 6 foundational methods throw `UnsupportedCapabilityError`) — Plan 03 Task 1
- [ ] `tests/conformance/adapter.conformance.ts` — adapter-parameterized test factory (D-15) — Plan 05 Task 1
- [ ] `tests/conformance/markdown.conformance.test.ts` — sample `getRecord` round-trip + section-mode coverage against MarkdownAdapter (D-15) — Plan 05 Task 2
- [ ] `vitest.conformance.config.ts` + `package.json` `scripts.test:conformance` entry — Plan 05 Task 2
- [ ] `scripts/leak-grep.cjs` + 4 fixtures + `tests/leak-grep.test.cjs` — D-14 — Plan 02 Task 2
- [ ] `.planning/DECISIONS.md` per-PR ADRs (D-XX-07 through -10) — D-12 — Plan 02 Task 1

*Wave 0 delivers all type infrastructure, the MarkdownAdapter scaffold, the conformance harness skeleton + sample test, the leak-grep tooling, and the per-PR ADRs. Every later task depends on these.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Per-PR ADRs in DECISIONS.md (D-12) | ADAPTER-05 | Requires reading upstream PR descriptions / merge state, not testable from code | Verify `.planning/DECISIONS.md` contains 4 new entries (one per PR #2898/#2901/#2908/#2909) each with verdict, contract impact, rebase risk |
| OQ-08 resolution captured | ADAPTER-07 | Documentary requirement | Verify CONTEXT.md D-09 + DECISIONS.md cross-reference each other |
| `markdownLockfile` capability shape correctness | ADAPTER-02, ADAPTER-07 | TypeScript type-correctness + the actual call sites that today use `replaceInCurrentMilestone` / `readModifyWriteRoadmapMd` route through the adapter | Type-check passes; grep shows zero direct CJS imports of these helpers from non-adapter code |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (10/10 tasks have automated commands)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has automated verify)
- [x] Wave 0 covers all MISSING references (Plan 01 Tasks 1+2 + Plan 03 Task 1 + Plan 05 Tasks 1+2 + Plan 02 Task 2 deliver all infrastructure)
- [x] No watch-mode flags (all vitest commands use `run` mode)
- [x] Feedback latency < 30s (quick) / 3min (full)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-30

---

## Failure Modes Phase 1 Validation Catches

Per RESEARCH §"Validation Architecture":

1. **Interface drift between TS and CJS shapes** — wrap-strategy MarkdownAdapter calls into CJS via `createRequire`. If a CJS function's signature drifts (e.g. extra parameter added during rebase), the adapter call breaks. Validation: per-method round-trip tests in conformance harness; type assertions on the wrapped-CJS return shapes.

2. **Call-site breakage from `createRegistry()` signature change** — D-07 makes `adapter` required, so all 4 production sites + ~79 test sites must update. Missing one = runtime crash. Validation: TypeScript compile-error budget = 0 after wave 1; CI runs the full test suite to catch any test that constructs `createRegistry()` without arguments.

3. **Leak-grep false positives/negatives** — D-14 ships a script that scans for direct I/O patterns. False positives block legitimate work; false negatives let regressions through. Validation: ship known-good and known-bad fixture files in `tests/leak-grep/`; assert script flags the bad ones and ignores the good ones.

4. **Capability flag misuse** — Consumers calling `adapter.snapshot()` without checking `capabilities.snapshot`. Defensive throw in MarkdownAdapter catches it at runtime; companion type guards (`hasSnapshot`) catch it at compile time. Validation: TypeScript-strict tests asserting that calling capability-gated methods without the type guard produces a type error (or accept the runtime guard if user types the value as `StorageAdapter`).

5. **getSection/updateSection regex correctness** — Researcher finding #2: these have NO CJS analog and must be implemented via regex in MarkdownAdapter. Risks: section anchor false-matches, append/prepend/overwrite mode confusion, atomicity violations. Validation: round-trip tests for each (mode, section-id) tuple on representative files (STATE.md, PROJECT.md, ROADMAP.md, AI-SPEC.md, debug session files).

6. **`<context>`-block frontmatter leak detection** — D-14's leak-grep must scan skill `<context>` block `@.planning/...` references. Risks: missing frontmatter, malformed YAML, unicode edge cases. Validation: fixture skills in `tests/leak-grep/skills/` covering each pattern.

