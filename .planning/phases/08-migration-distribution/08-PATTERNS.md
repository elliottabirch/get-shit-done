# Phase 8: Migration + Distribution — Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 14 new/modified files
**Analogs found:** 11 / 14 (3 docs/prose files have no code analog)

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `sdk/src/query/adapter-factory.ts` | integration-glue / service | config-in → StorageAdapter-out | `sdk/src/query/helpers.ts` lines 499–507 (`adapterFor`) + `adapters/types.ts` lines 149–168 (`UnsupportedCapabilityError`) | role-match |
| `sdk/src/query/adapter-factory.test.ts` | test | fixture-project → unit assertions | `sdk/src/query/config-query.test.ts` lines 1–106 | exact |
| `sdk/src/query/config-schema.ts` (modify) | config | additive key append | self (existing `VALID_CONFIG_KEYS` set) | exact |
| `sdk/scripts/gen-command-aliases.ts` (rewrite) | utility / generator | manifest-in → two file artifacts out | self (existing generator, same ESM + `writeFile` skeleton) | exact |
| `sdk/src/query/command-aliases.generated.ts` (regenerate) | generated artifact | generator → committed TS | self (committed format is the target) | exact |
| `bin/lib/command-aliases.generated.cjs` (first-time emit) | generated artifact | generator → committed CJS | `get-shit-done/bin/lib/command-aliases.generated.cjs` lines 1–30 (format target) | exact |
| `.github/workflows/upstream-parity.yml` | CI | PR-trigger → upstream golden suite | `.github/workflows/test.yml` lines 1–50, 155–205 | role-match |
| `tests/shared/sanitize.ts` | utility / test-helper | raw output string → sanitized string | `tests/conformance/init-bundlers.test.ts` lines 53–95 | exact (extraction) |
| `docs/MIGRATION.md` | documentation | n/a (prose) | `docs/README.md` (prose-level ref) | no analog |
| `docs/UPSTREAM-REBASE.md` | documentation | n/a (prose) | none | no analog |
| `scripts/sync-upstream.sh` | utility / script | git plumbing + leak-grep invocation | `scripts/install-hooks.sh` lines 1–19 | role-match |
| `sdk/src/gsd-tools.ts` et al. (modify ~8 sites) | integration-glue | `new MarkdownAdapter(...)` → `createStorageAdapter(...)` | self (existing construction sites; pattern in `sdk/src/gsd-tools.ts` lines 170, 630) | exact |
| `.github/workflows/test.yml` line 179 (modify) | CI | remove `if: false` guard | self (lines 163–181 are the bypass block) | exact |
| `README.md` (modify) | documentation | additive section | self | exact |

---

## Pattern Assignments

### `sdk/src/query/adapter-factory.ts` (integration-glue, config-in → StorageAdapter-out)

**Analogs:**
- `sdk/src/query/helpers.ts` lines 499–507 — `adapterFor()`: the only existing helper that returns a `StorageAdapter`; factory replaces this pattern
- `adapters/types.ts` lines 149–168 — `UnsupportedCapabilityError`: the established error-class shape (brand field, `[Symbol.hasInstance]`, typed fields) to copy for `BeadsAdapterUnavailable`

**Critical constraint — compiler target:** `sdk/tsconfig.json` has `"module": "NodeNext"`. Files compiled under NodeNext that need synchronous require of an optional peer must use `createRequire(import.meta.url)` (the same shim used at `sdk/scripts/check-command-aliases-fresh.mjs` line 6). Plain `require()` is NOT available in NodeNext ESM output.

**Imports pattern** (`sdk/src/gsd-tools.ts` lines 20–28, showing existing import style for MarkdownAdapter):
```typescript
import type { StorageAdapter } from '../../adapters/types.js';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
```

**Error class pattern** (`adapters/types.ts` lines 149–168):
```typescript
export class UnsupportedCapabilityError extends Error {
  override readonly name = 'UnsupportedCapabilityError';
  readonly capability: string;
  readonly adapterName: string;
  /** Brand field for cross-module instanceof resilience (dual-package/vitest transform). */
  readonly __brand = 'UnsupportedCapabilityError' as const;
  constructor(capability: string, adapterName: string) {
    super(`Adapter '${adapterName}' does not support capability '${capability}'`);
    this.capability = capability;
    this.adapterName = adapterName;
  }
  static [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance != null &&
      typeof instance === 'object' &&
      (instance as Record<string, unknown>).__brand === 'UnsupportedCapabilityError'
    );
  }
}
```

