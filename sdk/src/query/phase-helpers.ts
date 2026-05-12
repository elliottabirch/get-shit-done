// Phase helpers — shared write-side functions composing Bin A adapter primitives (D-05/D-06).

import { GSDError, ErrorClassification } from '../errors.js';
import type { StorageAdapter } from '../../../adapters/types.js';
import { planningRelativePath, normalizeMd, escapeRegex, stateExtractField } from './helpers.js';
import { stripFrontmatter } from './frontmatter.js';
import { syncStateFrontmatter, stateReplaceField } from './state-mutation.js';

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
 * Scan ROADMAP.md and the phases directory to find the next sequential phase number.
 *
 * Scans ROADMAP.md for phase references in three formats (heading, bullet checklist,
 * bold inline) — these are the canonical source of truth. Falls back to scanning
 * .planning/phases/ directory names when ROADMAP yields no matches (fresh repo,
 * pre-populated phase dirs). See regression #2726.
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
  let maxPhase = 0;

  // Primary: parse ROADMAP.md. Matches heading (## Phase N:), bullet checklist
  // (- [x] Phase N:), and bold (**Phase N:**). Skips 999.x backlog phases.
  const roadmapPath = planningRelativePath(workstream, 'ROADMAP.md');
  const roadmap = await adapter.getRecord(roadmapPath);
  if (roadmap !== null) {
    const phasePattern = /(?:^|\n)\s*(?:[-*]\s*(?:\[[x ]\]\s*)?|#{2,4}\s*|\*{1,2}\s*)Phase\s+(\d+)[A-Z]?(?:\.\d+)*:/gi;
    let m: RegExpExecArray | null;
    while ((m = phasePattern.exec(roadmap)) !== null) {
      const num = parseInt(m[1], 10);
      if (num >= 999) continue;
      if (num > maxPhase) maxPhase = num;
    }
  }

  // Fallback: scan phases/ directory when ROADMAP scan finds nothing.
  if (maxPhase === 0) {
    const phasesPath = planningRelativePath(workstream, 'phases');
    const entries = await adapter.listCollection(phasesPath);
    for (const entry of entries) {
      // Parse directory names like "03-wire-core-write-methods" or "CK-03-wire"
      const match = /^(?:[A-Z][A-Z0-9]*-)?(\d+)/i.exec(entry.name);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= 999) continue;
        if (num > maxPhase) maxPhase = num;
      }
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
    await adapter.removeCollection(basePath);
  });
}

// ─── scaffoldPlanFiles ──────────────────────────────────────────────────────

/**
 * Create template files in a phase directory (PLAN.md skeleton, CONTEXT.md skeleton).
 *
 * Transaction-wrapping: NO — expected to be called within an existing transaction.
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param phaseDir - Phase directory name (e.g., '03-wire-core-write-methods')
 * @param phaseNumber - Phase number string (e.g., '03')
 * @param templates - Which templates to create
 */
export async function scaffoldPlanFiles(
  adapter: StorageAdapter,
  workstream: string | undefined,
  phaseDir: string,
  phaseNumber: string,
  templates: { plan?: boolean; context?: boolean },
): Promise<void> {
  const basePath = planningRelativePath(workstream, `phases/${phaseDir}`);
  const today = new Date().toISOString().split('T')[0];

  if (templates.context) {
    const contextContent = `---\nphase: "${phaseNumber}"\ncreated: ${today}\n---\n\n# Phase ${phaseNumber} — Context\n\n## Decisions\n\n_Decisions will be captured during /gsd-discuss-phase ${phaseNumber}_\n\n## Discretion Areas\n\n_Areas where the executor can use judgment_\n\n## Deferred Ideas\n\n_Ideas to consider later_\n`;
    await adapter.putRecord(`${basePath}/${phaseNumber}-CONTEXT.md`, contextContent);
  }

  if (templates.plan) {
    const planContent = `---\nphase: "${phaseNumber}"\ncreated: ${today}\n---\n\n# Phase ${phaseNumber} — Plan\n\n## Objective\n\n_TBD_\n\n## Tasks\n\n- [ ] TBD\n`;
    await adapter.putRecord(`${basePath}/${phaseNumber}-01-PLAN.md`, planContent);
  }
}

