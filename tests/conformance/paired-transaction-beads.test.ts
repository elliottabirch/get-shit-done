/**
 * Phase 7 paired-transaction entry (BeadsAdapter).
 */
import { describe, it } from 'vitest';
import { createBeadsAdapter } from 'gsd-beads/testing';
import { runWithTransactionSuite } from './write-transaction.conformance-suite.js';
import { bdPresent } from './paired-adapters.js';

if (bdPresent()) {
  runWithTransactionSuite('beads', createBeadsAdapter);
} else {
  describe.skip('withTransaction (beads)', () => {
    it.skip('bd v1.0.4+ not available', () => {});
  });
}