**Replicate exactly:** `override readonly name`, `readonly __brand = '...' as const`, `static [Symbol.hasInstance]` with brand check. Adapt: class name → `BeadsAdapterUnavailable`; fields → `reason: 'missing-package' | 'missing-bd'` + `installCmd: string`.

**adapterFor pattern** (`sdk/src/query/helpers.ts` lines 472–507):
```typescript
// Adapter instance cache for transaction sharing (Phase 5 Plan 05)
// Exported for test cleanup
export const _adapterCache = new Map<string, StorageAdapter>();

export async function adapterFor(projectDir: string): Promise<StorageAdapter> {
  const cached = _adapterCache.get(projectDir);
  if (cached) return cached;

  const { MarkdownAdapter } = await import('../../../adapters/markdown/index.js');
  const instance = new MarkdownAdapter(projectDir);
  _adapterCache.set(projectDir, instance);
  return instance;
}
```

**Adapt:** The new factory is synchronous (no cache needed; callers construct once per entry point). Use `createRequire(import.meta.url)` from `node:module` for the optional-peer require instead of dynamic import. Structure:

```typescript
import { createRequire } from 'node:module';
import { MarkdownAdapter } from '../../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../../adapters/types.js';

const _require = createRequire(import.meta.url);

export class BeadsAdapterUnavailable extends Error { /* brand pattern from UnsupportedCapabilityError */ }

export function createStorageAdapter(
  projectDir: string,
  opts?: { adapter?: 'markdown' | 'beads' }
): StorageAdapter {
  const adapterName = opts?.adapter ?? 'markdown';
  if (adapterName === 'markdown') return new MarkdownAdapter(projectDir);
  if (adapterName === 'beads') {
    try {
      const mod = _require('gsd-beads') as { default: new (p: string) => StorageAdapter };
      return new mod.default(projectDir);
    } catch {
      throw new BeadsAdapterUnavailable('missing-package', 'npm install gsd-beads');
    }
  }
  throw new Error(`Unknown adapter: "${adapterName}". Valid values: "markdown", "beads"`);
}
```

**Pattern lessons:**
- Brand field + `[Symbol.hasInstance]` is mandatory — copy verbatim from `UnsupportedCapabilityError`
- `createRequire(import.meta.url)` is the correct NodeNext shim; `require()` bare will not compile
- Factory must never call `loadConfig()` internally — config-to-opts wiring is the caller's responsibility (see Pitfall 2 in RESEARCH.md)
- Do NOT modify `adapterFor()` cache behavior; `adapterFor()` should be annotated deprecated/MarkdownAdapter-only with a JSDoc note

---

### `sdk/src/query/adapter-factory.test.ts` (test, fixture-project → unit assertions)

**Analog:** `sdk/src/query/config-query.test.ts` lines 1–106

