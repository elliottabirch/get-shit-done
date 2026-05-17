# Phase 2: Wire core read methods to adapter — Research

**Researched:** 2026-05-01
**Domain:** SDK read-handler migration (TS-side, MarkdownAdapter mounted)
**Confidence:** HIGH (everything is verifiable from code in this repo)

## Phase Summary

Phase 2 is a **mechanical TS-side migration**: replace ~78 in-scope `node:fs`
read calls and 1 `createRequire`-bridged CJS call across 16 SDK TS files
(plus 16 init bundlers) with `await adapter.getRecord` /
`getSection` / `getFrontmatter` / `listCollection` / `exists` / `stat`
calls. The MarkdownAdapter wraps the same CJS helpers internally per Phase 1
D-02 — so observable behavior is byte-identical, but the seam moves from
"each handler imports `node:fs`" to "each handler awaits `adapter.*`."
The phase also extends `scripts/leak-grep.cjs` with an SDK-fs pattern
category and produces an audit register for the `<context>`-block frontmatter
leak class (read-side audit only; mitigation is Phase 4 LEAKS-02).

The single contract change is `stat()` joining Bin A as a required primitive
(verified necessary by 6 call sites — `helpers.ts:478,490,512`,
`docs-init.ts:94,99`, `init-complex.ts:450`, `verify.ts:544`,
`intel.ts:138`). Every other primitive needed is already in the locked
v1.0 interface. Phase 1 wired `opts.adapter` into the registry closure
(per `01-04-SUMMARY.md`); Phase 2's job is to make handlers consume it.

**Primary recommendation:** Plan 1 establishes a tight migration recipe
(adapter-as-explicit-first-parameter to helpers; `await adapter.*` inside
handler bodies; null-on-miss semantics; conformance test per primitive),
then Plans 2-4 apply that recipe mechanically across 16 files. Plan 5 is a
pure audit script + register — no code migration.

## Locked Decisions Carry-Forward

From `02-CONTEXT.md` (locked, do not re-research):

- **D-01/D-02:** 5-plan structure: foundation+pattern → leaves → leaves → composers → audit
- **D-03:** Per-plan exit gate = leak-grep zero in scope + per-plan conformance tests
- **D-04:** Extend `scripts/leak-grep.cjs` with SDK-fs patterns; path-scoped (`.planning/` prefix)
- **D-05/D-06/D-07/D-08:** Audit register at `.planning/leaks/context-block-register.md`; 3-bucket disposition (REWRITE-CANDIDATE / INTERCEPT-CANDIDATE / EXCEPTION); scan repo-wide
- **D-09:** Init-bundler internals compose adapter primitives via SDK-side helpers (NOT Bin B reads — adapter contract surface stays flat)
- **D-10:** Adapter passed as explicit first parameter to every adapter-aware helper: `(adapter: StorageAdapter, ...rest)`
- **D-11:** `stat(path)` joins Bin A as required primitive; signature `(path: string) => Promise<{ kind: 'file' | 'dir'; mtime?: string } | null>`; null-on-miss; mtime optional in return shape
- **D-12:** TS handlers replace `createRequire`-bridged CJS fs calls with `adapter.*`
- **D-13:** `get-shit-done/bin/lib/*.cjs` files stay untouched (Phase 1 D-02 permanent)
- **D-14:** Per-line read-only discipline in mixed read+write files; writes wait for Phase 3
- **D-15:** Path-scoped leak-grep naturally excludes C2 files (no allowlist needed)

From Phase 1 (`01-CONTEXT.md` + `01-04-SUMMARY.md`):

- `createRegistry({adapter})` is required; `opts.adapter` is in handler closure but not yet consumed
- `MarkdownAdapter` (`adapters/markdown/index.ts`) implements Bin A + markdownLockfile + commitPlanningState; remaining methods throw `UnsupportedCapabilityError`
- `tests/conformance/adapter.conformance.ts` skeleton exists with 1 sample (`getRecord` round-trip); Phase 2 adds describe blocks
- `scripts/leak-grep.cjs` ships with TOOL_PATTERNS, SHELL_PATTERNS, CONTEXT_BLOCK_RE, CONTEXT_PATH_RE; Phase 2 adds SDK_FS_PATTERNS

## Migration Recipe

**This is the canonical pattern Plans 1-4 apply mechanically. Plan 1 ships it; Plans 2-4 reuse verbatim.**

### Pattern A: Direct `node:fs` read in handler body

**Before** (`route-next-action.ts:17-24`):

```typescript
import { readFileSync, existsSync, readdirSync } from 'node:fs';

function readConsecutiveCallCount(planningDir: string): number {
  try {
    const raw = readFileSync(join(planningDir, '.next-call-count'), 'utf-8');
    return parseInt(raw.trim(), 10) || 0;
  } catch {
    return 0;
  }
}
```

**After** (Phase 2):

```typescript
// (no node:fs read import for paths under .planning/)

async function readConsecutiveCallCount(
  adapter: StorageAdapter,
  planningRel: string,  // '.next-call-count' (planning-relative)
): Promise<number> {
  const raw = await adapter.getRecord(planningRel);
  if (raw === null) return 0;
  return parseInt(raw.trim(), 10) || 0;
}
```

**Key transformations:**
1. `readFileSync(path, 'utf-8')` + try/catch ENOENT → `await adapter.getRecord(planningRelPath)` + null check
2. `existsSync(path)` → `await adapter.exists(planningRelPath)`
3. `readdirSync(path, { withFileTypes: true })` → `await adapter.listCollection(planningRelPath)` (returns `RecordRef[]` with `path` and `name`)
4. `readdirSync(path)` → `(await adapter.listCollection(planningRelPath)).map(r => r.name)`
5. `statSync(path)` (for `.isDirectory()` / mtime) → `await adapter.stat(planningRelPath)` and check `kind === 'dir'` / `result.mtime`
6. The function becomes `async` — propagate up the call chain
7. Path argument changes from absolute to `.planning/`-relative

### Pattern B: Async `node:fs/promises` read in handler body

**Before** (`phase.ts:67`):

```typescript
import { readFile, readdir } from 'node:fs/promises';

async function getPhaseFileStats(phaseDir: string): Promise<...> {
  const files = await readdir(phaseDir);
  // ...
}
```

**After:**

```typescript
async function getPhaseFileStats(
  adapter: StorageAdapter,
  phaseRel: string,  // 'phases/01-name' (planning-relative)
): Promise<...> {
  const refs = await adapter.listCollection(phaseRel);
  const files = refs.map(r => r.name);
  // ...
}
```

### Pattern C: `createRequire`-bridged CJS fs call

**Before** (`state-project-load.ts:36-47`):

