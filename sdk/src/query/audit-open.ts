/**
 * Open Artifact Audit — full TypeScript port of `get-shit-done/bin/lib/audit.cjs`.
 *
 * Scans `.planning/` artifact categories for unresolved items (same JSON as gsd-tools `audit-open`).
 *
 * Phase 2 Plan 02-02 Task 2 (D-12, D-10, Pitfall 2, Pitfall 3): adapter-as-first-arg
 * signature; all 8 artifact-category scanners route through `adapter.listCollection`
 * + `adapter.getRecord`. Per-file reads inside each scanner use `Promise.all` to
 * parallelize (Pitfall 2). Redundant `exists()` checks before `listCollection()`
 * removed (Pitfall 3 — listCollection returns [] on ENOENT).
 */

import { basename } from 'node:path';

import { extractFrontmatter } from './frontmatter.js';
import { planningRelativePath, sanitizeForDisplay } from './helpers.js';
import type { QueryResult } from './utils.js';
import type { StorageAdapter, RecordRef } from '../../../adapters/types.js';

async function scanDebugSessions(
  adapter: StorageAdapter,
  workstream: string | undefined,
): Promise<Array<Record<string, unknown>>> {
  // Pitfall 3: listCollection returns [] on ENOENT — no redundant exists() check needed
  const debugRel = planningRelativePath(workstream, 'debug');
  let entries: RecordRef[];
  try {
    entries = await adapter.listCollection(debugRel);
  } catch {
    return [{ scan_error: true }];
  }
  const mdRefs = entries.filter(e => e.name.endsWith('.md'));

  // Pitfall 2: parallelize per-file reads
  const reads = await Promise.all(
    mdRefs.map(async ref => ({
      ref,
      content: await adapter.getRecord(ref.path),
    })),
  );

  const results: Array<Record<string, unknown>> = [];
  for (const { ref, content } of reads) {
    if (content === null) {
      results.push({
        slug: sanitizeForDisplay(basename(ref.name, '.md')),
        status: 'unreadable',
        scan_error: true,
        detail: 'file read failed',
      });
      continue;
    }

    const fm = extractFrontmatter(content);
    const status = (fm.status || 'unknown').toString().toLowerCase();
    if (status === 'resolved' || status === 'complete') continue;

    let hypothesis = '';
    const focusMatch = content.match(/##\s*Current Focus[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
    if (focusMatch) {
      const focusText = focusMatch[1].trim().split('\n')[0].trim();
      hypothesis = sanitizeForDisplay(focusText.slice(0, 100));
    }

    const slug = basename(ref.name, '.md');
    results.push({
      slug: sanitizeForDisplay(slug),
      status: sanitizeForDisplay(status),
      updated: sanitizeForDisplay(String(fm.updated || fm.date || '')),
      hypothesis,
    });
  }

  return results;
}

async function scanQuickTasks(
  adapter: StorageAdapter,
  workstream: string | undefined,
): Promise<Array<Record<string, unknown>>> {
  const quickRel = planningRelativePath(workstream, 'quick');
  // Pitfall 3: listCollection returns [] on ENOENT
  let entries: RecordRef[];
  try {
    entries = await adapter.listCollection(quickRel);
  } catch {
    return [{ scan_error: true }];
  }

  // Filter to subdirectories only — probe via stat in parallel (Pitfall 2)
  const dirChecks = await Promise.all(
    entries.map(async e => ({
      ref: e,
      isDir: ((await adapter.stat(e.path))?.kind === 'dir'),
    })),
  );
  const dirEntries = dirChecks.filter(c => c.isDir).map(c => c.ref);

  // Read SUMMARY.md for each task dir in parallel
  const summaries = await Promise.all(
    dirEntries.map(async ref => ({
      ref,
      summary: await adapter.getRecord(`${ref.path}/SUMMARY.md`),
    })),
  );

  const results: Array<Record<string, unknown>> = [];
  for (const { ref, summary } of summaries) {
    const dirName = ref.name;

    let status = 'missing';
    const description = '';

    if (summary !== null) {
      const fm = extractFrontmatter(summary);
      status = (fm.status || 'unknown').toString().toLowerCase();
    }

    if (status === 'complete') continue;

    let date = '';
    let slug = sanitizeForDisplay(dirName);
    const dateMatch = dirName.match(/^(\d{4}-?\d{2}-?\d{2})-(.+)$/);
    if (dateMatch) {
      date = dateMatch[1];
      slug = sanitizeForDisplay(dateMatch[2]);
    }

    results.push({
      slug,
      date,
      status: sanitizeForDisplay(status),
      description,
    });
  }

  return results;
}

async function scanThreads(
  adapter: StorageAdapter,
  workstream: string | undefined,
): Promise<Array<Record<string, unknown>>> {
  const threadsRel = planningRelativePath(workstream, 'threads');
  let entries: RecordRef[];
  try {
    entries = await adapter.listCollection(threadsRel);
  } catch {
    return [{ scan_error: true }];
  }

  const openStatuses = new Set(['open', 'in_progress', 'in progress']);
  const mdRefs = entries.filter(e => e.name.endsWith('.md'));

  // Pitfall 2: parallelize reads
  const reads = await Promise.all(
    mdRefs.map(async ref => ({
      ref,
      content: await adapter.getRecord(ref.path),
    })),
  );

  const results: Array<Record<string, unknown>> = [];
  for (const { ref, content } of reads) {
    if (content === null) {
      results.push({
        slug: sanitizeForDisplay(basename(ref.name, '.md')),
        status: 'unreadable',
        scan_error: true,
        detail: 'file read failed',
      });
      continue;
    }

    const fm = extractFrontmatter(content);
    let status = (fm.status || '').toString().toLowerCase().trim();

    if (!status) {
      const bodyStatusMatch = content.match(/##\s*Status:\s*(OPEN|IN PROGRESS|IN_PROGRESS)/i);
      if (bodyStatusMatch) {
        status = bodyStatusMatch[1].toLowerCase().replace(/ /g, '_');
      }
    }

    if (!openStatuses.has(status)) continue;

    let title = sanitizeForDisplay(String(fm.title || ''));
    if (!title) {
      const headingMatch = content.match(/^#\s*Thread:\s*(.+)$/m);
      if (headingMatch) {
        title = sanitizeForDisplay(headingMatch[1].trim().slice(0, 100));
      }
    }

    const slug = basename(ref.name, '.md');
    results.push({
      slug: sanitizeForDisplay(slug),
      status: sanitizeForDisplay(status),
      updated: sanitizeForDisplay(String(fm.updated || fm.date || '')),
      title,
    });
  }

  return results;
}

async function scanTodos(
  adapter: StorageAdapter,
  workstream: string | undefined,
): Promise<Array<Record<string, unknown>>> {
  const pendingRel = planningRelativePath(workstream, 'todos/pending');
  let entries: RecordRef[];
  try {
    entries = await adapter.listCollection(pendingRel);
  } catch {
    return [{ scan_error: true }];
  }

  const mdRefs = entries.filter(e => e.name.endsWith('.md'));
  const results: Array<Record<string, unknown>> = [];

  const displayRefs = mdRefs.slice(0, 5);
  // Pitfall 2: parallelize reads
  const reads = await Promise.all(
    displayRefs.map(async ref => ({
      ref,
      content: await adapter.getRecord(ref.path),
    })),
  );

  for (const { ref, content } of reads) {
    if (content === null) continue;

    const fm = extractFrontmatter(content);
    const bodyMatch = content.replace(/^---[\s\S]*?---\n?/, '');
    const firstLine = bodyMatch.trim().split('\n')[0] || '';
    const summary = sanitizeForDisplay(firstLine.slice(0, 100));

    results.push({
      filename: sanitizeForDisplay(ref.name),
      priority: sanitizeForDisplay(String(fm.priority || '')),
      area: sanitizeForDisplay(String(fm.area || '')),
      summary,
    });
  }

  if (mdRefs.length > 5) {
    results.push({ _remainder_count: mdRefs.length - 5 });
  }

  return results;
}

async function scanSeeds(
  adapter: StorageAdapter,
  workstream: string | undefined,
): Promise<Array<Record<string, unknown>>> {
  const seedsRel = planningRelativePath(workstream, 'seeds');
  let entries: RecordRef[];
  try {
    entries = await adapter.listCollection(seedsRel);
  } catch {
    return [{ scan_error: true }];
  }

  const seedRefs = entries.filter(e => e.name.startsWith('SEED-') && e.name.endsWith('.md'));
  const unimplementedStatuses = new Set(['dormant', 'active', 'triggered']);

  // Pitfall 2: parallelize reads
  const reads = await Promise.all(
    seedRefs.map(async ref => ({
      ref,
      content: await adapter.getRecord(ref.path),
    })),
  );

  const results: Array<Record<string, unknown>> = [];
  for (const { ref, content } of reads) {
    if (content === null) continue;

    const fm = extractFrontmatter(content);
    const status = (fm.status || 'dormant').toString().toLowerCase();

    if (!unimplementedStatuses.has(status)) continue;

    const seedIdMatch = ref.name.match(/^(SEED-[\w-]+)\.md$/);
    const seed_id = seedIdMatch ? seedIdMatch[1] : basename(ref.name, '.md');
    const slug = sanitizeForDisplay(seed_id.replace(/^SEED-/, ''));

    let title = sanitizeForDisplay(String(fm.title || ''));
    if (!title) {
      const headingMatch = content.match(/^#\s*(.+)$/m);
      if (headingMatch) title = sanitizeForDisplay(headingMatch[1].trim().slice(0, 100));
    }

    results.push({
      seed_id: sanitizeForDisplay(seed_id),
      slug,
      status: sanitizeForDisplay(status),
      title,
    });
  }

  return results;
}

/**
 * Walk every phase directory and aggregate per-phase scan results in parallel.
 * Shared by scanUatGaps, scanVerificationGaps, scanContextQuestions.
 *
 * @param matchFile - test the file basename for inclusion
 * @param processFile - returns the result row to append (or null to skip)
 */
async function scanPhaseFiles(
  adapter: StorageAdapter,
  workstream: string | undefined,
  matchFile: (name: string) => boolean,
  processFile: (params: {
    phaseNum: string;
    file: string;
    content: string;
    fm: Record<string, unknown>;
  }) => Record<string, unknown> | null,
): Promise<Array<Record<string, unknown>>> {
  const phasesRel = planningRelativePath(workstream, 'phases');
  let phaseRefs: RecordRef[];
  try {
    phaseRefs = await adapter.listCollection(phasesRel);
  } catch {
    return [{ scan_error: true }];
  }

  // Filter to phase directories — Promise.all stat probes (Pitfall 2)
  const dirChecks = await Promise.all(
    phaseRefs.map(async r => ({
      ref: r,
      isDir: ((await adapter.stat(r.path))?.kind === 'dir'),
    })),
  );
  const phaseDirRefs = dirChecks
    .filter(c => c.isDir)
    .map(c => c.ref)
    .sort((a, b) => a.name.localeCompare(b.name));

  // For each phase: list its files, filter by matchFile, read in parallel (Pitfall 2)
  const perPhase = await Promise.all(
    phaseDirRefs.map(async phaseRef => {
      const phaseMatch = phaseRef.name.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
      const phaseNum = phaseMatch ? phaseMatch[1] : phaseRef.name;
      let fileRefs: RecordRef[];
      try {
        fileRefs = await adapter.listCollection(phaseRef.path);
      } catch {
        return [] as Array<Record<string, unknown>>;
      }
      const matched = fileRefs.filter(r => matchFile(r.name));
      const reads = await Promise.all(
        matched.map(async fileRef => ({
          fileRef,
          content: await adapter.getRecord(fileRef.path),
        })),
      );
      const phaseResults: Array<Record<string, unknown>> = [];
      for (const { fileRef, content } of reads) {
        if (content === null) continue;
        const fm = extractFrontmatter(content);
        const row = processFile({
          phaseNum,
          file: fileRef.name,
          content,
          fm,
        });
        if (row) phaseResults.push(row);
      }
      return phaseResults;
    }),
  );

  return perPhase.flat();
}

async function scanUatGaps(
  adapter: StorageAdapter,
  workstream: string | undefined,
): Promise<Array<Record<string, unknown>>> {
  return scanPhaseFiles(
    adapter,
    workstream,
    name => name.includes('-UAT') && name.endsWith('.md'),
    ({ phaseNum, file, content, fm }) => {
      const status = (fm.status || 'unknown').toString().toLowerCase();
      if (status === 'complete') return null;
      const pendingMatches = (content.match(/result:\s*(?:pending|\[pending\])/gi) || []).length;
      return {
        phase: sanitizeForDisplay(phaseNum),
        file: sanitizeForDisplay(file),
        status: sanitizeForDisplay(status),
        open_scenario_count: pendingMatches,
      };
    },
  );
}

async function scanVerificationGaps(
  adapter: StorageAdapter,
  workstream: string | undefined,
): Promise<Array<Record<string, unknown>>> {
  return scanPhaseFiles(
    adapter,
    workstream,
    name => name.includes('-VERIFICATION') && name.endsWith('.md'),
    ({ phaseNum, file, fm }) => {
      const status = (fm.status || 'unknown').toString().toLowerCase();
      if (status !== 'gaps_found' && status !== 'human_needed') return null;
      return {
        phase: sanitizeForDisplay(phaseNum),
        file: sanitizeForDisplay(file),
        status: sanitizeForDisplay(status),
      };
    },
  );
}

async function scanContextQuestions(
  adapter: StorageAdapter,
  workstream: string | undefined,
): Promise<Array<Record<string, unknown>>> {
  return scanPhaseFiles(
    adapter,
    workstream,
    name => name.includes('-CONTEXT') && name.endsWith('.md'),
    ({ phaseNum, file, content, fm }) => {
      let questions: string[] = [];
      if (fm.open_questions) {
        if (Array.isArray(fm.open_questions) && fm.open_questions.length > 0) {
          questions = fm.open_questions.map(q => sanitizeForDisplay(String(q).slice(0, 200)));
        }
      }

      if (questions.length === 0) {
        const oqMatch = content.match(/##\s*Open Questions[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
        if (oqMatch) {
          const oqBody = oqMatch[1].trim();
          if (oqBody && oqBody.length > 0 && !/^\s*none\s*$/i.test(oqBody)) {
            const items = oqBody.split('\n')
              .map(l => l.trim())
              .filter(l => l && l !== '-' && l !== '*')
              .filter(l => /^[-*\d]/.test(l) || l.includes('?'));
            questions = items.slice(0, 3).map(q => sanitizeForDisplay(q.slice(0, 200)));
          }
        }
      }

      if (questions.length === 0) return null;

      return {
        phase: sanitizeForDisplay(phaseNum),
        file: sanitizeForDisplay(file),
        question_count: questions.length,
        questions: questions.slice(0, 3),
      };
    },
  );
}

export interface AuditOpenResult {
  scanned_at: string;
  /** True when at least one category reported scan_error / unreadable rows (audit may be incomplete). */
  has_scan_errors: boolean;
  has_open_items: boolean;
  counts: {
    debug_sessions: number;
    quick_tasks: number;
    threads: number;
    todos: number;
    seeds: number;
    uat_gaps: number;
    verification_gaps: number;
    context_questions: number;
    total: number;
  };
  items: {
    debug_sessions: Array<Record<string, unknown>>;
    quick_tasks: Array<Record<string, unknown>>;
    threads: Array<Record<string, unknown>>;
    todos: Array<Record<string, unknown>>;
    seeds: Array<Record<string, unknown>>;
    uat_gaps: Array<Record<string, unknown>>;
    verification_gaps: Array<Record<string, unknown>>;
    context_questions: Array<Record<string, unknown>>;
  };
}

/**
 * Same structured result as `gsd-tools.cjs audit-open` (JSON).
 *
 * Phase 2 Plan 02-02 Task 2: now adapter-aware. Runs all 8 category scanners
 * in parallel (Promise.all top-level) and each scanner uses Promise.all per
 * read inside (Pitfall 2).
 */
export async function auditOpenArtifacts(
  adapter: StorageAdapter,
  _projectDir: string,
  workstream?: string,
): Promise<AuditOpenResult> {
  const [
    debugSessions,
    quickTasks,
    threads,
    todos,
    seeds,
    uatGaps,
    verificationGaps,
    contextQuestions,
  ] = await Promise.all([
    scanDebugSessions(adapter, workstream).catch(() => [{ scan_error: true }] as Array<Record<string, unknown>>),
    scanQuickTasks(adapter, workstream).catch(() => [{ scan_error: true }] as Array<Record<string, unknown>>),
    scanThreads(adapter, workstream).catch(() => [{ scan_error: true }] as Array<Record<string, unknown>>),
    scanTodos(adapter, workstream).catch(() => [{ scan_error: true }] as Array<Record<string, unknown>>),
    scanSeeds(adapter, workstream).catch(() => [{ scan_error: true }] as Array<Record<string, unknown>>),
    scanUatGaps(adapter, workstream).catch(() => [{ scan_error: true }] as Array<Record<string, unknown>>),
    scanVerificationGaps(adapter, workstream).catch(() => [{ scan_error: true }] as Array<Record<string, unknown>>),
    scanContextQuestions(adapter, workstream).catch(() => [{ scan_error: true }] as Array<Record<string, unknown>>),
  ]);

  const countReal = (arr: Array<Record<string, unknown>>): number =>
    arr.filter(i => !i.scan_error && !i._remainder_count).length;

  const counts = {
    debug_sessions: countReal(debugSessions),
    quick_tasks: countReal(quickTasks),
    threads: countReal(threads),
    todos: countReal(todos),
    seeds: countReal(seeds),
    uat_gaps: countReal(uatGaps),
    verification_gaps: countReal(verificationGaps),
    context_questions: countReal(contextQuestions),
    total: 0,
  };
  counts.total =
    counts.debug_sessions +
    counts.quick_tasks +
    counts.threads +
    counts.todos +
    counts.seeds +
    counts.uat_gaps +
    counts.verification_gaps +
    counts.context_questions;

  const itemArrays = [
    debugSessions,
    quickTasks,
    threads,
    todos,
    seeds,
    uatGaps,
    verificationGaps,
    contextQuestions,
  ];
  const has_scan_errors = itemArrays.some(arr =>
    arr.some(i => i.scan_error === true),
  );

  return {
    scanned_at: new Date().toISOString(),
    has_scan_errors,
    has_open_items: counts.total > 0,
    counts,
    items: {
      debug_sessions: debugSessions,
      quick_tasks: quickTasks,
      threads,
      todos,
      seeds,
      uat_gaps: uatGaps,
      verification_gaps: verificationGaps,
      context_questions: contextQuestions,
    },
  };
}

/**
 * Human-readable report (same text as gsd-tools without `--json`).
 */
export function formatAuditReport(auditResult: AuditOpenResult): string {
  const { counts, items, has_open_items, has_scan_errors } = auditResult;
  const lines: string[] = [];
  const hr = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  lines.push(hr);
  lines.push('  Milestone Close: Open Artifact Audit');
  lines.push(hr);

  if (has_scan_errors) {
    lines.push('');
    lines.push('  ⚠ Some files or directories could not be scanned completely.');
    lines.push('  Treat this audit as incomplete until read errors are resolved.');
    lines.push('');
  }

  if (!has_open_items && !has_scan_errors) {
    lines.push('');
    lines.push('  All artifact types clear. Safe to proceed.');
    lines.push('');
    lines.push(hr);
    return lines.join('\n');
  }

  if (!has_open_items && has_scan_errors) {
    lines.push('');
    lines.push('  No open items counted, but scanning had errors — not safe to assume a clean close.');
    lines.push('');
    lines.push(hr);
    return lines.join('\n');
  }

  if (counts.debug_sessions > 0) {
    lines.push('');
    lines.push(`🔴 Debug Sessions (${counts.debug_sessions} open)`);
    for (const item of items.debug_sessions.filter(i => !i.scan_error)) {
      const hyp = item.hypothesis ? ` — ${item.hypothesis}` : '';
      lines.push(`   • ${item.slug} [${item.status}]${hyp}`);
    }
  }

  if (counts.uat_gaps > 0) {
    lines.push('');
    lines.push(`🔴 UAT Gaps (${counts.uat_gaps} phases with incomplete UAT)`);
    for (const item of items.uat_gaps.filter(i => !i.scan_error)) {
      lines.push(`   • Phase ${item.phase}: ${item.file} [${item.status}] — ${item.open_scenario_count} pending scenarios`);
    }
  }

  if (counts.verification_gaps > 0) {
    lines.push('');
    lines.push(`🔴 Verification Gaps (${counts.verification_gaps} unresolved)`);
    for (const item of items.verification_gaps.filter(i => !i.scan_error)) {
      lines.push(`   • Phase ${item.phase}: ${item.file} [${item.status}]`);
    }
  }

  if (counts.quick_tasks > 0) {
    lines.push('');
    lines.push(`🟡 Quick Tasks (${counts.quick_tasks} incomplete)`);
    for (const item of items.quick_tasks.filter(i => !i.scan_error)) {
      const d = item.date ? ` (${item.date})` : '';
      lines.push(`   • ${item.slug}${d} [${item.status}]`);
    }
  }

  if (counts.todos > 0) {
    const realTodos = items.todos.filter(i => !i.scan_error && !i._remainder_count);
    const remainder = items.todos.find(i => i._remainder_count);
    lines.push('');
    lines.push(`🟡 Pending Todos (${counts.todos} pending)`);
    for (const item of realTodos) {
      const area = item.area ? ` [${item.area}]` : '';
      const pri = item.priority ? ` (${item.priority})` : '';
      lines.push(`   • ${item.filename}${area}${pri}`);
      if (item.summary) lines.push(`     ${item.summary}`);
    }
    if (remainder) {
      lines.push(`   ... and ${remainder._remainder_count} more`);
    }
  }

  if (counts.threads > 0) {
    lines.push('');
    lines.push(`🔵 Open Threads (${counts.threads} active)`);
    for (const item of items.threads.filter(i => !i.scan_error)) {
      const title = item.title ? ` — ${item.title}` : '';
      lines.push(`   • ${item.slug} [${item.status}]${title}`);
    }
  }

  if (counts.seeds > 0) {
    lines.push('');
    lines.push(`🔵 Unimplemented Seeds (${counts.seeds} pending)`);
    for (const item of items.seeds.filter(i => !i.scan_error)) {
      const title = item.title ? ` — ${item.title}` : '';
      lines.push(`   • ${item.seed_id} [${item.status}]${title}`);
    }
  }

  if (counts.context_questions > 0) {
    lines.push('');
    lines.push(`🔵 CONTEXT Open Questions (${counts.context_questions} phases with open questions)`);
    for (const item of items.context_questions.filter(i => !i.scan_error)) {
      lines.push(`   • Phase ${item.phase}: ${item.file} (${item.question_count} question${item.question_count !== 1 ? 's' : ''})`);
      for (const q of (item.questions as string[]) || []) {
        lines.push(`     - ${q}`);
      }
    }
  }

  lines.push('');
  lines.push(hr);
  lines.push(`  ${counts.total} item${counts.total !== 1 ? 's' : ''} require decisions before close.`);
  lines.push(hr);

  return lines.join('\n');
}

/**
 * `audit-open` / `audit.open` — optional `--json` for structured JSON only (default adds formatted report string).
 */
export const auditOpen = async (
  adapter: StorageAdapter,
  args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> => {
  const jsonOnly = args.includes('--json');
  const result = await auditOpenArtifacts(adapter, projectDir, workstream);
  if (jsonOnly) {
    return { data: result };
  }
  return {
    data: {
      ...result,
      report: formatAuditReport(result),
    },
  };
};
