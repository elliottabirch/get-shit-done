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

  // ─── Event family methods (Phase 3 Plan 02) ────────────────────────────────

  /**
   * Append-family event: adds entries to STATE.md sections.
   * Section targeting dispatches on event.type → correct STATE.md section regex.
   * Pipeline: withTransaction → getRecord → strip frontmatter → find section →
   * append formatted entry → syncStateFrontmatter → normalize → putRecord.
   */
  async recordStateAppend(event: AppendEvent): Promise<void> {
    await this.withTransaction(async () => {
      const raw = (await this.getRecord('STATE.md')) ?? '';
      const body = this.stripFrontmatter(raw);
      let modified: string;

      switch (event.type) {
        case 'decision': {
          const { phase, summary, rationale } = event.payload;
          const entry = `- [Phase ${phase || '?'}]: ${summary}${rationale ? ` — ${rationale}` : ''}`;
          modified = this.appendToSection(
            body,
            /(###?\s*(?:Decisions|Decisions Made|Accumulated.*Decisions)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i,
            entry,
          );
          break;
        }
        case 'metric': {
          const { phase, plan, duration, tasks, files } = event.payload;
          const entry = `| Phase ${phase} P${plan} | ${duration} | ${tasks || '-'} tasks | ${files || '-'} files |`;
          modified = this.appendToMetricsTable(body, entry);
          break;
        }
        case 'roadmap_evolution': {
          const { phase, action, note, after, urgent } = event.payload;
          const entry = this.formatRoadmapEvolutionEntry({ phase, action, note, after, urgent });
          modified = this.appendToRoadmapEvolution(body, entry);
          break;
        }
        case 'session': {
          const { stoppedAt, resumeFile } = event.payload;
          modified = this.updateSessionFields(body, stoppedAt, resumeFile);
          break;
        }
        case 'forensic_session': {
          const { sessionId, findings } = event.payload;
          const entry = `- ${sessionId}: ${findings}`;
          modified = this.appendToOrCreateSection(
            body,
            /(##\s*Forensic Sessions\s*\n)([\s\S]*?)(?=\n##|$)/i,
            '## Forensic Sessions',
            entry,
          );
          break;
        }
        case 'quick_task': {
          const { task, result } = event.payload;
          const entry = `- ${task}${result ? ': ' + result : ''}`;
          modified = this.appendToOrCreateSection(
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

      const synced = await this.syncFrontmatter(modified);
      const normalized = this.normalizeMd(synced);
      await this.putRecord('STATE.md', normalized);
    });
  }

  /**
   * Mutation-family event: modifies existing lists in STATE.md sections.
   * Pipeline: withTransaction → getRecord → strip frontmatter → mutate list →
   * syncStateFrontmatter → normalize → putRecord.
   */
  async recordStateMutation(event: MutationEvent): Promise<void> {
    await this.withTransaction(async () => {
      const raw = (await this.getRecord('STATE.md')) ?? '';
      const body = this.stripFrontmatter(raw);
      let modified: string;

      switch (event.type) {
        case 'blocker_added': {
          const { text } = event.payload;
          const entry = `- ${text}`;
          modified = this.appendToSection(
            body,
            /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i,
            entry,
          );
          break;
        }
        case 'blocker_resolved': {
          const { text } = event.payload;
          modified = this.removeFromBlockersList(body, text);
          break;
        }
        case 'todo_count_update': {
          const { count } = event.payload;
          modified = this.updateTodoCount(body, count);
          break;
        }
        case 'deferred_items': {
          const { items, action } = event.payload;
          modified = this.mutateDeferredItems(body, items, action);
          break;
        }
        default: {
          const _exhaustive: never = event;
          throw new Error(`Unknown MutationEvent type: ${(event as { type: string }).type}`);
        }
      }

      const synced = await this.syncFrontmatter(modified);
      const normalized = this.normalizeMd(synced);
      await this.putRecord('STATE.md', normalized);
    });
  }

  /**
   * Signal-family event: writes/removes stateless flags.
   * Dual-write: .planning/WAITING.json via adapter + .gsd/WAITING.json via direct fs (Pitfall #4).
   */
  async recordStateSignal(event: SignalEvent): Promise<void> {
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
        // Write to .planning/WAITING.json via adapter
        await this.putRecord('WAITING.json', payload);
        // Dual-write to .gsd/WAITING.json (outside adapter scope per Pitfall #4)
        mkdirSync(join(this.projectDir, '.gsd'), { recursive: true });
        writeFileSync(join(this.projectDir, '.gsd', 'WAITING.json'), payload, 'utf-8');
        break;
      }
      case 'resume': {
        // Remove WAITING.json via adapter
        await this.removeRecord('WAITING.json');
        // Remove .gsd/WAITING.json (outside adapter scope)
        try { unlinkSync(join(this.projectDir, '.gsd', 'WAITING.json')); } catch { /* ENOENT OK */ }
        break;
      }
      default: {
        const _exhaustive: never = event;
        throw new Error(`Unknown SignalEvent type: ${(event as { type: string }).type}`);
      }
    }
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
    // the import for rootDir analysis (adapters tsconfig rootDir = ".")
    const modulePath = '../../sdk/src/query/state-mutation.js';
    const mod = await (import(/* webpackIgnore: true */ modulePath) as Promise<{
      syncStateFrontmatter: (content: string, projectDir: string) => Promise<string>;
    }>);
    return mod.syncStateFrontmatter(body, this.projectDir);
  }

  /** Append entry to a section matched by regex pattern. Strips placeholder text. */
  private appendToSection(content: string, pattern: RegExp, entry: string): string {
    const match = content.match(pattern);
    if (!match) return content;
    let sectionBody = match[2];
    // Strip common placeholder lines
    sectionBody = sectionBody.replace(/None yet\.?\s*\n?/gi, '').replace(/No decisions yet\.?\s*\n?/gi, '').replace(/^None\.?\s*\n?/gim, '');
    sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
    return content.replace(pattern, (_m, header: string) => `${header}${sectionBody}`);
  }

  /** Append a row to the Performance Metrics table (handles the table pattern). */
  private appendToMetricsTable(content: string, entry: string): string {
    const metricsPattern = /(##\s*Performance Metrics[\s\S]*?\n\|[^\n]+\n\|[-|\s]+\n)([\s\S]*?)(?=\n##|\n$|$)/i;
    const match = content.match(metricsPattern);
    if (!match) return content;
    let tableBody = match[2].trimEnd();
    if (tableBody.trim() === '' || tableBody.includes('None yet')) {
      tableBody = entry;
    } else {
      tableBody = tableBody + '\n' + entry;
    }
    return content.replace(metricsPattern, (_m, header: string) => `${header}${tableBody}\n`);
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
  private appendToRoadmapEvolution(content: string, entry: string): string {
    const subsectionPattern = /(###\s*Roadmap Evolution\s*\n)([\s\S]*?)(?=\n###?\s|\n##[^#]|$)/i;
    const match = content.match(subsectionPattern);

    if (match) {
      let sectionBody = match[2];
      // Dedupe: exact line match
      const existingLines = sectionBody.split('\n').map(l => l.trim());
      if (existingLines.some(l => l === entry.trim())) return content;
      // Strip placeholder
      sectionBody = sectionBody.replace(/^None(?:\s+yet)?\.?\s*$/gim, '');
      sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
      return content.replace(subsectionPattern, (_m, header: string) => `${header}${sectionBody}`);
    }

    // Subsection missing — create under Accumulated Context or at EOF
    const accumulatedPattern = /(##\s*Accumulated Context\s*\n)/i;
    const newSubsection = `\n### Roadmap Evolution\n\n${entry}\n`;
    if (accumulatedPattern.test(content)) {
      return content.replace(accumulatedPattern, (_m, header: string) => `${header}${newSubsection}`);
    }
    return content.trimEnd() + `\n\n## Accumulated Context\n${newSubsection}\n`;
  }

  /** Update session fields (Last session, Stopped At, Resume File) in body. */
  private updateSessionFields(content: string, stoppedAt?: string, resumeFile?: string): string {
    const now = new Date().toISOString();
    let result = content;

    // Update Last session
    result = this.replaceFieldInBody(result, 'Last session', now) ?? result;
    result = this.replaceFieldInBody(result, 'Last Date', now) ?? result;

    // Update Stopped At
    if (stoppedAt) {
      const updated = this.replaceFieldInBody(result, 'Stopped At', stoppedAt)
        ?? this.replaceFieldInBody(result, 'Stopped at', stoppedAt);
      if (updated) result = updated;
    }

    // Update Resume File
    const rf = resumeFile ?? 'None';
    const rfUpdated = this.replaceFieldInBody(result, 'Resume File', rf)
      ?? this.replaceFieldInBody(result, 'Resume file', rf);
    if (rfUpdated) result = rfUpdated;

    return result;
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
  ): string {
    const match = content.match(pattern);
    if (match) {
      let sectionBody = match[2];
      sectionBody = sectionBody.replace(/None yet\.?\s*\n?/gi, '').replace(/^None\.?\s*\n?/gim, '');
      sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
      return content.replace(pattern, (_m, header: string) => `${header}${sectionBody}`);
    }
    // Section not found — create at end
    return content.trimEnd() + `\n\n${heading}\n\n${entry}\n`;
  }

  /** Remove a blocker line by text match and replace with "None" if empty. */
  private removeFromBlockersList(content: string, searchText: string): string {
    const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
    const match = content.match(sectionPattern);
    if (!match) return content;
    const sectionBody = match[2];
    const lines = sectionBody.split('\n');
    const filtered = lines.filter(line => {
      if (!line.startsWith('- ')) return true;
      return !line.toLowerCase().includes(searchText.toLowerCase());
    });
    let newBody = filtered.join('\n');
    if (!newBody.trim() || !newBody.includes('- ')) {
      newBody = 'None\n';
    }
    return content.replace(sectionPattern, (_m, header: string) => `${header}${newBody}`);
  }

  /** Update the Pending todos section with a new count. */
  private updateTodoCount(content: string, count: number): string {
    const todoPattern = /(##\s*Pending todos\s*\n)([\s\S]*?)(?=\n##|$)/i;
    const match = content.match(todoPattern);
    if (match) {
      const replacement = count > 0 ? `(${count} items)\n` : '(none)\n';
      return content.replace(todoPattern, (_m, header: string) => `${header}\n${replacement}`);
    }
    return content;
  }

  /** Mutate Deferred Ideas section: add or remove items. */
  private mutateDeferredItems(content: string, items: string[], action: 'add' | 'remove'): string {
    const sectionPattern = /(###?\s*(?:Deferred Ideas|Deferred)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
    const match = content.match(sectionPattern);

    if (action === 'add') {
      const entries = items.map(i => `- ${i}`).join('\n');
      if (match) {
        let sectionBody = match[2];
        sectionBody = sectionBody.replace(/^None\.?\s*\n?/gim, '').replace(/None yet\.?\s*\n?/gi, '');
        sectionBody = sectionBody.trimEnd() + '\n' + entries + '\n';
        return content.replace(sectionPattern, (_m, header: string) => `${header}${sectionBody}`);
      }
      // Create section if missing
      return content.trimEnd() + `\n\n## Deferred Ideas\n\n${entries}\n`;
    }

    // action === 'remove'
    if (!match) return content;
    const sectionBody = match[2];
    const lines = sectionBody.split('\n');
    const lowerItems = items.map(i => i.toLowerCase());
    const filtered = lines.filter(line => {
      if (!line.startsWith('- ')) return true;
      const lineText = line.slice(2).trim().toLowerCase();
      return !lowerItems.some(item => lineText.includes(item));
    });
    let newBody = filtered.join('\n');
    if (!newBody.trim() || !newBody.includes('- ')) {
      newBody = 'None\n';
    }
    return content.replace(sectionPattern, (_m, header: string) => `${header}${newBody}`);
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
