/**
 * Phase 7 meta-coverage (D-06): bidirectional assertion between
 * CONFORMANCE_MANIFEST and registeredTests.
 *
 *   direction 1 (gap):    every manifest entry × adapter must be
 *                         registered; a missing registration means an
 *                         adapter skipped a documented test case.
 *   direction 2 (orphan): every registeredTests key must be in the
 *                         manifest; an orphan means an adapter authored
 *                         a test without a documented expected outcome.
 *
 * Runs LAST in the paired suite: vitest collects all describes +
 * its first, populating registeredTests via assertFromManifest calls;
 * this file then reads the Set.
 *
 * Implementation note (RESEARCH Pattern 3): registeredTests is
 * test-code-owned (not vitest-internal introspection), so it's
 * portable across vitest major-version bumps.
 */
import { describe, it, expect } from 'vitest';
import { CONFORMANCE_MANIFEST } from './manifest.js';
import { manifestKey, registeredTests } from './test-registry.js';
import type { AdapterName } from './manifest-types.js';

const ADAPTERS: readonly AdapterName[] = ['markdown', 'beads'] as const;

describe('Phase 7 meta-coverage (D-06)', () => {
  it('every CONFORMANCE_MANIFEST entry has a registered test on every adapter', () => {
    for (const adapter of ADAPTERS) {
      for (const entry of CONFORMANCE_MANIFEST) {
        const key = manifestKey(adapter, entry.kind, entry.name);
        expect.soft(
          registeredTests.has(key),
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
    for (const key of registeredTests) {
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
