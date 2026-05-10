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
import type { NamedDocCategory } from '../../../adapters/types.js';

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

// ─── Display path helper (D-12 migration) ───────────────────────────────────

/**
 * Reconstruct the display path for a named doc (used to preserve the
 * `written` field in handler return shapes after migrating to putNamedDoc).
 */
function namedDocDisplayPath(
  workstream: string | null | undefined,
  category: NamedDocCategory,
  key: string,
): string {
  const base = category === 'root' ? key + '.md' : category + '/' + key + '.md';
  return planningRelativePath(workstream ?? null, base);
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
  await adapter.putNamedDoc('reports', name, body, { workstream: workstream ?? undefined });
  const docPath = namedDocDisplayPath(workstream, 'reports', name);
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
  const content = await adapter.getNamedDoc('reports', name, { workstream: workstream ?? undefined });

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
  await adapter.putNamedDoc('root', 'HANDOFF', body, { workstream: workstream ?? undefined });
  const docPath = namedDocDisplayPath(workstream, 'root', 'HANDOFF');
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
  await adapter.putNamedDoc('root', 'CONTINUE-HERE', body, { workstream: workstream ?? undefined });
  const docPath = namedDocDisplayPath(workstream, 'root', 'CONTINUE-HERE');
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
  const fileNameStem = `FORENSICS-${timestamp}`;
  await adapter.putNamedDoc('reports', fileNameStem, body, { workstream: workstream ?? undefined });
  const docPath = namedDocDisplayPath(workstream, 'reports', fileNameStem);
  return { data: { written: docPath, fileName: fileNameStem + '.md' } };
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

  // Try DECISIONS-INDEX.md first via getNamedDoc
  const primary = await adapter.getNamedDoc('root', 'DECISIONS-INDEX', { workstream: workstream ?? undefined });
  if (primary !== null) {
    return { data: { found: true, source: 'DECISIONS-INDEX.md', content: primary } };
  }

  // Fall back to DECISIONS.md via getRecord (workflow-layer legacy support)
  const fallbackPath = planningRelativePath(workstream ?? null, 'DECISIONS.md');
  const fallback = await adapter.getRecord(fallbackPath);
  if (fallback === null) {
    return { data: { found: false, content: null } };
  }
  return { data: { found: true, source: 'DECISIONS.md', content: fallback } };
}
