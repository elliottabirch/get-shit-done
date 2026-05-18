/**
 * D-10/D-13 (Phase 2 / SEAM-06): paired conformance suite for seam-realness.
 * Each test exercises a migrated state-mutation handler via FULL REGISTRY
 * DISPATCH (not direct call) so that the closure-wrapper and adapter routing
 * are exercised end-to-end. Direct handler calls would bypass the closure
 * wrapper and falsely pass even if the registry was not updated.
 *
 * Test bodies are it.todo() stubs in this Wave-1 scaffolding commit.
 * Plans 03-07 replace each it.todo() with a real it() block as handler
 * families migrate to the closure-wrapper pattern.
 */
import { describe, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StorageAdapter } from '../../adapters/types.js';
import type { AdapterName } from './manifest-types.js';
import { preRegisterTest } from './test-registry.js';

export function runSeamRealnessSuite(
  adapterName: AdapterName,
  adapterFactory: (projectDir: string) => StorageAdapter,
): void {
  // Pre-register all seam-realness entries at collection time so meta-coverage
  // can verify bidirectional invariant. Entries below MUST match manifest.ts.
  const seamEntries: Array<{ name: string }> = [
    { name: 'putRecord:large-body:round-trip' },
    { name: 'state.milestone-switch:via-registry' },
    // Plans 03-07 add more entries as handler families migrate.
  ];
  for (const entry of seamEntries) {
    preRegisterTest(adapterName, entry.name, 'seam-realness');
  }

  describe(`seam realness (${adapterName})`, () => {
    let tmpDir: string;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let adapter: StorageAdapter;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'gsd-seam-realness-'));
      await mkdir(join(tmpDir, '.planning'), { recursive: true });
      adapter = adapterFactory(tmpDir);
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    // DEFECT-02 — large body round-trip. Body filled in Plan 02-07 (closure plan).
    it.todo('putRecord:large-body:round-trip — assert >64KB body byte-identical via getRecord');

    // SEAM-04/05 — registry dispatch end-to-end. Body filled in Plan 02-07.
    it.todo('state.milestone-switch:via-registry — registry routing reaches configured adapter');

    // Plans 03-07 add more it() blocks as handler families migrate.
  });
}
