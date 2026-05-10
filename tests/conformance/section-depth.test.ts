/**
 * Phase 5 Plan 02 target — updateSection/getSection heading-depth walker.
 * Wave 0 scaffold (Plan 01): it.todo placeholders until Plan 02 implements D-06.
 */

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
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

  it('L2 anchor "## Foo" extracts/replaces body', async () => {
    await adapter.putRecord('doc.md', [
      '# Title',
      '',
      '## Foo',
      '',
      'foo body',
      '',
      '## Bar',
      '',
      'bar body',
      '',
    ].join('\n'));
    const body = await adapter.getSection('doc.md', '## Foo');
    expect(body).toBe('foo body');

    await adapter.updateSection('doc.md', '## Foo', 'replaced foo', 'overwrite');
    const updated = await adapter.getRecord('doc.md');
    expect(updated).toContain('replaced foo');
    expect(updated).not.toContain('foo body');
    expect(updated).toContain('bar body');  // untouched sibling
  });

  it('L3 anchor "### Evidence" under "## Investigation" extracts only the subsection', async () => {
    await adapter.putRecord('doc.md', [
      '## Investigation 2026-05-01',
      '',
      '### Evidence',
      '',
      'ev-1',
      '',
      '### Conclusions',
      '',
      'conclusion body',
      '',
      '## Investigation 2026-05-05',
      '',
      '### Evidence',
      '',
      'ev-2',
      '',
    ].join('\n'));
    const body = await adapter.getSection('doc.md', '### Evidence');
    expect(body).toBe('ev-1');  // D-07 first-match
  });

  it('L4 anchor "#### Sub-point" terminates at next L4/L3/L2', async () => {
    await adapter.putRecord('doc.md', [
      '## Main',
      '',
      '### Sub',
      '',
      '#### Sub-point',
      '',
      'sp body line 1',
      'sp body line 2',
      '',
      '#### Next sub-point',
      '',
      'not included',
      '',
    ].join('\n'));
    const body = await adapter.getSection('doc.md', '#### Sub-point');
    expect(body).toBe('sp body line 1\nsp body line 2');
  });

  it('getSection returns null when anchor missing', async () => {
    await adapter.putRecord('doc.md', '## Foo\n\nbody\n');
    const body = await adapter.getSection('doc.md', '## Nonexistent');
    expect(body).toBeNull();
  });

  it('document-order first-match when two "### Evidence" share name (D-07)', async () => {
    await adapter.putRecord('doc.md', '## A\n\n### Evidence\n\nfirst\n\n## B\n\n### Evidence\n\nsecond\n');
    const body = await adapter.getSection('doc.md', '### Evidence');
    expect(body).toBe('first');
  });

  it('fenced code block containing "## Not a heading" does NOT split section (D-08)', async () => {
    await adapter.putRecord('doc.md', [
      '## Real',
      '',
      'text',
      '',
      '```markdown',
      '## Not a heading',
      'still inside fence',
      '```',
      '',
      'more text',
      '',
      '## Next',
      '',
      'next body',
      '',
    ].join('\n'));
    const body = await adapter.getSection('doc.md', '## Real');
    expect(body).toContain('## Not a heading');
    expect(body).toContain('more text');
    expect(body).not.toContain('next body');
  });

  it('HTML comment "<!-- ## Not a heading -->" does NOT split (D-08)', async () => {
    await adapter.putRecord('doc.md', [
      '## Real',
      '',
      '<!-- ## Not a heading inside comment -->',
      '',
      'body continues',
      '',
      '## Next',
      '',
      'next body',
      '',
    ].join('\n'));
    const body = await adapter.getSection('doc.md', '## Real');
    expect(body).toContain('body continues');
    expect(body).not.toContain('next body');
  });

  it('setext-style heading emits console.warn but does NOT throw', async () => {
    await adapter.putRecord('doc.md', [
      '## Real',
      '',
      'body',
      '',
      'Setext Heading',
      '=============',
      '',
      'after setext',
      '',
    ].join('\n'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const body = await adapter.getSection('doc.md', '## Real');
      expect(body).not.toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      const warnArg = warnSpy.mock.calls[0]?.[0] as string;
      expect(warnArg).toMatch(/setext/i);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it.todo('three-author concurrency: 3 concurrent updateSection serialize, final doc has all three bodies (SC#2, PRIMITIVES-06)');
});
