# Phase 3: Wire core write methods + recordStateEvent - Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 11 (new/modified files)
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `adapters/types.ts` | config (interface) | type-definition | self (current version) | exact |
| `adapters/markdown/index.ts` | service (adapter impl) | CRUD + transaction | self (current `putRecord`/`getRecord` methods) | exact |
| `sdk/src/query/state-event-types.ts` | model (type defs) | type-definition | `adapters/types.ts` (discriminated unions + branded types) | role-match |
| `sdk/src/query/state-mutation.ts` | controller (handler) | request-response + CRUD | self (current `stateAddDecision`, `stateUpdate` patterns) | exact |
| `sdk/src/query/phase-lifecycle.ts` | controller (handler) | request-response + CRUD | self (current `phaseAdd` pattern) | exact |
| `sdk/src/query/phase-helpers.ts` | service (shared helpers) | CRUD | `sdk/src/query/helpers.ts` (`adapterFor`, `planningRelativePath`) | role-match |
| `scripts/leak-grep.cjs` | utility (lint tool) | batch | self (current `SDK_FS_READ_PATTERNS`) | exact |
| `tests/conformance/write-events.test.ts` | test (conformance) | request-response | `tests/conformance/phase-reads.test.ts` | exact |
| `tests/conformance/write-transaction.test.ts` | test (conformance) | request-response | `tests/conformance/adapter.conformance.ts` | exact |
| `tests/conformance/commit-planning-state.test.ts` | test (conformance) | request-response | `tests/conformance/adapter.conformance.ts` | exact |
| `tests/conformance/golden-write.test.ts` | test (integration) | request-response | `tests/conformance/phase-reads.test.ts` | role-match |

## Pattern Assignments

### `adapters/types.ts` (config, type-definition)

**Analog:** Self — the existing file at `/Volumes/code/get-shit-done/adapters/types.ts`

**Interface extension pattern** (lines 26-61 — adding methods to `StorageAdapter`):
```typescript
export interface StorageAdapter {
  readonly name: string;
  readonly capabilities: Capabilities;

  // Bin A — record (required, D-05 + D-2026-05-XX extension — stat)
  getRecord(path: string): Promise<string | null>;
  putRecord(path: string, body: string): Promise<void>;
  // ... existing methods ...

  // Foundational primitives (D-10): declared in Phase 1, fully impl'd in Phase 5
  withTransaction(fn: () => Promise<void>): Promise<void>;
  commitPlanningState(message: string, files?: string[]): Promise<void>;
}
```

**Capabilities enum pattern** (lines 12-24 — capability flags):
```typescript
export interface Capabilities {
  // Required core groups (D-05): true literal forces compile-time presence
  record: true;
  section: true;
  frontmatter: true;
  // Optional, closed enum of 6 (D-08)
  binaryAsset: boolean;
  snapshot: boolean;
  transaction: boolean;
  namedDoc: boolean;
  commitPlanningState: boolean;
  markdownLockfile: boolean;
}
```

**Type guard pattern** (lines 85-102 — companion type guards for optional caps):
```typescript
export function hasTransaction(a: StorageAdapter): a is StorageAdapter & { capabilities: Capabilities & { transaction: true } } {
  return a.capabilities.transaction;
}
export function hasCommitPlanningState(a: StorageAdapter): a is StorageAdapter & { capabilities: Capabilities & { commitPlanningState: true } } {
  return a.capabilities.commitPlanningState;
}
```

---

### `adapters/markdown/index.ts` (service, CRUD + transaction)

**Analog:** Self — the existing file at `/Volumes/code/get-shit-done/adapters/markdown/index.ts`

**Imports pattern** (lines 20-33):
```typescript
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { readFile, writeFile, unlink, readdir, mkdir, stat as fsStat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type {
  StorageAdapter,
  Capabilities,
  RecordRef,
  RecordFilter,
  SectionMode,
} from '../types.js';
import { UnsupportedCapabilityError } from '../types.js';
```

