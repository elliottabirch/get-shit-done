---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: StorageAdapter interface + MarkdownAdapter
status: planning
last_updated: "2026-04-30T22:51:01.850Z"
last_activity: 2026-04-30
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-30 — Milestone v1.0 started

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

## v1.0 milestone scope

8 phases per SYNTHESIS.md §7:

| # | Phase | Where |
|---|-------|-------|
| 1 | Fork bootstrap + StorageAdapter interface skeleton + MarkdownAdapter scaffold | this repo |
| 2 | Wire core read methods to adapter | this repo |
| 3 | Wire core write methods + `recordStateEvent` | this repo |
| 4 | Plug workflow leaks (top-10 + `<context>`-block class) | this repo |
| 5 | Foundational primitive lift | this repo |
| 6 | BeadsAdapter implementation | gsd-beads |
| 7 | Conformance test suite | both |
| 8 | Migration + distribution | both |

## Open questions deferred (from SYNTHESIS.md §6)

These are NOT blocking for Phase 1; resolved as relevant phases approach:

| ID | Question | Phase that decides |
|----|----------|-------------------|
| OQ-01 | `commitPlanningState` semantics across adapters | Phase 3 |
| OQ-02 | Section-scoped vs whole-file write granularity | Phase 5 |
| OQ-03 | 2 raw-git outliers (spec-phase, eval-review) | Phase 4 |
| OQ-04 | `<context>`-block leak mitigation strategy | Phase 4 |
| OQ-05 | Sidecar paths kv-vs-named | Phase 5 |
| OQ-06 | Knowledge-graph subsystem scope | Phase 5/6 |
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

(none — fresh repo)

## Session Continuity

Last session: 2026-04-30 — fork bootstrap session
Stopped at: `.planning/` initialized on `feat/storage-adapter` branch with
synthesis + decisions + project context.

Next action: in this repo, run `/gsd-new-milestone` to formalize v1.0,
then `/gsd-discuss-phase 1` for the fork bootstrap phase.

Sibling repo state: `gsd-beads` v0.2 milestone is superseded; v1.0
Phase 6 (BeadsAdapter implementation) waits for Phase 5 of this repo
to ship before activating.
