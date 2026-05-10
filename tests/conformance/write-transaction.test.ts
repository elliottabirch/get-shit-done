/**
 * Phase 3 Plan 05 — Conformance test for withTransaction atomicity.
 * Verifies that withTransaction serializes concurrent access, returns
 * values, and releases locks on both success and error paths.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../adapters/types.js';

async function hashDir(dir: string): Promise<string> {
  const crypto = await import('node:crypto');
  const { readdir: rd, readFile: rf } = await import('node:fs/promises');
  let entries: import('node:fs').Dirent[];
  try { entries = await rd(dir, { withFileTypes: true }); }
  catch { return '<missing>'; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const h = crypto.createHash('sha256');
  for (const e of entries) {
    if (e.name.startsWith('.tmp-txn-') || e.name.startsWith('.tmp-snap-') || e.name === '.adapter.lock') continue;
    const p = join(dir, e.name);
    h.update(e.name);
    if (e.isFile()) h.update(await rf(p));
    else if (e.isDirectory()) h.update(await hashDir(p));
  }
  return h.digest('hex');
}

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

  it('dryRun: true rolls back all writes', async () => {
    await adapter.putRecord('STATE.md', 'before');
    await adapter.withTransaction(async () => {
      await adapter.putRecord('STATE.md', 'inside-txn');
      const mid = await adapter.getRecord('STATE.md');
      expect(mid).toBe('inside-txn');  // in-txn reads see their own writes
    }, { dryRun: true });
    const after = await adapter.getRecord('STATE.md');
    expect(after).toBe('before');
  });

  it('mid-txn failure leaves .planning/ byte-identical to pre-txn state (SC#1)', async () => {
    await adapter.putRecord('STATE.md', '# pre-state\n');
    await adapter.putRecord('PROJECT.md', '# pre-project\n');
    const beforeHash = await hashDir(join(tmpDir, '.planning'));

    await expect(
      adapter.withTransaction(async () => {
        await adapter.putRecord('STATE.md', '# mutated\n');
        await adapter.putRecord('PROJECT.md', '# also mutated\n');
        throw new Error('intentional mid-txn failure');
      }),
    ).rejects.toThrow('intentional mid-txn failure');

    const afterHash = await hashDir(join(tmpDir, '.planning'));
    expect(afterHash).toBe(beforeHash);
    expect(await adapter.getRecord('STATE.md')).toBe('# pre-state\n');
    expect(await adapter.getRecord('PROJECT.md')).toBe('# pre-project\n');
  });

  it('shadow-dir tmpdir is cleaned up after commit', async () => {
    await adapter.withTransaction(async () => {
      await adapter.putRecord('foo.md', 'x');
    });
    const entries = await readdir(join(tmpDir, '.planning'), { withFileTypes: true });
    const leaks = entries.filter(e => e.name.startsWith('.tmp-txn-'));
    expect(leaks).toEqual([]);
  });

  it('reentrant withTransaction joins outer txn (no deadlock, no double-lock)', async () => {
    await adapter.putRecord('counter.md', '0');
    await adapter.withTransaction(async () => {
      // Inner withTransaction MUST return without trying to acquire the lock again.
      await adapter.withTransaction(async () => {
        const v = parseInt((await adapter.getRecord('counter.md'))!, 10);
        await adapter.putRecord('counter.md', String(v + 1));
      });
      // Outer also writes; both should be visible at commit.
      const mid = await adapter.getRecord('counter.md');
      expect(mid).toBe('1');
    });
    const final = await adapter.getRecord('counter.md');
    expect(final).toBe('1');
  });

  it('nested withTransaction inherits outer dryRun flag (D-05)', async () => {
    await adapter.putRecord('STATE.md', 'before');
    await adapter.withTransaction(async () => {
      await adapter.withTransaction(async () => {
        await adapter.putRecord('STATE.md', 'inside-nested');
      });
      const v = await adapter.getRecord('STATE.md');
      expect(v).toBe('inside-nested');  // in-txn reads see it
    }, { dryRun: true });
    const after = await adapter.getRecord('STATE.md');
    expect(after).toBe('before');  // outer dryRun rolls back the whole thing
  });

  it('snapshot() / restore(id) roundtrip reverts state', async () => {
    await adapter.putRecord('STATE.md', 'v1');
    const id = await adapter.snapshot();
    await adapter.putRecord('STATE.md', 'v2');
    expect(await adapter.getRecord('STATE.md')).toBe('v2');
    await adapter.restore(id);
    expect(await adapter.getRecord('STATE.md')).toBe('v1');
  });

  it('updateSection concurrency: 3 concurrent updateSection calls serialize (PRIMITIVES-06)', async () => {
    // Seed doc with 3 distinct sections
    await adapter.putRecord('doc.md', [
      '## S1', '', 'a', '',
      '## S2', '', 'a', '',
      '## S3', '', 'a', '',
    ].join('\n'));
    await Promise.all([
      adapter.updateSection('doc.md', '## S1', 'x1', 'overwrite'),
      adapter.updateSection('doc.md', '## S2', 'x2', 'overwrite'),
      adapter.updateSection('doc.md', '## S3', 'x3', 'overwrite'),
    ]);
    const final = await adapter.getRecord('doc.md');
    expect(final).toContain('x1');
    expect(final).toContain('x2');
    expect(final).toContain('x3');
  });
});
