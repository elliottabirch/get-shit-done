# Phase 1: Land the rebase - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 takes the 357-commit upstream rebase already completed on `rebase/onto-upstream-2026-05-16` (current tip `832df66b`) and lands it on `feat/storage-adapter` such that:

- The build is clean (TypeScript + npm).
- Test outcomes match upstream/main at the rebase window tip — no new regressions.
- The 357-commit diff has been reviewed (not just applied) with a written audit artifact.
- Future `git rebase main` from `feat/storage-adapter` produces conflicts only in adapter-seam files.
- v1.0 rollback safety is preserved (`fork/v1.0-shipped` tag and `rebase/onto-upstream-2026-05-16` branch remain on origin).

This phase does NOT do any new feature porting (PORT-01..07 are Phase 3 scope), seam surgery (SEAM-01..06 are Phase 2 scope), or fix integration test goldens (VERIFY-01..07 are Phase 4 scope). It accepts the rebase outcome as-is and proves the result is a stable foundation for SEAM work.

</domain>

<decisions>
## Implementation Decisions

### Cutover mechanic
- **D-01:** Preferred strategy is **fast-forward** `feat/storage-adapter` to current branch tip (`832df66b`).
- **D-02:** Fallback (if `feat/storage-adapter` at `ecf72c9f` is NOT an ancestor of current tip): **reset via force-push**, gated on a "nothing lost" check.
- **D-03:** "Nothing lost" check is a **cherry-pick dry-run audit** — for each commit unique to `origin/feat/storage-adapter` not in the current branch, attempt `cherry-pick --no-commit` against a scratch branch and inspect the resulting diff. Empty diff = already applied, safe to discard. Non-empty diff = flag the commit and decide explicitly before proceeding with the reset.
- **D-04:** Cutover is **staged on an intermediate branch** (`feat/storage-adapter-staging`). REBASE-02/03/04 verifications run on the staging branch. Only after all gates pass does the canonical `origin/feat/storage-adapter` move (fast-forward or reset). Avoids exposing unverified state on the canonical branch.
- **D-05:** `fork/v1.0-shipped` tag and `rebase/onto-upstream-2026-05-16` branch **remain on origin until v1.1 milestone close** (locked by REBASE-05). Verified via `git ls-remote origin` before Phase 1 closes.

### Test failure triage policy
- **D-06:** **Zero tolerance** for failed tests, with one exception: tests that ALSO fail on `upstream/main` at the rebase window tip are allowed. This replaces the original ≥97% pass-rate threshold from REBASE-02 with a stricter "no new regressions vs upstream" gate.
- **D-07:** **Allowed-failure baseline** is captured by checking out `upstream/main` at commit **`ae63cbe5`** (the rebase window tip per DELTA.md), running the full test suite, and persisting failing test IDs to `.planning/phases/01-land-the-rebase/upstream-baseline-failures.txt`. This artifact is the gate input for REBASE-02 and is reproducible.
- **D-08:** **Inherited-skip set** — the 6 known CJS-vs-SDK golden parity failures (todo `cjs-sdk-golden-parity-failures.md`, scoped to v1.0 Phase 8 / DIST-04) are an additional allowed-failure set, but ONLY if they also fail on `upstream/main` (which they may, since upstream lacks our SDK divergence). If they pass on upstream, they count as new regressions and must be fixed or `.skip`'d in Phase 1.
- **D-09:** **Uncategorized failure tolerance** — up to **2** uncategorized failures may be filed as bd issues with details and the phase still passes. ≥3 uncategorized failures block Phase 1 close.
- **D-10:** **Gate evaluation formula:** `failing tests on rebase branch` SET-MINUS `upstream-baseline-failing tests` SET-MINUS `inherited-skip set` ≤ 2 (and each remaining failure is filed as a bd issue with categorization).

### Diff review depth
- **D-11:** **Spot-check by file class** is the review approach. Files are categorized by class (e.g., `sdk/src/query/`, `sdk/src/state-mutation/`, tests, configs, docs).
- **D-12:** Every commit touching **adapter-seam files** must be read in full (no sampling). Pure upstream-feature commits (non-seam) are sampled; sampling rate is left to the planner's discretion, but should bias toward larger diffs (>10 files or >300 lines always reviewed).
- **D-13:** **Test gate is the primary correctness evidence.** The diff review exists to catch surprises tests don't catch (e.g., a config field that quietly changed semantics). The review is a check on subtle issues, not a proof of correctness.
- **D-14:** **Artifact:** `.planning/phases/01-land-the-rebase/01-REVIEW-NOTES.md` containing (a) file-class breakdown of the 357-commit window, (b) every adapter-seam commit with a one-line verdict, (c) sampled feature commits with one-line verdicts, (d) any flagged surprises requiring follow-up.

### Conflict-resolution playbook trigger (REBASE-04)
- **D-15:** REBASE-04 is a **dry-run only**. Run `git rebase main` against a throwaway branch (`feat/storage-adapter-rebase-test`); verify zero conflicts in business-logic files; discard the result. `feat/storage-adapter` tip remains at the post-cutover state. The "real" rebase against main happens in a future milestone after upstream lands more commits.
- **D-16:** If the dry-run produces **unexpected business-logic conflicts** (conflicts in files that are not adapter-seam), the response is: **block Phase 1 close**, file a bd issue as `DEFECT-NEW` class. This indicates a leak we missed during the original 351-commit rebase — a file the adapter doesn't actually mediate.
- **D-17:** **Defect routing:** Any `DEFECT-NEW` issue filed during Phase 1 is **automatically added to Phase 4 scope**. Roadmap traceability table for Phase 4 must be updated before `/gsd-plan-phase 4` runs. Keeps milestone closure deterministic.

