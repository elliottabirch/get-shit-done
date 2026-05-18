# Phase 2: Make the Seam Real — Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 13 new/modified files (plus 29 handler migration files using shared pattern)
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `adapters/types.ts` | interface | N/A | `adapters/types.ts` (current) | self — additive extension |
| `adapters/markdown/index.ts` | adapter impl | CRUD | `adapters/markdown/index.ts` (current snapshot/restore block) | self — additive + deletion |
| `sdk/src/query/helpers.ts` | utility | N/A | `sdk/src/query/helpers.ts` (current adapterFor block) | self — deletion only |
| `sdk/src/query/pipeline.ts` | middleware | request-response | `sdk/src/query/pipeline.ts` (current wrapWithPipeline) | self — dry-run block rewrite |
| `sdk/src/query/index.ts` | registry | request-response | `sdk/src/query/index.ts` lines 299-481 (existing closure wrappers) | exact |
| `sdk/src/query/state-mutation.ts` | handler (write) | CRUD | `sdk/src/query/state.ts` (stateJson, stateGet — migrated) | exact (role-match migrated) |
| `sdk/src/query/phase-lifecycle.ts` | handler (mixed) | CRUD | `sdk/src/query/state.ts` (stateJson pattern) | role-match |
| 27 remaining handler files (spike-sketch.ts, scratch.ts, named-docs.ts, workstream.ts, etc.) | handler (mixed) | CRUD / request-response | `sdk/src/query/workstream.ts` (pre-migration shape); `sdk/src/query/state-project-load.ts` (post-migration shape) | exact migration pair |
| `tests/conformance/manifest-types.ts` | type definition | N/A | `tests/conformance/manifest-types.ts` (current) | self — additive |
| `tests/conformance/manifest.ts` | test manifest | N/A | `tests/conformance/manifest.ts` lines 25-74 (existing entries) | exact |
| `tests/conformance/paired-seam-markdown.test.ts` | test (new) | request-response | `tests/conformance/paired-outcome-markdown.test.ts` | exact |
| `tests/conformance/paired-seam-beads.test.ts` | test (new) | request-response | `tests/conformance/paired-outcome-beads.test.ts` | exact |
| `~/code/gsd-beads/src/index.ts` (BeadsAdapter) | adapter impl | CRUD | `adapters/markdown/index.ts` getTouchedPaths block | partial match (cross-repo) |

---

## Pattern Assignments

### `adapters/types.ts` — add `getTouchedPaths(): Set<string>`

**Analog:** `adapters/types.ts` itself (the existing interface block, lines 122-127 — the `recordState*` method group)

**Placement pattern** (lines 122-127 — where to insert the new method, after `recordStateSignal`):
```typescript
// Event families (D-01/D-04): grouped by mutation semantics.
recordStateAppend(event: AppendEvent): Promise<StateWriteOutcome>;
recordStateMutation(event: MutationEvent): Promise<StateWriteOutcome>;
recordStateSignal(event: SignalEvent): Promise<StateWriteOutcome>;
```

**New method to insert after `recordStateSignal`** (RESEARCH.md §getTouchedPaths Interface Decisions):
```typescript
/**
 * Returns the set of relative paths that have been written (or removed)
 * during the currently-active transaction. Callable only inside a
 * withTransaction callback; returns empty set if no transaction is active.
 *
 * MarkdownAdapter: returns exact set from activeTxn.touchedPaths union
 *   activeTxn.removedPaths (same data as deleted _txnContextForPipeline).
 * BeadsAdapter: returns best-effort set of bd op kinds/args touched during
 *   the current transaction. Coarser-grained; used for non-empty assertion only.
 */
getTouchedPaths(): Set<string>;
```

**JSDoc style pattern** (lines 129-146 — `normalize()` method is the most recent addition):
```typescript
/**
 * D-13 (Phase 7, ADR D-2026-05-12-NORMALIZE):
 * ...
 * Invariant: normalize(normalize(x)) === normalize(x) (idempotent).
 */
normalize(body: string, category?: string): string;
```
New method follows same JSDoc structure: motivation reference (D-03 / RESEARCH.md), per-adapter behavior bullets, calling constraint.

