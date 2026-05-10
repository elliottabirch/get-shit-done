/**
 * Phase 3 Plan 05 — Conformance test stub for commitPlanningState (D-13).
 * Phase 7 fills in the full paired test with BeadsAdapter.
 *
 * MarkdownAdapter: commitPlanningState = git add + git commit.
 * BeadsAdapter: commitPlanningState = bead-hash bookmark (Phase 7).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../adapters/types.js';

describe('commitPlanningState', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-commit-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });

    // Initialize a git repo with user config for the test environment
    execSync(
      'git init && git config user.email "test@test.com" && git config user.name "Test"',
      { cwd: tmpDir, stdio: 'pipe' },
    );

    // Create an initial commit so HEAD exists
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), '# State\n');
    execSync('git add .planning && git commit -m "initial"', {
      cwd: tmpDir,
      stdio: 'pipe',
    });

    adapter = new MarkdownAdapter(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('commitPlanningState creates a git commit (MarkdownAdapter)', async () => {
    // Modify STATE.md via adapter
    await adapter.putRecord('STATE.md', '# State\n\n## Updated\n\nNew content\n');

    // Commit via adapter
    await adapter.commitPlanningState('test checkpoint');

    // Verify git log shows the commit
    const log = execSync('git log --oneline', { cwd: tmpDir, encoding: 'utf-8' });
    expect(log).toContain('test checkpoint');
  });

  it('commitPlanningState with specific files only stages those files', async () => {
    // Create multiple files
    await adapter.putRecord('STATE.md', '# State\n\nModified state\n');
    await adapter.putRecord('ROADMAP.md', '# Roadmap\n\nModified roadmap\n');

    // Commit only STATE.md
    await adapter.commitPlanningState('selective commit', [
      join(tmpDir, '.planning', 'STATE.md'),
    ]);

    // Verify the commit message appears
    const log = execSync('git log --oneline -1', { cwd: tmpDir, encoding: 'utf-8' });
    expect(log).toContain('selective commit');

    // Verify only STATE.md is in the commit (ROADMAP.md should still be unstaged)
    const show = execSync('git show --name-only --format=""', {
      cwd: tmpDir,
      encoding: 'utf-8',
    });
    expect(show).toContain('STATE.md');
    expect(show).not.toContain('ROADMAP.md');

    // Verify ROADMAP.md is still modified (not committed)
    const status = execSync('git status --short', { cwd: tmpDir, encoding: 'utf-8' });
    expect(status).toContain('ROADMAP.md');
  });

  // Phase 7 stub: BeadsAdapter paired test
  it.todo('commitPlanningState creates identifiable save point on BeadsAdapter');
});
