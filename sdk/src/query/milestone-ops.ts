/**
 * Milestone operations query handlers — adapter-mediated phase archiving,
 * manifest reads, and graph storage.
 *
 * Covers cleanup (1 leak), complete-milestone (1), undo (1), graphify (3-4).
 * All paths route through StorageAdapter; no node:fs imports (D-09).
 */

import { GSDError, ErrorClassification } from '../errors.js';
import { adapterFor, planningRelativePath, normalizePhaseName } from './helpers.js';
import type { QueryResult } from './utils.js';

// ─── Path validation (T-04-03) ──────────────────────────────────────────────

function validateMilestoneName(name: string): void {
  if (!name) {
    throw new GSDError('milestone name required', ErrorClassification.Validation);
  }
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new GSDError(
      'milestone name must not contain path separators or ".."',
      ErrorClassification.Validation,
    );
  }
}

function validatePhaseDirName(dirName: string): void {
  if (!dirName) {
    throw new GSDError('phase directory name required', ErrorClassification.Validation);
  }
  if (dirName.includes('..') || dirName.startsWith('/') || dirName.includes('\\')) {
    throw new GSDError(
      'phase directory name must not contain path traversal or absolute paths',
      ErrorClassification.Validation,
    );
  }
  // Validate via normalizePhaseName to ensure it's a valid phase token
  const token = dirName.match(/^(\d+)/);
  if (!token) {
    throw new GSDError(
      `invalid phase directory name: ${dirName}`,
      ErrorClassification.Validation,
    );
  }
}

function validateGraphName(name: string): void {
  if (!name) {
    throw new GSDError('graph name required', ErrorClassification.Validation);
  }
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new GSDError(
      'graph name must not contain path separators or ".."',
      ErrorClassification.Validation,
    );
  }
}

// ─── milestoneArchivePhases ─────────────────────────────────────────────────

/**
 * Archive phase directories from phases/ to milestones/{milestone}/phases/.
 *
 * Uses adapter.withTransaction for atomicity (D-04). Moves are simulated via
 * listCollection + getRecord + putRecord + removeRecord since adapters are
 * key-value stores (no native mv).
 *
 * Args: [milestone, ...phaseDirs]
 */
export async function milestoneArchivePhases(
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [milestone, ...phaseDirs] = args;
  validateMilestoneName(milestone);

  if (phaseDirs.length === 0) {
    throw new GSDError(
      'at least one phase directory name required',
      ErrorClassification.Validation,
    );
  }

  for (const dir of phaseDirs) {
    validatePhaseDirName(dir);
  }

  const adapter = await adapterFor(projectDir);
  const archived: string[] = [];

  await adapter.withTransaction(async () => {
    for (const dir of phaseDirs) {
      const sourcePrefix = planningRelativePath(workstream ?? null, `phases/${dir}/`);
      const destPrefix = planningRelativePath(
        workstream ?? null,
        `milestones/${milestone}/phases/${dir}/`,
      );

      const records = await adapter.listCollection(sourcePrefix);
      for (const ref of records) {
        const content = await adapter.getRecord(ref.path);
        if (content !== null) {
          // Compute destination path: replace source prefix with dest prefix
          const relativePart = ref.path.slice(sourcePrefix.length);
          const destPath = destPrefix + relativePart;
          await adapter.putRecord(destPath, content);
          await adapter.removeRecord(ref.path);
        }
      }
      archived.push(dir);
    }
  });

  return { data: { archived, milestone, count: archived.length } };
}

// ─── phaseGetManifest ───────────────────────────────────────────────────────

/**
 * Read .phase-manifest.json from a phase directory.
 *
 * Args: [phaseDir]
 * Reads: phases/{phaseDir}/.phase-manifest.json
 */
export async function phaseGetManifest(
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [phaseDir] = args;
  if (!phaseDir) {
    throw new GSDError('phaseDir argument required', ErrorClassification.Validation);
  }
  validatePhaseDirName(phaseDir);

  const adapter = await adapterFor(projectDir);
  const docPath = planningRelativePath(
    workstream ?? null,
    `phases/${phaseDir}/.phase-manifest.json`,
  );
  const content = await adapter.getRecord(docPath);

  if (content === null) {
    return { data: { found: false, phaseDir, manifest: null } };
  }

  try {
    const manifest = JSON.parse(content);
    return { data: { found: true, phaseDir, manifest } };
  } catch {
    return { data: { found: true, phaseDir, manifest: content } };
  }
}

// ─── graphifyStore ──────────────────────────────────────────────────────────

/**
 * Write graph artifacts to graphs/{name}.
 *
 * Args: [name, ...body]
 * Writes to: graphs/{name}.md (or graphs/{name}/ if multiple files needed)
 */
export async function graphifyStore(
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [name, ...bodyParts] = args;
  validateGraphName(name);

  const adapter = await adapterFor(projectDir);
  const body = bodyParts.join(' ');
  const docPath = planningRelativePath(workstream ?? null, `graphs/${name}.md`);

  await adapter.putRecord(docPath, body);
  return { data: { written: docPath, name } };
}
