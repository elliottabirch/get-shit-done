# Phase 1: Fork bootstrap + StorageAdapter interface skeleton + MarkdownAdapter scaffold — Research

**Researched:** 2026-04-30
**Domain:** TypeScript adapter-interface design, CJS-to-TS bridging via createRequire, dependency injection into registry factory
**Confidence:** HIGH (codebase verified directly; upstream PRs classified by code inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Module layout):** StorageAdapter interface and MarkdownAdapter live at top-level `adapters/` (e.g. `adapters/types.ts`, `adapters/markdown/`), outside `sdk/`. Third-party adapters import from this clean path, not internal SDK shapes.
- **D-02 (Scaffold delegation):** MarkdownAdapter wraps existing CJS via `createRequire`. Each TS adapter method calls into the corresponding helper in `get-shit-done/bin/lib/*.cjs`.
- **D-03 (Lifecycle):** Sync constructor only. `StorageAdapter` declares no `init()` / `teardown()` methods in v1.0.
- **D-04 (Path shape):** Methods take `.planning/`-relative paths. Adapter holds `projectDir` internally and resolves. Logical refs deferred.
- **D-05 (Required core capability groups):** Three groups always required (`true` literal): `record`, `section`, `frontmatter`.
- **D-06 (Adapter identity):** `adapter.name: string`. No `version`, no `sdkApiVersion`.
- **D-07 (createRegistry DI signature):** `createRegistry({adapter})` requires explicit adapter parameter — no default, no fallback. Every existing zero-arg call site updates in Phase 1.
- **D-08 (Optional capability enum — closed, 6 entries):** `binaryAsset`, `snapshot`, `transaction`, `namedDoc`, `commitPlanningState`, `markdownLockfile`.
- **D-09 (OQ-08 resolution):** `replaceInCurrentMilestone` and `readModifyWriteRoadmapMd` are PUBLIC on the StorageAdapter interface, capability-gated by `markdownLockfile`.
- **D-10 (Phase 1 interface declares full v1.0 surface):** Interface file declares every v1.0 method. MarkdownAdapter implements Bin A + `markdownLockfile` + `commitPlanningState` in Phase 1. Remaining foundational methods throw `UnsupportedCapabilityError`.
- **D-11 (Optional method shape — companion type guards):** Capability-gated methods are required on the interface (no `?:`). Each capability group ships a companion type guard.
- **D-12 (ADAPTER-05 reconciliation artifact):** Per-PR ADRs appended to `.planning/DECISIONS.md` — D-YYYY-MM-DD-07 through D-YYYY-MM-DD-10.
- **D-13 (Strict-superset validation in Phase 1):** Phase 1's CI job runs fork's existing test suite with MarkdownAdapter wired in. Empirical match against upstream's #2909 is Phase 8 (DIST-04).
- **D-14 (Leak-grep rebase script scope):** `scripts/leak-grep.mjs` or similar covering Rubric R5 patterns plus `<context>`-block detection.
- **D-15 (Conformance harness skeleton + 1 sample test):** `tests/conformance/` with test factory + one `getRecord` round-trip test against MarkdownAdapter.

### Claude's Discretion

- Internal layout under `adapters/markdown/` (one file vs. one file per capability group)
- Exact `UnsupportedCapabilityError` shape and inheritance chain
- TypeScript type-guard authoring style (named functions vs. inline predicates)
- Whether the leak-grep script is `.mjs` / `.cjs` / shell — pick what matches existing `scripts/` style
- Test framework wiring details for conformance (vitest config additions)

### Deferred Ideas (OUT OF SCOPE)

- Logical-ref shape for Bin A methods
- BeadsAdapter shape & capability mapping
- Empirical strict-superset proof against upstream's #2909 golden parity matrix
- Lifecycle methods (`init()` / `teardown()`) on StorageAdapter
- Open-record/string-keyed capabilities
- Bin B method signatures on the v1.0 interface
- CI gate enforcement for the leak-grep script
- PR-vs-long-lived-fork distribution decision

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADAPTER-01 | StorageAdapter TypeScript interface defines 10 Bin A primitives | §4 of SYNTHESIS.md is the canonical source; verified signatures reproduced in Code Examples below |
| ADAPTER-02 | Adapter exposes `capabilities` flag for optional method support | D-05/D-08 locked the shape; D-2026-04-30-05 provides the TS sketch |
| ADAPTER-03 | MarkdownAdapter scaffold implements interface by delegating to today's `node:fs` code, zero behavior change | createRequire pattern confirmed in `state-project-load.ts`; CJS surface mapped below |
| ADAPTER-04 | `createRegistry({adapter})` wired in index.js via dependency injection | 4 production call sites identified; signature change strategy documented below |
| ADAPTER-05 | Upstream PRs #2898/#2901/#2908/#2909 investigated and reconciled | All four classified; ADR verdicts in Upstream PR Classification section |
| ADAPTER-06 | Module layout decided | D-01 locked: top-level `adapters/` |
| ADAPTER-07 | Markdown-and-lockfile helpers visibility decision locked (OQ-08) | D-09 locked: public, capability-gated by `markdownLockfile` |

</phase_requirements>

---

## Summary

Phase 1 ships the adapter contract that gates Phases 2-8. The research confirms the codebase is in a tractable state for this work: the `createRequire` bridging pattern already exists in `state-project-load.ts` and can be copied verbatim for the MarkdownAdapter's CJS delegation. The `createRegistry()` factory has exactly four production call sites (not counting tests) that need the new `{adapter}` parameter — manageable in a single wave. The `adapters/` directory does not yet exist; Phase 1 creates it from scratch.

The four upstream PRs land in distinct layers. PR #2898 (PlanningRuntime/PlanningJournal) is an append-only JSONL journal for plan events — entirely separate from `.planning/` file storage and orthogonal to our adapter seam. PR #2901 (planning-workspace seam) extracted path resolution into `planning-workspace.cjs` and is already present in the `get-shit-done/bin/lib/` directory — this is a useful sub-seam that MarkdownAdapter can import directly when computing `.planning/`-relative paths. PR #2908 (manifest-backed routing seam) adds a typed command manifest and alias generation — it affects the registry layer that Phase 1 modifies, requiring the new `createRegistry({adapter})` call to preserve manifest registration coverage. PR #2909 (golden parity matrix) adds integration tests against the CJS layer; per D-13, these are deferred to Phase 8.

