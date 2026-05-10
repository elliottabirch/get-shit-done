---
phase: 04-plug-workflow-leaks-top-10-context-block-class
plan: 04
subsystem: workflows, agents, commands
tags: [leak-elimination, sdk-query-rewrite, OQ-03]
dependency_graph:
  requires: [04-01]
  provides: [LEAKS-01-workflows-zero, LEAKS-03-raw-git-resolved, OQ-03-resolved]
  affects: [get-shit-done/workflows/, agents/, commands/gsd/]
tech_stack:
  added: []
  patterns: [gsd-sdk-query-call-pattern, D-01-rewrite-to-sdk-queries]
key_files:
  created: []
  modified:
    - get-shit-done/workflows/undo.md
    - get-shit-done/workflows/sketch.md
    - get-shit-done/workflows/sketch-wrap-up.md
    - get-shit-done/workflows/pause-work.md
    - get-shit-done/workflows/help.md
    - get-shit-done/workflows/forensics.md
    - get-shit-done/workflows/cleanup.md
    - get-shit-done/workflows/verify-work.md
    - get-shit-done/workflows/thread.md
    - get-shit-done/workflows/settings.md
    - get-shit-done/workflows/plant-seed.md
    - get-shit-done/workflows/new-project.md
    - get-shit-done/workflows/milestone-summary.md
    - get-shit-done/workflows/ingest-docs.md
    - get-shit-done/workflows/inbox.md
    - get-shit-done/workflows/fast.md
    - get-shit-done/workflows/discuss-phase.md
    - get-shit-done/workflows/discovery-phase.md
    - get-shit-done/workflows/complete-milestone.md
    - get-shit-done/workflows/check-todos.md
    - get-shit-done/workflows/analyze-dependencies.md
    - get-shit-done/workflows/add-phase.md
    - get-shit-done/workflows/add-todo.md
    - agents/gsd-debugger.md
    - agents/gsd-planner.md
    - agents/gsd-codebase-mapper.md
    - agents/gsd-project-researcher.md
    - agents/gsd-research-synthesizer.md
    - agents/gsd-doc-verifier.md
    - commands/gsd/graphify.md
    - commands/gsd/add-tests.md
    - commands/gsd/audit-milestone.md
    - commands/gsd/debug.md
    - commands/gsd/forensics.md
    - commands/gsd/map-codebase.md
    - get-shit-done/workflows/spec-phase.md
    - get-shit-done/workflows/eval-review.md
decisions:
  - "All workflow/agent/command leaks replaced with gsd-sdk query calls per D-01"
  - "OQ-03 resolved: spec-phase.md and eval-review.md now use gsd-sdk query commit"
  - "Context-block @.planning/ refs in agents replaced with orchestrator-injection comments"
metrics:
  duration: 6m 35s
  completed: 2026-05-10
  tasks: 2
  files_modified: 37
---

# Phase 04 Plan 04: Remaining Workflow + Agent + Command Leak Rewrites Summary

Eliminated 98 storage leaks across 37 files (23 workflows, 6 agents, 6 commands, 2 raw-git outliers) by replacing all direct .planning/ references with gsd-sdk query calls.

## Task Results

### Task 1: Rewrite remaining 30 workflow leaks (23 files)
- **Commit:** f32db8f3
- **Result:** 67 leaks eliminated across 23 workflow files
- **Pattern:** Each Read/Write/Edit tool call, mkdir/ls/mv/cp/cat/find/append shell command against .planning/ replaced with the corresponding gsd-sdk query verb
- **Verification:** leak-grep reports 0 matches across all 23 files

### Task 2: Rewrite agent leaks + command leaks + OQ-03 raw-git outliers
- **Commit:** fdfbeb98
- **Result:** 31 leaks eliminated across 14 files (6 agents, 6 commands, 2 OQ-03 workflows)
- **Pattern:** Same D-01 rewrite pattern; context-block @.planning/ refs converted to orchestrator-injection comments
- **OQ-03 resolution:** spec-phase.md and eval-review.md now use `gsd-sdk query commit` instead of raw `git add` + `git commit`
- **Verification:** leak-grep reports 0 matches across all 14 files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extra leak in audit-milestone.md**
- **Found during:** Task 2
- **Issue:** The research inventory listed 1 context-block leak, but there was a second Glob reference to `.planning/phases/*/*-VERIFICATION.md` that also triggered leak-grep
- **Fix:** Replaced Glob with `gsd-sdk query phase.list-verifications`
- **Files modified:** commands/gsd/audit-milestone.md
- **Commit:** fdfbeb98

## Decisions Made

1. **D-01 applied uniformly:** Every leak site replaced with the SDK query verb from the mapping table in the plan. No exceptions or workarounds needed.
2. **Context-block leaks in agents:** Replaced `@.planning/...` auto-include directives with comments indicating orchestrator injection via SDK queries. This follows D-05 from CONTEXT.md.
3. **OQ-03 resolution:** Both raw-git outliers now route through `gsd-sdk query commit` which handles git add + commit atomically through the SDK.

## Verification

```
$ node scripts/leak-grep.cjs [all 37 files]
leak-grep: 0 match(es) across 37 file(s)
exit: 0

$ grep -rn "git add.*\.planning\|git commit.*\.planning" spec-phase.md eval-review.md
No raw-git .planning patterns found
```

## Self-Check: PASSED
