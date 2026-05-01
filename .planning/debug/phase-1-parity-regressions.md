---
slug: phase-1-parity-regressions
status: root_cause_found
trigger: After Phase 1 execution (5 plans creating StorageAdapter interface + MarkdownAdapter scaffold + createRegistry({adapter}) signature change), the SDK test suite shows 16 failed tests across 6 files (1441/1457 pass). Plan 01-04's executor noted ~8 pre-existing failures, suggesting ~8 are NEW regressions introduced by Phase 1 — likely in the parity layer where MarkdownAdapter's regex-based section/frontmatter handling is compared against legacy gsd-tools.cjs output.
created: 2026-04-30
updated: 2026-04-30
---

# Debug Session: phase-1-parity-regressions

## Symptoms

- **Expected:** D-13 strict-superset invariant — `cd sdk && npm test -- --run` exits 0 after MarkdownAdapter is wired via `createRegistry({adapter: new MarkdownAdapter(projectDir)})`. Phase 1 SC#1 (per CONTEXT.md D-13 override of ROADMAP SC#1) reads "fork's existing tests pass after MarkdownAdapter wiring."
- **Actual:** Test suite completes with exit code 0 BUT 6 test files / 16 tests fail. One confirmed failure: `sdk/src/golden/read-only-parity.integration.test.ts:66:35` — the test compares `strip(sdkResult.data)` against `strip(gsdOutput)` (SDK output vs legacy `gsd-tools.cjs` output). Other 5 failing files unknown — output got truncated.
- **Pre-existing failures (per Plan 01-04's executor note):** 6 in `state-mutation.test.ts`, 1 in `registry.test.ts`, 1 in CJS suite (`scripts/run-tests.cjs`). That's ~8.
- **Net regressions:** 16 - 8 = ~8 new failures attributable to Phase 1 changes.
- **Timeline:** Started after merging plan 01-04 (createRegistry signature change) + plan 01-03 (MarkdownAdapter scaffold) + plan 01-05 (conformance harness). Wave 3 merge happened ~2 hours before symptoms surfaced. Conformance suite (`npm run test:conformance`) passes 2/2.
- **Reproduction:** `cd /home/ellio/code/get-shit-done/sdk && npm test -- --run` (~16 min runtime). Or target the known failing file: `cd sdk && ./node_modules/.bin/vitest run src/golden/read-only-parity.integration.test.ts`.

## Hypothesis Space (initial)

Three plausible root cause categories — debugger should triage:

1. **MarkdownAdapter semantic divergence from CJS** (most likely):
   - Plan 01-03 implemented `getSection`/`updateSection` via line-by-line regex (the executor deviation from plan's `\Z` lookahead). The CJS layer uses different parsing in `state.cjs`/`roadmap.cjs`/etc. Subtle byte-level differences (trailing newlines, whitespace, anchor disambiguation) → parity test failures.
   - Frontmatter merge logic in MarkdownAdapter could differ from CJS `frontmatter.cjs` in field-ordering or list-deduplication semantics.
   - File suspects: `adapters/markdown/index.ts`, `sdk/src/golden/read-only-parity.integration.test.ts`, the `strip` normalizer in that test (lines 56-66).

2. **Test-side assumptions broken by signature change** (less likely given conformance passes):
   - Tests that previously called `createRegistry()` (zero-arg) now use `makeRegistry(projectDir)` helper from plan 01-04. If the helper threads adapter incorrectly (wrong projectDir, wrong cwd resolution), tests fail.
   - File suspects: `sdk/src/test-helpers/makeRegistry.ts` (or wherever the helper lives), the 7 modified test files (`golden.integration.test.ts`, `read-only-parity.integration.test.ts`, `command-seam-coverage.test.ts`, `phase-lifecycle.test.ts`, `registry.test.ts`, `sub-repos-root.integration.test.ts`, `template.test.ts`).

3. **createRegistry signature change side-effect** (possible):
   - The signature now takes `{adapter, eventStream?, correlationSessionId?}` instead of `(eventStream?, correlationSessionId?)`. Anything that destructured positional args incorrectly is broken.

## Current Focus

```yaml
hypothesis: REJECTED — initial hypothesis (MarkdownAdapter regex divergence) is wrong.
  None of the 16 failures touch MarkdownAdapter code paths. The MarkdownAdapter is
  held in createRegistry but not yet consumed by any handler (per the explicit
  "Phase 1 plumbing only" comment at index.ts:284-287, `_adapter; void _adapter;`).
test: Ran the failing parity file in isolation (3.6s), then full suite (16min) twice
  for stability. Bisected each failure category.
expecting: A specific shape of divergence — found it. See "Eliminated Hypotheses"
  and "Root Cause" below.
next_action: Decide fix scope (3 options). All fixes are in SDK source, not CJS.
reasoning_checkpoint: |
  Conformance suite passes (2/2). MarkdownAdapter isn't wired into handlers yet.
  All 16 failures classify into 5 distinct root causes — none are Phase 1 code
  changes. Two are environmental triggers (user-defaults file installed today,
  fork's STATE/ROADMAP arrangement); three are pre-existing SDK bugs visible
  only when the fork's specific .planning state interacts with them.
tdd_checkpoint: |
  Phase 1 plans were TDD (RED/GREEN). The TDD tests passed (13/13 in MarkdownAdapter,
  5/5 in leak-grep, 2/2 in conformance). The "regressions" are all in pre-existing
  SDK code paths and pre-existing test expectations. No Phase 1 TDD test broke.
```

## Evidence

- timestamp: 2026-04-30T18:30:00Z
  source: Plan 01-04 executor SUMMARY note
  finding: "Pre-existing test failures (6 in state-mutation.test.ts, 1 in registry.test.ts, 1 in CJS suite) are not regressions"
  weight: high — executor explicitly disclaimed ~8 failures as pre-existing
  verification_status: PARTIALLY ACCURATE — state-mutation.test.ts has 3 failures (not 6) when run in isolation; registry.test.ts has 1; the CJS-suite item is outside vitest. Total pre-existing in vitest = 4 (per isolation runs), not 7.

- timestamp: 2026-04-30T18:30:00Z
  source: SDK test suite run (bd0hhmihd.output)
  finding: 6 test files / 16 tests failed; one confirmed at `read-only-parity.integration.test.ts:66:35`
  weight: high — empirical
  verification_status: CONFIRMED — reproduced twice (16/16 each run, deterministic when working tree is clean).

- timestamp: 2026-04-30T18:30:00Z
  source: `npm run test:conformance` run
  finding: 2/2 passed (putRecord/getRecord round-trip on tmpdir)
  weight: medium — narrows failure to cross-method or parity layer, not the primitives themselves
  verification_status: CONFIRMED relevant — MarkdownAdapter primitives are sound; the failures are in handlers that don't yet use the adapter at all.

- timestamp: 2026-04-30T19:00:00Z
  source: Investigation of `sdk/src/query/roadmap.ts:91-144` (`getMilestoneInfo`)
  finding: SDK reads `milestone_name` from STATE.md frontmatter (Priority 1 since the helper was extended for that) — when present and not the literal `'milestone'`, returns immediately. CJS (`get-shit-done/bin/lib/core.cjs:1580-1626`) only uses STATE.md for the *version*, then matches against ROADMAP `## ... v{version} ...` headings or `🚧 **v{version} ...**` list entries to find the *name*; if neither matches, returns name='milestone'.
  weight: high — accounts for 5 of the 16 failures.

- timestamp: 2026-04-30T19:00:00Z
  source: Investigation of `sdk/src/config.ts:155-211` (`loadConfig`) vs `get-shit-done/bin/lib/core.cjs:461-509`
  finding: SDK falls through to `~/.gsd/defaults.json` whenever `.planning/config.json` is missing, regardless of `.planning/` directory existence. CJS only consults the user-defaults file when `.planning/` does NOT exist (line 466: "Fall back to ~/.gsd/defaults.json only for truly pre-project contexts (#1683); If .planning/ exists, the project is initialized — just missing config.json"). The fork has `.planning/` but no `.planning/config.json`. With `~/.gsd/defaults.json` containing `{"resolve_model_ids":"omit"}`, SDK applies it (returns `model:''`); CJS doesn't (returns `model:'opus'`).
  weight: high — accounts for 3 additional failures (and one that's also in the milestone_name set).

- timestamp: 2026-04-30T19:00:00Z
  source: `git log --oneline sdk/src/config.ts`
  finding: `loadConfig` last touched in commit `0f8f7537 fix(#2652): layer ~/.gsd/defaults.json over built-ins in SDK loadConfig (#2663)` — UPSTREAM, pre-fork. Phase 1 commits do not modify `sdk/src/config.ts`.
  weight: high — confirms Cause 2 is pre-existing SDK bug, not Phase 1 regression.

- timestamp: 2026-04-30T19:00:00Z
  source: `stat /home/ellio/.gsd/defaults.json` + git log timeline
  finding: `~/.gsd/defaults.json` was created today at 17:28. The Phase 1 commits started after that. So the failures appeared *during* the Phase 1 wave but the cause is the user-defaults file interacting with a pre-existing SDK bug, not anything Phase 1 wrote.
  weight: high — disconfirms Phase 1 attribution for Cause 2.

- timestamp: 2026-04-30T19:00:00Z
  source: STATE.md history (`git show 83e0f6dd:.planning/STATE.md`)
  finding: `milestone_name: StorageAdapter interface + MarkdownAdapter` has been in STATE.md since the very first fork bootstrap commit (`83e0f6dd`). ROADMAP.md (`7a99d507`) has never had a `## v1.0 ...` heading or `🚧 **v1.0 ...**` list entry — the fork uses a different ROADMAP layout (line-1 `**Milestone:**` plus `- [x] **Phase N:` bullet list with no inner-bold v1.0 marker). So Cause 1 has been latent since fork creation; it surfaces because the parity tests run against the fork's own .planning state (REPO_ROOT).
  weight: high — Cause 1 is also a fork-environment trigger, not Phase 1 code.

- timestamp: 2026-04-30T19:30:00Z
  source: Per-file test runs (vitest run <file>)
  finding: state-mutation.test.ts in isolation = 3 failed (`bug-2420: parses --phase/--name/--plans flag-form args correctly`, `bug-2420: positional args still work after flag-parsing fix`, `bug-2420: flag parser throws when a flag value is missing`). registry.test.ts in isolation = 1 failed (`QueryRegistry > dispatch calls registered handler` — spy gets `(['arg1'], '/tmp', undefined)` because registry.ts:125 always passes `workstream`, but the test expects 2 args; root cause is a pre-existing test-expectation drift, registry.ts:125 was last changed in upstream `5676e2e4`).
  weight: high — confirms 4 of the 16 failures are pre-existing in isolated runs.

- timestamp: 2026-04-30T19:30:00Z
  source: `vitest run -t "..."` for each remaining failure
  finding: Three more pre-existing failures: (a) decomposed-handlers.test.ts `agentSkills > returns valid QueryResult with skills array` — `expected false to be true` (b) config-mutation.test.ts `configNewProject > creates config.json with defaults` — `expected false to be true` (c) golden.integration.test.ts `state.update matches gsd-tools.cjs` — SDK returns `{updated, field, value}` but CJS returns `{updated: true}` only. All three were unchanged by Phase 1 (`git blame` points to upstream commits ≤April-21).
  weight: high — these are environment-independent SDK bugs.

- timestamp: 2026-04-30T19:30:00Z
  source: `vitest run -t "validate.health"`
  finding: SDK reports W006 ("Phase N in ROADMAP.md but no directory on disk") for phases 2-8, and adds `repairs_performed: undefined` field. CJS doesn't report W006 for the same setup (and reports a different W019 for DECISIONS.md). The fork has only Phase 01 directory on disk while ROADMAP lists phases 1-8. Pre-existing divergence in `sdk/src/query/validate.ts` between SDK and CJS validators; not touched by Phase 1.
  weight: high — adds 1 to the pre-existing-pile.

## Eliminated Hypotheses

- **H1 (MarkdownAdapter regex divergence in `getSection`/`updateSection`/frontmatter merge):** Eliminated. None of the 16 failures touch MarkdownAdapter code. The adapter is held but not consumed (`index.ts:284-287` `void _adapter;`). Phase 2-3 will start using it. Evidence: stack traces all point at `sdk/src/query/roadmap.ts`, `sdk/src/config.ts`, `sdk/src/query/state-mutation.ts`, `sdk/src/query/validate.ts`, etc. — never `adapters/markdown/index.ts`.

- **H2 (test-helper `makeRegistry` threads adapter incorrectly):** Eliminated. The 7 test files updated by plan 01-04 all instantiate `MarkdownAdapter(REPO_ROOT)` correctly; the failures are in handler logic, not in registry construction. Conformance suite (which uses a real adapter on tmpdirs) passes 2/2. Failure exit codes happen at `expect(...).toEqual(...)` after dispatch returns, not during dispatch.

- **H3 (createRegistry signature change side-effect — positional/destructure breakage):** Eliminated. The new signature `createRegistry({adapter, eventStream?, correlationSessionId?})` is destructured immediately at index.ts:283. All call sites updated by plan 01-04 (4 production + 7 test files) pass `{adapter}`. The "Cannot destructure 'eventStream' of 'opts' as it is undefined" error appears ONLY when working-tree contamination reverts a test file to the old `createRegistry()` zero-arg form (which I accidentally triggered once during investigation by misuse of `git checkout`; restored before final run).

## Root Cause

**No Phase 1 code regressions exist.** All 16 failures decompose into 5 distinct pre-existing or environment-triggered causes:

### Cause A: SDK `getMilestoneInfo` reads STATE.md `milestone_name` directly; CJS ignores it (5 tests)

- File: `sdk/src/query/roadmap.ts:91-144`
- The SDK was extended (per docstring "Port of getMilestoneInfo from core.cjs lines 1367-1402, **extended for**: …STATE.md frontmatter when ROADMAP has no parseable milestone…") to read `milestone_name` from STATE.md frontmatter as Priority 1. When present and not literal `'milestone'`, returns it directly.
- CJS (`get-shit-done/bin/lib/core.cjs:1580-1626`) reads STATE.md only for the *version*, then matches version against ROADMAP `##` or `🚧 **vX.Y ...**` entries to derive the name. When no match, returns `name: 'milestone'`.
- The fork's STATE.md has `milestone_name: StorageAdapter interface + MarkdownAdapter` (since `83e0f6dd`); ROADMAP lacks the matching format, so CJS returns `'milestone'`. The two diverge at `getMilestoneInfo`, propagating to every consumer.
- Affected: `read-only-parity > 'stats.json'`, `read-only-parity > state.json`, `golden > progress`, `golden > init.execute-phase`, `golden > init.plan-phase` (also affected by Cause B).

### Cause B: SDK `loadConfig` applies `~/.gsd/defaults.json` even when `.planning/` exists; CJS does not (3+1 tests)

- File: `sdk/src/config.ts:155-211`, specifically lines 178-186 (the `if (!projectConfigFound) { return mergeDefaults(userDefaults); }` branch).
- CJS (`get-shit-done/bin/lib/core.cjs:466`) explicitly guards: `if (fs.existsSync(planningDir(cwd))) { return defaults; }` — bypasses user-defaults when project is initialized but missing `config.json`.
- SDK has no equivalent guard. With `~/.gsd/defaults.json = {"resolve_model_ids":"omit"}` (created today at 17:28), SDK returns `model:''` from `resolveModel`; CJS returns `'opus'` (or `'sonnet'`).
- Bug introduced upstream by `0f8f7537 fix(#2652): layer ~/.gsd/defaults.json over built-ins in SDK loadConfig (#2663)` — pre-fork.
- Affected: `read-only-parity > 'resolve-model'`, `golden > init.plan-phase` (also Cause A), `golden > init.quick`, `golden > init.verify-work`.

### Cause C: SDK `validateHealth` reports W006 for missing phase dirs + adds `repairs_performed: undefined` (1 test)

- File: `sdk/src/query/validate.ts` (last touched in upstream `5fdc950e`/`3a623b11`/`7b470f26` — none Phase 1).
- The fork's ROADMAP lists phases 1-8 but only Phase 01 directory exists yet. SDK validators surface this as W006 errors; CJS doesn't.
- Pre-existing parity gap in `validate.health`. Surfaces because of fork's phase-dir state.

### Cause D: SDK `stateUpdate` returns `{updated, field, value}` shape; CJS returns `{updated: true}` only (1 test)

- File: `sdk/src/query/state-mutation.ts:344` (`return { data: { updated, field, value: updated ? value : undefined } };`)
- CJS (`state.cjs:220`): `output({ updated: true });`
- Last changed in upstream `002bcf2a` (April 12, pre-fork). Pre-existing SDK divergence.

### Cause E: Pre-existing SDK test bugs (6 tests)

- `state-mutation.test.ts` (3 tests): `bug-2420` flag parser tests — `data.name` is `undefined` (parser regression) and one error-message expectation drifted.
- `registry.test.ts` (1 test): `dispatch calls registered handler` — expects 2-arg call, dispatch always passes `workstream` as 3rd arg since upstream `5676e2e4`.
- `decomposed-handlers.test.ts` (1 test): `agentSkills > returns valid QueryResult with skills array` — `expected false to be true`.
- `config-mutation.test.ts` (1 test): `configNewProject > creates config.json with defaults` — `expected false to be true`.

All six survive on `main` and were unchanged by Phase 1.

## Resolution

(pending — see "Recommended Action" below)

## Recommended Action

Per D-13: SC#1 reduces to "fork's existing tests pass after MarkdownAdapter wiring." With **zero** Phase 1 code regressions, the strict-superset invariant is mechanically satisfied — Phase 1 didn't break anything that was previously passing in the fork checkout.

However, the absolute count "16 failed" is uncomfortable for the milestone. Three options:

### Option 1: Document and proceed (lowest effort)

Mark all 16 failures as pre-existing/environmental in the Phase 1 SUMMARY. Append the full classification above. Phase 1 SC#1 is met under D-13's "after wiring" interpretation. Defer the SDK fixes (Cause A/B/C/D/E) to Phase 4 (DEBT) or upstream PRs.

**Pros:** No risk, no scope creep, Phase 1 closes today.
**Cons:** Test count looks bad to outsiders; future sessions see 16 red and may waste cycles re-investigating.

### Option 2: Fix Cause A + Cause B in SDK (medium effort)

Two atomic commits:

1. `fix(sdk): match CJS getMilestoneInfo when STATE.md milestone_name is non-canonical`
   In `sdk/src/query/roadmap.ts:91-144`, treat STATE.md `milestone_name` as a hint, not authoritative — match CJS behavior of using ROADMAP for the name and falling back to literal `'milestone'`. (Subtle: this trades correctness — the SDK behavior is arguably better — for parity. Document the trade.)

2. `fix(sdk): skip ~/.gsd/defaults.json when .planning/ exists, matching CJS loadConfig`
   In `sdk/src/config.ts:155-211`, add the missing `if (planningDir exists) return defaults` guard before the `loadUserDefaults` branch. Mirrors `core.cjs:466`.

This eliminates 8 of 16 failures. The remaining 8 (Cause C/D/E) are demonstrably pre-existing on `main`.

**Pros:** Net 8 fewer red tests, both fixes are small (≤20 lines) and surgical.
**Cons:** Both fixes change existing SDK behavior; Cause A in particular makes SDK *less* correct in service of CJS parity. May conflict with upstream when rebasing.

### Option 3: Fix all 5 causes (highest effort)

Adds 4 more commits for Cause C/D/E. Most of those touch deeper SDK/test code and may have semantic implications (the `agentSkills` and `configNewProject` failures need investigation; we only confirmed they're pre-existing, not their underlying issue).

**Pros:** Clean test board.
**Cons:** Out of Phase 1 scope per D-13. Each commit needs its own analysis.

**My recommendation: Option 1 + (optional) Cause B fix.**

Cause B is the cheapest win: a one-line `if (existsSync(...))` guard in `sdk/src/config.ts` matches CJS exactly, was likely intended in commit `0f8f7537` (the comment at line 178-182 explicitly references the CJS branch but didn't port the guard), and unblocks `resolve-model` + 3 init parity tests immediately. It is also the change least likely to conflict with upstream because it makes SDK *more* CJS-faithful, not less.

Cause A is more controversial — fixing it makes SDK behavior worse (ignores STATE.md `milestone_name` you intentionally set). Better to leave Cause A as a documented divergence, file an upstream issue, and resolve in Phase 4/8.
