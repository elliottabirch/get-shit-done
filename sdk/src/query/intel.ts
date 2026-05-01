/**
 * Intel query handlers — .planning/intel/ file management.
 *
 * Ported from get-shit-done/bin/lib/intel.cjs.
 * Provides intel status, diff, snapshot, validate, query, extract-exports,
 * and patch-meta operations for the project intelligence system.
 *
 * Phase 2 Plan 02-03 Task 2 (D-12, D-14):
 * - Read paths route through the StorageAdapter (config.json,
 *   intel/<file>, including the mtime check via adapter.stat — the first
 *   real consumer of Plan 1's stat() Bin A primitive).
 * - Write paths (mkdir / writeFileSync) are unchanged: D-14 read-only
 *   discipline restricts Phase 2 to read migration; writes land in Phase 3.
 * - intelExtractExports / intelPatchMeta read a USER-supplied path
 *   (resolved via resolvePathUnderProject) — direct fs reads retained
 *   per the audited-exception pattern (same as summaryExtract +
 *   uatRenderCheckpoint in Plan 3 Task 1).
 *
 * @example
 *   import { intelStatus, intelQuery } from './intel.js';
 *   await intelStatus(adapter, [], '/project');
 *   // { data: { files: { ... }, overall_stale: false } }
 *   await intelQuery(adapter, ['AuthService'], '/project');
 *   // { data: { matches: [...], term: 'AuthService', total: 3 } }
 */

// Phase 2 D-14: write-side fs imports retained until Phase 3 migrates writes.
// Read-side imports (existsSync / readFileSync / readdirSync / statSync) are
// dropped in this plan; the user-path audited-exception readers below import
// what they need locally.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { planningRelativePath, resolvePathUnderProject } from './helpers.js';
import type { QueryResult } from './utils.js';
import type { StorageAdapter } from '../../../adapters/types.js';

// ─── Constants ───────────────────────────────────────────────────────────

const INTEL_FILES: Record<string, string> = {
  files: 'files.json',
  apis: 'apis.json',
  deps: 'deps.json',
  arch: 'arch.md',
  stack: 'stack.json',
};

const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Internal helpers ────────────────────────────────────────────────────

/** Adapter-relative path to .planning/intel/. */
function intelRelDir(workstream?: string): string {
  return planningRelativePath(workstream, 'intel');
}

/** Adapter-relative path to .planning/intel/<filename>. */
function intelRelFile(filename: string, workstream?: string): string {
  return planningRelativePath(workstream, `intel/${filename}`);
}

/** Absolute path to .planning/intel/ — write-side only (D-14 retain). */
function intelDirAbs(projectDir: string, workstream?: string): string {
  // Compose by resolving the planning-relative path against projectDir.
  // For workstream runs this gives projectDir/.planning/workstreams/<ws>/intel.
  return join(projectDir, '.planning', workstream ? join('workstreams', workstream, 'intel') : 'intel');
}

async function isIntelEnabled(adapter: StorageAdapter, workstream?: string): Promise<boolean> {
  const cfgRel = planningRelativePath(workstream, 'config.json');
  const raw = await adapter.getRecord(cfgRel);
  if (raw === null) return false;
  try {
    const cfg = JSON.parse(raw) as { intel?: { enabled?: boolean } };
    return cfg?.intel?.enabled === true;
  } catch {
    return false;
  }
}

/** Read JSON from an adapter-relative path; return null on missing or invalid JSON. */
async function safeReadJsonViaAdapter(adapter: StorageAdapter, relPath: string): Promise<unknown> {
  const raw = await adapter.getRecord(relPath);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Hash an adapter-stored file's content. Returns null on missing. */
async function hashFileViaAdapter(adapter: StorageAdapter, relPath: string): Promise<string | null> {
  const content = await adapter.getRecord(relPath);
  if (content === null) return null;
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/** Max recursion depth when walking JSON for intel queries (avoids stack overflow). */
export const MAX_JSON_SEARCH_DEPTH = 48;

export function searchJsonEntries(data: unknown, term: string, depth = 0): unknown[] {
  const lowerTerm = term.toLowerCase();
  const results: unknown[] = [];
  if (depth > MAX_JSON_SEARCH_DEPTH) return results;
  if (!data || typeof data !== 'object') return results;

  function matchesInValue(value: unknown, d: number): boolean {
    if (d > MAX_JSON_SEARCH_DEPTH) return false;
    if (typeof value === 'string') return value.toLowerCase().includes(lowerTerm);
    if (Array.isArray(value)) return value.some(v => matchesInValue(v, d + 1));
    if (value && typeof value === 'object') return Object.values(value as object).some(v => matchesInValue(v, d + 1));
    return false;
  }

  if (Array.isArray(data)) {
    for (const entry of data) {
      if (matchesInValue(entry, depth + 1)) results.push(entry);
    }
  } else {
    for (const [, value] of Object.entries(data as object)) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (matchesInValue(entry, depth + 1)) results.push(entry);
        }
      }
    }
  }
  return results;
}

