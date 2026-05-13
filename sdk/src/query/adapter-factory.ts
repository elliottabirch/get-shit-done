/**
 * Storage adapter factory — config-driven dispatch between MarkdownAdapter (default)
 * and BeadsAdapter (peer package `gsd-beads`). See CONTEXT.md D-04/D-05.
 *
 * Import style (D-05): static import for MarkdownAdapter (always resolvable in this repo);
 * synchronous `createRequire(import.meta.url)` shim for `gsd-beads` wrapped in try/catch
 * at the call site. This keeps the factory synchronous and matches every existing
 * `new MarkdownAdapter(projectDir)` construction site.
 *
 * The factory NEVER calls loadConfig() — callers pass the adapter name from config.
 */
import { createRequire } from 'node:module';

import { MarkdownAdapter } from '../../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../../adapters/types.js';

const _require = createRequire(import.meta.url);

export class BeadsAdapterUnavailable extends Error {
  override readonly name = 'BeadsAdapterUnavailable';
  readonly reason: 'missing-package' | 'missing-bd';
  readonly installCmd: string;
  /** Brand field for cross-module instanceof resilience (dual-package/vitest transform). */
  readonly __brand = 'BeadsAdapterUnavailable' as const;
  constructor(reason: 'missing-package' | 'missing-bd', installCmd: string) {
    super(`BeadsAdapter unavailable (${reason}). Install: ${installCmd}`);
    this.reason = reason;
    this.installCmd = installCmd;
  }
  static [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance != null &&
      typeof instance === 'object' &&
      (instance as Record<string, unknown>).__brand === 'BeadsAdapterUnavailable'
    );
  }
}

export type StorageAdapterName = 'markdown' | 'beads';

export interface CreateStorageAdapterOpts {
  adapter?: StorageAdapterName;
}

/**
 * Construct a StorageAdapter from a projectDir + optional adapter name.
 *
 * Default (undefined / 'markdown'): MarkdownAdapter (byte-identical to upstream).
 * 'beads': BeadsAdapter via `require('gsd-beads')`; throws BeadsAdapterUnavailable
 * with install hint if the peer package is not resolvable.
 *
 * @throws {BeadsAdapterUnavailable} when adapter='beads' but gsd-beads is missing.
 * @throws {Error} when adapter is an unknown string (future-proofing for typos).
 */
export function createStorageAdapter(
  projectDir: string,
  opts?: CreateStorageAdapterOpts,
): StorageAdapter {
  const adapterName: StorageAdapterName = opts?.adapter ?? 'markdown';
  if (adapterName === 'markdown') {
    return new MarkdownAdapter(projectDir);
  }
  if (adapterName === 'beads') {
    let BeadsAdapterCtor: new (p: string) => StorageAdapter;
    try {
      const mod = _require('gsd-beads') as { default?: new (p: string) => StorageAdapter } & (new (p: string) => StorageAdapter);
      // Support both default-export and namespace-export shapes.
      BeadsAdapterCtor = (mod.default ?? mod) as new (p: string) => StorageAdapter;
    } catch {
      throw new BeadsAdapterUnavailable('missing-package', 'npm install gsd-beads');
    }
    return new BeadsAdapterCtor(projectDir);
  }
  throw new Error(
    `Unknown adapter: "${String(adapterName)}". Valid values: "markdown", "beads"`,
  );
}
