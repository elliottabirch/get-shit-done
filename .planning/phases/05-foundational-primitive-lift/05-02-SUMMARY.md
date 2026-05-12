---
phase: 05-foundational-primitive-lift
plan: 02
subsystem: adapters/markdown
tags: [primitives, section-walker, depth-aware]
dependency_graph:
  requires: [05-01]
  provides: [heading-depth-walker, L2-L3-L4-support, fence-comment-skip, setext-warning]
  affects: [adapters/markdown/index.ts, tests/conformance/section-depth.test.ts]
tech_stack:
  added: []
  patterns: [heading-depth walker, ATX-only validation, fence/comment state machine, document-order first-match]
key_files:
  created: []
  modified:
    - adapters/markdown/index.ts: "Added parseAnchor helper + replaced extractSection/replaceSection with depth-aware walker (~99 LOC added, ~34 LOC removed)"
    - tests/conformance/section-depth.test.ts: "Flipped 8 it.todo to live tests covering L2/L3/L4 + fence + comment + setext + first-match"
    - adapters/package.json: "Added @types/node devDependency"
    - package.json: "Added vitest devDependency for conformance test runner"
decisions:
  - "Anchor parameter now accepts FULL ATX heading marker ('## Foo', not 'Foo') — D-06 contract"
  - "Setext headings emit console.warn but do NOT throw — graceful degradation per D-08"
  - "Three-author concurrency test remains it.todo until Plan 03 withTransaction wrap lands"
metrics:
  duration_minutes: 6
  completed_date: "2026-05-10"
  tasks_completed: 2
  tests_added: 8
  tests_passing: 8
  tests_todo: 1
---

# Phase 05 Plan 02: Heading-Depth Walker Summary

**One-liner:** Replace L2-only section helpers with depth-aware walker supporting L2/L3/L4 ATX anchors, fence/comment skip, and setext warnings.

## Execution Summary

