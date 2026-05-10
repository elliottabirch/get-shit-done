---
phase: 05-foundational-primitive-lift
plan: 01
subsystem: adapter-interface
tags: [storage-adapter, typescript, vitest, named-doc, discriminated-overloads, wave-0-scaffolds]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: StorageAdapter interface + Capabilities shape + UnsupportedCapabilityError + companion type guards (adapters/types.ts)
provides:
  - NamedDocCategory closed union (8 members) exported from adapters/types.ts
  - RootNamedDocKey literal union (3 keys) exported from adapters/types.ts
  - putNamedDoc/getNamedDoc discriminated overload signatures on StorageAdapter ('root' category narrows key to RootNamedDocKey)
  - Wave 0 failing-test scaffolds (5 new files, 28 it.todo placeholders) for PRIMITIVES-01/02/04/05/08/09
affects:
  - 05-02 (section-depth walker) — consumes section-depth.test.ts scaffold
  - 05-03 (transaction hardening) — runs under same tsc/vitest contract
  - 05-04 (named-doc + binary-asset lift) — consumes named-doc.test.ts + binary-asset.test.ts scaffolds; imports NamedDocCategory/RootNamedDocKey
  - 05-05 (SDK sidecar + scratch verbs) — consumes sidecar.test.ts + scratch.test.ts scaffolds

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-overload pattern on adapter methods: 'root' category compile-time narrows key parameter to RootNamedDocKey via two overloads + Exclude<NamedDocCategory, 'root'> for the general case"
    - "Closed typed-union export for adapter-level string discriminators (D-13 gate against typo drift)"
    - "Wave 0 test-scaffold convention: one describe per file, it.todo placeholders only, tmpdir+MarkdownAdapter harness matching tests/conformance/write-transaction.test.ts:7-27"

key-files:
  created:
    - tests/conformance/section-depth.test.ts
    - tests/conformance/named-doc.test.ts
    - tests/conformance/binary-asset.test.ts
    - sdk/src/query/sidecar.test.ts
    - sdk/src/query/scratch.test.ts
  modified:
    - adapters/types.ts
    - adapters/types.test.ts
    - adapters/vitest.config.ts

key-decisions:
  - "D-13 realized: NamedDocCategory is a closed 8-member string union — adding a category is a breaking interface change, which is the intended typo-drift gate"
  - "D-14 realized: RootNamedDocKey (3 keys) + discriminated overload pair on putNamedDoc/getNamedDoc — arbitrary string keys for 'root' category rejected at compile time, verified by live @ts-expect-error in adapters/types.test.ts"
  - "Rule 3 (blocking) deviation: adapters/vitest.config.ts include pattern extended to pick up types.test.ts (was 'markdown/**/*.test.ts' only) so the new D-13/D-14 runtime describe block executes under the existing adapters vitest project"
  - "Zero touches to adapters/markdown/index.ts — preserves wave serialization contract; capability flags (binaryAsset/snapshot/namedDoc) remain at pre-Phase-5 values (false)"

patterns-established:
  - "Discriminated adapter-method overloads: pair of signatures with a literal discriminator parameter that narrows a sibling parameter's type (see putNamedDoc/getNamedDoc)"
  - "Wave 0 failing-scaffold convention for Nyquist gating: downstream implementation plans flip it.todo → it(...) rather than creating new test files"

requirements-completed: [PRIMITIVES-04]

# Metrics
duration: ~22min
completed: 2026-05-10
---

# Phase 5 Plan 01: Foundational primitive types + Wave 0 test scaffolds Summary

**Locked NamedDocCategory (8 members) and RootNamedDocKey (3 keys) typed unions on the StorageAdapter interface with discriminated put/getNamedDoc overloads, and stood up 5 Wave 0 test scaffolds (28 it.todo placeholders) as failing targets for Plans 02/04/05.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-05-10T19:53Z (phase state entry)
- **Completed:** 2026-05-10T20:12Z
- **Tasks:** 2 / 2
- **Files modified:** 3 (adapters/types.ts, adapters/types.test.ts, adapters/vitest.config.ts)
- **Files created:** 5 (Wave 0 scaffolds)

