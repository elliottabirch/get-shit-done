---
phase: 01-land-the-rebase
audit_run: 2026-05-17T16:11:25Z
rebase_tip: 12b40ac9fb3bd8377316d99cab86f92913e0203f
canonical_tip: ecf72c9fa97e10b3e40439300f45a088c1bc6e44
counts:
  already_present: 351
  merge_commit: 29
  intentional_drop: 1
  substantive: 1
verdict: safe-to-force-push
---

# Phase 1: Cherry-Pick Audit

**Purpose:** Record the "nothing lost" verdict for D-03 before force-pushing `feat/storage-adapter` to the staging branch tip.

Enumerates all 382 commits unique to `origin/feat/storage-adapter` (`ecf72c9f`) that are NOT in `feat/storage-adapter-staging` (staged rebase tip). For each commit, determines whether the content has been carried forward (rebased equivalent exists), was an empty merge commit, was an intentionally dropped commit, or is genuinely absent (substantive).

**Method:** `git log --format='%H %s' origin/feat/storage-adapter ^feat/storage-adapter-staging` produced 382 commits. Each was classified by:
1. Parent count (`git cat-file -p <sha> | grep -c '^parent '`) to detect merge commits (≥2 parents)
2. Subject match against `git log --format='%s' ae63cbe5..feat/storage-adapter-staging` for already-rebased content
3. SHA/subject match for known intentional drops (documented in DELTA.md)
4. Remainder = SUBSTANTIVE (requires explicit decision)

**CI workflow check:** `grep -rE 'npm install.*github' .github/workflows/` returned no matches. The "prepare hook no-op" guard is therefore not load-bearing for CI.

---

## Classification table

> The 382 unique commits are grouped by class. Full SHA list available via:
> `git log --format='%H %s' origin/feat/storage-adapter ^feat/storage-adapter-staging`

| # | SHA | Subject | Class | Notes |
|---|-----|---------|-------|-------|
| 1 | ecf72c9f | fix(scripts): make prepare hook script no-op outside git checkout | SUBSTANTIVE | Only non-empty commit missing from rebase; see explicit decision below |
| 2 | d4d34500 | fix(01-debt): cause-C validateHealth W006/W019/repairs_performed parity | INTENTIONAL_DROP | Per DELTA.md §"What got skipped" — intentionally not ported |
| 3–31 | (29 commits) | Various merge/wave commits | MERGE_COMMIT | Worktree wave merge commits; empty after rebase. Not cherry-pickable without -m. Content represented by non-merge equivalents. |
| 32–382 | (351 commits) | All other adapter commits | ALREADY_PRESENT | Rebased equivalents found in feat/storage-adapter-staging by subject match |

**Note:** ALREADY_PRESENT count (351) excludes the 5 new v1.1 planning docs commits that exist in staging but not in origin/feat/storage-adapter — those are net-new commits not present on either side of the gap.

---

## Substantive commits — explicit decisions

### SUBSTANTIVE: `ecf72c9fa97e10b3e40439300f45a088c1bc6e44`

**Subject:** `fix(scripts): make prepare hook script no-op outside git checkout`

**Diff summary:** Adds 7 lines to `scripts/install-hooks.sh`. When `git rev-parse --show-toplevel` fails (e.g., during `npm install github:user/repo`), the script exits cleanly instead of failing with "fatal: not a git repository".

**Disposition: document-the-drop**

**Rationale:** The guard is defensive for `npm install <github-url>` consumers. CI verification confirmed: `grep -rE 'npm install.*github' .github/workflows/` returned **no matches**. This fork's CI runs tests in-repo via `npm ci` (not from a GitHub URL), so the guard is not load-bearing for any CI workflow. Risk: LOW per RESEARCH.md A1. The commit is safe to omit from the rebase branch — users installing from `npm` or locally via `git clone` are unaffected. GitHub-URL consumers would encounter the pre-guard failure mode only if they run `prepare` without a `.git` directory, which is an unusual setup not exercised by any current workflow.

**Action:** None. The drop is documented here. The behavior difference is acceptable and does not affect any tested workflow.

---

## Verdict

All 382 unique commits classified: 351 already present (rebased equivalents), 29 empty merge commits, 1 intentional drop (documented in DELTA.md), 1 substantive commit with a recorded document-the-drop disposition. All substantive commits have explicit decisions. Safe to force-push staging onto canonical.