**Test structure pattern** (lines 1–20, 25–50):
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-cfg-'));
  await mkdir(join(tmpDir, '.planning'), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('configGet', () => {
  it('returns raw config value for top-level key', async () => {
    const { configGet } = await import('./config-query.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'quality' }),
    );
    const result = await configGet(['model_profile'], tmpDir);
    expect(result.data).toBe('quality');
  });
```

**Adapt for adapter-factory:**
- `tmpDir` prefix: `'gsd-factory-'`
- Dynamic import of `'./adapter-factory.js'` (not static — matches the pattern above)
- Test cases needed:
  1. `createStorageAdapter(dir)` with no opts → returns MarkdownAdapter instance (`expect(adapter.capabilities.transaction).toBe(true)` or check constructor name)
  2. `createStorageAdapter(dir, { adapter: 'markdown' })` → MarkdownAdapter
  3. `createStorageAdapter(dir, { adapter: 'beads' })` with gsd-beads absent → throws `BeadsAdapterUnavailable` (check brand: `(err as any).__brand === 'BeadsAdapterUnavailable'`)
  4. `BeadsAdapterUnavailable[Symbol.hasInstance](err)` → `true` for the thrown error
  5. Unknown adapter string → throws `Error` with message including `"Unknown adapter"`

**Error assertion pattern** (lines 61–78 of config-query.test.ts):
```typescript
try {
  await configGet(['nonexistent.key'], tmpDir);
  throw new Error('expected configGet to throw for missing key');
} catch (err) {
  expect(err).toBeInstanceOf(GSDError);
  const gsdErr = err as GSDError;
  expect(gsdErr.classification).toBe(ErrorClassification.Execution);
}
```

**Adapt:** Replace `toBeInstanceOf(GSDError)` with brand check `(err as any).__brand === 'BeadsAdapterUnavailable'` since cross-module instanceof may fail in vitest's transform context — this is why `UnsupportedCapabilityError` uses the brand pattern.

**Pattern lessons:**
- Use dynamic `await import('./adapter-factory.js')` not static import (matches config-query.test.ts pattern; helps vitest module isolation)
- `beforeEach` / `afterEach` with `mkdtemp` + `rm` is the project-standard fixture lifecycle
- Always test the brand field directly, not just `instanceof`

---

### `sdk/src/query/config-schema.ts` (modify — additive key append)

**Analog:** Self — existing `VALID_CONFIG_KEYS` set (lines 18–74) + CJS mirror at `get-shit-done/bin/lib/config-schema.cjs`

**Existing set pattern** (lines 18–74):
```typescript
/** Exact-match config key paths accepted by config-set. */
export const VALID_CONFIG_KEYS: ReadonlySet<string> = new Set([
  'mode', 'granularity', ...
  'runtime',
]);
```

**Required change:** Append `'storage.adapter'` to `VALID_CONFIG_KEYS`. Identical string must be added to `get-shit-done/bin/lib/config-schema.cjs` (the parity test `tests/config-schema-sdk-parity.test.cjs` enforces set-equality between the two allowlists).

**Pattern lessons:**
- This is a two-file atomic change: `config-schema.ts` + `config-schema.cjs` must be updated together
- No other changes to this file needed for DIST-01
- The `GSDConfig` interface in `sdk/src/config.ts` also needs `storage?: { adapter?: 'markdown' | 'beads' }` added (separate file, same plan)

---

### `sdk/scripts/gen-command-aliases.ts` (rewrite — Pre-0)

**Analog:** Self — existing generator (lines 1–104) is the skeleton to rewrite

**Existing ESM + writeFile skeleton** (lines 1–103):
```typescript
#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { COMMAND_DEFINITIONS_BY_FAMILY } from '../src/query/command-definition.js';

function toSubcommand(canonical: string, family: 'state' | ...): string {
  const prefix = `${family}.`;
  return canonical.startsWith(prefix) ? canonical.slice(prefix.length) : canonical;
}

async function main(): Promise<void> {
  // ... build entries arrays from COMMAND_DEFINITIONS_BY_FAMILY ...
  const outPath = fileURLToPath(new URL('../src/query/command-aliases.generated.ts', import.meta.url));
  const header = `/**\n * GENERATED FILE ...\n */\n\n`;
  const body = [ /* string assembly */ ].join('\n');
  await writeFile(outPath, header + body, 'utf-8');
}

main().catch((err) => { console.error(err); process.exit(1); });
```

**Target TS artifact format** (`sdk/src/query/command-aliases.generated.ts` lines 1–30):
```typescript
/**
 * GENERATED FILE — command alias expansion for state.*, verify.*, ...
 */

export interface FamilyCommandAlias {
  canonical: string;
  aliases: string[];
  subcommand: string;
  mutation: boolean;
}

export const STATE_COMMAND_ALIASES: readonly FamilyCommandAlias[] = [
  { canonical: 'state.load', aliases: [], subcommand: 'load', mutation: false },
  { canonical: 'state.json', aliases: ['state json'], subcommand: 'json', mutation: false },
  ...
] as const;
```

**Target CJS artifact format** (`get-shit-done/bin/lib/command-aliases.generated.cjs` lines 1–30):
```javascript
'use strict';

/**
 * GENERATED FILE — state.*, verify.*, ... alias/subcommand metadata for CJS routing.
 */

const STATE_COMMAND_ALIASES = [
  { canonical: 'state.load', aliases: [], subcommand: 'load', mutation: false },
  ...
];
// ... all family arrays ...
module.exports = {
  STATE_COMMAND_ALIASES, VERIFY_COMMAND_ALIASES, INIT_COMMAND_ALIASES,
  PHASE_COMMAND_ALIASES, PHASES_COMMAND_ALIASES, VALIDATE_COMMAND_ALIASES, ROADMAP_COMMAND_ALIASES,
  STATE_SUBCOMMANDS, VERIFY_SUBCOMMANDS, INIT_SUBCOMMANDS,
  PHASE_SUBCOMMANDS, PHASES_SUBCOMMANDS, VALIDATE_SUBCOMMANDS, ROADMAP_SUBCOMMANDS,
};
```

**CJS output path** (from `sdk/scripts/check-command-aliases-fresh.mjs` line 7 pattern):
```javascript
// check script navigates: sdk/scripts/ → up 2 → get-shit-done/bin/lib/
const cjsOutPath = fileURLToPath(
  new URL('../../../get-shit-done/bin/lib/command-aliases.generated.cjs', import.meta.url)
);
```

**Subcommand constants format difference:**
- TS artifact: `export const STATE_SUBCOMMANDS = new Set<string>(STATE_COMMAND_ALIASES.map((entry) => entry.subcommand));`
- CJS artifact: `const STATE_SUBCOMMANDS = STATE_COMMAND_ALIASES.map((entry) => entry.subcommand);` (plain array, no Set — CJS consumers use `.includes()`)

**Pattern lessons:**
- Keep `toSubcommand()` helper unchanged — it matches what the check script's `toAliasEntries()` produces
- TS entries must use single-quote string literals (not JSON double-quotes from `JSON.stringify`)
- TS entries must be inline single-line objects, not pretty-printed multi-line
- `FamilyCommandAlias` interface must be exported at the top before the first const
- Each family const must have `: readonly FamilyCommandAlias[]` annotation + `] as const;` closing
- CJS `*_SUBCOMMANDS` are plain arrays mapped from the alias arrays (not Sets)
- Two `writeFile` calls in `main()`: one to TS path, one to CJS path

---

### `.github/workflows/upstream-parity.yml` (CI, PR-trigger → upstream golden suite)

**Analog:** `.github/workflows/test.yml` lines 1–60 (workflow header, on-triggers, matrix) + lines 155–204 (step pattern with conditional matrix gating)

**Trigger + job pattern** (`test.yml` lines 1–50):
```yaml
name: Tests

on:
  push:
    branches:
      - main
      - 'release/**'
  pull_request:
    branches:
      - main
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.run_id }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ${{ matrix.os }}
    timeout-minutes: 10
    strategy:
      fail-fast: true
      matrix:
        os: [ubuntu-latest]
        node-version: [22, 24]
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd  # v6.0.2
        with:
          fetch-depth: 0
```

**Pinned action hashes** — copy exact pinned SHAs from test.yml (`actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd`, `actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f`). Do NOT use floating `@v4` refs.

**Adapt for upstream-parity.yml:**
```yaml
name: upstream-parity

on:
  pull_request:
    branches: [feat/storage-adapter, main]
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.run_id }}
  cancel-in-progress: true

