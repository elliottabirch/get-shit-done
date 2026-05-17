---
phase: 07-conformance-test-suite
plan: 05a
subsystem: testing
tags: [fast-check, property-based-testing, arbitraries, conformance]

# Dependency graph
requires:
  - phase: 07-04b
    provides: conformance manifest (41 entries), paired test harness, tsconfig for conformance tree
provides:
  - fast-check@4.8.0 + @fast-check/vitest@0.4.1 devDeps installed
  - 12 per-noun fast-check arbitraries in tests/conformance/arbitraries/
  - encode.ts shared helper (encodeFrontmatterDoc)
  - conformance tsconfig updated to include arbitraries/
affects: [07-05b, 07-06]

# Tech tracking
tech-stack:
  added: [fast-check@4.8.0, "@fast-check/vitest@0.4.1"]
  patterns:
    - "fc.option with { nil: undefined } for optional interface fields (T | undefined)"
    - "fc.stringMatching for constrained string shapes (IDs, slugs, enum-like patterns)"
    - "Per-noun arbitrary files: one file per noun, ~15-50 LOC, RESEARCH-table caps"

key-files:
  created:
    - tests/conformance/arbitraries/arbStateEvent.ts
    - tests/conformance/arbitraries/encode.ts
    - tests/conformance/arbitraries/arbPhase.ts
    - tests/conformance/arbitraries/arbPlan.ts
    - tests/conformance/arbitraries/arbSummary.ts
    - tests/conformance/arbitraries/arbUat.ts
    - tests/conformance/arbitraries/arbRoadmap.ts
    - tests/conformance/arbitraries/arbDecision.ts
    - tests/conformance/arbitraries/arbBlocker.ts
    - tests/conformance/arbitraries/arbDebugSession.ts
    - tests/conformance/arbitraries/arbProject.ts
    - tests/conformance/arbitraries/arbSpec.ts
    - tests/conformance/arbitraries/arbAiSpec.ts
  modified:
    - package.json
    - package-lock.json
    - tests/conformance/tsconfig.json

key-decisions:
  - "fc.option uses { nil: undefined } to match optional interface fields (T | undefined, not T | null)"
  - "Resolution field on arbDebugSession uses default fc.option (null) for widest distribution coverage"
  - "No Unicode special chars (§, ≤) in single-line comments that span */ boundary — caused tsc parse error in block comments"

patterns-established:
  - "Arbitrary caps: fc.array maxLength:50, fc.string maxLength:500 (RESEARCH-table standard)"
  - "Single-line filter: .filter((s) => !s.includes('\\n')) for bullet-item fields (arbBlocker, arbBlockerAddedPayload)"
  - "Discriminated union arbitraries: fc.oneof over fc.record({ type: fc.constant('literal' as const), payload: arbPayload })"

requirements-completed: [CONFORM-02]

# Metrics
duration: 35min
completed: 2026-05-12
---

# Phase 7 Plan 05a: fast-check Arbitraries Summary

**12 per-noun fast-check arbitraries + encode helper authored; fast-check@4.8.0 installed; all typecheck clean under npm run build:conformance**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-12T15:15:00Z
- **Completed:** 2026-05-12T15:50:00Z
- **Tasks:** 3 of 3
- **Files modified:** 16 (13 created, 3 modified)

## Accomplishments

- Installed fast-check@4.8.0 + @fast-check/vitest@0.4.1 as devDeps; package.json preserves alphabetical sort order
- Authored `arbStateEvent.ts` covering all 12 discriminated-union variants: 6 AppendEvent (decision, metric, roadmap_evolution, session, forensic_session, quick_task), 4 MutationEvent (blocker_added, blocker_resolved, todo_count_update, deferred_items), 2 SignalEvent (waiting, resume) — mirrors `adapters/state-event-types.ts` 1-for-1
- Authored `encode.ts` exporting `encodeFrontmatterDoc(frontmatter, body) -> string` for 07-05b property-test use
- Authored 11 remaining per-noun arbitraries: arbPhase, arbPlan, arbSummary, arbUat, arbRoadmap, arbDecision, arbBlocker, arbDebugSession, arbProject, arbSpec, arbAiSpec
- Updated `tests/conformance/tsconfig.json` to include `arbitraries/**/*.ts`; `npm run build:conformance` exits 0

## Task Commits

1. **Task 1: Install fast-check + @fast-check/vitest devDeps** - `e24a1881` (chore)
2. **Task 2: Author arbStateEvent.ts + encode.ts** - `33cb0a15` (feat)
3. **Task 3: Author 11 per-noun arbitraries** - `38da9aea` (feat)

## Files Created/Modified

