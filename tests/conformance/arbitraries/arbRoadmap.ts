/**
 * fast-check arbitrary for Roadmap records.
 *
 * Schema source: RESEARCH §Property-Based Noun Arbitrary Shapes (Roadmap row)
 *   + ROADMAP.md structure (phases list + overview + progress table).
 * Caps: phases array 1–15, free-form text ≤ 500 chars.
 */
import fc from 'fast-check';

const arbPhaseListEntry = fc.record({
  num: fc.integer({ min: 1, max: 20 }),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  status: fc.constantFrom('pending' as const, 'in-progress' as const, 'complete' as const),
  plans: fc.integer({ min: 0, max: 15 }),
});

export const arbRoadmap = fc.record({
  milestone_overview: fc.string({ maxLength: 500 }),
  phases: fc.array(arbPhaseListEntry, { minLength: 1, maxLength: 15 }),
  progress_table: fc.string({ maxLength: 500 }),
});
