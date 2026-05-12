<!-- leak-grep-allow file — generated PLAN.md artifact; @.planning/* context refs are consumed by executor via SDK, not auto-loaded by skills -->
---
phase: 07-conformance-test-suite
plan: 05a
type: execute
wave: 4
depends_on: [04b]
files_modified:
  - package.json
  - tests/conformance/arbitraries/arbPhase.ts
  - tests/conformance/arbitraries/arbPlan.ts
  - tests/conformance/arbitraries/arbSummary.ts
  - tests/conformance/arbitraries/arbUat.ts
  - tests/conformance/arbitraries/arbStateEvent.ts
  - tests/conformance/arbitraries/arbRoadmap.ts
  - tests/conformance/arbitraries/arbDecision.ts
  - tests/conformance/arbitraries/arbBlocker.ts
  - tests/conformance/arbitraries/arbDebugSession.ts
  - tests/conformance/arbitraries/arbProject.ts
  - tests/conformance/arbitraries/arbSpec.ts
  - tests/conformance/arbitraries/arbAiSpec.ts
  - tests/conformance/arbitraries/encode.ts
autonomous: true
requirements: [CONFORM-02]
tags: [conformance, fast-check, arbitraries]

must_haves:
  truths:
    - "fast-check + @fast-check/vitest devDeps installed (D-12)."
    - "12 per-noun arbitraries authored in tests/conformance/arbitraries/ (one file per noun per D-12 catalog): arbPhase, arbPlan, arbSummary, arbUat, arbStateEvent, arbRoadmap, arbDecision, arbBlocker, arbDebugSession, arbProject, arbSpec, arbAiSpec."
    - "arbStateEvent mirrors adapters/state-event-types.ts discriminated-union exactly (12 variants across AppendEvent + MutationEvent + SignalEvent)."
    - "encode.ts exports encodeFrontmatterDoc(frontmatter, body) → markdown string."
    - "All authored files typecheck (npm run build:conformance / build exits 0) — no runtime import required to validate shape (WARNING #5 resolution: verify via typecheck, not via doubled-dist import)."
  artifacts:
    - path: "tests/conformance/arbitraries/arbStateEvent.ts"
      provides: "Discriminated-union arbitrary for StateEvent matching adapters/state-event-types.ts"
      contains: "fc.oneof"
    - path: "tests/conformance/arbitraries/encode.ts"
      provides: "Shared encode helper — noun → markdown body"
      contains: "export function encode"
  key_links:
    - from: "tests/conformance/arbitraries/arbStateEvent.ts"
      to: "adapters/state-event-types.ts"
      via: "imports AppendEvent/MutationEvent/SignalEvent types"
      pattern: "state-event-types"
---

<objective>
Install fast-check tooling and author the 12 per-noun arbitraries +
shared encode helper. Split from the original 07-05 to keep the
authoring scope within a single plan (blocker #3 resolution).

Follow-up plan 07-05b authors `properties.test.ts` and populates the 12
noun-roundtrip manifest entries; it runs as a separate plan with
`depends_on: [05a]` so that arbitrary authoring + property-test wiring +
manifest population are each scoped at ≤ 30% context per plan.

Three outcomes:

1. **Install fast-check devDeps**: `fast-check@^4.8.0` +
   `@fast-check/vitest@^0.4.1`. Verify via `npm install` exit-0 and
   presence under `node_modules/`.

2. **Author arbStateEvent.ts + encode.ts**: `arbStateEvent` mirrors the
   discriminated union from `adapters/state-event-types.ts` exactly; the
   shared `encode.ts` helper exports `encodeFrontmatterDoc(frontmatter,
   body) → string` used by 07-05b's property tests.

3. **Author the remaining 11 arbitraries**: one file per noun per D-12,
   using the exact `fc.record(...)` skeletons from RESEARCH §Property-
   Based Noun Arbitrary Shapes.

Purpose: CONFORM-02 prerequisites. The property-test wiring (which
consumes these arbitraries) lives in Plan 07-05b.

Output: 12 arb*.ts files + encode.ts typecheck clean. No property tests
run yet — that's 07-05b.
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

<interfaces>
<!-- From adapters/state-event-types.ts (discriminated-union source for arbStateEvent): -->
export type AppendEvent =
  | { type: 'decision'; payload: DecisionPayload }
  | { type: 'metric'; payload: MetricPayload }
  | { type: 'roadmap_evolution'; payload: RoadmapEvolutionPayload }
  | { type: 'session'; payload: SessionPayload }
  | { type: 'forensic_session'; payload: ForensicSessionPayload }
  | { type: 'quick_task'; payload: QuickTaskPayload };
export type MutationEvent = /* 4 variants */;
export type SignalEvent = /* 2 variants */;
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install fast-check + @fast-check/vitest devDeps</name>
  <files>package.json</files>
  <read_first>
    - /Volumes/code/get-shit-done/package.json (current devDeps block; place fast-check alongside existing entries)
    - /Volumes/code/get-shit-done/vitest.conformance.config.ts (audit — Pitfall 2 requires > 60s for property tests; 07-05b will set per-test timeouts, not global)
    - /Volumes/code/get-shit-done/.planning/phases/07-conformance-test-suite/07-RESEARCH.md (lines 254-301 standard stack; lines 642-688 Pattern 4 adaptive budget; lines 780-799 Pitfall 2 timeout integration)
  </read_first>
  <action>
    1. **Edit `package.json`** devDeps block. Add `fast-check` and `@fast-check/vitest` preserving sort order:
       ```json
         "devDependencies": {
           "@fast-check/vitest": "^0.4.1",
           "c8": "^11.0.0",
           "fast-check": "^4.8.0",
           "gsd-beads": "file:../gsd-beads"
         },
       ```

    2. Run `npm install`. Confirm:
       - `node_modules/fast-check/package.json` exists with version 4.8.x.
       - `node_modules/@fast-check/vitest/package.json` exists with version 0.4.x.
       - No peer-dep warnings indicating incompatibility (fast-check pairs cleanly with vitest 4.x per verification in RESEARCH §Standard Stack).

    3. Do NOT change the global `testTimeout` in `vitest.conformance.config.ts`. Property tests in 07-05b will set their own timeout per-test via `it(..., { timeout: 90_000 })`.
  </action>
  <verify>
    <automated>npm install &amp;&amp; test -f node_modules/fast-check/package.json &amp;&amp; test -f node_modules/@fast-check/vitest/package.json</automated>
  </verify>
  <done>
    - fast-check + @fast-check/vitest resolve from node_modules.
    - package.json devDeps reflect the additions.
    - No regressions in `npm run test:conformance` (existing tests still green).
  </done>
