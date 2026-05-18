/**
 * Unit tests for pipeline middleware.
 *
 * Tests wrapWithPipeline with dry-run mode, prepare/finalize callbacks,
 * and normal execution passthrough.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { QueryRegistry } from './registry.js';
import { wrapWithPipeline } from './pipeline.js';
import { createStorageAdapter } from './adapter-factory.js';
import type { StorageAdapter } from '../../../adapters/types.js';
import type { QueryResult } from './utils.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-pipeline-'));
  await mkdir(join(tmpDir, '.planning'), { recursive: true });
  await writeFile(join(tmpDir, '.planning', 'STATE.md'), '# State\nstatus: idle\n');
  // No adapter cache to clear — D-08: cache lives in createRegistry's closure
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─── Helpers ──────────────────────────────────────────────────────────────

async function hashDirForTest(dir: string): Promise<string> {
  const crypto = await import('node:crypto');
  const { readdir, readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  let entries: import('node:fs').Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return '<missing>';
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const h = crypto.createHash('sha256');
  for (const e of entries) {
    if (e.name.startsWith('.tmp-txn-') || e.name.startsWith('.tmp-snap-') || e.name === '.adapter.lock') continue;
    const p = join(dir, e.name);
    h.update(e.name);
    if (e.isFile()) {
      const content = await readFile(p);
      h.update(content);
    } else if (e.isDirectory()) {
      h.update(await hashDirForTest(p));
    }
  }
  return h.digest('hex');
}

function makeRegistry(adapter: StorageAdapter): QueryRegistry {
  const registry = new QueryRegistry();
  registry.register('read-cmd', async (_args, _dir) => ({ data: { read: true } }));
  registry.register('mut-cmd', async (_args, _dir) => {
    // Simulate a mutation: write through the shared adapter (dry-run compatible via wrapWithPipeline)
    await adapter.putRecord('MUTATED.md', '# mutated');
    return { data: { mutated: true } };
  });
  return registry;
}

const MUTATION_SET = new Set(['mut-cmd']);

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('wrapWithPipeline — passthrough (no options)', () => {
  it('read command passes through normally', async () => {
    const adapter = createStorageAdapter(tmpDir);
    const registry = makeRegistry(adapter);
    wrapWithPipeline(registry, MUTATION_SET, {}, adapter);
    const result = await registry.dispatch('read-cmd', [], tmpDir);
    expect((result.data as Record<string, unknown>).read).toBe(true);
  });

  it('mutation command executes and writes to disk when dryRun=false', async () => {
    const adapter = createStorageAdapter(tmpDir);
    const registry = makeRegistry(adapter);
    wrapWithPipeline(registry, MUTATION_SET, { dryRun: false }, adapter);
    const result = await registry.dispatch('mut-cmd', [], tmpDir);
    expect((result.data as Record<string, unknown>).mutated).toBe(true);
    // File should have been written to the real dir
    const { existsSync } = await import('node:fs');
    expect(existsSync(join(tmpDir, '.planning', 'MUTATED.md'))).toBe(true);
  });
});

describe('wrapWithPipeline — dry-run mode', () => {
  it('dry-run mutation returns diff without writing to disk', async () => {
    const adapter = createStorageAdapter(tmpDir);
    const registry = makeRegistry(adapter);
    wrapWithPipeline(registry, MUTATION_SET, { dryRun: true }, adapter);
    const result = await registry.dispatch('mut-cmd', [], tmpDir);
    const data = result.data as Record<string, unknown>;

    // Should be a dry-run result
    expect(data.dry_run).toBe(true);
    expect(data.command).toBe('mut-cmd');
    expect(data.diff).toBeDefined();
    expect(typeof data.changes_summary).toBe('string');

    // Real project should NOT have been written to
    const { existsSync } = await import('node:fs');
    expect(existsSync(join(tmpDir, '.planning', 'MUTATED.md'))).toBe(false);
  });

  it('dry-run diff contains before/after for changed files', async () => {
    const adapter = createStorageAdapter(tmpDir);
    const registry = makeRegistry(adapter);
    wrapWithPipeline(registry, MUTATION_SET, { dryRun: true }, adapter);
    const result = await registry.dispatch('mut-cmd', [], tmpDir);
    const data = result.data as Record<string, unknown>;
    const diff = data.diff as Record<string, { before: string | null; after: string | null }>;

    // MUTATED.md is a new file — before should be null
    const mutatedKey = Object.keys(diff).find(k => k.includes('MUTATED'));
    expect(mutatedKey).toBeDefined();
    expect(diff[mutatedKey!].before).toBeNull();
    expect(diff[mutatedKey!].after).toBe('# mutated');
  });

  it('dry-run read command executes normally (side-effect-free)', async () => {
    const adapter = createStorageAdapter(tmpDir);
    const registry = makeRegistry(adapter);
    wrapWithPipeline(registry, MUTATION_SET, { dryRun: true }, adapter);
    // read-cmd is NOT in MUTATION_SET, so it's not wrapped at all
    const result = await registry.dispatch('read-cmd', [], tmpDir);
    expect((result.data as Record<string, unknown>).read).toBe(true);
  });

  it('dry-run changes_summary reflects number of changed files', async () => {
    const adapter = createStorageAdapter(tmpDir);
    const registry = makeRegistry(adapter);
    wrapWithPipeline(registry, MUTATION_SET, { dryRun: true }, adapter);
    const result = await registry.dispatch('mut-cmd', [], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.changes_summary).toContain('1 file');
  });
});

describe('wrapWithPipeline — prepare/finalize callbacks', () => {
  it('onPrepare fires before mutation execution', async () => {
    const adapter = createStorageAdapter(tmpDir);
    const registry = makeRegistry(adapter);
    const preparedCommands: string[] = [];
    wrapWithPipeline(registry, MUTATION_SET, {
      onPrepare: async (cmd) => { preparedCommands.push(cmd); },
    }, adapter);
    await registry.dispatch('mut-cmd', ['arg1'], tmpDir);
    expect(preparedCommands).toContain('mut-cmd');
  });

  it('onFinalize fires after mutation with result', async () => {
    const adapter = createStorageAdapter(tmpDir);
    const registry = makeRegistry(adapter);
    let capturedResult: QueryResult | null = null;
    wrapWithPipeline(registry, MUTATION_SET, {
      onFinalize: async (_cmd, _args, result) => { capturedResult = result; },
    }, adapter);
    await registry.dispatch('mut-cmd', [], tmpDir);
    expect(capturedResult).not.toBeNull();
  });

  it('onPrepare receives correct args', async () => {
    const adapter = createStorageAdapter(tmpDir);
    const registry = makeRegistry(adapter);
    let capturedArgs: string[] = [];
    wrapWithPipeline(registry, MUTATION_SET, {
      onPrepare: async (_cmd, args) => { capturedArgs = args; },
    }, adapter);
    await registry.dispatch('mut-cmd', ['foo', 'bar'], tmpDir);
    expect(capturedArgs).toEqual(['foo', 'bar']);
  });

  it('onFinalize fires even in dry-run mode', async () => {
    const adapter = createStorageAdapter(tmpDir);
    const registry = makeRegistry(adapter);
    let finalizeCalled = false;
    wrapWithPipeline(registry, MUTATION_SET, {
      dryRun: true,
      onFinalize: async () => { finalizeCalled = true; },
    }, adapter);
    await registry.dispatch('mut-cmd', [], tmpDir);
    expect(finalizeCalled).toBe(true);
  });
});

describe('wrapWithPipeline — unregistered command passthrough', () => {
  it('commands not in mutation set are not wrapped', async () => {
    const adapter = createStorageAdapter(tmpDir);
    const registry = makeRegistry(adapter);
    const spy = vi.fn(async (_args: string[], _dir: string): Promise<QueryResult> => ({ data: { value: 42 } }));
    registry.register('other-cmd', spy);
    wrapWithPipeline(registry, MUTATION_SET, {
      onPrepare: async () => { /* should not fire for non-mutation */ },
    }, adapter);
    const result = await registry.dispatch('other-cmd', [], tmpDir);
    // Since other-cmd is not in MUTATION_SET, it's not wrapped
    expect((result.data as Record<string, unknown>).value).toBe(42);
  });
});