---

### `adapters/markdown/index.ts` — add `getTouchedPaths()` impl; delete `_txnContextForPipeline` and `_realReadForPipeline`

**Analog:** `adapters/markdown/index.ts` lines 640-658 — the two underscore escape hatches that get deleted; their replacement is the new public method.

**Existing code to delete** (lines 641-658):
```typescript
/** Pipeline-internal escape hatch (RESEARCH OQ #1). NOT on StorageAdapter interface. */
_txnContextForPipeline(): TxnCtx | undefined {
  return this.activeTxn;
}

/**
 * Pipeline-internal: bypass shadow-dir merge, read the real file.
 * Used by dry-run to compute before-image of touched paths.
 */
async _realReadForPipeline(relPath: string): Promise<string | null> {
  const abs = this.resolve(relPath);
  try {
    return await readFile(abs, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}
```

**New `getTouchedPaths()` implementation** — replaces both underscore methods in the same commit:
```typescript
getTouchedPaths(): Set<string> {
  if (!this.activeTxn) return new Set();
  const all = new Set<string>();
  for (const p of this.activeTxn.touchedPaths) all.add(p);
  for (const p of this.activeTxn.removedPaths) all.add(p);
  return all;
}
```

**`activeTxn` field pattern** (visible from `withTransaction` at lines 523-562 — `activeTxn` is the `TxnCtx | undefined` instance field; the new method reads `this.activeTxn` identically to how `_txnContextForPipeline` did).

---

### `sdk/src/query/helpers.ts` — delete `adapterFor` and `_adapterCache`

**Analog:** `sdk/src/query/helpers.ts` lines 504-545 — the code being deleted.

**Code to delete** (lines 527-545):
```typescript
// Adapter instance cache for transaction sharing (Phase 5 Plan 05)
// Exported for test cleanup
export const _adapterCache = new Map<string, StorageAdapter>();

/**
 * @deprecated Returns MarkdownAdapter regardless of config ...
 */
export async function adapterFor(projectDir: string): Promise<StorageAdapter> {
  const cached = _adapterCache.get(projectDir);
  if (cached) return cached;

  const { MarkdownAdapter } = await import('../../../adapters/markdown/index.js');
  const instance = new MarkdownAdapter(projectDir);
  _adapterCache.set(projectDir, instance);
  return instance;
}
```

**Section comment to delete** (lines 504-506):
```typescript
// ─── adapterFor (Phase 2 transitional helper) ─────────────────────────────
```

**Import to remove from every handler file** — every file that imports `adapterFor` from helpers.ts has this pattern (e.g. `state-mutation.ts` lines 31-41):
```typescript
import {
  adapterFor,            // DELETE THIS LINE
  comparePhaseNum,
  escapeRegex,
  ...
} from './helpers.js';
```

**StorageAdapter import to add** to each handler file that doesn't already have it:
```typescript
import type { StorageAdapter } from '../../../adapters/types.js';
```
Analog: `sdk/src/query/state.ts` line 36 (already-migrated file).

---

### `sdk/src/query/pipeline.ts` — rewrite dry-run block; add `adapter` param to `wrapWithPipeline`

**Analog:** `sdk/src/query/pipeline.ts` lines 82-187 (full `wrapWithPipeline` — the part outside the dry-run block stays identical).

**Current imports** (lines 23-26 — stays unchanged except adding adapter types):
```typescript
import { join } from 'node:path';
import type { QueryResult } from './utils.js';
import type { QueryRegistry } from './registry.js';
```

**New imports to add** (after the existing imports):
```typescript
import type { StorageAdapter } from '../../../adapters/types.js';
import { hasSnapshot } from '../../../adapters/types.js';
```

**`wrapWithPipeline` signature change** — Approach A per RESEARCH.md §"Two viable approaches":
```typescript
// BEFORE (line 82):
export function wrapWithPipeline(
  registry: QueryRegistry,
  mutationCommands: Set<string>,
  options: PipelineOptions,
): void {

// AFTER:
export function wrapWithPipeline(
  registry: QueryRegistry,
  mutationCommands: Set<string>,
  options: PipelineOptions,
  adapter: StorageAdapter,   // NEW — replaces adapterFor call inside dry-run block
): void {
```

