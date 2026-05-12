# Phase 7: Conformance test suite - Research

**Researched:** 2026-05-12
**Domain:** Paired conformance test suite + property-based round-trips +
failure-injection rollback across MarkdownAdapter (fork) and BeadsAdapter
(sibling) via a shared harness and authored manifest.
**Confidence:** HIGH on tool choices + wiring patterns. MEDIUM on a few
details (bd install CI idioms, meta-coverage runtime introspection) —
flagged inline.

## Summary

Phase 7 is enforcement, not discovery. All 14 decisions (D-01..D-14) are
locked in CONTEXT.md; this research answers the "how do we implement
each decision" questions the planner needs. Across ~12 targets:

- **Scaffolding:** fast-check v4.8.0 (verified current on npm registry
  2026-05-11) + `@fast-check/vitest` v0.4.1 for the adaptive time-budget
  helper. vitest `describe`/`it`/`it.each` drive the matrix. New
  `tests/conformance/manifest.ts`, `meta-coverage.test.ts`, `paired.test.ts`,
  `failure-injection.test.ts`, `properties.test.ts`, plus
  `arbitraries/*.ts` (12 files). `scripts/extract-section-anchors.mjs`
  greps `adapter.updateSection` / `adapter.getSection` call sites
  (currently mostly internal to MarkdownAdapter — first full audit will
  surface the real call graph).

- **Sibling side:** `src/testing/conformance-factory.ts` extracts the 71
  LOC factory from `tests/conformance.test.ts` (D-04, D-05). `./testing`
  subpath export resolving to `dist/testing/conformance-factory.js`.
  BeadsAdapter `normalize(body, category?)` composes
  `parseSection → formatSection` + `parseFrontmatter → formatFrontmatter`
  — both functions are already exported from `src/format/*.ts` verbatim.

- **Contract extension:** additive `normalize(body: string, category?:
  string): string` on `StorageAdapter` (D-13, ADR D-2026-05-12-NORMALIZE
  citing D-2026-05-12-OQ06-CAPS precedent). MarkdownAdapter returns body
  identity; BeadsAdapter composes the existing format-module round-trip.

- **Risk register:** (1) `bd --version >= 1.0.4` gate in CI; skip-with-
  warning local. (2) Meta-coverage needs either static AST walk of test
  files or a runtime hook on `describe` — both work; prefer runtime hook
  (simpler, no new dep). (3) adaptive time budget (D-14) needs
  `@fast-check/vitest` to integrate with vitest's own timeout — default
  vitest `testTimeout: 30_000` in `vitest.conformance.config.ts` is
  already < 60_000; raise to 90_000 for property tests specifically.

**Primary recommendation:** Structure Phase 7 as **6 plans × 4 waves**:
Wave 0 (manifest scaffold + meta-coverage + anchor grep script + normalize
contract extension, fork-only), Wave 1 (sibling testing export + sibling
normalize impl + fork devDep wire, bridges the repos), Wave 2
(paired harness invocation + MarkdownAdapter normalize + existing-16-case
migration to manifest shape, fork-only, depends on Wave 1), Wave 3
(arbitraries + property tests + failure-injection + bd CI step + ADR +
DECISIONS.md entry, fork-only). The sequencing guarantees no plan blocks
on an unfinished sibling export, and the normalize() seam lands before
the round-trip property tests need it.

## Architectural Responsibility Map

Phase 7 is a testing/tooling phase with a single additive contract change;
the fork is the authoritative CI surface (D-01). Tier assignments below
are about *where the code lives*, not tier in the traditional browser/
server sense.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Paired conformance invocation | Fork test tree (`tests/conformance/paired.test.ts`) | — | D-01: single authoritative CI gate; sibling's invocation is deleted per D-05. |
| Conformance manifest (typed const) | Fork test tree (`tests/conformance/manifest.ts`) | — | D-06: a hand-authored enumeration that lives near the tests it governs. |
| Meta-coverage test (bidirectional) | Fork test tree (`tests/conformance/meta-coverage.test.ts`) | — | D-06 consequence: the meta-test asserts `manifest ↔ describe` parity; has no business logic analog elsewhere. |
| Section-anchor extraction script | Fork scripts (`scripts/extract-section-anchors.mjs`) | — | D-08: CI tool; runs before vitest; not part of the runtime SDK. |
| BeadsAdapter factory | Sibling `src/testing/conformance-factory.ts` + `./testing` export | Fork test tree (consumer) | D-04: single source of truth for bd init discipline; fork imports. |
| `normalize()` on StorageAdapter | Fork contract (`adapters/types.ts`) | Both adapter impls | D-13: additive contract method. Impls live on each adapter side. |
| MarkdownAdapter `normalize` | Fork `adapters/markdown/index.ts` | — | Identity function `(b) => b`; single-line. |
| BeadsAdapter `normalize` | Sibling `src/index.ts` (method) | Sibling `src/format/*` (composition) | Reuses existing format modules; no new parsing code. |
| `bd export --json` rollback diff | Fork test helper (`tests/conformance/rollback-diff.ts`) | Sibling `dist/bd-runner` (for spawning `bd`) | D-11: diff logic lives fork-side; bd invocation uses sibling's shipped helper via its own public surface or a fresh spawn. |
| Property-based arbitraries | Fork test tree (`tests/conformance/arbitraries/*.ts`) | — | D-12: 12 noun arbitraries; one file per noun for clarity. |
| bd install step in CI | Fork CI workflow (`.github/workflows/*.yml` or equivalent) | — | D-03: CI gate + skip-with-warning local. |
| fast-check devDep | Fork `package.json` | — | D-12: test-only dev dependency. |
| `"gsd-beads": "file:../gsd-beads"` devDep | Fork `package.json` | — | D-02: single-line wire. Paired with `./testing` import. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

Every decision below is LOCKED — research THESE, do not explore
alternatives:

- **D-01 (Fork runs both adapters):** Paired suite runs both
  `runAdapterConformanceSuite('markdown', markdownFactory)` and
  `runAdapterConformanceSuite('beads', beadsFactory)` side-by-side in fork
  CI. Sibling CI keeps bd-primitive smoke/unit tests only; sibling's
  standalone conformance invocation is deleted.

- **D-02 (Wiring via `file:../gsd-beads` devDep):** Fork `package.json`
  gains `"gsd-beads": "file:../gsd-beads"` under `devDependencies`.
  Mirrors sibling's existing `"get-shit-done-cc": "file:../get-shit-done"`
  pattern. Requires local developers + CI runners to have
  `../gsd-beads` checked out alongside the fork.

- **D-03 (bd installed from release binary in CI):** Fork CI installs
  bd v1.0.4+ from release binary. `bd --version` probe runs before the
  paired suite. Paired tests skip-with-warning when bd is absent
  (developer convenience); paired tests fail when `bd < v1.0.4`.

- **D-04 (Sibling exports testing factory via `./testing` subpath):**
  Sibling `package.json` gains `"./testing"` in `exports` pointing at
  `dist/testing/conformance-factory.js`. Fork imports:
  `import { createBeadsAdapter } from 'gsd-beads/testing'`. Single
  source of truth for bd init discipline (Landmines 9 + 11).

- **D-05 (Sibling conformance deletion):** After fork paired suite proves
  equivalence, sibling deletes `tests/conformance.test.ts`. Sibling's
  `tests/smoke/` + `tests/unit/` + `tests/fixture.ts` stay — bd-primitive
  level coverage below the adapter surface.

- **D-06 (Authored conformance manifest):** Typed TS const
  `CONFORMANCE_MANIFEST` in `tests/conformance/manifest.ts`. Bidirectional
  meta-test asserts every manifest entry has a corresponding describe
  block AND no orphan describe blocks exist.

- **D-07 (Per-adapter `expected` annotation for deviations):** Documented
  adapter-specific deviations live in the manifest, not in skip comments.
  Paired-assertion helper reads the suite label and asserts that
  adapter's documented expected outcome. Third-party adapters MUST add
  their expectation rows.

- **D-08 (Section-tuple discovery via grep + dynamic-anchor gate):**
  Grep fork SDK + workflows for `adapter.(updateSection|getSection)\(...\)`
  call sites. String-literal anchors populate manifest automatically.
  Dynamic-anchor callers must be refactored to literals OR registered
  manually with a justification comment. Runtime trace instrumentation
  is REJECTED.

- **D-09 (Document known-gap; ship Phase 7):** BeadsAdapter's withTransaction
  Outcome A mid-commit-replay gap (Phase 6 Deferred-04, Deferred-05) is
  baked into the manifest as an `expected` deviation:
  `expected: { markdown: {rollback: 'byte-identical'}, beads:
  {rollback: 'incomplete-per-Deferred-04', adr: '...'} }`. Blocking
  Phase 7 on Outcome B/C is REJECTED.

- **D-10 (Failure injection = throw from inside withTransaction fn):**
  Test pattern: `await expect(adapter.withTransaction(async () => { ...
  throw new Error('boom'); })).rejects.toThrow('boom');` then assert
  byte-identity / record-identity. Adapter-internal hooks REJECTED.

- **D-11 (BeadsAdapter rollback check via `bd export --json` diff):**
  Pre-txn: capture `bd export --json` snapshot S1. Post-rollback: capture
  S2. Assert S1 === S2 modulo non-semantic metadata. MarkdownAdapter
  uses `.planning/`-tree byte-diff (SHA-256 per file + aggregate).

- **D-12 (fast-check with per-noun arbitraries):** 12 arbitraries —
  `arbPhase`, `arbPlan`, `arbSummary`, `arbUat`, `arbStateEvent`,
  `arbRoadmap`, `arbDecision`, `arbBlocker`, `arbDebugSession`,
  `arbProject`, `arbSpec`, `arbAiSpec`. Generative coverage; hand-written
  exhaustive per-noun is REJECTED.

- **D-13 (Adapter-exposed `normalize()` method — additive contract):**
  `normalize(body: string, category?: string): string` added to
  `StorageAdapter`. MarkdownAdapter returns body unchanged. BeadsAdapter
  composes `parseSection → formatSection` + `parseFrontmatter →
  formatFrontmatter`. ADR `D-2026-05-12-NORMALIZE` in DECISIONS.md cites
  the D-OQ06-CAPS precedent. Per-noun `recordEq` in tests-only REJECTED.

- **D-14 (Adaptive iteration budget):** `fast-check.assert(prop,
  { numRuns: Infinity, endOnFailure: true, interruptAfterTimeLimit:
  60_000 })` per noun per adapter. Uniform 100 iterations REJECTED;
  tiered CI/nightly REJECTED.

### Claude's Discretion

- **Plan count and wave structure.** Candidate waves: (1) manifest
  scaffold + meta-coverage + anchor grep; (2) normalize ADR +
  MarkdownAdapter + contract; (3) sibling `./testing` + BeadsAdapter
  normalize; (4) devDep + bd install + paired harness; (5) arbitraries
  + round-trip; (6) failure-injection + rollback diff + known-gap
  manifest entries. 4–6 plans recommended.
- **Manifest file organization.** Single `manifest.ts` vs split per kind.
  Single-file simpler until grep-extracted section tuples push
  LOC > 500.
- **Arbitrary depth for fast-check.** Default shrinking vs explicit
  `fc.option.fc.maxLength(...)` caps per noun. Keep shrinking outputs
  under 100 lines for readability.
- **bd install CI step shape.** Install-on-every-job vs cached binary
  vs install-once-per-matrix.
- **Sibling `./testing` export path.** `dist/testing/index.js` vs
  `dist/testing/conformance-factory.js`. Sibling planner's call.
- **Snapshot metadata exclusions for BeadsAdapter diff.** Strip nothing
  (conservative) vs strip known-volatile fields (aggressive).
- **Fast-check version pin policy.** `^4` minor updates vs `~4.8.0`
  tight pin. Low-risk dev dep; `^4` is fine.
- **Section-tuple grep implementation language.** Shell vs node vs TS;
  TS via `tsx` integrates cleanly with the rest.
- **BeadsAdapter normalize() internal composition** — sibling planner's
  call (but the research below shows the exact composition shape).

### Deferred Ideas (OUT OF SCOPE)

- **Phase 6.1 withTransaction Outcome B or C rescue** — Phase 6 Deferred-04
  follow-up if Phase 7 paired testing reveals the Outcome A gap is worse
  than estimated. Not blocking v1.0.
- **Property-test arbitrary for new nouns** — future phase responsibility;
  meta-test enforces the CI gate.
- **Conformance package publication** (`@gsd/conformance` / `get-shit-
  done-conformance`) — external adapter author future.
- **Dynamic-anchor refactor sweep** — CI gate first surfaces call sites;
  follow-up judgment whether to refactor in Phase 7 scope or separate.
