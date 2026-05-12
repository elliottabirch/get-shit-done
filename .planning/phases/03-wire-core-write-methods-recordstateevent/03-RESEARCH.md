# Phase 3: Wire core write methods + recordStateEvent - Research

**Researched:** 2026-05-09
**Domain:** TypeScript SDK write-path migration, adapter pattern, discriminated-union event design
**Confidence:** HIGH

## Summary

Phase 3 migrates every direct-I/O write in `state-mutation.ts` (1712 LOC, 18 handlers) and `phase-lifecycle.ts` (1934 LOC, 13 handlers) through the StorageAdapter interface. The migration has two structural axes: (1) collapsing 10 event-style state-mutation handlers into 3 family methods (`recordStateAppend`, `recordStateMutation`, `recordStateSignal`) with discriminated-union payloads, and (2) extracting ~30 shared SDK helper functions from `phase-lifecycle.ts` that compose Bin A adapter primitives (`getRecord`, `putRecord`, `updateSection`, etc.) for reuse across the 13 phase handlers.

The key architectural constraint is that `MarkdownAdapter` currently has `transaction: false` and `withTransaction` throws `UnsupportedCapabilityError`. Phase 3 implements `withTransaction` by wrapping the existing `acquireStateLock`/`releaseStateLock` PID-based lockfile mechanism (already working in `state-mutation.ts:179-228`), then sets `transaction: true`. All 31 write handlers that currently use `readModifyWriteStateMd` or `readModifyWriteRoadmapMd` refactor to explicit `adapter.withTransaction(async () => { ... })` blocks composing `getRecord` + transform + `putRecord`.

