/**
 * Sidecar document query handlers — adapter-mediated CRUD for .planning/
 * sidecars (.next-call-count, etc.).
 *
 * Per D-19: SDK-typed verbs; adapter stays Bin A (no new adapter methods).
 * Per D-21: centralizes sidecar path literals; callers MUST NOT use raw
 * adapter.getRecord('.next-call-count').
 */

import { adapterFor, planningRelativePath } from './helpers.js';
import type { QueryResult } from './utils.js';
import type { StorageAdapter } from '../../../adapters/types.js';

// ─── Path constants (single source of truth per D-21) ─────────────────────

const NEXT_CALL_COUNT = '.next-call-count';

// ─── Adapter-first helpers ────────────────────────────────────────────────

/**
 * Read the consecutive-call counter used by /gsd-next routing.
 * @returns The count (0 if file missing or unparseable).
 */
export async function nextCallCountGet(
  adapter: StorageAdapter,
  workstream?: string,
): Promise<number> {
  const raw = await adapter.getRecord(planningRelativePath(workstream ?? null, NEXT_CALL_COUNT));
  if (raw === null) return 0;
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Increment the consecutive-call counter. Returns the new value.
 */
export async function nextCallCountIncr(
  adapter: StorageAdapter,
  workstream?: string,
): Promise<number> {
  const current = await nextCallCountGet(adapter, workstream);
  const next = current + 1;
  await adapter.putRecord(planningRelativePath(workstream ?? null, NEXT_CALL_COUNT), String(next));
  return next;
}

// ─── Registry-shaped handlers ─────────────────────────────────────────────

export async function nextCallCountGetHandler(
  _args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const adapter = await adapterFor(projectDir);
  const count = await nextCallCountGet(adapter, workstream);
  return { data: { count } };
}

export async function nextCallCountIncrHandler(
  _args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> {
  const adapter = await adapterFor(projectDir);
  const count = await nextCallCountIncr(adapter, workstream);
  return { data: { count } };
}
