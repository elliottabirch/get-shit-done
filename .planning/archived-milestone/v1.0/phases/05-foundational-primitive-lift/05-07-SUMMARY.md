---
phase: 05-foundational-primitive-lift
plan: 07
subsystem: decisions-adr-exit-gate
tags: [ADR, OQ-02, OQ-05, OQ-07, OQ-10, shadow-dir-journal, phase-exit-checkpoint]
dependency_graph:
  requires: [05-01, 05-02, 05-03, 05-04, 05-05, 05-06]
  provides: [phase-5-exit, unblocks-phase-6-beads]
  affects: [.planning/DECISIONS.md]
tech_stack:
  added: []
  patterns: [architectural-decision-record]
key_files:
  created: []
  modified:
    - .planning/DECISIONS.md
decisions:
  - "OQ-02 resolved: section is the unit of write atomicity at L2/L3/L4 depth (D-2026-05-10-03)"
  - "OQ-05 resolved: sidecar paths get typed SDK verbs, adapter stays Bin A (D-2026-05-10-04)"
  - "OQ-07 resolved: scratch artifacts are first-class SDK verbs at phase-scoped paths (D-2026-05-10-05)"
  - "OQ-10 resolved: multi-author concurrency via internally-wrapped updateSection (D-2026-05-10-06)"
  - "withTransaction upgraded to shadow-dir journal with rollback (D-2026-05-10-07)"
  - "ADR IDs renumbered from planner-drafted D-2026-05-01..05 to D-2026-05-10-03..07 after discovering ID collision with prior Phase 3/4 ADRs (D-2026-05-01, D-2026-05-01-OQ04, etc.)"
status: complete
---

## Objective Achieved

Plan 05-07 is the Phase 5 exit checkpoint. It appends 5 ADRs to
`.planning/DECISIONS.md` resolving the four SYNTHESIS §6 open questions
Phase 5 was scoped to close (OQ-02, OQ-05, OQ-07, OQ-10) plus a fifth ADR
documenting the shadow-dir journal upgrade that landed in Plan 05-03. Then
it runs an 11-command verification matrix as a human-verify checkpoint
before Phase 5 can be marked complete.

## Tasks Completed

### Task 1: Append 5 ADRs to .planning/DECISIONS.md

Committed in `09b576e4` earlier in the session. The planner drafted ADR
headers using IDs `D-2026-05-01` through `D-2026-05-05`, but those IDs
collided with existing Phase 2/3/4 entries:

- `D-2026-05-01` (Phase 2 `stat()` primitive)
- `D-2026-05-01-OQ04` (Phase 4 context-block leak audit)
- `D-2026-05-01-OQ09` (Phase 2 init-bundle granularity)
- `D-2026-05-10-01`, `D-2026-05-10-02` (Phase 3 commitPlanningState ADRs)
- `D-2026-05-10-OQ03`, `D-2026-05-10-OQ04` (Phase 4 raw-git outlier, context-block strategy)

Resolution: continued the existing `D-2026-05-10-NN` sequence with IDs
03..07. This preserves the plan's content and acceptance intent (5 new
ADRs, each with Trigger / Decision / Alternatives / Evidence / Implication)
while avoiding duplicate header lines in the file. User approved the
renumbering mid-session.

Final ADRs appended (body text lifted verbatim from the plan's drafts,
only the IDs changed):

| New ID | Topic | Source plan text |
|--------|-------|------------------|
| D-2026-05-10-03 | OQ-02: section as unit of write atomicity (L2/L3/L4 walker) | Plan 05-07 ADR 1 |
| D-2026-05-10-04 | OQ-05: sidecar paths are SDK-typed verbs, adapter stays Bin A | Plan 05-07 ADR 2 |
| D-2026-05-10-05 | OQ-07: scratch artifacts are first-class SDK verbs | Plan 05-07 ADR 3 |
| D-2026-05-10-06 | OQ-10: multi-author concurrency via internally-wrapped updateSection | Plan 05-07 ADR 4 |
| D-2026-05-10-07 | withTransaction upgraded to shadow-dir journal with rollback | Plan 05-07 ADR 5 |

### Task 2: Human-verify Phase 5 exit — full verification matrix

All 11 verification commands from the plan's `<how-to-verify>` block ran
successfully during the Phase 5 UAT session (`.planning/phases/05-foundational-primitive-lift/05-UAT.md`)
and the pre-ship audit in this session. Latest run:

