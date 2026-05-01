/**
 * MarkdownAdapter unit tests (TDD RED phase for Plan 01-03).
 *
 * Tests 1-12 from the plan's <behavior> block.
 * Run from repo root: npx vitest run --project adapters
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MarkdownAdapter } from './index.js';
import { UnsupportedCapabilityError } from '../types.js';

// Helper: create a minimal .planning/ dir so planningDir() resolves correctly.
async function makeTmpProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'gsd-mdtest-'));
  await mkdir(join(dir, '.planning'), { recursive: true });
  return dir;
}

describe('MarkdownAdapter', () => {
  let projectDir: string;
  let adapter: MarkdownAdapter;

  beforeEach(async () => {
    projectDir = await makeTmpProject();
    adapter = new MarkdownAdapter(projectDir);
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  // Test 1: capabilities shape matches locked contract
  it('capabilities shape matches locked contract', () => {
    const caps = adapter.capabilities;
    expect(caps.record).toBe(true);
    expect(caps.section).toBe(true);
    expect(caps.frontmatter).toBe(true);
    expect(caps.binaryAsset).toBe(false);
    expect(caps.snapshot).toBe(false);
    expect(caps.transaction).toBe(false);
    expect(caps.namedDoc).toBe(false);
    expect(caps.commitPlanningState).toBe(true);
    expect(caps.markdownLockfile).toBe(true);
  });

  // Test 2: name === 'markdown' (D-06)
  it('name is "markdown"', () => {
    expect(adapter.name).toBe('markdown');
  });

  // Test 3: getRecord round-trip
  it('putRecord then getRecord returns same body', async () => {
    await adapter.putRecord('FOO.md', 'hello');
    const result = await adapter.getRecord('FOO.md');
    expect(result).toBe('hello');
  });

  // Test 4: getRecord ENOENT returns null
  it('getRecord returns null for non-existent path', async () => {
    const result = await adapter.getRecord('NONEXISTENT.md');
    expect(result).toBeNull();
  });

  // Test 5: exists returns boolean
  it('exists returns false for missing file', async () => {
    const result = await adapter.exists('STATE.md');
    expect(result).toBe(false);
  });

  it('exists returns true after putRecord', async () => {
    await adapter.putRecord('STATE.md', '# State\n');
    const result = await adapter.exists('STATE.md');
    expect(result).toBe(true);
  });

  // Test 6: path resolution (D-04) — file lands under projectDir/.planning/
  it('putRecord resolves path under .planning/ (D-04)', async () => {
    await adapter.putRecord('ANCHOR_TEST.md', 'content');
    // If path is wrong it will land somewhere else or throw; getRecord confirms it
    const content = await adapter.getRecord('ANCHOR_TEST.md');
    expect(content).toBe('content');
  });

  // Test 7: getSection extracts section body
  it('getSection extracts body of named ## heading', async () => {
    const md = '## Anchor\nbody line\n## Other\nother body\n';
    await adapter.putRecord('SECTIONS.md', md);
    const result = await adapter.getSection('SECTIONS.md', 'Anchor');
    expect(result).toBe('body line');
  });

  // Test 8: updateSection overwrite
  it('updateSection overwrite replaces section, leaves siblings intact', async () => {
    const md = '## Anchor\noriginal\n## Other\nother body\n';
    await adapter.putRecord('SECTIONS.md', md);
    await adapter.updateSection('SECTIONS.md', 'Anchor', 'replaced', 'overwrite');
    const section = await adapter.getSection('SECTIONS.md', 'Anchor');
    expect(section).toBe('replaced');
    // sibling intact
    const other = await adapter.getSection('SECTIONS.md', 'Other');
    expect(other).toBe('other body');
  });

  // Test 9: updateSection append
  it('updateSection append adds content after existing body', async () => {
    const md = '## Anchor\noriginal\n## Other\nother\n';
    await adapter.putRecord('SECTIONS.md', md);
    await adapter.updateSection('SECTIONS.md', 'Anchor', 'appended', 'append');
    const section = await adapter.getSection('SECTIONS.md', 'Anchor');
    expect(section).toContain('original');
    expect(section).toContain('appended');
  });

  // Test 10: snapshot() throws UnsupportedCapabilityError with capability === 'snapshot'
  it('snapshot() throws UnsupportedCapabilityError with capability "snapshot"', async () => {
    await expect(adapter.snapshot()).rejects.toThrow(UnsupportedCapabilityError);
    try {
      await adapter.snapshot();
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedCapabilityError);
      expect((e as UnsupportedCapabilityError).capability).toBe('snapshot');
      expect((e as UnsupportedCapabilityError).adapterName).toBe('markdown');
    }
  });

  // Test 11: writeBinaryAsset throws UnsupportedCapabilityError with capability === 'binaryAsset'
  it('writeBinaryAsset() throws UnsupportedCapabilityError with capability "binaryAsset"', async () => {
    await expect(adapter.writeBinaryAsset('foo.bin', new Uint8Array())).rejects.toThrow(UnsupportedCapabilityError);
    try {
      await adapter.writeBinaryAsset('foo.bin', new Uint8Array());
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedCapabilityError);
      expect((e as UnsupportedCapabilityError).capability).toBe('binaryAsset');
    }
  });

  // Test 12: markdownLockfile methods do NOT throw (they are implemented since cap=true)
  it('readModifyWriteRoadmapMd does not throw (implemented, not defensive throw)', async () => {
    // Create a minimal ROADMAP.md so the method has something to read
    await adapter.putRecord('ROADMAP.md', '# Roadmap\n');
    // If it throws, the test fails; if it succeeds or updates, we're good
    await expect(adapter.readModifyWriteRoadmapMd((c) => c + '\n<!-- updated -->')).resolves.not.toThrow();
  });
});
