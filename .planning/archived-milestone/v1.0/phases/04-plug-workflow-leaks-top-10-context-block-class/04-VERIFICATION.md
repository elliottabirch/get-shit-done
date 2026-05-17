<!-- leak-grep-allow file — verification artifact describes the leak patterns it verifies; self-referential quoting is by design -->
---
phase: 04-plug-workflow-leaks-top-10-context-block-class
verified: 2026-05-11T00:00:00Z
status: gaps_found
score: 4/5 must-haves verified (1 retroactively-discovered minor gap)
overrides_applied: 0
retroactive: true
gaps:
  - truth: "Full codebase zero-leak state (Plan 07 SC) across all workflow subdirectories"
    status: partial
    reason: "Plan 07's final scan used non-recursive glob on get-shit-done/workflows/*.md and missed the execute-phase/steps/ subdirectory. post-merge-gate.md contains a find-shell false positive pattern (exclusion path, not a leak) that was present before Phase 4 and remains unsuppressed."
    severity: minor
    artifacts:
      - path: "get-shit-done/workflows/execute-phase/steps/post-merge-gate.md"
        issue: "Line 32 has `-not -path './.planning/*'` exclusion in a find command — triggers find-shell pattern in workflow zone. Not an actual leak (it is a path EXCLUSION), but leak-grep flags it."
    missing:
      - "Add `<!-- leak-grep-ignore -->` directive on line 32 of post-merge-gate.md (simple false-positive suppression), OR extend Plan 07's final scan to recurse into workflow subdirectories."
    note: "Retroactive finding; Phase 4 is marked complete. Does NOT affect ROADMAP SC#1 (top-10 workflows scan clean) or SC#2 (CI gate works). Affects the Plan 07 'zero-leak state across all zones' narrative."
---

# Phase 4: Plug workflow leaks (top-10 + `<context>`-block class) — Verification Report

**Phase Goal:** The 10 heaviest leaking workflows + the new `<context>`-block frontmatter leak class no longer touch `.planning/` directly; a CI gate prevents regression; the two raw-git outliers are fixed.
**Verified:** 2026-05-11
**Status:** gaps_found (retroactively discovered, non-blocking)
**Re-verification:** No — this is retroactive initial verification.

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP.md §Phase 4)

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | Running the workflow-level leak-grep (R5 patterns) over plan-phase, execute-phase, spike, forensics, progress, verify-phase, sketch, discuss-phase, execute-plan, gsd-debugger returns zero matches | VERIFIED | `node scripts/leak-grep.cjs get-shit-done/workflows/{plan-phase,execute-phase,spike,forensics,progress,verify-phase,sketch,discuss-phase,execute-plan}.md agents/gsd-debugger.md` → 0 matches across 10 files, exit 0 |
| 2   | CI gate fails on deliberately-introduced regression PR (observable to PR authors) | VERIFIED | Test: `echo 'Read ".planning/STATE.md"' > /tmp/test-leak.md && node scripts/leak-grep.cjs /tmp/test-leak.md` → exit 1 with "1 match(es)". Hook symlink installed at `.git/hooks/pre-commit` → `scripts/pre-commit-leak-gate.sh` (exists, executable). Hook blocks commits with clear error message (lines 18-30 of hook script). |
| 3   | OQ-04 resolved: every skill frontmatter `<context>` `@.planning/...` reference rewritten/intercepted/exception-listed; uniform strategy | VERIFIED | DECISIONS.md line 617: D-2026-05-10-OQ04 — uniform orchestrator-injection strategy. Templates/references adopt `<project_context>` blocks (26 files use this pattern). Remaining `@.planning/` in phase-prompt.md (2) and planner-antipatterns.md (3) are backtick-wrapped ILLUSTRATIVE examples explicitly listed as "25 EXCEPTION" entries in the decision. Leak-grep passes these files (exit 0). |
| 4   | OQ-03 resolved: `spec-phase.md` Step 7 and `eval-review.md` end use `gsd-sdk query commit` instead of raw `git add`/`git commit` | VERIFIED | `grep "git add\|git commit" spec-phase.md eval-review.md` → 0 matches (no raw-git remains). `grep "gsd-sdk query commit" spec-phase.md eval-review.md` → spec-phase.md:220 and eval-review.md:141 both use `gsd-sdk query commit`. DECISIONS.md D-2026-05-10-OQ03 records resolution. |
| 5   | `verify.fat-skills` SDK query lists every non-router skill with line-count + leak-count and is wired into CI | VERIFIED | File `sdk/src/query/verify-fat-skills.ts` exists (122 lines), exports `verifyFatSkills`. Registered in `sdk/src/query/index.ts:401`. Behavioral: `gsd-sdk query verify.fat-skills` returns valid JSON with `total_skills: 87`, `non_router_skills: 87`, `over_threshold: 19`, skill list with `name/path/lines/leaks/warning`. Wired in pre-commit hook lines 34-42 (non-blocking warning mode per D-08). |

