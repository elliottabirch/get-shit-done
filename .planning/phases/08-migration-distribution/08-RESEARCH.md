# Phase 8: Migration + Distribution — Research

**Researched:** 2026-05-13
**Domain:** Adapter factory wiring, config-driven dispatch, upstream parity CI, alias-generator rewrite, rebase playbook
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Plan split (6 plans total)**
- One plan per requirement: Pre-0 + DIST-01..05 = 6 plans.
- DIST-05 plan is a placeholder written at phase-close.

**DIST-01 — storage.adapter: beads wiring**
- Factory lives in new module `sdk/src/query/adapter-factory.ts` exporting `createStorageAdapter(projectDir, opts?)`.
- Fail-fast (no silent markdown fallback) when `storage.adapter: beads` but gsd-beads/bd unavailable.
- Import style: static top-of-file import + try/catch at module boundary (NOT pure-dynamic).
- All ~10 `new MarkdownAdapter(projectDir)` sites migrate in the same plan as factory creation.

**DIST-02 — migration tool**
- Migration logic lives in sibling repo (`gsd-beads migrate` subcommand). Fork-side is docs-only + optional `gsd-sdk query storage.migrate` pass-through.
- Dry-run shape: plan-then-apply JSON; bd auto-generates ids.
- Backup/rollback: require clean-slate `.beads/` + archive markdown on success.

**DIST-03 — rebase playbook**
- Ships as `docs/UPSTREAM-REBASE.md` + `scripts/sync-upstream.sh`.
- Leak-grep on post-rebase diff is advisory (non-blocking; exit 0 even when leaks found).
- Conflict taxonomy documents both seam AND business-logic conflicts (latter is INVESTIGATE red flag).
- On-demand cadence only (no cron/GHA trigger).

**DIST-04 — strict-superset parity CI**
- Upstream pin is a tag in `.github/workflows/upstream-parity.yml`.
- `npm pack` + `npm install <tarball>` install method.
- Sanitize-before-compare using init-bundlers.test.ts `sanitize()` pattern.
- Parity CI runs on every PR to `feat/storage-adapter` + `main` as required check.

**DIST-05** — Deferred to phase-close; placeholder plan only.

**Pre-0 — SDK alias-generator rewrite**
- Rewrite `sdk/scripts/gen-command-aliases.ts` to emit `readonly FamilyCommandAlias[]` + inline single-line format + `FamilyCommandAlias` interface export.
- Add CJS writer that emits `get-shit-done/bin/lib/command-aliases.generated.cjs`.
- Regenerate both artifacts. Remove `if: false` guard and `TODO(phase-8)` from test.yml.
- Pre-0 MUST land before DIST-04 (both touch test.yml).

### Claude's Discretion

- Exact file path for rebase helper script (`scripts/sync-upstream.sh` default; planner may adjust).
- Exact signature of `createStorageAdapter` — sync vs async.
- Whether parity workflow becomes `.github/workflows/upstream-parity.yml` or a new matrix slot in `test.yml`.
- Migration docs location: README.md vs docs/MIGRATION.md vs inline in PROJECT.md.
- Exact error class name for DIST-01 (`BeadsAdapterUnavailable` is a working name).

### Deferred Ideas (OUT OF SCOPE)

- Additional adapter types (sqlite, postgres, REST).
- Automated upstream-sync cron / weekly PR-open GHA.
- bd cold-start perf dashboard.
- Full property-suite nightly CI (`CONFORMANCE_DEEP=1`).
- Sibling `main` graduation (sibling is on `feat/phase-6-reset`).
- Migration verification against pre-migration state (conformance re-run post-migrate).
- Mid-phase migration (v1.0 assumes clean boundary migration only).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIST-01 | User opts in via `storage.adapter: beads` in `.planning/config.json`; default identical to upstream | §DIST-01 deep-dive: construction-site inventory, factory signature, config-schema extension pattern |
| DIST-02 | Migration tool: read existing `.planning/` markdown, seed bd store | §DIST-02: fork-side docs-only, sibling owns implementation; JSONL round-trip pattern from SKILL.md |
| DIST-03 | Fork divergence / upstream-patch-reapply workflow documented | §DIST-03: prior rebase history, leak-grep integration, conflict taxonomy |
| DIST-04 | Strict-superset invariant validated end-to-end via `npm install <fork>` | §DIST-04: npm pack size/manifest, sanitize() pattern reuse, upstream golden suite path |
| DIST-05 | Distribution decision (PR vs fork) recorded in DECISIONS.md | Placeholder plan; inputs not yet stable |
</phase_requirements>

---

## Summary

Phase 8 closes v1.0 by converting the adapter-seam work (Phases 1–7) into three user-facing deliverables: config-driven adapter dispatch, a migration path to bd, and a distribution story (rebase playbook + parity CI gate + PR-vs-fork ADR). A prerequisite cleanup (Pre-0: alias generator rewrite) must land first.

The research findings are highly concrete because the codebase has been through seven prior phases. The construction-site inventory is fully enumerated in CONTEXT.md §Canonical refs and confirmed by direct code inspection. The Pre-0 delta analysis is complete: the generator's `JSON.stringify` output diverges from the committed single-line `as const` format, and there is no CJS writer at all — it was maintained by hand. The check script (`sdk/scripts/check-command-aliases-fresh.mjs`) validates both the TS artifact and the CJS artifact by comparing against `toAliasEntries(MANIFEST, family)` — so the rewritten generator only needs to replicate that same transform, plus emit `'use strict'` CJS with `module.exports`.

