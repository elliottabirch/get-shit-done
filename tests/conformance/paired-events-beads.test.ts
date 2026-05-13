/**
 * Phase 7 paired-events entry (BeadsAdapter).
 */
import { describe, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createBeadsAdapter } from 'gsd-beads/testing';
import { runStateEventDispatchSuite } from './write-events.conformance-suite.js';

function bdPresent(): boolean {
  const r = spawnSync('bd', ['--version'], { encoding: 'utf-8' });
  if (r.status !== 0) return false;
  return /^bd version 1\.0\.(4|[5-9]|\d{2,})\b/.test(r.stdout ?? '');
}

if (bdPresent()) {
  runStateEventDispatchSuite('beads', createBeadsAdapter);
} else {
  describe.skip('StateEvent dispatch (beads)', () => {
    it.skip('bd v1.0.4+ not available', () => {});
  });
}
