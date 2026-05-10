/**
 * requirements.extract-from-plans — aggregate `requirements` frontmatter across all plans in a phase.
 */

import { GSDError, ErrorClassification } from '../errors.js';
import { extractFrontmatter } from './frontmatter.js';
import {
  normalizePhaseName,
  comparePhaseNum,
  phaseTokenMatches,
  adapterFor,
  planningRelativePath,
} from './helpers.js';
import type { StorageAdapter } from '../../../adapters/types.js';
import type { QueryHandler } from './utils.js';

async function resolvePhaseDirRel(phase: string, adapter: StorageAdapter, workstream?: string): Promise<string | null> {
  const phasesRel = planningRelativePath(workstream, 'phases');
  const normalized = normalizePhaseName(phase);
  try {
    const refs = await adapter.listCollection(phasesRel);
    const dirs: Array<{ name: string; path: string }> = [];
    for (const ref of refs) {
      const st = await adapter.stat(ref.path);
      if (st?.kind === 'dir') dirs.push(ref);
    }
    dirs.sort((a, b) => comparePhaseNum(a.name, b.name));
    const match = dirs.find(d => phaseTokenMatches(d.name, normalized));
    return match ? match.path : null;
  } catch {
    return null;
  }
}

function normalizeReqList(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === 'string') return [v];
  return [];
}

/**
 * Args: `<phase>`
 */
export const requirementsExtractFromPlans: QueryHandler = async (args, projectDir, workstream) => {
  const phase = args[0];
  if (!phase) {
    throw new GSDError('phase required', ErrorClassification.Validation);
  }

  const normalized = normalizePhaseName(phase);
  const adapter = await adapterFor(projectDir);
  const phaseDirRel = await resolvePhaseDirRel(phase, adapter, workstream);
  if (!phaseDirRel) {
    return {
      data: {
        phase: normalized,
        requirements: [] as string[],
        by_plan: {} as Record<string, string[]>,
        error: 'Phase not found',
      },
    };
  }

  const innerRefs = await adapter.listCollection(phaseDirRel);
  const fileNames = innerRefs.map(r => r.name);
  const planFiles = fileNames.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();
  const byPlan: Record<string, string[]> = {};
  const seen = new Set<string>();

  for (const planFile of planFiles) {
    const planId =
      planFile === 'PLAN.md' ? 'PLAN' : planFile.replace(/-PLAN\.md$/i, '').replace(/PLAN\.md$/i, '');
    const content = await adapter.getRecord(`${phaseDirRel}/${planFile}`);
    if (!content) continue;
    const fm = extractFrontmatter(content) as Record<string, unknown>;
    const list = normalizeReqList(fm.requirements);
    byPlan[planId] = list;
    for (const r of list) {
      seen.add(r);
    }
  }

  return {
    data: {
      phase: normalized,
      requirements: [...seen].sort(),
      by_plan: byPlan,
    },
  };
};