**Score:** 5/5 Success Criteria fully verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `scripts/leak-grep.cjs` | Extended with 5 new shell patterns + zone filter + allow/ignore directives | VERIFIED | Extended: contains `mkdir-shell`, `cat-shell`, `find-shell` (zone-gated), `ls-shell` (zone-gated), `git-add-shell`. `WORKFLOW_ZONE_RE` at line 62. `FILE_ALLOW_RE` at line 110. `LINE_IGNORE_RE` at line 117. |
| `scripts/pre-commit-leak-gate.sh` | Pre-commit hook that runs leak-grep + verify.fat-skills warning | VERIFIED | 45 lines; zero-tolerance leak gate; runs leak-grep on staged .md/.ts/.js/.cjs/.mjs; excludes `adapters/markdown/`; exits 1 on leak with "COMMIT BLOCKED" message; verify.fat-skills is non-blocking warning (D-08). |
| `scripts/install-hooks.sh` | Installer symlinking hook to .git/hooks/pre-commit | VERIFIED | Exists, executable. Hook symlink VERIFIED: `.git/hooks/pre-commit → /Volumes/code/get-shit-done/scripts/pre-commit-leak-gate.sh`. |
| `sdk/src/query/codebase-docs.ts` | codebase.put/get/list handlers via adapter | VERIFIED | 107 lines, exports codebasePut/Get/List, uses `adapterFor`, zero node:fs imports. |
| `sdk/src/query/named-docs.ts` | report.put/get, handoff/continue-here/forensics/decisions-index | VERIFIED | 192 lines, all exports present, uses adapter, zero node:fs. |
| `sdk/src/query/debug-session.ts` | debug.archive handler | VERIFIED | Exists, uses adapter. |
| `sdk/src/query/spike-sketch.ts` | spike/sketch manifest/conventions/wrap-up handlers | VERIFIED | 179 lines, exports all 7 handlers, uses adapter. |
| `sdk/src/query/thread-seed.ts` | thread.add/seed.add/todo.add | VERIFIED | Exists, exports all 3 handlers, uses adapter. |
| `sdk/src/query/milestone-ops.ts` | milestone.archive-phases/phase.get-manifest/graphify.store | VERIFIED | Exists, uses adapter. |
| `sdk/src/query/tmp-docs.ts` | tmp.put/tmp.get | VERIFIED | 91 lines, uses adapter. |
| `sdk/src/query/verify-fat-skills.ts` | verify.fat-skills query handler | VERIFIED | 122 lines, exports verifyFatSkills, invokes leak-grep via execSync with 5s timeout, returns structured JSON. |
| `.planning/DECISIONS.md` | OQ-03 + OQ-04 resolution records | VERIFIED | Contains D-2026-05-10-OQ03 (line 588) and D-2026-05-10-OQ04 (line 617). |
| `package.json` prepare script | Auto-install hooks on npm install | VERIFIED | Line 72: `"prepare": "./scripts/install-hooks.sh"`. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `scripts/pre-commit-leak-gate.sh` | `scripts/leak-grep.cjs` | `node scripts/leak-grep.cjs <staged>` | WIRED | Line 15 of hook: `xargs node scripts/leak-grep.cjs`. |
| `scripts/pre-commit-leak-gate.sh` | `verify.fat-skills` | `gsd-sdk query verify.fat-skills` | WIRED | Line 35 of hook: `FAT_OUTPUT=$(gsd-sdk query verify.fat-skills ...)` inside `command -v gsd-sdk` guard. |
| `sdk/src/query/index.ts` | `verify-fat-skills.ts` | `registry.register('verify.fat-skills', verifyFatSkills)` | WIRED | Line 103 imports, line 401 registers. |
| `sdk/src/query/index.ts` | 7 new handler files | `registry.register('codebase.put/get/list', 'debug.archive', 'spike.*', 'thread.add', 'milestone.archive-phases', 'tmp.put/get', ...)` | WIRED | All 25 new verbs registered in lines 730-760. |
| Workflow files | SDK query layer | `gsd-sdk query ...` CLI invocations in workflow prose | WIRED | `grep -rn "gsd-sdk query" get-shit-done/workflows/ | wc -l` shows hundreds of call sites in rewritten workflows. Spec-phase + eval-review confirmed using `gsd-sdk query commit`. |
| `agents/gsd-debugger.md` | SDK commands | `gsd-sdk query debug.archive` etc. | WIRED | Leak-grep clean; prior Read/Write refs replaced. |