async function searchArchMd(adapter: StorageAdapter, relPath: string, term: string): Promise<string[]> {
  const content = await adapter.getRecord(relPath);
  if (content === null) return [];
  const lowerTerm = term.toLowerCase();
  return content.split('\n').filter(line => line.toLowerCase().includes(lowerTerm));
}

// ─── Handlers ────────────────────────────────────────────────────────────

const INTEL_DISABLED_MSG = 'Intel system disabled. Set intel.enabled=true in config.json to activate.';

export const intelStatus = async (
  adapter: StorageAdapter,
  _args: string[],
  _projectDir: string,
  workstream?: string,
): Promise<QueryResult> => {
  if (!(await isIntelEnabled(adapter, workstream))) {
    return { data: { disabled: true, message: INTEL_DISABLED_MSG } };
  }
  const now = Date.now();
  const files: Record<string, unknown> = {};
  let overallStale = false;

  for (const [, filename] of Object.entries(INTEL_FILES)) {
    const rel = intelRelFile(filename, workstream);
    // Phase 2 Plan 02-03 Task 2: stat() is the first real consumer of Plan-1's
    // Bin A stat primitive. Replaces statSync(filePath).mtime.toISOString()
    // and the existsSync ENOENT branch (stat() returns null on miss).
    const st = await adapter.stat(rel);
    if (st === null) {
      files[filename] = { exists: false, updated_at: null, stale: true };
      overallStale = true;
      continue;
    }
    let updatedAt: string | null = null;
    if (filename.endsWith('.md')) {
      // mtime is optional in stat() return shape per D-11; MarkdownAdapter
      // always supplies it but null-coalesce for adapter-implementation parity.
      updatedAt = st.mtime ?? null;
    } else {
      const data = await safeReadJsonViaAdapter(adapter, rel) as Record<string, unknown> | null;
      if (data?._meta) {
        updatedAt = (data._meta as Record<string, unknown>).updated_at as string | null;
      }
    }
    const stale = !updatedAt || (now - new Date(updatedAt).getTime()) > STALE_MS;
    if (stale) overallStale = true;
    files[filename] = { exists: true, updated_at: updatedAt, stale };
  }
  return { data: { files, overall_stale: overallStale } };
};

export const intelDiff = async (
  adapter: StorageAdapter,
  _args: string[],
  _projectDir: string,
  workstream?: string,
): Promise<QueryResult> => {
  if (!(await isIntelEnabled(adapter, workstream))) {
    return { data: { disabled: true, message: INTEL_DISABLED_MSG } };
  }
  const snapshotRel = intelRelFile('.last-refresh.json', workstream);
  const snapshot = await safeReadJsonViaAdapter(adapter, snapshotRel) as Record<string, unknown> | null;
  if (!snapshot) return { data: { no_baseline: true } };

  const prevHashes = (snapshot.hashes as Record<string, string>) || {};
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];

  for (const [, filename] of Object.entries(INTEL_FILES)) {
    const rel = intelRelFile(filename, workstream);
    const currentHash = await hashFileViaAdapter(adapter, rel);
    if (currentHash && !prevHashes[filename]) added.push(filename);
    else if (currentHash && prevHashes[filename] && currentHash !== prevHashes[filename]) changed.push(filename);
    else if (!currentHash && prevHashes[filename]) removed.push(filename);
  }
  return { data: { changed, added, removed } };
};

// ─── Phase 2 D-14: writes deferred to Phase 3 ─────────────────────────────
// The handlers below retain their direct fs writes (mkdirSync, writeFileSync)
// per D-14 read-only discipline. Phase 3 (WRITES-01..04) migrates these to
// adapter.putRecord / adapter.commitPlanningState. Writes live below the
// read-handler section so the migration boundary stays visually clear.

