<!-- leak-grep-allow file — generated SUMMARY.md artifact; @.planning/* refs and prose citations are documentation, not auto-loaded skill context -->
---
phase: 08-migration-distribution
plan: 06
status: complete
completed_date: 2026-05-13
plan_type: checkpoint:decision
requirements_satisfied: [DIST-05]
key_files:
  created:
    - .planning/phases/08-migration-distribution/08-06-SUMMARY.md
  modified:
    - .planning/DECISIONS.md
    - .planning/REQUIREMENTS.md
self_check: PASSED
---

# Plan 08-06 Summary — DIST-05 Distribution Decision (PR-vs-Fork)

## Outcome

**Decision: option-b — Maintain long-lived fork.** Recorded as ADR `D-2026-05-13-DIST-05` in `.planning/DECISIONS.md`. All five DIST requirement rows in `.planning/REQUIREMENTS.md` flipped from `Pending` to `Complete (Phase 8)`. v1.0 milestone is now fully traceable: every REQ-ID has status `Complete`.

## Inputs Gathered at Decision Time

### Upstream PR reception (PRs #2898, #2901, #2908)

| PR | Title | State | Merged |
|----|-------|-------|--------|
| #2898 | feat(sdk): add durable planning runtime | MERGED | 2026-04-30 |
| #2901 | refactor: extract planning-workspace seam from core.cjs | MERGED | 2026-04-30 |
| #2908 | refactor(query): manifest-backed routing seam + family adapters | MERGED | 2026-04-30 |

All three reference PRs merged on 2026-04-30. Strong signal that upstream actively accepts seam-abstraction work.

### Fork's rebase retrospective

- One real upstream rebase has occurred in fork history (commit `6d5889a9`, 228 commits absorbed, 13 mechanical test fixes).
- `scripts/sync-upstream.sh` (DIST-03) shipped this phase with zero real runs to date — playbook is shipped but unexercised.
- The `upstream-parity.yml` workflow (DIST-04) had its first real run via draft PR #2 on 2026-05-13 and surfaced two design findings about `.planning/` fixture expectations in the upstream-checkout (`verify.commits` needs git-history seeding; `STATE.md` fixture missing). These need follow-up but are tracked in `08-05-SUMMARY.md` deviations and do not block DIST-05.

### External adopter signal

- 0 stars, 0 forks, 0 open issues on `elliottabirch/get-shit-done`.
- No NPM-01 (external-adopter requirement) signal — the requirement remains in REQUIREMENTS.md `Future Requirements` as a deferred re-open trigger.

### Sibling repo state

- `gsd-beads@feat/phase-6-reset` — stable, used by Phase 7 conformance suite via `file:../gsd-beads` peer dep.
- Sibling graduation to `main` and v1.0 release deferred to post-v1.0 work; the two-repo model (D-2026-04-30-02) holds as the long-term shape, not a transient state.

## Rationale (one paragraph, written verbatim into ADR)

Upstream's reception of #2898/#2901/#2908 (all merged 2026-04-30) demonstrates active willingness to accept seam abstractions, which is encouraging signal — but the fork's specific design (`StorageAdapter` interface as a first-class top-level seam, capabilities flag for adapter feature negotiation, paired conformance harness across two repos) is materially larger in scope than any of the three accepted PRs and would arrive as a 491-file / 371-commit proposal that upstream did not initiate. The fork's own retrospective is consistent: the one real 228-commit rebase (commit 6d5889a9) resolved cleanly with 13 mechanical test fixes, validating that DIST-03's playbook captures the rebase shape; with `sync-upstream.sh` (DIST-03) and `upstream-parity.yml` (DIST-04) now in place, ongoing rebase cost is bounded and observable. External-adopter signal is 0 today (no stars / forks / issues), which means there is no third-party pressure forcing an upstream merge — we can decide on our own timeline. Carry-forward: sibling `gsd-beads` stays on `feat/phase-6-reset` until v1.0 cut; the two-repo model (D-2026-04-30-02) remains canonical. Reopens annually as a review item.

## Forward References

- **`docs/MIGRATION.md` language stays fork-rooted** — DIST-02 docs already reference `gsd-beads migrate` against fork-installed users; no changes needed under option-b.
- **`scripts/sync-upstream.sh` (DIST-03) becomes operational lifeline** — every upstream-feature consumption requires the rebase + leak-grep audit + adapter-seam reconciliation cadence. On-demand cadence (D-15) holds.
- **`upstream-parity.yml` (DIST-04) is the strict-superset gate** — the two open findings from the 2026-05-13 first-run (`verify.commits` git-history fixture; `STATE.md` fixture in upstream-checkout) need resolution as a Phase 8.x or post-v1.0 follow-up before the parity gate can claim "first green." Tracked alongside the workflow file, not blocking DIST-05.
- **Sibling `gsd-beads` graduation to `main`** — unblocked but explicitly post-v1.0; v1.0 cut on the fork happens first, sibling v1.0 follows.
- **Annual reopen** — D-2026-05-13-DIST-05 specifies three reopen triggers: (a) external-adopter pressure (`REQ NPM-01`), (b) materially burdensome rebase-cost curve, (c) upstream maintainers explicitly soliciting the work.

## Phase 8 Close-Out Confirmation

| DIST row | Status pre-08-06 | Status post-08-06 |
|----------|------------------|-------------------|
| DIST-01 | Pending | Complete (Phase 8) |
| DIST-02 | Pending | Complete (Phase 8) |
| DIST-03 | Pending | Complete (Phase 8) |
| DIST-04 | Pending | Complete (Phase 8) |
| DIST-05 | Pending | Complete (Phase 8) |

Phase 8 ROADMAP.md row flip to `[x]` is the orchestrator's responsibility in the phase-close step (not this plan's SUMMARY).

## Self-Check

- [x] DIST-05 ADR appended to `.planning/DECISIONS.md` (`D-2026-05-13-DIST-05`)
- [x] ADR has all four subheadings: `### Context`, `### Decision`, `### Rationale`, `### Consequences`
- [x] ADR cites upstream PRs #2898, #2901, #2908 (>= 1 occurrence each — all 3 verified merged via `gh pr view`)
- [x] DIST-05 row in `.planning/REQUIREMENTS.md` reads `| DIST-05 | Phase 8 — Migration + distribution | both | Complete (Phase 8) |`
- [x] Zero `Pending` remaining in DIST rows
- [x] Active Requirements §DIST: all `[ ]` → `[x]` for DIST-01..DIST-05
- [x] No TODO / PLACEHOLDER / TBD markers in the new ADR
- [x] No hedging language in Decision field — concrete option-b answer

## Deviations

None — plan executed as specified.

## Status

**PASSED.** DIST-05 closed; v1.0 milestone fully traced.
