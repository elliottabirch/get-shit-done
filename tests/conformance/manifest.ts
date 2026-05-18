/**
 * Authored Phase 7 conformance manifest (D-06).
 *
 * This file is the single source of truth for which (adapter, test) pairs
 * must exist. Adding a new Bin B method, section tuple, noun, or rollback
 * case requires appending here AND authoring the matching describe/it in
 * tests/conformance/paired.test.ts (via assertFromManifest).
 *
 * Populated in Plan 07-04b:
 *   - 5 baseline binB entries (getRecord round-trip, stat file/dir/missing)
 *   - 25 StateWriteOutcome binB entries from write-outcome.conformance-suite.ts
 *   - 2 withTransaction binB entries from write-transaction.conformance-suite.ts
 *   - 9 section-tuple entries from RESEARCH Tier 1 STATE.md literals
 *   Plan 07-05b: 12 noun-roundtrip entries × 2 adapters.
 *   Plan 07-06:  2 rollback entries (CONFORM-04 + known-gap per D-09).
 *   Phase-close: 1 commitPlanningState binB (CONFORM-01 fill; D-OQ01-BEADS).
 *   Total: 56 entries.
 *
 * D-2026-05-12-OQ06-CREATED-SECTION: BeadsAdapter Outcome A never emits
 * created_section. Every markdown entry with created_section has a paired
 * beads entry with created_section: null and this ADR citation.
 */
import type { ManifestEntry } from './manifest-types.js';