The DIST-01 factory decision on sync-vs-async (Claude's discretion) is resolvable by inspection: the existing `adapterFor()` transitional helper is async only because it uses a dynamic import as a cycle-guard. That cycle guard was necessary during phased migration, but a dedicated `adapter-factory.ts` that does a direct static import of `MarkdownAdapter` and a try/catch-guarded static import of `gsd-beads` has no dependency cycle and can be synchronous. All current call sites construct `new MarkdownAdapter(...)` synchronously; keeping the factory sync eliminates N-site async refactoring.

The DIST-04 parity workflow is the most infrastructure-heavy plan. The upstream golden suite (PR #2909) lives at `sdk/src/golden/` as `golden.integration.test.ts` + `golden-policy.test.ts`; it is a vitest suite, not a separate test runner. The `npm pack` tarball is `get-shit-done-cc-1.39.0-rc.4.tgz` at the current version; parity CI should pack fresh from HEAD. The upstream tag to pin against is currently beyond `v1.9.9` on `upstream/main` (the latest fetched commits are PR #3158 and vicinity); the planner should record the tag used at time of DIST-04 authoring.

**Primary recommendation:** Execute plans in order Pre-0 → DIST-01 → DIST-02 → DIST-03 → DIST-04 → DIST-05. Pre-0 first because it removes the `if: false` bypass that would conflict with DIST-04's test.yml changes. DIST-01 second because the factory is the foundation for DIST-02's docs and the parity test's zero-diff guarantee.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Config-driven adapter selection (DIST-01) | SDK layer (`adapter-factory.ts`) | Config reader (`config.ts`) | Factory reads config and constructs adapter; config reader already has `loadConfig()` + `GSDConfig` shape to extend |
| Migration tool implementation (DIST-02) | Sibling repo (`gsd-beads migrate`) | Fork docs layer | Per D-07: migration is adapter-specific; fork is docs + optional pass-through only |
| Rebase playbook + leak-grep script (DIST-03) | Fork scripts layer (`scripts/sync-upstream.sh`) | `scripts/leak-grep.cjs` | Existing leak-grep runs unchanged; script wraps git + invokes it |
| Parity CI gate (DIST-04) | GitHub Actions (`.github/workflows/`) | `npm pack` + upstream tag | Workflow packs tarball, installs into upstream clone, runs vitest suite |
| PR-vs-fork ADR (DIST-05) | `DECISIONS.md` | ROADMAP.md traceability | Document-only plan written at phase-close |
| Alias generator rewrite (Pre-0) | `sdk/scripts/gen-command-aliases.ts` | `get-shit-done/bin/lib/command-aliases.generated.cjs` | Two committed artifacts + CI check; generator produces both |

---

## Standard Stack

### Core

| Library/Tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `gsd-beads` | `1.0.0-alpha.0` (`file:../gsd-beads`) | BeadsAdapter peer that `createStorageAdapter` imports | The adapter implementation produced in Phase 6; required for `storage.adapter: beads` |
| vitest | (existing in `sdk/`) | Test runner for parity workflow | Already the project test runner; parity suite adds a new vitest project or matrix slot |
| `npm pack` | Built-in npm | Produce fork tarball for parity test | Catches packaging bugs (class of #2647 bug) that `npm link` misses |
| `scripts/leak-grep.cjs` | Existing (no version) | Post-rebase diff leak scan in DIST-03 | Already in-project; invoked with `node scripts/leak-grep.cjs <files>` |

### Supporting

| Library/Tool | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:child_process` | Node built-in | Shell-out in `scripts/sync-upstream.sh` | Script needs git commands + leak-grep invocation |
| `node:fs/promises` | Node built-in | CJS writer in rewritten gen script | Emit CJS artifact in Pre-0 generator |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Static import + try/catch guard for gsd-beads | Pure-dynamic `await import('gsd-beads')` | Dynamic import gives lazy resolution and avoids failing on startup for markdown users, but loses static type inference and produces async factory. User overrode recommendation: static preferred for types + simpler error paths. |
| `npm pack` + tarball install | `npm link` | `npm link` misses packaging errors in `exports` map; tarball install is what users actually get |
| Separate `.github/workflows/upstream-parity.yml` | New matrix entry in `test.yml` | New file is cleaner separation and simpler conditional logic; tradeoff is more files. Either is valid — planner decides based on workflow complexity. |

**Installation (DIST-01):**
```bash
# gsd-beads is already a devDep via file:../gsd-beads in the fork's package.json
# No new npm install needed for the fork itself
# DIST-01 adds storage.adapter key to config-schema.ts + adds adapter-factory.ts
```

---

## Pre-0 Deep Dive: Alias Generator Delta Analysis

[VERIFIED: direct code inspection]

### What exists today

**Generator (`sdk/scripts/gen-command-aliases.ts`)** outputs via `JSON.stringify(entries, null, 2)` which produces pretty-printed JSON with no TypeScript type annotations:

```typescript
// Generator currently emits (simplified):
export const STATE_COMMAND_ALIASES = [
  {
    "canonical": "state.load",
    "aliases": [],
    ...
  },
  ...
] as const;
```

**Committed TS artifact (`sdk/src/query/command-aliases.generated.ts`)** uses inline single-line format with a typed annotation and a `FamilyCommandAlias` interface:

```typescript
export interface FamilyCommandAlias {
  canonical: string;
  aliases: string[];
  subcommand: string;
  mutation: boolean;
}

export const STATE_COMMAND_ALIASES: readonly FamilyCommandAlias[] = [
  { canonical: 'state.load', aliases: [], subcommand: 'load', mutation: false },
  ...
] as const;
```

**Committed CJS artifact (`get-shit-done/bin/lib/command-aliases.generated.cjs`)** is `'use strict'` CJS with bare arrays (no TypeScript annotations) and `module.exports` at the bottom. No `FamilyCommandAlias` type. Subcommand arrays are plain JS arrays (not `Set`).

**Check script (`sdk/scripts/check-command-aliases-fresh.mjs`)** verifies both artifacts by comparing against `toAliasEntries(MANIFEST, family)` — a transform that reads from `sdk/dist/query/command-manifest.*.js` and produces `{canonical, aliases: [...aliases], subcommand: canonical.slice(prefix.length), mutation}` entries. The drift check is that TS aliases === toAliasEntries and CJS aliases === toAliasEntries.

### What the rewritten generator must do

1. **Read from source manifests** — import `COMMAND_DEFINITIONS_BY_FAMILY` from `command-definition.js` (same as current generator) or directly from `command-manifest.*.ts`. The `toSubcommand()` helper can be kept; it matches what `toAliasEntries` in the check script produces.

2. **Emit TS artifact** with:
   - `FamilyCommandAlias` interface exported at top
   - `readonly FamilyCommandAlias[]` type annotation on each const
   - Inline single-line format per entry (one object per line, no JSON.stringify pretty-print)
   - `as const` at the end of each array
   - `Set<string>` for `*_SUBCOMMANDS` exports

3. **Emit CJS artifact** with:
   - `'use strict';` header + JSDoc comment header
   - Bare arrays (no type annotations)
   - `module.exports = { STATE_COMMAND_ALIASES, ..., STATE_SUBCOMMANDS, ... }` at bottom
   - `*_SUBCOMMANDS` as plain arrays (CJS consumers use array `.includes()`, not `Set.has()`)

4. **Two output paths**: `sdk/src/query/command-aliases.generated.ts` and `get-shit-done/bin/lib/command-aliases.generated.cjs`.

5. **Remove `if: false` guard** from `.github/workflows/test.yml` line 179 and the comment block explaining the bypass (lines 163–177).

### Format difference summary

| Aspect | Current generator emits | Committed TS artifact | Committed CJS artifact |
|--------|------------------------|----------------------|------------------------|
| Type annotation | None | `readonly FamilyCommandAlias[]` | N/A (CJS) |
| Interface export | No | Yes (`FamilyCommandAlias`) | No |
| Entry format | Pretty-printed JSON (2-space indent) | Inline single-line object literal | Inline single-line object literal |
| String quotes | Double (JSON.stringify) | Single quotes | Single quotes |
| Subcommand Sets | `new Set<string>(...)` computed inline | `new Set<string>(...)` computed inline | Plain arrays (no Set) |
| Module system | ESM `writeFile` to TS only | Consumed as ESM | `module.exports` CJS |

---

## DIST-01 Deep Dive: Construction Site Inventory

[VERIFIED: direct code inspection of files listed in CONTEXT.md §Canonical refs]

### Complete inventory of `new MarkdownAdapter(projectDir)` call sites in `sdk/src/`

| File | Line(s) | Context | Notes |
|------|---------|---------|-------|
| `sdk/src/gsd-tools.ts` | 170 | `GSDTools` constructor: `opts.adapter ?? new MarkdownAdapter(opts.projectDir)` | Already supports adapter injection via opts; `new` is the default path |
| `sdk/src/gsd-tools.ts` | 630 | `runGsdToolsQuery()` standalone function | No opts injection; hardcoded |
| `sdk/src/cli.ts` | 412 | `gsd-sdk query` subcommand handler in `runCli()` | No opts injection |
| `sdk/src/index.ts` | 131 | `GSD.createTools()` method | Passes `new MarkdownAdapter(this.projectDir)` to GSDTools constructor |
| `sdk/src/query-gsd-tools-runtime.ts` | 33 | `createGSDToolsRuntime()`: `opts.adapter ?? new MarkdownAdapter(opts.projectDir)` | Already supports injection; hardcoded is the default |
| `sdk/src/query/query-cli-adapter.ts` | 25 | `runQueryCliCommand()` | No opts injection |
| `sdk/src/query/helpers.ts` | 499–506 | `adapterFor()` transitional helper | Uses dynamic import + `_adapterCache` singleton. DIST-01 replaces this with `createStorageAdapter()` |
| `sdk/src/golden/registry-canonical-commands.ts` | 12 | `getCanonicalRegistryCommands()` | Used only for manifest coverage; adapter is not exercised. Low-risk migration site. |

**Total: ~8 sites** (the CONTEXT.md says ~10; some are in `helpers.ts` via the `adapterFor` wrapper which is counted as one logical site).

### Factory signature decision: sync vs async

[VERIFIED: code inspection + reasoning from locked decisions]

The `adapterFor()` transitional helper is async **only** because it uses a dynamic `await import('...')` to avoid a dependency cycle that existed during phased migration. Per CONTEXT.md §Code_context "Adapter construction is synchronous", the `new MarkdownAdapter(projectDir)` pattern is synchronous everywhere.

For `createStorageAdapter(projectDir, opts?)`:

- **MarkdownAdapter branch**: `new MarkdownAdapter(projectDir)` — synchronous.
- **BeadsAdapter branch**: `new BeadsAdapter(projectDir)` — synchronous constructor (gsd-beads `BeadsAdapter` constructor takes `projectRoot: string`; the `init()` validation call is called lazily on first bd-using method, per D-18/`_ensureBd` pattern).

The **static import + try/catch boundary** (D-05 locked decision) means: `import BeadsAdapter from 'gsd-beads'` at module top level, wrapped in try/catch so module load fails gracefully if gsd-beads is absent. Module-level try/catch on a static import is actually a CommonJS pattern; in ESM the analogous approach is to use `import.meta.resolve()` or a conditional dynamic import guarded by `try { await import() } catch`. However, the factory file can be written as a CJS-compatible TS module (compiled to CJS by the adapter build) using `require()` inside the try/catch — this is the pattern used by `adapters/markdown/index.ts` which already uses `createRequire`.

Alternatively, the factory can load gsd-beads lazily inside the `createStorageAdapter` function body via a synchronous `require()` call wrapped in try/catch — this is the cleanest approach for a CJS-compiled module:

```typescript
// sdk/src/query/adapter-factory.ts
import { MarkdownAdapter } from '../../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../../adapters/types.js';
import { loadConfig } from '../config.js';

export class BeadsAdapterUnavailable extends Error {
  readonly __brand = 'BeadsAdapterUnavailable' as const;
  constructor(reason: 'missing-package' | 'missing-bd', installCmd: string) {
    super(`BeadsAdapter unavailable (${reason}). Install: ${installCmd}`);
  }
}

export function createStorageAdapter(projectDir: string, opts?: { adapterName?: string }): StorageAdapter {
  const adapterName = opts?.adapterName ?? 'markdown';
  if (adapterName === 'markdown' || !adapterName) {
    return new MarkdownAdapter(projectDir);
  }
  if (adapterName === 'beads') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { default: BeadsAdapter } = require('gsd-beads');
      return new BeadsAdapter(projectDir);
    } catch (err) {
      throw new BeadsAdapterUnavailable('missing-package', 'npm install gsd-beads');
    }
  }
  throw new Error(`Unknown adapter: "${adapterName}". Valid values: "markdown", "beads"`);
}
```

This factory is **synchronous** throughout. Call sites replace `new MarkdownAdapter(projectDir)` with `createStorageAdapter(projectDir)` and optionally pass the adapter name from config.

### Config schema extension

`VALID_CONFIG_KEYS` in `sdk/src/query/config-schema.ts` needs `'storage.adapter'` added. The `GSDConfig` interface in `sdk/src/config.ts` needs a `storage?: { adapter?: 'markdown' | 'beads' }` field. The `loadConfig()` function reads from config.json and already has `[key: string]: unknown` escape hatch but should have a typed path.

The CJS mirror `get-shit-done/bin/lib/config-schema.cjs` must also add `'storage.adapter'` (parity test in `tests/config-schema-sdk-parity.test.cjs` enforces set-equality). This is a 2-file atomic change.

### Pipeline.ts discretionary casts (lines 124, 136)

```typescript
// pipeline.ts lines 124-128 (confirmed by inspection):
const ext = adapter as unknown as {
  withTransaction<T>(fn: () => Promise<T>, opts?: { dryRun?: boolean }): Promise<T>;
  _txnContextForPipeline?: () => ...;
  _realReadForPipeline?: (relPath: string) => Promise<string | null>;
};
```

These casts reach into **MarkdownAdapter-internal** underscore-prefixed methods. The comment at line 139 already documents: `// non-MarkdownAdapter: leave diff empty`. When `createStorageAdapter` returns a `BeadsAdapter`, `ext._txnContextForPipeline?.()` returns `undefined` and the diff computation short-circuits with an empty diff. No changes to pipeline.ts are required for DIST-01 — the discretionary casts are already graceful-fallback for non-MarkdownAdapter.

---

## DIST-02 Deep Dive: Fork-Side Surface

[VERIFIED: CONTEXT.md D-07/D-08/D-09/D-10/D-11 + gsd-beads package.json]

### What fork-side DIST-02 delivers

1. **`docs/MIGRATION.md`** — user-facing migration guide covering:
   - Prerequisites: gsd-beads installed, `.beads/` does not exist, bd v1.0.4+ installed.
   - Command: `gsd-beads migrate [--dry-run]` run from project root.
   - Dry-run output: plan-then-apply JSON showing each noun (type, source path, target bd id, frontmatter preview).
   - Apply: seeds bd store via `bd init --from-jsonl` with auto-generated ids. Non-idempotent (different ids on re-run — documented for v1.0).
   - Rollback: delete `.beads/` + restore `.planning.markdown-backup-${date}/` to `.planning/`.
   - Post-migration: set `storage.adapter: beads` in `.planning/config.json`.
   - Note on `commitPlanningState` NOOP (per D-2026-05-12-OQ01-BEADS): git commits are no-ops on bd backend.
   - Reference to conformance suite as verification tool post-migrate.

2. **`README.md` update** — add a "Storage backends" section pointing to `docs/MIGRATION.md`.

3. **Optional pass-through** — `gsd-sdk query storage.migrate` (if planner decides to include) would shell out to `gsd-beads migrate` with forwarded args. Low-value for v1.0 since it's just a one-time operation; planner can omit.

### Sibling surface the docs reference

The sibling (`/Volumes/code/gsd-beads`) exports from `"."` entry point: `import BeadsAdapter from 'gsd-beads'`. No `migrate` subcommand exists yet; it is DIST-02's sibling-side deliverable (out of scope for fork Phase 8 planning).

The `normalize()` method on `StorageAdapter` (D-2026-05-12-NORMALIZE) can be used by the migration tool's pre-seed normalize pass — call `beadsAdapter.normalize(markdownBody)` before seeding to avoid frontmatter byte-drift. The conformance manifest's `noun-roundtrip` entries document which nouns are affected.

---

## DIST-03 Deep Dive: Rebase History + Script Design

[VERIFIED: git log inspection]

### Prior rebase history

The fork has been rebased against upstream once already, as evidenced by commit `6d5889a9 fix(upstream-sync): resolve 13 test failures after 228-commit rebase`. This commit fixed 13 test failures introduced by a 228-commit upstream batch. The rebase also required:
- `970d1ab7 fix(upstream-sync): make adapter optional with MarkdownAdapter default`
- `be8cdae6 fix(upstream-sync): reconcile adapter DI with upstream's registry-assembly refactor`

These commits are the ground truth for the conflict types that actually occur:
- **Seam conflicts**: signature changes to `createRegistry()` call sites (the D-2026-04-30-09 D-08 pattern).
- **Test-expectation drift**: upstream test changes whose expectations diverge from fork's fixed CJS-parity patches.
- **Adapter-optional pattern**: upstream adds a function that constructs a `GSDTools`-like object without adapter injection.

No business-logic conflicts were observed in the first rebase — consistent with the architecture.

### `scripts/sync-upstream.sh` design

The script should:
1. Fetch upstream: `git fetch upstream`
2. Record pre-rebase HEAD: `PRE_REBASE=$(git rev-parse HEAD)`
3. Rebase: `git rebase upstream/main` (or a specified ref via `$1`)
4. On success: `git diff "${PRE_REBASE}..HEAD" -- '*.ts' '*.cjs' '*.mjs' '*.md' | node scripts/leak-grep.cjs /dev/stdin` (pipe the diff to leak-grep or save to tmpfile first)
5. If leak-grep exits 1 (leaks found): print the list with advisory header; exit 0.
6. If leak-grep exits 0: print "No new leaks found after rebase."

**Leak-grep invocation detail**: `scripts/leak-grep.cjs` accepts `<path> [<path>...]` on argv. It cannot consume a unified diff via stdin directly — it reads file content. The script should save the post-rebase changed files list (`git diff --name-only "${PRE_REBASE}..HEAD"`) and pass those file paths to leak-grep. This is more useful than scanning the diff, because it shows the full current state of changed files, not just the added lines.

```bash
# Correct invocation pattern:
CHANGED_FILES=$(git diff --name-only "${PRE_REBASE}..HEAD")
if [ -n "$CHANGED_FILES" ]; then
  echo "$CHANGED_FILES" | xargs node scripts/leak-grep.cjs || true  # exit 0 regardless
fi
```

### Conflict taxonomy for `docs/UPSTREAM-REBASE.md`

**Seam conflicts (expected on every rebase affecting `createRegistry()`):**

Files: `sdk/src/gsd-tools.ts`, `sdk/src/cli.ts`, `sdk/src/index.ts`, `sdk/src/query/query-cli-adapter.ts`, `sdk/src/query-gsd-tools-runtime.ts`, `sdk/src/golden/registry-canonical-commands.ts`, any new file upstream adds that calls `createRegistry()`.

Resolution pattern: upstream adds `createRegistry({...})` without adapter arg; fork requires `createRegistry({ adapter: new MarkdownAdapter(...) })`. Resolution: accept upstream's new arguments and inject `adapter: ...` alongside. If upstream adds a `MarkdownAdapter`-only construction site (a new direct I/O leak), that is a business-logic conflict (next category).

**Business-logic conflicts (red flag — investigate):**

Trigger: upstream modifies a file that the fork's leak-grep would catch. Examples: new `readFileSync('.planning/...')` in SDK core, new `gsd-tools.cjs` handler that bypasses adapter.

Resolution workflow:
1. Inspect the conflict site. Is it a new adapter route that should go through `adapter.*`?
2. If yes: route through adapter, file note in commit message. Consider filing upstream issue.
3. If no (e.g., it's truly not a `.planning/` path): resolve normally.

**CJS binary conflicts (expected; mechanical):**

Files: `get-shit-done/bin/lib/*.cjs` — compiled CJS outputs. Resolution: always take the upstream version and re-apply any fork-side CJS patches on top.

---

## DIST-04 Deep Dive: Parity CI Design

[VERIFIED: code inspection of golden test suite, npm pack output, upstream tag inspection]

### Upstream golden suite structure

The upstream golden suite (PR #2909) lives at:
- `sdk/src/golden/golden.integration.test.ts` — integration tests comparing SDK dispatch to CJS subprocess output
- `sdk/src/golden/golden-policy.test.ts` — policy test ensuring every registry command is covered or excepted
- `sdk/src/golden/read-only-golden-rows.ts` — read-only command pairs
- `sdk/src/golden/registry-canonical-commands.ts` — command enumeration (also a DIST-01 migration site)

The tests are standard vitest tests that run via `cd sdk && npx vitest run`. They import `createRegistry` with `new MarkdownAdapter(...)` — which is exactly the "no adapter config" path that DIST-04 validates.

### npm pack output

Running `npm pack --dry-run` from the fork root (current HEAD) produces tarball `get-shit-done-cc-1.39.0-rc.4.tgz`. The tarball includes:
- All `adapters/` source + dist files
- `sdk/` dist files
- `get-shit-done/` command files (skills, workflows, agents, etc.)
- READMEs
- `CLAUDE.md`

The parity workflow packs from the fork, installs into an upstream checkout at a pinned tag, then runs upstream's golden suite against the installed fork.

### Parity workflow design

```yaml
# .github/workflows/upstream-parity.yml
name: upstream-parity
on:
  pull_request:
    branches: [feat/storage-adapter, main]
  push:
    branches: [main]
jobs:
  parity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4  # fork checkout
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run build:adapters && npm run build:sdk-only
      - run: npm pack  # produces get-shit-done-cc-*.tgz
      - name: Checkout upstream at pinned tag
        uses: actions/checkout@v4
        with:
          repository: gsd-build/get-shit-done
          ref: v1.39.0  # PINNED TAG — update deliberately
          path: upstream-checkout
      - name: Install fork tarball into upstream checkout
        working-directory: upstream-checkout
        run: npm install ../get-shit-done-cc-*.tgz
      - name: Build upstream SDK dist (needed by golden tests)
        working-directory: upstream-checkout
        run: cd sdk && npm ci && npm run build
      - name: Run upstream golden suite against fork
        working-directory: upstream-checkout
        run: cd sdk && npx vitest run src/golden/
```

**Sanitize()-before-compare**: The golden tests in upstream use `captureGsdToolsOutput` and compare against fixtures. The `sanitize()` function from `tests/conformance/init-bundlers.test.ts` handles: timestamps, home paths, temp paths, date fields, quick_id, cwd_repo_name, project_root, etc. The planner can either:
(a) Extract `sanitize()` to `tests/shared/sanitize.ts` and import it in both init-bundlers.test.ts and the upstream parity test, or
(b) Copy the function inline into the parity test since it's isolated.

Option (a) is cleaner and reduces drift risk. The current `sanitize()` body is 42 lines; extraction is straightforward.

### Upstream tag selection

At time of research, `upstream/main` is at commit `3579a48d` (PR #3158, sdk-runtime-bridge-seam). The local tags go up to `v1.9.9` — these appear to be an unrelated tag series (likely testing/internal). The upstream GSD package is at version `1.39.0-rc.4` per package.json. The planner should check `git tag --list '*upstream*' -a` or `git ls-remote upstream 'refs/tags/*'` to confirm the correct upstream tag name format at DIST-04 authoring time.

---

## Architecture Patterns

### System Architecture Diagram

```
User sets storage.adapter: beads in .planning/config.json
            |
            v
[loadConfig(projectDir)] ← sdk/src/config.ts
            |
            | config.storage.adapter
            v
[createStorageAdapter(projectDir, opts)] ← sdk/src/query/adapter-factory.ts
            |
            |── 'markdown' (default) ──→ new MarkdownAdapter(projectDir) ──→ .planning/ filesystem
            |
            └── 'beads' ──→ try { require('gsd-beads') }
                              |
                              |── success ──→ new BeadsAdapter(projectDir) ──→ bd CLI ──→ .beads/ SQLite
                              |
                              └── catch ──→ throw BeadsAdapterUnavailable (install hint)

StorageAdapter instance
            |
            v
[createRegistry({ adapter })] ← sdk/src/query/index.ts
            |
            v
All SDK query handlers (state.*, phase.*, roadmap.*, init.*, verify.*, validate.*, etc.)
```

### Recommended Project Structure (new files for Phase 8)

```
sdk/src/query/
└── adapter-factory.ts      # DIST-01: createStorageAdapter() + BeadsAdapterUnavailable

docs/
└── MIGRATION.md            # DIST-02: markdown → bd migration user guide

docs/
└── UPSTREAM-REBASE.md      # DIST-03: rebase playbook + conflict taxonomy

scripts/
└── sync-upstream.sh        # DIST-03: automated rebase + post-rebase leak scan

.github/workflows/
└── upstream-parity.yml     # DIST-04: strict-superset parity CI gate

tests/shared/               # optional DIST-04 extraction
└── sanitize.ts             # extracted sanitize() for reuse across parity + init-bundlers

.planning/phases/08-migration-distribution/
├── 08-PRE0-PLAN.md
├── 08-DIST01-PLAN.md
├── 08-DIST02-PLAN.md
├── 08-DIST03-PLAN.md
├── 08-DIST04-PLAN.md
└── 08-DIST05-PLAN.md       # placeholder, written at phase-close
```

### Pattern 1: Static import + runtime guard for optional peer

```typescript
// sdk/src/query/adapter-factory.ts
// Source: D-05 (CONTEXT.md) + SKILL.md §D-RUNTIME-RESOLUTION

import { MarkdownAdapter } from '../../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../../adapters/types.js';

export class BeadsAdapterUnavailable extends Error {
  // mirrors UnsupportedCapabilityError pattern from adapters/types.ts
  override readonly name = 'BeadsAdapterUnavailable';
  readonly __brand = 'BeadsAdapterUnavailable' as const;
  readonly reason: 'missing-package' | 'missing-bd';
  constructor(reason: 'missing-package' | 'missing-bd', installCmd: string) {
    super(`BeadsAdapter unavailable (${reason}). Install: ${installCmd}`);
    this.reason = reason;
  }
  static [Symbol.hasInstance](instance: unknown): boolean {
    return (instance as any)?.__brand === 'BeadsAdapterUnavailable';
  }
}

export function createStorageAdapter(
  projectDir: string,
  opts?: { adapter?: 'markdown' | 'beads' }
): StorageAdapter {
  const adapterName = opts?.adapter ?? 'markdown';
  if (adapterName === 'markdown') {
    return new MarkdownAdapter(projectDir);
  }
  if (adapterName === 'beads') {
    let BeadsAdapterClass: new (p: string) => StorageAdapter;
    try {
      // require() is synchronous; module resolves at call time.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      BeadsAdapterClass = (require('gsd-beads') as { default: new (p: string) => StorageAdapter }).default;
    } catch {
      throw new BeadsAdapterUnavailable('missing-package', 'npm install gsd-beads');
    }
    return new BeadsAdapterClass(projectDir);
  }
  throw new Error(`Unknown adapter: "${adapterName}". Valid values: "markdown", "beads"`);
}
```

### Pattern 2: Config-aware factory invocation at call sites

```typescript
// Replacement for: new MarkdownAdapter(projectDir)
// Source: CONTEXT.md D-06 — all sites migrate in same plan

import { createStorageAdapter } from './adapter-factory.js';
import { loadConfig } from '../config.js';

// In an async context (cli.ts runCli, etc.):
const config = await loadConfig(projectDir);
const adapter = createStorageAdapter(projectDir, { adapter: config.storage?.adapter });
```

For sync call sites (where loadConfig hasn't been called yet), the factory defaults to `'markdown'` when `opts?.adapter` is undefined, so `createStorageAdapter(projectDir)` remains backward-compatible.

### Pattern 3: CJS writer in gen-command-aliases.ts

```typescript
// sdk/scripts/gen-command-aliases.ts (addition for Pre-0)
// CJS output format:
const cjsHeader = `'use strict';\n\n/**\n * GENERATED FILE — ...\n */\n\n`;
const cjsBody = families.map(f =>
  `const ${f.constName} = [\n` +
  f.entries.map(e =>
    `  { canonical: '${e.canonical}', aliases: [${e.aliases.map(a => `'${a}'`).join(', ')}], subcommand: '${e.subcommand}', mutation: ${e.mutation} },`
  ).join('\n') +
  '\n];\n'
).join('\n') + '\n' +
families.map(f => `const ${f.subcommandConst} = ${f.constName}.map((entry) => entry.subcommand);`).join('\n') +
'\n\nmodule.exports = {\n' +
[...families.map(f => `  ${f.constName}`), ...families.map(f => `  ${f.subcommandConst}`)].join(',\n') +
'\n};\n';

await writeFile(cjsOutPath, cjsHeader + cjsBody, 'utf-8');
```

### Anti-Patterns to Avoid

- **Silent fallback to MarkdownAdapter when beads unavailable**: explicitly rejected in D-04. If `storage.adapter: beads` is set but gsd-beads is missing, throw `BeadsAdapterUnavailable` with the install command. Never silently degrade.
- **`adapterFor()` in helpers.ts left as a permanent API**: the transitional helper cache (`_adapterCache`) was introduced for Phase 5 transaction sharing. After DIST-01, primary call sites should use `createStorageAdapter()`. `adapterFor()` can remain for internal helpers that are not yet on the factory path, but should be annotated as deprecated.
- **Upstream parity test checking byte-identical output without sanitization**: dates, paths, and volatile fields will differ across machines and time. Always sanitize before compare.
- **Committing a regenerated alias file that was produced by the old generator**: the check script (`check-command-aliases-fresh.mjs`) will fail if the TS artifact lacks the `FamilyCommandAlias` interface or uses wrong formatting. Run the check script locally before committing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error class for missing gsd-beads | Custom ad-hoc Error | `BeadsAdapterUnavailable` following `UnsupportedCapabilityError` pattern (adapters/types.ts:149-168) | Brand field + `[Symbol.hasInstance]` cross-module resilience is already established pattern |
| Path sanitization for parity tests | Custom regex per test | Extract + reuse `sanitize()` from `tests/conformance/init-bundlers.test.ts` lines 53-95 | 42 lines already covering all volatile fields; manually re-implementing will miss cases |
| Leak scan on post-rebase diff | New scanner | `node scripts/leak-grep.cjs <files>` on the changed file paths | Already battle-tested; skip-directives and allow-lists are already in place |
| Config schema allowlist sync | Manual | Edit both `sdk/src/query/config-schema.ts` AND `get-shit-done/bin/lib/config-schema.cjs`; the parity test catches drift | `tests/config-schema-sdk-parity.test.cjs` enforces set-equality between the two allowlists |

**Key insight:** Every Phase 8 deliverable reuses existing infrastructure. The factory uses the existing `MarkdownAdapter` and `BeadsAdapter` constructors. The parity CI reuses the existing golden suite. The rebase script reuses the existing leak-grep. The only genuinely new code is `adapter-factory.ts` (~60 LOC) and the generator rewrite (~150 LOC).

---

## Common Pitfalls

### Pitfall 1: `require('gsd-beads')` in ESM context

**What goes wrong:** `sdk/src/query/adapter-factory.ts` compiles to ESM by default (`"type": "module"` in sdk/package.json or `.js` ESM). `require()` is not available in ESM. The factory will throw a `ReferenceError` at module load time, not at the call site.

**Why it happens:** The "static import + runtime guard" decision (D-05) was specified assuming CJS compilation. The SDK compiles via tsc with `"module": "NodeNext"` which supports mixed ESM/CJS, but the generated output depends on the file extension and package.json settings.

**How to avoid:** Check `sdk/package.json` `"type"` field and the `tsconfig.json` `"module"` setting before writing the factory. If the output is ESM, use `import.meta.resolve()` or a try/catch around a dynamic `await import('gsd-beads')` — but this forces the factory async. If CJS, `require()` with try/catch works. The planner should inspect the compile target and document the chosen pattern.

**Warning signs:** `require is not defined` at runtime; tsc emits `.mjs` extension; `"type": "module"` in sdk/package.json.

### Pitfall 2: Config not yet loaded at construction sites

**What goes wrong:** Many `new MarkdownAdapter(projectDir)` call sites construct the adapter before `loadConfig()` has been called (e.g., in synchronous constructor bodies). The factory needs to read `storage.adapter` from config, but config reading is async.

**Why it happens:** The SDK has a layered initialization. The `createRegistry()` call in `cli.ts` happens after `args` are parsed but not necessarily after full config load.

**How to avoid:** The factory's `opts?.adapter` parameter defaults to `'markdown'` when undefined. Call sites that have access to loaded config pass the adapter name; call sites that don't use `createStorageAdapter(projectDir)` (no opts) and get the markdown default. The factory never calls `loadConfig()` internally — config-to-factory wiring is the caller's responsibility. Document this in the factory's JSDoc.

### Pitfall 3: CJS artifact path confusion

**What goes wrong:** The CJS artifact lives at `get-shit-done/bin/lib/command-aliases.generated.cjs` (inside the `get-shit-done/` subdirectory), NOT at `bin/lib/command-aliases.generated.cjs` at the repo root. The check script at `sdk/scripts/check-command-aliases-fresh.mjs` line 41 uses `resolve(here, '..', '..', 'get-shit-done', 'bin', 'lib', 'command-aliases.generated.cjs')` — navigating up from `sdk/scripts/` two levels to repo root, then into `get-shit-done/bin/lib/`.

**Why it happens:** The `get-shit-done/` directory is the upstream source tree; the CJS alias file is part of the CJS routing layer in that tree, not in the fork's root.

**How to avoid:** The rewritten generator's CJS output path should be `fileURLToPath(new URL('../../../get-shit-done/bin/lib/command-aliases.generated.cjs', import.meta.url))` (navigating from `sdk/scripts/` up to repo root and then into `get-shit-done/bin/lib/`). Verify against what the check script expects.

### Pitfall 4: `adapterFor()` cache stale after factory migration

**What goes wrong:** `adapterFor()` in helpers.ts maintains a `_adapterCache` singleton keyed by `projectDir`. If `createStorageAdapter()` creates a `BeadsAdapter` instance and `adapterFor()` creates a `MarkdownAdapter` for the same projectDir, the pipeline.ts dry-run logic (which calls `adapterFor()`) gets a different adapter than the registry, breaking transaction sharing.

**Why it happens:** `adapterFor()` always constructs `MarkdownAdapter` regardless of config. After DIST-01, it should use `createStorageAdapter()`.

**How to avoid:** Update `adapterFor()` to call `createStorageAdapter(projectDir)` (using the same config-read path, possibly synchronous since config may already be loaded in the pipeline context). Or mark `adapterFor()` as deprecated/MarkdownAdapter-only with a comment. The planner must decide whether pipeline.ts dry-run's MarkdownAdapter-internal method access (`_txnContextForPipeline`, `_realReadForPipeline`) creates an implicit MarkdownAdapter-only constraint that overrides the factory dispatch.

### Pitfall 5: Upstream tag format mismatch in parity workflow

**What goes wrong:** The workflow hard-codes `ref: v1.39.0` but the upstream's actual tags use a different format (e.g., `v1.39.0-rc.4` or numeric only).

**How to avoid:** Run `git ls-remote upstream 'refs/tags/*' | sort -t/ -k3 -V | tail -5` to confirm the tag naming convention before committing the workflow. The check-out should use the most recent stable (non-rc) tag, or the RC that matches the fork's current version.

---

## Runtime State Inventory

This is a code-and-config-only phase (no rename/refactor). No runtime state migration is required. The `storage.adapter` config key is purely additive; existing `.planning/config.json` files without the key continue to behave identically to upstream.

**Nothing found in any category — verified by phase description analysis.** Phase 8 adds new files and config keys; it does not rename or refactor existing string identifiers that would persist in external state.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bd` CLI | DIST-01 integration path; parity CI | ✓ (local) | 1.0.4 (Homebrew) | — (required for beads adapter; parity test uses no-adapter path) |
| `gsd-beads` sibling | DIST-01 factory import | ✓ | `1.0.0-alpha.0` at `/Volumes/code/gsd-beads` | — (required for `storage.adapter: beads` path) |
| Node.js | All | ✓ | v22.14.0 | — |
| npm | `npm pack` for DIST-04 | ✓ | 11.3.0 | — |
| GitHub Actions (Ubuntu) | DIST-04 parity CI | N/A (CI env) | ubuntu-latest | — |

**Missing dependencies with no fallback:** None that would block plan execution.

**Note for DIST-04 CI:** The parity workflow needs `bd` installed on the CI runner (Ubuntu) because the paired conformance suite already runs there (Plan 07-04a installed bd on CI). The parity suite itself runs in the upstream checkout with no-adapter-config, so `bd` is NOT needed for the parity run. The install step in test.yml that installs bd is from the existing conformance step; the parity workflow can use a separate job that does NOT require bd.

---

## Validation Architecture

> `workflow.nyquist_validation` is not set to `false` in `.planning/config.json` (`{"workflow":{"security_enforcement":false}}`). Treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (sdk/vitest.config.ts, sdk/vitest.conformance.config.ts) |
| Config file | `sdk/vitest.config.ts` + `sdk/vitest.conformance.config.ts` |
| Quick run command | `cd sdk && npx vitest run` |
| Full suite command | `npm run test:coverage` (from repo root) |
| Conformance command | `npm run test:conformance:paired` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIST-01 | `createStorageAdapter('beads')` returns BeadsAdapter; `'markdown'` returns MarkdownAdapter | unit | `cd sdk && npx vitest run src/query/adapter-factory.test.ts` | ❌ Wave 0 |
| DIST-01 | `BeadsAdapterUnavailable` thrown when gsd-beads absent | unit | `cd sdk && npx vitest run src/query/adapter-factory.test.ts` | ❌ Wave 0 |
| DIST-01 | `config-schema.ts` VALID_CONFIG_KEYS includes `'storage.adapter'` | unit | `cd sdk && npx vitest run src/query/config-schema.test.ts` | ✅ (extend existing) |
| DIST-01 | CJS `config-schema.cjs` parity with SDK | unit | `npx vitest run tests/config-schema-sdk-parity.test.cjs` | ✅ (extend existing) |
| DIST-04 | Upstream golden suite passes against fork tarball | integration | CI only via `upstream-parity.yml` | ❌ Wave 0 |
| Pre-0 | Alias artifacts are fresh after generator rewrite | unit | `node sdk/scripts/check-command-aliases-fresh.mjs` | ✅ (check script exists) |
| Pre-0 | TS alias format matches committed shape | integration | `node sdk/scripts/check-command-aliases-fresh.mjs` | ✅ (check script covers both) |

### Sampling Rate

- **Per task commit:** `cd sdk && npx vitest run src/query/adapter-factory.test.ts` (DIST-01) or `node sdk/scripts/check-command-aliases-fresh.mjs` (Pre-0)
- **Per wave merge:** `npm run test:coverage`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `sdk/src/query/adapter-factory.test.ts` — covers DIST-01 factory unit tests (markdown default, beads routing, missing-package error class shape)
- [ ] `.github/workflows/upstream-parity.yml` — covers DIST-04 parity CI gate
- [ ] `docs/MIGRATION.md` — covers DIST-02 documentation
- [ ] `docs/UPSTREAM-REBASE.md` — covers DIST-03 playbook
- [ ] `scripts/sync-upstream.sh` — covers DIST-03 automation

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `new MarkdownAdapter(projectDir)` hardcoded at N call sites | `createStorageAdapter(projectDir, opts?)` factory reading config | DIST-01 (Phase 8) | Enables config-driven adapter selection without per-site changes |
| `adapterFor()` async transitional helper with `_adapterCache` | Factory-based construction at call sites; `adapterFor()` retained for pipeline dry-run only | DIST-01 (Phase 8) | Removes last major adapter-construction indirection |
| Alias generator emits JSON.stringify format (mismatched from committed artifact) | Generator emits inline typed format + CJS writer | Pre-0 (Phase 8) | Alias drift CI check re-enabled; prevents future hand-sync errors |
| No upstream parity CI | `upstream-parity.yml` with npm pack + tag-pinned upstream golden suite | DIST-04 (Phase 8) | Prevents strict-superset invariant regressions silently landing |

**Deprecated/outdated:**
- `sdk/scripts/gen-command-aliases.ts` current format: produces wrong output; replaced by rewrite in Pre-0.
- `if: false` guard on alias drift CI step: removed in Pre-0.
- `adapterFor()` in helpers.ts: after DIST-01, this should be annotated as transitional/deprecated; remaining call sites should migrate to factory over time (not required for DIST-01 itself beyond ensuring no dual-construction for the same projectDir).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The SDK compiles to CJS (allowing `require()` in factory) or to NodeNext ESM (requiring async factory or dynamic import workaround) | DIST-01 factory signature, Pitfall 1 | Wrong compilation target forces factory async, requiring N-site async refactoring |
| A2 | `config-schema.cjs` lives in the CJS layer at `get-shit-done/bin/lib/config-schema.cjs` and has the same allowlist validation pattern | DIST-01 config schema extension | If different location or pattern, the parity test change plan is wrong |
| A3 | Upstream parity tag naming follows `v1.39.x` semver format matching the fork's package.json version | DIST-04 workflow tag pin | Incorrect tag causes checkout failure in CI |

**A1 investigation note:** The factory file lives in `sdk/src/query/`. The `sdk/` package uses tsc. Check `sdk/tsconfig.json` `"module"` setting before finalizing factory implementation. If it's `"NodeNext"`, emit a `.cjs` extension OR use dynamic import. If `"CommonJS"`, use `require()`. [ASSUMED: CJS or NodeNext with CJS output — needs verification by implementor]

---

## Open Questions

1. **Is `sdk/` compiled to CJS or ESM?**
   - What we know: `sdk/` uses tsc; `sdk/dist/` files exist; npm pack includes `sdk/dist/`.
   - What's unclear: Whether `sdk/tsconfig.json` targets `"module": "CommonJS"` or `"NodeNext"`. This determines whether `require()` is available in `adapter-factory.ts`.
   - Recommendation: `cat sdk/tsconfig.json | grep -i module` before writing the factory. If `NodeNext`, use `createRequire(import.meta.url)` from `node:module` as the require shim (already used in `sdk/scripts/check-command-aliases-fresh.mjs` line 6).

2. **Does `config-schema.cjs` exist and where?**
   - What we know: `config-schema.ts` has a JSDoc comment referencing `get-shit-done/bin/lib/config-schema.cjs` and `tests/config-schema-sdk-parity.test.cjs`.
   - What's unclear: Whether `get-shit-done/bin/lib/config-schema.cjs` was already created as a fork artifact or still needs to be created.
   - Recommendation: `ls get-shit-done/bin/lib/config-schema.cjs` to confirm existence before DIST-01 planning.

3. **Should `adapterFor()` be updated or left as MarkdownAdapter-only?**
   - What we know: `adapterFor()` is used by pipeline.ts dry-run which accesses MarkdownAdapter-internal underscore methods. Updating it to `createStorageAdapter()` could cause it to return a BeadsAdapter when config says beads, but pipeline.ts's MarkdownAdapter-specific methods would then silently no-op (the `?.()` guard already handles this).
   - What's unclear: Whether the pipeline.ts dry-run is expected to work with BeadsAdapter in v1.0 or is explicitly MarkdownAdapter-only.
   - Recommendation: Keep `adapterFor()` as MarkdownAdapter-only (it already has the comment "Lazy import keeps this file free of an adapters/ static import"). Add a JSDoc note: "Returns MarkdownAdapter regardless of config. Pipeline dry-run diffs rely on MarkdownAdapter internals. Use createStorageAdapter() for config-driven dispatch in other contexts."

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `sdk/src/gsd-tools.ts`, `sdk/src/cli.ts`, `sdk/src/index.ts`, `sdk/src/query-gsd-tools-runtime.ts`, `sdk/src/query/query-cli-adapter.ts`, `sdk/src/query/helpers.ts`, `sdk/src/golden/registry-canonical-commands.ts` — construction site inventory
- Direct code inspection: `sdk/scripts/gen-command-aliases.ts`, `sdk/src/query/command-aliases.generated.ts`, `get-shit-done/bin/lib/command-aliases.generated.cjs`, `sdk/scripts/check-command-aliases-fresh.mjs` — Pre-0 delta analysis
- Direct code inspection: `adapters/types.ts` — `UnsupportedCapabilityError` pattern for `BeadsAdapterUnavailable`
- Direct code inspection: `sdk/src/query/config-schema.ts`, `sdk/src/config.ts` — config schema extension target
- Direct code inspection: `tests/conformance/init-bundlers.test.ts` lines 53-95 — `sanitize()` pattern
- Direct code inspection: `scripts/leak-grep.cjs`, `scripts/install-hooks.sh` — DIST-03 tooling
- Direct code inspection: `sdk/src/golden/golden.integration.test.ts`, `registry-canonical-commands.ts` — DIST-04 golden suite structure
- `git log --oneline feat/storage-adapter | grep -i 'rebase\|upstream'` — prior rebase history
- `git remote -v` — upstream remote confirmed at `https://github.com/gsd-build/get-shit-done.git`
- `npm pack --dry-run` — tarball size and manifest
- `/Volumes/code/gsd-beads/package.json` — sibling exports shape
- `.planning/phases/08-migration-distribution/08-CONTEXT.md` — all 21 locked decisions
- `.planning/DECISIONS.md` — D-2026-04-30-02, -04, -05, -10, D-2026-05-12-OQ01-BEADS, D-2026-05-12-CONFORM-MANIFEST

### Secondary (MEDIUM confidence)
- `.github/workflows/test.yml` lines 163-205 — CI matrix structure and existing step patterns
- `.claude/skills/spike-findings-gsd-beads/SKILL.md` — JSONL seed patterns, D-RUNTIME-RESOLUTION export shape
- `.planning/ROADMAP.md` lines 227-241, `.planning/REQUIREMENTS.md` lines 80-84

### Tertiary (LOW confidence)
- A1 (compiler target) — needs one shell command to verify; all factory patterns in this document assume CJS-compatible output

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are existing project dependencies
- Architecture: HIGH — all patterns verified from existing code
- Pre-0 delta: HIGH — generator vs committed artifact diff directly inspected
- DIST-01 construction sites: HIGH — directly enumerated from source
- DIST-03 rebase history: HIGH — confirmed from git log
- DIST-04 golden suite: HIGH — directly inspected
- Pitfalls: HIGH for P1-P4, MEDIUM for P5 (tag format depends on upstream registry state)

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable phase; no fast-moving dependencies)