The migration must maintain byte-identical output (SC#3) when MarkdownAdapter is mounted. This is achievable because the adapter already wraps the same filesystem primitives -- the transformation is structural (move from inline fs calls to adapter method calls) with zero semantic change. The `readModifyWriteStateMd` function's behavior (acquire lock, strip frontmatter, apply modifier, rebuild frontmatter, normalize markdown, write) must be replicated exactly through adapter primitives.

**Primary recommendation:** Migrate in 4-5 plans mirroring Phase 2's shape: (1) Foundation -- implement `withTransaction` + define event types + shared helper module scaffold + extend leak-grep; (2) State-mutation event handlers -- the 10 append/mutate/signal handlers; (3) State-mutation non-event handlers -- the 8 field-update/maintenance handlers; (4) Phase-lifecycle handlers -- the 13 handlers via shared helpers; (5) Conformance tests + OQ-01 resolution ADR.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (3 event families by mutation semantics):** `recordStateAppend`, `recordStateMutation`, `recordStateSignal` -- grouped for clean BeadsAdapter mapping (append->comment, mutation->sub-record, signal->sidecar)
- **D-02 (Discriminated union per family):** Each family has its own TypeScript union with `type` + `payload`. Narrower unions per family for tighter type safety.
- **D-03 (Non-event handlers stay separate):** `stateUpdate`, `statePatch`, `stateBeginPhase`, `stateAdvancePlan`, `statePlannedPhase`, `stateUpdateProgress`, `stateValidate`, `stateSync`, `statePrune` use adapter calls (`updateFrontmatter`, `updateSection`, etc.) NOT `recordState*`
- **D-04 (Adapter interface stays thin):** Only Bin A + 3 event methods + `withTransaction` + `commitPlanningState` required. No domain-specific methods.
- **D-05 (Shared SDK helper layer):** ~30 mid-level helpers in `sdk/src/query/phase-helpers.ts` composing Bin A primitives
- **D-06 (Handler shape after migration):** `phase-lifecycle.ts` handlers become orchestrators (~600 LOC total): validation + helper composition + result formatting
- **D-07 (Implement withTransaction now):** Phase 3 implements `withTransaction` wrapping existing PID lockfile
- **D-08 (MarkdownAdapter withTransaction):** ~50 LOC: acquire lock -> execute fn -> release lock (try/finally)
- **D-09 (Caller pattern):** Explicit `adapter.withTransaction(async () => { ... })` blocks with `getRecord` + transform + `putRecord` inside
- **D-10 (Non-markdown adapters):** `withTransaction` maps to native concurrency: bd append-log ACID, sqlite BEGIN/COMMIT, postgres transactions
- **D-11 (commitPlanningState = always checkpoint):** Every adapter MUST implement as meaningful save point. MarkdownAdapter: git add + git commit. BeadsAdapter: bead-hash bookmark.
- **D-12 (commitPlanningState required):** Removed from `Capabilities` enum, becomes required like `getRecord`. `hasCommitPlanningState` type guard removed.
- **D-13 (Conformance test stub):** Phase 3 adds stub asserting commitPlanningState creates an identifiable save point

### Claude's Discretion
- Internal naming for the shared SDK helper module (`phase-helpers.ts`, `write-helpers.ts`, or split)
- Exact payload type names and field shapes for each event family member
- Whether `withTransaction` capability flag stays `transaction: boolean` or is renamed
- Plan count and sequencing (likely 4-5 plans mirroring Phase 2)
- Conformance test structure for the 3 event families
- Whether `readModifyWriteStateMd`/`readModifyWriteRoadmapMd` are removed entirely or kept as deprecated aliases

### Deferred Ideas (OUT OF SCOPE)
- Foundational primitives (`snapshot/restore`, `putNamedDoc`, `getNamedDoc`, `writeBinaryAsset`) -- Phase 5
- `getSection`/`updateSection` semantic upgrade (append/overwrite/prepend modes) -- Phase 5
- Workflow leak plugging (Read/Write/Edit tool calls) -- Phase 4
- `<context>`-block mitigation strategy -- Phase 4
- BeadsAdapter implementation -- Phase 6
- Conformance test full paired runs (both adapters) -- Phase 7
- Transaction nesting / savepoint semantics -- not needed for v1.0
- `stateValidate`/`stateSync`/`statePrune` flagged as potentially complex (read + rewrite entire STATE.md)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WRITES-01 | `state-mutation.ts` 18 handlers migrated to `recordStateEvent` discriminated-union | Handler inventory complete: 10 event handlers map to 3 families; 8 non-event handlers use Bin A directly |
| WRITES-02 | `phase-lifecycle.ts` 13 handlers migrated to Bin B named methods over Bin A primitives | Handler inventory + shared helper decomposition documented; `readModifyWriteRoadmapMd` pattern mapped to `withTransaction` + `getRecord`/`putRecord` |
| WRITES-03 | ~58 Bin B named methods implemented in MarkdownAdapter | Clarification: per D-04/D-05, domain logic lives in SDK helpers NOT adapter impl. "58 Bin B methods" = ~30 SDK helpers + 3 event family adapter methods. MarkdownAdapter write surface stays thin. |
| WRITES-04 | `commitPlanningState` semantics resolved (OQ-01) | D-11/D-12 provide the resolution: always checkpoint, required method. ADR needed. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| STATE.md event recording (decisions, metrics, sessions, blockers, roadmap evolution) | API / Backend (SDK handler layer) | Database / Storage (adapter) | Business logic (section targeting, dedup, formatting) belongs in SDK; storage primitive is append-to-section |
| Phase lifecycle (add, insert, remove, complete, scaffold) | API / Backend (SDK helper layer) | Database / Storage (adapter) | Domain logic (slug generation, decimal math, renumber cascades) in SDK helpers; raw file/dir CRUD via adapter |
| Transaction/locking | Database / Storage (adapter) | -- | Concurrency control is a storage responsibility; SDK just wraps operations in `withTransaction` |
| Frontmatter sync (buildStateFrontmatter, reconstructFrontmatter) | API / Backend (SDK) | -- | Derived from parsing body content; pure computation, not storage |
| commitPlanningState (git commit / bead-hash) | Database / Storage (adapter) | -- | Backend-specific checkpoint mechanism; SDK just calls with a message |
| WAITING.json signal/resume | Database / Storage (adapter) | -- | Sidecar file write/delete; routes through `putRecord`/`removeRecord` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x (project-local) | Type-safe discriminated unions for event families | Already in use; discriminated unions are first-class TS feature |
| vitest | 3.x (project-local) | Conformance + unit tests | Already configured in `vitest.conformance.config.ts` |
| node:fs/promises | Node 20+ built-in | MarkdownAdapter `withTransaction` implementation | Already used; lockfile mechanism proven in production |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod (or manual narrowing) | N/A | Event payload validation | NOT recommended -- TS discriminated unions + exhaustiveness checks provide compile-time safety without runtime overhead; payload shapes are internal SDK types not external input |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 3 separate event family methods | Single `recordStateEvent(union)` | Single method has simpler interface but 13+ variants in one union is unwieldy; 3 families match BeadsAdapter primitives cleanly |
| Explicit `withTransaction` blocks | Keep `readModifyWriteStateMd` as adapter method | `readModifyWriteStateMd` embeds STATE.md-specific logic (frontmatter sync, normalize); can't generalize to multi-file transactions |
| SDK helper functions | Bin B methods on adapter interface | Adapter stays storage-only; BeadsAdapter never needs phase semantics |

[VERIFIED: codebase inspection] -- all library claims verified against project package.json and existing imports.

## Architecture Patterns

### System Architecture Diagram

```
                  SDK Handler (e.g. stateAddDecision)
                           |
                           v
              +---------------------------+
              | Validation + arg parsing  |
              +---------------------------+
                           |
                           v
              +---------------------------+
              | adapter.withTransaction() |
              |   +---------------------+ |
              |   | adapter.getRecord() | |
              |   +---------------------+ |
              |            |              |
              |            v              |
              |   +---------------------+ |
              |   | Transform function  | |
              |   | (pure: parse,       | |
              |   |  modify, format)    | |
              |   +---------------------+ |
              |            |              |
              |            v              |
              |   +---------------------+ |
              |   | adapter.putRecord() | |  <- or updateSection/updateFrontmatter
              |   +---------------------+ |
              +---------------------------+
                           |
                           v
              +---------------------------+
              | Result formatting         |
              +---------------------------+

  For EVENT handlers (recordStateAppend/Mutation/Signal):
  
              SDK Handler (e.g. stateAddDecision)
                           |
                           v
              +---------------------------+
              | Validation + arg parsing  |
              +---------------------------+
                           |
                           v
              +---------------------------+
              | adapter.recordStateAppend |
              |   ({ type: 'decision',   |
              |      payload: { ... } }) |
              +---------------------------+
              (adapter internally does:   )
              (  withTransaction ->        )
              (    getRecord('STATE.md')   )
              (    -> transform -> put     )
              +---------------------------+
                           |
                           v
              +---------------------------+
              | Result formatting         |
              +---------------------------+
```

### Recommended Project Structure
```
adapters/
  types.ts                    # +3 event method signatures, +event payload types
                              # -commitPlanningState from Capabilities enum
  markdown/
    index.ts                  # +withTransaction impl, +3 recordState* impls
                              # capabilities.transaction = true

sdk/src/query/
  state-mutation.ts           # 18 handlers refactored (in-place, no file split)
  phase-lifecycle.ts          # 13 handlers refactored (in-place, no file split)
  phase-helpers.ts            # NEW: ~30 shared helper functions
  state-event-types.ts        # NEW: discriminated union type definitions

scripts/
  leak-grep.cjs              # Extended with SDK_FS_WRITE_PATTERNS

tests/conformance/
  write-events.test.ts        # NEW: event family round-trip tests
  write-transaction.test.ts   # NEW: withTransaction atomicity test
  commit-planning-state.test.ts # NEW: checkpoint identification stub
```

### Pattern 1: Event Family Method (recordStateAppend)
**What:** Adapter method that accepts a discriminated-union event and appends to the correct STATE.md section
**When to use:** For the 10 event-type handlers that append entries to STATE.md subsections
**Example:**
```typescript
// adapters/types.ts — new event types
interface DecisionPayload {
  phase: string;
  summary: string;
  rationale?: string;
}

interface MetricPayload {
  phase: string;
  plan: string;
  duration: string;
  tasks?: string;
  files?: string;
}

// ... other payload types

type AppendEvent =
  | { type: 'decision'; payload: DecisionPayload }
  | { type: 'metric'; payload: MetricPayload }
  | { type: 'roadmap_evolution'; payload: RoadmapEvolutionPayload }
  | { type: 'session'; payload: SessionPayload }
  | { type: 'forensic_session'; payload: ForensicSessionPayload }
  | { type: 'quick_task'; payload: QuickTaskPayload };

// On StorageAdapter interface:
recordStateAppend(event: AppendEvent): Promise<void>;
```
[VERIFIED: codebase inspection of state-mutation.ts handlers]

### Pattern 2: withTransaction Wrapping Lockfile
**What:** `MarkdownAdapter.withTransaction` wraps the existing `acquireStateLock`/`releaseStateLock` mechanism
**When to use:** Every multi-step write that was previously inside `readModifyWriteStateMd` or `readModifyWriteRoadmapMd`
**Example:**
```typescript
// adapters/markdown/index.ts
async withTransaction(fn: () => Promise<void>): Promise<void> {
  // Use a per-adapter lockfile (not tied to STATE.md path)
  const lockPath = join(this.planningBase, '.adapter.lock');
  const acquired = await this.acquireLock(lockPath);
  try {
    await fn();
  } finally {
    await this.releaseLock(lockPath, acquired);
  }
}
```
[VERIFIED: existing acquireStateLock in state-mutation.ts:179-228 uses O_CREAT|O_EXCL + PID + 10-retry]

### Pattern 3: SDK Shared Helper (phase-helpers.ts)
**What:** Mid-level functions composing Bin A primitives for reusable phase-lifecycle patterns
**When to use:** Logic shared across multiple phase-lifecycle handlers
**Example:**
```typescript
// sdk/src/query/phase-helpers.ts
export async function scaffoldPhaseDir(
  adapter: StorageAdapter,
  phasesRelPath: string,
  dirName: string,
): Promise<void> {
  await adapter.putRecord(`${phasesRelPath}/${dirName}/.gitkeep`, '');
}

export async function insertRoadmapPhase(
  adapter: StorageAdapter,
  phaseEntry: string,
  workstream?: string,
): Promise<void> {
  await adapter.withTransaction(async () => {
    const roadmapRel = planningRelativePath(workstream, 'ROADMAP.md');
    const content = (await adapter.getRecord(roadmapRel)) ?? '';
    const lastSep = content.lastIndexOf('\n---');
    const updated = lastSep > 0
      ? content.slice(0, lastSep) + phaseEntry + content.slice(lastSep)
      : content + phaseEntry;
    await adapter.putRecord(roadmapRel, updated);
  });
}
```
[VERIFIED: phaseAdd handler at phase-lifecycle.ts:199-313 does exactly this pattern]

### Pattern 4: Non-Event State Handler Migration
**What:** Handlers like `stateUpdate`, `statePatch`, `stateBeginPhase` that modify fields (not append events)
**When to use:** The 8 non-event handlers per D-03
**Example:**
```typescript
// Migrated stateUpdate handler
export const stateUpdate: QueryHandler = async (args, projectDir, workstream) => {
  const adapter = await adapterFor(projectDir);
  const field = args[0];
  const value = args[1];
  // ... validation ...
  
  let updated = false;
  await adapter.withTransaction(async () => {
    const stateRel = planningRelativePath(workstream, 'STATE.md');
    const content = (await adapter.getRecord(stateRel)) ?? '';
    const body = stripFrontmatter(content);
    const result = stateReplaceField(body, field, value);
    if (result) {
      updated = true;
      const synced = await syncStateFrontmatter(result, projectDir);
      await adapter.putRecord(stateRel, normalizeMd(synced));
    }
  });
  return { data: { updated } };
};
```
[VERIFIED: current stateUpdate at state-mutation.ts:328-347 uses readModifyWriteStateMd with same logic]

### Anti-Patterns to Avoid
- **Direct `readFile`/`writeFile` against `.planning/` paths:** Use `adapter.getRecord`/`adapter.putRecord` exclusively
- **Inline `acquireStateLock`/`releaseStateLock` in handlers:** Use `adapter.withTransaction` instead
- **Domain logic in adapter methods:** Slug generation, decimal math, renumber cascades belong in SDK helpers, never in MarkdownAdapter
- **Mixing lockfiles with `withTransaction`:** The `withTransaction` implementation owns all locking; handlers should never directly call `acquireStateLock`
- **Frontmatter sync inside adapter:** `syncStateFrontmatter`/`buildStateFrontmatter`/`reconstructFrontmatter` remain in SDK code; the adapter's `putRecord` takes pre-synced content

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lockfile atomicity | Custom lock-acquire in each handler | `adapter.withTransaction(fn)` | Proven PID+O_CREAT|O_EXCL mechanism; handles stale locks, crash recovery |
| Section extraction/replacement | Per-handler regex section parsing | `adapter.getSection` / `adapter.updateSection` | Already implemented in MarkdownAdapter with edge-case handling |
| Frontmatter read/write | Inline YAML parsing per handler | `adapter.getFrontmatter` / `adapter.updateFrontmatter` / `adapter.mergeFrontmatter` | CJS `frontmatter.cjs` handles edge cases; adapter wraps it |
| Event dispatch to STATE.md sections | Per-handler section-finding + append logic | `recordStateAppend` dispatcher with section-map | Single implementation handles dedup, placeholder removal, section creation |
| Phase directory scaffolding | Inline `mkdir` + `writeFile(.gitkeep)` | `scaffoldPhaseDir(adapter, path, dirName)` helper | Reused by phaseAdd, phaseAddBatch, phaseInsert, phaseScaffold |

**Key insight:** The current codebase already solves every problem correctly -- the migration is structural, not behavioral. The risk is introducing subtle behavioral drift during the refactor, not missing functionality.

## Common Pitfalls

### Pitfall 1: readModifyWriteStateMd's Hidden Frontmatter Dance
**What goes wrong:** Naively replacing `readModifyWriteStateMd` with `getRecord` + transform + `putRecord` loses the frontmatter strip/rebuild/sync behavior
**Why it happens:** `readModifyWriteStateMd` does 5 steps: (1) read, (2) strip frontmatter, (3) apply modifier to body-only, (4) rebuild frontmatter from body + disk scan, (5) normalize and write. A raw `getRecord`/`putRecord` skips steps 2-4.
**How to avoid:** The `syncStateFrontmatter` function must still be called between transform and write. Create a shared helper that replicates the full pipeline: `readModifyWriteState(adapter, workstream, modifier)` that does the dance via adapter primitives.
**Warning signs:** Frontmatter getting corrupted; STATUS.md frontmatter fields drifting from body content.

### Pitfall 2: Transaction Scope Mismatch (Multi-File Operations)
**What goes wrong:** `phaseComplete` writes to ROADMAP.md, REQUIREMENTS.md, and STATE.md in sequence -- using separate locks for each. A naive migration might create 3 separate `withTransaction` blocks.
**Why it happens:** The current code uses `readModifyWriteRoadmapMd` (locks ROADMAP.md) then separately `acquireStateLock` (locks STATE.md). These are independent locks.
**How to avoid:** For Phase 3, `withTransaction` wraps a single global lock (the adapter-level lock). All writes within one handler call should be in ONE `withTransaction` block. The multi-file atomicity is acceptable because the adapter lock serializes all writers.
**Warning signs:** Interleaved writes from concurrent handler calls; partial updates visible to readers.

### Pitfall 3: Event Handler vs Non-Event Handler Classification
**What goes wrong:** Routing a non-event handler through `recordStateAppend` (or vice versa) produces wrong output shape
**Why it happens:** The 18 state-mutation handlers look similar but have different mutation semantics
**How to avoid:** Strict classification per D-03:
- **Event handlers (10):** `stateAddDecision`, `stateAddBlocker`, `stateResolveBlocker`, `stateRecordMetric`, `stateRecordSession`, `stateAddRoadmapEvolution`, `stateSignalWaiting`, `stateSignalResume`, `statePrune` (archive part), `stateUpdateProgress` (metrics table append)
- **Non-event handlers (8):** `stateUpdate`, `statePatch`, `stateBeginPhase`, `stateAdvancePlan`, `statePlannedPhase`, `stateUpdateProgress` (field replacement part), `stateValidate` (read-only + optional write), `stateSync`, `stateMilestoneSwitch`
**Warning signs:** Handler trying to construct an event payload that doesn't map to an append/mutate/signal semantic.

### Pitfall 4: WAITING.json Writes Outside .planning/ Scope
**What goes wrong:** `stateSignalWaiting` writes to BOTH `.gsd/WAITING.json` AND `.planning/WAITING.json`. The `.gsd/` write is outside adapter scope.
**Why it happens:** The signal is dual-written for backwards compatibility (some readers watch `.gsd/`, others watch `.planning/`)
**How to avoid:** Route the `.planning/WAITING.json` write through `adapter.putRecord('WAITING.json', payload)`. Keep the `.gsd/WAITING.json` write as a direct `writeFileSync` (it's outside adapter scope, like C2 files). Document this as a known dual-write.
**Warning signs:** Removing ALL `writeFileSync` calls without noticing the `.gsd/` path is out-of-scope.

### Pitfall 5: phaseRemove's STATE.md Direct Frontmatter Manipulation
**What goes wrong:** `phaseRemove` at line 1046-1076 directly manipulates STATE.md frontmatter with regex (incrementing `total_phases`, etc.) instead of going through `updateFrontmatter`
**Why it happens:** The handler was written before the adapter existed; it does inline regex on the full file content
**How to avoid:** Refactor to use `adapter.mergeFrontmatter('STATE.md', { progress: { total_phases: oldTotal - 1 } })` or `adapter.withTransaction` + `getRecord` + modify + `putRecord`. Must carefully preserve the "decrement" semantics.
**Warning signs:** Frontmatter `total_phases` getting out of sync after phase removal.

### Pitfall 6: phaseComplete's Cross-File Atomicity
**What goes wrong:** `phaseComplete` at lines 1185-1498 touches 3 files (ROADMAP.md, REQUIREMENTS.md, STATE.md) with separate lock scopes. Migrating naively could lose the per-file error isolation.
**Why it happens:** The handler uses `readModifyWriteRoadmapMd` for ROADMAP (which includes the REQUIREMENTS.md write inside its callback -- line 1318), then separately locks STATE.md.
**How to avoid:** Use a single `adapter.withTransaction(async () => { ... })` block for the entire handler. The adapter-level lock serializes all access. If the REQUIREMENTS.md write fails, the entire transaction should still complete for ROADMAP.md (current behavior is best-effort per file). Document this behavior.
**Warning signs:** ROADMAP updated but STATE.md not, or vice versa.

### Pitfall 7: Leak-Grep False Positives on Lockfile Code Inside Adapter
**What goes wrong:** The `withTransaction` implementation in MarkdownAdapter legitimately uses `node:fs` for the lockfile. Leak-grep must not flag this.
**Why it happens:** The leak-grep SDK_FS_WRITE_PATTERNS would catch `writeFile`/`unlink` inside `adapters/markdown/index.ts`
**How to avoid:** Leak-grep's scope is `sdk/src/query/*.ts` files, NOT `adapters/**`. The `SDK_FS_EXTS` filter + `PLANNING_SCOPE_RE` window already provide path-scoping. Ensure the new write patterns follow the same structure: only flag `.ts` files under SDK that reference `.planning/` paths.
**Warning signs:** leak-grep flagging the adapter implementation itself.

## Code Examples

### Event Type Definitions (state-event-types.ts)

```typescript
// Source: derived from state-mutation.ts handler analysis [VERIFIED: codebase inspection]

// ─── Append family (STATE.md section append-only events) ─────────────

export interface DecisionPayload {
  phase: string;
  summary: string;
  rationale?: string;
}

export interface MetricPayload {
  phase: string;
  plan: string;
  duration: string;
  tasks?: string;
  files?: string;
}

export interface RoadmapEvolutionPayload {
  phase: string;
  action: 'inserted' | 'removed' | 'moved' | 'edited' | 'added';
  note?: string;
  after?: string;
  urgent?: boolean;
}

export interface SessionPayload {
  stoppedAt?: string;
  resumeFile?: string;
}

export interface ForensicSessionPayload {
  // Phase 3 placeholder; actual shape TBD when forensic handlers are audited
  sessionId: string;
  findings: string;
}

export interface QuickTaskPayload {
  task: string;
  result?: string;
}

export type AppendEvent =
  | { type: 'decision'; payload: DecisionPayload }
  | { type: 'metric'; payload: MetricPayload }
  | { type: 'roadmap_evolution'; payload: RoadmapEvolutionPayload }
  | { type: 'session'; payload: SessionPayload }
  | { type: 'forensic_session'; payload: ForensicSessionPayload }
  | { type: 'quick_task'; payload: QuickTaskPayload };

// ─── Mutation family (STATE.md list add/remove events) ────────────────

export interface BlockerAddedPayload {
  text: string;
}

export interface BlockerResolvedPayload {
  text: string;
}

export interface TodoCountUpdatePayload {
  count: number;
  items?: string[];
}

export interface DeferredItemsPayload {
  items: string[];
  action: 'add' | 'remove';
}

export type MutationEvent =
  | { type: 'blocker_added'; payload: BlockerAddedPayload }
  | { type: 'blocker_resolved'; payload: BlockerResolvedPayload }
  | { type: 'todo_count_update'; payload: TodoCountUpdatePayload }
  | { type: 'deferred_items'; payload: DeferredItemsPayload };

// ─── Signal family (stateless flags / control signals) ────────────────

export interface WaitingPayload {
  waitType: string;
  question?: string;
  options?: string[];
  phase?: string;
}

export interface ResumePayload {
  // empty -- signal only
}

export interface MilestoneSwitchPayload {
  version: string;
  name?: string;
}

export type SignalEvent =
  | { type: 'waiting'; payload: WaitingPayload }
  | { type: 'resume'; payload: ResumePayload }
  | { type: 'milestone_switch'; payload: MilestoneSwitchPayload };
```

### MarkdownAdapter withTransaction Implementation

```typescript
// Source: wraps existing acquireStateLock pattern [VERIFIED: state-mutation.ts:179-228]
import { open, unlink, stat as fsStat } from 'node:fs/promises';
import { constants, unlinkSync } from 'node:fs';

// Inside MarkdownAdapter class:
private readonly lockSet = new Set<string>();

async withTransaction(fn: () => Promise<void>): Promise<void> {
  const lockPath = join(this.planningBase, '.adapter.lock');
  await this.acquireAdapterLock(lockPath);
  try {
    await fn();
  } finally {
    await this.releaseAdapterLock(lockPath);
  }
}

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
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'EEXIST') {
        // Check for stale lock (dead PID or >10s old)
        const dead = await this.isLockStale(lockPath);
        if (dead) {
          try { await unlink(lockPath); } catch { /* race */ }
          continue;
        }
        if (i === maxRetries - 1) {
          // Force-break on last retry (matches CJS behavior)
          try { await unlink(lockPath); } catch { /* ignore */ }
          return;
        }
        await new Promise<void>(r => setTimeout(r, retryDelay + Math.floor(Math.random() * 50)));
      } else {
        // Graceful degradation on non-EEXIST (match CJS state.cjs:889)
        return;
      }
    }
  }
}

private async releaseAdapterLock(lockPath: string): Promise<void> {
  this.lockSet.delete(lockPath);
  try { await unlink(lockPath); } catch { /* already gone */ }
}

private async isLockStale(lockPath: string): Promise<boolean> {
  try {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(lockPath, 'utf-8');
    const pid = parseInt(raw.trim(), 10);
    if (!Number.isFinite(pid) || pid <= 0) return true;
    try { process.kill(pid, 0); return false; } catch { return true; }
  } catch { return true; }
}
```

### Leak-grep SDK Write Pattern Extension

```javascript
// Source: extending existing scripts/leak-grep.cjs [VERIFIED: current file at lines 58-71]

// SDK fs-write patterns (.ts only; .planning/-scoped via Stage-2 filter)
// Phase 3: covers the SDK migration's write surface.
const SDK_FS_WRITE_PATTERNS = [
  { name: 'writeFile-async',    re: /\bawait\s+writeFile\s*\(/ },
  { name: 'writeFileSync',      re: /\bwriteFileSync\s*\(/ },
  { name: 'mkdirSync',          re: /\bmkdirSync\s*\(/ },
  { name: 'mkdir-async',        re: /\bawait\s+mkdir\s*\(/ },
  { name: 'unlinkSync',         re: /\bunlinkSync\s*\(/ },
  { name: 'unlink-async',       re: /\bawait\s+unlink\s*\(/ },
  { name: 'appendFileSync',     re: /\bappendFileSync\s*\(/ },
  { name: 'rename-async',       re: /\bawait\s+rename\s*\(/ },
  { name: 'rm-async',           re: /\bawait\s+rm\s*\(/ },
  { name: 'fs-write-import',    re: /\bimport\s+\{[^}]*\b(?:writeFile|mkdir|unlink|rename|rm|writeFileSync|mkdirSync|unlinkSync|appendFileSync)\b[^}]*\}\s+from\s+['"]node:fs(?:\/promises)?['"]/ },
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `readModifyWriteStateMd(projectDir, modifier)` | `adapter.withTransaction(() => { getRecord + transform + putRecord })` | Phase 3 | Every STATE.md write routes through adapter |
| `readModifyWriteRoadmapMd(projectDir, modifier)` | `adapter.withTransaction(() => { getRecord + transform + putRecord })` | Phase 3 | Every ROADMAP.md write routes through adapter |
| Direct `mkdir` + `writeFile(.gitkeep)` | `adapter.putRecord('phases/XX-slug/.gitkeep', '')` | Phase 3 | putRecord creates parent dirs automatically |
| Inline `acquireStateLock`/`releaseStateLock` | `adapter.withTransaction(fn)` | Phase 3 | Lock mechanism encapsulated in adapter |
| `capabilities.commitPlanningState: boolean` | Required method (no capability check) | Phase 3 | Simpler call sites; every adapter must implement |

**Deprecated/outdated after Phase 3:**
- `readModifyWriteStateMd` -- replaced by explicit `withTransaction` + adapter primitives (may keep as deprecated alias during migration)
- `readModifyWriteRoadmapMd` -- same
- `readModifyWriteStateMdFull` -- same
- `acquireStateLock` / `releaseStateLock` (as public exports from state-mutation.ts) -- internalized into MarkdownAdapter
- `hasCommitPlanningState` type guard -- removed since method is now required

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `stateUpdateProgress` splits into event (metrics table append) and non-event (field replacement) | Pitfall 3 | If treated as purely one category, either the table append or the field update gets wrong routing |
| A2 | A single adapter-level lock (`.adapter.lock`) suffices for all write serialization in MarkdownAdapter | Pattern 2 | If handlers need per-file locks for performance, the single-lock model creates unnecessary contention |
| A3 | `forensic_session` and `quick_task` event types exist as valid STATE.md append targets | Event Types | If these types aren't used by current handlers, the union has dead branches |
| A4 | `phaseComplete`'s REQUIREMENTS.md write inside the ROADMAP.md callback is acceptable within one `withTransaction` block | Pitfall 6 | If error semantics require partial-success (ROADMAP updated but REQUIREMENTS not), a single txn block changes behavior |
| A5 | `stateMilestoneSwitch` maps to `recordStateSignal({ type: 'milestone_switch' })` rather than non-event handler | Event Types | D-03 lists specific non-event handlers but doesn't mention milestoneSwitch; classification unclear |

## Open Questions

1. **Single lock vs per-file locks in withTransaction**
   - What we know: Current code uses per-file locks (`STATE.md.lock`, `ROADMAP.md.lock`). D-08 says `withTransaction` is ~50 LOC wrapping `acquireStateLock`/`releaseStateLock`.
   - What's unclear: Should `withTransaction` use a single adapter-wide lock (simpler, but more contention) or should it acquire locks for each file touched within the transaction?
   - Recommendation: Start with a single adapter-wide lock (simpler implementation matching D-08's ~50 LOC target). Multi-file transactions like `phaseComplete` already serialize all their writes in sequence within one lock hold. The contention cost is negligible for a CLI tool. Phase 5's `snapshot/restore` can revisit if needed.

2. **Classification of stateUpdateProgress**
   - What we know: The handler has TWO behaviors: (1) scan disk for plan/summary counts (read), (2) update the "Progress:" field in STATE.md (field replacement = non-event). It does NOT append to the Performance Metrics table.
   - What's unclear: Whether it should route through `recordStateMutation` (since it "mutates" a field value) or stay as a pure non-event handler using `updateFrontmatter` + field replacement.
   - Recommendation: Non-event handler per D-03 (it's a field update, not a list add/remove). `stateRecordMetric` is the one that appends to the Performance Metrics table.

3. **stateMilestoneSwitch classification**
   - What we know: It rewrites STATE.md frontmatter + body completely for a new milestone. D-03 mentions specific non-event handlers but doesn't explicitly list `stateMilestoneSwitch`.
   - What's unclear: Whether it's a signal event (`recordStateSignal({ type: 'milestone_switch' })`) or a non-event handler doing field updates.
   - Recommendation: Treat as non-event handler -- it does wholesale frontmatter reconstruction + body rewrite, not a simple signal. The signal family is for stateless flags (WAITING.json write/delete, metadata field update). MilestoneSwitch is a heavy mutation.

4. **Adapter signature for withTransaction -- void vs generic return**
   - What we know: Current interface declares `withTransaction(fn: () => Promise<void>): Promise<void>`. Handlers need to extract data from within the transaction (e.g., `let updated = false` set inside the callback).
   - What's unclear: Should `withTransaction` support `<T>(fn: () => Promise<T>): Promise<T>` for cleaner data extraction?
   - Recommendation: Change to generic `<T>(fn: () => Promise<T>): Promise<T>`. This avoids the ugly pattern of declaring mutable variables outside the callback and mutating them inside. The interface change is backward-compatible (void-returning callbacks still work). If the team prefers to keep the current `void` signature, handlers can use the existing mutable-variable-outside pattern.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x (project-local, already configured) |
| Config file | `vitest.conformance.config.ts` (exists) |
| Quick run command | `npm run test:conformance -- --testPathPattern write` |
| Full suite command | `npm run test:conformance` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WRITES-01 | 10 event handlers route through recordState* | conformance | `npm run test:conformance -- --testPathPattern write-events` | Wave 0 |
| WRITES-02 | 13 phase-lifecycle handlers use helpers over Bin A | conformance | `npm run test:conformance -- --testPathPattern phase-lifecycle` | Wave 0 |
| WRITES-03 | SDK helpers compose Bin A correctly | unit | `npx vitest run --config vitest.config.ts --testPathPattern phase-helpers` | Wave 0 |
| WRITES-04 | commitPlanningState creates identifiable save point | conformance | `npm run test:conformance -- --testPathPattern commit-planning` | Wave 0 |
| SC#1 | Zero writeFile/mkdir against .planning/ in SDK write surface | smoke | `node scripts/leak-grep.cjs sdk/src/query/state-mutation.ts sdk/src/query/phase-lifecycle.ts` | Extends existing |
| SC#3 | Byte-identical output with MarkdownAdapter mounted | integration | `npm run test:conformance -- --testPathPattern golden-write` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:conformance -- --testPathPattern write`
- **Per wave merge:** `npm run test:conformance && npm run test`
- **Phase gate:** Full suite green (`npm run test:conformance && npm run test`) + `node scripts/leak-grep.cjs sdk/src/query/`

### Wave 0 Gaps
- [ ] `tests/conformance/write-events.test.ts` -- covers WRITES-01 (event round-trips via recordStateAppend/Mutation/Signal)
- [ ] `tests/conformance/write-transaction.test.ts` -- covers withTransaction atomicity
- [ ] `tests/conformance/commit-planning-state.test.ts` -- covers WRITES-04 (stub: checkpoint creates identifiable marker)
- [ ] `tests/conformance/golden-write.test.ts` -- covers SC#3 (byte-identical output comparison)
- [ ] `sdk/src/query/phase-helpers.test.ts` -- covers WRITES-03 (unit tests for shared helpers)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | yes | Existing `assertNoNullBytes`, `assertSafePhaseDirName`, `assertSafeProjectCode`; carried forward unchanged |
| V6 Cryptography | no | -- |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via phase name | Tampering | `assertNoNullBytes` + `assertSafePhaseDirName` (already implemented; carried forward) |
| Lockfile race condition (TOCTOU) | Tampering | O_CREAT\|O_EXCL atomic create (already in `acquireStateLock`; carried forward into adapter) |
| Stale lock causing deadlock | Denial of Service | PID liveness check + 10s timeout heuristic (already implemented) |

## Sources

### Primary (HIGH confidence)
- `sdk/src/query/state-mutation.ts` -- 1712 LOC, all 18 handler implementations inspected
- `sdk/src/query/phase-lifecycle.ts` -- 1934 LOC, all 13 handler implementations inspected
- `adapters/types.ts` -- current StorageAdapter interface (101 LOC)
- `adapters/markdown/index.ts` -- current MarkdownAdapter implementation (421 LOC)
- `scripts/leak-grep.cjs` -- current leak detection patterns
- `sdk/src/query/index.ts` -- registry wiring showing which handlers are already adapter-aware vs not
- `.planning/phases/03-wire-core-write-methods-recordstateevent/03-CONTEXT.md` -- all locked decisions

### Secondary (MEDIUM confidence)
- `.planning/phases/01-fork-bootstrap-storageadapter-interface-skeleton-markdownada/01-CONTEXT.md` -- Phase 1 decisions (carry-forward)
- `.planning/phases/02-wire-core-read-methods-to-adapter/02-CONTEXT.md` -- Phase 2 patterns (established conventions)
- `tests/conformance/adapter.conformance.ts` -- existing conformance harness shape

### Tertiary (LOW confidence)
- None -- all findings derived from direct codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- this is an internal refactoring of existing code, no new external dependencies
- Architecture: HIGH -- patterns established by Phase 2, decisions locked in CONTEXT.md, all code surfaces inspected
- Pitfalls: HIGH -- derived from direct code analysis of the 31 handlers being migrated

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (stable internal architecture; no external dependency risk)
