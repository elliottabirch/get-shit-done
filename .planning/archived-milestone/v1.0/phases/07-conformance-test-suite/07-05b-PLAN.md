<!-- leak-grep-allow file — generated PLAN.md artifact; @.planning/* context refs are consumed by executor via SDK, not auto-loaded by skills -->
---
phase: 07-conformance-test-suite
plan: 05b
type: execute
wave: 5
depends_on: [05a]
files_modified:
  - tests/conformance/properties.test.ts
  - tests/conformance/manifest.ts
  - package.json
  - vitest.conformance.config.ts
autonomous: true
requirements: [CONFORM-02]
tags: [conformance, property-tests, fast-check, manifest-population]

must_haves:
  truths:
    - "tests/conformance/properties.test.ts runs 12 nouns × 2 adapters = 24 property tests; each uses adaptive time budget (D-14: numRuns: Infinity, interruptAfterTimeLimit: 60_000); vitest per-test timeout: 90_000 (Pitfall 2 budget-headroom)."
    - "Each property asserts `adapter.getRecord(path) === adapter.normalize(encode(value))` — normalize()-modulo equality per D-13."
    - "Every property test calls assertFromManifest + registers with registeredTests; manifest entry kind='noun-roundtrip' has `markdown: { kind: 'identity-equal' }` and `beads: { kind: 'normalize-modulo-equal' }`."
    - "CONFORMANCE_MANIFEST gains 12 new noun-roundtrip entries (one per noun in the D-12 catalog); total manifest entries now ≥ 42 (30 from 07-04b + 12 from this plan)."
    - "Meta-coverage test green after manifest population (24 new noun-roundtrip keys registered; 12 new manifest entries)."
    - "test:conformance:paired script extended with tests/conformance/properties.test.ts."
    - "Shrinking output stays under 100 lines per Claude's Discretion / RESEARCH §Property-Based Noun Arbitrary Shapes caps."
    - "Full paired suite runtime does NOT regress > 2× relative to 07-04a baseline."
  artifacts:
    - path: "tests/conformance/properties.test.ts"
      provides: "12-noun × 2-adapter round-trip property tests"
      contains: "interruptAfterTimeLimit"
    - path: "tests/conformance/manifest.ts"
      provides: "Appended 12 noun-roundtrip entries"
      contains: "noun-roundtrip"
  key_links:
    - from: "tests/conformance/properties.test.ts"
      to: "tests/conformance/arbitraries/arbStateEvent.ts"
      via: "imports arbStateEvent + 11 other arbs"
      pattern: "from '\\./arbitraries/"
    - from: "tests/conformance/properties.test.ts"
      to: "adapter.normalize"
      via: "each asserts expect(getRecord(p)).toBe(adapter.normalize(encode(value)))"
      pattern: "adapter\\.normalize"
---

<objective>
Wire the 12 arbitraries from Plan 07-05a into a single `properties.test.ts`
runner against both adapters, and append the 12 noun-roundtrip entries
to CONFORMANCE_MANIFEST. Split from original 07-05 so that the arbitrary
authoring (12 new files in 07-05a) and the property-test wiring +
manifest population (this plan) are each ≤ 3 tasks in their own plan
(blocker #3 resolution).

Three outcomes:

1. **properties.test.ts**: 12 nouns × 2 adapters = 24 property tests;
   adaptive budget per D-14; vitest per-test timeout 90_000 per
   Pitfall 2; each test calls `assertFromManifest` for bidirectional
   meta-coverage.

2. **Manifest population**: append 12 `noun-roundtrip` entries — one per
   noun — with `markdown: { kind: 'identity-equal' }` and `beads: {
   kind: 'normalize-modulo-equal' }`.

3. **Script + vitest config extension**: append
   `tests/conformance/properties.test.ts` to `test:conformance:paired`;
   confirm the vitest config picks the file up under its existing glob.

Purpose: CONFORM-02 SC#2 (property-based round-trips pass for every
record type; CI gate on new nouns via meta-coverage).

Output: `npm run test:conformance:paired` green including 24 new
property tests; manifest entry count ≥ 42 total; meta-coverage green
with 24 new registrations.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-conformance-test-suite/07-CONTEXT.md
@.planning/phases/07-conformance-test-suite/07-RESEARCH.md
@.planning/phases/07-conformance-test-suite/07-PATTERNS.md
@adapters/state-event-types.ts
@adapters/types.ts
@tests/conformance/manifest.ts
@tests/conformance/test-registry.ts
@tests/conformance/paired.test.ts

<interfaces>
<!-- From Plan 07-05a: -->
import { arbPhase } from './arbitraries/arbPhase.js';
import { arbPlan } from './arbitraries/arbPlan.js';
// ... 10 more arbs ...
import { encodeFrontmatterDoc } from './arbitraries/encode.js';

<!-- From Plan 07-04a: -->
import { bdPresent, pairedAdapters } from './paired.test.js';
// pairedAdapters: Array<[string, (dir: string) => StorageAdapter]>

<!-- From Plan 07-01: -->
import { assertFromManifest, registeredTests, manifestKey } from './test-registry.js';
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 4: Author properties.test.ts with 12-noun × 2-adapter round-trip coverage + append manifest entries</name>
  <files>tests/conformance/properties.test.ts, tests/conformance/manifest.ts, package.json</files>
  <read_first>
    - /Volumes/code/get-shit-done/tests/conformance/write-outcome.conformance-suite.ts (lines 42-54 — describe + beforeEach pattern; style reference post-07-04b rename)
    - /Volumes/code/get-shit-done/tests/conformance/arbitraries/ (all 12 arb files + encode.ts — confirm exports from 07-05a)
    - /Volumes/code/get-shit-done/tests/conformance/manifest.ts (07-04b output — confirm existing ≥30 entries before appending noun-roundtrip entries)
    - /Volumes/code/get-shit-done/tests/conformance/test-registry.ts (Plan 07-01 output — for assertFromManifest call pattern)
    - /Volumes/code/get-shit-done/tests/conformance/paired.test.ts (07-04a output — note the `bdPresent` + `pairedAdapters` exports; reuse here)
    - /Volumes/code/get-shit-done/.planning/phases/07-conformance-test-suite/07-RESEARCH.md (lines 642-689 Pattern 4 adaptive budget; lines 780-799 Pitfall 2 timeout integration)
    - /Volumes/code/get-shit-done/.planning/phases/07-conformance-test-suite/07-PATTERNS.md (lines 229-285 properties.test.ts shape)
  </read_first>
  <behavior>
    - Property 1 (per noun per adapter): for every `value` generated by `arb<Noun>`, `adapter.getRecord(path) === adapter.normalize(encode(value))`.
    - Property runs with fast-check adaptive budget (D-14): `numRuns: Infinity, interruptAfterTimeLimit: 60_000, endOnFailure: true, markInterruptAsFailure: false`.
    - vitest per-test timeout: `90_000` (Pitfall 2 headroom).
    - Failures shrink to minimum reproducer (fast-check's default behavior; ≤ 100 lines of shrink output per Claude's Discretion).
    - `registeredTests` populated with 24 noun-roundtrip keys (`markdown:noun-roundtrip:<noun>` + `beads:noun-roundtrip:<noun>`).
    - Meta-coverage test green: manifest has 12 noun-roundtrip entries (one per noun), each with `expected.markdown` + `expected.beads`.
  </behavior>
  <action>
    1. **Create `tests/conformance/properties.test.ts`**:
       ```typescript
       /**
        * Phase 7 Plan 07-05b: property-based round-trip tests (CONFORM-02, D-12, D-14).
        *
        * For every noun in the catalog, generate values via its fc.Arbitrary
        * and assert
        *
        *   adapter.getRecord(path) === adapter.normalize(encode(value))
        *
        * Runs against both adapters. MarkdownAdapter's normalize is identity
        * (byte-preserving); BeadsAdapter's normalize composes frontmatter
        * parse/format. Modulo-normalize equality is the correct contract
        * per D-13.
        *
        * Adaptive budget (D-14): numRuns: Infinity + interruptAfterTimeLimit:
        * 60_000 ms per (noun × adapter). Vitest per-test timeout: 90_000 ms
        * (Pitfall 2 headroom). Property tests register with
        * assertFromManifest for bidirectional meta-coverage.
        */
       import { describe, it, beforeEach, afterEach } from 'vitest';
       import { mkdtemp, rm, mkdir } from 'node:fs/promises';
       import { tmpdir } from 'node:os';
       import { join } from 'node:path';
       import fc from 'fast-check';
       import type { StorageAdapter } from '../../adapters/types.js';
       import { assertFromManifest } from './test-registry.js';
       import type { AdapterName } from './manifest-types.js';
       // Reuse the adapter-tuple + bd probe from paired.test.ts (07-04a).
       import { pairedAdapters } from './paired.test.js';

       // --- arbitraries ---
       import { arbPhase } from './arbitraries/arbPhase.js';
       import { arbPlan } from './arbitraries/arbPlan.js';
       import { arbSummary } from './arbitraries/arbSummary.js';
       import { arbUat } from './arbitraries/arbUat.js';
       import { arbStateEvent } from './arbitraries/arbStateEvent.js';
       import { arbRoadmap } from './arbitraries/arbRoadmap.js';
       import { arbDecision } from './arbitraries/arbDecision.js';
       import { arbBlocker } from './arbitraries/arbBlocker.js';
       import { arbDebugSession } from './arbitraries/arbDebugSession.js';
       import { arbProject } from './arbitraries/arbProject.js';
       import { arbSpec } from './arbitraries/arbSpec.js';
       import { arbAiSpec } from './arbitraries/arbAiSpec.js';
       import { encodeFrontmatterDoc } from './arbitraries/encode.js';

       // noun name → arbitrary. Used for table-driven test generation.
       const NOUNS: Array<{ name: string; arb: fc.Arbitrary<unknown>; path: string }> = [
         { name: 'Phase',        arb: arbPhase,        path: 'tmp/phase.md' },
         { name: 'Plan',         arb: arbPlan,         path: 'tmp/plan.md' },
         { name: 'Summary',      arb: arbSummary,      path: 'tmp/summary.md' },
         { name: 'Uat',          arb: arbUat,          path: 'tmp/uat.md' },
         { name: 'StateEvent',   arb: arbStateEvent,   path: 'tmp/state-event.md' },
         { name: 'Roadmap',      arb: arbRoadmap,      path: 'tmp/roadmap.md' },
         { name: 'Decision',     arb: arbDecision,     path: 'tmp/decision.md' },
         { name: 'Blocker',      arb: arbBlocker,      path: 'tmp/blocker.md' },
         { name: 'DebugSession', arb: arbDebugSession, path: 'tmp/debug-session.md' },
         { name: 'Project',      arb: arbProject,      path: 'tmp/project.md' },
         { name: 'Spec',         arb: arbSpec,         path: 'tmp/spec.md' },
         { name: 'AiSpec',       arb: arbAiSpec,       path: 'tmp/ai-spec.md' },
       ];

       for (const [adapterName, adapterFactory] of pairedAdapters) {
         describe(`noun round-trips under normalize() (${adapterName})`, () => {
           let tmpDir: string;
           let adapter: StorageAdapter;

           beforeEach(async () => {
             tmpDir = await mkdtemp(join(tmpdir(), 'gsd-prop-'));
             await mkdir(join(tmpDir, '.planning'), { recursive: true });
             adapter = adapterFactory(tmpDir);
           });

           afterEach(async () => {
             await rm(tmpDir, { recursive: true, force: true });
           });

           for (const { name, arb, path } of NOUNS) {
             it(
               `${name}: getRecord(p) === normalize(encode(value))`,
               async () => {
                 // Register with meta-coverage BEFORE running fc.assert so
                 // a property exhaustion doesn't skip registration.
                 assertFromManifest(
                   adapterName as AdapterName,
                   name,
                   'noun-roundtrip',
                   (_expected) => {
                     // Manifest already validates per-adapter expected; the
                     // actual round-trip assertion is the fc.assert below.
                   },
                 );
                 await fc.assert(
                   fc.asyncProperty(arb, async (value) => {
                     const body = encodeFrontmatterDoc({ noun: name }, JSON.stringify(value));
                     await adapter.putRecord(path, body);
                     const retrieved = await adapter.getRecord(path);
                     const expected = adapter.normalize(body);
                     if (retrieved !== expected) {
                       throw new Error(
                         `round-trip mismatch:\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(retrieved)}`,
                       );
                     }
                   }),
                   {
                     numRuns: Number.POSITIVE_INFINITY,
                     endOnFailure: true,
                     interruptAfterTimeLimit: 60_000,
                     markInterruptAsFailure: false,
                     verbose: true,
                   },
                 );
               },
               { timeout: 90_000 },
             );
           }
         });
       }
       ```

    2. **Append to `tests/conformance/manifest.ts`**: Add 12 `noun-roundtrip` entries before the closing `] as const;`. Use this template:
       ```typescript
       // ... existing entries from 07-04b ...

         // ========================================================================
         // Property-based round-trip entries (CONFORM-02, D-12 + D-13)
         // MarkdownAdapter: identity-equal (byte-preserving storage).
         // BeadsAdapter:    normalize-modulo-equal (frontmatter round-trip via
         //                   parseFrontmatter + formatFrontmatter; idempotent).
         // ========================================================================
         { kind: 'noun-roundtrip', name: 'Phase',
           expected: { markdown: { kind: 'identity-equal' }, beads: { kind: 'normalize-modulo-equal' } } },
         { kind: 'noun-roundtrip', name: 'Plan',
           expected: { markdown: { kind: 'identity-equal' }, beads: { kind: 'normalize-modulo-equal' } } },
         { kind: 'noun-roundtrip', name: 'Summary',
           expected: { markdown: { kind: 'identity-equal' }, beads: { kind: 'normalize-modulo-equal' } } },
         { kind: 'noun-roundtrip', name: 'Uat',
           expected: { markdown: { kind: 'identity-equal' }, beads: { kind: 'normalize-modulo-equal' } } },
         { kind: 'noun-roundtrip', name: 'StateEvent',
           expected: { markdown: { kind: 'identity-equal' }, beads: { kind: 'normalize-modulo-equal' } } },
         { kind: 'noun-roundtrip', name: 'Roadmap',
           expected: { markdown: { kind: 'identity-equal' }, beads: { kind: 'normalize-modulo-equal' } } },
         { kind: 'noun-roundtrip', name: 'Decision',
           expected: { markdown: { kind: 'identity-equal' }, beads: { kind: 'normalize-modulo-equal' } } },
         { kind: 'noun-roundtrip', name: 'Blocker',
           expected: { markdown: { kind: 'identity-equal' }, beads: { kind: 'normalize-modulo-equal' } } },
         { kind: 'noun-roundtrip', name: 'DebugSession',
           expected: { markdown: { kind: 'identity-equal' }, beads: { kind: 'normalize-modulo-equal' } } },
         { kind: 'noun-roundtrip', name: 'Project',
           expected: { markdown: { kind: 'identity-equal' }, beads: { kind: 'normalize-modulo-equal' } } },
         { kind: 'noun-roundtrip', name: 'Spec',
           expected: { markdown: { kind: 'identity-equal' }, beads: { kind: 'normalize-modulo-equal' } } },
         { kind: 'noun-roundtrip', name: 'AiSpec',
           expected: { markdown: { kind: 'identity-equal' }, beads: { kind: 'normalize-modulo-equal' } } },
       ] as const;
       ```

    3. **Update `test:conformance:paired` script in `package.json`**: append `tests/conformance/properties.test.ts` at the end of the file list:
       ```json
       "test:conformance:paired": "NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run --config vitest.conformance.config.ts tests/conformance/paired.test.ts tests/conformance/meta-coverage.test.ts tests/conformance/properties.test.ts",
       ```

    4. **Vitest config audit**: check `vitest.conformance.config.ts`. If `pool` or `maxConcurrency` settings would cause property tests to run in parallel on BeadsAdapter (which has bd cold-start contention), add a comment noting that `properties.test.ts` may want `pool: 'forks'` + `poolOptions: { forks: { singleFork: true } }` if flakes surface. Do NOT change it yet — add only if Task 4 flakes.

    5. Run: `npm run test:conformance:paired -- tests/conformance/properties.test.ts`.
       Expect: 12 property tests on markdown + 12 on beads (if bd present) = 24 total.
       Each should complete well under 60s — typical MarkdownAdapter test runs thousands of iterations in <5s; BeadsAdapter cold-start means ≤50 iterations per 60s budget.
       If a test fails → fast-check shrinks + prints the minimal counter-example. Debug by inspecting the shrunk value vs the body roundtrip (look for js-yaml edge cases like unquoted floats, date coercion, empty-string quoting).

    6. Run the full paired suite: `npm run test:conformance:paired`. Confirm meta-coverage still green.
  </action>
  <verify>
    <automated>npm run test:conformance:paired -- tests/conformance/properties.test.ts tests/conformance/meta-coverage.test.ts</automated>
  </verify>
  <done>
    - `properties.test.ts` runs 12 property tests per adapter.
    - Manifest has 12 new `noun-roundtrip` entries (total grep count of `kind: 'noun-roundtrip'` ≥ 12).
    - Total manifest entry count ≥ 42 (30 from 07-04b + 12 from this plan).
    - `test:conformance:paired` includes properties.test.ts.
    - Meta-coverage test green after manifest + registrations populate.
    - Wall-clock for full paired suite ≤ 90s with bd present on a modern dev machine (Pitfall 2 budget headroom).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| property test → adapter.putRecord | test-time only; tmpDir isolation |
| fast-check generator → adapter | generates in-memory values only; no network / filesystem leakage |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-05b-01 | Denial of Service | property test with unbounded iterations | mitigate | `numRuns: Infinity` bounded by `interruptAfterTimeLimit: 60_000`; vitest `timeout: 90_000` forcibly kills if fast-check hangs. |
| T-07-05b-02 | Tampering | arbitrary generates pathological input (huge strings, deep nesting) | mitigate | All arbitraries cap maxLength at ≤ 500 chars; arrays ≤ 50 items; shrinking bounded to ≤ 100 lines of output. |
| T-07-05b-03 | Information Disclosure | fast-check random seed logged on failure | accept | Seed output is a number; no sensitive data; enables reproduction (net benefit). |
</threat_model>

<verification>
After this plan:
- `npm run test:conformance:paired` green end-to-end (including properties.test.ts).
- 24 new registeredTests keys after a paired run (12 nouns × 2 adapters).
- Meta-coverage test green.
- Total manifest entries ≥ 42 (≥ 30 from 07-04b + 12 noun-roundtrip).
- No wall-clock regression > 2x the Plan 07-04a baseline.
</verification>

<success_criteria>
- All 12 nouns covered by property-based round-trip tests on both adapters.
- Adaptive time budget honored (no test runs > 90s).
- Shrinking works: intentionally-broken test (e.g. temporarily change `normalize` on sibling to swap quote style) produces a ≤ 100-line shrunk counter-example.
- New-noun CI gate functional: adding a new noun requires adding a manifest entry (else meta-coverage fails).
</success_criteria>

<output>
After completion, create `.planning/phases/07-conformance-test-suite/07-05b-SUMMARY.md`
documenting:
- Actual iteration counts observed per noun per adapter (CI log captures).
- Any fast-check shrink artifacts that surfaced BeadsAdapter non-determinism (should be zero; if >0 → fix js-yaml dump discipline in sibling and document).
- Updated manifest entry count (≥ 42).
- Forward pointer: Plan 07-06 adds failure-injection tests + the Phase 7 exit.
</output>
