---
phase: 06-beadsadapter-implementation
plan: 04
subsystem: beads-adapter-format-substrate
tags: [port, typescript, format-modules, path-router, per-canonical-schemas, d-mapping-outcome-a]
requires: [06-02, 06-03]
provides:
  - format-phase-ts
  - format-section-ts
  - format-frontmatter-ts
  - format-state-ts
  - paths-ts-router
  - per-canonical-file-schemas-12
  - cr-02-hybrid-tier-deleted
  - d-mapping-outcome-a-schemas-landed
affects:
  - gsd-beads/src/format/
  - gsd-beads/src/paths.ts
  - gsd-beads/tests/unit/
  - fork/.planning/phases/06-beadsadapter-implementation/
tech-stack:
  added: [js-yaml@4.1.1]
  patterns:
    - parse-format-idempotency-contract
    - code-fence-guard
    - closed-enum-routing
    - discriminated-union-kind-tags
    - per-canonical-schema-dispatch
key-files:
  created:
    - /Volumes/code/gsd-beads/src/format/phase.ts
    - /Volumes/code/gsd-beads/src/format/section.ts
    - /Volumes/code/gsd-beads/src/format/frontmatter.ts
    - /Volumes/code/gsd-beads/src/format/state.ts
    - /Volumes/code/gsd-beads/src/paths.ts
    - /Volumes/code/gsd-beads/src/format/schemas/index.ts
    - /Volumes/code/gsd-beads/src/format/schemas/roadmap.ts
    - /Volumes/code/gsd-beads/src/format/schemas/project.ts
    - /Volumes/code/gsd-beads/src/format/schemas/requirements.ts
    - /Volumes/code/gsd-beads/src/format/schemas/decisions.ts
    - /Volumes/code/gsd-beads/src/format/schemas/ai-spec.ts
    - /Volumes/code/gsd-beads/src/format/schemas/spec.ts
    - /Volumes/code/gsd-beads/src/format/schemas/uat.ts
    - /Volumes/code/gsd-beads/src/format/schemas/verification.ts
    - /Volumes/code/gsd-beads/src/format/schemas/plan.ts
    - /Volumes/code/gsd-beads/src/format/schemas/context.ts
    - /Volumes/code/gsd-beads/src/format/schemas/debug-session.ts
    - /Volumes/code/gsd-beads/tests/unit/format-phase.test.ts
    - /Volumes/code/gsd-beads/tests/unit/format-section.test.ts
    - /Volumes/code/gsd-beads/tests/unit/format-frontmatter.test.ts
    - /Volumes/code/gsd-beads/tests/unit/format-state.test.ts
    - /Volumes/code/gsd-beads/tests/unit/paths.test.ts
    - /Volumes/code/get-shit-done/.planning/phases/06-beadsadapter-implementation/06-04-SCHEMA-DECISION.md
  modified:
    - /Volumes/code/gsd-beads/package.json
    - /Volumes/code/gsd-beads/package-lock.json
  removed:
    - /Volumes/code/gsd-beads/src/format/phase.mjs
    - /Volumes/code/gsd-beads/src/format/section.mjs
    - /Volumes/code/gsd-beads/src/format/frontmatter.mjs
    - /Volumes/code/gsd-beads/src/adapter/pathRouter.mjs
    - /Volumes/code/gsd-beads/src/adapter/ (empty dir)
decisions:
  - "js-yaml@4.1.1 escalated for frontmatter parser (fork corpus has nested-object frontmatter — PLAN.md must_haves.truths + artifacts maps-inside-lists)"
  - "CR-02 hybrid tier DELETED entirely (paths.ts Tier = 'bd' | 'disk' only; named-docs disk-tier with post-write bd-memory index side-effect in Plan 06-05)"
  - "D-MAPPING Outcome A landed: 12 per-canonical-file TS schemas under src/format/ + src/format/schemas/"
  - "state.ts ships FULL parseState + formatState bodies this plan (B6 revision; no TODO markers); Plan 06-06 CONSUMES, does NOT extend"
  - "paths.ts accepts .planning/-relative paths (fork convention per types.ts D-04); defensive prefix-strip for sibling-style interop"
  - "slash-anchor locateSection bypassed in state.ts (full-path-from-H1 constraint unsuitable for event-log use-case); state.ts uses exact heading-text match + level-aware sibling detection"