The scripts directory uses `.cjs` exclusively (no `.mjs` files found). The leak-grep script should therefore be `.cjs` to match existing conventions. The conformance harness should use vitest (already the SDK test framework) with a test factory function pattern.

**Primary recommendation:** Wire the interface and MarkdownAdapter scaffold as a pure TypeScript layer at `adapters/`, with MarkdownAdapter importing CJS helpers via `createRequire` following the exact pattern in `state-project-load.ts`. Modify `createRegistry()` last (it unblocks CI).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| StorageAdapter interface definition | TypeScript module (`adapters/`) | — | Public contract consumed by SDK and third-party adapters |
| MarkdownAdapter implementation | TypeScript module (`adapters/markdown/`) | CJS helpers (`get-shit-done/bin/lib/*.cjs`) | TS seam delegates to existing CJS; CJS stays untouched |
| Registry dependency injection | SDK factory (`sdk/src/query/index.ts`) | — | `createRegistry` is the single construction point |
| Path resolution | `adapters/` + `planning-workspace.cjs` | — | `planningDir()` from planning-workspace.cjs already owns this |
| Conformance test harness | `tests/conformance/` | SDK vitest config | Factory pattern: adapter in → assertions run |
| Leak-grep detection script | `scripts/leak-grep.cjs` | — | Matches existing scripts/ style (.cjs only, no .mjs) |
| Per-PR ADR records | `.planning/DECISIONS.md` | — | D-12: four new entries appended |
| CJS legacy I/O layer | `get-shit-done/bin/lib/*.cjs` | — | Not modified; wrapped only |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.7.x | Type system for interface + adapter | Already the SDK language; `tsconfig.json` at `sdk/tsconfig.json` — ES2022 target, NodeNext module resolution [VERIFIED: sdk/package.json] |
| vitest | 4.1.5 | Test framework for conformance harness | Already the SDK test framework; configured in `sdk/vitest.config.ts` [VERIFIED: sdk/package.json] |
| Node.js `createRequire` | built-in | CJS bridging from TS adapter | Pattern already in `state-project-load.ts`; no additional dependencies needed [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:module` | built-in | Provides `createRequire` for CJS bridging | Inside MarkdownAdapter wherever wrapping a CJS export |
| `node:path` | built-in | Path resolution for `.planning/`-relative paths | In MarkdownAdapter constructor and all method implementations |
| `node:fs/promises` | built-in | Direct filesystem access for methods without a CJS analog | Any Bin A primitive not covered by existing CJS helpers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `createRequire` bridging | Port CJS to TS directly | Porting is a larger diff and increases rebase risk; D-02 explicitly chose the wrapper approach for minimal Phase 1 surface |
| Top-level `adapters/` | `sdk/src/storage/` | D-01 chose `adapters/` for clean public seam; `sdk/src/` would couple third-party adapters to SDK internals |
| `.cjs` for leak-grep | `.mjs` or shell | `scripts/` directory contains only `.cjs` files; no `.mjs` files exist [VERIFIED: directory listing] |

---

## Architecture Patterns

### System Architecture Diagram

```
Project root
├── adapters/
│   ├── types.ts          → StorageAdapter interface + UnsupportedCapabilityError
│   │                        + companion type guards (hasSnapshot, hasTransaction, ...)
│   └── markdown/
│       └── index.ts      → MarkdownAdapter class (createRequire → *.cjs)
│
├── sdk/src/query/
│   └── index.ts          → createRegistry({adapter}) — DI entry point
│                            (signature change: adapter param required, no default)
│
├── get-shit-done/bin/lib/
│   ├── core.cjs          → loadConfig, findPhaseInternal, replaceInCurrentMilestone,
│   │                        readModifyWriteRoadmapMd (MarkdownAdapter wraps these)
│   ├── state.cjs         → readModifyWriteStateMd, cmdStateJson, cmdStateLoad
│   ├── phase.cjs         → cmdFindPhase, cmdPhasesList, cmdPhasePlanIndex
│   ├── roadmap.cjs       → cmdRoadmapAnalyze, cmdRoadmapGetPhase
│   ├── frontmatter.cjs   → cmdFrontmatterGet, cmdFrontmatterSet, cmdFrontmatterMerge
│   └── planning-workspace.cjs → planningDir() (path resolver — MarkdownAdapter uses)
│
├── tests/conformance/
│   └── adapter.conformance.ts → test factory: (adapter: StorageAdapter) => void
│
└── scripts/
    └── leak-grep.cjs     → R5 + <context>-block scanner

Data flow (Phase 1, read path):
  Workflow calls gsd-sdk query → cli.ts → createRegistry({adapter})
  → registry.dispatch('state.json', args, projectDir)
  → state.ts handler → (Phase 1: still direct CJS; Phase 2 migrates to adapter.getRecord)
  [Note: Phase 1 wires createRegistry DI but handlers do NOT yet call adapter.* —
   that is Phase 2's job. Phase 1 makes the plumbing exist.]
```

### Recommended Project Structure
```
adapters/
├── types.ts              # StorageAdapter interface + UnsupportedCapabilityError
└── markdown/
    └── index.ts          # MarkdownAdapter class

tests/conformance/
├── adapter.conformance.ts  # test factory function
└── markdown.conformance.test.ts  # runs factory against new MarkdownAdapter

scripts/
└── leak-grep.cjs         # R5 + <context>-block scanner
```

### Pattern 1: createRequire CJS Bridge (from `state-project-load.ts`)

This is the canonical pattern. MarkdownAdapter copies it for every CJS delegation.

```typescript
// Source: sdk/src/query/state-project-load.ts (VERIFIED: codebase)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const BUNDLED_CORE_CJS = fileURLToPath(
  new URL('../../../get-shit-done/bin/lib/core.cjs', import.meta.url),
);

function resolveCoreCjsPath(projectDir: string): string | null {
  const candidates = [
    BUNDLED_CORE_CJS,
    join(projectDir, '.claude', 'get-shit-done', 'bin', 'lib', 'core.cjs'),
    join(homedir(), '.claude', 'get-shit-done', 'bin', 'lib', 'core.cjs'),
  ];
  return candidates.find(p => existsSync(p)) ?? null;
}

const req = createRequire(import.meta.url);
const { loadConfig } = req(corePath) as { loadConfig: (cwd: string) => Record<string, unknown> };
```

**Adaptation for MarkdownAdapter:** The three-candidate resolution array should be reused. MarkdownAdapter holds a `projectDir: string` in its constructor and resolves paths from there. Each CJS call is wrapped in a method. Errors from CJS surface as thrown values — MarkdownAdapter should translate these to `GSDError` (or let them propagate, since the callers already expect errors from these paths).

### Pattern 2: StorageAdapter Interface Shape (from SYNTHESIS §4 + CONTEXT.md decisions)

```typescript
// Source: SYNTHESIS.md §4 + CONTEXT.md D-05/D-08/D-09/D-10/D-11 [VERIFIED: planning docs]
interface StorageAdapter {
  name: string;  // D-06: diagnostic only, not for behavior branching

  capabilities: {
    // Required groups (true literal — missing = type error, not runtime)
    record: true;
    section: true;
    frontmatter: true;
    // Optional (6 entries, closed — D-08)
    binaryAsset: boolean;
    snapshot: boolean;
    transaction: boolean;
    namedDoc: boolean;
    commitPlanningState: boolean;
    markdownLockfile: boolean;  // D-09: OQ-08 resolved here
  };

  // Bin A — record group (required)
  getRecord(path: string): Promise<string | null>;
  putRecord(path: string, body: string): Promise<void>;
  removeRecord(path: string): Promise<void>;
  listCollection(prefix: string, filter?: RecordFilter): Promise<RecordRef[]>;
  exists(path: string): Promise<boolean>;

  // Bin A — section group (required)
  getSection(path: string, anchor: string): Promise<string | null>;
  updateSection(path: string, anchor: string, body: string, mode: 'overwrite' | 'append' | 'prepend'): Promise<void>;

  // Bin A — frontmatter group (required)
  getFrontmatter(path: string, field?: string): Promise<unknown>;
  updateFrontmatter(path: string, field: string, value: unknown): Promise<void>;
  mergeFrontmatter(path: string, patch: Record<string, unknown>): Promise<void>;

  // Optional — markdownLockfile group (D-09)
  replaceInCurrentMilestone(pattern: string | RegExp, replacement: string): Promise<void>;
  readModifyWriteRoadmapMd(mutator: (content: string) => string): Promise<void>;

  // Foundational primitives — declared in Phase 1, implemented in Phase 5 (throw UnsupportedCapabilityError in Phase 1)
  writeBinaryAsset(path: string, bytes: Uint8Array): Promise<void>;
  snapshot(): Promise<string>;  // returns snapshot ID
  restore(snapshotId: string): Promise<void>;
  withTransaction(fn: () => Promise<void>): Promise<void>;
  putNamedDoc(category: string, key: string, body: string): Promise<void>;
  getNamedDoc(category: string, key: string): Promise<string | null>;
  commitPlanningState(message: string, files?: string[]): Promise<void>;
}
```

### Pattern 3: Companion Type Guards (D-11)

```typescript
// Source: CONTEXT.md D-11 [VERIFIED: planning docs]
function hasSnapshot(a: StorageAdapter):
    a is StorageAdapter & { capabilities: { snapshot: true } } {
  return a.capabilities.snapshot;
}

function hasMarkdownLockfile(a: StorageAdapter):
    a is StorageAdapter & { capabilities: { markdownLockfile: true } } {
  return a.capabilities.markdownLockfile;
}

// Pattern for all 6 optional capability groups (binaryAsset, snapshot,
// transaction, namedDoc, commitPlanningState, markdownLockfile)
```

### Pattern 4: UnsupportedCapabilityError

Modeled after existing `GSDError`. Phase 1 introduces a subclass:

```typescript
// Source: sdk/src/errors.ts pattern [VERIFIED: codebase]
export class UnsupportedCapabilityError extends Error {
  readonly name = 'UnsupportedCapabilityError';
  readonly capability: string;
  readonly adapterName: string;

  constructor(capability: string, adapterName: string) {
    super(`Adapter '${adapterName}' does not support capability '${capability}'`);
    this.capability = capability;
    this.adapterName = adapterName;
  }
}
```

Where to define it: inside `adapters/types.ts` alongside the interface, so consumers import both from the same path.

### Pattern 5: createRegistry Signature Change

Current signature (`sdk/src/query/index.ts` line 273):
```typescript
export function createRegistry(
  eventStream?: GSDEventStream,
  correlationSessionId?: string,
): QueryRegistry
```

New signature (D-07):
```typescript
export function createRegistry(opts: {
  adapter: StorageAdapter;
  eventStream?: GSDEventStream;
  correlationSessionId?: string;
}): QueryRegistry
```

**Why object parameter:** Avoids positional ambiguity as the adapter is mandatory but the others remain optional.

### Pattern 6: Conformance Harness Factory

```typescript
// Modeled on vitest parameterized test patterns [ASSUMED — no prior conformance harness exists]
// tests/conformance/adapter.conformance.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StorageAdapter } from '../../adapters/types.js';

export function runAdapterConformanceSuite(
  adapterFactory: (projectDir: string) => StorageAdapter,
) {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-conform-'));
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
  // Phases 2-5 add more describe blocks here
}
```

### Pattern 7: Leak-Grep Script Structure

The script scans a diff or file tree for direct I/O patterns. Matches `scripts/*.cjs` style:

```javascript
// scripts/leak-grep.cjs — skeleton
#!/usr/bin/env node
'use strict';

// R5 patterns: Read/Write/Edit tool calls against .planning/
// plus cp/mv/rm -rf/>> against .planning/
// plus <context>-block @.planning/ frontmatter references

const TOOL_PATTERNS = [
  /\bRead\s+["']\.planning\//,
  /\bWrite\s+["']\.planning\//,
  /\bEdit\s+["']\.planning\//,
  /\bcp\s+[^;]*\.planning\//,
  /\bmv\s+[^;]*\.planning\//,
  /\brm\s+-rf\s+[^;]*\.planning\//,
  />>\s*\.planning\//,
];

// <context>-block pattern: @.planning/ in frontmatter
const CONTEXT_BLOCK_PATTERN = /@\.planning\//;
```

### Anti-Patterns to Avoid

- **`if (adapter.name === 'markdown') { ... }`:** D-06 explicitly prohibits behavior branching on adapter identity. Use capability flags and type guards instead.
- **Optional methods with `?:`:** D-11 mandates required methods with `UnsupportedCapabilityError` defensive throws. TypeScript optional methods (`?: () => ...`) allow calling without narrowing and hide missing implementations.
- **Importing from `sdk/src/` inside `adapters/`:** D-01 says the interface lives outside `sdk/`. Third-party adapters should only import from `adapters/`. Cross-importing back into `sdk/src/` internal modules creates a circular dependency and couples the public seam to internal details.
- **Default adapter in createRegistry:** D-07 requires explicit `{adapter}` with no fallback. Do not add `adapter: new MarkdownAdapter(projectDir)` as a default — callers must always construct and inject the adapter.
- **Zero-arg createRegistry calls that still compile:** When changing the signature to require `{adapter}`, do NOT use an optional parameter. A missing adapter must be a type error, not a runtime null check.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CJS module loading from ESM | Dynamic `import()` of a CJS file | `createRequire(import.meta.url)(cjsPath)` | `createRequire` is the canonical Node.js bridge; already used in `state-project-load.ts` [VERIFIED] |
| Path resolution for `.planning/` | Custom path join logic | `planningDir(projectDir, ws)` from `planning-workspace.cjs` | Already handles workstream routing, project root detection, path normalization [VERIFIED] |
| Atomic writes for STATE.md | Custom lockfile | Existing `readModifyWriteStateMd` in `state.cjs` (MarkdownAdapter wraps this) | The lock logic took multiple iterations to get right; wrapping is safer than re-implementing |
| Lockfile acquire/release | Custom | Existing `acquireStateLock`/`releaseStateLock` in `state.cjs` | Same reason — complex, battle-tested |
| Vitest temp directory lifecycle | Custom test infra | `mkdtemp` + `beforeEach`/`afterEach` + `rm` | Exact pattern used in `state.test.ts` [VERIFIED] |

**Key insight:** The CJS layer already handles the hardest edge cases (file locking, atomic writes, ROADMAP.md milestone parsing, phase slug normalization). Phase 1's job is to declare the TypeScript seam over this existing correct behavior, not to re-implement it.

---

## CJS Surface Mapping (Bin A + markdownLockfile methods → CJS wrap targets)

This is the authoritative mapping the planner needs for writing MarkdownAdapter tasks.

### Record group (5 methods)

| Interface method | CJS wrap target | Module | Notes |
|-----------------|-----------------|--------|-------|
| `getRecord(path)` | `fs.readFile(join(planningDir, path), 'utf-8')` | `node:fs/promises` (no CJS needed) | Simple file read; no CJS analog needed |
| `putRecord(path, body)` | `atomicWriteFileSync(join(planningDir, path), body)` | `core.cjs` | Must create parent directory if needed |
| `removeRecord(path)` | `fs.unlink(join(planningDir, path))` | `node:fs/promises` | Direct fs call |
| `listCollection(prefix, filter?)` | `fs.readdir(join(planningDir, prefix), {withFileTypes: true})` | `node:fs/promises` | Phase 2 handlers can provide more domain-aware listing |
| `exists(path)` | `existsSync(join(planningDir, path))` | `node:fs` | Sync is fine here |

### Section group (2 methods)

| Interface method | CJS wrap target | Module | Notes |
|-----------------|-----------------|--------|-------|
| `getSection(path, anchor)` | No direct CJS analog; implement regex extraction | Implement directly | Pattern: find `## anchor` heading, extract until next `##` |
| `updateSection(path, anchor, body, mode)` | No direct CJS analog; `readModifyWriteStateMd` contains related logic | `state.cjs` (adapt) | Phase 5 implements fully; Phase 1 can throw `UnsupportedCapabilityError` since `section: true` is required — this is the one tension: required capability but deferred impl. Resolution: implement minimal version in Phase 1 using regex. |

**Important tension:** `section` and `frontmatter` are required capability groups (D-05), meaning the adapter must implement them — they cannot throw `UnsupportedCapabilityError`. The research confirms there is no direct CJS function matching `getSection(path, anchor)` — MarkdownAdapter Phase 1 must implement a basic regex extractor directly. This is modest scope but the planner should allocate a dedicated task for it.

### Frontmatter group (3 methods)

| Interface method | CJS wrap target | Module | Notes |
|-----------------|-----------------|--------|-------|
| `getFrontmatter(path, field?)` | `cmdFrontmatterGet(cwd, resolvedPath, field, false)` | `frontmatter.cjs` | Returns parsed YAML object or specific field |
| `updateFrontmatter(path, field, value)` | `cmdFrontmatterSet(cwd, resolvedPath, field, value, false)` | `frontmatter.cjs` | Single-field update |
| `mergeFrontmatter(path, patch)` | `cmdFrontmatterMerge(cwd, resolvedPath, patch, false)` | `frontmatter.cjs` | Multi-field merge |

### markdownLockfile group (2 methods — D-09)

| Interface method | CJS wrap target | Module | Notes |
|-----------------|-----------------|--------|-------|
| `replaceInCurrentMilestone(pattern, replacement)` | `replaceInCurrentMilestone(content, pattern, replacement)` | `core.cjs` | Exported at `core.cjs:1121`; used inside roadmap mutation commands |
| `readModifyWriteRoadmapMd(mutator)` | Compose: read ROADMAP.md, apply mutator, atomic write | `core.cjs` + `node:fs/promises` | No direct CJS single-function; compose from `atomicWriteFileSync` + read |

### Foundational primitives (Phase 1: declare + throw UnsupportedCapabilityError)

| Interface method | Capability flag | Phase 1 behavior |
|-----------------|-----------------|------------------|
| `writeBinaryAsset(path, bytes)` | `binaryAsset` | throw `UnsupportedCapabilityError('binaryAsset', this.name)` |
| `snapshot()` | `snapshot` | throw `UnsupportedCapabilityError('snapshot', this.name)` |
| `restore(snapshotId)` | `snapshot` | throw `UnsupportedCapabilityError('snapshot', this.name)` |
| `withTransaction(fn)` | `transaction` | throw `UnsupportedCapabilityError('transaction', this.name)` |
| `putNamedDoc(category, key, body)` | `namedDoc` | throw `UnsupportedCapabilityError('namedDoc', this.name)` |
| `getNamedDoc(category, key)` | `namedDoc` | throw `UnsupportedCapabilityError('namedDoc', this.name)` |
| `commitPlanningState(message, files?)` | `commitPlanningState` | MarkdownAdapter implements this (Phase 1): `git add + git commit`; delegates to `commit.cjs` or existing `commit.ts` |

**Note on `commitPlanningState`:** This is optional (`commitPlanningState: boolean` in capabilities), but MarkdownAdapter should set it to `true` and implement it in Phase 1 since it's the default behavior users expect. The existing `commit.ts` handler can be reused.

---

## createRegistry() Call-Site Inventory

**Total `createRegistry()` call-sites:** 83 occurrences in the codebase [VERIFIED: grep count].

**Production call sites (non-test, actual invocations):** 4 sites that need updating [VERIFIED: grep]:

| File | Line | Context | Update needed |
|------|------|---------|--------------|
| `sdk/src/cli.ts` | 409 | `gsd-sdk query` CLI entrypoint | `createRegistry({ adapter: buildDefaultAdapter(args.projectDir) })` |
| `sdk/src/gsd-tools.ts` | 134 | `GSDTools` constructor | `createRegistry({ adapter, eventStream, correlationSessionId })` — adapter injected via `opts.adapter` |
| `sdk/src/gsd-tools.ts` | 567 | `runGsdToolsQuery()` standalone function | Needs adapter param; may need projectDir-derived adapter |
| `sdk/src/golden/registry-canonical-commands.ts` | 10 | Registry shape introspection utility | Test/golden utility; needs adapter but any adapter works |

**Test call sites (83 total minus 4 production):** The bulk are in `sdk/src/golden/*.integration.test.ts` and `sdk/src/query/*.test.ts`. These need to be updated to pass a MarkdownAdapter, but since they run against real `.planning/` fixtures, this is straightforward.

**Key planner note:** The `cli.ts` update at line 409 is the critical path. When `gsd-sdk query` is invoked, it constructs the registry. With D-07's mandatory adapter, the CLI must construct a MarkdownAdapter from the `args.projectDir`. This is the "install-wiring layer" D-07 refers to.

**The `GSDTools` class update** at line 134 is the second-most impactful: every programmatic SDK user who constructs `GSDTools` will need to pass an adapter, OR the class can construct a MarkdownAdapter internally as its default (but this must not be a `createRegistry()` default — it's a `GSDTools` concern). The planner should decide whether to add `adapter?: StorageAdapter` to `GSDToolsOptions` with a `MarkdownAdapter` fallback in the class constructor, OR require it explicitly. Given D-07 says "no default, no fallback," requiring it explicitly is safer.

---

## Upstream PR Classification (ADAPTER-05)

These are the four ADR verdicts the planner will need to document in `.planning/DECISIONS.md` as D-YYYY-MM-DD-07 through -10.

### PR #2898 — `feat(sdk): add durable planning runtime`

**What it lands:** `PlanningRuntime`, `PlanningJournal`, `RuntimeGate` classes in `sdk/src/`. The journal appends JSONL events to `.planning/.journal/` for plan execution tracking (idempotency, checkpoint, done signals). These are event-sourcing primitives for *plan execution*, not storage adapter concerns.

**Overlap with our design:** None. The journal writes to `.planning/.journal/` (a new path outside the existing `.planning/` document tree). It does not touch STATE.md, ROADMAP.md, or any document the StorageAdapter owns. `PlanningRuntime` records plan lifecycle events; our adapter records planning *content*.

**Verdict: IRRELEVANT** — different layer. No contract impact on StorageAdapter shape. Rebase risk: low (separate files, separate directory).

**ADR note:** Future consideration: should journal writes eventually flow through the adapter's `putRecord`? Deferred — the journal's append-only JSONL semantics do not fit `putRecord`/`getRecord` cleanly, and PR #2898's design explicitly chose a separate `PlanningJournal` class.

### PR #2901 — `refactor: extract planning-workspace seam from core.cjs`

**What it lands:** `planning-workspace.cjs` — a new module in `get-shit-done/bin/lib/` that owns `planningDir()`, `planningRoot()`, `planningPaths()`, `withPlanningLock()`, `getActiveWorkstream()`, `setActiveWorkstream()`, and the workstream pointer adapters. `core.cjs` now imports from it (compat shim). Already present in this fork [VERIFIED: directory listing].

**Overlap with our design:** HIGH UTILITY. `planningDir(cwd, ws)` is exactly what MarkdownAdapter needs to resolve `.planning/`-relative paths to absolute paths. We should import this directly:
```typescript
// In MarkdownAdapter constructor
const { planningDir } = req('./planning-workspace.cjs') as typeof import('./planning-workspace.cjs');
this.planningBase = planningDir(projectDir);
```

**Verdict: REUSE** — upstream's seam is reusable foundation. The fork's MarkdownAdapter builds on `planning-workspace.cjs` for path resolution. No StorageAdapter interface impact. Rebase risk: low (we consume the existing module, not modify it).

### PR #2908 — `refactor(query): manifest-backed routing seam + family adapters`

**What it lands:** `CommandManifestEntry` types, `COMMAND_MANIFEST` array, per-family manifest files (`command-manifest.state.ts`, `.phase.ts`, etc.), and a `command-seam-coverage.test.ts` that verifies manifest entries match generated alias artifacts. This is a meta-seam: it makes the registry's command routing structure inspectable and testable [VERIFIED: codebase].

**Overlap with our design:** MODERATE. The manifest's `CommandFamily` type covers `state | verify | init | phase | phases | validate | roadmap` — not a `storage` or `adapter` family. When Phase 1 changes `createRegistry()` to require `{adapter}`, the manifest itself does not need to change (it covers command routing, not DI). However, the seam coverage test (`command-seam-coverage.test.ts`) calls `createRegistry()` at line 10 via `registry-canonical-commands.ts`. This test file needs updating after the signature change.

**Verdict: COORDINATE** — parallel work. The manifest seam is upstream's way of making command routing inspectable; our adapter seam is our way of making storage pluggable. These are complementary, not competing. The fork stays aligned by updating the one call site that hits the manifest coverage test. No StorageAdapter interface impact. Rebase risk: low-medium (the alias generation scripts may add new entries that need monitoring via leak-grep).

### PR #2909 — `test(golden): expand phases/validate/roadmap parity matrix`

**What it lands:** Additional golden integration tests (`golden.integration.test.ts`) comparing SDK registry dispatch to CJS `gsd-tools.cjs` output for `phases.*`, `validate.*`, `roadmap.*` command families. These tests call `createRegistry()` at ~8 additional sites.

**Overlap with our design:** Direct. Per D-13, Phase 1 does NOT need to pass the #2909 parity matrix — that is Phase 8. The fork's CI for Phase 1 only needs to pass the existing test suite. However, all `createRegistry()` calls in `golden.integration.test.ts` must be updated to the new `{adapter}` signature.

**Verdict: COORDINATE** — Phase 8 (DIST-04) is the milestone for strict parity. Phase 1 updates the call signatures in these golden tests but does not need to achieve full parity. Rebase risk: medium — #2909 adds new golden rows; future rebases may add more `createRegistry()` calls that need adapter injection.

---

## Common Pitfalls

### Pitfall 1: capabilities `true` literal vs `boolean` in TS
**What goes wrong:** If `capabilities.record` is typed as `boolean` instead of `true`, an adapter can declare `record: false` and still type-check. The D-05 invariant says required groups must be `true` (literal type) so the type system catches missing capability at compile time.
**Why it happens:** TypeScript infers `boolean` from `{ record: false }` unless the interface forces `true`.
**How to avoid:** Use literal type: `record: true;` in the interface. Missing groups then fail `satisfies StorageAdapter` with a type error.
**Warning signs:** Compiler doesn't complain when you construct `{ ...capabilities, record: false }`.

### Pitfall 2: createRequire path resolution breaks in non-standard installs
**What goes wrong:** `BUNDLED_CORE_CJS = new URL('../../../get-shit-done/bin/lib/core.cjs', import.meta.url)` — the relative path assumes adapter file lives inside `adapters/markdown/index.ts`. If the layout changes, the URL computation fails silently.
**Why it happens:** ESM URL-relative paths are computed at module load time; wrong relative path gives a path that looks valid but resolves to a non-existent file.
**How to avoid:** Use the same three-candidate probe as `state-project-load.ts` (bundled path, `projectDir/.claude/get-shit-done/...`, `~/.claude/get-shit-done/...`). Validate all three exist before picking. Throw a clear `GSDError` if none found.
**Warning signs:** `ENOENT` errors when calling any MarkdownAdapter method, not during construction.

### Pitfall 3: Path argument confusion — absolute vs .planning/-relative
**What goes wrong:** A method receives `STATE.md` (relative) but internally calls `fs.readFile` with `STATE.md` — resolves against process.cwd(), not the adapter's `projectDir`.
**Why it happens:** D-04 says interface methods take `.planning/`-relative paths. The adapter must join `planningBase + path`, not just use `path`.
**How to avoid:** In every MarkdownAdapter method, apply: `const abs = join(this.planningBase, relativePath)`. Never pass the raw `path` argument to `node:fs`.
**Warning signs:** Works when `cwd === projectDir`, breaks in CI where they differ.

### Pitfall 4: Zero-arg createRegistry() callers in test files compile after signature change
**What goes wrong:** If `adapter` is an optional parameter with a default, old zero-arg calls compile silently with the default. Defeats D-07's "no default, no fallback" invariant.
**Why it happens:** TypeScript optional parameters allow call-site omission.
**How to avoid:** Use a required object parameter: `createRegistry(opts: { adapter: StorageAdapter; ... })`. TypeScript then errors at every zero-arg call site immediately.
**Warning signs:** After the change, TypeScript reports zero errors but you haven't updated any call sites — this means the parameter is still optional.

### Pitfall 5: section + frontmatter required groups have no CJS direct analog
**What goes wrong:** Planner schedules MarkdownAdapter as "wrap CJS" for all 10 methods, but `getSection` and `updateSection` have no CJS function with matching semantics.
**Why it happens:** CJS handlers do section mutations internally (inside `readModifyWriteStateMd`) but do not expose a generic `getSection(path, anchor)` API.
**How to avoid:** Implement `getSection`/`updateSection` directly using regex. The pattern: find `## anchor` (or `### anchor`), extract until next `##` heading (or end of file), return the block. For `updateSection`, find the block and splice-replace it with `body`.
**Warning signs:** Searching `state.cjs` for "getSection" returns nothing — expected.

### Pitfall 6: `<context>`-block leak-grep false negatives for non-`@` syntax
**What goes wrong:** Some skill frontmatter may reference `.planning/` files using syntax other than `@.planning/...` (e.g., embedded in XML or markdown link syntax).
**Why it happens:** The `<context>` block format is not strictly defined; skills use various syntaxes.
**How to avoid:** In the leak-grep script, scan for any occurrence of `.planning/` inside `<context>...</context>` blocks, not just `@.planning/` prefix. A broader regex catches more patterns.
**Warning signs:** Manual audit of a skill file shows a `.planning/` reference that the script misses.

---

## Code Examples

### MarkdownAdapter scaffold structure

```typescript
// adapters/markdown/index.ts
// Source: derived from state-project-load.ts pattern [VERIFIED: codebase]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { StorageAdapter, RecordFilter, RecordRef } from '../types.js';
import { UnsupportedCapabilityError } from '../types.js';

const BUNDLED_LIB = fileURLToPath(
  new URL('../../get-shit-done/bin/lib/', import.meta.url),
);

function resolveLibPath(name: string, projectDir: string): string {
  const candidates = [
    join(BUNDLED_LIB, name),
    join(projectDir, '.claude', 'get-shit-done', 'bin', 'lib', name),
    join(homedir(), '.claude', 'get-shit-done', 'bin', 'lib', name),
  ];
  const found = candidates.find(p => existsSync(p));
  if (!found) throw new Error(`MarkdownAdapter: ${name} not found`);
  return found;
}

export class MarkdownAdapter implements StorageAdapter {
  readonly name = 'markdown';
  readonly capabilities = {
    record: true as const,
    section: true as const,
    frontmatter: true as const,
    binaryAsset: false,
    snapshot: false,
    transaction: false,
    namedDoc: false,
    commitPlanningState: true,
    markdownLockfile: true,
  };

  private readonly planningBase: string;
  private readonly req: NodeRequire;

  constructor(projectDir: string) {
    const req = createRequire(import.meta.url);
    const { planningDir } = req(resolveLibPath('planning-workspace.cjs', projectDir)) as {
      planningDir: (cwd: string) => string;
    };
    this.planningBase = planningDir(projectDir);
    this.req = req;
  }

  // ... method implementations follow
}
```

### getRecord implementation

```typescript
// adapters/markdown/index.ts — getRecord
async getRecord(path: string): Promise<string | null> {
  const abs = join(this.planningBase, path);
  try {
    return await readFile(abs, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}
```

### Conformance harness invocation

```typescript
// tests/conformance/markdown.conformance.test.ts
import { describe } from 'vitest';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import { runAdapterConformanceSuite } from './adapter.conformance.js';

describe('MarkdownAdapter conformance', () => {
  runAdapterConformanceSuite((projectDir) => new MarkdownAdapter(projectDir));
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `createRegistry()` zero-arg | `createRegistry({adapter})` required | Phase 1 | All callers must inject adapter; no global filesystem state in registry |
| `replaceInCurrentMilestone` private to core.cjs | Public on `StorageAdapter` interface, `markdownLockfile`-gated | Phase 1 (D-09) | Overrides SYNTHESIS §6 #1 recommendation; consumers type-narrow before calling |
| Direct `node:fs` reads/writes throughout SDK handlers | Routed through `adapter.*` | Phase 2 (reads) + Phase 3 (writes) | Phase 1 only wires the seam; actual migration is Phases 2-3 |
| `pipeline.js` dry-run via `cp -r .planning/ /tmp/` | `snapshot()/restore()` adapter capability | Phase 5 | Phase 1 declares the interface; Phase 5 implements |

**Deprecated/outdated:**
- `replaceInCurrentMilestone` as CJS C1 (SYNTHESIS §5 C1): SYNTHESIS §5 classified it as obsolete, but D-09 OVERRIDES this — it is now a public interface method capability-gated by `markdownLockfile`. The SYNTHESIS classification is superseded by the CONTEXT.md decision.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `getSection`/`updateSection` Phase 1 implementations use regex extraction (no CJS analog found) | CJS Surface Mapping | If a suitable CJS function exists that was missed, regex approach duplicates work; low risk since search was thorough |
| A2 | `GSDTools.opts.adapter` should be required (not optional) per D-07; GSDTools class is a public API that may need a migration path | createRegistry Call-Site Inventory | If GSDTools is used by external callers in Phase 1 scope, requiring adapter breaks them; recommend `opts.adapter?: StorageAdapter` with `MarkdownAdapter` fallback inside GSDTools specifically |
| A3 | Conformance harness test factory pattern (function-based, not class-based) | Code Examples | If vitest suite composition requires class, the factory approach still works but ergonomics differ |
| A4 | leak-grep.cjs uses regex matching on file content (not AST) | Leak-Grep Tooling | AST would be more precise but is overkill for Phase 1; regex false positives/negatives are acceptable until Phase 4 |

---

## Open Questions (RESOLVED)

All three open questions were resolved during planning. Each carries the resolving plan + the locked decision below.

1. **`GSDTools` class DI strategy** — **RESOLVED: Plan 04 makes `GSDTools.adapter` REQUIRED (no default).**
   - What we know: `GSDTools` is a public SDK class consumed by external callers. D-07 says `createRegistry` requires `{adapter}`, but `GSDTools` wraps it. The class could accept `opts.adapter?: StorageAdapter` and default to `new MarkdownAdapter(projectDir)` internally — this does not violate D-07 (the default lives in the class, not in `createRegistry`).
   - What's unclear: Is `GSDTools` used externally in Phase 1's scope in a way that would break if we require the adapter?
   - **Resolution (Plan 04, Task 2):** `GSDToolsOptions.adapter` is required, no default. Tests update to pass `{adapter: new MarkdownAdapter(projectDir)}`. This honors D-07's intent (no implicit filesystem coupling at the registry boundary). Backward-compatibility shim rejected — every consumer threads adapter explicitly. Verifiable: `GSDTools({adapter})` compiles; `GSDTools({})` produces a TypeScript error.

2. **adapters/ TypeScript build** — **RESOLVED: Plan 01 creates `adapters/tsconfig.json` (separate project, composite: true).**
   - What we know: `sdk/tsconfig.json` has `rootDir: "src"` and `outDir: "dist"`. The new `adapters/` dir is at repo root, outside `sdk/`. The root `tsconfig.json` has `references: [{path: "sdk"}]` only.
   - What's unclear: Does `adapters/` need its own `tsconfig.json` + build step, or should it be compiled by the SDK's tsconfig?
   - **Resolution (Plan 01, Task 2):** Separate `adapters/tsconfig.json` with `composite: true`; root `tsconfig.json` adds `{path: "adapters"}` to its `references` array; `package.json` `files` array adds `adapters/dist`. Project-references model keeps build incrementality clean and prevents `sdk/dist` from accidentally including adapter sources.

3. **`updateSection` Phase 1 minimal implementation depth** — **RESOLVED: Plan 03 implements all three modes at heading-level-2 only.**
   - What we know: `section: true` is a required capability (D-05). MarkdownAdapter must implement it. No CJS direct analog exists.
   - What's unclear: How sophisticated does the Phase 1 regex implementation need to be? Can it handle nested sections (e.g., `##` inside a `###` context)?
   - **Resolution (Plan 03, Task 1):** Phase 1 implements `overwrite` / `append` / `prepend` modes for heading-level-2 (`##`) anchors. Heading-level-3+ nested anchors and section-aware-of-frontmatter handling are deferred to Phase 5 (foundational primitive lift). Conformance harness (Plan 05) tests all three modes against a fixture markdown file.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | MarkdownAdapter CJS bridging | ✓ | v24.14.0 | — |
| TypeScript | Compile `adapters/` | ✓ | 6.0.3 (tsx) / 5.7.x (sdk) | — |
| vitest | Conformance harness tests | ✓ | 4.1.5 | — |
| `core.cjs` | MarkdownAdapter wrapping | ✓ | Present at `get-shit-done/bin/lib/core.cjs` | — |
| `planning-workspace.cjs` | MarkdownAdapter path resolution | ✓ | Present at `get-shit-done/bin/lib/planning-workspace.cjs` (PR #2901) | — |
| `frontmatter.cjs` | getFrontmatter/updateFrontmatter | ✓ | Present at `get-shit-done/bin/lib/frontmatter.cjs` | — |
| `state.cjs` | State mutation delegation | ✓ | Present at `get-shit-done/bin/lib/state.cjs` | — |

No missing dependencies. All Phase 1 work is achievable with what's already in the repository.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 |
| Config file | `sdk/vitest.config.ts` |
| Quick run command | `cd sdk && npm run test:unit` |
| Full suite command | `cd sdk && npm run test` (unit + integration) |
| CJS test suite | `node scripts/run-tests.cjs` (runs `tests/*.test.cjs` via Node.js `--test`) |

Phase 1 adds a new vitest project for `tests/conformance/` or adds to the existing SDK unit config.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADAPTER-01 | StorageAdapter declares all 10 Bin A primitives | unit (type-check only) | `cd sdk && npm run build` fails if interface missing | ❌ Wave 0: `adapters/types.ts` |
| ADAPTER-02 | capabilities flag shape correct, required caps force true | unit | `cd sdk && npm run build` (TS type error if wrong) | ❌ Wave 0: `adapters/types.ts` |
| ADAPTER-03 | MarkdownAdapter `getRecord` round-trip | unit | `cd sdk && npx vitest run tests/conformance/` | ❌ Wave 0: `tests/conformance/` |
| ADAPTER-04 | `createRegistry({adapter})` compiles; zero-arg fails type-check | unit | `cd sdk && npm run build` | ❌ Wave 0: signature change |
| ADAPTER-05 | ADRs documented in DECISIONS.md | manual | Human review | ❌ Wave 0: DECISIONS.md entries |
| ADAPTER-06 | `adapters/` directory exists at repo root | smoke | `ls adapters/types.ts` | ❌ Wave 0: directory creation |
| ADAPTER-07 | `replaceInCurrentMilestone` is public on interface | unit (type-check) | `cd sdk && npm run build` | ❌ Wave 0: interface declaration |

### Failure Mode Detection

| Failure Mode | Detection Method | Test Command |
|-------------|-----------------|--------------|
| Interface drift between TS and CJS shapes | MarkdownAdapter `getRecord` conformance test round-trips | `cd sdk && npx vitest run tests/conformance/` |
| Call-site breakage from `createRegistry()` signature change | TypeScript compiler reports type error at old call sites | `cd sdk && npm run build` |
| Leak-grep false positives | Manual review of `scripts/leak-grep.cjs` output on known-clean file | `node scripts/leak-grep.cjs tests/fixtures/clean-skill.md` |
| Leak-grep false negatives | Add a known-leak fixture and assert script catches it | Unit test for leak-grep script itself |
| `section: true` required but UnsupportedCapabilityError thrown | Conformance test calls `getSection` and expects string/null result | `cd sdk && npx vitest run tests/conformance/` |

### Sampling Rate

- **Per task commit:** `cd sdk && npm run build` (type-check only, fast)
- **Per wave merge:** `cd sdk && npm run test:unit` (unit suite) + `node scripts/run-tests.cjs` (CJS suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps (must exist before implementation tasks run)

- [ ] `adapters/types.ts` — StorageAdapter interface skeleton (can be stub with `any` initially)
- [ ] `adapters/markdown/index.ts` — MarkdownAdapter class stub
- [ ] `tests/conformance/adapter.conformance.ts` — factory function (can be empty suite initially)
- [ ] `tests/conformance/markdown.conformance.test.ts` — runs factory against MarkdownAdapter
- [ ] `sdk/vitest.config.ts` update (or separate `vitest.conformance.config.ts`) — add `tests/conformance/` to include paths
- [ ] `adapters/tsconfig.json` or extend `sdk/tsconfig.json` — compile `adapters/` directory

---

## Security Domain

This phase is purely TypeScript infrastructure (interface declaration + CJS wrapping). No new network calls, no new authentication surfaces, no new external data ingestion.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (partial) | `.planning/`-relative path inputs should reject `..` and null bytes — same validation as `planning-workspace.cjs` `BAD_SEGMENT` regex |
| V6 Cryptography | no | — |

**Path traversal:** The `BAD_SEGMENT = /[/\\]|\.\./` check in `planning-workspace.cjs` covers workstream/project name validation. MarkdownAdapter's `getRecord(path)` should apply similar validation to prevent reads outside `.planning/`. The existing `assertNoNullBytes` + `assertSafePhaseDirName` helpers in `phase-lifecycle.ts` are the analog [VERIFIED: codebase].

---

## Sources

### Primary (HIGH confidence)
- `sdk/src/query/index.ts` — `createRegistry()` signature, all call sites verified directly
- `sdk/src/query/state-project-load.ts` — canonical `createRequire` bridge pattern
- `sdk/src/query/phase-lifecycle.ts` — TypeScript handler pattern for Phase 1's adapter files
- `sdk/src/errors.ts` — `GSDError` pattern for `UnsupportedCapabilityError` design
- `get-shit-done/bin/lib/core.cjs` — exported functions, `replaceInCurrentMilestone` at line 1121
- `get-shit-done/bin/lib/state.cjs` — exported functions, `readModifyWriteStateMd` pattern
- `get-shit-done/bin/lib/frontmatter.cjs` — `cmdFrontmatterGet/Set/Merge` exports
- `get-shit-done/bin/lib/planning-workspace.cjs` — `planningDir()` as MarkdownAdapter path resolver
- `sdk/vitest.config.ts` — test framework configuration
- `sdk/src/golden/read-only-parity.integration.test.ts` — test factory pattern analogs
- `.planning/phases/01-fork-bootstrap-storageadapter-interface-skeleton-markdownada/01-CONTEXT.md` — all locked decisions
- `.planning/research/fork-investigation/SYNTHESIS.md` — §4 adapter interface draft, §9 risk register

### Secondary (MEDIUM confidence)
- `sdk/HANDOVER-QUERY-LAYER.md` — createRequire bridging description, confirmed against actual code
- `sdk/src/planning-journal.ts`, `sdk/src/planning-runtime.ts` — PR #2898 classification
- `sdk/src/query/command-manifest.ts`, `command-manifest.types.ts` — PR #2908 classification
- `scripts/run-tests.cjs` — CJS test runner mechanics

### Tertiary (LOW confidence)
- None. All claims in this research were verified against the codebase or cited from planning documents.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from package.json; patterns verified from codebase
- Architecture: HIGH — all four production call sites found by grep; CJS surface mapped by grepping exports
- Upstream PR classification: HIGH — code inspected directly; PR #2898/#2901/#2908 all present in current working tree
- Pitfalls: HIGH — derived from code inspection (no CJS analog for getSection) and locked decisions (type literal trap)

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable — upstream PR activity could shift PR #2909 verdict if it merges; all other findings are code-grounded)
