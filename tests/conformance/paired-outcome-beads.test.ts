/**
 * Phase 7 paired-outcome entry (BeadsAdapter).
 */
import { describe, it } from 'vitest';
import { createBeadsAdapter } from 'gsd-beads/testing';
import { runStateWriteOutcomeSuite } from './write-outcome.conformance-suite.js';
import { bdPresent } from './paired-adapters.js';

if (bdPresent()) {
  runStateWriteOutcomeSuite('beads', createBeadsAdapter);
} else {
  describe.skip('StateWriteOutcome (beads)', () => {
    it.skip('bd v1.0.4+ not available', () => {});
  });
}
