# Phase 2: Wire core read methods to adapter — Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 30 (3 contract, 6 conformance, 4 leak-grep, ~16 SDK handlers, 1 register)
**Analogs found:** 30 / 30 (every file has a strong Phase-1 analog or self-analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **Plan 1 — Foundation + recipe** | | | | |
| `adapters/types.ts` (modify: add `stat`) | contract | type-defn | self (existing Bin A `exists` declaration) | exact |
| `adapters/markdown/index.ts` (modify: add `stat()` impl) | adapter-impl | request-response | self (existing `getRecord()` impl, lines 126-134) | exact |
| `adapters/types.test.ts` (modify: add stat type-check) | test | type-defn | self (existing `_testTypeGuards` lines 54-74) | exact |
| `tests/conformance/adapter.conformance.ts` (modify: add stat describe block) | test-harness | round-trip | self (existing `getRecord/putRecord round-trip` block lines 44-55) | exact |
| `tests/leak-grep/fixtures/leaky-sdk-handler.ts` (NEW) | fixture | type-defn | `tests/leak-grep/fixtures/leaky-skill-context.md` | role-match |
| `tests/leak-grep/fixtures/clean-sdk-handler.ts` (NEW) | fixture | type-defn | `tests/leak-grep/fixtures/clean-skill.md` | role-match |
| `tests/leak-grep/fixtures/c2-handler.ts` (NEW) | fixture | type-defn | `tests/leak-grep/fixtures/clean-skill.md` | role-match |
| `tests/leak-grep.test.cjs` (modify: add SDK_FS assertions) | test | request-response | self (existing `'leaky-workflow-shell.md detects'` test block lines 40-47) | exact |
| `scripts/leak-grep.cjs` (modify: add SDK_FS_READ_PATTERNS + Stage-2 filter) | script | batch | self (existing TOOL_PATTERNS / SHELL_PATTERNS / CONTEXT_BLOCK_RE block lines 33-54) | exact |
| `sdk/src/query/helpers.ts` (modify: thread `adapter` first-arg into `findProjectRoot` etc.) | utility | request-response | `adapters/markdown/index.ts:getRecord` (null-on-miss) + `state-project-load.ts:54` (handler signature shape) | role-match |
| `sdk/src/query/route-next-action.ts` (modify: reference handler — recipe exemplar) | controller | request-response | `state-project-load.ts:54-80` (handler closure consuming adapter via registry — but Phase 2 shape adds adapter awaits) | role-match |
| **Plan 2 — Phase / state / progress / roadmap reads** | | | | |
| `sdk/src/query/phase.ts` (modify) | controller | CRUD | self (existing async fs/promises shape lines 67, 85) | exact |
| `sdk/src/query/roadmap.ts` (modify) | controller | CRUD | `phase.ts` analog (after Plan-2 migration) | role-match |
| `sdk/src/query/progress.ts` (modify: read-only paths) | controller | CRUD (mixed) | `phase.ts` analog (per-line read discipline per D-14) | role-match |
| `sdk/src/query/route-next-action.ts` (already migrated in Plan 1 as recipe) | controller | request-response | self | exact |
| `sdk/src/query/audit-open.ts` (modify) | controller | CRUD | `phase.ts:searchPhaseInDir` (list+read pattern, lines 83-130) | role-match |
| `sdk/src/query/phase-ready.ts` (modify) | controller | request-response | `phase.ts:findPhase` shape | role-match |
| `sdk/src/query/verify.ts` (modify: read-only paths) | controller | CRUD (mixed) | `phase.ts` analog + needs `stat()` for mtime | role-match |
| `sdk/src/query/check-verification-status.ts` (modify) | controller | request-response | `phase.ts:searchPhaseInDir` shape | role-match |
| `sdk/src/query/detect-phase-type.ts` (modify) | controller | request-response | `phase.ts:searchPhaseInDir` shape | role-match |
| `tests/conformance/phase-reads.test.ts` (NEW) | test | round-trip | `tests/conformance/markdown.conformance.test.ts` (suite-mount shape) + `adapter.conformance.ts:44-55` | role-match |
| **Plan 3 — Document reads** | | | | |
| `sdk/src/query/summary.ts` (modify) | controller | CRUD | `phase.ts:searchPhaseInDir` (walk milestones/<v>-phases/) | role-match |
| `sdk/src/query/uat.ts` (modify) | controller | CRUD | `phase.ts:findPhase` shape | role-match |
| `sdk/src/query/intel.ts` (modify: read-only paths, needs `stat()` for mtime) | controller | CRUD (mixed) | `state-project-load.ts:54` shape + `stat()` (Plan-1 contract) | role-match |
| `sdk/src/query/docs-init.ts` (modify: only `.planning`-scoped probe) | controller | request-response | `state-project-load.ts:54-80` (mostly C2; one `exists()` migration) | role-match |
| `sdk/src/query/skill-manifest.ts` (audit only — likely zero scope reads) | controller | request-response | C2 — no reads against `.planning/` per RESEARCH inventory | partial |
| `tests/conformance/document-reads.test.ts` (NEW) | test | round-trip | `adapter.conformance.ts` describe-block shape | role-match |
| `tests/conformance/helpers.test.ts` (NEW — Plan 1 helper coverage) | test | round-trip | `adapter.conformance.ts` describe-block shape | role-match |
| `tests/conformance/stat.test.ts` (NEW — Plan 1 stat conformance, OR added inline to adapter.conformance.ts per the RESEARCH recipe) | test | round-trip | `adapter.conformance.ts:44-55` | exact |
| **Plan 4 — Init bundlers (composers)** | | | | |
| `sdk/src/query/init.ts` (modify: 13 bundlers compose adapter primitives) | controller | request-response (compose) | `state-project-load.ts:54` (handler-as-composition) | role-match |
| `sdk/src/query/init-complex.ts` (modify: 3 bundlers; needs `stat()` mtime) | controller | request-response (compose) | `init.ts` (after Plan-4 migration) | role-match |
| `tests/conformance/init-bundlers.test.ts` (NEW: byte-diff snapshots for 16 bundlers) | test | round-trip | `adapter.conformance.ts` describe-block shape, plus snapshot capture pre/post (RESEARCH §"Byte-Identical Bundle Verification") | role-match |
| **Plan 5 — `<context>`-block audit** | | | | |
| `scripts/audit-context-blocks.cjs` (NEW) | script | batch | `scripts/leak-grep.cjs` (existing CONTEXT_BLOCK_RE engine, lines 53-54, 91-110) | role-match |
| `.planning/leaks/context-block-register.md` (NEW) | register-doc | type-defn | `.planning/DECISIONS.md` (table-row + section markdown shape) | partial |
| `.planning/leaks/context-block-register.json` (NEW — sidecar; Claude's discretion per CONTEXT D-O) | register-doc | type-defn | (no analog; new artifact) | none |
| **Phase-wide** | | | | |
| `.planning/DECISIONS.md` (append D-2026-05-XX for `stat()` ADR) | decision-log | append | self (existing D-2026-04-30-07..-11 entries lines 197-283) | exact |

---

## Pattern Assignments

### `adapters/types.ts` — extend Bin A with `stat()` (Plan 1)

**Analog:** self — existing `exists()` declaration on the same interface.

**Existing pattern to copy** (`adapters/types.ts` lines 30-35, the Bin A record group):

```typescript
// Bin A — record (required, D-05)
getRecord(path: string): Promise<string | null>;
putRecord(path: string, body: string): Promise<void>;
removeRecord(path: string): Promise<void>;
listCollection(prefix: string, filter?: RecordFilter): Promise<RecordRef[]>;
exists(path: string): Promise<boolean>;
```

**Phase 2 addition** (insert after line 35, inside the Bin A record group, per CONTEXT D-11):

```typescript
// Bin A — record (required, D-05 + D-2026-05-XX extension)
// Returns null on missing path (matches getRecord null-on-miss semantics).
// mtime is optional in the return shape — adapters that can't cheaply compute it omit the field.
stat(path: string): Promise<{ kind: 'file' | 'dir'; mtime?: string } | null>;
```

**No `Capabilities` change** — `stat` is required, not capability-gated. The closed-enum at lines 12-24 stays at 9 keys (3 required + 6 optional). Per CONTEXT.md "Capability flag pattern: Phase 2 does NOT add a new capability — `stat` is required."

**No new type guard** — type guards are for `Capabilities` optional methods only. `stat` is unconditionally on the surface.

---

### `adapters/markdown/index.ts` — implement `stat()` (Plan 1)

**Analog:** self — existing `getRecord()` (lines 126-134) and `listCollection()` (lines 152-166) show the ENOENT-as-null pattern using `node:fs/promises`.

**Existing pattern to copy** (`adapters/markdown/index.ts:126-134`):

```typescript
async getRecord(path: string): Promise<string | null> {
  const abs = this.resolve(path);
  try {
    return await readFile(abs, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}
```

**Existing imports already present** (`adapters/markdown/index.ts:23`):

```typescript
import { readFile, writeFile, unlink, readdir, mkdir } from 'node:fs/promises';
```

**Phase 2 addition** — extend the import to add `stat`, then add the method alongside `exists()` (line 168):

```typescript
// Update line 23 to add `stat`
import { readFile, writeFile, unlink, readdir, mkdir, stat } from 'node:fs/promises';

// Add inside the class, after exists() (line 170):
async stat(path: string): Promise<{ kind: 'file' | 'dir'; mtime?: string } | null> {
  const abs = this.resolve(path);
  try {
    const st = await stat(abs);
    return {
      kind: st.isDirectory() ? 'dir' : 'file',
      mtime: st.mtime.toISOString(),
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}
```

> NB: when both the imported binding and the method are named `stat`, the inner method body should rename the import (`import { stat as fsStat } from 'node:fs/promises'`) to avoid shadowing. Final form left to Plan 1 author (Claude's discretion in RESEARCH "stat() Implementation Notes").

---

### `adapters/types.test.ts` — add stat type-check (Plan 1)

**Analog:** self — existing `_testTypeGuards` (lines 54-74) and Test-3 capability shape (lines 33-43).

**Existing pattern to copy** (`adapters/types.test.ts:84-87`):

```typescript
// Test 7: RecordRef shape
const _ref: RecordRef = { path: 'phases/01/PLAN.md', name: 'PLAN.md' };
```

**Phase 2 addition** (append after Test 9, before the `void` suppression block at line 95):

```typescript
// Test 10: stat() return shape (Phase 2 D-11)
function _testStat(a: StorageAdapter): void {
  // Compile-time check: stat exists, takes string, returns Promise<...>
  const _p: Promise<{ kind: 'file' | 'dir'; mtime?: string } | null> = a.stat('STATE.md');
  void _p;
}
void _testStat;

// Test 11: stat result shape — kind narrowing
async function _testStatNarrow(a: StorageAdapter): Promise<void> {
  const r = await a.stat('phases/01-foo');
  if (r === null) return;
  // r.kind is 'file' | 'dir'
  const _k: 'file' | 'dir' = r.kind;
  // r.mtime is optional string
  const _m: string | undefined = r.mtime;
  void _k; void _m;
}
void _testStatNarrow;
```

---

### `tests/conformance/stat.test.ts` (or `adapter.conformance.ts` extension) — Plan 1 stat conformance

**Analog:** existing `getRecord / putRecord round-trip` describe block at `tests/conformance/adapter.conformance.ts:44-55`.

**Existing pattern to copy** (`tests/conformance/adapter.conformance.ts:44-55`):

```typescript
describe('getRecord / putRecord round-trip', () => {
  it('putRecord then getRecord returns same body', async () => {
    await adapter.putRecord('STATE.md', '# State\n');
    const result = await adapter.getRecord('STATE.md');
    expect(result).toBe('# State\n');
  });

  it('getRecord returns null for non-existent path', async () => {
    const result = await adapter.getRecord('NONEXISTENT.md');
    expect(result).toBeNull();
  });
});
```

**Phase 2 addition** — add a new describe block INSIDE the existing `runAdapterConformanceSuite` (before the comment block at line 57). The harness re-uses the suite's `tmpDir` / `adapter` fixtures from `beforeEach` (lines 32-38), so the new tests inherit setup unchanged:

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

**Per-plan conformance test files** (Plans 2-4) follow the same describe-block shape but live in their OWN test files that **import and extend the harness**. The harness factory `runAdapterConformanceSuite` already lives in `adapter.conformance.ts` and is mounted once via `markdown.conformance.test.ts:1-7`:

```typescript
// tests/conformance/markdown.conformance.test.ts (existing)
import { runAdapterConformanceSuite } from './adapter.conformance.js';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';

runAdapterConformanceSuite(
  'markdown',
  (projectDir) => new MarkdownAdapter(projectDir),
);
```

Per-plan tests append describe blocks **inside** `adapter.conformance.ts` (so they get parameterized over BeadsAdapter in Phase 7 automatically), or — if they need bespoke seed setup — live as standalone `.test.ts` files that construct their own MarkdownAdapter via the existing pattern.

---

### `scripts/leak-grep.cjs` — add SDK_FS_READ_PATTERNS (Plan 1)

**Analog:** self — existing TOOL_PATTERNS / SHELL_PATTERNS / CONTEXT_BLOCK_RE blocks (lines 33-54).

**Existing pattern to copy** (`scripts/leak-grep.cjs:33-54`):

```javascript
// Tool patterns — Read/Write/Edit invocations against .planning/
const TOOL_PATTERNS = [
  { name: 'Read-tool',  re: /\bRead\b[^\n]{0,200}["'`]\.planning\// },
  { name: 'Write-tool', re: /\bWrite\b[^\n]{0,200}["'`]\.planning\// },
  { name: 'Edit-tool',  re: /\bEdit\b[^\n]{0,200}["'`]\.planning\// },
];

// Shell patterns — cp/mv/rm/>> against .planning/
const SHELL_PATTERNS = [
  { name: 'cp-shell',     re: /\bcp\b[^\n;]{0,200}\.planning\// },
  { name: 'mv-shell',     re: /\bmv\b[^\n;]{0,200}\.planning\// },
  { name: 'rm-rf-shell',  re: /\brm\s+-rf\b[^\n;]{0,200}\.planning\// },
  { name: 'append-shell', re: />>\s*\.planning\// },
];

// <context>-block @.planning/ frontmatter scan
const CONTEXT_BLOCK_RE = /<context>([\s\S]*?)<\/context>/g;
const CONTEXT_PATH_RE = /\.planning\//;
```

**Existing scan-loop** (`scripts/leak-grep.cjs:78-89`):

```javascript
// Per-line scan for TOOL_PATTERNS + SHELL_PATTERNS
lines.forEach((line, i) => {
  for (const { name, re } of [...TOOL_PATTERNS, ...SHELL_PATTERNS]) {
    if (re.test(line)) {
      matches.push({
        file: filePath,
        line: i + 1,
        category: name,
        text: line.trim(),
      });
    }
  }
});
```

**Phase 2 addition** — insert SDK_FS_READ_PATTERNS after SHELL_PATTERNS (around line 49), and add a Stage-2 path-scope filter for them. Per CONTEXT D-04 + RESEARCH "leak-grep.cjs Extension Patterns":

```javascript
// SDK fs-read patterns (.ts only, .planning/-scoped via Stage-2 filter)
// Phase 2 D-04: covers the SDK migration's read surface; path-scoped so C2 files
// reading ~/.claude/, ~/gsd-workspaces/, etc. naturally pass.
const SDK_FS_READ_PATTERNS = [
  { name: 'fs-read-import', re: /\bimport\s+\{[^}]*\b(?:readFileSync|readdirSync|existsSync|statSync|readFile|readdir|stat|access)\b[^}]*\}\s+from\s+['"]node:fs(?:\/promises)?['"]/ },
  { name: 'fs-require',     re: /\brequire\s*\(\s*['"]node:fs(?:\/promises)?['"]\s*\)/ },
  { name: 'readFileSync',   re: /\breadFileSync\s*\(/ },
  { name: 'readdirSync',    re: /\breaddirSync\s*\(/ },
  { name: 'existsSync',     re: /\bexistsSync\s*\(/ },
  { name: 'statSync',       re: /\bstatSync\s*\(/ },
  { name: 'readFile-async', re: /\bawait\s+readFile\s*\(/ },
  { name: 'readdir-async',  re: /\bawait\s+readdir\s*\(/ },
  { name: 'stat-async',     re: /\bawait\s+stat\s*\(/ },
];

// Stage-2 path-scope filter: a SDK_FS hit only counts if a ±20-line window
// around it references .planning/ (literal) OR planningPaths(...) OR
// relPlanningPath(...) OR a paths.<canonical-name> member access.
const PLANNING_SCOPE_RE = /(?:['"]\.planning\/|planningPaths\s*\(|relPlanningPath\s*\(|paths\.(state|roadmap|project|config|phases|requirements|planning)\b)/;

// Apply only to .ts files (sdk source); keep .js/.cjs/.mjs out of SDK pattern scope.
const SDK_FS_EXTS = /\.ts$/;
```

**Stage-2 filter logic** — extend the per-line scan loop (around line 89) with a windowed pass for SDK_FS_READ_PATTERNS:

```javascript
// SDK_FS pass — .ts files only, with Stage-2 ±20-line .planning/ scope filter
if (SDK_FS_EXTS.test(filePath)) {
  lines.forEach((line, i) => {
    for (const { name, re } of SDK_FS_READ_PATTERNS) {
      if (!re.test(line)) continue;
      // Stage 2: scan ±20 lines for .planning/ scope evidence
      const lo = Math.max(0, i - 20);
      const hi = Math.min(lines.length, i + 21);
      const window = lines.slice(lo, hi).join('\n');
      if (!PLANNING_SCOPE_RE.test(window)) continue;
      matches.push({
        file: filePath,
        line: i + 1,
        category: name,
        text: line.trim(),
      });
    }
  });
}
```

---

### `tests/leak-grep/fixtures/leaky-sdk-handler.ts` (NEW) — Plan 1

**Analog:** `tests/leak-grep/fixtures/leaky-skill-context.md` (the closest leak-trip fixture), plus the existing `clean-skill.md` shape for the no-match counterpart.

**Existing pattern to copy** (`tests/leak-grep/fixtures/leaky-skill-context.md`):

```markdown
---
name: leaky-skill-context
description: A skill that loads .planning/STATE.md at activation via <context>
<context>
@.planning/STATE.md
@.planning/ROADMAP.md
</context>
---

# Leaky Skill (frontmatter <context> @ leak)
This skill triggers Claude Code to read .planning/ files at activation,
bypassing any runtime adapter.
```

**Phase 2 addition** (per RESEARCH §"Test Fixtures") — three new TS fixtures:

```typescript
// tests/leak-grep/fixtures/leaky-sdk-handler.ts
// Should match: fs-read-import + readFileSync + planningPaths scope
import { readFileSync } from 'node:fs';
import { planningPaths } from '../../sdk/src/query/helpers.js';

export function leak(projectDir: string): string {
  const paths = planningPaths(projectDir);
  return readFileSync(paths.state, 'utf-8');
}
```

```typescript
// tests/leak-grep/fixtures/clean-sdk-handler.ts
// Should NOT match: no fs imports, uses adapter
import type { StorageAdapter } from '../../adapters/types.js';

export async function clean(adapter: StorageAdapter): Promise<string> {
  return (await adapter.getRecord('STATE.md')) ?? '';
}
```

```typescript
// tests/leak-grep/fixtures/c2-handler.ts
// Should NOT match: fs read but path is ~/.claude/, NOT .planning/
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function readSkill(): string {
  return readFileSync(join(homedir(), '.claude', 'skills', 'foo.md'), 'utf-8');
}
```

---

### `tests/leak-grep.test.cjs` — extend with SDK_FS assertions (Plan 1)

**Analog:** self — existing test cases at `tests/leak-grep.test.cjs:19-47`.

**Existing pattern to copy** (`tests/leak-grep.test.cjs:25-30`):

```javascript
test('leaky-skill-context.md detects <context>-block leak', () => {
  const { exitCode, stdout } = runLeakGrep('leaky-skill-context.md');
  assert.equal(exitCode, 1);
  assert.match(stdout, /context-block/);
  assert.match(stdout, /\.planning\//);
});
```

**Phase 2 addition** (append at end of file, before any final block):

```javascript
test('leaky-sdk-handler.ts detects readFileSync + planningPaths scope', () => {
  const { exitCode, stdout } = runLeakGrep('leaky-sdk-handler.ts');
  assert.equal(exitCode, 1);
  assert.match(stdout, /readFileSync/);
  assert.match(stdout, /fs-read-import/);
});

test('clean-sdk-handler.ts produces zero leaks', () => {
  const { exitCode, stdout } = runLeakGrep('clean-sdk-handler.ts');
  assert.equal(exitCode, 0, `expected 0, got ${exitCode}; stdout: ${stdout}`);
  assert.equal(stdout.trim(), '');
});

test('c2-handler.ts (~/.claude/ reads) does not trigger SDK_FS pattern', () => {
  // Stage-2 scope filter must suppress: fs read + no .planning/ in window = no match
  const { exitCode, stdout } = runLeakGrep('c2-handler.ts');
  assert.equal(exitCode, 0, `expected 0, got ${exitCode}; stdout: ${stdout}`);
  assert.equal(stdout.trim(), '');
});
```

---

### `sdk/src/query/helpers.ts` — adapter-aware `findProjectRoot` (Plan 1)

**Analog:** `adapters/markdown/index.ts:getRecord` for null-on-miss + `state-project-load.ts:54-80` for handler-style adapter consumption.

**Existing pattern (pre-migration)** (`sdk/src/query/helpers.ts:465-500`):

```typescript
export function findProjectRoot(startDir: string): string {
  let resolvedStart: string;
  try {
    resolvedStart = resolve(startDir);
  } catch {
    return startDir;
  }
  // ...
  try {
    const ownPlanning = join(resolvedStart, '.planning');
    if (existsSync(ownPlanning) && statSync(ownPlanning).isDirectory()) {
      return startDir;
    }
  } catch {
    // fall through
  }
  // ...
  while (dir !== fsRoot && depth < FIND_PROJECT_ROOT_MAX_DEPTH) {
    // ...
    try {
      parentPlanningIsDir = existsSync(parentPlanning) && statSync(parentPlanning).isDirectory();
    } catch {
      parentPlanningIsDir = false;
    }
    // ...
    try {
      const raw = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw) as { /* ... */ };
      // ...
    } catch {
      // config.json missing or unparseable — fall through
    }
  }
}
```

**Phase 2 migration target** — per CONTEXT D-10, adapter is explicit first parameter; per Pitfall 1, ripple async to all callers. Per Pitfall 10, paths must be relative-to-`planningBase`, NOT absolute. **Caveat:** `findProjectRoot` walks PARENT dirs looking for `.planning/` — this is fundamentally a project-root-discovery operation that pre-dates the adapter's `planningBase`. Phase 2 author may choose to leave THIS function on raw fs (it's a bootstrap concern), and migrate only the leaf `existsSync` checks for `.planning/<path>` inside it. Plan 1 task surface should call this out and pick one of:

1. **Keep `findProjectRoot` raw** (it's pre-adapter / discovery): document as inline `// leak-grep-allow file:` exception or move it to a `bootstrap.ts` outside the leak-grep scope.
2. **Make it async + adapter-threaded** with the cost of full ripple.

Whichever option Plan 1 picks, the migrated leaf calls follow the recipe at RESEARCH §"Migration Recipe — Pattern A":

```typescript
// Pre-Phase-2
const raw = readFileSync(configPath, 'utf-8');

// Post-Phase-2 (when called inside an adapter-mounted scope)
const raw = await adapter.getRecord('config.json');
if (raw === null) { /* fallback */ }
```

For `existsSync(...).isDirectory()` checks (line 478, 512), the new `stat()` primitive replaces both:

```typescript
// Pre-Phase-2
parentPlanningIsDir = existsSync(parentPlanning) && statSync(parentPlanning).isDirectory();

// Post-Phase-2
const st = await adapter.stat('');  // adapter is rooted at .planning/ — ''=base
parentPlanningIsDir = st !== null && st.kind === 'dir';
```

---

### `sdk/src/query/route-next-action.ts` — recipe exemplar (Plan 1)

**Analog:** self (lines 17-24, 27-41) shows the three patterns in one file: sync `readFileSync`, async `readdir`+`readFile`, and the handler entry-point.

**Existing pattern** (`sdk/src/query/route-next-action.ts:17-24`):

```typescript
function readConsecutiveCallCount(planningDir: string): number {
  try {
    const raw = readFileSync(join(planningDir, '.next-call-count'), 'utf-8');
    return parseInt(raw.trim(), 10) || 0;
  } catch {
    return 0;
  }
}
```

**Phase 2 migration** (per RESEARCH "Migration Recipe — Pattern A"):

```typescript
async function readConsecutiveCallCount(
  adapter: StorageAdapter,
  // .next-call-count is at .planning/ root → relative path is ''-prefixed
): Promise<number> {
  const raw = await adapter.getRecord('.next-call-count');
  if (raw === null) return 0;
  return parseInt(raw.trim(), 10) || 0;
}
```

**Existing handler shape — the closure** (`sdk/src/query/route-next-action.ts:55-78`):

```typescript
export const routeNextAction: QueryHandler = async (_args, projectDir, workstream) => {
  const planning = planningPaths(projectDir, workstream).planning;
  const continueHere = existsSync(join(planning, '.continue-here.md'));
  // ...
};
```

**Phase 2 migration — adapter from registry closure** — this is the critical Phase 1 D-07 carry-forward. `createRegistry({adapter})` already passes `opts.adapter` into the registry constructor (`sdk/src/query/index.ts:286-287`):

```typescript
// sdk/src/query/index.ts:283-287 (existing)
const { eventStream, correlationSessionId } = opts;
// Phase 1 plumbing only: adapter is held but not yet consumed by handlers.
// Phase 2-3 will start passing it to individual handlers.
const _adapter = opts.adapter;
void _adapter;
```

**Phase 2 must rewire this** — the `void _adapter;` line at index.ts:287 disappears; the adapter is passed to each handler. The minimal pattern (per CONTEXT D-10 — adapter as explicit first parameter to helpers; handler signature stays `(args, projectDir, workstream)`):

```typescript
// sdk/src/query/index.ts after Phase 2 (Plan 1 establishes pattern)
export function createRegistry(opts: {
  adapter: StorageAdapter;
  eventStream?: GSDEventStream;
  correlationSessionId?: string;
}): QueryRegistry {
  const { adapter, eventStream, correlationSessionId } = opts;
  // adapter is now consumed via per-handler closures
  const registry = new QueryRegistry();
  // Wrap each adapter-aware handler so it receives the adapter via closure
  registry.register('route-next-action', (args, projectDir, ws) =>
    routeNextAction(adapter, args, projectDir, ws),
  );
  // ... existing non-adapter handlers register unchanged
}
```

OR the alternative shape (per CONTEXT D-10's "(args, projectDir) handler shape with one extra leading arg" prompt): change the handler signature to `(adapter, args, projectDir, workstream)`. The choice is Plan 1's call (Claude's discretion in CONTEXT.md §"Internal naming for the Plan 1 reference handler"). Both produce the same closure access — pick whichever survives D-07's "explicit, no global module state" intent.

---

### `sdk/src/query/phase.ts` — Plan 2 reference

**Analog:** self — `phase.ts:67` (`readdir`), `phase.ts:85` (`readdir withFileTypes`).

**Existing pattern** (`sdk/src/query/phase.ts:59-76`):

```typescript
async function getPhaseFileStats(phaseDir: string): Promise<{...}> {
  const files = await readdir(phaseDir);
  return {
    plans: files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md'),
    summaries: files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md'),
    // ...
  };
}
```

**Phase 2 migration** (per RESEARCH "Pattern B"):

```typescript
async function getPhaseFileStats(
  adapter: StorageAdapter,
  phaseRel: string,  // 'phases/01-foo' (planning-relative)
): Promise<{...}> {
  const refs = await adapter.listCollection(phaseRel);
  const files = refs.map(r => r.name);
  return {
    plans: files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md'),
    summaries: files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md'),
    // ...
  };
}
```

**Plans 2-3 leaf-handler migration** — every handler that walks `phases/<dir>/` follows this same `listCollection` → `.map(r => r.name)` → filter pattern. The `searchPhaseInDir` helper at `phase.ts:83-130` already returns `RecordRef`-shaped data; minimal change.

---

### `sdk/src/query/intel.ts` — needs `stat()` for mtime (Plan 3, mixed file)

**Analog:** existing `intel.ts:138` — `statSync(filePath).mtime.toISOString()`.

**Existing pattern** (`sdk/src/query/intel.ts:131-138`):

```typescript
if (!existsSync(filePath)) {
  files[filename] = { exists: false, updated_at: null, stale: true };
  // ...
}
let updatedAt: string | null = null;
if (filename.endsWith('.md')) {
  try { updatedAt = statSync(filePath).mtime.toISOString(); } catch { /* skip */ }
}
```

**Phase 2 migration** (uses Plan-1 `stat()` primitive directly — single call combines exists + mtime):

```typescript
const st = await adapter.stat(intelRel);
if (st === null) {
  files[filename] = { exists: false, updated_at: null, stale: true };
  // ...
}
let updatedAt: string | null = null;
if (filename.endsWith('.md')) {
  updatedAt = st.mtime ?? null;  // mtime is optional in return shape per D-11
}
```

**Per CONTEXT D-14** — `intel.ts` is mixed read+write; Phase 2 migrates ONLY the read calls. `appendFileSync` / `writeFileSync` paths in this file stay until Phase 3.

---

### `sdk/src/query/init.ts` / `init-complex.ts` — bundlers compose primitives (Plan 4)

**Analog:** `state-project-load.ts:54-80` — handler-as-composition shape (closure that orchestrates multiple reads into a bundle).

**Existing pattern** (`sdk/src/query/state-project-load.ts:54-80`):

```typescript
export const stateProjectLoad: QueryHandler = async (_args, projectDir, workstream) => {
  const config = loadConfigCjs(projectDir);
  const planDir = planningPaths(projectDir, workstream).planning;

  let stateRaw = '';
  try {
    stateRaw = await readFile(join(planDir, 'STATE.md'), 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  const configExists = existsSync(join(planDir, 'config.json'));
  const roadmapExists = existsSync(join(planDir, 'ROADMAP.md'));
  const stateExists = stateRaw.length > 0;

  return {
    data: { config, state_raw: stateRaw, state_exists: stateExists,
            roadmap_exists: roadmapExists, config_exists: configExists },
  };
};
```

**Phase 2 migration** (per RESEARCH "initProgress Trace") — bundle shape preserved verbatim; internals decompose into adapter primitives:

```typescript
export const stateProjectLoad: QueryHandler = async (args, projectDir, workstream) => {
  // (adapter threaded via createRegistry closure — see route-next-action recipe)
  const config = await loadConfigViaAdapter(adapter);  // Plan 1 helper
  const stateRaw = (await adapter.getRecord('STATE.md')) ?? '';
  const stateExists = stateRaw.length > 0;
  const configExists = await adapter.exists('config.json');
  const roadmapExists = await adapter.exists('ROADMAP.md');
  return {
    data: { config, state_raw: stateRaw, state_exists: stateExists,
            roadmap_exists: roadmapExists, config_exists: configExists },
  };
};
```

**Note on `loadConfig`** — per RESEARCH §"CJS-to-Adapter Call-Site Mapping", `state-project-load.ts` is the ONLY TS file with `createRequire`. The CJS `loadConfig(cwd)` is a parsing+defaults function. Plan 1 audits its body and either (a) inlines the defaults logic in TS, or (b) keeps `loadConfig` as a CJS helper that takes a `string` content arg (no fs). Either way, the adapter loads `config.json`; the parsing is pure logic.

---

### `tests/conformance/init-bundlers.test.ts` (NEW — Plan 4)

**Analog:** `tests/conformance/adapter.conformance.ts` describe-block shape, but with byte-diff snapshot semantics.

**Phase 2 addition** (per RESEARCH §"Byte-Identical Bundle Verification"):

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRegistry } from '../../sdk/src/query/index.js';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';

describe('init bundle byte-stability (16 bundlers)', () => {
  let tmpDir: string;
  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-bundle-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    // Seed fixture .planning/ tree (STATE.md, ROADMAP.md, phases/01-foo/)
    await writeFile(join(tmpDir, '.planning/STATE.md'), '# State\nphase: 01\n');
    await writeFile(join(tmpDir, '.planning/ROADMAP.md'), '# Roadmap\n');
  });
  afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

  it('init-progress bundle matches pre-migration snapshot', async () => {
    const registry = createRegistry({ adapter: new MarkdownAdapter(tmpDir) });
    const result = await registry.dispatch('init.progress', [], tmpDir);
    expect(result.data).toMatchSnapshot();  // snapshot captured at Plan 4 task-1 (pre-migration)
  });
  // ... 15 more `it` blocks, one per bundler
});
```

**Snapshot capture protocol** — Plan 4 task 1 captures snapshots BEFORE any code changes (using the current `node:fs`-based bundlers); Plan 4 task N changes bundler internals; final task verifies snapshots still match.

---

### `scripts/audit-context-blocks.cjs` (NEW — Plan 5)

**Analog:** `scripts/leak-grep.cjs:91-110` — the existing whole-text `<context>`-block scan loop.

**Existing pattern to copy** (`scripts/leak-grep.cjs:91-110`):

```javascript
let m;
CONTEXT_BLOCK_RE.lastIndex = 0;
const contextRe = /<context>([\s\S]*?)<\/context>/g;
while ((m = contextRe.exec(text)) !== null) {
  const block = m[1];
  if (CONTEXT_PATH_RE.test(block)) {
    const lineNum = text.slice(0, m.index).split(/\r?\n/).length;
    const matchingLine = block.split(/\r?\n/).find(l => CONTEXT_PATH_RE.test(l));
    matches.push({
      file: filePath,
      line: lineNum,
      category: 'context-block',
      text: matchingLine?.trim() ?? '<context>-block .planning/ ref',
    });
  }
}
```

**Phase 2 addition** — `scripts/audit-context-blocks.cjs` reuses this engine (either by re-importing CONTEXT_BLOCK_RE / CONTEXT_PATH_RE — leak-grep must export them — or by duplicating the regex constants). Per RESEARCH §"Plan 5 Audit Script — Option B" (recommended):

```javascript
#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const CONTEXT_BLOCK_RE = /<context>([\s\S]*?)<\/context>/g;
const PLANNING_REF_RE = /@\.planning\/[^\s)>"`'<]+/g;

function scanFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const records = [];
  let m;
  while ((m = CONTEXT_BLOCK_RE.exec(text)) !== null) {
    const block = m[1];
    let r;
    PLANNING_REF_RE.lastIndex = 0;
    while ((r = PLANNING_REF_RE.exec(block)) !== null) {
      const lineNum = text.slice(0, m.index + r.index + 9).split(/\r?\n/).length;
      records.push({
        file: filePath,
        line: lineNum,
        ref: r[0],
        excerpt: block.split(/\r?\n/).slice(0, 6).join(' / ').slice(0, 100),
        disposition: classify(filePath, r[0]),
      });
    }
  }
  return records;
}

function classify(file, ref) {
  // RESEARCH §"Auto-Classification Heuristics"
  if (file.includes('tests/leak-grep/fixtures/')) return 'EXCEPTION (fixture)';
  if (file.includes('/templates/')) return 'EXCEPTION (template)';
  const refPath = ref.replace(/^@\.planning\//, '');
  if (['STATE.md', 'ROADMAP.md', 'PROJECT.md', 'REQUIREMENTS.md', 'DECISIONS.md']
        .includes(refPath)) {
    return 'REWRITE-CANDIDATE (canonical doc; skill body can call gsd-sdk query)';
  }
  if (refPath.startsWith('phases/')) return 'INTERCEPT-CANDIDATE (phase artifact)';
  if (refPath.includes('research/')) return 'EXCEPTION (research read-once)';
  return 'INTERCEPT-CANDIDATE (default)';
}

function renderRegister(records) {
  const lines = [
    '# `<context>`-block @.planning/ Reference Register',
    '',
    `**Last audited:** ${new Date().toISOString().slice(0, 10)}`,
    `**Total references:** ${records.length}`,
    '',
    '> Phase 2 deliverable per READS-03 / D-05/D-06/D-07/D-08.',
    '> Phase 4 LEAKS-02 chooses uniform-vs-mixed mitigation strategy.',
    '',
    '| # | File:Line | Reference path | Proposed disposition | Excerpt |',
    '|---|-----------|----------------|----------------------|---------|',
    ...records.map((r, i) =>
      `| ${i + 1} | \`${r.file}:${r.line}\` | \`${r.ref}\` | ${r.disposition} | ${r.excerpt.replace(/\|/g, '\\|')} |`),
  ];
  return lines.join('\n') + '\n';
}

// ... walk + main; mirrors leak-grep.cjs:120-188
```

---

### `.planning/leaks/context-block-register.md` (NEW — Plan 5)

**Analog:** `.planning/DECISIONS.md` table-row + section markdown shape.

**Existing pattern** (`.planning/DECISIONS.md:266-274` — table-driven multi-row):

```markdown
| Cause | Files | Nature | Upstream issue |
|-------|-------|--------|----------------|
| A — getMilestoneInfo ignores STATE.md milestone_name | `sdk/src/query/roadmap.ts` | CJS faithfulness (SDK was arguably more correct) | File: "..." |
```

**Phase 2 addition** — Plan 5's audit script generates this file; the user/Phase 4 author can refine dispositions per row. See above script's `renderRegister()` output for the canonical shape.

---

### `.planning/DECISIONS.md` — append `stat()` ADR (Plan 1)

**Analog:** existing per-PR ADRs at `.planning/DECISIONS.md:197-283` (D-2026-04-30-07 through -11).

**Existing pattern to copy** (`.planning/DECISIONS.md:197-208`, the D-2026-04-30-07 entry):

```markdown
## D-2026-04-30-07 — Upstream PR #2898 reconciliation (durable planning runtime)

**Date:** 2026-04-30
**Decision:** **IRRELEVANT** to the StorageAdapter contract. PR #2898 lands ...

**Contract impact:** NONE. The journal does not touch STATE.md, ROADMAP.md, or any document the StorageAdapter owns.

**Rebase risk:** LOW. Separate files, separate directory.

**Alternatives considered:** Should journal writes eventually flow through `adapter.putRecord`? Deferred ...

**Implication:** No changes needed to the StorageAdapter interface or MarkdownAdapter scaffold as a result of this PR. ...

---
```

**Phase 2 addition** (append after D-2026-04-30-11; Plan 1 ships this with the contract change):

```markdown
## D-2026-05-XX — Bin A contract extension: stat() required primitive

**Date:** 2026-05-XX
**Trigger:** Phase 2 migration audit identified 6 SDK call sites needing
`statSync().isDirectory()` (`helpers.ts:478,512`, `docs-init.ts:94,99`,
`init-complex.ts:450`) and 1 needing `mtime` (`intel.ts:138`).

**Decision:** Add `stat(path) => Promise<{kind, mtime?} | null>` to the
required Bin A surface of `StorageAdapter`. Re-opens Phase 1 D-05/D-10
with one new required method. Not capability-gated.

**Alternatives considered:**
1. **`listCollection`-as-isDirectory check.** Rejected: relies on call-success
   vs. throw to distinguish dir from file; fragile semantic overload.
2. **Capability-gate `stat`.** Rejected: `isDirectory` is fundamental
   enough that every backend must support it; gate-noise at every call site
   is worse than one required method.
3. **Make `mtime` required.** Rejected: some backends (e.g. virtual
   filesystems, in-memory test adapters) can't cheaply compute mtime;
   making it optional in the return shape preserves graceful degradation.

**Contract impact:** v1.0 surface gains one required method. Third-party
adapters importing `StorageAdapter` must implement `stat` on next minor bump.

**Rebase risk:** LOW. The change is isolated to `adapters/types.ts` + one
new method on `MarkdownAdapter`; no upstream collision.

**Implication:** Plan 1 of Phase 2 ships the contract change + impl +
conformance test. Plans 2-4 consume `stat()` at the 7 identified call
sites and any further sites discovered during per-handler migration.

---
```

---

## Shared Patterns

### Adapter null-on-miss + try/catch ENOENT

**Source:** `adapters/markdown/index.ts:126-134` (getRecord), 142-150 (removeRecord), 152-160 (listCollection).

**Apply to:** every new adapter method (`stat()`) and every migrated handler that previously used `try { readFileSync } catch { fallback }`.

```typescript
async someMethod(path: string): Promise<T | null> {
  const abs = this.resolve(path);
  try {
    return await someFsCall(abs);  // readFile, stat, readdir, etc.
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;  // Bubble up real I/O errors (permissions, etc.)
  }
}
```

### Adapter from registry closure (handler signature preservation)

**Source:** `sdk/src/query/index.ts:283-329` (createRegistry body) + Phase 1 SUMMARY's plumbing decision.

**Apply to:** every adapter-aware handler in Plans 1-4.

The adapter is captured in the registry-construction closure. Two equivalent shapes; Plan 1 picks one and Plans 2-4 follow:

**Shape A — wrapper at registration:**
```typescript
const { adapter } = opts;
registry.register('find-phase', (args, projectDir, ws) =>
  findPhase(adapter, args, projectDir, ws));
```

**Shape B — handler signature has explicit adapter first-arg:**
```typescript
// findPhase signature changes from (args, projectDir, ws) to (adapter, args, projectDir, ws)
// All call sites + tests update.
```

Either is consistent with CONTEXT D-10 ("explicit, no module state, no factory closure"); shape B is more verbose but more grep-able. Plan 1 picks one.

### Per-line read-only discipline in mixed files (D-14)

**Source:** CONTEXT.md D-14 — applies to `progress.ts`, `intel.ts`, `verify.ts`, `state-mutation.ts` read-paths.

**Apply to:** Plans 2-3 leaf migrations.

For files containing both reads and writes:
- Migrate ONLY `readFileSync` / `readdirSync` / `existsSync` / `statSync` / `await readFile` / `await readdir` / `await stat`
- Leave `writeFileSync` / `mkdirSync` / `unlinkSync` / `appendFileSync` / `await writeFile` UNCHANGED
- The leak-grep SDK_FS_READ_PATTERNS list contains only read fs calls, so the gate fires correctly per-line

### Path normalization to `.planning/`-relative

**Source:** Phase 1 D-04 + `adapters/markdown/index.ts:resolve()` (line 120-122).

**Apply to:** every adapter call in Plans 1-4.

| Pre-migration absolute path | Post-migration `.planning/`-relative path |
|----------------------------|-------------------------------------------|
| `paths.state` | `'STATE.md'` |
| `paths.roadmap` | `'ROADMAP.md'` |
| `paths.requirements` | `'REQUIREMENTS.md'` |
| `paths.phases` | `'phases'` |
| `join(paths.phases, dir)` | `'phases/' + dir` (or `${'phases'}/${dir}`) |
| `join(planning, '.next-call-count')` | `'.next-call-count'` |
| `intelFilePath(projectDir, fname)` | `'intel/' + fname` |

### Conformance test fixture seeding via `putRecord`

**Source:** `tests/conformance/adapter.conformance.ts:46` (`await adapter.putRecord('STATE.md', '# State\n')`).

**Apply to:** every per-handler conformance test in Plans 1-4.

```typescript
beforeEach(async () => {
  // tmpDir created + .planning/ pre-mkdir'd by harness
  await adapter.putRecord('STATE.md', '# State\n');
  await adapter.putRecord('phases/01-foo/01-PLAN.md', '# Plan\n');
});
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.planning/leaks/context-block-register.json` (sidecar, optional) | register-doc | type-defn | No prior JSON sidecar to a markdown register exists; Phase 2 sets the precedent if Claude opts to ship per CONTEXT.md "Claude's discretion" |

**Note:** `tests/conformance/init-bundlers.test.ts` is "no analog" for the snapshot capture mechanic specifically (vitest's `toMatchSnapshot` is uncomplicated but no existing test in this repo uses it for byte-diff). The describe-block + adapter-mount shape DOES have an analog (`adapter.conformance.ts`).

---

## Metadata

**Analog search scope:**
- `/home/ellio/code/get-shit-done/adapters/` (types.ts, types.test.ts, markdown/index.ts)
- `/home/ellio/code/get-shit-done/tests/conformance/` (adapter.conformance.ts, markdown.conformance.test.ts)
- `/home/ellio/code/get-shit-done/tests/leak-grep/` (fixtures + leak-grep.test.cjs at parent)
- `/home/ellio/code/get-shit-done/scripts/leak-grep.cjs`
- `/home/ellio/code/get-shit-done/sdk/src/query/` (helpers.ts, route-next-action.ts, phase.ts, intel.ts, docs-init.ts, state-project-load.ts, index.ts)
- `/home/ellio/code/get-shit-done/.planning/DECISIONS.md`
- `/home/ellio/code/get-shit-done/.planning/phases/01-fork-bootstrap-storageadapter-interface-skeleton-markdownada/` (Phase 1 plans for closure-pattern reference)

**Files scanned:** 14 source files + 4 fixture files + 5 phase docs = 23

**Pattern extraction date:** 2026-04-30

**Key facts the planner can rely on:**
- `MarkdownAdapter.getRecord` already implements null-on-ENOENT correctly (line 131); `stat()` mirrors this exactly.
- `MarkdownAdapter.listCollection` swallows ENOENT and returns `[]` (line 158); pre-migration `try { readdirSync } catch { return [] }` patterns become no-op redundancy after migration (RESEARCH Pitfall 3).
- The conformance harness (`adapter.conformance.ts`) is parameterized over adapter factories; new describe blocks added now run against MarkdownAdapter today and BeadsAdapter in Phase 7 with zero changes.
- `scripts/leak-grep.cjs` already has the file-walk + per-line scan engine; Phase 2 only adds new pattern arrays + a Stage-2 windowed scope filter for the SDK_FS category.
- `createRegistry({adapter})` in `sdk/src/query/index.ts:286-287` currently has `void _adapter;` — Plan 1 deletes this stub and threads `adapter` to handlers.
- `state-project-load.ts` is the ONLY SDK TS file using `createRequire` for fs work (RESEARCH §"CJS-to-Adapter Call-Site Mapping").

## PATTERN MAPPING COMPLETE
