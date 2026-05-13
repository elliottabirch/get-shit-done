/**
 * Phase 7 paired-core entry (BeadsAdapter).
 *
 * Standalone vitest test file that invokes the locked Phase 1 D-15
 * `runAdapterConformanceSuite` harness against BeadsAdapter. Skip-with-warning
 * when bd v1.0.4+ is absent locally (D-03 developer convenience).
 */
import { describe, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { runAdapterConformanceSuite } from './adapter.conformance.js';
import { createBeadsAdapter } from 'gsd-beads/testing';

function bdPresent(): boolean {
  const r = spawnSync('bd', ['--version'], { encoding: 'utf-8' });
  if (r.status !== 0) return false;
  return /^bd version 1\.0\.(4|[5-9]|\d{2,})\b/.test(r.stdout ?? '');
}

if (bdPresent()) {
  runAdapterConformanceSuite('beads', createBeadsAdapter);
} else {
  describe.skip('StorageAdapter conformance: beads', () => {
    it.skip(
      'bd v1.0.4+ not available — install bd locally to run paired conformance ' +
        '(CI installs bd; this skip is developer convenience per D-03)',
      () => {},
    );
  });
}
