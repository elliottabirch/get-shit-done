/**
 * Codebase document query handlers — adapter-mediated CRUD for .planning/codebase/ docs.
 *
 * Covers map-codebase (7 leaks), new-project (1), scout-codebase (1).
 * All paths route through StorageAdapter; no node:fs imports (D-09).
 *
 * Phase 5 Plan 06 (D-12): codebasePut / codebaseGet delegate path computation
 * to adapter.putNamedDoc / adapter.getNamedDoc. codebaseList stays on
 * adapter.listCollection — no list primitive in Phase 5 scope.
 */

import { GSDError, ErrorClassification } from '../errors.js';
import { adapterFor, planningRelativePath } from './helpers.js';
import type { QueryResult } from './utils.js';
import type { RecordRef } from '../../../adapters/types.js';

// ─── Path validation (T-04-01) ──────────────────────────────────────────────

function validateName(name: string): void {
  if (!name) {
    throw new GSDError('name argument required', ErrorClassification.Validation);
  }
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new GSDError(
      'name must not contain path separators or ".."',
      ErrorClassification.Validation,
    );
  }
}

/**
 * Mirror of adapter.putNamedDoc's path formula for the 'codebase' category,
 * used to reconstruct the legacy `written: string` field in handler returns.
 */
function codebaseDisplayPath(workstream: string | null | undefined, key: string): string {
  return planningRelativePath(workstream ?? null, `codebase/${key}.md`);
}

// ─── codebasePut ────────────────────────────────────────────────────────────

/**
 * Write a codebase document (e.g., STACK.md, ARCHITECTURE.md).
 *
 * Args: [name, ...bodyParts]
 * Writes to: codebase/{name}.md
 */
export async function codebasePut(
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [name, ...bodyParts] = args;
  validateName(name);

  const adapter = await adapterFor(projectDir);
  const body = bodyParts.join(' ');

  await adapter.putNamedDoc('codebase', name, body, { workstream: workstream ?? undefined });
  const docPath = codebaseDisplayPath(workstream, name);
  return { data: { written: docPath, name } };
}

// ─── codebaseGet ────────────────────────────────────────────────────────────

/**
 * Read a codebase document by name.
 *
 * Args: [name]
 * Reads from: codebase/{name}.md
 */
export async function codebaseGet(
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [name] = args;
  validateName(name);

  const adapter = await adapterFor(projectDir);
  const content = await adapter.getNamedDoc('codebase', name, { workstream: workstream ?? undefined });

  if (content === null) {
    return { data: { found: false, name, content: null } };
  }
  return { data: { found: true, name, content } };
}

// ─── codebaseList ───────────────────────────────────────────────────────────

/**
 * List all codebase documents.
 *
 * Args: none
 * Lists: codebase/
 */
export async function codebaseList(
  _args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const adapter = await adapterFor(projectDir);
  const prefix = planningRelativePath(workstream ?? null, 'codebase/');
  const refs = await adapter.listCollection(prefix);
  const docs = refs.map((ref: RecordRef) => ref.name);

  return { data: { docs, count: docs.length } };
}
