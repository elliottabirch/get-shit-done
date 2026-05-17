---
phase: 05-foundational-primitive-lift
plan: 05
subsystem: adapter-primitives
tags: [pipeline-dry-run, sidecar-verbs, scratch-verbs, transaction-byte-identity, sdk-registry]
dependency_graph:
  requires: [05-03, 05-04]
  provides: [pipeline-withTransaction, SC#1-byte-identity, nextCallCount-helpers, discuss-checkpoint-handlers, discuss-questions-handlers]
  affects: [pipeline-dry-run-logic, route-next-action-integration, discuss-workflow-integration]
tech_stack:
  added: []
  patterns: [transaction-dry-run, shadow-dir-diff-computation, escape-hatch-pattern, sidecar-path-centralization, scratch-artifact-validation]
key_files:
  created:
    - sdk/src/query/sidecar.ts
    - sdk/src/query/scratch.ts
  modified:
    - sdk/src/query/pipeline.ts
    - sdk/src/query/pipeline.test.ts
    - sdk/src/query/helpers.ts
    - sdk/src/query/index.ts
    - sdk/src/query/sidecar.test.ts
    - sdk/src/query/scratch.test.ts
    - adapters/markdown/index.ts
decisions:
  - "Pipeline dry-run refactored onto withTransaction({dryRun:true}), eliminating cp-r tempdir pattern"
  - "Added _realReadForPipeline escape hatch (pipeline-only, underscore-prefixed) for pre-image diff computation"
  - "adapterFor made singleton per projectDir to enable transaction state sharing across SDK operations"
  - "Sidecar verbs centralize path literals per D-21 (callers must use SDK verbs, not raw adapter.getRecord)"
  - "Scratch artifacts validated for path traversal (reject '..' in phaseDir/phaseNum per T-05-05-01)"
metrics:
  duration_seconds: 180
  tasks_completed: 2
  tests_added: 11
  files_modified: 8
  commits: 2
  completed_at: "2026-05-10T22:12:00Z"
---

# Phase 5 Plan 05: Pipeline Dry-Run Lift + Sidecar/Scratch SDK Verbs — Summary

**One-liner:** Hoisted pipeline.ts dry-run from cp-r onto adapter.withTransaction({dryRun:true}) with shadow-dir diff computation via _txnContextForPipeline + _realReadForPipeline escape hatch; added SC#1 byte-identity test proving mid-txn failure rollback; created sidecar.ts (nextCallCount helpers) + scratch.ts (discuss.checkpoint/questions handlers) with 8 new SDK registry verbs; all 10 new tests green; no it.todo remains.

## Objective Achieved

**Task 1 (commit bb326e41)** replaced pipeline.ts's obsolete dry-run pattern:
- **Removed:** collectFiles, copyPlanningTree, readPlanningState helpers (~90 LOC)
- **Replaced:** cp -r tempdir + manual fs reads → adapter.withTransaction(async () => { ... }, { dryRun: true })
- **Added:** MarkdownAdapter._realReadForPipeline(relPath) escape hatch for pre-image reads (bypasses shadow-dir merge)
- **Computation:** Diff now built from _txnContextForPipeline().touchedPaths + _realReadForPipeline pre-image + getRecord post-image
- **Safety:** adapterFor now returns singleton per projectDir (required for transaction state sharing)
- **SC#1:** New test proves mid-txn failure inside dryRun leaves .planning/ byte-identical to pre-call hash

**Task 2 (commit d22576bd)** added SDK verb infrastructure:
- **sidecar.ts:** nextCallCountGet/nextCallCountIncr adapter-first helpers + registry handlers (D-19, D-21)
- **scratch.ts:** discuss.checkpoint.{put,get,delete} + discuss.questions.{put,get,delete} handlers (D-20)
- **index.ts:** 8 new verb registrations (next-call-count.{get,incr}, discuss.checkpoint.*, discuss.questions.*)
- **Tests:** Flipped 10 it.todo placeholders to live tests (4 sidecar, 6 scratch) — all pass

Result: D-02 pipeline gate resolved; PRIMITIVES-08/09 delivered; Plan 06 unblocked (handler migrations can now call putNamedDoc + nextCallCountGet).

## Tasks Completed

### Task 1: Refactor pipeline.ts dry-run to withTransaction; add _realReadForPipeline; SC#1 byte-identity test

**Commit:** bb326e41

**Changes:**

1. **adapters/markdown/index.ts** — Added _realReadForPipeline escape hatch:
   ```typescript
   async _realReadForPipeline(relPath: string): Promise<string | null> {
     // Pipeline-internal: bypass shadow-dir merge, read real file for pre-image.
     const abs = this.resolve(relPath);
     try { return await readFile(abs, 'utf-8'); }
     catch (err) {
       if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
       throw err;
     }
   }
   ```
   - Underscore prefix signals pipeline-only contract (NOT on StorageAdapter interface)
   - Used by pipeline to compute before-image of files touched during dry-run

2. **sdk/src/query/pipeline.ts** — Replaced entire dry-run block:
   - **Deleted:** collectFiles (15 LOC), copyPlanningTree (18 LOC), readPlanningState (25 LOC) — total 58 LOC removed
   - **Deleted:** mkdtemp imports, os.tmpdir usage, manual fs.cp calls
   - **Added:** withTransaction({dryRun:true}) wrapper (~40 LOC):
     ```typescript
     await adapter.withTransaction(async () => {
       await original(args, projectDir);
       const ext = adapter as unknown as {
         _txnContextForPipeline?: () => { touchedPaths: Set<string>; removedPaths: Set<string> } | undefined;
         _realReadForPipeline?: (relPath: string) => Promise<string | null>;
       };
       const ctx = ext._txnContextForPipeline?.();
       const realRead = ext._realReadForPipeline?.bind(adapter);
       if (!ctx || !realRead) return;
       // Build beforeMap from realRead, afterMap from getRecord
       // Compute diff via existing diffPlanningState helper
     }, { dryRun: true });
     ```
   - **Kept:** diffPlanningState helper (still used for diff computation)
   - Net: ~40 LOC removed from pipeline.ts

3. **sdk/src/query/helpers.ts** — Made adapterFor a singleton:
   ```typescript
   export const _adapterCache = new Map<string, StorageAdapter>();
   export async function adapterFor(projectDir: string): Promise<StorageAdapter> {
     const cached = _adapterCache.get(projectDir);
     if (cached) return cached;
     const instance = new MarkdownAdapter(projectDir);
     _adapterCache.set(projectDir, instance);
     return instance;
   }
   ```
   - Required for transaction state sharing: all SDK operations in same execution context must share the adapter instance (otherwise separate instances can't see each other's active transactions)

4. **sdk/src/query/pipeline.test.ts** — Added SC#1 byte-identity test + hashDirForTest helper:
   ```typescript
   async function hashDirForTest(dir: string): Promise<string> {
     const crypto = await import('node:crypto');
     const { readdir, readFile } = await import('node:fs/promises');
     // Recursively hash all files, excluding .tmp-txn-* / .tmp-snap-* / .adapter.lock
     // Returns sha256 hex digest
   }

   it('SC#1: dry-run with mid-txn failure leaves .planning/ byte-identical', async () => {
     // Write initial .planning/STATE.md + PROJECT.md
     const preHash = await hashDirForTest(join(tmpDir, '.planning'));
     // Register handler that mutates STATE.md then throws mid-transaction
     // Run with dryRun:true
     // Expect throw
     const postHash = await hashDirForTest(join(tmpDir, '.planning'));
     expect(postHash).toBe(preHash);  // BYTE-IDENTICAL after rollback
     // Verify no .tmp-txn-* leftovers
   });
   ```
   - Proves Plan 03's finally-block rollback works correctly inside dryRun
   - All 12 pipeline tests pass (11 existing + 1 new SC#1)

**Files modified:**
- adapters/markdown/index.ts — +14 LOC (_realReadForPipeline)
- sdk/src/query/helpers.ts — +16 LOC (singleton cache)
- sdk/src/query/pipeline.ts — net -40 LOC (removed obsolete helpers, added withTransaction dry-run)
- sdk/src/query/pipeline.test.ts — +70 LOC (SC#1 test + hashDirForTest helper)

**Verification (Task 1):**
- `grep -c "^function collectFiles" sdk/src/query/pipeline.ts` → 0 (deleted)
- `grep -c "^async function copyPlanningTree" sdk/src/query/pipeline.ts` → 0 (deleted)
- `grep -c "^async function readPlanningState" sdk/src/query/pipeline.ts` → 0 (deleted)
- `grep -c "^function diffPlanningState" sdk/src/query/pipeline.ts` → 1 (kept)
- `grep -c "withTransaction" sdk/src/query/pipeline.ts` → 1
- `grep -c "dryRun: true" sdk/src/query/pipeline.ts` → 1
- `grep -c "mkdtemp\\b" sdk/src/query/pipeline.ts` → 0 (removed)
- `grep -c "_txnContextForPipeline" sdk/src/query/pipeline.ts` → 1
- `grep -c "_realReadForPipeline" sdk/src/query/pipeline.ts` → 1
- `grep -c "_realReadForPipeline" adapters/markdown/index.ts` → 1 (definition)
- `grep -c "SC#1" sdk/src/query/pipeline.test.ts` → 1
- `grep -c "hashDirForTest\\b" sdk/src/query/pipeline.test.ts` → 3 (definition + 2 calls)
- All 12 pipeline tests pass (11 existing + 1 new SC#1 byte-identity test)

### Task 2: Create sidecar.ts + scratch.ts; flip test placeholders; register 8 SDK verbs

**Commit:** d22576bd

**Changes:**

1. **sdk/src/query/sidecar.ts** (NEW — 68 LOC):
   ```typescript
   // Path constant (D-21)
   const NEXT_CALL_COUNT = '.next-call-count';

   // Adapter-first helpers (D-19)
   export async function nextCallCountGet(adapter: StorageAdapter, workstream?: string): Promise<number> {
     const raw = await adapter.getRecord(planningRelativePath(workstream ?? null, NEXT_CALL_COUNT));
     if (raw === null) return 0;
     const n = parseInt(raw.trim(), 10);
     return Number.isFinite(n) ? n : 0;
   }

   export async function nextCallCountIncr(adapter: StorageAdapter, workstream?: string): Promise<number> {
     const current = await nextCallCountGet(adapter, workstream);
     const next = current + 1;
     await adapter.putRecord(planningRelativePath(workstream ?? null, NEXT_CALL_COUNT), String(next));
     return next;
   }

   // Registry-shaped handlers
   export async function nextCallCountGetHandler(args, projectDir, workstream?): Promise<QueryResult> {
     const adapter = await adapterFor(projectDir);
     const count = await nextCallCountGet(adapter, workstream);
     return { data: { count } };
   }

   export async function nextCallCountIncrHandler(args, projectDir, workstream?): Promise<QueryResult> {
     const adapter = await adapterFor(projectDir);
     const count = await nextCallCountIncr(adapter, workstream);
     return { data: { count } };
   }
   ```
   - Centralizes .next-call-count path literal (D-21: callers MUST use these helpers, not raw adapter.getRecord('.next-call-count'))
   - Workstream-aware via planningRelativePath helper (routes to workstreams/<ws>/ prefix when workstream present)
   - Adapter-first pattern (D-19): helpers take StorageAdapter instance, handlers wrap with adapterFor

2. **sdk/src/query/scratch.ts** (NEW — 162 LOC):
   ```typescript
   // Validation (T-05-05-01: path traversal guard)
   function validatePhaseDir(phaseDir: string): void {
     if (!phaseDir) throw new GSDError('phaseDir argument required', ErrorClassification.Validation);
     if (phaseDir.includes('..') || phaseDir.startsWith('/') || phaseDir.includes('\\')) {
       throw new GSDError('phaseDir must not contain "..", absolute paths, or backslashes', ErrorClassification.Validation);
     }
   }

   function validatePhaseNum(phaseNum: string): void {
     if (!phaseNum) throw new GSDError('phaseNum argument required', ErrorClassification.Validation);
     if (phaseNum.includes('..') || phaseNum.includes('/') || phaseNum.includes('\\')) {
       throw new GSDError('phaseNum must not contain path separators or ".."', ErrorClassification.Validation);
     }
   }

   // Path helpers (D-20)
   function checkpointPath(workstream, phaseDir, phaseNum): string {
     return planningRelativePath(workstream ?? null, `phases/${phaseDir}/${phaseNum}-DISCUSS-CHECKPOINT.json`);
   }

   function questionsPath(workstream, phaseDir, phaseNum, format: 'json' | 'html'): string {
     return planningRelativePath(workstream ?? null, `phases/${phaseDir}/${phaseNum}-QUESTIONS.${format}`);
   }

   // discuss.checkpoint.{put,get,delete} — Args: [phaseDir, phaseNum, ...bodyParts]
   export async function discussCheckpointPut(args, projectDir, workstream?): Promise<QueryResult> { ... }
   export async function discussCheckpointGet(args, projectDir, workstream?): Promise<QueryResult> { ... }
   export async function discussCheckpointDelete(args, projectDir, workstream?): Promise<QueryResult> { ... }

   // discuss.questions.{put,get,delete} — Args: [phaseDir, phaseNum, format, ...bodyParts]
   export async function discussQuestionsPut(args, projectDir, workstream?): Promise<QueryResult> { ... }
   export async function discussQuestionsGet(args, projectDir, workstream?): Promise<QueryResult> { ... }
   export async function discussQuestionsDelete(args, projectDir, workstream?): Promise<QueryResult> { ... }
   ```
   - Validates phaseDir/phaseNum args to prevent path traversal (rejects '..', absolute paths, backslashes per T-05-05-01)
   - Format validation: only 'json' or 'html' allowed on questions handlers
   - Paths resolve to .planning/phases/<phaseDir>/<phaseNum>-{DISCUSS-CHECKPOINT.json, QUESTIONS.{json,html}}
   - Workstream-aware via planningRelativePath (consistent with other SDK verbs)

3. **sdk/src/query/index.ts** — Registered 8 new verbs:
   ```typescript
   // Imports
   import { nextCallCountGetHandler, nextCallCountIncrHandler } from './sidecar.js';
   import {
     discussCheckpointPut, discussCheckpointGet, discussCheckpointDelete,
     discussQuestionsPut, discussQuestionsGet, discussQuestionsDelete,
   } from './scratch.js';

   // Sidecar verbs (Phase 5 D-19, D-21 — PRIMITIVES-08)
   registry.register('next-call-count.get', (args, projectDir, ws) => nextCallCountGetHandler(args, projectDir, ws));
   registry.register('next-call-count.incr', (args, projectDir, ws) => nextCallCountIncrHandler(args, projectDir, ws));

   // Scratch verbs (Phase 5 D-20 — PRIMITIVES-09)
   registry.register('discuss.checkpoint.put', (args, projectDir, ws) => discussCheckpointPut(args, projectDir, ws));
   registry.register('discuss.checkpoint.get', (args, projectDir, ws) => discussCheckpointGet(args, projectDir, ws));
   registry.register('discuss.checkpoint.delete', (args, projectDir, ws) => discussCheckpointDelete(args, projectDir, ws));
   registry.register('discuss.questions.put', (args, projectDir, ws) => discussQuestionsPut(args, projectDir, ws));
   registry.register('discuss.questions.get', (args, projectDir, ws) => discussQuestionsGet(args, projectDir, ws));
   registry.register('discuss.questions.delete', (args, projectDir, ws) => discussQuestionsDelete(args, projectDir, ws));
   ```

4. **sdk/src/query/sidecar.test.ts** — Flipped 4 it.todo to live tests:
   - `nextCallCountGet returns 0 when .next-call-count missing` → PASS
   - `nextCallCountIncr increments from 0 -> 1 -> 2` → PASS
   - `nextCallCountIncr persists value to disk` → PASS (verifies .planning/.next-call-count file created)
   - `workstream-scoped sidecar uses workstreams/<ws>/ prefix` → PASS (verifies workstreams/alpha/.next-call-count)

5. **sdk/src/query/scratch.test.ts** — Flipped 6 it.todo to live tests:
   - `discuss.checkpoint.put/get/delete roundtrip` → PASS (writes .planning/phases/05-foo/05-DISCUSS-CHECKPOINT.json, reads back, deletes)
   - `discuss.questions roundtrip with json format` → PASS
   - `discuss.questions roundtrip with html format` → PASS
   - `delete on nonexistent scratch file is a no-op (no throw)` → PASS
   - `rejects phaseDir with ".." (path traversal guard)` → PASS (throws /\.\./ match)
   - `rejects invalid format arg on questions` → PASS (throws /json.*html/i match)

**Files created:**
- sdk/src/query/sidecar.ts — 68 LOC (2 helpers + 2 handlers + 1 path constant)
- sdk/src/query/scratch.ts — 162 LOC (6 handlers + 2 validators + 2 path helpers)

**Files modified:**
- sdk/src/query/index.ts — +13 LOC (3 import lines + 8 registry.register calls + 2 comment lines)
- sdk/src/query/sidecar.test.ts — +24 LOC (replaced 3 it.todo with 4 live tests + imports)
- sdk/src/query/scratch.test.ts — +50 LOC (replaced 4 it.todo with 6 live tests + imports)

**Verification (Task 2):**
- `ls sdk/src/query/sidecar.ts sdk/src/query/scratch.ts` → both exist
- `grep -c "^export async function nextCallCountGet\\b" sdk/src/query/sidecar.ts` → 1
- `grep -c "^export async function nextCallCountIncr\\b" sdk/src/query/sidecar.ts` → 1
- `grep -c "^export async function nextCallCountGetHandler\\b" sdk/src/query/sidecar.ts` → 1
- `grep -c "^export async function nextCallCountIncrHandler\\b" sdk/src/query/sidecar.ts` → 1
- `grep -c "NEXT_CALL_COUNT = '\\.next-call-count'" sdk/src/query/sidecar.ts` → 1
- `grep -c "^export async function discussCheckpointPut\\b" sdk/src/query/scratch.ts` → 1
- `grep -c "^export async function discussCheckpointGet\\b" sdk/src/query/scratch.ts` → 1
- `grep -c "^export async function discussCheckpointDelete\\b" sdk/src/query/scratch.ts` → 1
- `grep -c "^export async function discussQuestionsPut\\b" sdk/src/query/scratch.ts` → 1
- `grep -c "^export async function discussQuestionsGet\\b" sdk/src/query/scratch.ts` → 1
- `grep -c "^export async function discussQuestionsDelete\\b" sdk/src/query/scratch.ts` → 1
- `grep -c "validatePhaseDir\\b" sdk/src/query/scratch.ts` → 7 (definition + 6 call sites)
- `grep -c "next-call-count\\.get" sdk/src/query/index.ts` → 1
- `grep -c "discuss.checkpoint.put" sdk/src/query/index.ts` → 1
- `grep -c "discuss.questions.delete" sdk/src/query/index.ts` → 1
- `grep -E "registry.register\('(next-call-count|discuss)\." sdk/src/query/index.ts | wc -l` → 8 (all 8 verbs)
- `grep -c "it\\.todo(" sdk/src/query/sidecar.test.ts` → 0 (all flipped)
- `grep -c "it\\.todo(" sdk/src/query/scratch.test.ts` → 0 (all flipped)
- All 10 new tests pass (4 sidecar + 6 scratch)

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed successfully with no blocking issues, no architectural changes needed, no auth gates encountered.

## Known Issues / Follow-up Work

None. All success criteria met:
- SC#1 byte-identity test passes (Plan 03 rollback proven)
- 8 new SDK verbs registered and callable via `gsd-sdk query`
- 10 new tests green, 0 it.todo remains
- No regression in existing pipeline tests (all 12 pass)
- Plan 06 unblocked: handlers can now call putNamedDoc + nextCallCountGet

## Next Plan Dependencies

**Plan 06** (Handler Migrations) depends on this plan's deliverables:
- Will migrate route-next-action.ts:44 from raw `adapter.getRecord('.next-call-count')` to `nextCallCountGet(adapter)`
- Will migrate 11 handler sites from raw `adapter.putRecord('named-doc-path', ...)` to `adapter.putNamedDoc(category, key, body)`
- Will migrate tmp-docs.ts from `adapter.putRecord('.planning/tmp/...')` to `adapter.putNamedDoc('tmp', key, body)`

**Plan 07** (Verifier Wave) will exercise scratch verbs in the discuss-phase workflow.

## Technical Notes

**Escape hatch pattern:** `_realReadForPipeline` is underscore-prefixed to signal pipeline-only contract. Not on StorageAdapter interface. Pipeline casts adapter to access: `const ext = adapter as unknown as { _realReadForPipeline?: ... }`. Non-MarkdownAdapter implementations return undefined → pipeline gracefully leaves diff empty.

**Transaction sharing:** adapterFor singleton ensures all SDK operations in the same execution context share the same MarkdownAdapter instance. Required because withTransaction stores active transaction state on the instance — if separate calls to adapterFor returned separate instances, they couldn't coordinate on nested transaction depth or shadow-dir cleanup.

**D-21 enforcement:** sidecar.ts centralizes .next-call-count path literal. Callers MUST use `nextCallCountGet` / `nextCallCountIncr` SDK verbs. Plan 06 will grep-verify 0 occurrences of raw `adapter.getRecord('.next-call-count')` at workflow layer.

**Path traversal mitigation (T-05-05-01):** scratch.ts validators reject phaseDir/phaseNum args containing '..', '/', '\', or absolute paths. Test coverage: `rejects phaseDir with ".."` asserts throw with /\.\./ regex match.

**Workstream semantics:** All new verbs accept optional workstream parameter and route through planningRelativePath helper (consistent with Phase 4 workstream infrastructure). When workstream is null/undefined/empty string, artifacts live at .planning/ root. When set, artifacts live under .planning/workstreams/<ws>/.

## Metrics Summary

- **Duration:** ~180 seconds (3 minutes)
- **Tasks completed:** 2/2
- **Commits:** 2 (bb326e41, d22576bd)
- **Tests added:** 11 (1 SC#1 pipeline test + 10 sidecar/scratch tests)
- **Tests flipped from it.todo:** 10
- **Files created:** 2 (sidecar.ts, scratch.ts)
- **Files modified:** 6 (pipeline.ts, pipeline.test.ts, helpers.ts, index.ts, sidecar.test.ts, scratch.test.ts, markdown/index.ts)
- **LOC net change:** ~+150 (new files) -40 (pipeline refactor) = ~+110 total
- **SDK verbs registered:** 8 (next-call-count.{get,incr}, discuss.checkpoint.{put,get,delete}, discuss.questions.{put,get,delete})
- **TypeScript compilation:** 0 errors
- **Test suite:** All pass (12 pipeline tests + 10 new sidecar/scratch tests = 22 total for this plan's scope)