describe('wrapWithPipeline — SC#1 byte-identity', () => {
  it('SC#1: dry-run with mid-txn failure leaves .planning/ byte-identical', async () => {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const { readdirSync } = await import('node:fs');
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), '# pre\n');
    await writeFile(join(tmpDir, '.planning', 'PROJECT.md'), '# pre-proj\n');

    const preHash = await hashDirForTest(join(tmpDir, '.planning'));

    const adapter = createStorageAdapter(tmpDir);
    const registry = makeRegistry(adapter);
    registry.register('throw-mid-txn', async (_args, _dir) => {
      await adapter.putRecord('STATE.md', '# mutated\n');
      throw new Error('intentional mid-txn failure');
    });
    const MUTATIONS = new Set(['throw-mid-txn']);
    wrapWithPipeline(registry, MUTATIONS, { dryRun: true }, adapter);

    await expect(registry.dispatch('throw-mid-txn', [], tmpDir))
      .rejects.toThrow('intentional mid-txn failure');

    const postHash = await hashDirForTest(join(tmpDir, '.planning'));
    expect(postHash).toBe(preHash);

    const leftovers = readdirSync(join(tmpDir, '.planning'))
      .filter(n => n.startsWith('.tmp-txn-'));
    expect(leftovers).toEqual([]);
  });
});