- `package.json` - Added @fast-check/vitest@^0.4.1 and fast-check@^4.8.0 to devDependencies
- `package-lock.json` - Lockfile updated by npm install
- `tests/conformance/tsconfig.json` - Added `./arbitraries/**/*.ts` to include array
- `tests/conformance/arbitraries/arbStateEvent.ts` - 12-variant discriminated union arbitrary
- `tests/conformance/arbitraries/encode.ts` - encodeFrontmatterDoc helper
- `tests/conformance/arbitraries/arbPhase.ts` - Phase record arbitrary
- `tests/conformance/arbitraries/arbPlan.ts` - Plan (must_haves, waves) arbitrary
- `tests/conformance/arbitraries/arbSummary.ts` - Summary (outcome enum) arbitrary
- `tests/conformance/arbitraries/arbUat.ts` - UAT (status, gaps) arbitrary
- `tests/conformance/arbitraries/arbRoadmap.ts` - Roadmap (phases list) arbitrary
- `tests/conformance/arbitraries/arbDecision.ts` - Decision (D-YYYY-MM-DD-NN id) arbitrary
- `tests/conformance/arbitraries/arbBlocker.ts` - Blocker (single-line text) arbitrary
- `tests/conformance/arbitraries/arbDebugSession.ts` - DebugSession (slug + sections) arbitrary
- `tests/conformance/arbitraries/arbProject.ts` - Project (validated/active/out-of-scope) arbitrary
- `tests/conformance/arbitraries/arbSpec.ts` - Spec (problem/constraints/approach) arbitrary
- `tests/conformance/arbitraries/arbAiSpec.ts` - AiSpec (3-section) arbitrary

## Decisions Made

- `fc.option` with `{ nil: undefined }` is required when the interface field is `T | undefined` (optional). The default `fc.option` produces `T | null`, which TypeScript rejects against optional interface fields. This was discovered during Task 2 type-checking.
- `arbDebugSession.resolution` uses default `fc.option` (null) intentionally per the plan's guidance: "prefer fc.option(arb) over arb" for widest distribution. This field is structural (not passed to the adapter interface directly), so null vs undefined is acceptable at the arbitrary level.
- The conformance tsconfig `include` array was extended to cover `./arbitraries/**/*.ts`. This keeps all arbitraries within the same tsc compile scope as the conformance harness types they reference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] fc.option nil parameter for optional interface fields**
- **Found during:** Task 2 (arbStateEvent.ts compilation)
- **Issue:** The plan skeleton used `fc.option(arb)` for optional fields, but fast-check's default `fc.option` produces `T | null`. TypeScript rejected `string | null` where the interface required `string | undefined`. Affected: `rationale` (DecisionPayload), `tasks`/`files` (MetricPayload), `note`/`after`/`urgent` (RoadmapEvolutionPayload), `stoppedAt`/`resumeFile` (SessionPayload), `result` (QuickTaskPayload), `items` (TodoCountUpdatePayload), `question`/`options`/`phase` (WaitingPayload).
- **Fix:** Added `const nil = { nil: undefined } as const` and used `fc.option(arb, nil)` for all optional interface fields in arbStateEvent.ts
- **Files modified:** `tests/conformance/arbitraries/arbStateEvent.ts`
- **Committed in:** 33cb0a15 (Task 2 commit)

**2. [Rule 1 - Bug] Block comment with embedded */ in arbSummary.ts**
- **Found during:** Task 3 (build:conformance after authoring all 11 arbitraries)
- **Issue:** The original arbSummary.ts comment contained `.planning/phases/NN-*/NN-NN-SUMMARY.md` — the `*/` inside the block comment terminated it early, causing tsc parse errors on lines 5-6.
- **Fix:** Replaced the comment line with a path that doesn't contain `*/`: `.planning/phases/NN-SUMMARY.md convention`
- **Files modified:** `tests/conformance/arbitraries/arbSummary.ts`
- **Committed in:** 38da9aea (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - type/syntax bugs surfaced during compilation)
**Impact on plan:** Both fixes necessary for typecheck to pass. No scope creep; no new features.

## Issues Encountered

- The worktree was initially at upstream main HEAD, not feat/storage-adapter HEAD. Required `git reset --hard c860827756dc001fc96088a03da4f8ab3734d15e` to land on the correct base per the `<worktree_branch_check>` protocol.
- `sdk/node_modules` was absent (tsc not found); ran `npm ci` in `sdk/` to install it before build:conformance could succeed.

## Known Stubs

None. No stubs or placeholders in any authored file. All 12 arbitraries generate concrete values; `encodeFrontmatterDoc` is a complete implementation.

## Next Phase Readiness

- Plan 07-05b can import from `tests/conformance/arbitraries/*.ts` to wire `properties.test.ts` against these arbitraries
- Plan 07-05b also populates 12 noun-roundtrip manifest entries (one per noun)
- Plan 07-06 adds failure-injection tests; it depends on 07-05b being complete

---
*Phase: 07-conformance-test-suite*
*Completed: 2026-05-12*
