# Phase 1: Land the rebase - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 01-land-the-rebase
**Areas discussed:** Cutover mechanic, Test failure triage policy, Diff review depth, Conflict-resolution playbook trigger

---

## Cutover mechanic

### Q1: How should the rebase land on feat/storage-adapter?

| Option | Description | Selected |
|--------|-------------|----------|
| Reset feat/storage-adapter to current branch tip | Force-update; cleanest history; discards origin/feat/storage-adapter tip work | |
| Fast-forward feat/storage-adapter | If feat/storage-adapter is an ancestor — same end state, no force-push | ✓ |
| Merge --no-ff with merge commit | Preserves both lineages; explicit landing merge commit | |
| Rename branches | Trade force-push for a rename event | |

**User's choice:** Fast-forward feat/storage-adapter (Recommended if possible).

### Q2: If feat/storage-adapter is NOT an ancestor, what's the fallback?

| Option | Description | Selected |
|--------|-------------|----------|
| Reset feat/storage-adapter (force-push) | Force-update to current tip after verifying nothing is lost | ✓ |
| Merge --no-ff (Recommended fallback) | Produce a merge commit; preserves both lineages | |
| Stop and investigate | File a bd issue, halt Phase 1 | |

**User's choice:** Reset feat/storage-adapter (force-push).

### Q3: What 'nothing lost' check must pass before force-push reset?

| Option | Description | Selected |
|--------|-------------|----------|
| Cherry-pick dry-run audit | For each unique commit, attempt cherry-pick to scratch branch and inspect diff | ✓ |
| git log --left-right + manual review | List commits, review titles only | |
| File-level diff snapshot | Diff source files only; audit by hand or fall back to cherry-pick | |
| Skip the check — v1.0 tag is the safety net | Trust strict-superset; recover post-reset if needed | |

**User's choice:** Cherry-pick dry-run audit (Recommended).

### Q4: Where should the cutover happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Stage on intermediate branch first | Land on feat/storage-adapter-staging, verify, then advance canonical | ✓ |
| Land directly on feat/storage-adapter | Update canonical immediately; verify there | |
| Local-only verification, then push | Local cutover + verification; push only after green | |

**User's choice:** Stage on intermediate branch first (Recommended).

### Q5: Branch lifecycle for rebase/onto-upstream-2026-05-16?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep until milestone close | REBASE-05 invariant; fork/v1.0-shipped + rebase branch on origin until v1.1 close | ✓ |
| Convert to a permanent tag | Tag rebase tip, delete branch | |
| Delete after Phase 1 close | Aggressive cleanup; violates REBASE-05 | |

**User's choice:** Keep until milestone close (Recommended).

---

## Test failure triage policy

### Q1: What counts as 'every failure categorized' for REBASE-02 to pass?

| Option | Description | Selected |
|--------|-------------|----------|
| Manifest of failures with REQ-ID per row | Per-test mapping to REQ-ID or known v1.0-deferred todo; no 'unknown' rows | |
| Failure count per category, no per-test mapping | Aggregate counts only | |
| Unknown failures allowed if <3 | Tolerate up to 2 uncategorized; ≥3 blocks | ✓ |

**User's choice:** Unknown failures allowed if <3.

### Q2: How should the 6 known CJS-vs-SDK golden parity failures be classified?

