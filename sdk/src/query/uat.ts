/**
 * UAT query handlers — checkpoint rendering and audit scanning.
 *
 * Ported from get-shit-done/bin/lib/uat.cjs.
 * Provides UAT checkpoint rendering for verify-work workflows and
 * audit scanning for UAT/VERIFICATION files across phases.
 *
 * Phase 2 Plan 02-03 Task 1 (D-12): document-tree reads route through the
 * StorageAdapter. auditUat walks all phase dirs via listCollection and reads
 * UAT/VERIFICATION content via getRecord. uatRenderCheckpoint retains a direct
 * readFileSync against a user-supplied path (resolved via resolvePathUnderProject)
 * — documented inline as an audited exception.
 *
 * @example
 *   import { uatRenderCheckpoint, auditUat } from './uat.js';
 *   await uatRenderCheckpoint(adapter, ['--file', 'path/to/UAT.md'], '/project');
 *   // { data: { test_number: 1, test_name: 'Login', checkpoint: '...' } }
 *   await auditUat(adapter, [], '/project');
 *   // { data: { results: [...], summary: { total_files: 2, total_items: 5 } } }
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { GSDError, ErrorClassification } from '../errors.js';
import { extractFrontmatter } from './frontmatter.js';
import { planningRelativePath, resolvePathUnderProject, sanitizeForDisplay, toPosixPath } from './helpers.js';
import { relPlanningPath } from '../workstream-utils.js';
import { getMilestonePhaseFilter } from './state.js';
import type { QueryResult } from './utils.js';
import type { StorageAdapter } from '../../../adapters/types.js';

/** Same string as `buildCheckpoint` in `get-shit-done/bin/lib/uat.cjs`. */
function buildUatCheckpoint(currentTest: { number: number; name: string; expected: string }): string {
  return [
    '╔══════════════════════════════════════════════════════════════╗',
    '║  CHECKPOINT: Verification Required                           ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    `**Test ${currentTest.number}: ${currentTest.name}**`,
    '',
    currentTest.expected,
    '',
    '──────────────────────────────────────────────────────────────',
    'Type `pass` or describe what\'s wrong.',
    '──────────────────────────────────────────────────────────────',
  ].join('\n');
}

// ─── uatRenderCheckpoint ─────────────────────────────────────────────────

/**
 * Render the current UAT checkpoint — reads a UAT file, parses the
 * "Current Test" section, and returns a formatted checkpoint prompt.
 *
 * Port of `cmdRenderCheckpoint` from `uat.cjs` (paths via `requireSafePath`,
 * checkpoint via `buildCheckpoint`, name/expected via `sanitizeForDisplay`).
 *
 * Args: --file <path>
 *
 * Phase 2 audited exception (D-14 + RESEARCH §"Read-Surface Inventory"):
 * uatRenderCheckpoint reads a user-supplied path (resolved via resolvePathUnderProject)
 * which may be OUTSIDE the planning tree. Adapter cannot resolve project-absolute paths.
 * This direct fs read is intentional. Phase 4 LEAKS-04 may add a `// leak-grep-allow line:`
 * suppression directive once the parser ships; for Phase 2 the path argument is not
 * planning-scoped, so leak-grep's Stage-2 filter naturally suppresses this match.
 */
