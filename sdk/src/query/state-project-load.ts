/**
 * `state load` — full project config + STATE.md raw text (CJS `cmdStateLoad`).
 *
 * Phase 2 D-12 (Plan 02-01 Task 4): the createRequire'd `loadConfigCjs` fs
 * bridge is removed. Reads route through the StorageAdapter — config.json,
 * STATE.md, ROADMAP.md, PROJECT.md — instead of `createRequire`-bridged
 * `core.cjs.loadConfig(cwd)`.
 *
 * Behavior trade-off: the CJS `loadConfig` performs workstream inheritance
 * (root → ws merge), depth → granularity migration, and sub-repo auto-sync
 * with on-disk writes. Those side-effects are Phase 3 (write paths). For
 * the `state.load` read handler, we apply the simpler defaults-merge here;
 * the migration writes happen lazily through other code paths.
 *
 * Distinct from {@link stateJson} (`state json` / `state.json`) which mirrors
 * `cmdStateJson` (rebuilt frontmatter only).
 */

import { planningRelativePath } from './helpers.js';
import type { QueryResult } from './utils.js';
import type { StorageAdapter } from '../../../adapters/types.js';

// Defaults inlined from get-shit-done/bin/lib/core.cjs:CONFIG_DEFAULTS.
// Ported here because core.cjs does not export `CONFIG_DEFAULTS` separately
// from the (fs-bound) `loadConfig` function, and modifying core.cjs to add
// a pure-helper export would violate Phase 1 D-13 (CJS files stay untouched).
// Keep this in sync with core.cjs:222-250 on rebase; drift is detected by
// the SDK test bar (D-13) and Plan 4's byte-identical baseline assertion.
const DEFAULT_CONFIG: Record<string, unknown> = {
  model_profile: 'balanced',
  commit_docs: true,
  search_gitignored: false,
  branching_strategy: 'none',
  phase_branch_template: 'gsd/phase-{phase}-{slug}',
  milestone_branch_template: 'gsd/{milestone}-{slug}',
  quick_branch_template: null,
  research: true,
  plan_checker: true,
  verifier: true,
  nyquist_validation: true,
  ai_integration_phase: true,
  parallelization: true,
  brave_search: false,
  firecrawl: false,
  exa_search: false,
  text_mode: false,
  sub_repos: [],
  resolve_model_ids: false,
  context_window: 200000,
  phase_naming: 'sequential',
  project_code: null,
  subagent_timeout: 300000,
  security_enforcement: true,
  security_asvs_level: 1,
  security_block_on: 'high',
  post_planning_gaps: true,
};

/**
 * [LOW-2] core.cjs.loadConfig behavior summary (from Step 1 audit):
 *   - Reads .planning/config.json; returns parsed object merged with defaults.
 *   - When GSD_WORKSTREAM is set, also reads root .planning/config.json and
 *     deep-merges (root → ws); the workstream config wins on key conflict.
 *   - Lazily migrates `depth` → `granularity` and writes back (fs side-effect).
 *   - Auto-detects sub_repos and writes back (fs side-effect).
 *
 * We port to TS here because (b) is small for the read path; the write
 * side-effects (b-3, b-4) are Phase 3 (D-14: read-only discipline). The
 * shallow defaults merge is sufficient for `state.load` consumers; complex
 * inheritance logic is invoked by other code paths through `config.ts`.
 */
async function loadConfigViaAdapter(
  adapter: StorageAdapter,
): Promise<Record<string, unknown>> {
  const raw = await adapter.getRecord('config.json');
  if (raw === null) return { ...DEFAULT_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Query handler for `state load` / bare `state` (normalize → `state.load`).
 *
 * Port of `cmdStateLoad` from `get-shit-done/bin/lib/state.cjs` lines 44–86.
 *
 * Phase 2 Plan 02-01 Task 4: adapter-as-first-arg signature (Shape A).
 * The registry registers a closure wrapper that binds `adapter` and forwards
 * `(args, projectDir, ws)` to this signature.
 */
export const stateProjectLoad = async (
  adapter: StorageAdapter,
  _args: string[],
  _projectDir: string,
  workstream?: string,
): Promise<QueryResult> => {
  const config = await loadConfigViaAdapter(adapter);

  const stateRel = planningRelativePath(workstream, 'STATE.md');
  const roadmapRel = planningRelativePath(workstream, 'ROADMAP.md');
  const configRel = planningRelativePath(workstream, 'config.json');

  const stateRaw = (await adapter.getRecord(stateRel)) ?? '';
  const stateExists = stateRaw.length > 0;
  const roadmapExists = await adapter.exists(roadmapRel);
  const configExists = await adapter.exists(configRel);

  return {
    data: {
      config,
      state_raw: stateRaw,
      state_exists: stateExists,
      roadmap_exists: roadmapExists,
      config_exists: configExists,
    },
  };
};

/**
 * `--raw` stdout for `state load` (matches CJS `cmdStateLoad` lines 65–83).
 */
export function formatStateLoadRawStdout(data: unknown): string {
  const d = data as Record<string, unknown>;
  const c = d.config as Record<string, unknown> | undefined;
  if (!c) {
    return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  }
  const configExists = d.config_exists;
  const roadmapExists = d.roadmap_exists;
  const stateExists = d.state_exists;
  const lines = [
    `model_profile=${c.model_profile}`,
    `commit_docs=${c.commit_docs}`,
    `branching_strategy=${c.branching_strategy}`,
    `phase_branch_template=${c.phase_branch_template}`,
    `milestone_branch_template=${c.milestone_branch_template}`,
    `parallelization=${c.parallelization}`,
    `research=${c.research}`,
    `plan_checker=${c.plan_checker}`,
    `verifier=${c.verifier}`,
    `config_exists=${configExists}`,
    `roadmap_exists=${roadmapExists}`,
    `state_exists=${stateExists}`,
  ];
  return lines.join('\n');
}
