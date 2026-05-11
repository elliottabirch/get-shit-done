# Phase 6: BeadsAdapter implementation - Pattern Map

**Mapped:** 2026-05-11
**Files analyzed:** 16 (2 fork-side modifications, 14 sibling-side new files)
**Analogs found:** 14 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `package.json` (fork) | config | - | `package.json` (current) | exact |
| `adapters/types.ts` (fork) | interface | - | `adapters/types.ts` (current) | exact |
| `~/code/gsd-beads/package.json` | config | - | `package.json` (fork) | role-match |
| `~/code/gsd-beads/tsconfig.json` | config | - | `adapters/tsconfig.json` | role-match |
| `~/code/gsd-beads/vitest.config.ts` | config | - | `vitest.conformance.config.ts` | role-match |
| `~/code/gsd-beads/README.md` | documentation | - | `adapters/markdown/README.md` (none exists) | no-analog |
| `~/code/gsd-beads/src/index.ts` | adapter-class | CRUD + event-driven | `adapters/markdown/index.ts` | exact |
| `~/code/gsd-beads/src/errors.ts` | error-class | - | `adapters/types.ts` (UnsupportedCapabilityError) | exact |
| `~/code/gsd-beads/src/format/state.ts` | transform | bidirectional | `adapters/markdown/index.ts` (extract/replace) | role-match |
| `~/code/gsd-beads/src/txn/staging-store.ts` | transaction | CRUD | `adapters/markdown/index.ts` (withTransaction) | role-match |
| `~/code/gsd-beads/src/init.ts` | initialization | probe | `adapters/markdown/index.ts` (constructor) | role-match |
| `~/code/gsd-beads/src/dep-graph.ts` | synthesizer | transform | None (new capability) | no-analog |
| `~/code/gsd-beads/src/bd-client.ts` | service | request-response | None (bd-specific) | no-analog |
| `~/code/gsd-beads/src/primitives/record.ts` | adapter-primitive | CRUD | `adapters/markdown/index.ts` (getRecord, putRecord) | exact |
| `~/code/gsd-beads/src/primitives/events.ts` | adapter-primitive | event-driven | `adapters/markdown/index.ts` (recordState*) | exact |
| `~/code/gsd-beads/tests/conformance.test.ts` | test | - | `tests/conformance/markdown.conformance.test.ts` | exact |

## Pattern Assignments

### `package.json` (fork) — add conformance subpath export

**Analog:** Current `package.json` structure (lines 1-75)

**Current structure** (lines 1-24):
```json
{
  "name": "get-shit-done-cc",
  "version": "1.39.0-rc.4",
  "files": [
    "bin",
    "commands",
    "get-shit-done",
    "agents",
    "hooks",
    "scripts",
    "sdk/src",
    "sdk/prompts",
    "sdk/dist",
    "sdk/package.json",
    "sdk/package-lock.json",
    "sdk/tsconfig.json",
    "adapters"
  ]
}
```

**Pattern to add:** Insert `exports` field after `files` array, before `keywords`:
```json
{
  "exports": {
    ".": "./bin/install.js",
    "./conformance": "./tests/conformance/adapter.conformance.js"
  }
}
```

**Also extend `files` array** to include `tests/conformance` so the conformance harness is published:
```json
{
  "files": [
    "bin",
    "commands",
    "get-shit-done",
    "agents",
    "hooks",
    "scripts",
    "sdk/src",
    "sdk/prompts",
    "sdk/dist",
    "sdk/package.json",
    "sdk/package-lock.json",
    "sdk/tsconfig.json",
    "adapters",
    "tests/conformance"
  ]
}
```

---

### `adapters/types.ts` (fork) — extend Capabilities with graphEdges

**Analog:** Current `Capabilities` interface (adapters/types.ts lines 54-65)

**Current interface:**
```typescript
export interface Capabilities {
  // Required core groups (D-05): true literal forces compile-time presence
  record: true;
  section: true;
  frontmatter: true;
  // Optional, closed enum of 5 (D-08; commitPlanningState promoted to required per D-12)
  binaryAsset: boolean;
  snapshot: boolean;
  transaction: boolean;
  namedDoc: boolean;
  markdownLockfile: boolean;
}
```

