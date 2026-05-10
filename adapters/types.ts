// StorageAdapter v1.0 interface — locked contract for pluggable storage backends.

import type { AppendEvent, MutationEvent, SignalEvent } from './state-event-types.js';

export interface RecordRef {
  path: string;
  name: string;
}

export type RecordFilter = (ref: RecordRef) => boolean;

export type SectionMode = 'overwrite' | 'append' | 'prepend';

/** D-13 (Phase 5): closed union of named-doc categories. Adding a member is a breaking interface change — intentional gate against typo drift. */
export type NamedDocCategory =
  | 'research'
  | 'intel'
  | 'codebase'
  | 'archived-milestone'
  | 'reports'
  | 'sketches'
  | 'tmp'
  | 'root';

/** D-14 (Phase 5): fixed-key discriminator for the 'root' category singletons at .planning/ root. */
export type RootNamedDocKey = 'HANDOFF' | 'CONTINUE-HERE' | 'DECISIONS-INDEX';

export interface Capabilities {
  // Required core groups (D-05): true literal forces compile-time presence
  record: true;
  section: true;
  frontmatter: true;
  // Optional, closed enum of 5 (D-08; commitPlanningState promoted to required per D-12)
  binaryAsset: boolean;
  snapshot: boolean;
  transaction: boolean;
  namedDoc: boolean;
  markdownLockfile: boolean;
}

export interface StorageAdapter {
  readonly name: string;                      // D-06: diagnostic only
  readonly capabilities: Capabilities;        // instance property (Claude's discretion in D-08)

  // Bin A — record (required, D-05 + D-2026-05-XX extension — stat)
  getRecord(path: string): Promise<string | null>;
  putRecord(path: string, body: string): Promise<void>;
  removeRecord(path: string): Promise<void>;
  listCollection(prefix: string, filter?: RecordFilter): Promise<RecordRef[]>;
  exists(path: string): Promise<boolean>;
  // Returns null on missing path (matches getRecord null-on-miss semantics).
  // mtime is optional in the return shape — adapters that can't cheaply compute it omit the field.
  stat(path: string): Promise<{ kind: 'file' | 'dir'; mtime?: string } | null>;

  // Bin A — section (required, D-05)
  getSection(path: string, anchor: string): Promise<string | null>;
  updateSection(path: string, anchor: string, body: string, mode: SectionMode): Promise<void>;

  // Bin A — frontmatter (required, D-05)
  getFrontmatter(path: string, field?: string): Promise<unknown>;
  updateFrontmatter(path: string, field: string, value: unknown): Promise<void>;
  mergeFrontmatter(path: string, patch: Record<string, unknown>): Promise<void>;

  // markdownLockfile group (D-09 / OQ-08): PUBLIC, capability-gated
  replaceInCurrentMilestone(pattern: string | RegExp, replacement: string): Promise<void>;
  readModifyWriteRoadmapMd(mutator: (content: string) => string): Promise<void>;

  // Foundational primitives (D-10): declared in Phase 1, fully impl'd in Phase 5
  writeBinaryAsset(path: string, bytes: Uint8Array): Promise<void>;
  snapshot(): Promise<string>;
  restore(snapshotId: string): Promise<void>;
  withTransaction<T>(fn: () => Promise<T>): Promise<T>;
  // D-14 (Phase 5): discriminated overloads — 'root' narrows key to RootNamedDocKey.
  // Phase 5 Plan 04: optional `opts.workstream` preserves Phase-4 workstream semantics.
  putNamedDoc(category: 'root', key: RootNamedDocKey, body: string, opts?: { workstream?: string }): Promise<void>;
  putNamedDoc(category: Exclude<NamedDocCategory, 'root'>, key: string, body: string, opts?: { workstream?: string }): Promise<void>;
  getNamedDoc(category: 'root', key: RootNamedDocKey, opts?: { workstream?: string }): Promise<string | null>;
  getNamedDoc(category: Exclude<NamedDocCategory, 'root'>, key: string, opts?: { workstream?: string }): Promise<string | null>;
  commitPlanningState(message: string, files?: string[]): Promise<void>;

  // Event families (D-01/D-04): grouped by mutation semantics
  recordStateAppend(event: AppendEvent): Promise<void>;
  recordStateMutation(event: MutationEvent): Promise<void>;
  recordStateSignal(event: SignalEvent): Promise<void>;
}

export class UnsupportedCapabilityError extends Error {
  override readonly name = 'UnsupportedCapabilityError';
  readonly capability: string;
  readonly adapterName: string;
  /** Brand field for cross-module instanceof resilience (dual-package/vitest transform). */
  readonly __brand = 'UnsupportedCapabilityError' as const;
  constructor(capability: string, adapterName: string) {
    super(`Adapter '${adapterName}' does not support capability '${capability}'`);
    this.capability = capability;
    this.adapterName = adapterName;
  }

  static [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance != null &&
      typeof instance === 'object' &&
      (instance as Record<string, unknown>).__brand === 'UnsupportedCapabilityError'
    );
  }
}

// Companion type guards (D-11) — one per optional capability
export function hasBinaryAsset(a: StorageAdapter): a is StorageAdapter & { capabilities: Capabilities & { binaryAsset: true } } {
  return a.capabilities.binaryAsset;
}
export function hasSnapshot(a: StorageAdapter): a is StorageAdapter & { capabilities: Capabilities & { snapshot: true } } {
  return a.capabilities.snapshot;
}
export function hasTransaction(a: StorageAdapter): a is StorageAdapter & { capabilities: Capabilities & { transaction: true } } {
  return a.capabilities.transaction;
}
export function hasNamedDoc(a: StorageAdapter): a is StorageAdapter & { capabilities: Capabilities & { namedDoc: true } } {
  return a.capabilities.namedDoc;
}
export function hasMarkdownLockfile(a: StorageAdapter): a is StorageAdapter & { capabilities: Capabilities & { markdownLockfile: true } } {
  return a.capabilities.markdownLockfile;
}
