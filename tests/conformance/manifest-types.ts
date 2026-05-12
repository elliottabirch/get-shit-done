/**
 * Phase 7 conformance manifest types (D-06 + D-07).
 *
 * Every paired conformance test MUST register itself via
 * `assertFromManifest(adapterName, entryName, kind, check)` so the
 * bidirectional meta-coverage test (tests/conformance/meta-coverage.test.ts)
 * can detect orphan tests AND missing manifest entries.
 */

export type AdapterName = 'markdown' | 'beads';

/** D-09: CONFORM-04 rollback outcomes — includes known-gap disposition. */
export type RollbackOutcomeExpected =
  | { kind: 'byte-identical' }
  | { kind: 'record-identical' }
  | { kind: 'incomplete-per-Deferred-04'; adr: 'D-2026-05-12-OQ06-TXN' };

/** D-13: noun round-trip outcome under normalize()-modulo equality. */
export type RoundTripOutcomeExpected =
  | { kind: 'normalize-modulo-equal' }
  | { kind: 'identity-equal' };

/**
 * Mirrors adapters/types.ts StateWriteOutcome plus per-adapter relaxations.
 * D-07: BeadsAdapter MAY omit `created_section` per D-2026-05-12-OQ06-CREATED-SECTION
 *       (use `created_section: null` in manifest entries to encode "never emitted").
 */
export type StateOutcomeExpected =
  | { applied: true; created_section?: string | null }
  | { applied: false; reason: 'duplicate' | 'nothing_to_remove' };

export type ExpectedOutcome =
  | StateOutcomeExpected
  | RollbackOutcomeExpected
  | RoundTripOutcomeExpected;

export interface ManifestEntry {
  /** Entry category; meta-coverage key is `${adapter}:${kind}:${name}`. */
  kind: 'binB' | 'section-tuple' | 'noun-roundtrip' | 'rollback';
  /** Stable id; e.g. 'recordStateAppend:decision:scaffold' or 'STATE.md#Decisions:append'. */
  name: string;
  /** Human-readable summary; NOT the source of truth for expected behavior. */
  description?: string;
  /** Per-adapter expected outcome. MUST include every shipped adapter. */
  expected: Record<AdapterName, ExpectedOutcome>;
  /** ADR reference when adapters legitimately differ. */
  adr?: string;
}
