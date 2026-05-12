/**
 * fast-check arbitrary for Decision records.
 *
 * Schema source: RESEARCH §Property-Based Noun Arbitrary Shapes (Decision row)
 *   + DECISIONS.md entry shape (## D-YYYY-MM-DD-NN — title).
 * Caps: alternatives ≤ 10, free-form text ≤ 500 chars.
 */
import fc from 'fast-check';

export const arbDecision = fc.record({
  id: fc.stringMatching(/^D-\d{4}-\d{2}-\d{2}-\d{2}$/),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  rationale: fc.string({ maxLength: 500 }),
  alternatives: fc.array(fc.string({ maxLength: 200 }), { maxLength: 10 }),
  consequences: fc.string({ maxLength: 500 }),
});