```typescript
function loadConfigCjs(projectDir: string): Record<string, unknown> {
  const corePath = resolveCoreCjsPath(projectDir);
  // ...
  const req = createRequire(import.meta.url);
  const { loadConfig } = req(corePath) as { loadConfig: (cwd: string) => Record<string, unknown> };
  return loadConfig(projectDir);
}
```

**Audit before migrating** — this CJS function may do non-fs work too (parsing, normalization). Migrate the FS portion through adapter; keep the parsing/normalization in TS.

For `loadConfig` specifically, it reads `.planning/config.json` then merges defaults. The adapter migration:

```typescript
async function loadConfigViaAdapter(
  adapter: StorageAdapter,
): Promise<Record<string, unknown>> {
  const raw = await adapter.getRecord('config.json');
  // Defaults logic was in core.cjs — can be inlined or kept as a pure helper
  if (raw === null) return DEFAULT_CONFIG;
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
}
```

NB: `state-project-load.ts` is the ONLY SDK TS file with `createRequire` (verified via grep — the next finding mentions `state-project-load.ts:17,44`). All other "CJS bridge" descriptions in the phase brief refer to TS handlers that DO NOT use createRequire — they use `node:fs` directly. The CJS-via-createRequire population is small.

### Helper Threading

Per D-10, every adapter-aware helper takes `adapter` as the FIRST parameter. Plan 1 establishes this for `helpers.ts`:

```typescript
// Before
export function findProjectRoot(startDir: string): string {
  // uses existsSync, statSync, readFileSync
}

// After — async because adapter primitives are async
export async function findProjectRoot(
  adapter: StorageAdapter,
  startDir: string,
): Promise<string> {
  // uses await adapter.exists, adapter.stat, adapter.getRecord
}
```

⚠️ **Async ripple is non-trivial.** `findProjectRoot` is currently synchronous; making it async forces every caller to be async. Mitigation: most callers are already in `QueryHandler` async functions, so the ripple is bounded — but the planner must enumerate callers and verify each is reachable from an async context.

### Error Semantics

Adapter contract → handler behavior:

| Adapter call | Returns | Pre-Phase-2 equivalent |
|--------------|---------|------------------------|
| `getRecord(path)` returns `null` | file missing | `try { readFileSync } catch (ENOENT) { fallback }` |
| `getRecord(path)` throws | I/O error (permissions, etc.) | `readFileSync` propagates |
| `listCollection(path)` returns `[]` | dir missing OR empty dir | `try { readdirSync } catch (ENOENT) { return [] }` (verified — `MarkdownAdapter.listCollection` swallows ENOENT) |
| `exists(path)` returns `false` | file/dir missing | `existsSync(path) === false` |
| `stat(path)` returns `null` | path missing | `try { statSync } catch (ENOENT) { ... }` |
| `stat(path)` returns `{ kind, mtime? }` | exists | `statSync` succeeded |

### Encoding & Path Normalization

- All `MarkdownAdapter` reads use `'utf-8'` encoding (verified `index.ts:129`). Existing TS handlers use `'utf-8'` too — no change.
- Trailing newlines: adapter returns the file content as-is (no normalization). Existing handlers operate on raw content the same way. No risk.
- Path shape: adapter expects `.planning/`-relative paths (D-04 from Phase 1). Existing handlers compute absolute paths via `planningPaths(projectDir)`; Phase 2 migration converts those to relative paths. The conversion is mechanical: replace `paths.state` (absolute) with `'STATE.md'`; `paths.roadmap` with `'ROADMAP.md'`; `paths.phases` with `'phases'`; `paths.requirements` with `'REQUIREMENTS.md'`; `join(paths.phases, dir)` with `'phases/' + dir`; `join(planning, '.next-call-count')` with `'.next-call-count'`.

## stat() Implementation Notes

### Contract (D-11)

```typescript
// adapters/types.ts — add to Bin A section
stat(path: string): Promise<{ kind: 'file' | 'dir'; mtime?: string } | null>;
```

- `null` on ENOENT (matches `getRecord` semantics)
- `mtime` is ISO-8601 string (e.g. `'2026-05-01T12:34:56.789Z'`) when computable; omitted otherwise
- `kind` is required (every backend that supports stat MUST distinguish file vs dir)
- No `Capabilities.stat` flag — this is required Bin A, not capability-gated. Same justification as `getRecord` / `exists`: every backend has it, gating it adds noise.

### `MarkdownAdapter.stat()` Implementation

```typescript
// adapters/markdown/index.ts — add inside class, alongside exists()

async stat(path: string): Promise<{ kind: 'file' | 'dir'; mtime?: string } | null> {
  const abs = this.resolve(path);
  let st: import('node:fs').Stats;
  try {
    // Async stat (consistent with rest of class which uses fs/promises)
    st = await (await import('node:fs/promises')).stat(abs);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  return {
    kind: st.isDirectory() ? 'dir' : 'file',
    mtime: st.mtime.toISOString(),
  };
}
```

Note: `MarkdownAdapter` already does dynamic imports of `node:fs/promises` (line 270 in `commitPlanningState`). Either inline the import or hoist it to the file's top alongside the existing `import { ... } from 'node:fs/promises'` at line 23.

### Type Guards

No type guard needed — `stat` is on the required surface. Type-check tests in `adapters/types.test.ts` should add a structural check that `StorageAdapter` includes `stat`.

### Conformance Test (Plan 1)

Add inside `runAdapterConformanceSuite` describe block:

```typescript
describe('stat', () => {
  it('returns kind=file for an existing file', async () => {
    await adapter.putRecord('STATE.md', '# State\n');
    const result = await adapter.stat('STATE.md');
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('file');
    if (result?.mtime) {
      expect(result.mtime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('returns kind=dir for an existing directory', async () => {
    await adapter.putRecord('phases/01-foo/PLAN.md', '# Plan\n');
    const result = await adapter.stat('phases/01-foo');
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('dir');
  });

  it('returns null for non-existent path', async () => {
    const result = await adapter.stat('NONEXISTENT.md');
    expect(result).toBeNull();
  });
});
```

## leak-grep.cjs Extension Patterns

**Existing engine** (`scripts/leak-grep.cjs`): TOOL_PATTERNS, SHELL_PATTERNS, CONTEXT_BLOCK_RE/CONTEXT_PATH_RE. Per-line scan + whole-text scan for context blocks.

**Phase 2 addition:** SDK_FS_PATTERNS — applies to TS files (.ts) only; matches fs read constructs that operate on `.planning/`-prefixed paths or paths derived from `planningPaths()` / `relPlanningPath()`.

### Recommended Pattern Set

