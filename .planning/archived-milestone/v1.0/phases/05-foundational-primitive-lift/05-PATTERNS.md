# Phase 5: Foundational primitive lift — Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 16 (7 modified, 7 created, 2 extended tests)
**Analogs found:** 16 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `adapters/types.ts` (modified) | interface | type-definition | Self (extend existing shape) | exact (self) |
| `adapters/markdown/index.ts` (modified) | adapter | file-I/O + transform | Self + Phase 3 `withTransaction`/`acquireAdapterLock` (lines 321-375) | exact (self-refactor) |
| `sdk/src/query/pipeline.ts` (modified) | middleware | request-response + txn | Self (lines 192-230 dry-run branch) | exact (self-refactor) |
| `sdk/src/query/named-docs.ts` (modified) | handler | request-response | Self + `codebase-docs.ts`/`tmp-docs.ts` | exact (self-refactor; siblings for symmetry) |
| `sdk/src/query/codebase-docs.ts` (modified) | handler | request-response | Self | exact (self-refactor) |
| `sdk/src/query/tmp-docs.ts` (modified) | handler | request-response | Self | exact (self-refactor) |
| `sdk/src/query/route-next-action.ts` (modified) | handler | request-response | Self (line 44) | exact (self-edit at one line) |
| `sdk/src/query/sidecar.ts` (NEW) | handler/helper | request-response | `named-docs.ts` (flat exported handler style) + `route-next-action.ts:40-47` (adapter-first signature) | exact |
| `sdk/src/query/scratch.ts` (NEW) | handler | request-response | `named-docs.ts` (reportPut/Get pairs) + `tmp-docs.ts` (relaxed key validation, subdir allowed) | exact |
| `tests/conformance/section-depth.test.ts` (NEW) | test | unit | `tests/conformance/write-transaction.test.ts` (harness + adapter setup) + `tests/conformance/write-events.test.ts` (seeded STATE.md fixture) | exact |
| `tests/conformance/named-doc.test.ts` (NEW) | test | unit | `tests/conformance/write-transaction.test.ts` (harness) + `tests/conformance/adapter.conformance.ts` (round-trip shape) | exact |
| `tests/conformance/binary-asset.test.ts` (NEW) | test | unit | `tests/conformance/write-transaction.test.ts` (harness) + `tests/conformance/commit-planning-state.test.ts` (mocking/monkeypatch for capability-gated flow) | exact |
| `sdk/src/query/sidecar.test.ts` (NEW) | test | unit | `sdk/src/query/pipeline.test.ts` (tmpDir setup + handler-style unit tests) | exact |
| `sdk/src/query/scratch.test.ts` (NEW) | test | unit | `sdk/src/query/pipeline.test.ts` | exact |
| `tests/conformance/write-transaction.test.ts` (extended) | test | unit | Self (existing test suite) | exact (self-extend) |
| `sdk/src/query/pipeline.test.ts` (extended) | test | unit | Self | exact (self-extend) |

---

## Pattern Assignments

### `adapters/types.ts` (interface extension)

**Analog:** Self — lines 27-67 (existing `StorageAdapter` interface shape)

**Current `putNamedDoc`/`getNamedDoc` signature** (lines 59-60, will be replaced with discriminated overloads):
```typescript
putNamedDoc(category: string, key: string, body: string): Promise<void>;
getNamedDoc(category: string, key: string): Promise<string | null>;
```

**Companion type-guard pattern to copy** (lines 100-102) — new `NamedDocCategory`/`RootNamedDocKey` exports will live near these:
```typescript
export function hasNamedDoc(a: StorageAdapter): a is StorageAdapter & { capabilities: Capabilities & { namedDoc: true } } {
  return a.capabilities.namedDoc;
}
```

**Discriminated overload target shape** (new, per D-13/D-14):
```typescript
export type NamedDocCategory =
  | 'research' | 'intel' | 'codebase' | 'archived-milestone'
  | 'reports' | 'sketches' | 'tmp' | 'root';

export type RootNamedDocKey = 'HANDOFF' | 'CONTINUE-HERE' | 'DECISIONS-INDEX';

// In StorageAdapter interface: replace single-line signatures with:
putNamedDoc(category: 'root', key: RootNamedDocKey, body: string): Promise<void>;
putNamedDoc(category: Exclude<NamedDocCategory, 'root'>, key: string, body: string): Promise<void>;
getNamedDoc(category: 'root', key: RootNamedDocKey): Promise<string | null>;
getNamedDoc(category: Exclude<NamedDocCategory, 'root'>, key: string): Promise<string | null>;
```

No new import sites; exports added alongside the existing `RecordRef`/`SectionMode` types.

---

### `adapters/markdown/index.ts` (largest Phase-5 diff)

**Analog:** Self — multiple sub-patterns reused; Phase 3 `withTransaction` + `acquireAdapterLock` is the prime starting skeleton.

#### Sub-pattern A: `withTransaction` upgrade (shadow-dir journal)