**Capability declaration pattern** (lines 83-93 — how to set caps):
```typescript
readonly capabilities: Capabilities = {
  record: true,
  section: true,
  frontmatter: true,
  binaryAsset: false,
  snapshot: false,
  transaction: false,    // Phase 3 changes to: true
  namedDoc: false,
  commitPlanningState: true,
  markdownLockfile: true,
};
```

**Method implementation pattern** (lines 126-140 — getRecord/putRecord as reference for how methods are structured):
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

async putRecord(path: string, body: string): Promise<void> {
  const abs = this.resolve(path);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, body, 'utf-8');
}
```

**Defensive throw pattern for unimplemented methods** (lines 318-319 — what Phase 3 replaces for `withTransaction`):
```typescript
async withTransaction(_fn: () => Promise<void>): Promise<void> {
  throw new UnsupportedCapabilityError('transaction', this.name);
}
```

**commitPlanningState implementation pattern** (lines 283-300 — existing impl stays, moves from cap-gated to always-available):
```typescript
async commitPlanningState(message: string, files?: string[]): Promise<void> {
  const { execFileSync } = await import('node:child_process');
  const targets = files && files.length > 0 ? files : ['.planning'];
  try {
    execFileSync('git', ['add', ...targets], {
      cwd: this.projectDir,
      stdio: 'pipe',
    });
    execFileSync('git', ['commit', '-m', message], {
      cwd: this.projectDir,
      stdio: 'pipe',
    });
  } catch (err) {
    throw new Error(
      `commitPlanningState failed: ${(err as Error).message}`,
    );
  }
}
```

---

### `sdk/src/query/state-event-types.ts` (model, type-definition) -- NEW FILE

**Analog:** `adapters/types.ts` (lines 1-24, 63-102)

**Discriminated union pattern** (from `adapters/types.ts` lines 63-82 — `UnsupportedCapabilityError` as example of branded type export):
```typescript
// adapters/types.ts shows: export interface + export class + export function pattern
// state-event-types.ts should follow same shape: export interface per payload, export type for unions

export interface DecisionPayload {
  phase: string;
  summary: string;
  rationale?: string;
}

export type AppendEvent =
  | { type: 'decision'; payload: DecisionPayload }
  | { type: 'metric'; payload: MetricPayload }
  // ...
