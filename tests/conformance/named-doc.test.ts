/**
 * Phase 5 Plan 04 target — putNamedDoc/getNamedDoc with typed NamedDocCategory.
 * Wave 0 scaffold (Plan 01): it.todo placeholders until Plan 04 lifts stubs.
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import type { StorageAdapter, NamedDocCategory, RootNamedDocKey } from '../../adapters/types.js';
import { hasNamedDoc } from '../../adapters/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('putNamedDoc / getNamedDoc (PRIMITIVES-04)', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-named-doc-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);
  });
  afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

  it('round-trip for each of the 8 NamedDocCategory values (non-root)', async () => {
    const cats: Exclude<NamedDocCategory, 'root'>[] = ['research', 'intel', 'codebase', 'archived-milestone', 'reports', 'sketches', 'tmp'];
    for (const cat of cats) {
      await adapter.putNamedDoc(cat, 'sample-key', `body for ${cat}`);
      const body = await adapter.getNamedDoc(cat, 'sample-key');
      expect(body).toBe(`body for ${cat}`);
    }
  });

  it('putNamedDoc("root", "HANDOFF", body) writes to .planning/HANDOFF.md', async () => {
    await adapter.putNamedDoc('root', 'HANDOFF', 'handoff body');
    const existsAtRoot = await adapter.exists('HANDOFF.md');
    expect(existsAtRoot).toBe(true);
    const body = await adapter.getNamedDoc('root', 'HANDOFF');
    expect(body).toBe('handoff body');
  });

  it('putNamedDoc("root", "CONTINUE-HERE", body) writes to .planning/CONTINUE-HERE.md', async () => {
    await adapter.putNamedDoc('root', 'CONTINUE-HERE', 'cont body');
    expect(await adapter.exists('CONTINUE-HERE.md')).toBe(true);
    expect(await adapter.getNamedDoc('root', 'CONTINUE-HERE')).toBe('cont body');
  });

  it('putNamedDoc("root", "DECISIONS-INDEX", body) writes to .planning/DECISIONS-INDEX.md', async () => {
    await adapter.putNamedDoc('root', 'DECISIONS-INDEX', 'dec body');
    expect(await adapter.exists('DECISIONS-INDEX.md')).toBe(true);
    expect(await adapter.getNamedDoc('root', 'DECISIONS-INDEX')).toBe('dec body');
  });

  it('getNamedDoc returns null on missing key', async () => {
    expect(await adapter.getNamedDoc('research', 'nonexistent')).toBeNull();
  });

  it('putNamedDoc with opts.workstream prefixes workstreams/<ws>/ path', async () => {
    await adapter.putNamedDoc('reports', 'foo', 'ws body', { workstream: 'alpha' });
    expect(await adapter.exists('workstreams/alpha/reports/foo.md')).toBe(true);
    const back = await adapter.getNamedDoc('reports', 'foo', { workstream: 'alpha' });
    expect(back).toBe('ws body');
  });

  it('capabilities.namedDoc === true (D-16) and hasNamedDoc guard reports true', async () => {
    expect(adapter.capabilities.namedDoc).toBe(true);
    expect(hasNamedDoc(adapter)).toBe(true);
  });

  // Negative type-check assertion (tsc --noEmit validates this). The
  // @ts-expect-error line MUST be present; removing it breaks this check.
  it('putNamedDoc("root", "ARBITRARY", body) rejected at compile (D-14 type gate)', async () => {
    // Type-level assertion; no runtime. Compile-time failure without @ts-expect-error.
    const typeCheckOnly = (a: StorageAdapter): void => {
      // @ts-expect-error — 'root' category rejects arbitrary string keys per D-14
      a.putNamedDoc('root', 'ARBITRARY_STRING_NOT_IN_UNION', 'body');
    };
    expect(typeof typeCheckOnly).toBe('function');
  });

  it('D-15 grep-zero: legacy kind-tagged names absent from sdk/src and adapters (regression guard)', async () => {
    const { execFileSync } = await import('node:child_process');
    // Grep inside the repo for legacy kind-tagged names. `grep -r` exits 1 when nothing
    // is found — which is the success case for D-15.
    const projectRoot = join(__dirname, '..', '..');
    const patterns = ['getResearch', 'putIntelDoc', 'putCodebaseDoc', 'getArchivedMilestoneDoc'];
    for (const pat of patterns) {
      try {
        const out = execFileSync('grep', ['-rn', '--include=*.ts', '--include=*.cjs', '--exclude-dir=node_modules', '--exclude-dir=dist', pat, join(projectRoot, 'sdk', 'src'), join(projectRoot, 'adapters')], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
        // If grep succeeded (exit 0) it found matches — fail.
        expect(out.trim()).toBe('');
      } catch (err) {
        // grep exit 1 = no matches — desired outcome.
        expect((err as { status?: number }).status).toBe(1);
      }
    }
  });
});