jobs:
  parity:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd  # v6.0.2
      - uses: actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f  # v6.3.0
        with:
          node-version: 22
      - run: npm ci
      - run: npm run build:adapters && npm run build:sdk-only
      - run: npm pack       # produces get-shit-done-cc-*.tgz
      - name: Checkout upstream at pinned tag
        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd
        with:
          repository: gsd-build/get-shit-done
          ref: <UPSTREAM_TAG>   # PINNED TAG — update deliberately; verify with git ls-remote
          path: upstream-checkout
      - name: Install fork tarball into upstream checkout
        working-directory: upstream-checkout
        run: npm install ../*.tgz
      - name: Build upstream SDK dist
        working-directory: upstream-checkout/sdk
        run: npm ci && npm run build
      - name: Run upstream golden suite against fork
        working-directory: upstream-checkout/sdk
        run: npx vitest run src/golden/
```

**Conditional step pattern** (`test.yml` lines 193–196):
```yaml
      - name: Run adapters vitest project
        if: matrix.os == 'ubuntu-latest' && matrix.node-version == 22
        shell: bash
        run: NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run --project adapters
```

**Pattern lessons:**
- Use pinned action SHAs, not floating tags — mandatory project convention
- `cancel-in-progress: true` concurrency group is in every workflow
- Second `actions/checkout` for upstream checkout uses `path:` to place it in a subdirectory
- No `bd` install needed in the parity job (golden suite uses no-adapter-config path; see RESEARCH.md §Environment)
- Upstream tag: run `git ls-remote upstream 'refs/tags/*' | sort -t/ -k3 -V | tail -5` before committing to confirm format
- The tarball glob `../*.tgz` works assuming `npm pack` is run in the repo root; verify the exact filename pattern at authoring time

---

### `tests/shared/sanitize.ts` (utility, raw output string → sanitized string)

**Analog:** `tests/conformance/init-bundlers.test.ts` lines 53–95 — **this is a verbatim extraction**

**Full function to copy** (lines 53–95):
```typescript
function sanitize(json: string): string {
  return json
    .replace(/"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z"/g, '"<TIMESTAMP>"')
    .replace(/"\/home\/[^"]+"/g, '"<HOME_PATH>"')
    .replace(/"\/Users\/[^"]+"/g, '"<HOME_PATH>"')
    .replace(/"\/tmp\/[^"]+"/g, '"<TMP_PATH>"')
    .replace(/"\/var\/folders\/[^"]+"/g, '"<TMP_PATH>"')
    .replace(/"\d{4}-\d{2}-\d{2}"/g, '"<DATE>"')
    .replace(/"date":\s*"[^"]+"/g, '"date": "<DATE>"')
    .replace(/"quick_id":\s*"[^"]+"/g, '"quick_id": "<QUICK_ID>"')
    .replace(/"cwd_repo_name":\s*"[^"]+"/g, '"cwd_repo_name": "<CWD_NAME>"')
    .replace(/"project_root":\s*"[^"]+"/g, '"project_root": "<HOME_PATH>"')
    .replace(/"workspace_base":\s*"[^"]+"/g, '"workspace_base": "<HOME_PATH>"')
    .replace(/"default_workspace_base":\s*"[^"]+"/g, '"default_workspace_base": "<HOME_PATH>"')
    .replace(/"source_repo_root":\s*"[^"]+"/g, '"source_repo_root": "<HOME_PATH>"')
    .replace(/"source_project_path":\s*"[^"]+"/g, '"source_project_path": "<HOME_PATH>"')
    .replace(/"workspace_path":\s*"[^"]+"/g, '"workspace_path": "<HOME_PATH>"')
    .replace(/"path":\s*"\/[^"]+"/g, '"path": "<HOME_PATH>"')
    .replace(/"error":\s*"Workspace not found: \/[^"]+"/g, '"error": "Workspace not found: <HOME_PATH>"')
    .replace(/"agents_installed":\s*(true|false)/g, '"agents_installed": "<AGENTS_INSTALLED>"')
    .replace(/"missing_agents":\s*\[[^\]]*\]/g, '"missing_agents": "<MISSING_AGENTS>"');
}
```

**Extraction shape for `tests/shared/sanitize.ts`:**
```typescript
/**
 * Sanitize bundle/query output for byte-identical comparison.
 *
 * Extracted from tests/conformance/init-bundlers.test.ts.
 * Replace ISO timestamps, absolute paths, and volatile fields with
 * stable placeholders before diffing across environments.
 */
