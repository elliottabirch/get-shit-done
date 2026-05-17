---
phase: 08-migration-distribution
plan: "02"
subsystem: sdk/adapter-factory
tags: [phase-8, dist-01, adapter-factory, call-site-migration, config-schema]
dependency_graph:
  requires: []
  provides: [createStorageAdapter, BeadsAdapterUnavailable, storage.adapter-config-key]
  affects: [sdk/src/gsd-tools.ts, sdk/src/cli.ts, sdk/src/index.ts, sdk/src/query-gsd-tools-runtime.ts, sdk/src/query/query-cli-adapter.ts, sdk/src/golden/registry-canonical-commands.ts, sdk/src/query/commands-list.ts, sdk/src/query/index.ts, sdk/src/query/helpers.ts]
tech_stack:
  added: [createStorageAdapter factory, BeadsAdapterUnavailable error class]
  patterns: [brand-field error class, createRequire NodeNext shim, config-driven factory dispatch]
key_files:
  created:
    - sdk/src/query/adapter-factory.ts
    - sdk/src/query/adapter-factory.test.ts
  modified:
    - sdk/src/query/config-schema.ts
    - get-shit-done/bin/lib/config-schema.cjs
    - sdk/src/config.ts
    - docs/CONFIGURATION.md
    - sdk/src/gsd-tools.ts
    - sdk/src/cli.ts
    - sdk/src/index.ts
    - sdk/src/query-gsd-tools-runtime.ts
    - sdk/src/query/query-cli-adapter.ts
    - sdk/src/golden/registry-canonical-commands.ts
    - sdk/src/query/commands-list.ts
    - sdk/src/query/index.ts
    - sdk/src/query/helpers.ts
decisions:
  - "createStorageAdapter() is synchronous — uses createRequire(import.meta.url) shim for NodeNext ESM instead of pure-dynamic await import(), per D-05"
  - "BeadsAdapterUnavailable uses brand-field + Symbol.hasInstance pattern matching UnsupportedCapabilityError"
  - "adapterFor() in helpers.ts retained as MarkdownAdapter-only (pipeline dry-run dependency on _txnContextForPipeline/_realReadForPipeline internals)"
  - "D-06 atomic migration: all construction sites migrated in single commit"
  - "commands-list.ts and query/index.ts were unlisted orphans (Rule 2 auto-fix)"
metrics:
  duration: "18m 48s"
  completed: "2026-05-13T17:35:48Z"
  tasks: 3
  files_modified: 13
---

# Phase 8 Plan 02: DIST-01 Adapter Factory + Call-Site Migration Summary

Creates the `createStorageAdapter()` factory, extends the config schema with `storage.adapter`, and migrates all ~10 hardcoded `new MarkdownAdapter(projectDir)` construction sites to the factory in a single atomic commit.

## What Was Built

### Factory Module (Task 1)

New module `sdk/src/query/adapter-factory.ts` (~80 LOC) exports:

- `createStorageAdapter(projectDir, opts?)` — synchronous factory returning `StorageAdapter`
- `BeadsAdapterUnavailable` — brand-field error class (mirrors `UnsupportedCapabilityError` pattern)
- `StorageAdapterName` — `'markdown' | 'beads'` type alias
- `CreateStorageAdapterOpts` — opts interface

**Factory design choices:**

1. **Synchronous** — All existing call sites use `new MarkdownAdapter(projectDir)` synchronously. Making the factory async would require async refactoring at every call site (N-site change). The `createRequire(import.meta.url)` shim loads `gsd-beads` synchronously within a try/catch, avoiding the async overhead.

2. **createRequire NodeNext shim** — `sdk/tsconfig.json` has `"module": "NodeNext"`. Plain `require()` is not available in NodeNext ESM. The `createRequire(import.meta.url)` pattern (from `node:module`) is the NodeNext-correct approach, matching the precedent at `sdk/scripts/check-command-aliases-fresh.mjs`.

3. **No silent fallback** — Per D-04, when `storage.adapter: beads` is configured but `gsd-beads` is not installed, the factory throws `BeadsAdapterUnavailable` with `reason: 'missing-package'` and `installCmd: 'npm install gsd-beads'`. No markdown fallback silently substitutes.

4. **No cache** — Unlike `adapterFor()`, the factory has no `_adapterCache`. Callers construct once per entry point per D-06 + RESEARCH.md Open Q 3.

**Brand-field pattern adoption:**

`BeadsAdapterUnavailable` replicates `UnsupportedCapabilityError` from `adapters/types.ts`:

```typescript
readonly __brand = 'BeadsAdapterUnavailable' as const;
static [Symbol.hasInstance](instance: unknown): boolean {
  return instance != null && typeof instance === 'object' &&
    (instance as Record<string, unknown>).__brand === 'BeadsAdapterUnavailable';
}
```

This ensures `instanceof` works across ESM/CJS dual-package boundaries and vitest module transforms.

### Config Schema Extension (Task 2)

Three-file atomic change:

- `sdk/src/query/config-schema.ts`: Added `'storage.adapter'` to `VALID_CONFIG_KEYS` Set
- `get-shit-done/bin/lib/config-schema.cjs`: Mirror change (parity test enforces set-equality)
- `sdk/src/config.ts`: Extended `GSDConfig` with `storage?: { adapter?: 'markdown' | 'beads' }`
- `docs/CONFIGURATION.md`: Added documentation row (docs-parity test requires it)

