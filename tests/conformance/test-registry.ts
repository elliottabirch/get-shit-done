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
 * this Set to validate the manifest ↔ describe bidirectional invariant.
 *
 * Registration happens at two points:
 *   1. COLLECTION time: `preRegisterTest(adapterName, entryName, kind)` is
 *      called from within `describe()` bodies (outside `it()`) in the
 *      conformance suite functions. This ensures registeredTests is fully
 *      populated when meta-coverage's `it()` callbacks run, regardless of
 *      which test FILE vitest schedules first.
 *   2. RUN time: `assertFromManifest(...)` also calls `registeredTests.add`
 *      inside the `it()` callback as a safety guard.
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

/**
 * Pre-register a manifest entry at COLLECTION time (inside a `describe()` body,
 * outside any `it()`). This ensures registeredTests is populated before
 * meta-coverage.test.ts reads it, regardless of file execution order.
 *
 * Call this once per (adapterName, entryName, kind) pair in the same
 * `describe()` that contains the matching `it()` + `assertFromManifest`.
 */
export function preRegisterTest(
  adapterName: AdapterName,
  entryName: string,
  kind: ManifestEntry['kind'],
): void {
  const key = manifestKey(adapterName, kind, entryName);
  registeredTests.add(key);
  // Validate the entry exists in the manifest at collection time.
  const entry = CONFORMANCE_MANIFEST.find(
    (e) => e.kind === kind && e.name === entryName,
  );
  if (!entry) {
    throw new Error(
      `preRegisterTest: no manifest entry for ${key} ` +
      `(expected in tests/conformance/manifest.ts)`,
    );
  }
  if (entry.expected[adapterName] === undefined) {
    throw new Error(
      `preRegisterTest: manifest entry ${entry.name} missing ` +
      `expected.${adapterName} (D-07 requires every adapter row)`,
    );
  }
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
