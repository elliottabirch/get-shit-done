// Phase helpers — shared write-side functions composing Bin A adapter primitives (D-05/D-06).

import { GSDError, ErrorClassification } from '../errors.js';
import type { StorageAdapter } from '../../../adapters/types.js';
import { planningRelativePath, normalizeMd, escapeRegex } from './helpers.js';
import { stripFrontmatter } from './frontmatter.js';
import { syncStateFrontmatter } from './state-mutation.js';

// ─── scaffoldPhaseDir ────────────────────────────────────────────────────────

/**
 * Create a phase directory with a .gitkeep marker file.
 *
 * Transaction-wrapping: NO — expected to be called within an existing transaction
 * (typically from phaseAdd which already holds a ROADMAP lock).
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param dirName - Phase directory name (e.g., '03-wire-core-write-methods')
 */
export async function scaffoldPhaseDir(
  adapter: StorageAdapter,
  workstream: string | undefined,
  dirName: string,
): Promise<void> {
  await adapter.putRecord(
    planningRelativePath(workstream, `phases/${dirName}/.gitkeep`),
    '',
  );
}

// ─── insertRoadmapPhase ──────────────────────────────────────────────────────

/**
 * Insert a new phase entry into ROADMAP.md before the last separator.
 *
 * Transaction-wrapping: YES — wraps read-modify-write in adapter.withTransaction.
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param phaseEntry - Markdown text for the new phase entry
 */
export async function insertRoadmapPhase(
  adapter: StorageAdapter,
  workstream: string | undefined,
  phaseEntry: string,
): Promise<void> {
  await adapter.withTransaction(async () => {
    const roadmapPath = planningRelativePath(workstream, 'ROADMAP.md');
    const content = (await adapter.getRecord(roadmapPath)) ?? '';

    const lastSep = content.lastIndexOf('\n---');
    let updated: string;
    if (lastSep > 0) {
      updated = content.slice(0, lastSep) + phaseEntry + content.slice(lastSep);
    } else {
      updated = content + phaseEntry;
    }

    await adapter.putRecord(roadmapPath, updated);
  });
}

// ─── updateRoadmapProgress ───────────────────────────────────────────────────

/**
 * Update a progress table row in ROADMAP.md for a given phase number.
 *
 * Transaction-wrapping: YES — wraps read-modify-write in adapter.withTransaction.
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param phaseNumber - Phase number string (e.g., '03')
 * @param updates - Fields to update: plansComplete, status, completed date
 */
export async function updateRoadmapProgress(
  adapter: StorageAdapter,
  workstream: string | undefined,
  phaseNumber: string,
  updates: { plansComplete?: string; status?: string; completed?: string },
): Promise<void> {
  await adapter.withTransaction(async () => {
    const roadmapPath = planningRelativePath(workstream, 'ROADMAP.md');
    const content = (await adapter.getRecord(roadmapPath)) ?? '';

    const escapedPhase = escapeRegex(phaseNumber);
    // Match a progress table row starting with | <phaseNumber>.
    const rowRe = new RegExp(`^(\\|\\s*${escapedPhase}\\.\\s*\\|.*)$`, 'm');
    const match = content.match(rowRe);

    if (!match) {
      throw new GSDError(
        `Phase ${phaseNumber} not found in ROADMAP.md progress table`,
        ErrorClassification.Execution,
      );
    }

    let row = match[1];
    const cells = row.split('|').map((c: string) => c.trim());

    // Progress table columns: | Phase | Plans | Status | Completed |
    // Adjust cell indices based on typical GSD roadmap format
    if (updates.plansComplete !== undefined && cells.length > 2) {
      cells[2] = ` ${updates.plansComplete} `;
    }
    if (updates.status !== undefined && cells.length > 3) {
      cells[3] = ` ${updates.status} `;
    }
    if (updates.completed !== undefined && cells.length > 4) {
      cells[4] = ` ${updates.completed} `;
    }

    const updatedRow = cells.join('|');
    const updated = content.replace(rowRe, updatedRow);
    await adapter.putRecord(roadmapPath, updated);
  });
}

// ─── readModifyWriteState ────────────────────────────────────────────────────

