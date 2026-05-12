/**
 * Phase lifecycle handlers — add, insert, scaffold operations.
 *
 * Ported from get-shit-done/bin/lib/phase.cjs and commands.cjs.
 * Provides phaseAdd (append phase), phaseAddBatch (append multiple phases),
 * phaseInsert (decimal phase insertion), and phaseScaffold (template file/directory creation).
 *
 * Phase 3 Plan 04 migration: all handlers are thin orchestrators that validate,
 * call shared helpers from phase-helpers.ts, and format results. All file I/O
 * routes through adapter primitives via the shared helper layer.
 *
 * @example
 * ```typescript
 * import { phaseAdd, phaseInsert, phaseScaffold } from './phase-lifecycle.js';
 *
 * await phaseAdd(['New Feature'], '/project');
 * await phaseInsert(['10', 'Urgent Fix'], '/project');
 * await phaseScaffold(['context', '9'], '/project');
 * ```
 */

import { join, relative } from 'node:path';
import type { StorageAdapter } from '../../../adapters/types.js';
import { GSDError, ErrorClassification } from '../errors.js';
import {
  adapterFor,
  escapeRegex,
  normalizeMd,
  normalizePhaseName,
  comparePhaseNum,
  phaseTokenMatches,
  toPosixPath,
  planningPaths,
  planningRelativePath,
  stateExtractField,
} from './helpers.js';
import { extractFrontmatter } from './frontmatter.js';
import { extractCurrentMilestone } from './roadmap.js';
import { getMilestonePhaseFilter } from './state.js';
import {
  acquireStateLock,
  readModifyWriteStateMdFull,
  releaseStateLock,
  stateReplaceField,
} from './state-mutation.js';
import {
  scaffoldPhaseDir,
  scaffoldPlanFiles,
  insertRoadmapPhase,
  scanNextPhaseNumber,
  readModifyWriteRoadmap,
  readModifyWriteState,
  removePhaseFiles,
  archivePhaseDir,
  removeRoadmapPhase,
  markRoadmapPhaseComplete,
  markRoadmapRequirementsComplete,
  renumberDecimalPhases,
  renumberIntegerPhases,
  updateRoadmapAfterRemoval,
  updateStatePhaseFields,
  updatePerformanceMetrics,
  decrementStateTotalPhases,
} from './phase-helpers.js';
import type { QueryHandler, QueryResult } from './utils.js';

// ─── Null byte validation ────────────────────────────────────────────────

/** Reject strings containing null bytes (path traversal defense). */
function assertNoNullBytes(value: string, label: string): void {
  if (value.includes('\0')) {
    throw new GSDError(`${label} contains null byte`, ErrorClassification.Validation);
  }
}

/** Reject `..` or path separators in phase directory names. */
function assertSafePhaseDirName(dirName: string, label = 'phase directory'): void {
  if (/[/\\]|\.\./.test(dirName)) {
    throw new GSDError(`${label} contains invalid path segments`, ErrorClassification.Validation);
  }
}

function assertSafeProjectCode(code: string): void {
  if (code && /[/\\]|\.\./.test(code)) {
    throw new GSDError('project_code contains invalid characters', ErrorClassification.Validation);
  }
}

// ─── Slug generation (inline) ────────────────────────────────────────────

/** Generate kebab-case slug from description. Port of generateSlugInternal. */
function generateSlugInternal(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

// ─── replaceInCurrentMilestone ──────────────────────────────────────────

/**
 * Replace a pattern only in the current milestone section of ROADMAP.md.
 *
 * Port of replaceInCurrentMilestone from core.cjs line 1197-1206.
 * If no `</details>` blocks exist, replaces in the entire content.
 * Otherwise, only replaces in content after the last `</details>` close tag.
 *
 * Edge case: when the active milestone is itself wrapped in a `<details>` block
 * (e.g. collapsed before it is fully shipped), the last `</details>` belongs to
 * the active milestone and the `after` slice is empty. In that case the function
 * falls back to searching the full content with all complete `<details>` blocks
 * stripped, so archived milestones are never touched.
 *
 * @param content - Full ROADMAP.md content
 * @param pattern - Regex or string pattern to match
 * @param replacement - Replacement string
 * @returns Modified content
 */
export function replaceInCurrentMilestone(
  content: string,
  pattern: string | RegExp,
  replacement: string,
): string {
  const lastDetailsClose = content.lastIndexOf('</details>');
  if (lastDetailsClose === -1) {
    return content.replace(pattern, replacement);
  }
  const offset = lastDetailsClose + '</details>'.length;
  const before = content.slice(0, offset);
  const after = content.slice(offset);

  // Fast path: the current milestone is not inside a <details> block — the
  // pattern lives in the plain text after the last </details>.
  const replacedAfter = after.replace(pattern, replacement);
  if (replacedAfter !== after) {
    return before + replacedAfter;
  }

  // Slow path: the active milestone is inside the last <details> block.
  // Strip every complete <details>…</details> block except the last one, then
  // apply the replacement inside that last block while leaving the stripped
  // (archived) blocks untouched.
  //
  // Strategy:
  //   1. Collect all complete <details>…</details> spans.
  //   2. Replace only inside the LAST span; leave earlier spans unchanged.
  const detailsBlockRe = /<details>[\s\S]*?<\/details>/gi;
  const spans: { start: number; end: number; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = detailsBlockRe.exec(content)) !== null) {
    spans.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }

  if (spans.length === 0) {
    // No complete blocks found — fall back to full-content replace.
    return content.replace(pattern, replacement);
  }

  const lastSpan = spans[spans.length - 1];
  const updatedLastBlock = lastSpan.text.replace(pattern, replacement);
  return (
    content.slice(0, lastSpan.start) +
    updatedLastBlock +
    content.slice(lastSpan.end)
  );
}

// ─── readModifyWriteRoadmapMd ───────────────────────────────────────────

/**
 * Atomic read-modify-write for ROADMAP.md.
 *
 * Holds a lockfile across the entire read -> transform -> write cycle.
 * Uses the same acquireStateLock/releaseStateLock mechanism as STATE.md
 * but with a ROADMAP.md-specific lock path.
 *
 * @deprecated Phase 3 migration complete. Use readModifyWriteRoadmap from phase-helpers.ts
 * or direct adapter.withTransaction + getRecord/putRecord. Will be removed in Phase 4.
 *
 * @param projectDir - Project root directory
 * @param modifier - Function to transform ROADMAP.md content
 * @returns The final written content
 */
export async function readModifyWriteRoadmapMd(
  projectDir: string,
  modifier: (content: string) => string | Promise<string>,
  workstream?: string,
): Promise<string> {
  const roadmapPath = planningPaths(projectDir, workstream).roadmap;
  const lockPath = await acquireStateLock(roadmapPath);
  try {
    const adapter = await adapterFor(projectDir);
    const roadmapRel = planningRelativePath(workstream, 'ROADMAP.md');
    const content = (await adapter.getRecord(roadmapRel)) ?? '';
    const modified = await modifier(content);
    await adapter.putRecord(roadmapRel, modified);
    return modified;
  } finally {
    await releaseStateLock(lockPath);
  }
}

// ─── phaseAdd handler ───────────────────────────────────────────────────

