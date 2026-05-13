/**
 * Phase 7 paired-events entry (BeadsAdapter).
 */
import { describe, it } from 'vitest';
import { createBeadsAdapter } from 'gsd-beads/testing';
import { runStateEventDispatchSuite } from './write-events.conformance-suite.js';
import { bdPresent } from './paired-adapters.js';

if (bdPresent()) {
  runStateEventDispatchSuite('beads', createBeadsAdapter);
} else {
  describe.skip('StateEvent dispatch (beads)', () => {
    it.skip('bd v1.0.4+ not available', () => {});
  });
}
