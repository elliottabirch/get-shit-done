/**
 * Named document query handlers — adapter-mediated CRUD for reports, handoffs,
 * forensics, decisions-index, and continue-here docs.
 *
 * Covers session-report, milestone-summary, forensics, inbox, pause-work, discuss-phase.
 * All paths route through StorageAdapter; no node:fs imports (D-09).
 *
 * Phase 5 Plan 06 (D-12): handlers delegate path computation to
 * `adapter.putNamedDoc` / `adapter.getNamedDoc` (primitive-first framing).
 * External SDK verb names and return shapes are preserved — callers see the
 * same `{ written, name, found, content, source }` envelope as before.
 */

import { GSDError, ErrorClassification } from '../errors.js';
import { adapterFor, planningRelativePath } from './helpers.js';
import type { NamedDocCategory } from '../../../adapters/types.js';
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

/**
 * Mirror of adapter.putNamedDoc's path formula, for reconstructing the
 * display-relative `written` field returned to callers (backward-compatible
 * return shape — the adapter primitive itself doesn't report a path back).
 */
function namedDocDisplayPath(
  workstream: string | null | undefined,
  category: NamedDocCategory,
  key: string,
): string {
  const base = category === 'root' ? `${key}.md` : `${category}/${key}.md`;
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
  const fileStem = `FORENSICS-${timestamp}`;

  await adapter.putNamedDoc('reports', fileStem, body, { workstream: workstream ?? undefined });
  const docPath = namedDocDisplayPath(workstream, 'reports', fileStem);
  return { data: { written: docPath, fileName: `${fileStem}.md` } };
}

// ─── decisionsIndexGet ──────────────────────────────────────────────────────

/**
 * Read DECISIONS-INDEX.md or fall back to DECISIONS.md.
 *
 * Args: none
 * Reads from: DECISIONS-INDEX.md or DECISIONS.md
 *
 * Note: DECISIONS (without -INDEX suffix) is NOT in the RootNamedDocKey
 * closed union — the fallback intentionally stays on adapter.getRecord. Per
 * CONTEXT §D-12, fallback lookup is a workflow-layer concern kept inside the
 * handler; the adapter primitive stays thin.
 */
export async function decisionsIndexGet(
  _args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const adapter = await adapterFor(projectDir);

  const primary = await adapter.getNamedDoc('root', 'DECISIONS-INDEX', { workstream: workstream ?? undefined });
  if (primary !== null) {
    return { data: { found: true, source: 'DECISIONS-INDEX.md', content: primary } };
  }

  const fallbackPath = planningRelativePath(workstream ?? null, 'DECISIONS.md');
  const fallback = await adapter.getRecord(fallbackPath);
  if (fallback === null) {
    return { data: { found: false, content: null } };
  }
  return { data: { found: true, source: 'DECISIONS.md', content: fallback } };
}