**Deviation (Rule 2):** The `tests/config-schema-docs-parity.test.cjs` test requires every `VALID_CONFIG_KEYS` entry to be documented in `docs/CONFIGURATION.md`. Added a row documenting `storage.adapter` to satisfy this gate.

### Call-Site Migration (Task 3)

D-06 atomic migration — all sites in one commit. Before/after per file:

| File | Line | Before | After |
|------|------|--------|-------|
| `sdk/src/gsd-tools.ts` | 170 | `opts.adapter ?? new MarkdownAdapter(opts.projectDir)` | `opts.adapter ?? createStorageAdapter(opts.projectDir)` |
| `sdk/src/gsd-tools.ts` | 630 | `new MarkdownAdapter(projectDir)` | `createStorageAdapter(projectDir)` |
| `sdk/src/cli.ts` | 412 | `new MarkdownAdapter(args.projectDir)` | `createStorageAdapter(args.projectDir, { adapter: cliConfig.storage?.adapter })` (added loadConfig call) |
| `sdk/src/index.ts` | 131 | `new MarkdownAdapter(this.projectDir)` | `createStorageAdapter(this.projectDir)` |
| `sdk/src/query-gsd-tools-runtime.ts` | 33 | `opts.adapter ?? new MarkdownAdapter(opts.projectDir)` | `opts.adapter ?? createStorageAdapter(opts.projectDir)` |
| `sdk/src/query/query-cli-adapter.ts` | 25 | `new MarkdownAdapter(runtime.projectDir)` | `createStorageAdapter(runtime.projectDir)` |
| `sdk/src/golden/registry-canonical-commands.ts` | 12 | `new MarkdownAdapter(process.cwd())` | `createStorageAdapter(process.cwd())` |
| `sdk/src/query/commands-list.ts` | 17 | `new MarkdownAdapter(_projectDir)` | `createStorageAdapter(_projectDir)` (unlisted orphan, Rule 2) |
| `sdk/src/query/index.ts` | 280 | `opts?.adapter ?? new MarkdownAdapter(process.cwd())` | `opts?.adapter ?? createStorageAdapter(process.cwd())` (unlisted orphan, Rule 2) |

**adapterFor() deprecation note rationale:**

`helpers.ts` `adapterFor()` is retained as MarkdownAdapter-only. The pipeline.ts dry-run accesses `_txnContextForPipeline` and `_realReadForPipeline` — MarkdownAdapter-internal underscore methods. `pipeline.ts` already has discretionary casts with `?.()` optional-chaining guards for non-MarkdownAdapter. `adapterFor()` was annotated with `@deprecated` JSDoc pointing to `createStorageAdapter()` for new callers.

## Test Results

| Test | Result |
|------|--------|
| `npx vitest run src/query/adapter-factory.test.ts` | 5/5 passed |
| `node --test tests/config-schema-sdk-parity.test.cjs` | 2/2 passed |
| `node --test tests/config-schema-docs-parity.test.cjs` | 1/1 passed |
| `npm test` (full CJS suite) | 7506/7506 passed |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Added storage.adapter to docs/CONFIGURATION.md**
- **Found during:** Task 2
- **Issue:** `tests/config-schema-docs-parity.test.cjs` requires every `VALID_CONFIG_KEYS` entry to appear in `docs/CONFIGURATION.md`. Adding `'storage.adapter'` without documenting it caused this test to fail.
- **Fix:** Added a documentation row for `storage.adapter` in `docs/CONFIGURATION.md`
- **Files modified:** `docs/CONFIGURATION.md`
- **Commit:** 262be5ce

**2. [Rule 2 - Missing] Migrated two unlisted construction sites**
- **Found during:** Task 3 (orphan scan)
- **Issue:** The plan's construction site inventory (from RESEARCH.md) listed 8 sites, but two additional sites existed: `sdk/src/query/commands-list.ts` line 17 and `sdk/src/query/index.ts` line 280. The zero-orphan acceptance criterion requires all sites outside the factory and helpers.ts to be migrated.
- **Fix:** Migrated both sites to `createStorageAdapter()`. Included in the D-06 atomic commit.
- **Files modified:** `sdk/src/query/commands-list.ts`, `sdk/src/query/index.ts`
- **Commit:** c923c6e5

## Commits

| Hash | Message |
|------|---------|
| 057831b1 | feat(08-02): create adapter-factory.ts with BeadsAdapterUnavailable + unit tests |
| 262be5ce | feat(08-02): extend config schema with storage.adapter key + GSDConfig.storage type |
| c923c6e5 | feat(08-02): migrate all construction sites from new MarkdownAdapter() to createStorageAdapter() |

## Self-Check: PASSED

| Item | Status |
|------|--------|
| sdk/src/query/adapter-factory.ts | FOUND |
| sdk/src/query/adapter-factory.test.ts | FOUND |
| .planning/phases/08-migration-distribution/08-02-SUMMARY.md | FOUND |
| commit 057831b1 | FOUND |
| commit 262be5ce | FOUND |
| commit c923c6e5 | FOUND |