## Accomplishments
- `adapters/types.ts` now exports `NamedDocCategory` (8-member closed union per D-13) and `RootNamedDocKey` (3-key literal union per D-14)
- `putNamedDoc`/`getNamedDoc` replaced with a 4-line discriminated overload pair: `'root'` category narrows the `key` parameter to `RootNamedDocKey` at compile time; the `Exclude<NamedDocCategory, 'root'>` overload accepts any string key for the remaining 7 categories
- `adapters/types.test.ts` extended with a runtime `describe('NamedDocCategory / RootNamedDocKey (D-13/D-14)')` block covering the 8 category values, the 3 root keys, and a live `@ts-expect-error` negative asserting that `putNamedDoc('root', 'ARBITRARY_STRING', 'body')` is rejected at compile time
- 5 Wave 0 test scaffold files created with the tmpdir + MarkdownAdapter harness pattern; each contains exactly one `describe` and only `it.todo` placeholders (no live tests), totaling 28 todos across the 5 files
- Zero changes to `adapters/markdown/index.ts` (verified `git diff ea467198..HEAD -- adapters/markdown/index.ts` is empty) — preserves Plans 02/03/04 wave serialization
- Zero capability-flag flips — `capabilities.namedDoc`/`capabilities.binaryAsset` remain at their pre-Phase-5 values (that is Plans 03/04's job)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add NamedDocCategory/RootNamedDocKey + discriminated overloads** — `13e04307` (feat)
2. **Task 2: Create Wave 0 test scaffolds (5 files)** — `42340c0a` (test)

## Files Created/Modified

### Created
- `tests/conformance/section-depth.test.ts` — 10 it.todo placeholders (PRIMITIVES-01/02, SC#2). Covers L2/L3/L4 anchors, document-order first-match (D-07), fenced-code + HTML-comment immunity (D-08), setext warn, three-author concurrency (SC#2).
- `tests/conformance/named-doc.test.ts` — 8 it.todo placeholders (PRIMITIVES-04). Covers 8-category round-trip, 3 root-key writes, null-on-miss, capability flip, D-14 compile-time negative, D-15 grep-zero.
- `tests/conformance/binary-asset.test.ts` — 3 it.todo placeholders (PRIMITIVES-05). Covers byte-verbatim readback, capability flip, graceful-degradation monkeypatch (D-18).
- `sdk/src/query/sidecar.test.ts` — 3 it.todo placeholders (PRIMITIVES-08). Covers nextCallCountGet default 0, 0→1→2 increment, route-next-action.ts grep-zero.
- `sdk/src/query/scratch.test.ts` — 4 it.todo placeholders (PRIMITIVES-09). Covers discuss.checkpoint round-trip, delete, discuss.questions round-trip (.json/.html), no-op delete.

### Modified
- `adapters/types.ts` — Added `NamedDocCategory` and `RootNamedDocKey` exports; replaced `putNamedDoc`/`getNamedDoc` single signatures with 4-line discriminated overload pair. Everything else untouched.
- `adapters/types.test.ts` — Added `describe`/`it`/`expect` imports from vitest plus type imports for `NamedDocCategory`/`RootNamedDocKey`; appended the D-13/D-14 describe block with 3 passing tests (including one `@ts-expect-error` assertion).
- `adapters/vitest.config.ts` — Extended `include` array to `['markdown/**/*.test.ts', 'types.test.ts']` so the new runtime describe runs under the adapters vitest project. (Rule 3 deviation — see below.)

## Decisions Made
- Followed the plan's D-13/D-14 decisions verbatim (union members, overload shape, @ts-expect-error negative test). No new architectural decisions.
- Chose to extend the existing `adapters/types.test.ts` with the D-13/D-14 describe rather than creating a sibling `named-doc-types.test.ts`, matching the plan's `<action>` instruction (step 4: "Append a new describe block to adapters/types.test.ts…").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended `adapters/vitest.config.ts` include pattern to pick up `types.test.ts`**
- **Found during:** Task 1 verification
- **Issue:** The plan's acceptance criterion requires `cd adapters && npx vitest run types.test.ts` to pass, but the pre-existing `adapters/vitest.config.ts` set `include: ['markdown/**/*.test.ts']` with a comment stating "types.test.ts is a compile-time-only type assertion file (no vitest describe/it blocks)". The plan's Task 1 step 4 appends a real `describe`/`it` block to `types.test.ts`, so the include pattern had to be widened or the acceptance command would report "No test files found".
- **Fix:** Changed `include` to `['markdown/**/*.test.ts', 'types.test.ts']` and updated the neighboring comment to document the Phase 5 Plan 01 change.
- **Files modified:** `adapters/vitest.config.ts`
- **Verification:** `cd adapters && vitest run --config vitest.config.ts types.test.ts` now reports `Test Files 1 passed (1) / Tests 3 passed (3)`.
- **Committed in:** `13e04307` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking).
**Impact on plan:** Deviation was necessary to satisfy the plan's own acceptance command. No scope creep — the change is one line in the include array plus a comment refresh; no behavior change, no new test files introduced beyond the 5 listed in `files_modified`.

## Issues Encountered
- The worktree had no local `node_modules` installed. Symlinked `sdk/node_modules` from the main repo into `.claude/worktrees/agent-a5dcc4c2b99c79013/sdk/node_modules` and `…/node_modules` (worktree root) so the main-repo-installed `tsc` + `vitest` binaries could resolve their packages. Both symlinks are untracked (still appear as `??` in `git status`); no files committed that depend on them. They exist only for verification during execution and will disappear when the worktree is torn down.
- Pre-existing adapter suite failures (`markdown/index.test.ts > MarkdownAdapter > capabilities shape matches locked contract` and `readModifyWriteRoadmapMd does not throw`) persist; they are caused by a `MODULE_NOT_FOUND` on `~/.claude/get-shit-done/bin/lib/model-catalog.cjs` when the markdown adapter transitively loads `core.cjs`. This is unrelated to this plan's scope (Task 1 only touches `types.ts`/`types.test.ts`; Task 2 only adds new scaffold files). Deferred — not logged to `deferred-items.md` since this is cross-cutting infra not in the Phase 5 scope.

## Verification Log

- **V1** `cd adapters && tsc --noEmit -p tsconfig.json` → exit 0, zero errors.
- **V2** `cd adapters && vitest run types.test.ts` → `Test Files 1 passed (1) / Tests 3 passed (3)` (8-member array, 3-key array, @ts-expect-error negative).
- **V3** `vitest run --config vitest.conformance.config.ts tests/conformance/section-depth.test.ts tests/conformance/named-doc.test.ts tests/conformance/binary-asset.test.ts` → `Test Files 3 skipped (3) / Tests 21 todo (21)` (all todos counted as passing, 0 failing).
- **V4** `cd sdk && vitest run src/query/sidecar.test.ts src/query/scratch.test.ts` → `Test Files 2 skipped (2) / Tests 7 todo (7)` (all passing/todo).
- **V5** `grep -c "it\.todo(" tests/conformance/section-depth.test.ts` → 10 (≥ 10 required).
- **Grep acceptance (Task 1):** NamedDocCategory=1, RootNamedDocKey=1, `category: 'root'`=2, `Exclude<NamedDocCategory, 'root'>`=2, `@ts-expect-error`=2 (≥1 required), `namedDoc: boolean`=1 (Capabilities unchanged).
- **Grep acceptance (Task 2):** `it.todo` per file: 10, 8, 3, 3, 4; live `it(...)` across all 5 files: 0; `mkdir(join(tmpDir, '.planning'` per file: 1 each; describe per file: 1 each.
- **SC (markdown/index.ts untouched):** `git diff ea467198..HEAD -- adapters/markdown/index.ts` returns 0 lines.

## User Setup Required

None — no external service configuration required.

## Next Plan Readiness
- **Plan 05-02 (section-depth walker):** `tests/conformance/section-depth.test.ts` in place with 10 it.todo placeholders covering every PRIMITIVES-01/02 test case the validation matrix calls for. Plan 02 flips todos to live `it(...)` tests and implements the heading-depth walker in `adapters/markdown/index.ts`.
- **Plan 05-04 (named-doc + binary-asset lift):** Typed interface contract is locked — Plan 04 implements `putNamedDoc`/`getNamedDoc` + `writeBinaryAsset` in `adapters/markdown/index.ts`, flips `capabilities.namedDoc`/`capabilities.binaryAsset` to `true`, and lifts the 11 todos across `named-doc.test.ts` + `binary-asset.test.ts` to live tests. `NamedDocCategory`/`RootNamedDocKey` imports are already exercised by the scaffolds so typos show up at compile time.
- **Plan 05-05 (SDK sidecar + scratch):** `sdk/src/query/sidecar.test.ts` and `…/scratch.test.ts` scaffolds exist with 7 it.todo placeholders tagged to D-19/D-20/D-21. Plan 05 creates `sidecar.ts` and `scratch.ts` and flips todos to live tests.
- **Wave serialization preserved:** Zero writes to `adapters/markdown/index.ts`. Plans 03/04 in later waves can serialize their edits to that file without conflict from Plan 01.

## Self-Check: PASSED

- `adapters/types.ts` — FOUND (modified; exports NamedDocCategory + RootNamedDocKey; overloads in place)
- `adapters/types.test.ts` — FOUND (modified; D-13/D-14 describe added)
- `adapters/vitest.config.ts` — FOUND (modified; include extended)
- `tests/conformance/section-depth.test.ts` — FOUND (created)
- `tests/conformance/named-doc.test.ts` — FOUND (created)
- `tests/conformance/binary-asset.test.ts` — FOUND (created)
- `sdk/src/query/sidecar.test.ts` — FOUND (created)
- `sdk/src/query/scratch.test.ts` — FOUND (created)
- Commit `13e04307` — FOUND in `git log`
- Commit `42340c0a` — FOUND in `git log`

---
*Phase: 05-foundational-primitive-lift*
*Plan: 01*
*Completed: 2026-05-10*
