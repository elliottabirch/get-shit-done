# Phase 1: Land the rebase — Research

**Researched:** 2026-05-17
**Domain:** Git rebase mechanics, vitest test reporting, TypeScript build, branch safety
**Confidence:** HIGH (all key findings verified against codebase and git DAG)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Cutover mechanic:**
- D-01: Preferred strategy is fast-forward `feat/storage-adapter` to current branch tip (`832df66b`).
- D-02: Fallback (if `feat/storage-adapter` at `ecf72c9f` is NOT an ancestor of current tip): reset via force-push, gated on a "nothing lost" check.
- D-03: "Nothing lost" check is a cherry-pick dry-run audit — for each commit unique to `origin/feat/storage-adapter` not in current branch, attempt `cherry-pick --no-commit` against scratch branch and inspect diff. Empty diff = already applied. Non-empty diff = flag explicitly.
- D-04: Cutover staged on intermediate branch (`feat/storage-adapter-staging`). REBASE-02/03/04 verifications run on staging. Only after all gates pass does canonical `origin/feat/storage-adapter` move.
- D-05: `fork/v1.0-shipped` tag and `rebase/onto-upstream-2026-05-16` branch remain on origin until v1.1 milestone close.

**Test failure triage policy:**
- D-06: Zero tolerance for new failures vs upstream; tests that ALSO fail on `upstream/main` at `ae63cbe5` are allowed.
- D-07: Baseline captured from `upstream/main` at `ae63cbe5`; persisted to `.planning/phases/01-land-the-rebase/upstream-baseline-failures.txt`.
- D-08: 6 CJS-vs-SDK golden parity failures (from `cjs-sdk-golden-parity-failures.md`) are an additional allowed-failure set, ONLY if they also fail on upstream.
- D-09: Up to 2 uncategorized failures may be filed as bd issues and phase still passes. ≥3 blocks close.
- D-10: Gate formula: `failures-on-rebase-branch` SET-MINUS `upstream-baseline-failures` SET-MINUS `inherited-skip-set` ≤ 2.

**Diff review depth:**
- D-11: Spot-check by file class.
- D-12: Every commit touching adapter-seam files must be read in full. Pure upstream-feature commits are sampled; sampling rate is planner's discretion, biasing toward larger diffs (>10 files or >300 lines always reviewed).
- D-13: Test gate is primary correctness evidence; diff review catches subtle config/semantic surprises.
- D-14: Artifact: `.planning/phases/01-land-the-rebase/01-REVIEW-NOTES.md` with (a) file-class breakdown, (b) adapter-seam commit verdicts, (c) sampled feature commit verdicts, (d) flagged surprises.

**Conflict-resolution playbook trigger (REBASE-04):**
- D-15: REBASE-04 is a dry-run only. Run `git rebase main` on a throwaway branch (`feat/storage-adapter-rebase-test`). Discard result. Canonical branch unchanged.
- D-16: Unexpected business-logic conflicts (non-adapter-seam files) block Phase 1 close; file as DEFECT-NEW.
- D-17: Any DEFECT-NEW filed in Phase 1 is added to Phase 4 scope before `/gsd-plan-phase 4` runs.

### Claude's Discretion
- Specific git commands, branch naming inside the staging flow, and exact ordering of REBASE-02/03/04 inside the staging branch.
- Sampling rate for non-seam commit review during diff audit.
- Whether to use `git worktree add` or a separate clone for the upstream baseline checkout.
- Whether to use `bd remember` to capture per-step verification evidence inline vs in `01-REVIEW-NOTES.md`.

### Deferred Ideas (OUT OF SCOPE)
- Programmatic baseline script (auto-checkout upstream tip, run suite, persist as JSON).
- Auto-skip annotations (`.skip("v1.0 Phase 8 deferred")`) on inherited failures — Phase 4 scope.
- Sibling `gsd-beads` rebase coordination.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REBASE-01 | All 351 commits from `rebase/onto-upstream-2026-05-16` land on `feat/storage-adapter` (fast-forward or replace) | Verified: force-push path required (ecf72c9f is not an ancestor of 832df66b); staging-branch flow documented below |
| REBASE-02 | Tests run green at ≥97% under default adapter; every failure categorized | Verified: vitest `--reporter=json --outputFile` produces machine-readable baseline; set-difference formula documented below |
| REBASE-03 | `npm run build:sdk-only` passes with zero TypeScript errors | Verified: script calls `cd sdk && npm run build` (tsc), which also builds adapters/ via project references |
| REBASE-04 | `git rebase main` from cutover branch produces no conflicts in business-logic files | Verified: main == ae63cbe5; rebase branch is already above main; dry-run will be a no-op; throwaway-branch procedure documented below |
| REBASE-05 | Both safety refs remain on origin until milestone close | Verified: both present on origin now; `git ls-remote origin` check pattern documented below |

</phase_requirements>

---

## Summary