**Dry-run block to replace** (lines 116-162 — entire `if (dryRun && isMutation)` branch):

The current block (lines 116-162):
```typescript
if (dryRun && isMutation) {
  const { adapterFor } = await import('./helpers.js');
  const adapter = await adapterFor(projectDir);
  // ... _txnContextForPipeline / _realReadForPipeline casts ...
  await ext.withTransaction(async () => {
    await original(args, projectDir);
    const ctx = ext._txnContextForPipeline?.();
    const realRead = ext._realReadForPipeline;
    if (!ctx || !realRead) return;
    // ... build diff ...
  }, { dryRun: true });
```

New block (per RESEARCH.md §"New dry-run block" two-pass approach):
```typescript
if (dryRun && isMutation) {
  const beforeMap = new Map<string, string | null>();
  const afterMap = new Map<string, string | null>();
  let touchedPaths: Set<string> = new Set();

  if (hasSnapshot(adapter)) {
    // Generic snapshot/restore path — works on MarkdownAdapter.
    const snapId = await adapter.snapshot();
    try {
      await adapter.withTransaction(async () => {
        await original(args, projectDir);
        touchedPaths = adapter.getTouchedPaths();   // inside txn
        for (const p of touchedPaths) {
          afterMap.set(p, await adapter.getRecord(p));   // shadow-dir read
        }
      });
      // Pass 2: restore → read before-images from pre-mutation state
      await adapter.restore(snapId);
      for (const p of touchedPaths) {
        beforeMap.set(p, await adapter.getRecord(p));
      }
    } finally {
      // restore already called above on success; on throw, we still need to
      // clean up — but adapter.restore is the only mechanism; absorb errors
      // from a double-restore attempt
      try { await adapter.restore(snapId); } catch { /* already restored */ }
    }
  } else {
    // BeadsAdapter fallback: withTransaction provides rollback (discard buffer).
    // Diff is coarse-grained per D-04.
    await adapter.withTransaction(async () => {
      await original(args, projectDir);
      touchedPaths = adapter.getTouchedPaths();   // best-effort on bd
    });
    // diff remains empty Maps; changedFiles = []
  }

  diff = diffPlanningState(beforeMap, afterMap);
  changedFiles = Object.keys(diff).map(k => k.replace(/^\.planning\//, ''));
```

**`result` shape below dry-run block** (lines 152-162 — stays identical):
```typescript
result = {
  data: {
    dry_run: true,
    command: cmd,
    args,
    diff,
    changes_summary: changedFiles.length > 0
      ? `${changedFiles.length} file(s) would be modified: ${changedFiles.map(f => '.planning/' + f).join(', ')}`
      : 'No files would be modified',
  },
};
```

---

### Handler files — 29 files; the "before" and "after" migration shapes

This is the core migration pattern. Every "not-yet-migrated" handler file follows the same two-commit transformation.

**Analog for "before" shape:** `sdk/src/query/workstream.ts` lines 99-124 (typical not-yet-migrated pattern)

**Analog for "after" shape:** `sdk/src/query/state-project-load.ts` lines 94-119 (canonical post-migration read handler) and `sdk/src/query/state.ts` lines 265-299 (post-migration pattern for write handler with StateWriteOutcome)

**Before (handler body uses `adapterFor`):**
```typescript
// workstream.ts lines 110-124 — representative not-yet-migrated handler
export const workstreamList: QueryHandler = async (_args, projectDir) => {
  const adapter = await adapterFor(projectDir);  // DELETE THIS
  if (!(await adapter.exists('workstreams'))) return { ... };
  try {
    const refs = await adapter.listCollection('workstreams');
    ...
  } catch {
    return { ... };
  }
};
```

**After (handler receives adapter as first arg):**
```typescript
// state-project-load.ts lines 94-119 — canonical migrated read handler
export const stateProjectLoad = async (
  adapter: StorageAdapter,          // NEW FIRST ARG
  _args: string[],
  _projectDir: string,
  workstream?: string,
): Promise<QueryResult> => {
  const stateRaw = (await adapter.getRecord(stateRel)) ?? '';
  ...
  return { data: { ... } };
};
```

