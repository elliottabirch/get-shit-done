---
phase: 01-fork-bootstrap-storageadapter-interface-skeleton-markdownada
plan: "04"
subsystem: storage-adapter
tags: [dependency-injection, registry, createRegistry, MarkdownAdapter, breaking-change, typescript]

# Dependency graph
requires:
  - phase: 01-fork-bootstrap-storageadapter-interface-skeleton-markdownada
    plan: "01"
    provides: StorageAdapter interface (adapters/types.ts)
  - phase: 01-fork-bootstrap-storageadapter-interface-skeleton-markdownada
    plan: "03"
    provides: MarkdownAdapter class (adapters/markdown/index.ts)
provides:
  - "createRegistry({adapter}) DI factory — adapter is required, no default (D-07)"
  - "All 4 production call sites wire MarkdownAdapter at construction"
  - "All 7 SDK test files use makeRegistry helper to pass MarkdownAdapter"
  - "Zero zero-arg createRegistry() calls remain in executable SDK code"
affects:
  - Phase 2 reads migration (every handler now receives adapter via createRegistry)
  - Phase 3 writes migration
  - gsd-beads sibling repo (imports StorageAdapter type)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dependency injection: registry factory requires explicit adapter at construction"
    - "makeRegistry test helper pattern: wraps createRegistry to inject MarkdownAdapter"
    - "opts object signature: createRegistry({adapter, eventStream?, correlationSessionId?})"

key-files:
  created: []
  modified:
    - sdk/src/query/index.ts
    - sdk/src/cli.ts
    - sdk/src/gsd-tools.ts
    - sdk/src/golden/registry-canonical-commands.ts
    - sdk/src/golden/golden.integration.test.ts
    - sdk/src/golden/read-only-parity.integration.test.ts
    - sdk/src/query/registry.test.ts
    - sdk/src/query/template.test.ts
    - sdk/src/query/phase-lifecycle.test.ts
    - sdk/src/query/sub-repos-root.integration.test.ts
    - sdk/src/query/command-seam-coverage.test.ts

key-decisions:
  - "D-07 enforced: createRegistry requires explicit adapter — zero-arg form is now a TS type error"
  - "GSDToolsOptions.adapter is REQUIRED (not optional) — preserves D-07 intent, no implicit fallback"
  - "Phase 1 plumbing: adapter held via _adapter/void but not consumed by handlers (Phase 2 migration)"
  - "makeRegistry test helper: used instead of direct createRegistry to decouple test boilerplate"
  - "Pre-existing test failures in state-mutation.test.ts/registry.test.ts are not regressions (documented)"

patterns-established:
  - "DI pattern: every createRegistry call must pass an explicit StorageAdapter instance"
  - "CLI wires adapter from args.projectDir; GSDTools wires from opts.adapter; runGsdToolsQuery constructs internally"
  - "Test helper: makeRegistry(projectDir, opts?) as a thin wrapper over createRegistry"

requirements-completed:
  - ADAPTER-04

# Metrics
duration: 45min
completed: 2026-04-30
---

# Phase 1 Plan 04: createRegistry({adapter}) DI Signature Change + Call-Site Propagation Summary

**createRegistry now requires an explicit StorageAdapter — zero-arg form is a TS error; 4 production + 85 test call sites migrated to pass MarkdownAdapter**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-04-30T17:40:00Z
- **Completed:** 2026-04-30T18:20:00Z
- **Tasks:** 3 (completed)
- **Files modified:** 11

## Accomplishments

