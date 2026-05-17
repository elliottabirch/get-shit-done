<!-- leak-grep-allow file — generated PLAN.md artifact; @.planning/* context refs are consumed by executor via SDK, not auto-loaded by skills -->
---
phase: 07-conformance-test-suite
plan: 04b
type: execute
wave: 3
depends_on: [04a]
files_modified:
  - tests/conformance/write-outcome.conformance-suite.ts
  - tests/conformance/write-events.conformance-suite.ts
  - tests/conformance/write-transaction.conformance-suite.ts
  - tests/conformance/paired.test.ts
  - tests/conformance/manifest.ts
  - package.json
autonomous: true
requirements: [CONFORM-01, CONFORM-03]
tags: [conformance, harness-migration, manifest-population]

must_haves:
  truths:
    - "`write-outcome.test.ts`, `write-events.test.ts`, `write-transaction.test.ts` migrated from hard-coded MarkdownAdapter construction to `adapterFactory` parameter AND renamed to `*.conformance-suite.ts` so vitest's default `*.test.ts` glob does NOT pick them up directly (WARNING #1 resolution — no double-registration risk)."
    - "`paired.test.ts` invokes `runStateWriteOutcomeSuite`, `runStateEventDispatchSuite`, `runWithTransactionSuite` in the `pairedAdapters` loop from 07-04a — every migrated suite runs against BOTH adapters via the harness (Pitfall 7 hybrid resolution)."
    - "`tests/conformance/manifest.ts` populated with ≥ 30 entries: ≥ 16 StateWriteOutcome binB + 9 section-tuple (STATE.md internal literals from RESEARCH Tier 1 + Pitfall 7) + ≥ 5 baseline binB (getRecord round-trip, stat file/dir/missing, commitPlanningState NOOP). Exact lower bound: 30 entries minimum (not '~16' — meta-coverage verification needs a precise floor)."
    - "Every `created_section` case in the StateWriteOutcome matrix has a corresponding BeadsAdapter `created_section: null` row with `adr: 'D-2026-05-12-OQ06-CREATED-SECTION'`."
    - "`commitPlanningState` entry cites `adr: 'D-2026-05-12-OQ01-BEADS'` (BeadsAdapter NOOP per locked decision)."
    - "`npm run test:conformance:paired` is extended (package.json script updated) to include the migrated suites indirectly via paired.test.ts — no new vitest file entries needed since the suite files use `.conformance-suite.ts` extension and are imported, not auto-collected."
    - "Meta-coverage test passes after migration: every migrated write-*.conformance-suite.ts case has a manifest entry + registration (bidirectional invariant holds)."
  artifacts:
    - path: "tests/conformance/write-outcome.conformance-suite.ts"
      provides: "Migrated StateWriteOutcome matrix (runs on both adapters via factory param; invoked by paired.test.ts)"
      contains: "adapterFactory"
    - path: "tests/conformance/write-events.conformance-suite.ts"
      provides: "Migrated AppendEvent/MutationEvent/SignalEvent dispatch tests"
      contains: "adapterFactory"
    - path: "tests/conformance/write-transaction.conformance-suite.ts"
      provides: "Migrated withTransaction commit/rollback tests"
      contains: "adapterFactory"
    - path: "tests/conformance/manifest.ts"
      provides: "CONFORMANCE_MANIFEST with ≥30 entries populated (StateWriteOutcome + section-tuple + binB baseline)"
      min_lines: 120
  key_links:
    - from: "tests/conformance/paired.test.ts"
      to: "tests/conformance/write-outcome.conformance-suite.ts"
      via: "paired.test.ts imports runStateWriteOutcomeSuite and invokes per adapter"
      pattern: "runStateWriteOutcomeSuite"
    - from: "tests/conformance/write-outcome.conformance-suite.ts"
      to: "tests/conformance/test-registry.ts"
      via: "every assertion routes through assertFromManifest to register for meta-coverage"
      pattern: "assertFromManifest"
---

<objective>
Migrate the three existing MarkdownAdapter-only write-*.test.ts files
into the paired harness and populate CONFORMANCE_MANIFEST with a precise
≥ 30-entry floor (blocker #2 + warning #4 resolution).

Scope split from original 07-04 to satisfy the 5-task blocker threshold
in the checker's scope_sanity review: this plan contains the 1157-LOC
migration + manifest population that was Task 3 + Task 4 of the original.

Three outcomes:

1. **Migrate the three files with rename**: each of the three existing
   `*.test.ts` files (write-outcome 453 LOC, write-events 480 LOC,
   write-transaction 224 LOC) is:
   - Renamed to `*.conformance-suite.ts` (drops `.test.ts` so vitest's
     default collector SKIPS them; they are only executed when
     explicitly imported from `paired.test.ts`). Resolves WARNING #1
     without requiring a vitest `exclude` glob.
   - Refactored to export a named `runXxxSuite(adapterName, adapterFactory)`
     function wrapping the existing describe tree; every
     `new MarkdownAdapter(tmpDir)` becomes `adapterFactory(tmpDir)`;
     every assertion routes through `assertFromManifest(...)` so the
     meta-coverage bidirectional invariant holds.

2. **Extend `paired.test.ts`**: append an import block for the three
   migrated suites + a per-adapter invocation loop using the
   `pairedAdapters` tuple array exported by 07-04a Task 2. Change is
   strictly additive — 07-04a's structure was loop-ready on purpose.

3. **Populate `CONFORMANCE_MANIFEST`**: append:
   - ≥ 16 StateWriteOutcome binB entries (one per describe/it from
     write-outcome.conformance-suite.ts; enumerated programmatically).
   - 9 section-tuple entries (STATE.md literals from RESEARCH Tier 1).
   - ≥ 5 baseline binB entries (getRecord round-trip, stat variants,
     commitPlanningState NOOP per D-OQ01-BEADS).
   - Every `created_section` markdown entry has a paired
     `created_section: null` beads row with `adr: 'D-2026-05-12-OQ06-CREATED-SECTION'`.

Purpose: CONFORM-01 SC#1 (zero failing assertions across both adapters
for every Bin B method in the migrated corpus); CONFORM-03 (section-
semantics matrix populated).

Output: `npm run test:conformance:paired` green locally (with bd) AND on
fork CI; migrated write-*.conformance-suite.ts files run against both
adapters via paired.test.ts; meta-coverage test continues to pass after
manifest population lands.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/07-conformance-test-suite/07-CONTEXT.md
@.planning/phases/07-conformance-test-suite/07-RESEARCH.md
@.planning/phases/07-conformance-test-suite/07-PATTERNS.md
@tests/conformance/adapter.conformance.ts
@tests/conformance/paired.test.ts
@tests/conformance/manifest.ts
@tests/conformance/test-registry.ts

<interfaces>
<!-- From Plan 07-04a paired.test.ts exports: -->
export function bdPresent(): boolean;
export type AdapterFactory = (projectDir: string) => StorageAdapter;
export const pairedAdapters: Array<[string, AdapterFactory]>;

<!-- From Plan 07-01 test-registry + manifest-types: -->
import { assertFromManifest } from './test-registry.js';
import type { AdapterName, ManifestEntry } from './manifest-types.js';
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 3: Migrate write-outcome.test.ts + write-events.test.ts + write-transaction.test.ts to runXxxSuite exports and rename to *.conformance-suite.ts</name>
  <files>tests/conformance/write-outcome.conformance-suite.ts, tests/conformance/write-events.conformance-suite.ts, tests/conformance/write-transaction.conformance-suite.ts, tests/conformance/paired.test.ts</files>
  <read_first>
    - /Volumes/code/get-shit-done/tests/conformance/write-outcome.test.ts (all 453 LOC — the migration target; focus header comment 1-29 with the 16-case StateWriteOutcome matrix declaration + lines 42-80 for the beforeEach refactor target)
    - /Volumes/code/get-shit-done/tests/conformance/write-events.test.ts (all 480 LOC — same migration shape)
    - /Volumes/code/get-shit-done/tests/conformance/write-transaction.test.ts (all 224 LOC — same migration shape; also the analog for failure-injection in Plan 07-06)
    - /Volumes/code/get-shit-done/tests/conformance/adapter.conformance.ts (lines 24-89 — confirm the harness embeds nested describes; migrated files follow Pattern 2 of RESEARCH — parallel exported helper called TWICE from paired.test.ts)
    - /Volumes/code/get-shit-done/tests/conformance/paired.test.ts (07-04a output — confirm `pairedAdapters` + `bdPresent` exports are in place)
    - /Volumes/code/get-shit-done/vitest.conformance.config.ts (confirm the `include` glob is pattern-based on `*.test.ts`; the `.conformance-suite.ts` extension will not match, which is exactly the desired behavior — WARNING #1 resolution)
    - /Volumes/code/get-shit-done/.planning/phases/07-conformance-test-suite/07-RESEARCH.md (lines 899-929 Pitfall 7 migration hybrid rule)
    - /Volumes/code/get-shit-done/.planning/phases/07-conformance-test-suite/07-PATTERNS.md (lines 723-769 migration diff)
  </read_first>
  <behavior>
    - After migration: each of the three files is renamed from `*.test.ts` → `*.conformance-suite.ts` AND exports a named function (e.g. `runStateWriteOutcomeSuite(adapterName, adapterFactory)`) that wraps the existing describe tree; top-level describes receive `(${adapterName})` suffix; each `beforeEach` uses `adapterFactory(tmpDir)` instead of `new MarkdownAdapter(tmpDir)`.
    - `paired.test.ts` invokes the exported function per adapter using the `pairedAdapters` tuple array from 07-04a.
    - Every `it(...)` block in the migrated files continues to pass on MarkdownAdapter (baseline) AND, per D-07, passes on BeadsAdapter except where the manifest documents a deviation (Task 4 populates those deviations; during this task, assertFromManifest will throw-on-missing and drive the manifest population).
    - The `.conformance-suite.ts` extension ensures vitest's default `*.test.ts` collector does NOT auto-run them (so they don't double-register). Resolves checker WARNING #1.
  </behavior>
  <action>
    **Step 1 — Rename + migrate each file.** Use `git mv` if under version control (this repo), else `mv`:
    ```bash
    cd /Volumes/code/get-shit-done
    mv tests/conformance/write-outcome.test.ts   tests/conformance/write-outcome.conformance-suite.ts
    mv tests/conformance/write-events.test.ts    tests/conformance/write-events.conformance-suite.ts
    mv tests/conformance/write-transaction.test.ts tests/conformance/write-transaction.conformance-suite.ts
    ```

    **Step 2 — Refactor each file to export a named suite function.** Apply this common transform to each.

    **Before** (current shape, common across all three — inside the renamed file):
    ```typescript
    import { MarkdownAdapter } from '../../adapters/markdown/index.js';
    // ...imports...
    describe('recordStateAppend outcomes', () => {
      let tmpDir: string;
      let adapter: StorageAdapter;
      beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'gsd-write-outcome-'));
        await mkdir(join(tmpDir, '.planning'), { recursive: true });
        adapter = new MarkdownAdapter(tmpDir);
      });
      afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
      });
      // ... it blocks ...
    });
    ```

    **After** (migrated shape; apply file-by-file):
    ```typescript
    // Remove top-level import of MarkdownAdapter; it's no longer referenced
    // inside the migrated describe. Keep all other imports.
    import type { StorageAdapter } from '../../adapters/types.js';
    import type { AdapterName } from './manifest-types.js';
    import { assertFromManifest } from './test-registry.js';

    /**
     * Phase 7 Plan 07-04b: migrated from MarkdownAdapter-only to accept an
     * adapterFactory parameter. Invoked per adapter from paired.test.ts's
     * `pairedAdapters` loop. Per-adapter expected outcomes live in
     * CONFORMANCE_MANIFEST (Task 4 populates).
     *
     * File renamed from *.test.ts to *.conformance-suite.ts so vitest's
     * default test-file glob does NOT pick it up directly — preventing
     * double-registration (WARNING #1 resolution).
     */
    export function runStateWriteOutcomeSuite(
      adapterName: AdapterName,
      adapterFactory: (projectDir: string) => StorageAdapter,
    ): void {
      describe(`recordStateAppend outcomes (${adapterName})`, () => {
        let tmpDir: string;
        let adapter: StorageAdapter;
        beforeEach(async () => {
          tmpDir = await mkdtemp(join(tmpdir(), 'gsd-write-outcome-'));
          await mkdir(join(tmpDir, '.planning'), { recursive: true });
          adapter = adapterFactory(tmpDir);
        });
        afterEach(async () => {
          await rm(tmpDir, { recursive: true, force: true });
        });
        // ... all existing it blocks, with outcome assertions rewritten
        //     to go through assertFromManifest (see Step 4 below) ...
      });
    }
    ```

    **Apply to all three files**:
    - `write-outcome.conformance-suite.ts` → `runStateWriteOutcomeSuite(adapterName, adapterFactory)`
    - `write-events.conformance-suite.ts` → `runStateEventDispatchSuite(adapterName, adapterFactory)`
    - `write-transaction.conformance-suite.ts` → `runWithTransactionSuite(adapterName, adapterFactory)`

    **Step 3 — Critical constraints**:
    - Every `new MarkdownAdapter(tmpDir)` inside the migrated file → `adapterFactory(tmpDir)`. Use ripgrep to confirm zero remaining MarkdownAdapter constructions in each migrated file.
    - Remove `import { MarkdownAdapter } from '../../adapters/markdown/index.js'` from each migrated file. If some helper sub-test still needs the concrete class (for an assertion unique to MarkdownAdapter), keep the import and make the assertion conditional on `adapterName === 'markdown'`.
    - Each migrated file's `runXxxSuite` function MUST be the ONLY top-level side-effect — no un-parameterized `describe(...)` blocks at module scope. (Otherwise even though the filename now ends in `.conformance-suite.ts`, module execution on import would register describes twice.)
    - Wrap every assertion that differs per adapter in `assertFromManifest(adapterName, entryName, kind, (expected) => { ... })`. Task 4 populates the manifest; during this task, `assertFromManifest` throw-on-missing drives the manifest population (author the test first, then add the manifest entry).

    **Step 4 — Update `paired.test.ts`** to invoke the migrated suites. Append to the END of `tests/conformance/paired.test.ts` (after the existing Plan 07-04a content):
    ```typescript
    // ============================================================================
    // Plan 07-04b: migrated suites invoked per adapter via the pairedAdapters
    // array exported above. Suite files use `.conformance-suite.ts` extension
    // so vitest's default glob skips them — this is the only entry point.
    // ============================================================================
    import { runStateWriteOutcomeSuite } from './write-outcome.conformance-suite.js';
    import { runStateEventDispatchSuite } from './write-events.conformance-suite.js';
    import { runWithTransactionSuite } from './write-transaction.conformance-suite.js';
    import type { AdapterName } from './manifest-types.js';

    for (const [name, factory] of pairedAdapters) {
      runStateWriteOutcomeSuite(name as AdapterName, factory);
      runStateEventDispatchSuite(name as AdapterName, factory);
      runWithTransactionSuite(name as AdapterName, factory);
    }
    ```

    **Step 5 — Confirm the rename resolved the glob issue.** The vitest config glob (from 07-04a audit) is `*.test.ts`. The renamed files with `.conformance-suite.ts` extension do NOT match this glob. Confirm with:
    ```bash
    # Enumerate what vitest would collect under tests/conformance/:
    ls tests/conformance/*.test.ts
    # Should NOT include write-outcome / write-events / write-transaction.
    ```
    If the vitest config has a BROADER glob (e.g. `**/*.{test,spec}.ts`), the rename alone may be insufficient — in that case, add an explicit `exclude: ['**/*.conformance-suite.ts']` entry to `vitest.conformance.config.ts`. Read the config first and apply the minimal fix.

    **Step 6 — Update `test:conformance:paired` script.** In `package.json`, replace the 07-04a baseline script line:
    ```json
    "test:conformance:paired": "NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run --config vitest.conformance.config.ts tests/conformance/paired.test.ts tests/conformance/meta-coverage.test.ts",
    ```
    The list does NOT need to change — `paired.test.ts` now imports the migrated suites, so they are loaded transitively. Verify by running the script and checking vitest's reporter output includes `recordStateAppend outcomes (markdown)` + `recordStateAppend outcomes (beads)` (latter only when bd is present).

    Run `npm run test:conformance:paired` and confirm:
    - Markdown describes run (with `(markdown)` suffix).
    - If bd present: Beads describes run (with `(beads)` suffix); may show some failing it() blocks where manifest entries for per-adapter deviations are missing — that's expected to surface in Task 4.
    - If bd absent: only Markdown describes run.
  </action>
  <verify>
    <automated>test -f tests/conformance/write-outcome.conformance-suite.ts &amp;&amp; test -f tests/conformance/write-events.conformance-suite.ts &amp;&amp; test -f tests/conformance/write-transaction.conformance-suite.ts &amp;&amp; test ! -f tests/conformance/write-outcome.test.ts &amp;&amp; test ! -f tests/conformance/write-events.test.ts &amp;&amp; test ! -f tests/conformance/write-transaction.test.ts &amp;&amp; grep -v '^#' tests/conformance/write-outcome.conformance-suite.ts | grep -c "new MarkdownAdapter(" | grep '^0$' &amp;&amp; grep -c "runStateWriteOutcomeSuite" tests/conformance/paired.test.ts | grep -v '^0$'</automated>
  </verify>
  <done>
    - Each of the 3 files renamed to `*.conformance-suite.ts`; original `.test.ts` files no longer exist.
    - Each exports a named `runXxxSuite(adapterName, adapterFactory)` function.
    - `grep -v '^#' tests/conformance/write-outcome.conformance-suite.ts | grep -c "new MarkdownAdapter("` returns 0 (same for other 2 files).
    - `paired.test.ts` imports + invokes all 3 migrated suites per adapter via the `pairedAdapters` loop.
    - `npm run test:conformance:paired` runs without syntax errors; may show red assertions that Task 4 fixes by populating manifest.
  </done>
</task>

<task type="auto">
  <name>Task 4: Populate CONFORMANCE_MANIFEST with ≥30 entries (StateWriteOutcome matrix + section-tuple + baseline binB)</name>
  <files>tests/conformance/manifest.ts</files>
  <read_first>
    - /Volumes/code/get-shit-done/tests/conformance/write-outcome.conformance-suite.ts (header lines 1-29 — the 16-case matrix enumeration; post-rename)
    - /Volumes/code/get-shit-done/tests/conformance/write-events.conformance-suite.ts (describe + it names — each becomes a manifest entry)
    - /Volumes/code/get-shit-done/tests/conformance/write-transaction.conformance-suite.ts (describe + it names)
    - /Volumes/code/get-shit-done/tests/conformance/.generated/anchors.json (Plan 07-02 output — section-tuple literals to add as section-tuple manifest entries)
    - /Volumes/code/get-shit-done/tests/conformance/manifest-types.ts (Plan 07-01 output — shape reference)
    - /Volumes/code/get-shit-done/.planning/phases/07-conformance-test-suite/07-CONTEXT.md (lines 181-205 D-07 example; lines 207-221 D-09 known-gap example)
    - /Volumes/code/get-shit-done/.planning/phases/07-conformance-test-suite/07-PATTERNS.md (lines 330-411 manifest shape + 16-case matrix header)
    - /Volumes/code/get-shit-done/.planning/phases/07-conformance-test-suite/07-RESEARCH.md (lines 443-521 Pattern 1 deviation examples; lines 1274-1310 section-anchor Tier 1 table)
  </read_first>
  <action>
    **Edit `tests/conformance/manifest.ts`**: Replace the empty array with a populated readonly const with ≥ 30 entries in three labeled blocks.

    **Precise entry-count floor** (WARNING #4 resolution — "≥16" is imprecise):
    - ≥ 16 StateWriteOutcome binB entries (matches the 16-case matrix in write-outcome.conformance-suite.ts).
    - ≥ 9 section-tuple entries (STATE.md literals from RESEARCH Tier 1 table — Decisions Made, Forensic Sessions, Quick Tasks, Blockers, Performance Metrics, Roadmap Evolution, Session Continuity, Pending todos, Deferred Ideas).
    - ≥ 5 baseline binB entries (getRecord round-trip, stat file-kind, stat dir-kind, stat missing-returns-null, commitPlanningState NOOP per D-OQ01-BEADS).
    - **Total floor: 30 entries.** Not "~16 entries" — the meta-coverage test needs a precise floor for regression detection.

    The 16 StateWriteOutcome entries come directly from `write-outcome.conformance-suite.ts` — extract each `describe/it` name as the manifest `name`, the existing `expect(outcome).toEqual({...})` shape as the markdown expected, and the BeadsAdapter variant per D-2026-05-12-OQ06-CREATED-SECTION: beads omits `created_section` → use `created_section: null` (per manifest-types.ts StateOutcomeExpected).

    Example entries (template — complete this pattern for every case surfaced in Task 3's test runs):
    ```typescript
    import type { ManifestEntry } from './manifest-types.js';

    export const CONFORMANCE_MANIFEST: readonly ManifestEntry[] = [
      // ========================================================================
      // Baseline harness sanity (from adapter.conformance.ts:44-82)
      // ========================================================================
      {
        kind: 'binB',
        name: 'getRecord-putRecord:round-trip',
        description: 'putRecord then getRecord returns same body',
        expected: {
          markdown: { kind: 'identity-equal' },
          beads:    { kind: 'normalize-modulo-equal' },
        },
      },
      {
        kind: 'binB',
        name: 'getRecord:missing-path-returns-null',
        expected: {
          markdown: { applied: true },
          beads:    { applied: true },
        },
      },
      {
        kind: 'binB',
        name: 'stat:file-kind',
        expected: { markdown: { applied: true }, beads: { applied: true } },
      },
      {
        kind: 'binB',
        name: 'stat:dir-kind',
        expected: { markdown: { applied: true }, beads: { applied: true } },
      },
      {
        kind: 'binB',
        name: 'stat:missing-returns-null',
        expected: { markdown: { applied: true }, beads: { applied: true } },
      },

      // ========================================================================
      // StateWriteOutcome matrix — 16 cases from Plan 03-06 (write-outcome.conformance-suite.ts)
      // Per D-07, BeadsAdapter Outcome A never emits created_section
      // (cite D-2026-05-12-OQ06-CREATED-SECTION in `adr`).
      // ========================================================================
      {
        kind: 'binB',
        name: 'recordStateAppend:decision:existing-section',
        description: 'decision: applied:true bare when Decisions section exists',
        expected: {
          markdown: { applied: true },
          beads:    { applied: true },
        },
      },
      {
        kind: 'binB',
        name: 'recordStateAppend:decision:scaffold',
        description: 'decision: applied:true + created_section when no Decisions heading',
        expected: {
          markdown: { applied: true, created_section: '## Decisions Made' },
          beads:    { applied: true, created_section: null },
        },
        adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
      },
      {
        kind: 'binB',
        name: 'recordStateAppend:decision:duplicate',
        description: 'decision: applied:false + reason:duplicate',
        expected: {
          markdown: { applied: false, reason: 'duplicate' },
          beads:    { applied: false, reason: 'duplicate' },
        },
      },
      // ... continue for every (family × case) pair in write-outcome.conformance-suite.ts's
      //     16-case matrix. Use the same naming convention:
      //     'recordState<Family>:<payloadType>:<scenario>'.
      //     Scenarios: existing-section, scaffold, duplicate, nothing_to_remove.
      //     For EVERY case where markdown emits created_section, beads MUST
      //     have created_section: null with the OQ06 ADR citation.

      // ========================================================================
      // Event dispatch matrix — 3 families × variants (from write-events.conformance-suite.ts)
      // ========================================================================
      {
        kind: 'binB',
        name: 'recordStateAppend:dispatch:decision-variant',
        expected: { markdown: { applied: true }, beads: { applied: true } },
      },
      // ... one entry per top-level `describe` in write-events.conformance-suite.ts.

      // ========================================================================
      // withTransaction matrix — commit + rollback (from write-transaction.conformance-suite.ts)
      // ========================================================================
      {
        kind: 'binB',
        name: 'withTransaction:commit-persists',
        expected: { markdown: { applied: true }, beads: { applied: true } },
      },
      {
        kind: 'binB',
        name: 'withTransaction:rollback-on-throw',
        expected: { markdown: { applied: true }, beads: { applied: true } },
      },
      // NOTE: the mid-txn byte-identity rollback case is Plan 07-06's
      // failure-injection test; its manifest entry lives there.

      // ========================================================================
      // commitPlanningState — BeadsAdapter NOOP per D-2026-05-12-OQ01-BEADS
      // ========================================================================
      {
        kind: 'binB',
        name: 'commitPlanningState:basic',
        description: 'commitPlanningState invocation — NOOP on bd per D-OQ01-BEADS',
        expected: {
          markdown: { applied: true },
          beads:    { applied: true },  // NOOP; no observable side effect
        },
        adr: 'D-2026-05-12-OQ01-BEADS',
      },

      // ========================================================================
      // Section-tuple matrix — 9 entries from RESEARCH Tier 1 STATE.md literals
      // (must_haves floor: 9 section-tuple entries minimum)
      // ========================================================================
      {
        kind: 'section-tuple',
        name: 'STATE.md#Decisions Made:append',
        expected: {
          markdown: { applied: true, created_section: '## Decisions Made' },
          beads:    { applied: true, created_section: null },
        },
        adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
      },
      {
        kind: 'section-tuple',
        name: 'STATE.md#Forensic Sessions:append',
        expected: {
          markdown: { applied: true, created_section: '## Forensic Sessions' },
          beads:    { applied: true, created_section: null },
        },
        adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
      },
      {
        kind: 'section-tuple',
        name: 'STATE.md#Quick Tasks:append',
        expected: {
          markdown: { applied: true, created_section: '## Quick Tasks' },
          beads:    { applied: true, created_section: null },
        },
        adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
      },
      {
        kind: 'section-tuple',
        name: 'STATE.md#Blockers:append',
        expected: {
          markdown: { applied: true, created_section: '## Blockers' },
          beads:    { applied: true, created_section: null },
        },
        adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
      },
      {
        kind: 'section-tuple',
        name: 'STATE.md#Performance Metrics:append',
        expected: {
          markdown: { applied: true, created_section: '## Performance Metrics' },
          beads:    { applied: true, created_section: null },
        },
        adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
      },
      {
        kind: 'section-tuple',
        name: 'STATE.md#Roadmap Evolution:append',
        expected: {
          markdown: { applied: true, created_section: '### Roadmap Evolution' },
          beads:    { applied: true, created_section: null },
        },
        adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
      },
      {
        kind: 'section-tuple',
        name: 'STATE.md#Session Continuity:overwrite',
        expected: {
          markdown: { applied: true, created_section: '## Session Continuity' },
          beads:    { applied: true, created_section: null },
        },
        adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
      },
      {
        kind: 'section-tuple',
        name: 'STATE.md#Pending todos:overwrite',
        expected: {
          markdown: { applied: true, created_section: '## Pending todos' },
          beads:    { applied: true, created_section: null },
        },
        adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
      },
      {
        kind: 'section-tuple',
        name: 'STATE.md#Deferred Ideas:append',
        expected: {
          markdown: { applied: true, created_section: '## Deferred Ideas' },
          beads:    { applied: true, created_section: null },
        },
        adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
      },
    ] as const;

    export type { ManifestEntry, AdapterName, ExpectedOutcome,
                  StateOutcomeExpected, RollbackOutcomeExpected,
                  RoundTripOutcomeExpected } from './manifest-types.js';
    ```

    **How to enumerate every StateWriteOutcome case (do this programmatically)**:
    ```bash
    # From repo root:
    rg "^\s*it\(" tests/conformance/write-outcome.conformance-suite.ts | head -40
    # Each `it('name', ...)` becomes a `binB` manifest entry with
    # name = "recordState<Family>:<scenario>" derived from the describe hierarchy.
    ```
    Do the same for `write-events.conformance-suite.ts` and `write-transaction.conformance-suite.ts`.

    **Migrate every test block in the 3 migrated files** to call `assertFromManifest` (completes Task 3's partial wiring):
    Inside each `it(...)` in `write-outcome.conformance-suite.ts`, wrap the outcome assertion:
    ```typescript
    // Before:
    expect(outcome).toEqual({ applied: true, created_section: '## Decisions Made' });

    // After:
    assertFromManifest(
      adapterName,
      'recordStateAppend:decision:scaffold',
      'binB',
      (expected) => {
        expect(outcome).toEqual(expected);
      },
    );
    ```
    (This is the step that populates `registeredTests` at test run time.)

    Run the full paired suite:
    ```
    npm run test:conformance:paired
    ```
    Expect:
    - All markdown tests green.
    - All beads tests green (D-07 deviations flow from manifest).
    - Meta-coverage test green (bidirectional invariant holds).
    - Any red assertion surfaces a manifest entry missing or a per-adapter expected mismatch — fix by adding/editing manifest entries or the assertion dispatch.

    **Final entry count check**:
    ```bash
    grep -c "^\s*{" tests/conformance/manifest.ts
    # Must be ≥ 30.
    ```
  </action>
  <verify>
    <automated>npm run test:conformance:paired &amp;&amp; grep -c "^\s*{$\|^\s*{ kind:" tests/conformance/manifest.ts | awk '$1 >= 30 { print "ok"; exit 0 } { print "manifest has "$1" entries, need >= 30"; exit 1 }'</automated>
  </verify>
  <done>
    - `tests/conformance/manifest.ts` non-empty; entry count ≥ 30.
    - Every StateWriteOutcome describe/it in the 3 migrated files has a matching manifest entry (check via meta-coverage — it will fail if any is missing).
    - Every MarkdownAdapter `created_section` case has a corresponding beads `created_section: null` entry with `adr: 'D-2026-05-12-OQ06-CREATED-SECTION'`.
    - `npm run test:conformance:paired` green end-to-end (both adapters, meta-coverage, migrated write-*.conformance-suite.ts files).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| paired.test.ts → migrated suite imports | test-time only; tmpDir isolation inherited from the per-suite beforeEach |
| migrated suite → assertFromManifest | all per-adapter deviation data flows through this single seam |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-04b-01 | Tampering | migrated suite files accidentally caught by vitest default glob (double registration) | mitigate | Filename discipline: `.conformance-suite.ts` extension does NOT match `*.test.ts` glob. Verify audit in Step 5; if config uses broader glob, add explicit `exclude`. |
| T-07-04b-02 | Information Disclosure | manifest entry names leak internal structure | accept | Entry names are already grepped from public test describes; no sensitive info. |
| T-07-04b-03 | Denial of Service | growing manifest slows meta-coverage | accept | meta-coverage is O(entries × adapters) = O(n); at n=30 the cost is microseconds. Scales linearly with catalog growth — not a concern at v1.0. |
</threat_model>

<verification>
Combined after both tasks:
- `npm run test:conformance:paired` green locally with bd installed.
- Meta-coverage test green (bidirectional invariant satisfied after manifest population).
- Migrated write-*.conformance-suite.ts files run against both adapters with D-07 deviations honored.
- Entry count in CONFORMANCE_MANIFEST ≥ 30 (grep-verifiable).
- Original `*.test.ts` files no longer exist (check: `test ! -f tests/conformance/write-outcome.test.ts`).
- vitest does NOT warn "no tests found" for the migrated `.conformance-suite.ts` files (the glob excludes them cleanly).
</verification>

<success_criteria>
- Migrated harness suites run against both adapters via paired.test.ts.
- CONFORMANCE_MANIFEST has ≥ 30 entries covering StateWriteOutcome + 9 section-tuple + baseline binB cases.
- Deviations documented as ADR citations (not skip comments).
- Plans 07-05a / 07-05b / 07-06 can append property-roundtrip + rollback manifest entries on top.
</success_criteria>

<output>
After completion, create `.planning/phases/07-conformance-test-suite/07-04b-SUMMARY.md`
documenting:
- Exact count of manifest entries added (StateWriteOutcome + section-tuple + baseline binB), broken down per kind.
- Any per-adapter deviations discovered during Task 3's migration beyond the expected OQ06-CREATED-SECTION + OQ01-BEADS set — each MUST have an ADR citation.
- Renamed file list (old → new) for the vitest glob audit.
- CI runtime delta measured relative to 07-04a baseline; note any regression > 2×.
- Forward pointer: Plan 07-05a installs fast-check devDeps + 12 arbitraries + encode.ts; Plan 07-05b authors properties.test.ts + populates 12 noun-roundtrip manifest entries; Plan 07-06 adds failure-injection + Phase 7 exit.
</output>
