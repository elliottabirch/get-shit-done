/**
 * Phase 7 Plan 07-04a: paired conformance harness invocation (D-01 + D-03).
 *
 * Runs the locked Phase 1 D-15 `runAdapterConformanceSuite` harness once
 * per adapter. Single authoritative CI surface for SC#1 "zero failing
 * assertions across both adapters" (D-01).
 *
 * bd v1.0.4+ presence probe (D-03):
 *   - LOCAL: skip-with-warning if bd is absent (developer convenience).
 *   - CI:    bd install step in .github/workflows/test.yml guarantees
 *            presence; describe.skip path never triggers on CI.
 *
 * Runtime budget per RESEARCH §Test Infrastructure: ~30-60s including
 * BeadsAdapter cold-start ~400-700ms per test.
 *
 * 07-04b will add imports for runStateWriteOutcomeSuite /
 * runStateEventDispatchSuite / runWithTransactionSuite at the bottom
 * of this file plus a per-adapter loop that invokes them. Keep the
 * structure loop-ready now (a NOUN/adapter-tuple array pattern) so
 * that the 07-04b diff is purely additive.
 */
import { describe, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { runAdapterConformanceSuite } from './adapter.conformance.js';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import { createBeadsAdapter } from 'gsd-beads/testing';
import type { StorageAdapter } from '../../adapters/types.js';

/** Probe bd CLI. Returns true iff bd >= v1.0.4 is on PATH. */
export function bdPresent(): boolean {
  const r = spawnSync('bd', ['--version'], { encoding: 'utf-8' });
  if (r.status !== 0) return false;
  // bd v1.0.4 / v1.0.5 / ... prints `bd version 1.0.X (<provenance>)`.
  // Accept 1.0.4 through 1.0.x; reject 1.0.0-1.0.3 (missing required primitives).
  return /^bd version 1\.0\.(4|[5-9]|\d{2,})\b/.test(r.stdout ?? '');
}

/** Adapter tuple used by 07-04b's migrated-suite loop; exported now to keep 07-04b additive. */
export type AdapterFactory = (projectDir: string) => StorageAdapter;
export const pairedAdapters: Array<[string, AdapterFactory]> = [
  ['markdown', (projectDir) => new MarkdownAdapter(projectDir)],
];
if (bdPresent()) {
  pairedAdapters.push(['beads', createBeadsAdapter]);
}

// MarkdownAdapter — always runs via the locked harness.
runAdapterConformanceSuite(
  'markdown',
  (projectDir) => new MarkdownAdapter(projectDir),
);

// BeadsAdapter — runs if bd is present locally; skip-with-warning otherwise.
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
