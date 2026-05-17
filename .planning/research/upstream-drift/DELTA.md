# Upstream Drift — Investigation (DELTA.md)

**Status:** Complete (empirical, derived from the actual rebase)
**Window:** `4029d103` (v1.0 cutover, 2026-05-13) → `ae63cbe5` (upstream/main tip, 2026-05-16)

## Headline numbers

| Metric | Value |
|---|---|
| Upstream commits in window | 396 |
| Files changed in window | 1,340 |
| Files in adapter-adjacent paths (`adapters/`, `get-shit-done/bin/lib/`, `sdk/src/`) | 253 |
| Replayed during rebase | 351 (1 explicit drop) |
| Substantive conflicts hit | ~15 distinct clusters |

## What got skipped during rebase

**Skipped commit:** `d4d34500` (`fix(01-debt): cause-C validateHealth W006/W019/repairs_performed parity`).

Reason: it was a fork-side workaround for W006 misbehavior in upstream's then-broken validate.health. Upstream subsequently fixed W006 properly with three issues' worth of test coverage (#3473, #3559, #3565). The workaround would now break test #3565 (`does not alias 22A to 22 when suppressing W006`) — verified empirically by running the test against the workaround.

**Cost of skip:** none. The commit's purpose is fully subsumed by upstream's better implementation.

## Conflict patterns observed

The 351 replayed commits split cleanly into four pattern classes:

### Pattern A — Adapter-as-first-arg signature collisions (~12 commits)
Examples: `065de6ec refactor(02-02): migrate phase/roadmap reads through adapter`, `a039d806 WIP(02-gaps): migrate state.ts + init handlers`.

Our commits changed function signatures (`(args, projectDir)` → `(adapter, args, projectDir)`). Upstream concurrently evolved the same functions' bodies. Resolution required combining: keep ours' signature, layer upstream's body improvements (e.g., #3164 diagnostic searchedDirectories, #2893 planNamingWarning, #3559 notStartedPhases exemption, #3257 scanPhasePlans nested-plans counting).

**Net result:** ~30 callsite updates. Most resolved cleanly with 5-15 lines per file.

### Pattern B — Wholesale "take theirs" refactors (~25 commits, mostly Phase 3-4)
Examples: `25f65d51 feat(03-04) refactor 13 phase-lifecycle handlers`, `b65b50d8 feat(04-01): register 25 new query verbs`, all of Phase 4 (workflow leak elimination).

Our commits were thin-orchestrator refactors that *moved code out of files* into shared helpers (phase-helpers.ts, phase-roadmap-mutation.ts, phase-filesystem-adapter.ts). Upstream had no equivalent — the conflict was always "ours adds the new structure, upstream still has the old code."

Resolution: `git checkout --theirs` to keep our refactor. Cost: ~6 commits worth of subsequent upstream improvements to the *original* (pre-refactor) functions were lost. Test-driven recovery required.

### Pattern C — CJS-only carve-outs (~3 commits)
Example: `verifyCodebaseDrift` in `verify.ts:681` — upstream intentionally removed it from the SDK because it caused infinite SDK→CLI→SDK recursion when the CJS verify-command-router dispatched through the SDK bridge. ADR: `docs/adr/3524-cjs-sdk-hard-seam.md §3`.

Resolution: drop our import + dispatch wiring; the CJS router handles it directly.

### Pattern D — Test fixture signature drift
Test files invoke handlers with the OLD signature (no adapter arg). Test files don't compile against the new signatures. Required mechanical sed (`s/await fn\(\[/await fn(adapter, [/g`) across 9 test files plus `// leak-grep-allow file` comments because tests legitimately set up `.planning/` fixtures in tmpdirs.

## Adapter-seam impact (filed by area)

| Area | Status | Evidence |
|---|---|---|
| Read-side handlers (find/get/analyze) | ✅ Reconciled | Phase 2 commits replayed; 53/53 roadmap.test passing, 27/27 state.test passing |
| Write-side handlers (state mutations) | ⚠️ Partial | Phase 3 commits replayed; 49/52 state-mutation.test passing — 3 unported features (curated progress preservation, workstream frontmatter sync) |
| Workflow leak plugging (Phase 4) | ✅ Reconciled | Workflow-file conflicts resolved take-theirs; integration tests still need port verification |
| Phase 5 primitives | ✅ Reconciled | No conflicts — upstream didn't touch this area |
| BeadsAdapter (Phase 6, sibling repo) | N/A | Out of scope for this milestone |
| Conformance suite (Phase 7) | ⚠️ Partial | Suite runs; large-body case missing (defect `get-shit-done-qjk`) |
| Distribution (Phase 8) | ✅ Reconciled | Workflow files updated; ADR D-2026-05-13-DIST-05 unchanged |

## Upstream features lost during "take theirs" (must be ported)

These are the test failures that remain after the rebase — empirically observed, grouped by behavior:

### Group 1 — `phase_status` field (#3569)
- **Test failures:** 4 (initPlanPhase phase_status: Complete/Planned/Pending/Executed)
- **What it is:** Multi-state status field derived from disk (PLAN/SUMMARY counts) + VERIFICATION.md `status:`. Maps to `Pending` (no plans) / `Planned` (plans, no summaries) / `Executed` (summaries match plans, no VERIFICATION) / `Complete` (verification passed).
- **Source:** `git show main:sdk/src/query/init.ts | grep determinePhaseStatus`
- **Belongs:** `progress.ts` (already imported in init.ts)
- **Adapter touch:** read VERIFICATION.md via adapter; phase file scan via adapter

### Group 2 — `mode` field on `roadmap.get-phase` (#mvp-mode regression)
- **Test failures:** 3 (extracts `**Mode:** mvp`, returns null when absent, preserves unrecognized verbatim)
- **What it is:** Extract `**Mode:** <value>` from a phase's section in ROADMAP.md
- **Belongs:** `roadmap.ts:roadmapGetPhase` — small parsing addition
- **Adapter touch:** none new (already reads roadmap via adapter)

### Group 3 — `--dry-run`, `--force`, flag rejection in phase-lifecycle
- **Test failures:** 9 (phaseAdd dry-run, phaseAdd reject unknown flags, phaseRemove --force, phaseComplete state updates, milestoneComplete --help defense)
- **What it is:** Strict argv parsing — reject unknown `--flags`, support `--dry-run`/`--force` consistently, refuse `--help` as a version value
- **Belongs:** `phase-lifecycle.ts` flag-parsing pre-amble (or `phase-lifecycle-policy.ts` if a shared validator exists)
- **Adapter touch:** none

### Group 4 — Curated progress preservation in stateUpdate
- **Test failures:** 3 (preserves curated progress frontmatter during body-only updates, resyncs progress when updating Progress body field, syncs full-file workstream STATE.md frontmatter)
- **What it is:** When body changes don't touch progress, the user-curated `progress.*` frontmatter values must survive (don't auto-recompute). When the user explicitly updates `Progress`, recompute everything.
- **Belongs:** `state-mutation.ts:stateUpdate` + `buildStateFrontmatter` `options.preserveExistingProgress` honoring
- **Adapter touch:** none new