export function sanitize(json: string): string {
  // ... verbatim body from above ...
}
```

**Update `init-bundlers.test.ts` after extraction:** replace the `function sanitize` declaration with `import { sanitize } from '../shared/sanitize.js';`.

**Pattern lessons:**
- Copy the function body verbatim — do not simplify or merge regexes; the comment in RESEARCH.md §"Don't Hand-Roll" explains why manual reimplementation misses cases
- The extraction is the deliverable; the parity test then imports from `tests/shared/sanitize.js`
- Keep the JSDoc on the extracted export; it explains *why* each group of replacements exists

---

### `scripts/sync-upstream.sh` (utility/script, git plumbing + leak-grep invocation)

**Analog:** `scripts/install-hooks.sh` lines 1–19

**Shell script pattern** (lines 1–19):
```sh
#!/bin/sh
# Install git hooks for the get-shit-done fork
# Usage: ./scripts/install-hooks.sh
set -e

HOOK_DIR="$(git rev-parse --show-toplevel)/.git/hooks"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Handle worktree case: .git may be a file pointing to the real gitdir
if [ -f "$(git rev-parse --show-toplevel)/.git" ]; then
  HOOK_DIR="$(git rev-parse --git-dir)/hooks"
fi

# Ensure hooks directory exists
mkdir -p "$HOOK_DIR"