**After with StateWriteOutcome (write handlers in state-mutation.ts only):**
```typescript
// state.ts lines 265-299 style, applied to state-mutation handlers
export const stateRecordMetric = async (
  adapter: StorageAdapter,          // NEW FIRST ARG
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> => {        // return type stays QueryResult (not StateWriteOutcome)
  const adapter_was_arg = adapter;  // no adapterFor call
  const outcome: StateWriteOutcome = await adapter_was_arg.recordStateAppend(event);
  if (!outcome.applied) {
    return { data: { recorded: false, reason: outcome.reason, ... } };
  }
  return { data: { recorded: true, ...(outcome.created_section ? { created_section: outcome.created_section } : {}) } };
};
```
Note: the handler return type remains `Promise<QueryResult>` — StateWriteOutcome is propagated into the `data` payload shape, not as the handler's own return type. This is the D-14 pattern: handlers expose the outcome to callers through the `data` field, not by changing the `QueryHandler` contract.

**Registration pattern change in `index.ts`** (analog: lines 299-481 — the already-migrated closure wrappers):

```typescript
// BEFORE (not-yet-migrated — direct handler reference):
registry.register('workstream.list', workstreamList);

// AFTER (closure wrapper — threads adapter from createRegistry scope):
registry.register('workstream.list', (args, projectDir, ws) => workstreamList(adapter, args, projectDir, ws));
```

**Alias-family registration pattern** (analog: index.ts lines 325-332 and 356-363 — the for-loop alias pattern):
```typescript
// Pattern for families with STATE_COMMAND_ALIASES or ROADMAP_COMMAND_ALIASES loops:
const stateHandlers: Record<string, QueryHandler> = {
  // BEFORE:
  'state.update': stateUpdate,
  // AFTER:
  'state.update': (args, pd, ws) => stateUpdate(adapter, args, pd, ws),
};
// The alias loop body is UNCHANGED — it still reads from stateHandlers dict and
// registers canonical + aliases. The closure is created once; all aliases share it.
for (const entry of STATE_COMMAND_ALIASES) {
  const handler = stateHandlers[entry.canonical];
  if (!handler) continue;
  registry.register(entry.canonical, handler);
  for (const alias of entry.aliases) {
    registry.register(alias, handler);
  }
}
```

---

### `sdk/src/query/state-mutation.ts` — additional patterns (heaviest file, 23 callsites)

**Internal helper pattern** (lines 259, 292, 326 — internal non-exported functions also call `adapterFor`):
```typescript
// BEFORE — internal helper with its own adapterFor call:
async function syncStateFrontmatter(projectDir: string, workstream?: string): Promise<void> {
  const syncAdapter = await adapterFor(projectDir);  // line 259
  ...
}

// AFTER — receives adapter as first arg:
async function syncStateFrontmatter(adapter: StorageAdapter, projectDir: string, workstream?: string): Promise<void> {
  // adapter is now a parameter
  ...
}
```
All internal helpers in state-mutation.ts that call `adapterFor` must be converted to receive `adapter` as first arg in the same adapter-threading commit. Callers of those helpers (the exported handlers) pass their own `adapter` parameter through.

**StateWriteOutcome propagation pattern** (analog: state-mutation.ts lines 682-699 — `stateRecordMetric` already propagates):
```typescript
// Handlers that call adapter.recordState* already have this pattern:
const outcome: StateWriteOutcome = await adapter.recordStateAppend(event);
if (!outcome.applied) {
  return { data: { recorded: false, reason: outcome.reason, phase, plan, duration } };
}
return {
  data: {
    recorded: true,
    phase, plan, duration,
    ...(outcome.created_section ? { created_section: outcome.created_section } : {}),
  },
};
```
Handlers that do NOT call `recordState*` (e.g. `stateUpdate`, `statePatch` — they call `readModifyWriteState` which returns `void`) do NOT get the StateWriteOutcome propagation commit (they have no outcome to propagate).

---

### `tests/conformance/manifest-types.ts` — add `'seam-realness'` to `ManifestEntryKind`

