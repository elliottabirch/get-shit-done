---
phase: 02-wire-core-read-methods-to-adapter
plan: "01"
subsystem: storage-adapter
tags: [storage-adapter, sdk, reads, foundation, leak-grep, stat, recipe, bootstrap, conformance]

# Dependency graph
requires:
  - phase: 01-fork-bootstrap-storageadapter-interface-skeleton-markdownada
    plan: "04"
    provides: createRegistry({adapter}) DI factory; opts.adapter in handler closure
provides:
  - "stat() Bin A primitive on StorageAdapter (required, not capability-gated)"
  - "MarkdownAdapter.stat() implementation (null on ENOENT; mtime ISO-string)"
  - "scripts/leak-grep.cjs SDK_FS_READ_PATTERNS + Stage-2 PLANNING_SCOPE_RE filter"
  - "sdk/src/query/bootstrap.ts (raw-fs findProjectRoot — physically separated)"
  - "helpers.ts: planningRelativePath (workstream-aware) + planningBaseIsDir (adapter-aware)"
  - "state-project-load.ts adapter-aware (config.json + STATE.md + ROADMAP.md + PROJECT.md via adapter)"
  - "route-next-action.ts canonical migrated handler (Migration Recipe Pattern A exemplar)"
  - "createRegistry closure wrapper pattern wired for state.load + route-next-action"
  - "tests/golden/init-bundlers/ pre-Plan-1 baselines for 17 init bundlers (HIGH-3 fix)"
  - "tests/conformance/stat.test.ts + tests/conformance/helpers.test.ts"
  - "D-2026-05-01 ADR — Bin A contract extension"