export const uatRenderCheckpoint = async (
  _adapter: StorageAdapter,
  args: string[],
  projectDir: string,
  _workstream?: string,
): Promise<QueryResult> => {
  const fileIdx = args.indexOf('--file');
  const filePath = fileIdx !== -1 ? args[fileIdx + 1] : null;
  if (!filePath) {
    return { data: { error: 'UAT file required: use uat render-checkpoint --file <path>' } };
  }

  let resolvedPath: string;
  try {
    resolvedPath = await resolvePathUnderProject(projectDir, filePath);
  } catch {
    return { data: { error: `UAT file not found: ${filePath}` } };
  }

  if (!existsSync(resolvedPath)) {
    return { data: { error: `UAT file not found: ${filePath}` } };
  }

  const content = readFileSync(resolvedPath, 'utf-8');

  const currentTestMatch = content.match(/##\s*Current Test\s*(?:\n<!--[\s\S]*?-->)?\n([\s\S]*?)(?=\n##\s|$)/i);
  if (!currentTestMatch) {
    return { data: { error: 'UAT file is missing a Current Test section' } };
  }

  const section = currentTestMatch[1].trimEnd();
  if (!section.trim()) {
    return { data: { error: 'Current Test section is empty' } };
  }

  if (/\[testing complete\]/i.test(section)) {
    return { data: { error: 'UAT session is already complete; no pending checkpoint to render' } };
  }

  const numberMatch = section.match(/^number:\s*(\d+)\s*$/m);
  const nameMatch = section.match(/^name:\s*(.+)\s*$/m);
  const expectedBlockMatch = section.match(/^expected:\s*\|\n([\s\S]*?)(?=^\w[\w-]*:\s)/m)
    || section.match(/^expected:\s*\|\n([\s\S]+)/m);
  const expectedInlineMatch = section.match(/^expected:\s*(.+)\s*$/m);

  if (!numberMatch || !nameMatch || (!expectedBlockMatch && !expectedInlineMatch)) {
    return { data: { error: 'Current Test section is malformed' } };
  }

  let expectedRaw: string;
  if (expectedBlockMatch) {
    expectedRaw = expectedBlockMatch[1]
      .split('\n')
      .map(line => line.replace(/^ {2}/, ''))
      .join('\n')
      .trim();
  } else {
    expectedRaw = expectedInlineMatch![1].trim();
  }

  const currentTest = {
    complete: false as const,
    number: parseInt(numberMatch[1], 10),
    name: sanitizeForDisplay(nameMatch[1].trim()),
    expected: sanitizeForDisplay(expectedRaw),
  };

  const checkpoint = buildUatCheckpoint(currentTest);

  return {
    data: {
      file_path: toPosixPath(relative(projectDir, resolvedPath)),
      test_number: currentTest.number,
      test_name: currentTest.name,
      checkpoint,
    },
  };
};

// ─── auditUat (cmdAuditUat) ────────────────────────────────────────────────

/** Port of `categorizeItem` from `uat.cjs`. */
function categorizeItem(
  result: string,
  reason: string | undefined,
  blockedBy: string | undefined,
): string {
  if (result === 'blocked' || blockedBy) {
    if (blockedBy) {
      if (/server/i.test(blockedBy)) return 'server_blocked';
      if (/device|physical/i.test(blockedBy)) return 'device_needed';
      if (/build|release|preview/i.test(blockedBy)) return 'build_needed';
      if (/third.party|twilio|stripe/i.test(blockedBy)) return 'third_party';
    }
    return 'blocked';
  }
  if (result === 'skipped') {
    if (reason) {
      if (/server|not running|not available/i.test(reason)) return 'server_blocked';
      if (/simulator|physical|device/i.test(reason)) return 'device_needed';
      if (/build|release|preview/i.test(reason)) return 'build_needed';
    }
    return 'skipped_unresolved';
  }
  if (result === 'pending') return 'pending';
  if (result === 'human_needed') return 'human_uat';
  return 'unknown';
}

/** Port of `parseUatItems` from `uat.cjs`. */
function parseUatItems(content: string): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  const testPattern =
    /###\s*(\d+)\.\s*([^\n]+)\nexpected:\s*([^\n]+)\nresult:\s*(\w+)(?:\n(?:reported|reason|blocked_by):\s*[^\n]*)?/g;
  let match: RegExpExecArray | null;
  while ((match = testPattern.exec(content)) !== null) {
    const [, num, name, expected, result] = match;
    if (result === 'pending' || result === 'skipped' || result === 'blocked') {
      const afterMatch = content.slice(match.index);
      const nextHeading = afterMatch.indexOf('\n###', 1);
      const blockText = nextHeading > 0 ? afterMatch.slice(0, nextHeading) : afterMatch;
      const reasonMatch = blockText.match(/reason:\s*(.+)/);
      const blockedByMatch = blockText.match(/blocked_by:\s*(.+)/);

      const item: Record<string, unknown> = {
        test: parseInt(num, 10),
        name: name.trim(),
        expected: expected.trim(),
        result,
        category: categorizeItem(result, reasonMatch?.[1], blockedByMatch?.[1]),
      };
      if (reasonMatch) item.reason = reasonMatch[1].trim();
      if (blockedByMatch) item.blocked_by = blockedByMatch[1].trim();
      items.push(item);
    }
  }
  return items;
}

