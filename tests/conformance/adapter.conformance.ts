/**
 * Conformance harness factory for StorageAdapter implementations.
 *
 * D-15: ships with one sample test (getRecord round-trip). Phases 2-5 add more
 * describe blocks inside this factory as they migrate handlers. Phase 7
 * parameterizes over MarkdownAdapter AND BeadsAdapter by calling
 * runAdapterConformanceSuite twice (once per adapter) — this shape is locked.
 *
 * Signature is locked for Phase 7 reuse:
 *   runAdapterConformanceSuite(adapterName, adapterFactory)
 *
 * Usage:
 *   import { runAdapterConformanceSuite } from './adapter.conformance.js';
 *   import { MyAdapter } from '../../adapters/my/index.js';
 *   runAdapterConformanceSuite('my', (dir) => new MyAdapter(dir));
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StorageAdapter } from '../../adapters/types.js';

export function runAdapterConformanceSuite(
  adapterName: string,
  adapterFactory: (projectDir: string) => StorageAdapter,
): void {
  describe(`StorageAdapter conformance: ${adapterName}`, () => {
    let tmpDir: string;
    let adapter: StorageAdapter;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'gsd-conform-'));
      // Pre-create .planning/ since adapter constructor calls planningDir(projectDir)
      // which expects this directory to exist.
      await mkdir(join(tmpDir, '.planning'), { recursive: true });
      adapter = adapterFactory(tmpDir);
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    describe('getRecord / putRecord round-trip', () => {
      it('putRecord then getRecord returns same body', async () => {
        await adapter.putRecord('STATE.md', '# State\n');
        const result = await adapter.getRecord('STATE.md');
        expect(result).toBe('# State\n');
      });

      it('getRecord returns null for non-existent path', async () => {
        const result = await adapter.getRecord('NONEXISTENT.md');
        expect(result).toBeNull();
      });
    });

    describe('stat (Phase 2 D-11)', () => {
      it('returns kind=file for a putRecord-written file', async () => {
        await adapter.putRecord('STATE.md', '# x\n');
        const r = await adapter.stat('STATE.md');
        expect(r).not.toBeNull();
        expect(r!.kind).toBe('file');
        // mtime is optional but MarkdownAdapter always provides it
        if (r!.mtime !== undefined) {
          expect(typeof r!.mtime).toBe('string');
          expect(() => new Date(r!.mtime!)).not.toThrow();
        }
      });

      it('returns kind=dir for a directory created via putRecord', async () => {
        // putRecord('phases/01-foo/PLAN.md', ...) creates the parent dir as a side effect
        await adapter.putRecord('phases/01-foo/PLAN.md', '# Plan\n');
        const r = await adapter.stat('phases/01-foo');
        expect(r).not.toBeNull();
        expect(r!.kind).toBe('dir');
      });

      it('returns null for non-existent path (matches getRecord null-on-miss)', async () => {
        const r = await adapter.stat('NONEXISTENT.md');
        expect(r).toBeNull();
      });
    });

    // Phase 2 adds: getSection / updateSection round-trip, frontmatter round-trip
    // Phase 3 adds: write-side handler conformance (recordStateEvent shape)
    // Phase 5 adds: snapshot/restore, withTransaction, putNamedDoc, writeBinaryAsset
    // Phase 7 parameterizes over MarkdownAdapter AND BeadsAdapter
  });
}
