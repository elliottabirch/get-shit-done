---
phase: 05-foundational-primitive-lift
plan: 06
subsystem: sdk-handler-primitive-migration
tags: [putNamedDoc, getNamedDoc, D-12-primitive-first, D-21-sidecar-path, D-15-grep-zero]
dependency_graph:
  requires: [05-04, 05-05]
  provides: [primitive-backed-handler-contract, D-21-resolved]
  affects: [named-docs-handlers, codebase-docs-handlers, route-next-action-call-count]
tech_stack:
  added: []
  patterns: [display-path-mirror-helper, D-12-handler-exception-comment]
key_files:
  created: []
  modified:
    - sdk/src/query/named-docs.ts
    - sdk/src/query/codebase-docs.ts
    - sdk/src/query/tmp-docs.ts
    - sdk/src/query/route-next-action.ts
decisions:
  - "Named-doc handlers delegate path computation to adapter.putNamedDoc / getNamedDoc (D-12 primitive-first framing)"
  - "tmp-docs.ts intentionally NOT migrated — tmp keys embed subdir + extension which the adapter's unconditional .md-append formula doesn't support (D-12 exception documented inline)"
  - "codebaseList stays on adapter.listCollection — no list primitive in Phase 5 scope (deferred per CONTEXT §D-12)"
  - "DECISIONS.md fallback in decisionsIndexGet stays on adapter.getRecord — DECISIONS is not in the RootNamedDocKey closed union, fallback is workflow-layer concern"
  - "route-next-action.ts readConsecutiveCallCount delegated to nextCallCountGet from sidecar.ts (D-21 centralization)"
  - "Display-path helpers (namedDocDisplayPath, codebaseDisplayPath) mirror the adapter's path formula inline in each handler file to preserve the legacy `written: string` return field"
status: complete
---

## Objective Achieved

Plan 05-06 migrates the SDK's named-document handlers from raw
`adapter.putRecord` / `adapter.getRecord` calls with manual path composition
to `adapter.putNamedDoc(category, key, body, opts)` /
`adapter.getNamedDoc(category, key, opts)` — per D-12 primitive-first framing.
External SDK verb names (`report.put`, `handoff.put`, `codebase.put`, etc.)
and return shapes (`{ written, name, found, content, source }`) are preserved
unchanged so workflow callers see zero behavior difference.

### Session context

This plan's original execution in the initial session (commit `88d43deb`, Wave 6
worktree merge `c02f37ae`) was reverted during Plan 05-07 verification because
the executor agent's commit bundled the legitimate migration with file-corrupting
edits that left `sdk/src/query/route-next-action.ts` unparseable (dangling
JSDoc, missing closing braces, missing import lines — see `git show 88d43deb`).
The revert happened in commit `3ba75421`.

The re-do landed this session across four atomic commits, each gated by a
full build + full SDK suite pass:

1. `49a5f6cb` — D-21 migration for route-next-action.ts (one line diff applied cleanly)
2. `11dc85a3` — named-docs.ts (5 handlers + display-path helper)
3. `6070d319` — codebase-docs.ts (2 handlers + display-path helper)
4. `b22606a9` — tmp-docs.ts D-12 exception comment

## Tasks Completed

### Task 1: Migrate named-docs + codebase-docs + document tmp-docs exception

Migration matrix:

| File | Handler | Old call | New call |
|------|---------|----------|----------|
| named-docs.ts | `reportPut` | `adapter.putRecord(planningRelativePath(ws, 'reports/{name}.md'), body)` | `adapter.putNamedDoc('reports', name, body, { workstream })` |
| named-docs.ts | `reportGet` | `adapter.getRecord(planningRelativePath(...))` | `adapter.getNamedDoc('reports', name, { workstream })` |
| named-docs.ts | `handoffPut` | `adapter.putRecord(planningRelativePath(ws, 'HANDOFF.md'), body)` | `adapter.putNamedDoc('root', 'HANDOFF', body, { workstream })` |
| named-docs.ts | `continueHerePut` | `adapter.putRecord(planningRelativePath(ws, 'CONTINUE-HERE.md'), body)` | `adapter.putNamedDoc('root', 'CONTINUE-HERE', body, { workstream })` |
| named-docs.ts | `forensicsPut` | `adapter.putRecord(planningRelativePath(ws, 'reports/FORENSICS-${ts}.md'), body)` | `adapter.putNamedDoc('reports', 'FORENSICS-${ts}', body, { workstream })` |
| named-docs.ts | `decisionsIndexGet` | `adapter.getRecord(planningRelativePath(ws, 'DECISIONS-INDEX.md'))` (primary) | `adapter.getNamedDoc('root', 'DECISIONS-INDEX', { workstream })` |
| codebase-docs.ts | `codebasePut` | `adapter.putRecord(planningRelativePath(ws, 'codebase/{name}.md'), body)` | `adapter.putNamedDoc('codebase', name, body, { workstream })` |
| codebase-docs.ts | `codebaseGet` | `adapter.getRecord(planningRelativePath(...))` | `adapter.getNamedDoc('codebase', name, { workstream })` |

Intentionally NOT migrated (documented exceptions):

| File | Handler | Reason |
|------|---------|--------|
| codebase-docs.ts | `codebaseList` | No list primitive in Phase 5 scope — stays on `adapter.listCollection` |
| named-docs.ts | `decisionsIndexGet` fallback | `DECISIONS` not in `RootNamedDocKey` closed union; fallback to `adapter.getRecord` is a workflow-layer concern per D-12 |
| tmp-docs.ts | `tmpPut` + `tmpGet` | tmp keys embed subdir + extension (`subdir/file.json`); putNamedDoc unconditionally appends `.md` and would break callers |