**Pattern to add:** Insert `graphEdges` field after `markdownLockfile` (additive change, D-OQ06-CAPS):
```typescript
export interface Capabilities {
  record: true;
  section: true;
  frontmatter: true;
  binaryAsset: boolean;
  snapshot: boolean;
  transaction: boolean;
  namedDoc: boolean;
  markdownLockfile: boolean;
  graphEdges: {
    semantic: boolean;
    dependency: boolean;
  };
}
```

**Update MarkdownAdapter capabilities** (adapters/markdown/index.ts lines 121-130):
```typescript
readonly capabilities: Capabilities = {
  record: true,
  section: true,
  frontmatter: true,
  binaryAsset: true,
  snapshot: true,
  transaction: true,
  namedDoc: true,
  markdownLockfile: true,
  graphEdges: {
    semantic: true,   // graphify.cjs produces semantic edges
    dependency: false, // markdown has no native dependency graph
  },
};
```

---

### `~/code/gsd-beads/src/index.ts` (adapter class, sibling-side)

**Analog:** `adapters/markdown/index.ts` (1452 lines)

**Imports pattern** (lines 21-37):
```typescript
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { existsSync, constants, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { readFile, writeFile, unlink, readdir, mkdir, stat as fsStat, open, rename, rm, mkdtemp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type {
  StorageAdapter,
  Capabilities,
  RecordRef,
  RecordFilter,
  SectionMode,
  NamedDocCategory,
  StateWriteOutcome,
} from '../types.js';
import { UnsupportedCapabilityError } from '../types.js';
import type { AppendEvent, MutationEvent, SignalEvent } from '../state-event-types.js';
```

**BeadsAdapter class structure** (adapt from MarkdownAdapter lines 116-158):
```typescript
export class BeadsAdapter implements StorageAdapter {
  readonly name = 'beads' as const;

  readonly capabilities: Capabilities = {
    record: true,
    section: true,
    frontmatter: true,
    binaryAsset: false,       // D-BINARY: skip-and-warn
    snapshot: true,            // D-TXN-CAPS: true only in Outcome B (staging-store)
    transaction: true,         // D-TXN-CAPS: true in both outcomes
    namedDoc: true,
    markdownLockfile: false,  // bd has no markdown lockfile primitives
    graphEdges: {
      semantic: false,         // D-OQ06: markdown-only pipeline
      dependency: true,        // D-OQ06: bd blocks/blocked-by native
    },
  };

  private readonly projectDir: string;
  private readonly planningBase: string;
  private activeTxn: TxnCtx | undefined;  // parallel to MarkdownAdapter

  constructor(projectDir: string) {
    this.projectDir = projectDir;
    this.planningBase = join(projectDir, '.planning');
    // Validate bd-managed state (see src/init.ts pattern below)
  }

  // Implement all StorageAdapter methods...
}
```

**Constructor validation pattern** (reference MarkdownAdapter lines 144-158 for pre-flight checks):
```typescript
constructor(projectDir: string) {
  this.projectDir = projectDir;
  this.planningBase = join(projectDir, '.planning');
  
  // Fail-fast validation (D-INIT-ERR)
  const bdDir = join(projectDir, '.bd');
  if (!existsSync(bdDir)) {
    throw new BdManagedMismatchError(
      projectDir,
      'Run `bd init` in this directory to initialize bd tracking.'
    );
  }
  
  // Optional: probe `bd status` exit code for deeper validation
}
```

---

### `~/code/gsd-beads/src/errors.ts` (error class, sibling-side)

**Analog:** `adapters/types.ts` UnsupportedCapabilityError pattern (lines 123-142)

**Error class with brand resilience:**
```typescript
export class BdManagedMismatchError extends Error {
  override readonly name = 'BdManagedMismatchError';
  readonly code = 'PROJECT_BD_MANAGED_MISMATCH' as const;
  readonly projectDir: string;
  readonly hint: string;
  readonly __brand = 'BdManagedMismatchError' as const;

  constructor(projectDir: string, hint: string) {
    super(`Project at '${projectDir}' is not bd-managed. ${hint}`);
    this.projectDir = projectDir;
    this.hint = hint;
  }

  static [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance != null &&
      typeof instance === 'object' &&
      (instance as Record<string, unknown>).__brand === 'BdManagedMismatchError'
    );
  }
}
```