# Pre-commit: leak gate
ln -sf "$SCRIPT_DIR/pre-commit-leak-gate.sh" "$HOOK_DIR/pre-commit"
echo "Installed pre-commit hook: leak-grep gate" >&2
```

**Adapt for sync-upstream.sh:**
```sh
#!/bin/sh
# Sync fork with upstream and scan for new leaks after rebase.
# Usage: ./scripts/sync-upstream.sh [upstream-ref]
#   upstream-ref defaults to upstream/main
set -e

UPSTREAM_REF="${1:-upstream/main}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"

git fetch upstream
PRE_REBASE=$(git rev-parse HEAD)
git rebase "$UPSTREAM_REF"

CHANGED_FILES=$(git diff --name-only "${PRE_REBASE}..HEAD" 2>/dev/null || true)
if [ -n "$CHANGED_FILES" ]; then
  echo "--- Post-rebase leak scan (advisory, non-blocking) ---" >&2
  echo "$CHANGED_FILES" | xargs node "$SCRIPT_DIR/leak-grep.cjs" || true
else
  echo "No changed files after rebase." >&2
fi
echo "Rebase complete." >&2
```

**Key differences from install-hooks.sh:**
- Uses `set -e` but ends leak-grep with `|| true` (exit 0 even on leaks — D-13 locked decision)
- Accepts optional `$1` for the upstream ref
- Uses `git rev-parse HEAD` before rebase to capture pre-rebase state
- Routes changed-files list to `xargs node scripts/leak-grep.cjs`

**Pattern lessons:**
- `#!/bin/sh` (not bash) — matches install-hooks.sh; portable POSIX sh
- `set -e` at top, but leak-grep step must explicitly `|| true` (non-blocking per D-13)
- `SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)` — the POSIX-portable way to get the script's own directory; copied exactly from install-hooks.sh
- Print status to stderr (`>&2`) — matches install-hooks.sh convention
- Leak-grep accepts file paths as args (`xargs`), not a diff pipe — per RESEARCH.md §DIST-03 design

---

### `sdk/src/gsd-tools.ts` and ~7 other call sites (modify — factory migration)

**Analog:** Self — the 8 construction sites are all the same swap

**Current pattern** (`sdk/src/gsd-tools.ts` line 170, line 630; `sdk/src/cli.ts` line 412; `sdk/src/index.ts` line 131):
```typescript
// import at file top:
import { MarkdownAdapter } from '../../adapters/markdown/index.js';

// construction site:
adapter: opts.adapter ?? new MarkdownAdapter(opts.projectDir)
// or:
const registry = createRegistry({ adapter: new MarkdownAdapter(projectDir) });
// or:
adapter: new MarkdownAdapter(this.projectDir),
```

**Replacement pattern** (per RESEARCH.md §Pattern 2):
```typescript
// Replace MarkdownAdapter import with factory import:
import { createStorageAdapter } from './query/adapter-factory.js';
// (adjust relative path per file location)

// Replace construction sites:
adapter: opts.adapter ?? createStorageAdapter(opts.projectDir, { adapter: config.storage?.adapter })
// or in sync contexts without config loaded:
const registry = createRegistry({ adapter: createStorageAdapter(projectDir) });
```