**Analog:** `tests/conformance/manifest-types.ts` lines 55-66 — the `ManifestEntry` interface with the `kind` discriminant.

**Current `kind` field** (line 57):
```typescript
kind: 'binB' | 'section-tuple' | 'noun-roundtrip' | 'rollback';
```

**New `kind` field after extension:**
```typescript
kind: 'binB' | 'section-tuple' | 'noun-roundtrip' | 'rollback' | 'seam-realness';
```

This is the only change to this file. All other types (`ExpectedOutcome`, `StateOutcomeExpected`, `PresenceExpected`, etc.) remain unchanged — `seam-realness` entries use the same `expected` shape as `binB` entries.

---

### `tests/conformance/manifest.ts` — add ~30 `kind: 'seam-realness'` entries

**Analog:** `tests/conformance/manifest.ts` lines 30-74 — the baseline `binB` entries with `PresenceExpected` shape; and lines 78-130 (the `StateWriteOutcome` matrix entries with `StateOutcomeExpected` shape).

**`PresenceExpected` entry pattern** (lines 30-38 — for handlers that do NOT call `recordState*`):
```typescript
{
  kind: 'seam-realness',
  name: 'state.milestone-switch:via-registry:markdown',
  description: 'state.milestone-switch dispatched via full registry routes to MarkdownAdapter (SEAM-04/05)',
  expected: {
    markdown: { kind: 'presence' },
    beads:    { kind: 'presence' },
  },
},
```

**`StateOutcomeExpected` entry pattern** (lines 84-93 — for state-mutation handlers that call `recordState*`):
```typescript
{
  kind: 'seam-realness',
  name: 'state.add-decision:via-registry:existing-section',
  description: 'state.add-decision dispatched via registry; outcome propagates from recordStateAppend',
  expected: {
    markdown: { applied: true },
    beads:    { applied: true },
  },
  // adr: required when adapters legitimately differ (per D-12)
},
```

**ADR annotation pattern for known divergence** (per D-12; analog: `rollback` entries in manifest):
```typescript
{
  kind: 'known-gap',         // NOT 'seam-realness' — kind changes for failing handlers
  name: 'state.X:via-registry:beads-fail',
  description: 'handler fails conformance on beads due to ...',
  expected: {
    markdown: { applied: true },
    beads:    { applied: false, reason: 'nothing_to_remove' },
  },
  adr: 'D-2026-05-12-OQ06-CREATED-SECTION',  // required
},
```

**DEFECT-02 large-body entry pattern** (unique; uses fixture parameter in name):
```typescript
{
  kind: 'seam-realness',
  name: 'putRecord:large-body:round-trip',
  description: 'putRecord + getRecord round-trip for body > 64KB; asserts byte-identical retrieval (DEFECT-02)',
  expected: {
    markdown: { kind: 'presence' },
    beads:    { kind: 'presence' },
  },
},
```

---

### `tests/conformance/paired-seam-markdown.test.ts` (NEW)

**Analog:** `tests/conformance/paired-outcome-markdown.test.ts` (3 lines — the entire file)

**Full file pattern:**
```typescript
/**
 * Phase 2 paired-seam entry (MarkdownAdapter).
 *
 * Invokes runSeamRealnessSuite against MarkdownAdapter. Each test exercises
 * a migrated state-mutation handler via full registry dispatch (not direct
 * call) to prove routing reaches the adapter (SEAM-01, SEAM-03, SEAM-05).
 */
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import { runSeamRealnessSuite } from './seam-realness.conformance-suite.js';  // new suite file

runSeamRealnessSuite('markdown', (projectDir) => new MarkdownAdapter(projectDir));
```

Note: the suite logic lives in `seam-realness.conformance-suite.ts` (analogous to `write-outcome.conformance-suite.ts`). The paired test file itself is a 3-line entry point — exactly matching the `paired-outcome-markdown.test.ts` pattern.

---

### `tests/conformance/paired-seam-beads.test.ts` (NEW)

**Analog:** `tests/conformance/paired-outcome-beads.test.ts` (16 lines — the entire file)