### Data-Flow Trace (Level 4)

`verify.fat-skills` is a runnable command producing dynamic data. Traced:

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| verify.fat-skills handler | `skills[]` | `readdirSync(gsdDir/{workflows,commands,agents})` + execSync(leak-grep) per skill | Yes (87 skills, real line counts, real leak counts) | FLOWING |
| Pre-commit hook | `LEAK_OUTPUT` | `node scripts/leak-grep.cjs` on staged files | Yes — test invocation shows it produces `file:line:category:match` output on leaks | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Top-10 workflows pass leak-grep | `node scripts/leak-grep.cjs get-shit-done/workflows/{plan-phase,execute-phase,spike,forensics,progress,verify-phase,sketch,discuss-phase,execute-plan}.md` | `0 match(es) across 9 file(s)`, exit 0 | PASS |
| gsd-debugger agent clean | `node scripts/leak-grep.cjs agents/gsd-debugger.md` | `0 match(es)`, exit 0 | PASS |
| Pre-commit gate detects test leak | `echo 'Read ".planning/STATE.md"' > /tmp/test-leak.md && node scripts/leak-grep.cjs /tmp/test-leak.md` | exit 1 with category `Read-tool` | PASS |
| verify.fat-skills returns real data | `gsd-sdk query verify.fat-skills` | JSON with `total_skills: 87`, 87 non-router skills, 19 over-threshold, real skill metadata | PASS |
| SDK production files clean | `find sdk/src -name "*.ts" ! -name "*.test.ts" \| xargs node scripts/leak-grep.cjs` | `0 match(es) across 163 file(s)` | PASS |
| SDK test files clean | `find sdk/src -name "*.test.ts" \| xargs node scripts/leak-grep.cjs` | `0 match(es) across 129 file(s)` | PASS |
| All templates clean | `find get-shit-done/templates -name "*.md" \| xargs node scripts/leak-grep.cjs` | `0 match(es) across 45 file(s)` | PASS |
| All references clean | `find get-shit-done/references -name "*.md" \| xargs node scripts/leak-grep.cjs` | `0 match(es) across 54 file(s)` | PASS |
| All agents clean | `find agents -name "*.md" \| xargs node scripts/leak-grep.cjs` | `0 match(es) across 33 file(s)` | PASS |
| All commands clean | `find commands/gsd -name "*.md" \| xargs node scripts/leak-grep.cjs` | `0 match(es) across 65 file(s)` | PASS |
| **All workflows (recursive)** | `find get-shit-done/workflows -name "*.md" \| xargs node scripts/leak-grep.cjs` | **`1 match(es) across 101 file(s)`** — post-merge-gate.md:32 find-shell | **FAIL (minor, retroactive)** |
| Raw-git verified absent | `grep "git add\|git commit" get-shit-done/workflows/spec-phase.md get-shit-done/workflows/eval-review.md` | 0 matches | PASS |
| gsd-sdk query commit used | `grep "gsd-sdk query commit" get-shit-done/workflows/spec-phase.md get-shit-done/workflows/eval-review.md` | spec-phase.md:220 + eval-review.md:141 | PASS |

### Requirements Coverage

