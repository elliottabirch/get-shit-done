// State event discriminated unions — Phase 3 (D-01/D-02). Grouped by mutation semantics for BeadsAdapter mapping.

// ─── Append Event Payloads ───────────────────────────────────────────────────

export interface DecisionPayload {
  phase: string;
  summary: string;
  rationale?: string;
}

export interface MetricPayload {
  phase: string;
  plan: string;
  duration: string;
  tasks?: string;
  files?: string;
}

export interface RoadmapEvolutionPayload {
  phase: string;
  action: 'inserted' | 'removed' | 'moved' | 'edited' | 'added';
  note?: string;
  after?: string;
  urgent?: boolean;
}

export interface SessionPayload {
  stoppedAt?: string;
  resumeFile?: string;
}

export interface ForensicSessionPayload {
  sessionId: string;
  findings: string;
}

export interface QuickTaskPayload {
  task: string;
  result?: string;
}

// ─── Append Event Union ──────────────────────────────────────────────────────

export type AppendEvent =
  | { type: 'decision'; payload: DecisionPayload }
  | { type: 'metric'; payload: MetricPayload }
  | { type: 'roadmap_evolution'; payload: RoadmapEvolutionPayload }
  | { type: 'session'; payload: SessionPayload }
  | { type: 'forensic_session'; payload: ForensicSessionPayload }
  | { type: 'quick_task'; payload: QuickTaskPayload };

// ─── Mutation Event Payloads ─────────────────────────────────────────────────

export interface BlockerAddedPayload {
  text: string;
}

export interface BlockerResolvedPayload {
  text: string;
}

export interface TodoCountUpdatePayload {
  count: number;
  items?: string[];
}

export interface DeferredItemsPayload {
  items: string[];
  action: 'add' | 'remove';
}

// ─── Mutation Event Union ────────────────────────────────────────────────────

export type MutationEvent =
  | { type: 'blocker_added'; payload: BlockerAddedPayload }
  | { type: 'blocker_resolved'; payload: BlockerResolvedPayload }
  | { type: 'todo_count_update'; payload: TodoCountUpdatePayload }
  | { type: 'deferred_items'; payload: DeferredItemsPayload };

// ─── Signal Event Payloads ───────────────────────────────────────────────────

export interface WaitingPayload {
  waitType: string;
  question?: string;
  options?: string[];
  phase?: string;
}

export interface ResumePayload {
  // Empty object — signal only
}

export interface MilestoneSwitchPayload {
  version: string;
  name?: string;
}

// ─── Signal Event Union ──────────────────────────────────────────────────────

export type SignalEvent =
  | { type: 'waiting'; payload: WaitingPayload }
  | { type: 'resume'; payload: ResumePayload }
  | { type: 'milestone_switch'; payload: MilestoneSwitchPayload };
