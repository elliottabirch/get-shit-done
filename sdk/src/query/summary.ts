/**
 * Summary query handlers — extract sections and history from SUMMARY.md files.
 *
 * Ported from get-shit-done/bin/lib/commands.cjs (cmdSummaryExtract, cmdHistoryDigest).
 * Uses `extractFrontmatterLeading` for parity with `frontmatter.cjs` (first `---` block only).
 *
 * Phase 2 Plan 02-03 Task 1 (D-12): document-tree reads route through the
 * StorageAdapter. historyDigest walks the milestone-archive tree and the
 * current phase tree via listCollection + stat; per-phase SUMMARY.md content
 * via getRecord. summaryExtract retains a direct readFile against a
 * user-supplied path (resolved via resolvePathUnderProject) — documented as an
 * audited exception (see inline annotation).
 *
 * @example
 *   import { summaryExtract, historyDigest } from './summary.js';
 *   await summaryExtract(adapter, ['path/to/SUMMARY.md'], '/project');
 *   await historyDigest(adapter, [], '/project');
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { extractFrontmatterLeading } from './frontmatter.js';
import { comparePhaseNum, planningRelativePath, resolvePathUnderProject } from './helpers.js';
import type { QueryResult } from './utils.js';
import type { StorageAdapter } from '../../../adapters/types.js';

// ─── extractOneLinerFromBody ────────────────────────────────────────────────

/**
 * Extract a one-liner from the summary body when it is not in frontmatter.
 * Port of `extractOneLinerFromBody` from `get-shit-done/bin/lib/core.cjs`.
 */
function extractOneLinerFromBody(content: string): string | null {
  if (!content) return null;
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, '');
  const match = body.match(/^#[^\n]*\n+\*\*([^*]+)\*\*/m);
  return match ? match[1].trim() : null;
}

/** Normalize frontmatter list fields — scalars become single-element arrays. */
function coerceFmArray(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

function parseDecisions(decisionsList: unknown): Array<{ summary: string; rationale: string | null }> {
  if (!decisionsList || !Array.isArray(decisionsList)) return [];
  return decisionsList.map((d: unknown) => {
    const s = String(d);
    const colonIdx = s.indexOf(':');
    if (colonIdx > 0) {
      return {
        summary: s.substring(0, colonIdx).trim(),
        rationale: s.substring(colonIdx + 1).trim(),
      };
    }
    return { summary: s, rationale: null };
  });
}

/**
 * List subdirectory names under a `.planning/`-relative directory via the adapter.
 * Returns sorted by phase-number when `sort=true`. Empty array on missing/empty dir.
 */
async function listAdapterSubdirectories(
  adapter: StorageAdapter,
  relDir: string,
  sort: boolean,
): Promise<string[]> {
  const refs = await adapter.listCollection(relDir);
  const dirs: string[] = [];
  for (const ref of refs) {
    const st = await adapter.stat(ref.path);
    if (st !== null && st.kind === 'dir') dirs.push(ref.name);
  }
  return sort ? dirs.sort((a, b) => comparePhaseNum(a, b)) : dirs;
}

/**
 * Match `getArchivedPhaseDirs` from core.cjs (newest milestone archive first).
 * Phase 2 Plan 02-03: walks via `adapter.listCollection` + `adapter.stat` over
 * `milestones/<v>-phases/<phase>/` (paths are .planning/-relative so the
 * adapter, rooted at the planning base, resolves them correctly).
 */
async function getArchivedPhaseDirs(
  adapter: StorageAdapter,
  workstream: string | undefined,
): Promise<Array<{ name: string; relPath: string; milestone: string }>> {
  const milestonesRel = planningRelativePath(workstream, 'milestones');
  const results: Array<{ name: string; relPath: string; milestone: string }> = [];

  const milestonesExist = await adapter.exists(milestonesRel);
  if (!milestonesExist) return results;

  const milestoneEntries = await adapter.listCollection(milestonesRel);
  const phaseArchives: Array<{ name: string; path: string }> = [];
  for (const ref of milestoneEntries) {
    if (!/^v[\d.]+-phases$/.test(ref.name)) continue;
    const st = await adapter.stat(ref.path);
    if (st !== null && st.kind === 'dir') {
      phaseArchives.push({ name: ref.name, path: ref.path });
    }
  }
  phaseArchives.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));

  for (const { name: archiveName, path: archivePath } of phaseArchives) {
    const versionMatch = archiveName.match(/^(v[\d.]+)-phases$/);
    const version = versionMatch ? versionMatch[1] : archiveName;
    const dirs = await listAdapterSubdirectories(adapter, archivePath, true);
    for (const dir of dirs) {
      results.push({
        name: dir,
        milestone: version,
        relPath: `${archivePath}/${dir}`,
      });
    }
  }

  return results;
}

