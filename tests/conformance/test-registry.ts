/**
 * Phase 7 test registration Set (D-06).
 *
 * Every paired conformance assertion goes through `assertFromManifest`,
 * which:
 *   (a) adds `${adapterName}:${kind}:${entryName}` to registeredTests;
 *   (b) looks up the manifest entry by (kind, name) and fails loudly
 *       if absent (prevents authoring tests without manifest entries);
 *   (c) invokes `check(entry.expected[adapterName])` so the test body
 *       receives the documented expected outcome for that adapter.
 *
 * The meta-coverage test (tests/conformance/meta-coverage.test.ts) reads
 * this Set AFTER vitest collection to validate the manifest ↔ describe
 * bidirectional invariant.
 *
 * This is test-code-owned state (no vitest-internal coupling) — portable
 * across vitest major-version bumps (RESEARCH Pattern 3).
 */
import { CONFORMANCE_MANIFEST } from './manifest.js';
import type { AdapterName, ExpectedOutcome, ManifestEntry } from './manifest-types.js';

export const registeredTests = new Set<string>();

/** Key format used by both registration + meta-coverage. */
export function manifestKey(
  adapterName: AdapterName,
  kind: ManifestEntry['kind'],
  entryName: string,
): string {
  return `${adapterName}:${kind}:${entryName}`;
}

export function assertFromManifest(
  adapterName: AdapterName,
  entryName: string,
  kind: ManifestEntry['kind'],
  check: (expected: ExpectedOutcome) => void,
): void {
  const key = manifestKey(adapterName, kind, entryName);
  registeredTests.add(key);
  const entry = CONFORMANCE_MANIFEST.find(
    (e) => e.kind === kind && e.name === entryName,
  );
  if (!entry) {
    throw new Error(
      `assertFromManifest: no manifest entry for ${key} ` +
      `(expected in tests/conformance/manifest.ts)`,
    );
  }
  const expected = entry.expected[adapterName];
  if (expected === undefined) {
    throw new Error(
      `assertFromManifest: manifest entry ${entry.name} missing ` +
      `expected.${adapterName} (D-07 requires every adapter row)`,
    );
  }
  check(expected);
}
