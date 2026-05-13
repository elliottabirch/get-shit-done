<!-- leak-grep-allow file — SUMMARY.md describes leak patterns for documentation; matches are intentional prose -->
---
phase: 08-migration-distribution
plan: "04"
subsystem: distribution
tags: [phase-8, dist-03, rebase-playbook, sync-upstream, leak-grep-integration]

dependency_graph:
  requires:
    - scripts/leak-grep.cjs (invoked by sync-upstream.sh; no code changes)
    - scripts/install-hooks.sh (pattern source for shebang/set-e/SCRIPT_DIR conventions)
  provides:
    - scripts/sync-upstream.sh (DIST-03 helper: automated fetch+rebase+advisory leak scan)
    - docs/UPSTREAM-REBASE.md (DIST-03 playbook: conflict taxonomy + INVESTIGATE workflow)
  affects: []

tech_stack:
  added: []
  patterns:
    - POSIX sh script with set -e and SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd) (matches install-hooks.sh)
    - xargs node scripts/leak-grep.cjs invocation with || true non-blocking sentinel (D-13)
    - leak-grep-allow file directive in markdown prose that describes leak patterns

key_files:
  created:
    - scripts/sync-upstream.sh
    - docs/UPSTREAM-REBASE.md
  modified: []

decisions:
  - "D-13 implemented: leak-grep invocation ends with || true; script exits 0 even when leaks found"
  - "D-14 implemented: conflict taxonomy covers seam AND business-logic; business-logic framed as RED FLAG with INVESTIGATE workflow (not routine resolution path)"
  - "D-15 implemented: on-demand only; no cron, no GHA trigger in either artifact"
  - "leak-grep-allow file directive added to UPSTREAM-REBASE.md (doc describes patterns, not I/O leaks — pre-commit hook tripped on prose)"

metrics:
  duration: "2m"
  completed: "2026-05-13T17:56:08Z"
  tasks: 2
  files: 2
---

# Phase 8 Plan 04: DIST-03 Upstream Rebase Playbook Summary

**One-liner:** POSIX sh sync-upstream.sh with advisory leak-grep-on-rebase plus a 3-category conflict taxonomy playbook framing business-logic conflicts as RED FLAG INVESTIGATE (D-12/D-13/D-14/D-15).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write scripts/sync-upstream.sh | 23161c9f | scripts/sync-upstream.sh |
| 2 | Write docs/UPSTREAM-REBASE.md | 6ee2ec33 | docs/UPSTREAM-REBASE.md |

## Script Design Choices (scripts/sync-upstream.sh)

**Shebang: `#!/bin/sh`** — POSIX sh, not bash, matching install-hooks.sh convention. Intentional for portability; no bash-isms needed.

**`set -e`** — Fail fast on any git command error (fetch failure, rebase abort). This is what makes the `|| true` on the leak-grep line critical: without it, `set -e` would treat leak-grep exit code 1 (leaks found) as a script failure, converting the advisory output into a gate — violating D-13.

**`SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)`** — Canonical pattern from install-hooks.sh. Resolves symlink-safe absolute path so `node "$SCRIPT_DIR/leak-grep.cjs"` works regardless of `cwd` at call time.

**`PRE_REBASE=$(git rev-parse HEAD)` before rebase** — Saves pre-rebase HEAD so the post-rebase diff can be precisely scoped to changes introduced by the upstream batch. Without this, `git diff --name-only HEAD~N..HEAD` would require knowing N in advance.

**`git diff --name-only "${PRE_REBASE}..HEAD" | xargs node ... || true`** — Passes file paths, not a unified diff. This matches leak-grep.cjs's argv contract (it reads file content with `fs.readFileSync`, not stdin). The `|| true` satisfies D-13.

**No `git fetch origin`** — The script assumes the caller's working branch is already current with its remote. This is the maintainer's pre-flight responsibility, documented in the playbook.