| Option | Description | Selected |
|--------|-------------|----------|
| Inherited-skip | Allow-list as v1.0 Phase 8 deferred; not a regression | (yes, plus add'l rule) |
| In-scope as new VERIFY items | Resolve in Phase 4 | |
| Skip with .skip annotation | Mutate test files now to .skip | |

**User's choice:** "yes, inherited skip is fine, and we need to have a 0 tolerance policy for failed tests, unless they ar failing on upstream branch" — chose inherited-skip AND added the broader zero-tolerance-vs-upstream policy.

### Q3: Confirming the policy — every test that passes on upstream/main MUST pass on feat/storage-adapter; any test failing on both is allowed?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, exactly | Run suite against upstream/main to produce baseline; rebase failures \\ upstream failures = 0 | ✓ |
| Yes, but allow inherited-skip set too | Same plus the 6 v1.0-inherited tests | (implicitly included via D-08) |
| I meant something different | Clarify in free text | |

**User's choice:** Yes, exactly (Recommended).

### Q4: How should the upstream baseline be captured?

| Option | Description | Selected |
|--------|-------------|----------|
| Run suite against upstream/main on disk, capture failure list | Worktree-checkout, dump failing test IDs to upstream-baseline-failures.txt | ✓ |
| Use GitHub Actions / upstream CI badge | Trust upstream's CI state | |
| Build a programmatic baseline script | Auto-checkout, run, persist as JSON | |

**User's choice:** Run suite against upstream/main on disk, capture failure list (Recommended).

### Q5: Which upstream commit should be the baseline checkout point?

| Option | Description | Selected |
|--------|-------------|----------|
| ae63cbe5 — rebase window tip | DELTA.md identifies this as the upstream commit our rebase replays onto | ✓ |
| Current upstream/main HEAD | Latest, but baseline drifts mid-phase | |
| Upstream main as of v1.0 close (4029d103) | Older; misses 396 commits | |

**User's choice:** ae63cbe5 — rebase window tip (Recommended).

---

## Diff review depth

### Q1: What level of review constitutes 'read and accepted' for the 357-commit diff?

| Option | Description | Selected |
|--------|-------------|----------|
| Spot-check by file class | Every adapter-seam commit in full + sampled feature commits | ✓ |
| Full reverse-chronological scan | Every commit message + diff stat, every commit acknowledged | |
| Trust DELTA.md + test gate | Skip extra read pass; rely on existing classification | |
| Auto-generate review summary, then approve | Script-generated summary, human reads summary not commits | |

**User's choice:** Spot-check by file class (Recommended).

### Q2: What artifact does Phase 1 produce to prove the review actually happened?

| Option | Description | Selected |
|--------|-------------|----------|
| REVIEW-NOTES.md with per-class findings | Tangible artifact: file-class breakdown + per-commit verdicts + flagged surprises | ✓ |
| Inline DELTA.md addendum | Append to DELTA.md; less granular | |
| Commit-message verdict trail | N small commits with verdicts in messages; poor discoverability | |

**User's choice:** REVIEW-NOTES.md with per-class findings (Recommended).

### Q3: What sampling rate for non-seam (pure upstream-feature) commits?

| Option | Description | Selected |
|--------|-------------|----------|
| 20% with bias toward larger diffs | Always include >10 files or >300 lines | (skipped) |
| 10% uniform random | Faster | |
| 100% headers, 20% bodies | Read every message; sample diffs | |

**User's choice:** "what is the point of this question?" — Claude acknowledged the test gate carries the bulk of correctness; sampling rate is left to the planner. Question retired.

---

## Conflict-resolution playbook trigger

### Q1: If `git rebase main` produces conflicts in business-logic files, what's the response?

| Option | Description | Selected |
|--------|-------------|----------|
| Block Phase 1 close, file as DEFECT-NEW | Indicates a missed leak; conservative | ✓ |
| Resolve in-place, document, proceed | Faster but normalizes 'unexpected conflict + resolve' | |
| Treat as Phase 2 SEAM scope unconditionally | Add to SEAM-01..03 | |

**User's choice:** Block Phase 1 close, file as DEFECT-NEW (Recommended).

### Q2: Is REBASE-04 a real rebase or a dry-run?

| Option | Description | Selected |
|--------|-------------|----------|
| Dry-run only | Throwaway branch, verify zero conflicts, discard | ✓ |
| Real rebase, consume result | feat/storage-adapter tip = main + adapter commits | |
| Skip if main hasn't moved | Pragmatic skip | |

**User's choice:** Dry-run only (Recommended).

### Q3: How should DEFECT-NEW issues filed during Phase 1 be routed?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-extend Phase 4 scope | Roadmap traceability grows; Phase 4 plans cover them | ✓ |
| Separate v1.1 backlog, user-promoted | Cleaner milestone scoping but risks shipping known-broken state | |
| Block milestone close until triaged | Defers routing problem to milestone-close time | |

**User's choice:** Auto-extend Phase 4 scope (Recommended).

---

## Claude's Discretion

- Specific git commands and exact verification ordering inside the staging flow.
- Branch naming for the staging branch.
- Sampling rate for non-seam commits during diff review.
- Worktree vs separate clone for the upstream baseline checkout.

## Deferred Ideas

- Programmatic baseline script (re-runnable for v1.2+) — out of scope for Phase 1.
- Auto-skip annotations on inherited failures — Phase 4 scope (VERIFY).
- Sibling gsd-beads rebase coordination — not v1.1 scope.
