/**
 * Phase 5 Plan 05 target — discuss.checkpoint.* + discuss.questions.* SDK verbs (D-20).
 * Wave 0 scaffold (Plan 01): it.todo placeholders until Plan 05 creates scratch.ts.
 */

import { describe, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('scratch — discuss.checkpoint.* + discuss.questions.* (PRIMITIVES-09)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-scratch-'));
    await mkdir(join(tmpDir, '.planning', 'phases', '05-foundational-primitive-lift'), { recursive: true });
  });
  afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

  void tmpDir;

  it.todo('discuss.checkpoint round-trip at .planning/phases/05-foo/05-DISCUSS-CHECKPOINT.json');
  it.todo('discuss.checkpoint.delete removes the file; re-get returns null');
  it.todo('discuss.questions round-trip with .json and .html formats');
  it.todo('delete on nonexistent is no-op (no throw)');
});
