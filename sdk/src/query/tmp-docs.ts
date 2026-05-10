/**
 * Temporary document query handlers — adapter-mediated CRUD for .planning/tmp/ artifacts.
 *
 * Covers docs-update (4 leaks) — temp verification/processing artifacts.
 * All paths route through StorageAdapter; no node:fs imports (D-09).
 */

import { GSDError, ErrorClassification } from '../errors.js';
import { adapterFor, planningRelativePath } from './helpers.js';
import type { QueryResult } from './utils.js';

// ─── Path validation (T-04-01) ──────────────────────────────────────────────

function validateName(name: string): void {
  if (!name) {
    throw new GSDError('name argument required', ErrorClassification.Validation);
  }
  if (name.includes('..') || name.includes('\\')) {
    throw new GSDError(
      'name must not contain ".." or backslashes',
      ErrorClassification.Validation,
    );
  }
  // Allow single forward slash for subdirectories (tmp/subdir/file.md)
  // but reject absolute paths
  if (name.startsWith('/')) {
    throw new GSDError(
      'name must not be an absolute path',
      ErrorClassification.Validation,
    );
  }
}

// ─── tmpPut ─────────────────────────────────────────────────────────────────

// Phase 5 D-12 exception: tmp keys embed subdir + extension (e.g. "subdir/file.json"),
// which the adapter's putNamedDoc category formula ('tmp/${key}.md') does not support.
// Handler continues to use adapter.putRecord directly with the raw path. Acceptable
// per D-12 "handlers remain thin wrappers over the uniform primitive call" — the
// tmp wrapper's concern is the extension-free, subdir-permissive path scheme.

/**
 * Write a temporary document.
 *
 * Args: [name, ...body]
 * Writes to: tmp/{name}
 */
export async function tmpPut(
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [name, ...bodyParts] = args;
  validateName(name);

  const adapter = await adapterFor(projectDir);
  const body = bodyParts.join(' ');
  const docPath = planningRelativePath(workstream ?? null, `tmp/${name}`);

  await adapter.putRecord(docPath, body);
  return { data: { written: docPath, name } };
}

// ─── tmpGet ─────────────────────────────────────────────────────────────────

/**
 * Read a temporary document.
 *
 * Args: [name]
 * Reads from: tmp/{name}
 */
export async function tmpGet(
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [name] = args;
  validateName(name);

  const adapter = await adapterFor(projectDir);
  const docPath = planningRelativePath(workstream ?? null, `tmp/${name}`);
  const content = await adapter.getRecord(docPath);

  if (content === null) {
    return { data: { found: false, name, content: null } };
  }
  return { data: { found: true, name, content } };
}
