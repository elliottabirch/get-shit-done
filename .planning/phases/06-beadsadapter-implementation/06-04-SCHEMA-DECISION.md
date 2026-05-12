# Plan 06-04 — Schema Scope Decision

**Date:** 2026-05-11
**Driver:** Plan 06-03 SPIKE-RESULTS §7 + D-2026-05-12-OQ06-MAPPING ADR
**D-MAPPING outcome:** **A** (LOCKED at Wave 2 via user confirmation per execution-context preamble)

## Scope

Authored **12 per-canonical-file schemas** under `/Volumes/code/gsd-beads/src/format/` + `src/format/schemas/`:

**Full parser pair (`parseX + formatX` bodies shipped this plan):**
- `src/format/phase.ts` — ROADMAP.md phase title + description (Task 1; 243 LOC)
- `src/format/state.ts` — STATE.md event-log sections (Task 4; 256 LOC; **NO TODO markers** per B6 revision)

**Typed declaration + purpose-built helper parser:**
- `src/format/schemas/requirements.ts` — REQUIREMENTS.md categorized checkbox parser (`parseRequirementsBody`)

**Typed declaration (re-export of phase.ts):**
- `src/format/schemas/roadmap.ts` — discriminated `RoadmapPhaseRecord` kind tag

**Type-only (rely on generic `section.ts` + `frontmatter.ts` parsing substrate):**
- `src/format/schemas/project.ts` — PROJECT.md
- `src/format/schemas/decisions.ts` — DECISIONS.md (append-only ADR log)
- `src/format/schemas/ai-spec.ts` — AI-SPEC.md (XML-tagged body opaque)
- `src/format/schemas/spec.ts` — SPEC.md
- `src/format/schemas/uat.ts` — `<phase>-UAT.md`
- `src/format/schemas/verification.ts` — `<phase>-VERIFICATION.md`
- `src/format/schemas/plan.ts` — `<phase>-<plan>-PLAN.md` (XML-tagged body opaque)
- `src/format/schemas/context.ts` — `<phase>-CONTEXT.md`
- `src/format/schemas/debug-session.ts` — debug-session docs (research/ or reports/)

Plus barrel at `src/format/schemas/index.ts` (re-exports every schema + `parseState`/`formatState`/`ParsedState`/`EventRecord` from `../state.ts`).

## Rationale

Each canonical file's L2-section structure is now explicit in TypeScript
(drift caught at type-check time, not masked by auto-derivation per
D-MAPPING-SCHEMA). The per-file schemas act as **contracts Plan 06-05
primitives dispatch against**: `resolveRoute(path).kind` maps to a schema
type, giving callers a typed record shape rather than `unknown`.

Pragmatic split drove the full-parser vs. type-only distinction: files
with non-trivial event/entry sequencing (STATE.md event log; ROADMAP.md
phase entries) get dedicated parsers. Files that are prose-with-L2-sections
(CONTEXT / SPEC / AI-SPEC / PROJECT / VERIFICATION) rely on `section.ts`
generic dispatch — the schema type declares the expected L2 shape; runtime
parsing is generic section lookup.

REQUIREMENTS.md sits in the middle: uniform checkbox-list structure makes
a purpose-built `parseRequirementsBody` simpler than stitching generic
parsers together, so we shipped it here rather than deferring.

## Consequences for Plan 06-05

- Bin A primitives (`getRecord`, `putRecord`, `getSection`, `updateSection`,
  `getFrontmatter`, etc.) dispatch on `resolveRoute(path).kind` and can
  therefore use the matching schema's record shape as a **TS guard type**
  (e.g. `RoadmapPhaseRecord`, `StateRecord` via `ParsedState`, etc.).
- `putRecord` on STATE.md uses `parseState → mutate → formatState`
  round-trip, guaranteeing the event-log line shape is preserved.
- `putRecord` on ROADMAP.md uses `parsePhaseTitle + parsePhaseDescription`
  for structured updates; generic updateSection for non-phase content.

## Consequences for Plan 06-06

- `recordStateAppend` / `recordStateMutation` / `recordStateSignal` bodies
  **consume `src/format/state.ts`** — they do NOT extend it. The plan has
  full parse/format bodies shipping today (B6 revision; no TODO scaffolds).
- D-TXN Outcome A (in-memory buffer, `capabilities.snapshot: false`) is
  compatible with state.ts: the parse/format pair is pure (no I/O), so
  an in-memory buffer can hold the mutated `ParsedState` across a
  transaction boundary without disk touching until commit.

## CR-02 Resolution (Landmines item 2) — carried in paths.ts (Task 3)

Not owned by this decision record, but cross-referenced here for
auditability: the `'hybrid'` tier was DELETED entirely. Named-docs
route to tier `'disk'`; BeadsAdapter.putNamedDoc (Plan 06-05) does
post-write bd-memory index as a side-effect, not a tier indirection.
See `/Volumes/code/gsd-beads/src/paths.ts` JSDoc + unit-test invariant
`tests/unit/paths.test.ts > resolveRoute — CR-02 invariant (no hybrid tier)`.