```

**Module doc comment pattern** (from `adapters/types.ts` line 1):
```typescript
// StorageAdapter v1.0 interface — locked contract for pluggable storage backends.
```

---

### `sdk/src/query/state-mutation.ts` (controller, request-response + CRUD)

**Analog:** Self — current event handler pattern (`stateAddDecision` at lines 742-791)

**Event handler pattern (BEFORE migration)** — lines 742-791:
```typescript
export const stateAddDecision: QueryHandler = async (args, projectDir, workstream) => {
  const parsed = parseNamedArgs(args, ['phase', 'summary', 'summary-file', 'rationale', 'rationale-file']);
  const phase = parsed.phase as string | null;
  // ... validation + arg extraction ...

  const entry = `- [Phase ${phase || '?'}]: ${summaryText}${rationaleText ? ` — ${rationaleText}` : ''}`;
  let added = false;

  await readModifyWriteStateMd(projectDir, (content) => {
    const sectionPattern = /(###?\s*(?:Decisions|Decisions Made|Accumulated.*Decisions)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
    const match = content.match(sectionPattern);
    if (match) {
      // ... section append logic ...
      added = true;
    }
    return content;
  }, workstream);

  if (added) {
    return { data: { added: true, decision: entry } };
  }
  return { data: { added: false, reason: 'Decisions section not found in STATE.md' } };
};
```

**Non-event handler pattern (BEFORE migration)** — `stateUpdate` at lines 328-347:
```typescript
export const stateUpdate: QueryHandler = async (args, projectDir, workstream) => {
  const field = args[0];
  const value = args[1];

  if (!field || value === undefined) {
    throw new GSDError('field and value required for state update', ErrorClassification.Validation);
  }

  let updated = false;
  await readModifyWriteStateMd(projectDir, (content) => {
    const result = stateReplaceField(content, field, value);
    if (result) {
      updated = true;
      return result;
    }
    return content;
  }, workstream);

  return { data: { updated } };
};
```

**Signal handler pattern (BEFORE migration)** — `stateSignalWaiting` at lines 1281-1314:
```typescript
export const stateSignalWaiting: QueryHandler = async (args, projectDir, _workstream) => {
  const parsed = parseNamedArgs(args, ['type', 'question', 'options', 'phase']);
  // ... arg parsing ...
  const signal = { status: 'waiting', type, question, options: [...], since: new Date().toISOString(), phase };

  try {
    const payload = JSON.stringify(signal, null, 2);
    mkdirSync(join(projectDir, '.gsd'), { recursive: true });
    mkdirSync(join(projectDir, '.planning'), { recursive: true });
    for (const p of waitingPaths) {
      writeFileSync(p, payload, 'utf-8');
    }
    return { data: { signaled: true, path: waitingPaths[0], paths: waitingPaths } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { data: { signaled: false, error: msg } };
  }
};
```

**Lockfile pattern** (lines 179-228 — `acquireStateLock` that Phase 3 internalizes into adapter):
```typescript
export async function acquireStateLock(statePath: string): Promise<string> {
  const lockPath = statePath + '.lock';
  const maxRetries = 10;
  const retryDelay = 200;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const fd = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
      await fd.writeFile(String(process.pid));
      await fd.close();
      _heldStateLocks.add(lockPath);
      return lockPath;
    } catch (err: unknown) {
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'EEXIST') {
        // ... stale lock cleanup, retry logic ...
      } else {
        return lockPath; // graceful degradation
      }
    }
  }
  return lockPath;
}
```

**readModifyWriteStateMd pattern** (lines 262-288 — the pattern being replaced):
```typescript
async function readModifyWriteStateMd(
  projectDir: string,
  modifier: (content: string) => string | Promise<string>,
  workstream?: string,
): Promise<string> {
  const statePath = planningPaths(projectDir, workstream).state;
  const lockPath = await acquireStateLock(statePath);
  try {
    let content: string;
    try { content = await readFile(statePath, 'utf-8'); } catch { content = ''; }
    const body = stripFrontmatter(content);
    const modified = await modifier(body);
    const synced = await syncStateFrontmatter(modified, projectDir);
    const normalized = normalizeMd(synced);
    await writeFile(statePath, normalized, 'utf-8');
    return normalized;
  } finally {
    await releaseStateLock(lockPath);
  }
}
```

---

### `sdk/src/query/phase-lifecycle.ts` (controller, request-response + CRUD)

**Analog:** Self — current `phaseAdd` handler pattern (lines 199-313)

**Handler shape** (lines 199-227 — validation + readModifyWriteRoadmapMd + side effects):
```typescript
export const phaseAdd: QueryHandler = async (args, projectDir, workstream) => {
  const description = args[0];
  if (!description) {
    throw new GSDError('description required for phase add', ErrorClassification.Validation);
  }
  assertNoNullBytes(description, 'description');

  const configPath = planningPaths(projectDir, workstream).config;
  let config: Record<string, unknown> = {};
  try { config = JSON.parse(await readFile(configPath, 'utf-8')); } catch { /* defaults */ }

  const slug = generateSlugInternal(description);
  // ... more setup ...

  await readModifyWriteRoadmapMd(projectDir, async (rawContent) => {
    const adapter = await adapterFor(projectDir);
    // ... logic using adapter for reads, direct fs for writes (pre-migration) ...
    const dirPath = join(planningPaths(projectDir, workstream).phases, dirName);
    await mkdir(dirPath, { recursive: true });
    await writeFile(join(dirPath, '.gitkeep'), '', 'utf-8');
    // ... ROADMAP content manipulation ...
    return rawContent.slice(0, lastSeparator) + phaseEntry + rawContent.slice(lastSeparator);
  }, workstream);

  return { data: result };
};
```

**readModifyWriteRoadmapMd pattern** (lines 164-184 — the ROADMAP equivalent being replaced):
```typescript
export async function readModifyWriteRoadmapMd(
  projectDir: string,
  modifier: (content: string) => string | Promise<string>,
  workstream?: string,
): Promise<string> {
  const roadmapPath = planningPaths(projectDir, workstream).roadmap;
  const lockPath = await acquireStateLock(roadmapPath);
  try {
    let content: string;
    try { content = await readFile(roadmapPath, 'utf-8'); } catch { content = ''; }
    const modified = await modifier(content);
    await writeFile(roadmapPath, modified, 'utf-8');
    return modified;
  } finally {
    await releaseStateLock(lockPath);
  }
}
```

**Validation helpers** (lines 50-68):
```typescript
function assertNoNullBytes(value: string, label: string): void {
  if (value.includes('\0')) {
    throw new GSDError(`${label} contains null byte`, ErrorClassification.Validation);
  }
}