export const summaryExtract = async (
  _adapter: StorageAdapter,
  args: string[],
  projectDir: string,
  _workstream?: string,
): Promise<QueryResult> => {
  const fieldsIdx = args.indexOf('--fields');
  const pathArgs = fieldsIdx === -1 ? args : args.slice(0, fieldsIdx);
  const summaryPath = pathArgs[0] ?? '';

  if (!summaryPath) {
    return { data: { error: 'summary-path required for summary-extract' } };
  }

  if (summaryPath.includes('\0')) {
    return { data: { error: 'Invalid path', path: summaryPath } };
  }

  const fields =
    fieldsIdx !== -1 && args[fieldsIdx + 1] ? args[fieldsIdx + 1].split(',').map(f => f.trim()) : null;

  // Phase 2 audited exception (D-14 + RESEARCH §"Read-Surface Inventory"):
  // summaryExtract reads a user-supplied path (resolved via resolvePathUnderProject)
  // which may be OUTSIDE .planning/. Adapter cannot resolve project-absolute paths.
  // This direct fs read is intentional. Phase 4 LEAKS-04 may add a `// leak-grep-allow line:`
  // suppression directive once the parser ships; for Phase 2 the path argument is not
  // .planning/-scoped, so leak-grep's Stage-2 filter naturally suppresses this match.
  let fullPath: string;
  try {
    fullPath = await resolvePathUnderProject(projectDir, summaryPath);
  } catch {
    return { data: { error: 'File not found', path: summaryPath } };
  }

  if (!existsSync(fullPath)) {
    return { data: { error: 'File not found', path: summaryPath } };
  }

  let content: string;
  try {
    content = await readFile(fullPath, 'utf-8');
  } catch {
    return { data: { error: 'File not found', path: summaryPath } };
  }

  const fm = extractFrontmatterLeading(content) as Record<string, unknown>;

  const techStackRaw = fm['tech-stack'] as { added?: unknown[] } | undefined;
  const techAdded = (techStackRaw && Array.isArray(techStackRaw.added) ? techStackRaw.added : []) as unknown[];

  const fullResult: Record<string, unknown> = {
    path: summaryPath,
    one_liner: (fm['one-liner'] as string | undefined) || extractOneLinerFromBody(content) || null,
    key_files: coerceFmArray(fm['key-files']),
    tech_added: techAdded,
    patterns: coerceFmArray(fm['patterns-established']),
    decisions: parseDecisions(fm['key-decisions']),
    requirements_completed: coerceFmArray(fm['requirements-completed']),
  };

  if (fields && fields.length > 0) {
    const filtered: Record<string, unknown> = { path: summaryPath };
    for (const field of fields) {
      if (fullResult[field] !== undefined) {
        filtered[field] = fullResult[field];
      }
    }
    return { data: filtered };
  }

  return { data: fullResult };
};

