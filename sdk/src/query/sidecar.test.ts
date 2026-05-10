/**
 * Phase 5 Plan 05 target — nextCallCountGet/Incr SDK verbs (D-19, D-21).
 * Wave 0 scaffold (Plan 01): it.todo placeholders until Plan 05 creates sidecar.ts.
 */

import { describe, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('sidecar — nextCallCountGet / nextCallCountIncr (PRIMITIVES-08)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-sidecar-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
  });
  afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

  void tmpDir;

  it.todo('nextCallCountGet returns 0 when .next-call-count missing');
  it.todo('nextCallCountIncr: 0 -> 1 -> 2');
  it.todo('route-next-action.ts:44 site uses nextCallCountGet helper — grep zero for raw adapter.getRecord(\'.next-call-count\')');
});