/**
 * Query handler for phase.add.
 *
 * Creates a new phase directory with .gitkeep, appends a phase section
 * to ROADMAP.md before the last "---" separator.
 *
 * @param args - args[0]: description (required), args[1]: customId (optional)
 * @param projectDir - Project root directory
 * @returns QueryResult with { phase_number, padded, name, slug, directory, naming_mode }
 */
export const phaseAdd: QueryHandler = async (args, projectDir, workstream) => {
  const description = args[0];
  if (!description) {
    throw new GSDError('description required for phase add', ErrorClassification.Validation);
  }
  assertNoNullBytes(description, 'description');

  const adapter = await adapterFor(projectDir);
  const configPath = planningRelativePath(workstream, 'config.json');
  let config: Record<string, unknown> = {};
  try {
    const configRaw = await adapter.getRecord(configPath);
    if (configRaw) config = JSON.parse(configRaw);
  } catch { /* use defaults */ }

  const slug = generateSlugInternal(description);
  const customId = args[1] || null;

  const projectCode = (config.project_code as string) || '';
  assertSafeProjectCode(projectCode);
  const prefix = projectCode ? `${projectCode}-` : '';

  let newPhaseId: number | string = '';
  let dirName = '';

  await adapter.withTransaction(async () => {
    if (customId || config.phase_naming === 'custom') {
      newPhaseId = customId || slug.toUpperCase().replace(/-/g, '_');
      if (!newPhaseId) {
        throw new GSDError('--id required when phase_naming is "custom"', ErrorClassification.Validation);
      }
      assertSafePhaseDirName(String(newPhaseId), 'custom phase id');
      dirName = `${prefix}${newPhaseId}-${slug}`;
    } else {
      newPhaseId = await scanNextPhaseNumber(adapter, workstream);
      const paddedNum = String(newPhaseId).padStart(2, '0');
      dirName = `${prefix}${paddedNum}-${slug}`;
    }

    assertSafePhaseDirName(dirName);
    await scaffoldPhaseDir(adapter, workstream, dirName);

    // Build phase entry and insert into ROADMAP
    const dependsOn = config.phase_naming === 'custom'
      ? ''
      : `\n**Depends on:** Phase ${typeof newPhaseId === 'number' ? newPhaseId - 1 : 'TBD'}`;
    const phaseEntry = `\n### Phase ${newPhaseId}: ${description}\n\n**Goal:** [To be planned]\n**Requirements**: TBD${dependsOn}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (run /gsd-plan-phase ${newPhaseId} to break down)\n`;

    await insertRoadmapPhase(adapter, workstream, phaseEntry);
  });

  if (!dirName) {
    throw new GSDError('Phase directory name was not computed', ErrorClassification.Execution);
  }
  if (newPhaseId === '') {
    throw new GSDError('Phase ID was not computed', ErrorClassification.Execution);
  }

  const result = {
    phase_number: typeof newPhaseId === 'number' ? newPhaseId : String(newPhaseId),
    padded: typeof newPhaseId === 'number' ? String(newPhaseId).padStart(2, '0') : String(newPhaseId),
    name: description,
    slug,
    directory: toPosixPath(planningRelativePath(workstream, `phases/${dirName}`)),
    naming_mode: config.phase_naming || 'sequential',
  };

  return { data: result };
};

// ─── phaseAddBatch handler ────────────────────────────────────────────────

/**
 * Query handler for phase.add-batch.
 *
 * Appends multiple phases in one transaction (sequential or custom naming).
 *
 * @param args - Either `--descriptions` followed by a JSON array string, or one description per arg (`--raw` ignored)
 */
export const phaseAddBatch: QueryHandler = async (args, projectDir, workstream) => {
  let descriptions: string[];
  const descIdx = args.indexOf('--descriptions');
  if (descIdx !== -1 && args[descIdx + 1] !== undefined) {
    try {
      const parsed = JSON.parse(args[descIdx + 1]) as unknown;
      if (!Array.isArray(parsed)) {
        throw new GSDError('--descriptions must be a JSON array', ErrorClassification.Validation);
      }
      descriptions = parsed.map((x) => String(x));
    } catch (e) {
      if (e instanceof GSDError) throw e;
      throw new GSDError('--descriptions must be a valid JSON array', ErrorClassification.Validation);
    }
  } else {
    descriptions = args.filter((a) => a !== '--raw');
  }

  if (descriptions.length === 0) {
    throw new GSDError('descriptions array required for phase add-batch', ErrorClassification.Validation);
  }

  for (const d of descriptions) {
    assertNoNullBytes(d, 'description');
    if (!d.trim()) {
      throw new GSDError('description must be non-empty', ErrorClassification.Validation);
    }
  }

  const adapter = await adapterFor(projectDir);
  const roadmapPath = planningRelativePath(workstream, 'ROADMAP.md');
  if (!(await adapter.exists(roadmapPath))) {
    throw new GSDError('ROADMAP.md not found', ErrorClassification.Validation);
  }

  const configPath = planningRelativePath(workstream, 'config.json');
  let config: Record<string, unknown> = {};
  try {
    const configRaw = await adapter.getRecord(configPath);
    if (configRaw) config = JSON.parse(configRaw);
  } catch { /* use defaults */ }

  const projectCode = (config.project_code as string) || '';
  assertSafeProjectCode(projectCode);
  const prefix = projectCode ? `${projectCode}-` : '';

  const added: Array<{
    phase_number: string | number;
    padded: string;
    name: string;
    slug: string;
    directory: string;
    naming_mode: unknown;
  }> = [];

  await adapter.withTransaction(async () => {
    let nextNum = await scanNextPhaseNumber(adapter, workstream);

    for (const description of descriptions) {
      const slug = generateSlugInternal(description);
      let newPhaseId: number | string;
      let dirName: string;

      if (config.phase_naming === 'custom') {
        newPhaseId = slug.toUpperCase();
        dirName = `${prefix}${newPhaseId}-${slug}`;
      } else {
        newPhaseId = nextNum;
        nextNum++;
        dirName = `${prefix}${String(newPhaseId).padStart(2, '0')}-${slug}`;
      }

      assertSafePhaseDirName(dirName);
      await scaffoldPhaseDir(adapter, workstream, dirName);

      const dependsOn =
        config.phase_naming === 'custom'
          ? ''
          : `\n**Depends on:** Phase ${typeof newPhaseId === 'number' ? newPhaseId - 1 : 'TBD'}`;
      const phaseEntry = `\n### Phase ${newPhaseId}: ${description}\n\n**Goal:** [To be planned]\n**Requirements**: TBD${dependsOn}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (run /gsd-plan-phase ${newPhaseId} to break down)\n`;

      await insertRoadmapPhase(adapter, workstream, phaseEntry);

      added.push({
        phase_number: typeof newPhaseId === 'number' ? newPhaseId : String(newPhaseId),
        padded: typeof newPhaseId === 'number' ? String(newPhaseId).padStart(2, '0') : String(newPhaseId),
        name: description,
        slug,
        directory: toPosixPath(planningRelativePath(workstream, `phases/${dirName}`)),
        naming_mode: config.phase_naming || 'sequential',
      });
    }
  });

  return { data: { phases: added, count: added.length } };
};

// ─── phaseInsert handler ────────────────────────────────────────────────