metrics:
  duration_seconds: ~1800
  completed: "2026-05-11T18:12:00Z"
  tasks_completed: 4
  tasks_total: 4
  files_created: 23
  files_removed: 4
---

# Phase 6 Plan 04: Port format modules + paths.ts + per-canonical-file schemas (D-MAPPING Outcome A) Summary

TypeScript port of sibling gsd-beads' 4 format/paths substrate modules
(phase.mjs / section.mjs / frontmatter.mjs / pathRouter.mjs) landed with
fork-specific amendments (NamedDocCategory alignment, CR-02 hybrid-tier
deletion); state.ts authored with FULL parseState/formatState bodies;
11 additional per-canonical-file schemas shipped for D-MAPPING Outcome A.

## What Landed

### Task 1 — `src/format/phase.ts` (gsd-beads commits `bff5aa5` + `6e63667`)

- 243 LOC TS port of sibling 251-LOC `phase.mjs` — regex triplet
  (TITLE_RE / LABEL_RE / TAIL_RE / SC_ITEM_RE) preserved verbatim.
- 4 exports: `parsePhaseTitle`, `formatPhaseTitle`,
  `parsePhaseDescription`, `formatPhaseDescription`.
- D-15 idempotency contract `parse(format(parse(x))) === parse(x)` proven
  on 3 fixtures (minimal / mixed label style / multi-line continuation).
- D-16 opaque-tail handling preserved (everything after Success Criteria
  round-trips byte-equal modulo trailing whitespace).
- 9 unit tests green.

### Task 2 — `src/format/section.ts` + `src/format/frontmatter.ts` (gsd-beads commits `3302cce` + `44c4b28`)

- `section.ts` (142 LOC): slugify + locateSection + rewriteSection;
  code-fence guard preserved via `inFence` boolean across heading scans
  (sibling's load-bearing Pitfall-8 defense). 3 exports + typed
  `SectionMode` union + `SectionLocation` interface.
- `frontmatter.ts` (104 LOC): **ESCALATED to js-yaml@4.1.1** per corpus
  scan finding nested-object frontmatter throughout fork's `.planning/`
  (PLAN.md `must_haves.truths: [...]` + `artifacts: - path: / provides:`
  maps-inside-lists). Hand-roll flat-scalar parser would silently drop
  every nested key (WR-02/WR-03 class bug). 3 exports preserved:
  `parseFrontmatter`, `formatFrontmatter`, `mergeFrontmatter`.
- 27 unit tests green (15 section + 12 frontmatter).

### Task 3 — `src/paths.ts` (gsd-beads commits `c737fc4` + `53d10c6`)

- 235 LOC TS port of sibling 97-LOC `pathRouter.mjs`. Flat top-level
  filename (D-SCAFFOLD whitelist) — flattened from `src/adapter/`.
- **NamedDocCategory aligned with fork (types.ts:15-23)**:
  removed sibling-specific `debug-knowledge-base` / `learnings` /
  `methodology` / `discussion-log` / `discovery`; added `reports` /
  `sketches` / `tmp` / `root`. 8-entry closed union frozen.
- **CR-02 BLOCKER resolved — `'hybrid'` tier deleted entirely.**
  `Tier = 'bd' | 'disk'` only. Named-docs route to `'disk'`;
  BeadsAdapter.putNamedDoc (Plan 06-05) handles bd-memory index as a
  post-write side-effect, not a tier indirection.
- Accepts `.planning/`-relative paths (fork convention per D-04); strips
  optional `.planning/` and `./` prefixes defensively.
- Typed `RouteKind` discriminated union (16 kinds); typed `Route` interface.
- 30 unit tests green, including CR-02 sweep invariant (every
  representative path returns tier ∈ {bd, disk}).

### Task 4 — D-MAPPING Outcome A: 12 per-canonical-file schemas (gsd-beads commit `e6b0909`, fork commit `eddf98a8`)

- **Full parser pair:**
  - `src/format/state.ts` (256 LOC) — `parseState` + `formatState` with
    FULL BODIES shipped this plan (B6 revision — 0 TODO/EXECUTOR/FIXME
    markers). Generic event-log line shape
    `- **<type>** (<ISO-date>): <JSON-payload>`
    for Append / Mutation / Signal event sections. 9 smoke tests green.
  - `src/format/phase.ts` — already landed Task 1.
- **Typed declaration + purpose-built parser:**
  - `src/format/schemas/requirements.ts` — `parseRequirementsBody`
    (categorized checkbox parser).
- **Typed declaration (re-export of phase.ts):**
  - `src/format/schemas/roadmap.ts`.
- **Type-only schemas (rely on generic `section.ts` + `frontmatter.ts`):**
  - `project.ts`, `decisions.ts`, `ai-spec.ts`, `spec.ts`, `uat.ts`,
    `verification.ts`, `plan.ts`, `context.ts`, `debug-session.ts`.
- Barrel `src/format/schemas/index.ts` re-exports all + pulls in
  state.ts's `parseState`/`formatState`/`ParsedState`/`EventRecord`.
- Schema decision record at fork-side
  `.planning/phases/06-beadsadapter-implementation/06-04-SCHEMA-DECISION.md`.

## Metrics

- **Files created:** 23 (4 format TS ports + 11 schemas + 1 barrel + 5
  unit test files + 1 decision record + phase.ts already counted).
- **Files removed:** 4 (`.mjs` originals) + 1 empty `src/adapter/` dir.
- **Tests added:** 75 green across 5 unit test files.
- **Lines added:** ~808 (schemas + state.ts) + ~408 (section + fm +
  tests) + ~423 (paths.ts + tests) + ~147 (phase.ts tests) = ~1,786.
- **tsc --noEmit:** 0 errors on final build.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical Functionality] Frontmatter parser escalation forced to js-yaml**
- **Found during:** Task 2 corpus scan
- **Issue:** Plan Path A (hand-roll preservation) would silently drop
  every nested-object frontmatter key in fork's `.planning/` corpus.
  PLAN.md files universally use `must_haves.truths: [...]` and
  `artifacts: - path: ... provides: ...` nested structures. Hand-roll's
  `/^([A-Za-z_][\w-]*):\s*(.*)$/` regex + flat list-item logic only
  handles single-level indent.