**Why `__brand` + `[Symbol.hasInstance]`:** Cross-module instanceof resilience (dual-package hazard + vitest transform can break standard instanceof). Pattern established in adapters/types.ts lines 127-142.

---

### `~/code/gsd-beads/src/format/state.ts` (format module, sibling-side)

**Analog:** MarkdownAdapter's section extraction/replacement pattern (adapters/markdown/index.ts lines 189-241 heading-depth walker)

**Schema definition pattern** (authored, not auto-derived per D-MAPPING-SCHEMA):
```typescript
// Explicit TypeScript schema per canonical file (STATE.md)
export interface StateSchema {
  decisions: DecisionEntry[];
  blockers: BlockerEntry[];
  metrics: MetricEntry[];
  forensic_sessions: ForensicSessionPayload[];
  quick_tasks: QuickTaskPayload[];
  // ... additional L2 sections
}

export interface DecisionEntry {
  phase: string;
  summary: string;
  rationale?: string;
}

export interface BlockerEntry {
  text: string;
}

export interface MetricEntry {
  phase: string;
  plan: string;
  duration: string;
  tasks?: string;
  files?: string;
}
```

**Parse function pattern** (markdown → sub-records):
```typescript
export function parseStateMd(markdown: string): StateSchema {
  const frontmatter = extractFrontmatter(markdown);  // preserved
  const body = stripFrontmatter(markdown);
  
  // Extract L2 sections via heading-depth walker pattern
  const decisionsSection = extractSection(body, '## Decisions Made');
  const blockersSection = extractSection(body, '## Blockers');
  const metricsSection = extractSection(body, '## Performance Metrics');
  
  // Parse section content into structured entries
  const decisions = parseDecisionsList(decisionsSection);
  const blockers = parseBlockersList(blockersSection);
  const metrics = parseMetricsTable(metricsSection);
  
  // Runtime validation: assert every L2 heading in markdown has schema field
  // If unknown L2 heading encountered, throw UnknownSectionError
  
  return { decisions, blockers, metrics, /* ... */ };
}
```

**Render function pattern** (sub-records → markdown):
```typescript
export function renderStateMd(schema: StateSchema, frontmatter: Record<string, unknown>): string {
  let md = stringifyFrontmatter(frontmatter) + '\n\n';
  
  md += '## Decisions Made\n\n';
  for (const entry of schema.decisions) {
    md += `- [Phase ${entry.phase || '?'}]: ${entry.summary}`;
    if (entry.rationale) md += ` — ${entry.rationale}`;
    md += '\n';
  }
  
  md += '\n## Blockers\n\n';
  for (const entry of schema.blockers) {
    md += `- ${entry.text}\n`;
  }
  
  md += '\n## Performance Metrics\n\n';
  md += '| Phase/Plan | Duration | Tasks | Files |\n';
  md += '|-----------|----------|-------|-------|\n';
  for (const entry of schema.metrics) {
    md += `| Phase ${entry.phase} P${entry.plan} | ${entry.duration} | ${entry.tasks || '-'} tasks | ${entry.files || '-'} files |\n`;
  }
  
  return md;
}
```

**Heading-depth extraction pattern** (reference adapters/markdown/index.ts lines 189-241):
```typescript
// Extract L2 section content (## Foo) stopping at next L2 heading or EOF
function extractSection(body: string, heading: string): string | null {
  const regex = new RegExp(`(${heading}\\n)([\\s\\S]*?)(?=\\n##[^#]|$)`, 'i');
  const match = body.match(regex);
  return match ? match[2].trim() : null;
}