export const intelSnapshot = async (
  adapter: StorageAdapter,
  _args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> => {
  if (!(await isIntelEnabled(adapter, workstream))) {
    return { data: { disabled: true, message: INTEL_DISABLED_MSG } };
  }
  // Phase 2 D-14: read-side hashing migrates to adapter; the manifest write
  // (mkdir + writeFileSync below) stays raw fs until Phase 3.
  const dirAbs = intelDirAbs(projectDir, workstream);
  if (!existsSync(dirAbs)) mkdirSync(dirAbs, { recursive: true });

  const hashes: Record<string, string> = {};
  let fileCount = 0;
  for (const [, filename] of Object.entries(INTEL_FILES)) {
    const rel = intelRelFile(filename, workstream);
    const hash = await hashFileViaAdapter(adapter, rel);
    if (hash) { hashes[filename] = hash; fileCount++; }
  }

  const timestamp = new Date().toISOString();
  writeFileSync(join(dirAbs, '.last-refresh.json'), JSON.stringify({ hashes, timestamp, version: 1 }, null, 2), 'utf-8');
  return { data: { saved: true, timestamp, files: fileCount } };
};

export const intelValidate = async (
  adapter: StorageAdapter,
  _args: string[],
  _projectDir: string,
  workstream?: string,
): Promise<QueryResult> => {
  if (!(await isIntelEnabled(adapter, workstream))) {
    return { data: { disabled: true, message: INTEL_DISABLED_MSG } };
  }
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [, filename] of Object.entries(INTEL_FILES)) {
    const rel = intelRelFile(filename, workstream);
    const exists = await adapter.exists(rel);
    if (!exists) {
      errors.push(`Missing intel file: ${filename}`);
      continue;
    }
    if (!filename.endsWith('.md')) {
      const data = await safeReadJsonViaAdapter(adapter, rel) as Record<string, unknown> | null;
      if (!data) { errors.push(`Invalid JSON in: ${filename}`); continue; }
      const meta = data._meta as Record<string, unknown> | undefined;
      if (!meta?.updated_at) warnings.push(`${filename}: missing _meta.updated_at`);
      else {
        const age = Date.now() - new Date(meta.updated_at as string).getTime();
        if (age > STALE_MS) warnings.push(`${filename}: stale (${Math.round(age / 3600000)}h old)`);
      }
    }
  }
  return { data: { valid: errors.length === 0, errors, warnings } };
};

export const intelQuery = async (
  adapter: StorageAdapter,
  args: string[],
  _projectDir: string,
  workstream?: string,
): Promise<QueryResult> => {
  const term = args[0] || '';
  if (!(await isIntelEnabled(adapter, workstream))) {
    return { data: { disabled: true, message: INTEL_DISABLED_MSG } };
  }
  const matches: unknown[] = [];
  let total = 0;

  for (const [, filename] of Object.entries(INTEL_FILES)) {
    const rel = intelRelFile(filename, workstream);
    if (filename.endsWith('.md')) {
      const archMatches = await searchArchMd(adapter, rel, term);
      if (archMatches.length > 0) { matches.push({ source: filename, entries: archMatches }); total += archMatches.length; }
    } else {
      const data = await safeReadJsonViaAdapter(adapter, rel);
      if (!data) continue;
      const found = searchJsonEntries(data, term);
      if (found.length > 0) { matches.push({ source: filename, entries: found }); total += found.length; }
    }
  }
  return { data: { matches, term, total } };
};

/**
 * Extract exports from a JS/CJS/ESM file — port of `intelExtractExports` in `intel.cjs` (lines 502–614).
 * Returns `{ file, exports, method }` with `file` as a resolved absolute path (matches `gsd-tools.cjs`).
 *
 * Phase 2 audited exception (D-14 + RESEARCH §"Read-Surface Inventory"):
 * intelExtractExports reads a user-supplied path (resolved via resolvePathUnderProject)
 * which may be OUTSIDE the planning tree (caller often points at source files in
 * src/ or lib/). Adapter cannot resolve project-absolute paths. This direct fs
 * read is intentional. Phase 4 LEAKS-04 may add a `// leak-grep-allow line:`
 * suppression directive once the parser ships; for Phase 2 the path argument
 * is not planning-scoped, so leak-grep's Stage-2 filter naturally suppresses
 * this match.
 */
