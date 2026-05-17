---
phase: 04-plug-workflow-leaks-top-10-context-block-class
plan: 03
subsystem: workflows
tags: [leak-plugging, sdk-queries, workflow-rewrite]
dependency_graph:
  requires: [04-01]
  provides: [zero-leak-workflows-wave2]
  affects: [get-shit-done/workflows/]
tech_stack:
  added: []
  patterns: [gsd-sdk-query-calls, adapter-mediated-storage]
key_files:
  created: []
  modified:
    - get-shit-done/workflows/map-codebase.md
    - get-shit-done/workflows/execute-phase.md
    - get-shit-done/workflows/quick.md
    - get-shit-done/workflows/docs-update.md
    - get-shit-done/workflows/import.md
    - get-shit-done/workflows/spike.md
    - get-shit-done/workflows/spike-wrap-up.md
    - get-shit-done/workflows/session-report.md
    - get-shit-done/workflows/graduation.md
decisions: []
metrics:
  duration_seconds: 317
  completed: "2026-05-10T16:60:31Z"
  tasks_completed: 3
  tasks_total: 3
---

# Phase 4 Plan 3: Rewrite 9 Heaviest-Leaking Workflow Files Summary

Eliminated all direct .planning/ references from 9 workflow files (39 leaks total) by replacing Read/Write/Edit tool calls, shell cp/mv/mkdir/ls/find commands, and git-add operations with gsd-sdk query calls that route through the adapter layer.

## One-liner

39 workflow leaks eliminated across 9 files using gsd-sdk query calls for codebase, state, roadmap, spike, report, tmp, debug, and phase operations.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite map-codebase.md, execute-phase.md, quick.md (19 leaks) | f9f7c817 | map-codebase.md, execute-phase.md, quick.md |
| 2 | Rewrite docs-update.md, import.md, spike.md, spike-wrap-up.md (14 leaks) | 4436bbe3 | docs-update.md, import.md, spike.md, spike-wrap-up.md |
| 3 | Rewrite session-report.md, graduation.md (6 leaks) | 348702b0 | session-report.md, graduation.md |

## Approach

Each leak was replaced with the semantically equivalent SDK query:

- **Write tool to .planning/codebase/** -> `gsd-sdk query codebase.put`
- **Read .planning/STATE.md** -> `gsd-sdk query state.load`
- **Read .planning/ROADMAP.md** -> `gsd-sdk query roadmap`
- **cp/restore of STATE/ROADMAP** -> `gsd-sdk query state.restore-snapshot` / `roadmap.restore-snapshot`
- **mkdir + mv debug sessions** -> `gsd-sdk query debug.archive`
- **find .planning/phases/** -> `gsd-sdk query phase.list-verifications` / `phase.list-learnings`
- **Read/Write .planning/tmp/** -> `gsd-sdk query tmp.get` / `tmp.put`
- **Read/Write .planning/spikes/** -> `gsd-sdk query spike.get-manifest` / `spike.get-conventions` / `spike.put-wrap-up` / `spike.put-conventions`
- **ls/mkdir .planning/reports/** -> `gsd-sdk query report.list` / `report.put`
- **Write STATE graduation_backlog** -> `gsd-sdk query state.add-graduation-backlog`
- **Read .planning/PROJECT.md** -> `gsd-sdk query project.get`
- **Read .planning/REQUIREMENTS.md** -> `gsd-sdk query requirements.get`
- **git add .planning/** -> `gsd-sdk query commit --stage-only`
- **git ls-files .planning/** -> `gsd-sdk query state.list-files`

## Verification

```
leak-grep: 0 match(es) across 9 file(s)
exit: 0
```

All 9 files pass leak-grep with zero matches. Workflow instructions remain semantically equivalent — same data accessed, same operations performed, routed through the SDK adapter layer.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] f9f7c817 exists in git log
- [x] 4436bbe3 exists in git log
- [x] 348702b0 exists in git log
- [x] All 9 modified workflow files exist and pass leak-grep
