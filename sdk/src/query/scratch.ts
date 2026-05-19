/**
 * Scratch artifact query handlers — adapter-mediated CRUD for
 * DISCUSS-CHECKPOINT and QUESTIONS artifacts per D-20 (PRIMITIVES-09).
 *
 * Scratch artifacts live at .planning/phases/<phaseDir>/ alongside canonical
 * phase artifacts (NOT under .planning/tmp/). Lifecycle is workflow-layer
 * concern; this module provides only getRecord/putRecord/removeRecord wrappers.
 */

import { GSDError, ErrorClassification } from '../errors.js';
import { planningRelativePath } from './helpers.js';
import type { QueryResult } from './utils.js';
import type { StorageAdapter } from '../../../adapters/types.js';

// ─── Validation ───────────────────────────────────────────────────────────

function validatePhaseDir(phaseDir: string): void {
  if (!phaseDir) {
    throw new GSDError('phaseDir argument required', ErrorClassification.Validation);
  }
  if (phaseDir.includes('..') || phaseDir.startsWith('/') || phaseDir.includes('\\')) {
    throw new GSDError(
      'phaseDir must not contain "..", absolute paths, or backslashes',
      ErrorClassification.Validation,
    );
  }
}

function validatePhaseNum(phaseNum: string): void {
  if (!phaseNum) {
    throw new GSDError('phaseNum argument required', ErrorClassification.Validation);
  }
  if (phaseNum.includes('..') || phaseNum.includes('/') || phaseNum.includes('\\')) {
    throw new GSDError(
      'phaseNum must not contain path separators or ".."',
      ErrorClassification.Validation,
    );
  }
}

function checkpointPath(workstream: string | null | undefined, phaseDir: string, phaseNum: string): string {
  return planningRelativePath(workstream ?? null, `phases/${phaseDir}/${phaseNum}-DISCUSS-CHECKPOINT.json`);
}

function questionsPath(
  workstream: string | null | undefined,
  phaseDir: string,
  phaseNum: string,
  format: 'json' | 'html',
): string {
  return planningRelativePath(workstream ?? null, `phases/${phaseDir}/${phaseNum}-QUESTIONS.${format}`);
}

// ─── discuss.checkpoint.put/get/delete ────────────────────────────────────

/** Args: [phaseDir, phaseNum, ...bodyParts] */
export async function discussCheckpointPut(
  adapter: StorageAdapter,
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [phaseDir, phaseNum, ...bodyParts] = args;
  validatePhaseDir(phaseDir);
  validatePhaseNum(phaseNum);
  const body = bodyParts.join(' ');
  const docPath = checkpointPath(workstream, phaseDir, phaseNum);
  await adapter.putRecord(docPath, body);
  return { data: { written: docPath } };
}

/** Args: [phaseDir, phaseNum] */
export async function discussCheckpointGet(
  adapter: StorageAdapter,
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [phaseDir, phaseNum] = args;
  validatePhaseDir(phaseDir);
  validatePhaseNum(phaseNum);
  const docPath = checkpointPath(workstream, phaseDir, phaseNum);
  const content = await adapter.getRecord(docPath);
  if (content === null) return { data: { found: false, content: null } };
  return { data: { found: true, content } };
}

/** Args: [phaseDir, phaseNum] */
export async function discussCheckpointDelete(
  adapter: StorageAdapter,
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [phaseDir, phaseNum] = args;
  validatePhaseDir(phaseDir);
  validatePhaseNum(phaseNum);
  const docPath = checkpointPath(workstream, phaseDir, phaseNum);
  await adapter.removeRecord(docPath);
  return { data: { removed: docPath } };
}

// ─── discuss.questions.put/get/delete ─────────────────────────────────────

/** Args: [phaseDir, phaseNum, format ('json' | 'html'), ...bodyParts] */
export async function discussQuestionsPut(
  adapter: StorageAdapter,
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [phaseDir, phaseNum, formatArg, ...bodyParts] = args;
  validatePhaseDir(phaseDir);
  validatePhaseNum(phaseNum);
  if (formatArg !== 'json' && formatArg !== 'html') {
    throw new GSDError('format must be "json" or "html"', ErrorClassification.Validation);
  }
  const body = bodyParts.join(' ');
  const docPath = questionsPath(workstream, phaseDir, phaseNum, formatArg);
  await adapter.putRecord(docPath, body);
  return { data: { written: docPath, format: formatArg } };
}

/** Args: [phaseDir, phaseNum, format ('json' | 'html')] */
export async function discussQuestionsGet(
  adapter: StorageAdapter,
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [phaseDir, phaseNum, formatArg] = args;
  validatePhaseDir(phaseDir);
  validatePhaseNum(phaseNum);
  if (formatArg !== 'json' && formatArg !== 'html') {
    throw new GSDError('format must be "json" or "html"', ErrorClassification.Validation);
  }
  const docPath = questionsPath(workstream, phaseDir, phaseNum, formatArg);
  const content = await adapter.getRecord(docPath);
  if (content === null) return { data: { found: false, content: null, format: formatArg } };
  return { data: { found: true, content, format: formatArg } };
}

/** Args: [phaseDir, phaseNum, format ('json' | 'html')] */
export async function discussQuestionsDelete(
  adapter: StorageAdapter,
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [phaseDir, phaseNum, formatArg] = args;
  validatePhaseDir(phaseDir);
  validatePhaseNum(phaseNum);
  if (formatArg !== 'json' && formatArg !== 'html') {
    throw new GSDError('format must be "json" or "html"', ErrorClassification.Validation);
  }
  const docPath = questionsPath(workstream, phaseDir, phaseNum, formatArg);
  await adapter.removeRecord(docPath);
  return { data: { removed: docPath, format: formatArg } };
}