**Config-aware path** — sites in async contexts where `loadConfig()` has been called (e.g., `cli.ts` which already calls `loadConfig` at line 20) should pass the adapter name from config:
```typescript
const config = await loadConfig(projectDir);
// ... later:
createStorageAdapter(projectDir, { adapter: config.storage?.adapter })
```

**Sites that already support injection** (`gsd-tools.ts` line 170, `query-gsd-tools-runtime.ts` line 33) use `opts.adapter ?? new MarkdownAdapter(...)` — the factory replaces the fallback only:
```typescript
adapter: opts.adapter ?? createStorageAdapter(projectDir, { adapter: config.storage?.adapter })
```

**Pattern lessons:**
- Remove `import { MarkdownAdapter }` once all sites in a file are migrated — the factory encapsulates the MarkdownAdapter import
- `adapterFor()` in `helpers.ts` is NOT migrated in DIST-01 — it stays MarkdownAdapter-only (see RESEARCH.md Open Question 3); add JSDoc noting this
- `pipeline.ts` lines 124, 136 discretionary casts do NOT need changes — the `?.()` guards already handle non-MarkdownAdapter (confirmed in RESEARCH.md)
- This is a single atomic commit per D-06; all 8 sites land together

---

### `.github/workflows/test.yml` line 179 (modify — remove `if: false` guard)

**Analog:** Self — lines 163–181 are the bypass block to remove

**Block to remove** (lines 163–181):
```yaml
      # TEMPORARILY DISABLED (Phase 7 close-out): the SDK alias-drift check fails
      # because sdk/scripts/gen-command-aliases.ts produces output in a different
      # format than the committed sdk/src/query/command-aliases.generated.ts (the
      # committed file uses a typed `readonly FamilyCommandAlias[]` + inline
      # formatting that the checked-in generator doesn't emit). There's also no
      # automated writer for the CJS mirror at get-shit-done/bin/lib/
      # command-aliases.generated.cjs — it's hand-kept-in-sync.
      #
      # This is pre-existing SDK generator rot, not caused by Phase 7 work. We're
      # bypassing it to unblock validation of the Phase 7 CI wiring (bd install,
      # sibling build, paired conformance). Tracked in PHASE-7-REMAINING.md §C
      # (Deferred — SDK alias generator rewrite) for a follow-up standalone plan.
      #
      # TODO(phase-8): rewrite sdk/scripts/gen-command-aliases.ts to match the
      # committed TS format + add a CJS writer, then re-enable this check.
      - name: SDK generated alias artifact drift check
        if: false
        shell: bash
        run: node sdk/scripts/check-command-aliases-fresh.mjs
```

**After removal (lines 178–181 collapse to):**
```yaml
      - name: SDK generated alias artifact drift check
        if: matrix.os == 'ubuntu-latest' && matrix.node-version == 24
        shell: bash
        run: node sdk/scripts/check-command-aliases-fresh.mjs
```

**Pattern lessons:**
- Remove the entire comment block (lines 163–177) — it explains the bypass that no longer exists
- Add `if: matrix.os == 'ubuntu-latest' && matrix.node-version == 24` — matches the "run once per workflow on primary Linux node" convention used by the seam coverage step at line 159
- Pre-0 MUST land before DIST-04 — both touch this file and the current `if: false` would conflict with DIST-04 adding a matrix slot

---

### `docs/MIGRATION.md` (documentation — no code analog)

**Closest prose reference:** `docs/CONFIGURATION.md` (project doc structure); `README.md` (top-level doc linking)

**No code analog exists.** Content must be drafted from D-07 through D-11 decisions in CONTEXT.md plus RESEARCH.md §DIST-02. Key sections to include:

1. Prerequisites (gsd-beads, bd v1.0.4+, clean `.beads/` directory)
2. Command: `gsd-beads migrate [--dry-run]`
3. Dry-run JSON shape
4. Apply: `bd init --from-jsonl` with auto-generated ids; non-idempotent (document explicitly)
5. Backup: `.planning/` → `.planning.markdown-backup-${date}/` on success
6. Rollback: delete `.beads/` + restore backup
7. Post-migration: set `storage.adapter: beads` in `.planning/config.json`
8. Note on `commitPlanningState` NOOP (per D-2026-05-12-OQ01-BEADS)
9. Verification: re-run conformance suite as safety checkpoint

