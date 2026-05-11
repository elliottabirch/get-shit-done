/**
 * Safety gate consolidation (`check.gates`).
 *
 * Checks blocking conditions before proceeding with a workflow — replaces
 * per-workflow gate logic in `next.md`, `execute-phase.md`, `discuss-phase.md`.
 * See `.planning/research/decision-routing-audit.md` §3.2.
 */

import { join } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { adapterFor, normalizePhaseName, planningRelativePath } from './helpers.js';
import { findPhase } from './phase.js';
import type { StorageAdapter } from '../../../adapters/types.js';
import type { QueryHandler } from './utils.js';

interface Blocker {
  gate: string;
  file: string;
  severity: 'blocking';
  anti_patterns: string[];
}

interface Warning {
  gate: string;
  phase: string;
  items: string[];
  message: string;
}

// .continue-here.md lives at the project root (outside .planning/) — use dynamic import
// for the single existsSync check to avoid a top-level fs import within leak-grep scope.
async function continueHereExists(projectDir: string): Promise<boolean> {
  const { existsSync } = await import('node:fs');
  return existsSync(join(projectDir, '.continue-here.md'));
}

export const checkGates: QueryHandler = async (args, projectDir, workstream) => {
  const workflow = args[0];
  if (!workflow) {
    throw new GSDError('workflow name required for check gates', ErrorClassification.Validation);
  }

  // Parse optional --phase flag
  let phaseNum: string | null = null;
  const phaseIdx = args.indexOf('--phase');
  if (phaseIdx !== -1 && args[phaseIdx + 1]) {
    phaseNum = args[phaseIdx + 1];
  }

  const blockers: Blocker[] = [];
  const warnings: Warning[] = [];
  const adapter = await adapterFor(projectDir);

  // Gate 1: .continue-here.md in project root (outside .planning/ — not adapter scope)
  if (await continueHereExists(projectDir)) {
    blockers.push({
      gate: 'continue-here',
      file: '.continue-here.md',
      severity: 'blocking',
      anti_patterns: ['continue-here.md present — another session may be in progress'],
    });
  }

  // Gate 2: STATE.md error/failed status
  const stateContent = await adapter.getRecord(planningRelativePath(workstream, 'STATE.md'));
  if (stateContent) {
    const hasErrorStatus =
      /^status:\s*(error|failed)/im.test(stateContent) ||
      /##\s*Error/i.test(stateContent);
    if (hasErrorStatus) {
      blockers.push({
        gate: 'state-error',
        file: '.planning/STATE.md',
        severity: 'blocking',
        anti_patterns: ['STATE.md status is error/failed'],
      });
    }
  }

  // Gate 3: Verification debt — check VERIFICATION.md in phase dir if phase provided
  if (phaseNum) {
    const phaseRes = await findPhase(adapter, [phaseNum], projectDir, workstream);
    const pdata = phaseRes.data as Record<string, unknown>;
    if (pdata.found && pdata.directory) {
      // findPhase returns a display-relative path (e.g. '.planning/phases/04-ui').
      // The adapter is rooted at .planning/, so strip the leading prefix.
      const displayDir = pdata.directory as string;
      const phaseDirRel = displayDir.startsWith('.planning/')
        ? displayDir.slice('.planning/'.length)
        : displayDir;
      const verContent = await adapter.getRecord(`${phaseDirRel}/VERIFICATION.md`);
      if (verContent) {
        const failLines = verContent.match(/\|\s*FAIL\s*\|[^\n]*/gi) || [];
        if (failLines.length > 0) {
          warnings.push({
            gate: 'verification-debt',
            phase: normalizePhaseName(phaseNum),
            items: failLines.map(l => `FAIL: ${l.trim()}`),
            message: `${failLines.length} FAIL row(s) in VERIFICATION.md`,
          });
        }
      }
    }
  }

  return {
    data: {
      passed: blockers.length === 0,
      blockers,
      warnings,
    },
  };
};
