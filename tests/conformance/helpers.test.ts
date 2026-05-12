// tests/conformance/helpers.test.ts
//
// Phase 2 Plan 02-01 Task 3 — coverage for the adapter-aware helpers added
// alongside the bootstrap.ts split (HIGH-2 Option 1).
//
// - planningRelativePath (Pitfall 10): workstream-aware path computation
// - planningBaseIsDir (D-10): adapter-aware probe of the planning base
// - findProjectRoot re-export from bootstrap.ts (compatibility check)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  planningRelativePath,
  planningBaseIsDir,
  findProjectRoot,
} from '../../sdk/src/query/helpers.js';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';

describe('planningRelativePath', () => {
  it('returns doc as-is when workstream is undefined', () => {
    expect(planningRelativePath(undefined, 'STATE.md')).toBe('STATE.md');
  });

  it('returns doc as-is when workstream is null', () => {
    expect(planningRelativePath(null, 'phases/01-foo/PLAN.md')).toBe('phases/01-foo/PLAN.md');
  });

  it('returns doc as-is when workstream is empty string', () => {
    expect(planningRelativePath('', 'ROADMAP.md')).toBe('ROADMAP.md');
  });

  it('prefixes workstreams/<ws>/ when workstream is active', () => {
    expect(planningRelativePath('feat-x', 'STATE.md')).toBe('workstreams/feat-x/STATE.md');
  });

  it('handles nested doc paths', () => {
    expect(planningRelativePath('feat-x', 'phases/01-foo/PLAN.md'))
      .toBe('workstreams/feat-x/phases/01-foo/PLAN.md');
  });
});

describe('findProjectRoot (re-exported from bootstrap.ts — HIGH-2 Option 1)', () => {
  it('is callable through helpers.ts re-export', () => {
    // Sanity check: the re-export works and returns a string
    const result = findProjectRoot(process.cwd());
    expect(typeof result).toBe('string');
  });
});

describe('planningBaseIsDir (adapter-aware)', () => {
  let tmpDir: string;
  let adapter: MarkdownAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-helpers-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns true when planning base exists', async () => {
    expect(await planningBaseIsDir(adapter)).toBe(true);
  });

  it('returns false after planning base removed', async () => {
    await rm(join(tmpDir, '.planning'), { recursive: true });
    expect(await planningBaseIsDir(adapter)).toBe(false);
  });
});
