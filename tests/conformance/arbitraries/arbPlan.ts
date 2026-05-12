/**
 * fast-check arbitrary for Plan records.
 *
 * Schema source: RESEARCH §Property-Based Noun Arbitrary Shapes (Plan row)
 *   + PLAN.md corpus (must_haves.truths, waves/tasks structure).
 * Caps: arrays ≤ 50 (waves ≤ 5, tasks ≤ 5), free-form text ≤ 500 chars.
 */
import fc from 'fast-check';

const arbTask = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  action: fc.string({ maxLength: 500 }),
});

export const arbPlan = fc.record({
  must_haves: fc.record({
    truths: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { maxLength: 20 }),
  }),
  waves: fc.array(
    fc.record({ tasks: fc.array(arbTask, { maxLength: 5 }) }),
    { maxLength: 5 },
  ),
});