// ─── removePhaseFiles ───────────────────────────────────────────────────────

/**
 * List and remove all files in a phase directory via adapter.
 *
 * Uses listCollection to enumerate all files, then removes each.
 * Handles nested structures by recursively listing sub-paths.
 *
 * Transaction-wrapping: NO — expected to be called within an existing transaction.
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param phaseDir - Phase directory name to remove
 */
export async function removePhaseFiles(
  adapter: StorageAdapter,
  workstream: string | undefined,
  phaseDir: string,
): Promise<void> {
  const basePath = planningRelativePath(workstream, `phases/${phaseDir}`);
  await adapter.removeCollection(basePath);
}

// ─── archivePhaseDir ────────────────────────────────────────────────────────

/**
 * Archive a phase directory by copying all files to an archive location,
 * then removing the originals.
 *
 * Transaction-wrapping: NO — expected to be called within an existing transaction.
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param phaseDir - Phase directory name to archive
 * @param archivePrefix - Destination prefix (e.g., 'milestones/v1.0-phases')
 */
export async function archivePhaseDir(
  adapter: StorageAdapter,
  workstream: string | undefined,
  phaseDir: string,
  archivePrefix: string,
): Promise<void> {
  const srcPath = planningRelativePath(workstream, `phases/${phaseDir}`);
  const destPath = planningRelativePath(workstream, `${archivePrefix}/${phaseDir}`);
  const entries = await adapter.listCollection(srcPath);

  for (const entry of entries) {
    const content = await adapter.getRecord(`${srcPath}/${entry.name}`);
    if (content !== null) {
      await adapter.putRecord(`${destPath}/${entry.name}`, content);
    }
  }

  // Remove the entire source directory tree (files + dir marker) in one shot
  await adapter.removeCollection(srcPath);
}

// ─── removeRoadmapPhase ─────────────────────────────────────────────────────

/**
 * Remove a phase entry from ROADMAP.md matching the given identifier.
 *
 * Removes the phase section (heading + body), checkbox lines, and table rows
 * that reference the specified phase.
 *
 * Transaction-wrapping: YES — wraps read-modify-write in adapter.withTransaction.
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param phaseIdentifier - Phase identifier (e.g., '03', '6.1')
 */
export async function removeRoadmapPhase(
  adapter: StorageAdapter,
  workstream: string | undefined,
  phaseIdentifier: string,
): Promise<void> {
  await adapter.withTransaction(async () => {
    const roadmapPath = planningRelativePath(workstream, 'ROADMAP.md');
    let content = (await adapter.getRecord(roadmapPath)) ?? '';
    const escaped = escapeRegex(phaseIdentifier);

    // Remove the phase section (header + body until next phase header or end)
    content = content.replace(
      new RegExp(`\\n?#{2,4}\\s*Phase\\s+${escaped}\\s*:[\\s\\S]*?(?=\\n#{2,4}\\s+Phase\\s+\\d|$)`, 'i'),
      '',
    );

    // Remove checkbox lines referencing the phase
    content = content.replace(
      new RegExp(`\\n?-\\s*\\[[ x]\\]\\s*.*Phase\\s+${escaped}[:\\s][^\\n]*`, 'gi'),
      '',
    );

    // Remove table rows referencing the phase
    content = content.replace(
      new RegExp(`\\n?\\|\\s*${escaped}\\.?\\s[^|]*\\|[^\\n]*`, 'gi'),
      '',
    );

    await adapter.putRecord(roadmapPath, content);
  });
}

// ─── markRoadmapPhaseComplete ───────────────────────────────────────────────