// Replace L2 section content (overwrite/append/prepend modes)
function replaceSection(body: string, heading: string, newContent: string, mode: SectionMode): string {
  const regex = new RegExp(`(${heading}\\n)([\\s\\S]*?)(?=\\n##[^#]|$)`, 'i');
  const match = body.match(regex);
  
  if (!match) {
    // Section absent — scaffold (mirrors Phase 3 UAT fix)
    return body + `\n\n${heading}\n\n${newContent}`;
  }
  
  const [fullMatch, headingPart, existingContent] = match;
  let updated: string;
  
  switch (mode) {
    case 'overwrite':
      updated = newContent;
      break;
    case 'append':
      updated = existingContent.trim() + '\n' + newContent;
      break;
    case 'prepend':
      updated = newContent + '\n' + existingContent.trim();
      break;
  }
  
  return body.replace(regex, `${headingPart}${updated}\n`);
}
```

**L3/L4 anchor-path concatenation** (for anchor-tagged comments per D-MAPPING):
```typescript
// Full heading path in anchor label to avoid ambiguity (Pitfall 4)
// Example: `gsd:section:## Investigation 2026-05-01:### Evidence`
function buildAnchorLabel(l2Heading: string, l3Heading?: string, l4Heading?: string): string {
  let label = `gsd:section:${l2Heading}`;
  if (l3Heading) label += `:${l3Heading}`;
  if (l4Heading) label += `:${l4Heading}`;
  return label;
}
```

---

### `~/code/gsd-beads/src/primitives/events.ts` (event families, sibling-side)

**Analog:** MarkdownAdapter's recordStateAppend/Mutation/Signal (adapters/markdown/index.ts lines 699-850)

**recordStateAppend pattern** (lines 699-788):
```typescript
async recordStateAppend(event: AppendEvent): Promise<StateWriteOutcome> {
  return this.withTransaction(async () => {
    const raw = (await this.getRecord('STATE.md')) ?? '';
    const schema = parseStateMd(raw);  // format module
    let result: { applied: boolean; body?: string; created_section?: string; reason?: string };
    
    switch (event.type) {
      case 'decision': {
        const { phase, summary, rationale } = event.payload;
        const newEntry = { phase, summary, rationale };
        
        // Discriminant dedupe: check if entry already exists
        const duplicate = schema.decisions.some(e => 
          e.phase === phase && e.summary === summary
        );
        if (duplicate) {
          return { applied: false, reason: 'duplicate' };
        }
        
        // Append to sub-record array (bd JSON field update)
        schema.decisions.push(newEntry);
        
        // Scaffold section if key was absent before
        const created = !schema.decisions.length ? '## Decisions Made' : undefined;
        
        result = { applied: true, body: raw, created_section: created };
        break;
      }
      
      case 'metric': {
        const { phase, plan, duration, tasks, files } = event.payload;
        const newEntry = { phase, plan, duration, tasks, files };
        
        // No dedupe for metrics (each entry is unique by phase+plan+time)
        schema.metrics.push(newEntry);
        
        const created = !schema.metrics.length ? '## Performance Metrics' : undefined;
        result = { applied: true, body: raw, created_section: created };
        break;
      }
      
      // ... remaining cases (roadmap_evolution, session, forensic_session, quick_task)
      
      default: {
        const _exhaustive: never = event;
        throw new Error(`Unknown AppendEvent type: ${(event as { type: string }).type}`);
      }
    }
    
    // Render schema back to markdown via format module
    const frontmatter = await this.getFrontmatter('STATE.md') as Record<string, unknown>;
    const rendered = renderStateMd(schema, frontmatter);
    
    // Map to bd sub-record update (bd CLI or node bindings)
    await this.bdClient.updateSubRecord('STATE.md', schema);
    
    return result.created_section
      ? { applied: true, created_section: result.created_section }
      : { applied: true };
  });
}
```

**StateWriteOutcome three-state contract** (adapters/types.ts lines 50-52):
```typescript
export type StateWriteOutcome =
  | { applied: true; created_section?: string }
  | { applied: false; reason: 'duplicate' | 'nothing_to_remove' };
```

**Discriminated dispatch pattern** (from adapters/state-event-types.ts):
```typescript
export type AppendEvent =
  | { type: 'decision'; payload: DecisionPayload }
  | { type: 'metric'; payload: MetricPayload }
  | { type: 'roadmap_evolution'; payload: RoadmapEvolutionPayload }
  | { type: 'session'; payload: SessionPayload }
  | { type: 'forensic_session'; payload: ForensicSessionPayload }
  | { type: 'quick_task'; payload: QuickTaskPayload };