- **Fix:** Installed `js-yaml@4.1.1` + `@types/js-yaml@4.0.9`
  (`js-yaml` as runtime `dependencies`, types as `devDependencies`).
  Preserved exported signatures so callers observe no change other
  than richer parsed data for nested inputs.
- **Files modified:** `src/format/frontmatter.ts`, `package.json`,
  `package-lock.json`.
- **Commit:** `44c4b28` (gsd-beads).
- **Plan alignment:** Plan's conditional Path-B escalation explicitly
  permitted this — the corpus scan triggered it.

**2. [Rule 1 — Bug] state.ts section lookup via `locateSection` failed on H1-less docs**
- **Found during:** Task 4 state.ts smoke test authoring
- **Issue:** section.ts's `locateSection` requires a full path-from-H1
  slug (e.g. `state/append-events`). STATE.md docs may or may not
  carry an H1 — locateSection's anchor semantics make it unsuitable
  for generic event-log section discovery.
- **Fix:** Added internal `findSectionRange` helper to state.ts that
  scans for exact heading-text match + level-aware sibling detection.
  Bypasses locateSection for this single use case; callers of
  section.ts for non-event sections retain the slash-anchor contract.
- **Files modified:** `src/format/state.ts`.
- **Commit:** included in `e6b0909` (gsd-beads).

## Authentication Gates

None. Plan fully autonomous; no CLI/network calls.

## TDD Gate Compliance

Plan `type: execute` (not `type: tdd`). TDD gate not applicable —
tests were authored alongside implementation per plan's `<action>`
directives (idempotency fixtures, code-fence guard, CR-02 invariant,
state-parse smoke). No plan-level RED/GREEN/REFACTOR ordering required.

## Commits

### gsd-beads (branch `feat/phase-6-reset`)

| Task | Hash      | Type     | Message                                                           |
| ---- | --------- | -------- | ----------------------------------------------------------------- |
| 1    | `bff5aa5` | refactor | git-mv src/format/phase.mjs → phase.ts (preserve --follow)        |
| 1    | `6e63667` | feat     | port format/phase.mjs → TS with idempotency test corpus           |
| 2    | `3302cce` | refactor | git-mv format/section + frontmatter → .ts (preserve --follow)     |
| 2    | `44c4b28` | feat     | port format/section + format/frontmatter to TS (js-yaml escalated) |
| 3    | `c737fc4` | refactor | git-mv src/adapter/pathRouter.mjs → src/paths.ts (flatten path)   |
| 3    | `53d10c6` | feat     | port pathRouter.mjs → src/paths.ts (CR-02 hybrid-tier deleted)    |
| 4    | `e6b0909` | feat     | per-canonical-file schemas for D-MAPPING Outcome A (12 files)     |