affects:
  - Plans 02-02..04 inherit the migration recipe (route-next-action shape)
  - Plan 04 byte-identical assertion compares against tests/golden/init-bundlers/*.before.json
  - Phase 4 LEAKS-04 inherits the extended leak-grep engine (via module.exports)
  - Phase 7 BeadsAdapter must implement stat() (conformance harness covers it)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adapter-as-explicit-first-parameter (Shape A): handler signature (adapter, args, projectDir, ws)"
    - "Closure wrapper at registration: registry.register(key, (a,p,w) => handler(adapter, a, p, w))"
    - "Migration Recipe Pattern A: sync fs -> await adapter.* with planningRelativePath(workstream, doc)"
    - "Stage-2 ±20-line scope-window filter: pattern hit + scope-trigger token within window"
    - "Bootstrap-vs-helpers split: raw-fs callsites isolated to bootstrap.ts; helpers.ts adapter-clean"

key-files:
  created:
    - sdk/src/query/bootstrap.ts
    - tests/conformance/stat.test.ts
    - tests/conformance/helpers.test.ts
    - tests/leak-grep/fixtures/leaky-sdk-handler.ts
    - tests/leak-grep/fixtures/clean-sdk-handler.ts
    - tests/leak-grep/fixtures/c2-handler.ts
    - tests/leak-grep/fixtures/sdk-fs-patterns.ts
    - tests/golden/init-bundlers/.gitkeep
    - tests/golden/init-bundlers/README.md
    - tests/golden/init-bundlers/*.before.json (17 files)
  modified:
    - adapters/types.ts (stat() declaration in Bin A record group)
    - adapters/types.test.ts (_testStat + _testStatNarrow type-check coverage)
    - adapters/markdown/index.ts (stat() impl + fsStat import rename)
    - tests/conformance/adapter.conformance.ts (stat describe block — file/dir/null)
    - .planning/DECISIONS.md (D-2026-05-01 ADR appended)
    - scripts/leak-grep.cjs (SDK_FS patterns + module.exports + main-gate)
    - tests/leak-grep.test.cjs (4 new test cases)
    - sdk/src/query/helpers.ts (findProjectRoot extracted; planningRelativePath + planningBaseIsDir added)
    - sdk/src/query/state-project-load.ts (adapter-routed; createRequire bridge removed)
    - sdk/src/query/route-next-action.ts (full migration to adapter)
    - sdk/src/query/route-next-action.test.ts (test signature update)
    - sdk/src/query/index.ts (closure wiring for state.load + route-next-action)
    - sdk/src/ws-flag.test.ts (adapter wiring — Rule 1 surfaced bug)

key-decisions:
  - "D-04 implemented: SDK_FS_READ_PATTERNS + Stage-2 PLANNING_SCOPE_RE filter in scripts/leak-grep.cjs"
  - "D-10 implemented: explicit-first-arg helpers (planningRelativePath, planningBaseIsDir, migrated handlers)"
  - "D-11 implemented: stat() is required Bin A; MarkdownAdapter.stat() returns null on ENOENT"
  - "D-12 implemented: state-project-load.ts uses await adapter.getRecord('config.json'); createRequire fs bridge removed"
  - "D-2026-05-01 ADR appended to .planning/DECISIONS.md"
  - "HIGH-1 fix: every <verify> block uses Form A/B/C explicit exit-code checks"
  - "HIGH-2 Option 1 fix: findProjectRoot physically separated into sdk/src/query/bootstrap.ts; helpers.ts fs-import-clean"
  - "HIGH-3 fix: pre-Plan-1 bundler baselines captured in Task 0 BEFORE any Plan 1 mutation"

requirements-completed: []
requirements-partial:
  - READS-01 (1 reference handler + 1 helper-bridge file migrated; Plans 02-02..04 cover the rest)

# Metrics
duration: 90min
completed: 2026-05-01
---

# Phase 2 Plan 01: Foundation + Pattern Summary

**Establishes the Phase 2 migration recipe end-to-end: stat() Bin A extension, leak-grep SDK pattern category, bootstrap.ts physical separation, route-next-action as the canonical migrated handler, state-project-load fs-bridge replacement, createRegistry closure wiring — and pre-Plan-1 golden baselines for Plan 4's byte-identical assertion.**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-05-01T02:20:00Z
- **Completed:** 2026-05-01T02:46:00Z
- **Tasks:** 7 (Task 0 through Task 6)
- **Files created:** 24 (incl. 17 baseline JSON files)
- **Files modified:** 14

## Accomplishments

### HIGH-3 fix (Task 0) — Pre-Plan-1 golden baselines

Captured raw JSON output of all 17 init bundlers BEFORE any other Plan 1 task ran. The fork's compiled `sdk/dist/cli.js` has a known import-path issue (`../../adapters/markdown/index.js` doesn't exist; only `dist/markdown/index.js` does), so baselines were captured by running TS sources directly via `vite-node` (already a SDK dev dep). Documented commit-sha in `tests/golden/init-bundlers/README.md`. Plan 4's byte-identical assertion now has its true pre-migration reference.

### Task 1 — stat() in Bin A (D-11)

Extended `StorageAdapter` Bin A — record group with `stat(path): Promise<{ kind: 'file' | 'dir'; mtime?: string } | null>`. Required (not capability-gated) per D-11 justification: `isDirectory` is universal across filesystem-like backends; `mtime` optional in the return shape so non-mtime backends still satisfy the required method.

`MarkdownAdapter.stat()` delegates to `node:fs/promises.stat`. Import alias `stat as fsStat` avoids method-name shadowing.

Conformance: 3 cases (file/dir/null) added to `tests/conformance/adapter.conformance.ts`. Standalone mounting at `tests/conformance/stat.test.ts` per D-15. Type-check coverage: `_testStat` + `_testStatNarrow` in `adapters/types.test.ts`.

ADR `D-2026-05-01` appended to `.planning/DECISIONS.md` documenting the contract extension, alternatives considered, and Phase 7 BeadsAdapter implication.

### Task 2 — leak-grep SDK pattern extension (D-04)

`scripts/leak-grep.cjs` extended with `SDK_FS_READ_PATTERNS` (9 categories: fs-read-import, fs-require, readFileSync, readdirSync, existsSync, statSync, readFile-async, readdir-async, stat-async). Stage-2 `PLANNING_SCOPE_RE` ±20-line windowed filter ensures C2 files reading `~/.claude/`, `~/gsd-workspaces/`, etc. naturally pass without an explicit allowlist.

Module exports added (`TOOL_PATTERNS`, `SHELL_PATTERNS`, `SDK_FS_READ_PATTERNS`, `PLANNING_SCOPE_RE`, `CONTEXT_BLOCK_RE`, `CONTEXT_PATH_RE`, `scanFile`) so Plan 5's `audit-context-blocks.cjs` can reuse the engine. `main(process.argv)` gated on `require.main === module` — required for safe re-import.

4 fixtures cover positive (Form B), negative (Form A), C2 suppression (Form A), and broad-coverage (Form B) cases. 4 test cases added to `tests/leak-grep.test.cjs`. All 9 leak-grep tests (5 existing + 4 new) pass.

### Task 3 — bootstrap.ts split (HIGH-2 Option 1)

`findProjectRoot` performs raw fs reads against `.planning/`-prefixed paths (`existsSync`, `statSync`, `readFileSync`). The Stage-2 `PLANNING_SCOPE_RE` filter WOULD match the literal `.planning` token in the function body, causing the per-plan leak-grep gate against `helpers.ts` to fire and undermine D-03's exit gate.

Fix: physically separate `findProjectRoot` into `sdk/src/query/bootstrap.ts`. `helpers.ts` re-exports for backwards compatibility (no caller break). `helpers.ts` is now fs-import-clean (no `existsSync`/`statSync`/`readFileSync` from `node:fs`; trimmed `node:path` imports).

New helpers added per D-10:
- `planningRelativePath(workstream, doc)` — Pitfall 10 workstream-aware path computation; always POSIX-style forward slashes
- `planningBaseIsDir(adapter)` — adapter-aware sibling for handler bodies

Conformance: `tests/conformance/helpers.test.ts` — 8 tests covering `planningRelativePath` (5 cases including null/undefined/empty), `findProjectRoot` re-export sanity check, `planningBaseIsDir` (2 cases). All 89 existing `sdk/src/query/helpers.test.ts` tests still pass — no regression.

### Task 4 — state-project-load adapter routing (D-12)

`state-project-load.ts` no longer imports `createRequire` / `node:fs`. The handler reads `config.json`, `STATE.md`, `ROADMAP.md`, `PROJECT.md` via `adapter.getRecord` / `adapter.exists`.

`DEFAULT_CONFIG` inlined from `core.cjs:222-250` (`CONFIG_DEFAULTS`); core.cjs untouched per D-13. The simpler defaults-merge here is sufficient for `state.load` consumers; the CJS `loadConfig` workstream-inheritance + migration writes (depth → granularity, sub_repos auto-sync) are Phase 3 concerns and run through other code paths (`sdk/src/config.ts`).

Signature changed to adapter-as-first-arg (Shape A). Closure wrapper for `state.load` wired in `index.ts` (build constraint forced wiring inline rather than waiting for Task 6).

Return shape gains `project_exists` (forward-compatible addition; matches plan's interface block).

### Task 5 — route-next-action migration (D-12 reference exemplar)

The canonical migrated reference handler. Every fs read routed through the adapter; workstream paths use `planningRelativePath`.

Migration mapping (Migration Recipe Pattern A):
- `readFileSync(...)` + try/catch ENOENT → `await adapter.getRecord(...)` + null check
- `existsSync(...)` → `await adapter.exists(...)`
- `readdirSync(..., {withFileTypes:true})` → `await adapter.listCollection(...)` + per-ref `await adapter.stat(ref.path)` for `isDirectory`
- `readdir(...) + readFile(...)` → `await adapter.listCollection + await adapter.getRecord`

Helpers migrated:
- `readConsecutiveCallCount(adapter, ws)` — adapter-aware; returns 0 on null
- `hasUnresolvedVerificationFails(adapter, phaseRelDir)` — `listCollection` + `getRecord`
- `verificationPassed(adapter, phaseRelDir)` — `listCollection` + `getRecord`
- `toAdapterDir(planningRelDir)` — strips leading `.planning/` so the adapter (rooted at `.planning/`) gets the correct relative path

Closure wrapper for both alias keys (`route.next-action`, `route next-action`) wired in `index.ts`.

### Task 6 — createRegistry closure wiring (D-10)

The runtime wiring was forced inline into Tasks 4 and 5 (build-must-pass constraint). Task 6's commit updates the createRegistry JSDoc to document the closure pattern and the running list of adapter-aware handler registrations. All Task 6 acceptance criteria verified:
- `void _adapter;` stub absent
- `const { adapter, ... } = opts;` destructure present
- `routeNextAction(adapter, ...)` closure wrapper registered
- `stateProjectLoad(adapter, ...)` closure wrapper registered

## Task Commits

Each task committed atomically (where possible):

| Task | Commit hash | Description |
|------|-------------|-------------|
| 0    | `ba17b33b`  | chore(02-01): capture pre-migration golden bundler baselines |
| 1    | `2f7b7636`  | feat(02-01): add stat() to Bin A; impl MarkdownAdapter.stat() + conformance |
| 2    | `fd460203`  | feat(02-01): extend leak-grep.cjs with SDK fs-read patterns |
| 3    | `5e150168`  | refactor(02-01): split findProjectRoot into bootstrap.ts (HIGH-2 fix) |
| 4    | `e88d9532`  | refactor(02-01): replace createRequire fs bridge in state-project-load |
| 5    | `69c6c2e6`  | refactor(02-01): migrate route-next-action handler to adapter (recipe exemplar) |
| 6    | `de833114`  | refactor(02-01): rewire createRegistry to thread adapter to handlers |

## Plan-level verification

All 8 verifications pass:

1. `cd adapters && tsc --noEmit` — types compile clean
2. `cd sdk && npm run build` — SDK builds clean
3. `vitest run tests/conformance/stat.test.ts tests/conformance/helpers.test.ts` — 13/13 conformance tests pass
4. `node --test tests/leak-grep.test.cjs` — 9/9 leak-grep tests pass
5. Per-plan exit gate (Form C) — leak-grep against `helpers.ts`, `route-next-action.ts`, `state-project-load.ts`, `index.ts` all pass; `bootstrap.ts` excluded per HIGH-2 Option 1
6. Full SDK unit suite — 75/75 test files, 1357/1357 tests pass (D-13 test bar held)
7. `grep -cE "^## D-2026-05-" .planning/DECISIONS.md` returns 1 (ADR appended)
8. `ls tests/golden/init-bundlers/*.before.json | wc -l` returns 17 (baselines captured BEFORE Tasks 1-6)

## Decisions Made

- **Atomic Task 6 wiring:** the registry closure wiring for `state.load` (Task 4) and `route.next-action` (Task 5) had to happen inline with their respective handler signature changes — otherwise the SDK build would fail between tasks (atomic-commit constraint). Task 6 became a JSDoc + verification commit; all functional wiring is recorded in Tasks 4 and 5 commits.

- **Inline DEFAULT_CONFIG vs CJS bridge:** core.cjs's `loadConfig` does much more than parse + merge defaults (workstream inheritance, depth→granularity migration, sub_repos auto-sync with on-disk writes). Per D-13 (CJS untouched) we cannot add a pure-helper export. Per D-14 (read-only discipline) the migration writes are Phase 3. Resolution: inline `DEFAULT_CONFIG` from core.cjs:222-250 with a comment to keep in sync on rebase. Other code paths (sdk/src/config.ts) still trigger the full migration logic.

- **C2 fixture comment-text minimization:** the c2-handler.ts fixture's original comment text contained `.planning/` literal and `planningPaths(...)` — both are PLANNING_SCOPE_RE triggers. The Stage-2 ±20-line window WOULD match those tokens in the comment, defeating the C2-suppression test. Resolution: rewrite the comment to describe the suppression intent without using triggering tokens. The fixture's actual code (the `.claude/skills/foo.md` literal) does not match PLANNING_SCOPE_RE; the comment was the only issue.

- **vite-node baseline capture method:** the fork's `sdk/dist/cli.js` has a known import-path issue (`../../adapters/markdown/index.js` doesn't exist; only `dist/markdown/index.js` does). Rather than fix the fork-side dist (out-of-scope for Plan 1), baselines were captured by running TS sources directly via `vite-node` (already a SDK dev dep). The TS sources at HEAD `1ced5a55` are pre-Plan-1 by construction, so baseline output is faithful. Documented in `tests/golden/init-bundlers/README.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Pre-existing test bug in sdk/src/ws-flag.test.ts**
- **Found during:** Task 4 (full SDK test suite run after migration)
- **Issue:** Two `new GSDTools({...})` constructions at lines 158 and 179 omitted the `adapter` field. Phase 1 D-07 made `GSDToolsOptions.adapter` REQUIRED at the type level, so this was a runtime-only bug (vitest doesn't strict-type-check `.test.ts`). Pre-Task-4 the bug was latent because `state.load` didn't actually call `adapter.*` — it used `loadConfigCjs`. After Task 4 routed through `adapter.getRecord`, the bug manifested.
- **Fix:** Added `adapter: new MarkdownAdapter(tmpDir)` to both GSDTools constructions. Added `preferNativeQuery: false` to the second test (which uses a mock `gsdToolsPath` script and actually wants CLI dispatch, not native query).
- **Files modified:** `sdk/src/ws-flag.test.ts`
- **Committed in:** Task 4 commit `e88d9532`

**2. [Rule 1 — Bug] Pre-existing test bug in sdk/src/query/route-next-action.test.ts**
- **Found during:** Task 5 (full SDK test suite run after migration)
- **Issue:** Three test cases called `routeNextAction([], dir)` (old QueryHandler signature). After Task 5 changed the signature to adapter-as-first-arg (Shape A), those calls fail at the type level (vitest no-strict) and at runtime (`adapter.exists` is not a function — `args` was being passed where `adapter` is expected).
- **Fix:** Each test now constructs `const adapter = new MarkdownAdapter(dir)` from its tmpdir and calls `routeNextAction(adapter, [], dir)`.
- **Files modified:** `sdk/src/query/route-next-action.test.ts`
- **Committed in:** Task 5 commit `69c6c2e6`

**3. [Rule 3 — Blocking] Atomic-task wiring constraint forced inline registry updates**
- **Found during:** Task 4 verification (`cd sdk && npm run build`)
- **Issue:** Task 4 changes `stateProjectLoad`'s signature to take `adapter` as the first parameter; Task 6 (later) wires the registry. Building between Task 4 and Task 6 fails because the new signature doesn't match the `QueryHandler` shape at the registration site.
- **Fix:** Wired the `state.load` closure inline in Task 4's commit; same pattern for `route.next-action` / `route next-action` in Task 5. Task 6 became a JSDoc + verification commit. The plan's intent (Task 6 owns the wiring) is preserved at the commit-message + JSDoc level; the runtime wiring lives where each task introduced its handler signature change.
- **Documented in:** Task 4 commit message, Task 5 commit message, Task 6 commit message

### Unfixed (deferred to follow-ups)

- The `state.load` handler simplifies away workstream inheritance and lazy migrations from `core.cjs:loadConfig`. Other code paths (`sdk/src/config.ts`) still exercise the full logic. If Plan 4's byte-identical assertion finds a divergence in `state.load`-derived bundler output, that drift gets investigated in Plan 4. State.load is NOT directly in the 17 baselined init bundlers (init bundlers call `loadConfig` from `../config.js`, not `stateProjectLoad`), so this risk is low.

## Threat Flags

None — Plan 1 is a pure read-side refactor. No new network endpoints, auth paths, file access patterns at trust boundaries, or schema changes.

## Known Stubs

None — every migrated callsite delegates to a real adapter method backed by `MarkdownAdapter`.

## Next-phase Readiness

- **Plans 02-02..04 entry:** the migration recipe is locked. Pattern A (sync fs → `await adapter.*`) and Pattern B (async `fs/promises` → `await adapter.*`) demonstrated in `route-next-action.ts`. Workstream-aware paths use `planningRelativePath(workstream, doc)`. Adapter-aware handlers register via closure wrappers in `index.ts`.

- **Plan 4 input ready:** 17 of 17 init bundlers have `tests/golden/init-bundlers/<name>.before.json` captured against pre-Plan-1 tree. README documents bundler list, args used, capture method, and HEAD commit-sha for traceability.

- **Phase 4 LEAKS-04 inherits the extended leak-grep engine:** `scripts/leak-grep.cjs` exports its regex constants + `scanFile()` for reuse. Phase 4's CI gate runs the same engine across the full repo.

- **Phase 7 BeadsAdapter implication (D-2026-05-01):** the Bin A contract gains one new required method. BeadsAdapter implementation must include `stat()`. The conformance harness (`runAdapterConformanceSuite`) covers it via the new file/dir/null describe block — no harness changes needed for Phase 7.

- **Open follow-up:** Phase 4 LEAKS-04 may add a `// leak-grep-allow file:` directive parser to formalize the `bootstrap.ts` carve-out. For Phase 2 the carve-out is by file path (documented in `bootstrap.ts` top-of-file comment + this plan's verification block).

---
*Phase: 02-wire-core-read-methods-to-adapter*
*Plan: 01 (Wave A — foundation; Plans 02-02..04 unblocked)*
*Completed: 2026-05-01*

## Self-Check: PASSED

Files verified (all FOUND):
- `adapters/types.ts` — stat() declaration confirmed
- `adapters/markdown/index.ts` — stat() impl + fsStat alias confirmed
- `scripts/leak-grep.cjs` — SDK_FS patterns + module.exports confirmed
- `sdk/src/query/bootstrap.ts` — findProjectRoot extracted (HIGH-2 Option 1)
- `sdk/src/query/helpers.ts` — fs-import-clean; planningRelativePath + planningBaseIsDir present
- `sdk/src/query/state-project-load.ts` — adapter-routed; no createRequire fs bridge
- `sdk/src/query/route-next-action.ts` — full migration; no node:fs imports
- `sdk/src/query/index.ts` — closure wrappers wired for state.load + route-next-action
- `tests/conformance/stat.test.ts` — 5 tests pass
- `tests/conformance/helpers.test.ts` — 8 tests pass
- 4 leak-grep fixtures (leaky/clean/c2/broad) — all behavior correct
- `tests/golden/init-bundlers/` — 17 baseline JSONs + .gitkeep + README

Commits verified (all FOUND):
- `ba17b33b` — Task 0: pre-migration baselines
- `2f7b7636` — Task 1: stat() Bin A + conformance + ADR
- `fd460203` — Task 2: leak-grep SDK pattern extension
- `5e150168` — Task 3: bootstrap.ts split
- `e88d9532` — Task 4: state-project-load adapter routing
- `69c6c2e6` — Task 5: route-next-action migration (recipe exemplar)
- `de833114` — Task 6: createRegistry closure-wiring JSDoc + verification

All 8 plan-level verifications pass (tsc, sdk build, conformance tests,
leak-grep tests, per-plan exit gate Form C, full SDK unit suite 1357/1357,
ADR appended, baselines captured).