### Task 2: D-21 migration for route-next-action.ts

Applied in commit `49a5f6cb`. `readConsecutiveCallCount` is now a one-line
delegate to `nextCallCountGet(adapter, workstream)` from `sidecar.ts`. No
raw `adapter.getRecord('.next-call-count')` calls remain in `sdk/src/`.

## Verification Results

All 16 Plan 05-06 acceptance grep gates pass:

| Gate | Expected | Actual |
|------|----------|--------|
| `grep -c 'adapter.putNamedDoc(' sdk/src/query/named-docs.ts` | ≥4 | 4 |
| `grep -c 'adapter.getNamedDoc(' sdk/src/query/named-docs.ts` | ≥2 | 2 |
| `grep -cF "adapter.putNamedDoc('reports'" sdk/src/query/named-docs.ts` | ≥2 | 2 |
| `grep -cF "adapter.putNamedDoc('root', 'HANDOFF'" sdk/src/query/named-docs.ts` | 1 | 1 |
| `grep -cF "adapter.putNamedDoc('root', 'CONTINUE-HERE'" sdk/src/query/named-docs.ts` | 1 | 1 |
| `grep -c 'adapter.putNamedDoc(' sdk/src/query/codebase-docs.ts` | 1 | 1 |
| `grep -c 'adapter.getNamedDoc(' sdk/src/query/codebase-docs.ts` | 1 | 1 |
| `grep -c 'adapter.listCollection(' sdk/src/query/codebase-docs.ts` | 1 | 1 |
| `grep -c 'namedDocDisplayPath' sdk/src/query/named-docs.ts` | ≥2 | 5 |
| `grep -c 'codebaseDisplayPath' sdk/src/query/codebase-docs.ts` | ≥2 | 2 |
| `grep -c 'adapter.putRecord(docPath' sdk/src/query/named-docs.ts` | 0 | 0 |
| `grep -c 'adapter.putRecord(docPath' sdk/src/query/codebase-docs.ts` | 0 | 0 |
| `grep -cF 'Phase 5 D-12 exception' sdk/src/query/tmp-docs.ts` | 1 | 1 |
| `grep -c 'adapter.putRecord(docPath' sdk/src/query/tmp-docs.ts` | 1 (unchanged) | 1 |
| D-21 raw `.next-call-count` sites outside sidecar.ts | 0 | 0 |
| D-15 legacy kind-tagged name sites (getResearch / putIntelDoc / putCodebaseDoc / getArchivedMilestoneDoc) | 0 | 0 |

Test suites:

- **SDK unit**: 1567 passed / 0 failed / 0 skipped (same count as pre-migration)
- **Conformance**: 113 passed / 0 failed / 4 skipped / 1 todo (4 skips are the documented drift baselines)
- **TypeScript build**: 0 errors

External contract preserved — no SDK test needed adjustment; all pre-migration
tests pass unchanged.

## Deviations from Plan

**None for scope**. The original plan was re-executed exactly as written, just
spread across four atomic commits instead of one bundled commit (explicit
response to the Wave-6 file-corruption incident that caused the revert).

**One observation worth capturing**: the plan's `<interfaces>` section mentions
a helper called `displayPath` that "lives inline in each handler file (or in
helpers.ts — planner's discretion; prefer inline to keep helpers.ts unchanged)".
Followed the inline-per-file preference. Two helpers (`namedDocDisplayPath`,
`codebaseDisplayPath`) rather than a shared one, because each handler file
typically references only one category and the helpers would pollute
`helpers.ts` with an `adapters/types.ts` import dependency otherwise. If a
future plan migrates additional categories (e.g., `sketches`, `tmp-with-
extension-support`), consolidating to a single `helpers.ts` helper would be a
reasonable step then.

## Technical Notes

**Display-path helper rationale.** `adapter.putNamedDoc` has a void return
type — it doesn't hand the resolved path back to the caller. But the handler
return contract has always included `written: string` (the display-relative
planning-root path). To preserve that contract, each migrated handler now
computes the path locally via a helper that mirrors the adapter's formula:

```ts
function namedDocDisplayPath(workstream, category, key) {
  const base = category === 'root' ? `${key}.md` : `${category}/${key}.md`;
  return planningRelativePath(workstream ?? null, base);
}
```

This is a known duplication of adapter-internal knowledge. If the adapter's
path formula ever changes (e.g., category subfolders, date-prefixed keys),
these helpers have to change in lockstep — a future plan could expose a
`resolveNamedDocPath()` method on StorageAdapter to eliminate the drift risk.

**tmp exception scope.** The comment at the top of `tmp-docs.ts` marks this
as a "Phase-5-scoped exception" — if a future plan adds `preserveKeyAsPath` or
similar to `putNamedDoc`, tmp can be migrated then. Listed as a follow-up in
the OQ tracking.

## Next Plan Dependencies

Plan 05-07 (exit checkpoint + ADRs) depends on this plan's deliverables being
in place, specifically:

- D-12 primitive-first framing proven end-to-end through real call-sites
- D-21 resolved (no raw `.next-call-count` paths)
- D-15 grep-zero maintained (no legacy kind-tagged names reappear)
- External SDK verb contract unchanged (required for the exit verification
  matrix's "all existing tests pass" gate)

All three hold as of this plan's completion.
