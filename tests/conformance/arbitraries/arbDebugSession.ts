/**
 * fast-check arbitrary for DebugSession records.
 *
 * Schema source: RESEARCH §Property-Based Noun Arbitrary Shapes (DebugSession row)
 *   + Phase 5 D-04 .planning/debug/*.md section pattern.
 * Sections: Symptoms (immutable), Current Focus (overwrite), Evidence (append),
 *   Eliminated (append), Resolution (overwrite, optional), Specialist Review (append).
 * Caps: arrays ≤ 20, free-form text ≤ 500 chars. resolution is fc.option to
 *   ensure thorough coverage of the optional case.
 */
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
