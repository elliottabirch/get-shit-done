/**
 * Phase finding and plan index query handlers.
 *
 * Ported from get-shit-done/bin/lib/phase.cjs and core.cjs.
 * Provides find-phase (directory lookup with archived fallback)
 * and phase-plan-index (plan metadata with wave grouping).
 *
 * Phase 2 Plan 02-02 Task 1 (D-12, D-10): adapter-as-first-arg signature;
 * fs reads (readdir / readFile) routed through `adapter.listCollection` /
 * `adapter.getRecord` per the Migration Recipe (Plan 02-01 exemplar).
 *
 * @example
 * ```typescript
 * import { findPhase, phasePlanIndex } from './phase.js';
 *
 * const found = await findPhase(adapter, ['9'], '/project');
 * // { data: { found: true, directory: '.planning/phases/09-foundation', ... } }
 *
 * const index = await phasePlanIndex(adapter, ['9'], '/project');
 * // { data: { phase: '09', plans: [...], waves: { '1': [...] }, ... } }
 * ```
 */

import { GSDError, ErrorClassification } from '../errors.js';
import { extractFrontmatter } from './frontmatter.js';
import {
  normalizePhaseName,
  comparePhaseNum,
  phaseTokenMatches,
  toPosixPath,
  planningRelativePath,
} from './helpers.js';
import { relPlanningPath } from '../workstream-utils.js';
import type { QueryResult } from './utils.js';
import type { StorageAdapter } from '../../../adapters/types.js';

// ─── Types ─────────────────────────────────────────────────────────────────