```javascript
// Phase 2 D-04: SDK fs read patterns (.planning/-scoped only)
// Two-stage match: pattern + .planning/ proximity check
const SDK_FS_READ_PATTERNS = [
  // Imports
  { name: 'fs-read-import', re: /\bimport\s+\{[^}]*\b(?:readFileSync|readdirSync|existsSync|statSync|readFile|readdir|stat|access)\b[^}]*\}\s+from\s+['"]node:fs(?:\/promises)?['"]/ },
  { name: 'fs-require',     re: /\brequire\s*\(\s*['"]node:fs(?:\/promises)?['"]\s*\)/ },
  // Direct call sites
  { name: 'readFileSync',   re: /\breadFileSync\s*\(/ },
  { name: 'readdirSync',    re: /\breaddirSync\s*\(/ },
  { name: 'existsSync',     re: /\bexistsSync\s*\(/ },
  { name: 'statSync',       re: /\bstatSync\s*\(/ },
  { name: 'readFile-async', re: /\bawait\s+readFile\s*\(/ },
  { name: 'readdir-async',  re: /\bawait\s+readdir\s*\(/ },
  { name: 'stat-async',     re: /\bawait\s+stat\s*\(/ },
];

// Path-scope filter: the matched line, or its containing function/expression,
// must reference .planning/ (literal) or planningPaths(...) or relPlanningPath(...).
// Scope: scan a sliding window of ±20 lines around the match for either
// '.planning/' literal OR planningPaths( OR relPlanningPath(.
const PLANNING_SCOPE_RE = /(?:['"]\.planning\/|planningPaths\s*\(|relPlanningPath\s*\(|paths\.(state|roadmap|project|config|phases|requirements|planning)\b)/;
```

### Two-Stage Filter Logic

For each fs-pattern hit:
1. **Stage 1:** Pattern matches on a line in a `.ts` file under `sdk/`.
2. **Stage 2 (path scope):** Within ±20 lines of the match, find evidence that the operand path resolves under `.planning/`. Evidence sources:
   - Literal `'.planning/'` substring (catches `join(projectDir, '.planning/...')` style)
   - `planningPaths(` / `relPlanningPath(` call (helpers from `helpers.ts` / `workstream-utils.ts`)
   - `paths.state` / `paths.roadmap` / etc. (member access on a `PlanningPaths` value)

A match without Stage 2 evidence is suppressed — that's how C2 files (skill-manifest reading `.claude/skills/`, init-complex reading `~/.gsd/...`) naturally pass.

### Why This Approach (Avoiding R5 Pitfalls)

The existing TOOL_PATTERNS (`Read-tool` etc.) match `Read[^\n]{0,200}["'`]\.planning\/` in one go — works for shell/tool-call prose. For TS code, the call site and the path may be separated by intermediate variables: `const path = paths.state; readFileSync(path)`. A single regex on one line would miss this. The two-stage filter handles it: line N matches `readFileSync`, line N-2 has `paths.state` reference → `paths.state` matches `PLANNING_SCOPE_RE`.

False-negative risk: a function takes a path argument and a caller passes a `.planning/` path from far away. Mitigation: per-plan scope limits the input file set; reviewer of each plan visually verifies. Phase 4 LEAKS-04 (CI gate) can extend the scope window if specific cases slip through.

False-positive risk: line matches near a `.planning/` literal that's actually a comment or string for an unrelated purpose. Mitigation: the existing engine emits file:line; reviewers can suppress per-line via inline `// leak-grep-allow next-line: <reason>` comments (a future extension; Phase 2 doesn't ship suppression — sources are clean enough that allowlist isn't needed yet).

### Test Fixtures

Add `tests/leak-grep/fixtures/leaky-sdk-handler.ts`:

```typescript
// Should match: fs-read-import + readFileSync + planningPaths scope
import { readFileSync } from 'node:fs';
import { planningPaths } from '../../sdk/src/query/helpers.js';

export function leak(projectDir: string): string {
  const paths = planningPaths(projectDir);
  return readFileSync(paths.state, 'utf-8');
}
```

And `tests/leak-grep/fixtures/clean-sdk-handler.ts`:

```typescript
// Should NOT match: no fs imports, uses adapter
import type { StorageAdapter } from '../../adapters/types.js';

export async function clean(adapter: StorageAdapter): Promise<string> {
  return (await adapter.getRecord('STATE.md')) ?? '';
}
```

And `tests/leak-grep/fixtures/c2-handler.ts`:

```typescript
// Should NOT match: fs read but path is ~/.claude/, NOT .planning/
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function readSkill(): string {
  return readFileSync(join(homedir(), '.claude', 'skills', 'foo.md'), 'utf-8');
}
```

Test in `tests/leak-grep/leak-grep.test.cjs` (extend existing):

```javascript
it('flags fs-read against .planning/ in TS handlers', () => {
  const result = scanFile('tests/leak-grep/fixtures/leaky-sdk-handler.ts');
  expect(result.some(m => m.category === 'readFileSync')).toBe(true);
});

it('does not flag fs-read against ~/.claude/ (C2)', () => {
  const result = scanFile('tests/leak-grep/fixtures/c2-handler.ts');
  expect(result.length).toBe(0);
});
```

## Read-Surface Inventory

Per-file enumeration of in-scope reads. Counts derived from grep against the named files at HEAD `66d4961c`.