/**
 * Query handler for phase.insert.
 *
 * Creates a decimal phase directory after a target phase, inserting
 * the phase section in ROADMAP.md after the target.
 *
 * @param args - args[0]: afterPhase (required), args[1]: description (required)
 * @param projectDir - Project root directory
 * @returns QueryResult with { phase_number, after_phase, name, slug, directory }
 */
export const phaseInsert: QueryHandler = async (args, projectDir, workstream) => {
  const afterPhase = args[0];
  const description = args[1];

  if (!afterPhase || !description) {
    throw new GSDError('after-phase and description required for phase insert', ErrorClassification.Validation);
  }
  assertNoNullBytes(afterPhase, 'afterPhase');
  assertNoNullBytes(description, 'description');

  const adapter = await adapterFor(projectDir);
  const slug = generateSlugInternal(description);
  let decimalPhase = '';
  let dirName = '';

  await adapter.withTransaction(async () => {
    // Validate target phase exists in ROADMAP
    const roadmapPath = planningRelativePath(workstream, 'ROADMAP.md');
    const rawContent = (await adapter.getRecord(roadmapPath)) ?? '';
    const milestoneContent = await extractCurrentMilestone(adapter, rawContent, workstream);

    const normalizedAfter = normalizePhaseName(afterPhase);
    const unpadded = normalizedAfter.replace(/^0+/, '');
    const afterPhaseEscaped = unpadded.replace(/\./g, '\\.');
    const targetPattern = new RegExp(`#{2,4}\\s*Phase\\s+0*${afterPhaseEscaped}:`, 'i');
    if (!targetPattern.test(milestoneContent)) {
      throw new GSDError(`Phase ${afterPhase} not found in ROADMAP.md`, ErrorClassification.Validation);
    }

    // Calculate next decimal by scanning directories AND ROADMAP entries via adapter
    const normalizedBase = normalizePhaseName(afterPhase);
    const decimalSet = new Set<number>();
    const phasesPath = planningRelativePath(workstream, 'phases');
    const entries = await adapter.listCollection(phasesPath);

    const decimalDirPattern = new RegExp(`^(?:[A-Z]{1,6}-)?${escapeRegex(normalizedBase)}\\.(\\d+)`);
    for (const entry of entries) {
      const dm = entry.name.match(decimalDirPattern);
      if (dm) decimalSet.add(parseInt(dm[1], 10));
    }

    // Also scan ROADMAP.md content for decimal entries
    const rmPhasePattern = new RegExp(
      `#{2,4}\\s*Phase\\s+0*${escapeRegex(normalizedBase)}\\.(\\d+)\\s*:`, 'gi'
    );
    let rmMatch: RegExpExecArray | null;
    while ((rmMatch = rmPhasePattern.exec(rawContent)) !== null) {
      decimalSet.add(parseInt(rmMatch[1], 10));
    }

    const nextDecimal = decimalSet.size === 0 ? 1 : Math.max(...decimalSet) + 1;
    decimalPhase = `${normalizedBase}.${nextDecimal}`;

    // Optional project code prefix
    const configPath = planningRelativePath(workstream, 'config.json');
    let insertConfig: Record<string, unknown> = {};
    try {
      const configRaw = await adapter.getRecord(configPath);
      if (configRaw) insertConfig = JSON.parse(configRaw);
    } catch { /* use defaults */ }
    const projectCode = (insertConfig.project_code as string) || '';
    assertSafeProjectCode(projectCode);
    const pfx = projectCode ? `${projectCode}-` : '';
    dirName = `${pfx}${decimalPhase}-${slug}`;
    assertSafePhaseDirName(dirName);

    // Create directory via adapter
    await scaffoldPhaseDir(adapter, workstream, dirName);

    // Build phase entry and insert after target phase section in ROADMAP
    const phaseEntry = `\n### Phase ${decimalPhase}: ${description} (INSERTED)\n\n**Goal:** [Urgent work - to be planned]\n**Requirements**: TBD\n**Depends on:** Phase ${afterPhase}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (run /gsd-plan-phase ${decimalPhase} to break down)\n`;

    const headerPattern = new RegExp(`(#{2,4}\\s*Phase\\s+0*${afterPhaseEscaped}:[^\\n]*\\n)`, 'i');
    const headerMatch = rawContent.match(headerPattern);
    if (!headerMatch) {
      throw new GSDError(`Could not find Phase ${afterPhase} header`, ErrorClassification.Execution);
    }

    const headerIdx = rawContent.indexOf(headerMatch[0]);
    const afterHeader = rawContent.slice(headerIdx + headerMatch[0].length);
    const nextPhaseMatch = afterHeader.match(/\n#{2,4}\s+Phase\s+\d/i);

    let insertIdx: number;
    if (nextPhaseMatch && nextPhaseMatch.index !== undefined) {
      insertIdx = headerIdx + headerMatch[0].length + nextPhaseMatch.index;
    } else {
      insertIdx = rawContent.length;
    }

    const updatedRoadmap = rawContent.slice(0, insertIdx) + phaseEntry + rawContent.slice(insertIdx);
    await adapter.putRecord(roadmapPath, updatedRoadmap);
  });

  if (!decimalPhase) {
    throw new GSDError('Decimal phase was not computed', ErrorClassification.Execution);
  }
  if (!dirName) {
    throw new GSDError('Phase directory name was not computed', ErrorClassification.Execution);
  }

  return {
    data: {
      phase_number: decimalPhase,
      after_phase: afterPhase,
      name: description,
      slug,
      directory: toPosixPath(planningRelativePath(workstream, `phases/${dirName}`)),
    },
  };
};

// ─── phaseScaffold handler ──────────────────────────────────────────────

/**
 * Internal helper: find phase directory matching a phase identifier via adapter.
 */
async function findPhaseDirAdapter(
  adapter: StorageAdapter,
  workstream: string | undefined,
  phase: string,
): Promise<{ dirName: string; phaseName: string | null } | null> {
  const phasesPath = planningRelativePath(workstream, 'phases');
  const normalized = normalizePhaseName(phase);

  const entries = await adapter.listCollection(phasesPath);
  const match = entries.find(e => phaseTokenMatches(e.name, normalized));
  if (!match) return null;

  const dirMatch = match.name.match(/^(?:[A-Z]{1,6}-)?\d+[A-Z]?(?:\.\d+)*-(.+)/i);
  const phaseName = dirMatch ? dirMatch[1] : null;

  return { dirName: match.name, phaseName };
}

/**
 * Internal helper: find phase directory matching a phase identifier.
 *
 * Migrated to adapter in Phase 4, Plan 02.
 */
async function findPhaseDir(
  projectDir: string,
  phase: string,
  workstream?: string,
): Promise<{ dirPath: string; dirName: string; phaseName: string | null } | null> {
  const phasesDir = planningPaths(projectDir, workstream).phases;
  const normalized = normalizePhaseName(phase);

  try {
    const adapter = await adapterFor(projectDir);
    const phasesRel = planningRelativePath(workstream, 'phases');
    const refs = await adapter.listCollection(phasesRel);
    const dirNames: string[] = [];
    for (const ref of refs) {
      const st = await adapter.stat(ref.path);
      if (st?.kind === 'dir') dirNames.push(ref.name);
    }
    const match = dirNames.find(d => phaseTokenMatches(d, normalized));
    if (!match) return null;

    // Extract phase name from directory
    const dirMatch = match.match(/^(?:[A-Z]{1,6}-)?\d+[A-Z]?(?:\.\d+)*-(.+)/i);
    const phaseName = dirMatch ? dirMatch[1] : null;

    return {
      dirPath: join(phasesDir, match),
      dirName: match,
      phaseName,
    };
  } catch {
    return null;
  }
}

/**
 * Query handler for phase.scaffold.
 *
 * Port of cmdScaffold from commands.cjs lines 750-806.
 * Creates template files (context, uat, verification) or phase directories.
 *
 * @param args - Positional `[type, phase, name?]` **or** gsd-tools style
 *   `[type, '--phase', N, '--name', title]` (name may be multiple words).
 * @param projectDir - Project root directory
 * @returns QueryResult with { created, path } or { created: false, reason: 'already_exists' }
 */
function normalizeScaffoldArgs(args: string[]): string[] {
  const type = args[0];
  if (!type || !args.includes('--phase')) {
    return args;
  }
  const phaseIdx = args.indexOf('--phase');
  const phase = phaseIdx !== -1 && args[phaseIdx + 1] && !args[phaseIdx + 1].startsWith('--')
    ? args[phaseIdx + 1]
    : '';
  const nameIdx = args.indexOf('--name');
  let name: string | undefined;
  if (nameIdx !== -1) {
    const tail = args.slice(nameIdx + 1);
    const stop = tail.findIndex(a => a.startsWith('--'));
    const parts = stop === -1 ? tail : tail.slice(0, stop);
    name = parts.join(' ').trim() || undefined;
  }
  return [type, phase, ...(name !== undefined && name !== '' ? [name] : [])];
}

export const phaseScaffold: QueryHandler = async (args, projectDir, workstream) => {
  const normalized = normalizeScaffoldArgs(args);
  const type = normalized[0];
  const phase = normalized[1];
  const name = normalized[2] || undefined;

  if (!type) {
    throw new GSDError('type required for scaffold', ErrorClassification.Validation);
  }

  const validTypes = new Set(['context', 'uat', 'verification', 'phase-dir']);
  if (!validTypes.has(type)) {
    throw new GSDError(
      `Unknown scaffold type: ${type}. Available: context, uat, verification, phase-dir`,
      ErrorClassification.Validation,
    );
  }

  if (phase) {
    assertNoNullBytes(phase, 'phase');
  }
  if (name) {
    assertNoNullBytes(name, 'name');
  }

  const adapter = await adapterFor(projectDir);
  const padded = phase ? normalizePhaseName(phase) : '00';
  const today = new Date().toISOString().split('T')[0];

  // Handle phase-dir type separately
  if (type === 'phase-dir') {
    if (!phase || !name) {
      throw new GSDError('phase and name required for phase-dir scaffold', ErrorClassification.Validation);
    }
    const slug = generateSlugInternal(name);
    const dirNameNew = `${padded}-${slug}`;
    assertSafePhaseDirName(dirNameNew, 'scaffold phase directory');
    await scaffoldPhaseDir(adapter, workstream, dirNameNew);
    return {
      data: {
        created: true,
        directory: toPosixPath(planningRelativePath(workstream, `phases/${dirNameNew}`)),
        path: planningRelativePath(workstream, `phases/${dirNameNew}`),
      },
    };
  }

  // For context/uat/verification types, find the phase directory via adapter
  const phaseInfo = phase ? await findPhaseDirAdapter(adapter, workstream, phase) : null;
  if (phase && !phaseInfo) {
    throw new GSDError(`Phase ${phase} directory not found`, ErrorClassification.Blocked);
  }

  const phaseDirName = phaseInfo!.dirName;
  const phaseName = name || phaseInfo?.phaseName || 'Unnamed';
  const basePath = planningRelativePath(workstream, `phases/${phaseDirName}`);

  let filePath: string;
  let content: string;

  switch (type) {
    case 'context': {
      filePath = `${basePath}/${padded}-CONTEXT.md`;
      content = `---\nphase: "${padded}"\nname: "${phaseName}"\ncreated: ${today}\n---\n\n# Phase ${phase}: ${phaseName} — Context\n\n## Decisions\n\n_Decisions will be captured during /gsd-discuss-phase ${phase}_\n\n## Discretion Areas\n\n_Areas where the executor can use judgment_\n\n## Deferred Ideas\n\n_Ideas to consider later_\n`;
      break;
    }
    case 'uat': {
      filePath = `${basePath}/${padded}-UAT.md`;
      content = `---\nphase: "${padded}"\nname: "${phaseName}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${phaseName} — User Acceptance Testing\n\n## Test Results\n\n| # | Test | Status | Notes |\n|---|------|--------|-------|\n\n## Summary\n\n_Pending UAT_\n`;
      break;
    }
    case 'verification': {
      filePath = `${basePath}/${padded}-VERIFICATION.md`;
      content = `---\nphase: "${padded}"\nname: "${phaseName}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${phaseName} — Verification\n\n## Goal-Backward Verification\n\n**Phase Goal:** [From ROADMAP.md]\n\n## Checks\n\n| # | Requirement | Status | Evidence |\n|---|------------|--------|----------|\n\n## Result\n\n_Pending verification_\n`;
      break;
    }
    default:
      throw new GSDError(`Unknown scaffold type: ${type}`, ErrorClassification.Validation);
  }

  // Check if file already exists via adapter
  if (await adapter.exists(filePath)) {
    return {
      data: {
        created: false,
        reason: 'already_exists',
        path: filePath,
      },
    };
  }

  await adapter.putRecord(filePath, content);
  return { data: { created: true, path: toPosixPath(filePath) } };
};

// ─── renameDecimalPhases (DEPRECATED — use renumberDecimalPhases from phase-helpers.ts) ──
// ─── renameIntegerPhases (DEPRECATED — use renumberIntegerPhases from phase-helpers.ts) ──
// ─── updateRoadmapAfterPhaseRemoval (DEPRECATED — use updateRoadmapAfterRemoval from phase-helpers.ts) ──
// All three functions removed in Phase 3 Plan 04 migration. Domain logic extracted to
// phase-helpers.ts with adapter-first-parameter signatures.

// ─── phaseRemove handler ───────────────────────────────────────────────

/**
 * Query handler for phase.remove.
 *
 * Deletes phase directory, renumbers subsequent phases on disk,
 * updates ROADMAP.md (removes section + renumbers), and decrements
 * STATE.md total_phases count. All operations via adapter.
 *
 * @param args - args[0]: targetPhase (required), args[1]: '--force' (optional)
 * @param projectDir - Project root directory
 * @returns QueryResult with { removed, directory_deleted, renamed_directories, roadmap_updated, state_updated }
 */
export const phaseRemove: QueryHandler = async (args, projectDir, workstream) => {
  const targetPhase = args[0];
  if (!targetPhase) {
    throw new GSDError('phase number required for phase remove', ErrorClassification.Validation);
  }
  assertNoNullBytes(targetPhase, 'targetPhase');

  const adapter = await adapterFor(projectDir);
  const roadmapPath = planningRelativePath(workstream, 'ROADMAP.md');
  if (!(await adapter.exists(roadmapPath))) {
    throw new GSDError('ROADMAP.md not found', ErrorClassification.Validation);
  }

  const normalized = normalizePhaseName(targetPhase);
  const isDecimal = targetPhase.includes('.');
  const force = args[1] === '--force';

  // Find target directory via adapter
  const phasesPath = planningRelativePath(workstream, 'phases');
  const entries = await adapter.listCollection(phasesPath);
  const targetDir = entries.find(e => phaseTokenMatches(e.name, normalized))?.name ?? null;

  // Guard against removing executed work
  if (targetDir && !force) {
    const dirPath = `${phasesPath}/${targetDir}`;
    const files = await adapter.listCollection(dirPath);
    const summaries = files.filter(f => f.name.endsWith('-SUMMARY.md') || f.name === 'SUMMARY.md');
    if (summaries.length > 0) {
      throw new GSDError(
        `Phase ${targetPhase} has ${summaries.length} executed plan(s). Use --force to remove anyway.`,
        ErrorClassification.Validation,
      );
    }
  }

  let renamedDirs: Map<string, string> = new Map();

  await adapter.withTransaction(async () => {
    // Delete directory files via adapter
    if (targetDir) {
      await removePhaseFiles(adapter, workstream, targetDir);
    }

    // Renumber subsequent phases on disk via adapter
    try {
      if (isDecimal) {
        const parts = normalized.split('.');
        if (parts.length < 2 || !parts[1]) {
          throw new GSDError(`Invalid decimal phase identifier: ${targetPhase}`, ErrorClassification.Validation);
        }
        const decimalPart = parseInt(parts[1], 10);
        if (isNaN(decimalPart)) {
          throw new GSDError(`Invalid decimal part in phase: ${targetPhase}`, ErrorClassification.Validation);
        }
        renamedDirs = await renumberDecimalPhases(adapter, workstream, parts[0], decimalPart);
      } else {
        renamedDirs = await renumberIntegerPhases(adapter, workstream, parseInt(normalized, 10));
      }
    } catch { /* intentionally empty — renaming is best-effort */ }

    // Update ROADMAP.md via adapter helper
    await updateRoadmapAfterRemoval(adapter, workstream, targetPhase, isDecimal, parseInt(normalized, 10), renamedDirs);

    // Update STATE.md: decrement total_phases via adapter helper
    await decrementStateTotalPhases(adapter, workstream, projectDir);
  });

  return {
    data: {
      removed: targetPhase,
      directory_deleted: targetDir,
      renamed_directories: Array.from(renamedDirs.entries()).map(([from, to]) => ({ from, to })),
      roadmap_updated: true,
      state_updated: true,
    },
  };
};

// ─── stateReplaceFieldWithFallback (inline) ────────────────────────────────

/**
 * Replace a field with fallback field name support.
 */
function stateReplaceFieldWithFallback(
  content: string,
  primary: string,
  fallback: string | null,
  value: string,
): string {
  let result = stateReplaceField(content, primary, value);
  if (result) return result;
  if (fallback) {
    result = stateReplaceField(content, fallback, value);
    if (result) return result;
  }
  return content;
}

// ─── phaseComplete handler ────────────────────────────────────────────────

/**
 * Query handler for phase.complete.
 *
 * Marks a phase as done — updates ROADMAP.md, REQUIREMENTS.md, and STATE.md
 * atomically via adapter.withTransaction.
 *
 * @param args - args[0]: phaseNum (required)
 * @param projectDir - Project root directory
 * @returns QueryResult with completion details and warnings
 */
export const phaseComplete: QueryHandler = async (args, projectDir, workstream) => {
  const phaseNum = args[0];
  if (!phaseNum) {
    throw new GSDError('phase number required for phase complete', ErrorClassification.Validation);
  }
  assertNoNullBytes(phaseNum, 'phaseNum');

  const adapter = await adapterFor(projectDir);
  const today = new Date().toISOString().split('T')[0];

  // Step A: Validate phase exists and get info via adapter
  const phaseInfo = await findPhaseDirAdapter(adapter, workstream, phaseNum);
  if (!phaseInfo) {
    throw new GSDError(`Phase ${phaseNum} not found`, ErrorClassification.Validation);
  }

  const phaseDirPath = planningRelativePath(workstream, `phases/${phaseInfo.dirName}`);
  const phaseFiles = await adapter.listCollection(phaseDirPath);
  const fileNames = phaseFiles.map(f => f.name);

  const plans = fileNames.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
  const summaries = fileNames.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
  const planCount = plans.length;
  const summaryCount = summaries.length;
  let requirementsUpdated = false;

  // Step B: Check for verification warnings (non-blocking)
  const warnings: string[] = [];
  for (const file of fileNames.filter(f => f.includes('-UAT') && f.endsWith('.md'))) {
    const content = await adapter.getRecord(`${phaseDirPath}/${file}`);
    if (content) {
      if (/result: pending/.test(content)) warnings.push(`${file}: has pending tests`);
      if (/result: blocked/.test(content)) warnings.push(`${file}: has blocked tests`);
      if (/status: partial/.test(content)) warnings.push(`${file}: testing incomplete (partial)`);
      if (/status: diagnosed/.test(content)) warnings.push(`${file}: has diagnosed gaps`);
    }
  }
  for (const file of fileNames.filter(f => f.includes('-VERIFICATION') && f.endsWith('.md'))) {
    const content = await adapter.getRecord(`${phaseDirPath}/${file}`);
    if (content) {
      if (/status: human_needed/.test(content)) warnings.push(`${file}: needs human verification`);
      if (/status: gaps_found/.test(content)) warnings.push(`${file}: has unresolved gaps`);
    }
  }

  // Step C+D: Update ROADMAP.md + REQUIREMENTS.md in one transaction
  await adapter.withTransaction(async () => {
    // C: Mark phase complete in ROADMAP
    await markRoadmapPhaseComplete(adapter, workstream, phaseNum, today, { summaryCount, planCount });

    // Update plan count and plan checkboxes in ROADMAP
    await readModifyWriteRoadmap(adapter, workstream, (roadmapContent) => {
      const phaseEscaped = escapeRegex(phaseNum);

      // Update plan count in phase section
      const planCountPattern = new RegExp(
        `(#{2,4}\\s*Phase\\s+${phaseEscaped}(?:(?!\\n#{2,4})[\\s\\S])*?\\*\\*Plans:\\*\\*[ \\t]*)[^\\n]+`,
        'i',
      );
      roadmapContent = replaceInCurrentMilestone(
        roadmapContent, planCountPattern,
        `$1${summaryCount}/${planCount} plans complete`,
      );

      // Mark completed plan checkboxes
      for (const summaryFile of summaries) {
        const planId = summaryFile.replace('-SUMMARY.md', '').replace('SUMMARY.md', '');
        if (!planId) continue;
        const planEscaped = escapeRegex(planId);
        const planCheckboxPattern = new RegExp(
          `(-\\s*\\[) (\\]\\s*(?:\\*\\*)?${planEscaped}(?:\\*\\*)?)`,
          'i',
        );
        roadmapContent = roadmapContent.replace(planCheckboxPattern, '$1x$2');
      }

      return roadmapContent;
    });

    // D: Update REQUIREMENTS.md if applicable
    const roadmapPath = planningRelativePath(workstream, 'ROADMAP.md');
    const roadmapContent = (await adapter.getRecord(roadmapPath)) ?? '';
    const currentMilestoneRoadmap = await extractCurrentMilestone(adapter, roadmapContent, workstream);
    const phaseEscaped = escapeRegex(phaseNum);
    const phaseSectionMatch = currentMilestoneRoadmap.match(
      new RegExp(`(#{2,4}\\s*Phase\\s+${phaseEscaped}[:\\s][\\s\\S]*?)(?=#{2,4}\\s*Phase\\s+|$)`, 'i'),
    );
    const sectionText = phaseSectionMatch ? phaseSectionMatch[1] : '';
    const reqMatch = sectionText.match(/\*\*Requirements\*?\*?:?\s*([^\n]+)/i);

    if (reqMatch) {
      const reqIds = reqMatch[1].replace(/[[\]]/g, '').split(/[,\s]+/).map(r => r.trim()).filter(Boolean);
      if (reqIds.length > 0) {
        await markRoadmapRequirementsComplete(adapter, workstream, reqIds);
        requirementsUpdated = true;
      }
    }
  });

  // Step E: Find next phase via adapter
  let nextPhaseNum: string | null = null;
  let nextPhaseName: string | null = null;
  let isLastPhase = true;
  let completedPhaseInPrimaryMilestone = true;

  try {
    const isDirInMilestone = await getMilestonePhaseFilter(adapter, workstream);
    const phasesPath = planningRelativePath(workstream, 'phases');
    const allEntries = await adapter.listCollection(phasesPath);
    const allDirs = allEntries.map(e => e.name);

    const completedDirInFilter = allDirs.some((d) => {
      const dm = d.match(/^(\d+[A-Z]?(?:\.\d+)*)-?/i);
      return dm && comparePhaseNum(dm[1], phaseNum) === 0 && isDirInMilestone(d);
    });
    completedPhaseInPrimaryMilestone = completedDirInFilter;
    const effectiveFilter = completedDirInFilter ? isDirInMilestone : (_d: string) => true;

    const dirs = allDirs
      .filter(effectiveFilter)
      .sort((a, b) => comparePhaseNum(a, b));

    for (const dir of dirs) {
      const dm = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i);
      if (dm) {
        if (comparePhaseNum(dm[1], phaseNum) > 0) {
          nextPhaseNum = dm[1];
          nextPhaseName = dm[2] || null;
          isLastPhase = false;
          break;
        }
      }
    }
  } catch { /* intentionally empty */ }

  // Fallback: check ROADMAP.md for phases not yet scaffolded
  if (isLastPhase) {
    try {
      const roadmapPath = planningRelativePath(workstream, 'ROADMAP.md');
      const roadmapContent = (await adapter.getRecord(roadmapPath)) ?? '';
      const roadmapForPhases = completedPhaseInPrimaryMilestone
        ? await extractCurrentMilestone(adapter, roadmapContent, workstream)
        : roadmapContent;
      const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi;
      let pm: RegExpExecArray | null;
      while ((pm = phasePattern.exec(roadmapForPhases)) !== null) {
        if (comparePhaseNum(pm[1], phaseNum) > 0) {
          nextPhaseNum = pm[1];
          nextPhaseName = pm[2].replace(/\(INSERTED\)/i, '').trim().toLowerCase().replace(/\s+/g, '-');
          isLastPhase = false;
          break;
        }
      }
    } catch { /* intentionally empty */ }
  }

  // Step F: Update STATE.md via adapter
  await adapter.withTransaction(async () => {
    await updateStatePhaseFields(adapter, workstream, {
      phase: nextPhaseNum || phaseNum,
      plan: 'Not started',
      status: isLastPhase ? 'Milestone complete' : 'Ready to plan',
      lastActivity: today,
    }, projectDir);

    await updatePerformanceMetrics(adapter, workstream, phaseNum, { planCount, summaryCount }, projectDir);

    // Update only non-derived frontmatter fields. Progress counters
    // (total_phases, completed_phases, total_plans, completed_plans, percent)
    // are derived by syncStateFrontmatter (state.ts:buildStateFrontmatter) from
    // the on-disk phase tree on every adapter write — we intentionally do NOT
    // write them here. Before this became the single-writer rule, phase.complete
    // used a phase-weighted formula (new_completed / total_phases) while the
    // sync path used plan-weighted (completed_plans / total_plans), so
    // `progress.percent` bounced between the two values depending on which
    // wrote last (see Phase 3 UAT Bug 2).
    const statePath = planningRelativePath(workstream, 'STATE.md');
    await adapter.mergeFrontmatter(statePath, {
      status: isLastPhase ? 'milestone_complete' : 'ready_to_plan',
    });
  });

  return {
    data: {
      completed_phase: phaseNum,
      phase_name: phaseInfo.phaseName,
      plans_executed: `${summaryCount}/${planCount}`,
      next_phase: nextPhaseNum,
      next_phase_name: nextPhaseName,
      is_last_phase: isLastPhase,
      date: today,
      roadmap_updated: true,
      state_updated: true,
      requirements_updated: requirementsUpdated,
      warnings,
      has_warnings: warnings.length > 0,
    },
  };
};

