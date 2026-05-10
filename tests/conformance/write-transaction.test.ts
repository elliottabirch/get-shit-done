/**
 * Phase 3 Plan 05 — Conformance test for withTransaction atomicity.
 * Verifies that withTransaction serializes concurrent access, returns
 * values, and releases locks on both success and error paths.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../adapters/types.js';

describe('withTransaction', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-write-txn-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('withTransaction executes function and mutations persist', async () => {
    await adapter.putRecord('STATE.md', '# State\n\nOriginal content\n');

    await adapter.withTransaction(async () => {
      const content = await adapter.getRecord('STATE.md');
      await adapter.putRecord('STATE.md', content! + '\nAdded in transaction\n');
    });

    const result = await adapter.getRecord('STATE.md');
    expect(result).toContain('Original content');
    expect(result).toContain('Added in transaction');
  });

  it('withTransaction returns value from callback', async () => {
    const result = await adapter.withTransaction(async () => {
      return 42;
    });

    expect(result).toBe(42);
  });

  it('withTransaction releases lock on success', async () => {
    // First transaction succeeds
    await adapter.withTransaction(async () => {
      await adapter.putRecord('test.md', 'first');
    });

    // Second transaction should succeed immediately (not timeout)
    const start = Date.now();
    await adapter.withTransaction(async () => {
      await adapter.putRecord('test.md', 'second');
    });
    const elapsed = Date.now() - start;

    // Should complete near-instantly (no lock contention)
    expect(elapsed).toBeLessThan(500);
    const content = await adapter.getRecord('test.md');
    expect(content).toBe('second');
  });

  it('withTransaction releases lock on error', async () => {
    // First transaction throws
    const thrownError = new Error('intentional failure');
    await expect(
      adapter.withTransaction(async () => {
        throw thrownError;
      }),
    ).rejects.toThrow('intentional failure');

    // Second transaction should succeed immediately (lock released)
    const start = Date.now();
    await adapter.withTransaction(async () => {
      await adapter.putRecord('test.md', 'after-error');
    });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500);
    const content = await adapter.getRecord('test.md');
    expect(content).toBe('after-error');
  });

  it('concurrent transactions serialize (second waits for first)', async () => {
    await adapter.putRecord('counter.md', '0');

    // Launch two transactions concurrently. Each reads, delays, then writes.
    // If they serialize, final value should be 2. If they interleave, it could be 1.
    const txn1 = adapter.withTransaction(async () => {
      const val = parseInt((await adapter.getRecord('counter.md'))!, 10);
      // Small delay to give txn2 time to attempt acquisition
      await new Promise<void>(r => setTimeout(r, 50));
      await adapter.putRecord('counter.md', String(val + 1));
    });

    const txn2 = adapter.withTransaction(async () => {
      const val = parseInt((await adapter.getRecord('counter.md'))!, 10);
      await adapter.putRecord('counter.md', String(val + 1));
    });

    await Promise.all([txn1, txn2]);

    const final = await adapter.getRecord('counter.md');
    expect(final).toBe('2');
  });
});