```

**recordStateMutation pattern** (lines 796-850):
```typescript
async recordStateMutation(event: MutationEvent): Promise<StateWriteOutcome> {
  return this.withTransaction(async () => {
    const raw = (await this.getRecord('STATE.md')) ?? '';
    const schema = parseStateMd(raw);
    let result: { applied: boolean; body?: string; created_section?: string; reason?: string };
    
    switch (event.type) {
      case 'blocker_added': {
        const { text } = event.payload;
        const entry = { text };
        
        // Append to blockers array
        schema.blockers.push(entry);
        
        const created = !schema.blockers.length ? '## Blockers' : undefined;
        result = { applied: true, body: raw, created_section: created };
        break;
      }
      
      case 'blocker_resolved': {
        const { text } = event.payload;
        
        // Remove from blockers array by discriminant
        const idx = schema.blockers.findIndex(e => e.text === text);
        if (idx === -1) {
          return { applied: false, reason: 'nothing_to_remove' };
        }
        
        schema.blockers.splice(idx, 1);
        result = { applied: true, body: raw };
        break;
      }
      
      case 'deferred_items': {
        const { items, action } = event.payload;
        
        if (action === 'add') {
          // Dedupe: only add items not already present
          const existing = new Set(schema.deferred_items || []);
          const newItems = items.filter(i => !existing.has(i));
          
          if (newItems.length === 0) {
            return { applied: false, reason: 'duplicate' };
          }
          
          schema.deferred_items = [...(schema.deferred_items || []), ...newItems];
          const created = !existing.size ? '## Deferred Items' : undefined;
          result = { applied: true, body: raw, created_section: created };
        } else {
          // action === 'remove'
          const existing = new Set(schema.deferred_items || []);
          const toRemove = items.filter(i => existing.has(i));
          
          if (toRemove.length === 0) {
            return { applied: false, reason: 'nothing_to_remove' };
          }
          
          schema.deferred_items = (schema.deferred_items || []).filter(i => !items.includes(i));
          result = { applied: true, body: raw };
        }
        break;
      }
      
      // ... remaining cases
      
      default: {
        const _exhaustive: never = event;
        throw new Error(`Unknown MutationEvent type: ${(event as { type: string }).type}`);
      }
    }
    
    // Render + update bd sub-record
    const frontmatter = await this.getFrontmatter('STATE.md') as Record<string, unknown>;
    const rendered = renderStateMd(schema, frontmatter);
    await this.bdClient.updateSubRecord('STATE.md', schema);
    
    return result.created_section
      ? { applied: true, created_section: result.created_section }
      : { applied: true };
  });
}
```

---

### `~/code/gsd-beads/src/txn/staging-store.ts` (transaction, sibling-side)

**Analog:** MarkdownAdapter's withTransaction + reentrant guard (adapters/markdown/index.ts lines 563-657)

**Transaction context interface** (lines 84-93):
```typescript
interface TxnCtx {
  tmpDir: string;           // staging bd store path
  touchedPaths: Set<string>;
  removedPaths: Set<string>;
  dryRun: boolean;
  depth: number;            // track nesting for reentrant guard
}
```

**withTransaction pattern** (lines 563-657):
```typescript
async withTransaction<T>(fn: () => Promise<T>, dryRun = false): Promise<T> {
  // D-10: reentrant guard — if this adapter instance already holds a txn,
  // same-PID reentry would deadlock. Return immediately; outer txn owns the lock.
  if (this.activeTxn) {
    this.activeTxn.depth += 1;  // track nesting depth for debug
    return fn();  // execute in outer txn context; no acquire/release
  }
  
  const lockPath = join(this.planningBase, '.adapter-lock');
  const tmpDir = await mkdtemp(join(tmpdir(), 'beads-txn-'));
  
  const ctx: TxnCtx = {
    tmpDir,
    touchedPaths: new Set(),
    removedPaths: new Set(),
    dryRun,
    depth: 1,
  };
  
  this.activeTxn = ctx;
  await this.acquireAdapterLock(lockPath);
  
  let succeeded = false;
  try {
    const result = await fn();
    succeeded = true;
    
    // Outcome B: commit = atomic bead-hash bookmark swap
    // Outcome A: commit = sequential bd issue edits
    if (!ctx.dryRun) {
      await this._commitStagingStore(ctx);  // Outcome B
      // OR: await this._applyWriteBuffer(ctx);  // Outcome A
    }
    
    return result;
  } finally {
    try { await rm(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
    this.activeTxn = undefined;
    await this.releaseAdapterLock(lockPath);
  }
}
```

**Lock acquisition with reentrant guard** (lines 563-598):
```typescript
private async acquireAdapterLock(lockPath: string): Promise<void> {
  // D-10: reentrant guard — if this adapter instance already holds a txn,
  // same-PID reentry would deadlock on O_EXCL. Return immediately; the outer
  // txn owns the lock. No fs-lock acquired.
  if (this.activeTxn) return;

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
        const dead = await this.isLockStale(lockPath);
        if (dead) {
          try { await unlink(lockPath); } catch { /* race OK */ }
          continue;
        }
        if (i === maxRetries - 1) {
          // Force-break on last retry (matches CJS state.cjs behavior)
          try { await unlink(lockPath); } catch { /* ignore */ }
          return;
        }
        await new Promise<void>(r => setTimeout(r, retryDelay + Math.floor(Math.random() * 50)));
      } else {
        // Graceful degradation on non-EEXIST errors
        return;
      }
    }
  }
}
```

**Staging-store commit pattern (Outcome B)** (lines 614-638):
```typescript
private async _commitStagingStore(ctx: TxnCtx): Promise<void> {
  // 1) Apply removes first (so touchedPaths can recreate if needed).
  for (const relPath of ctx.removedPaths) {
    // bd-specific: delete issue or sub-record
    await this.bdClient.deleteIssue(relPath);
  }
  
  // 2) Apply writes via bd store-clone + bead-hash bookmark swap
  //    (atomic cutover from staging store to real store)
  const stagingStorePath = ctx.tmpDir;
  const realStorePath = join(this.projectDir, '.bd');
  
  // Atomic bookmark swap: point canonical bookmark at staging store's bead-hash
  const stagingHash = await this.bdClient.getBdStoreHash(stagingStorePath);
  await this.bdClient.setBookmark('main', stagingHash);
  
  // OR for Outcome A fallback (in-memory write-buffer):
  // Sequential apply (not atomic across multiple issues)
  // for (const relPath of ctx.touchedPaths) {
  //   const content = await readFile(join(ctx.tmpDir, relPath), 'utf-8');
  //   await this.bdClient.updateIssue(relPath, content);
  // }
}
```

---

### `~/code/gsd-beads/src/primitives/record.ts` (record primitives, sibling-side)

**Analog:** MarkdownAdapter's getRecord/putRecord/removeRecord (adapters/markdown/index.ts lines 191-256)

**getRecord pattern** (lines 191-199):
```typescript
async getRecord(path: string): Promise<string | null> {
  const abs = await this.resolveRead(path);
  try {
    // bd-specific: compose sub-records + comments into markdown body
    const issue = await this.bdClient.getIssue(path);
    if (!issue) return null;
    
    const schema = issue.subRecords;  // L2 sub-records as JSON
    const comments = issue.comments;  // L3/L4 anchor-tagged comments
    
    // Format module composes into markdown
    const rendered = renderStateMd(schema, issue.frontmatter);
    return rendered;
  } catch (err) {
    if ((err as any).code === 'ISSUE_NOT_FOUND') return null;
    throw err;
  }
}
```

**putRecord pattern** (lines 201-205):
```typescript
async putRecord(path: string, body: string): Promise<void> {
  const abs = this.resolveWrite(path);
  
  // Parse markdown into sub-records + comments via format module
  const schema = parseStateMd(body);
  const frontmatter = extractFrontmatter(body);
  
  // bd-specific: create or update issue with sub-records
  await this.bdClient.createOrUpdateIssue(path, {
    subRecords: schema,
    frontmatter,
  });
}
```

**removeRecord pattern** (lines 207-223):
```typescript
async removeRecord(path: string): Promise<void> {
  if (this.activeTxn) {
    this.activeTxn.removedPaths.add(path);
    this.activeTxn.touchedPaths.delete(path);
    return;
  }
  
  // bd-specific: delete issue
  try {
    await this.bdClient.deleteIssue(path);
  } catch (err) {
    if ((err as any).code === 'ISSUE_NOT_FOUND') return;
    throw err;
  }
}
```

**resolveRead/resolveWrite pattern** (lines 165-187 — transaction-aware path resolution):
```typescript
private resolveWrite(relPath: string): string {
  if (this.activeTxn) {
    this.activeTxn.touchedPaths.add(relPath);
    this.activeTxn.removedPaths.delete(relPath);  // a write un-removes
    return join(this.activeTxn.tmpDir, relPath);  // staging store path
  }
  return join(this.planningBase, relPath);  // real store path
}