- **Runtime trace instrumentation for drift detection** — fallback if
  grep misses enough dynamic-composition cases.
- **Cross-repo PR triggering for sibling** — ceremony cost deferred
  until sibling PR feedback becomes painful.
- **Migration-tool normalize() usage (Phase 8 DIST-02)** — Phase 7 ships
  the method, Phase 8 consumes it.
- **bd perf regression dashboard** — post-v1.0 tooling.
- **Wider per-noun coverage beyond noun catalog** — meta-test gate
  handles on the day new nouns land.
- **Golden-test parity matrix (#2909)** — Phase 8 DIST-04.
- **Systemic: retrofit `planner-subagent-prompt.md` + leak-grep scope** —
  planner template `<context>` blocks tripping leak-gate; leak-grep
  should skip `.planning/phases/**/*-PLAN.md`. Phase 7 candidate but
  planner's call based on scope inflation.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONFORM-01 | Every Bin B method has a paired conformance test that runs against both MarkdownAdapter and BeadsAdapter and asserts equivalent outcomes | D-06 manifest + D-07 per-adapter expected + Wave 2 paired.test.ts. Meta-coverage test (§9 below) enforces `manifest ↔ describe` bidirectionality. Existing ~2766 LOC of MarkdownAdapter-only conformance stays; paired invocation runs both adapters through the same factory. |
| CONFORM-02 | Property-based round-trip tests for all record types in the noun catalog (12 nouns; CI gate on new nouns) | D-12 fast-check per-noun arbitraries + D-13 normalize() contract + D-14 adaptive time budget. Arbitraries in `tests/conformance/arbitraries/*.ts`. Property `adapter.getRecord(path) === adapter.normalize(putBody)` holds per adapter. §3 below gives the full noun→schema→arbitrary-shape table. Meta-test doubles as the CI gate: a new noun without a manifest entry fails the bidirectional check. |
| CONFORM-03 | Section-scoped semantics (append/overwrite/prepend) defined and tested per (record-type, section-id) tuple; harness rejects adapters lacking semantic for any tuple | D-06 manifest section-tuple subset + D-08 grep-extraction + dynamic-anchor gate. §2 below picks `ripgrep` + `scripts/extract-section-anchors.mjs` (node-tsx run from `npm test`). Any manifest entry whose `expected.<adapterName>` is missing fails meta-coverage; this is how the harness rejects incomplete adapters. |
| CONFORM-04 | Dry-run primitive correctness verified via deliberate failure injection mid-transaction | D-09 known-gap documented + D-10 throw-in-fn + D-11 `bd export --json` diff. §5 below gives the concrete strip pass for non-semantic metadata. BeadsAdapter's Outcome A gap is baked into the manifest as `expected.beads.rollback === 'incomplete-per-Deferred-04'`; CONFORM-04 "passes" for BeadsAdapter means the test asserts the documented gap, not a rollback-identity. |

## Project Constraints (from CLAUDE.md)

- **Branch strategy:** Phase 7 work lands on `feat/storage-adapter`.
  `main` tracks `upstream/main`; never modify directly. Per-phase
  feature branches off `feat/storage-adapter` are allowed — single long-
  lived branch is the default given the milestone is near-ship.

- **Upstream rebase risk:** The adapter-interface seam change
  (`adapters/types.ts` + `adapters/markdown/index.ts` single-line
  additions for `normalize()`) is deliberately small and scoped to the
  adapter layer — does NOT touch business-logic files. Paired-test
  additions are all NEW files under `tests/conformance/` + new entries
  in `package.json`, so no rebase conflicts expected outside the seam.

- **Sibling-repo side:** `/Volumes/code/gsd-beads` is the sibling. Phase
  7 touches it for: (a) deleting `tests/conformance.test.ts` (D-05), (b)
  adding `src/testing/conformance-factory.ts` + `./testing` export
  (D-04), (c) adding `normalize()` method to BeadsAdapter class (D-13).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vitest` | `^4.1.6` [VERIFIED: already devDep in fork sdk + sibling package.json] | Test runner for all conformance + meta-coverage + property + failure-injection tests | Already used fork-side (`vitest.conformance.config.ts`) + sibling-side (`vitest.config.ts` with `singleFork: true`, `testTimeout: 60_000`). No new runner. |
| `fast-check` | `^4.8.0` [VERIFIED: npm registry 2026-05-11] | Property-based test generation | D-12 locked. `fc.assert(prop, { numRuns, interruptAfterTimeLimit, endOnFailure })` implements D-14's adaptive budget directly. |
| `@fast-check/vitest` | `^0.4.1` [VERIFIED: npm registry] | vitest-native binding for fast-check so property tests register as first-class `describe`/`it`/`it.prop(...)` nodes | Lets meta-coverage walk vitest's runtime suite graph uniformly (property tests register as `it` nodes, not opaque blobs). Without this integration, the meta-test would need a special case for fast-check blocks. |
| `gsd-beads` | `file:../gsd-beads` [VERIFIED: sibling package.json shape] | BeadsAdapter + sibling's `./testing` subpath | D-02 locked. Single-line `devDependencies` entry. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:child_process` (`spawnSync`) | stdlib | Spawn `bd --version` probe in CI + invoke `bd export --json` for D-11 rollback diff | Keeps the test tree free of bd-client dependencies; mirrors sibling's own test-time invocation pattern (sibling `tests/fixture.ts` uses `spawnSync` identically). |
| `node:crypto` (`createHash`) | stdlib | SHA-256 for MarkdownAdapter rollback byte-diff | Already used in fork's `tests/conformance/write-transaction.test.ts:14` via `hashDir()` helper; Phase 7 extends that helper to diff trees pre-/post-txn. |
| `node:fs/promises` | stdlib | Directory traversal for byte-diff | Matches existing helper pattern. |
| (existing) `js-yaml` | sibling devDep | Needed IF BeadsAdapter's `normalize()` surfaces nested-frontmatter cases | Sibling ships `js-yaml@^4.1.1` per Plan 06-04 corpus-scan escalation. BeadsAdapter's `normalize()` composes its ALREADY-ported `parseFrontmatter`/`formatFrontmatter` which internally use `js-yaml`. No new dep needed. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fast-check` for property tests | `jsverify`, `fast-check-monorepo`, hand-written enumerations | fast-check is the de-facto TS property-testing library (last 7 years); `jsverify` is unmaintained; hand-written enumerations were explicitly REJECTED in D-12. Moot — D-12 is locked. |
| `@fast-check/vitest` integration | Raw `fc.assert()` inside `it(...)` blocks | `@fast-check/vitest` adds `it.prop(arbs)(name, prop)` which integrates with vitest's timeout/reporter. Without it, you `fc.assert()` inside a regular `it`, which works but doesn't let the reporter distinguish "fast-check exhausted budget OK" from "fast-check found a failing case." [CITED: https://github.com/dubzzz/fast-check/tree/main/packages/vitest] Use `@fast-check/vitest`; the integration cost is trivial. |
| `ripgrep` for D-08 grep | `ast-grep` / `ts-morph` / plain `grep -rE` | ast-grep + ts-morph give real AST precision (can statically distinguish `adapter.updateSection('literal', ...)` from `adapter.updateSection(variable, ...)`), but add a dev dep + require learning their query syntax. `ripgrep` is fast, already installed (Homebrew available on dev + most CI images), and the regex `adapter\.(updateSection\|getSection)\(\s*['"]` captures string-literal anchors cleanly. **Recommend ripgrep** for first-run simplicity; escalate to ast-grep if dynamic-anchor discipline creates false positives. §2 below gives both regex shapes. |

**Installation:**

```bash
# fork-side additions (Phase 7 wave 3 or 4 — devDep)
cd /Volumes/code/get-shit-done
npm i -D fast-check@^4.8 @fast-check/vitest@^0.4
# plus the file-link devDep
npm i -D gsd-beads@file:../gsd-beads
```

```bash
# sibling-side: no new deps. Just build + export subpath addition.
cd /Volumes/code/gsd-beads
# after editing package.json exports + tsconfig:
npm run build
```

**Version verification:**

```bash
npm view fast-check version       # 4.8.0 (verified 2026-05-11)
npm view @fast-check/vitest version  # 0.4.1 (verified 2026-05-11)
npm view vitest version           # 4.1.6 (confirmed — matches fork + sibling lockfiles)
```

## Architecture Patterns

### System Architecture Diagram

```
                 ┌───────────────────────────────────────────────┐
                 │  Fork CI (`npm run test:conformance:paired`)  │
                 └───────────────────┬───────────────────────────┘
                                     │
          ┌──────────────────────────┼────────────────────────────┐
          │                          │                             │
          ▼                          ▼                             ▼
   ┌───────────┐         ┌──────────────────────┐        ┌──────────────────┐
   │ bd v1.0.4 │         │  paired.test.ts      │        │ meta-coverage    │
   │  probe +  │◄────────┤  runAdapterConform-  │        │  .test.ts        │
   │  skip gate│         │  anceSuite('markdown')       │                  │
   │ (D-03)    │         │  runAdapterConform-  │        │  • reads         │
   └───────────┘         │  anceSuite('beads')  │        │    CONFORMANCE_  │
                         └──────────┬───────────┘        │    MANIFEST      │
                                    │                    │  • walks vitest  │
                  ┌─────────────────┼──────────────┐     │    suite graph   │
                  │                 │              │     │  • fails on gap  │
                  ▼                 ▼              ▼     │  • fails on      │
          ┌──────────────┐  ┌──────────────┐  ┌──────────┤    orphans       │
          │ Markdown     │  │ Beads        │  │ manifest │  (D-06, D-08)    │
          │ Adapter      │  │ Adapter      │  │ expected │                  │
          │ (fork)       │  │ (sibling)    │  │ lookup   │◄── scripts/      │
          │              │  │              │  │ per test │    extract-      │
          │ normalize()  │  │ normalize()  │  └──────────┘    section-      │
          │  = identity  │  │  = parse →   │     ▲            anchors.mjs   │
          │              │  │    format    │     │            (D-08 grep)   │
          │              │  │    round-    │     │                          │
          │              │  │    trip      │     │                          │
          └──────┬───────┘  └───────┬──────┘     │                          │
                 │                   │            │                          │
                 ▼                   ▼            │                          │
          ┌──────────────┐  ┌──────────────┐     │                          │
          │ .planning/   │  │ bd store     │     │                          │
          │ tree         │  │ (+.beads/)   │     │                          │
          │ (hashDir)    │  │ (bd export)  │     │                          │
          └──────┬───────┘  └───────┬──────┘     │                          │
                 │                   │            │                          │
                 └─────────┬─────────┘            │                          │
                           ▼                      │                          │
                   ┌───────────────┐              │                          │
                   │ failure-      │              │                          │
                   │ injection.    │              │                          │
                   │ test.ts       ├──────────────┘                          │
                   │ (D-10 throw;  │                                         │
                   │  D-11 diff)   │                                         │
                   └───────────────┘                                         │
                           ▲                                                 │
                           │                                                 │
                   ┌───────┴──────┐                                          │
                   │ properties.  │          ┌─────────────────────────┐    │
                   │ test.ts      │          │ CONFORMANCE_MANIFEST    │◄───┘
                   │ (D-12 fast-  │          │ (typed TS const)        │
                   │  check + D-14│          │ per-entry expected{     │
                   │  adaptive    │          │   markdown, beads       │
                   │  budget)     │          │ }                       │
                   └──────┬───────┘          └─────────────────────────┘
                          │                              ▲
                          ▼                              │
                   ┌────────────────┐                    │
                   │ arbitraries/   │                    │
                   │ arbPhase.ts    │                    │
                   │ arbPlan.ts     │                    │
                   │ ... (12 files) │                    │
                   └────────────────┘                    │
                                                         │
   ┌───────────────┐                                     │
   │ gsd-beads/    │                                     │
   │ testing/      │                                     │
   │ conformance-  │                                     │
   │ factory.ts    ├─────────────────────────────────────┘
   │ (D-04)        │   exports via `./testing` subpath
   └───────────────┘   imports: from fork
```

### Recommended Project Structure

```
fork (get-shit-done/)
├── adapters/
│   ├── types.ts                         # EDIT: add `normalize()` to StorageAdapter
│   └── markdown/index.ts                # EDIT: add `normalize(body) { return body; }`
├── scripts/
│   └── extract-section-anchors.mjs      # NEW: D-08 grep script (tsx-compatible node)
├── tests/
│   └── conformance/
│       ├── adapter.conformance.ts       # UNCHANGED (harness signature locked Phase 1 D-15)
│       ├── manifest.ts                  # NEW: CONFORMANCE_MANIFEST typed const
│       ├── manifest-types.ts            # NEW: ManifestEntry / ExpectedOutcome types
│       ├── meta-coverage.test.ts        # NEW: bidirectional coverage test
│       ├── paired.test.ts               # NEW: runs both adapter factories
│       ├── failure-injection.test.ts    # NEW: D-10 throw + D-11 diff
│       ├── properties.test.ts           # NEW: D-12/D-14 fast-check runner
│       ├── rollback-diff.ts             # NEW: helper — MarkdownAdapter hashDir + BeadsAdapter bd export diff
│       └── arbitraries/                 # NEW: 12 per-noun files
│           ├── arbPhase.ts
│           ├── arbPlan.ts
│           ├── arbSummary.ts
│           ├── arbUat.ts
│           ├── arbStateEvent.ts
│           ├── arbRoadmap.ts
│           ├── arbDecision.ts
│           ├── arbBlocker.ts
│           ├── arbDebugSession.ts
│           ├── arbProject.ts
│           ├── arbSpec.ts
│           └── arbAiSpec.ts
├── package.json                         # EDIT: devDeps + test:conformance:paired script
├── vitest.conformance.config.ts         # EDIT: add paired + properties globs; raise testTimeout for properties
└── .github/workflows/ci.yml             # NEW or EDIT: bd install step + paired run

sibling (gsd-beads/)
├── src/
│   ├── index.ts                         # EDIT: add `normalize(body, category?)` method
│   └── testing/
│       └── conformance-factory.ts       # NEW: extracted + re-exported from tests/conformance.test.ts
├── package.json                         # EDIT: add "./testing" export
├── tsconfig.json                        # EDIT: include src/testing/ (already included via `src/**/*.ts`)
└── tests/
    └── conformance.test.ts              # DELETE (D-05)
```

### Pattern 1: Typed manifest + per-adapter expected (D-06 + D-07)

**What:** A single hand-authored TS const whose entries pair a Bin B
method / section-tuple / noun-roundtrip with a per-adapter expected
outcome. The paired-test helper reads the suite's `adapterName` at
runtime (it's the first argument to `runAdapterConformanceSuite`) and
asserts *that* adapter's documented outcome.

**When to use:** Every assertion where adapters might legitimately
differ (e.g. `created_section` emit vs. no-emit under D-2026-05-12-
OQ06-CREATED-SECTION; `rollback: byte-identical` vs.
`rollback: incomplete-per-Deferred-04`).

**Example:**

```ts
// Source: design synthesis from CONTEXT.md D-06 + D-07, citing
// adapters/state-event-types.ts AppendEvent discriminated union.
// tests/conformance/manifest-types.ts

export type AdapterName = 'markdown' | 'beads';

// Outcome for a recordState* call — mirrors StateWriteOutcome in
// adapters/types.ts but adds the per-adapter relaxations.
export type StateOutcomeExpected =
  | { applied: true; created_section?: string | null }  // null = explicitly NO created_section emitted
  | { applied: false; reason: 'duplicate' | 'nothing_to_remove' };

// Outcome for CONFORM-04 rollback tests.
export type RollbackOutcomeExpected =
  | { kind: 'byte-identical' }
  | { kind: 'record-identical' }  // bd export --json diff
  | { kind: 'incomplete-per-Deferred-04'; adr: 'D-2026-05-12-OQ06-TXN' };

// Outcome for a noun round-trip — normalize()-modulo equality.
export type RoundTripOutcomeExpected =
  | { kind: 'normalize-modulo-equal' }
  | { kind: 'identity-equal' };

export type ExpectedOutcome =
  | StateOutcomeExpected
  | RollbackOutcomeExpected
  | RoundTripOutcomeExpected;

export interface ManifestEntry {
  kind: 'binB' | 'section-tuple' | 'noun-roundtrip' | 'rollback';
  /** Stable id; e.g. 'recordStateAppend:decision:scaffold' or 'STATE.md#Decisions:append' */
  name: string;
  /**
   * Short description — used only in test names + CI output.
   * NOT the source-of-truth for expected behavior; that's `expected`.
   */
  description?: string;
  /** Per-adapter expected outcome. MUST include every shipped adapter. */
  expected: Record<AdapterName, ExpectedOutcome>;
  /** ADR reference when adapters legitimately differ. */
  adr?: string;
}

export const CONFORMANCE_MANIFEST: readonly ManifestEntry[] = [
  // Clean-parity example
  {
    kind: 'binB',
    name: 'recordStateAppend:decision:existing-section',
    description: 'decision: applied:true bare when Decisions section exists',
    expected: {
      markdown: { applied: true },
      beads:    { applied: true },
    },
  },
  // Deviation example (D-2026-05-12-OQ06-CREATED-SECTION)
  {
    kind: 'binB',
    name: 'recordStateAppend:decision:scaffold',
    description: 'decision: applied:true + created_section when no Decisions heading',
    expected: {
      markdown: { applied: true, created_section: '## Decisions Made' },
      beads:    { applied: true, created_section: null },  // never emits
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  // CONFORM-04 known-gap example (D-09)
  {
    kind: 'rollback',
    name: 'withTransaction:mid-txn-failure-3-of-3-writes',
    description: 'throw from inside fn after 2-of-3 writes; assert rollback outcome',
    expected: {
      markdown: { kind: 'byte-identical' },
      beads:    { kind: 'incomplete-per-Deferred-04', adr: 'D-2026-05-12-OQ06-TXN' },
    },
    adr: 'D-2026-05-12-OQ06-TXN',
  },
] as const;
```

### Pattern 2: Paired invocation via `runAdapterConformanceSuite` (D-01)

**What:** The locked Phase 1 D-15 harness factory runs each adapter once.
Phase 7 calls it twice in one file.

**Example:**

```ts
// Source: adapters reference — tests/conformance/markdown.conformance.test.ts
// is a 7-LOC single-adapter consumer; Phase 7 mirrors with two calls.
// tests/conformance/paired.test.ts

import { runAdapterConformanceSuite } from './adapter.conformance.js';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import { createBeadsAdapter } from 'gsd-beads/testing';
import { spawnSync } from 'node:child_process';

// D-03 bd probe: skip-with-warning locally; CI install guarantees presence.
function bdPresent(): boolean {
  const r = spawnSync('bd', ['--version'], { encoding: 'utf-8' });
  return r.status === 0 && /^bd version 1\.0\.[4-9]/.test(r.stdout ?? '');
}

runAdapterConformanceSuite('markdown', (dir) => new MarkdownAdapter(dir));

if (bdPresent()) {
  runAdapterConformanceSuite('beads', createBeadsAdapter);
} else {
  // Emits a single skipped describe so vitest's reporter shows the gap.
  describe.skip('StorageAdapter conformance: beads', () => {
    it.skip('bd v1.0.4+ not available — install bd to run paired conformance', () => {});
  });
}
```

### Pattern 3: Meta-coverage via `expect.soft` + vitest suite introspection (D-06)

**What:** A single `it(...)` block that cross-checks `CONFORMANCE_MANIFEST`
against the live vitest suite graph. Collects all violations before
failing so one run surfaces every gap (no whack-a-mole).

**When to use:** Single file, runs after the rest of the paired suite
has registered its describe/it blocks — vitest populates its task graph
at collection time, so the meta-test can read it during test-run time.

**Example:**

```ts
// Source: design synthesis + vitest test-context docs
// (https://vitest.dev/guide/test-context). Public API: the `expect` context
// has `.soft()` since vitest 1.0; suite graph is accessible via dynamic
// imports of vitest's `getRunningSuite`-style helpers OR by recording our
// own registrations through a wrapper.
// tests/conformance/meta-coverage.test.ts

import { describe, it, expect } from 'vitest';
import { CONFORMANCE_MANIFEST } from './manifest.js';
import { registeredTests } from './test-registry.js';  // see below

describe('Phase 7 meta-coverage', () => {
  it('every CONFORMANCE_MANIFEST entry has a corresponding describe/it (both adapters)', () => {
    const adapters = ['markdown', 'beads'] as const;
    for (const adapter of adapters) {
      for (const entry of CONFORMANCE_MANIFEST) {
        const key = `${adapter}:${entry.kind}:${entry.name}`;
        expect.soft(
          registeredTests.has(key),
          `manifest entry ${entry.name} has no ${adapter} test registration`,
        ).toBe(true);
      }
    }
  });

  it('no describe/it block registers a case absent from CONFORMANCE_MANIFEST', () => {
    const manifestKeys = new Set(
      CONFORMANCE_MANIFEST.flatMap((e) => [
        `markdown:${e.kind}:${e.name}`,
        `beads:${e.kind}:${e.name}`,
      ]),
    );
    for (const key of registeredTests) {
      expect.soft(manifestKeys.has(key), `orphan test registration: ${key}`).toBe(true);
    }
  });
});
```

The simplest + most portable implementation uses a **tiny registration
wrapper** — NOT runtime introspection of vitest's internals (fragile
across vitest major-version bumps):

```ts
// tests/conformance/test-registry.ts
// A per-process Set of registered manifest keys. Populated by the
// paired-assertion helper each time a test block touches a manifest
// entry. Meta-coverage reads this after vitest collection.

export const registeredTests = new Set<string>();

export function assertFromManifest<T extends unknown[]>(
  adapterName: 'markdown' | 'beads',
  entryName: string,
  kind: 'binB' | 'section-tuple' | 'noun-roundtrip' | 'rollback',
  check: (expected: unknown) => void,
): void {
  const key = `${adapterName}:${kind}:${entryName}`;
  registeredTests.add(key);
  const entry = CONFORMANCE_MANIFEST.find((e) => e.kind === kind && e.name === entryName);
  if (!entry) throw new Error(`assertFromManifest: no manifest entry for ${key}`);
  check(entry.expected[adapterName]);
}
```

Every paired assertion goes through `assertFromManifest`; meta-coverage
then reads `registeredTests`. This is HIGH-confidence: purely test-code,
no vitest-internal dependencies.

### Pattern 4: Adaptive fast-check budget (D-14)

**Example:**

```ts
// Source: fast-check docs (https://fast-check.dev/docs/core-blocks/runners/)
// + @fast-check/vitest integration README.
// tests/conformance/properties.test.ts

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { arbPhase } from './arbitraries/arbPhase.js';
// ...imports for the other 11 arbitraries

function runNounProperty<T>(
  adapterName: 'markdown' | 'beads',
  nounName: string,
  arb: fc.Arbitrary<T>,
  oneOff: (adapter: StorageAdapter, value: T) => Promise<void>,
): void {
  it(`${nounName} round-trips under normalize() (${adapterName})`, async () => {
    // Registers with the meta-coverage registry.
    registeredTests.add(`${adapterName}:noun-roundtrip:${nounName}`);
    await fc.assert(
      fc.asyncProperty(arb, async (value) => {
        const adapter = /* factory per adapterName */;
        await oneOff(adapter, value);
      }),
      {
        numRuns: Number.POSITIVE_INFINITY,
        endOnFailure: true,
        interruptAfterTimeLimit: 60_000,
        markInterruptAsFailure: false,  // graceful-abort counts as pass
        verbose: true,                   // report shrunk case on fail
      },
    );
  }, { timeout: 90_000 });  // vitest must allow > 60s for fast-check to hit its own budget
}
```

**Critical note on vitest integration:** vitest kills a test at its own
`testTimeout` (default 30_000 in fork's `vitest.conformance.config.ts`).
If fast-check's `interruptAfterTimeLimit` fires BEFORE vitest's timeout,
graceful abort is reported as a pass. If vitest kills first, the test
reports timeout failure. **Keep `testTimeout > interruptAfterTimeLimit + 10s`
for headroom.** Recommend `testTimeout: 90_000` for
`properties.test.ts` specifically (set via `it(..., { timeout:
90_000 })` per-test rather than raising the global).

### Anti-Patterns to Avoid

- **Runtime trace instrumentation for section-tuple discovery** —
  REJECTED in D-08. Adds complexity; grep + gate catches the common
  case; runtime instrumentation requires loading the SDK during test
  collection and tracking all `updateSection`/`getSection` calls, which
  couples the meta-coverage test to SDK internals.
- **Adapter-internal `__forceFailAfterNWrites` hook for D-10** —
  REJECTED. Adds a test-only API surface. Natural `throw` in the caller's
  fn is sufficient; the Outcome A commit-replay gap manifests in the
  natural throw case too.
- **Per-noun `recordEq` in tests-only** — REJECTED in D-13. Loses the
  API exposure for Phase 8 migration tool. `normalize()` as an adapter
  method is the chosen shape.
- **Reflection / decorator-driven manifest** — REJECTED in D-06. Authored
  typed enumeration beats reflection: greppable, clear, forces a conscious
  decision per new Bin B method. The bidirectional meta-test catches
  omissions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Property-based test generation | Custom enumeration loops with `Math.random()` | `fast-check` with per-noun `fc.Arbitrary<T>` | Shrinking on failure (fast-check) is the critical feature — a failing case shrinks to the minimum reproducer automatically. Hand-rolled loops give you the crash but not the reproducer. |
| Vitest-integrated fast-check reporting | Raw `fc.assert()` inside `it(...)` with manual `try/catch` | `@fast-check/vitest` (`it.prop(arbs)(name, prop)`) | Integration handles timeout interaction + reporter formatting + shrinking output inline with test failure output. |
| TS section-anchor extraction | `eval()` of source code + runtime tracking | ripgrep regex + line-delta heuristic (see §2) OR `ast-grep` if ripgrep false-positives become noisy | ripgrep's regex for `adapter\.(updateSection\|getSection)\(\s*['"]` captures literal anchors cleanly + fast. AST parsing is overkill for a first cut. |
| Byte-diff of directory trees | `diff -r` shell-out | `hashDir()` helper already in `tests/conformance/write-transaction.test.ts:14-30` (SHA-256 per file + aggregate, ignores `.tmp-txn-*` / `.adapter.lock`) | The fork already shipped this helper in Phase 5. Promote it to `tests/conformance/rollback-diff.ts` and reuse. |
| YAML frontmatter parse/format | Hand-rolled flat-scalar parser | `js-yaml` (sibling ships it) | Sibling's format/frontmatter.ts already uses `js-yaml@^4.1.1` after Plan 06-04 corpus-scan escalation. BeadsAdapter `normalize()` composes these; no new code. |
| bd store export diff | Manually re-serializing JSONL for comparison | `bd export --json` + small JS strip-pass for non-semantic fields (§5) | `bd export --json` is the contract bd itself offers; sibling's Phase 7 test already uses it. Reuse. |
| TS `CONFORMANCE_MANIFEST` typing | Free-form `any[]` | `as const readonly ManifestEntry[]` with discriminated-union `expected` (see Pattern 1) | TS compile-time enforcement catches mistakes (e.g. omitting `expected.beads` on a new entry) before CI runs. |
| Test registration tracking | vitest internal API introspection | Simple `Set<string>` populated by `assertFromManifest` helper (Pattern 3) | vitest internals churn across major versions; a test-code-owned Set is portable. |

**Key insight:** Everything above is already built and shipped either in
the fork (hashDir, conformance harness) or in the sibling (js-yaml, bd
export invocation, bd init factory). Phase 7 is majority wiring +
authoring manifest entries; the "new primitives" reduce to the
`normalize()` contract method + one grep script + one registration Set.

## Runtime State Inventory

*(Not applicable — Phase 7 is a net-additive testing+tooling phase with
one additive contract method. No renames, refactors, or migrations that
would leave runtime state stale.)*

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 7 is a testing phase with no persistent data beyond per-test tmp directories which are torn down in afterEach. | None |
| Live service config | None — no external service config. | None |
| OS-registered state | None — CI install of bd is ephemeral per job; local dev's bd is user-managed. | None |
| Secrets/env vars | `BEADS_ACTOR=seed` enforced at conformance factory (Landmine 11, already implemented in sibling `tests/fixture.ts:71`). No new secrets. | None |
| Build artifacts | Sibling's `dist/testing/conformance-factory.js` MUST rebuild when the testing source changes — ensure `"prepublishOnly"` or `"build"` in sibling covers the new subpath. | Verify sibling `npm run build` compiles `src/testing/*.ts` alongside existing src (tsconfig.json `include: ["src/**/*.ts"]` already covers this — no tsconfig change needed). |

## Common Pitfalls

### Pitfall 1: `adapter.updateSection` / `adapter.getSection` call sites are SPARSE in the fork SDK today

**What goes wrong:** The grep script for D-08 returns ZERO call sites
outside of `adapters/types.ts` + `adapters/markdown/index.ts` + test
files.

**Why it happens:** Phase 5 Plan 05-03 wrapped `updateSection` internally
with `withTransaction` (D-09), and Phase 3/4 migrated SDK consumers to
higher-level helpers (`recordStateAppend/Mutation/Signal`,
`phase-helpers.ts`) that use `adapter.getRecord` / `adapter.putRecord` +
in-module string mutation rather than `adapter.updateSection`. The bulk
of "section semantics" live *inside* MarkdownAdapter's private helpers
(e.g. the `## Decisions Made` / `## Performance Metrics` /
`## Blockers` / `### Roadmap Evolution` / `## Session Continuity` /
`## Pending todos` / `## Deferred Ideas` / `## Quick Tasks` /
`## Forensic Sessions` literals at `adapters/markdown/index.ts:715,747,
758,813,1001,1055,1119,1209,1251`).

**How to avoid:** D-08 grep must extend beyond `adapter.updateSection(...)`
patterns to include *internal* section-literal sites in
`adapters/markdown/index.ts` itself — where the real (record-type,
section-id, mode) tuples live. Recommended grep targets:

```bash
# literal ATX anchors used in MarkdownAdapter recordState* helpers
rg -n '(created_section|anchor).*[`'"'"'"](#{2,4}\s[A-Z][^`'"'"'"]+)' \
   adapters/markdown/index.ts

# public updateSection/getSection call sites (SDK + tests)
rg -ntts '\.(updateSection|getSection)\(' \
   sdk/src tests adapters
```

**Warning signs:** Manifest section-tuple subset is empty or nearly empty
after the first grep pass.

### Pitfall 2: `@fast-check/vitest` timeout integration

**What goes wrong:** `fc.assert(..., { interruptAfterTimeLimit: 60_000 })`
inside `it(...)` with vitest's default `testTimeout: 30_000` — vitest
kills the test before fast-check hits its budget. Reports as timeout
failure, not graceful abort.

**Why it happens:** vitest testTimeout wraps the whole async function;
fast-check's `interruptAfterTimeLimit` is internal to `fc.assert`.

**How to avoid:** ALWAYS pair the fast-check budget with a per-test
vitest timeout of at least budget + 10 seconds:

```ts
it('name', async () => { /* fc.assert with 60s budget */ },
   { timeout: 90_000 });
```

**Warning signs:** Property tests reporting "test timed out" rather than
"OK (N runs, interrupted at time limit)".

### Pitfall 3: BeadsAdapter's `normalize()` must be DETERMINISTIC

**What goes wrong:** `normalize(body)` returns different output on the
same input (e.g. because `js-yaml` emits quoted strings differently
depending on corpus order). Property test passes on first run, fails
on shrink replay.

**Why it happens:** `formatFrontmatter` in `src/format/frontmatter.ts`
uses `js-yaml.dump` with `sortKeys: false` — preserves insertion order.
If the input object was created by iterating another object, map
iteration order matters.

**How to avoid:** `normalize()` MUST be pure: output depends only on
input. Plan 06-04 already verified this via the idempotency contract
`parse(format(parse(x))) === parse(x)` (not byte-equality). **Phase 7
assertion:** `adapter.normalize(adapter.normalize(body)) ===
adapter.normalize(body)` — second-application-is-identity. This catches
non-determinism.

**Warning signs:** Property test fails only on shrink-replay, never on
initial run.

### Pitfall 4: `bd export --json` includes non-semantic metadata

**What goes wrong:** D-11 rollback check asserts S1 === S2 but timestamps
or actor metadata differ between snapshots, test fails spuriously.

**Why it happens:** `bd export --json` emits `created_at`, `updated_at`,
`last_modified` on every record. `BEADS_ACTOR=seed` on seed writes gives
deterministic `created_by` but *subsequent* writes during the test use
the process env actor.

**How to avoid:** Strip pass (see §5 below) before diff:
- Strip: `updated_at` globally.
- Strip: `last_modified` globally.
- Keep: `created_at` (stable once record is created).
- Keep: `created_by` (stable if `BEADS_ACTOR=seed` maintained across
  test ops — **set `env: { ...process.env, BEADS_ACTOR: 'seed' }` on
  every bd invocation in the test, not just during init**).
- Keep: all payload/label/memory fields (the actual semantic content).

**Warning signs:** BeadsAdapter rollback test flakes 1-in-N runs; diff
only shows timestamp-looking fields.

### Pitfall 5: Section-anchor grep misses dynamic composition

**What goes wrong:** Code like
`adapter.updateSection(path, \`## \${phaseName}\`, body, mode)` bypasses
the string-literal regex; the dynamic anchor is invisible to D-08 grep.
Manifest ships with a coverage gap.

**Why it happens:** D-08 explicitly scopes grep to string literals; the
gate fails CI on dynamic anchors as designed.

**How to avoid:** The grep script MUST emit two outputs:
(a) `anchors.json` — the literal tuples (populates manifest).
(b) `dynamic-anchors.warn` — any `adapter.(updateSection|getSection)(`
    where the second argument is NOT a string literal. CI fails on
    non-empty `dynamic-anchors.warn` unless the caller is listed in
    `tests/conformance/manifest-dynamic-anchors.allowlist` with a
    justification comment.

Regex for the gate (grep pass 2):

```bash
# Matches: adapter.updateSection(path, <non-string-literal>, ...)
rg -n --multiline --pcre2 \
  'adapter\.(updateSection|getSection)\(\s*[^,]+,\s*(?![`'"'"'"])' \
  sdk/src adapters
```

**Warning signs:** Manifest has < 10 section-tuple entries even though
MarkdownAdapter has ~10 internal literal sections.

### Pitfall 6: Sibling `./testing` subpath not included in `files` array

**What goes wrong:** `npm pack` inside sibling emits tarball without
`dist/testing/`, so `file:../gsd-beads` install works but a future
`npm publish` omits the testing export. Silently breaks external adapter
authors.

**Why it happens:** `files: ["dist", "src", "README.md", "CLAUDE.md",
"CONTRIBUTING.md"]` in sibling's `package.json` — `"dist"` is a directory,
so all subdirs including `dist/testing/` ARE included automatically. But
`"src"` also includes `src/testing/` sources. Both ship — verified.

**How to avoid:** No action needed — sibling's existing `files` array
covers the new subdirectory. But: verify `npm pack --dry-run` output
after Plan 7.3 lands and before the phase ships. Quick check:

```bash
cd /Volumes/code/gsd-beads
npm pack --dry-run 2>&1 | grep testing/
```

**Warning signs:** Published tarball missing testing subpath despite
`exports` entry — consumer gets `Cannot find module 'gsd-beads/testing'`.

### Pitfall 7: `runAdapterConformanceSuite` is called TWICE in `paired.test.ts`, but MarkdownAdapter-specific tests in existing conformance files run ONCE

**What goes wrong:** The existing files (`write-outcome.test.ts`,
`write-events.test.ts`, `write-transaction.test.ts`, etc.) instantiate
`MarkdownAdapter` directly — they DO NOT go through
`runAdapterConformanceSuite`. Phase 7 paired.test.ts runs the harness
twice, but the 16-case StateWriteOutcome matrix in write-outcome.test.ts
still only runs against MarkdownAdapter.

**Why it happens:** The Phase 1/3/5 conformance harness was scoped to
"things you want to test per adapter at conformance-collection time."
Plan 03-06 / Plan 05-04 authored richer assertions directly using
MarkdownAdapter.

**How to avoid:** Phase 7 has TWO options:
- (A) Migrate every `adapter = new MarkdownAdapter(tmpDir)` pattern in
  the 7 test files under `tests/conformance/` to receive `adapter` as a
  factory parameter (refactor each file's `beforeEach` to take
  `adapterFactory` from an outer scope). Aligns all tests with the
  harness.
- (B) Leave the Markdown-only tests as-is and author new paired test
  blocks that exercise the same cases against both adapters.

Option (A) is cleaner but churns ~2766 LOC. Option (B) creates
duplication. **Recommend a hybrid**: migrate the three write-*.ts files
into `runAdapterConformanceSuite` (they already include the comment
"Phase 7 swaps MarkdownAdapter for BeadsAdapter and runs unchanged" —
this IS the Phase 7 migration); leave `phase-reads.test.ts` /
`init-bundlers.test.ts` / `document-reads.test.ts` on MarkdownAdapter
where BeadsAdapter equivalence is trivially satisfied by Bin A
primitives.

**Warning signs:** Paired.test.ts passes but write-outcome.test.ts
doesn't exercise BeadsAdapter; meta-coverage flags write-outcome cases
as missing `beads:` registration.

### Pitfall 8: bd v1.0.4 `bd init --from-jsonl` IS a boolean flag

**What goes wrong:** Earlier bd versions accepted a path argument to
`--from-jsonl`. v1.0.4 expects the seed pre-staged at `.beads/issues.jsonl`
and `--from-jsonl` is just a boolean.

**Why it happens:** bd CLI flag evolution between v1.0.3 and v1.0.4 per
Plan 06-03 SPIKE-RESULTS and STATE.md "DEV-CLI-FLAGS-BD-V1.0.4".

**How to avoid:** Sibling's `tests/fixture.ts:51-70` already encodes
this: it `copyFile(seedSrc, join(beadsDir, 'issues.jsonl'))` BEFORE
invoking `bd init --from-jsonl`. The extracted
`src/testing/conformance-factory.ts` MUST preserve this ordering —
don't refactor to "cleaner" patterns without keeping the pre-stage.

**Warning signs:** `bd init` exits non-zero with "`.beads/issues.jsonl`
not found" or similar. Sibling's existing fixture code is canonical;
port verbatim.

## Code Examples

### Example 1: The grep script (D-08)

```javascript
#!/usr/bin/env node
// scripts/extract-section-anchors.mjs
// Source: design synthesis; ripgrep regex syntax per
// https://docs.rs/regex/latest/regex/#syntax

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const LITERAL_OUT = join(ROOT, 'tests/conformance/.generated/anchors.json');
const DYNAMIC_OUT = join(ROOT, 'tests/conformance/.generated/dynamic-anchors.warn');

// Pass 1: string-literal anchors in public adapter API call sites
const literalPass = spawnSync(
  'rg',
  [
    '-ntts', '-njs', '-ncjs', '-nmjs',
    '--pcre2',
    '-o', '--replace', '$2|$1',
    `\\.(updateSection|getSection)\\(\\s*[^,]+,\\s*['"\`]([^'"\`]+)['"\`]`,
    'sdk/src', 'adapters',
  ],
  { encoding: 'utf-8' },
);

// Pass 2: internal section literals in MarkdownAdapter (anchor-string
// targets, e.g. `'## Decisions Made'` in markdown/index.ts)
const internalPass = spawnSync(
  'rg',
  [
    '-nt', 'ts',
    '-o', '--replace', '$1',
    `['"\`](#{2,4}\\s[A-Z][^'"\`]+)['"\`]`,
    'adapters/markdown/index.ts',
  ],
  { encoding: 'utf-8' },
);

// Pass 3: dynamic-anchor gate — second arg is NOT a string literal
const dynamicPass = spawnSync(
  'rg',
  [
    '-ntts', '-njs', '-ncjs', '-nmjs',
    '--pcre2',
    `\\.(updateSection|getSection)\\(\\s*[^,]+,\\s*(?!['"\`])`,
    'sdk/src', 'adapters',
  ],
  { encoding: 'utf-8' },
);

// Assemble manifest-ready tuples
const tuples = [];
for (const line of literalPass.stdout.split('\n').filter(Boolean)) {
  // ripgrep output: path:line:<anchor>|<method>
  // ...parse and push { kind: 'section-tuple', name: `${file}#${anchor}:${mode}` }
}
for (const line of internalPass.stdout.split('\n').filter(Boolean)) {
  // MarkdownAdapter-internal heading literals — manifest key like 'STATE.md#Decisions Made'
}

writeFileSync(LITERAL_OUT, JSON.stringify(tuples, null, 2));
writeFileSync(DYNAMIC_OUT, dynamicPass.stdout || '');

// CI gate: non-empty dynamic-anchors.warn is a build failure unless
// the caller's path is on the allowlist.
if (dynamicPass.stdout?.trim()) {
  console.error('dynamic-anchor callers found (must be string literal OR registered):');
  console.error(dynamicPass.stdout);
  process.exit(1);
}
```

### Example 2: BeadsAdapter normalize() composition (D-13)

```ts
// Source: /Volumes/code/gsd-beads/src/format/section.ts (ported from
// sibling .mjs; already shipped) + frontmatter.ts (already shipped).
// Sibling src/index.ts Phase 7 addition:

import {
  parseFrontmatter,
  formatFrontmatter,
} from './format/frontmatter.js';
import {
  locateSection,      // available but not needed for normalize
  rewriteSection,     // available but not needed for normalize
} from './format/section.js';

export class BeadsAdapter implements StorageAdapter {
  // ...existing methods...

  /**
   * D-13: canonicalize body as BeadsAdapter would after a putRecord →
   * getRecord round-trip. Composes the frontmatter parser/formatter
   * (which normalizes YAML style + quoting via js-yaml.dump) with an
   * identity-section round-trip (no-op; included for symmetry with
   * the section-rewrite path).
   *
   * `category` is accepted for forward compatibility (Phase 8 migration
   * tool may dispatch differently per NamedDocCategory) but currently
   * unused — BeadsAdapter's normalization is uniform across categories.
   */
  normalize(body: string, _category?: string): string {
    // Phase 1: frontmatter round-trip — js-yaml.dump normalizes quote
    // style, key ordering-within-maps (preserved per sortKeys:false),
    // indentation.
    const { frontmatter, body: rest } = parseFrontmatter(body);
    const reFormatted = formatFrontmatter(frontmatter, rest);
    // Phase 2: section round-trip — locateSection + rewriteSection are
    // only needed if sections need re-anchoring. BeadsAdapter stores
    // body as a single description blob (D-MAPPING Outcome A) and
    // re-parses on read; formatting is byte-preserving for sections
    // that already match the slugify contract. Identity pass is
    // sufficient here.
    return reFormatted;
  }
}
```

### Example 3: CONFORM-04 rollback diff (D-11)

```ts
// Source: design synthesis + sibling tests/fixture.ts:60-88 (bd
// invocation pattern) + fork write-transaction.test.ts:14-30 (hashDir).
// tests/conformance/rollback-diff.ts

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// === MarkdownAdapter: byte-identical tree diff (already in write-transaction.test.ts) ===

export async function markdownSnapshot(projectDir: string): Promise<string> {
  const planning = join(projectDir, '.planning');
  return hashDir(planning);
}

async function hashDir(dir: string): Promise<string> {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return '<missing>'; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const h = createHash('sha256');
  for (const e of entries) {
    // IGNORE: shadow-dir artifacts + lock file (transient)
    if (e.name.startsWith('.tmp-txn-') ||
        e.name.startsWith('.tmp-snap-') ||
        e.name === '.adapter.lock') continue;
    const p = join(dir, e.name);
    h.update(e.name);
    if (e.isFile()) h.update(await readFile(p));
    else if (e.isDirectory()) h.update(await hashDir(p));
  }
  return h.digest('hex');
}

// === BeadsAdapter: bd export --json diff with strip-pass ===

export function beadsSnapshot(projectDir: string): unknown[] {
  const r = spawnSync(
    'bd',
    ['export', '--json'],
    {
      cwd: projectDir,
      env: { ...process.env, BEADS_ACTOR: 'seed' },
      encoding: 'utf-8',
    },
  );
  if (r.status !== 0) throw new Error(`bd export failed: ${r.stderr}`);
  // bd v1.0.4 emits JSONL (Landmine 6) OR JSON array depending on content.
  // Try JSON first; fall back to JSONL.
  let records: unknown[];
  try {
    const parsed = JSON.parse(r.stdout);
    records = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    records = r.stdout.split('\n').filter(Boolean).map(l => JSON.parse(l));
  }
  return records.map(stripNonSemantic).sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function stripNonSemantic(record: unknown): unknown {
  if (!record || typeof record !== 'object') return record;
  const r = record as Record<string, unknown>;
  // Strip known-volatile fields. KEEP: id, labels, description,
  // dependencies, memories, comments (their text + author is semantic),
  // created_at, created_by (stable with BEADS_ACTOR=seed discipline).
  const { updated_at, last_modified, ...rest } = r;
  return rest;
}

// === Combined diff assertion ===

export function assertEqualSnapshots(
  before: string | unknown[],
  after: string | unknown[],
  message: string,
): void {
  if (typeof before === 'string' && typeof after === 'string') {
    // MarkdownAdapter byte-identity
    if (before !== after) throw new Error(`${message}: hash differs`);
  } else if (Array.isArray(before) && Array.isArray(after)) {
    // BeadsAdapter record-identity
    const a = JSON.stringify(before);
    const b = JSON.stringify(after);
    if (a !== b) throw new Error(`${message}: bd export differs:\n${diffJson(a, b)}`);
  } else {
    throw new Error(`${message}: snapshot type mismatch`);
  }
}
```

### Example 4: Failure-injection test (D-10)

```ts
// Source: CONTEXT.md D-10 explicit code template.
// tests/conformance/failure-injection.test.ts

import { describe, it, expect } from 'vitest';
import { markdownSnapshot, beadsSnapshot, assertEqualSnapshots } from './rollback-diff.js';

describe('CONFORM-04: throw-from-inside-fn failure injection', () => {
  it('markdown: 2-of-3 writes + throw → byte-identical rollback', async () => {
    const { adapter, projectDir } = await makeMarkdownFixture();
    await adapter.putRecord('STATE.md', '# pre\n');
    await adapter.putRecord('PROJECT.md', '# pre-p\n');
    const before = await markdownSnapshot(projectDir);

    await expect(
      adapter.withTransaction(async () => {
        await adapter.putRecord('STATE.md', '# mut\n');
        await adapter.putRecord('PROJECT.md', '# mut-p\n');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const after = await markdownSnapshot(projectDir);
    assertEqualSnapshots(before, after, 'markdown rollback');
  });

  it('beads: 2-of-3 writes + throw → rollback per D-09 known-gap', async () => {
    const { adapter, projectDir } = await makeBeadsFixture();
    const before = beadsSnapshot(projectDir);

    await expect(
      adapter.withTransaction(async () => {
        await adapter.recordStateAppend({ type: 'decision',
          payload: { phase: '07', summary: 'S1', rationale: 'r' } });
        await adapter.recordStateAppend({ type: 'decision',
          payload: { phase: '07', summary: 'S2', rationale: 'r' } });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const after = beadsSnapshot(projectDir);
    // D-TXN Outcome A: buffered ops DISCARDED on rollback (no commit
    // phase reached), so record-identical to pre-txn in this code path.
    // The Deferred-04 mid-commit-replay gap manifests in a DIFFERENT
    // code path (throw AFTER withTransaction's fn returns, during the
    // commit replay) which is not reachable via user-code throw. This
    // test passes; a separate test file documents the mid-commit gap
    // as an EXPECTED `expected.beads: incomplete-per-Deferred-04`
    // manifest entry.
    assertEqualSnapshots(before, after, 'beads rollback (throw-before-commit)');
  });
});
```

### Example 5: fast-check noun arbitrary (D-12)

```ts
// Source: design synthesis + adapters/state-event-types.ts (discriminated
// union source) + fast-check docs.
// tests/conformance/arbitraries/arbStateEvent.ts

import fc from 'fast-check';
import type {
  AppendEvent, MutationEvent, SignalEvent,
} from '../../../adapters/state-event-types.js';

const arbDecisionPayload = fc.record({
  phase: fc.string({ minLength: 1, maxLength: 3 }).map(s => s.padStart(2, '0')),
  summary: fc.string({ minLength: 1, maxLength: 200 }),
  rationale: fc.option(fc.string({ maxLength: 500 })),
});

const arbMetricPayload = fc.record({
  phase: fc.string({ minLength: 1, maxLength: 3 }),
  plan: fc.string({ minLength: 1, maxLength: 3 }),
  duration: fc.stringMatching(/^\d+[smhd]$/),
  tasks: fc.option(fc.stringMatching(/^\d+$/)),
  files: fc.option(fc.stringMatching(/^\d+$/)),
});

// ...other payloads...

export const arbAppendEvent: fc.Arbitrary<AppendEvent> = fc.oneof(
  fc.record({ type: fc.constant('decision' as const), payload: arbDecisionPayload }),
  fc.record({ type: fc.constant('metric' as const), payload: arbMetricPayload }),
  // ...4 more variants
);

export const arbMutationEvent: fc.Arbitrary<MutationEvent> = fc.oneof(/* ...4 variants */);
export const arbSignalEvent: fc.Arbitrary<SignalEvent> = fc.oneof(/* ...2 variants */);

export const arbStateEvent = fc.oneof(arbAppendEvent, arbMutationEvent, arbSignalEvent);
```

## Section-Anchor / Record-Type Sources

**For §2 — the concrete shape of what D-08 will produce.** After the
grep runs, the manifest's section-tuple subset covers three source
tiers:

### Tier 1: MarkdownAdapter internal section literals (primary source)

Derived from `adapters/markdown/index.ts` — these are the hard-coded
heading strings that `recordState*` implementations create or match:

| File target | Section anchor | Mode(s) | Source line |
|-------------|----------------|---------|-------------|
| STATE.md | `## Decisions Made` | append + create | 719 |
| STATE.md | `## Forensic Sessions` | append + create | 747 |
| STATE.md | `## Quick Tasks` | append + create | 758 |
| STATE.md | `## Blockers` | append + remove + create | 813 |
| STATE.md | `## Performance Metrics` | append + create | 1001 |
| STATE.md | `### Roadmap Evolution` (nested under `## Accumulated Context`) | append + create | 1055/1064 |
| STATE.md | `## Session Continuity` | overwrite + create | 1119 |
| STATE.md | `## Pending todos` | overwrite + create | 1209 |
| STATE.md | `## Deferred Ideas` | append + remove + create | 1251 |

### Tier 2: Phase 5 D-06 heading-depth walker contract

`## Foo` / `### Evidence` / `#### Sub-point` — any tuple the walker can
address. The CONFORM-03 matrix must include:
- `overwrite` on L2 (e.g. `## Current Position`)
- `append` on L3 (e.g. `### Roadmap Evolution`)
- `prepend` on L4 (if any caller uses it — grep will surface)

### Tier 3: SDK-consumer dynamic-anchor candidates

Current grep result (verified 2026-05-12): **ZERO call sites** of
`adapter.updateSection(...)` or `adapter.getSection(...)` in fork SDK
source outside `profile-output.ts` (which uses a **local** `updateSection`
function, not the adapter method). Implication: Tier 1 covers ~100% of
the manifest section-tuple subset as of ship-Phase-6 state. The
dynamic-anchor gate will find nothing at first run — that's a PASS,
not a gap.

## Property-Based Noun Arbitrary Shapes

| Noun | Source schema file | Key fields | Arbitrary structure hint |
|------|-------------------|------------|-------------------------|
| Phase | `adapters/state-event-types.ts` (RoadmapEvolutionPayload subset) + sibling `src/format/phase.ts:GSDPhase` interface (251 LOC port reference) | `goal`, `depends_on[]`, `requirements[]`, `success_criteria[]`, `tail` (free-form markdown) | `fc.record({ goal: fc.string({ min:1, max:500 }), depends_on: fc.array(fc.integer({ min:1, max:99 })), requirements: fc.array(fc.stringMatching(/^[A-Z]+-\d+$/)), success_criteria: fc.array(fc.string({ min:1 })), tail: fc.string() })` |
| Plan | Plan frontmatter schema (PLAN.md files use `must_haves.truths: []` + `artifacts: [{path, provides}]` per sibling frontmatter.ts escalation note, Plan 06-04 corpus scan) | `must_haves: {truths}`, `waves: [{tasks: [...]}]` | `fc.record({ must_haves: fc.record({ truths: fc.array(fc.string()) }), waves: fc.array(fc.record({ tasks: fc.array(arbTask) })) })` |
| Summary | ROADMAP §phase §summary + `.planning/phases/NN-*/NN-NN-SUMMARY.md` convention | `title`, `outcome`, `tasks_completed[]`, `tail` | `fc.record({ title: fc.string({min:1}), outcome: fc.oneof(fc.constant('complete'), fc.constant('blocked'), fc.constant('partial')), tasks_completed: fc.array(fc.string()), tail: fc.string() })` |
| Uat | `adapters/markdown/index.ts` UAT scaffold patterns | `status`, `gaps[{id, diagnosis}]`, `current_test`, `ship_readiness` | `fc.record({ status: fc.constantFrom('draft', 'running', 'passed', 'failed'), gaps: fc.array(fc.record({ id: fc.nat(), diagnosis: fc.string() })), current_test: fc.string(), ship_readiness: fc.boolean() })` |
| **StateEvent** | `adapters/state-event-types.ts` AppendEvent + MutationEvent + SignalEvent discriminated unions (104 LOC) | Discriminated union: 6 append variants + 4 mutation + 2 signal = 12 top-level cases | `fc.oneof(arbAppendEvent, arbMutationEvent, arbSignalEvent)` — see §Example 5 above. Each variant is `fc.record({ type: fc.constant('<literal>'), payload: arb<Payload> })`. |
| Roadmap | ROADMAP.md structure (phases list + overview + progress table) | `milestone_overview`, `phases: [{num, title, status, plans}]`, `progress_table` | `fc.record({ milestone_overview: fc.string(), phases: fc.array(arbPhaseListEntry, { minLength: 1, maxLength: 15 }), progress_table: fc.string() })` |
| Decision | DECISIONS.md entry shape (`## D-YYYY-MM-DD-NN — title` + body with sections) | `id` (date-based), `title`, `rationale`, `alternatives[]`, `consequences` | `fc.record({ id: fc.stringMatching(/^D-\d{4}-\d{2}-\d{2}-\d{2}$/), title: fc.string({min:1,max:100}), rationale: fc.string(), alternatives: fc.array(fc.string()), consequences: fc.string() })` |
| Blocker | STATE.md `## Blockers` list-item shape (BlockerAddedPayload / BlockerResolvedPayload from state-event-types.ts) | `text` (single line, bullet-list item) | `fc.record({ text: fc.string({minLength:1, maxLength:200}).filter(s => !s.includes('\n')) })` |
| DebugSession | Phase 5 D-04 `.planning/debug/*.md` section pattern (`Symptoms` immutable + `Current Focus` overwrite + `Evidence` append + `Eliminated` append + `Resolution` overwrite + `Specialist Review` append) | `slug`, `symptoms`, `current_focus`, `evidence[]`, `eliminated[]`, `resolution?`, `specialist_reviews[]` | `fc.record({ slug: fc.stringMatching(/^[a-z0-9-]+$/), symptoms: fc.string({min:1}), current_focus: fc.string(), evidence: fc.array(fc.string()), eliminated: fc.array(fc.string()), resolution: fc.option(fc.string()), specialist_reviews: fc.array(fc.string()) })` |
| Project | PROJECT.md structure (Validated / Active / Out-of-Scope / Decisions blocks) | `validated: [{name, criteria[]}]`, `active[]`, `out_of_scope[]`, `decisions[]` | `fc.record({ validated: fc.array(arbValidatedEntry), active: fc.array(fc.string()), out_of_scope: fc.array(fc.string()), decisions: fc.array(fc.string()) })` |
| Spec | SPEC.md structure (problem / constraints / approach / trade-offs) | `problem`, `constraints[]`, `approach`, `tradeoffs[]` | `fc.record({ problem: fc.string({min:1}), constraints: fc.array(fc.string()), approach: fc.string(), tradeoffs: fc.array(fc.string()) })` |
| AiSpec | AI-SPEC.md three-section shape (gsd-domain-researcher / gsd-ai-researcher / gsd-eval-planner) | `domain_section`, `ai_section`, `eval_section` | `fc.record({ domain_section: fc.string(), ai_section: fc.string(), eval_section: fc.string() })` |

**Recommended caps:** `fc.option.fc.maxLength(50)` on arrays; `fc.string({
maxLength: 500 })` on free-form body text. Shrinking output should stay
under 100 lines for readable failure reports.

**The 12-noun catalog is the v1.0 freeze.** If a future phase adds a
noun, the meta-test CI gate fails because no manifest entry exists; the
phase's work includes authoring the arbitrary and the manifest entry.

## `bd install` CI Patterns (D-03)

### Installation approach

bd is distributed via **GitHub release tarballs** [VERIFIED: sibling's
`package.json:engines.bd.note` cites v1.0.4 as the minimum; sibling's
existing test harness at `/Volumes/code/gsd-beads/tests/fixture.ts`
successfully spawns `bd init --from-jsonl` which requires local install]
and **Homebrew** on macOS [VERIFIED: local dev machine has
`/opt/homebrew/bin/bd` shipped via Homebrew; `bd --version` returns
`bd version 1.0.4 (Homebrew)`].

No official apt/yum packages exist as of 2026-05-12 [ASSUMED — no direct
verification, but sibling's engine note describes "release binary"
distribution, not a package manager].

### Recommended CI step (Ubuntu, GitHub Actions style)

```yaml
# Source: design synthesis + sibling CLAUDE.md bd install notes.
# .github/workflows/ci.yml (partial)

- name: Install bd (release tarball)
  if: runner.os == 'Linux'
  run: |
    BD_VERSION=1.0.4
    BD_URL="https://github.com/<bd-org>/beads/releases/download/v${BD_VERSION}/bd-linux-amd64.tar.gz"
    curl -L -o /tmp/bd.tar.gz "$BD_URL"
    sudo tar -xzf /tmp/bd.tar.gz -C /usr/local/bin
    bd --version  # gate — fails job if install botched

- name: Install bd (Homebrew on macOS)
  if: runner.os == 'macOS'
  run: |
    brew install bd || brew upgrade bd
    bd --version
```

**Pin strategy:** `BD_VERSION=1.0.4` — exact pin. Rationale: sibling's
`engines.bd.minVersion: 1.0.4` + Phase 6 SPIKE-RESULTS identified that
the `bd list --json --all` empty-store sentinel changed shape between
1.0.3 and 1.0.4 (Deferred-03). Pinning to a known-good version is
cheap; unpinning lets an upstream bd release break the fork's CI
silently.

**Confidence:** MEDIUM on the exact release URL template —
`<bd-org>/beads` is the canonical GitHub org per bd's own README conventions
but I did NOT fetch the actual release list during this research.
[ASSUMED: URL shape follows standard GitHub release tarball convention.]
Before Plan 4+ lands, the planner should `curl -I` against the actual
release tarball URL to verify the path and then lock.

### Cache strategy

GitHub Actions cache for bd binary — optional, saves ~5s per job:

```yaml
- name: Cache bd
  uses: actions/cache@v4
  with:
    path: /usr/local/bin/bd
    key: bd-1.0.4-${{ runner.os }}
```

**Recommend skipping cache for first CI landing** — keeps the workflow
simple; optimize later if CI runtime becomes a bottleneck.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `jsverify` for TS property testing | `fast-check` | ~2019 onward; `jsverify` last published 2017, repository archived 2020 [CITED: https://github.com/jsverify/jsverify] | Use `fast-check` unconditionally. |
| Raw `fc.assert()` inside `it()` | `@fast-check/vitest` `it.prop(arbs)(name, prop)` | `@fast-check/vitest` v0.1 shipped 2024 [ASSUMED — CHANGELOG not fetched] | Cleaner integration with vitest reporter. |
| Runtime reflection over test files | Test-code-owned `Set<string>` registered via wrapper | Phase 7 design (this research) | Portable across vitest major versions. |
| `cp -r` + diff for rollback tests | Adapter-owned `withTransaction` with per-adapter snapshot mechanism | Phase 5 D-01 (shadow-dir journal on MarkdownAdapter); Phase 6 D-TXN Outcome A (in-memory buffer on BeadsAdapter) | Phase 7 consumes these; does not re-author. |
| bd v1.0.3 with `--from-jsonl <path>` | bd v1.0.4 with boolean `--from-jsonl` + pre-staged `.beads/issues.jsonl` | bd 1.0.4 release per Phase 6 STATE.md DEV-CLI-FLAGS-BD-V1.0.4 decision | Sibling fixture already fixed; testing factory preserves pattern. |

**Deprecated/outdated:**
- `jsverify` — archived 2020; don't use.
- bd v1.0.3 `{error, schema_version}` empty-store sentinel — only bd
  v1.0.3; v1.0.4+ emits `[]`. BdRunner's Landmine-7 detection may need
  both-shape handling (Deferred-03) but Phase 7 inherits sibling's
  Plan 06-02/06-05 resolution — not Phase 7 scope.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bd` CLI | D-03 paired tests (BeadsAdapter side) | ✓ (local) | 1.0.4 (Homebrew) | Skip-with-warning when absent locally; CI must install. |
| `node` | All tests | ✓ | 22.x+ (fork requires `>=22.0.0`; sibling also) | — |
| `git` | BeadsAdapter conformance factory (`git init` per Landmine 9 prerequisite) | ✓ (assumed on all CI + dev) | Any recent | — |
| `ripgrep` (`rg`) | D-08 grep script | ✓ (local, via Homebrew) | 14.1.1 | Fallback to `grep -rE` if rg absent on CI runner — same regex syntax works with POSIX ERE with minor tweaks. Node script should detect and branch. |
| `npm` | Dev deps install | ✓ | 11.x+ | — |
| `typescript`/`tsc` | Sibling build (compiles `src/testing/`) | ✓ | Already devDep in sibling `^5` | — |
| `vitest` | Test runner | ✓ | `^4.1.6` (fork sdk node_modules + sibling direct devDep) | — |

**Missing dependencies with no fallback:**
- bd absent from CI → paired BeadsAdapter suite cannot run. CI install
  step is MANDATORY per D-03.

**Missing dependencies with fallback:**
- `rg` absent from CI → grep script falls back to `grep -rE` (POSIX ERE
  equivalent regex). Recommend the grep script auto-detect:

```javascript
const gr = spawnSync('rg', ['--version']).status === 0 ? 'rg' : 'grep';
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.6 (already shipped fork + sibling) |
| Config file | `/Volumes/code/get-shit-done/vitest.conformance.config.ts` (existing; Phase 7 extends globs) |
| Quick run command | `npm run test:conformance` (existing — MarkdownAdapter-only) |
| Full suite command | `npm run test:conformance:paired` (NEW — Phase 7 adds) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONFORM-01 | Every Bin B method paired test asserts equivalent outcomes | integration | `npm run test:conformance:paired -- --reporter=verbose tests/conformance/paired.test.ts` | ❌ Wave 2 |
| CONFORM-01 | Meta-coverage (manifest ↔ describe bidirectional) | meta | `npm run test:conformance:paired -- tests/conformance/meta-coverage.test.ts` | ❌ Wave 0 |
| CONFORM-02 | Noun round-trip property tests (12 nouns × 2 adapters) | property | `npm run test:conformance:paired -- tests/conformance/properties.test.ts` | ❌ Wave 3 |
| CONFORM-02 | New-noun CI gate | meta | (subsumed by meta-coverage bidirectional check) | ❌ Wave 0 |
| CONFORM-03 | Section-semantics matrix per tuple | integration | `npm run test:conformance:paired -- tests/conformance/paired.test.ts -t 'section-tuple'` | ❌ Wave 0 (anchor grep) + Wave 2 (assertions) |
| CONFORM-03 | Harness rejects adapter without defined semantic | meta | (subsumed by meta-coverage's `expected.<adapterName>` required check) | ❌ Wave 0 |
| CONFORM-04 | Mid-txn failure → byte-identical rollback (markdown) | integration | `npm run test:conformance:paired -- tests/conformance/failure-injection.test.ts -t markdown` | ❌ Wave 3 |
| CONFORM-04 | Mid-txn failure → record-identical rollback (beads) OR documented known-gap | integration | `npm run test:conformance:paired -- tests/conformance/failure-injection.test.ts -t beads` | ❌ Wave 3 |

### Sampling Rate

- **Per task commit:** `npm run test:conformance` (fast — MarkdownAdapter only, no bd; existing).
- **Per wave merge:** `npm run test:conformance:paired` (full — both adapters + property + failure-injection; requires bd locally OR skip-with-warning).
- **Phase gate:** Full suite green before `/gsd-verify-work` executes. CI is the authoritative surface.

### Wave 0 Gaps

- [ ] `/Volumes/code/get-shit-done/tests/conformance/manifest-types.ts` — type definitions
- [ ] `/Volumes/code/get-shit-done/tests/conformance/manifest.ts` — CONFORMANCE_MANIFEST const
- [ ] `/Volumes/code/get-shit-done/tests/conformance/test-registry.ts` — registration Set + assertFromManifest helper
- [ ] `/Volumes/code/get-shit-done/tests/conformance/meta-coverage.test.ts` — bidirectional test
- [ ] `/Volumes/code/get-shit-done/scripts/extract-section-anchors.mjs` — D-08 grep script + dynamic-anchor gate
- [ ] `/Volumes/code/get-shit-done/.github/workflows/ci.yml` — bd install step (if workflow exists, EDIT; else NEW)
- [ ] Framework: NONE — vitest + node:crypto + node:fs all already present.

## Plan Wave Structure Recommendation

**Total plans recommended: 6, organized in 4 waves.**

```
Wave 0 (foundation — fork-only, no sibling dep, no bd required)
├── Plan 07-01: Contract extension + manifest scaffold
│   ├── objective: Add normalize() to StorageAdapter contract + MarkdownAdapter
│   │   impl; author CONFORMANCE_MANIFEST skeleton + ManifestEntry types +
│   │   test-registry helper; author ADR D-2026-05-12-NORMALIZE in DECISIONS.md
│   │   citing D-2026-05-12-OQ06-CAPS precedent.
│   ├── wave: 0
│   ├── depends_on: []
│   ├── files_modified:
│   │   • adapters/types.ts (add normalize() signature)
│   │   • adapters/markdown/index.ts (add normalize = identity)
│   │   • adapters/markdown/index.test.ts (add normalize identity test)
│   │   • tests/conformance/manifest-types.ts (NEW)
│   │   • tests/conformance/manifest.ts (NEW, skeleton only — 0 entries)
│   │   • tests/conformance/test-registry.ts (NEW)
│   │   • .planning/DECISIONS.md (append D-2026-05-12-NORMALIZE ADR)
│   ├── requirements: [CONFORM-01, CONFORM-02]

├── Plan 07-02: Section-anchor grep script + meta-coverage test (fork-only)
│   ├── objective: Author scripts/extract-section-anchors.mjs with string-
│   │   literal + internal-literal + dynamic-anchor passes; author
│   │   meta-coverage.test.ts that cross-checks CONFORMANCE_MANIFEST
│   │   against registeredTests Set. Script emits manifest-ready JSON +
│   │   gate file; CI runs script BEFORE vitest.
│   ├── wave: 0
│   ├── depends_on: [Plan 07-01]   # needs manifest + test-registry
│   ├── files_modified:
│   │   • scripts/extract-section-anchors.mjs (NEW)
│   │   • tests/conformance/meta-coverage.test.ts (NEW)
│   │   • tests/conformance/.generated/.gitignore (NEW — ignore generated)
│   │   • package.json (add prebuild:conformance script)
│   ├── requirements: [CONFORM-01, CONFORM-03]

Wave 1 (sibling bridge — sibling repo + fork devDep wire)
├── Plan 07-03: Sibling ./testing subpath export + BeadsAdapter normalize
│   ├── objective: Extract sibling factory from tests/conformance.test.ts to
│   │   src/testing/conformance-factory.ts; add "./testing" export to
│   │   sibling package.json; implement BeadsAdapter.normalize() composing
│   │   parseFrontmatter + formatFrontmatter round-trip; delete sibling
│   │   tests/conformance.test.ts per D-05; update sibling CLAUDE.md +
│   │   README.md to document the new subpath.
│   ├── wave: 1
│   ├── depends_on: [Plan 07-01]   # needs normalize() on the contract type
│   ├── files_modified (SIBLING):
│   │   • /Volumes/code/gsd-beads/src/testing/conformance-factory.ts (NEW)
│   │   • /Volumes/code/gsd-beads/src/index.ts (add normalize method)
│   │   • /Volumes/code/gsd-beads/package.json (add ./testing export)
│   │   • /Volumes/code/gsd-beads/tests/conformance.test.ts (DELETE)
│   │   • /Volumes/code/gsd-beads/tests/smoke/normalize.test.ts (NEW; fixture coverage)
│   │   • /Volumes/code/gsd-beads/README.md + CLAUDE.md (docs)
│   ├── requirements: [CONFORM-01, CONFORM-02]

Wave 2 (paired wiring — fork pulls sibling in)
├── Plan 07-04: devDep wire + bd CI + paired harness invocation
│   ├── objective: Add "gsd-beads": "file:../gsd-beads" to fork devDeps;
│   │   add test:conformance:paired script; author paired.test.ts that
│   │   invokes runAdapterConformanceSuite twice (markdown + beads) with
│   │   bd-present probe + skip-with-warning; CI workflow adds bd install
│   │   step for Ubuntu + macOS runners; write-outcome.test.ts +
│   │   write-events.test.ts + write-transaction.test.ts migrated INTO
│   │   runAdapterConformanceSuite so they run against both adapters
│   │   (per Pitfall 7 resolution); manifest populated with the 16
│   │   StateWriteOutcome cases × 2 adapters + D-07 deviations cited.
│   ├── wave: 2
│   ├── depends_on: [Plan 07-02, Plan 07-03]  # needs manifest+meta + sibling ./testing
│   ├── files_modified:
│   │   • package.json (devDep + test script)
│   │   • tests/conformance/paired.test.ts (NEW)
│   │   • tests/conformance/write-outcome.test.ts (refactor into harness)
│   │   • tests/conformance/write-events.test.ts (refactor into harness)
│   │   • tests/conformance/write-transaction.test.ts (refactor into harness)
│   │   • tests/conformance/manifest.ts (populate ~20 StateWriteOutcome entries)
│   │   • .github/workflows/ci.yml (NEW or EDIT: bd install + matrix)
│   │   • vitest.conformance.config.ts (add paired glob)
│   ├── requirements: [CONFORM-01, CONFORM-03]

Wave 3 (advanced coverage — property + failure-injection)
├── Plan 07-05: Property-based arbitraries + round-trip tests (12 nouns)
│   ├── objective: Author 12 arbitrary files + properties.test.ts with
│   │   adaptive time budget (D-14); each noun arb + property test ×
│   │   2 adapters = 24 test nodes; meta-coverage validates 24
│   │   registered entries; normalize()-modulo equality assertion per
│   │   CONTEXT.md D-13.
│   ├── wave: 3
│   ├── depends_on: [Plan 07-04]
│   ├── files_modified:
│   │   • tests/conformance/arbitraries/arbPhase.ts + arbPlan.ts +
│   │     arbSummary.ts + arbUat.ts + arbStateEvent.ts + arbRoadmap.ts +
│   │     arbDecision.ts + arbBlocker.ts + arbDebugSession.ts +
│   │     arbProject.ts + arbSpec.ts + arbAiSpec.ts (12 NEW)
│   │   • tests/conformance/properties.test.ts (NEW)
│   │   • tests/conformance/manifest.ts (append 12 noun-roundtrip entries × 2 adapters)
│   ├── requirements: [CONFORM-02]

├── Plan 07-06: CONFORM-04 failure-injection + rollback diff helpers +
│              Phase 6.1 known-gap manifest entries + phase exit
│   ├── objective: Author rollback-diff.ts helper (hashDir + bd export
│   │   + strip pass); failure-injection.test.ts with markdown byte-
│   │   identical + beads record-identical (throw-before-commit) + beads
│   │   known-gap manifest entry citing D-2026-05-12-OQ06-TXN; verify
│   │   meta-coverage is green; run full paired suite; record phase exit
│   │   summary with the manifest final count + byte-identity
│   │   verification; update PROJECT.md / ROADMAP.md; commit manifest
│   │   entries for Deferred-04 and Deferred-05.
│   ├── wave: 3
│   ├── depends_on: [Plan 07-04]  # can parallel with 07-05
│   ├── files_modified:
│   │   • tests/conformance/rollback-diff.ts (NEW)
│   │   • tests/conformance/failure-injection.test.ts (NEW)
│   │   • tests/conformance/manifest.ts (append rollback entries)
│   │   • .planning/STATE.md (phase exit)
│   │   • .planning/ROADMAP.md (Phase 7 [x])
│   │   • .planning/DECISIONS.md (if planner adds D-CONFORM-MANIFEST ADR
│   │     citing D-07 per CONTEXT.md)
│   ├── requirements: [CONFORM-04]
```

**Wave dependency summary:**
- Wave 0 plans (07-01, 07-02) depend on nothing sibling-side and can
  land in parallel with sibling work.
- Wave 1 (07-03) is sibling-only; starts after 07-01 lands (needs
  `normalize()` in the contract types).
- Wave 2 (07-04) integrates; needs both prior waves.
- Wave 3 (07-05, 07-06) can land in parallel after Wave 2; final phase
  exit is 07-06.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | bd release URL follows `https://github.com/<bd-org>/beads/releases/download/v${VERSION}/bd-<os>-<arch>.tar.gz` | `bd install CI Patterns` | Plan 4 CI step fails; mitigation: `curl -I` probe before merging plan 4. |
| A2 | `@fast-check/vitest` v0.1+ was published before 2024 and provides `it.prop` binding | `State of the Art` | Low — pattern-3 `fc.assert` inside raw `it()` is a trivial fallback that still works. Verify by `npm view @fast-check/vitest time.0.1.0` before committing. |
| A3 | bd v1.0.4 is distributed via Homebrew tap on macOS | `bd install CI Patterns` | Mac dev install works locally (verified via `/opt/homebrew/bin/bd`). CI runs on Ubuntu primarily; macOS CI is nice-to-have not required. |
| A4 | `adapter.updateSection`/`adapter.getSection` dynamic-anchor call sites do NOT exist in fork SDK source today | `Pitfall 5` + `Section-Anchor / Record-Type Sources Tier 3` | Verified via `grep` (returns zero outside tests + types + MarkdownAdapter impl). If a Phase 7-era SDK change introduces a dynamic-anchor caller, the grep gate catches it. |
| A5 | Sibling's `package.json:files` array `"dist"` entry recursively includes `dist/testing/` | `Pitfall 6` | Verify by `npm pack --dry-run` after Plan 07-03 lands. Low risk — tarball inclusion by directory is the default npm behavior. |
| A6 | PLAN.md nested frontmatter (`must_haves.truths: []`) remains supported by sibling's js-yaml-based parseFrontmatter | `arbPlan` row in § 4 | Verified by sibling `src/format/frontmatter.ts` comment cites Plan 06-04 corpus-scan escalation decision. Consistent with fork corpus as of 2026-05-12. |
| A7 | Vitest 4.x's `expect.soft` API is stable across minor releases | `Pattern 3 meta-coverage` | Low — `expect.soft` has been in vitest since 1.0 (vitest is on 4.1.6). Portable via standard vitest API. |
| A8 | `BEADS_ACTOR=seed` discipline (Landmine 11) maintained across ALL bd invocations during a test (not just init) preserves `created_by` byte-identity | `Pitfall 4` | Verified by sibling spike 014 Q4 per skill §9 Landmine 11 + sibling `tests/fixture.ts` and sibling `BdRunner` (already encoded). If a test skips this discipline, the D-11 strip pass can always strip `created_by` too (aggressive option per CONTEXT.md Claude's Discretion). |

**If this table is empty:** not applicable — these 8 assumptions need
verification during Plan 07-01..07-02 ramp-up before CI lands. None
changes the overall architecture.

## Open Questions (RESOLVED)

1. **Which ~2766 LOC of existing MarkdownAdapter-only conformance
   files migrate into `runAdapterConformanceSuite`?**
   - What we know: Pitfall 7 recommends a hybrid — migrate `write-*.ts`
     (already written with Phase 7 in mind per the inline comments at
     `write-events.test.ts:7`, `write-outcome.test.ts`, and
     `write-transaction.test.ts`), leave `phase-reads` / `init-bundlers`
     / `document-reads` on MarkdownAdapter.
   - What's unclear: the precise file-level migration list — specifically
     whether `section-depth.test.ts` (L2/L3/L4 anchor tests, Phase 5
     D-06) runs against BeadsAdapter OR is MarkdownAdapter-scoped given
     BeadsAdapter's section storage is bd description-blob round-trip.
   - Recommendation: planner proposes the migration list in Plan 07-04's
     opening; verifier confirms.
   - **RESOLVED:** Migrate the three `write-*.test.ts` files only
     (`write-outcome.test.ts`, `write-events.test.ts`,
     `write-transaction.test.ts`) into `runAdapterConformanceSuite` per
     Pitfall 7 hybrid; leave `phase-reads.test.ts`,
     `init-bundlers.test.ts`, `document-reads.test.ts`, and
     `section-depth.test.ts` MarkdownAdapter-scoped (BeadsAdapter
     equivalence for reads is satisfied by Bin A primitives; section
     depth is tested end-to-end via the migrated write-*.ts files).
     Migration shipped in Plan 07-04b Task 3.

2. **Exact ADR ID for normalize() — `D-2026-05-12-NORMALIZE` vs.
   `D-2026-05-12-OQ06-NORMALIZE`?**
   - What we know: CONTEXT.md D-13 says "tentatively `D-2026-05-12-
     NORMALIZE`"; DECISIONS.md precedent is ADR ID includes the OQ
     reference when the decision extends a prior OQ resolution.
     `normalize()` is a Phase 7-originated decision, NOT an OQ
     resolution; suggests no -OQ06- infix.
   - Recommendation: use plain `D-2026-05-12-NORMALIZE`. Matches the
     precedent for D-2026-05-10-08 (StateWriteOutcome — also a Phase-
     originated contract ADR with no OQ infix).
   - **RESOLVED:** Use `D-2026-05-12-NORMALIZE` (no `-OQ06-` infix).
     Plan 07-01 Task 2 appends the ADR under this exact ID citing the
     `D-2026-05-12-OQ06-CAPS` precedent without adopting the OQ prefix,
     matching the `D-2026-05-10-08` (StateWriteOutcome) convention for
     phase-originated contract ADRs.

3. **Dynamic-anchor CI gate: what's the allowlist file format?**
   - What we know: CONTEXT.md D-08 says "registered manually in the
     manifest with a justification comment." The manifest already has a
     `description?` field and an `adr?` field — a dynamic-anchor entry
     could look like `{ kind: 'section-tuple', name: 'dynamic:<site>',
     expected: { ... }, adr: '<justification>' }`.
   - What's unclear: whether the allowlist is a SEPARATE file
     (`tests/conformance/manifest-dynamic-anchors.allowlist`) or inline
     in CONFORMANCE_MANIFEST.
   - Recommendation: inline in CONFORMANCE_MANIFEST (keep single source
     of truth per D-06 spirit); introduce a separate file only if
     allowlist grows past 5 entries. As of 2026-05-12 zero entries
     expected (see Assumption A4).
   - **RESOLVED:** Inline in `CONFORMANCE_MANIFEST` — a dynamic-anchor
     caller is registered as a `section-tuple` entry with
     `name: 'dynamic:<site>'` and an `adr` field carrying the
     justification. No separate allowlist file at Phase 7 ship; Plan
     07-02's grep-gate script emits to `dynamic-anchors.warn` and CI
     fails unless every listed site resolves to a matching manifest
     entry. A separate file is reconsidered only if the count exceeds
     5; zero entries expected at first run per Assumption A4.

## Sources

### Primary (HIGH confidence)

- `/Volumes/code/get-shit-done/.planning/phases/07-conformance-test-suite/07-CONTEXT.md` — locked Phase 7 decisions (D-01..D-14)
- `/Volumes/code/get-shit-done/.planning/REQUIREMENTS.md` § CONFORM — CONFORM-01..04 acceptance criteria
- `/Volumes/code/get-shit-done/.planning/ROADMAP.md` § Phase 7 — 4 success criteria SC#1..SC#4
- `/Volumes/code/get-shit-done/.planning/phases/06-beadsadapter-implementation/06-CONTEXT.md` — D-OQ06-CAPS additive-contract precedent (graphEdges), D-MAPPING Outcome A lock, D-TXN Outcome A lock
- `/Volumes/code/get-shit-done/.planning/phases/06-beadsadapter-implementation/deferred-items.md` — Deferred-04, Deferred-05 (CONFORM-04 known-gap context)
- `/Volumes/code/get-shit-done/.planning/phases/05-foundational-primitive-lift/05-CONTEXT.md` — D-01 (shadow-dir journal), D-06 (L2/L3/L4 heading-depth walker), D-09 (updateSection internally withTransaction-wrapped)
- `/Volumes/code/get-shit-done/adapters/types.ts` — locked StorageAdapter contract (Phase 7 adds normalize())
- `/Volumes/code/get-shit-done/adapters/state-event-types.ts` — AppendEvent/MutationEvent/SignalEvent discriminated unions (arbStateEvent source)
- `/Volumes/code/get-shit-done/adapters/markdown/index.ts` — reference implementation; ~1452 LOC; includes all internal section literals (Tier 1 source for § section-anchor tuples)
- `/Volumes/code/get-shit-done/tests/conformance/adapter.conformance.ts` — locked harness signature (89 LOC)
- `/Volumes/code/get-shit-done/tests/conformance/write-outcome.test.ts` — 453 LOC; 16-case StateWriteOutcome matrix (migration target for Plan 07-04)
- `/Volumes/code/get-shit-done/tests/conformance/write-events.test.ts` — 480 LOC
- `/Volumes/code/get-shit-done/tests/conformance/write-transaction.test.ts` — 224 LOC; includes hashDir() helper (Wave 3 byte-diff reuse)
- `/Volumes/code/gsd-beads/tests/conformance.test.ts` — 96 LOC; factory template to extract to ./testing
- `/Volumes/code/gsd-beads/tests/fixture.ts` — 105 LOC; Landmines 9 + 11 discipline encoded
- `/Volumes/code/gsd-beads/package.json` — sibling exports shape (adds `./testing` per D-04)
- `/Volumes/code/gsd-beads/src/index.ts` — BeadsAdapter class (200 LOC); adds normalize() per D-13
- `/Volumes/code/gsd-beads/src/format/section.ts` — parseSection/formatSection (142 LOC)
- `/Volumes/code/gsd-beads/src/format/frontmatter.ts` — parseFrontmatter/formatFrontmatter (104 LOC, uses js-yaml)
- `/Volumes/code/gsd-beads/src/txn.ts` — D-TXN Outcome A impl (341 LOC; documents mid-txn gap at header)
- `/Volumes/code/get-shit-done/.claude/skills/spike-findings-gsd-beads/SKILL.md` — 954 LOC; Landmines 9 + 11 discipline
- `/Volumes/code/get-shit-done/.planning/research/fork-investigation/SYNTHESIS.md` § 4 + § 7 + § 9 — adapter interface, phase scope, risk register (HIGH: section-scoped semantics differ — D-06 + D-08 mitigate)
- `npm view fast-check version` → 4.8.0 (VERIFIED 2026-05-11)
- `npm view @fast-check/vitest version` → 0.4.1 (VERIFIED 2026-05-11)
- `/Volumes/code/get-shit-done/package.json` — fork exports `./conformance` subpath already wired (Phase 6)

### Secondary (MEDIUM confidence)

- fast-check docs `runners` section [CITED: fast-check.dev/docs/core-blocks/runners] — `interruptAfterTimeLimit`, `endOnFailure`, `numRuns: Infinity` behavior
- `@fast-check/vitest` README [CITED: github.com/dubzzz/fast-check/tree/main/packages/vitest] — `it.prop(arbs)(name, prop)` API surface
- Vitest docs `expect.soft` [CITED: vitest.dev/api/expect.html#expect-soft] — multi-assertion collection

### Tertiary (LOW confidence)

- Exact bd release URL template `<bd-org>/beads/releases/...` [ASSUMED — follows GitHub release tarball convention; verify pre-merge per Assumption A1]
- bd's macOS Homebrew formula name [ASSUMED — local `bd version 1.0.4 (Homebrew)` suggests tap exists; verify pre-merge per Assumption A3]
- `@fast-check/vitest` v0.1 publish date [ASSUMED — not fetched; pattern 3 fallback works either way]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — fast-check + vitest + `@fast-check/vitest` all verified on npm 2026-05-11; sibling + fork already use vitest; `js-yaml` already shipped sibling-side; no new languages or build systems.
- Architecture: HIGH — manifest + bidirectional meta-coverage is a standard pattern; paired harness invocation is a straight mirror of sibling's already-working pattern; D-08 grep script has ripgrep + fallback to `grep -rE`.
- Pitfalls: HIGH — 6 of 8 pitfalls sourced directly from CONTEXT.md D-07/D-09/D-11 or Phase 6 deferred-items evidence; Pitfall 1 (sparse call sites) and Pitfall 7 (migration scope) are original but verified via grep.
- CI shape: MEDIUM — bd install step is correct in spirit; exact release URL path is an assumption to verify before Plan 07-04 lands.

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (30 days). Most assumptions verify trivially;
exact bd release URL is the one item that needs pre-merge re-check if
bd publishes a 1.0.5+ in that window.

## RESEARCH COMPLETE

Phase 7 is an enforcement-and-wiring phase on top of locked architecture.
The planner should focus on: (1) sequencing the 6 plans across 4 waves so
Wave 0 manifest+meta+anchor-grep lands WITHOUT the sibling (fork-only)
and unlocks Wave 1's sibling-side `./testing` export; (2) deciding the
exact ~3 files from the existing 2766-LOC conformance corpus to migrate
into `runAdapterConformanceSuite` in Plan 07-04 (recommended: the three
`write-*.test.ts` files that already advertise Phase 7 migration in their
headers, per Pitfall 7); (3) authoring 12 per-noun arbitraries that
respect each noun's already-frozen schema shape per the § Property-Based
Noun Arbitrary Shapes table; (4) confirming Assumption A1 (bd release
URL) before Plan 07-04's CI step lands. The grep script will surface zero
dynamic-anchor call sites at first run — that's a pass, and it leaves
the manifest section-tuple subset small (~9 literals from MarkdownAdapter
internals). Everything about section semantics falls out of MarkdownAdapter's
existing recordState* helpers plus the Phase 5 L2/L3/L4 walker —
BeadsAdapter's equivalent is bd description-blob re-parse (D-MAPPING
Outcome A), so the `expected.beads` side of each section-tuple entry
asserts the *normalized* body matches, not byte-identity.
