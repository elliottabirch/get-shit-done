// sdk/src/query/bootstrap.ts
//
// COMPATIBILITY SHIM — fork-side bootstrap module retained for backwards
// compatibility with v1.0 callers that import from `./bootstrap.js`.
//
// In v1.0 (commit ee3942cf, Phase 2 Plan 02-01), we extracted findProjectRoot
// from helpers.ts into this file to satisfy the leak-grep gate (HIGH-2 Option 1
// from revision pass 1). Upstream subsequently performed the same extraction
// independently, landing at sdk/src/project-root/index.ts with a more
// complete implementation (multi-repo heuristics, FIND_PROJECT_ROOT_MAX_DEPTH
// export, etc.).
//
// Resolution: this file now re-exports from upstream's location. Existing
// `import { findProjectRoot } from './bootstrap.js'` callsites keep working;
// new code should prefer the canonical `../project-root/index.js` import.

import { existsSync } from 'node:fs';
import { join } from 'node:path';

export { findProjectRoot } from '../project-root/index.js';

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

