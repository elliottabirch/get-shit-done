/**
 * fast-check arbitrary for Phase records.
 *
 * Schema source: RESEARCH §Property-Based Noun Arbitrary Shapes (Phase row)
 *   + sibling src/format/phase.ts GSDPhase interface.
 * Caps: arrays ≤ 50, free-form text ≤ 500 chars (RESEARCH cap).
 */
import fc from 'fast-check';

export const arbPhase = fc.record({
  goal: fc.string({ minLength: 1, maxLength: 500 }),
  depends_on: fc.array(fc.integer({ min: 1, max: 99 }), { maxLength: 50 }),
  requirements: fc.array(fc.stringMatching(/^[A-Z]+-\d+$/), { maxLength: 50 }),
  success_criteria: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { maxLength: 50 }),
  tail: fc.string({ maxLength: 500 }),
});
