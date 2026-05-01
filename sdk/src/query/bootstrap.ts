// sdk/src/query/bootstrap.ts
//
// BOOTSTRAP — raw fs intentional; runs BEFORE the StorageAdapter is constructed
// (the adapter needs projectDir to compute its planningBase). This file is
// PHYSICALLY SEPARATED from helpers.ts (HIGH-2 Option 1 from revision pass 1)
// so that Plan 1 leak-grep gate against helpers.ts is unambiguous: helpers.ts has
// ZERO raw-fs callsites; bootstrap.ts is excluded from leak-grep scope.
//
// Phase 4 LEAKS-04 may add a `// leak-grep-allow file:` directive parser to
// formalize this carve-out; for Phase 2 the carve-out is by file path.

import { existsSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, relative, resolve, parse as parsePath, sep as pathSep } from 'node:path';
import { homedir } from 'node:os';

/**
 * Maximum number of parent directories to walk when searching for a
 * multi-repo `.planning/` root. Bounded to avoid scanning to the filesystem
 * root in pathological cases.
 */
const FIND_PROJECT_ROOT_MAX_DEPTH = 10;

/**
 * Walk up from `startDir` to find the project root that owns `.planning/`.
 *
 * Ported from `get-shit-done/bin/lib/core.cjs:findProjectRoot` so that
 * `gsd-sdk query` resolves the same parent `.planning/` root as the legacy
 * `gsd-tools.cjs` CLI when invoked inside a `sub_repos`-listed child repo.
 *
 * Detection strategy (checked in order for each ancestor, up to
 * `FIND_PROJECT_ROOT_MAX_DEPTH` levels):
 *   1. `startDir` itself has `.planning/` — return it unchanged (#1362).
 *   2. Parent has `.planning/config.json` with `sub_repos` listing the
 *      immediate child segment of the starting directory.
 *   3. Parent has `.planning/config.json` with `multiRepo: true` (legacy).
 *   4. Parent has `.planning/` AND an ancestor of `startDir` (up to the
 *      candidate parent) contains `.git` — heuristic fallback.
 *
 * Returns `startDir` unchanged when no ancestor `.planning/` is found
 * (first-run or single-repo projects). Never walks above the user's home
 * directory.
 *
 * All filesystem errors are swallowed — a missing or unparseable
 * `config.json` falls back to the `.git` heuristic, and unreadable
 * directories terminate the walk at that level.
 */
export function findProjectRoot(startDir: string): string {
  let resolvedStart: string;
  try {
    resolvedStart = resolve(startDir);
  } catch {
    return startDir;
  }
  const fsRoot = parsePath(resolvedStart).root;
  const home = homedir();

  // If startDir already contains .planning/, it IS the project root.
  try {
    const ownPlanning = join(resolvedStart, '.planning');
    if (existsSync(ownPlanning) && statSync(ownPlanning).isDirectory()) {
      return startDir;
    }
  } catch {
    // fall through
  }

  // Walk upward, mirroring isInsideGitRepo from the CJS reference.
  function isInsideGitRepo(candidateParent: string): boolean {
    let d = resolvedStart;
    while (d !== fsRoot) {
      try {
        if (existsSync(join(d, '.git'))) return true;
      } catch {
        // ignore
      }
      if (d === candidateParent) break;
      const next = dirname(d);
      if (next === d) break;
      d = next;
    }
    return false;
  }

  let dir = resolvedStart;
  let depth = 0;
  while (dir !== fsRoot && depth < FIND_PROJECT_ROOT_MAX_DEPTH) {
    const parent = dirname(dir);
    if (parent === dir) break;
    if (parent === home) break;

    const parentPlanning = join(parent, '.planning');
    let parentPlanningIsDir = false;
    try {
      parentPlanningIsDir = existsSync(parentPlanning) && statSync(parentPlanning).isDirectory();
    } catch {
      parentPlanningIsDir = false;
    }

    if (parentPlanningIsDir) {
      const configPath = join(parentPlanning, 'config.json');
      let matched = false;
      try {
        const raw = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(raw) as {
          sub_repos?: unknown;
          planning?: { sub_repos?: unknown };
          multiRepo?: unknown;
        };
        const subReposValue =
          (config.sub_repos as unknown) ?? (config.planning && config.planning.sub_repos);
        const subRepos = Array.isArray(subReposValue) ? (subReposValue as unknown[]) : [];

        if (subRepos.length > 0) {
          const relPath = relative(parent, resolvedStart);
          const topSegment = relPath.split(pathSep)[0];
          if (subRepos.includes(topSegment)) {
            return parent;
          }
        }

        if (config.multiRepo === true && isInsideGitRepo(parent)) {
          matched = true;
        }
      } catch {
        // config.json missing or unparseable — fall through to .git heuristic.
      }

      if (matched) return parent;

      // Heuristic: parent has .planning/ and we're inside a git repo.
      if (isInsideGitRepo(parent)) {
        return parent;
      }
    }

    dir = parent;
    depth += 1;
  }
  return startDir;
}

/**
 * Phase 2 D-15 (Plan 02-04): project-root probe used by init bundlers to
 * check the existence of paths under the project directory (not the planning
 * tree) — e.g. `.git`, `package.json`, `Cargo.toml`. The StorageAdapter is
 * rooted at the planning base, so these reads are intentionally direct fs.
 *
 * Lives in bootstrap.ts (not init.ts) to keep the init.ts surface free of
 * raw `existsSync` near `.planning/` literals — bootstrap.ts is the
 * documented carve-out for raw-fs callsites that the leak-grep gate excludes
 * by file path.
 */
export function pathExistsProject(base: string, relPath: string): boolean {
  return existsSync(join(base, relPath));
}
