/**
 * Authored Phase 7 conformance manifest (D-06).
 *
 * This file is the single source of truth for which (adapter, test) pairs
 * must exist. Adding a new Bin B method, section tuple, noun, or rollback
 * case requires appending here AND authoring the matching describe/it in
 * tests/conformance/paired.test.ts (via assertFromManifest).
 *
 * Populated incrementally:
 *   - Plan 07-04: ~16 recordState* Bin B entries (StateWriteOutcome matrix)
 *                 + section-tuple entries from Plan 07-02 grep output.
 *   - Plan 07-05: 12 noun-roundtrip entries × 2 adapters.
 *   - Plan 07-06: rollback entries (CONFORM-04 + known-gap per D-09).
 */
import type { ManifestEntry } from './manifest-types.js';

export const CONFORMANCE_MANIFEST: readonly ManifestEntry[] = [] as const;

export type { ManifestEntry, AdapterName, ExpectedOutcome,
              StateOutcomeExpected, RollbackOutcomeExpected,
              RoundTripOutcomeExpected } from './manifest-types.js';