// ─── phasesClear handler ──────────────────────────────────────────────────

/**
 * Query handler for phases.clear.
 *
 * Deletes all phase directories except 999.x backlog phases via adapter.
 * Requires --confirm flag to proceed.
 *
 * @param args - args[0]: '--confirm' to proceed (optional)
 * @param projectDir - Project root directory
 * @returns QueryResult with { cleared: count }
 */
export const phasesClear: QueryHandler = async (args, projectDir, workstream) => {
  const adapter = await adapterFor(projectDir);
  const phasesPath = planningRelativePath(workstream, 'phases');
  const confirm = Array.isArray(args) && args.includes('--confirm');
  let cleared = 0;

  if (await adapter.exists(phasesPath)) {
    const entries = await adapter.listCollection(phasesPath);
    const dirs = entries.filter(e => !/^999(?:\.|$)/.test(e.name));

    if (dirs.length > 0 && !confirm) {
      throw new GSDError(
        `phases clear would delete ${dirs.length} phase director${dirs.length === 1 ? 'y' : 'ies'}. ` +
        `Pass --confirm to proceed.`,
        ErrorClassification.Validation,
      );
    }

    await adapter.withTransaction(async () => {
      for (const entry of dirs) {
        await removePhaseFiles(adapter, workstream, entry.name);
        cleared++;
      }
    });
  }

  return { data: { cleared } };
};

