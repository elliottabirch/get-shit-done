/**
 * Shared paired-adapter tuple used by both per-suite paired-*.test.ts files
 * and by properties.test.ts.
 *
 * Extracted from the pre-split paired.test.ts so vitest can load this module
 * without triggering its test-file collection (vitest's glob is *.test.ts;
 * this file intentionally has no .test. extension).
 *
 * D-03 skip-with-warning: BeadsAdapter is included only when bd v1.0.4+ is
 * on PATH. CI installs bd; local dev without bd gets a MarkdownAdapter-only
 * run plus a describe.skip for the beads half.
 */
import { spawnSync } from 'node:child_process';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import { createBeadsAdapter } from 'gsd-beads/testing';
import type { StorageAdapter } from '../../adapters/types.js';

export type AdapterFactory = (projectDir: string) => StorageAdapter;

/** Probe bd CLI. Returns true iff bd >= v1.0.4 is on PATH. */
export function bdPresent(): boolean {
  const r = spawnSync('bd', ['--version'], { encoding: 'utf-8' });
  if (r.status !== 0) return false;
  // bd v1.0.4 / v1.0.5 / ... prints `bd version 1.0.X (<provenance>)`.
  // Accept 1.0.4 through 1.0.x; reject 1.0.0-1.0.3 (missing required primitives).
  return /^bd version 1\.0\.(4|[5-9]|\d{2,})\b/.test(r.stdout ?? '');
}

export const pairedAdapters: Array<[string, AdapterFactory]> = (() => {
  const out: Array<[string, AdapterFactory]> = [
    ['markdown', (projectDir) => new MarkdownAdapter(projectDir)],
  ];
  if (bdPresent()) {
    out.push(['beads', createBeadsAdapter]);
  }
  return out;
})();