export const intelExtractExports = async (
  _adapter: StorageAdapter,
  args: string[],
  projectDir: string,
  _workstream?: string,
): Promise<QueryResult> => {
  const raw = args[0];
  if (!raw) {
    return { data: { file: '', exports: [], method: 'none' } };
  }
  let filePath: string;
  try {
    filePath = await resolvePathUnderProject(projectDir, raw);
  } catch {
    return { data: { file: raw, exports: [], method: 'none' } };
  }
  if (!existsSync(filePath)) {
    return { data: { file: filePath, exports: [], method: 'none' } };
  }

  const content = readFileSync(filePath, 'utf-8');
  const exports: string[] = [];
  let method = 'none';

  const allMatches = [...content.matchAll(/module\.exports\s*=\s*\{/g)];
  if (allMatches.length > 0) {
    const lastMatch = allMatches[allMatches.length - 1]!;
    const startIdx = lastMatch.index! + lastMatch[0].length;
    let depth = 1;
    let endIdx = startIdx;
    while (endIdx < content.length && depth > 0) {
      if (content[endIdx] === '{') depth++;
      else if (content[endIdx] === '}') depth--;
      if (depth > 0) endIdx++;
    }
    const block = content.substring(startIdx, endIdx);
    method = 'module.exports';
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
      const keyMatch = trimmed.match(/^(\w+)\s*[,}:]/) || trimmed.match(/^(\w+)$/);
      if (keyMatch) exports.push(keyMatch[1]!);
    }
  }

  const individualPattern = /^exports\.(\w+)\s*=/gm;
  let im: RegExpExecArray | null;
  while ((im = individualPattern.exec(content)) !== null) {
    if (!exports.includes(im[1]!)) {
      exports.push(im[1]!);
      if (method === 'none') method = 'exports.X';
    }
  }

  const hadCjs = exports.length > 0;

  const esmExports: string[] = [];

  const defaultNamedPattern = /^export\s+default\s+(?:function|class)\s+(\w+)/gm;
  let em: RegExpExecArray | null;
  while ((em = defaultNamedPattern.exec(content)) !== null) {
    if (!esmExports.includes(em[1]!)) esmExports.push(em[1]!);
  }

  const defaultAnonPattern = /^export\s+default\s+(?!function\s|class\s)/gm;
  if (defaultAnonPattern.test(content) && esmExports.length === 0) {
    if (!esmExports.includes('default')) esmExports.push('default');
  }

  const exportFnPattern = /^export\s+(?:async\s+)?function\s+(\w+)\s*\(/gm;
  while ((em = exportFnPattern.exec(content)) !== null) {
    if (!esmExports.includes(em[1]!)) esmExports.push(em[1]!);
  }

  const exportVarPattern = /^export\s+(?:const|let|var)\s+(\w+)\s*=/gm;
  while ((em = exportVarPattern.exec(content)) !== null) {
    if (!esmExports.includes(em[1]!)) esmExports.push(em[1]!);
  }

  const exportClassPattern = /^export\s+class\s+(\w+)/gm;
  while ((em = exportClassPattern.exec(content)) !== null) {
    if (!esmExports.includes(em[1]!)) esmExports.push(em[1]!);
  }

  const exportBlockPattern = /^export\s*\{([^}]+)\}/gm;
  while ((em = exportBlockPattern.exec(content)) !== null) {
    const items = em[1]!.split(',');
    for (const item of items) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      const name = trimmed.split(/\s+as\s+/)[0]!.trim();
      if (name && !esmExports.includes(name)) esmExports.push(name);
    }
  }

  for (const e of esmExports) {
    if (!exports.includes(e)) exports.push(e);
  }

  const hadEsm = esmExports.length > 0;
  if (hadCjs && hadEsm) {
    method = 'mixed';
  } else if (hadEsm && !hadCjs) {
    method = 'esm';
  }

  return { data: { file: filePath, exports, method } };
};

/**
 * Phase 2 audited exception (same as intelExtractExports above):
 * intelPatchMeta reads + writes a user-supplied JSON file via the project root.
 * The read is intentional; the write stays per D-14 (Phase 3 territory).
 */
export const intelPatchMeta = async (
  _adapter: StorageAdapter,
  args: string[],
  projectDir: string,
  _workstream?: string,
): Promise<QueryResult> => {
  const arg0 = args[0];
  if (!arg0) {
    return { data: { patched: false, error: 'File not found' } };
  }
  let filePath: string;
  try {
    filePath = await resolvePathUnderProject(projectDir, arg0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: { patched: false, error: msg } };
  }
  if (!existsSync(filePath)) {
    return { data: { patched: false, error: `File not found: ${filePath}` } };
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data._meta) data._meta = {};
    const meta = data._meta as Record<string, unknown>;
    const timestamp = new Date().toISOString();
    meta.updated_at = timestamp;
    meta.version = ((meta.version as number) || 0) + 1;
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    return { data: { patched: true, file: filePath, timestamp } };
  } catch (err) {
    return { data: { patched: false, error: String(err) } };
  }
};

// ─── intelUpdate ───────────────────────────────────────────────────────────

/**
 * `gsd-tools intel update` entry point: returns the same JSON as `intel.cjs` `intelUpdate`.
 * Does not run the full graph refresh in-process — that work is done by the
 * **gsd-intel-updater** agent after spawn. When the intel system is disabled
 * in config, returns `{ disabled: true, message }` so SDK output matches the
 * CJS CLI.
 *
 * Port of `intelUpdate` from `intel.cjs` lines 314–321.
 */
export const intelUpdate = async (
  adapter: StorageAdapter,
  _args: string[],
  _projectDir: string,
  workstream?: string,
): Promise<QueryResult> => {
  if (!(await isIntelEnabled(adapter, workstream))) {
    return { data: { disabled: true, message: INTEL_DISABLED_MSG } };
  }
  return {
    data: {
      action: 'spawn_agent',
      message: 'Run gsd-tools intel update or spawn gsd-intel-updater agent for full refresh',
    },
  };
};
