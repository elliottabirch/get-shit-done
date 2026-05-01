/**
 * Phase readiness snapshot (`check.phase-ready`).
 *
 * Deterministic file + plan/summary counts and a suggested `next_step` for orchestration.
 * See `.planning/research/decision-routing-audit.md` §3.4.
 *
 * Phase 2 Plan 02-02 Task 1 (D-12, D-10): adapter-as-first-arg signature;
 * fs reads (readFile, existsSync, readdirSync) routed through adapter.
 */

import { GSDError, ErrorClassification } from '../errors.js';
import {
  comparePhaseNum,
  escapeRegex,
  normalizePhaseName,
  planningRelativePath,
} from './helpers.js';
import { findPhase } from './phase.js';
import { roadmapAnalyze } from './roadmap.js';
import type { QueryResult } from './utils.js';
import type { StorageAdapter } from '../../../adapters/types.js';

const UI_INDICATOR_RE = /UI|interface|frontend|component|layout|page|screen|view|form|dashboard|widget/i;

/**
 * True if ROADMAP phase heading line for this phase matches UI_INDICATOR_RE.
 */
async function roadmapPhaseLineHasUiIndicators(
  adapter: StorageAdapter,
  phaseNum: string,
  workstream?: string,
): Promise<boolean> {
  const content = await adapter.getRecord(planningRelativePath(workstream, 'ROADMAP.md'));
  if (content === null) return false;
  const re = new RegExp(
    `#{2,4}\\s*Phase\\s+${escapeRegex(phaseNum)}\\s*:[^\\n]*`,
    'i',
  );
  const m = content.match(re);
  if (!m) return false;
  return UI_INDICATOR_RE.test(m[0]);
}

/**
 * Check whether a phase directory contains a UI-SPEC.md file.
 *
 * @param adapter - Storage adapter (Phase 2 D-10)
 * @param phaseAdapterRel - Adapter-relative phase directory (e.g. 'phases/03-foo' or
 *                          'workstreams/<ws>/phases/03-foo'; not the display-relative
 *                          `.planning/phases/...` path returned by findPhase).
 */
async function hasUiSpecFile(adapter: StorageAdapter, phaseAdapterRel: string): Promise<boolean> {
  // Pitfall 3: listCollection returns [] on ENOENT
  const refs = await adapter.listCollection(phaseAdapterRel);
  if (refs.length === 0) return false;
  return refs.some(r => r.name === 'UI-SPEC.md' || r.name.endsWith('-UI-SPEC.md'));
}

/**
 * Whether all roadmap phases strictly before `phaseNum` are complete on disk / roadmap.
 */
function dependenciesMet(
  phases: Array<Record<string, unknown>>,
  phaseNum: string,
): boolean {
  const sorted = [...phases].sort((a, b) =>
    comparePhaseNum(String(a.number), String(b.number)),
  );
  const idx = sorted.findIndex(p => normalizePhaseName(String(p.number)) === normalizePhaseName(phaseNum));
  if (idx <= 0) return true;
  for (let i = 0; i < idx; i++) {
    const p = sorted[i];
    const complete =
      p.roadmap_complete === true ||
      p.disk_status === 'complete';
    if (!complete) return false;
  }
  return true;
}

type NextStep = 'discuss' | 'plan' | 'execute' | 'verify' | 'complete';

function inferNextStep(params: {
  found: boolean;
  has_context: boolean;
  has_research: boolean;
  plan_count: number;
  incomplete_plans: string[];
  has_verification: boolean;
}): NextStep {
  if (!params.found) return 'discuss';
  if (!params.has_context && !params.has_research) return 'discuss';
  if (params.plan_count === 0) return 'plan';
  if (params.incomplete_plans.length > 0) return 'execute';
  if (!params.has_verification) return 'verify';
  return 'complete';
}

/**
 * Strip leading `.planning/` segment from a directory string returned by findPhase
 * (which formats them as `.planning/phases/<dir>` or `.planning/milestones/<v>/<dir>`)
 * to get an adapter-resolvable path. Adapter is rooted at `.planning/`.
 */
function toAdapterDir(planningRelDir: string): string {
  if (planningRelDir.startsWith('.planning/')) {
    return planningRelDir.slice('.planning/'.length);
  }
  return planningRelDir;
}

export const checkPhaseReady = async (
  adapter: StorageAdapter,
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> => {
  const raw = args[0];
  if (!raw) {
    throw new GSDError('phase number required for check phase-ready', ErrorClassification.Validation);
  }
  const phaseArg = normalizePhaseName(raw);

  const phaseRes = await findPhase(adapter, [raw], projectDir, workstream);
  const pdata = phaseRes.data as Record<string, unknown>;
  const found = Boolean(pdata.found);

  const planCount = (pdata.plans as string[] | undefined)?.length ?? 0;
  const incomplete = (pdata.incomplete_plans as string[] | undefined) ?? [];
  const has_context = Boolean(pdata.has_context);
  const has_research = Boolean(pdata.has_research);
  const has_verification = Boolean(pdata.has_verification);

  let has_ui_spec = false;
  if (found && pdata.directory) {
    has_ui_spec = await hasUiSpecFile(adapter, toAdapterDir(pdata.directory as string));
  }

  const phaseNumForRoadmap = (pdata.phase_number as string) || phaseArg;
  const has_ui_indicators =
    (await roadmapPhaseLineHasUiIndicators(adapter, phaseNumForRoadmap, workstream)) ||
    (phaseNumForRoadmap !== phaseArg ? await roadmapPhaseLineHasUiIndicators(adapter, phaseArg, workstream) : false);

  const analysis = await roadmapAnalyze(adapter, [], projectDir, workstream);
  const adata = analysis.data as { phases?: Array<Record<string, unknown>> };
  const phases = adata.phases ?? [];
  const deps = dependenciesMet(phases, phaseArg);

  const next_step = inferNextStep({
    found,
    has_context,
    has_research,
    plan_count: planCount,
    incomplete_plans: incomplete,
    has_verification,
  });

  /** Phase exists on disk and prior roadmap phases are complete — safe to focus on `next_step`. */
  const ready = found && deps;

  return {
    data: {
      found,
      ready,
      phase: phaseArg,
      phase_name: (pdata.phase_name as string) ?? null,
      phase_dir: (pdata.directory as string) ?? null,
      has_context,
      has_research,
      has_plans: planCount > 0,
      plan_count: planCount,
      incomplete_plans: incomplete.length,
      has_verification,
      has_ui_spec,
      has_ui_indicators,
      dependencies_met: deps,
      blockers: [] as string[],
      next_step,
    },
  };
};
