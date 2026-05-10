/**
 * Thread/seed/todo query handlers — adapter-mediated creation of thread, seed, and todo docs.
 *
 * Covers thread (1 leak), plant-seed (1), add-todo (1).
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
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new GSDError(
      'name must not contain path separators or ".."',
      ErrorClassification.Validation,
    );
  }
}

// ─── threadAdd ──────────────────────────────────────────────────────────────

/**
 * Create a thread document.
 *
 * Args: [name, ...body]
 * Writes to: threads/{name}.md
 */
export async function threadAdd(
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [name, ...bodyParts] = args;
  validateName(name);

  const adapter = await adapterFor(projectDir);
  const body = bodyParts.join(' ');
  const docPath = planningRelativePath(workstream ?? null, `threads/${name}.md`);

  await adapter.putRecord(docPath, body);
  return { data: { written: docPath, name } };
}

// ─── seedAdd ────────────────────────────────────────────────────────────────

/**
 * Create a seed document.
 *
 * Args: [name, ...body]
 * Writes to: seeds/{name}.md
 */
export async function seedAdd(
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [name, ...bodyParts] = args;
  validateName(name);

  const adapter = await adapterFor(projectDir);
  const body = bodyParts.join(' ');
  const docPath = planningRelativePath(workstream ?? null, `seeds/${name}.md`);

  await adapter.putRecord(docPath, body);
  return { data: { written: docPath, name } };
}

// ─── todoAdd ────────────────────────────────────────────────────────────────

/**
 * Create a todo document.
 *
 * Args: [name, ...body]
 * Writes to: todos/{name}.md
 */
export async function todoAdd(
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [name, ...bodyParts] = args;
  validateName(name);

  const adapter = await adapterFor(projectDir);
  const body = bodyParts.join(' ');
  const docPath = planningRelativePath(workstream ?? null, `todos/${name}.md`);

  await adapter.putRecord(docPath, body);
  return { data: { written: docPath, name } };
}
