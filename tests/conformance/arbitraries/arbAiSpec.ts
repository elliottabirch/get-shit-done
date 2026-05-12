/**
 * fast-check arbitrary for AiSpec records.
 *
 * Schema source: RESEARCH §Property-Based Noun Arbitrary Shapes (AiSpec row)
 *   + AI-SPEC.md three-section shape (gsd-domain-researcher / gsd-ai-researcher
 *     / gsd-eval-planner sections).
 * Caps: free-form text ≤ 500 chars per section.
 */
import fc from 'fast-check';

export const arbAiSpec = fc.record({
  domain_section: fc.string({ maxLength: 500 }),
  ai_section: fc.string({ maxLength: 500 }),
  eval_section: fc.string({ maxLength: 500 }),
});