// ─── phasesArchive handler ────────────────────────────────────────────────

/**
 * Query handler for phases.archive.
 *
 * Extracted from cmdMilestoneComplete, milestone.cjs lines 210-227.
 * Moves milestone phase directories to milestones/{version}-phases/.
 *
 * @param args - args[0]: version string (e.g., "v3.0")
 * @param projectDir - Project root directory
 * @returns QueryResult with { archived: count, version, archive_directory }
 */
export const phasesList = async (adapter: StorageAdapter, args: string[], _projectDir: string, workstream?: string): Promise<QueryResult> => {
  const phasesRel = planningRelativePath(workstream, 'phases');

  const typeIdx = args.indexOf('--type');
  const phaseIdx = args.indexOf('--phase');
  const type = typeIdx !== -1 ? args[typeIdx + 1] : null;
  const phase = phaseIdx !== -1 ? args[phaseIdx + 1] : null;
  const includeArchived = args.includes('--include-archived');

  if (!(await adapter.exists(phasesRel))) {
    return { data: type ? { files: [], count: 0 } : { directories: [], count: 0 } };
  }

  const phaseRefs = await adapter.listCollection(phasesRel);
  const dirChecks = await Promise.all(
    phaseRefs.map(async r => ({ ref: r, isDir: (await adapter.stat(r.path))?.kind === 'dir' })),
  );
  let dirs = dirChecks.filter(c => c.isDir).map(c => c.ref.name);

  if (includeArchived) {
    const milestonesRel = planningRelativePath(workstream, 'milestones');
    if (await adapter.exists(milestonesRel)) {
      const milestoneRefs = await adapter.listCollection(milestonesRel);
      const mDirChecks = await Promise.all(
        milestoneRefs.map(async r => ({ ref: r, isDir: (await adapter.stat(r.path))?.kind === 'dir' })),
      );
      for (const mDir of mDirChecks.filter(c => c.isDir && c.ref.name.endsWith('-phases'))) {
        const milestone = mDir.ref.name.replace(/-phases$/, '');
        const archivedRefs = await adapter.listCollection(mDir.ref.path);
        const aDirChecks = await Promise.all(
          archivedRefs.map(async r => ({ ref: r, isDir: (await adapter.stat(r.path))?.kind === 'dir' })),
        );
        for (const a of aDirChecks.filter(c => c.isDir)) {
          dirs.push(`${a.ref.name} [${milestone}]`);
        }
      }
    }
  }

  dirs.sort((a, b) => comparePhaseNum(a, b));

  if (phase) {
    const normalized = normalizePhaseName(phase);
    const match = dirs.find(d => phaseTokenMatches(d, normalized));
    if (!match) {
      return { data: { files: [], count: 0, phase_dir: null, error: 'Phase not found' } };
    }
    dirs = [match];
  }

  if (type) {
    const files: string[] = [];
    for (const dir of dirs) {
      const dirPath = `${phasesRel}/${dir}`;
      if (!(await adapter.exists(dirPath))) continue;
      const fileRefs = await adapter.listCollection(dirPath);
      const fileNames = fileRefs.map(r => r.name);
      let filtered: string[];
      if (type === 'plans') {
        filtered = fileNames.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
      } else if (type === 'summaries') {
        filtered = fileNames.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      } else {
        filtered = fileNames;
      }
      files.push(...filtered.sort());
    }
    return { data: { files, count: files.length, phase_dir: phase ? dirs[0]?.replace(/^\d+(?:\.\d+)*-?/, '') : null } };
  }

  return { data: { directories: dirs, count: dirs.length } };
};

