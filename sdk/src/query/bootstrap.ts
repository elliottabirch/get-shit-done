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

export { findProjectRoot } from '../project-root/index.js';
