#!/usr/bin/env node
/**
 * Clears the conformance test-registry directory (.vitest-tmp/registry/).
 *
 * Phase 7 D-06 uses a file-based registry so parallel vitest forks can each
 * publish their registrations without sharing in-memory state. The registry
 * MUST be cleared at the start of every conformance run so stale entries from
 * a prior run don't leak into meta-coverage.
 *
 * Invoked as a `pretest:conformance:paired` hook and also called explicitly
 * by `scripts/run-meta-coverage.mjs` as a safety net.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REGISTRY_DIR = path.resolve(
  process.env.GSD_CONFORMANCE_REGISTRY_DIR ??
    path.join(process.cwd(), '.vitest-tmp', 'registry'),
);

if (fs.existsSync(REGISTRY_DIR)) {
  fs.rmSync(REGISTRY_DIR, { recursive: true, force: true });
}
fs.mkdirSync(REGISTRY_DIR, { recursive: true });
console.log(`clear-registry: reset ${REGISTRY_DIR}`);
