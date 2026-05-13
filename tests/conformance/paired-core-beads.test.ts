/**
 * Phase 7 paired-core entry (BeadsAdapter).
 */
import { describe, it } from 'vitest';
import { runAdapterConformanceSuite } from './adapter.conformance.js';
import { createBeadsAdapter } from 'gsd-beads/testing';
import { bdPresent } from './paired-adapters.js';

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