private async resolveRead(relPath: string): Promise<string> {
  if (this.activeTxn) {
    if (this.activeTxn.removedPaths.has(relPath)) {
      // Caller removed this in-txn; reads should see it as absent
      return join(this.activeTxn.tmpDir, '.__REMOVED__', relPath);
    }
    const shadowPath = join(this.activeTxn.tmpDir, relPath);
    if (existsSync(shadowPath)) return shadowPath;  // staging-over-real merge
  }
  return join(this.planningBase, relPath);
}
```

---

### `~/code/gsd-beads/tests/conformance.test.ts` (conformance harness, sibling-side)

**Analog:** `tests/conformance/markdown.conformance.test.ts` (lines 1-10)

**Conformance harness invocation pattern:**
```typescript
import { describe } from 'vitest';
import { runAdapterConformanceSuite } from 'get-shit-done/conformance';
import { BeadsAdapter } from '../src/index.js';

// Phase 6 runs sibling-only smoke tests. Phase 7 runs full paired suite.
runAdapterConformanceSuite('beads', (projectDir) => new BeadsAdapter(projectDir));
```

**Factory signature** (locked per Phase 1 D-15, tests/conformance/adapter.conformance.ts lines 24-27):
```typescript
export function runAdapterConformanceSuite(
  adapterName: string,
  adapterFactory: (projectDir: string) => StorageAdapter,
): void {
  describe(`StorageAdapter conformance: ${adapterName}`, () => {
    // ... test cases
  });
}
```

**Test structure pattern** (tests/conformance/adapter.conformance.ts lines 28-55):
```typescript
describe(`StorageAdapter conformance: ${adapterName}`, () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-conform-'));
    // Pre-create .planning/ since adapter constructor calls planningDir(projectDir)
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

    it('getRecord returns null for non-existent path', async () => {
      const result = await adapter.getRecord('NONEXISTENT.md');
      expect(result).toBeNull();
    });
  });
});
```

---

## Shared Patterns

### Authentication / Initialization Validation
**Source:** `adapters/markdown/index.ts` constructor (lines 144-158)
**Apply to:** `~/code/gsd-beads/src/index.ts` constructor
```typescript
constructor(projectDir: string) {
  this.projectDir = projectDir;
  this.planningBase = join(projectDir, '.planning');
  
  // Fail-fast validation: probe bd-managed state
  const bdDir = join(projectDir, '.bd');
  if (!existsSync(bdDir)) {
    throw new BdManagedMismatchError(
      projectDir,
      'Run `bd init` in this directory to initialize bd tracking.'
    );
  }
  
  // Optional deeper probe: `bd status` shell-out, check exit code
}
```

### Error Handling — UnsupportedCapabilityError
**Source:** `adapters/types.ts` (lines 123-142)
**Apply to:** All BeadsAdapter methods for unsupported capabilities
```typescript
async writeBinaryAsset(path: string, bytes: Uint8Array): Promise<void> {
  // D-BINARY: capabilities.binaryAsset = false
  throw new UnsupportedCapabilityError('binaryAsset', this.name);
}