/**
 * Adapter-based atomic read-modify-write for STATE.md.
 *
 * Replicates the `readModifyWriteStateMd` dance from state-mutation.ts:
 * 1. Read STATE.md via adapter
 * 2. Strip frontmatter
 * 3. Apply modifier to body-only
 * 4. Call syncStateFrontmatter to rebuild frontmatter from body
 * 5. Normalize markdown
 * 6. Write back via adapter
 *
 * Transaction-wrapping: YES — wraps entire dance in adapter.withTransaction.
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param modifier - Transform function applied to the body (no frontmatter)
 * @param projectDir - Project root (needed for syncStateFrontmatter's disk reads)
 * @returns The final written content
 */
export async function readModifyWriteState(
  adapter: StorageAdapter,
  workstream: string | undefined,
  modifier: (body: string) => string | Promise<string>,
  projectDir: string,
): Promise<string> {
  return await adapter.withTransaction(async () => {
    const statePath = planningRelativePath(workstream, 'STATE.md');
    const content = (await adapter.getRecord(statePath)) ?? '';
    const body = stripFrontmatter(content);
    const modified = await modifier(body);
    const synced = await syncStateFrontmatter(modified, projectDir);
    const normalized = normalizeMd(synced);
    await adapter.putRecord(statePath, normalized);
    return normalized;
  });
}

// ─── readModifyWriteRoadmap ──────────────────────────────────────────────────

/**
 * Adapter-based atomic read-modify-write for ROADMAP.md.
 *
 * Transaction-wrapping: YES — wraps read-modify-write in adapter.withTransaction.
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param modifier - Transform function applied to entire ROADMAP.md content
 * @returns The final written content
 */
export async function readModifyWriteRoadmap(
  adapter: StorageAdapter,
  workstream: string | undefined,
  modifier: (content: string) => string | Promise<string>,
): Promise<string> {
  return await adapter.withTransaction(async () => {
    const roadmapPath = planningRelativePath(workstream, 'ROADMAP.md');
    const content = (await adapter.getRecord(roadmapPath)) ?? '';
    const modified = await modifier(content);
    await adapter.putRecord(roadmapPath, modified);
    return modified;
  });
}

// ─── scanNextPhaseNumber ─────────────────────────────────────────────────────

/**
 * Scan the phases directory to find the next sequential phase number.
 *
 * Transaction-wrapping: NO — read-only operation, safe outside transactions.
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @returns The next phase number (max existing + 1, or 1 if no phases)
 */
export async function scanNextPhaseNumber(
  adapter: StorageAdapter,
  workstream: string | undefined,
): Promise<number> {
  const phasesPath = planningRelativePath(workstream, 'phases');
  const entries = await adapter.listCollection(phasesPath);
  let maxPhase = 0;

  for (const entry of entries) {
    // Parse directory names like "03-wire-core-write-methods" or "CK-03-wire"
    const match = /^(?:[A-Z][A-Z0-9]*-)?(\d+)/i.exec(entry.name);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 999) continue; // skip backlog phases
      if (num > maxPhase) maxPhase = num;
    }
  }

  return maxPhase + 1;
}

// ─── removePhaseDir ──────────────────────────────────────────────────────────

/**
 * Remove a phase directory and its known files.
 *
 * Simplified implementation: removes known standard files (.gitkeep, *-PLAN.md,
 * *-SUMMARY.md) and the directory marker. Full recursive removal is deferred
 * to Phase 5 when adapter.removeCollection() is available.
 *
 * Transaction-wrapping: YES — wraps removal sequence in adapter.withTransaction.
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param dirName - Phase directory name to remove
 */
export async function removePhaseDir(
  adapter: StorageAdapter,
  workstream: string | undefined,
  dirName: string,
): Promise<void> {
  await adapter.withTransaction(async () => {
    const basePath = planningRelativePath(workstream, `phases/${dirName}`);
    const entries = await adapter.listCollection(basePath);

    for (const entry of entries) {
      await adapter.removeRecord(`${basePath}/${entry.name}`);
    }

    // Remove the .gitkeep last (directory marker)
    await adapter.removeRecord(`${basePath}/.gitkeep`);
  });
}