/**
 * Parse frontmatter human_verification: YAML array entries into audit items.
 *
 * Fixes #2788: when gsd-verifier encodes human items in YAML frontmatter
 * rather than the body, parseVerificationItems was returning [] because it
 * only searched the body for a "## Human Verification" heading.
 */
function parseVerificationFrontmatterItems(fm: Record<string, unknown>): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  const hvArray = fm.human_verification;
  if (!Array.isArray(hvArray)) return items;

  let i = 0;
  for (const entry of hvArray) {
    i++;
    if (typeof entry === 'string') {
      const name = entry.trim();
      if (name.length > 0) {
        items.push({ test: i, name, result: 'human_needed', category: 'human_uat' });
      }
    } else if (typeof entry === 'object' && entry !== null) {
      const obj = entry as Record<string, unknown>;
      // Accept any string property as the item name; prefer 'test' key.
      const name = (obj.test as string | undefined) || (obj.name as string | undefined) || '';
      if (name) {
        const item: Record<string, unknown> = {
          test: i,
          name: String(name).trim(),
          result: 'human_needed',
          category: 'human_uat',
        };
        if (obj.expected) item.expected = String(obj.expected).trim();
        if (obj.why_human) item.why_human = String(obj.why_human).trim();
        items.push(item);
      }
    }
  }
  return items;
}

/** Port of `parseVerificationItems` from `uat.cjs`. */
function parseVerificationItems(content: string, status: string, fm?: Record<string, unknown>): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  if (status === 'human_needed') {
    // Check frontmatter human_verification: array first (#2788).
    // gsd-verifier writes items here; body-section fallback is secondary.
    if (fm) {
      const fmItems = parseVerificationFrontmatterItems(fm);
      if (fmItems.length > 0) return fmItems;
    }

    // Body fallback: match ## human_verification or ## Human Verification
    // (case-insensitive, underscore or space, with optional parenthetical).
    const hvSection = content.match(
      /##\s*human[_\s-]verification[^\n]*\n([\s\S]*?)(?=\n##\s|\n---\s|$)/i
    );
    if (hvSection) {
      const lines = hvSection[1].split('\n');
      for (const line of lines) {
        const tableMatch = line.match(/\|\s*(\d+)\s*\|\s*([^|]+)/);
        const bulletMatch = line.match(/^[-*]\s+(.+)/);
        const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);

        if (tableMatch) {
          items.push({
            test: parseInt(tableMatch[1], 10),
            name: tableMatch[2].trim(),
            result: 'human_needed',
            category: 'human_uat',
          });
        } else if (numberedMatch) {
          items.push({
            test: parseInt(numberedMatch[1], 10),
            name: numberedMatch[2].trim(),
            result: 'human_needed',
            category: 'human_uat',
          });
        } else if (bulletMatch && bulletMatch[1].length > 10) {
          items.push({
            name: bulletMatch[1].trim(),
            result: 'human_needed',
            category: 'human_uat',
          });
        }
      }
    }
  }
  return items;
}

