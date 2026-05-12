/**
 * Phase 5 Plan 05 target — discuss.checkpoint.* + discuss.questions.* SDK verbs (D-20).
 * Wave 0 scaffold (Plan 01): it.todo placeholders until Plan 05 creates scratch.ts.
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  discussCheckpointPut, discussCheckpointGet, discussCheckpointDelete,
  discussQuestionsPut, discussQuestionsGet, discussQuestionsDelete,
} from './scratch.js';

describe('scratch — discuss.checkpoint.* + discuss.questions.* (PRIMITIVES-09)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-scratch-'));
    await mkdir(join(tmpDir, '.planning', 'phases', '05-foundational-primitive-lift'), { recursive: true });
  });
  afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

  it('discuss.checkpoint.put/get/delete roundtrip at .planning/phases/05-foo/05-DISCUSS-CHECKPOINT.json', async () => {
    const phaseDir = '05-foo';
    const phaseNum = '05';
    const body = '{"state":"mid-discuss"}';

    const putRes = await discussCheckpointPut([phaseDir, phaseNum, body], tmpDir);
    expect((putRes.data as { written: string }).written).toContain('phases/05-foo/05-DISCUSS-CHECKPOINT.json');

    const getRes = await discussCheckpointGet([phaseDir, phaseNum], tmpDir);
    expect((getRes.data as { found: boolean; content: string | null }).found).toBe(true);
    expect((getRes.data as { content: string }).content).toBe(body);

    await discussCheckpointDelete([phaseDir, phaseNum], tmpDir);
    const afterDelete = await discussCheckpointGet([phaseDir, phaseNum], tmpDir);
    expect((afterDelete.data as { found: boolean }).found).toBe(false);
  });

  it('discuss.questions roundtrip with json format', async () => {
    await discussQuestionsPut(['05-foo', '05', 'json', '{"q":"x"}'], tmpDir);
    const res = await discussQuestionsGet(['05-foo', '05', 'json'], tmpDir);
    expect((res.data as { found: boolean; content: string }).found).toBe(true);
    expect((res.data as { content: string }).content).toBe('{"q":"x"}');
  });

  it('discuss.questions roundtrip with html format', async () => {
    await discussQuestionsPut(['05-foo', '05', 'html', '<p>q</p>'], tmpDir);
    const res = await discussQuestionsGet(['05-foo', '05', 'html'], tmpDir);
    expect((res.data as { content: string }).content).toBe('<p>q</p>');
  });

  it('delete on nonexistent scratch file is a no-op (no throw)', async () => {
    await expect(discussCheckpointDelete(['99-nonexistent', '99'], tmpDir)).resolves.toBeDefined();
  });

  it('rejects phaseDir with ".." (path traversal guard)', async () => {
    await expect(
      discussCheckpointPut(['../../etc', '05', 'body'], tmpDir),
    ).rejects.toThrow(/\.\./);
  });

  it('rejects invalid format arg on questions', async () => {
    await expect(
      discussQuestionsPut(['05-foo', '05', 'yaml', 'body'], tmpDir),
    ).rejects.toThrow(/json.*html/i);
  });
});
