/**
 * Phase 5 Plan 05 target — nextCallCountGet/Incr SDK verbs (D-19, D-21).
 * Wave 0 scaffold (Plan 01): it.todo placeholders until Plan 05 creates sidecar.ts.
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { mkdtemp, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nextCallCountGet, nextCallCountIncr } from './sidecar.js';
import { MarkdownAdapter } from '../../../adapters/markdown/index.js';

describe('sidecar — nextCallCountGet / nextCallCountIncr (PRIMITIVES-08)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-sidecar-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
  });
  afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

  it('nextCallCountGet returns 0 when .next-call-count missing', async () => {
    const adapter = new MarkdownAdapter(tmpDir);
    expect(await nextCallCountGet(adapter)).toBe(0);
  });

  it('nextCallCountIncr increments from 0 -> 1 -> 2', async () => {
    const adapter = new MarkdownAdapter(tmpDir);
    expect(await nextCallCountIncr(adapter)).toBe(1);
    expect(await nextCallCountIncr(adapter)).toBe(2);
    expect(await nextCallCountGet(adapter)).toBe(2);
  });

  it('nextCallCountIncr persists value to disk', async () => {
    const adapter = new MarkdownAdapter(tmpDir);
    await nextCallCountIncr(adapter);
    const raw = (await readFile(join(tmpDir, '.planning', '.next-call-count'), 'utf-8')).trim();
    expect(raw).toBe('1');
  });

  it('workstream-scoped sidecar uses workstreams/<ws>/ prefix', async () => {
    const adapter = new MarkdownAdapter(tmpDir);
    await nextCallCountIncr(adapter, 'alpha');
    const raw = (await readFile(join(tmpDir, '.planning', 'workstreams', 'alpha', '.next-call-count'), 'utf-8')).trim();
    expect(raw).toBe('1');
  });
});
