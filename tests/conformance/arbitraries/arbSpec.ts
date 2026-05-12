/**
 * fast-check arbitrary for Spec records.
 *
 * Schema source: RESEARCH §Property-Based Noun Arbitrary Shapes (Spec row)
 *   + SPEC.md structure (problem / constraints / approach / trade-offs).
 * Caps: arrays ≤ 20, free-form text ≤ 500 chars.
 */
import fc from 'fast-check';

export const arbSpec = fc.record({
  problem: fc.string({ minLength: 1, maxLength: 500 }),
  constraints: fc.array(fc.string({ maxLength: 200 }), { maxLength: 20 }),
  approach: fc.string({ maxLength: 500 }),
  tradeoffs: fc.array(fc.string({ maxLength: 200 }), { maxLength: 20 }),
});