export const CONFORMANCE_MANIFEST: readonly ManifestEntry[] = [
  // ========================================================================
  // Baseline harness sanity (from adapter.conformance.ts)
  // 5 entries × 2 adapters — always registered via runAdapterConformanceSuite
  // ========================================================================
  {
    kind: 'binB',
    name: 'getRecord-putRecord:round-trip',
    description: 'putRecord then getRecord returns same body (identity check)',
    expected: {
      markdown: { kind: 'presence' },
      beads:    { kind: 'presence' },
    },
  },
  {
    kind: 'binB',
    name: 'getRecord:missing-path-returns-null',
    description: 'getRecord returns null for non-existent path',
    expected: {
      markdown: { kind: 'presence' },
      beads:    { kind: 'presence' },
    },
  },
  {
    kind: 'binB',
    name: 'stat:file-kind',
    description: 'stat returns kind=file for putRecord-written file',
    expected: {
      markdown: { kind: 'presence' },
      beads:    { kind: 'presence' },
    },
  },
  {
    kind: 'binB',
    name: 'stat:dir-kind',
    description: 'stat returns kind=dir for directory created via putRecord',
    expected: {
      markdown: { kind: 'presence' },
      beads:    { kind: 'presence' },
    },
  },
  {
    kind: 'binB',
    name: 'stat:missing-returns-null',
    description: 'stat returns null for non-existent path',
    expected: {
      markdown: { kind: 'presence' },
      beads:    { kind: 'presence' },
    },
  },

  // ========================================================================
  // StateWriteOutcome matrix — write-outcome.conformance-suite.ts
  // 25 cases from Plan 03-06 (Append / Mutation / Signal families).
  // Per D-2026-05-12-OQ06-CREATED-SECTION: BeadsAdapter Outcome A never
  // emits created_section → use created_section: null in beads expected.
  // ========================================================================

  // ---- recordStateAppend: decision ----------------------------------------
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

  // ---- recordStateAppend: metric ------------------------------------------
  {
    kind: 'binB',
    name: 'recordStateAppend:metric:scaffold',
    description: 'metric: applied:true + created_section scaffolds Performance Metrics',
    expected: {
      markdown: { applied: true, created_section: '## Performance Metrics' },
      beads:    { applied: true, created_section: null },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  {
    kind: 'binB',
    name: 'recordStateAppend:metric:existing-section',
    description: 'metric: applied:true bare when Performance Metrics table exists',
    expected: {
      markdown: { applied: true },
      beads:    { applied: true },
    },
  },

  // ---- recordStateAppend: session -----------------------------------------
  {
    kind: 'binB',
    name: 'recordStateAppend:session:existing-section',
    description: 'session: applied:true bare when Last session field exists',
    expected: {
      markdown: { applied: true },
      beads:    { applied: true },
    },
  },
  {
    kind: 'binB',
    name: 'recordStateAppend:session:scaffold',
    description: 'session: applied:true + created_section when no session field present',
    expected: {
      markdown: { applied: true, created_section: '## Session Continuity' },
      beads:    { applied: true, created_section: null },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },

  // ---- recordStateAppend: roadmap_evolution --------------------------------
  {
    kind: 'binB',
    name: 'recordStateAppend:roadmap_evolution:duplicate',
    description: 'roadmap_evolution: applied:false + reason:duplicate on exact re-append',
    expected: {
      markdown: { applied: false, reason: 'duplicate' },
      // D-2026-05-12-OQ06-CREATED-SECTION (extension): BeadsAdapter dedup reads
      // bd memory; markdown-seeded STATE.md content is invisible to bd, so a
      // duplicate seeded via putRecord is not detected — BeadsAdapter always
      // applies a new write here.
      beads:    { applied: true },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  {
    kind: 'binB',
    name: 'recordStateAppend:roadmap_evolution:existing-section',
    description: 'roadmap_evolution: applied:true bare on new entry to existing subsection',
    expected: {
      markdown: { applied: true },
      beads:    { applied: true },
    },
  },
  {
    kind: 'binB',
    name: 'recordStateAppend:roadmap_evolution:scaffold',
    description: 'roadmap_evolution: applied:true + created_section when subsection absent',
    expected: {
      markdown: { applied: true, created_section: '### Roadmap Evolution' },
      beads:    { applied: true, created_section: null },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  {
    kind: 'binB',
    name: 'recordStateAppend:roadmap_evolution:outside-section-not-dup',
    description: 'roadmap_evolution: applied:true when identical bullet outside Roadmap Evolution (WR-02 regression)',
    expected: {
      markdown: { applied: true },
      beads:    { applied: true },
    },
  },

  // ---- recordStateMutation: blocker_added ---------------------------------
  {
    kind: 'binB',
    name: 'recordStateMutation:blocker_added:scaffold',
    description: 'blocker_added: applied:true + created_section on STATE.md without Blockers',
    expected: {
      markdown: { applied: true, created_section: '## Blockers' },
      beads:    { applied: true, created_section: null },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  {
    kind: 'binB',
    name: 'recordStateMutation:blocker_added:existing-section',
    description: 'blocker_added: applied:true bare when Blockers section exists',
    expected: {
      markdown: { applied: true },
      beads:    { applied: true },
    },
  },

  // ---- recordStateMutation: blocker_resolved ------------------------------
  {
    kind: 'binB',
    name: 'recordStateMutation:blocker_resolved:nothing_to_remove',
    description: 'blocker_resolved: applied:false + reason:nothing_to_remove when blocker absent',
    expected: {
      markdown: { applied: false, reason: 'nothing_to_remove' },
      beads:    { applied: false, reason: 'nothing_to_remove' },
    },
  },
  {
    kind: 'binB',
    name: 'recordStateMutation:blocker_resolved:existing',
    description: 'blocker_resolved: applied:true when blocker present',
    expected: {
      markdown: { applied: true },
      // D-2026-05-12-OQ06-CREATED-SECTION (extension): BeadsAdapter resolves
      // blockers via bd labels, not markdown content. A blocker seeded via
      // putRecord (markdown) is invisible to bd — BeadsAdapter returns
      // nothing_to_remove because no bd label was ever added.
      beads:    { applied: false, reason: 'nothing_to_remove' },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  {
    kind: 'binB',
    name: 'recordStateMutation:blocker_resolved:section-exists-item-absent',
    description: 'blocker_resolved: applied:false when section exists but named blocker absent (WR-04)',
    expected: {
      markdown: { applied: false, reason: 'nothing_to_remove' },
      beads:    { applied: false, reason: 'nothing_to_remove' },
    },
  },

  // ---- recordStateMutation: todo_count_update -----------------------------
  {
    kind: 'binB',
    name: 'recordStateMutation:todo_count_update:scaffold',
    description: 'todo_count_update: applied:true + created_section when Pending todos absent',
    expected: {
      markdown: { applied: true, created_section: '## Pending todos' },
      beads:    { applied: true, created_section: null },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  {
    kind: 'binB',
    name: 'recordStateMutation:todo_count_update:existing-section',
    description: 'todo_count_update: applied:true bare when Pending todos section exists (WR-04)',
    expected: {
      markdown: { applied: true },
      beads:    { applied: true },
    },
  },

  // ---- recordStateMutation: deferred_items --------------------------------
  {
    kind: 'binB',
    name: 'recordStateMutation:deferred_items:remove-missing',
    description: 'deferred_items remove: applied:false + reason:nothing_to_remove when item absent',
    expected: {
      markdown: { applied: false, reason: 'nothing_to_remove' },
      beads:    { applied: false, reason: 'nothing_to_remove' },
    },
  },
  {
    kind: 'binB',
    name: 'recordStateMutation:deferred_items:add-existing-section',
    description: 'deferred_items add: applied:true bare when Deferred Ideas section exists',
    expected: {
      markdown: { applied: true },
      beads:    { applied: true },
    },
  },
  {
    kind: 'binB',
    name: 'recordStateMutation:deferred_items:add-scaffold',
    description: 'deferred_items add: applied:true + created_section when Deferred Ideas absent (WR-04)',
    expected: {
      markdown: { applied: true, created_section: '## Deferred Ideas' },
      beads:    { applied: true, created_section: null },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  {
    kind: 'binB',
    name: 'recordStateMutation:deferred_items:add-all-duplicate',
    description: 'deferred_items add: applied:false + reason:duplicate when all items already present (IN-02)',
    expected: {
      markdown: { applied: false, reason: 'duplicate' },
      // D-2026-05-12-OQ06-CREATED-SECTION (extension): BeadsAdapter dedup reads
      // bd memory; markdown-seeded Deferred Ideas items are invisible to bd, so
      // items seeded via putRecord are not detected as duplicates — BeadsAdapter
      // always applies the write here.
      beads:    { applied: true },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  {
    kind: 'binB',
    name: 'recordStateMutation:deferred_items:add-partial-duplicate',
    description: 'deferred_items add: applied:true when some items are duplicates (IN-02 partial)',
    expected: {
      markdown: { applied: true },
      beads:    { applied: true },
    },
  },

  // ---- recordStateSignal --------------------------------------------------
  {
    kind: 'binB',
    name: 'recordStateSignal:waiting:applied',
    description: 'waiting: always applied:true',
    expected: {
      markdown: { applied: true },
      beads:    { applied: true },
    },
  },
  {
    kind: 'binB',
    name: 'recordStateSignal:resume:applied',
    description: 'resume: applied:true when WAITING.json exists',
    expected: {
      markdown: { applied: true },
      // D-2026-05-12-OQ06-CREATED-SECTION (extension): BeadsAdapter uses bd
      // labels for waiting/resume signals, not WAITING.json. A WAITING.json
      // seeded via putRecord (markdown) is invisible to bd — BeadsAdapter
      // returns nothing_to_remove because no bd label was ever added.
      beads:    { applied: false, reason: 'nothing_to_remove' },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  {
    kind: 'binB',
    name: 'recordStateSignal:resume:nothing_to_remove',
    description: 'resume: applied:false + reason:nothing_to_remove when WAITING.json absent',
    expected: {
      markdown: { applied: false, reason: 'nothing_to_remove' },
      beads:    { applied: false, reason: 'nothing_to_remove' },
    },
  },

  // ========================================================================
  // withTransaction matrix — write-transaction.conformance-suite.ts
  // Commit + rollback registration. Failure-injection (mid-txn rollback)
  // is Plan 07-06's territory; its manifest entry lives there.
  // ========================================================================
  {
    kind: 'binB',
    name: 'withTransaction:commit-persists',
    description: 'withTransaction executes function and mutations persist',
    expected: {
      markdown: { kind: 'presence' },
      beads:    { kind: 'presence' },
    },
  },
  {
    kind: 'binB',
    name: 'withTransaction:rollback-on-throw',
    description: 'withTransaction releases lock on error (throw path)',
    expected: {
      markdown: { kind: 'presence' },
      beads:    { kind: 'presence' },
    },
  },

  // ========================================================================
  // commitPlanningState — paired entry closing CONFORM-01 coverage.
  // MarkdownAdapter: git add + git commit. BeadsAdapter: NOOP per
  // D-2026-05-12-OQ01-BEADS (bd owns per-write atomicity; no git analog).
  // Both resolve without throwing; the NOOP asymmetry is a deviation, not
  // a divergence — both return `void`, which is the only observable.
  // ========================================================================
  {
    kind: 'binB',
    name: 'commitPlanningState:returns-void',
    description: 'commitPlanningState resolves with no observable adapter difference (markdown: git commit; beads: NOOP per D-OQ01-BEADS)',
    expected: {
      markdown: { kind: 'presence' },
      beads:    { kind: 'presence' },
    },
    adr: 'D-2026-05-12-OQ01-BEADS',
  },

  // ========================================================================
  // Section-tuple matrix — 9 entries from RESEARCH Tier 1 STATE.md literals
  // (must_haves floor: 9 section-tuple entries minimum)
  // Per D-2026-05-12-OQ06-CREATED-SECTION: BeadsAdapter does not emit
  // created_section in Outcome A → all beads entries have created_section: null.
  // ========================================================================
  {
    kind: 'section-tuple',
    name: 'STATE.md#Decisions Made:append',
    description: 'Decisions Made section append (Tier 1 STATE.md anchor)',
    expected: {
      markdown: { applied: true, created_section: '## Decisions Made' },
      beads:    { applied: true, created_section: null },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  {
    kind: 'section-tuple',
    name: 'STATE.md#Forensic Sessions:append',
    description: 'Forensic Sessions section append (Tier 1 STATE.md anchor)',
    expected: {
      markdown: { applied: true, created_section: '## Forensic Sessions' },
      beads:    { applied: true, created_section: null },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  {
    kind: 'section-tuple',
    name: 'STATE.md#Quick Tasks:append',
    description: 'Quick Tasks section append (Tier 1 STATE.md anchor)',
    expected: {
      markdown: { applied: true, created_section: '## Quick Tasks' },
      beads:    { applied: true, created_section: null },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  {
    kind: 'section-tuple',
    name: 'STATE.md#Blockers:append',
    description: 'Blockers section append (Tier 1 STATE.md anchor)',
    expected: {
      markdown: { applied: true, created_section: '## Blockers' },
      beads:    { applied: true, created_section: null },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  {
    kind: 'section-tuple',
    name: 'STATE.md#Performance Metrics:append',
    description: 'Performance Metrics section append (Tier 1 STATE.md anchor)',
    expected: {
      markdown: { applied: true, created_section: '## Performance Metrics' },
      beads:    { applied: true, created_section: null },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  {
    kind: 'section-tuple',
    name: 'STATE.md#Roadmap Evolution:append',
    description: 'Roadmap Evolution subsection append (Tier 1 STATE.md anchor)',
    expected: {
      markdown: { applied: true, created_section: '### Roadmap Evolution' },
      beads:    { applied: true, created_section: null },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  {
    kind: 'section-tuple',
    name: 'STATE.md#Session Continuity:overwrite',
    description: 'Session Continuity section overwrite (Tier 1 STATE.md anchor)',
    expected: {
      markdown: { applied: true, created_section: '## Session Continuity' },
      beads:    { applied: true, created_section: null },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  {
    kind: 'section-tuple',
    name: 'STATE.md#Pending todos:overwrite',
    description: 'Pending todos section overwrite (Tier 1 STATE.md anchor)',
    expected: {
      markdown: { applied: true, created_section: '## Pending todos' },
      beads:    { applied: true, created_section: null },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  {
    kind: 'section-tuple',
    name: 'STATE.md#Deferred Ideas:append',
    description: 'Deferred Ideas section append (Tier 1 STATE.md anchor)',
    expected: {
      markdown: { applied: true, created_section: '## Deferred Ideas' },
      beads:    { applied: true, created_section: null },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },

  // ========================================================================
  // Property-based round-trip entries (CONFORM-02, D-12 + D-13)
  // Plan 07-05b: 12 noun-roundtrip entries × 2 adapters = 24 property tests.
  //
  // MarkdownAdapter: identity-equal (byte-preserving storage; normalize = id).
  // BeadsAdapter:    normalize-modulo-equal (frontmatter parse/format round-
  //                  trip via parseFrontmatter + formatFrontmatter; idempotent).
  //
  // Assertion: adapter.getRecord(path) === adapter.normalize(encode(value))
  // ========================================================================
  {
    kind: 'noun-roundtrip',
    name: 'Phase',
    description: 'Phase record round-trip under normalize()-modulo equality (arbPhase)',
    expected: {
      markdown: { kind: 'identity-equal' },
      beads:    { kind: 'normalize-modulo-equal' },
    },
  },
  {
    kind: 'noun-roundtrip',
    name: 'Plan',
    description: 'Plan record round-trip under normalize()-modulo equality (arbPlan)',
    expected: {
      markdown: { kind: 'identity-equal' },
      beads:    { kind: 'normalize-modulo-equal' },
    },
  },
  {
    kind: 'noun-roundtrip',
    name: 'Summary',
    description: 'Summary record round-trip under normalize()-modulo equality (arbSummary)',
    expected: {
      markdown: { kind: 'identity-equal' },
      beads:    { kind: 'normalize-modulo-equal' },
    },
  },
  {
    kind: 'noun-roundtrip',
    name: 'Uat',
    description: 'UAT record round-trip under normalize()-modulo equality (arbUat)',
    expected: {
      markdown: { kind: 'identity-equal' },
      beads:    { kind: 'normalize-modulo-equal' },
    },
  },
  {
    kind: 'noun-roundtrip',
    name: 'StateEvent',
    description: 'StateEvent record round-trip under normalize()-modulo equality (arbStateEvent)',
    expected: {
      markdown: { kind: 'identity-equal' },
      beads:    { kind: 'normalize-modulo-equal' },
    },
  },
  {
    kind: 'noun-roundtrip',
    name: 'Roadmap',
    description: 'Roadmap record round-trip under normalize()-modulo equality (arbRoadmap)',
    expected: {
      markdown: { kind: 'identity-equal' },
      beads:    { kind: 'normalize-modulo-equal' },
    },
  },
  {
    kind: 'noun-roundtrip',
    name: 'Decision',
    description: 'Decision record round-trip under normalize()-modulo equality (arbDecision)',
    expected: {
      markdown: { kind: 'identity-equal' },
      beads:    { kind: 'normalize-modulo-equal' },
    },
  },
  {
    kind: 'noun-roundtrip',
    name: 'Blocker',
    description: 'Blocker record round-trip under normalize()-modulo equality (arbBlocker)',
    expected: {
      markdown: { kind: 'identity-equal' },
      beads:    { kind: 'normalize-modulo-equal' },
    },
  },
  {
    kind: 'noun-roundtrip',
    name: 'DebugSession',
    description: 'DebugSession record round-trip under normalize()-modulo equality (arbDebugSession)',
    expected: {
      markdown: { kind: 'identity-equal' },
      beads:    { kind: 'normalize-modulo-equal' },
    },
  },
  {
    kind: 'noun-roundtrip',
    name: 'Project',
    description: 'Project record round-trip under normalize()-modulo equality (arbProject)',
    expected: {
      markdown: { kind: 'identity-equal' },
      beads:    { kind: 'normalize-modulo-equal' },
    },
  },
  {
    kind: 'noun-roundtrip',
    name: 'Spec',
    description: 'Spec record round-trip under normalize()-modulo equality (arbSpec)',
    expected: {
      markdown: { kind: 'identity-equal' },
      beads:    { kind: 'normalize-modulo-equal' },
    },
  },
  {
    kind: 'noun-roundtrip',
    name: 'AiSpec',
    description: 'AiSpec record round-trip under normalize()-modulo equality (arbAiSpec)',
    expected: {
      markdown: { kind: 'identity-equal' },
      beads:    { kind: 'normalize-modulo-equal' },
    },
  },

  // ========================================================================
  // CONFORM-04 rollback entries (Plan 07-06; D-09 + D-10 + D-11)
  // ========================================================================

  // Standard throw-before-commit rollback: both adapters must rollback
  // cleanly. Buffered-op discard on BeadsAdapter (Outcome A path).
  {
    kind: 'rollback',
    name: 'withTransaction:throw-before-commit',
    description: 'throw inside withTransaction fn before commit; rollback to pre-txn state',
    expected: {
      markdown: { kind: 'byte-identical' },
      beads:    { kind: 'record-identical' },
    },
  },

  // KNOWN GAP per D-09: Outcome A mid-commit-replay failure leaves
  // bd partially committed on the Nth issue. Phase 6 Deferred-04 +
  // Deferred-05. Documented; not tested via adapter-internal hooks
  // (D-10). Phase 6.1 candidate.
  {
    kind: 'rollback',
    name: 'withTransaction:mid-commit-replay',
    description:
      'mid-commit-replay failure after N-of-M buffered writes replayed ' +
      '(Phase 6 Outcome A gap; Deferred-04 / Deferred-05)',
    expected: {
      markdown: { kind: 'byte-identical' },
      beads:    { kind: 'incomplete-per-Deferred-04', adr: 'D-2026-05-12-OQ06-TXN' },
    },
    adr: 'D-2026-05-12-OQ06-TXN',
  },

  // ============================================================================
  // Phase 2 SEAM-06 — kind: 'seam-realness' entries
  // Bodies filled progressively as handler-family migrations land in Plans 03-07.
  // ============================================================================

  // DEFECT-02 — large body (>64KB) byte-identical round-trip on both adapters
  {
    kind: 'seam-realness',
    name: 'putRecord:large-body:round-trip',
    description: 'putRecord + getRecord round-trip for body > 64KB; asserts byte-identical retrieval on both adapters (DEFECT-02)',
    expected: {
      markdown: { kind: 'presence' },
      beads:    { kind: 'presence' },
    },
  },

  // SEAM-04/05 — state.milestone-switch via registry dispatch (markdown side = byte-identical; beads side = bd-tier write reaches store)
  {
    kind: 'seam-realness',
    name: 'state.milestone-switch:via-registry',
    description: 'state.milestone-switch dispatched via full registry routes to configured adapter (SEAM-04 beads / SEAM-05 markdown byte-identical)',
    expected: {
      markdown: { kind: 'presence' },
      beads:    { kind: 'presence' },
    },
  },
] as const;

export type { ManifestEntry, AdapterName, ExpectedOutcome,
              StateOutcomeExpected, RollbackOutcomeExpected,
              RoundTripOutcomeExpected } from './manifest-types.js';
