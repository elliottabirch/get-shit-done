/**
 * Phase 7 paired-outcome entry (BeadsAdapter).
 *
 * Standalone vitest test file that invokes runStateWriteOutcomeSuite against
 * BeadsAdapter when bd is present.
 */
import { describe, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createBeadsAdapter } from 'gsd-beads/testing';
import { runStateWriteOutcomeSuite } from './write-outcome.conformance-suite.js';

function bdPresent(): boolean {
  const r = spawnSync('bd', ['--version'], { encoding: 'utf-8' });
  if (r.status !== 0) return false;
  return /^bd version 1\.0\.(4|[5-9]|\d{2,})\b/.test(r.stdout ?? '');
}

if (bdPresent()) {
  runStateWriteOutcomeSuite('beads', createBeadsAdapter);
} else {
  describe.skip('StateWriteOutcome (beads)', () => {
    it.skip('bd v1.0.4+ not available', () => {});
  });
}
