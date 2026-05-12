---
phase: 07-conformance-test-suite
plan: "01"
subsystem: adapters/conformance
tags: [conformance, contract-extension, manifest, normalize, tdd]
dependency_graph:
  requires: []
  provides:
    - StorageAdapter.normalize() method signature (adapters/types.ts)
    - MarkdownAdapter.normalize() identity implementation
    - tests/conformance/manifest-types.ts (ManifestEntry, ExpectedOutcome, AdapterName)
    - tests/conformance/manifest.ts (CONFORMANCE_MANIFEST empty scaffold)
    - tests/conformance/test-registry.ts (registeredTests Set + assertFromManifest helper)
    - ADR D-2026-05-12-NORMALIZE in .planning/DECISIONS.md
  affects:
    - "All downstream plans: 07-02, 07-03, 07-04, 07-05, 07-06 (import from conformance scaffold)"
    - "gsd-beads Plan 07-03: must implement BeadsAdapter.normalize()"
tech_stack:
  added: []
  patterns:
    - "TDD RED/GREEN cycle for contract extension"
    - "Discriminated union types mirroring state-event-types.ts pattern"
    - "Module-scoped Set for test registration (vitest-version-agnostic)"
key_files:
  created:
    - tests/conformance/manifest-types.ts
    - tests/conformance/manifest.ts
    - tests/conformance/test-registry.ts
  modified:
    - adapters/types.ts
    - adapters/markdown/index.ts
    - adapters/markdown/index.test.ts
    - tests/conformance/tsconfig.json
    - .planning/DECISIONS.md
decisions:
  - "D-2026-05-12-NORMALIZE: StorageAdapter.normalize() additive contract (cites D-OQ06-CAPS precedent)"
  - "4-kind ManifestEntry discriminator: binB | section-tuple | noun-roundtrip | rollback (Appendix A)"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-12"
  tasks: 2
  files_changed: 8
---

# Phase 7 Plan 01: Normalize Contract Extension + Conformance Manifest Scaffold Summary

**One-liner:** Added `normalize(body, category?): string` to StorageAdapter interface with MarkdownAdapter identity impl, plus typed conformance manifest scaffold (manifest-types.ts + manifest.ts + test-registry.ts) and ADR D-2026-05-12-NORMALIZE documenting the 4-kind ManifestEntry discriminator.

## What Was Built

### Task 1: normalize() — TDD RED/GREEN

**TDD Gate Compliance:**
- RED commit `66d49aa4`: 4 failing tests in `describe('normalize (D-13 additive contract)')` — `adapter.normalize is not a function`
- GREEN commit `a9a0f4ba`: implementation passes all 4 tests; zero regressions in the pre-existing 17-test adapter suite

**Interface addition (`adapters/types.ts` line 128-147):**

```typescript
/**
 * D-13 (Phase 7, ADR D-2026-05-12-NORMALIZE):
 * Canonicalize body per the adapter's storage normalization.
 * MarkdownAdapter returns body unchanged (byte-preserving storage).
 * BeadsAdapter applies frontmatter round-trip via parseFrontmatter +
 * formatFrontmatter (js-yaml.dump normalizes quote style).
 * ...
 * Invariant: normalize(normalize(x)) === normalize(x) (idempotent).
 */
normalize(body: string, category?: string): string;
```

**MarkdownAdapter identity implementation (`adapters/markdown/index.ts` line 940-943):**

```typescript
/** D-13 (Phase 7): identity — MarkdownAdapter storage is byte-preserving. */
normalize(body: string, _category?: string): string {
  return body;
}
```

Inserted after `recordStateSignal()` and before the private `normalizeMd()` helper (no name conflict — `normalizeMd` is an internal content-shaping helper, NOT the StorageAdapter contract).

### Task 2: Conformance manifest scaffold

**`tests/conformance/manifest-types.ts`** — Pure type module; 4 outcome types:
- `StateOutcomeExpected` — mirrors `StateWriteOutcome` with per-adapter `null` relaxation for `created_section`
- `RollbackOutcomeExpected` — 3 variants including `incomplete-per-Deferred-04` for D-09 known-gap
- `RoundTripOutcomeExpected` — `normalize-modulo-equal` | `identity-equal`
- `ExpectedOutcome` = union of the three above
- `ManifestEntry` interface with `kind: 'binB' | 'section-tuple' | 'noun-roundtrip' | 'rollback'`