### Claude's Discretion
- Specific git commands, branch naming inside the staging flow, and exact ordering of REBASE-02/03/04 inside the staging branch are planner-chosen.
- Sampling rate for non-seam commit review during diff audit.
- Whether to use `git worktree add` or a separate clone for the upstream baseline checkout — both are valid.
- Whether to use `bd remember` to capture per-step verification evidence inline vs collecting them in `01-REVIEW-NOTES.md`.

### Folded Todos
- **`cjs-sdk-golden-parity-failures.md`** (originally Phase 8 / DIST-04 deferred):
  - **Original problem:** 6 CJS-vs-SDK subprocess parity test failures inherited from v1.0 Phase 3 deferred items.
  - **Fold rationale:** The Phase 1 test gate ("zero new regressions vs upstream") needs a defined inherited-skip set so it doesn't block on these. They are NOT being fixed here — they remain v1.0 Phase 8 / DIST-04 scope. Phase 1 just allow-lists them after confirming they also fail on upstream.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope
- `.planning/REQUIREMENTS.md` §"v1.1 — Make the StorageAdapter Seam Real" / "REBASE" — defines REBASE-01..05 with success criteria
- `.planning/ROADMAP.md` §"Phase 1: Land the rebase" — phase goal + dependencies + per-criterion observable outcomes
- `.planning/research/upstream-drift/DELTA.md` — empirical findings from the 351-commit rebase: rebase window (`4029d103` → `ae63cbe5`), 4 conflict-pattern classes, file-area impact table, the 7 PORT groups, integration test parity gaps. Anchors the test triage and review-notes artifact.

### Inherited v1.0 closeout
- `.planning/todos/pending/cjs-sdk-golden-parity-failures.md` — 6 known parity failures inherited from v1.0 Phase 3, scoped to v1.0 Phase 8 / DIST-04. Phase 1 allow-lists them.

### Locked v1.0 decisions still in force
- `.planning/DECISIONS.md` D-2026-04-30-04 — periodic rebase against upstream/main; conflicts only in adapter-seam files. This is the invariant REBASE-04 is testing.
- `.planning/PROJECT.md` "Branch strategy" section — `main` mirrors upstream, `feat/storage-adapter` is the long-lived working branch.

### Beads issues with cross-references
- bd `get-shit-done-qt2` (P0, blocking) — root cause for SEAM Phase 2; not Phase 1 scope but informs why test failures matter (handlers bypass the configured adapter, so beads-mode test results are currently meaningless).
- bd `get-shit-done-8sg` / `6sn` / `c1j` — singleton mirrors of ROADMAP/REQUIREMENTS/STATE in bd. Manually maintained until SEAM lands.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`fork/v1.0-shipped` tag** at `4029d103` — v1.0 cutover commit. Rollback target if Phase 1 catastrophically fails.
- **`rebase/onto-upstream-2026-05-16` branch** at `832df66b` — current branch with the rebase + v1.1 docs. Source for the cutover.
- **`upstream/main` at `ae63cbe5`** — rebase window tip. Source for the test-failure baseline.

### Established Patterns
- **Manual bd singleton mirroring** — until SEAM-01..03 land, every write to `.planning/STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, etc. must be mirrored to bd via `node -e "...bd update --description..."`. Phase 1 will write `01-CONTEXT.md`, `01-REVIEW-NOTES.md`, `upstream-baseline-failures.txt`, `01-PLAN.md`(s) — none of these are singletons (they're per-phase artifacts), so they do NOT need bd mirroring. STATE.md updates DO.
- **Two-step staging branch flow** (newly chosen here) — every cutover-class operation lands on a `*-staging` branch first, runs verification, only then advances the canonical branch. Establishes a pattern other v1.1 phases can reuse.

### Integration Points
- `npm run build:sdk-only` — TypeScript build gate (REBASE-03).
- `npm test` (or the suite-level vitest invocation) — test gate (REBASE-02). Will need a way to dump failing test IDs for diffing against the baseline; vitest supports `--reporter=json` for this.
- `git ls-remote origin` — REBASE-05 verification at phase close.
- `gsd-sdk query state.*` — STATE.md updates for phase progress.

</code_context>

<specifics>
## Specific Ideas

- The user wants the test triage policy to be **observable and falsifiable** — "zero new regressions vs upstream baseline" is the language. The baseline file (`upstream-baseline-failures.txt`) is the artifact that makes this checkable. Future phases inherit this pattern: every "tests pass" success criterion is grounded in a baseline file, not a percentage.
- Branch strategy: prefer fast-forward over merge commits to keep the upstream-PR strategy viable (linear history with adapter commits cleanly stacked on top).
- Phase 1 is intentionally low-novelty — it's verification of work that already exists. The "deep work" is the diff review, not new code.

</specifics>

<deferred>
## Deferred Ideas

- **Programmatic baseline script** — a script that auto-checks out upstream's tip, runs the suite, persists failing test IDs as JSON keyed by test name. Useful for future rebase milestones (v1.2+). Out of scope for Phase 1 — a one-shot manual capture is enough now.
- **Auto-skip annotations on inherited failures** — adding `.skip("v1.0 Phase 8 deferred")` directly to test files would be cleaner long-term, but mutating test files is Phase 4 scope (VERIFY items), not Phase 1.
- **Sibling `gsd-beads` rebase coordination** — the sibling repo has its own upstream-tracking story. Not v1.1 scope.

### Reviewed Todos (not folded)
- None — the only matching todo (`cjs-sdk-golden-parity-failures.md`) was folded into the inherited-skip set.

</deferred>

---

*Phase: 01-land-the-rebase*
*Context gathered: 2026-05-17*