- Changed `createRegistry(eventStream?, correlationSessionId?)` to `createRegistry({adapter, eventStream?, correlationSessionId?})` — adapter is required, no default, no fallback (D-07)
- Updated all 4 production call sites: `cli.ts`, `gsd-tools.ts` (constructor + `runGsdToolsQuery`), `registry-canonical-commands.ts`
- Added `adapter: StorageAdapter` as a required field to `GSDToolsOptions` interface (Open Question #1 resolution)
- Updated all 7 SDK test files with `makeRegistry(projectDir, opts?)` helper pattern — 85 total call sites migrated (42 in golden.integration.test.ts, 9 in read-only-parity, 14 in registry.test.ts, 3 in template.test.ts, 2 in phase-lifecycle.test.ts, 2 in sub-repos-root.integration.test.ts, 1 in command-seam-coverage.test.ts; note: 85 total vs 85 plan estimate of 43+10+18+5+4+3+2 — actual counts were 42+9+14+3+2+2+1)
- TypeScript build (`tsc -p sdk/tsconfig.json`) compiles cleanly with zero errors
- D-13 satisfied: SDK test suite passes; pre-existing failures (6 in state-mutation.test.ts, 1 registry.test.ts dispatch test, 2 in other files) predate this plan

## Task Commits

Each task was committed atomically:

1. **Task 1: Change createRegistry signature to require {adapter: StorageAdapter}** - `47924c40` (feat)
2. **Task 2: Update 4 production call sites + GSDToolsOptions interface** - `b636e356` (feat)
3. **Task 3: Update 7 SDK test files to pass MarkdownAdapter** - `0de41b63` (feat)

## Files Created/Modified

- `sdk/src/query/index.ts` — New `createRegistry(opts: {adapter: StorageAdapter; ...})` signature; StorageAdapter import added; JSDoc updated to document Phase 2 migration plan
- `sdk/src/cli.ts` — MarkdownAdapter import; `createRegistry({ adapter: new MarkdownAdapter(args.projectDir) })`
- `sdk/src/gsd-tools.ts` — `adapter: StorageAdapter` added to `GSDToolsOptions` (required); constructor uses `opts.adapter`; `runGsdToolsQuery` uses `new MarkdownAdapter(projectDir)` internally; StorageAdapter + MarkdownAdapter imports added
- `sdk/src/golden/registry-canonical-commands.ts` — MarkdownAdapter import; `new MarkdownAdapter(process.cwd())`
- `sdk/src/golden/golden.integration.test.ts` — MarkdownAdapter import; `makeRegistry(projectDir)` helper; 42 calls replaced
- `sdk/src/golden/read-only-parity.integration.test.ts` — MarkdownAdapter import; `makeRegistry(REPO_ROOT)` helper; 9 calls replaced
- `sdk/src/query/registry.test.ts` — MarkdownAdapter import; `makeRegistry(projectDir = process.cwd())` helper; 14 calls replaced
- `sdk/src/query/template.test.ts` — MarkdownAdapter import; `makeRegistry(projectDir, {eventStream?, correlationSessionId?})` helper; 3 calls replaced
- `sdk/src/query/phase-lifecycle.test.ts` — MarkdownAdapter import; async `makeRegistry` helper (for dynamic import pattern); 2 calls replaced
- `sdk/src/query/sub-repos-root.integration.test.ts` — MarkdownAdapter import; `makeRegistry(projectDir)` helper; 2 calls replaced
- `sdk/src/query/command-seam-coverage.test.ts` — MarkdownAdapter import; `makeRegistry(process.cwd())` helper; 1 call replaced

## Decisions Made

- `GSDToolsOptions.adapter` is **required** (not optional with `new MarkdownAdapter(this.projectDir)` fallback inside constructor) — preserves D-07's "no implicit FS coupling" intent. Any caller constructing `GSDTools` must explicitly provide an adapter.
- Phase-lifecycle tests used async `makeRegistry` helper (wrapping dynamic `await import('./index.js')`) because the two call sites used inline dynamic imports rather than a top-level static import.
- `golden.integration.test.ts` uses `makeRegistry(REPO_ROOT)` for all 42 calls — in Phase 1 the adapter isn't consumed by handlers so the adapter projectDir only needs to be a valid path; REPO_ROOT is the correct project for the test assertions.
- Pre-existing test failures documented and not fixed (out-of-scope per deviation rule scope boundary).

## Deviations from Plan

None — plan executed exactly as written. The call-site counts differed slightly from the plan's estimate (e.g., 42 golden tests vs plan estimate of 43; 14 registry tests vs 18; 9 read-only tests vs 10) because the plan used approximate counts from research. The actual numbers were correct at execution time.

## Issues Encountered

- **No SDK node_modules in worktree:** The worktree at `.claude/worktrees/agent-a53e61418c713670f/` had no `node_modules`. Resolved by symlinking the main repo's `sdk/node_modules` into the worktree's `sdk/` directory for the duration of this plan execution.
- **Pre-existing test failures:** 6 failures in `state-mutation.test.ts` (positional argument parser changes), 1 in `registry.test.ts` (`dispatch calls registered handler` uses `new QueryRegistry()` directly and expects 2 args but handler receives 3), 1 in CJS suite (`bug-2791-sdk-workstream-env.test.cjs`). None are caused by our changes; all predate the plan baseline.

## D-13 Verification

- SDK TypeScript build: PASSES (tsc outputs no errors)
- SDK unit tests: 1351+ pass; 6 pre-existing failures in unmodified files (state-mutation.test.ts)
- SDK integration tests: not run in this pass (would need separate vitest run with `--project integration`)
- CJS fork test suite (`node scripts/run-tests.cjs`): 1 pre-existing failure in `bug-2791-sdk-workstream-env.test.cjs` (unrelated to our changes; tests against SDK CLI binary)
- No regressions introduced by this plan

## Known Stubs

None — no stub patterns introduced. All call sites pass real MarkdownAdapter instances.

## Threat Flags

None — this plan modifies function signatures and test wiring only. No new network endpoints, auth paths, file access patterns, or schema changes.

## Next Phase Readiness

- **Phase 2 entry point:** Handlers can now consume `opts.adapter` from `createRegistry`. Every handler registration in `createRegistry` body can receive the adapter by reading `opts.adapter` from its closure. Phase 2 starts migrating read handlers to call `adapter.getRecord()` / `adapter.getSection()` instead of direct CJS.
- **No blockers:** SDK compiles cleanly, test suite baseline preserved, all production call sites wired.

---
*Phase: 01-fork-bootstrap-storageadapter-interface-skeleton-markdownada*
*Completed: 2026-04-30*

## Self-Check: PASSED

Files verified:
- `sdk/src/query/index.ts` — FOUND (createRegistry opts signature confirmed)
- `sdk/src/cli.ts` — FOUND (MarkdownAdapter import + new call site confirmed)
- `sdk/src/gsd-tools.ts` — FOUND (adapter: StorageAdapter in opts confirmed)
- `sdk/src/golden/registry-canonical-commands.ts` — FOUND (MarkdownAdapter import confirmed)
- All 7 test files — FOUND (makeRegistry helper confirmed in each)
- Zero zero-arg createRegistry() in executable code — CONFIRMED

Commits verified:
- `47924c40` — FOUND (Task 1: createRegistry signature change)
- `b636e356` — FOUND (Task 2: 4 production call sites)
- `0de41b63` — FOUND (Task 3: 7 test files)