interface PhaseInfo {
  found: boolean;
  directory: string | null;
  phase_number: string | null;
  phase_name: string | null;
  phase_slug: string | null;
  plans: string[];
  summaries: string[];
  incomplete_plans: string[];
  has_research: boolean;
  has_context: boolean;
  has_verification: boolean;
  has_reviews: boolean;
  archived?: string;
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Get file stats for a phase directory.
 *
 * Port of getPhaseFileStats from core.cjs lines 1461-1471.
 *
 * @param adapter - Storage adapter (Phase 2 D-10)
 * @param phaseRel - Adapter-relative phase directory path (e.g. 'phases/09-foundation')
 */
async function getPhaseFileStats(
  adapter: StorageAdapter,
  phaseRel: string,
): Promise<{
  plans: string[];
  summaries: string[];
  hasResearch: boolean;
  hasContext: boolean;
  hasVerification: boolean;
  hasReviews: boolean;
}> {
  // Pitfall 3: listCollection returns [] on ENOENT, no need for redundant exists check
  const refs = await adapter.listCollection(phaseRel);
  const files = refs.map(r => r.name);
  return {
    plans: files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md'),
    summaries: files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md'),
    hasResearch: files.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md'),
    hasContext: files.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md'),
    hasVerification: files.some(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md'),
    hasReviews: files.some(f => f.endsWith('-REVIEWS.md') || f === 'REVIEWS.md'),
  };
}

/**
 * Search for a phase directory matching the normalized name.
 *
 * Port of searchPhaseInDir from core.cjs lines 956-1000.
 *
 * @param adapter - Storage adapter
 * @param baseRel - Adapter-relative base directory (e.g. 'phases' or 'milestones/v1.0-phases')
 * @param relBase - Display-relative base prefix (e.g. '.planning/phases') for the returned directory string
 * @param normalized - Normalized phase identifier
 */
async function searchPhaseInDir(
  adapter: StorageAdapter,
  baseRel: string,
  relBase: string,
  normalized: string,
): Promise<PhaseInfo | null> {
  // Pitfall 3: listCollection returns [] on ENOENT, no need for redundant exists check
  const refs = await adapter.listCollection(baseRel);
  if (refs.length === 0) return null;

  // We need only directories — probe via stat. Run in parallel (Pitfall 2).
  const dirChecks = await Promise.all(
    refs.map(async r => ({
      ref: r,
      isDir: ((await adapter.stat(r.path))?.kind === 'dir'),
    })),
  );
  const dirs = dirChecks
    .filter(c => c.isDir)
    .map(c => c.ref.name)
    .sort((a, b) => comparePhaseNum(a, b));

  const match = dirs.find(d => phaseTokenMatches(d, normalized));
  if (!match) return null;

  // Extract phase number and name
  const dirMatch = match.match(/^(?:[A-Z]{1,6}-)(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i)
    || match.match(/^(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i)
    || match.match(/^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)-(.+)/i)
    || [null, match, null];
  const phaseNumber = dirMatch ? dirMatch[1] : normalized;
  const phaseName = dirMatch && dirMatch[2] ? dirMatch[2] : null;
  const phaseRel = `${baseRel}/${match}`;

  const { plans: unsortedPlans, summaries: unsortedSummaries, hasResearch, hasContext, hasVerification, hasReviews } = await getPhaseFileStats(adapter, phaseRel);
  const plans = unsortedPlans.sort();
  const summaries = unsortedSummaries.sort();

  const completedPlanIds = new Set(
    summaries.map(s => s.replace('-SUMMARY.md', '').replace('SUMMARY.md', ''))
  );
  const incompletePlans = plans.filter(p => {
    const planId = p.replace('-PLAN.md', '').replace('PLAN.md', '');
    return !completedPlanIds.has(planId);
  });

  return {
    found: true,
    directory: toPosixPath(`${relBase}/${match}`),
    phase_number: phaseNumber,
    phase_name: phaseName,
    phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
    plans,
    summaries,
    incomplete_plans: incompletePlans,
    has_research: hasResearch,
    has_context: hasContext,
    has_verification: hasVerification,
    has_reviews: hasReviews,
  };
}

/**
 * Extract objective text from plan content.
 */
function extractObjective(content: string): string | null {
  const m = content.match(/<objective>\s*\n?\s*(.+)/);
  return m ? m[1].trim() : null;
}

// ─── Exported handlers ─────────────────────────────────────────────────────

/**
 * Query handler for find-phase.
 *
 * Locates a phase directory by number/identifier, searching current phases
 * first, then archived milestone phases.
 *
 * Port of cmdFindPhase from phase.cjs lines 152-196, combined with
 * findPhaseInternal from core.cjs lines 1002-1038.
 *
 * @param adapter - Storage adapter (Phase 2 D-10)
 * @param args - args[0] is the phase identifier (required)
 * @param projectDir - Project root directory (kept for signature compatibility; unused now)
 * @param workstream - Optional workstream name
 * @returns QueryResult with PhaseInfo
 * @throws GSDError with Validation classification if phase identifier missing
 */
export const findPhase = async (
  adapter: StorageAdapter,
  args: string[],
  _projectDir: string,
  workstream?: string,
): Promise<QueryResult> => {
  const phase = args[0];
  if (!phase) {
    throw new GSDError('phase identifier required', ErrorClassification.Validation);
  }

  const normalized = normalizePhaseName(phase);

  const notFound: PhaseInfo = {
    found: false,
    directory: null,
    phase_number: null,
    phase_name: null,
    phase_slug: null,
    plans: [],
    summaries: [],
    incomplete_plans: [],
    has_research: false,
    has_context: false,
    has_verification: false,
    has_reviews: false,
  };

  // Search current phases first.
  // Adapter is rooted at .planning/, so adapter-relative path is workstream-aware
  // ('phases' for root or 'workstreams/<ws>/phases' for workstream).
  const phasesAdapterRel = planningRelativePath(workstream, 'phases');
  // The display-relative base used in the returned `directory` field includes the
  // .planning/[workstream/] prefix to match pre-migration output.
  const phasesDisplayRel = `${relPlanningPath(workstream)}/phases`;
  const current = await searchPhaseInDir(adapter, phasesAdapterRel, phasesDisplayRel, normalized);
  if (current) return { data: current };

  // Search archived milestone phases (newest first).
  // milestones/ lives at the .planning/ root regardless of workstream — archived
  // milestones are global (matches pre-migration behavior using join(projectDir, '.planning', 'milestones')).
  const milestonesAdapterRel = 'milestones';
  // Pitfall 3: listCollection returns [] on ENOENT
  const milestoneRefs = await adapter.listCollection(milestonesAdapterRel);
  // We need only directories matching v<...>-phases — stat in parallel (Pitfall 2)
  const milestoneDirChecks = await Promise.all(
    milestoneRefs
      .filter(r => /^v[\d.]+-phases$/.test(r.name))
      .map(async r => ({
        ref: r,
        isDir: ((await adapter.stat(r.path))?.kind === 'dir'),
      })),
  );
  const archiveDirs = milestoneDirChecks
    .filter(c => c.isDir)
    .map(c => c.ref.name)
    .sort()
    .reverse();

  for (const archiveName of archiveDirs) {
    const versionMatch = archiveName.match(/^(v[\d.]+)-phases$/);
    const version = versionMatch ? versionMatch[1] : archiveName;
    const archiveAdapterRel = `${milestonesAdapterRel}/${archiveName}`;
    const archiveDisplayRel = '.planning/milestones/' + archiveName;
    const result = await searchPhaseInDir(adapter, archiveAdapterRel, archiveDisplayRel, normalized);
    if (result) {
      result.archived = version;
      return { data: result };
    }
  }

  return { data: notFound };
};

/**
 * Query handler for phase-plan-index.
 *
 * Returns plan metadata with wave grouping for a specific phase.
 *
 * Port of cmdPhasePlanIndex from phase.cjs lines 203-310.
 *
 * @param adapter - Storage adapter (Phase 2 D-10)
 * @param args - args[0] is the phase identifier (required)
 * @param projectDir - Project root directory (kept for signature compatibility; unused now)
 * @param workstream - Optional workstream name
 * @returns QueryResult with { phase, plans[], waves{}, incomplete[], has_checkpoints }
 * @throws GSDError with Validation classification if phase identifier missing
 */
export const phasePlanIndex = async (
  adapter: StorageAdapter,
  args: string[],
  _projectDir: string,
  workstream?: string,
): Promise<QueryResult> => {
  const phase = args[0];
  if (!phase) {
    throw new GSDError('phase required for phase-plan-index', ErrorClassification.Validation);
  }

  const normalized = normalizePhaseName(phase);
  const phasesAdapterRel = planningRelativePath(workstream, 'phases');

  // Find phase directory.
  // Pitfall 3: listCollection returns [] on ENOENT
  const refs = await adapter.listCollection(phasesAdapterRel);
  const dirChecks = await Promise.all(
    refs.map(async r => ({
      ref: r,
      isDir: ((await adapter.stat(r.path))?.kind === 'dir'),
    })),
  );
  const dirs = dirChecks
    .filter(c => c.isDir)
    .map(c => c.ref.name)
    .sort((a, b) => comparePhaseNum(a, b));
  const match = dirs.find(d => phaseTokenMatches(d, normalized));

  let phaseAdapterRel: string | null = null;
  if (match) {
    phaseAdapterRel = `${phasesAdapterRel}/${match}`;
  }

  if (!phaseAdapterRel) {
    return {
      data: {
        phase: normalized,
        error: 'Phase not found',
        plans: [],
        waves: {},
        incomplete: [],
        has_checkpoints: false,
      },
    };
  }

  // Get all files in phase directory
  const phaseRefs = await adapter.listCollection(phaseAdapterRel);
  const phaseFiles = phaseRefs.map(r => r.name);
  const planFiles = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();
  const summaryFiles = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');

  // Build set of plan IDs with summaries — match the planId derivation logic
  const completedPlanIds = new Set(
    summaryFiles.map(s => s === 'SUMMARY.md' ? 'PLAN' : s.replace('-SUMMARY.md', ''))
  );

  const plans: Array<Record<string, unknown>> = [];
  const waves: Record<string, string[]> = {};
  const incomplete: string[] = [];
  let hasCheckpoints = false;

  // Read plan contents in parallel (Pitfall 2)
  const planContents = await Promise.all(
    planFiles.map(async planFile => ({
      planFile,
      content: (await adapter.getRecord(`${phaseAdapterRel}/${planFile}`)) ?? '',
    })),
  );

  for (const { planFile, content } of planContents) {
    // For named plans (01-01-PLAN.md): strip suffix to get '01-01'
    // For bare PLAN.md: use the filename itself as the ID
    const planId = planFile === 'PLAN.md' ? 'PLAN' : planFile.replace('-PLAN.md', '');
    const fm = extractFrontmatter(content);

    // Count tasks: XML <task> tags (canonical) or ## Task N markdown (legacy)
    const xmlTasks = content.match(/<task[\s>]/gi) || [];
    const mdTasks = content.match(/##\s*Task\s*\d+/gi) || [];
    const taskCount = xmlTasks.length || mdTasks.length;

    // Parse wave as integer
    const wave = parseInt(String(fm.wave), 10) || 1;

    // Parse autonomous (default true if not specified)
    let autonomous = true;
    if (fm.autonomous !== undefined) {
      autonomous = fm.autonomous === 'true' || fm.autonomous === true;
    }

    if (!autonomous) {
      hasCheckpoints = true;
    }

    // Parse files_modified
    let filesModified: string[] = [];
    const fmFiles = (fm['files_modified'] || fm['files-modified']) as string | string[] | undefined;
    if (fmFiles) {
      filesModified = Array.isArray(fmFiles) ? fmFiles : [fmFiles];
    }

    const hasSummary = completedPlanIds.has(planId);
    if (!hasSummary) {
      incomplete.push(planId);
    }

    const plan = {
      id: planId,
      wave,
      autonomous,
      objective: extractObjective(content) || (fm.objective as string) || null,
      files_modified: filesModified,
      task_count: taskCount,
      has_summary: hasSummary,
    };

    plans.push(plan);

    // Group by wave
    const waveKey = String(wave);
    if (!waves[waveKey]) {
      waves[waveKey] = [];
    }
    waves[waveKey].push(planId);
  }

  return {
    data: {
      phase: normalized,
      plans,
      waves,
      incomplete,
      has_checkpoints: hasCheckpoints,
    },
  };
};
