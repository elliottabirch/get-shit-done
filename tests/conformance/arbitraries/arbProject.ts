/**
 * fast-check arbitrary for Project records.
 *
 * Schema source: RESEARCH §Property-Based Noun Arbitrary Shapes (Project row)
 *   + PROJECT.md structure (Validated / Active / Out-of-Scope / Decisions blocks).
 * Caps: arrays ≤ 20 items, criteria ≤ 10 per entry, free-form text ≤ 200 chars.
 */
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
