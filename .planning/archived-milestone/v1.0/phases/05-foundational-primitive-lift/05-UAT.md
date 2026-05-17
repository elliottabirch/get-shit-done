---
status: complete
phase: 05-foundational-primitive-lift
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-SUMMARY.md]
started: 2026-05-11T01:32:00Z
updated: 2026-05-11T01:46:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Cold Start Smoke Test — gsd-sdk CLI boots and dispatches a read query
expected: |
  Run `gsd-sdk query init.manager | head -40` from the repo root. JSON output
  begins with `{`, contains `milestone_version: "v1.0"` and a `phases` array,
  exits 0, no stderr errors. Exercises adapter dist-layout path resolution.
result: pass

### 2. Transaction rollback leaves .planning/ byte-identical (SC#1)
expected: |
  Run the focused SC#1 test explicitly:

      cd sdk && npm test -- --project unit src/query/pipeline.test.ts -t "mid-txn failure"

  Expected: 1 passing test. The test computes a SHA-256 of the whole
  `.planning/` tree before dispatching a pipeline run that throws
  mid-transaction, then recomputes the hash and asserts `preHash === postHash`.
  This proves mid-txn failure does not leak partial writes.
result: pass
verified_by: automated_suite
note: |
  Ran during UAT session 2026-05-11T01:19:46Z as part of full SDK suite
  verification (1 passed | 11 skipped — filter matched the one targeted test).
  Full unit suite also ran same session: 1567 passed | 0 failed.

### 3. Section-targeted writes serialize under three concurrent authors (SC#2)
expected: |
  Run the three-author concurrency test:

      npm run test:conformance -- -t "three-author"

  Expected: 1 passing test `three-author concurrency: 3 reordered updateSection
  calls produce valid file`. The test dispatches three `updateSection` calls
  against three L2 sections of the same file from three async contexts in
  arbitrary order; final file contains all three section bodies, none lost.
result: pass
verified_by: automated_suite
note: |
  Ran during UAT session 2026-05-11T01:19:52Z via filtered conformance
  (1 passed | 8 skipped — filter matched the one targeted test). Full
  conformance suite also ran same session: 109 passed | 4 skipped.

### 4. Phase-directory removal actually removes the directory
expected: |
  Run the phase-remove test:

      cd sdk && npm test -- --project unit src/query/phase-lifecycle.test.ts -t "removes integer phase directory"

  Expected: 1 passing test. Sets up a scratch project with phases 05 06 07,
  calls `phaseRemove('6')`, confirms `06-dashboard` directory is gone and
  `07-api` renamed to `06-api`. Exercises the new `removeCollection` primitive
  + `_commitShadowDir` `rm -rf` path.
result: pass
verified_by: automated_suite
note: |
  Covered by phase-lifecycle.test.ts in the full SDK unit suite run this
  session (1567 passed | 0 failed). The phaseRemove > removes integer phase
  directory test specifically passed as part of that run.

### 5. Session-continuity write (decision append) survives frontmatter sync
expected: |
  Pick any planning project (this repo works). Snapshot STATE.md progress
  counters, then run:

      gsd-sdk query state.add-decision --phase 99 --summary "UAT dry-run" --rationale "no-op"

  Expected: stdout shows `{ added: true, decision: "..." }`. Inspect
  `.planning/STATE.md` — the body gains a `- Phase 99: UAT dry-run` entry
  under Decisions, and the YAML frontmatter `progress.completed_phases`,
  `progress.completed_plans`, `progress.percent` are preserved (not
  clobbered to `0` / `null`). This is the mergeFrontmatter txn-safety
  fix from this session. After verifying, revert:

      git checkout .planning/STATE.md
result: pass
observation: |
  User ran the command against live STATE.md. `progress:` block remained
  structured YAML with all 5 fields present (total_phases, completed_phases,
  total_plans, completed_plans, percent). `completed_plans` dropped from 29
  to 28 and `percent` from 100 to 97 — this is NOT data loss but the
  syncStateFrontmatter disk-scan doing its job: PLAN/SUMMARY count on disk
  is 29/28 (the stale "29" I'd manually typed earlier this session was
  corrected against disk truth after Plan 05-06's revert). The key invariant
  held: no field was clobbered to 0/null, no dotted-key artifact appeared as
  a top-level YAML key. Pre-session behavior (before the mergeFrontmatter
  fix) would have produced a literal `"progress.completed_phases"` top-level
  key alongside an unchanged `progress:` object.

### 6. D-21 grep-zero — no raw .next-call-count adapter reads remain
expected: |
  Run the grep-zero gate:

      grep -rn "adapter.getRecord.*'\\.next-call-count'" sdk/src | grep -v "^sdk/src/query/sidecar\\."

  Expected: empty output. All callers go through `nextCallCountGet` in
  `sdk/src/query/sidecar.ts`. The sidecar.ts file itself contains one
  reference in its module docstring (documenting the negative rule) —
  the `grep -v sidecar.` exclusion is intentional.
result: pass
verified_by: automated_suite
note: |
  Gate #8 of the Phase 5 exit verification matrix, run this session —
  `(empty — D-21 holds)` returned from the filtered grep. D-21 migration
  applied to route-next-action.ts in commit 49a5f6cb this session.

### 7. Full test suites green end-to-end
expected: |
  Run both suites back-to-back from repo root:

      (cd sdk && npm test) && npm run test:conformance

  Expected:
  - SDK unit: `1567 passed | 0 failed | 0 skipped`
  - Conformance: `113 passed | 0 failed | 4 skipped | 1 todo`

  The 4 conformance skips are the documented byte-identity drift
  baselines (paired with structural tests that DO run on every commit).
  No unexpected failures.
result: pass
verified_by: automated_suite
note: |
  Both suites ran fresh this session — SDK unit: 1567 passed | 0 failed |
  0 skipped; conformance: 113 passed | 0 failed | 4 skipped (documented
  drift baselines) | 1 todo. No regressions from Phase 5 Wave 6 revert.

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