function assertSafePhaseDirName(dirName: string, label = 'phase directory'): void {
  if (/[/\\]|\.\./.test(dirName)) {
    throw new GSDError(`${label} contains invalid path segments`, ErrorClassification.Validation);
  }
}
```

---

### `sdk/src/query/phase-helpers.ts` (service, CRUD) -- NEW FILE

**Analog:** `sdk/src/query/helpers.ts` (lines 437-493)

**Module structure and import pattern** (lines 0-24 of helpers.ts):
```typescript
/**
 * Shared query helpers — cross-cutting utility functions used across query modules.
 * ...
 */

import { join, dirname, relative, resolve, isAbsolute, normalize } from 'node:path';
import { realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { GSDError, ErrorClassification } from '../errors.js';
import { relPlanningPath } from '../workstream-utils.js';
import type { StorageAdapter } from '../../../adapters/types.js';
```

**Adapter-first-parameter helper pattern** (lines 490-493 — `adapterFor` as reference for adapter-accepting functions):
```typescript
export async function adapterFor(projectDir: string): Promise<StorageAdapter> {
  const { MarkdownAdapter } = await import('../../../adapters/markdown/index.js');
  return new MarkdownAdapter(projectDir);
}
```

**planningRelativePath utility pattern** (lines 448-456 — helper that Phase 3 SDK helpers will use):
```typescript
export function planningRelativePath(
  workstream: string | null | undefined,
  doc: string,
): string {
  if (workstream === null || workstream === undefined || workstream === '') {
    return doc;
  }
  return `workstreams/${workstream}/${doc}`;
}
```

**Phase 3 helper signature pattern** (derived from D-05 / Phase 2 D-10):
```typescript
// Phase 3 shared helpers follow this signature pattern:
export async function scaffoldPhaseDir(
  adapter: StorageAdapter,
  phasesRelPath: string,
  dirName: string,
): Promise<void> {
  await adapter.putRecord(`${phasesRelPath}/${dirName}/.gitkeep`, '');
}
```

---

### `scripts/leak-grep.cjs` (utility, batch)

**Analog:** Self — the existing file at `/Volumes/code/get-shit-done/scripts/leak-grep.cjs`

**SDK pattern array structure** (lines 59-69 — how read patterns are defined):
```javascript
const SDK_FS_READ_PATTERNS = [
  { name: 'fs-read-import', re: /\bimport\s+\{[^}]*\b(?:readFileSync|readdirSync|existsSync|statSync|readFile|readdir|stat|access)\b[^}]*\}\s+from\s+['"]node:fs(?:\/promises)?['"]/ },
  { name: 'fs-require',     re: /\brequire\s*\(\s*['"]node:fs(?:\/promises)?['"]\s*\)/ },
  { name: 'readFileSync',   re: /\breadFileSync\s*\(/ },
  { name: 'readdirSync',    re: /\breaddirSync\s*\(/ },
  { name: 'existsSync',     re: /\bexistsSync\s*\(/ },
  { name: 'statSync',       re: /\bstatSync\s*\(/ },
  { name: 'readFile-async', re: /\bawait\s+readFile\s*\(/ },
  { name: 'readdir-async',  re: /\bawait\s+readdir\s*\(/ },
  { name: 'stat-async',     re: /\bawait\s+(?:fsStat|stat)\s*\(/ },
];
```

**Stage-2 path-scope filter** (line 72 — new write patterns use same scoping):
```javascript
const PLANNING_SCOPE_RE = /(?:['"`]\.planning\/|planningPaths\s*\(|relPlanningPath\s*\(|planningRelativePath\s*\(|paths\.(state|roadmap|project|config|phases|requirements|planning)\b)/;
```

**SDK scan logic** (lines 113-129 — the scan structure that the write patterns must integrate into):
```javascript
if (SDK_FS_EXTS.test(filePath)) {
  lines.forEach((line, i) => {
    for (const { name, re } of SDK_FS_READ_PATTERNS) {
      if (!re.test(line)) continue;
      const lo = Math.max(0, i - 20);
      const hi = Math.min(lines.length, i + 21);
      const window = lines.slice(lo, hi).join('\n');
      if (!PLANNING_SCOPE_RE.test(window)) continue;
      matches.push({ file: filePath, line: i + 1, category: name, text: line.trim() });
    }
  });
}
```

**Module exports pattern** (lines 234-242):
```javascript
module.exports = {
  TOOL_PATTERNS,
  SHELL_PATTERNS,
  SDK_FS_READ_PATTERNS,
  PLANNING_SCOPE_RE,
  CONTEXT_BLOCK_RE,
  CONTEXT_PATH_RE,
  scanFile,
};
```

---

### `tests/conformance/write-events.test.ts` (test, conformance) -- NEW FILE

**Analog:** `tests/conformance/phase-reads.test.ts` (lines 0-57)

**Test file structure** (lines 0-57):
```typescript
/**
 * Phase 2 Plan 02-02 Task 3 — Conformance test for phase/state/progress/roadmap reads.
 * ...
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRegistry } from '../../sdk/src/query/index.js';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../adapters/types.js';

describe('Phase 2 Plan 02-02: phase/state/progress/roadmap reads via adapter', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-phase-reads-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);

    // Seed common fixture state
    await adapter.putRecord('STATE.md', `---
milestone: v1.0
---

# State

**Current Phase:** 01
**Status:** executing
`);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ... test cases ...
});
```

---

### `tests/conformance/write-transaction.test.ts` and `commit-planning-state.test.ts` (test, conformance) -- NEW FILES

**Analog:** `tests/conformance/adapter.conformance.ts` (lines 1-89)

**Conformance harness pattern** (lines 24-89):
```typescript
export function runAdapterConformanceSuite(
  adapterName: string,
  adapterFactory: (projectDir: string) => StorageAdapter,
): void {
  describe(`StorageAdapter conformance: ${adapterName}`, () => {
    let tmpDir: string;
    let adapter: StorageAdapter;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'gsd-conform-'));
      await mkdir(join(tmpDir, '.planning'), { recursive: true });
      adapter = adapterFactory(tmpDir);
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    describe('getRecord / putRecord round-trip', () => {
      it('putRecord then getRecord returns same body', async () => {
        await adapter.putRecord('STATE.md', '# State\n');
        const result = await adapter.getRecord('STATE.md');
        expect(result).toBe('# State\n');
      });
    });
  });
}
```

---

## Shared Patterns

### Handler Signature
**Source:** `sdk/src/query/utils.ts` lines 40-44
**Apply to:** All handler files (`state-mutation.ts`, `phase-lifecycle.ts`)
```typescript
export type QueryHandler<T = unknown> = (
  args: string[],
  projectDir: string,
  workstream?: string,
) => Promise<QueryResult<T>>;
```

### adapterFor + planningRelativePath
**Source:** `sdk/src/query/helpers.ts` lines 448-493
**Apply to:** All handlers and helpers that need adapter access or workstream-aware paths
```typescript
export async function adapterFor(projectDir: string): Promise<StorageAdapter> {
  const { MarkdownAdapter } = await import('../../../adapters/markdown/index.js');
  return new MarkdownAdapter(projectDir);
}

export function planningRelativePath(
  workstream: string | null | undefined,
  doc: string,
): string {
  if (workstream === null || workstream === undefined || workstream === '') {
    return doc;
  }
  return `workstreams/${workstream}/${doc}`;
}
```

### Error Handling
**Source:** `sdk/src/query/state-mutation.ts` lines 25-26, `sdk/src/query/phase-lifecycle.ts` lines 50-68
**Apply to:** All handlers and helpers
```typescript
import { GSDError, ErrorClassification } from '../errors.js';

// Validation errors:
throw new GSDError('field and value required for state update', ErrorClassification.Validation);

// Execution errors:
throw new GSDError('Phase directory name was not computed', ErrorClassification.Execution);

// Path safety validation:
function assertNoNullBytes(value: string, label: string): void {
  if (value.includes('\0')) {
    throw new GSDError(`${label} contains null byte`, ErrorClassification.Validation);
  }
}
```

### UnsupportedCapabilityError
**Source:** `adapters/types.ts` lines 63-82
**Apply to:** Adapter methods that are capability-gated
```typescript
export class UnsupportedCapabilityError extends Error {
  override readonly name = 'UnsupportedCapabilityError';
  readonly capability: string;
  readonly adapterName: string;
  readonly __brand = 'UnsupportedCapabilityError' as const;
  constructor(capability: string, adapterName: string) {
    super(`Adapter '${adapterName}' does not support capability '${capability}'`);
    this.capability = capability;
    this.adapterName = adapterName;
  }
}
```

### Test Setup (Conformance)
**Source:** `tests/conformance/phase-reads.test.ts` lines 25-57
**Apply to:** All new conformance test files
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../adapters/types.js';

describe('...', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-write-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);
    // Seed fixtures via adapter.putRecord(...)
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });
});
```

### Frontmatter Sync Pipeline
**Source:** `sdk/src/query/state-mutation.ts` lines 238-251
**Apply to:** Any handler that writes to STATE.md (must replicate the strip-modify-sync-normalize dance)
```typescript
async function syncStateFrontmatter(content: string, projectDir: string): Promise<string> {
  const existingFm = extractFrontmatter(content);
  const body = stripFrontmatter(content);
  const syncAdapter = await adapterFor(projectDir);
  const derivedFm = await buildStateFrontmatter(syncAdapter, body, projectDir);

  if (derivedFm.status === 'unknown' && existingFm.status && existingFm.status !== 'unknown') {
    derivedFm.status = existingFm.status;
  }

  const yamlStr = reconstructFrontmatter(derivedFm);
  return `---\n${yamlStr}\n---\n\n${body}`;
}
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | All files have close analogs in the existing codebase |

All 11 files to be created or modified have strong existing analogs. The migration is structural (routing through adapter instead of direct fs), not behavioral (no new patterns being introduced from scratch).

## Metadata

**Analog search scope:** `adapters/`, `sdk/src/query/`, `scripts/`, `tests/conformance/`
**Files scanned:** 12 source files read + grep across the codebase
**Pattern extraction date:** 2026-05-10