export const historyDigest = async (
  adapter: StorageAdapter,
  _args: string[],
  _projectDir: string,
  workstream?: string,
): Promise<QueryResult> => {
  const phasesRel = planningRelativePath(workstream, 'phases');
  const digest: {
    phases: Record<
      string,
      {
        name: string;
        provides: Set<string>;
        affects: Set<string>;
        patterns: Set<string>;
      }
    >;
    decisions: Array<{ phase: string; decision: string }>;
    tech_stack: Set<string>;
  } = { phases: {}, decisions: [], tech_stack: new Set() };

  const allPhaseDirs: Array<{ name: string; relPath: string }> = [];

  // Walk archived milestones first (newest first per archive sort).
  const archived = await getArchivedPhaseDirs(adapter, workstream);
  for (const a of archived) {
    allPhaseDirs.push({ name: a.name, relPath: a.relPath });
  }

  // Walk current phases/ (if present).
  const phasesExist = await adapter.exists(phasesRel);
  if (phasesExist) {
    const refs = await adapter.listCollection(phasesRel);
    const currentDirs: Array<{ name: string; relPath: string }> = [];
    for (const ref of refs) {
      const st = await adapter.stat(ref.path);
      if (st !== null && st.kind === 'dir') {
        currentDirs.push({ name: ref.name, relPath: ref.path });
      }
    }
    currentDirs.sort((a, b) => comparePhaseNum(a.name, b.name));
    for (const d of currentDirs) allPhaseDirs.push(d);
  }

  if (allPhaseDirs.length === 0) {
    return { data: { phases: {}, decisions: [], tech_stack: [] } };
  }

  try {
    for (const { name: dir, relPath: dirPath } of allPhaseDirs) {
      const refs = await adapter.listCollection(dirPath);
      const summaries = refs
        .map(r => r.name)
        .filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md')
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      for (const summary of summaries) {
        try {
          const content = await adapter.getRecord(`${dirPath}/${summary}`);
          if (content === null) continue;
          const fm = extractFrontmatterLeading(content) as Record<string, unknown>;

          const phaseRaw = fm.phase;
          const phaseNum =
            typeof phaseRaw === 'string' || typeof phaseRaw === 'number'
              ? String(phaseRaw)
              : dir.split('-')[0];

          if (!digest.phases[phaseNum]) {
            digest.phases[phaseNum] = {
              name:
                (typeof fm.name === 'string' ? fm.name : null) ||
                dir.split('-').slice(1).join(' ') ||
                'Unknown',
              provides: new Set(),
              affects: new Set(),
              patterns: new Set(),
            };
          }

          const depGraph = fm['dependency-graph'] as
            | { provides?: string[]; affects?: string[] }
            | undefined;
          if (depGraph && Array.isArray(depGraph.provides)) {
            depGraph.provides.forEach(p => digest.phases[phaseNum].provides.add(p));
          } else if (Array.isArray(fm.provides)) {
            (fm.provides as string[]).forEach(p => digest.phases[phaseNum].provides.add(p));
          }

          if (depGraph && Array.isArray(depGraph.affects)) {
            depGraph.affects.forEach(a => digest.phases[phaseNum].affects.add(a));
          }

          if (Array.isArray(fm['patterns-established'])) {
            (fm['patterns-established'] as string[]).forEach(p => digest.phases[phaseNum].patterns.add(p));
          }

          if (Array.isArray(fm['key-decisions'])) {
            (fm['key-decisions'] as string[]).forEach(d => {
              digest.decisions.push({ phase: phaseNum, decision: d });
            });
          }

          const techStack = fm['tech-stack'] as { added?: unknown[] } | undefined;
          if (techStack && Array.isArray(techStack.added)) {
            techStack.added.forEach(t => {
              const s = typeof t === 'string' ? t : (t as { name?: string }).name;
              if (s) digest.tech_stack.add(s);
            });
          }
        } catch {
          /* Skip malformed summaries */
        }
      }
    }

    const phasesOut: Record<
      string,
      { name: string; provides: string[]; affects: string[]; patterns: string[] }
    > = {};
    for (const p of Object.keys(digest.phases)) {
      phasesOut[p] = {
        name: digest.phases[p].name,
        provides: [...digest.phases[p].provides],
        affects: [...digest.phases[p].affects],
        patterns: [...digest.phases[p].patterns],
      };
    }

    return {
      data: {
        phases: phasesOut,
        decisions: digest.decisions,
        tech_stack: [...digest.tech_stack],
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { data: { error: `Failed to generate history digest: ${msg}` } };
  }
};
