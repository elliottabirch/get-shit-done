/**
 * MarkdownAdapter — StorageAdapter implementation backed by .planning/ filesystem.
 *
 * Strategy: wrap existing CJS helpers via createRequire (D-02). Zero re-implementation
 * of filesystem semantics; the adapter is a typed seam over already-correct CJS code.
 *
 * Locked constraints:
 *  D-02  Wrap CJS via createRequire — no CJS files modified
 *  D-03  Sync constructor only (no init/teardown)
 *  D-04  Methods accept .planning/-relative paths; adapter resolves via planningDir()
 *  D-05  capabilities.record/section/frontmatter = true (literal)
 *  D-06  name = 'markdown'
 *  D-08  Optional capabilities: binaryAsset/snapshot/namedDoc = false;
 *        transaction/markdownLockfile = true
 *  D-12  commitPlanningState promoted to required (no longer in Capabilities)
 *  D-09  replaceInCurrentMilestone + readModifyWriteRoadmapMd implemented (markdownLockfile=true)
 *  D-10  Remaining foundational primitives throw UnsupportedCapabilityError (Phase 5 fills them)
 *  D-11  Defensive throws use correct capability key + adapterName
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { existsSync, constants } from 'node:fs';
import { readFile, writeFile, unlink, readdir, mkdir, stat as fsStat, open } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type {
  StorageAdapter,
  Capabilities,
  RecordRef,
  RecordFilter,
  SectionMode,
} from '../types.js';
import { UnsupportedCapabilityError } from '../types.js';
import type { AppendEvent, MutationEvent, SignalEvent } from '../state-event-types.js';

// ─── CJS path resolution ───────────────────────────────────────────────────────
// Mirrors the three-candidate probe from sdk/src/query/state-project-load.ts.
// adapters/markdown/index.ts is 2 levels deep from repo root, so '../../' reaches root.

const BUNDLED_LIB_DIR = fileURLToPath(
  new URL('../../get-shit-done/bin/lib/', import.meta.url),
);

function resolveLibPath(name: string, projectDir: string): string {
  const candidates = [
    join(BUNDLED_LIB_DIR, name),
    join(projectDir, '.claude', 'get-shit-done', 'bin', 'lib', name),
    join(homedir(), '.claude', 'get-shit-done', 'bin', 'lib', name),
  ];
  const found = candidates.find(p => existsSync(p));
  if (!found) {
    throw new Error(
      `MarkdownAdapter: ${name} not found in any candidate path.\n` +
      `Searched:\n${candidates.map(c => `  ${c}`).join('\n')}`,
    );
  }
  return found;
}

// ─── CJS shim types ───────────────────────────────────────────────────────────

interface PlanningWorkspaceCjs {
  planningDir(cwd: string, ws?: string | null, project?: string | null): string;
}

interface FrontmatterCjs {
  cmdFrontmatterGet(cwd: string, filePath: string, field?: string, raw?: boolean): unknown;
  cmdFrontmatterSet(cwd: string, filePath: string, field: string, value: unknown, raw?: boolean): void;
  cmdFrontmatterMerge(cwd: string, filePath: string, data: Record<string, unknown>, raw?: boolean): void;
}

interface CoreCjs {
  replaceInCurrentMilestone(content: string, pattern: string | RegExp, replacement: string): string;
  atomicWriteFileSync(filePath: string, content: string, encoding?: string): void;
}

// ─── MarkdownAdapter ──────────────────────────────────────────────────────────

export class MarkdownAdapter implements StorageAdapter {
  /** D-06: diagnostic identity, never used for behavior branching */
  readonly name = 'markdown' as const;

  /** D-05 / D-08: capability shape — required groups are true literals */
  readonly capabilities: Capabilities = {
    record: true,
    section: true,
    frontmatter: true,
    binaryAsset: false,
    snapshot: false,
    transaction: true,
    namedDoc: false,
    markdownLockfile: true,
  };

  private readonly projectDir: string;
  /** Resolved absolute path to the .planning/ directory */
  private readonly planningBase: string;
  private readonly req: NodeRequire;
  /** Pre-resolved CJS paths (validated in constructor — fail fast, not on first call) */
  private readonly libPaths: Record<string, string>;
  /** Track held locks for cleanup on release */
  private readonly lockSet = new Set<string>();

  /** D-03: Sync constructor — no async init */
  constructor(projectDir: string) {
    this.projectDir = projectDir;
    this.req = createRequire(import.meta.url);

    // Pre-resolve CJS dependencies — throws immediately if any are missing
    this.libPaths = {
      'planning-workspace.cjs': resolveLibPath('planning-workspace.cjs', projectDir),
      'frontmatter.cjs': resolveLibPath('frontmatter.cjs', projectDir),
      'core.cjs': resolveLibPath('core.cjs', projectDir),
    };

    // D-04: resolve the .planning/ base via PR #2901's planningDir() (REUSE per ADR D-08)
    const ws = this.req(this.libPaths['planning-workspace.cjs']) as PlanningWorkspaceCjs;
    this.planningBase = ws.planningDir(projectDir);
  }

  /** D-04 / Pitfall 3: Join planningBase + .planning/-relative path → absolute path. */
  private resolve(relPath: string): string {
    return join(this.planningBase, relPath);
  }

  // ─── Bin A: record group (D-05, required) ─────────────────────────────────

  async getRecord(path: string): Promise<string | null> {
    const abs = this.resolve(path);
    try {
      return await readFile(abs, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async putRecord(path: string, body: string): Promise<void> {
    const abs = this.resolve(path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, body, 'utf-8');
  }

  async removeRecord(path: string): Promise<void> {
    const abs = this.resolve(path);
    try {
      await unlink(abs);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
  }

  async listCollection(prefix: string, filter?: RecordFilter): Promise<RecordRef[]> {
    const abs = this.resolve(prefix);
    let entries: import('node:fs').Dirent[];
    try {
      entries = await readdir(abs, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    const refs: RecordRef[] = entries.map(e => ({
      path: join(prefix, e.name),
      name: e.name,
    }));
    return filter ? refs.filter(filter) : refs;
  }

  async exists(path: string): Promise<boolean> {
    return existsSync(this.resolve(path));
  }

  async stat(path: string): Promise<{ kind: 'file' | 'dir'; mtime?: string } | null> {
    const abs = this.resolve(path);
    try {
      const st = await fsStat(abs);
      return {
        kind: st.isDirectory() ? 'dir' : 'file',
        mtime: st.mtime.toISOString(),
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  // ─── Bin A: section group (D-05, required) ────────────────────────────────
  // No CJS analog (RESEARCH.md Pitfall 5). Implemented via line-by-line parsing.
  // Phase 1 scope: ## (heading-level-2) anchors only; level-3+ deferred to Phase 5.

  async getSection(path: string, anchor: string): Promise<string | null> {
    const text = await this.getRecord(path);
    if (text === null) return null;
    const { body } = extractSection(text, anchor);
    return body;
  }

  async updateSection(
    path: string,
    anchor: string,
    body: string,
    mode: SectionMode,
  ): Promise<void> {
    const current = (await this.getRecord(path)) ?? '';
    const { body: existingBody, found } = extractSection(current, anchor);

    let next: string;
    if (!found) {
      // Section does not exist — append a new one at end of file
      const sep = current.endsWith('\n') ? '' : '\n';
      next = `${current}${sep}\n## ${anchor}\n\n${body}\n`;
    } else {
      let newBody: string;
      switch (mode) {
        case 'overwrite':
          newBody = body;
          break;
        case 'append':
          newBody =
            existingBody !== null && existingBody.length > 0
              ? `${existingBody}\n\n${body}`
              : body;
          break;
        case 'prepend':
          newBody =
            existingBody !== null && existingBody.length > 0
              ? `${body}\n\n${existingBody}`
              : body;
          break;
        default: {
          const _exhaustive: never = mode;
          throw new Error(`Unknown SectionMode: ${String(_exhaustive)}`);
        }
      }
      next = replaceSection(current, anchor, newBody);
    }

    await this.putRecord(path, next);
  }

  // ─── Bin A: frontmatter group (D-05, required) ────────────────────────────
  // Wraps frontmatter.cjs via createRequire (D-02).

  async getFrontmatter(path: string, field?: string): Promise<unknown> {
    const fm = this.req(this.libPaths['frontmatter.cjs']) as FrontmatterCjs;
    return fm.cmdFrontmatterGet(this.projectDir, this.resolve(path), field, false);
  }

  async updateFrontmatter(path: string, field: string, value: unknown): Promise<void> {
    const fm = this.req(this.libPaths['frontmatter.cjs']) as FrontmatterCjs;
    fm.cmdFrontmatterSet(this.projectDir, this.resolve(path), field, value, false);
  }

  async mergeFrontmatter(path: string, patch: Record<string, unknown>): Promise<void> {
    const fm = this.req(this.libPaths['frontmatter.cjs']) as FrontmatterCjs;
    fm.cmdFrontmatterMerge(this.projectDir, this.resolve(path), patch, false);
  }

  // ─── markdownLockfile group (D-09 / ADAPTER-07) ───────────────────────────
  // IMPLEMENTED (not throwing) since capabilities.markdownLockfile = true.
  // Wraps core.cjs exports (replaceInCurrentMilestone, atomicWriteFileSync).

  async replaceInCurrentMilestone(
    pattern: string | RegExp,
    replacement: string,
  ): Promise<void> {
    const core = this.req(this.libPaths['core.cjs']) as CoreCjs;
    const roadmapPath = this.resolve('ROADMAP.md');
    const current = (await this.getRecord('ROADMAP.md')) ?? '';
    const updated = core.replaceInCurrentMilestone(current, pattern, replacement);
    core.atomicWriteFileSync(roadmapPath, updated, 'utf-8');
  }

  async readModifyWriteRoadmapMd(mutator: (content: string) => string): Promise<void> {
    const core = this.req(this.libPaths['core.cjs']) as CoreCjs;
    const roadmapPath = this.resolve('ROADMAP.md');
    const current = (await this.getRecord('ROADMAP.md')) ?? '';
    const updated = mutator(current);
    core.atomicWriteFileSync(roadmapPath, updated, 'utf-8');
  }

  // ─── commitPlanningState (D-08 / D-10, implemented since cap=true) ────────

  async commitPlanningState(message: string, files?: string[]): Promise<void> {
    const { execFileSync } = await import('node:child_process');
    const targets = files && files.length > 0 ? files : ['.planning'];
    try {
      execFileSync('git', ['add', ...targets], {
        cwd: this.projectDir,
        stdio: 'pipe',
      });
      execFileSync('git', ['commit', '-m', message], {
        cwd: this.projectDir,
        stdio: 'pipe',
      });
    } catch (err) {
      throw new Error(
        `commitPlanningState failed: ${(err as Error).message}`,
      );
    }
  }

  // ─── Foundational primitives — defensive throws (D-10 / D-11) ────────────
  // Phase 5 replaces these with real implementations.

  async writeBinaryAsset(_path: string, _bytes: Uint8Array): Promise<void> {
    throw new UnsupportedCapabilityError('binaryAsset', this.name);
  }

  async snapshot(): Promise<string> {
    throw new UnsupportedCapabilityError('snapshot', this.name);
  }

  async restore(_snapshotId: string): Promise<void> {
    // restore() is gated by the same 'snapshot' capability
    throw new UnsupportedCapabilityError('snapshot', this.name);
  }

  async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    const lockPath = join(this.planningBase, '.adapter.lock');
    await this.acquireAdapterLock(lockPath);
    try {
      return await fn();
    } finally {
      await this.releaseAdapterLock(lockPath);
    }
  }

  private async acquireAdapterLock(lockPath: string): Promise<void> {
    const maxRetries = 10;
    const retryDelay = 200;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const fd = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
        await fd.writeFile(String(process.pid));
        await fd.close();
        this.lockSet.add(lockPath);
        return;
      } catch (err: unknown) {
        if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'EEXIST') {
          const dead = await this.isLockStale(lockPath);
          if (dead) {
            try { await unlink(lockPath); } catch { /* race OK */ }
            continue;
          }
          if (i === maxRetries - 1) {
            // Force-break on last retry (matches CJS state.cjs behavior)
            try { await unlink(lockPath); } catch { /* ignore */ }
            return;
          }
          await new Promise<void>(r => setTimeout(r, retryDelay + Math.floor(Math.random() * 50)));
        } else {
          // Graceful degradation on non-EEXIST errors (match CJS state.cjs:889)
          return;
        }
      }
    }
  }

  private async releaseAdapterLock(lockPath: string): Promise<void> {
    this.lockSet.delete(lockPath);
    try { await unlink(lockPath); } catch { /* already gone */ }
  }

  private async isLockStale(lockPath: string): Promise<boolean> {
    try {
      const raw = await readFile(lockPath, 'utf-8');
      const pid = parseInt(raw.trim(), 10);
      if (!Number.isFinite(pid) || pid <= 0) return true;
      try { process.kill(pid, 0); return false; } catch { return true; }
    } catch { return true; }
  }

  // ─── Event family stubs (Phase 3 Plan 02 fills these) ─────────────────────

  async recordStateAppend(_event: AppendEvent): Promise<void> {
    throw new Error('recordStateAppend not yet implemented (Phase 3 Plan 02)');
  }

  async recordStateMutation(_event: MutationEvent): Promise<void> {
    throw new Error('recordStateMutation not yet implemented (Phase 3 Plan 02)');
  }

  async recordStateSignal(_event: SignalEvent): Promise<void> {
    throw new Error('recordStateSignal not yet implemented (Phase 3 Plan 02)');
  }

  async putNamedDoc(
    _category: string,
    _key: string,
    _body: string,
  ): Promise<void> {
    throw new UnsupportedCapabilityError('namedDoc', this.name);
  }

  async getNamedDoc(
    _category: string,
    _key: string,
  ): Promise<string | null> {
    throw new UnsupportedCapabilityError('namedDoc', this.name);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse a markdown document line-by-line to find a level-2 (##) section.
 * Returns the trimmed body content and whether the section was found.
 * Heading-level-3+ nested anchors are deferred to Phase 5.
 */
function extractSection(
  text: string,
  anchor: string,
): { found: boolean; body: string | null } {
  const anchorRe = new RegExp('^##[ \\t]+' + escapeRegExp(anchor) + '[ \\t]*$');
  const nextH2Re = /^##[ \t]/;

  const lines = text.split('\n');
  let inSection = false;
  const bodyLines: string[] = [];

  for (const line of lines) {
    if (!inSection) {
      if (anchorRe.test(line)) {
        inSection = true;
      }
    } else {
      if (nextH2Re.test(line)) {
        // Hit the next ## heading — section ends here
        break;
      }
      bodyLines.push(line);
    }
  }

  if (!inSection) return { found: false, body: null };

  const raw = bodyLines.join('\n');
  // Use /g flag to replace both leading and trailing newlines in a single pass
  const trimmed = raw.replace(/^\n+/g, '').replace(/\n+$/g, '');
  return { found: true, body: trimmed };
}

/**
 * Replace the body of a level-2 section in a markdown document.
 * Leaves all other sections and content intact.
 */
function replaceSection(text: string, anchor: string, newBody: string): string {
  const anchorRe = new RegExp('^##[ \\t]+' + escapeRegExp(anchor) + '[ \\t]*$');
  const nextH2Re = /^##[ \t]/;

  const lines = text.split('\n');
  const out: string[] = [];
  let i = 0;

  // Pass through everything before the target section
  while (i < lines.length) {
    if (anchorRe.test(lines[i])) {
      // Emit the heading itself
      out.push(lines[i]);
      i++;
      // Skip original body lines
      while (i < lines.length && !nextH2Re.test(lines[i])) {
        i++;
      }
      // Emit the new body
      out.push('');
      out.push(newBody);
      out.push('');
      break;
    }
    out.push(lines[i]);
    i++;
  }

  // Pass through everything after the replaced section
  while (i < lines.length) {
    out.push(lines[i]);
    i++;
  }

  return out.join('\n');
}
