/**
 * Phase 2 paired-seam entry (BeadsAdapter).
 */
import { describe, it } from 'vitest';
import { createBeadsAdapter } from 'gsd-beads/testing';
import { runSeamRealnessSuite } from './seam-realness.conformance-suite.js';
import { bdPresent } from './paired-adapters.js';

if (bdPresent()) {
  runSeamRealnessSuite('beads', createBeadsAdapter);
} else {
  describe.skip('SeamRealness (beads)', () => {
    it.skip('bd v1.0.4+ not available', () => {});
  });
}
