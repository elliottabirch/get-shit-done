/**
 * Phase 3 Plan 05 — initial conformance stub for commitPlanningState (D-13).
 * Phase 7 close — BeadsAdapter paired test added to fill the CONFORM-01 gap
 *                 surfaced by gsd-verifier. Both adapters now register via
 *                 `assertFromManifest` so meta-coverage's bidirectional
 *                 invariant is satisfied for `commitPlanningState:returns-void`.
 *
 * MarkdownAdapter: commitPlanningState = git add + git commit.
 * BeadsAdapter:    commitPlanningState = NOOP (D-2026-05-12-OQ01-BEADS — bd owns
 *                  per-write atomicity; no git-equivalent commit operation).
 *                  The deviation is a contract-level NOOP, not a divergence —
 *                  both adapters return `void` without throwing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../adapters/types.js';
import { createBeadsAdapter } from 'gsd-beads/testing';
import { bdPresent } from './paired-adapters.js';
import { assertFromManifest } from './test-registry.js';

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

    assertFromManifest('markdown', 'commitPlanningState:returns-void', 'binB', (expected) => {
      expect((expected as { applied: boolean }).applied).toBe(true);
    });
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
});

// Phase 7 close — BeadsAdapter paired test. Guarded by bdPresent() per D-03
// skip-with-warning (CI installs bd; local dev without bd gets a describe.skip).
if (bdPresent()) {
  describe('commitPlanningState (BeadsAdapter)', () => {
    let tmpDir: string;
    let adapter: StorageAdapter;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'gsd-commit-beads-'));
      await mkdir(join(tmpDir, '.planning'), { recursive: true });
      adapter = createBeadsAdapter(tmpDir);
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('commitPlanningState resolves with no observable effect (NOOP per D-OQ01-BEADS)', async () => {
      // Per D-2026-05-12-OQ01-BEADS: bd manages its own SQLite+JSONL store
      // with per-write atomicity; there is no git-equivalent commit operation.
      // The method exists only to satisfy the (non-capability-gated)
      // StorageAdapter contract, and is a NOOP. The ONLY observable is that
      // it resolves without throwing — both with and without a files list.
      await expect(adapter.commitPlanningState('checkpoint message')).resolves.toBeUndefined();
      await expect(
        adapter.commitPlanningState('with-files', [join(tmpDir, '.planning', 'STATE.md')]),
      ).resolves.toBeUndefined();

      assertFromManifest('beads', 'commitPlanningState:returns-void', 'binB', (expected) => {
        expect((expected as { applied: boolean }).applied).toBe(true);
      });
    });
  });
} else {
  describe.skip('commitPlanningState (BeadsAdapter)', () => {
    it.skip(
      'bd v1.0.4+ not available — install bd locally to run paired conformance ' +
        '(CI installs bd; this skip is developer convenience per D-03)',
      () => {},
    );
  });
}
