/**
 * fast-check arbitrary for Blocker records.
 *
 * Schema source: RESEARCH §Property-Based Noun Arbitrary Shapes (Blocker row)
 *   + STATE.md Blockers list-item shape (BlockerAddedPayload from state-event-types.ts).
 * Constraint: text is a single-line bullet-list item (no newlines).
 */
import fc from 'fast-check';

export const arbBlocker = fc.record({
  text: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => !s.includes('\n')),
});
