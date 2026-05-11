/**
 * Named document query handlers — adapter-mediated CRUD for reports, handoffs,
 * forensics, decisions-index, and continue-here docs.
 *
 * Covers session-report, milestone-summary, forensics, inbox, pause-work, discuss-phase.
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

// ─── reportPut ──────────────────────────────────────────────────────────────

/**
 * Write a report document.
 *
 * Args: [name, ...bodyParts]
 * Writes to: reports/{name}.md
 */
export async function reportPut(
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [name, ...bodyParts] = args;
  validateName(name);

  const adapter = await adapterFor(projectDir);
  const body = bodyParts.join(' ');
  const docPath = planningRelativePath(workstream ?? null, `reports/${name}.md`);

  await adapter.putRecord(docPath, body);
  return { data: { written: docPath, name } };
}

// ─── reportGet ──────────────────────────────────────────────────────────────

/**
 * Read a report document by name.
 *
 * Args: [name]
 * Reads from: reports/{name}.md
 */
export async function reportGet(
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [name] = args;
  validateName(name);

  const adapter = await adapterFor(projectDir);
  const docPath = planningRelativePath(workstream ?? null, `reports/${name}.md`);
  const content = await adapter.getRecord(docPath);

  if (content === null) {
    return { data: { found: false, name, content: null } };
  }
  return { data: { found: true, name, content } };
}

// ─── handoffPut ─────────────────────────────────────────────────────────────

/**
 * Write HANDOFF.md at planning root.
 *
 * Args: [...bodyParts]
 * Writes to: HANDOFF.md
 */
export async function handoffPut(
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const adapter = await adapterFor(projectDir);
  const body = args.join(' ');
  const docPath = planningRelativePath(workstream ?? null, 'HANDOFF.md');

  await adapter.putRecord(docPath, body);
  return { data: { written: docPath } };
}

// ─── continueHerePut ────────────────────────────────────────────────────────

/**
 * Write CONTINUE-HERE.md at planning root.
 *
 * Args: [...bodyParts]
 * Writes to: CONTINUE-HERE.md
 */
export async function continueHerePut(
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const adapter = await adapterFor(projectDir);
  const body = args.join(' ');
  const docPath = planningRelativePath(workstream ?? null, 'CONTINUE-HERE.md');

  await adapter.putRecord(docPath, body);
  return { data: { written: docPath } };
}

// ─── forensicsPut ───────────────────────────────────────────────────────────

/**
 * Write a forensics report with timestamp.
 *
 * Args: [...bodyParts]
 * Writes to: reports/FORENSICS-{timestamp}.md
 */
export async function forensicsPut(
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const adapter = await adapterFor(projectDir);
  const body = args.join(' ');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `FORENSICS-${timestamp}.md`;
  const docPath = planningRelativePath(workstream ?? null, `reports/${fileName}`);

  await adapter.putRecord(docPath, body);
  return { data: { written: docPath, fileName } };
}

// ─── decisionsIndexGet ──────────────────────────────────────────────────────

/**
 * Read DECISIONS-INDEX.md or fall back to DECISIONS.md.
 *
 * Args: none
 * Reads from: DECISIONS-INDEX.md or DECISIONS.md
 */
export async function decisionsIndexGet(
  _args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const adapter = await adapterFor(projectDir);

  // Try DECISIONS-INDEX.md first, fall back to DECISIONS.md
  const indexPath = planningRelativePath(workstream ?? null, 'DECISIONS-INDEX.md');
  let content = await adapter.getRecord(indexPath);

  if (content === null) {
    const fallbackPath = planningRelativePath(workstream ?? null, 'DECISIONS.md');
    content = await adapter.getRecord(fallbackPath);
    if (content === null) {
      return { data: { found: false, content: null } };
    }
    return { data: { found: true, source: 'DECISIONS.md', content } };
  }

  return { data: { found: true, source: 'DECISIONS-INDEX.md', content } };
}
