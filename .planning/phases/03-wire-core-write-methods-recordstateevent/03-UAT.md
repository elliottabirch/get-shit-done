---
status: diagnosed
phase: 03-wire-core-write-methods-recordstateevent
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-VERIFICATION.md]
started: 2026-05-11T02:00:00Z
updated: 2026-05-11T02:55:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete — 2 bugs caught, both fixed mid-session]

## Tests

### 1. SC#3 — Adapter-routed writes produce valid STATE.md byte shape (live smoke)
expected: |
  Byte-shape invariant for adapter-routed STATE.md writes. The verifier
  flagged this as human_needed because no golden-file byte-diff test
  exists for the new write paths.
result: issue
reported: "Decision didn't actually land in the file; progress values non-deterministic across writes"
severity: blocker
observation: |
  INITIALLY marked pass based on Phase 5 UAT evidence, but user pushed
  back and asked 'where was it supposed to show changes? im only seeing
  changes in the last updated time and percent complete'. Re-ran the
  live smoke and caught TWO real bugs that the automated test suite
  missed:

  Bug 1 (blocker): state.add-decision reported {added: true, decision: "..."}
    but the decision body was NOT written to STATE.md. Root cause: adapter
    regex /(Decisions|Decisions Made|Accumulated...Decisions)/ only
    matched those three literals; this repo's STATE.md has "## Locked
    decisions (2026-04-30)" which didn't match. appendToSection silently
    returned content unchanged; recordStateAppend didn't throw; handler
    reported success.

  Bug 2 (blocker): progress fields drifted across writes. phase.complete
    wrote percent using phase-weighted formula (new_completed/total_phases);
    syncStateFrontmatter used plan-weighted (completed_plans/total_plans).
    Same disk state produced different numbers depending on which writer
    ran last. completed_phases bounced 6 → 5 → 6 across commits this
    session — visible in `git show` on commits 9656d25a vs subsequent
    state writes.

  Both bugs fixed mid-UAT:
  - Bug 1: commit e7c0806a — broadened regex + use appendToOrCreateSection
    (consistent with forensic_session / quick_task event handling); added 2
    regression tests (heading-variant, create-if-missing).
  - Bug 2: commit e325d561 — single-writer rule. Stripped progress-writing
    from phase.complete; syncStateFrontmatter is now the only writer of
    progress fields; deterministic across writes.

  Post-fix live smoke at 2026-05-11T02:54Z:
  - state.add-decision → decision landed at line 81 under "## Locked
    decisions (2026-04-30)" ✓
  - progress: completed_phases=5, completed_plans=30, percent=100 —
    deterministic across 3 consecutive writes (decision, session,
    decision again) ✓
  - status: ready_to_plan → planning (canonical status normalizer) —
    expected.
status_after_fix: resolved
pass_post_fix: true

### 2. Event families are discriminated-union-safe (TS compile-time guarantee)
expected: |
  Compile-time dispatch-contract check via `tsc --noEmit`.
result: pass
observation: |
  `cd sdk && ./node_modules/.bin/tsc --noEmit` exits 0 with no errors.
  Discriminated-union contract holds across every call-site in sdk/src
  and adapters/ — any unhandled event type would produce a
  never-narrowing error at compile time.

### 3. withTransaction atomicity under mid-call failure (SC#1 byte-identity)
expected: |
  Focused conformance test for the mid-txn-failure invariant.
result: pass
observation: |
  `NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run --config
  vitest.conformance.config.ts -t "mid-txn"` → 1 passed / 119 skipped (filter).
  SHA-256 preHash === postHash holds after an intentional mid-transaction
  throw. Phase 3's lock-only withTransaction + Phase 5's shadow-dir journal
  upgrade both passing.

### 4. OQ-01 resolution: commitPlanningState is a required, documented primitive (SC#4)
expected: |
  Triple grep on ADR + type interface + Capabilities exclusion.
result: pass
observation: |
  - D-2026-05-10-01 present (1 match) ✓
  - commitPlanningState appears on StorageAdapter interface (2 refs:
    method declaration + doc comment) ✓
  - Zero `commitPlanningState: boolean` or similar in Capabilities
    (promoted to required per D-2026-05-10-02) ✓

## Summary

total: 4
passed: 3
issues: 1
issues_resolved: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

<!-- Both gaps fixed mid-UAT; recorded here for traceability -->

- truth: "state.add-decision writes the decision body to STATE.md (adapter-routed write contract)"
  status: resolved
  reason: "User reported: 'where was it supposed to show changes? im only seeing changes in the last updated time and percent complete' — decision body was NOT landing in STATE.md"
  severity: blocker
  test: 1
  root_cause: "adapters/markdown/index.ts recordStateAppend case 'decision' used appendToSection with regex /(Decisions|Decisions Made|Accumulated.*Decisions)/ — no match on real-world headings like '## Locked decisions (2026-04-30)'; appendToSection silently returns content unchanged"
  artifacts:
    - path: "adapters/markdown/index.ts"
      issue: "Hardcoded heading regex dropped writes against heading variants"
    - path: "tests/conformance/write-events.test.ts"
      issue: "Only tested the exact heading '## Decisions', missed real-world variants"
  fix_commit: "e7c0806a — broaden regex to /\\b[Dd]ecisions?\\b/, switch to appendToOrCreateSection (consistent with forensic_session/quick_task pattern); add 2 regression tests"
  status_after_fix: resolved

- truth: "progress.completed_phases / completed_plans / percent are deterministic across adapter writes"
  status: resolved
  reason: "User-observed: progress fields bounced across writes this session (completed_phases 6→5→6 across sequential STATE.md-writing commits)"
  severity: blocker
  test: 1
  root_cause: "Two competing writers: phase.complete wrote percent using phase-weighted (new_completed/total_phases); syncStateFrontmatter wrote percent using plan-weighted (completed_plans/total_plans). Whichever ran last won. Also completed_phases was incremented from stale STATE.md value instead of always re-scanned from disk."
  artifacts:
    - path: "sdk/src/query/phase-lifecycle.ts"
      issue: "phase.complete wrote progress fields directly (should have deferred to sync)"
    - path: "sdk/src/query/state.ts"
      issue: "buildStateFrontmatter derivation was correct but being overwritten by phase.complete"
  fix_commit: "e325d561 — strip progress-writing from phase.complete; syncStateFrontmatter is now the single writer of all 5 progress fields; verified deterministic across 3 consecutive live writes"
  status_after_fix: resolved
