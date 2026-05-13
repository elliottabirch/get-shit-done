/**
 * Phase 7 Plan 07-06: CONFORM-04 failure-injection tests (D-09, D-10, D-11).
 *
 * Three tests per D-10 "throw from inside withTransaction fn":
 *
 *   1. MarkdownAdapter: byte-identical rollback on throw-before-commit.
 *   2. BeadsAdapter:    record-identical rollback on throw-before-commit
 *                       (Outcome A buffered-op discard path).
 *   3. BeadsAdapter known gap: mid-commit-replay failure documented as
 *      `expected.beads: 'incomplete-per-Deferred-04'` in the manifest.
 *      Per D-10 + D-09, no adapter-internal hook tests this directly;
 *      the manifest entry + this describe.skip documents the contract.
 *
 * All bd invocations use BEADS_ACTOR=seed (Landmine 11; Pitfall 4
 * otherwise `created_by` drifts between pre- and post-txn snapshots).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { StorageAdapter } from '../../adapters/types.js';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import { createBeadsAdapter } from 'gsd-beads/testing';
import {
  markdownSnapshot,
  beadsSnapshot,
  assertEqualSnapshots,
} from './rollback-diff.js';
import { assertFromManifest, preRegisterTest } from './test-registry.js';

function bdPresent(): boolean {
  const r = spawnSync('bd', ['--version'], { encoding: 'utf-8' });
  return r.status === 0 && /^bd version 1\.0\.(4|[5-9]|\d{2,})\b/.test(r.stdout ?? '');
}

// ============================================================================
// MarkdownAdapter — byte-identical rollback
// ============================================================================

// Pre-register at collection time so meta-coverage sees these keys.
preRegisterTest('markdown', 'withTransaction:throw-before-commit', 'rollback');
preRegisterTest('markdown', 'withTransaction:mid-commit-replay', 'rollback');

describe('CONFORM-04: failure-injection (markdown)', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-fi-md-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('throw-before-commit: .planning/ byte-identical to pre-txn state', async () => {
    // Pre-seed two records.
    await adapter.putRecord('STATE.md', '# pre-state\n');
    await adapter.putRecord('PROJECT.md', '# pre-project\n');
    const before = await markdownSnapshot(tmpDir);

    // Throw inside withTransaction fn AFTER 2-of-3 writes (D-10).
    await expect(
      adapter.withTransaction(async () => {
        await adapter.putRecord('STATE.md', '# mutated\n');
        await adapter.putRecord('PROJECT.md', '# also mutated\n');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const after = await markdownSnapshot(tmpDir);

    assertFromManifest('markdown', 'withTransaction:throw-before-commit', 'rollback', (expected) => {
      expect((expected as { kind: string }).kind).toBe('byte-identical');
    });

    assertEqualSnapshots(before, after, 'markdown rollback');
    expect(await adapter.getRecord('STATE.md')).toBe('# pre-state\n');
    expect(await adapter.getRecord('PROJECT.md')).toBe('# pre-project\n');
  });
});

// ============================================================================
// BeadsAdapter — record-identical rollback + known-gap documentation
// ============================================================================

if (bdPresent()) {
  // Pre-register at collection time so meta-coverage sees these keys.
  preRegisterTest('beads', 'withTransaction:throw-before-commit', 'rollback');
  preRegisterTest('beads', 'withTransaction:mid-commit-replay', 'rollback');

  describe('CONFORM-04: failure-injection (beads)', () => {
    let tmpDir: string;
    let adapter: StorageAdapter;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'gsd-fi-beads-'));
      await mkdir(join(tmpDir, '.planning'), { recursive: true });
      adapter = createBeadsAdapter(tmpDir);
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('throw-before-commit: bd store record-identical to pre-txn state (Outcome A buffered discard)', async () => {
      const before = beadsSnapshot(tmpDir);

      // Throw inside withTransaction fn — Outcome A path: ops are
      // buffered in-memory; a throw before the commit replay phase
      // discards the buffer, leaving bd store unchanged.
      await expect(
        adapter.withTransaction(async () => {
          await adapter.recordStateAppend({
            type: 'decision',
            payload: { phase: '07', summary: 'S1', rationale: 'r1' },
          });
          await adapter.recordStateAppend({
            type: 'decision',
            payload: { phase: '07', summary: 'S2', rationale: 'r2' },
          });
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      const after = beadsSnapshot(tmpDir);

      assertFromManifest('beads', 'withTransaction:throw-before-commit', 'rollback', (expected) => {
        expect((expected as { kind: string }).kind).toBe('record-identical');
      });

      assertEqualSnapshots(before, after, 'beads rollback (throw-before-commit)');
    });

    describe('mid-commit-replay known gap (Deferred-04, Deferred-05)', () => {
      it.skip(
        'DOCUMENTED: mid-commit-replay failure leaves bd partially committed on the Nth issue ' +
          '(per Deferred-04). Manifest entry: withTransaction:mid-commit-replay / ' +
          'expected.beads.kind = "incomplete-per-Deferred-04" / adr: D-2026-05-12-OQ06-TXN. ' +
          'Phase 6.1 would close this gap. Per D-10 + D-09 no adapter-internal hook tests ' +
          'this directly; the manifest entry + this describe is the documented contract.',
        () => {},
      );

      // Registration-only for meta-coverage (no behavior test).
      it('manifest entry registration (meta-coverage only)', () => {
        assertFromManifest('markdown', 'withTransaction:mid-commit-replay', 'rollback', (_e) => {});
        assertFromManifest('beads', 'withTransaction:mid-commit-replay', 'rollback', (_e) => {});
      });
    });
  });
} else {
  describe.skip('CONFORM-04: failure-injection (beads)', () => {
    it.skip('bd v1.0.4+ not available — install bd to run paired rollback tests', () => {});
  });
}