All 5 Phase 4 requirement IDs accounted for (match REQUIREMENTS.md §LEAKS):

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| LEAKS-01 | 04-02, 04-03, 04-04 | Top-10 leaking workflows refactored to use only adapter calls (no Read/Write/Edit/cp/mv against `.planning/`) | SATISFIED | Top-10 workflows all leak-free (SC#1 verified). Plan 02 eliminated 110 SDK production leaks. Plans 03-04 rewrote 39+98 workflow/agent/command leaks. REQUIREMENTS.md marks LEAKS-01 Complete. |
| LEAKS-02 | 04-05 | `<context>`-block leak class mitigated via orchestrator-injection | SATISFIED | 26 files now use `<project_context>` blocks. DECISIONS.md D-2026-05-10-OQ04 records uniform strategy. Only remaining `@.planning/` refs are backtick-wrapped illustrative examples (explicitly classified as EXCEPTION entries). |
| LEAKS-03 | 04-04 | Raw-git outliers refactored (spec-phase.md, eval-review.md) | SATISFIED | Both files use `gsd-sdk query commit`; zero raw `git add`/`git commit` matches. DECISIONS.md D-2026-05-10-OQ03 records resolution. |
| LEAKS-04 | 04-01, 04-07 | CI gate enforces leak-grep; extended per R5 | SATISFIED | leak-grep.cjs extended with 5 new shell patterns. Pre-commit hook installed and blocks leaks (verified behaviorally). |
| LEAKS-05 | 04-06, 04-07 | verify.fat-skills SDK query shipped, wired into CI | SATISFIED | Handler exists (122 lines), registered in index.ts:401, returns valid JSON output, wired into pre-commit hook as non-blocking warning. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `get-shit-done/workflows/execute-phase/steps/post-merge-gate.md` | 32 | find-shell match on `-not -path './.planning/*'` exclusion filter | Warning (false positive) | Leak-grep flags a path EXCLUSION as if it were a leak. File does not actually read/write `.planning/` — the pattern is there specifically to AVOID `.planning/`. Should have been marked with `<!-- leak-grep-ignore -->` during Plan 07. File was added 2026-04-26, before Phase 4 began, and Plan 07's non-recursive glob missed `execute-phase/steps/` subdirectory. |

### Human Verification Required

None required. All Success Criteria are programmatically verifiable and have been verified.

### Gaps Summary (retroactively discovered)

The Phase 4 goal is **substantively achieved**: the 5 ROADMAP Success Criteria all pass against the current codebase, requirements LEAKS-01..05 are satisfied, the CI gate works as designed, and OQ-03/OQ-04 are resolved with ADRs recorded in DECISIONS.md.

One minor retroactive gap was discovered during this verification:

**Plan 07's "full codebase zero-leak state" claim is not strictly true** — one file in a workflow subdirectory (`get-shit-done/workflows/execute-phase/steps/post-merge-gate.md`) contains a false-positive find-shell match at line 32. Plan 07's final verification glob (`get-shit-done/workflows/*.md`) did not recurse into subdirectories, so this file was never scanned during Plan 07's zero-state verification.

Nature of the match:
- The line is: `BUILD_CMD="python -m py_compile $(find . -name '*.py' -not -path './.planning/*' -not -path './node_modules/*' | head -20 | tr '\n' ' ')"`
- The `.planning/` reference here is an EXCLUSION in a build-command auto-detect — the code explicitly avoids `.planning/`
- This is semantically the opposite of a leak, but leak-grep's `find-shell` pattern triggers on the string match

Remediation (trivial, advisory — Phase 4 already shipped):
1. Add `<!-- leak-grep-ignore -->` inline on line 32 (or the preceding line), OR
2. Extend leak-grep to tokenize and skip patterns where `.planning/` appears inside a `-not -path` / `-o -path` / `--exclude` clause, OR
3. The pre-commit hook only runs on STAGED files — since post-merge-gate.md is not being modified, it does not currently block any commits. The gap is narrative (the "zero-leak" claim) not operational.

**Impact on Phase 4 completion:** None. The phase is marked complete in ROADMAP.md (2026-05-10) and the next phase (Phase 5) has already shipped (2026-05-11). The gap is documentation-level, not a blocker for downstream work.

---

_Verified: 2026-05-11_
_Verifier: Claude (gsd-verifier), retroactive verification mode_