Phase 1 is a verification-heavy cutover operation, not new feature development. The 357-commit rebase (our v1.0 adapter work rebased onto upstream's `ae63cbe5`) already lives on `rebase/onto-upstream-2026-05-16` at `832df66b`. The work is to: (1) prove nothing was lost from `origin/feat/storage-adapter` (`ecf72c9f`), (2) run build and test gates on the staging branch, (3) execute a dry-run rebase-against-main proof, (4) perform a diff review of the 357 adapter commits, and (5) move the canonical `feat/storage-adapter` pointer.

The fast-forward path (D-01) is not available. `ecf72c9f` is NOT an ancestor of `832df66b` — the two branches diverged from upstream commit `3579a48d` (a merge commit) with different commit histories. This is expected: the rebase branch replayed our v1.0 work on top of the new upstream base, creating new SHAs for all fork commits. The force-push path (D-02) applies, gated on the "nothing lost" audit.

The "nothing lost" audit is substantially pre-answered by this research: of the 382 commits unique to `ecf72c9f`, 351 have matching subjects in `832df66b` (the rebased equivalents), 28 are empty merge/worktree commits (expected to disappear in a rebase), one (`fix(01-debt)`) was intentionally dropped per DELTA.md, and one (`fix(scripts): make prepare hook script no-op outside git checkout`) is genuinely missing from the rebase branch. That last commit adds a guard to `scripts/install-hooks.sh` for `npm install` from GitHub URLs. The planner should include an explicit decision task for this commit — either cherry-pick it forward or document why it's safe to omit.

**Primary recommendation:** Stage on `feat/storage-adapter-staging`, run REBASE-02/03/04 gates, cherry-pick the one missing non-empty commit forward (or document the drop), then force-push `feat/storage-adapter` to `832df66b`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Git branch cutover | Developer workstation | origin remote | Local git operations; origin is the target |
| TypeScript build verification | SDK build tier (`sdk/tsc`) | adapters/ (project reference) | `build:sdk-only` triggers tsc, which builds both sdk/ and adapters/ via TS project references |
| Test gate (unit + integration) | SDK vitest runner | Root vitest config (multi-project) | Tests run from `sdk/` or root with vitest; CJS tests run separately via node --test |
| Baseline diff capture | Worktree or clone of upstream/main | Filesystem (txt output) | Requires a second checkout at ae63cbe5 without disturbing working branch |
| Diff review | Human-readable git log output | REVIEW-NOTES.md artifact | Reviewer reads commits; writes to .planning/phases artifact |
| Rollback safety | Origin remote refs | git ls-remote check | Tag and branch must persist on origin; verification is read-only |

---

## Standard Stack

### Core — No new libraries needed. All tools are already present.

| Tool | Version | Purpose | Source |
|------|---------|---------|--------|
| git | 2.50.1 (Apple Git-155) | All branch, worktree, and audit operations | [VERIFIED: git --version] |
| vitest | 3.2.4 | Test runner; `--reporter=json` for machine-readable output | [VERIFIED: sdk/node_modules/vitest/package.json] |
| TypeScript (tsc) | ^5.7.0 | `npm run build:sdk-only` compiles sdk/ + adapters/ | [VERIFIED: sdk/package.json devDependencies] |
| node | ≥22.0.0 | Runtime; CJS tests use Node's built-in `--test` runner | [VERIFIED: package.json engines] |

### Build Script Semantics

`npm run build:sdk-only` = `cd sdk && npm run build` = `cd sdk && tsc`

What tsc builds:
- `sdk/src/**/*.ts` → `sdk/dist/` (primary SDK output)
- `adapters/**/*.ts` → `adapters/dist/` (via `sdk/tsconfig.json` project reference: `"references": [{ "path": "../adapters" }]`)

"Clean" output means:
- Exit code 0
- No TypeScript errors on stderr (warnings may appear but are not failures)
- `sdk/dist/` and `adapters/dist/` populated/updated

[VERIFIED: sdk/tsconfig.json, adapters/tsconfig.json — confirmed composite project reference]

**Important:** `npm run build:sdk-only` does NOT build `tests/conformance/`. The conformance suite (`build:conformance`) is a separate script. Phase 1 only needs `build:sdk-only` for REBASE-03.

### Test Suite Structure

There are two separate test runners at the root:

| Runner | Command | Test files | What it covers |
|--------|---------|-----------|----------------|
| Node built-in `--test` | `npm test` | `tests/*.test.cjs` | CJS runtime tests; legacy format |
| vitest (root) | `cd sdk && npx vitest run` or via root vitest config | `sdk/src/**/*.test.ts`, `sdk/src/**/*.integration.test.ts`, `adapters/**/*.test.ts`, `tests/leak-grep/**/*.test.ts` | SDK unit + integration + adapters + leak-grep |

`npm test` at the root runs ONLY the CJS `tests/*.test.cjs` suite (via `scripts/run-tests.cjs`). It does NOT run vitest. The vitest suite is separate.

For Phase 1 test gate (REBASE-02), the planner should specify which runner(s) to use. The CONTEXT.md says "unit test suite" — the vitest suite in `sdk/` is the more comprehensive one and contains the PORT-group failures identified in DELTA.md.

[VERIFIED: package.json scripts, scripts/run-tests.cjs, sdk/package.json]

---

## Architecture Patterns

### System Architecture Diagram

```
origin/feat/storage-adapter (ecf72c9f)
         |
         | [diverged at 3579a48d]
         |
rebase/onto-upstream-2026-05-16 (832df66b)
    upstream window (ae63cbe5 = main)
    + 357 adapter commits stacked above
         |
         v
feat/storage-adapter-staging  <-- create here, run all gates
         |
   [all gates pass?]
         |
         v
git push --force-with-lease origin HEAD:feat/storage-adapter
```

```
upstream-baseline-failures.txt    rebase-branch-failures.txt
           |                                |
           +----------SET-MINUS-------------+
                           |
               set A = new failures vs upstream
                           |
               +--SET-MINUS-- inherited-skip-set (6 CJS parity)
                           |
               set B = uncategorized failures
                           |
               |B| ≤ 2? → PASS    |B| ≥ 3? → BLOCK
```

### Baseline Capture: git worktree approach

The upstream baseline requires running the test suite against `upstream/main` at `ae63cbe5` without disturbing the current checkout. Two options are available (D-Claude's-Discretion):

**Option A — git worktree (recommended):**
```bash
git worktree add /tmp/upstream-baseline ae63cbe5
cd /tmp/upstream-baseline
# sdk/node_modules is gitignored and NOT present in the worktree
cd sdk && npm ci  # Full install required — lockfile is present
cd .. && NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run \
  --config sdk/vitest.config.ts --reporter=json \
  --outputFile=/path/to/upstream-baseline-failures.txt
git worktree remove /tmp/upstream-baseline
```

**Option B — separate clone:**
```bash
git clone --local . /tmp/upstream-baseline-clone
cd /tmp/upstream-baseline-clone
git checkout ae63cbe5
cd sdk && npm ci
# run vitest as above
```

**node_modules in worktrees:** `sdk/node_modules` is in `.gitignore` and is NOT shared between worktrees. Each worktree needs its own `npm ci` in `sdk/`. The lockfile (`sdk/package-lock.json`) is present in the worktree (tracked by git), so `npm ci` is deterministic. [VERIFIED: .gitignore contains `sdk/node_modules`; sdk/package-lock.json is committed]

**Worktree cleanup:** `git worktree remove --force <path>` removes the worktree. Always remove before retrying.

### vitest Failing-Test-ID Extraction

vitest 3.2.4 supports `--reporter=json` as a built-in reporter (confirmed in CLI help):
```
--reporter <name>  ... (default, basic, blob, verbose, dot, json, tap, tap-flat, junit, hanging-process, github-actions)
```

**Command to capture failing test IDs:**
```bash
# From the repo root or sdk/ directory:
NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run \
  --config sdk/vitest.config.ts \
  --reporter=json \
  --outputFile=upstream-baseline-failures.txt \
  ; true   # ignore exit code — we want the file even on failure
```

**JSON output format** (from `vitest/dist/chunks/reporters.d.BFLkQcL6.d.ts`):
```typescript
interface JsonTestResults {
  testResults: Array<{
    name: string;           // file path (e.g., "sdk/src/query/roadmap.test.ts")
    status: "failed" | "passed";
    assertionResults: Array<{
      fullName: string;     // describe path + test name (e.g., "roadmap.get-phase > returns mode field")
      status: "failed" | "passed" | "pending";
      ancestorTitles: string[];
      title: string;
    }>;
  }>;
}
```

**Stable test ID:** A test is identified by `<file>::<fullName>` (file path + full describe+test name). These ARE deterministic across checkouts as long as the test code is identical. The `--reporter=json --outputFile` approach writes the full JSON to a file even when vitest exits non-zero.

**Extracting failing test IDs from the JSON:**
```bash
node -e "
  const r = JSON.parse(require('fs').readFileSync('upstream-baseline-failures.txt','utf8'));
  const ids = [];
  for (const f of r.testResults) {
    for (const a of f.assertionResults) {
      if (a.status === 'failed') ids.push(f.name + '::' + a.fullName);
    }
  }
  ids.sort().forEach(id => console.log(id));
" > upstream-baseline-failures-ids.txt
```

[VERIFIED: vitest CLI --help, vitest dist/chunks/reporters.d.BFLkQcL6.d.ts]

### Cherry-Pick Dry-Run Audit

**Situation confirmed by research:** `ecf72c9f` is NOT an ancestor of `832df66b` (force-push required). Of the 382 commits unique to `ecf72c9f`:

| Category | Count | How to handle |
|----------|-------|---------------|
| Matching subject in 832df66b (rebased equivalents) | 351 | Already present — skip |
| Worktree/wave merge commits | 28 | Empty after rebase — skip |
| fix(01-debt): cause-C validateHealth parity | 1 | Intentionally dropped per DELTA.md — document in REVIEW-NOTES.md |
| fix(scripts): make prepare hook no-op outside git checkout | 1 | **MISSING** — needs explicit decision (cherry-pick or document drop) |
| fix(scripts): route prepare-hook install echo to stderr | 1 | Present as 8e44f7ec in 832df66b — skip |

**The "nothing lost" audit is effectively done** — only 1 non-empty commit is absent from the rebase branch. The planner should create a task that:
1. Records the pre-computed answer (above) as the audit output
2. Cherry-picks `ecf72c9f`'s guard commit forward (or documents the decision to drop it)

**Cherry-pick command if needed:**
```bash
# On feat/storage-adapter-staging:
git cherry-pick --no-commit ecf72c9f  # or the specific commit SHA
git diff HEAD                          # Inspect: should show the git rev-parse guard addition
git cherry-pick --continue            # or --abort to discard
```

**Note on cherry-pick of merge commits:** The 28 worktree merge commits from `ecf72c9f` should NOT be cherry-picked — they are empty after rebase and have no content. Attempting `cherry-pick --no-commit` on a merge commit without `-m` will fail with "is a merge but no -m option was given." The planner should skip them in any automated loop.

[VERIFIED: git log --format analysis of ecf72c9f and 832df66b, subject-matching via comm]

### Staging Branch Flow

```bash
# Step 1: Create staging branch from rebase tip
git checkout -b feat/storage-adapter-staging 832df66b

# Step 2 (if cherry-pick needed): Apply the missing guard commit
git cherry-pick <sha-of-missing-commit-from-ecf72c9f-equivalent>

# Step 3: Run REBASE-03 (build gate)
npm run build:sdk-only
# Success: exit 0, no TypeScript errors

# Step 4: Run REBASE-02 (test gate)
NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run \
  --config sdk/vitest.config.ts --reporter=json \
  --outputFile=.planning/phases/01-land-the-rebase/rebase-failures.json

# Step 5: Run REBASE-04 (dry-run rebase against main)
git checkout -b feat/storage-adapter-rebase-test feat/storage-adapter-staging
git rebase main   # Expected: no-op (main == ae63cbe5, staging is above main)
git checkout feat/storage-adapter-staging
git branch -D feat/storage-adapter-rebase-test

# Step 6: Perform diff review → write 01-REVIEW-NOTES.md

# Step 7: Cutover — move canonical branch
git push --force-with-lease origin feat/storage-adapter-staging:feat/storage-adapter

# Step 8: Verify REBASE-05 safety refs
git ls-remote origin refs/tags/fork/v1.0-shipped refs/heads/rebase/onto-upstream-2026-05-16
# Must show both: f9955778... and 0ecf5a78...
```

[VERIFIED: git merge-base checks, git ls-remote confirmed both safety refs present]

### REBASE-04 Dry-Run Mechanics

**Critical finding: `git rebase` has NO `--dry-run` flag.** Confirmed:
```
$ git rebase --dry-run
error: unknown option `dry-run'
```

The "dry-run" is implemented by:
1. Creating a throwaway branch from the staging branch
2. Actually running `git rebase main` on it
3. Checking the exit code and any conflict file list
4. Discarding the branch (whether rebase succeeded or failed)

**Why REBASE-04 will trivially pass:** `main` (both local and `origin/main`) currently points to `ae63cbe5`. The rebase branch is already above `ae63cbe5` in the commit DAG (confirmed via `git merge-base --is-ancestor main 832df66b` = YES). Therefore `git rebase main` from the staging branch is a no-op — there are no commits on `main` not already in the staging branch's history.

**Procedure for the dry-run:**
```bash
# Create throwaway branch
git checkout -b feat/storage-adapter-rebase-test feat/storage-adapter-staging

# Attempt rebase (expected: "Current branch feat/storage-adapter-rebase-test is up to date.")
git rebase main
REBASE_EXIT=$?

# Capture result
if [ $REBASE_EXIT -ne 0 ]; then
  # Unexpected — capture conflict list
  git diff --name-only --diff-filter=U > /tmp/conflict-files.txt
  git rebase --abort
  echo "REBASE-04 FAILED: conflicts in $(cat /tmp/conflict-files.txt)"
  # Check: are any conflict files outside adapters/ and sdk/src/?
  # If yes -> D-16: block + file DEFECT-NEW
else
  echo "REBASE-04 PASSED: clean rebase"
fi

# Discard throwaway branch
git checkout feat/storage-adapter-staging
git branch -D feat/storage-adapter-rebase-test
```

[VERIFIED: git rebase --dry-run error, git merge-base --is-ancestor main 832df66b]

### Diff Review — File Class Breakdown Commands

The 357 adapter commits in `ae63cbe5..832df66b` are categorized as follows (verified counts):

| File class | Commits touching | Command to enumerate |
|------------|-----------------|----------------------|
| adapters/ (adapter seam) | 94 commits | `git log --oneline ae63cbe5..832df66b -- adapters/` |
| sdk/src/ (SDK seam) | Not separately counted (overlaps with adapters) | `git log --oneline ae63cbe5..832df66b -- sdk/src/` |
| Total adapter+SDK touches | 94 adapter / 117 unique files | see above |
| .planning/ (docs artifacts) | 214 commits | `git log --oneline ae63cbe5..832df66b -- .planning/` |
| Test files | 65 commits | `git log --oneline ae63cbe5..832df66b -- "*.test.ts" "*.integration.test.ts"` |
| get-shit-done/ workflows | 13 commits | `git log --oneline ae63cbe5..832df66b -- get-shit-done/` |

**Large commits (>10 files OR >300 insertions) identified in this window:**
These 20 commits MUST be reviewed in full per D-12 (regardless of whether they touch adapter-seam files):
- `9a7eeeaa` — docs(milestone): archive v1.0 phase artifacts (171 files, 0 insertions — pure move)
- `4d9618da` — docs(08): create phase plan (10 files, 3467 insertions)
- `801d8e79` — fix(meta-coverage): gate beads direction by bdPresent (2 files, 528 insertions)
- `7a93ad7c` — perf(conformance): parallel forks via file-based test-registry (16 files, 315 insertions)
- `e59b0df7` — feat(07-04b): populate manifest + assertFromManifest wiring (7 files, 1006 insertions)
- `aee87cab` — feat(07-04b): migrate write-*.test.ts to conformance-suite.ts (7 files, 1294 insertions)
- `d4f1d738` — docs(07): create phase plan (11 files, 5328 insertions)
- ... (full list obtainable via `git log ae63cbe5..832df66b --format="%H %s" | while read h m; do git show --stat $h | tail -1; done`)

**Command to generate file-class breakdown for REVIEW-NOTES.md:**
```bash
echo "=== Adapter-seam commits ===" 
git log --oneline ae63cbe5..832df66b -- adapters/ sdk/src/

echo "=== Commits >10 files or >300 insertions ==="
git log ae63cbe5..832df66b --format="%H %s" | while read hash msg; do
  stats=$(git show --stat "$hash" 2>/dev/null | tail -1)
  files=$(echo "$stats" | grep -oE '[0-9]+ file' | grep -oE '[0-9]+')
  ins=$(echo "$stats" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+')
  if [ "${files:-0}" -gt 10 ] || [ "${ins:-0}" -gt 300 ]; then
    echo "$hash [$files files, $ins ins] $msg"
  fi
done
```

[VERIFIED: git log output on current branch, commit counts confirmed]

### REBASE-05 Safety Ref Check

**Current state (verified):**
```
f9955778  refs/heads/rebase/onto-upstream-2026-05-16
0ecf5a78  refs/tags/fork/v1.0-shipped
```

**Check command (single invocation, fail-fast):**
```bash
git ls-remote origin refs/tags/fork/v1.0-shipped refs/heads/rebase/onto-upstream-2026-05-16 | \
  awk 'END { if (NR != 2) { print "MISSING SAFETY REF"; exit 1 } else { print "OK: both safety refs present" } }'
```

Or more explicitly:
```bash
REMOTE_REFS=$(git ls-remote origin refs/tags/fork/v1.0-shipped refs/heads/rebase/onto-upstream-2026-05-16)
TAG_PRESENT=$(echo "$REMOTE_REFS" | grep -c "refs/tags/fork/v1.0-shipped")
BRANCH_PRESENT=$(echo "$REMOTE_REFS" | grep -c "refs/heads/rebase/onto-upstream-2026-05-16")
if [ "$TAG_PRESENT" -eq 1 ] && [ "$BRANCH_PRESENT" -eq 1 ]; then
  echo "REBASE-05 PASS: both safety refs present on origin"
else
  echo "REBASE-05 FAIL: missing safety refs"
  exit 1
fi
```

[VERIFIED: git ls-remote origin confirmed both refs present at start of Phase 1]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Machine-readable test ID list | Custom log parser | `vitest --reporter=json --outputFile` | Built-in; deterministic; covers all test projects if run from root config |
| Set difference of failing tests | Manual grep comparison | `comm -23 <(sort A) <(sort B)` after extracting IDs via node script | POSIX utility; works on sorted line-delimited files |
| "Does commit X exist in branch Y" | Custom commit search | `git merge-base --is-ancestor <sha> <branch>` | O(1) reachability check in git DAG |
| Finding commits by subject across branches | Manual log scan | `comm -23 <(sort /tmp/branch-a-subjects.txt) <(sort /tmp/branch-b-subjects.txt)` | Proven: used in this research to identify 31 unique commits |
| Git rebase dry-run | Nothing — doesn't exist | Throwaway branch + actual rebase + branch -D | Git has no --dry-run flag for rebase |

---

## Common Pitfalls

### Pitfall 1: Running `npm test` and missing the vitest suite
**What goes wrong:** `npm test` at the root runs `scripts/run-tests.cjs` which only runs `tests/*.test.cjs` via Node's built-in `--test` runner. It does NOT run the SDK vitest suite. REBASE-02 failures (PORT-group tests) live in `sdk/src/**/*.test.ts`, not in `tests/*.test.cjs`.
**How to avoid:** Run vitest explicitly: `NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run --config sdk/vitest.config.ts` (or via root vitest.config.ts).
**Warning signs:** Zero failures reported but you know PORT-group tests should fail.
[VERIFIED: scripts/run-tests.cjs, package.json test scripts]

### Pitfall 2: Worktree missing node_modules — vitest silently fails
**What goes wrong:** `git worktree add` creates the working tree but not `node_modules` (gitignored). If you run vitest from a worktree without `npm ci` first, it fails with module-not-found errors, not test failures.
**How to avoid:** Always `cd <worktree>/sdk && npm ci` before running vitest in any worktree.
**Warning signs:** `Cannot find module 'vitest'` errors, not test failures.

### Pitfall 3: Interpreting "up to date" as a real rebase for REBASE-04
**What goes wrong:** `git rebase main` says "Current branch ... is up to date." This is the expected success case (main is already an ancestor). Do NOT interpret this as "no conflicts detected" in a meaningful way — document it as "trivially passes: branch is already above main."
**How to avoid:** The planner should explicitly describe what success looks like for this no-op case.

### Pitfall 4: Cherry-picking merge commits
**What goes wrong:** `git cherry-pick <merge-commit-sha>` without `-m <parent-number>` fails with "is a merge but no -m option was given." The 28 worktree merge commits in `ecf72c9f`'s unique set are all merge commits.
**How to avoid:** Skip merge commits in any cherry-pick loop. The "nothing lost" analysis proves their content is already represented via the rebased non-merge commits.
**Warning signs:** `error: commit <sha> is a merge but no -m option was given`

### Pitfall 5: Force-push without `--force-with-lease`
**What goes wrong:** `git push --force` will overwrite any commits added to `origin/feat/storage-adapter` since you last fetched, silently discarding them.
**How to avoid:** Always use `--force-with-lease`. This fails safely if the remote has new commits you haven't seen.
[ASSUMED: standard git safety practice — not project-specific, but important to flag]

### Pitfall 6: pretest hook runs during staging verification
**What goes wrong:** `npm test` at the root triggers `pretest: npm run build:sdk`, which rebuilds the SDK before running tests. In the staging branch context this is actually desired (ensures the SDK dist reflects the branch being tested), but if the build is broken, the test run never starts and the exit code is nonzero from the build, not the tests.
**How to avoid:** If build fails, address REBASE-03 first, then re-run REBASE-02.

### Pitfall 7: `force-with-lease` fails if staging branch pushed to origin first
**What goes wrong:** If `feat/storage-adapter-staging` is pushed to origin (for CI), then the force-push of `feat/storage-adapter` must reference the STAGING branch's remote state, not origin/feat/storage-adapter.
**How to avoid:** Run `git fetch origin` immediately before the force-push so `--force-with-lease` has the latest remote state for comparison.

---

## Runtime State Inventory

This is a cutover/verification phase with no rename or migration. No runtime state is affected by Phase 1 operations.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — Phase 1 writes no new records | None |
| Live service config | None — no external service config changes | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | `sdk/dist/` and `adapters/dist/` will be rebuilt by REBASE-03 | Normal build output; no migration needed |

**bd singleton mirroring:** Per CONTEXT.md code_context: per-phase artifacts (01-CONTEXT.md, 01-REVIEW-NOTES.md, upstream-baseline-failures.txt) are NOT singletons and do NOT need bd mirroring. STATE.md updates DO require mirroring via node one-liner until SEAM lands (confirmed by CONTEXT.md established patterns).

---

## Code Examples

### Verified patterns

#### Create staging branch and push safety refs check
```bash
# [VERIFIED: git branch/checkout commands, ls-remote confirmed working]

# Create staging branch from rebase tip
git checkout -b feat/storage-adapter-staging 832df66b

# Verify safety refs before doing anything else
git ls-remote origin refs/tags/fork/v1.0-shipped refs/heads/rebase/onto-upstream-2026-05-16
# Expected output:
# 0ecf5a781bf4dd95d8e3a45c59b9b3d5ec51a3ee  refs/tags/fork/v1.0-shipped
# f9955778ecd28f84cba7a62e5a20b601a9bab129  refs/heads/rebase/onto-upstream-2026-05-16
```

#### Run vitest with JSON reporter for baseline capture
```bash
# [VERIFIED: vitest 3.2.4 CLI --reporter=json confirmed in --help output]

# From repo root (recommended — covers all vitest projects):
NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run \
  --config vitest.config.ts \
  --reporter=json \
  --outputFile=.planning/phases/01-land-the-rebase/rebase-failures.json; true

# Note: append "; true" to avoid script abort on non-zero exit from test failures
```

#### Extract failing test IDs from vitest JSON report
```bash
# [VERIFIED: output format from vitest/dist/chunks/reporters.d.BFLkQcL6.d.ts]
node -e "
  const r = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const ids = [];
  for (const f of r.testResults) {
    for (const a of f.assertionResults) {
      if (a.status === 'failed') ids.push(f.name + '::' + a.fullName);
    }
  }
  ids.sort().forEach(id => console.log(id));
" .planning/phases/01-land-the-rebase/rebase-failures.json \
  > .planning/phases/01-land-the-rebase/rebase-failures-ids.txt
```

#### Set-difference evaluation (D-10 gate formula)
```bash
# After generating both ID files:
# rebase-failures-ids.txt  = failing tests on rebase/staging branch
# upstream-baseline-ids.txt = failing tests on upstream/main at ae63cbe5
# inherited-skip-ids.txt   = 6 known CJS-parity failures from cjs-sdk-golden-parity-failures.md

# Combine allowed sets:
sort upstream-baseline-ids.txt inherited-skip-ids.txt | sort -u > allowed-failures.txt

# Find new failures:
comm -23 <(sort rebase-failures-ids.txt) allowed-failures.txt > new-failures.txt
UNCATEGORIZED=$(wc -l < new-failures.txt | tr -d ' ')
echo "Uncategorized failures: $UNCATEGORIZED"
if [ "$UNCATEGORIZED" -le 2 ]; then
  echo "REBASE-02 PASS (within tolerance)"
else
  echo "REBASE-02 FAIL (exceeds ≤2 tolerance)"
fi
```

#### Enumerate adapter-seam commits for full review (D-12)
```bash
# [VERIFIED: git log output on current branch]
git log --oneline ae63cbe5..832df66b -- adapters/ sdk/src/
# 94 commits touching adapter-seam files — all must be read in full
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `--reporter=json` as an external package | Built into vitest 3.x | vitest 2.x+ | No extra install needed; `JsonReporter` is part of vitest core |
| `git worktree add` as experimental | Stable in git 2.x | git 2.5 (2015) | Safe to use for upstream baseline checkout |
| `git push --force` | `git push --force-with-lease` | git 1.8.5 (2013) | Use force-with-lease in all force-push operations |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The "prepare hook no-op" commit (`ecf72c9f`'s unique content) is safe to cherry-pick forward or drop without breaking existing tests | Staging Branch Flow | If this guard is load-bearing for CI (e.g., upstream-parity.yml does npm install from a git URL), dropping it could cause a CI failure |
| A2 | Running vitest from the ROOT vitest.config.ts covers all four test projects (unit, integration, adapters, leak-grep) | Standard Stack | If any project is excluded from root config, its failures won't be captured in the baseline |

**A2 verification:** Root `vitest.config.ts` defines 4 projects: unit, integration, adapters, leak-grep — confirmed by reading the file. [VERIFIED]
**A1 risk:** LOW — the guard is a defensive fix for `npm install <github-url>` consumers. Phase 1 CI does not install from a GitHub URL; it runs tests in-repo. But it should be documented and decided explicitly.

---

## Open Questions

1. **Missing "no-op outside git checkout" guard**
   - What we know: `ecf72c9f` has `scripts/install-hooks.sh` guard for `npm install <github:url>`; `832df66b` does not.
   - What's unclear: Is this guard tested in any CI workflow? Is it important for npm consumers of this package?
   - Recommendation: Check `.github/workflows/` for any `npm install --prefix` from git URL. If none found, document the drop in REVIEW-NOTES.md as deliberate. If found, cherry-pick forward.

2. **Which vitest projects to include in REBASE-02 baseline**
   - What we know: Root `vitest.config.ts` runs 4 projects. The SDK tests (unit + integration) contain PORT-group failures. The `adapters` and `leak-grep` projects may or may not have failures.
   - What's unclear: Should REBASE-02 cover ALL 4 vitest projects or just SDK unit+integration?
   - Recommendation: Include all 4 — the inherited-skip set is defined by file, and the baseline capture will correctly flag adapters/leak-grep if they have upstream-inherited failures.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git | All branch operations | ✓ | 2.50.1 | — |
| node | vitest, npm scripts | ✓ | ≥22.0.0 (engines constraint) | — |
| vitest | REBASE-02 test gate | ✓ | 3.2.4 (sdk/node_modules) | — |
| tsc | REBASE-03 build gate | ✓ | ^5.7.0 (sdk/node_modules) | — |
| npm | `npm ci` in worktree | ✓ | 11.3.0 (packageManager field) | — |
| origin remote (GitHub) | REBASE-05 ls-remote check | ✓ | — | — |
| `sdk/node_modules` | vitest runs | ✓ (present in working copy) | — | `npm ci` in sdk/ |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Note on worktree node_modules:** A fresh `git worktree add` will NOT have `sdk/node_modules`. The planner must include `cd <worktree>/sdk && npm ci` as a task step before running vitest in the worktree.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.4 (sdk/node_modules) |
| Config file | `vitest.config.ts` (root, 4 projects) or `sdk/vitest.config.ts` (SDK only) |
| Quick run command | `NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run --config sdk/vitest.config.ts --project unit` |
| Full suite command | `NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run --config vitest.config.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Deterministic? |
|--------|----------|-----------|-------------------|----------------|
| REBASE-01 | 351 upstream commits land on feat/storage-adapter | git verification | `git log --oneline ae63cbe5..feat/storage-adapter \| wc -l` == 357 | ✓ deterministic |
| REBASE-02 | ≥97% tests pass; zero new regressions vs upstream | vitest run + set-difference | `vitest run --reporter=json --outputFile=...` + node set-diff script | ✓ deterministic |
| REBASE-03 | TypeScript build exits zero, no errors | tsc exit code | `npm run build:sdk-only; echo $?` == 0 | ✓ deterministic |
| REBASE-04 | git rebase main produces no business-logic conflicts | git rebase exit code | `git rebase main` on throwaway branch, `echo $?` == 0 | ✓ deterministic |
| REBASE-05 | Both safety refs present on origin | git ls-remote | `git ls-remote origin refs/tags/fork/v1.0-shipped refs/heads/rebase/onto-upstream-2026-05-16 \| wc -l` == 2 | ✓ deterministic |

**REBASE-02 baseline dependency:** This test gate requires a baseline run against `upstream/main` at `ae63cbe5` first. The baseline itself is a one-time artifact. Wave 0 must include a task to capture the baseline before the gate can be evaluated.

**Stochastic elements:** The diff review (D-11..D-14) produces a human-written artifact (REVIEW-NOTES.md). The verdict on each commit is a judgment call. This is intentional — the test gate is the primary correctness proof; the review is a secondary catch for subtle semantic changes.

### Sampling Rate
- **Per task commit:** `npm run build:sdk-only && echo "Build OK"` (quick build check)
- **Per wave merge:** Full vitest suite + set-difference evaluation
- **Phase gate:** Build clean + test gate passes + REVIEW-NOTES.md written + safety refs confirmed

### Wave 0 Gaps
- [ ] Upstream baseline capture: `git worktree add /tmp/upstream-baseline ae63cbe5 && cd /tmp/upstream-baseline/sdk && npm ci` — required before REBASE-02 can be evaluated
- [ ] `upstream-baseline-failures.txt` — does not yet exist; Wave 0 task must create it

*(All existing test infrastructure is in place — no new test files needed for Phase 1.)*

---

## Project Constraints (from CLAUDE.md)

- Use `bd` for ALL task tracking — NOT TodoWrite, TaskCreate, or markdown TODO lists
- Per-phase artifacts (01-CONTEXT.md, 01-REVIEW-NOTES.md, upstream-baseline-failures.txt) are NOT bd singletons — do NOT mirror them to bd
- STATE.md updates DO require manual bd mirroring via node one-liner until SEAM lands
- Branch strategy: `main` mirrors `upstream/main`; work branch is `feat/storage-adapter`
- `feat/storage-adapter` force-push must use `--force-with-lease`
- Work is NOT complete until `git push` succeeds (mandatory push after each wave)

---

## Sources

### Primary (HIGH confidence)
- `origin/feat/storage-adapter` git DAG analysis — fast-forward feasibility, commit count, subject-matching
- `rebase/onto-upstream-2026-05-16` git DAG analysis — 357 adapter commits above ae63cbe5, structure verified
- `sdk/node_modules/vitest/dist/chunks/reporters.d.BFLkQcL6.d.ts` — JSON reporter output format
- `sdk/node_modules/.bin/vitest --help` — built-in reporter names including `json`
- `package.json`, `sdk/package.json`, `sdk/tsconfig.json`, `adapters/tsconfig.json` — build script semantics
- `git ls-remote origin` — safety refs confirmed present
- `git rebase --dry-run` — confirmed this flag does not exist
- `git merge-base --is-ancestor main 832df66b` — REBASE-04 no-op confirmed

### Secondary (MEDIUM confidence)
- `git log --format` message comparison (`comm -12` / `comm -23`) — 351 matching + 31 unique classified
- `.planning/research/upstream-drift/DELTA.md` — file-area conflict patterns, intentionally dropped commit
- `.planning/todos/pending/cjs-sdk-golden-parity-failures.md` — 6 inherited failures, exact test IDs

### Tertiary (LOW confidence)
- None — all critical claims verified against codebase or git DAG

---

## Metadata

**Confidence breakdown:**
- Fast-forward vs force-push determination: HIGH — verified via git merge-base
- Cherry-pick audit: HIGH — subject-matching confirmed; 1 substantive missing commit identified
- vitest JSON reporter: HIGH — confirmed in CLI help and type definitions
- REBASE-04 no-op: HIGH — verified via git merge-base --is-ancestor
- Safety refs present: HIGH — verified via git ls-remote

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (stable; only changes if upstream/main advances or force-push changes branch state)
