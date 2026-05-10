/**
 * Debug session query handlers — adapter-mediated debug archive operations.
 *
 * Covers execute-phase debug archive (1 leak), gsd-debugger (3 leaks).
 * All paths route through StorageAdapter; no node:fs imports (D-09).
 */

import { GSDError, ErrorClassification } from '../errors.js';
import { adapterFor, planningRelativePath } from './helpers.js';
import type { QueryResult } from './utils.js';

// ─── Path validation (T-04-01) ──────────────────────────────────────────────

function validateSessionId(sessionId: string): void {
  if (!sessionId) {
    throw new GSDError('sessionId argument required', ErrorClassification.Validation);
  }
  if (sessionId.includes('..') || sessionId.includes('/') || sessionId.includes('\\')) {
    throw new GSDError(
      'sessionId must not contain path separators or ".."',
      ErrorClassification.Validation,
    );
  }
}

// ─── debugArchive ───────────────────────────────────────────────────────────

/**
 * Archive a debug session by moving it from debug/ to debug/resolved/.
 *
 * Simulates mv via getRecord + putRecord + removeRecord (adapter primitive composition).
 *
 * Args: [sessionId]
 * Moves: debug/{sessionId}.md -> debug/resolved/{sessionId}.md
 */
export async function debugArchive(
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const [sessionId] = args;
  validateSessionId(sessionId);

  const adapter = await adapterFor(projectDir);
  const sourcePath = planningRelativePath(workstream ?? null, `debug/${sessionId}.md`);
  const destPath = planningRelativePath(workstream ?? null, `debug/resolved/${sessionId}.md`);

  // Use transaction for atomic move (D-04)
  await adapter.withTransaction(async () => {
    const content = await adapter.getRecord(sourcePath);
    if (content === null) {
      throw new GSDError(
        `debug session not found: ${sessionId}`,
        ErrorClassification.Validation,
      );
    }
    await adapter.putRecord(destPath, content);
    await adapter.removeRecord(sourcePath);
  });

  return { data: { archived: true, sessionId, from: sourcePath, to: destPath } };
}
