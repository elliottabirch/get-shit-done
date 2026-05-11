# Phase 6: BeadsAdapter implementation - Research

**Researched:** 2026-05-11
**Domain:** BeadsAdapter implementation against bd CLI in sibling repo ~/code/gsd-beads
**Confidence:** MEDIUM

## Summary

Phase 6 implements a complete BeadsAdapter against the hypothetical `bd` CLI issue-tracking system in a fresh sibling repository at `~/code/gsd-beads`. The adapter targets the primitive-lifted StorageAdapter interface locked in Phases 1–5 (159 lines at `adapters/types.ts`), implementing all Bin A primitives, foundational primitives, and the 3 recordState* event families using a hybrid L2 sub-records + L3/L4 anchor-comments mapping strategy. The phase resolves OQ-06 (knowledge-graph scope) via a layered two-pipeline approach where BeadsAdapter synthesizes dependency edges from bd's native `blocks`/`blocked-by` graph, while semantic edges remain markdown-only. A critical early spike (Plan 06-01) probes bd's store-clone and bead-hash bookmark primitives to determine whether `withTransaction` can be implemented via staging-store cutover (Option B, mirroring MarkdownAdapter's shadow-dir journal 1:1) or requires an in-memory write-buffer fallback (Option A, with documented sequential-commit gap flagged for Phase 6.1).

**Primary recommendation:** Begin with Plan 06-01 spike + fork-side subpath export + sibling scaffold. Spike outcome gates the transaction implementation path. Structure remaining plans as 5–6 waves mirroring Phase 3/5 pattern: foundational primitives → event families → format module → conformance smoke → dep-edge synthesizer.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-OQ06 (Layered graph edges via two separate pipelines):**
- `graphs/graph.json` edge schema extends with `type: 'semantic' | 'dependency'`
- Semantic edges: `graphify.cjs` continues producing fuzzy confidence-tiered edges from markdown (MarkdownAdapter only; BeadsAdapter emits zero semantic edges — acceptable, documented)
- Dependency edges: BeadsAdapter-native synthesizer exposes bd `blocks`/`blocked-by` issue-graph edges as `{type: 'dependency', confidence: 1.0}` entries
- Adapter capabilities gain `graphEdges: { semantic: boolean; dependency: boolean }` (replaces simpler `graph: boolean`; only Phase-6 change to locked contract surface — additive)
- MarkdownAdapter: `{ semantic: true, dependency: false }`
- BeadsAdapter: `{ semantic: false, dependency: true }`
- Type-aware filtering in `gsd-phase-researcher` and `graphify.md` deferred to Phase 8 or late-Phase-6 uplift

**D-MAPPING (Hybrid L2 sub-records + L3/L4 anchor-comments):**
- Each `.planning/*.md` file → ONE bd issue
- L2 section content (`## Foo`) → bd sub-records keyed by section name (native mutable JSON fields; `updateSection` mode becomes JSON array/value op)
- L3 and L4 nested content (`### Evidence`, `#### Sub-point`) → anchor-tagged comments on the issue with labels `gsd:section:### Evidence` or `gsd:section:### Evidence:#### Sub-point`
- `getRecord(path)` composes sub-records + comments back into rendered markdown body via format module

**D-MAPPING-SCHEMA (Authored per canonical file):**
- L2 sub-record schemas EXPLICITLY AUTHORED in BeadsAdapter's `format` module
- One TypeScript schema per canonical file (STATE.md, ROADMAP.md, PROJECT.md, REQUIREMENTS.md, DECISIONS.md, AI-SPEC.md, SPEC.md, UAT.md, VERIFICATION.md, debug-session docs, PLAN.md, CONTEXT.md)
- Schemas are TypeScript types with sub-record keys matching L2 heading text (e.g., STATE.md → `{ decisions: DecisionEntry[], blockers: BlockerEntry[], metrics: MetricEntry[], ... }`)
- Derived schemas NOT used — drift caught at sync time by schema validation

**D-MAPPING-EVENTS (Event families → bd operations):**
- `recordStateAppend` → push to target L2 sub-record array (discriminant-field dedupe for `applied: false, reason: 'duplicate'`; scaffold sub-record key if absent for `applied: true, created_section: '...'`)
- `recordStateMutation` → add-or-remove from target L2 sub-record array by discriminant (`applied: false, reason: 'nothing_to_remove'` when target entry absent)
- `recordStateSignal` → bd metadata field or tiny marker-issue with `gsd:signal:<type>` label (`applied: false, reason: 'nothing_to_remove'` on `resume` when no WAITING marker exists)

**D-MAPPING-ROUNDTRIP (Phase 7 equivalence):**
- Phase 7 CONFORM-02 asserts `putRecord(x); getRecord(...) === x` modulo (a) L2 sub-record array order (conformance harness sorts both sides); (b) whitespace normalization (trailing newline, heading depth)
- Format module is single authority for markdown ↔ sub-record bidirectional transform

**D-TXN-SPIKE (Plan 06-01 validates primitives):**
- Spike bd's store-clone + bead-hash bookmark primitives
- **Outcome B (primitives available):** staging bd store + bead-hash bookmark cutover
  - `withTransaction` entry creates staging bd store at derived path; mutating calls redirect to staging; reads merge staging-over-real; commit = atomic bead-hash bookmark swap; rollback = drop staging store
  - `dryRun: true` unconditionally drops staging on exit
  - Nested `withTransaction` JOINs outer staging store via reentrant-lock guard (direct port of Phase 5 D-04/D-10)
  - 1:1 with MarkdownAdapter's shadow-dir journal; closes SYNTHESIS §9 HIGH-severity dry-run gate by construction
- **Outcome A (primitives unavailable):** in-memory write-buffer fallback
  - Queue mutations in `activeTransaction` buffer; apply on commit (sequential bd issue edits); discard on rollback; reads consult buffer first
  - Document "sequential commit, best-effort mid-txn rollback" gap — mid-txn failure after 2-of-3 buffered writes leaves bd partially committed
  - Flag as Phase 6.1 follow-up; Phase 7 CONFORM-04 failure-injection test will fail — expected

**D-TXN-CAPS:**
- `capabilities.transaction: true` in both outcomes (pipeline.ts dry-run depends unconditionally)
- `capabilities.snapshot: true` only in Outcome B; false in Outcome A
- Document which variant shipped in BeadsAdapter README

**D-BINARY (skip-and-warn):**
- BeadsAdapter declares `capabilities.binaryAsset: false`
- `writeBinaryAsset` throws `UnsupportedCapabilityError` if called directly
- Consumer workflows MUST guard with `hasBinaryAsset(adapter)` per Phase 5 D-18
- Zero BeadsAdapter LOC; clean migration path if bd users later demand asset routing

**D-INIT-ERR (Typed error class):**
- Export `BdManagedMismatchError extends Error` with fields:
  - `code: 'PROJECT_BD_MANAGED_MISMATCH'` (literal)
  - `projectDir: string`
  - `hint: string` (human-readable next step)
  - `__brand` symbol for cross-module instanceof resilience (mirrors `UnsupportedCapabilityError`)
- `BeadsAdapter.init()` throws when target dir not bd-managed (no `.bd/` dir, or `bd status` exits non-zero, or equivalent)
- Consumers catch by class or `err.code`

**D-SCAFFOLD (Fresh `npm init` + file-link):**
- Plan 06-01 creates `~/code/gsd-beads/` via fresh `npm init -y`
- `package.json` declares:
  - `"get-shit-done": "file:../get-shit-done"` (dev dependency)
  - Minimal deps (bd node bindings when available; `vitest` for tests)
  - Single entry point `src/index.ts` exporting `BeadsAdapter` (exact export shape — default vs named — is Claude's discretion; must match Phase 8 resolution convention)
  - README stating "BeadsAdapter for get-shit-done fork v1.0; depends on locked StorageAdapter contract at `adapters/types.ts`"
- Zero v0.2 archaeology — 13 spike findings + format module concept ported fresh into v1.0, not inherited as code

**D-CONFORM-EXPORT (Fork-side `package.json` subpath export):**
- This fork's `package.json` gains `"./conformance"` entry in `exports` field pointing at `./tests/conformance/adapter.conformance.js`
- Sibling imports via:
  ```ts
  import { runAdapterConformanceSuite } from 'get-shit-done/conformance';
  import { BeadsAdapter } from './src/index.js';
  runAdapterConformanceSuite('beads', (dir) => new BeadsAdapter(dir));
  ```
- Single fork-side change Phase 6 writes into THIS repo before switching to sibling work
- `runAdapterConformanceSuite` signature already locked (Phase 1 D-15)

**D-RUNTIME-RESOLUTION (Phase 8 preview):**
- Fork's `createRegistry` will dynamically `require("gsd-{name}")` when `storage.adapter: "beads"` set in `.planning/config.json`
- BeadsAdapter's package export must match this pattern — exact shape (default / named / factory) is Claude's discretion, subject to constraint that resolver can instantiate with `new Adapter(projectDir)` or `Adapter.create(projectDir)`
- Document chosen shape in BeadsAdapter README so Phase 8 can wire resolver against it

### Claude's Discretion

- Spike sequencing within Plan 06-01 (standalone markdown doc / throwaway test file / executable script)
- Exact bd primitives invoked (shell to `bd` CLI / node bindings to bd's SQLite / mix) — planner judges based on spike outcome
- Plan count and wave structure (likely 5–7 plans mirroring Phase 3/5)
- Format module internal organization (single file per canonical schema / one big `format.ts`)
- `BeadsAdapter.init()` exact probe mechanism (`ls .bd/` / `bd status` shell-out / JSON-RPC to bd daemon / equivalent)
- Error-class export path (`src/errors.ts` / inline in `src/index.ts`)
- Dep-edge synthesizer implementation (lazy on every `getRecord('graphs/graph.json')` / eager-cache materialized on writes to bd's blocks-edges)
- Sibling-repo branch strategy (long-lived `main` / per-plan feature branches)

### Deferred Ideas (OUT OF SCOPE)

- bd-sourced semantic edges (running `graphify.cjs` against bd as data source) — post-v1.0 or Phase 8
- Phase 8 adapter-name runtime resolver (DIST-01) — full impl is Phase 8
- markdown→bd migration tool (DIST-02) — Phase 8
- Type-aware graph-edge filtering in consumers — Phase 8 or late-Phase-6 uplift at planner's discretion
- Phase 6.1 follow-up (bd multi-record commit atomicity) — only needed if D-TXN spike forces Option A AND Phase 7 conformance judges sequential-commit gap unacceptable
- Blob-store routing for binaryAsset on BeadsAdapter — ship when consumer workflow needs UI-review screenshots on bd backend
- BeadsAdapter-specific sidecar path-sniff map documentation — planner-level detail for Plan 06-0N
- Publishing `gsd-beads` to npm registry — deferred to NPM-01 (REQUIREMENTS.md "Future Requirements")
- `gsd update` convenience for adapters — Phase 8 or post-v1.0
- Reconsidering two-repo model (D-2026-04-30-02) — user confirmed keep-two-repos mid-discussion
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BEADS-01 | `BeadsAdapter` implements all 10 Bin A primitives against `bd` CLI (carries forward 13 spike findings, format module, JSONL roundtrip seed pattern from `gsd-beads` v0.2 work) | D-MAPPING + D-SCAFFOLD define the mapping strategy; format module schemas (§6) enable sub-record transform; transaction spike (§5.1) determines read/write primitive shape |
| BEADS-02 | `BeadsAdapter` implements ~58 Bin B methods with bd-native mappings (`addPhase` → bd issue with `gsd:phase` label; `recordStateEvent` → typed comment or label; `updateSection` → per-section sub-records or comment-with-anchor) | D-MAPPING-EVENTS define the 3 recordState* families; Bin B methods are SDK-side helpers (Phase 3 D-04) not adapter methods — BeadsAdapter only implements Bin A + foundational primitives + 3 event families |
| BEADS-03 | Knowledge-graph subsystem scope decided — separate `GraphAdapter` sub-interface or out-of-scope for v1, with `gsd-phase-researcher` and `graphify.md` graceful-degradation path (resolves OQ-6) | D-OQ06 resolves via layered two-pipeline approach; no separate GraphAdapter sub-interface; BeadsAdapter synthesizes dependency edges (§8); semantic edges remain markdown-only |
| BEADS-04 | `BeadsAdapter.init()` validates the store is bd-managed before any read/write (carries forward `project_bd_managed_mismatch.md` memory from spike work) | D-INIT-ERR defines typed error class; init probe mechanism (§9) detects bd-managed state |
| BEADS-05 | `BeadsAdapter` declares `writeBinaryAsset` capability as unsupported (or routes to external blob store); UI-review and sketch workflows degrade gracefully when running on bd backend | D-BINARY resolves via skip-and-warn; capabilities.binaryAsset: false; UnsupportedCapabilityError thrown; consumer guards with hasBinaryAsset(adapter) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| State persistence (.planning/ records) | Storage layer (bd issue store) | — | BeadsAdapter owns mapping markdown records → bd issues + sub-records + comments |
| Graph edge synthesis (dependency) | Storage layer (bd native) | — | bd's `blocks`/`blocked-by` primitives are storage-native; adapter exposes them |
| Graph edge synthesis (semantic) | Application layer (graphify.cjs) | — | Markdown-only pipeline; BeadsAdapter does not participate (documented acceptable) |
| Transaction isolation | Storage layer (bd store-clone OR in-memory buffer) | — | Spike determines whether bd provides staging-store primitive or fallback to buffer |
| Schema validation (format module) | Adapter layer (BeadsAdapter format/) | — | Authored schemas per canonical file catch drift at sync time |
| Binary asset storage | Out of scope (capability: false) | — | Phase 6 declares unsupported; consumers guard; post-v1.0 blob-store routing if demanded |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x | Type-safe adapter implementation | Fork already TypeScript-native; locked contract at adapters/types.ts is TS |
| vitest | latest | Test framework for conformance smoke tests | Fork uses vitest for conformance harness (vitest.conformance.config.ts line 71) |
| node:fs/promises | native | Fallback for local file I/O when bd CLI insufficient | Standard Node.js primitives for temp dirs, JSON schema files |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| bd (hypothetical CLI) | unknown | Issue tracker backend | PRIMARY target — all record/section/frontmatter operations map to bd primitives |
| bd node bindings (if exist) | unknown | Direct SQLite access to bd store | Fallback if bd CLI insufficient for store-clone/bookmark primitives (spike investigates) |
| zod OR joi OR ajv | latest | Runtime schema validation for format module | Validate L2 sub-record schemas at sync time (drift detection); choice is planner's discretion |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bd CLI shell-out | Direct SQLite queries to bd's underlying .bd/ store | Bypasses bd's schema/validation layer; fragile to bd version changes; CLI is safer abstraction |
| Authored schemas per canonical file | Auto-derive schemas from markdown structure | Masks drift silently; authored schemas surface mismatches explicitly (D-MAPPING-SCHEMA rationale) |
| Layered graph-edges (two pipelines) | Single unified GraphAdapter sub-interface | Would expand v1.0 scope; layered approach keeps change additive and non-breaking |

**Installation (sibling repo):**
```bash
cd ~/code
mkdir gsd-beads
cd gsd-beads
npm init -y
npm install --save-dev vitest
npm install --save-dev file:../get-shit-done
# bd CLI assumed globally installed or in PATH
# If bd node bindings exist: npm install bd-bindings (hypothetical)
```

**Version verification:** bd is hypothetical/internal; no npm package found. Research assumes bd CLI exists at `which bd` on target machine. Spike Plan 06-01 validates availability and surfaces primitives.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Entry: SDK query handlers (fork repo)                          │
│   ↓ adapter.getRecord('STATE.md')                              │
│   ↓ adapter.recordStateAppend({type: 'decision', payload})      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ BeadsAdapter (sibling repo ~/code/gsd-beads)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Bin A primitives (getRecord, putRecord, updateSection)   │  │
│  │   ↓ format module: markdown ↔ sub-record transform       │  │
│  │   ↓ bd CLI shell-out OR bd node bindings                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ withTransaction(fn)                                       │  │
│  │   ↓ Outcome B: bd store-clone + bead-hash bookmark swap  │  │
│  │   ↓ Outcome A: in-memory write-buffer + sequential apply │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ recordState* event families                               │  │
│  │   ↓ recordStateAppend → push to L2 sub-record array      │  │
│  │   ↓ recordStateMutation → add/remove from L2 array       │  │
│  │   ↓ recordStateSignal → bd metadata field / marker-issue │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Dep-edge synthesizer                                      │  │
│  │   ↓ bd blocks/blocked-by → graphs/graph.json edges       │  │
│  │   ↓ {type: 'dependency', confidence: 1.0}                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ bd issue store (.bd/ SQLite OR content-addressed bead-hash)    │
│  • One issue per .planning/*.md file                           │
│  • L2 sections → bd sub-records (JSON fields)                  │
│  • L3/L4 sections → anchor-tagged comments (gsd:section:...)   │
│  • blocks/blocked-by edges → native bd graph                   │
└─────────────────────────────────────────────────────────────────┘
```

Data flow for primary use case (recordStateAppend event):
1. SDK handler calls `adapter.recordStateAppend({type: 'decision', payload})`
2. BeadsAdapter dispatcher identifies target L2 section (`## Decisions Made`)
3. Format module retrieves bd sub-record for 'decisions' key
4. Discriminant dedupe checks if entry already exists (applied:false/duplicate if present)
5. If absent, entry appended to sub-record array; scaffold section if key missing (applied:true + created_section signal)
6. Sub-record update committed to bd issue
7. Return StateWriteOutcome to caller

### Recommended Project Structure
```
~/code/gsd-beads/
├── src/
│   ├── index.ts                  # BeadsAdapter class export
│   ├── errors.ts                 # BdManagedMismatchError + UnsupportedCapabilityError re-export
│   ├── format/                   # Markdown ↔ sub-record transform
│   │   ├── state.ts              # STATE.md schema + bidirectional transform
│   │   ├── roadmap.ts            # ROADMAP.md schema + transform
│   │   ├── project.ts            # PROJECT.md schema + transform
│   │   ├── requirements.ts       # REQUIREMENTS.md schema + transform
│   │   ├── decisions.ts          # DECISIONS.md schema + transform
│   │   ├── plan.ts               # *-PLAN.md schema + transform
│   │   ├── context.ts            # *-CONTEXT.md schema + transform
│   │   ├── verification.ts       # *-VERIFICATION.md schema + transform
│   │   └── debug-session.ts      # debug-*.md schema + transform
│   ├── txn/                      # Transaction implementation (Outcome B OR A)
│   │   ├── staging-store.ts      # Outcome B: bd store-clone + bookmark
│   │   └── write-buffer.ts       # Outcome A: in-memory fallback
│   ├── init.ts                   # BeadsAdapter.init() + bd-managed probe
│   ├── dep-graph.ts              # Dependency-edge synthesizer
│   ├── bd-client.ts              # Thin wrapper around bd CLI shell-out OR node bindings
│   └── primitives/               # Bin A + foundational primitive impls
│       ├── record.ts             # getRecord, putRecord, removeRecord, removeCollection, listCollection, exists, stat
│       ├── section.ts            # getSection, updateSection (L2/L3/L4 heading-depth walker)
│       ├── frontmatter.ts        # getFrontmatter, updateFrontmatter, mergeFrontmatter
│       ├── events.ts             # recordStateAppend, recordStateMutation, recordStateSignal
│       └── named-doc.ts          # putNamedDoc, getNamedDoc discriminator
├── tests/
│   ├── conformance.test.ts       # Imports runAdapterConformanceSuite from fork
│   └── smoke/                    # Per-Bin-B-category smoke tests (phase, plan, summary, uat, state-event, debug, intel, learnings)
├── package.json                  # file:../get-shit-done dev dep; vitest scripts
├── tsconfig.json                 # Extends fork's adapters/tsconfig.json
├── vitest.config.ts              # Test config
└── README.md                     # D-TXN variant shipped (A or B), sidecar path-sniff map, gsd:* label namespace, export shape
```

### Pattern 1: Format Module Bidirectional Transform

**What:** Canonical TypeScript schemas define L2 sub-record shapes per-file. Format module exports `markdown → sub-records` (parse) and `sub-records → markdown` (render) functions for each canonical file.

**When to use:** Every `getRecord` and `putRecord` call for canonical files (STATE.md, ROADMAP.md, etc.)

**Example:**
```typescript
// Source: format/state.ts (authored by BeadsAdapter maintainers, NOT auto-derived)

export interface StateSchema {
  decisions: DecisionEntry[];
  blockers: BlockerEntry[];
  metrics: MetricEntry[];
  forensic_sessions: ForensicEntry[];
  quick_tasks: QuickTaskEntry[];
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

// Parse: markdown → sub-records
export function parseStateMd(markdown: string): StateSchema {
  const frontmatter = extractFrontmatter(markdown);  // preserved
  const body = stripFrontmatter(markdown);
  
  // Extract L2 sections via heading-depth walker
  const decisionsSection = extractSection(body, '## Decisions Made');
  const blockersSection = extractSection(body, '## Blockers');
  const metricsSection = extractSection(body, '## Metrics');
  
  // Parse section content into structured entries
  const decisions = parseDecisionsList(decisionsSection);
  const blockers = parseBlockersList(blockersSection);
  const metrics = parseMetricsTable(metricsSection);
  
  return { decisions, blockers, metrics, /* ... */ };
}

// Render: sub-records → markdown
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
  
  md += '\n## Metrics\n\n';
  md += '| Phase | Duration | Tasks | Files |\n';
  md += '|-------|----------|-------|-------|\n';
  for (const entry of schema.metrics) {
    md += `| Phase ${entry.phase} P${entry.plan} | ${entry.duration} | ${entry.tasks || '-'} tasks | ${entry.files || '-'} files |\n`;
  }
  
  return md;
}
```

### Pattern 2: StateWriteOutcome Three-State Dispatch

**What:** Every recordState* method returns a discriminated `StateWriteOutcome` with three possible states: (1) applied:true (data landed), (2) applied:true + created_section (helper scaffolded section), (3) applied:false + reason (dedupe or nothing_to_remove).

**When to use:** All three recordState* families (append, mutation, signal)

**Example:**
```typescript
// Source: adapters/markdown/index.ts lines 699–788 (MarkdownAdapter reference)

async recordStateAppend(event: AppendEvent): Promise<StateWriteOutcome> {
  return this.withTransaction(async () => {
    const raw = (await this.getRecord('STATE.md')) ?? '';
    const schema = parseStateMd(raw);  // format module
    let result: { applied: boolean; created_section?: string; reason?: string };
    
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
        
        // Append to sub-record array
        schema.decisions.push(newEntry);
        
        // Scaffold section if key was absent before
        const created = !schema.decisions.length ? '## Decisions Made' : undefined;
        
        result = { applied: true, created_section: created };
        break;
      }
      // ... other event types
    }
    
    // Render schema back to markdown via format module
    const frontmatter = await this.getFrontmatter('STATE.md') as Record<string, unknown>;
    const rendered = renderStateMd(schema, frontmatter);
    await this.putRecord('STATE.md', rendered);
    
    return result.created_section
      ? { applied: true, created_section: result.created_section }
      : { applied: true };
  });
}
```

### Pattern 3: Reentrant Transaction Guard

**What:** `withTransaction` checks if the adapter instance already holds a transaction lock. If yes, JOIN the outer transaction (no-op acquire); if no, acquire lock + create staging context.

**When to use:** Every `withTransaction` entry point to prevent deadlock when `recordState*` methods (which internally wrap `withTransaction`) call `updateSection` (which also wraps `withTransaction`).

**Example:**
```typescript
// Source: adapters/markdown/index.ts lines 563–598 (MarkdownAdapter reference)

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
    if (!ctx.dryRun) await this._commitStagingStore(ctx);  // Outcome B
    return result;
  } finally {
    try { await rm(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
    this.activeTxn = undefined;
    await this.releaseAdapterLock(lockPath);
  }
}
```

### Anti-Patterns to Avoid

- **Auto-derive schemas from markdown structure:** Drift silently masked. Explicit authored schemas catch mismatches at validation time (D-MAPPING-SCHEMA rationale).
- **Bypass format module for "simple" files:** Inconsistent transform logic across adapters; Phase 7 conformance will fail. All canonical files route through format module.
- **No-op commitPlanningState for non-git adapters:** Loses restore-point semantics (Phase 3 D-11/D-12). Every adapter must checkpoint meaningfully.
- **Silent success on discriminant dedupe:** Prior behavior (silent-true no-op) caused UAT scars in Phase 3. StateWriteOutcome three-state contract surfaces dedupe as explicit `applied: false, reason: 'duplicate'`.
- **Direct bd SQLite queries bypassing bd CLI:** Fragile to bd version changes; CLI is safer abstraction layer (§3 Stack recommendation).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown heading-depth parsing | Custom regex line-scan | Phase 5 D-06 heading-depth walker (adapters/markdown/index.ts extractSection/replaceSection ~lines 189–241) | Handles L2/L3/L4 nesting, skips headings in fenced code blocks and comments, consistent with MarkdownAdapter semantics |
| Cross-module instanceof resilience | Standard `instanceof UnsupportedCapabilityError` | `__brand` symbol + custom `[Symbol.hasInstance]` (adapters/types.ts lines 127–142) | Dual-package hazard + vitest transform can break standard instanceof; brand pattern survives |
| Transaction rollback on error | Manual try/catch + cleanup | `withTransaction(fn)` primitive (locked in adapters/types.ts line 106) | Reentrant guard + dryRun support + adapter-native concurrency mechanisms already built |
| State-mutation dedupe logic | Per-handler dedupe checks | StateWriteOutcome three-state contract (adapters/types.ts lines 50–52) | Discriminated union forces callers to handle dedupe/nothing_to_remove cases explicitly; no silent no-ops |
| Graph edge schema extension | New interface or breaking change | Additive `type: 'semantic' \| 'dependency'` field on existing edge schema | Existing consumers tolerate missing field (graceful degradation already built in); additive change non-breaking |

**Key insight:** The primitive-lifted interface (Phases 1–5) exposed 159 lines of carefully-designed contract (adapters/types.ts) that handles cross-cutting concerns (capabilities, error resilience, transaction semantics, discriminated outcomes). Building custom solutions for these problems duplicates effort and risks Phase 7 conformance failure.

## Runtime State Inventory

> **Phase 6 is greenfield — no existing runtime state to migrate.** The sibling repo `~/code/gsd-beads` does not exist on disk (verified 2026-05-11 via `ls ~/code/` — no `beads` or `gsd-beads` dir). This section documents the state categories for awareness but all answers are "None — new implementation."

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — new sibling repo created from scratch | N/A |
| Live service config | None — no bd instance configured yet | N/A |
| OS-registered state | None — no task scheduler / pm2 process / systemd unit for BeadsAdapter | N/A |
| Secrets/env vars | None — no bd-specific secrets or env vars (bd CLI assumed in PATH; no auth keys phase 6) | N/A |
| Build artifacts | None — fresh npm init; no stale egg-info / node_modules / dist from prior work | N/A |

**13 spike findings carry-forward:** SYNTHESIS.md §8 references 13 spike findings from superseded v0.2 gsd-beads work. These are **conceptual only** — not code artifacts on disk. Research understands them as design principles (format module concept, parsePhaseId helper pattern, JSONL roundtrip seed, blocks-edge sibling-dep modeling per spike 014) to inform fresh v1.0 implementation, not as files to migrate.

## Common Pitfalls

### Pitfall 1: bd CLI Primitive Availability Unknown Until Spike

**What goes wrong:** Plan 06-02+ assumes store-clone + bead-hash bookmark primitives exist and implements Outcome B (staging-store cutover). Mid-implementation discovery that bd lacks these primitives forces backtrack to Outcome A (in-memory write-buffer) with larger blast radius.

**Why it happens:** bd is hypothetical/internal with no public documentation found (pypi.org/bd 404, beadorg/bd GitHub 404). Primitive surface unknown at research time.

**How to avoid:** 
1. Plan 06-01 MUST spike bd CLI primitives before any adapter code written
2. Spike outputs a DECISION.md entry recording which primitives exist
3. Subsequent plans branch on spike outcome: Outcome B (primitives found) OR Outcome A (fallback)
4. If Outcome A forced, document sequential-commit gap in BeadsAdapter README + flag Phase 6.1 follow-up

**Warning signs:** 
- Plan 06-01 skipped or merged with scaffold plan
- withTransaction implementation started before spike completes
- Spike assumes primitives exist without validation commands

### Pitfall 2: Format Module Schema Drift Masked Until Phase 7

**What goes wrong:** BeadsAdapter's format module auto-derives L2 sub-record schemas from markdown structure on first sync. User manually edits STATE.md in markdown (adds new L2 section `## Notes`). Next BeadsAdapter sync silently creates `notes: []` sub-record. Phase 7 conformance test compares MarkdownAdapter (which preserves `## Notes` verbatim) vs BeadsAdapter (which injects empty array) and fails with mysterious drift.

**Why it happens:** Auto-derivation optimizes for convenience (no schema maintenance burden) at cost of validation. Drift is invisible until round-trip comparison.

**How to avoid:**
1. D-MAPPING-SCHEMA locks authored schemas per canonical file (not auto-derived)
2. Format module includes runtime validation step: on `parseStateMd`, assert every L2 heading in markdown has a corresponding schema field
3. If unknown L2 heading encountered, throw explicit error: `UnknownSectionError: STATE.md contains L2 heading "## Notes" not in schema. Add to format/state.ts StateSchema interface.`
4. Phase 6 smoke tests include a "schema drift detection" test: manually inject unknown L2 heading into test fixture, assert parseStateMd throws

**Warning signs:**
- Format module uses generic `Record<string, unknown>` for L2 sub-records instead of explicit typed interfaces
- No validation step in parse functions
- Tests only cover "happy path" canonical file structures

### Pitfall 3: Reentrant Transaction Deadlock

**What goes wrong:** `recordStateAppend` internally calls `withTransaction`. Inside the transaction, it calls `updateSection` to append to a different file (e.g., ROADMAP.md). `updateSection` ALSO internally calls `withTransaction` (Phase 5 D-09). The nested call attempts to acquire the same PID lockfile already held by outer transaction. O_EXCL flag on lockfile open causes EEXIST error → retry loop exhausts → force-break → partial-commit state corruption.

**Why it happens:** Phase 5 D-09 mandates `updateSection` internally wraps `withTransaction` for atomic section writes. Without reentrant guard, every nested call deadlocks.

**How to avoid:**
1. D-10 reentrant-lock guard: `acquireAdapterLock` checks `if (this.activeTxn) return;` before attempting O_EXCL open
2. Nested `withTransaction` calls JOIN the outer transaction (increment depth counter for debug, return fn() directly without acquire/release)
3. Phase 6 smoke tests include a "nested transaction" test: call `recordStateAppend` → which internally calls `updateSection` → assert no deadlock, assert both writes apply atomically

**Warning signs:**
- `acquireAdapterLock` has no activeTxn check
- Test suite has no multi-write-in-transaction coverage
- Mysterious "lock acquisition timeout" errors in CI

### Pitfall 4: Hybrid Mapping L3/L4 Anchor Path Concatenation Ambiguity

**What goes wrong:** STATE.md has two L2 sections with nested L3 headings:
```
## Investigation 2026-05-01
### Evidence
...

## Investigation 2026-05-05
### Evidence
...
```
BeadsAdapter's anchor-tagged comment path concatenates: `gsd:section:### Evidence`. Both L3 sections map to the same label. First `updateSection('STATE.md', '### Evidence', body, 'overwrite')` call accidentally overwrites the SECOND investigation's evidence (document-order first-match per Phase 5 D-07).

**Why it happens:** L3/L4 anchor paths don't include parent L2 heading context. Ambiguity in shared-name subsections.

**How to avoid:**
1. Phase 5 D-07 documents first-match contract: ambiguous anchors resolve to document-order first occurrence
2. BeadsAdapter format module includes FULL heading path in anchor label: `gsd:section:## Investigation 2026-05-01:### Evidence` and `gsd:section:## Investigation 2026-05-05:### Evidence`
3. `updateSection` caller passes more specific anchor string when disambiguation needed
4. Phase 6 smoke tests include "ambiguous L3 heading" fixture asserting correct section targeted

**Warning signs:**
- Anchor labels only include leaf heading text (no parent context)
- No disambiguation logic in `getSection` / `updateSection`
- Tests only cover unique L3 heading names

## Code Examples

Verified patterns from locked contract and reference implementation:

### Discriminated Union Dispatch (Event Families)

```typescript
// Source: adapters/state-event-types.ts (locked contract, Phase 3)

export type AppendEvent =
  | { type: 'decision'; payload: DecisionPayload }
  | { type: 'metric'; payload: MetricPayload }
  | { type: 'roadmap_evolution'; payload: RoadmapEvolutionPayload }
  | { type: 'session'; payload: SessionPayload }
  | { type: 'forensic_session'; payload: ForensicSessionPayload }
  | { type: 'quick_task'; payload: QuickTaskPayload };

export type MutationEvent =
  | { type: 'blocker_added'; payload: BlockerAddedPayload }
  | { type: 'blocker_resolved'; payload: BlockerResolvedPayload }
  | { type: 'todo_count_update'; payload: TodoCountUpdatePayload }
  | { type: 'deferred_items'; payload: DeferredItemsPayload };

export type SignalEvent =
  | { type: 'waiting'; payload: WaitingPayload }
  | { type: 'resume'; payload: ResumePayload };

// BeadsAdapter implementation (sibling repo src/primitives/events.ts):

async recordStateAppend(event: AppendEvent): Promise<StateWriteOutcome> {
  return this.withTransaction(async () => {
    switch (event.type) {
      case 'decision': {
        const { phase, summary, rationale } = event.payload;
        // Map to bd sub-record append logic here
        break;
      }
      case 'metric': {
        const { phase, plan, duration, tasks, files } = event.payload;
        // Map to bd sub-record append logic here
        break;
      }
      // ... remaining cases
      default: {
        const _exhaustive: never = event;
        throw new Error(`Unknown AppendEvent type: ${(event as { type: string }).type}`);
      }
    }
  });
}
```

### Capabilities Declaration with Fine-Grained Graph Edges

```typescript
// Source: adapters/types.ts (extended per D-OQ06-CAPS)

export interface Capabilities {
  record: true;
  section: true;
  frontmatter: true;
  binaryAsset: boolean;
  snapshot: boolean;
  transaction: boolean;
  namedDoc: boolean;
  markdownLockfile: boolean;
  graphEdges: {  // NEW in Phase 6 — additive, not breaking
    semantic: boolean;
    dependency: boolean;
  };
}

// BeadsAdapter implementation (sibling repo src/index.ts):

export class BeadsAdapter implements StorageAdapter {
  readonly name = 'beads' as const;
  
  readonly capabilities: Capabilities = {
    record: true,
    section: true,
    frontmatter: true,
    binaryAsset: false,       // D-BINARY: skip-and-warn
    snapshot: true,            // D-TXN-CAPS: true only in Outcome B
    transaction: true,         // D-TXN-CAPS: true in both outcomes
    namedDoc: true,
    markdownLockfile: false,  // bd has no markdown lockfile primitives
    graphEdges: {
      semantic: false,         // D-OQ06: markdown-only pipeline
      dependency: true,        // D-OQ06: bd blocks/blocked-by native
    },
  };
  
  // ... implementation
}
```

### BdManagedMismatchError with Brand Resilience

```typescript
// Source: adapters/types.ts UnsupportedCapabilityError pattern (lines 123–142)

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

// BeadsAdapter.init() usage (sibling repo src/init.ts):

export function init(projectDir: string): void {
  const bdDir = join(projectDir, '.bd');
  if (!existsSync(bdDir)) {
    throw new BdManagedMismatchError(
      projectDir,
      'Run `bd init` in this directory to initialize bd tracking.'
    );
  }
  // Additional validation: bd status exit code, etc.
}
```

### Fork-Side Subpath Export (package.json)

```json
// Source: this fork's package.json (Plan 06-01 adds this)

{
  "name": "get-shit-done-cc",
  "version": "1.39.0-rc.4",
  "exports": {
    ".": "./bin/install.js",
    "./conformance": "./tests/conformance/adapter.conformance.js"
  },
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

### Conformance Harness Invocation from Sibling

```typescript
// Source: sibling repo tests/conformance.test.ts (Plan 06-0N smoke tests)

import { describe } from 'vitest';
import { runAdapterConformanceSuite } from 'get-shit-done/conformance';
import { BeadsAdapter } from '../src/index.js';

// Phase 6 runs sibling-only smoke tests. Phase 7 runs full paired suite.
runAdapterConformanceSuite('beads', (projectDir) => new BeadsAdapter(projectDir));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct `node:fs` calls in SDK handlers | Adapter primitive dispatch | Phase 1–5 (2026-05-01..11) | All storage I/O routed through 159-line contract; BeadsAdapter targets this surface |
| Ad-hoc state-mutation handlers (10+ methods) | 3 event families (recordStateAppend/Mutation/Signal) | Phase 3 (2026-05-10) | Discriminated-union payloads map cleanly to bd primitives (append→sub-record, mutation→list-op, signal→metadata) |
| Implicit transaction via PID lockfile in CJS | Explicit `withTransaction(fn)` primitive | Phase 3/5 (2026-05-10..11) | BeadsAdapter maps to bd-native concurrency (store-clone OR write-buffer) |
| Promise<void> state-write returns | StateWriteOutcome three-state contract | Phase 3 gap-closure (2026-05-11) | Dedupe / nothing_to_remove / scaffold-section outcomes explicit; BeadsAdapter returns same discriminants |
| Markdown-only knowledge graph (graphify.cjs) | Layered semantic + dependency edges | Phase 6 (this research) | BeadsAdapter synthesizes bd blocks-edges as dependency type; semantic edges remain markdown-only (acceptable documented tradeoff) |

**Deprecated/outdated:**
- `commitPlanningState: boolean` capability flag — removed Phase 3 D-12; now required method on all adapters
- `readModifyWriteRoadmapMd` / `replaceInCurrentMilestone` as private helpers — Phase 1 D-09 promoted to PUBLIC capability-gated methods (`markdownLockfile` group)
- Single-variant `graph: boolean` capability — Phase 6 replaces with fine-grained `graphEdges: { semantic, dependency }`

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this
> section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | bd CLI exists at `which bd` on target machine and provides issue create/edit/read/delete, labels, comments, sub-records, and blocks/blocked-by edges | §3 Standard Stack, §5.1 Spike Design | Plan 06-01 spike fails; BeadsAdapter cannot be implemented without bd CLI or equivalent node bindings; Phase 6 blocked until bd availability confirmed |
| A2 | bd's underlying storage is either SQLite-based OR content-addressed bead-hash architecture permitting store-clone + atomic bookmark swap | §5.1 D-TXN Spike Outcome B | If bd storage model differs (e.g., REST API to remote server with no clone primitive), Outcome B infeasible; fallback to Outcome A in-memory write-buffer required |
| A3 | bd sub-records support JSON-typed mutable arrays (add/remove operations) for L2 section content mapping | §6 Format Module, §4 D-MAPPING | If bd sub-records are immutable or string-only, hybrid mapping breaks; would need comments-everywhere fallback (significantly more complex anchor-tagged comment logic) |
| A4 | bd CLI `bd init` command (or equivalent) creates `.bd/` directory marker in project root when project is bd-managed | §9 Init Failure Detection | If bd uses different marker (e.g., `.bdconfig` file, remote registration only), init probe logic incorrect; BeadsAdapter.init() false negatives |
| A5 | bd comments support arbitrary label/tag attachment (`gsd:section:...`) for anchor-path encoding | §4 D-MAPPING L3/L4 anchor-comments | If bd comment labels are restricted enum or have length limits, anchor-path encoding fails for deeply nested L3/L4 headings; would need alternative encoding (hash-based IDs, separate metadata table) |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. [TABLE NOT EMPTY — 5 assumptions require validation in Plan 06-01 spike]

## Open Questions

1. **bd CLI primitive surface — store-clone + bead-hash bookmarks**
   - What we know: D-TXN-SPIKE requires probing bd for store-clone and atomic bookmark primitives to determine Outcome B feasibility
   - What's unclear: bd documentation not found (pypi.org 404, GitHub 404); CLI command syntax, primitives exposed, node bindings availability all unknown at research time
   - Recommendation: Plan 06-01 spike MUST be first plan executed. Spike outputs include: (a) bd --help full command listing, (b) store-clone primitive validation (e.g., `bd clone <src> <dst>`), (c) bead-hash bookmark commands (e.g., `bd bookmark set <name> <hash>`), (d) node bindings availability check (`npm search bd`, `npm view bd-bindings`). If primitives unavailable, spike documents Outcome A fallback path.

2. **Format module validation strategy — runtime vs compile-time schema checks**
   - What we know: D-MAPPING-SCHEMA mandates authored schemas per canonical file; drift must be caught at sync time
   - What's unclear: Should validation be runtime (zod/joi/ajv parse + throw on mismatch) or compile-time (TypeScript strict mode + CI enforcement)? Runtime is safer but slower; compile-time is faster but requires test coverage discipline.
   - Recommendation: Runtime validation for Phase 6 (defensive; catches user-edited markdown drift immediately). CI type-checking already enforces compile-time schema presence. Phase 7 conformance may reveal performance bottleneck requiring lazy validation optimization.

3. **Dep-edge synthesizer freshness vs cost tradeoff**
   - What we know: D-OQ06 requires synthesizing bd blocks/blocked-by edges into graphs/graph.json as `{type: 'dependency', confidence: 1.0}` entries
   - What's unclear: Should synthesizer run on every `getRecord('graphs/graph.json')` (lazy, always fresh) or materialize on writes to bd blocks-edges (eager-cache, stale until next write)?
   - Recommendation: Lazy for Phase 6 (simpler, no cache invalidation logic). If `gsd-phase-researcher` graph queries become slow (>500ms), Phase 8 can add eager-cache optimization as follow-up.

4. **Sibling repo npm link vs file: dependency ergonomics**
   - What we know: D-SCAFFOLD specifies `"get-shit-done": "file:../get-shit-done"` in sibling package.json
   - What's unclear: Does `file:` dep require `npm install` re-run on every fork-side change? Will npm link be more ergonomic for iterative dev?
   - Recommendation: Start with `file:` per D-SCAFFOLD (matches user decision). If dev friction high (manual `npm install` after every fork-side change), Plan 06-02+ can switch to `npm link` with documentation update. No functional difference, only dev-loop speed.

5. **Phase 8 adapter resolution pattern — default export vs named class vs factory**
   - What we know: D-RUNTIME-RESOLUTION previews Phase 8's `require("gsd-{name}")` dynamic resolution; BeadsAdapter export shape must match resolver contract
   - What's unclear: Should BeadsAdapter export `export default class BeadsAdapter` (default), `export class BeadsAdapter` (named), or `export function createBeadsAdapter(projectDir)` (factory)?
   - Recommendation: Named class export (`export class BeadsAdapter`) for Phase 6. Matches MarkdownAdapter pattern (adapters/markdown/index.ts line 115); resolver can `require("gsd-beads").BeadsAdapter`. If Phase 8 resolver prefers factory pattern, BeadsAdapter adds factory wrapper in Phase 8 (non-breaking — factory can call `new BeadsAdapter` internally).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bd CLI | All BeadsAdapter primitives | ✗ (not found in PATH) | unknown | ✗ (blocking — no fallback; Plan 06-01 spike must validate before proceeding) |
| bd node bindings | Transaction primitives (if CLI insufficient) | ✗ (npm view bd 404, npm search bd-bindings 0 results) | — | bd CLI shell-out (slower but functional) |
| TypeScript compiler | BeadsAdapter compilation | ✓ | 5.x (fork already TS-native) | — |
| vitest | Conformance smoke tests | ✓ | latest (fork uses vitest for conformance harness) | — |
| node:fs/promises | Temp dirs, JSON schema files | ✓ | native | — |

**Missing dependencies with no fallback:**
- **bd CLI:** Plan 06-01 spike MUST confirm bd availability before any adapter code written. If bd not installed, spike documents installation steps OR surfaces blocker to user.

**Missing dependencies with fallback:**
- **bd node bindings:** If unavailable, BeadsAdapter shells to `bd` CLI for all operations. Functional but slower (spawn overhead per call). Optimization opportunity for post-v1.0.

## Validation Architecture

> Included per workflow.nyquist_validation enabled (config.json key absent = enabled default)

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (latest) |
| Config file | `vitest.config.ts` (sibling repo — created Plan 06-01) |
| Quick run command | `npm test -- tests/conformance.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BEADS-01 | Bin A primitives (getRecord, putRecord, updateSection, etc.) implement against bd CLI | unit | `npm test -- tests/conformance.test.ts::StorageAdapter conformance: beads -x` | ❌ Wave 0 |
| BEADS-02 | recordState* event families return correct StateWriteOutcome (applied:true/false, reason, created_section) | integration | `npm test -- tests/smoke/state-events.test.ts -x` | ❌ Wave 0 |
| BEADS-03 | Dep-edge synthesizer produces {type: 'dependency', confidence: 1.0} edges from bd blocks/blocked-by | unit | `npm test -- tests/smoke/dep-graph.test.ts -x` | ❌ Wave 0 |
| BEADS-04 | BeadsAdapter.init() throws BdManagedMismatchError when .bd/ dir absent | unit | `npm test -- tests/smoke/init.test.ts -x` | ❌ Wave 0 |
| BEADS-05 | writeBinaryAsset throws UnsupportedCapabilityError; capabilities.binaryAsset === false | unit | `npm test -- tests/conformance.test.ts::"binary asset unsupported" -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- {changed-test-file} -x` (fail-fast on first error)
- **Per wave merge:** `npm test` (full suite green before wave PR merge)
- **Phase gate:** Full suite green + fork's `npm run test:conformance` MarkdownAdapter baseline passing before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/conformance.test.ts` — imports `runAdapterConformanceSuite` from `get-shit-done/conformance`; covers BEADS-01 + BEADS-05
- [ ] `tests/smoke/state-events.test.ts` — covers BEADS-02 (all 3 event families, all StateWriteOutcome discriminants)
- [ ] `tests/smoke/dep-graph.test.ts` — covers BEADS-03 (bd blocks-edges → graph.json dependency edges)
- [ ] `tests/smoke/init.test.ts` — covers BEADS-04 (BdManagedMismatchError on non-bd-managed project)
- [ ] `vitest.config.ts` — sibling repo test config pointing at src/
- [ ] Framework install: `npm install --save-dev vitest` — Plan 06-01 scaffold

## Security Domain

> **Security enforcement disabled** per config.json `workflow.security_enforcement: false`. Section OMITTED per researcher contract ("Omit only if explicitly false in config").

## Sources

### Primary (HIGH confidence)
- **adapters/types.ts** (159 lines) — LOCKED StorageAdapter contract BeadsAdapter implements against. Lines 67–121 interface, lines 50–52 StateWriteOutcome, lines 123–142 UnsupportedCapabilityError pattern. [VERIFIED: Read tool 2026-05-11]
- **adapters/markdown/index.ts** (1452 lines) — Reference implementation for equivalence. Lines 563–598 withTransaction + reentrant guard, lines 699–788 recordStateAppend dispatcher, lines 189–241 extractSection/replaceSection heading-depth walker. [VERIFIED: Read tool 2026-05-11]
- **adapters/state-event-types.ts** (105 lines) — AppendEvent/MutationEvent/SignalEvent payload unions BeadsAdapter dispatches on. [VERIFIED: Read tool 2026-05-11]
- **.planning/phases/06-beadsadapter-implementation/06-CONTEXT.md** (682 lines) — USER DECISIONS from `/gsd-discuss-phase`. All locked decisions (D-OQ06, D-MAPPING, D-TXN-SPIKE, etc.) authoritative. [VERIFIED: Read tool 2026-05-11]
- **.planning/phases/03-wire-core-write-methods-recordstateevent/03-CONTEXT.md** (lines 42–62) — D-01/D-02 event-family design rationale: 3 families optimized for bd mapping (append→comment, mutation→sub-record, signal→sidecar). [VERIFIED: Read tool 2026-05-11]
- **.planning/phases/05-foundational-primitive-lift/05-CONTEXT.md** (lines 101–146) — D-06 heading-depth walker, D-09/D-10 updateSection withTransaction + reentrant guard, D-11 BeadsAdapter mapping preview. [VERIFIED: Read tool 2026-05-11]
- **.planning/REQUIREMENTS.md** (lines 63–70) — BEADS-01..05 requirements. [VERIFIED: Read tool 2026-05-11]
- **.planning/ROADMAP.md** (lines 31–32) — Phase 6 goal, depends-on, 5 Success Criteria. [VERIFIED: Read tool 2026-05-11]

### Secondary (MEDIUM confidence)
- **.planning/research/fork-investigation/SYNTHESIS.md** §8 (lines 693–709) — 13 spike findings carry-forward recommendation. Note: conceptual only, not code artifacts. [VERIFIED: Read tool 2026-05-11]
- **tests/conformance/adapter.conformance.ts** (lines 0–49) — Factory harness signature locked Phase 1 D-15. [VERIFIED: Read tool 2026-05-11]
- **package.json** (lines 71–72) — Existing fork test scripts + vitest usage. [VERIFIED: Read tool 2026-05-11]

### Tertiary (LOW confidence)
- **bd CLI existence and primitive surface** — ALL bd-related assumptions (A1–A5) LOW confidence. No documentation found (pypi.org/project/bd 404, GitHub beadorg/bd 404, `which bd` returns "not found", `npm view bd` returns unrelated package). Phase 6 cannot proceed until Plan 06-01 spike validates bd availability and surfaces primitives. [ASSUMED: bd CLI hypothetical/internal system]

## Metadata

**Confidence breakdown:**
- Standard stack: **MEDIUM** — TypeScript/vitest verified present in fork; bd CLI unverified (see Assumptions A1–A5)
- Architecture: **HIGH** — Hybrid L2 sub-records + L3/L4 anchor-comments locked in 06-CONTEXT D-MAPPING; format module pattern clear; transaction spike outcomes well-defined
- Pitfalls: **HIGH** — Reentrant transaction deadlock, schema drift masking, L3/L4 anchor ambiguity all have concrete examples from MarkdownAdapter and prior UAT scars in Phase 3
- Environment availability: **LOW** — bd CLI not found; blocking until Plan 06-01 spike validates

**Research date:** 2026-05-11
**Valid until:** 30 days (2026-06-10) — stable milestone v1.0 scope; Phase 6 locked decisions unlikely to change barring spike-discovered blockers