async snapshot(): Promise<string> {
  // D-TXN-CAPS: capabilities.snapshot = false in Outcome A fallback
  if (!this.capabilities.snapshot) {
    throw new UnsupportedCapabilityError('snapshot', this.name);
  }
  // Outcome B: implement snapshot via bd store-clone
}
```

### StateWriteOutcome Consistency
**Source:** `adapters/types.ts` (lines 50-52)
**Apply to:** All three `recordState*` methods in BeadsAdapter
```typescript
// ALWAYS return discriminated StateWriteOutcome, never Promise<void>
export type StateWriteOutcome =
  | { applied: true; created_section?: string }
  | { applied: false; reason: 'duplicate' | 'nothing_to_remove' };

// Example in recordStateAppend:
if (duplicate) {
  return { applied: false, reason: 'duplicate' };
}

if (sectionScaffolded) {
  return { applied: true, created_section: '## Decisions Made' };
}

return { applied: true };
```

### Reentrant Transaction Guard
**Source:** `adapters/markdown/index.ts` acquireAdapterLock (lines 563-567)
**Apply to:** `~/code/gsd-beads/src/txn/staging-store.ts` withTransaction entry
```typescript
async withTransaction<T>(fn: () => Promise<T>, dryRun = false): Promise<T> {
  // Reentrant guard: if activeTxn exists, JOIN outer txn (no new lock)
  if (this.activeTxn) {
    this.activeTxn.depth += 1;
    return fn();  // execute in outer txn context
  }
  
  // Outer txn: acquire lock, create staging context
  // ...
}
```

### Discriminated Union Exhaustiveness Check
**Source:** `adapters/markdown/index.ts` recordStateAppend (lines 762-765)
**Apply to:** All event dispatcher switch statements
```typescript
switch (event.type) {
  case 'decision': /* ... */ break;
  case 'metric': /* ... */ break;
  // ... all event types
  default: {
    const _exhaustive: never = event;
    throw new Error(`Unknown AppendEvent type: ${(event as { type: string }).type}`);
  }
}
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns or design from scratch):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `~/code/gsd-beads/README.md` | documentation | - | No existing adapter README to reference; document D-TXN variant (A or B), sidecar path-sniff map, gsd:* label namespace, export shape |
| `~/code/gsd-beads/src/dep-graph.ts` | synthesizer | transform | New capability (dependency edges from bd blocks-edges); no MarkdownAdapter analog; depends on bd CLI `bd blocks <issue>` output + graphify.cjs schema for graphs/graph.json |
| `~/code/gsd-beads/src/bd-client.ts` | service | request-response | bd-specific CLI wrapper or node bindings; shell-out pattern can reference MarkdownAdapter's CJS shim via `createRequire`, but bd commands are unique |