export const phaseNextDecimal = async (adapter: StorageAdapter, args: string[], _projectDir: string, workstream?: string): Promise<QueryResult> => {
  const basePhase = args[0];
  if (!basePhase) {
    throw new GSDError('base phase number required', ErrorClassification.Validation);
  }
  assertNoNullBytes(basePhase, 'basePhase');

  const phasesRel = planningRelativePath(workstream, 'phases');
  const roadmapRel = planningRelativePath(workstream, 'ROADMAP.md');
  const normalized = normalizePhaseName(basePhase);
  const decimalSet = new Set<number>();
  let baseExists = false;

  if (await adapter.exists(phasesRel)) {
    const phaseRefs = await adapter.listCollection(phasesRel);
    const dirChecks = await Promise.all(
      phaseRefs.map(async r => ({ ref: r, isDir: (await adapter.stat(r.path))?.kind === 'dir' })),
    );
    const dirNames = dirChecks.filter(c => c.isDir).map(c => c.ref.name);
    baseExists = dirNames.some(d => phaseTokenMatches(d, normalized));

    const dirPattern = new RegExp(`^(?:[A-Z]{1,6}-)?${escapeRegex(normalized)}\\.(\\d+)`);
    for (const dir of dirNames) {
      const match = dir.match(dirPattern);
      if (match) decimalSet.add(parseInt(match[1], 10));
    }
  }

  const roadmapContent = await adapter.getRecord(roadmapRel);
  if (roadmapContent !== null) {
    const phasePattern = new RegExp(
      `#{2,4}\\s*Phase\\s+0*${escapeRegex(normalized)}\\.(\\d+)\\s*:`, 'gi',
    );
    let pm;
    while ((pm = phasePattern.exec(roadmapContent)) !== null) {
      decimalSet.add(parseInt(pm[1], 10));
    }
  }

  const existingDecimals = Array.from(decimalSet)
    .sort((a, b) => a - b)
    .map(n => `${normalized}.${n}`);

  const nextDecimal = decimalSet.size === 0
    ? `${normalized}.1`
    : `${normalized}.${Math.max(...decimalSet) + 1}`;

  return {
    data: {
      found: baseExists,
      base_phase: normalized,
      next: nextDecimal,
      existing: existingDecimals,
    },
  };
};

