---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Make the StorageAdapter Seam Real
status: executing
last_updated: "2026-05-18T16:08:29Z"
last_activity: 2026-05-18
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 25
---

# Project State

## Current Position

Phase: Phase 1 — Land the rebase (closed)
Plan: — (Phase 2 next)
Status: Phase 1 closed; ready to plan Phase 2
Last activity: 2026-05-18 — Phase 1 closed (cutover complete; canonical at 332f9efe7f0045eb8473f183b9ad22ab8c50360d)

## Reference

- **Project core value:** Add a clean storage-adapter interface to GSD so
  any backend (markdown default; bd, sqlite, etc. as alternates) can be
  plugged in via config without modifying business logic.

- **Strict superset invariant:** Without an adapter configured, this fork
  behaves identically to upstream `gsd-build/get-shit-done`.

- **Phases this milestone:** 8 (per SYNTHESIS.md §7); first 5 land in
  this repo, Phase 6 in sibling `gsd-beads`, Phases 7–8 span both.

- **Carry-forward:** entire architectural investigation done in
  `gsd-beads` repo; SYNTHESIS.md (6500 words) is the canonical scope
  input. 6 locked decisions documented in DECISIONS.md.

## Architectural pivot context

This fork was created on 2026-04-30 after the gsd-beads project's v0.2
milestone surfaced that a runtime shadow architecture cannot reach all of
GSD's I/O surface (~334 direct-I/O leaks; new `<context>`-block
frontmatter leak class found mid-investigation). The architectural
investigation classified ~258 upstream artifacts and produced an adapter-
interface design. This fork is the implementation vehicle for that design.

See `.planning/research/fork-investigation/SYNTHESIS.md` for the full
investigation output.

## Recent upstream signal (relevant to this work)

Upstream's recent commits show active seam-abstraction work:

- `8cbdbdd2 feat(sdk): add durable planning runtime (#2898)`
- `abb2cb63 refactor: extract planning-workspace seam from core.cjs (#2901)`
- `444db171 refactor(query): manifest-backed routing seam + family adapters (#2908)`
- `8051bc4f test(golden): expand phases/validate/roadmap parity matrix (#2909)`
- `006cdafe ci(drift): enforce alias freshness checks in CI (#2910)`

**Phase 1 must investigate these before locking the StorageAdapter contract.**
Possible upstream foundation we build on, OR divergent vision we reconcile with.
This is encoded as ADAPTER-05 and is part of Phase 1's success criteria.

## Locked decisions (2026-04-30)

1. **Two-repo model** — this fork + `gsd-beads` (BeadsAdapter)
2. **Fork name:** keep `get-shit-done`
3. **Upstream sync model:** periodic rebase against `gsd-build/get-shit-done`
4. **Adapter capability negotiation:** `adapter.capabilities = { ... }` flag
5. **Branch strategy:** `main` mirrors `upstream/main`; work happens on
   `feat/storage-adapter`; per-phase feature branches as needed

6. **SYNTHESIS.md is canonical** — milestone scope derives from §7;
   adapter interface from §4; risks from §9; open questions from §6

See `.planning/DECISIONS.md` for full record + rationale.

- [Phase ?]: D-INIT-ERR (BEADS-04) BdManagedMismatchError shipped with __brand cross-module instanceof (sibling src/bd/errors.ts)
- [Phase ?]: RESEARCH Open Q #5 validated — two-commit git-mv+rewrite preserves git log --follow; locked as Plan 06-04 port discipline
- [Phase ?]: DEV-CLI-FLAGS-BD-V1.0.4 — bd v1.0.4 --from-jsonl is a boolean flag; seed.jsonl must pre-exist at .beads/issues.jsonl before bd init. bd delete requires --force. bd delete --cascade supports recursive deletion of dependents.
- [Phase ?]: [Phase 6 Plan 06-06]: D-2026-05-12-OQ06-CREATED-SECTION — BeadsAdapter never emits created_section under D-MAPPING Outcome A
- [Phase ?]: [Phase 6 Plan 06-06]: D-2026-05-12-OQ01-BEADS — commitPlanningState NOOP on BeadsAdapter (OQ-01 resolved)
- [Phase ?]: [Phase 6 Plan 06-06]: withTransaction ships D-TXN Outcome A in-memory buffer (275 LOC); capabilities.snapshot=false; mid-txn commit gap tracked as Deferred-04 Phase 6.1 follow-up
- [Phase ?]: [Phase 6 Plan 06-06]: BeadsAdapter feature-complete — zero NotYetImplementedError throw-stubs in src/index.ts; 71/71 smoke tests green
- [Phase 7]: D-2026-05-12-NORMALIZE — StorageAdapter.normalize() additive contract (Plan 07-01)
- [Phase 7]: D-2026-05-12-CONFORM-MANIFEST — 55-entry conformance manifest + enforcement rules (Plan 07-06); manifest ↔ registeredTests bidirectional invariant via meta-coverage.test.ts
- [Phase 7]: Paired CI green on both adapters; 119/119 non-property tests pass; BEADS_ACTOR=seed + bd export --json rollback diff confirmed (D-11)
- [Phase 7]: BeadsAdapter known-gap baked as manifest entry (D-09): mid-commit-replay withTransaction:mid-commit-replay / expected.beads.kind=incomplete-per-Deferred-04 / adr D-2026-05-12-OQ06-TXN