| # | Gate | Expected | Actual |
|---|------|----------|--------|
| 1 | `cd sdk && npm test` | 0 failing | 1567 passed / 0 failed / 0 skipped |
| 2 | `npm run test:conformance` | 0 failing | 113 passed / 0 failed / 4 skipped / 1 todo |
| 3 | SC#1 `pipeline.test.ts -t "mid-txn failure"` | 1 passing | 1 passed (`preHash === postHash`) |
| 4 | SC#2 `section-depth.test.ts -t "three-author"` | 1 passing | 1 passed |
| 5 | SC#3 legacy-name grep-zero (4 legacy names across sdk/src+adapters, excluding regression test) | empty | empty |
| 6 | SC#4 capability flags (binaryAsset/namedDoc/snapshot/transaction = true) | 4 | 4 |
| 7 | SC#5 `^## D-2026-05-10-0[3-7] ` in DECISIONS.md | 5 | 5 |
| 8 | D-21 raw `.next-call-count` grep (excluding sidecar.ts docstring) | empty | empty (the one match is the don't-do-this negative example in sidecar.ts line 7) |
| 9 | Pipeline obsolete helpers (collectFiles, copyPlanningTree, readPlanningState) in pipeline.ts | 0 | 0 |
| 10 | `.gitignore` contains `.planning/.tmp-txn-*` and `.planning/.tmp-snap-*` | 2 | 2 |
| 11 | No `UnsupportedCapabilityError('binaryAsset\|snapshot\|namedDoc')` stubs in adapter | 0 | 0 |

User approved the checkpoint via `/gsd-verify-work 5` session that
completed with 7/7 UAT tests pass (see
`.planning/phases/05-foundational-primitive-lift/05-UAT.md`).

## Deviations from Plan

**ADR ID renumbering.** Planner drafted IDs `D-2026-05-01..05`; these
collided with existing entries. User chose renumber path (option A of the
three offered) — land as `D-2026-05-10-03..07`. All other content
(triggers, decisions, alternatives, evidence, implications) landed verbatim.

**Mid-plan revert of Wave 6.** When Task 2's verification matrix first
ran (before this session's bug-fix work), gates 1 and 2 failed because
Plan 05-06's original commit `88d43deb` had left
`sdk/src/query/route-next-action.ts` structurally broken (dangling JSDoc,
missing closing braces, missing import lines). The user chose to revert
the whole Wave 6 merge commit `c02f37ae` and re-execute Plan 05-06
atomically in this session. The revert landed as `3ba75421`; the clean
re-execution landed across four commits (`49a5f6cb`, `11dc85a3`,
`6070d319`, `b22606a9`) before Plan 05-07's verification matrix was
re-run. No plan-level scope changed — Task 1 was already committed
(`09b576e4`), so the revert+redo flowed entirely through Plan 05-06.

**Test-harness fixes surfaced during verification.** The verification
matrix exposed several latent defects in the test harness that predated
Phase 5 but only showed up when all tests ran on a macOS host for the
first time: adapter dist-layout path resolution, mergeFrontmatter txn-
safety, `getFrontmatter` returning undefined (CJS CLI path), path-sanitizer
regexes in `init-bundlers.test.ts`. These were all fixed mid-session as
collateral work required for the verification gates to pass authentically
rather than be papered over. See `f3f636f4`, `b0f2e9a6`, `0b23867a`,
`11ebea3c`, `627c6354` for the commit trail.

## Technical Notes

**Why renumber vs delete+re-draft.** The collision was a planner
mechanical error, not a content error. Renumbering preserved all 5 ADRs'
content (alternatives considered, evidence pointers to 05-CONTEXT/05-
RESEARCH/test files, implications for Phase 6). A re-draft would have
risked losing subtle details in the alternatives lists.

**Why Task 2 runs as a human-verify checkpoint.** The plan frontmatter
set `autonomous: false` and marked Task 2's `gate="blocking"`. This is
the right stance for a phase-exit gate — auto-pass would make it trivial
to ship Phase 5 with silent failures. The actual approval flow: user ran
`/gsd-verify-work 5`, UAT session generated 7 checkpoint questions
including a live STATE.md round-trip, user approved test-by-test. That's
the `resume-signal: "approved"` specified in the plan.

**The D-21 near-miss.** During the original (reverted) Plan 05-06
execution, the D-21 migration itself was structurally correct — only the
surrounding file editing was broken. When re-executing in this session,
the D-21 migration was applied as a standalone commit (`49a5f6cb`) first
to confirm it held, then the remaining handler migrations followed. This
decomposition proved the original Plan 05-06 intent was sound; only its
execution bundling was flawed.

## Phase 5 Exit

With this plan's completion, all 7 plans in Phase 5 have landed SUMMARYs:
- 05-01: type unions + Wave 0 test scaffolds
- 05-02: heading-depth walker (L2/L3/L4)
- 05-03: shadow-dir journal + snapshot/restore + reentrant lock
- 05-04: putNamedDoc/getNamedDoc/writeBinaryAsset real bodies
- 05-05: pipeline dry-run via withTransaction + sidecar.ts + scratch.ts
- 05-06: SDK handler migrations to putNamedDoc/getNamedDoc + D-21
- 05-07 (this): 5 ADRs + Phase 5 exit verification

SYNTHESIS §9 HIGH-severity gate ("Don't ship Phase 6 until dry-run is
stable on MarkdownAdapter") is closed — SC#1 passes byte-identity
against mid-txn failure, so `gsd-beads` Phase 6 (BeadsAdapter) can now
activate against the primitive-lifted interface.

## Next Phase Dependencies

Phase 6 (BeadsAdapter, sibling repo `~/code/gsd-beads`) depends on:
- Stable adapter capability flags (all 4 in SC#4 are `true`) ✓
- `updateSection` internally wrapped in `withTransaction` for AI-SPEC
  three-author concurrency parity ✓
- `putNamedDoc` / `getNamedDoc` primitive surface frozen — category +
  key dispatch model documented in ADRs ✓
- D-21 sidecar-verb pattern documented — BeadsAdapter will implement
  the same path-sniff map for `.next-call-count` and friends ✓

All four prerequisites hold as of this plan's completion.
