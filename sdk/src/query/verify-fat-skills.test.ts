/**
 * Tests for verify.fat-skills query handler.
 *
 * Verifies skill discovery, line counting, and report structure.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { verifyFatSkills } from './verify-fat-skills.js';

describe('verifyFatSkills', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-fat-skills-'));
    // Create get-shit-done/workflows/ structure
    await mkdir(join(tmpDir, 'get-shit-done', 'workflows'), { recursive: true });
    // Create scripts/leak-grep.cjs stub that reports 0 matches
    await mkdir(join(tmpDir, 'scripts'), { recursive: true });
    await writeFile(
      join(tmpDir, 'scripts', 'leak-grep.cjs'),
      'process.stdout.write("leak-grep: 0 match(es) across 1 file(s)\\n");',
      'utf-8',
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty results when no skill files exist', async () => {
    const result = await verifyFatSkills([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.total_skills).toBe(0);
    expect(data.non_router_skills).toBe(0);
    expect(data.skills).toEqual([]);
  });

  it('discovers workflow skill files', async () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
    await writeFile(join(tmpDir, 'get-shit-done', 'workflows', 'test-skill.md'), lines, 'utf-8');

    const result = await verifyFatSkills([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.total_skills).toBe(1);
    expect(data.non_router_skills).toBe(1);
    const skills = data.skills as Array<{ name: string; lines: number; path: string }>;
    expect(skills[0].name).toBe('test-skill');
    expect(skills[0].lines).toBe(100);
    expect(skills[0].path).toBe('workflows/test-skill.md');
  });

  it('identifies router skills (lines < 20)', async () => {
    await writeFile(
      join(tmpDir, 'get-shit-done', 'workflows', 'tiny-router.md'),
      'Just a few lines\n',
      'utf-8',
    );

    const result = await verifyFatSkills([], tmpDir);
    const data = result.data as Record<string, unknown>;
    // Router skills are excluded from non_router list
    expect(data.total_skills).toBe(1);
    expect(data.non_router_skills).toBe(0);
  });

  it('identifies router skills (route-next-action content)', async () => {
    const content = Array.from({ length: 50 }, () => 'content line').join('\n');
    await writeFile(
      join(tmpDir, 'get-shit-done', 'workflows', 'dispatcher.md'),
      content + '\nroute-next-action\n',
      'utf-8',
    );

    const result = await verifyFatSkills([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.total_skills).toBe(1);
    expect(data.non_router_skills).toBe(0);
  });

  it('marks fat skills when over threshold', async () => {
    const lines = Array.from({ length: 600 }, (_, i) => `Line ${i + 1}`).join('\n');
    await writeFile(join(tmpDir, 'get-shit-done', 'workflows', 'big-skill.md'), lines, 'utf-8');

    const result = await verifyFatSkills([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const skills = data.skills as Array<{ warning: string | null; lines: number }>;
    expect(skills[0].warning).toBe('fat');
    expect(skills[0].lines).toBe(600);
    expect(data.over_threshold).toBe(1);
  });

  it('accepts custom threshold via args', async () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
    await writeFile(join(tmpDir, 'get-shit-done', 'workflows', 'medium.md'), lines, 'utf-8');

    // With threshold=50, 100 lines should be "fat"
    const result = await verifyFatSkills(['50'], tmpDir);
    const data = result.data as Record<string, unknown>;
    const skills = data.skills as Array<{ warning: string | null }>;
    expect(skills[0].warning).toBe('fat');
    expect(data.threshold_lines).toBe(50);
  });

  it('sorts skills by line count descending', async () => {
    await writeFile(
      join(tmpDir, 'get-shit-done', 'workflows', 'small.md'),
      Array.from({ length: 30 }, () => 'x').join('\n'),
      'utf-8',
    );
    await writeFile(
      join(tmpDir, 'get-shit-done', 'workflows', 'large.md'),
      Array.from({ length: 200 }, () => 'x').join('\n'),
      'utf-8',
    );

    const result = await verifyFatSkills([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const skills = data.skills as Array<{ name: string; lines: number }>;
    expect(skills[0].lines).toBeGreaterThan(skills[1].lines);
    expect(skills[0].name).toBe('large');
  });

  it('handles missing get-shit-done directory gracefully', async () => {
    await rm(join(tmpDir, 'get-shit-done'), { recursive: true, force: true });
    const result = await verifyFatSkills([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.total_skills).toBe(0);
  });

  it('runs against real project directory', async () => {
    // Integration test against the actual repo
    const repoRoot = process.cwd().replace(/\/sdk$/, '');
    const result = await verifyFatSkills([], repoRoot);
    const data = result.data as Record<string, unknown>;
    // The real repo has workflow skills
    expect((data.total_skills as number)).toBeGreaterThan(0);
    expect((data.non_router_skills as number)).toBeGreaterThanOrEqual(0);
    expect(data.threshold_lines).toBe(500);
  });
});