/**
 * Mark a phase as complete in ROADMAP.md: update checkbox, progress table row.
 *
 * Transaction-wrapping: YES — wraps read-modify-write in adapter.withTransaction.
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param phaseNumber - Phase number string (e.g., '03')
 * @param dateStr - Completion date (YYYY-MM-DD)
 * @param planInfo - Plan execution details
 */
export async function markRoadmapPhaseComplete(
  adapter: StorageAdapter,
  workstream: string | undefined,
  phaseNumber: string,
  dateStr: string,
  planInfo?: { summaryCount: number; planCount: number },
): Promise<void> {
  await adapter.withTransaction(async () => {
    const roadmapPath = planningRelativePath(workstream, 'ROADMAP.md');
    let content = (await adapter.getRecord(roadmapPath)) ?? '';
    const phaseEscaped = escapeRegex(phaseNumber);

    // Checkbox: - [ ] Phase N: -> - [x] Phase N: (...completed DATE)
    const checkboxPattern = new RegExp(
      `(-\\s*\\[)[ ](\\]\\s*.*Phase\\s+${phaseEscaped}[:\\s][^\\n]*)`,
      'i',
    );
    content = content.replace(checkboxPattern, `$1x$2 (completed ${dateStr})`);

    // Progress table: update Status to Complete, add date
    if (planInfo) {
      const tableRowPattern = new RegExp(
        `^(\\|\\s*${phaseEscaped}\\.?\\s[^|]*(?:\\|[^\\n]*))$`,
        'im',
      );
      content = content.replace(tableRowPattern, (fullRow) => {
        const cells = fullRow.split('|').slice(1, -1);
        if (cells.length === 5) {
          cells[2] = ` ${planInfo.summaryCount}/${planInfo.planCount} `;
          cells[3] = ' Complete    ';
          cells[4] = ` ${dateStr} `;
        } else if (cells.length === 4) {
          cells[1] = ` ${planInfo.summaryCount}/${planInfo.planCount} `;
          cells[2] = ' Complete    ';
          cells[3] = ` ${dateStr} `;
        }
        return '|' + cells.join('|') + '|';
      });
    }

    await adapter.putRecord(roadmapPath, content);
  });
}

// ─── markRoadmapRequirementsComplete ────────────────────────────────────────

/**
 * Mark requirement IDs as complete in REQUIREMENTS.md (checkboxes + traceability table).
 *
 * Transaction-wrapping: YES — wraps read-modify-write in adapter.withTransaction.
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param reqIds - Requirement IDs to mark complete
 */
export async function markRoadmapRequirementsComplete(
  adapter: StorageAdapter,
  workstream: string | undefined,
  reqIds: string[],
): Promise<void> {
  if (reqIds.length === 0) return;

  await adapter.withTransaction(async () => {
    const reqPath = planningRelativePath(workstream, 'REQUIREMENTS.md');
    let content = (await adapter.getRecord(reqPath)) ?? '';

    for (const reqId of reqIds) {
      const reqEscaped = escapeRegex(reqId);
      // Update checkbox: - [ ] **REQ-ID** -> - [x] **REQ-ID**
      content = content.replace(
        new RegExp(`(-\\s*\\[)[ ](\\]\\s*\\*\\*${reqEscaped}\\*\\*)`, 'gi'),
        '$1x$2',
      );
      // Update traceability table: Pending/In Progress -> Complete
      content = content.replace(
        new RegExp(`(\\|\\s*${reqEscaped}\\s*\\|[^|]+\\|)\\s*(?:Pending|In Progress)\\s*(\\|)`, 'gi'),
        '$1 Complete $2',
      );
    }

    await adapter.putRecord(reqPath, content);
  });
}

// ─── renumberDecimalPhases ──────────────────────────────────────────────────

/**
 * Renumber sibling decimal phases after a decimal phase is removed.
 *
 * e.g. removing 06.2 -> 06.3 becomes 06.2, 06.4 becomes 06.3, etc.
 * Uses adapter read+write+remove pattern (adapters don't have native rename).
 *
 * Transaction-wrapping: NO — expected to be called within an existing transaction.
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param baseInt - The integer part of the decimal phase (e.g., "06")
 * @param removedDecimal - The decimal part that was removed (e.g., 2 for 06.2)
 * @returns Map of old->new directory names
 */