**Full file pattern:**
```typescript
/**
 * Phase 2 paired-seam entry (BeadsAdapter).
 */
import { describe, it } from 'vitest';
import { createBeadsAdapter } from 'gsd-beads/testing';
import { runSeamRealnessSuite } from './seam-realness.conformance-suite.js';
import { bdPresent } from './paired-adapters.js';

if (bdPresent()) {
  runSeamRealnessSuite('beads', createBeadsAdapter);
} else {
  describe.skip('SeamRealness (beads)', () => {
    it.skip('bd v1.0.4+ not available', () => {});
  });
}
```

The `bdPresent()` guard is mandatory — without it, the test fails in environments without bd installed. This is identical to the `paired-outcome-beads.test.ts` pattern at lines 9-15.

---

### `seam-realness.conformance-suite.ts` (NEW — implied by the paired test files)

**Analog:** `tests/conformance/write-outcome.conformance-suite.ts` lines 86-180 (the `runStateWriteOutcomeSuite` function structure)

**Suite function shape:**
```typescript
// write-outcome.conformance-suite.ts lines 47-54 — imports pattern:
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StorageAdapter } from '../../adapters/types.js';
import type { AdapterName, ExpectedOutcome } from './manifest-types.js';
import { assertFromManifest, preRegisterTest } from './test-registry.js';
```

**Pre-registration block** (analog: lines 96-130 — pre-register all entries at collection time):
```typescript
export function runSeamRealnessSuite(
  adapterName: AdapterName,
  adapterFactory: (projectDir: string) => StorageAdapter,
): void {
  const seamEntries: Array<{ name: string; kind: 'seam-realness' }> = [
    { name: 'state.milestone-switch:via-registry', kind: 'seam-realness' },
    { name: 'state.add-decision:via-registry:existing-section', kind: 'seam-realness' },
    { name: 'putRecord:large-body:round-trip', kind: 'seam-realness' },
    // ... ~30 entries matching manifest.ts additions
  ];
  for (const entry of seamEntries) {
    preRegisterTest(adapterName, entry.name, entry.kind);
  }

  describe(`seam realness (${adapterName})`, () => {
    let tmpDir: string;
    let adapter: StorageAdapter;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'gsd-seam-realness-'));
      await mkdir(join(tmpDir, '.planning'), { recursive: true });
      adapter = adapterFactory(tmpDir);
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    // Tests exercise handlers via registry dispatch, not direct calls:
    it('state.milestone-switch routes to configured adapter via registry', async () => {
      // Seed fixture, dispatch via registry, assert outcome via assertFromManifest
      assertFromManifest(adapterName, 'state.milestone-switch:via-registry', 'seam-realness', (expected) => {
        // check presence or StateWriteOutcome per expected shape
      });
    });
    // ... one it() per manifest entry
  });
}
```

**Key constraint on test body:** Tests MUST dispatch via `registry.dispatch(cmd, args, projectDir)` — NOT by calling handler functions directly. Direct calls bypass the closure wrapper and would pass even if the registry wasn't updated (RESEARCH.md §"Structural proof").

**`assertFromManifest` call pattern** (analog: write-outcome.conformance-suite.ts lines 154-157):
```typescript
assertFromManifest(adapterName, 'state.add-decision:via-registry:existing-section', 'seam-realness', (expected) => {
  expectOutcomeMatch(outcome, expected);  // reuse the expectOutcomeMatch helper from write-outcome suite
});
```

---

### `~/code/gsd-beads/src/index.ts` — add `getTouchedPaths()` to BeadsAdapter (cross-repo)

**Analog:** `adapters/markdown/index.ts` `getTouchedPaths()` implementation (see above). The semantics differ (coarse-grained) but the method shape is identical.

**BeadsAdapter transaction context** (verified: `/Volumes/code/gsd-beads/src/txn.ts` — `TxnContext` has `buffer: BufferedOp[]`; no `touchedPaths` field exists yet):