---

## Metadata

**Analog search scope:** 
- `adapters/` (types, markdown implementation, state-event-types)
- `tests/conformance/` (harness, write-outcome tests)
- Root `package.json` (fork structure)

**Files scanned:** 8 (types.ts, markdown/index.ts, state-event-types.ts, adapter.conformance.ts, write-outcome.test.ts, markdown.conformance.test.ts, package.json, vitest.conformance.config.ts)

**Pattern extraction date:** 2026-05-11

**Key insights:**
- **StateWriteOutcome three-state contract** is the primary semantic bridge from MarkdownAdapter to BeadsAdapter — every event handler MUST return discriminated outcome (lines 50-52 in types.ts)
- **Reentrant transaction guard** (lines 563-567 in markdown/index.ts) prevents deadlock when `recordState*` methods call `updateSection` which also wraps `withTransaction`
- **Format module bidirectional transform** is the abstraction for hybrid L2 sub-records + L3/L4 anchor-comments mapping — one schema per canonical file, authored not auto-derived
- **Brand-based instanceof resilience** (lines 127-142 in types.ts) survives dual-package hazard + vitest transform issues — apply to BdManagedMismatchError
- **Heading-depth walker pattern** (lines 189-241 in markdown/index.ts) handles L2/L3/L4 nesting + skips headings in fenced code blocks — reference for BeadsAdapter's anchor-path logic