### Group 5 — Validate.health W005/W006/I001 fixes
- **Test failures:** 3 (`#3473 999.X backlog phase directory naming`, `#3565 alias 22A to 22 when suppressing W006`, `#3473 plan file with descriptor + canonical-stem summary`)
- **What it is:** Three independent validate.health rule fixes upstream shipped — backlog-phase (999.X) recognition, no-aliasing of phase variants when suppressing, descriptor-vs-canonical plan-file matching
- **Belongs:** `validate.ts` (where validateHealth lives)
- **Adapter touch:** validate.ts already adapter-aware; just rule logic

### Group 6 — Archived-phase directory handling (#3469)
- **Test failures:** 1 (initExecutePhase keeps same-milestone archived dir instead of nulling it)
- **What it is:** When findPhase finds a phase in the milestones archive AND ROADMAP says it's still active in the current milestone, keep the archived dir — don't null it.
- **Belongs:** `init.ts:shouldDropArchivedPhaseMatch` (function exists, has wrong logic)
- **Adapter touch:** none

### Group 7 — Workstream-scoped initVerifyWork
- **Test failures:** 1 (resolves workstream-scoped phases when workstream is provided)
- **What it is:** initVerifyWork should honor workstream like initMilestoneOp does
- **Belongs:** `init.ts:initVerifyWork`
- **Adapter touch:** thread workstream through findPhase/roadmapGetPhase calls

### Group 8 — Integration test parity
- **Test failures:** 6 (3 golden, 3 read-only-parity)
  - `validate.health` SDK vs CJS golden
  - `docs-init` SDK vs CJS golden
  - `verify.codebase-drift` SDK vs CJS (we removed this — golden also needs updating)
  - `audit-uat` JSON parity
  - `state.load` payload parity
  - `state.get` no-field full-content parity
- **What it is:** End-to-end golden snapshots between SDK and CJS implementations
- **Belongs:** Update goldens to match post-rebase output OR fix divergences

### Group 9 — Misc (3)
- **`config.test.ts loadConfig`** — defaults parity (returns undefined for fields that should be false)
- **`markdown/index.test.ts > readModifyWriteRoadmapMd does not throw`** — implementation gap (`core.atomicWriteFileSync` missing)
- **`runtime-bridge-sync/index.test.ts > native_failure classification`** — bridge classification regression

## Recommended phase shape for v1.1 roadmap

Based on grouping above, ~3-4 phases:

1. **Land the rebase** — fast-forward `feat/storage-adapter` to `rebase/onto-upstream-2026-05-16` after agreeing the diff is acceptable
2. **Port adapter-clean upstream features** (Groups 1, 2, 3, 5, 6, 7) — test-driven; each group is a plan
3. **Port write-path features** (Group 4 + integration test cleanup, Group 8) — touches state-mutation hot path
4. **Close out adapter defects** — DECISIONS.md >64KB (`get-shit-done-qjk`) + conformance suite large-body test
5. *(Optional)* — Resolve the 7 beads-vs-markdown divergences I called out earlier (disk/bd dual-write trap, stub SDK handlers, etc.)

## Things to consciously NOT scope into v1.1

- Sibling `gsd-beads` work (separate repo, post-v1.1)
- BeadsAdapter feature additions beyond the >64KB fix
- New StorageAdapter capabilities
- Any Phase 8 distribution rework — DIST-04 first-green CI run still pending but is a v1.0 closeout item, not v1.1 scope

---

*Investigation method: live rebase against upstream/main, observed conflict patterns, ran test suite, classified failures by root cause. No subagent spawn needed — the rebase IS the empirical evidence.*
*Source branch: `rebase/onto-upstream-2026-05-16` at `5a063672` (post-rebase + initial cleanup commits).*