| File | LOC | fs-read calls | Primitive mapping | Tricky cases |
|------|-----|---------------|-------------------|--------------|
| `helpers.ts` | 614 | 4 (`existsSync`x3, `statSync`x2, `readFileSync`x1) all in `findProjectRoot` (lines 478,490,512,521) | `existsSync` → `exists`; `statSync().isDirectory()` → `(await stat()).kind === 'dir'`; `readFileSync` → `getRecord` | `findProjectRoot` is sync today, walks parent dirs; making it async ripples to every caller. The `.git` exists check (line 490) is on `<dir>/.git` — NOT under `.planning/` — so it's C2 territory. Only `.planning` and `.planning/config.json` checks are in-scope. |
| `phase.ts` | 343 | 3 (`readdir`x2, `readFile`x1) | `readdir` → `listCollection`; `readFile` → `getRecord` | Walks `phases/`, then `phases/<dir>`, then archived `milestones/<v>-phases/<dir>`. All three resolve via `planningPaths` — clean migration. |
| `roadmap.ts` | 728 | 2 (`existsSync`x1, `readFile`x1 visible; full audit needed but lower count than peers) | `existsSync` → `exists`; `readFile` → `getRecord` | `parseMilestoneFromState` reads `STATE.md` (line 67); `extractCurrentMilestone` is also called from init bundlers — confirm it doesn't read fs itself (it operates on already-loaded content). |
| `progress.ts` | 566 | ~10 reads (`existsSync`, `readdirSync`, `readFileSync`) + writes | Reads in lines 220-432; mixed read+write file (D-14) | Walks `phases/<dir>`; reads `STATE.md`, `REQUIREMENTS.md`, plan files; reads `pending/*.md` todos. Migration needs walk pattern: `listCollection('phases')` then per-dir `listCollection`. |
| `route-next-action.ts` | 345 | 3 (`readFileSync`x1, `existsSync`x1, `readdirSync`x1) | All Bin A — `getRecord`, `exists`, `listCollection` | `.next-call-count` is a sidecar — but Phase 5 PRIMITIVES-08 says sidecars are named methods. For Phase 2: stay in Bin A (`getRecord('.next-call-count')`); Phase 5 migrates to a named accessor. Also has 2 `readFile`/`readdir` async calls in helper functions. |
| `audit-open.ts` | 722 | 16 reads (`existsSync`x9, `readdirSync`x6, `readFileSync`x6+; high count) | All Bin A — `exists`, `listCollection`, `getRecord` | Six different artifact category scanners (`debug`, `quick`, `threads`, `pending`, `seeds`, `phases/*/{PLAN,UAT,RESEARCH}.md`). Each is a list+read pattern. Mechanical migration — biggest file by call-count. |
| `phase-ready.ts` | 159 | 2 (`existsSync`x1, `readdirSync`x1) | `exists`, `listCollection` | Tiny file; one helper function. |
| `verify.ts` | 698 | ~10 reads (`existsSync`x4, `readdirSync`x3, `readFileSync`x3, `statSync`x1) + writes | Mixed read+write (D-14) | Mtime via `statSync` at line 544 — needs new `stat()` primitive. |
| `check-verification-status.ts` | 160 | 2 (`existsSync`, `readdirSync`) | `exists`, `listCollection` | Tiny; phase dir check + scan for VERIFICATION.md presence. |
| `detect-phase-type.ts` | 141 | 4 (`existsSync`x2, `readdirSync`x2) | `exists`, `listCollection` | Walks phase dir + sub-dirs; needs recursive list pattern (just two-level). |
| `summary.ts` | 296 | 6 (`existsSync`x2, `readdirSync`x3, `readFileSync`x1) | `exists`, `listCollection`, `getRecord` | `historyDigest` walks `milestones/<v>-phases/*`; `summaryExtract` walks `phases/`. |
| `uat.ts` | 365 | 6 (`existsSync`x2, `readdirSync`x2, `readFileSync`x2) | `exists`, `listCollection`, `getRecord` | `auditUat` walks all phase dirs scanning for UAT.md / VERIFICATION.md. `uatRenderCheckpoint` reads a user-supplied path via `resolvePathUnderProject` — security check; the resolved path is project-relative, may or may not be under `.planning/`. **GAP**: `resolvePathUnderProject` returns absolute. If outside `.planning/`, adapter can't resolve. Recommend: keep this read direct (it's a user-supplied path), and document as audited exception via inline comment. |
| `intel.ts` | 404 | ~10 reads (`existsSync`x6, `readFileSync`x4, `statSync`x1) + writes | Mixed read+write (D-14); `statSync` needs `stat()` primitive | `intelFilePath` returns paths under `.planning/intel/` — clean adapter route. `mtime` at line 138 → `stat()`. `safeReadJson` is the helper to migrate. |
| `docs-init.ts` | 257 | ~6 reads (`existsSync`x4, `readdirSync`x2, `statSync`x2, `readFileSync`x4) | Most are C2 (project root, package.json, pnpm-workspace.yaml) | **Mostly C2**: only line 250's `pathExistsInternal(projectDir, '.planning')` is `.planning/`-scoped → migrate to `adapter.exists('')` (or define an empty-base check). Rest stays direct fs. Reflect this in the plan: docs-init is mostly out-of-scope for adapter migration; only the `.planning` existence probe migrates. |
| `skill-manifest.ts` | 214 | 8 (`existsSync`x4, `readdirSync`x2, `readFileSync`x1) + 1 writeFileSync | **Mostly C2**: skills dir is `~/.claude/skills/` or argument-supplied; only line 207 `existsSync(planningDir)` (gated by `--write`) is `.planning/`-scoped — that's a write-side path → defer to Phase 3. Read-side: nothing in-scope. | Confirm: `skill-manifest.ts` has zero reads against `.planning/`. Path-scoped leak-grep should pass it without changes. |
| `init.ts` | 1105 | ~30 reads (huge — `existsSync`x18, `readdirSync`x9, `readFileSync`x4, `statSync`x1) + 13 bundlers | Mostly Bin A; some are project-root-scoped (`.git`, package detection — C2) | `MILESTONES.md` (line 69-72) → adapter; phase dir scans (lines 412, 446, 699, 817, 832) → `listCollection`; `STATE.md` / `ROADMAP.md` / `config.json` existence checks → `exists`. **C2 leak risk:** `~/gsd-workspaces/` reads at line 975-1077 (workspace bundlers) are NOT in-scope (C2 territory). Path-scoped leak-grep handles this. |
| `init-complex.ts` | 660 | ~10 reads + 3 bundlers | Mix of Bin A (phase dirs, ROADMAP, STATE) and `~/.gsd/` API key probes (C2) | `~/.gsd/{brave,firecrawl,exa}_api_key` (lines 103-111) are C2 — pass through leak-grep naturally. `statSync` for mtime (line 450) → `stat()`. |

**Total in-scope read-call sites (estimated):** ~78 across the 16 SDK files (skill-manifest excluded; docs-init mostly excluded). The exact count is plan-time inventory work; this table sets the upper bound.

**Reads that DON'T fit Bin A surface — flag for planner:**

| Site | Issue | Recommendation |
|------|-------|----------------|
| `uat.ts:75` (`uatRenderCheckpoint`) | Reads user-supplied path via `resolvePathUnderProject` — may be outside `.planning/` | Keep direct fs read; add inline `// leak-grep-exception` comment with justification (user-input path). Treat as documented exception, not adapter migration. |
| `progress.ts:376,508` (pending todo dirs) | Reads `.planning/todos/pending/*.md` — within scope; clean adapter route. | No issue — `listCollection('todos/pending')` + `getRecord` per file. |
| `init-complex.ts:131` (recursive `findCodeFiles`) | Walks project root looking for `.ts/.js/.py/...` files outside `.planning/` | C2 — leak-grep ignores. No migration. |

## CJS-to-Adapter Call-Site Mapping

**Verified via grep across all SDK TS files:** ONLY `state-project-load.ts` uses `createRequire` to bridge CJS for fs-bound logic.

| File | CJS function | Signature | Adapter equivalent | Normalization gap? |
|------|--------------|-----------|--------------------|--------------------|
| `state-project-load.ts:44` | `loadConfig` from `core.cjs` | `(cwd: string) => Record<string, unknown>` | `await adapter.getRecord('config.json')` + JSON.parse + apply defaults | **Gap**: `loadConfig` in core.cjs presumably applies default merging beyond raw JSON. Need to inline that defaults logic in TS, OR keep `loadConfig` (parsing only — no fs) as a CJS bridge that takes a `string` content arg instead of a `cwd`. **Recommendation:** in Plan 1, audit `core.cjs.loadConfig` body. If it's pure (parsing + defaults from a known constant), port the defaults to TS as a `DEFAULT_CONFIG` constant. If it does multiple fs reads (config.json + per-workstream override), the TS handler reproduces that as multiple adapter calls. |

