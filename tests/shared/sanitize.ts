/**
 * Sanitize bundle/query output for byte-identical comparison.
 *
 * Extracted from tests/conformance/init-bundlers.test.ts (Phase 8 DIST-04).
 * Shared between the existing init-bundlers suite and the upstream-parity
 * workflow so both compare raw output against stable placeholders.
 *
 * Replacements (preserve order — some regexes subsume earlier ones):
 * - ISO timestamps -> "<TIMESTAMP>"
 * - Home/user/tmp/var-folders absolute paths -> "<HOME_PATH>" or "<TMP_PATH>"
 * - ISO dates and date-field values -> "<DATE>"
 * - Volatile JSON fields (quick_id, cwd_repo_name, project_root, workspace_*,
 *   source_*, agents_installed, missing_agents) -> stable placeholders
 */
export function sanitize(json: string): string {
  return json
    .replace(/"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z"/g, '"<TIMESTAMP>"')
    // User home on Linux and macOS (baselines captured on /home/..., local
    // runs on /Users/...). Match either prefix so both sides fold to the
    // same placeholder.
    .replace(/"\/home\/[^"]+"/g, '"<HOME_PATH>"')
    .replace(/"\/Users\/[^"]+"/g, '"<HOME_PATH>"')
    .replace(/"\/tmp\/[^"]+"/g, '"<TMP_PATH>"')
    // macOS tempdirs live under /var/folders/<jobhash>/... and show up in
    // bundles whenever a test points at a temp scratch dir.
    .replace(/"\/var\/folders\/[^"]+"/g, '"<TMP_PATH>"')
    // Volatile date fields embedded as plain strings (e.g. "2026-04-30") —
    // the YYMMDD-encoded quick_id is also volatile.
    .replace(/"\d{4}-\d{2}-\d{2}"/g, '"<DATE>"')
    .replace(/"date":\s*"[^"]+"/g, '"date": "<DATE>"')
    .replace(/"quick_id":\s*"[^"]+"/g, '"quick_id": "<QUICK_ID>"')
    // cwd_repo_name is the basename of process.cwd() — varies between the
    // baseline-capture worktree (e.g. "agent-afe48fc6f178f469c") and the
    // current worktree. Both sides go through the same sanitizer.
    .replace(/"cwd_repo_name":\s*"[^"]+"/g, '"cwd_repo_name": "<CWD_NAME>"')
    // Absolute project/workspace/source paths differ between the baseline
    // capture host (/home/<user>/...) and local runs (/Users/..., /Volumes/...,
    // /opt/..., etc.). Collapse a fixed set of keys that carry these paths so
    // both sides fold to the same placeholder regardless of host filesystem.
    .replace(/"project_root":\s*"[^"]+"/g, '"project_root": "<HOME_PATH>"')
    .replace(/"workspace_base":\s*"[^"]+"/g, '"workspace_base": "<HOME_PATH>"')
    .replace(/"default_workspace_base":\s*"[^"]+"/g, '"default_workspace_base": "<HOME_PATH>"')
    .replace(/"source_repo_root":\s*"[^"]+"/g, '"source_repo_root": "<HOME_PATH>"')
    .replace(/"source_project_path":\s*"[^"]+"/g, '"source_project_path": "<HOME_PATH>"')
    .replace(/"workspace_path":\s*"[^"]+"/g, '"workspace_path": "<HOME_PATH>"')
    .replace(/"path":\s*"\/[^"]+"/g, '"path": "<HOME_PATH>"')
    .replace(/"error":\s*"Workspace not found: \/[^"]+"/g, '"error": "Workspace not found: <HOME_PATH>"')
    // agents_installed + missing_agents reflect the host's .claude/agents/
    // directory state at capture time. Baselines were captured on a host
    // with the full agent set installed; CI runners start without any
    // agents installed. The fields exist for the sessionStart bundler's
    // "GSD setup ready?" signal, but byte-identity is a host-environment
    // property, not a bundler-correctness property. Fold both to stable
    // placeholders so the assertion checks SHAPE, not environment.
    .replace(/"agents_installed":\s*(true|false)/g, '"agents_installed": "<AGENTS_INSTALLED>"')
    .replace(/"missing_agents":\s*\[[^\]]*\]/g, '"missing_agents": "<MISSING_AGENTS>"');
}
