// Re-export event types from the adapters package (canonical location).
// Event types live alongside the StorageAdapter interface they belong to.
// SDK modules import from here for convenience; adapters/state-event-types.ts is the source of truth.

export type {
  // Append event family
  AppendEvent,
  DecisionPayload,
  MetricPayload,
  RoadmapEvolutionPayload,
  SessionPayload,
  ForensicSessionPayload,
  QuickTaskPayload,
  // Mutation event family
  MutationEvent,
  BlockerAddedPayload,
  BlockerResolvedPayload,
  TodoCountUpdatePayload,
  DeferredItemsPayload,
  // Signal event family
  SignalEvent,
  WaitingPayload,
  ResumePayload,
  MilestoneSwitchPayload,
} from '../../../adapters/state-event-types.js';