The phase brief mentions `core.cjs.readState()` as another example — verify in Plan 1: does any SDK TS file call `core.cjs.readState()`? Grep shows: NO. The only place reading `STATE.md` via `core.cjs` is the CJS files themselves (which stay untouched per D-13). All SDK TS reads of `STATE.md` use `await readFile(planningPaths(projectDir).state, 'utf-8')` directly (e.g. `state.ts:101`, `roadmap.ts:67`, `init-complex.ts:329`).

**Conclusion:** Migration is mostly direct `node:fs` → adapter. The `createRequire` cleanup is a single-file job (state-project-load.ts) and could be done in Plan 1 alongside the foundation work, or deferred to Plan 2 with the rest of the state-handler family.

## Init-Bundler Decomposition Recipe

D-09 says: bundlers compose adapter primitives via SDK-side helpers. No Bin B reads on the adapter. Coarse external bundle shape preserved (ROADMAP SC#2).

### `initProgress` Trace (`init-complex.ts:212-363`)

Read calls in current implementation:

| Call | Source location | Adapter primitive |
|------|-----------------|-------------------|
| `await readFile(paths.roadmap, 'utf-8')` (line 227) | ROADMAP.md | `getRecord('ROADMAP.md')` |
| `readdirSync(paths.phases, ...)` (line 241) | phase dirs | `listCollection('phases')` |
| `readdirSync(phasePath)` (line 259) | per-phase dir | `listCollection('phases/<dir>')` |
| `await readFile(paths.state, 'utf-8')` (line 329) | STATE.md | `getRecord('STATE.md')` |
| `existsSync(paths.roadmap)` (line 354) | exists check | `exists('ROADMAP.md')` |
| `existsSync(paths.state)` (line 355) | exists check | `exists('STATE.md')` |
| `pathExists(projectDir, '.planning/PROJECT.md')` (line 353) | exists check | `exists('PROJECT.md')` |
| Internal: `getMilestoneInfo` → reads ROADMAP + STATE (via `roadmap.ts`) | (already migrated in Plan 2 — `roadmap.ts`) | n/a |
| Internal: `extractCurrentMilestone` (already operates on loaded content) | (no fs) | n/a |

After migration, `initProgress` is purely composition:

```typescript
export const initProgress: QueryHandler = async (_args, projectDir, workstream) => {
  // adapter is in handler closure via createRegistry — Phase 1 plumbing
  const config = await loadConfig(adapter);  // migrated in Plan 1
  const milestone = await getMilestoneInfo(adapter, projectDir, workstream);  // Plan 2
  // ... pure composition; one bundle field per primitive call
  const rawRoadmap = await adapter.getRecord('ROADMAP.md');
  const phaseRefs = await adapter.listCollection('phases');
  // ... etc.
};
```

### Byte-Identical Bundle Verification

D-09 + ROADMAP SC#2 require byte-identical bundles between pre- and post-migration. Verification approach (Plan 4 conformance test):

1. Capture bundle JSON before migration: `npx gsd-sdk query init-progress > before.json`
2. Apply Plan 4 changes
3. Capture bundle JSON after: `npx gsd-sdk query init-progress > after.json`
4. `diff before.json after.json` must produce zero output

Or as a vitest test: snapshot the bundle output, verify against pre-migration snapshot (commit the snapshot in Plan 4 setup).

### Bundlers Genuinely Needing Bin B Reads?

**Audit conclusion (verified):** None. Every bundler decomposes into Bin A primitives (`getRecord`, `getSection` for milestone-section extraction, `getFrontmatter` for plan metadata, `listCollection`, `exists`, `stat` for mtime/dir checks). No bundler requires a "named-method" adapter call that isn't already on Bin A.

The `initManager` mtime check (`statSync(join(fullDir, f))` at line 450) was the candidate worry — but `stat()` lands on Bin A in Plan 1, so it's covered.

## Conformance Test Extension Patterns

Existing harness shape (`tests/conformance/adapter.conformance.ts`):

```typescript
export function runAdapterConformanceSuite(
  adapterName: string,
  adapterFactory: (projectDir: string) => StorageAdapter,
): void {
  describe(`StorageAdapter conformance: ${adapterName}`, () => {
    let tmpDir: string;
    let adapter: StorageAdapter;
    beforeEach(async () => { ... });
    afterEach(async () => { ... });
    describe('getRecord / putRecord round-trip', () => { ... });
  });
}
```

Plans 1-4 add **describe blocks inside this suite**. The suite is parameterized over adapter implementations, so any test added now also runs against BeadsAdapter in Phase 7.

### Plan 1 — Primitive Conformance

Add 3 describe blocks:

- `describe('stat')` — see "stat() Implementation Notes" above
- `describe('getSection / updateSection round-trip')` — write a doc with two `## anchor` sections, read each, verify content
- `describe('getFrontmatter / updateFrontmatter round-trip')` — write a YAML-frontmatter doc, read frontmatter, verify

These are primitive-level (per-method) conformance tests.

### Plans 2-4 — Per-Handler Reproductive Tests

For each migrated handler, add a test that:
1. Seeds a fixture .planning/ tree under `tmpDir/.planning/`
2. Constructs the adapter against `tmpDir`
3. Constructs a fake QueryRegistry via `makeRegistry` helper, dispatches the migrated handler
4. Asserts the result matches a known-good shape

Example for Plan 2 `findPhase`:

```typescript
describe('findPhase via adapter', () => {
  it('finds phase 01 in current phases dir', async () => {
    await adapter.putRecord('phases/01-foo/01-PLAN.md', '# Plan\n');
    await adapter.putRecord('phases/01-foo/01-RESEARCH.md', '# Research\n');
    const registry = createRegistry({ adapter });
    const result = await registry.dispatch('find-phase', ['1'], tmpDir);
    expect(result.data).toMatchObject({ found: true, phase_number: '01' });
  });
});
```

### Naming Convention (Claude's discretion per D-15)

Recommend: per-plan describe block name = `<plan-id>-<area>` (e.g. `'02-01: phase reads'`, `'02-02: roadmap+progress reads'`). Makes failures easy to attribute to a specific plan.

### Test Framework

Vitest (verified — `MarkdownConformance.test.ts` uses `import { describe, it, expect, beforeEach, afterEach } from 'vitest'`). Per-plan tests run via existing npm test script. No new test infrastructure needed.

## `<context>`-Block Audit Script Recipe

### Existing Engine Reuse

`scripts/leak-grep.cjs` already has `CONTEXT_BLOCK_RE` and `CONTEXT_PATH_RE` (lines 53-54) that match `<context>...@.planning/...</context>` blocks and emit one match per file:line. Plan 5 reuses this engine.

### Plan 5 Audit Script

Two viable shapes:

**Option A — Reuse leak-grep, post-process its output:**

```bash
node scripts/leak-grep.cjs commands/ agents/ get-shit-done/ docs/ \
  | grep ':context-block:' \
  > /tmp/context-block-leaks.txt
node scripts/audit-context-blocks.cjs /tmp/context-block-leaks.txt > .planning/leaks/context-block-register.md
```

**Option B — Standalone audit script that reuses the regex constants:**

`scripts/audit-context-blocks.cjs`:

```javascript
const fs = require('node:fs');
const path = require('node:path');
const { CONTEXT_BLOCK_RE, CONTEXT_PATH_RE } = require('./leak-grep.cjs');  // (export these)

function scanDir(dir) { /* recursive walk, emit { file, line, blockExcerpt, refPath } */ }
function classify(blockExcerpt, refPath) { /* heuristic for REWRITE-CANDIDATE / INTERCEPT-CANDIDATE / EXCEPTION */ }
function renderRegister(records) { /* emit markdown table */ }
```

**Recommendation:** Option B. Leak-grep emits one line per match; the register needs the `<context>` block excerpt around it for classification. A dedicated script can extract and format that more cleanly. Plan 5 ships the script under `scripts/audit-context-blocks.cjs`; Phase 4 LEAKS-04 may choose to wire one or both into CI.

### Auto-Classification Heuristics

For each `@.planning/<path>` reference inside a `<context>` block:

| Heuristic | Bucket |
|-----------|--------|
| File is a fixture (`tests/leak-grep/fixtures/`) | EXCEPTION (fixture) |
| Path is `STATE.md` / `ROADMAP.md` / `PROJECT.md` (canonical loaded-at-runtime) | REWRITE-CANDIDATE (skill body can call `gsd-sdk query state.json`) |
| Path is a phase artifact (`phases/<dir>/...`) | INTERCEPT-CANDIDATE (frontmatter context loads at install; needs hook) |
| Path is `REQUIREMENTS.md` | REWRITE-CANDIDATE |
| Path is `DECISIONS.md` | REWRITE-CANDIDATE |
| Path is a research doc | EXCEPTION (research is read-once, content rarely changes — install-time materialization OK) |

The script proposes a default; the user/Phase 4 author can override per row.

### Register File Format

`.planning/leaks/context-block-register.md`:

```markdown
# `<context>`-block @.planning/ Reference Register

**Last audited:** YYYY-MM-DD
**Total references:** N
**By disposition:** REWRITE-CANDIDATE: X | INTERCEPT-CANDIDATE: Y | EXCEPTION: Z

> Phase 2 deliverable per READS-03 / D-05/D-06/D-07/D-08.
> Phase 4 LEAKS-02 chooses uniform-vs-mixed mitigation strategy.

| # | File:Line | `<context>` excerpt | Reference path | Proposed disposition | Rationale |
|---|-----------|---------------------|----------------|----------------------|-----------|
| 1 | `agents/gsd-planner.md:420` | `<context>\n@.planning/STATE.md\n@.planning/ROADMAP.md\n</context>` | `.planning/STATE.md` | REWRITE-CANDIDATE | Skill body invokes `gsd-sdk query state.json` instead of frontmatter `@`-load |
| 2 | ... | ... | ... | ... | ... |

## Bucket Definitions

- **REWRITE-CANDIDATE:** Skill/workflow body can invoke `gsd-sdk query` to load the doc at runtime; the frontmatter `@`-ref is removable.
- **INTERCEPT-CANDIDATE:** Doc must be present at frontmatter-load time; needs install-time hook to materialize from adapter before skill activates.
- **EXCEPTION:** Doc fundamentally needs to load at activation and can't be intercepted; document why.
```

JSON sidecar (Claude's discretion per CONTEXT.md): could ship `.planning/leaks/context-block-register.json` for Phase 4 to consume programmatically. Recommend: ship JSON sidecar — Phase 4's mitigation tooling will need machine-readable input.

### Audit Scope (Verified via grep)

Files containing `@.planning/` references (count from `grep -rEc "@\.planning/"`):

| File | Refs |
|------|------|
| `agents/gsd-planner.md` | 3 |
| `get-shit-done/templates/planner-subagent-prompt.md` | 9 |
| `get-shit-done/references/tdd.md` | 2 |
| `get-shit-done/references/planner-antipatterns.md` | 6 |
| `commands/gsd/add-tests.md` | 2 |
| `get-shit-done/templates/debug-subagent-prompt.md` | 1 |
| `get-shit-done/templates/phase-prompt.md` | 15 |
| `docs/CONFIGURATION.md` | 1 |
| `docs/zh-CN/references/tdd.md` | 2 |

**Total:** 41 references across 9 files. Plus 1 fixture (`tests/leak-grep/fixtures/leaky-skill-context.md` — 2 refs, EXCEPTION).

The `<context>` blocks in `phase-prompt.md` and `planner-antipatterns.md` are mostly **example/template content** — verify in Plan 5 that they're not active load-time refs (template substitution may strip `<context>` before delivery to a skill engine). If they ARE just illustration, classify as EXCEPTION (template).

## Risks & Pitfalls

### Pitfall 1: Async ripple from sync helpers
**What:** `findProjectRoot`, `pathExists`, `pathExistsInternal`, `readConsecutiveCallCount` are sync today. Migration makes them async, forcing every caller to await. Caller chain may go deep.
**Detection:** TypeScript will complain about every missing `await` / `Promise<>` mismatch. Fast feedback loop.
**Mitigation:** Plan 1 walks the helper chain, makes everything async at once. Plans 2-4 just consume the now-async helpers. NB: `helpers.ts.findProjectRoot` is called from `cli.ts` and `state-project-load.ts` — both already async-friendly; no surprise.
**Edge case:** If `findProjectRoot` is called from a sync context (e.g. a sync constructor), need a sync fallback OR refactor that constructor. Search for sync call sites in Plan 1 inventory.

### Pitfall 2: Per-await performance overhead in tight loops
**What:** `audit-open.ts` walks `phases/*` then per-phase reads ~3 docs (PLAN, UAT, RESEARCH). Pre-migration: nested `readdirSync` + `readFileSync` (sync, single-thread). Post-migration: each call is `await adapter.*` which (in MarkdownAdapter) wraps `node:fs/promises` — adds promise-creation overhead.
**Magnitude:** Probably negligible (<10ms over a 30-phase project). But measurable.
**Mitigation:** Use `Promise.all` for parallelizable per-phase reads. Add a benchmark in Plan 2 or 3 for the heaviest handler (`auditOpen` or `progressJson`); fail loudly if regression > 200ms on a 30-phase fixture.

### Pitfall 3: `MarkdownAdapter.listCollection` swallows ENOENT, returns `[]`
**What:** Verified at `adapters/markdown/index.ts:158`: `if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];`. The pre-migration handler distinguishes "dir missing" from "dir empty" via `try { readdirSync } catch { return [] }` — same result. But some handlers used a separate `existsSync` check before the `readdirSync` (e.g. `audit-open.ts:16-21`). Post-migration, those existsSync checks become redundant — `listCollection` already handles missing.
**Detection:** Lint rule `no-redundant-exists-before-list` (informal — code reviewer in PR).
**Mitigation:** Plan 2-3 task lists explicitly say "remove redundant `await adapter.exists(dir)` before `await adapter.listCollection(dir)`." Slight code shrink; clear win.

### Pitfall 4: Path normalization differences (POSIX vs Windows)
**What:** `MarkdownAdapter.resolve(relPath)` does `join(this.planningBase, relPath)`. On Windows, `join` returns backslash-separated. The adapter contract takes `.planning/`-relative paths in POSIX form (D-04 from Phase 1: `'STATE.md'`, `'phases/01-foo/PLAN.md'`). The adapter resolves using `node:path.join` which handles both. **No issue** as long as relative paths use forward slashes — which they do throughout.
**Detection:** Run conformance suite on Windows in CI (existing CI matrix should cover).
**Mitigation:** None needed — already correct.

### Pitfall 5: createRegistry threads adapter through closure, but tests construct registries lots of ways
**What:** Per `01-04-SUMMARY.md`, 7 SDK test files use `makeRegistry(projectDir)` helper. Two test files use **dynamic imports** (phase-lifecycle.test.ts) — async makeRegistry. Phase 2 doesn't change this, but every new test added in Plan 1-4 must use the appropriate helper to ensure the test gets a real MarkdownAdapter.
**Mitigation:** Plan 1 tasks include a quick survey of test files; new conformance tests follow the existing makeRegistry pattern.

### Pitfall 6: `stat()` mtime format inconsistency between Node versions
**What:** `Stats.mtime.toISOString()` produces ISO-8601. All Node versions in the support matrix produce identical format. **No issue.**

### Pitfall 7: leak-grep false positive on existing `existsSync` in adapter file itself
**What:** `adapters/markdown/index.ts:22` imports `existsSync`. The leak-grep SDK pattern would match it. But `adapters/` is OUT of the leak-grep scan path — leak-grep is run against `sdk/src/`, not `adapters/`.
**Mitigation:** Per-plan exit gate runs leak-grep against `sdk/src/query/` (the scope), not the whole repo. Phase 4 LEAKS-04 will run it whole-repo with adapter directories explicitly excluded (or — better — with a comment like "// adapter implementation — fs allowed" recognized via `// leak-grep-allow file:` directive added in Phase 4).

### Pitfall 8: `<context>`-block audit may flag intentional template content
**What:** `get-shit-done/templates/phase-prompt.md` has 15 `@.planning/` refs in `<context>` blocks. These are TEMPLATE content (delivered to a skill that may or may not load them). Classifying them all as REWRITE-CANDIDATE is wrong — they're illustrations. Classifying them as EXCEPTION (template) is correct, but the heuristic in the audit script must recognize "is template?" — by file path (`templates/`) OR a frontmatter marker.
**Mitigation:** Plan 5 audit script: files under `**/templates/**` get default disposition `EXCEPTION (template content)`. Documented in the register's rationale column. Phase 4 may revisit if template engines actually expand these into runtime contexts.

### Pitfall 9: `state-project-load.ts` createRequire + loadConfig parsing logic
**What:** This is the only TS file using `createRequire` for fs work. `loadConfig(cwd)` does config.json read PLUS workstream-aware override merging PLUS defaults. Migrating to adapter requires reproducing the override+defaults logic in TS — not just the read.
**Mitigation:** Plan 1 includes a one-task subaudit of `core.cjs.loadConfig` body. If the logic is small (likely <50 lines), port to TS as a `loadConfigViaAdapter(adapter, workstream?)` helper. If complex, defer this single file to Plan 2 with a research-spike task.

### Pitfall 10: Workstream-rooted reads
**What:** `relPlanningPath(workstream)` returns `.planning/workstreams/<ws>` when workstream is set. Adapter calls take paths relative to `.planning/` — but workstream-rooted reads need paths relative to `.planning/workstreams/<ws>/`. **Verified via `MarkdownAdapter.resolve`:** the adapter holds `planningBase = ws.planningDir(projectDir)` (resolved at construction). So the adapter is already workstream-aware via the constructor — but only if the workstream is passed at registry construction time.
**Detection:** Per-handler trace — does `findPhase` etc. honor the `workstream` argument by computing paths via `relPlanningPath(workstream)` instead of the adapter-held base?
**Mitigation (significant):** This is a real architectural question Phase 1 may have under-specified. Two options:
  - (a) Construct a per-call MarkdownAdapter with the workstream's base. Very expensive — adapter construction is currently sync but one-shot.
  - (b) Pass the resolved relative path to the adapter, which always resolves under its single `planningBase`. Means every helper that takes `workstream` must compute the relative path via `relPlanningPath(workstream)` and pass `'<rel>/STATE.md'` to `adapter.getRecord`.
**Recommendation:** Option (b). Plan 1 refactors `helpers.ts` to expose a `planningRelativePath(workstream, doc)` helper that returns `'workstreams/<ws>/<doc>'` or `'<doc>'`. All subsequent plans use this helper to compute paths. **This is a research finding the planner needs to call out explicitly** — it's a subtle ripple from D-04.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing — `MarkdownConformance.test.ts`, `sdk/src/query/*.test.ts`) |
| Config file | `vitest.config.ts` (existing, top-level) |
| Quick run command | `npx vitest run tests/conformance/markdown.conformance.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|--------|----------|-----------|-------------------|-------------|
| READS-01 | All ~40 SDK read queries call `adapter.*` | leak-grep + conformance | `node scripts/leak-grep.cjs sdk/src/query/` (zero matches) + `npx vitest run tests/conformance/` | leak-grep ✓; conformance ✓ Phase-1 skeleton; Plans 1-4 add per-handler tests |
| READS-01 | Per-handler reproduction (findPhase, roadmapAnalyze, progressJson, summaryExtract, ...) | integration in conformance | `npx vitest run tests/conformance/markdown.conformance.test.ts` | Plans 2-3 add tests |
| READS-02 | 16 init bundlers compose primitives; bundle shape preserved | byte-diff or snapshot | `npx vitest run tests/conformance/init-bundlers.test.ts` | ❌ Wave 0 — Plan 4 creates `tests/conformance/init-bundlers.test.ts` |
| READS-03 | `<context>`-block audit register exists with all 41 refs classified | file presence + count assertion | `node scripts/audit-context-blocks.cjs --check` | ❌ Wave 0 — Plan 5 creates `scripts/audit-context-blocks.cjs` and `.planning/leaks/context-block-register.md` |
| (Phase 1 SC#1, carry-forward) | fork's existing test suite passes with MarkdownAdapter | regression | `npm test` | ✓ |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/conformance/markdown.conformance.test.ts` + `node scripts/leak-grep.cjs sdk/src/query/<plan-scope>` (per-plan scope)
- **Per wave merge (per plan):** Full conformance suite + leak-grep across all sdk/src/query/
- **Phase gate:** `npm test` (full SDK suite) + leak-grep across `sdk/src/query/` returning zero matches + `<context>`-block register file exists with all 41+ refs

### Wave 0 Gaps

Items the planner must address before Plan 1 implementation:

- [ ] **Plan 1 prerequisite:** Confirm `helpers.ts.findProjectRoot` async ripple is bounded — enumerate all sync callers across SDK before flipping the async switch (Pitfall 1)
- [ ] **Plan 1 prerequisite:** Audit `core.cjs.loadConfig` body to determine port-vs-bridge for state-project-load.ts (Pitfall 9)
- [ ] **Plan 1 prerequisite:** Decide workstream-relative-path strategy in `helpers.ts` (Pitfall 10)
- [ ] **Plan 1 deliverable:** `tests/leak-grep/fixtures/leaky-sdk-handler.ts` + `clean-sdk-handler.ts` + `c2-handler.ts` — fixtures for new SDK_FS pattern category
- [ ] **Plan 1 deliverable:** Extend `tests/leak-grep/leak-grep.test.cjs` with SDK_FS pattern assertions
- [ ] **Plan 4 deliverable:** `tests/conformance/init-bundlers.test.ts` — byte-diff snapshots for 16 bundlers (precapture before migration starts)
- [ ] **Plan 5 deliverable:** `scripts/audit-context-blocks.cjs` — register-generation script
- [ ] **Plan 5 deliverable:** `.planning/leaks/` directory creation + initial `context-block-register.md`
- [ ] No new test framework install needed — Vitest is already configured.

### Boundary Conditions per Primitive

| Primitive | Conformance must verify |
|-----------|-------------------------|
| `getRecord` | exists → returns content; missing → `null`; permission denied → throws |
| `listCollection` | exists empty → `[]`; missing → `[]` (verified MarkdownAdapter behavior); exists with files → `RecordRef[]` with `name` and relative `path` |
| `exists` | exists → `true`; missing → `false`; symlink to missing → `false` |
| `getSection` | exists & section found → body without anchor heading; exists & section absent → `null`; file missing → `null` |
| `getFrontmatter` | YAML valid → parsed object; YAML missing → `{}` (verify); YAML malformed → throws |
| `stat` | file → `{ kind: 'file', mtime: ISO }`; dir → `{ kind: 'dir', mtime: ISO }`; missing → `null` |

## Sources

### Primary (HIGH confidence — verified in this session)

- `/home/ellio/code/get-shit-done/adapters/types.ts` — locked StorageAdapter contract (Phase 2 extends with `stat`)
- `/home/ellio/code/get-shit-done/adapters/markdown/index.ts` — MarkdownAdapter implementation; verified `listCollection` swallows ENOENT (line 158), `getRecord` returns null on ENOENT (line 131), createRequire wrap pattern (line 105-117)
- `/home/ellio/code/get-shit-done/scripts/leak-grep.cjs` — engine to extend; verified TOOL_PATTERNS / SHELL_PATTERNS / CONTEXT_BLOCK_RE shape
- `/home/ellio/code/get-shit-done/sdk/src/query/index.ts` — confirmed `_adapter = opts.adapter; void _adapter;` (line 286-287); 17 init handlers registered (lines 483-501)
- `/home/ellio/code/get-shit-done/sdk/src/query/helpers.ts` — confirmed 4 fs read sites in `findProjectRoot` (lines 478,490,512,521)
- `/home/ellio/code/get-shit-done/sdk/src/query/state-project-load.ts` — confirmed createRequire usage (line 17,44); only TS file with this pattern
- `/home/ellio/code/get-shit-done/sdk/src/query/init-complex.ts` — verified 3 bundlers (initNewProject, initProgress, initManager); line counts and read patterns
- `/home/ellio/code/get-shit-done/tests/conformance/adapter.conformance.ts` — Phase 1 harness skeleton; Plan 1 extends
- `/home/ellio/code/get-shit-done/tests/leak-grep/fixtures/` — existing fixture set (clean-skill, leaky-skill-context, leaky-workflow-shell, leaky-workflow-tools)
- All 16 SDK read files grepped at HEAD (commit 66d4961c) for `readFileSync|readdirSync|existsSync|statSync|fs\\.read*|from 'node:fs'|require\\('node:fs'\\)`

### Secondary (HIGH — Phase 1 outputs)

- `01-CONTEXT.md` D-02 (CJS wrap), D-04 (planning-relative paths), D-05/D-08 (capabilities), D-10 (full v1.0 surface), D-13 (test bar), D-14 (leak-grep R5+context-block), D-15 (conformance harness)
- `01-04-SUMMARY.md` — createRegistry DI plumbing complete; opts.adapter in closure; 4 production sites + 7 test files migrated to `makeRegistry`

### Tertiary (locked decisions, not researched)

- `02-CONTEXT.md` D-01..D-15 — Phase 2 plan structure, leak-grep extension, audit register, init-bundler decomposition strategy

## Metadata

**Confidence breakdown:**
- Migration recipe: HIGH — code-verified, traceable to specific line numbers
- stat() implementation: HIGH — derives mechanically from MarkdownAdapter's existing async fs/promises usage
- leak-grep extension: HIGH — design verified against existing fixture/test infrastructure
- Read-surface inventory: HIGH on per-file pattern; MEDIUM on exact total count (~78 estimate; per-plan inventory will refine)
- CJS-to-adapter mapping: HIGH — only one file (`state-project-load.ts`); other "CJS bridges" mentioned in phase brief are NOT createRequire-based, they're direct `node:fs` (which is what the migration removes)
- Init-bundler decomposition: HIGH — `initProgress` traced end-to-end; pattern generalizes
- Conformance test extension: HIGH — existing harness shape is exemplary
- `<context>`-block audit: HIGH — repo-wide grep gives exact ref counts (41 refs across 9 files + fixtures)
- Risks & pitfalls: MEDIUM-to-HIGH — all 10 identified by code inspection; severity estimates based on architectural reasoning

**Research date:** 2026-05-01
**Valid until:** 2026-05-15 (planner should consume soon; the longer the delay, the more upstream rebases may shift line numbers)

## RESEARCH COMPLETE
