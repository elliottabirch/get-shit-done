/**
 * Spike/sketch query handlers — adapter-mediated CRUD for spike and sketch artifacts.
 *
 * Covers spike (3 leaks), spike-wrap-up (3), sketch (2), sketch-wrap-up (1).
 * All paths route through StorageAdapter; no node:fs imports (D-09).
 */

import { GSDError, ErrorClassification } from '../errors.js';
import { planningRelativePath } from './helpers.js';
import type { QueryResult } from './utils.js';
import type { StorageAdapter } from '../../../adapters/types.js';

// ─── Path validation (T-04-01) ──────────────────────────────────────────────

function validateName(name: string): void {
  if (!name) {
    throw new GSDError('name argument required', ErrorClassification.Validation);
  }
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new GSDError(
      'name must not contain path separators or ".."',
      ErrorClassification.Validation,
    );
  }
}

// ─── Spike handlers ─────────────────────────────────────────────────────────

/**
 * Read the spikes MANIFEST.md.
 *
 * Args: [spikeName?] — optional; if given, reads spikes/{spikeName}/MANIFEST.md
 */
export async function spikeGetManifest(
  adapter: StorageAdapter,
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [spikeName] = args;

  let docPath: string;
  if (spikeName) {
    validateName(spikeName);
    docPath = planningRelativePath(workstream ?? null, `spikes/${spikeName}/MANIFEST.md`);
  } else {
    docPath = planningRelativePath(workstream ?? null, 'spikes/MANIFEST.md');
  }

  const content = await adapter.getRecord(docPath);
  if (content === null) {
    return { data: { found: false, content: null } };
  }
  return { data: { found: true, content } };
}

/**
 * Read spikes CONVENTIONS.md.
 *
 * Args: none
 */
export async function spikeGetConventions(
  adapter: StorageAdapter,
  _args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const docPath = planningRelativePath(workstream ?? null, 'spikes/CONVENTIONS.md');
  const content = await adapter.getRecord(docPath);

  if (content === null) {
    return { data: { found: false, content: null } };
  }
  return { data: { found: true, content } };
}

/**
 * Write a spike wrap-up summary.
 *
 * Args: [name, ...body]
 * Writes to: spikes/{name}/WRAP-UP-SUMMARY.md
 */
export async function spikePutWrapUp(
  adapter: StorageAdapter,
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [name, ...bodyParts] = args;
  validateName(name);

  const body = bodyParts.join(' ');
  const docPath = planningRelativePath(workstream ?? null, `spikes/${name}/WRAP-UP-SUMMARY.md`);

  await adapter.putRecord(docPath, body);
  return { data: { written: docPath, name } };
}

/**
 * Write spikes CONVENTIONS.md.
 *
 * Args: [...body]
 * Writes to: spikes/CONVENTIONS.md
 */
export async function spikePutConventions(
  adapter: StorageAdapter,
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const body = args.join(' ');
  const docPath = planningRelativePath(workstream ?? null, 'spikes/CONVENTIONS.md');

  await adapter.putRecord(docPath, body);
  return { data: { written: docPath } };
}

// ─── Sketch handlers ────────────────────────────────────────────────────────

/**
 * Read the sketches MANIFEST.md.
 *
 * Args: none
 */
export async function sketchGetManifest(
  adapter: StorageAdapter,
  _args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const docPath = planningRelativePath(workstream ?? null, 'sketches/MANIFEST.md');
  const content = await adapter.getRecord(docPath);

  if (content === null) {
    return { data: { found: false, content: null } };
  }
  return { data: { found: true, content } };
}

/**
 * Read sketches CONVENTIONS.md.
 *
 * Args: none
 */
export async function sketchGetConventions(
  adapter: StorageAdapter,
  _args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const docPath = planningRelativePath(workstream ?? null, 'sketches/CONVENTIONS.md');
  const content = await adapter.getRecord(docPath);

  if (content === null) {
    return { data: { found: false, content: null } };
  }
  return { data: { found: true, content } };
}

/**
 * Write a sketch wrap-up summary.
 *
 * Args: [name, ...body]
 * Writes to: sketches/{name}/WRAP-UP-SUMMARY.md
 */
export async function sketchPutWrapUp(
  adapter: StorageAdapter,
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [name, ...bodyParts] = args;
  validateName(name);

  const body = bodyParts.join(' ');
  const docPath = planningRelativePath(workstream ?? null, `sketches/${name}/WRAP-UP-SUMMARY.md`);

  await adapter.putRecord(docPath, body);
  return { data: { written: docPath, name } };
}