### fork (branch `feat/storage-adapter`)

| Hash       | Type | Message                                                      |
| ---------- | ---- | ------------------------------------------------------------ |
| `eddf98a8` | docs | schema scope decision record (D-MAPPING Outcome A)           |

## Handoff to Plan 06-05

Plan 06-05's Bin A primitives (`primitives.ts`) now have the full
parsing/routing substrate ready to consume:

- **`resolveRoute(path)` → typed `Route`** — Plan 06-05 opens every Bin A
  method with `const route = resolveRoute(path)` and dispatches on
  `route.kind` / `route.tier`. CR-02 hybrid-tier complications are gone.
- **`format/phase.ts`, `format/section.ts`, `format/frontmatter.ts`,
  `format/state.ts`** — Plan 06-05 `getRecord`/`putRecord` on canonical
  files parses via the appropriate module, applies the mutation, and
  re-emits. `getSection`/`updateSection` dispatches to `section.ts`'s
  locate+rewrite for all non-canonical paths.
- **`src/format/schemas/`** — Plan 06-05 can import the typed record
  shapes when it needs typed access (e.g. `RoadmapPhaseRecord`,
  `ParsedState`). For files addressed by `route.kind`, the schema
  type is the TS-level contract.
- **js-yaml dependency** — `package.json` now has `js-yaml@4.1.1` as a
  runtime dep. Plan 06-05's `getFrontmatter` / `updateFrontmatter` /
  `mergeFrontmatter` implementations use format/frontmatter.ts directly.

**Landmines still live (Plan 06-05 scope):**
- Landmine CR-01 (`_abs()` path-traversal) — owned by Plan 06-05.
  paths.ts intentionally does NOT defend against this (comment in
  `resolveRoute` JSDoc cites primitive-level `_abs()` as authoritative).

**Landmines retired this plan:**
- CR-02 (hybrid tier silent fall-through) — DELETED. Invariant test
  at `tests/unit/paths.test.ts > resolveRoute — CR-02 invariant (no
  hybrid tier)` guarantees no regression.

## Self-Check: PASSED

### Files

- FOUND: /Volumes/code/gsd-beads/src/format/phase.ts
- FOUND: /Volumes/code/gsd-beads/src/format/section.ts
- FOUND: /Volumes/code/gsd-beads/src/format/frontmatter.ts
- FOUND: /Volumes/code/gsd-beads/src/format/state.ts
- FOUND: /Volumes/code/gsd-beads/src/paths.ts
- FOUND: /Volumes/code/gsd-beads/src/format/schemas/index.ts (+ 11 peer schemas)
- FOUND: /Volumes/code/gsd-beads/tests/unit/format-phase.test.ts
- FOUND: /Volumes/code/gsd-beads/tests/unit/format-section.test.ts
- FOUND: /Volumes/code/gsd-beads/tests/unit/format-frontmatter.test.ts
- FOUND: /Volumes/code/gsd-beads/tests/unit/format-state.test.ts
- FOUND: /Volumes/code/gsd-beads/tests/unit/paths.test.ts
- FOUND: /Volumes/code/get-shit-done/.planning/phases/06-beadsadapter-implementation/06-04-SCHEMA-DECISION.md

### Commits

- FOUND: `bff5aa5` (gsd-beads)
- FOUND: `6e63667` (gsd-beads)
- FOUND: `3302cce` (gsd-beads)
- FOUND: `44c4b28` (gsd-beads)
- FOUND: `c737fc4` (gsd-beads)
- FOUND: `53d10c6` (gsd-beads)
- FOUND: `e6b0909` (gsd-beads)
- FOUND: `eddf98a8` (fork)

### Verification block (from plan `<verification>`)

- PASSED: all 4 .mjs originals removed
- PASSED: all 4 .ts replacements present with substantive LOC
- PASSED: `npx tsc --noEmit` exits 0
- PASSED: all 75 unit tests green (format-phase, format-section,
  format-frontmatter, format-state, paths)
- PASSED: schema decision record present + cites Outcome A
- PASSED: CR-02 invariant (no live `tier: 'hybrid'` code; only comments
  documenting removal)
