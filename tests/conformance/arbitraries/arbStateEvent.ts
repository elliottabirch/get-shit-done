/**
 * fast-check arbitrary for the StateEvent discriminated union
 * (AppendEvent | MutationEvent | SignalEvent) from
 * adapters/state-event-types.ts.
 *
 * Each variant's payload generator produces values within the
 * schema's legal ranges. Caps per RESEARCH §Property-Based Noun
 * Arbitrary Shapes: arrays ≤ 50; free-form strings ≤ 500 chars.
 *
 * Mirrors adapters/state-event-types.ts 1-for-1:
 *   AppendEvent: 6 variants (decision, metric, roadmap_evolution,
 *                             session, forensic_session, quick_task)
 *   MutationEvent: 4 variants (blocker_added, blocker_resolved,
 *                               todo_count_update, deferred_items)
 *   SignalEvent: 2 variants (waiting, resume)
 */
import fc from 'fast-check';
import type {
  AppendEvent,
  MutationEvent,
  SignalEvent,
} from '../../../adapters/state-event-types.js';

// ---- AppendEvent variants -----------------------------------------------

// fc.option with { nil: undefined } generates T | undefined, matching optional interface fields.
const nil = { nil: undefined } as const;

const arbDecisionPayload = fc.record({
  phase: fc.string({ minLength: 1, maxLength: 3 }).map((s) => s.padStart(2, '0')),
  summary: fc.string({ minLength: 1, maxLength: 200 }),
  rationale: fc.option(fc.string({ maxLength: 500 }), nil),
});

const arbMetricPayload = fc.record({
  phase: fc.string({ minLength: 1, maxLength: 3 }),
  plan: fc.string({ minLength: 1, maxLength: 3 }),
  duration: fc.stringMatching(/^\d+[smhd]$/),
  tasks: fc.option(fc.stringMatching(/^\d+$/), nil),
  files: fc.option(fc.stringMatching(/^\d+$/), nil),
});

const arbRoadmapEvolutionPayload = fc.record({
  phase: fc.string({ minLength: 1, maxLength: 3 }),
  action: fc.constantFrom(
    'inserted' as const,
    'removed' as const,
    'moved' as const,
    'edited' as const,
    'added' as const,
  ),
  note: fc.option(fc.string({ maxLength: 500 }), nil),
  after: fc.option(fc.string({ maxLength: 200 }), nil),
  urgent: fc.option(fc.boolean(), nil),
});

const arbSessionPayload = fc.record({
  stoppedAt: fc.option(fc.string({ maxLength: 200 }), nil),
  resumeFile: fc.option(fc.string({ maxLength: 200 }), nil),
});

const arbForensicSessionPayload = fc.record({
  sessionId: fc.stringMatching(/^[a-z0-9-]{1,40}$/),
  findings: fc.string({ minLength: 1, maxLength: 500 }),
});

const arbQuickTaskPayload = fc.record({
  task: fc.string({ minLength: 1, maxLength: 200 }),
  result: fc.option(fc.string({ maxLength: 500 }), nil),
});

export const arbAppendEvent: fc.Arbitrary<AppendEvent> = fc.oneof(
  fc.record({ type: fc.constant('decision' as const), payload: arbDecisionPayload }),
  fc.record({ type: fc.constant('metric' as const), payload: arbMetricPayload }),
  fc.record({ type: fc.constant('roadmap_evolution' as const), payload: arbRoadmapEvolutionPayload }),
  fc.record({ type: fc.constant('session' as const), payload: arbSessionPayload }),
  fc.record({ type: fc.constant('forensic_session' as const), payload: arbForensicSessionPayload }),
  fc.record({ type: fc.constant('quick_task' as const), payload: arbQuickTaskPayload }),
);

// ---- MutationEvent variants -----------------------------------------------

const arbBlockerAddedPayload = fc.record({
  text: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => !s.includes('\n')),
});

const arbBlockerResolvedPayload = fc.record({
  text: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => !s.includes('\n')),
});

const arbTodoCountUpdatePayload = fc.record({
  count: fc.nat({ max: 100 }),
  items: fc.option(fc.array(fc.string({ maxLength: 200 }), { maxLength: 50 }), nil),
});

const arbDeferredItemsPayload = fc.record({
  items: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 1, maxLength: 50 }),
  action: fc.constantFrom('add' as const, 'remove' as const),
});

export const arbMutationEvent: fc.Arbitrary<MutationEvent> = fc.oneof(
  fc.record({ type: fc.constant('blocker_added' as const), payload: arbBlockerAddedPayload }),
  fc.record({ type: fc.constant('blocker_resolved' as const), payload: arbBlockerResolvedPayload }),
  fc.record({ type: fc.constant('todo_count_update' as const), payload: arbTodoCountUpdatePayload }),
  fc.record({ type: fc.constant('deferred_items' as const), payload: arbDeferredItemsPayload }),
);

// ---- SignalEvent variants --------------------------------------------------

const arbWaitingPayload = fc.record({
  waitType: fc.string({ minLength: 1, maxLength: 100 }),
  question: fc.option(fc.string({ maxLength: 500 }), nil),
  options: fc.option(fc.array(fc.string({ maxLength: 200 }), { maxLength: 50 }), nil),
  phase: fc.option(fc.string({ maxLength: 50 }), nil),
});

const arbResumePayload = fc.record({});

export const arbSignalEvent: fc.Arbitrary<SignalEvent> = fc.oneof(
  fc.record({ type: fc.constant('waiting' as const), payload: arbWaitingPayload }),
  fc.record({ type: fc.constant('resume' as const), payload: arbResumePayload }),
);

// ---- Top-level union -------------------------------------------------------

export const arbStateEvent = fc.oneof(
  arbAppendEvent,
  arbMutationEvent,
  arbSignalEvent,
);
