/**
 * fast-check arbitrary for Summary records.
 *
 * Schema source: RESEARCH Property-Based Noun Arbitrary Shapes (Summary row)
 *   + .planning/phases/NN-SUMMARY.md convention.
 * Caps: arrays max 20 tasks_completed, free-form text max 500 chars.
 */
import fc from 'fast-check';

export const arbSummary = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }),
  outcome: fc.constantFrom('complete' as const, 'blocked' as const, 'partial' as const),
  tasks_completed: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { maxLength: 20 }),
  tail: fc.string({ maxLength: 500 }),
});