**New implementation shape** (Option B per RESEARCH.md §"BeadsAdapter Implementation"):
```typescript
// gsd-beads/src/index.ts — add to BeadsAdapter class
getTouchedPaths(): Set<string> {
  const ctx = this.txnStorage.getStore();   // AsyncLocalStorage pattern from txn.ts
  if (!ctx) return new Set();
  const paths = new Set<string>();
  for (const op of ctx.buffer) {
    // Map operation kind to synthetic path for non-empty diff assertion (D-04)
    paths.add(`bd://${op.kind}/${op.args[0] ?? 'unknown'}`);
  }
  return paths;
}
```

**Cross-repo delivery note:** This change requires a semver bump on `gsd-beads` and a dependency update in this repo's `package.json`. Alternatively, stub `getTouchedPaths?(): Set<string>` as optional in `adapters/types.ts` during Wave 0 development, then make it required at Wave 5 close when gsd-beads is confirmed updated. The Wave 0 task must verify `ls -la node_modules/gsd-beads` to confirm whether it's a symlink (local development) or a copied package.

---

## Shared Patterns

### Adapter Import (every handler file migration)
**Source:** `sdk/src/query/state-project-load.ts` (post-migration file)
**Apply to:** All 29 handler files during adapter-threading commit
```typescript
import type { StorageAdapter } from '../../../adapters/types.js';
```
Remove `adapterFor` from the helpers.ts import destructure in the same commit.

### Closure Wrapper (registry registration)
**Source:** `sdk/src/query/index.ts` lines 302-303, 336-338, 451-456
**Apply to:** Every handler re-registration in index.ts
```typescript
// Single-handler registration:
registry.register('handler.name', (args, projectDir, ws) => handlerFn(adapter, args, projectDir, ws));

// Dict-based family + alias loop (unchanged loop body — closure lives in the dict value):
const familyHandlers: Record<string, QueryHandler> = {
  'handler.name': (args, pd, ws) => handlerFn(adapter, args, pd, ws),
};
for (const entry of FAMILY_COMMAND_ALIASES) {
  const handler = familyHandlers[entry.canonical];
  if (!handler) continue;
  registry.register(entry.canonical, handler);
  for (const alias of entry.aliases) { registry.register(alias, handler); }
}
```

### Capability Guard (pipeline dry-run)
**Source:** `adapters/types.ts` lines 174-176 (`hasSnapshot` typeguard)
**Apply to:** `sdk/src/query/pipeline.ts` dry-run block
```typescript
import { hasSnapshot } from '../../../adapters/types.js';
// ...
if (hasSnapshot(adapter)) { /* snapshot path */ } else { /* withTransaction-only fallback */ }
```

### Conformance Pre-Registration
**Source:** `tests/conformance/write-outcome.conformance-suite.ts` lines 96-130
**Apply to:** `seam-realness.conformance-suite.ts`
```typescript
// Call preRegisterTest() for every entry at collection time (outside any it())
// to ensure registeredTests is populated before meta-coverage runs.
preRegisterTest(adapterName, entryName, 'seam-realness');
```

### BeadsAdapter Skip Guard
**Source:** `tests/conformance/paired-outcome-beads.test.ts` lines 9-15
**Apply to:** `tests/conformance/paired-seam-beads.test.ts`
```typescript
if (bdPresent()) {
  runSeamRealnessSuite('beads', createBeadsAdapter);
} else {
  describe.skip('SeamRealness (beads)', () => {
    it.skip('bd v1.0.4+ not available', () => {});
  });
}
```

### Per-Commit Build Gate (D-18)
**Source:** RESEARCH.md §"Per-Commit Gate" — this is a process constraint, not a code pattern.
**Apply to:** Every atomic commit in this phase.
```bash
npm run build:sdk-only && cd sdk && npm run test:unit
```

---

## No Analog Found

All files have analogs. No new architectural patterns are needed.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tests/conformance/seam-realness.conformance-suite.ts` | test suite | request-response | New suite file (implied by paired-seam tests); no direct analog — closest is `write-outcome.conformance-suite.ts`. Structure is a direct copy with handler names and registry-dispatch assertions substituted. |

---

## Metadata

**Analog search scope:** `sdk/src/query/`, `adapters/`, `tests/conformance/`, `/Volumes/code/gsd-beads/src/`
**Files scanned:** 14 source files read directly; 5 additional files grepped
**Pattern extraction date:** 2026-05-18
