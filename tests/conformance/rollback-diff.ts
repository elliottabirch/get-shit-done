/**
 * Phase 7 CONFORM-04 rollback-snapshot helpers (D-11).
 *
 * Two adapter-specific snapshot functions + one shared equality assertion.
 *
 * MarkdownAdapter: byte-identity via SHA-256 tree hash
 *   (extracted from tests/conformance/write-transaction.conformance-suite.ts:14-30;
 *   ignores shadow-dir artifacts + lock files — same discipline).
 *
 * BeadsAdapter: record-identity via `bd export --json` with strip pass
 *   for non-semantic metadata (Pitfall 4):
 *     STRIP: updated_at, last_modified
 *     KEEP:  id, labels, description, dependencies, memories, comments,
 *            created_at, created_by (stable with BEADS_ACTOR=seed
 *            maintained across all bd ops in the test).
 */
import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

// ============================================================================
// MarkdownAdapter snapshot — SHA-256 tree hash
// ============================================================================

export async function markdownSnapshot(projectDir: string): Promise<string> {
  const planning = join(projectDir, '.planning');
  return hashDir(planning);
}

async function hashDir(dir: string): Promise<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return '<missing>';
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const h = createHash('sha256');
  for (const e of entries) {
    // Skip shadow-dir artifacts + lock (transient)
    if (
      e.name.startsWith('.tmp-txn-') ||
      e.name.startsWith('.tmp-snap-') ||
      e.name === '.adapter.lock'
    ) {
      continue;
    }
    const p = join(dir, e.name);
    h.update(e.name);
    if (e.isFile()) {
      h.update(await readFile(p));
    } else if (e.isDirectory()) {
      h.update(await hashDir(p));
    }
  }
  return h.digest('hex');
}

// ============================================================================
// BeadsAdapter snapshot — bd export --json + strip pass
// ============================================================================

/** Record type after stripping non-semantic metadata. Opaque shape — compared via JSON.stringify. */
export type BeadsSnapshot = unknown[];

export function beadsSnapshot(projectDir: string): BeadsSnapshot {
  const r = spawnSync('bd', ['export', '--json'], {
    cwd: projectDir,
    // Landmine 11: determinism-relevant bd ops require BEADS_ACTOR=seed
    env: { ...process.env, BEADS_ACTOR: 'seed' },
    encoding: 'utf-8',
  });
  if (r.status !== 0) {
    throw new Error(
      `beadsSnapshot: bd export failed (status=${r.status}): ${r.stderr}`,
    );
  }
  // bd v1.0.4 emits JSON array OR JSONL depending on content. Try JSON;
  // fall back to JSONL per RESEARCH §Example 3 branch.
  const stdout = r.stdout ?? '';
  let records: unknown[];
  try {
    const parsed = JSON.parse(stdout);
    records = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    records = stdout
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
  }
  // Strip non-semantic + sort deterministically for diff.
  return records
    .map(stripNonSemantic)
    .sort((a, b) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b)),
    );
}

function stripNonSemantic(record: unknown): unknown {
  if (!record || typeof record !== 'object') return record;
  const r = record as Record<string, unknown>;
  // Per Pitfall 4: strip updated_at + last_modified; keep created_at +
  // created_by (stable with BEADS_ACTOR=seed discipline).
  const {
    updated_at: _updated_at,
    last_modified: _last_modified,
    ...rest
  } = r;
  // Recursively strip nested objects (e.g. comments[].updated_at).
  for (const [key, value] of Object.entries(rest)) {
    if (Array.isArray(value)) {
      (rest as Record<string, unknown>)[key] = value.map(stripNonSemantic);
    } else if (value && typeof value === 'object') {
      (rest as Record<string, unknown>)[key] = stripNonSemantic(value);
    }
  }
  return rest;
}

// ============================================================================
// Shared equality helper
// ============================================================================

/**
 * Assert two snapshots are equal. Both snapshots MUST be the same kind
 * (string for markdown, array for beads).
 */
export function assertEqualSnapshots(
  before: string | BeadsSnapshot,
  after: string | BeadsSnapshot,
  message: string,
): void {
  if (typeof before === 'string' && typeof after === 'string') {
    if (before !== after) {
      throw new Error(`${message}: markdown hash differs\n  before: ${before}\n  after:  ${after}`);
    }
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const a = JSON.stringify(before);
    const b = JSON.stringify(after);
    if (a !== b) {
      // Show first ~500 chars of each for debuggability.
      throw new Error(
        `${message}: beads export differs\n` +
        `  before (len=${a.length}): ${a.slice(0, 500)}${a.length > 500 ? '…' : ''}\n` +
        `  after  (len=${b.length}): ${b.slice(0, 500)}${b.length > 500 ? '…' : ''}`,
      );
    }
    return;
  }
  throw new Error(`${message}: snapshot type mismatch (before=${typeof before}, after=${typeof after})`);
}
