/**
 * MarkdownAdapter unit tests.
 *
 * Phase 1 TDD RED (Plan 01-03): tests 1-12 covered the initial stub state.
 * Phase 5 Plans 03-04 implemented binaryAsset/snapshot/namedDoc (flipped the
 * capability flags from false → true and swapped the defensive throws for
 * working implementations). Phase 7 code-review CR-01 updates the stale
 * Phase-1 assertions here to reflect the post-Phase-5 truth.
 *
 * Run from repo root: npx vitest run --project adapters
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MarkdownAdapter } from './index.js';

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

  // Test 1: capabilities shape matches post-Phase-5 contract.
  //   - binaryAsset / snapshot / namedDoc flipped true in Phase 5 Plans 03-04
  //     (D-03 snapshot, D-16 namedDoc, D-17 binaryAsset).
  //   - commitPlanningState is NOT a capability flag (D-12: promoted to
  //     required method; absent from the Capabilities interface).
  //   - graphEdges is the D-OQ06-CAPS fine-grained matrix: MarkdownAdapter
  //     owns semantic edges via graphify.cjs, but no dependency edges.
  it('capabilities shape matches locked contract', () => {
    const caps = adapter.capabilities;
    expect(caps.record).toBe(true);
    expect(caps.section).toBe(true);
    expect(caps.frontmatter).toBe(true);
    expect(caps.binaryAsset).toBe(true);
    expect(caps.snapshot).toBe(true);
    expect(caps.transaction).toBe(true);
    expect(caps.namedDoc).toBe(true);
    expect(caps.markdownLockfile).toBe(true);
    expect(caps.graphEdges).toEqual({ semantic: true, dependency: false });
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
    const result = await adapter.getSection('SECTIONS.md', '## Anchor');
    expect(result).toBe('body line');
  });

  // Test 8: updateSection overwrite
  it('updateSection overwrite replaces section, leaves siblings intact', async () => {
    const md = '## Anchor\noriginal\n## Other\nother body\n';
    await adapter.putRecord('SECTIONS.md', md);
    await adapter.updateSection('SECTIONS.md', '## Anchor', 'replaced', 'overwrite');
    const section = await adapter.getSection('SECTIONS.md', '## Anchor');
    expect(section).toBe('replaced');
    // sibling intact
    const other = await adapter.getSection('SECTIONS.md', '## Other');
    expect(other).toBe('other body');
  });

  // Test 9: updateSection append
  it('updateSection append adds content after existing body', async () => {
    const md = '## Anchor\noriginal\n## Other\nother\n';
    await adapter.putRecord('SECTIONS.md', md);
    await adapter.updateSection('SECTIONS.md', '## Anchor', 'appended', 'append');
    const section = await adapter.getSection('SECTIONS.md', '## Anchor');
    expect(section).toContain('original');
    expect(section).toContain('appended');
  });

  // Test 10: snapshot() is implemented (D-03 shipped in Phase 5 Plan 03).
  //   Returns a stable identifier string for the current planning-state
  //   snapshot. Was a defensive throw through Phase 4; flipped to a working
  //   implementation in Phase 5 Plan 03.
  it('snapshot() returns a non-empty identifier string (implemented, D-03)', async () => {
    const id = await adapter.snapshot();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  // Test 11: writeBinaryAsset is implemented (D-17 shipped in Phase 5 Plan 04).
  //   Writes the byte buffer under .planning/assets/ (or the adapter-decided
  //   asset root). Was a defensive throw through Phase 4; flipped to a working
  //   implementation in Phase 5 Plan 04.
  it('writeBinaryAsset() writes bytes without throwing (implemented, D-17)', async () => {
    await expect(
      adapter.writeBinaryAsset('foo.bin', new Uint8Array([1, 2, 3])),
    ).resolves.not.toThrow();
  });

  // Test 12: markdownLockfile methods do NOT throw (they are implemented since cap=true)
  it('readModifyWriteRoadmapMd does not throw (implemented, not defensive throw)', async () => {
    // Create a minimal ROADMAP.md so the method has something to read
    await adapter.putRecord('ROADMAP.md', '# Roadmap\n');
    // If it throws, the test fails; if it succeeds or updates, we're good
    await expect(adapter.readModifyWriteRoadmapMd((c) => c + '\n<!-- updated -->')).resolves.not.toThrow();
  });
});

describe('normalize (D-13 additive contract)', () => {
  let adapter: MarkdownAdapter;

  beforeEach(async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'gsd-md-normalize-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);
  });

  it('returns body unchanged (identity)', () => {
    expect(adapter.normalize('hello')).toBe('hello');
  });

  it('preserves frontmatter byte-for-byte', () => {
    const body = '---\nkey: 1\n---\nbody\n';
    expect(adapter.normalize(body)).toBe(body);
  });

  it('accepts category arg without side effect', () => {
    expect(adapter.normalize('x', 'root')).toBe('x');
  });

  it('is idempotent: normalize(normalize(x)) === normalize(x)', () => {
    const x = 'abc\n';
    expect(adapter.normalize(adapter.normalize(x))).toBe(adapter.normalize(x));
  });
});