## v1.0 milestone scope

8 phases per SYNTHESIS.md §7 (locked in `.planning/ROADMAP.md`):

| # | Phase | Where | REQ-IDs |
|---|-------|-------|---------|
| 1 | Fork bootstrap + StorageAdapter interface skeleton + MarkdownAdapter scaffold | this repo | ADAPTER-01..07 |
| 2 | Wire core read methods to adapter | this repo | READS-01..03 |
| 3 | Wire core write methods + `recordStateEvent` | this repo | WRITES-01..04 |
| 4 | Plug workflow leaks (top-10 + `<context>`-block class) | this repo | LEAKS-01..05 |
| 5 | Foundational primitive lift | this repo | PRIMITIVES-01..09 |
| 6 | BeadsAdapter implementation | gsd-beads | BEADS-01..05 |
| 7 | Conformance test suite | both | CONFORM-01..04 |
| 8 | Migration + distribution | both | DIST-01..05 |

**REQ coverage:** 42/42 (100%). See `.planning/REQUIREMENTS.md` Traceability section.

## Open questions deferred (from SYNTHESIS.md §6)

These are NOT blocking for Phase 1; resolved as relevant phases approach:

| ID | Question | Phase that decides |
|----|----------|-------------------|
| OQ-01 | `commitPlanningState` semantics across adapters | Phase 3 |
| OQ-02 | Section-scoped vs whole-file write granularity | Phase 5 |
| OQ-03 | 2 raw-git outliers (spec-phase, eval-review) | Phase 4 |
| OQ-04 | `<context>`-block leak mitigation strategy | Phase 4 |
| OQ-05 | Sidecar paths kv-vs-named | Phase 5 |
| OQ-06 | Knowledge-graph subsystem scope | Phase 6 |
| OQ-07 | "Scratch" record taxonomy | Phase 5 |
| OQ-08 | Markdown-and-lockfile helpers visibility | Phase 1 |
| OQ-09 | Init-bundle granularity | Phase 2 |
| OQ-10 | Multi-author file (AI-SPEC) concurrency | Phase 5 |

## Phase 1 immediate decisions (need to lock during discuss-phase)

- Capabilities flag exact shape (TypeScript signature)
- Module layout: where in upstream's tree does `StorageAdapter` go? `sdk/dist/storage/`? Top-level `adapters/`?
- MarkdownAdapter relationship to upstream's `node:fs` calls: composition? extraction?
- Conformance test infrastructure design (Phase 7 prereq)
- Leak-grep tooling for the rebase script (per D-2026-04-30-04 implication)
- OQ-08 (markdown-and-lockfile helpers visibility): decide upfront whether `replaceInCurrentMilestone` and `readModifyWriteRoadmapMd` are public interface or private to MarkdownAdapter

## Pending todos

- **Systemic: retrofit planner-subagent-prompt.md + leak-grep scope** (captured 2026-05-11)
  - `$HOME/.claude/get-shit-done/templates/planner-subagent-prompt.md` still emits `<context>` blocks with `@.planning/*` refs, producing PLAN.md artifacts that trip the Phase 4 leak-gate
  - Every PLAN.md in this repo (03-01..05, 04-01..07, 05-01..07) was committed pre-hook or via `--no-verify`; 03-06 is the first to hit the gate and was manually stripped
  - Two-part fix: (a) rewrite the planner template to emit `<files_to_read>` inside `<objective>` instead of `<context>` auto-loads; (b) narrow `scripts/leak-grep.cjs` to skip `.planning/phases/**/*-PLAN.md` (these are generated artifacts, not skill-activated source)
  - Not blocking v1.0. Candidate for a standalone cleanup plan or Phase 7 scope when conformance-test-suite work touches leak-grep anyway
  - Ref: D-2026-05-10-OQ04 (partial resolution); SYNTHESIS §6 OQ-04

## Session Continuity

Last session: 2026-05-17T16:24:01.581Z
mid-session, Phase 3 UAT caught 2 more blocker bugs — all fixed)
Stopped at: Phase 8 context gathered
complete (4/4); `StateWriteOutcome` three-state contract DESIGNED but not
implemented (hit context budget). Tree clean at 5d3e05f3.

Uncommitted: none.

Next action (decision needed): Either (a) land the `StateWriteOutcome`
contract refactor as a Phase 3.1 gap plan (30–45 min; clean target for
BeadsAdapter from day one), or (b) fold it into Phase 6 interface design.
See HANDOFF.json `human_actions_pending[0]`.

Note: ROADMAP.md line 31 still shows `[ ] Phase 5` — stale; the phase
shipped (commit 9656d25a) with all 7 plans `[x]` at lines 148–166.
Flip the phase-level checkbox before Phase 6 kickoff.

Sibling repo state: `gsd-beads` v0.2 milestone is superseded; v1.0
Phase 6 (BeadsAdapter) is now unblocked.

## Performance Metrics

| Phase/Plan | Duration | Tasks | Files |
|-----------|----------|-------|-------|
| Phase 06 P02 | 25 | 3 tasks | 13 files |
| Phase 06 P05 | 13 | 3 tasks | 11 files |
| Phase 06 P06 | 46m | 3 tasks | 9 files |
| Phase 06 P07 | 38m | 4 tasks | 16 files |