export async function renumberDecimalPhases(
  adapter: StorageAdapter,
  workstream: string | undefined,
  baseInt: string,
  removedDecimal: number,
): Promise<Map<string, string>> {
  const renamedMap = new Map<string, string>();
  const phasesPath = planningRelativePath(workstream, 'phases');
  const entries = await adapter.listCollection(phasesPath);

  const decPattern = new RegExp(`^${escapeRegex(baseInt)}\\.(\\d+)-(.+)$`);

  const toRename = entries
    .map(entry => {
      const m = entry.name.match(decPattern);
      return m ? { name: entry.name, oldDecimal: parseInt(m[1], 10), slug: m[2] } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null && item.oldDecimal > removedDecimal)
    .sort((a, b) => b.oldDecimal - a.oldDecimal); // DESCENDING to avoid conflicts

  for (const item of toRename) {
    const newDecimal = item.oldDecimal - 1;
    const oldPhaseId = `${baseInt}.${item.oldDecimal}`;
    const newPhaseId = `${baseInt}.${newDecimal}`;
    const newDirName = `${baseInt}.${newDecimal}-${item.slug}`;
    const oldDirPath = `${phasesPath}/${item.name}`;
    const newDirPath = `${phasesPath}/${newDirName}`;

    // Copy all files from old dir to new dir, renaming files that contain old phase ID
    const dirEntries = await adapter.listCollection(oldDirPath);
    for (const file of dirEntries) {
      const content = await adapter.getRecord(`${oldDirPath}/${file.name}`);
      const newFileName = file.name.includes(oldPhaseId)
        ? file.name.replace(oldPhaseId, newPhaseId)
        : file.name;
      if (content !== null) {
        await adapter.putRecord(`${newDirPath}/${newFileName}`, content);
      }
    }

    // Remove the entire old directory (files + dir marker) in one shot
    await adapter.removeCollection(oldDirPath);

    // Ensure new dir has .gitkeep
    await adapter.putRecord(`${newDirPath}/.gitkeep`, '');

    renamedMap.set(item.name, newDirName);
  }

  return renamedMap;
}

// ─── renumberIntegerPhases ──────────────────────────────────────────────────

/**
 * Renumber all integer phases after a removed integer phase.
 *
 * e.g. removing phase 5 -> phase 6 becomes 5, phase 7 becomes 6, etc.
 * Handles letter suffixes (12A) and decimals (6.1).
 * Uses adapter read+write+remove pattern (adapters don't have native rename).
 *
 * Transaction-wrapping: NO — expected to be called within an existing transaction.
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param removedInt - The integer phase number that was removed
 * @returns Map of old->new directory names
 */
export async function renumberIntegerPhases(
  adapter: StorageAdapter,
  workstream: string | undefined,
  removedInt: number,
): Promise<Map<string, string>> {
  const renamedMap = new Map<string, string>();
  const phasesPath = planningRelativePath(workstream, 'phases');
  const entries = await adapter.listCollection(phasesPath);

  const toRename = entries
    .map(entry => {
      const m = entry.name.match(/^(\d+)([A-Z])?(?:\.(\d+))?-(.+)$/i);
      if (!m) return null;
      const dirInt = parseInt(m[1], 10);
      if (dirInt <= removedInt) return null;
      return {
        name: entry.name,
        oldInt: dirInt,
        letter: m[2] ? m[2].toUpperCase() : '',
        decimal: m[3] !== undefined ? parseInt(m[3], 10) : null,
        slug: m[4],
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.oldInt !== b.oldInt
      ? b.oldInt - a.oldInt
      : (b.decimal ?? 0) - (a.decimal ?? 0)); // DESCENDING

  for (const item of toRename) {
    const newInt = item.oldInt - 1;
    const newPadded = String(newInt).padStart(2, '0');
    const oldPadded = String(item.oldInt).padStart(2, '0');
    const letterSuffix = item.letter || '';
    const decimalSuffix = item.decimal !== null ? `.${item.decimal}` : '';
    const oldPrefix = `${oldPadded}${letterSuffix}${decimalSuffix}`;
    const newPrefix = `${newPadded}${letterSuffix}${decimalSuffix}`;
    const newDirName = `${newPrefix}-${item.slug}`;
    const oldDirPath = `${phasesPath}/${item.name}`;
    const newDirPath = `${phasesPath}/${newDirName}`;

    // Copy all files from old dir to new dir, renaming files that start with old prefix
    const dirEntries = await adapter.listCollection(oldDirPath);
    for (const file of dirEntries) {
      const content = await adapter.getRecord(`${oldDirPath}/${file.name}`);
      const newFileName = file.name.startsWith(oldPrefix)
        ? newPrefix + file.name.slice(oldPrefix.length)
        : file.name;
      if (content !== null) {
        await adapter.putRecord(`${newDirPath}/${newFileName}`, content);
      }
    }

    // Remove the entire old directory (files + dir marker) in one shot
    await adapter.removeCollection(oldDirPath);

    // Ensure new dir has .gitkeep
    await adapter.putRecord(`${newDirPath}/.gitkeep`, '');

    renamedMap.set(item.name, newDirName);
  }

  return renamedMap;
}

// ─── updateRoadmapAfterRemoval ──────────────────────────────────────────────

/**
 * Update ROADMAP.md to reflect a removed phase and any renumbered phases.
 *
 * Removes the phase section, checkbox lines, table rows, and if the removal
 * was an integer phase, renumbers all subsequent phase references in ROADMAP.
 *
 * Transaction-wrapping: YES — wraps read-modify-write in adapter.withTransaction.
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param removedPhase - Phase identifier that was removed
 * @param isDecimal - Whether the removed phase was a decimal phase
 * @param removedInt - The integer part of the removed phase
 * @param renameMap - Map of old->new directory names from renumber operations
 */
export async function updateRoadmapAfterRemoval(
  adapter: StorageAdapter,
  workstream: string | undefined,
  removedPhase: string,
  isDecimal: boolean,
  removedInt: number,
  _renameMap?: Map<string, string>,
): Promise<void> {
  await adapter.withTransaction(async () => {
    const roadmapPath = planningRelativePath(workstream, 'ROADMAP.md');
    let content = (await adapter.getRecord(roadmapPath)) ?? '';
    const escaped = escapeRegex(removedPhase);

    // Remove the phase section (header + body until next phase header or end)
    content = content.replace(
      new RegExp(`\\n?#{2,4}\\s*Phase\\s+${escaped}\\s*:[\\s\\S]*?(?=\\n#{2,4}\\s+Phase\\s+\\d|$)`, 'i'),
      '',
    );

    // Remove checkbox lines referencing the phase
    content = content.replace(
      new RegExp(`\\n?-\\s*\\[[ x]\\]\\s*.*Phase\\s+${escaped}[:\\s][^\\n]*`, 'gi'),
      '',
    );

    // Remove table rows referencing the phase
    content = content.replace(
      new RegExp(`\\n?\\|\\s*${escaped}\\.?\\s[^|]*\\|[^\\n]*`, 'gi'),
      '',
    );

    // For integer phase removal, renumber all subsequent phases in ROADMAP text
    if (!isDecimal) {
      const MAX_PHASE = 99;
      for (let oldNum = MAX_PHASE; oldNum > removedInt; oldNum--) {
        const newNum = oldNum - 1;
        const oldStr = String(oldNum);
        const newStr = String(newNum);
        const oldPad = oldStr.padStart(2, '0');
        const newPad = newStr.padStart(2, '0');

        // Renumber phase headers: ### Phase N:
        content = content.replace(
          new RegExp(`(#{2,4}\\s*Phase\\s+)${escapeRegex(oldStr)}(\\s*:)`, 'gi'),
          `$1${newStr}$2`,
        );

        // Renumber inline Phase N references
        content = content.replace(
          new RegExp(`(Phase\\s+)${escapeRegex(oldStr)}([:\\s])`, 'g'),
          `$1${newStr}$2`,
        );

        // Renumber padded plan references: 07-01 -> 06-01
        content = content.replace(
          new RegExp(`${escapeRegex(oldPad)}-(\\d{2})`, 'g'),
          `${newPad}-$1`,
        );

        // Renumber table row phase numbers: | 7. -> | 6.
        content = content.replace(
          new RegExp(`(\\|\\s*)${escapeRegex(oldStr)}\\.\\s`, 'g'),
          `$1${newStr}. `,
        );

        // Renumber depends-on references
        content = content.replace(
          new RegExp(`(\\*\\*Depends on:\\*\\*\\s*Phase\\s+)${escapeRegex(oldStr)}\\b`, 'gi'),
          `$1${newStr}`,
        );
      }
    }

    await adapter.putRecord(roadmapPath, content);
  });
}

// ─── updateStatePhaseFields ─────────────────────────────────────────────────

/**
 * Update Current Position fields in STATE.md.
 *
 * Uses readModifyWriteState internally with stateReplaceField logic.
 *
 * Transaction-wrapping: YES (via readModifyWriteState which wraps in withTransaction).
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param fields - Fields to update in Current Position section
 * @param projectDir - Project root directory
 */
export async function updateStatePhaseFields(
  adapter: StorageAdapter,
  workstream: string | undefined,
  fields: { phase?: string; plan?: string; status?: string; lastActivity?: string; name?: string },
  projectDir: string,
): Promise<void> {
  await readModifyWriteState(adapter, workstream, (body) => {
    let result = body;
    if (fields.phase !== undefined) {
      const replaced = stateReplaceField(result, 'Current Phase', fields.phase)
        || stateReplaceField(result, 'Phase', fields.phase);
      if (replaced) result = replaced;
    }
    if (fields.plan !== undefined) {
      const replaced = stateReplaceField(result, 'Current Plan', fields.plan)
        || stateReplaceField(result, 'Plan', fields.plan);
      if (replaced) result = replaced;
    }
    if (fields.status !== undefined) {
      const replaced = stateReplaceField(result, 'Status', fields.status);
      if (replaced) result = replaced;
    }
    if (fields.lastActivity !== undefined) {
      const replaced = stateReplaceField(result, 'Last Activity', fields.lastActivity)
        || stateReplaceField(result, 'Last activity', fields.lastActivity);
      if (replaced) result = replaced;
    }
    return result;
  }, projectDir);
}

// updateStateProgressFields removed — progress fields (completed_phases,
// completed_plans, percent, etc.) are single-writer derived by
// syncStateFrontmatter (sdk/src/query/state.ts:buildStateFrontmatter) from
// the on-disk phase tree on every adapter write. Any code that used to call
// this helper was competing with the sync path and producing non-deterministic
// values (see Phase 3 UAT Bug 2, commit e325d561). If you need to set
// progress, write SUMMARY.md files and let the sync do it.

// ─── updatePerformanceMetrics ───────────────────────────────────────────────

/**
 * Update the Performance Metrics section in STATE.md for a completed phase.
 *
 * Finds the metrics table row for the phase and updates values. Also
 * increments "Total plans completed" counter.
 *
 * Transaction-wrapping: YES (via readModifyWriteState which wraps in withTransaction).
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param phaseNumber - Phase number being completed
 * @param metrics - Plans/status info
 * @param projectDir - Project root directory
 */
export async function updatePerformanceMetrics(
  adapter: StorageAdapter,
  workstream: string | undefined,
  phaseNumber: string,
  metrics: { planCount: number; summaryCount: number },
  projectDir: string,
): Promise<void> {
  await readModifyWriteState(adapter, workstream, (body) => {
    let content = body;

    // Update Velocity: Total plans completed
    const totalMatch = content.match(/Total plans completed:\s*(\d+|\[N\])/);
    const prevTotal = totalMatch && totalMatch[1] !== '[N]' ? parseInt(totalMatch[1], 10) : 0;
    const newTotal = prevTotal + metrics.summaryCount;
    content = content.replace(
      /Total plans completed:\s*(\d+|\[N\])/,
      `Total plans completed: ${newTotal}`,
    );

    // Update By Phase table — upsert row for this phase
    const byPhaseTablePattern = /(\|\s*Phase\s*\|\s*Plans\s*\|\s*Total\s*\|\s*Avg\/Plan\s*\|[ \t]*\n\|(?:[- :\t]+\|)+[ \t]*\n)((?:[ \t]*\|[^\n]*\n)*)(?=\n|$)/i;
    const byPhaseMatch = content.match(byPhaseTablePattern);
    if (byPhaseMatch) {
      let tableBody = byPhaseMatch[2].trim();
      const phaseRowPattern = new RegExp(`^\\|\\s*${escapeRegex(String(phaseNumber))}\\s*\\|.*$`, 'm');
      const newRow = `| ${phaseNumber} | ${metrics.summaryCount} | - | - |`;

      if (phaseRowPattern.test(tableBody)) {
        // Update existing row
        tableBody = tableBody.replace(new RegExp(`^\\|\\s*${escapeRegex(String(phaseNumber))}\\s*\\|.*$`, 'm'), newRow);
      } else {
        // Remove placeholder row and add new row
        tableBody = tableBody.replace(/^\|\s*-\s*\|\s*-\s*\|\s*-\s*\|\s*-\s*\|$/m, '').trim();
        tableBody = tableBody ? tableBody + '\n' + newRow : newRow;
      }

      content = content.replace(byPhaseTablePattern, `$1${tableBody}\n`);
    }

    return content;
  }, projectDir);
}

// ─── decrementStateTotalPhases ──────────────────────────────────────────────

/**
 * Decrement the total_phases counter in STATE.md (used after phase removal).
 *
 * Transaction-wrapping: YES (via readModifyWriteState which wraps in withTransaction).
 *
 * @param adapter - StorageAdapter instance
 * @param workstream - Active workstream or undefined
 * @param projectDir - Project root directory
 */
export async function decrementStateTotalPhases(
  adapter: StorageAdapter,
  workstream: string | undefined,
  projectDir: string,
): Promise<void> {
  // Decrement frontmatter total_phases
  const statePath = planningRelativePath(workstream, 'STATE.md');
  await adapter.withTransaction(async () => {
    const content = (await adapter.getRecord(statePath)) ?? '';
    const totalPhasesMatch = content.match(/total_phases:\s*(\d+)/);
    if (totalPhasesMatch) {
      const oldTotal = parseInt(totalPhasesMatch[1], 10);
      const updated = content.replace(
        /total_phases:\s*\d+/,
        `total_phases: ${oldTotal - 1}`,
      );
      await adapter.putRecord(statePath, updated);
    }
  });

  // Also update body "of N" pattern and "Total Phases" field
  await readModifyWriteState(adapter, workstream, (body) => {
    let result = body;
    const ofMatch = result.match(/(\bof\s+)(\d+)(\s*(?:\(|phases?))/i);
    if (ofMatch) {
      result = result.replace(
        /(\bof\s+)(\d+)(\s*(?:\(|phases?))/i,
        `$1${parseInt(ofMatch[2], 10) - 1}$3`,
      );
    }
    const totalRaw = stateExtractField(result, 'Total Phases');
    if (totalRaw) {
      const replaced = stateReplaceField(result, 'Total Phases', String(parseInt(totalRaw, 10) - 1));
      if (replaced) result = replaced;
    }
    return result;
  }, projectDir);
}
