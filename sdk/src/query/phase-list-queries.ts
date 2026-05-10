/**
 * Handlers: phase.list-plans, phase.list-artifacts — deterministic plan/artifact listing
 * for agents (replaces shell `ls` / `find` patterns). SDK-only; no gsd-tools.cjs mirror.
 */

import { GSDError, ErrorClassification } from '../errors.js';
import { extractFrontmatter } from './frontmatter.js';
import {
  normalizePhaseName,
  comparePhaseNum,
  phaseTokenMatches,
  toPosixPath,
  adapterFor,
  planningRelativePath,
} from './helpers.js';
import type { StorageAdapter } from '../../../adapters/types.js';
import type { QueryHandler } from './utils.js';

/** Resolve adapter-relative path for a phase token, or null. */
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

type ArtifactType = 'context' | 'summary' | 'verification' | 'research';

/**
 * phase.list-artifacts — list CONTEXT / SUMMARY / VERIFICATION / RESEARCH files in a phase directory.
 *
 * Args: `<phase>` `--type` `<context|summary|verification|research>`
 */
export const phaseListArtifacts: QueryHandler = async (args, projectDir, workstream) => {
  if (!args[0]) {
    throw new GSDError('phase required', ErrorClassification.Validation);
  }
  const typeIdx = args.indexOf('--type');
  if (typeIdx === -1 || !args[typeIdx + 1]) {
    throw new GSDError('--type context|summary|verification|research required', ErrorClassification.Validation);
  }
  const phase = args[0];
  const rawType = args[typeIdx + 1].toLowerCase();
  const allowed: ArtifactType[] = ['context', 'summary', 'verification', 'research'];
  if (!allowed.includes(rawType as ArtifactType)) {
    throw new GSDError(`invalid --type ${rawType}`, ErrorClassification.Validation);
  }
  const artifactType = rawType as ArtifactType;

  const adapter = await adapterFor(projectDir);
  const phaseDirRel = await resolvePhaseDirRel(phase, adapter, workstream);
  if (!phaseDirRel) {
    return { data: { phase: normalizePhaseName(phase), type: artifactType, artifacts: [], error: 'Phase not found' } };
  }

  const innerRefs = await adapter.listCollection(phaseDirRel);
  const files = innerRefs.map(r => r.name);
  const baseNames = files.filter((f) => {
    if (artifactType === 'context') {
      return f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md';
    }
    if (artifactType === 'summary') {
      return f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md';
    }
    if (artifactType === 'verification') {
      return f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md';
    }
    return f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md';
  });

  const artifacts = baseNames.sort().map((f) =>
    toPosixPath(`${phaseDirRel}/${f}`),
  );

  return {
    data: {
      phase: normalizePhaseName(phase),
      type: artifactType,
      artifacts,
    },
  };
};

/**
 * phase.list-plans — list PLAN files in a phase with optional frontmatter key filter.
 *
 * Args: `<phase>` [`--with-schema` `<yamlKey>`]
 */
export const phaseListPlans: QueryHandler = async (args, projectDir, workstream) => {
  if (!args[0]) {
    throw new GSDError('phase required', ErrorClassification.Validation);
  }
  let schemaKey: string | null = null;
  const wsIdx = args.indexOf('--with-schema');
  if (wsIdx !== -1) {
    schemaKey = args[wsIdx + 1] ?? null;
    if (!schemaKey) {
      throw new GSDError('--with-schema requires a field name', ErrorClassification.Validation);
    }
  }

  const phase = args[0];
  const normalized = normalizePhaseName(phase);
  const adapter = await adapterFor(projectDir);
  const phaseDirRel = await resolvePhaseDirRel(phase, adapter, workstream);
  if (!phaseDirRel) {
    return {
      data: {
        phase: normalized,
        plans: [] as Array<Record<string, unknown>>,
        error: 'Phase not found',
      },
    };
  }

  const innerRefs = await adapter.listCollection(phaseDirRel);
  const phaseFiles = innerRefs.map(r => r.name);
  const planFiles = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();

  const plans: Array<Record<string, unknown>> = [];
  for (const planFile of planFiles) {
    const planId = planFile.replace('-PLAN.md', '').replace('PLAN.md', '');
    const content = await adapter.getRecord(`${phaseDirRel}/${planFile}`);
    if (!content) continue;
    const fm = extractFrontmatter(content) as Record<string, unknown>;

    if (schemaKey && !(schemaKey in fm)) {
      continue;
    }

    plans.push({
      id: planId,
      file: toPosixPath(planFile),
      wave: parseInt(String(fm.wave ?? '1'), 10) || 1,
      autonomous: fm.autonomous !== false && fm.autonomous !== 'false',
      frontmatter_keys: Object.keys(fm).sort(),
    });
  }

  return {
    data: {
      phase: normalized,
      with_schema: schemaKey,
      plans,
    },
  };
};