**Current impl** (lines 321-329, lock-only):
```typescript
async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const lockPath = join(this.planningBase, '.adapter.lock');
  await this.acquireAdapterLock(lockPath);
  try {
    return await fn();
  } finally {
    await this.releaseAdapterLock(lockPath);
  }
}
```

**Target pattern** (per RESEARCH Pattern 1, D-01/D-04/D-05):
- Add instance field `private activeTxn: TxnCtx | undefined;` (near `lockSet` at line 103).
- Extend signature `withTransaction<T>(fn, opts?: { dryRun?: boolean })`.
- Reentrant guard: `if (this.activeTxn) { existing.depth++; try { return await fn(); } finally { existing.depth--; } }`.
- Create tmpdir via `mkdtemp(join(this.planningBase, '.tmp-txn-'))` (same-mount — see Pitfall 1).
- Track `touchedPaths: Set<string>` and `removedPaths: Set<string>`.
- Commit on success + `!dryRun`: `rename(tmpdir/relPath, real/relPath)` per touched path, sorted parent-first.
- Rollback (always) on dryRun OR error: `rm -rf tmpdir`.
- Clear `this.activeTxn` and release lock in `finally`.

#### Sub-pattern B: Reentrant-lock guard (~10 LOC addition)

**Current `acquireAdapterLock` skeleton to extend** (lines 331-361):
```typescript
private async acquireAdapterLock(lockPath: string): Promise<void> {
  const maxRetries = 10;
  const retryDelay = 200;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const fd = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
      await fd.writeFile(String(process.pid));
      await fd.close();
      this.lockSet.add(lockPath);
      return;
    } catch (err: unknown) {
      /* stale-lock detection, retry, force-break on last retry */
    }
  }
}
```

**Target addition** — prepend BEFORE the `for` loop (per D-10, RESEARCH Pattern 4):
```typescript
// D-10: reentrant guard — in-memory check BEFORE filesystem lock
if (this.activeTxn) return;  // same adapter instance, same process — join outer txn
```

The force-break branch at line 349 stays untouched (it handles cross-process stale-lock recovery, not reentrancy).

#### Sub-pattern C: Shadow-dir write/read resolvers

Every mutating adapter method (`putRecord`, `removeRecord`, `updateSection`, `updateFrontmatter`, `mergeFrontmatter`, `putNamedDoc`, `writeBinaryAsset`) gains a `resolveWrite(relPath)` call in place of direct `this.resolve(relPath)`. Reads (`getRecord`, `listCollection`, `stat`, `exists`, `getSection`, `getFrontmatter`, `getNamedDoc`) gain `resolveRead(relPath)`.

**Current `putRecord`** (lines 139-143, trivial frame to extend):
```typescript
async putRecord(path: string, body: string): Promise<void> {
  const abs = this.resolve(path);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, body, 'utf-8');
}
```

**Target frame** (with txn-aware resolver):
```typescript
async putRecord(path: string, body: string): Promise<void> {
  const abs = this.resolveWrite(path);   // tmpdir path when activeTxn, real path otherwise
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, body, 'utf-8');
}
```

Same mechanical change on each mutating method. Removal-specific branch (`removeRecord`) records a delete in `activeTxn.removedPaths` when in-txn instead of unlinking the real path.

#### Sub-pattern D: Heading-depth walker rewrite

**Current `extractSection`** (lines 785-816, line-scan for L2 only) — skeleton kept; termination condition changes:
```typescript
function extractSection(text: string, anchor: string): { found: boolean; body: string | null } {
  const anchorRe = new RegExp('^##[ \\t]+' + escapeRegExp(anchor) + '[ \\t]*$');
  const nextH2Re = /^##[ \t]/;
  const lines = text.split('\n');
  let inSection = false;
  const bodyLines: string[] = [];
  for (const line of lines) { /* ... */ }
  ...
}
```