---

### `docs/UPSTREAM-REBASE.md` (documentation — no code analog)

**No code analog exists.** Content from D-12 through D-15 in CONTEXT.md plus RESEARCH.md §DIST-03. Key sections:

1. When to sync (on-demand only; D-15)
2. Quick path: `./scripts/sync-upstream.sh`
3. Manual path: `git fetch upstream && git rebase upstream/main`
4. Seam conflicts (expected): `createRegistry()` call sites in `sdk/src/`; resolution pattern is to inject `adapter:` alongside new upstream args
5. Business-logic conflicts (red flag — INVESTIGATE workflow): upstream modifying a `.planning/` read path; this is a missed adapter leak; file upstream issue
6. CJS binary conflicts (mechanical): take upstream version, re-apply fork CJS patches
7. Leak-grep output interpretation: advisory list, not a gate; items are to-do routing tasks

---

## Shared Patterns

### createRequire shim (NodeNext ESM → synchronous require)

**Source:** `sdk/scripts/check-command-aliases-fresh.mjs` lines 2–6
**Apply to:** `sdk/src/query/adapter-factory.ts`
```typescript
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const _require = createRequire(import.meta.url);
```
This is the only correct way to call `require()` from a NodeNext ESM module. `import.meta.url` is available in `.ts` files compiled with `"module": "NodeNext"`.

### Brand-field error class

**Source:** `adapters/types.ts` lines 149–168 (`UnsupportedCapabilityError`)
**Apply to:** `sdk/src/query/adapter-factory.ts` (`BeadsAdapterUnavailable`)

The pattern is: `readonly __brand = 'ClassName' as const` + `static [Symbol.hasInstance]` that checks the brand field. This makes `instanceof` work reliably across ESM/CJS dual-package boundaries and vitest module transforms. Copy the entire static method verbatim; only change the brand string.

### Pinned action SHAs

**Source:** `.github/workflows/test.yml` lines 25, 27
**Apply to:** `.github/workflows/upstream-parity.yml`
```yaml
- uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd  # v6.0.2
- uses: actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f  # v6.3.0
```
Do not use floating `@v4` tags. Copy these exact SHAs.

### Two-file config-schema sync

**Source:** `sdk/src/query/config-schema.ts` JSDoc header (lines 1–15)
**Apply to:** DIST-01 config-schema modification

> "If you add/remove a key here, make the identical change in `get-shit-done/bin/lib/config-schema.cjs` (and vice versa). The parity test asserts the two allowlists are set-equal."

Every key added to `VALID_CONFIG_KEYS` in the TS file must be added to the CJS mirror in the same commit.

### Vitest test file structure (tmpDir fixture lifecycle)

**Source:** `sdk/src/query/config-query.test.ts` lines 1–20
**Apply to:** `sdk/src/query/adapter-factory.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tmpDir: string;
beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-factory-'));
  await mkdir(join(tmpDir, '.planning'), { recursive: true });
});
afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});
```

### sh script conventions

**Source:** `scripts/install-hooks.sh` lines 1–19
**Apply to:** `scripts/sync-upstream.sh`

- `#!/bin/sh` (POSIX sh, not bash)
- `set -e` at line 4
- `SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)` for self-referential paths
- Status messages to `stderr` with `>&2`

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `docs/MIGRATION.md` | documentation | prose | No migration guide exists; nearest is `docs/CONFIGURATION.md` prose style but content is wholly new |
| `docs/UPSTREAM-REBASE.md` | documentation | prose | No rebase playbook exists in the project; content is wholly new from CONTEXT.md decisions |

---

## Metadata

**Analog search scope:** `sdk/src/`, `sdk/scripts/`, `scripts/`, `.github/workflows/`, `tests/conformance/`, `adapters/`, `get-shit-done/bin/lib/`
**Files read:** 16
**Pattern extraction date:** 2026-05-13

**Assumption flagged (A1):** `sdk/tsconfig.json` confirms `"module": "NodeNext"` — `require()` bare is NOT available in factory. Use `createRequire(import.meta.url)` shim. This resolves RESEARCH.md Open Question 1 and changes the factory implementation from the RESEARCH.md code example (which used plain `require()`).
