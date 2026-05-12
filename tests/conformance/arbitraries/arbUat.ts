/**
 * fast-check arbitrary for UAT records.
 *
 * Schema source: RESEARCH §Property-Based Noun Arbitrary Shapes (Uat row)
 *   + adapters/markdown/index.ts UAT scaffold patterns.
 * Caps: gaps array ≤ 10, free-form text ≤ 300 chars.
 */
import fc from 'fast-check';

export const arbUat = fc.record({
  status: fc.constantFrom(
    'draft' as const,
    'running' as const,
    'passed' as const,
    'failed' as const,
  ),
  gaps: fc.array(
    fc.record({
      id: fc.nat({ max: 99 }),
      diagnosis: fc.string({ maxLength: 300 }),
    }),
    { maxLength: 10 },
  ),
  current_test: fc.string({ maxLength: 200 }),
  ship_readiness: fc.boolean(),
});