**Target walker** (per RESEARCH Pattern 2, D-06/D-08):
- Parse anchor as `{depth, text}` from full heading marker (`"### Evidence"` → depth=3, text="Evidence"); throw on non-ATX.
- Track `inFence` toggled by `/^[ ]{0,3}```/` matches.
- Track `inComment` entered on `<!--` without closing `-->`, exited on `-->`.
- Skip heading detection when `inFence || inComment`.
- Terminate at next heading where `match[1].length <= depth`.
- `replaceSection` follows identical structure (parse depth, find anchor, replace body up to same-or-shallower terminator).
- Setext detection (`^=+$` or `^-+$` after non-blank): `console.warn`, do NOT throw (OQ-4).

Keep line-walker frame; keep `escapeRegExp` helper at line 776.

#### Sub-pattern E: `putNamedDoc`/`getNamedDoc` implementation

**Current stubs to replace** (lines 758-771):
```typescript
async putNamedDoc(_category: string, _key: string, _body: string): Promise<void> {
  throw new UnsupportedCapabilityError('namedDoc', this.name);
}
async getNamedDoc(_category: string, _key: string): Promise<string | null> {
  throw new UnsupportedCapabilityError('namedDoc', this.name);
}
```

**Target impl** (per D-12/D-14):
```typescript
async putNamedDoc(category: NamedDocCategory, key: string, body: string): Promise<void> {
  const path = category === 'root' ? `${key}.md` : `${category}/${key}.md`;
  await this.putRecord(path, body);   // inherits shadow-dir redirection via resolveWrite
}
async getNamedDoc(category: NamedDocCategory, key: string): Promise<string | null> {
  const path = category === 'root' ? `${key}.md` : `${category}/${key}.md`;
  return this.getRecord(path);
}
```

Signature in the class uses `NamedDocCategory` widened body; overload declarations live on the `StorageAdapter` interface (TypeScript compat: interface overloads + widened impl body).

**Workstream handling (OQ-A3 resolution — planner locks):** recommended add optional `opts?: { workstream?: string }` param; compute path as `workstream ? workstreams/${workstream}/${cat-or-root-path}` to preserve Phase-4 workstream semantics.

#### Sub-pattern F: `writeBinaryAsset` (D-17)

**Current stub** (lines 308-310):
```typescript
async writeBinaryAsset(_path: string, _bytes: Uint8Array): Promise<void> {
  throw new UnsupportedCapabilityError('binaryAsset', this.name);
}
```

**Target impl** (analogous to `putRecord` lines 139-143 but accepts `Uint8Array`):
```typescript
async writeBinaryAsset(path: string, bytes: Uint8Array): Promise<void> {
  const abs = this.resolveWrite(path);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, Buffer.from(bytes));   // no 'utf-8' — raw bytes
}
```

Flip `capabilities.binaryAsset: true` (line 89) in the SAME commit that lifts the stub (Pitfall 5).

#### Sub-pattern G: `snapshot`/`restore` (D-03)

**Current stubs** (lines 312-319):
```typescript
async snapshot(): Promise<string> { throw new UnsupportedCapabilityError('snapshot', this.name); }
async restore(_snapshotId: string): Promise<void> { throw new UnsupportedCapabilityError('snapshot', this.name); }
```

**Target impl** — snapshot captures current tmpdir location (or opens a fresh snapshot tmpdir outside the active txn); restore `rm -rf`'s then re-renames. Internal primary consumer is `withTransaction` rollback; public contract returns opaque id. Flip `capabilities.snapshot: true` same commit.

#### Sub-pattern H: `updateSection` internal `withTransaction` wrap (D-09)

**Current `updateSection`** (lines 200-241, NO explicit txn wrap):
```typescript
async updateSection(path: string, anchor: string, body: string, mode: SectionMode): Promise<void> {
  const current = (await this.getRecord(path)) ?? '';
  /* ... compute next ... */
  await this.putRecord(path, next);
}
```

**Target frame** (per D-09):
```typescript
async updateSection(path: string, anchor: string, body: string, mode: SectionMode): Promise<void> {
  await this.withTransaction(async () => {
    const current = (await this.getRecord(path)) ?? '';
    /* ... compute next via new heading-depth walker ... */
    await this.putRecord(path, next);
  });
}
```

Reentrant-safe because `withTransaction` now joins an active outer txn (D-10). `recordStateAppend/Mutation` (lines 385-500) already wrap `withTransaction` and call `updateSection`-adjacent helpers internally — they continue to work unmodified because nested calls join the outer txn.

#### Sub-pattern I: `commitPlanningState` dryRun no-op (D-05)

**Current impl** (lines 286-303, always executes git):
```typescript
async commitPlanningState(message: string, files?: string[]): Promise<void> {
  const { execFileSync } = await import('node:child_process');
  const targets = files && files.length > 0 ? files : ['.planning'];
  try {
    execFileSync('git', ['add', ...targets], { cwd: this.projectDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', message], { cwd: this.projectDir, stdio: 'pipe' });
  } catch (err) { throw new Error(`commitPlanningState failed: ${(err as Error).message}`); }
}
```

**Target addition** — prepend at top of method (per D-05, Pitfall 4):
```typescript
if (this.activeTxn?.dryRun) return;   // D-05: no-op inside dryRun txn
```

---

### `sdk/src/query/pipeline.ts` (dry-run hoist)

**Analog:** Self — lines 180-230 (dry-run `mkdtemp`/`copyPlanningTree`/`readPlanningState` branch).

**Imports pattern to preserve** (lines 23-28):
```typescript
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { tmpdir } from 'node:os';
```

**Dry-run branch current shape** (lines 192-230) — to be replaced wholesale:
```typescript
if (dryRun && isMutation) {
  let tempDir: string | null = null;
  try {
    tempDir = await mkdtemp(join(tmpdir(), 'gsd-dryrun-'));
    const beforeState = await readPlanningState(projectDir);
    await copyPlanningTree(projectDir, tempDir);
    await original(args, tempDir);
    const afterState = await readPlanningState(tempDir);
    const diff = diffPlanningState(beforeState, afterState);
    const changedFiles = Object.keys(diff);
    result = { data: { dry_run: true, command: cmd, args, diff, changes_summary: /* ... */ } };
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
```

**Target frame** (per D-02):
```typescript
if (dryRun && isMutation) {
  const { adapterFor } = await import('./helpers.js');
  const adapter = await adapterFor(projectDir);
  let diff: Record<string, { before: string | null; after: string | null }> = {};
  await adapter.withTransaction(async () => {
    // Capture before-state snapshot of paths the handler is about to touch.
    // Use pipeline-internal __getTxnContext() (underscore-prefixed escape hatch per OQ-1)
    // to read touchedPaths AFTER fn(); before-read happens pre-fn against real fs.
    await original(args, projectDir);   // writes route into shadow via adapter
    // After fn: read shadow-dir touched paths and compare to real-dir contents
    // diff = await computeDiff(adapter);   // helper in pipeline.ts
  }, { dryRun: true });
  result = { data: { dry_run: true, command: cmd, args, diff, changes_summary: /* ... */ } };
}
```

**Removal targets** (safe to delete after migration): `collectFiles` (lines 55-69), `copyPlanningTree` (lines 75-92), `readPlanningState` (lines 98-122). Keep `diffPlanningState` (lines 127-141) — still used to format diff output from touched paths.

**Keep Phase-4 zero-leak compliance:** never use `node:fs` against `.planning/` in pipeline.ts — all reads flow through `adapter.*`.

---

### `sdk/src/query/named-docs.ts` (handler migration — 5 handlers, D-12)

**Analog:** Self — this file IS the canonical Phase-4 per-category handler pattern; siblings `codebase-docs.ts`, `tmp-docs.ts` follow identical shape.

**Current `reportPut`** (lines 35-49) — canonical "before" pattern:
```typescript
export async function reportPut(
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [name, ...bodyParts] = args;
  validateName(name);
  const adapter = await adapterFor(projectDir);
  const body = bodyParts.join(' ');
  const docPath = planningRelativePath(workstream ?? null, `reports/${name}.md`);
  await adapter.putRecord(docPath, body);
  return { data: { written: docPath, name } };
}
```

**Target `reportPut`** (per D-12):
```typescript
export async function reportPut(args, projectDir, workstream): Promise<QueryResult> {
  const [name, ...bodyParts] = args;
  validateName(name);
  const adapter = await adapterFor(projectDir);
  const body = bodyParts.join(' ');
  // Delegate path computation to adapter primitive (D-12)
  await adapter.putNamedDoc('reports', name, body, { workstream: workstream ?? undefined });
  return { data: { written: /* compute from adapter or keep helper */, name } };
}
```

**`handoffPut` / `continueHerePut` / `decisionsIndexGet`** (lines 85-96, 106-117, 150-171) — all use `category: 'root'` with fixed-key discriminator:
- `handoffPut`: `adapter.putNamedDoc('root', 'HANDOFF', body, { workstream })`
- `continueHerePut`: `adapter.putNamedDoc('root', 'CONTINUE-HERE', body, { workstream })`
- `decisionsIndexGet`: first `adapter.getNamedDoc('root', 'DECISIONS-INDEX', { workstream })`; fallback `adapter.getNamedDoc('root', 'DECISIONS' as any /* or widen */)`. The fallback is a workflow concern kept in the handler — adapter primitive stays thin.

**`forensicsPut`** (lines 127-140) — timestamp stays in SDK layer:
```typescript
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const fileName = `FORENSICS-${timestamp}`;
await adapter.putNamedDoc('reports', fileName, body, { workstream });
```

**`validateName`** (lines 15-25) — preserve as-is:
```typescript
function validateName(name: string): void {
  if (!name) throw new GSDError('name argument required', ErrorClassification.Validation);
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new GSDError('name must not contain path separators or ".."', ErrorClassification.Validation);
  }
}
```

---

### `sdk/src/query/codebase-docs.ts` (3 handlers, D-12)

**Analog:** Self — handler pattern identical to `named-docs.ts`.

**Current `codebasePut`** (lines 35-49):
```typescript
export async function codebasePut(args, projectDir, workstream): Promise<QueryResult> {
  const [name, ...bodyParts] = args;
  validateName(name);
  const adapter = await adapterFor(projectDir);
  const body = bodyParts.join(' ');
  const docPath = planningRelativePath(workstream ?? null, `codebase/${name}.md`);
  await adapter.putRecord(docPath, body);
  return { data: { written: docPath, name } };
}
```

**Target**:
```typescript
await adapter.putNamedDoc('codebase', name, body, { workstream });
```

`codebaseGet` (lines 59-75) mirrors; `codebaseList` (lines 85-96) keeps `adapter.listCollection(prefix)` — no `getNamedDoc` list primitive in Phase 5 scope.

---

### `sdk/src/query/tmp-docs.ts` (2 handlers, D-12)

**Analog:** Self — relaxed `validateName` allows subdirs (lines 14-32), preserved verbatim.

**Current `tmpPut`** (lines 42-56):
```typescript
const docPath = planningRelativePath(workstream ?? null, `tmp/${name}`);
await adapter.putRecord(docPath, body);
```

**Target**:
```typescript
await adapter.putNamedDoc('tmp', name, body, { workstream });
```

Note: `tmp` category `key` accepts arbitrary strings including `subdir/file.md` — the union definition typed via `Exclude<NamedDocCategory, 'root'>` permits this (D-14 only constrains `'root'` keys).

---

### `sdk/src/query/route-next-action.ts` (1 line migration, D-21)

**Analog:** Self — `readConsecutiveCallCount` at lines 40-47 is the single migration site.

**Current** (line 44):
```typescript
const raw = await adapter.getRecord(planningRelativePath(workstream, '.next-call-count'));
```

**Target** (per D-21):
```typescript
import { nextCallCountGet } from './sidecar.js';
// ...
const count = await nextCallCountGet(adapter, workstream);
return count;   // helper returns number directly
```

The `readConsecutiveCallCount` wrapper may be removed entirely (the new `nextCallCountGet` SDK helper subsumes it).

---

### `sdk/src/query/sidecar.ts` (NEW — D-19, D-21)

**Analog (structural shape):** `named-docs.ts` lines 1-49 (top-of-file docblock + `validateName` + exported handler functions).
**Analog (adapter-first signature):** `route-next-action.ts` lines 40-47 (`readConsecutiveCallCount(adapter: StorageAdapter, workstream?: string): Promise<number>`).

**File frame to copy (from `named-docs.ts:1-11` + `route-next-action.ts:40-47`):**
```typescript
/**
 * Sidecar document query handlers — adapter-mediated CRUD for .planning/ sidecars
 * (.next-call-count, etc.).
 *
 * Per D-19: SDK-typed verbs; adapter stays Bin A (no new adapter methods).
 * Sidecar paths centralized here; callers MUST NOT use raw adapter.getRecord('.next-call-count').
 */

import { adapterFor, planningRelativePath } from './helpers.js';
import type { QueryResult } from './utils.js';
import type { StorageAdapter } from '../../../adapters/types.js';

// ─── Path constants (single source of truth) ──────────────────────────────

const NEXT_CALL_COUNT = '.next-call-count';

// ─── nextCallCountGet ──────────────────────────────────────────────────────

/**
 * Read the consecutive-call counter used by /gsd-next routing.
 *
 * @returns The count (0 if file missing or unparseable).
 */
export async function nextCallCountGet(
  adapter: StorageAdapter,
  workstream?: string,
): Promise<number> {
  const raw = await adapter.getRecord(planningRelativePath(workstream, NEXT_CALL_COUNT));
  if (raw === null) return 0;
  return parseInt(raw.trim(), 10) || 0;
}

// ─── nextCallCountIncr ─────────────────────────────────────────────────────

export async function nextCallCountIncr(
  adapter: StorageAdapter,
  workstream?: string,
): Promise<number> {
  const current = await nextCallCountGet(adapter, workstream);
  const next = current + 1;
  await adapter.putRecord(planningRelativePath(workstream, NEXT_CALL_COUNT), String(next));
  return next;
}

// ─── Registry-shaped handlers (for SDK verb wiring in index.ts) ────────────

export async function nextCallCountGetHandler(
  _args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const adapter = await adapterFor(projectDir);
  const count = await nextCallCountGet(adapter, workstream);
  return { data: { count } };
}

export async function nextCallCountIncrHandler(
  _args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const adapter = await adapterFor(projectDir);
  const count = await nextCallCountIncr(adapter, workstream);
  return { data: { count } };
}
```

**Registration in `index.ts`** (mirrors line 729 pattern):
```typescript
import { nextCallCountGetHandler, nextCallCountIncrHandler } from './sidecar.js';
// ...
registry.register('next-call-count.get', (args, projectDir, ws) => nextCallCountGetHandler(args, projectDir, ws));
registry.register('next-call-count.incr', (args, projectDir, ws) => nextCallCountIncrHandler(args, projectDir, ws));
```

---

### `sdk/src/query/scratch.ts` (NEW — D-20)

**Analog (structural shape):** `named-docs.ts` reportPut/Get pairs (lines 35-75).
**Analog (validation style):** `tmp-docs.ts` (lines 14-32, relaxed — allows single-slash subdir like `tmp/subdir/file`) — scratch similarly supports phase-scoped paths.

**File frame:**
```typescript
/**
 * Scratch artifact query handlers — adapter-mediated CRUD for DISCUSS-CHECKPOINT
 * and QUESTIONS artifacts per D-20.
 *
 * Scratch artifacts live at .planning/phases/NN-*/ alongside canonical phase
 * artifacts (NOT under .planning/tmp/). Lifecycle is workflow-layer concern;
 * adapter only needs getRecord/putRecord/removeRecord.
 */

import { GSDError, ErrorClassification } from '../errors.js';
import { adapterFor, planningRelativePath } from './helpers.js';
import type { QueryResult } from './utils.js';

function validatePhaseDir(phaseDir: string): void {
  if (!phaseDir) throw new GSDError('phaseDir argument required', ErrorClassification.Validation);
  if (phaseDir.includes('..') || phaseDir.startsWith('/')) {
    throw new GSDError('phaseDir must not contain ".." or be absolute', ErrorClassification.Validation);
  }
}

// ─── discuss.checkpoint.put/get/delete ─────────────────────────────────────

export async function discussCheckpointPut(args, projectDir, workstream): Promise<QueryResult> {
  const [phaseDir, phaseNum, ...bodyParts] = args;
  validatePhaseDir(phaseDir);
  const adapter = await adapterFor(projectDir);
  const body = bodyParts.join(' ');
  const docPath = planningRelativePath(
    workstream ?? null,
    `phases/${phaseDir}/${phaseNum}-DISCUSS-CHECKPOINT.json`,
  );
  await adapter.putRecord(docPath, body);
  return { data: { written: docPath } };
}

export async function discussCheckpointGet(args, projectDir, workstream): Promise<QueryResult> {
  const [phaseDir, phaseNum] = args;
  validatePhaseDir(phaseDir);
  const adapter = await adapterFor(projectDir);
  const docPath = planningRelativePath(
    workstream ?? null,
    `phases/${phaseDir}/${phaseNum}-DISCUSS-CHECKPOINT.json`,
  );
  const content = await adapter.getRecord(docPath);
  if (content === null) return { data: { found: false, content: null } };
  return { data: { found: true, content } };
}

export async function discussCheckpointDelete(args, projectDir, workstream): Promise<QueryResult> {
  const [phaseDir, phaseNum] = args;
  validatePhaseDir(phaseDir);
  const adapter = await adapterFor(projectDir);
  const docPath = planningRelativePath(
    workstream ?? null,
    `phases/${phaseDir}/${phaseNum}-DISCUSS-CHECKPOINT.json`,
  );
  await adapter.removeRecord(docPath);
  return { data: { removed: docPath } };
}

// ─── discuss.questions.put/get/delete ──────────────────────────────────────
// Same shape as checkpoint but with filename stem `QUESTIONS.{json,html}`.
// Format parameter discriminates extension.
```

**Registration** (mirrors line 729 pattern, 6 verbs):
```typescript
registry.register('discuss.checkpoint.put', (args, projectDir, ws) => discussCheckpointPut(args, projectDir, ws));
registry.register('discuss.checkpoint.get', (args, projectDir, ws) => discussCheckpointGet(args, projectDir, ws));
registry.register('discuss.checkpoint.delete', (args, projectDir, ws) => discussCheckpointDelete(args, projectDir, ws));
// ... questions trio
```

---

### `tests/conformance/section-depth.test.ts` (NEW)

**Analog (harness/setup):** `tests/conformance/write-transaction.test.ts` lines 1-27 (describe + beforeEach/afterEach + `mkdtemp`/`mkdir`/`rm`).
**Analog (seeded-fixture pattern):** `tests/conformance/write-events.test.ts` lines 30-53 (putRecord seeded markdown with known sections, then adapter call, then expect substring).

**Imports pattern to copy** (`write-transaction.test.ts:7-13`):
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../adapters/types.js';
```

**beforeEach/afterEach pattern** (`write-transaction.test.ts:17-26`):
```typescript
let tmpDir: string;
let adapter: StorageAdapter;
beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-section-depth-'));
  await mkdir(join(tmpDir, '.planning'), { recursive: true });
  adapter = new MarkdownAdapter(tmpDir);
});
afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });
```

**Test cases to implement** (per PRIMITIVES-01/02, SC#2):
- L2 anchor `"## Foo"` extracts/replaces L2 body (regression from current impl).
- L3 anchor `"### Evidence"` under `## Investigation` extracts only the subsection; terminates at next L3 or L2.
- L4 anchor `"#### Sub-point"` under `### Evidence` terminates at next L4/L3/L2.
- Document-order first-match (D-07): two `### Evidence` under different L2 parents — `getSection("### Evidence")` returns the first.
- Fenced-code-block skip (D-08): section body containing `` ```markdown\n## Not a heading\n``` `` is NOT split.
- HTML-comment skip: `<!-- ## Not a heading -->` does not split.
- Setext detected → `console.warn` spy asserted, no throw.
- Three-author concurrency (SC#2): three concurrent `updateSection` calls on same file with different anchors — all complete, no interleaving, final content contains all three bodies.

---

### `tests/conformance/named-doc.test.ts` (NEW)

**Analog:** `tests/conformance/write-transaction.test.ts` (harness) + `tests/conformance/adapter.conformance.ts` lines 44-55 (round-trip shape).

**Round-trip skeleton to copy** (`adapter.conformance.ts:44-54`):
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

**Target cases** (8 categories + root literal-key assertions per PRIMITIVES-04):
- All 8 `NamedDocCategory` values round-trip: for each, `putNamedDoc(cat, 'foo', body)` then `getNamedDoc(cat, 'foo')` returns `body`.
- `'root'` category: `putNamedDoc('root', 'HANDOFF', body)` writes to `.planning/HANDOFF.md` (verifiable via `adapter.exists('HANDOFF.md')`).
- `@ts-expect-error` assertion: `adapter.putNamedDoc('root', 'ARBITRARY_STRING', 'body')` rejected at compile — `tsc --noEmit` on test file fails without the comment.
- Missing doc returns null: `getNamedDoc('research', 'nonexistent')` → `null`.
- Capability flag: `expect(adapter.capabilities.namedDoc).toBe(true)`.
- D-15 grep gate (describe block runs `execFileSync('grep', ...)`): `! grep -rn "getResearch\|putIntelDoc\|putCodebaseDoc\|getArchivedMilestoneDoc" sdk/src/ adapters/` returns empty.

---

### `tests/conformance/binary-asset.test.ts` (NEW)

**Analog:** `tests/conformance/write-transaction.test.ts` (harness) + `tests/conformance/commit-planning-state.test.ts` (monkeypatch/mock pattern for capability-gated flow).

**Cases** (per PRIMITIVES-05, SC#4):
- `writeBinaryAsset('foo.png', bytes)` writes bytes verbatim — readback via `readFile(join(tmpDir, '.planning/foo.png'))` equals `Buffer.from(bytes)`.
- `expect(adapter.capabilities.binaryAsset).toBe(true)`.
- Graceful-degradation (D-18) — monkeypatch `capabilities.binaryAsset` to `false`, invoke workflow path, assert it warns but does not throw.
- Path-traversal negative test (Pitfall 6): `writeBinaryAsset('../outside.png', bytes)` either (a) rejects at adapter level if validation added OR (b) documented as raw-primitive (matching `putRecord` behavior) — locked by plan.

---

### `sdk/src/query/sidecar.test.ts` (NEW)

**Analog:** `sdk/src/query/pipeline.test.ts` lines 1-26 (tmpDir setup + handler unit tests).

**Imports + setup** (from `pipeline.test.ts:8-26`):
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { nextCallCountGet, nextCallCountIncr } from './sidecar.js';
import { MarkdownAdapter } from '../../../adapters/markdown/index.js';

let tmpDir: string;
beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-sidecar-'));
  await mkdir(join(tmpDir, '.planning'), { recursive: true });
});
afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });
```

**Cases:** `nextCallCountGet` returns 0 when file missing; `nextCallCountIncr` increments from 0 → 1 → 2; route-next-action uses helper (grep assertion).

---

### `sdk/src/query/scratch.test.ts` (NEW)

**Analog:** `sdk/src/query/pipeline.test.ts` (same harness as sidecar.test.ts).

**Cases:** `discuss.checkpoint.put/get/delete` round-trip at `phases/05-foo/05-DISCUSS-CHECKPOINT.json`; `discuss.questions.*` same shape with `.json` and `.html` format variants; delete on nonexistent is no-op.

---

### `tests/conformance/write-transaction.test.ts` (extended)

**Analog:** Self — existing structure (lines 1-111) is the canonical harness. New tests appended.

**Existing pattern to extend** (lines 89-110, concurrent-transactions serialization):
```typescript
it('concurrent transactions serialize (second waits for first)', async () => {
  await adapter.putRecord('counter.md', '0');
  const txn1 = adapter.withTransaction(async () => { /* ... */ });
  const txn2 = adapter.withTransaction(async () => { /* ... */ });
  await Promise.all([txn1, txn2]);
  const final = await adapter.getRecord('counter.md');
  expect(final).toBe('2');
});
```

**New cases to append** (per PRIMITIVES-03/06, SC#1):
- `dryRun: true` rolls back all writes: writes inside txn, after rollback `getRecord` returns pre-txn state.
- Mid-txn failure byte-identical (SC#1 gate): use `hashDir` helper from RESEARCH code example lines 913-927; seed STATE.md + PROJECT.md, throw mid-txn, assert hash equal.
- Reentrancy: `withTransaction` inside another `withTransaction` joins outer, no deadlock, no double-lock.
- Nested `dryRun` inherits flag: outer `{dryRun:true}`, inner no opts — assert inner behaves as dryRun.
- `snapshot()`/`restore(id)` round-trip: snapshot, mutate, restore → state equals snapshot.
- `updateSection` concurrency (PRIMITIVES-06): three concurrent `updateSection` calls serialize and all succeed.
- Shadow-dir cleanup: after txn, `.planning/.tmp-txn-*` entries removed.
- `commitPlanningState` inside dryRun: no git commit produced (Pitfall 4).

---

### `sdk/src/query/pipeline.test.ts` (extended)

**Analog:** Self — existing cases (lines 44-80+) test prepare/finalize/passthrough/dry-run.

**Existing dry-run case to extend** (lines 65-80):
```typescript
it('dry-run mutation returns diff without writing to disk', async () => {
  const registry = makeRegistry();
  wrapWithPipeline(registry, MUTATION_SET, { dryRun: true });
  const result = await registry.dispatch('mut-cmd', [], tmpDir);
  // ...
});
```

**New cases**:
- Dry-run uses `adapter.withTransaction({dryRun:true})` not `cp -r` (verify no `gsd-dryrun-*` entries in `os.tmpdir()`; presence of `.planning/.tmp-txn-*` during execution, none after).
- Mid-txn-failure byte-identical (SC#1): hash `.planning/` pre+post, throw mid-mutation, equal.

---

## Shared Patterns

### Pattern S-1: Adapter-first helper signature (Phase 2 D-10)

**Source:** `sdk/src/query/route-next-action.ts` lines 40-47 (`readConsecutiveCallCount(adapter: StorageAdapter, workstream?: string)`).

**Apply to:** All new helpers in `sidecar.ts` and `scratch.ts` when internal (non-registry-facing). Registry-facing handlers keep `(args, projectDir, workstream?)` shape and call `adapterFor(projectDir)` inside.

```typescript
export async function nextCallCountGet(
  adapter: StorageAdapter,
  workstream?: string,
): Promise<number> { /* ... */ }
```

### Pattern S-2: `adapterFor(projectDir)` construction inside handlers (Phase 2 D-12)

**Source:** `sdk/src/query/helpers.ts` lines 490-493 + consumer pattern in `named-docs.ts:43`.

**Apply to:** Every new registry-facing handler in `sidecar.ts` / `scratch.ts`.

```typescript
const adapter = await adapterFor(projectDir);
```

### Pattern S-3: Validation via `validateName` + `GSDError` (Phase 4 T-04-01)

**Source:** `sdk/src/query/named-docs.ts` lines 15-25; relaxed variant `tmp-docs.ts:14-32`.

**Apply to:** `scratch.ts` (via `validatePhaseDir`). Preserve exact error messages and `ErrorClassification.Validation`.

### Pattern S-4: Zero-leak invariant (Phase 4 D-09/D-10)

**Source:** Project-wide rule — only `adapters/markdown/` may touch `.planning/` via `node:fs`.

**Apply to:** `pipeline.ts` refactor — remove `collectFiles`, `copyPlanningTree`, `readPlanningState` (all use `node:fs` against `.planning/`); route everything through `adapter.*`. Shadow-dir tmpdir at `.planning/.tmp-txn/<uuid>/` is written by `adapters/markdown/` only — no SDK-layer `fs` writes there.

### Pattern S-5: Capability flag flip in same commit as stub lift (Pitfall 5)

**Source:** RESEARCH §Common Pitfalls Pitfall 5.

**Apply to:**
- `capabilities.namedDoc: true` (line 92) committed WITH `putNamedDoc`/`getNamedDoc` bodies replacing throws (lines 758-771).
- `capabilities.binaryAsset: true` (line 89) WITH `writeBinaryAsset` body (line 308-310).
- `capabilities.snapshot: true` (line 90) WITH `snapshot`/`restore` bodies (lines 312-319).

### Pattern S-6: Conformance-test harness (Phase 2 D-15)

**Source:** `tests/conformance/write-transaction.test.ts` lines 7-27; also `tests/conformance/adapter.conformance.ts` lines 24-42.

**Apply to:** `section-depth.test.ts`, `named-doc.test.ts`, `binary-asset.test.ts`. Uniform beforeEach creating `tmpDir` + `.planning/` + `new MarkdownAdapter(tmpDir)`; uniform afterEach `rm -rf tmpDir`.

### Pattern S-7: Error handling — let adapter errors propagate

**Source:** `adapters/markdown/index.ts` lines 129-137 (`getRecord` ENOENT returns null; other errors re-thrown).

**Apply to:** `putNamedDoc`/`getNamedDoc` — return `null` on miss (matches `getRecord`); throw on any other error. `writeBinaryAsset` throws on any error (matches `putRecord`).

### Pattern S-8: SDK verb registration in `index.ts`

**Source:** `sdk/src/query/index.ts` lines 725-731 + 754-755 (existing category-handler registrations).

**Apply to:** `sidecar.ts` + `scratch.ts` — add lines near line 755 following the same arrow-closure wrapping pattern:
```typescript
registry.register('next-call-count.get', (args, projectDir, ws) => nextCallCountGetHandler(args, projectDir, ws));
registry.register('discuss.checkpoint.put', (args, projectDir, ws) => discussCheckpointPut(args, projectDir, ws));
// etc.
```

---

## No Analog Found

None. Every new file has a close structural analog in the Phase 2/3/4 codebase. The only genuinely new mechanism is the shadow-dir journal (no prior art in this repo), but RESEARCH Pattern 1 provides the concrete design and the existing `acquireAdapterLock`/`releaseAdapterLock` (lines 331-375) is the skeleton the new `activeTxn`-tracked version extends.

---

## Metadata

**Analog search scope:**
- `/Volumes/code/get-shit-done/adapters/` (types.ts, markdown/index.ts)
- `/Volumes/code/get-shit-done/sdk/src/query/` (pipeline.ts, named-docs.ts, codebase-docs.ts, tmp-docs.ts, route-next-action.ts, helpers.ts, index.ts, pipeline.test.ts)
- `/Volumes/code/get-shit-done/tests/conformance/` (adapter.conformance.ts, write-transaction.test.ts, write-events.test.ts, list via `ls`)

**Files scanned:** 14 source files + 6 test files = 20

**Pattern extraction date:** 2026-05-10