export const phasesArchive = async (adapter: StorageAdapter, args: string[], _projectDir: string, workstream?: string): Promise<QueryResult> => {
  const version = args[0];
  if (!version) {
    throw new GSDError('version required for phases archive', ErrorClassification.Validation);
  }
  assertNoNullBytes(version, 'version');

  const isDirInMilestone = await getMilestonePhaseFilter(adapter, workstream);
  const phasesPath = planningRelativePath(workstream, 'phases');
  const archivePrefix = `milestones/${version}-phases`;

  let archivedCount = 0;
  if (await adapter.exists(phasesPath)) {
    const entries = await adapter.listCollection(phasesPath);

    await adapter.withTransaction(async () => {
      for (const entry of entries) {
        if (!isDirInMilestone(entry.name)) continue;
        await archivePhaseDir(adapter, workstream, entry.name, archivePrefix);
        archivedCount++;
      }
    });
  }

  return {
    data: {
      archived: archivedCount,
      version,
      archive_directory: toPosixPath(planningRelativePath(workstream, archivePrefix)),
    },
  };
};

// ─── milestoneComplete ────────────────────────────────────────────────────

/** Port of `parseMultiwordArg` in `gsd-tools.cjs`. */
function parseMultiwordArg(args: string[], flag: string): string | null {
  const idx = args.indexOf(`--${flag}`);
  if (idx === -1) return null;
  const tokens: string[] = [];
  for (let i = idx + 1; i < args.length; i++) {
    if (args[i]!.startsWith('--')) break;
    tokens.push(args[i]!);
  }
  return tokens.length > 0 ? tokens.join(' ') : null;
}

/** Port of `extractOneLinerFromBody` from `core.cjs` / `summary.ts`. */
function extractOneLinerFromBody(content: string): string | null {
  if (!content) return null;
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, '');
  const match = body.match(/^#[^\n]*\n+\*\*([^*]+)\*\*/m);
  return match ? match[1]!.trim() : null;
}

/**
 * Query handler for `milestone.complete`.
 *
 * Marks a milestone complete — archives ROADMAP/REQUIREMENTS, creates MILESTONES.md entry,
 * updates STATE.md, optionally archives phase directories. All via adapter.
 */