**No colored output** — Matches install-hooks.sh plain stderr convention. All status messages go to stderr (`>&2`); only leak-grep output goes to stdout.

## bash -n Verification

`bash -n scripts/sync-upstream.sh` exits 0. Verified during execution.

## No-op Smoke Test

The `upstream` remote is configured in this repo. A full live smoke test (fetch + no-op rebase against current HEAD) was not run to avoid network I/O in a parallel execution context. The script structure was verified instead:

- File-level: `bash -n` syntax check passes
- `|| true` present on the leak-grep line (2 occurrences in file)
- `git diff --name-only "${PRE_REBASE}..HEAD"` produces no output on a no-op rebase, causing the `if [ -n "$CHANGED_FILES" ]` branch to skip to "No changed files after rebase." — the expected no-op behavior.

## Conflict Taxonomy Framing (docs/UPSTREAM-REBASE.md)

The playbook distinguishes three conflict categories:

1. **Seam conflicts (expected, mechanical)** — `createRegistry()` call sites in SDK entrypoints. Resolution pattern: accept upstream arguments + inject adapter construction. This is the routine path.

2. **Business-logic conflicts (RED FLAG - INVESTIGATE)** — Upstream modifies a file that leak-grep would flag (new `readFileSync('.planning/...')`, new direct `fs.writeFile` in state mutation). The playbook frames this explicitly as a **defect in the fork's adapter coverage**, not a merge event. The INVESTIGATE workflow (4 steps: inspect → route through adapter → file upstream issue if missed → only then resolve) is framed as the non-routine exception path, consistent with D-14.

3. **CJS binary conflicts (expected, mechanical)** — `get-shit-done/bin/lib/*.cjs` compiled outputs. Always take upstream version; re-apply fork-side CJS patches on top.

Key D-14 framing: "If business logic conflicts appear, it means either (a) Our adapter seam is incomplete ... OR (b) Upstream has introduced a new I/O surface ... Either way, this is a defect in the fork's adapter coverage, not a merge event."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added leak-grep-allow file directive to docs/UPSTREAM-REBASE.md**
- **Found during:** Task 2 commit attempt
- **Issue:** The pre-commit hook (scripts/pre-commit-leak-gate.sh) triggered on documentation prose in UPSTREAM-REBASE.md that describes the leak patterns (`mv`, `rm -rf` targeting `.planning/`) as part of the Leak-grep output interpretation section. The hook blocked the commit with exit code 1.
- **Fix:** Added `<!-- leak-grep-allow file -->` HTML comment directive in the first line of UPSTREAM-REBASE.md. This is the canonical mechanism (used in leak-grep.cjs itself for the same reason — a file that describes patterns it detects). The directive correctly classifies the file as "describes patterns for documentation purposes, not I/O leaks."
- **Files modified:** docs/UPSTREAM-REBASE.md (line 1 prepended)
- **Commit:** 6ee2ec33 (same commit; no additional commit needed)

## Known Stubs

None. Both artifacts are fully wired: sync-upstream.sh invokes the real leak-grep.cjs; UPSTREAM-REBASE.md references the real script with accurate command examples.

## Threat Flags

None beyond what the plan's threat model already covers (UPSTREAM_REF from caller argv, trusted maintainer; xargs paths from git diff --name-only, git-controlled).

## Self-Check: PASSED

- `test -f scripts/sync-upstream.sh` → found
- `test -x scripts/sync-upstream.sh` → found (executable)
- `test -f docs/UPSTREAM-REBASE.md` → found (178 lines)
- `bash -n scripts/sync-upstream.sh` → exits 0
- `grep -c "INVESTIGATE" docs/UPSTREAM-REBASE.md` → 2 (>= 1)
- `grep -Ec "RED FLAG" docs/UPSTREAM-REBASE.md` → 1 (>= 1)
- Commits 23161c9f and 6ee2ec33 both exist in git log