Replaced the Phase-1 L2-only `extractSection`/`replaceSection` helpers (lines 785-857 of `adapters/markdown/index.ts`) with a depth-aware walker that:
- Parses full ATX heading markers ("## Foo", "### Evidence", "#### Sub-point") via new `parseAnchor` helper
- Terminates sections at the next same-or-shallower heading depth (D-06)
- Skips headings inside fenced code blocks (``` or ~~~) and HTML comments (D-08)
- Emits `console.warn` for setext-style headings (Foo\n===) without throwing (D-08)
- Resolves duplicate anchor names to document-order first-match (D-07)

Class methods `getSection` and `updateSection` (lines 193-241) remain structurally unchanged — they delegate to the rewritten helpers. The only semantic change is that `anchor` is now a full heading marker ("## Foo") instead of bare text.

Flipped 8 `it.todo` cases in `tests/conformance/section-depth.test.ts` to live `it(...)` tests covering all D-06/D-07/D-08 contract points. The three-author concurrency test remains `it.todo` (Plan 03 dependency — requires withTransaction-wrapped updateSection per D-09).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @types/node and vitest devDependencies**
- **Found during:** Task 2 (test execution)
- **Issue:** TypeScript compilation and vitest test runner missing dependencies in worktree
- **Fix:** Added @types/node to adapters/package.json, added vitest to root package.json
- **Files modified:** adapters/package.json, adapters/package-lock.json, package.json, package-lock.json
- **Commit:** 98a324c4 (included in Task 2 commit)

## Tasks Completed

| Task | Name | Commit | Files | Outcome |
|------|------|--------|-------|---------|
| 1 | Implement heading-depth walker in adapters/markdown/index.ts | 02d80e80 | adapters/markdown/index.ts | Added parseAnchor/extractSection/replaceSection with depth-aware logic; removed nextH2Re constant; updated updateSection to use full anchor marker |
| 2 | Flip section-depth test.todo cases to live tests | 98a324c4 | tests/conformance/section-depth.test.ts, adapters/package.json, package.json | 8 live tests pass (L2/L3/L4 + fence + comment + setext + first-match); 1 todo remains (three-author concurrency) |

## Code Changes

### adapters/markdown/index.ts

**Net LOC:** +99 added, -34 removed (net +65)

**Key additions:**
- `parseAnchor(anchor: string): ParsedAnchor` — validates ATX heading markers, throws on non-ATX input
- `extractSection` — depth-aware walker with fence/comment/setext handling (56 lines)
- `replaceSection` — depth-aware replacement walker (57 lines)
- Removed `nextH2Re` constant (L2-only)
- Updated `updateSection` line 213: changed `## ${anchor}` to `${anchor}` (anchor is now full marker)

**Walker invariants:**
- `inFence` toggle on `/^[ ]{0,3}(` `{3,}|~{3,})/` (CommonMark-compliant)
- `inComment` range tracking on `<!--` / `-->`
- Setext detection: `/^(=+|-+)[ \t]*$/` on line following non-blank text → console.warn, no throw
- Heading regex: `/^(#{1,6})[ \t]+/` — depth extracted from match group
- Terminator condition: `hm[1].length <= depth` (same-or-shallower stops extraction)

### tests/conformance/section-depth.test.ts

**Tests added:** 8 live `it(...)` cases

1. **L2 anchor "## Foo"** — extracts/replaces body, leaves sibling untouched
2. **L3 anchor "### Evidence"** — extracts subsection only (first-match)
3. **L4 anchor "#### Sub-point"** — terminates at next L4/L3/L2
4. **getSection null** — returns null when anchor missing
5. **Document-order first-match** — two "### Evidence" under different parents → first wins (D-07)
6. **Fenced code block** — `## Not a heading` inside ``` fence does NOT split (D-08)
7. **HTML comment** — `<!-- ## Not a heading -->` does NOT split (D-08)
8. **Setext warning** — `Foo\n===` emits console.warn, no throw (D-08)

**Remaining todo:** three-author concurrency (SC#2, PRIMITIVES-06) — requires Plan 03 D-09 internal withTransaction wrap.

## Verification Results

### TypeScript Compilation
```
cd adapters && tsc --noEmit -p tsconfig.json
# Exit 0 — no errors
```

### Conformance Tests
```
npx vitest run --config vitest.conformance.config.ts tests/conformance/section-depth.test.ts
# 8 passed | 1 todo (9)
```

### Grep Checks (Task 1 acceptance criteria)
- `parseAnchor` function count: 1 ✓
- `extractSection` function count: 1 ✓
- `replaceSection` function count: 1 ✓
- Depth-parametric regex `#{${depth}}`: 2 ✓
- Setext warning string: 1 ✓
- `nextH2Re` removed: 0 ✓
- `getSection` class method preserved: 1 ✓
- `updateSection` class method preserved: 1 ✓

## Known Stubs

None — all section read/write operations are fully wired through the depth-aware walker.

## Threat Flags

No new security-relevant surface introduced. The walker operates on author-controlled planning documents under `.planning/` — no adversarial input model. Fenced code block and HTML comment handling per STRIDE mitigations T-05-02-01 and T-05-02-02 (threat model in PLAN.md).

## Self-Check

**Files created/modified:**
- ✓ adapters/markdown/index.ts exists (modified)
- ✓ tests/conformance/section-depth.test.ts exists (modified)
- ✓ adapters/package.json exists (modified)
- ✓ package.json exists (modified)

**Commits exist:**
- ✓ 02d80e80 (Task 1: heading-depth walker)
- ✓ 98a324c4 (Task 2: live tests)

**Test results:**
- ✓ 8/8 live tests pass
- ✓ 1 todo remains (three-author concurrency, Plan 03 dependency)

## Self-Check: PASSED

All files verified, all commits exist, all tests pass. Plan complete.

## Notes

- **Anchor contract change (D-06):** The `anchor` parameter to `getSection`/`updateSection` is now the FULL ATX heading marker ("## Foo", "### Evidence") — not bare text. This is a breaking change for direct callers of these methods. Phase 3 recordState methods use internal `appendToSection` with regex patterns (not updateSection public API), so no upstream breakage.
- **Class method wrappers unchanged:** `getSection` and `updateSection` signatures (lines 193-241) remain identical in structure. Only the helper delegation changed — the rewritten `extractSection`/`replaceSection` accept the same inputs and return the same shapes.
- **Setext graceful degradation:** Setext headings (`Foo\n===`) are detected and warned but not treated as section boundaries. The text line remains part of the body. This is intentional — GSD planning docs use ATX exclusively; setext is unsupported but non-fatal.
- **Three-author concurrency deferred:** The it.todo test for PRIMITIVES-06 (concurrent updateSection) remains until Plan 03 wraps updateSection in withTransaction (D-09 internal wrap). That test requires the shadow-dir journal atomicity — cannot be verified with the current updateSection implementation.

## Dependencies Satisfied

- **PRIMITIVES-01 (write):** updateSection supports L2/L3/L4 via depth walker ✓
- **PRIMITIVES-02 (read):** getSection supports L2/L3/L4 via depth walker ✓
- **D-06:** Heading-depth walker implemented ✓
- **D-07:** Document-order first-match implemented ✓
- **D-08:** Fence/comment skip + setext warning implemented ✓

## Blockers for Plan 03

None — Plan 03 (D-09 withTransaction internal wrap) can proceed. The depth walker is complete and tested.
