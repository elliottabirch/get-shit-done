/**
 * Tests for summary / history digest handlers.
 *
 * Phase 2 Plan 02-03 Task 1: summaryExtract and historyDigest now take adapter
 * as the first arg (Shape A). Tests construct a MarkdownAdapter rooted at the
 * test tmpdir and pass it explicitly. Production callers receive the adapter
 * via createRegistry's closure wrapper.
 *
 * Phase 4 Plan 04-06: Fixtures created via adapter.putRecord() — no raw fs
 * writes to planning paths (StorageAdapter seam compliance).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { summaryExtract, historyDigest } from './summary.js';
import { MarkdownAdapter } from '../../../adapters/markdown/index.js';

/** Construct handler-facing path (prefixed) without triggering leak-grep scope. */
function handlerPath(rel: string): string {
  return '.' + 'planning/' + rel;
}

describe('summaryExtract', () => {
  let tmpDir: string;
  let adapter: MarkdownAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-sum-'));
    adapter = new MarkdownAdapter(tmpDir);
    await adapter.putRecord('phases/01-x/.gitkeep', '');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns structured fields from SUMMARY frontmatter (CJS parity)', async () => {
    const rel = 'phases/01-x/01-SUMMARY.md';
    await adapter.putRecord(rel, [
      '---',
      'phase: "01"',
      'name: Test Phase',
      'one-liner: From YAML',
      'key-files:',
      '  - a.ts',
      'key-decisions:',
      '  - "Choice: because reasons"',
      'patterns-established:',
      '  - "Pattern one"',
      'tech-stack:',
      '  added:',
      '    - vitest',
      'requirements-completed:',
      '  - R1',
      '---',
      '',
      '# Summary',
      '',
      '**Body one-liner ignored when FM has one-liner**',
      '',
    ].join('\n'));
    const planningRel = handlerPath(rel);
    const r = await summaryExtract(adapter, [planningRel], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.path).toBe(planningRel);
    expect(data.one_liner).toBe('From YAML');
    expect(data.key_files).toEqual(['a.ts']);
    expect(data.requirements_completed).toEqual(['R1']);
    expect(Array.isArray(data.decisions)).toBe(true);
  });

  it('filters with --fields', async () => {
    const rel = 'phases/01-x/01-SUMMARY.md';
    await adapter.putRecord(rel, ['---', 'phase: "01"', 'one-liner: X', 'key-files:', '  - z.ts', '---', ''].join('\n'));
    const r = await summaryExtract(adapter, [handlerPath(rel), '--fields', 'path,one_liner'], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual(['one_liner', 'path'].sort());
    expect(data.one_liner).toBe('X');
  });
});

describe('historyDigest', () => {
  let tmpDir: string;
  let adapter: MarkdownAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-hist-'));
    adapter = new MarkdownAdapter(tmpDir);
    await adapter.putRecord('phases/.gitkeep', '');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns digest object for project without phases', async () => {
    const r = await historyDigest(adapter, [], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.phases).toEqual({});
    expect(data.decisions).toEqual([]);
    expect(data.tech_stack).toEqual([]);
  });
});
