/**
 * Phase 5 Plan 02 target — updateSection/getSection heading-depth walker.
 * Wave 0 scaffold (Plan 01): it.todo placeholders until Plan 02 implements D-06.
 */

import { describe, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../adapters/types.js';

describe('section-depth walker (PRIMITIVES-01, PRIMITIVES-02)', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-section-depth-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);
  });
  afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

  // Silence unused-variable lints until placeholders are filled.
  void adapter; void tmpDir;

  it.todo('L2 anchor "## Foo" extracts/replaces body (regression from Phase 1 L2-only)');
  it.todo('L3 anchor "### Evidence" under "## Investigation" extracts only the subsection');
  it.todo('L4 anchor "#### Sub-point" terminates at next L4/L3/L2');
  it.todo('getSection L3 returns body at deeper anchor');
  it.todo('getSection returns null when anchor missing');
  it.todo('Document-order first-match when two "### Evidence" share name (D-07)');
  it.todo('Fenced-code block containing "## Not a heading" does NOT split section (D-08)');
  it.todo('HTML-comment "<!-- ## Not a heading -->" does NOT split (D-08)');
  it.todo('Setext detected: console.warn emitted; no throw (D-08)');
  it.todo('three-author concurrency: 3 concurrent updateSection serialize, final doc has all three bodies (SC#2, PRIMITIVES-06)');
});