The 4th kind `'rollback'` is introduced here (not in CONTEXT.md D-06 which names only 3). This extension is documented in ADR Appendix A.

**`tests/conformance/manifest.ts`** — Typed const scaffold:
```typescript
export const CONFORMANCE_MANIFEST: readonly ManifestEntry[] = [] as const;
```
Empty array is intentional — entries land in Plans 07-04/05/06. Re-exports all manifest-types.ts types for consumer convenience.

**`tests/conformance/test-registry.ts`** — Registration pattern:
- `registeredTests: Set<string>` — module-scoped, test-code-owned state. No vitest-internal coupling.
- `manifestKey(adapterName, kind, entryName): string` — key format `${adapter}:${kind}:${name}`, shared between registration and meta-coverage
- `assertFromManifest(adapterName, entryName, kind, check)` — the single entry point for all paired assertions; adds key to registeredTests, looks up manifest entry, passes `entry.expected[adapterName]` to the check function

**Why test-code-owned Set (not vitest introspection):**
RESEARCH Pattern 3 specifically chose this over vitest's internal task graph because vitest's internals change across major versions (already changed between v2 and v3). A plain `Set<string>` is stable across any vitest upgrade.

**`tests/conformance/tsconfig.json`** — Added 3 new files to `include` array so `npm run build:conformance` picks them up. `build:conformance` runs `tsc -p tsconfig.json` which exits 0 (clean compile).

**`.planning/DECISIONS.md`** — Appended ADR `D-2026-05-12-NORMALIZE` with:
- Context, Decision, Rationale, Alternatives rejected, Consequences
- Appendix A: documents why `'rollback'` is the 4th kind (CONFORM-04 failure-injection outcomes per D-09/D-10/D-11)

## Deviations from Plan

None — plan executed exactly as written.

Note: `adapters/dist/` rebuild was needed to make tests pass (vitest resolves `./index.js` to the compiled dist, not the TypeScript source). This is a known build discipline requirement, not a deviation.

## TDD Gate Compliance

1. RED commit `66d49aa4` — `test(07-01): add failing normalize() D-13 tests (TDD RED)` — 4 tests fail with `adapter.normalize is not a function`
2. GREEN commit `a9a0f4ba` — `feat(07-01): add normalize() to StorageAdapter interface + MarkdownAdapter identity impl (TDD GREEN)` — 4 tests pass

## Forward Pointers

- **Plan 07-02** (meta-coverage + grep script gate): imports `CONFORMANCE_MANIFEST` from `./manifest.js` and `registeredTests` from `./test-registry.js` for the meta-coverage invariant test
- **Plan 07-03** (sibling-side): BeadsAdapter must implement `normalize()` by composing `parseFrontmatter → formatFrontmatter`; imports `normalize(body: string, category?: string): string` from the StorageAdapter interface
- **Plans 07-04/05/06** (manifest population): all three import from `./manifest-types.js` and append entries to `CONFORMANCE_MANIFEST`; every entry goes through `assertFromManifest` which registers with the `registeredTests` Set

## Self-Check

### Created files exist:
- [x] `tests/conformance/manifest-types.ts` exists
- [x] `tests/conformance/manifest.ts` exists
- [x] `tests/conformance/test-registry.ts` exists

### Modified files contain expected content:
- [x] `adapters/types.ts` contains `normalize(body: string` (1 match)
- [x] `adapters/markdown/index.ts` contains `normalize(body: string, _category` (1 match)
- [x] `.planning/DECISIONS.md` contains `D-2026-05-12-NORMALIZE` (1 match)

### Commits exist:
- [x] `66d49aa4` — TDD RED
- [x] `a9a0f4ba` — TDD GREEN
- [x] `0faa9088` — manifest scaffold + ADR

### Tests pass:
- [x] 4 normalize tests green in `adapters/markdown/index.test.ts`
- [x] 0 regressions (6 pre-existing failures unchanged)
- [x] `npm run build:conformance` exits 0

## Self-Check: PASSED
