/**
 * Phase 5 Plan 04 target — writeBinaryAsset + capabilities.binaryAsset flip.
 * Wave 0 scaffold (Plan 01): it.todo placeholders until Plan 04 lifts stubs.
 */

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../adapters/types.js';
import { hasBinaryAsset } from '../../adapters/types.js';

describe('writeBinaryAsset (PRIMITIVES-05)', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-binary-asset-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);
  });
  afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

  it('writeBinaryAsset("foo.png", bytes) writes bytes verbatim', async () => {
    const { readFile: rf } = await import('node:fs/promises');
    const bytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);  // PNG magic
    await adapter.writeBinaryAsset('foo.png', bytes);
    const readBack = await rf(join(tmpDir, '.planning', 'foo.png'));
    expect(Buffer.compare(readBack, Buffer.from(bytes))).toBe(0);
  });

  it('capabilities.binaryAsset === true (D-17) and hasBinaryAsset guard reports true', async () => {
    expect(adapter.capabilities.binaryAsset).toBe(true);
    expect(hasBinaryAsset(adapter)).toBe(true);
  });

  it('writeBinaryAsset creates intermediate directories', async () => {
    const { readFile: rf } = await import('node:fs/promises');
    const bytes = new Uint8Array([1, 2, 3]);
    await adapter.writeBinaryAsset('sketches/review-2026/before.png', bytes);
    const readBack = await rf(join(tmpDir, '.planning', 'sketches', 'review-2026', 'before.png'));
    expect(Buffer.compare(readBack, Buffer.from(bytes))).toBe(0);
  });

  it('graceful-degradation: monkeypatched binaryAsset=false surfaces through hasBinaryAsset guard (D-18)', async () => {
    // Simulate an adapter that reports binaryAsset: false. The caller workflow
    // is expected to check hasBinaryAsset(adapter) and skip the write with a
    // warn rather than throwing. We assert the guard reports correctly and
    // that the surrounding contract remains non-throwing.
    //
    // Monkeypatch the CAPABILITIES object only — not the method body. This
    // matches the "hypothetical adapter with binaryAsset:false" contract.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // Clone capabilities with binaryAsset: false — tests the guard surface,
      // not the adapter mutation path (that would leak state across tests).
      const degraded = { ...adapter, capabilities: { ...adapter.capabilities, binaryAsset: false } } as StorageAdapter;
      expect(hasBinaryAsset(degraded)).toBe(false);
      // Caller pattern per D-18: check guard BEFORE calling the method.
      if (hasBinaryAsset(degraded)) {
        await degraded.writeBinaryAsset('x.png', new Uint8Array([0]));
        throw new Error('should not reach — hasBinaryAsset returned false');
      } else {
        // eslint-disable-next-line no-console
        console.warn('binaryAsset unsupported — skipping write');
      }
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