export const milestoneComplete: QueryHandler = async (args, projectDir, workstream) => {
  const version = args[0];
  if (!version) {
    throw new GSDError('version required for milestone complete (e.g., v1.0)', ErrorClassification.Validation);
  }
  assertNoNullBytes(version, 'version');

  const nameOpt = parseMultiwordArg(args, 'name');
  const archivePhasesFlag = args.includes('--archive-phases');
  const adapter = await adapterFor(projectDir);
  const today = new Date().toISOString().split('T')[0]!;
  const milestoneName = nameOpt || version;

  const isDirInMilestone = await getMilestonePhaseFilter(adapter, workstream);
  const phasesPath = planningRelativePath(workstream, 'phases');

  let phaseCount = 0;
  let totalPlans = 0;
  let totalTasks = 0;
  const accomplishments: string[] = [];

  // Gather phase statistics via adapter
  try {
    const entries = await adapter.listCollection(phasesPath);
    const dirs = entries.map(e => e.name).sort();

    for (const dir of dirs) {
      if (!isDirInMilestone(dir)) continue;
      phaseCount++;

      const dirPath = `${phasesPath}/${dir}`;
      const phaseFiles = await adapter.listCollection(dirPath);
      const fileNames = phaseFiles.map(f => f.name);
      const plans = fileNames.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
      const summaryFiles = fileNames.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      totalPlans += plans.length;

      for (const s of summaryFiles) {
        const content = await adapter.getRecord(`${dirPath}/${s}`);
        if (!content) continue;
        const fm = extractFrontmatter(content);
        const oneLiner =
          (fm['one-liner'] as string | undefined) || extractOneLinerFromBody(content);
        if (oneLiner) accomplishments.push(oneLiner);
        const tasksFieldMatch = content.match(/\*\*Tasks:\*\*\s*(\d+)/);
        if (tasksFieldMatch) {
          totalTasks += parseInt(tasksFieldMatch[1]!, 10);
        } else {
          const xmlTaskMatches = content.match(/<task[\s>]/gi) || [];
          const mdTaskMatches = content.match(/##\s*Task\s*\d+/gi) || [];
          totalTasks += xmlTaskMatches.length || mdTaskMatches.length;
        }
      }
    }
  } catch { /* intentionally empty */ }

  await adapter.withTransaction(async () => {
    // Archive ROADMAP.md
    const roadmapPath = planningRelativePath(workstream, 'ROADMAP.md');
    const roadmapContent = await adapter.getRecord(roadmapPath);
    if (roadmapContent !== null) {
      await adapter.putRecord(
        planningRelativePath(workstream, `milestones/${version}-ROADMAP.md`),
        roadmapContent,
      );
    }

    // Archive REQUIREMENTS.md
    const reqPath = planningRelativePath(workstream, 'REQUIREMENTS.md');
    const reqContent = await adapter.getRecord(reqPath);
    if (reqContent !== null) {
      const archiveHeader =
        `# Requirements Archive: ${version} ${milestoneName}\n\n` +
        `**Archived:** ${today}\n**Status:** SHIPPED\n\n` +
        `For current requirements, see \`.planning/REQUIREMENTS.md\`.\n\n---\n\n`;
      await adapter.putRecord(
        planningRelativePath(workstream, `milestones/${version}-REQUIREMENTS.md`),
        archiveHeader + reqContent,
      );
    }

    // Move audit file if exists
    const auditPath = planningRelativePath(workstream, `${version}-MILESTONE-AUDIT.md`);
    const auditContent = await adapter.getRecord(auditPath);
    if (auditContent !== null) {
      await adapter.putRecord(
        planningRelativePath(workstream, `milestones/${version}-MILESTONE-AUDIT.md`),
        auditContent,
      );
      await adapter.removeRecord(auditPath);
    }

    // Update/create MILESTONES.md
    const accomplishmentsList = accomplishments.map((a) => `- ${a}`).join('\n');
    const milestoneEntry =
      `## ${version} ${milestoneName} (Shipped: ${today})\n\n` +
      `**Phases completed:** ${phaseCount} phases, ${totalPlans} plans, ${totalTasks} tasks\n\n` +
      `**Key accomplishments:**\n${accomplishmentsList || '- (none recorded)'}\n\n---\n\n`;

    const milestonesPath = planningRelativePath(workstream, 'MILESTONES.md');
    const existing = await adapter.getRecord(milestonesPath);
    if (existing === null || !existing.trim()) {
      await adapter.putRecord(milestonesPath, normalizeMd(`# Milestones\n\n${milestoneEntry}`));
    } else {
      const headerMatch = existing.match(/^(#{1,3}\s+[^\n]*\n\n?)/);
      if (headerMatch) {
        const header = headerMatch[1]!;
        const rest = existing.slice(header.length);
        await adapter.putRecord(milestonesPath, normalizeMd(header + milestoneEntry + rest));
      } else {
        await adapter.putRecord(milestonesPath, normalizeMd(milestoneEntry + existing));
      }
    }

    // Update STATE.md
    await readModifyWriteState(adapter, workstream, (body) => {
      let next = stateReplaceFieldWithFallback(body, 'Status', null, `${version} milestone complete`);
      next = stateReplaceFieldWithFallback(next, 'Last Activity', 'Last activity', today);
      next = stateReplaceFieldWithFallback(next, 'Last Activity Description', null, `${version} milestone completed and archived`);

      const positionPattern = /(##\s*Current Position\s*\n)([\s\S]*?)(?=\n##|$)/i;
      const closedPositionBody =
        `\nPhase: Milestone ${version} complete\n` +
        `Plan: —\n` +
        `Status: Awaiting next milestone\n` +
        `Last activity: ${today} — Milestone ${version} completed and archived\n\n`;
      if (positionPattern.test(next)) {
        next = next.replace(positionPattern, (_m, header) => `${header}${closedPositionBody}`);
      } else {
        next = `${next.trimEnd()}\n\n## Current Position\n${closedPositionBody}`;
      }

      const operatorPattern = /(##\s*Operator Next Steps\s*\n)([\s\S]*?)(?=\n##|$)/i;
      if (operatorPattern.test(next)) {
        next = next.replace(operatorPattern, `$1\n- Start the next milestone with /gsd-new-milestone\n\n`);
      } else {
        next = `${next.trimEnd()}\n\n## Operator Next Steps\n\n- Start the next milestone with /gsd-new-milestone\n`;
      }

      return next;
    }, projectDir);

    // Archive phase directories if requested
    if (archivePhasesFlag) {
      const archivePrefix = `milestones/${version}-phases`;
      const entries = await adapter.listCollection(phasesPath);
      for (const entry of entries) {
        if (!isDirInMilestone(entry.name)) continue;
        await archivePhaseDir(adapter, workstream, entry.name, archivePrefix);
      }
    }
  });

  // Check what was actually archived
  const roadmapArchived = (await adapter.exists(planningRelativePath(workstream, `milestones/${version}-ROADMAP.md`)));
  const reqArchived = (await adapter.exists(planningRelativePath(workstream, `milestones/${version}-REQUIREMENTS.md`)));
  const auditArchived = (await adapter.exists(planningRelativePath(workstream, `milestones/${version}-MILESTONE-AUDIT.md`)));

  return {
    data: {
      version,
      name: milestoneName,
      date: today,
      phases: phaseCount,
      plans: totalPlans,
      tasks: totalTasks,
      accomplishments,
      archived: {
        roadmap: roadmapArchived,
        requirements: reqArchived,
        audit: auditArchived,
        phases: archivePhasesFlag,
      },
      milestones_updated: true,
      state_updated: true,
    },
  };
};
