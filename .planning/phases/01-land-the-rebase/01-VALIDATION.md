---
phase: 1
slug: land-the-rebase
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 01-RESEARCH.md §"Validation Architecture" + 01-CONTEXT.md decisions.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.4 (in `sdk/node_modules`) |
| **Config file** | `vitest.config.ts` (root, 4 projects) — primary; `sdk/vitest.config.ts` (SDK only) for fast iteration |
| **Quick run command** | `NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run --config sdk/vitest.config.ts --project unit` |
| **Full suite command** | `NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run --config vitest.config.ts --reporter=json --outputFile=/tmp/phase-01-rebase-failures.json` |
| **Estimated runtime** | ~60s quick / ~5min full suite |

**Note:** root `npm test` uses Node's built-in `--test` and ONLY exercises `tests/*.test.cjs`. The PORT-group failures DELTA.md tracks live in `sdk/src/**/*.test.ts` and require the vitest invocation above. REBASE-02's gate runs against the full vitest suite, not `npm test`.

---

## Sampling Rate

- **After every task commit (build-affecting):** `npm run build:sdk-only` (TypeScript exit code = 0)
- **After every wave merge:** Full vitest suite via the full-suite command above
- **Before phase close:** Full suite green AND set-difference evaluation against upstream baseline ≤ 2 uncategorized
- **Max feedback latency:** 5 minutes (full suite); 60s (build + quick suite)

---

## Per-Task Verification Map

> Tasks below are illustrative — the planner may adjust IDs/granularity. Each REQ has at least one deterministic gate.

| Req ID | Phase Gate | Test Type | Automated Command | Deterministic? | File Exists |
|--------|------------|-----------|-------------------|----------------|-------------|
| REBASE-01 | All 357 adapter commits above `ae63cbe5` on `feat/storage-adapter` | git DAG check | `[ "$(git log --oneline ae63cbe5..feat/storage-adapter \| wc -l \| tr -d ' ')" = "357" ]` | ✓ | ✅ |
| REBASE-01 | "Nothing lost" cherry-pick audit produced ≤ 1 substantive missing commit (researcher: `fix(scripts)` only) | bash + diff | scripted cherry-pick walk; non-empty diffs ≤ 1 | ✓ | ❌ W0 |
| REBASE-02 | Upstream baseline failure list captured | vitest at `ae63cbe5` worktree | `cd /tmp/upstream-baseline/sdk && NODE_PATH=./node_modules ./node_modules/.bin/vitest run --reporter=json --outputFile=/tmp/upstream-baseline-failures.json` | ✓ | ❌ W0 |
| REBASE-02 | Set-difference: rebase failures \\ upstream failures \\ inherited-skip ≤ 2 | node script | `node scripts/baseline-diff.cjs /tmp/upstream-baseline-failures.json /tmp/phase-01-rebase-failures.json` | ✓ | ❌ W0 |
| REBASE-03 | TypeScript build exits 0 | npm script | `npm run build:sdk-only; [ $? -eq 0 ]` | ✓ | ✅ |
| REBASE-04 | `git rebase main` from throwaway branch returns 0 conflicts in business-logic files | git + grep | `git checkout -b throwaway feat/storage-adapter-staging && git rebase main; rc=$?; [ $rc -eq 0 ] \|\| (git diff --name-only --diff-filter=U \| grep -vE '^(adapters\|sdk/src/.*adapter)' \| wc -l) -eq 0` | ✓ | ✅ |
| REBASE-05 | Both safety refs present on origin | git ls-remote | `[ "$(git ls-remote origin refs/tags/fork/v1.0-shipped refs/heads/rebase/onto-upstream-2026-05-16 \| wc -l \| tr -d ' ')" = "2" ]` | ✓ | ✅ |

*Status legend: ✅ infrastructure exists · ❌ W0 = Wave 0 task must create it*

---

## Wave 0 Requirements

- [ ] **Upstream baseline worktree:** `git worktree add /tmp/upstream-baseline ae63cbe5 && (cd /tmp/upstream-baseline/sdk && npm ci)` — required before REBASE-02 baseline capture
- [ ] **Baseline failure capture:** Run vitest in baseline worktree, persist failing test IDs to `.planning/phases/01-land-the-rebase/upstream-baseline-failures.txt` (or .json — planner picks format)
- [ ] **Set-difference script:** small node script (`scripts/baseline-diff.cjs` or in-line) that takes two vitest JSON outputs + the inherited-skip list and reports the set-difference count + categorization. Reusable for future rebase milestones if generalized.
- [ ] **Cherry-pick audit script (or commands):** enumerate commits unique to `origin/feat/storage-adapter`, attempt cherry-pick to scratch branch with `--no-commit`, classify diff as empty / substantive. The researcher's manual audit produced 1 substantive miss (`fix(scripts) prepare hook no-op`) — this Wave 0 task either reproduces that result or accepts it from the research artifact.

*If existing infrastructure is sufficient: **NO** — three Wave-0 artifacts above are net-new for v1.1.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Diff review of 357 commits — flagged-surprise verdict | REBASE-01 SC §"diff has been read and accepted" | Verdict on subtle semantic changes is a human judgment call; cannot be automated without reproducing what tests already do | Spot-check by file class per D-11..D-14; record verdicts in `01-REVIEW-NOTES.md`; flag anything the test gate could plausibly miss (e.g., config-field semantic drift, error-message changes that might affect downstream parsing) |
| Force-push approval | D-02 cutover | Destructive action against shared remote; requires explicit human go-ahead per CLAUDE.md "Executing actions with care" | Phase 1 final task pauses for user confirmation before `git push --force-with-lease origin feat/storage-adapter` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (3 W0 artifacts above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5 minutes (full suite); < 60s (build + quick suite)
- [ ] `nyquist_compliant: true` set in frontmatter (toggle after planner approves)

**Approval:** pending
