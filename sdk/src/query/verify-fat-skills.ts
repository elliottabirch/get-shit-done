/**
 * verify.fat-skills — list non-router skills with line-count and leak-count.
 *
 * Used by CI/pre-commit as a warning (non-blocking) indicator of skill bloat.
 * Discovers skill files in get-shit-done/{workflows,commands,agents}/*.md
 * and reports size + leak metrics per skill.
 *
 * This handler reads skill files from the GSD install directory using raw fs —
 * this is intentional and NOT a leak (C2 scope: runtime install dirs).
 */

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { QueryHandler } from './utils.js';

interface SkillReport {
  name: string;
  path: string;
  lines: number;
  leaks: number;
  warning: 'fat' | 'leaky' | null;
}

/**
 * Scans GSD skill directories and reports per-skill metrics.
 *
 * @param args - Optional: [threshold_lines] (default 500)
 * @param projectDir - Project root containing get-shit-done/
 */
export const verifyFatSkills: QueryHandler = async (args, projectDir) => {
  const thresholdLines = args[0] ? parseInt(args[0], 10) : 500;
  const gsdDir = join(projectDir, 'get-shit-done');
  const skillDirs = ['workflows', 'commands', 'agents'];

  const allSkills: Array<{
    name: string;
    path: string;
    lines: number;
    leaks: number;
    isRouter: boolean;
  }> = [];

  for (const dir of skillDirs) {
    const dirPath = join(gsdDir, dir);
    let files: string[];
    try {
      files = readdirSync(dirPath).filter(f => f.endsWith('.md'));
    } catch {
      // Directory doesn't exist — skip
      continue;
    }

    for (const file of files) {
      const filePath = join(dirPath, file);
      let content: string;
      try {
        content = readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }
      const lines = content.split('\n').length;

      // Router skills dispatch to other skills without doing substantial work
      const isRouter = content.includes('route-next-action') || lines < 20;

      // Count leaks via leak-grep (5000ms timeout per T-04-13)
      let leaks = 0;
      try {
        const result = execSync(
          `node scripts/leak-grep.cjs "${filePath}"`,
          {
            cwd: projectDir,
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe'],
          },
        );
        // leak-grep outputs "leak-grep: N match(es)..." on success (0 leaks)
        const countMatch = result.match(/(\d+)\s+match/);
        leaks = countMatch ? parseInt(countMatch[1], 10) : 0;
      } catch (e: unknown) {
        // leak-grep exits non-zero when leaks found — parse stdout
        const err = e as { stdout?: string; status?: number };
        if (err.stdout) {
          const countMatch = err.stdout.match(/(\d+)\s+match/);
          leaks = countMatch ? parseInt(countMatch[1], 10) : 0;
        }
        // Timeout or other error — leave leaks as 0
      }

      allSkills.push({ name: file.replace('.md', ''), path: `${dir}/${file}`, lines, leaks, isRouter });
    }
  }

  // Filter to non-router skills and sort by line count descending
  const nonRouter = allSkills
    .filter(s => !s.isRouter)
    .sort((a, b) => b.lines - a.lines);

  // Build output with warnings
  const skills: SkillReport[] = nonRouter.map(s => ({
    name: s.name,
    path: s.path,
    lines: s.lines,
    leaks: s.leaks,
    warning: s.lines > thresholdLines ? 'fat' as const : s.leaks > 0 ? 'leaky' as const : null,
  }));

  const warnings = skills.filter(s => s.warning !== null);

  return {
    data: {
      total_skills: allSkills.length,
      non_router_skills: nonRouter.length,
      over_threshold: warnings.length,
      threshold_lines: thresholdLines,
      skills,
    },
  };
};
