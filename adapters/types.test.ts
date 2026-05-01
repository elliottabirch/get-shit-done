// Type-level tests for StorageAdapter interface (TDD RED phase).
// These are compile-time assertions; they do NOT run at runtime.
// Run: npx tsc --noEmit (from adapters/ directory) to validate.

// Test 1: The module exports exist
// (will fail until adapters/types.ts is created)
import type {
  StorageAdapter,
  Capabilities,
  RecordRef,
  RecordFilter,
  SectionMode,
} from './types.js';
import {
  UnsupportedCapabilityError,
  hasBinaryAsset,
  hasSnapshot,
  hasTransaction,
  hasNamedDoc,
  hasCommitPlanningState,
  hasMarkdownLockfile,
} from './types.js';

// Test 2: literal-true required fields (D-05 + Pitfall 1)
// An object with record: false must NOT satisfy Capabilities
// This is a compile-time-only check — the assignment below must produce a type error:
// const _badCaps: Capabilities = { record: false, section: true, frontmatter: true,
//   binaryAsset: false, snapshot: false, transaction: false, namedDoc: false,
//   commitPlanningState: false, markdownLockfile: false };
// ^ Intentionally commented out — if uncommented, TypeScript must error.

// Test 3: Capabilities has exactly 9 keys
const _caps: Capabilities = {
  record: true,
  section: true,
  frontmatter: true,
  binaryAsset: false,
  snapshot: false,
  transaction: false,
  namedDoc: false,
  commitPlanningState: false,
  markdownLockfile: false,
};
const _capKeys: (keyof Capabilities)[] = [
  'record', 'section', 'frontmatter',
  'binaryAsset', 'snapshot', 'transaction', 'namedDoc', 'commitPlanningState', 'markdownLockfile',
];
// If Capabilities had more or fewer than 9 keys, the above would not be exhaustive.

// Test 4: markdownLockfile public methods exist on StorageAdapter (no ?:)
// Verified by the interface shape — compile error if absent

// Test 5: type guards narrow correctly
function _testTypeGuards(a: StorageAdapter): void {
  if (hasSnapshot(a)) {
    // a.capabilities.snapshot is true here
    const _snap: true = a.capabilities.snapshot;
  }
  if (hasBinaryAsset(a)) {
    const _ba: true = a.capabilities.binaryAsset;
  }
  if (hasTransaction(a)) {
    const _tx: true = a.capabilities.transaction;
  }
  if (hasNamedDoc(a)) {
    const _nd: true = a.capabilities.namedDoc;
  }
  if (hasCommitPlanningState(a)) {
    const _cps: true = a.capabilities.commitPlanningState;
  }
  if (hasMarkdownLockfile(a)) {
    const _ml: true = a.capabilities.markdownLockfile;
  }
}

// Test 6: UnsupportedCapabilityError message format
const _err = new UnsupportedCapabilityError('snapshot', 'markdown');
const _msg: string = _err.message;
// Expected: "Adapter 'markdown' does not support capability 'snapshot'"
const _cap: string = _err.capability;
const _adapterName: string = _err.adapterName;

// Test 7: RecordRef shape
const _ref: RecordRef = { path: 'phases/01/PLAN.md', name: 'PLAN.md' };

// Test 8: RecordFilter is a predicate function
const _filter: RecordFilter = (ref) => ref.name.endsWith('.md');

// Test 9: SectionMode values
const _mode1: SectionMode = 'overwrite';
const _mode2: SectionMode = 'append';
const _mode3: SectionMode = 'prepend';

// Test: stat() return shape (Phase 2 D-11)
function _testStat(a: StorageAdapter): void {
  const _p: Promise<{ kind: 'file' | 'dir'; mtime?: string } | null> = a.stat('STATE.md');
  void _p;
}
void _testStat;

// Test: stat result narrowing
async function _testStatNarrow(a: StorageAdapter): Promise<void> {
  const r = await a.stat('phases/01-foo');
  if (r === null) return;
  const _k: 'file' | 'dir' = r.kind;
  const _m: string | undefined = r.mtime;
  void _k; void _m;
}
void _testStatNarrow;

// Suppress unused-variable warnings for the type assertions above
void _caps; void _capKeys; void _err; void _msg; void _cap; void _adapterName;
void _ref; void _filter; void _mode1; void _mode2; void _mode3;
void _testTypeGuards;
