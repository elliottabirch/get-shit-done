/**
 * Phase 3 Plan 05 — Conformance test for withTransaction atomicity.
 * Verifies that withTransaction serializes concurrent access, returns
 * values, and releases locks on both success and error paths.
 *
 * File renamed from *.test.ts to *.conformance-suite.ts so vitest's
 * default test-file glob does NOT pick it up directly — preventing
 * double-registration (WARNING #1 resolution).
 *
 * Phase 7 Plan 07-04b: migrated from MarkdownAdapter-only to accept an
 * adapterFactory parameter. Invoked per adapter from paired.test.ts's
 * `pairedAdapters` loop. Per-adapter expected outcomes live in
 * CONFORMANCE_MANIFEST (manifest.ts populates).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StorageAdapter } from '../../adapters/types.js';
import type { AdapterName } from './manifest-types.js';
import { assertFromManifest, preRegisterTest } from './test-registry.js';

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

export function runWithTransactionSuite(
  adapterName: AdapterName,
  adapterFactory: (projectDir: string) => StorageAdapter,
): void {
  // Pre-register withTransaction entries at COLLECTION time.
  preRegisterTest(adapterName, 'withTransaction:commit-persists', 'binB');
  preRegisterTest(adapterName, 'withTransaction:rollback-on-throw', 'binB');

  describe(`withTransaction (${adapterName})`, () => {
    let tmpDir: string;
    let adapter: StorageAdapter;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'gsd-write-txn-'));
      await mkdir(join(tmpDir, '.planning'), { recursive: true });
      adapter = adapterFactory(tmpDir);
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

      assertFromManifest(adapterName, 'withTransaction:commit-persists', 'binB', (expected) => {
        expect(expected).toBeTruthy(); // Manifest-registered; content assertions above verify behavior
      });
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

      assertFromManifest(adapterName, 'withTransaction:rollback-on-throw', 'binB', (expected) => {
        expect(expected).toBeTruthy(); // Manifest-registered; behavior assertions above verify lock release
      });
    });

    it('concurrent transactions serialize (second waits for first)', async () => {
      await adapter.putRecord('counter.md', '0');

      // Launch two transactions concurrently. Each reads, delays, then writes.
      // If they serialize, final value should be 2. If they interleave, it could be 1.
      // BeadsAdapter: uses bd's internal locking model; the two concurrent bd ops
      // may interleave (both read '0' and write '1'). Serialization is a MarkdownAdapter
      // capability (file-level mutex). BeadsAdapter handles the withTransaction API
      // but does not guarantee strict serialization for concurrent read-modify-write.
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

      // MarkdownAdapter-only: BeadsAdapter uses bd's internal locking model which
      // doesn't provide the same serialization guarantee for read-modify-write.
      if (adapterName === 'markdown') {
        const final = await adapter.getRecord('counter.md');
        expect(final).toBe('2');
      }
    });

    it('dryRun: true rolls back all writes', async () => {
      await adapter.putRecord('STATE.md', 'before');
      await adapter.withTransaction(async () => {
        await adapter.putRecord('STATE.md', 'inside-txn');
        // MarkdownAdapter-only: in-txn reads see their own writes via shadow dir.
        // BeadsAdapter does not support shadow-dir semantics; in-txn reads see
        // committed state. Skip in-txn read assertion for beads.
        if (adapterName === 'markdown') {
          const mid = await adapter.getRecord('STATE.md');
          expect(mid).toBe('inside-txn');  // in-txn reads see their own writes
        }
      }, { dryRun: true });
      // MarkdownAdapter-only: dryRun rolls back all writes. BeadsAdapter does not
      // support dryRun semantics (mutations always persist).
      if (adapterName === 'markdown') {
        const after = await adapter.getRecord('STATE.md');
        expect(after).toBe('before');
      }
    });

    it('mid-txn failure leaves .planning/ byte-identical to pre-txn state (SC#1)', async () => {
      await adapter.putRecord('STATE.md', '# pre-state\n');
      await adapter.putRecord('PROJECT.md', '# pre-project\n');
      // MarkdownAdapter-only: uses shadow-dir rollback on failure; filesystem is
      // byte-identical before and after the failed txn. BeadsAdapter does not
      // implement shadow-dir rollback; mutations before the throw persist.
      if (adapterName === 'markdown') {
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
      } else {
        // For beads: verify the error still propagates (no deadlock / hang).
        await expect(
          adapter.withTransaction(async () => {
            await adapter.putRecord('STATE.md', '# mutated\n');
            throw new Error('intentional mid-txn failure');
          }),
        ).rejects.toThrow('intentional mid-txn failure');
      }
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
        // MarkdownAdapter-only: in-txn reads see their own writes via shadow dir.
        if (adapterName === 'markdown') {
          const v = await adapter.getRecord('STATE.md');
          expect(v).toBe('inside-nested');  // in-txn reads see it
        }
      }, { dryRun: true });
      // MarkdownAdapter-only: outer dryRun rolls back the whole thing.
      // BeadsAdapter does not support dryRun semantics; nested mutations persist.
      if (adapterName === 'markdown') {
        const after = await adapter.getRecord('STATE.md');
        expect(after).toBe('before');  // outer dryRun rolls back the whole thing
      }
    });

    it('snapshot() / restore(id) roundtrip reverts state', async () => {
      // MarkdownAdapter-only: BeadsAdapter throws UnsupportedCapabilityError for
      // snapshot/restore (bd does not support filesystem-level snapshots).
      if (adapterName !== 'markdown') {
        // Verify the adapter correctly signals unsupported capability.
        const { UnsupportedCapabilityError } = await import('../../adapters/types.js');
        await expect(adapter.snapshot()).rejects.toThrow(UnsupportedCapabilityError);
        return;
      }
      await adapter.putRecord('STATE.md', 'v1');
      const id = await adapter.snapshot();
      await adapter.putRecord('STATE.md', 'v2');
      expect(await adapter.getRecord('STATE.md')).toBe('v2');
      await adapter.restore(id);
      expect(await adapter.getRecord('STATE.md')).toBe('v1');
    });

    it('updateSection concurrency: 3 concurrent updateSection calls serialize (PRIMITIVES-06)', async () => {
      // MarkdownAdapter uses heading-string anchors (e.g., '## S1'); concurrent calls
      // serialize via the file-level lock and all three updates persist.
      // BeadsAdapter uses path-slug anchors (e.g., 's1'); the anchor format differs
      // across adapters so this test uses an adapter-appropriate anchor in each branch.
      if (adapterName !== 'markdown') {
        // BeadsAdapter branch: seed via putRecord, then 3 sequential updateSection
        // calls using slug anchors. Concurrency serialization is bd-internal.
        await adapter.putRecord('doc.md', [
          '## S1', '', 'a', '',
          '## S2', '', 'a', '',
          '## S3', '', 'a', '',
        ].join('\n'));
        // BeadsAdapter anchor format: slug (lowercase, hyphens) per D-05.
        await adapter.updateSection('doc.md', 's1', 'x1', 'overwrite');
        await adapter.updateSection('doc.md', 's2', 'x2', 'overwrite');
        await adapter.updateSection('doc.md', 's3', 'x3', 'overwrite');
        const final = await adapter.getRecord('doc.md');
        expect(final).toContain('x1');
        expect(final).toContain('x2');
        expect(final).toContain('x3');
        return;
      }
      // MarkdownAdapter: seed doc with 3 distinct sections
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
}
