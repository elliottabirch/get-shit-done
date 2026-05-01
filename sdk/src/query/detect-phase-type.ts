/**
 * Phase type detection (`detect.phase-type`).
 *
 * Replaces fragile grep-based UI/schema/API detection in workflows with a
 * structured query. See `.planning/research/decision-routing-audit.md` §3.6.
 *
 * Phase 2 Plan 02-02 Task 1 (D-12, D-10): adapter-as-first-arg signature;
 * fs reads (readFile, existsSync, readdirSync) routed through adapter.
 */

import { GSDError, ErrorClassification } from '../errors.js';
import { escapeRegex, normalizePhaseName, planningRelativePath } from './helpers.js';
import { findPhase } from './phase.js';
import { detectSchemaFiles } from './schema-detect.js';
import type { QueryResult } from './utils.js';
import type { StorageAdapter } from '../../../adapters/types.js';

// Copied from phase-ready.ts — do not import to avoid cross-module coupling.
const UI_INDICATOR_RE = /UI|interface|frontend|component|layout|page|screen|view|form|dashboard|widget/i;

const API_INDICATOR_RE = /route\.ts|controller\.|api\//i;
const API_HEADING_RE = /\bAPI\b|endpoint|REST|GraphQL/i;
const INFRA_RE = /docker|terraform|k8s|helm|infra/i;

async function roadmapHeadingForPhase(
  adapter: StorageAdapter,
  phaseNum: string,
  workstream?: string,
): Promise<string | null> {
  const content = await adapter.getRecord(planningRelativePath(workstream, 'ROADMAP.md'));
  if (content === null) return null;
  const re = new RegExp(`#{2,4}\\s*Phase\\s+${escapeRegex(phaseNum)}\\s*:[^\\n]*`, 'i');
  const m = content.match(re);
  return m ? m[0] : null;
}

/**
 * Strip leading `.planning/` segment from a directory string returned by findPhase
 * to produce an adapter-resolvable path. Adapter is rooted at `.planning/`.
 */
function toAdapterDir(planningRelDir: string): string {
  if (planningRelDir.startsWith('.planning/')) {
    return planningRelDir.slice('.planning/'.length);
  }
  return planningRelDir;
}

export const detectPhaseType = async (
  adapter: StorageAdapter,
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> => {
  const raw = args[0];
  if (!raw) {
    throw new GSDError('phase number required for detect phase-type', ErrorClassification.Validation);
  }
  const phaseArg = normalizePhaseName(raw);

  const phaseRes = await findPhase(adapter, [raw], projectDir, workstream);
  const pdata = phaseRes.data as Record<string, unknown>;
  const found = Boolean(pdata.found);

  // Build phase adapter-rel path when found
  let phaseAdapterRel: string | null = null;
  if (found && pdata.directory) {
    phaseAdapterRel = toAdapterDir(pdata.directory as string);
  }

  const phaseNumForRoadmap = (pdata.phase_number as string) || phaseArg;

  // Read ROADMAP heading — try both normalized forms
  let heading = await roadmapHeadingForPhase(adapter, phaseNumForRoadmap, workstream);
  if (!heading && phaseNumForRoadmap !== phaseArg) {
    heading = await roadmapHeadingForPhase(adapter, phaseArg, workstream);
  }

  // Frontend detection
  const headingUiMatch = heading ? UI_INDICATOR_RE.test(heading) : false;
  const frontendIndicators: string[] = [];

  if (heading && headingUiMatch) {
    // Collect matched keywords from heading
    const keywords = ['UI', 'interface', 'frontend', 'component', 'layout', 'page', 'screen', 'view', 'form', 'dashboard', 'widget'];
    for (const kw of keywords) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(heading)) {
        frontendIndicators.push(kw);
      }
    }
  }

  let hasUiSpecFile = false;
  let dirFiles: string[] = [];

  if (phaseAdapterRel) {
    // Pitfall 3: listCollection returns [] on ENOENT
    const refs = await adapter.listCollection(phaseAdapterRel);
    dirFiles = refs.map(r => r.name);
    hasUiSpecFile = dirFiles.some(f => f === 'UI-SPEC.md' || f.endsWith('-UI-SPEC.md'));
  }

  const has_frontend = headingUiMatch || hasUiSpecFile;

  // Schema detection — build relative paths from phase dir for detectSchemaFiles
  let schemaFiles: string[] = [];
  let schemaOrm: string | null = null;
  let hasSchema = false;

  if (phaseAdapterRel && dirFiles.length > 0) {
    // Also check subdirectory one level deep (e.g. prisma/schema.prisma).
    // Use Promise.all to parallelize the per-entry stat + sub-list (Pitfall 2).
    const subResults = await Promise.all(
      dirFiles.map(async f => {
        const subRel = `${phaseAdapterRel}/${f}`;
        const st = await adapter.stat(subRel);
        if (st === null || st.kind !== 'dir') return [] as string[];
        const subRefs = await adapter.listCollection(subRel);
        return subRefs.map(r => `${f}/${r.name}`);
      }),
    );
    const allRelPaths: string[] = [...dirFiles, ...subResults.flat()];

    const detection = detectSchemaFiles(allRelPaths);
    if (detection.detected) {
      hasSchema = true;
      schemaFiles = detection.matches;
      schemaOrm = detection.orms[0] ?? null;
    }
  }

  // API detection
  const apiFromFiles = dirFiles.some(f => API_INDICATOR_RE.test(f));
  const apiFromHeading = heading ? API_HEADING_RE.test(heading) : false;
  const has_api = apiFromFiles || apiFromHeading;

  // Infra detection
  const has_infra = dirFiles.some(f => INFRA_RE.test(f));

  return {
    data: {
      phase: phaseArg,
      has_frontend,
      frontend_indicators: frontendIndicators,
      has_schema: hasSchema,
      schema_orm: schemaOrm,
      schema_files: schemaFiles,
      push_command: null,
      has_api,
      has_infra,
    },
  };
};
