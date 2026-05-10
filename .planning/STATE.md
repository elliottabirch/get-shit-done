---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 5 context gathered
last_updated: "2026-05-10T21:00:23.743Z"
last_activity: 2026-05-10 -- Phase 05 execution started
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 29
  completed_plans: 26
  percent: 90
---

# Project State

## Current Position

Phase: 05 (foundational-primitive-lift) — EXECUTING
Plan: 6 of 7 complete (Waves 5 + 6 merged)
Status: Executing Phase 05 — Wave 7 (Plan 05-07, final) next
Last activity: 2026-05-10 -- Wave 6 (Plan 05-06) complete

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

(none — fresh repo)

## Session Continuity

Last session: 2026-05-10T21:00:23.743Z
Stopped at: Wave 5 (Plan 05-05) and Wave 6 (Plan 05-06) merged;
Phase 5 at 6/7 plans complete. Plan 05-07 (final wave — 5 ADRs for
OQ-02/05/07/10 + shadow-dir journal + Phase 5 exit checkpoint) is the
only remaining work in Phase 5.

Uncommitted: `sdk/src/query/route-next-action.ts` has a JSDoc-only
addition around `toAdapterDir` — low-risk, unrelated to Plan 05-07.

Next action: Execute Plan 05-07 via `/gsd-execute-phase 5` to close out
Phase 5. After Phase 5 ships, unblocks sibling repo `gsd-beads` v1.0
Phase 6 (BeadsAdapter implementation) per SYNTHESIS §9 high-severity
dry-run risk.

Sibling repo state: `gsd-beads` v0.2 milestone is superseded; v1.0
Phase 6 activates once this repo's Phase 5 ships.
