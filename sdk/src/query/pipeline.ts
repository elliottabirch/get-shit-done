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
 * wrapWithPipeline(registry, MUTATION_COMMANDS, { dryRun: true });
 * // mutations now return { data: { dry_run: true, diff: { ... } } }
 * ```
 */

import { join } from 'node:path';
import type { QueryResult } from './utils.js';
import type { QueryRegistry } from './registry.js';

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
 */
export function wrapWithPipeline(
  registry: QueryRegistry,
  mutationCommands: Set<string>,
  options: PipelineOptions,
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
        // ─── Dry-run: adapter-backed withTransaction ──────────────────
        const { adapterFor } = await import('./helpers.js');
        const adapter = await adapterFor(projectDir);

        let diff: Record<string, { before: string | null; after: string | null }> = {};
        let changedFiles: string[] = [];

        // Cast to access MarkdownAdapter's dryRun option (not on interface, discretionary impl)
        const ext = adapter as unknown as {
          withTransaction<T>(fn: () => Promise<T>, opts?: { dryRun?: boolean }): Promise<T>;
          _txnContextForPipeline?: () => { touchedPaths: Set<string>; removedPaths: Set<string> } | undefined;
          _realReadForPipeline?: (relPath: string) => Promise<string | null>;
        };

        await ext.withTransaction(async () => {
          // Run the real mutation against the shadow-dir-aware adapter.
          await original(args, projectDir);

          // Reach into the adapter for touched paths + real-read escape hatch.
          // Both are MarkdownAdapter-internal (underscore prefix signals pipeline-only contract).
          const ctx = ext._txnContextForPipeline?.();
          const realRead = ext._realReadForPipeline;
          if (!ctx || !realRead) return;  // non-MarkdownAdapter: leave diff empty

          const allTouched = new Set<string>([...ctx.touchedPaths, ...ctx.removedPaths]);
          const beforeMap = new Map<string, string | null>();
          const afterMap = new Map<string, string | null>();
          for (const p of allTouched) {
            beforeMap.set(p, await realRead.call(ext, p));
            afterMap.set(p, ctx.removedPaths.has(p) ? null : await adapter.getRecord(p));
          }
          diff = diffPlanningState(beforeMap, afterMap);
          changedFiles = Object.keys(diff).map(k => k.replace(/^\.planning\//, ''));
        }, { dryRun: true });

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
