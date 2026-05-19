/**
 * Staged execution pipeline — registry-level middleware for pre/post hooks
 * and full in-memory dry-run support.
 *
 * Wraps all registry handlers with prepare/execute/finalize stages.
 * When dryRun=true and the command is a mutation, the mutation executes
 * against a temporary directory clone of .planning/ instead of the real
 * project, and the before/after diff is returned without writing to disk.
 *
 * Read commands are always executed normally — they are side-effect-free.
 *
 * @example
 * ```typescript
 * import { createRegistry } from './index.js';
 * import { wrapWithPipeline } from './pipeline.js';
 *
 * const registry = createRegistry();
 * wrapWithPipeline(registry, MUTATION_COMMANDS, { dryRun: true }, adapter);
 * // mutations now return { data: { dry_run: true, diff: { ... } } }
 * ```
 */

import type { QueryResult } from './utils.js';
import type { QueryRegistry } from './registry.js';
import type { StorageAdapter, Capabilities } from '../../../adapters/types.js';

// Capability typeguard inlined to avoid runtime import of `adapters/types.ts`
// (no compiled `.js` exists at that path; only `dist/types.js` does, but
// other SDK files reference the source path via `import type` which is erased.
// Inlining keeps pipeline.ts on the same import path as everywhere else.)
function hasSnapshot(
  a: StorageAdapter,
): a is StorageAdapter & { capabilities: Capabilities & { snapshot: true } } {
  return a.capabilities.snapshot;
}

// ─── Types ─────────────────────────────────────────────────────────────────

/**
 * Configuration for the pipeline middleware.
 */
export interface PipelineOptions {
  /** When true, mutations execute against a temp clone and return a diff */
  dryRun?: boolean;
  /** Called before each handler invocation */
  onPrepare?: (command: string, args: string[], projectDir: string) => Promise<void>;
  /** Called after each handler invocation */
  onFinalize?: (command: string, args: string[], result: QueryResult) => Promise<void>;
}

/**
 * A single stage in the execution pipeline.
 */
export type PipelineStage = 'prepare' | 'execute' | 'finalize';

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Diff two file maps, returning files that changed (with before/after content).
 */
function diffPlanningState(
  before: Map<string, string | null>,
  after: Map<string, string | null>,
): Record<string, { before: string | null; after: string | null }> {
  const diff: Record<string, { before: string | null; after: string | null }> = {};
  const allKeys = new Set([...before.keys(), ...after.keys()]);
  for (const key of allKeys) {
    const b = before.get(key) ?? null;
    const a = after.get(key) ?? null;
    if (b !== a) {
      diff[`.planning/${key}`] = { before: b, after: a };
    }
  }
  return diff;
}

// ─── wrapWithPipeline ──────────────────────────────────────────────────────

/**
 * Wrap all registered handlers with prepare/execute/finalize pipeline stages.
 *
 * When dryRun=true and a mutation command is dispatched, the real projectDir
 * is cloned (only .planning/ subtree) into a temp directory. The mutation
 * runs against the clone, a before/after diff is computed, and the temp
 * directory is cleaned up in a finally block. The real project is never
 * touched during a dry run.
 *
 * @param registry - The registry whose handlers to wrap
 * @param mutationCommands - Set of command names that perform mutations
 * @param options - Pipeline configuration
 * @param adapter - The StorageAdapter instance (from createRegistry's closure). Used by the
 *   dry-run block to call snapshot/restore/getTouchedPaths without going through adapterFor.
 */
export function wrapWithPipeline(
  registry: QueryRegistry,
  mutationCommands: Set<string>,
  options: PipelineOptions,
  adapter: StorageAdapter,
): void {
  const { dryRun = false, onPrepare, onFinalize } = options;

  // Collect all currently registered commands by iterating known handlers
  // We wrap by re-registering with the same name using the same technique
  // as event emission wiring in index.ts
  const commandsToWrap: string[] = [];

  // Enumerate mutation commands via the caller-provided set. QueryRegistry also
  // exposes commands() for full command lists when needed by tooling.
  // We wrap the register method temporarily to collect known commands,
  // then restore. Instead, we use the mutation commands set + a marker approach:
  // wrap mutation commands for dry-run, and wrap all via onPrepare/onFinalize.
  //
  // For pipeline wrapping we use a two-pass approach:
  // Pass 1: wrap mutation commands (for dry-run + hooks)
  // Pass 2: wrap non-mutation commands (for hooks only, if hooks provided)

  const wrapHandler = (cmd: string, isMutation: boolean): void => {
    const original = registry.getHandler(cmd);
    if (!original) return;

    registry.register(cmd, async (args: string[], projectDir: string) => {
      // ─── Prepare stage ───────────────────────────────────────────────
      if (onPrepare) {
        await onPrepare(cmd, args, projectDir);
      }

      let result: QueryResult;

      if (dryRun && isMutation) {
        // ─── Dry-run: snapshot/restore two-pass approach (D-02) ──────
        const beforeMap = new Map<string, string | null>();
        const afterMap = new Map<string, string | null>();
        let touchedPaths: Set<string> = new Set();

        let diff: Record<string, { before: string | null; after: string | null }> = {};
        let changedFiles: string[] = [];

        if (hasSnapshot(adapter)) {
          // MarkdownAdapter path: snapshot then mutate inside txn (rollback discards
          // shadow-dir), capture afterMap inside txn (shadow-dir reads = post-mutation),
          // then restore from snapshot, then capture beforeMap (post-restore = pre-mutation).
          const snapId = await adapter.snapshot();
          let restored = false;
          try {
            await adapter.withTransaction(async () => {
              await original(args, projectDir);
              touchedPaths = adapter.getTouchedPaths();
              for (const p of touchedPaths) {
                afterMap.set(p, await adapter.getRecord(p));
              }
            });
            // Pass 2: restore then read before-images from pre-mutation state.
            await adapter.restore(snapId);
            restored = true;
            for (const p of touchedPaths) {
              beforeMap.set(p, await adapter.getRecord(p));
            }
          } finally {
            // If we threw before the explicit restore landed, attempt cleanup now.
            // Already-restored case: the second restore is a no-op or harmless throw,
            // which we absorb because the snapshot is already gone.
            if (!restored) {
              try { await adapter.restore(snapId); } catch { /* best-effort */ }
            }
          }
        } else {
          // BeadsAdapter fallback (capabilities.snapshot=false): use withTransaction
          // for rollback only. Diff is coarse-grained per D-04. touchedPaths populated
          // from BeadsAdapter's best-effort impl (synthetic bd:// paths).
          await adapter.withTransaction(async () => {
            await original(args, projectDir);
            touchedPaths = adapter.getTouchedPaths();
          });
          // beforeMap and afterMap remain empty; diff will be {} below.
        }

        diff = diffPlanningState(beforeMap, afterMap);
        changedFiles = Object.keys(diff).map(k => k.replace(/^\.planning\//, ''));

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
      } else {
        // ─── Normal execution ─────────────────────────────────────────
        result = await original(args, projectDir);
      }

      // ─── Finalize stage ───────────────────────────────────────────────
      if (onFinalize) {
        await onFinalize(cmd, args, result);
      }

      return result;
    });

    commandsToWrap.push(cmd);
  };

  // Wrap mutation commands (dry-run eligible + hooks)
  for (const cmd of mutationCommands) {
    wrapHandler(cmd, true);
  }

  // Note: non-mutation commands are NOT wrapped here for performance — callers
  // can provide onPrepare/onFinalize for mutations only. If full wrapping of
  // read commands is needed, callers should pass their command set explicitly.
}
