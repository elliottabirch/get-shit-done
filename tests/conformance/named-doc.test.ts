/**
 * Phase 5 Plan 04 target — putNamedDoc/getNamedDoc with typed NamedDocCategory.
 * Wave 0 scaffold (Plan 01): it.todo placeholders until Plan 04 lifts stubs.
 */

import { describe, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import type { StorageAdapter, NamedDocCategory, RootNamedDocKey } from '../../adapters/types.js';

describe('putNamedDoc / getNamedDoc (PRIMITIVES-04)', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-named-doc-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);
  });
  afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

  void adapter; void tmpDir;
  // Type-level references so the imports are not pruned before Plan 04 fills tests.
  const _cats: NamedDocCategory[] = ['research', 'intel', 'codebase', 'archived-milestone', 'reports', 'sketches', 'tmp', 'root'];
  const _rootKeys: RootNamedDocKey[] = ['HANDOFF', 'CONTINUE-HERE', 'DECISIONS-INDEX'];
  void _cats; void _rootKeys;

  it.todo('round-trip for each of the 8 NamedDocCategory values');
  it.todo('putNamedDoc("root", "HANDOFF", body) writes to .planning/HANDOFF.md');
  it.todo('putNamedDoc("root", "CONTINUE-HERE", body) writes to .planning/CONTINUE-HERE.md');
  it.todo('putNamedDoc("root", "DECISIONS-INDEX", body) writes to .planning/DECISIONS-INDEX.md');
  it.todo('getNamedDoc("research", "nonexistent") returns null');
  it.todo('capabilities.namedDoc === true post-Plan 04');
  it.todo('@ts-expect-error — putNamedDoc("root", "ARBITRARY", body) rejected at compile (D-14)');
  it.todo('D-15 grep-zero: no legacy kind-tagged names in sdk/src/ or adapters/');
});