</task>

<task type="auto">
  <name>Task 2: Author arbStateEvent.ts (the discriminated-union arbitrary) + encode.ts helper</name>
  <files>tests/conformance/arbitraries/arbStateEvent.ts, tests/conformance/arbitraries/encode.ts</files>
  <read_first>
    - /Volumes/code/get-shit-done/adapters/state-event-types.ts (full 104 LOC — EXACT source-of-truth for the 12-variant discriminated union)
    - /Volumes/code/get-shit-done/.planning/phases/07-conformance-test-suite/07-RESEARCH.md (lines 1230-1268 Example 5 arbStateEvent)
    - /Volumes/code/get-shit-done/.planning/phases/07-conformance-test-suite/07-PATTERNS.md (lines 287-324 arbStateEvent analog)
  </read_first>
  <action>
    1. **Create `tests/conformance/arbitraries/encode.ts`**:
       ```typescript
       /**
        * Shared encode helper: converts a noun value into a markdown body
        * suitable for adapter.putRecord(path, body). Each noun module may
        * override/extend; this file provides the default shape.
        *
        * For most nouns, the encoding is a YAML frontmatter block + a
        * structured body section. MarkdownAdapter round-trips byte-for-byte
        * (normalize = identity); BeadsAdapter round-trips modulo frontmatter
        * re-serialization (normalize composes parseFrontmatter/formatFrontmatter).
        */

       /** Encode a generic frontmatter + body to a markdown string. */
       export function encodeFrontmatterDoc(
         frontmatter: Record<string, unknown>,
         body: string,
       ): string {
         const yamlLines: string[] = [];
         for (const [key, value] of Object.entries(frontmatter)) {
           yamlLines.push(`${key}: ${JSON.stringify(value)}`);
         }
         return `---\n${yamlLines.join('\n')}\n---\n${body}\n`;
       }
       ```

    2. **Create `tests/conformance/arbitraries/arbStateEvent.ts`** mirroring `adapters/state-event-types.ts` 1-for-1. Read that file first to capture the exact payload shapes for every variant. Structure:
       ```typescript
       /**
        * fast-check arbitrary for the StateEvent discriminated union
        * (AppendEvent | MutationEvent | SignalEvent) from
        * adapters/state-event-types.ts.
        *
        * Each variant's payload generator produces values within the
        * schema's legal ranges. Caps per RESEARCH §Property-Based Noun
        * Arbitrary Shapes: arrays ≤ 50; free-form strings ≤ 500 chars.
        */
       import fc from 'fast-check';
       import type {
         AppendEvent, MutationEvent, SignalEvent,
       } from '../../../adapters/state-event-types.js';

       // ---- AppendEvent variants ----
       const arbDecisionPayload = fc.record({
         phase: fc.string({ minLength: 1, maxLength: 3 }).map((s) => s.padStart(2, '0')),
         summary: fc.string({ minLength: 1, maxLength: 200 }),
         rationale: fc.option(fc.string({ maxLength: 500 })),
       });

       const arbMetricPayload = fc.record({
         phase: fc.stringMatching(/^\d{1,3}$/),
         plan: fc.stringMatching(/^\d{1,3}$/),
         duration: fc.stringMatching(/^\d+[smhd]$/),
         tasks: fc.option(fc.stringMatching(/^\d+$/)),
         files: fc.option(fc.stringMatching(/^\d+$/)),
       });

       // For EACH remaining payload type in state-event-types.ts, author
       // a matching fc.record(...). Reference the exact field list from
       // read_first output; do NOT guess field names.
       const arbRoadmapEvolutionPayload = fc.record({
         phase: fc.stringMatching(/^\d+$/),
         decision: fc.string({ minLength: 1, maxLength: 500 }),
       });

       const arbSessionPayload = fc.record({
         started_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }).map((d) => d.toISOString()),
         ended_at: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }).map((d) => d.toISOString())),
         summary: fc.string({ maxLength: 500 }),
       });

       const arbForensicSessionPayload = fc.record({
         slug: fc.stringMatching(/^[a-z0-9-]{1,40}$/),
         summary: fc.string({ maxLength: 500 }),
       });

       const arbQuickTaskPayload = fc.record({
         task: fc.string({ minLength: 1, maxLength: 200 }),
         status: fc.constantFrom('open', 'done', 'blocked'),
       });

       export const arbAppendEvent: fc.Arbitrary<AppendEvent> = fc.oneof(
         fc.record({ type: fc.constant('decision' as const), payload: arbDecisionPayload }),
         fc.record({ type: fc.constant('metric' as const), payload: arbMetricPayload }),
         fc.record({ type: fc.constant('roadmap_evolution' as const), payload: arbRoadmapEvolutionPayload }),
         fc.record({ type: fc.constant('session' as const), payload: arbSessionPayload }),
         fc.record({ type: fc.constant('forensic_session' as const), payload: arbForensicSessionPayload }),
         fc.record({ type: fc.constant('quick_task' as const), payload: arbQuickTaskPayload }),
       );

       // ---- MutationEvent variants ----
       // Read state-event-types.ts MutationEvent definition and author
       // 4 fc.record variants matching its union. Per RESEARCH §Property-
       // Based Noun Arbitrary Shapes this is 4 top-level cases.

       // ---- SignalEvent variants ----
       // Read state-event-types.ts SignalEvent definition; 2 variants.

       export const arbMutationEvent: fc.Arbitrary<MutationEvent> = fc.oneof(
         // TODO: 4 variants per read_first of adapters/state-event-types.ts
         // MutationEvent union. Example placeholder:
         fc.record({
           type: fc.constant('todo_count_update' as const),
           payload: fc.record({ count: fc.nat({ max: 100 }) }),
         }),
         // ... fill from read_first ...
       );

       export const arbSignalEvent: fc.Arbitrary<SignalEvent> = fc.oneof(
         // TODO: 2 variants per read_first; example placeholder:
         fc.record({
           type: fc.constant('blocker_added' as const),
           payload: fc.record({ text: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => !s.includes('\n')) }),
         }),
         // ... fill from read_first ...
       );

       export const arbStateEvent = fc.oneof(
         arbAppendEvent,
         arbMutationEvent,
         arbSignalEvent,
       );
       ```
       **Before committing**: open `adapters/state-event-types.ts` and confirm EVERY variant in `MutationEvent` + `SignalEvent` appears in the file — do NOT ship placeholders. If any payload type has required fields beyond what the skeleton shows, add them with the matching fc.* generator. fc.date for ISO timestamps, fc.nat/fc.integer for numbers, fc.constantFrom for enums, fc.option for optional fields.

    3. **Compile check** (WARNING #5 resolution — use typecheck, not doubled-dist runtime import):
       ```bash
       npm run build
       ```
       Expect exit 0 with no type errors. This verifies `arbStateEvent.ts` + `encode.ts` compile cleanly without requiring the arbitrary files to be runtime-importable from a built-dist path (the earlier doubled `./tests/conformance/dist/tests/conformance/arbitraries/...` path was incorrect and would not resolve).

       If the repo does not have a `build` script that also typechecks this directory, substitute with:
       ```bash
       npx tsc --noEmit -p tests/conformance/tsconfig.json
       ```
       (Adjust path if the conformance tree has its own tsconfig.)
  </action>
  <verify>
    <automated>npm run build</automated>
  </verify>
  <done>
    - `arbStateEvent.ts` exports `arbAppendEvent`, `arbMutationEvent`, `arbSignalEvent`, `arbStateEvent`.
    - Every variant in adapters/state-event-types.ts has a matching fc.record — no placeholders shipped.
    - `encode.ts` exports `encodeFrontmatterDoc`.
    - `npm run build` (or equivalent typecheck) exits 0.
  </done>
</task>

<task type="auto">
  <name>Task 3: Author the remaining 11 per-noun arbitraries (arbPhase, arbPlan, arbSummary, arbUat, arbRoadmap, arbDecision, arbBlocker, arbDebugSession, arbProject, arbSpec, arbAiSpec)</name>
  <files>tests/conformance/arbitraries/arbPhase.ts, tests/conformance/arbitraries/arbPlan.ts, tests/conformance/arbitraries/arbSummary.ts, tests/conformance/arbitraries/arbUat.ts, tests/conformance/arbitraries/arbRoadmap.ts, tests/conformance/arbitraries/arbDecision.ts, tests/conformance/arbitraries/arbBlocker.ts, tests/conformance/arbitraries/arbDebugSession.ts, tests/conformance/arbitraries/arbProject.ts, tests/conformance/arbitraries/arbSpec.ts, tests/conformance/arbitraries/arbAiSpec.ts</files>
  <read_first>
    - /Volumes/code/get-shit-done/.planning/phases/07-conformance-test-suite/07-RESEARCH.md (lines 1311-1334 Property-Based Noun Arbitrary Shapes table — EVERY row has a pre-authored `fc.record(...)` skeleton; copy each skeleton verbatim into the corresponding file)
    - /Volumes/code/gsd-beads/src/format/schemas/phase.ts (if BeadsAdapter already ported a schema, mirror field names)
    - /Volumes/code/gsd-beads/src/format/schemas/plan.ts
    - /Volumes/code/gsd-beads/src/format/schemas/uat.ts
    - /Volumes/code/gsd-beads/src/format/schemas/debug-session.ts
    - /Volumes/code/gsd-beads/src/format/schemas/decisions.ts
    - /Volumes/code/gsd-beads/src/format/schemas/spec.ts
    - /Volumes/code/gsd-beads/src/format/schemas/ai-spec.ts
    - /Volumes/code/gsd-beads/src/format/schemas/roadmap.ts
    - /Volumes/code/gsd-beads/src/format/schemas/project.ts
  </read_first>
  <action>
    Author one file per noun. Use this template for each:

    ```typescript
    /**
     * fast-check arbitrary for <Noun> records.
     *
     * Schema source: <cite sibling schema file or RESEARCH table row>
     * Caps: arrays ≤ 50, free-form text ≤ 500 chars (RESEARCH cap).
     */
    import fc from 'fast-check';

    export const arb<Noun> = fc.record({ /* fields per RESEARCH table row */ });
    ```

    Specific entries (copy each fc.record skeleton verbatim from RESEARCH §Property-Based Noun Arbitrary Shapes table — the skeletons are already authored for every noun):

    1. **`arbPhase.ts`** — RESEARCH row for "Phase":
       ```typescript
       import fc from 'fast-check';
       export const arbPhase = fc.record({
         goal: fc.string({ minLength: 1, maxLength: 500 }),
         depends_on: fc.array(fc.integer({ min: 1, max: 99 }), { maxLength: 50 }),
         requirements: fc.array(fc.stringMatching(/^[A-Z]+-\d+$/), { maxLength: 50 }),
         success_criteria: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { maxLength: 50 }),
         tail: fc.string({ maxLength: 500 }),
       });
       ```

    2. **`arbPlan.ts`** — Plan frontmatter with `must_haves.truths` + `waves`:
       ```typescript
       import fc from 'fast-check';
       const arbTask = fc.record({
         name: fc.string({ minLength: 1, maxLength: 100 }),
         action: fc.string({ maxLength: 500 }),
       });
       export const arbPlan = fc.record({
         must_haves: fc.record({
           truths: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { maxLength: 20 }),
         }),
         waves: fc.array(fc.record({ tasks: fc.array(arbTask, { maxLength: 5 }) }), { maxLength: 5 }),
       });
       ```

    3. **`arbSummary.ts`**:
       ```typescript
       import fc from 'fast-check';
       export const arbSummary = fc.record({
         title: fc.string({ minLength: 1, maxLength: 100 }),
         outcome: fc.constantFrom('complete', 'blocked', 'partial'),
         tasks_completed: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { maxLength: 20 }),
         tail: fc.string({ maxLength: 500 }),
       });
       ```

    4. **`arbUat.ts`**:
       ```typescript
       import fc from 'fast-check';
       export const arbUat = fc.record({
         status: fc.constantFrom('draft', 'running', 'passed', 'failed'),
         gaps: fc.array(fc.record({ id: fc.nat({ max: 99 }), diagnosis: fc.string({ maxLength: 300 }) }), { maxLength: 10 }),
         current_test: fc.string({ maxLength: 200 }),
         ship_readiness: fc.boolean(),
       });
       ```

    5. **`arbRoadmap.ts`**:
       ```typescript
       import fc from 'fast-check';
       const arbPhaseListEntry = fc.record({
         num: fc.integer({ min: 1, max: 20 }),
         title: fc.string({ minLength: 1, maxLength: 100 }),
         status: fc.constantFrom('pending', 'in-progress', 'complete'),
         plans: fc.integer({ min: 0, max: 15 }),
       });
       export const arbRoadmap = fc.record({
         milestone_overview: fc.string({ maxLength: 500 }),
         phases: fc.array(arbPhaseListEntry, { minLength: 1, maxLength: 15 }),
         progress_table: fc.string({ maxLength: 500 }),
       });
       ```

    6. **`arbDecision.ts`**:
       ```typescript
       import fc from 'fast-check';
       export const arbDecision = fc.record({
         id: fc.stringMatching(/^D-\d{4}-\d{2}-\d{2}-\d{2}$/),
         title: fc.string({ minLength: 1, maxLength: 100 }),
         rationale: fc.string({ maxLength: 500 }),
         alternatives: fc.array(fc.string({ maxLength: 200 }), { maxLength: 10 }),
         consequences: fc.string({ maxLength: 500 }),
       });
       ```

    7. **`arbBlocker.ts`**:
       ```typescript
       import fc from 'fast-check';
       export const arbBlocker = fc.record({
         text: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => !s.includes('\n')),
       });
       ```

    8. **`arbDebugSession.ts`**:
       ```typescript
       import fc from 'fast-check';
       export const arbDebugSession = fc.record({
         slug: fc.stringMatching(/^[a-z0-9-]{1,40}$/),
         symptoms: fc.string({ minLength: 1, maxLength: 500 }),
         current_focus: fc.string({ maxLength: 300 }),
         evidence: fc.array(fc.string({ maxLength: 300 }), { maxLength: 20 }),
         eliminated: fc.array(fc.string({ maxLength: 300 }), { maxLength: 20 }),
         resolution: fc.option(fc.string({ maxLength: 500 })),
         specialist_reviews: fc.array(fc.string({ maxLength: 300 }), { maxLength: 10 }),
       });
       ```

    9. **`arbProject.ts`**:
       ```typescript
       import fc from 'fast-check';
       const arbValidatedEntry = fc.record({
         name: fc.string({ minLength: 1, maxLength: 100 }),
         criteria: fc.array(fc.string({ maxLength: 200 }), { maxLength: 10 }),
       });
       export const arbProject = fc.record({
         validated: fc.array(arbValidatedEntry, { maxLength: 10 }),
         active: fc.array(fc.string({ maxLength: 200 }), { maxLength: 20 }),
         out_of_scope: fc.array(fc.string({ maxLength: 200 }), { maxLength: 20 }),
         decisions: fc.array(fc.string({ maxLength: 300 }), { maxLength: 20 }),
       });
       ```

    10. **`arbSpec.ts`**:
        ```typescript
        import fc from 'fast-check';
        export const arbSpec = fc.record({
          problem: fc.string({ minLength: 1, maxLength: 500 }),
          constraints: fc.array(fc.string({ maxLength: 200 }), { maxLength: 20 }),
          approach: fc.string({ maxLength: 500 }),
          tradeoffs: fc.array(fc.string({ maxLength: 200 }), { maxLength: 20 }),
        });
        ```

    11. **`arbAiSpec.ts`**:
        ```typescript
        import fc from 'fast-check';
        export const arbAiSpec = fc.record({
          domain_section: fc.string({ maxLength: 500 }),
          ai_section: fc.string({ maxLength: 500 }),
          eval_section: fc.string({ maxLength: 500 }),
        });
        ```

    After all 11 files exist, run `npm run build` (or the appropriate typecheck command from Task 2 Step 3) to confirm TypeScript compiles.

    **If any field is ambiguous** (e.g. you're unsure whether `resolution` on DebugSession is optional): prefer `fc.option(arb)` over `arb`; `fc.option` widens the distribution to include `null`. This errs on the side of thorough coverage.
  </action>
  <verify>
    <automated>npm run build &amp;&amp; ls tests/conformance/arbitraries/arb*.ts | wc -l | awk '$1 >= 12 { print "ok"; exit 0 } { print "need >= 12 arb files, found "$1; exit 1 }'</automated>
  </verify>
  <done>
    - All 12 arb*.ts files present (`ls tests/conformance/arbitraries/arb*.ts` shows ≥ 12 files).
    - encode.ts present.
    - `npm run build` clean (typecheck across the tree).
    - Each arbitrary has array caps and string-length caps matching RESEARCH table.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| fast-check generator → test runner | in-memory only; no network / filesystem leakage at authoring time |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-05a-01 | Tampering | arbitrary generates pathological input (huge strings, deep nesting) | mitigate | All arbitraries cap maxLength at ≤ 500 chars; arrays ≤ 50 items. Applied uniformly per RESEARCH caps. |
| T-07-05a-02 | Tampering | supply-chain: fast-check / @fast-check/vitest packages | accept | Pinned to `^4.8.0` / `^0.4.1`; test-only dev deps; no production runtime exposure. |
</threat_model>

<verification>
After all tasks:
- 12 arb*.ts files + encode.ts exist; all typecheck.
- `npm run build` clean; no TypeScript errors on the arbitraries.
- No runtime registration (properties.test.ts ships in Plan 07-05b).
- Existing `npm run test:conformance` + `npm run test:conformance:paired` still green (zero functional regression from arbitrary authoring).
</verification>

<success_criteria>
- All 12 nouns have a typed fast-check arbitrary authored.
- Each arbitrary respects RESEARCH-table caps (arrays ≤ 50, strings ≤ 500).
- encode.ts exports encodeFrontmatterDoc for 07-05b's property-test use.
</success_criteria>

<output>
After completion, create `.planning/phases/07-conformance-test-suite/07-05a-SUMMARY.md`
documenting:
- The 12 arbitraries authored + their cap choices.
- Any divergences between RESEARCH-table skeletons and the final fc.record shapes (e.g. extra required fields surfaced during read_first of sibling schemas).
- Forward pointer: Plan 07-05b wires properties.test.ts against these arbitraries + populates 12 noun-roundtrip manifest entries; Plan 07-06 adds failure-injection tests + the Phase 7 exit.
</output>
