/**
 * Phase 7 test registration (D-06) — file-based registry for parallel forks.
 *
 * Every paired conformance assertion goes through `assertFromManifest`,
 * which:
 *   (a) appends `${adapterName}:${kind}:${entryName}` to the registry file
 *       for the current worker process;
 *   (b) looks up the manifest entry by (kind, name) and fails loudly
 *       if absent (prevents authoring tests without manifest entries);
 *   (c) invokes `check(entry.expected[adapterName])` so the test body
 *       receives the documented expected outcome for that adapter.
 *
 * The meta-coverage runner (scripts/meta-coverage-run.mjs + meta-coverage.test.ts)
 * aggregates all per-worker registry files after the paired vitest run
 * exits, then validates the manifest ↔ describe bidirectional invariant.
 *
 * WHY FILE-BASED (vs a module-level Set):
 *   Under vitest `pool: forks` without `singleFork: true`, each test file can run
 *   in its own worker process. Module-level state does NOT cross process
 *   boundaries; an in-memory Set would be empty in the meta-coverage process.
 *   A file-based registry lets every worker publish its registrations and
 *   lets meta-coverage read the union.
 *
 * WHY JSONL (one registration per line):
 *   Atomic appends. Multiple workers can append concurrently without
 *   corrupting the file if each worker writes to its OWN file (we do — see
 *   registryFilePath).
 *
 * The registry directory is cleared at the start of every conformance run
 * (see scripts/clear-registry.mjs, invoked as a prebuild hook) so stale
 * registrations from a previous run don't leak into meta-coverage.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONFORMANCE_MANIFEST } from './manifest.js';
import type { AdapterName, ExpectedOutcome, ManifestEntry } from './manifest-types.js';

export const REGISTRY_DIR = path.resolve(
  process.env.GSD_CONFORMANCE_REGISTRY_DIR ??
    path.join(process.cwd(), '.vitest-tmp', 'registry'),
);

// Unique per-worker file name: PID + random suffix in case multiple vitest
// workers share a PID recycled by the OS (very unlikely but cheap to guard).
let _registryFilePath: string | null = null;
function registryFilePath(): string {
  if (_registryFilePath !== null) return _registryFilePath;
  fs.mkdirSync(REGISTRY_DIR, { recursive: true });
  const random = Math.random().toString(36).slice(2, 10);
  _registryFilePath = path.join(REGISTRY_DIR, `worker-${process.pid}-${random}.jsonl`);
  return _registryFilePath;
}

/** Key format used by both registration + meta-coverage. */
export function manifestKey(
  adapterName: AdapterName,
  kind: ManifestEntry['kind'],
  entryName: string,
): string {
  return `${adapterName}:${kind}:${entryName}`;
}

/** Append a registration line to this worker's registry file. */
function appendRegistration(key: string): void {
  fs.appendFileSync(registryFilePath(), key + '\n');
}

/**
 * Read the union of registrations across ALL worker files in REGISTRY_DIR.
 * Called by meta-coverage.test.ts AFTER the paired suite has exited (so all
 * workers have flushed their files).
 */
export function readRegisteredTests(): Set<string> {
  const set = new Set<string>();
  if (!fs.existsSync(REGISTRY_DIR)) return set;
  for (const file of fs.readdirSync(REGISTRY_DIR)) {
    if (!file.endsWith('.jsonl')) continue;
    const contents = fs.readFileSync(path.join(REGISTRY_DIR, file), 'utf8');
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length > 0) set.add(trimmed);
    }
  }
  return set;
}

/**
 * Pre-register a manifest entry at COLLECTION time (inside a `describe()` body,
 * outside any `it()`). Ensures the registration is written before meta-coverage
 * runs.
 */
export function preRegisterTest(
  adapterName: AdapterName,
  entryName: string,
  kind: ManifestEntry['kind'],
): void {
  const key = manifestKey(adapterName, kind, entryName);
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
  appendRegistration(key);
}

export function assertFromManifest(
  adapterName: AdapterName,
  entryName: string,
  kind: ManifestEntry['kind'],
  check: (expected: ExpectedOutcome) => void,
): void {
  const key = manifestKey(adapterName, kind, entryName);
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
  appendRegistration(key);
  check(expected);
}
