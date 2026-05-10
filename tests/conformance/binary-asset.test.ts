/**
 * Phase 5 Plan 04 target — writeBinaryAsset + capabilities.binaryAsset flip.
 * Wave 0 scaffold (Plan 01): it.todo placeholders until Plan 04 lifts stubs.
 */

import { describe, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../adapters/types.js';

describe('writeBinaryAsset (PRIMITIVES-05)', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-binary-asset-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);
  });
  afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

  void adapter; void tmpDir;

  it.todo('writeBinaryAsset("foo.png", bytes) writes bytes verbatim (readback with fs.readFile matches Buffer.from(bytes))');
  it.todo('capabilities.binaryAsset === true after Plan 04');
  it.todo('graceful-degradation: monkeypatch capabilities.binaryAsset=false; hasBinaryAsset returns false; caller skips write + warns (D-18)');
});