/**
 * Cross-phase UAT / VERIFICATION audit — port of `cmdAuditUat` (`uat.cjs`).
 *
 * Phase 2 Plan 02-03 Task 1 (D-12): all directory walks and document reads
 * route through the StorageAdapter via listCollection + getRecord.
 */
export const auditUat = async (
  adapter: StorageAdapter,
  _args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> => {
  const phasesRel = planningRelativePath(workstream, 'phases');
  const phasesExist = await adapter.exists(phasesRel);
  if (!phasesExist) {
    throw new GSDError('No phases directory found in planning directory', ErrorClassification.Blocked);
  }

  const isDirInMilestone = await getMilestonePhaseFilter(adapter, workstream);
  const results: Record<string, unknown>[] = [];

  // Project-relative root for file_path display (matches CJS output shape).
  // For workstream runs, this is `.planning/workstreams/<ws>`; otherwise `.planning`.
  const planningRoot = relPlanningPath(workstream);

  // Walk phase directories via adapter.
  const phaseRefs = await adapter.listCollection(phasesRel);
  const dirNames: Array<{ name: string; path: string }> = [];
  for (const ref of phaseRefs) {
    const st = await adapter.stat(ref.path);
    if (st === null || st.kind !== 'dir') continue;
    if (!isDirInMilestone(ref.name)) continue;
    dirNames.push({ name: ref.name, path: ref.path });
  }
  dirNames.sort((a, b) => a.name.localeCompare(b.name));

  for (const { name: dir, path: phaseRelDir } of dirNames) {
    const phaseMatch = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
    const phaseNum = phaseMatch ? phaseMatch[1] : dir;

    const fileRefs = await adapter.listCollection(phaseRelDir);
    const fileNames = fileRefs.map(r => r.name);

    for (const file of fileNames.filter(f => f.includes('-UAT') && f.endsWith('.md'))) {
      const content = await adapter.getRecord(`${phaseRelDir}/${file}`);
      if (content === null) continue;
      const items = parseUatItems(content);
      if (items.length > 0) {
        const fm = extractFrontmatter(content);
        // file_path is project-relative POSIX; the adapter path is planning-base-relative,
        // so we compose with the project-relative planning root.
        const fileProjectRel = toPosixPath(join(planningRoot, phaseRelDir, file));
        results.push({
          phase: phaseNum,
          phase_dir: dir,
          file,
          file_path: fileProjectRel,
          type: 'uat',
          status: (fm.status || 'unknown') as string,
          items,
        });
      }
    }

    for (const file of fileNames.filter(f => f.includes('-VERIFICATION') && f.endsWith('.md'))) {
      const content = await adapter.getRecord(`${phaseRelDir}/${file}`);
      if (content === null) continue;
      const fm = extractFrontmatter(content);
      const status = (fm.status || 'unknown') as string;
      if (status === 'human_needed' || status === 'gaps_found') {
        const items = parseVerificationItems(content, status, fm);
        if (items.length > 0) {
          const fileProjectRel = toPosixPath(join(planningRoot, phaseRelDir, file));
          results.push({
            phase: phaseNum,
            phase_dir: dir,
            file,
            file_path: fileProjectRel,
            type: 'verification',
            status,
            items,
          });
        }
      }
    }
  }

  const summary: {
    total_files: number;
    total_items: number;
    by_category: Record<string, number>;
    by_phase: Record<string, number>;
  } = {
    total_files: results.length,
    total_items: results.reduce((sum, r) => sum + (r.items as unknown[]).length, 0),
    by_category: {},
    by_phase: {},
  };

  for (const r of results) {
    if (!summary.by_phase[r.phase as string]) summary.by_phase[r.phase as string] = 0;
    for (const item of r.items as Array<{ category?: string }>) {
      summary.by_phase[r.phase as string]++;
      const cat = item.category || 'unknown';
      summary.by_category[cat] = (summary.by_category[cat] || 0) + 1;
    }
  }

  return { data: { results, summary } };
};
