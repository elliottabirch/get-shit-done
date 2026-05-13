/**
 * Phase 7 meta-coverage (D-06): bidirectional assertion between
 * CONFORMANCE_MANIFEST and the union of registrations flushed to
 * `.vitest-tmp/registry/` by the paired vitest run.
 *
 *   direction 1 (gap):    every manifest entry × adapter must be
 *                         registered; a missing registration means an
 *                         adapter skipped a documented test case.
 *   direction 2 (orphan): every registered key must be in the
 *                         manifest; an orphan means an adapter authored
 *                         a test without a documented expected outcome.
 *
 * Runs as a SEPARATE vitest invocation AFTER the paired suite finishes
 * (see scripts/run-meta-coverage.mjs). The paired suite's workers append
 * registrations to per-worker files; this test reads their union.
 *
 * WHY SEPARATE RUN (vs inline last-in-sequence):
 *   Under parallel forks (no singleFork), the custom sequencer can start
 *   meta-coverage last but can't guarantee it FINISHES after all other
 *   workers have flushed their registry files. A separate second vitest
 *   invocation guarantees all paired workers have exited, so the registry
 *   is complete before this test reads it.
 *
 * WHY FILE-BASED (vs a module-level Set):
 *   Parallel forks don't share module state. See test-registry.ts comment.
 */
import { describe, it, expect } from 'vitest';
import { CONFORMANCE_MANIFEST } from './manifest.js';
import { manifestKey, readRegisteredTests } from './test-registry.js';
import type { AdapterName } from './manifest-types.js';
import { bdPresent } from './paired-adapters.js';

// D-03 skip-with-warning: when bd is absent (local dev without bd installed),
// the 8 paired-*-beads.test.ts files are all guarded by `if (bdPresent())`
// and skip their preRegisterTest() calls. Including 'beads' in ADAPTERS
// unconditionally would surface all 56 beads-side entries as registration
// gaps, breaking the dev experience for contributors without bd. CI runs
// on a bd-installed runner, so the full paired matrix is still enforced
// there — this gate only relaxes the LOCAL run when bd is absent.
const ADAPTERS: readonly AdapterName[] = bdPresent()
  ? (['markdown', 'beads'] as const)
  : (['markdown'] as const);

// Read once at module scope — registry is static by the time we run.
const registered = readRegisteredTests();

describe('Phase 7 meta-coverage (D-06)', () => {
  it('every CONFORMANCE_MANIFEST entry has a registered test on every adapter', () => {
    for (const adapter of ADAPTERS) {
      for (const entry of CONFORMANCE_MANIFEST) {
        const key = manifestKey(adapter, entry.kind, entry.name);
        expect.soft(
          registered.has(key),
          `manifest entry ${entry.kind}:${entry.name} has no ${adapter} test registration ` +
            `(expected via assertFromManifest inside a describe/it block)`,
        ).toBe(true);
      }
    }
  });

  it('no registered test exists without a matching CONFORMANCE_MANIFEST entry', () => {
    const manifestKeys = new Set<string>();
    for (const entry of CONFORMANCE_MANIFEST) {
      for (const adapter of ADAPTERS) {
        manifestKeys.add(manifestKey(adapter, entry.kind, entry.name));
      }
    }
    for (const key of registered) {
      expect.soft(
        manifestKeys.has(key),
        `orphan test registration: ${key} — add an entry to ` +
          `tests/conformance/manifest.ts with the corresponding ` +
          `per-adapter expected outcomes`,
      ).toBe(true);
    }
  });

  it('every CONFORMANCE_MANIFEST entry populates expected for every adapter (D-07)', () => {
    for (const entry of CONFORMANCE_MANIFEST) {
      for (const adapter of ADAPTERS) {
        expect.soft(
          entry.expected[adapter] !== undefined,
          `manifest entry ${entry.kind}:${entry.name} missing expected.${adapter} ` +
            `(D-07: every shipped adapter must have an expected row)`,
        ).toBe(true);
      }
    }
  });
});
