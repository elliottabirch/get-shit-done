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
import { existsSync, constants, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { readFile, writeFile, unlink, readdir, mkdir, stat as fsStat, open, rename, rm, mkdtemp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type {
  StorageAdapter,
  Capabilities,
  RecordRef,
  RecordFilter,
  SectionMode,
  NamedDocCategory,
  StateWriteOutcome,
} from '../types.js';
import { UnsupportedCapabilityError } from '../types.js';
import type { AppendEvent, MutationEvent, SignalEvent } from '../state-event-types.js';

// ─── CJS path resolution ───────────────────────────────────────────────────────
// Mirrors the three-candidate probe from sdk/src/query/state-project-load.ts.
// At runtime `import.meta.url` may be either of:
//   - adapters/dist/markdown/index.js  (dist, 3 levels deep)  → `../../../` reaches root
//   - adapters/markdown/index.ts       (src under vitest, 2 levels deep) → `../../` reaches root
const BUNDLED_LIB_DIR = fileURLToPath(
  new URL(
    (import.meta.url.includes('/dist/') ? '../../../' : '../../') + 'get-shit-done/bin/lib/',
    import.meta.url,
  ),
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
  cmdFrontmatterMerge(cwd: string, filePath: string, data: string, raw?: boolean): void;
}

interface CoreCjs {
  replaceInCurrentMilestone(content: string, pattern: string | RegExp, replacement: string): string;
  atomicWriteFileSync(filePath: string, content: string, encoding?: string): void;
}

// ─── Transaction Context ──────────────────────────────────────────────────────

/** Phase 5 D-01/D-04: transaction context tracked per-adapter-instance. */
interface TxnCtx {
  tmpDir: string;
  touchedPaths: Set<string>;
  removedPaths: Set<string>;
  dryRun: boolean;
  depth: number;
}

// ─── MarkdownAdapter ──────────────────────────────────────────────────────────

/**
 * Internal helper return shape. Public recordState* methods convert this
 * into the user-facing StateWriteOutcome before returning.
 *
 * Discriminated union (IN-01): the applied:true branch carries the post-
 * mutation body (and optionally a scaffolded heading); the applied:false
 * branch carries ONLY the no-op reason. Making the shape asymmetric at
 * the type level removes a silent-data-loss foot-gun — a future helper
 * can no longer attach a partially-modified `body` to an applied:false
 * result and have it silently discarded by the dispatcher.
 *   body             — post-mutation STATE.md body (applied:true only)
 *   created_section  — heading scaffolded by the helper (preserves the
 *                      Phase 3 UAT-fix semantics as a typed signal)
 *   reason           — mirrors StateWriteOutcome's no-op reasons
 */
type HelperResult =
  | { applied: true; body: string; created_section?: string }
  | { applied: false; reason: 'duplicate' | 'nothing_to_remove' };

export class MarkdownAdapter implements StorageAdapter {
  /** D-06: diagnostic identity, never used for behavior branching */
  readonly name = 'markdown' as const;

  /** D-05 / D-08: capability shape — required groups are true literals */
  readonly capabilities: Capabilities = {
    record: true,
    section: true,
    frontmatter: true,
    binaryAsset: true,     // D-17: Phase 5 Plan 04
    snapshot: true,        // D-03: Phase 5 Plan 03
    transaction: true,
    namedDoc: true,        // D-16: Phase 5 Plan 04
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
  /** Phase 5 D-01: per-transaction shadow-dir state. undefined when no txn active. */
  private activeTxn: TxnCtx | undefined;

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

  /** D-01: write-path resolver — shadow tmpdir when txn active, real path otherwise. */
  private resolveWrite(relPath: string): string {
    if (this.activeTxn) {
      this.activeTxn.touchedPaths.add(relPath);
      this.activeTxn.removedPaths.delete(relPath);  // a write un-removes
      return join(this.activeTxn.tmpDir, relPath);
    }
    return this.resolve(relPath);
  }

  /** D-01: read-path resolver — tmpdir-over-real merge. Async to stat the shadow. */
  private async resolveRead(relPath: string): Promise<string> {
    if (this.activeTxn) {
      if (this.activeTxn.removedPaths.has(relPath)) {
        // The caller removed this in-txn; reads should see it as absent. Point at a
        // guaranteed-missing path so the caller's catch(ENOENT) branch fires.
        return join(this.activeTxn.tmpDir, '.__REMOVED__', relPath);
      }
      const shadowPath = join(this.activeTxn.tmpDir, relPath);
      if (existsSync(shadowPath)) return shadowPath;
    }
    return this.resolve(relPath);
  }

  // ─── Bin A: record group (D-05, required) ─────────────────────────────────

  async getRecord(path: string): Promise<string | null> {
    const abs = await this.resolveRead(path);
    try {
      return await readFile(abs, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async putRecord(path: string, body: string): Promise<void> {
    const abs = this.resolveWrite(path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, body, 'utf-8');
  }

  async removeRecord(path: string): Promise<void> {
    if (this.activeTxn) {
      this.activeTxn.removedPaths.add(path);
      this.activeTxn.touchedPaths.delete(path);  // a remove un-touches
      // Remove from shadow if previously written this txn.
      const shadowAbs = join(this.activeTxn.tmpDir, path);
      try { await unlink(shadowAbs); } catch { /* not written this txn */ }
      return;
    }
    const abs = this.resolve(path);
    try {
      await unlink(abs);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
  }

  async removeCollection(prefix: string): Promise<void> {
    // Transactions: stage removal by enumerating the subtree and marking each
    // entry. Txn commit (see commitTxn) materializes via the shadow-dir rename
    // + removal pass already in place; explicit rmdir at commit is not needed
    // because fs.rm -r is applied during commit for `removedPaths` roots.
    if (this.activeTxn) {
      // Walk current real subtree + shadow to enumerate all paths to remove.
      const realAbs = this.resolve(prefix);
      try {
        const realEntries = await readdir(realAbs, { withFileTypes: true });
        for (const entry of realEntries) {
          const childRel = `${prefix}/${entry.name}`;
          if (entry.isDirectory()) {
            await this.removeCollection(childRel);
          } else {
            await this.removeRecord(childRel);
          }
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
      this.activeTxn.removedPaths.add(prefix);
      return;
    }
    const abs = this.resolve(prefix);
    try {
      await rm(abs, { recursive: true, force: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
  }

  async listCollection(prefix: string, filter?: RecordFilter): Promise<RecordRef[]> {
    const realAbs = this.resolve(prefix);
    let entries: import('node:fs').Dirent[] = [];
    try {
      entries = await readdir(realAbs, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    let refs: RecordRef[] = entries.map(e => ({ path: join(prefix, e.name), name: e.name }));

    if (this.activeTxn) {
      // Filter out in-txn removals.
      refs = refs.filter(r => !this.activeTxn!.removedPaths.has(r.path));
      // Add in-txn shadow-only entries.
      try {
        const shadowAbs = join(this.activeTxn.tmpDir, prefix);
        const shadowEntries = await readdir(shadowAbs, { withFileTypes: true });
        const seen = new Set(refs.map(r => r.name));
        for (const e of shadowEntries) {
          if (!seen.has(e.name)) refs.push({ path: join(prefix, e.name), name: e.name });
        }
      } catch { /* no shadow dir at prefix */ }
    }
    return filter ? refs.filter(filter) : refs;
  }

  async exists(path: string): Promise<boolean> {
    if (this.activeTxn?.removedPaths.has(path)) return false;
    const resolved = await this.resolveRead(path);
    return existsSync(resolved);
  }

  async stat(path: string): Promise<{ kind: 'file' | 'dir'; mtime?: string } | null> {
    if (this.activeTxn?.removedPaths.has(path)) return null;
    const abs = await this.resolveRead(path);
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
    await this.withTransaction(async () => {
      const current = (await this.getRecord(path)) ?? '';
      const { body: existingBody, found } = extractSection(current, anchor);

      let next: string;
      if (!found) {
        // Section does not exist — append a new one at end of file
        const sep = current.endsWith('\n') ? '' : '\n';
        next = `${current}${sep}\n${anchor}\n\n${body}\n`;
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
    });
  }

  // ─── Bin A: frontmatter group (D-05, required) ────────────────────────────
  // Wraps frontmatter.cjs via createRequire (D-02).

  async getFrontmatter(path: string, field?: string): Promise<unknown> {
    // The CJS `cmdFrontmatterGet` is a CLI command that writes to stdout and
    // returns undefined — it cannot be used programmatically. Parse directly
    // via the exported `extractFrontmatter` helper, reading through the
    // adapter's record layer so txn-shadow state is respected.
    const content = await this.getRecord(path);
    if (content === null) return undefined;
    const fmMod = this.req(this.libPaths['frontmatter.cjs']) as {
      extractFrontmatter: (c: string) => Record<string, unknown>;
    };
    const fm = fmMod.extractFrontmatter(content);
    if (field) {
      return fm[field];
    }
    return fm;
  }

  async updateFrontmatter(path: string, field: string, value: unknown): Promise<void> {
    const fm = this.req(this.libPaths['frontmatter.cjs']) as FrontmatterCjs;
    fm.cmdFrontmatterSet(this.projectDir, this.resolve(path), field, value, false);
  }

  async mergeFrontmatter(path: string, patch: Record<string, unknown>): Promise<void> {
    // When a txn is active, the CJS helper's direct fs access would bypass the
    // shadow-dir — reading stale content and writing outside the txn. Route
    // through getRecord/putRecord so writes land in the shadow and reads see
    // prior in-txn mutations. No-txn behavior remains identical: the fallback
    // path below still calls the CJS helper against the real file.
    if (this.activeTxn) {
      const current = (await this.getRecord(path)) ?? '';
      const existingFm = this.extractFrontmatterFromContent(current);
      const body = this.stripFrontmatterFromContent(current);
      const merged: Record<string, unknown> = { ...existingFm, ...patch };
      const yaml = this.reconstructFrontmatterYaml(merged);
      await this.putRecord(path, `---\n${yaml}\n---\n\n${body}`);
      return;
    }
    const fm = this.req(this.libPaths['frontmatter.cjs']) as FrontmatterCjs;
    fm.cmdFrontmatterMerge(this.projectDir, this.resolve(path), JSON.stringify(patch), false);
  }

  /** Extract YAML frontmatter into a JS object via the CJS helper's shared parser. */
  private extractFrontmatterFromContent(content: string): Record<string, unknown> {
    const fm = this.req(this.libPaths['frontmatter.cjs']) as {
      extractFrontmatter: (c: string) => Record<string, unknown>;
    };
    return fm.extractFrontmatter(content);
  }

  /** Strip the leading `---\n...\n---\n` block, if present. */
  private stripFrontmatterFromContent(content: string): string {
    const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    return m ? content.slice(m[0].length) : content;
  }

  /** Reconstruct YAML frontmatter using the CJS helper's formatter. */
  private reconstructFrontmatterYaml(data: Record<string, unknown>): string {
    const fm = this.req(this.libPaths['frontmatter.cjs']) as {
      reconstructFrontmatter?: (d: Record<string, unknown>) => string;
      spliceFrontmatter?: (content: string, data: Record<string, unknown>) => string;
    };
    if (typeof fm.reconstructFrontmatter === 'function') {
      return fm.reconstructFrontmatter(data);
    }
    // Fallback: splice into an empty-fm document and extract the YAML block.
    if (typeof fm.spliceFrontmatter === 'function') {
      const spliced = fm.spliceFrontmatter('---\n---\n\nBODY', data);
      const m = spliced.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
      return m ? m[1] : '';
    }
    // Last resort: naive serialization. Only triggers if CJS surface changes.
    const lines: string[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        lines.push(`${k}:`);
        for (const [ck, cv] of Object.entries(v as Record<string, unknown>)) {
          lines.push(`  ${ck}: ${JSON.stringify(cv)}`);
        }
      } else {
        lines.push(`${k}: ${JSON.stringify(v)}`);
      }
    }
    return lines.join('\n');
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
    if (this.activeTxn?.dryRun) return;  // D-05: no-op during dry-run
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

  async writeBinaryAsset(path: string, bytes: Uint8Array): Promise<void> {
    // D-17: raw bytes — no 'utf-8' encoding. Routes through resolveWrite so
    // shadow-dir journal captures binary writes inside active transactions.
    const abs = this.resolveWrite(path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, Buffer.from(bytes));
  }

  /** D-03: snapshot the current .planning/ tree into an opaque tmpdir; returns its path as the id. */
  async snapshot(): Promise<string> {
    const snapDir = await mkdtemp(join(this.planningBase, '.tmp-snap-'));
    await this._copyTreeRecursive(this.planningBase, snapDir, ['.tmp-txn-', '.tmp-snap-', '.adapter.lock']);
    return snapDir;
  }

  /** D-03: restore a previously-captured snapshot. Rolls back .planning/ to snapshot state. */
  async restore(snapshotId: string): Promise<void> {
    if (!existsSync(snapshotId)) throw new Error(`Snapshot not found: ${snapshotId}`);
    // Replace .planning/ contents (except .tmp-* scratch and .adapter.lock) with snapshot contents.
    await this._wipePlanning(['.tmp-txn-', '.tmp-snap-', '.adapter.lock']);
    await this._copyTreeRecursive(snapshotId, this.planningBase, []);
    // Remove the snapshot on successful restore (single-use).
    try { await rm(snapshotId, { recursive: true, force: true }); } catch { /* best effort */ }
  }

  async withTransaction<T>(fn: () => Promise<T>, opts?: { dryRun?: boolean }): Promise<T> {
    // D-04: reentrant — join outer txn, execute fn without acquiring a new lock or tmpdir.
    const existing = this.activeTxn;
    if (existing) {
      existing.depth++;
      try {
        return await fn();
      } finally {
        existing.depth--;
      }
    }

    // Fresh txn: acquire lock + create shadow tmpdir.
    const lockPath = join(this.planningBase, '.adapter.lock');
    await this.acquireAdapterLock(lockPath);
    // D-03 discretion: tmpdir lives under .planning/ to guarantee same-mount atomic rename (A1, Pitfall 1).
    const tmpDir = await mkdtemp(join(this.planningBase, '.tmp-txn-'));
    const ctx: TxnCtx = {
      tmpDir,
      touchedPaths: new Set(),
      removedPaths: new Set(),
      dryRun: opts?.dryRun ?? false,
      depth: 1,
    };
    this.activeTxn = ctx;

    let succeeded = false;
    try {
      const result = await fn();
      succeeded = true;
      if (!ctx.dryRun) await this._commitShadowDir(ctx);
      return result;
    } finally {
      // Rollback path: dryRun always rolls back; error (succeeded=false) rolls back.
      try { await rm(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
      this.activeTxn = undefined;
      await this.releaseAdapterLock(lockPath);
      void succeeded;  // no-op use to satisfy strict mode
    }
  }

  private async acquireAdapterLock(lockPath: string): Promise<void> {
    // D-10: reentrant guard — if this adapter instance already holds a txn,
    // same-PID reentry would deadlock on O_EXCL. Return immediately; the outer
    // txn owns the lock. No fs-lock acquired.
    if (this.activeTxn) return;

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

  /** D-01: apply shadow-dir changes to real planning tree. Idempotent on dir creation. */
  private async _commitShadowDir(ctx: TxnCtx): Promise<void> {
    // 1) Apply removes first (so touchedPaths can recreate if needed).
    // Collection removals (directories) come through removeCollection and may
    // appear as either a leaf path or a prefix containing other removedPaths;
    // use `rm -rf` to handle both file and directory cases uniformly and to
    // survive macOS EPERM on directory `unlink` (EISDIR on linux).
    for (const relPath of ctx.removedPaths) {
      const realAbs = this.resolve(relPath);
      try {
        await rm(realAbs, { recursive: true, force: true });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    }
    // 2) Apply writes via rename, sorted parent-first.
    const paths = Array.from(ctx.touchedPaths).sort();
    for (const relPath of paths) {
      const src = join(ctx.tmpDir, relPath);
      const dst = this.resolve(relPath);
      if (!existsSync(src)) continue;  // removed after write in same txn; already handled
      await mkdir(dirname(dst), { recursive: true });
      await rename(src, dst);  // POSIX same-mount atomic
    }
  }

  /** Pipeline-internal escape hatch (RESEARCH OQ #1). NOT on StorageAdapter interface. */
  _txnContextForPipeline(): TxnCtx | undefined {
    return this.activeTxn;
  }

  /**
   * Pipeline-internal: bypass shadow-dir merge, read the real file.
   * Used by dry-run to compute before-image of touched paths.
   */
  async _realReadForPipeline(relPath: string): Promise<string | null> {
    const abs = this.resolve(relPath);
    try {
      return await readFile(abs, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  // Private helpers for snapshot/restore
  private async _copyTreeRecursive(srcBase: string, dstBase: string, skipPrefixes: string[]): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try { entries = await readdir(srcBase, { withFileTypes: true }); }
    catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
    for (const e of entries) {
      if (skipPrefixes.some(p => e.name.startsWith(p))) continue;
      const src = join(srcBase, e.name);
      const dst = join(dstBase, e.name);
      if (e.isDirectory()) {
        await mkdir(dst, { recursive: true });
        await this._copyTreeRecursive(src, dst, skipPrefixes);
      } else if (e.isFile()) {
        const body = await readFile(src);
        await mkdir(dirname(dst), { recursive: true });
        await writeFile(dst, body);
      }
    }
  }

  private async _wipePlanning(skipPrefixes: string[]): Promise<void> {
    const entries = await readdir(this.planningBase, { withFileTypes: true });
    for (const e of entries) {
      if (skipPrefixes.some(p => e.name.startsWith(p))) continue;
      const target = join(this.planningBase, e.name);
      await rm(target, { recursive: true, force: true });
    }
  }

  // ─── Event family methods (Phase 3 Plan 02) ────────────────────────────────

  /**
   * Append-family event: adds entries to STATE.md sections.
   * Section targeting dispatches on event.type → correct STATE.md section regex.
   * Pipeline: withTransaction → getRecord → strip frontmatter → find section →
   * append formatted entry → syncStateFrontmatter → normalize → putRecord.
   */
  async recordStateAppend(event: AppendEvent): Promise<StateWriteOutcome> {
    return this.withTransaction(async () => {
      const raw = (await this.getRecord('STATE.md')) ?? '';
      const body = this.stripFrontmatter(raw);
      let result: HelperResult;

      switch (event.type) {
        case 'decision': {
          const { phase, summary, rationale } = event.payload;
          const entry = `- [Phase ${phase || '?'}]: ${summary}${rationale ? ` — ${rationale}` : ''}`;
          // Use create-if-missing so a STATE.md that lacks a Decisions section
          // still receives the append (consistent with forensic_session /
          // quick_task / deferred_item event types). The broadened heading
          // regex (any L2/L3 heading containing "Decisions"/"decisions" as a
          // word, with an optional suffix like "(2026-04-30)") catches common
          // real-world variants like "## Locked decisions (date)".
          result = this.appendToOrCreateSection(
            body,
            /(###?\s*[^\n]*\b[Dd]ecisions?\b[^\n]*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/,
            '## Decisions Made',
            entry,
          );
          break;
        }
        case 'metric': {
          const { phase, plan, duration, tasks, files } = event.payload;
          const entry = `| Phase ${phase} P${plan} | ${duration} | ${tasks || '-'} tasks | ${files || '-'} files |`;
          result = this.appendToMetricsTable(body, entry);
          break;
        }
        case 'roadmap_evolution': {
          const { phase, action, note, after, urgent } = event.payload;
          const entry = this.formatRoadmapEvolutionEntry({ phase, action, note, after, urgent });
          result = this.appendToRoadmapEvolution(body, entry);
          break;
        }
        case 'session': {
          const { stoppedAt, resumeFile } = event.payload;
          result = this.updateSessionFields(body, stoppedAt, resumeFile);
          break;
        }
        case 'forensic_session': {
          const { sessionId, findings } = event.payload;
          const entry = `- ${sessionId}: ${findings}`;
          result = this.appendToOrCreateSection(
            body,
            /(##\s*Forensic Sessions\s*\n)([\s\S]*?)(?=\n##|$)/i,
            '## Forensic Sessions',
            entry,
          );
          break;
        }
        case 'quick_task': {
          const { task, result: taskResult } = event.payload;
          const entry = `- ${task}${taskResult ? ': ' + taskResult : ''}`;
          result = this.appendToOrCreateSection(
            body,
            /(##\s*Quick Tasks\s*\n)([\s\S]*?)(?=\n##|$)/i,
            '## Quick Tasks',
            entry,
          );
          break;
        }
        default: {
          const _exhaustive: never = event;
          throw new Error(`Unknown AppendEvent type: ${(event as { type: string }).type}`);
        }
      }

      // Translate HelperResult → StateWriteOutcome. Skip disk write when the
      // body didn't change (no-op semantics).
      // NOTE: when !result.applied we intentionally skip syncFrontmatter +
      // normalizeMd + putRecord. Prior behavior rewrote the file unchanged
      // on dedupe hits, causing last_updated frontmatter churn. The new
      // behavior is cleaner but visible; documented in ADR D-2026-05-10-08.
      // IN-05: the outer withTransaction still holds the adapter lock and
      // created a tmp-txn directory on the way in. For pure dedupe /
      // nothing_to_remove paths this is paid-for overhead. Short-circuiting
      // would require reading STATE.md outside the lock, trading correctness
      // for speed — deferred.
      if (!result.applied) {
        return { applied: false, reason: result.reason };
      }
      const synced = await this.syncFrontmatter(result.body);
      const normalized = this.normalizeMd(synced);
      await this.putRecord('STATE.md', normalized);
      return result.created_section
        ? { applied: true, created_section: result.created_section }
        : { applied: true };
    });
  }

  /**
   * Mutation-family event: modifies existing lists in STATE.md sections.
   * Pipeline: withTransaction → getRecord → strip frontmatter → mutate list →
   * syncStateFrontmatter → normalize → putRecord.
   */
  async recordStateMutation(event: MutationEvent): Promise<StateWriteOutcome> {
    return this.withTransaction(async () => {
      const raw = (await this.getRecord('STATE.md')) ?? '';
      const body = this.stripFrontmatter(raw);
      let result: HelperResult;

      switch (event.type) {
        case 'blocker_added': {
          const { text } = event.payload;
          const entry = `- ${text}`;
          // Create-if-missing (Phase 3 UAT Bug 1 family): the prior
          // appendToSection silently dropped writes when no Blockers
          // heading existed. Broadened heading match + auto-create.
          result = this.appendToOrCreateSection(
            body,
            /(###?\s*[^\n]*\b[Bb]lockers?(?:\/[Cc]oncerns)?\b[^\n]*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/,
            '## Blockers',
            entry,
          );
          break;
        }
        case 'blocker_resolved': {
          const { text } = event.payload;
          result = this.removeFromBlockersList(body, text);
          break;
        }
        case 'todo_count_update': {
          const { count } = event.payload;
          result = this.updateTodoCount(body, count);
          break;
        }
        case 'deferred_items': {
          const { items, action } = event.payload;
          result = this.mutateDeferredItems(body, items, action);
          break;
        }
        default: {
          const _exhaustive: never = event;
          throw new Error(`Unknown MutationEvent type: ${(event as { type: string }).type}`);
        }
      }

      // Translate HelperResult → StateWriteOutcome. NOTE: when !result.applied
      // we skip syncFrontmatter + normalizeMd + putRecord (D-2026-05-10-08).
      // With HelperResult now a discriminated union (IN-01), `result.reason`
      // is required on the applied:false branch — no fallback needed.
      // IN-05: the outer withTransaction still holds the adapter lock and
      // created a tmp-txn directory on the way in. For pure dedupe /
      // nothing_to_remove paths this is paid-for overhead. Short-circuiting
      // would require reading STATE.md outside the lock, trading correctness
      // for speed — deferred.
      if (!result.applied) {
        return { applied: false, reason: result.reason };
      }
      const synced = await this.syncFrontmatter(result.body);
      const normalized = this.normalizeMd(synced);
      await this.putRecord('STATE.md', normalized);
      return result.created_section
        ? { applied: true, created_section: result.created_section }
        : { applied: true };
    });
  }

  /**
   * Signal-family event: writes/removes stateless flags.
   * Dual-write: .planning/WAITING.json via adapter + .gsd/WAITING.json via direct fs (Pitfall #4).
   *
   * Transaction semantics (IN-03):
   * The body is wrapped in `this.withTransaction(...)` so the
   * `.planning/WAITING.json` path participates in the adapter shadow-dir:
   * the `putRecord`/`removeRecord` calls against it honor the active
   * transaction, and an outer `adapter.withTransaction(...)` can roll
   * them back.
   *
   * LIMITATION: the dual-write to `.gsd/WAITING.json` uses direct
   * `writeFileSync` / `unlinkSync` and is OUTSIDE the adapter shadow-dir.
   * On rollback of an outer transaction, `.planning/WAITING.json` reverts
   * but `.gsd/WAITING.json` does NOT. This is intentional — `.gsd/` lives
   * at the project root (not under `.planning/`), and the shadow-dir is
   * scoped to `.planning/`. The two copies can drift in this narrow
   * rollback window; the next successful `recordStateSignal` call re-
   * synchronizes them. The `resume` path's existence check (WR-03) also
   * treats a drifted state where only `.gsd/WAITING.json` survives as
   * `applied: true` rather than `nothing_to_remove`.
   *
   * LIMITATION (IN-04): the `resume` branch's existence check has a
   * pre-existing TOCTOU window between `getRecord`/`existsSync` and the
   * subsequent `removeRecord`/`unlinkSync` calls. Functional impact is
   * zero because `removeRecord` silently swallows ENOENT (idempotent
   * remove) and `unlinkSync` is wrapped in `try/catch`. The outcome
   * string could be inaccurate in a rare multi-writer scenario;
   * `recordStateSignal` is NOT multi-writer-safe.
   */
  async recordStateSignal(event: SignalEvent): Promise<StateWriteOutcome> {
    return this.withTransaction(async () => {
      switch (event.type) {
        case 'waiting': {
          const { waitType, question, options, phase } = event.payload;
          const signal = {
            status: 'waiting',
            type: waitType,
            question: question ?? null,
            options: options ?? [],
            since: new Date().toISOString(),
            phase: phase ?? null,
          };
          const payload = JSON.stringify(signal, null, 2);
          // Write to .planning/WAITING.json via adapter (shadow-aware).
          await this.putRecord('WAITING.json', payload);
          // Dual-write to .gsd/WAITING.json (outside adapter scope per
          // Pitfall #4; not participant in shadow-dir — see JSDoc above).
          mkdirSync(join(this.projectDir, '.gsd'), { recursive: true });
          writeFileSync(join(this.projectDir, '.gsd', 'WAITING.json'), payload, 'utf-8');
          return { applied: true };
        }
        case 'resume': {
          // Distinguish "removed a real pause" from "nothing to resume"
          // (D-2026-05-10-08). Prior behavior was blind-unlink.
          //
          // WR-03: check BOTH `.planning/WAITING.json` AND `.gsd/WAITING.json`
          // so a drifted dual-write state (only the `.gsd/` copy present) is
          // reported as `applied: true` rather than a misleading
          // `nothing_to_remove` — the user's pause WAS cleared, even if the
          // two locations had gotten out of sync. Only report
          // `nothing_to_remove` when neither location held a copy.
          const planningExisted = (await this.getRecord('WAITING.json')) !== null;
          const gsdPath = join(this.projectDir, '.gsd', 'WAITING.json');
          const gsdExisted = existsSync(gsdPath);
          if (!planningExisted && !gsdExisted) {
            return { applied: false, reason: 'nothing_to_remove' };
          }
          if (planningExisted) await this.removeRecord('WAITING.json');
          try { unlinkSync(gsdPath); } catch { /* ENOENT OK */ }
          return { applied: true };
        }
        default: {
          const _exhaustive: never = event;
          throw new Error(`Unknown SignalEvent type: ${(event as { type: string }).type}`);
        }
      }
    });
  }

  // ─── recordState* internal helpers ──────────────────────────────────────────

  /** Strip YAML frontmatter from markdown content. */
  private stripFrontmatter(content: string): string {
    const match = content.match(/^---\n[\s\S]*?\n---\n*/);
    return match ? content.slice(match[0].length) : content;
  }

  /** Normalize markdown: collapse 3+ consecutive blank lines to 2, ensure trailing newline. */
  private normalizeMd(content: string): string {
    let result = content.replace(/\n{3,}/g, '\n\n');
    if (!result.endsWith('\n')) result += '\n';
    return result;
  }

  /** Rebuild frontmatter from body + disk via syncStateFrontmatter. */
  private async syncFrontmatter(body: string): Promise<string> {
    // Dynamic import using a variable to prevent TypeScript from following
    // the import for rootDir analysis (adapters tsconfig rootDir = ".").
    //
    // At runtime `import.meta.url` may point to either of:
    //   - adapters/dist/markdown/index.js   (normal dist path, 3 levels deep)
    //   - adapters/markdown/index.ts        (src path under vitest, 2 levels deep)
    // Choose the relative prefix based on which one we see; otherwise the
    // computed candidate URLs walk one parent too many from src and produce
    // `/Volumes/code/sdk/...` instead of `/Volumes/code/get-shit-done/sdk/...`.
    const isDist = import.meta.url.includes('/dist/');
    const prefix = isDist ? '../../../' : '../../';
    const distUrl = new URL(`${prefix}sdk/dist/query/state-mutation.js`, import.meta.url);
    const srcUrl = new URL(`${prefix}sdk/src/query/state-mutation.js`, import.meta.url);
    const modulePath = existsSync(fileURLToPath(distUrl)) ? distUrl.href : srcUrl.href;
    const mod = await (import(/* webpackIgnore: true */ modulePath) as Promise<{
      syncStateFrontmatter: (content: string, projectDir: string) => Promise<string>;
    }>);
    return mod.syncStateFrontmatter(body, this.projectDir);
  }

  // (appendToSection removed — Plan 03-06: zero remaining callers after the
  // seven helpers below were refactored to HelperResult. The helper was a
  // legacy primitive superseded by appendToOrCreateSection.)

  /**
   * Append a row to the Performance Metrics table (handles the table pattern).
   * Create-if-missing (Phase 3 UAT Bug 1 family): when the Performance
   * Metrics section + table don't exist, create both and append the first
   * row. Prior behavior silently dropped the write.
   */
  private appendToMetricsTable(content: string, entry: string): HelperResult {
    const metricsPattern = /(##\s*Performance Metrics[\s\S]*?\n\|[^\n]+\n\|[-|\s]+\n)([\s\S]*?)(?=\n##|\n$|$)/i;
    const match = content.match(metricsPattern);
    if (match) {
      let tableBody = match[2].trimEnd();
      if (tableBody.trim() === '' || tableBody.includes('None yet')) {
        tableBody = entry;
      } else {
        tableBody = tableBody + '\n' + entry;
      }
      const newBody = content.replace(metricsPattern, (_m, header: string) => `${header}${tableBody}\n`);
      return { body: newBody, applied: true };
    }
    // Section + table missing — scaffold both at end of file.
    const scaffold = '\n\n## Performance Metrics\n\n| Phase/Plan | Duration | Tasks | Files |\n|-----------|----------|-------|-------|\n';
    return {
      body: content.trimEnd() + `${scaffold}${entry}\n`,
      applied: true,
      created_section: '## Performance Metrics',
    };
  }

  /** Format a Roadmap Evolution entry line. */
  private formatRoadmapEvolutionEntry(opts: {
    phase: string;
    action: string;
    note?: string | null;
    after?: string | null;
    urgent?: boolean;
  }): string {
    const { phase, action, note, after, urgent } = opts;
    const trimmedNote = note ? note.trim() : '';
    if (action === 'inserted') {
      const afterClause = after ? ` after Phase ${after}` : '';
      let line = `- Phase ${phase} inserted${afterClause}`;
      if (trimmedNote) line += `: ${trimmedNote}`;
      if (urgent) line += ' (URGENT)';
      return line;
    }
    let line = `- Phase ${phase} ${action}`;
    if (trimmedNote) line += `: ${trimmedNote}`;
    return line;
  }

  /** Append entry to Roadmap Evolution subsection; create if missing. */
  private appendToRoadmapEvolution(content: string, entry: string): HelperResult {
    const subsectionPattern = /(###\s*Roadmap Evolution\s*\n)([\s\S]*?)(?=\n###?\s|\n##[^#]|$)/i;
    const match = content.match(subsectionPattern);

    if (match) {
      let sectionBody = match[2];
      // Dedupe: exact line match — surfaces reason:'duplicate' to the caller.
      // Previously this branch returned `content` unchanged and silently
      // reported success; the three-state StateWriteOutcome contract
      // (D-2026-05-10-08) makes the dedupe visible.
      const existingLines = sectionBody.split('\n').map(l => l.trim());
      if (existingLines.some(l => l === entry.trim())) {
        return { applied: false, reason: 'duplicate' };
      }
      // Strip placeholder
      sectionBody = sectionBody.replace(/^None(?:\s+yet)?\.?\s*$/gim, '');
      sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
      const newBody = content.replace(subsectionPattern, (_m, header: string) => `${header}${sectionBody}`);
      return { body: newBody, applied: true };
    }

    // Subsection missing — create under Accumulated Context or at EOF
    const accumulatedPattern = /(##\s*Accumulated Context\s*\n)/i;
    const newSubsection = `\n### Roadmap Evolution\n\n${entry}\n`;
    if (accumulatedPattern.test(content)) {
      return {
        body: content.replace(accumulatedPattern, (_m, header: string) => `${header}${newSubsection}`),
        applied: true,
        created_section: '### Roadmap Evolution',
      };
    }
    return {
      body: content.trimEnd() + `\n\n## Accumulated Context\n${newSubsection}\n`,
      applied: true,
      created_section: '### Roadmap Evolution',
    };
  }

  /**
   * Update session fields (Last session, Stopped At, Resume File) in body.
   * Create-if-missing (Phase 3 UAT Bug 1 family, Plan 03-06 extension):
   * scaffold a `## Session Continuity` section at EOF when no recognizable
   * session field matches. Prior behavior silently returned the input
   * unchanged — which would flow through the HelperResult discipline as
   * applied:true with no visible effect. Scaffolding matches decision /
   * metric / blocker parity and surfaces via created_section.
   */
  private updateSessionFields(content: string, stoppedAt?: string, resumeFile?: string): HelperResult {
    const now = new Date().toISOString();
    let working = content;
    let anyReplaced = false;

    // Track whether each field-replacement attempt actually modified content.
    // Independent updates (WR-01): refresh BOTH `Last session` AND `Last Date`
    // when both are present — a `??` short-circuit would leave the second
    // stale. The parallel `Stopped At`/`Stopped at` and `Resume File`/`Resume
    // file` pairs below are left with `??` because they are known-variant
    // spellings of the SAME field (only one exists on a given STATE.md), not
    // two independent fields that legacy layouts may both carry.
    let candidate = this.replaceFieldInBody(working, 'Last session', now);
    if (candidate !== null) { working = candidate; anyReplaced = true; }
    candidate = this.replaceFieldInBody(working, 'Last Date', now);
    if (candidate !== null) { working = candidate; anyReplaced = true; }

    if (stoppedAt) {
      const stopped = this.replaceFieldInBody(working, 'Stopped At', stoppedAt)
        ?? this.replaceFieldInBody(working, 'Stopped at', stoppedAt);
      if (stopped !== null) {
        working = stopped;
        anyReplaced = true;
      }
    }

    const rf = resumeFile ?? 'None';
    const rfUpdated = this.replaceFieldInBody(working, 'Resume File', rf)
      ?? this.replaceFieldInBody(working, 'Resume file', rf);
    if (rfUpdated !== null) {
      working = rfUpdated;
      anyReplaced = true;
    }

    if (anyReplaced) {
      return { body: working, applied: true };
    }

    // No field matched — scaffold a Session Continuity section at EOF.
    const lines: string[] = [];
    lines.push('## Session Continuity');
    lines.push('');
    lines.push(`Last session: ${now}`);
    if (stoppedAt) lines.push(`Stopped At: ${stoppedAt}`);
    lines.push(`Resume File: ${rf}`);
    const scaffold = lines.join('\n') + '\n';
    return {
      body: content.trimEnd() + `\n\n${scaffold}`,
      applied: true,
      created_section: '## Session Continuity',
    };
  }

  /** Replace a field value in body content (supports **bold:** and plain: formats). */
  private replaceFieldInBody(content: string, fieldName: string, newValue: string): string | null {
    const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boldPattern = new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i');
    if (boldPattern.test(content)) {
      return content.replace(boldPattern, (_m, prefix: string) => `${prefix}${newValue}`);
    }
    const plainPattern = new RegExp(`(^${escaped}:\\s*)(.*)`, 'im');
    if (plainPattern.test(content)) {
      return content.replace(plainPattern, (_m, prefix: string) => `${prefix}${newValue}`);
    }
    return null;
  }

  /** Append entry to a section (create section if missing). */
  private appendToOrCreateSection(
    content: string,
    pattern: RegExp,
    heading: string,
    entry: string,
  ): HelperResult {
    const match = content.match(pattern);
    if (match) {
      let sectionBody = match[2];
      sectionBody = sectionBody.replace(/None yet\.?\s*\n?/gi, '').replace(/^None\.?\s*\n?/gim, '');
      sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
      const newBody = content.replace(pattern, (_m, header: string) => `${header}${sectionBody}`);
      return { body: newBody, applied: true };
    }
    // Section not found — create at end.
    return {
      body: content.trimEnd() + `\n\n${heading}\n\n${entry}\n`,
      applied: true,
      created_section: heading,
    };
  }

  /** Remove a blocker line by text match and replace with "None" if empty. */
  private removeFromBlockersList(content: string, searchText: string): HelperResult {
    const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
    const match = content.match(sectionPattern);
    if (!match) {
      return { applied: false, reason: 'nothing_to_remove' };
    }
    const sectionBody = match[2];
    const lines = sectionBody.split('\n');
    const filtered = lines.filter(line => {
      if (!line.startsWith('- ')) return true;
      return !line.toLowerCase().includes(searchText.toLowerCase());
    });
    if (filtered.length === lines.length) {
      // Section exists but the target blocker wasn't found — structural no-op.
      return { applied: false, reason: 'nothing_to_remove' };
    }
    let newBody = filtered.join('\n');
    if (!newBody.trim() || !newBody.includes('- ')) {
      newBody = 'None\n';
    }
    const result = content.replace(sectionPattern, (_m, header: string) => `${header}${newBody}`);
    return { body: result, applied: true };
  }

  /**
   * Update the Pending todos section with a new count.
   * Create-if-missing (Phase 3 UAT Bug 1 family): scaffold a Pending todos
   * section when none exists. Prior behavior silently dropped the update.
   */
  private updateTodoCount(content: string, count: number): HelperResult {
    const todoPattern = /(##\s*Pending todos\s*\n)([\s\S]*?)(?=\n##|$)/i;
    const match = content.match(todoPattern);
    const replacement = count > 0 ? `(${count} items)\n` : '(none)\n';
    if (match) {
      const newBody = content.replace(todoPattern, (_m, header: string) => `${header}\n${replacement}`);
      return { body: newBody, applied: true };
    }
    // Section missing — append at end.
    return {
      body: content.trimEnd() + `\n\n## Pending todos\n\n${replacement}`,
      applied: true,
      created_section: '## Pending todos',
    };
  }

  /**
   * Mutate Deferred Ideas section: add or remove items.
   *
   * IN-02: the `add` path dedupes on exact-line match (parity with
   * `appendToRoadmapEvolution`). When EVERY requested item already exists
   * in the section, returns `{applied: false, reason: 'duplicate'}`. When
   * SOME items are duplicates and some are new, silently drops the
   * duplicates and appends only the genuinely new ones as applied:true.
   * The "some new" case intentionally does not surface a partial-duplicate
   * signal — StateWriteOutcome's two-reason contract does not encode it,
   * and callers that care can pre-filter before calling.
   */
  private mutateDeferredItems(content: string, items: string[], action: 'add' | 'remove'): HelperResult {
    const sectionPattern = /(###?\s*(?:Deferred Ideas|Deferred)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
    const match = content.match(sectionPattern);

    if (action === 'add') {
      if (match) {
        let sectionBody = match[2];
        // IN-02 dedupe: exact-line match against the existing Deferred Ideas
        // body. Mirrors appendToRoadmapEvolution's dedupe scope (subsection-
        // only, not whole-file; see D-2026-05-10-08 "Consequences").
        const existingLines = sectionBody.split('\n').map(l => l.trim());
        const newItems = items.filter(i => !existingLines.includes(`- ${i}`.trim()));
        if (newItems.length === 0) {
          return { applied: false, reason: 'duplicate' };
        }
        const entries = newItems.map(i => `- ${i}`).join('\n');
        sectionBody = sectionBody.replace(/^None\.?\s*\n?/gim, '').replace(/None yet\.?\s*\n?/gi, '');
        sectionBody = sectionBody.trimEnd() + '\n' + entries + '\n';
        const newBody = content.replace(sectionPattern, (_m, header: string) => `${header}${sectionBody}`);
        return { body: newBody, applied: true };
      }
      // Create section if missing
      const entries = items.map(i => `- ${i}`).join('\n');
      return {
        body: content.trimEnd() + `\n\n## Deferred Ideas\n\n${entries}\n`,
        applied: true,
        created_section: '## Deferred Ideas',
      };
    }

    // action === 'remove'
    if (!match) {
      return { applied: false, reason: 'nothing_to_remove' };
    }
    const sectionBody = match[2];
    const lines = sectionBody.split('\n');
    const lowerItems = items.map(i => i.toLowerCase());
    const filtered = lines.filter(line => {
      if (!line.startsWith('- ')) return true;
      const lineText = line.slice(2).trim().toLowerCase();
      return !lowerItems.some(item => lineText.includes(item));
    });
    if (filtered.length === lines.length) {
      // Section exists but none of the items matched a line — no-op.
      return { applied: false, reason: 'nothing_to_remove' };
    }
    let newBody = filtered.join('\n');
    if (!newBody.trim() || !newBody.includes('- ')) {
      newBody = 'None\n';
    }
    const result = content.replace(sectionPattern, (_m, header: string) => `${header}${newBody}`);
    return { body: result, applied: true };
  }

  async putNamedDoc(
    category: NamedDocCategory,
    key: string,
    body: string,
    opts?: { workstream?: string },
  ): Promise<void> {
    const base = category === 'root' ? `${key}.md` : `${category}/${key}.md`;
    const path = opts?.workstream ? `workstreams/${opts.workstream}/${base}` : base;
    // Inherits shadow-dir redirection via resolveWrite inside putRecord (Plan 03).
    await this.putRecord(path, body);
  }

  async getNamedDoc(
    category: NamedDocCategory,
    key: string,
    opts?: { workstream?: string },
  ): Promise<string | null> {
    const base = category === 'root' ? `${key}.md` : `${category}/${key}.md`;
    const path = opts?.workstream ? `workstreams/${opts.workstream}/${base}` : base;
    // Inherits shadow-over-real merge via resolveRead inside getRecord (Plan 03).
    return this.getRecord(path);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse a full ATX heading marker to { depth, text }.
 * Accepts "## Foo", "### Evidence 2026-05-01", "#### Sub-point".
 * Throws on non-ATX input (e.g. bare "Foo" or setext).
 */
interface ParsedAnchor { depth: number; text: string; }
function parseAnchor(anchor: string): ParsedAnchor {
  const m = anchor.match(/^(#{1,6})[ \t]+(.+?)[ \t]*$/);
  if (!m) {
    throw new Error(
      `Invalid anchor (not an ATX heading marker): ${JSON.stringify(anchor)}. ` +
      `Anchor must be of the form "## Foo" or "### Nested Foo".`,
    );
  }
  return { depth: m[1].length, text: m[2] };
}

/**
 * Phase 5 D-06: depth-aware section extraction.
 * - Anchor is the FULL ATX heading marker (e.g. "## Foo", "### Evidence").
 * - Section terminates at the next heading of depth <= anchor depth.
 * - Skips headings inside fenced code blocks (``` fences) and HTML comments.
 * - Setext-style headings (Foo\n===) emit console.warn (D-08) and are treated
 *   as non-headings (the bar-line does not become an anchor).
 * - Duplicate anchors resolve to document-order first-match (D-07).
 */
function extractSection(
  text: string,
  anchor: string,
): { found: boolean; body: string | null } {
  const { depth, text: anchorText } = parseAnchor(anchor);
  const anchorRe = new RegExp(`^#{${depth}}[ \\t]+${escapeRegExp(anchorText)}[ \\t]*$`);
  const headingRe = /^(#{1,6})[ \t]+/;

  const lines = text.split('\n');
  let inSection = false;
  let inFence = false;
  let inComment = false;
  const bodyLines: string[] = [];
  let prevNonBlank: string | null = null;

  for (const line of lines) {
    // Fenced-code toggle (CommonMark: up to 3 leading spaces, ``` or ~~~).
    const fenceMatch = /^[ ]{0,3}(`{3,}|~{3,})/.test(line);
    if (fenceMatch) { inFence = !inFence; prevNonBlank = line; if (inSection) bodyLines.push(line); continue; }

    // Setext detection (D-08 warning): prior non-blank line followed by ==== or ----.
    if (!inFence && prevNonBlank !== null && prevNonBlank.trim() !== '' && /^(=+|-+)[ \t]*$/.test(line)) {
      // eslint-disable-next-line no-console
      console.warn(`MarkdownAdapter: setext-style heading detected (unsupported; use ATX). Line: ${JSON.stringify(prevNonBlank)}`);
      // Continue treating the text line as a normal body line; do NOT split.
    }

    // HTML-comment range tracking.
    if (!inFence) {
      if (!inComment && /<!--/.test(line) && !/-->/.test(line)) inComment = true;
      else if (inComment && /-->/.test(line)) { inComment = false; if (inSection) bodyLines.push(line); prevNonBlank = line; continue; }
    }

    if (!inSection) {
      if (!inFence && !inComment && anchorRe.test(line)) {
        inSection = true;
      }
      prevNonBlank = line.trim() === '' ? prevNonBlank : line;
      continue;
    }

    // Inside the section: detect terminator.
    if (!inFence && !inComment) {
      const hm = line.match(headingRe);
      if (hm && hm[1].length <= depth) break;
    }
    bodyLines.push(line);
    prevNonBlank = line.trim() === '' ? prevNonBlank : line;
  }

  if (!inSection) return { found: false, body: null };
  const raw = bodyLines.join('\n');
  const trimmed = raw.replace(/^\n+/g, '').replace(/\n+$/g, '');
  return { found: true, body: trimmed };
}

/**
 * Phase 5 D-06: depth-aware section replacement.
 * Same walker mechanics as extractSection; replaces body up to the
 * same-or-shallower terminator.
 */
function replaceSection(text: string, anchor: string, newBody: string): string {
  const { depth, text: anchorText } = parseAnchor(anchor);
  const anchorRe = new RegExp(`^#{${depth}}[ \\t]+${escapeRegExp(anchorText)}[ \\t]*$`);
  const headingRe = /^(#{1,6})[ \t]+/;

  const lines = text.split('\n');
  const out: string[] = [];
  let i = 0;
  let inFence = false;
  let inComment = false;
  let replaced = false;

  // Walk until anchor, preserving fence/comment state on the pre-section path.
  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = /^[ ]{0,3}(`{3,}|~{3,})/.test(line);
    if (fenceMatch) inFence = !inFence;
    if (!inFence) {
      if (!inComment && /<!--/.test(line) && !/-->/.test(line)) inComment = true;
      else if (inComment && /-->/.test(line)) inComment = false;
    }

    if (!replaced && !inFence && !inComment && anchorRe.test(line)) {
      // Emit heading, skip old body up to terminator, emit newBody.
      out.push(line);
      i++;
      while (i < lines.length) {
        const innerLine = lines[i];
        const innerFence = /^[ ]{0,3}(`{3,}|~{3,})/.test(innerLine);
        if (innerFence) { inFence = !inFence; i++; continue; }
        if (!inFence) {
          if (!inComment && /<!--/.test(innerLine) && !/-->/.test(innerLine)) inComment = true;
          else if (inComment && /-->/.test(innerLine)) { inComment = false; i++; continue; }
        }
        if (!inFence && !inComment) {
          const hm = innerLine.match(headingRe);
          if (hm && hm[1].length <= depth) break;  // terminator
        }
        i++;  // discard old body line
      }
      out.push('');
      out.push(newBody);
      out.push('');
      replaced = true;
      continue;
    }

    out.push(line);
    i++;
  }

  // Emit remaining lines (post-section) unchanged.
  while (i < lines.length) { out.push(lines[i]); i++; }

  return out.join('\n');
}
