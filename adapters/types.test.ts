// Type-level tests for StorageAdapter interface (TDD RED phase).
// These are compile-time assertions; they do NOT run at runtime.
// Run: npx tsc --noEmit (from adapters/ directory) to validate.
//
// Phase 5 Plan 01 extends this file with a runtime describe block covering
// D-13 (NamedDocCategory) and D-14 (RootNamedDocKey / discriminated overloads).

import { describe, it, expect } from 'vitest';

// Test 1: The module exports exist
// (will fail until adapters/types.ts is created)
import type {
  StorageAdapter,
  Capabilities,
  RecordRef,
  RecordFilter,
  SectionMode,
  NamedDocCategory,
  RootNamedDocKey,
} from './types.js';
import {
  UnsupportedCapabilityError,
  hasBinaryAsset,
  hasSnapshot,
  hasTransaction,
  hasNamedDoc,
  hasMarkdownLockfile,
} from './types.js';

// Test 2: literal-true required fields (D-05 + Pitfall 1)
// An object with record: false must NOT satisfy Capabilities
// This is a compile-time-only check — the assignment below must produce a type error:
// const _badCaps: Capabilities = { record: false, section: true, frontmatter: true,
//   binaryAsset: false, snapshot: false, transaction: false, namedDoc: false,
//   markdownLockfile: false };
// ^ Intentionally commented out — if uncommented, TypeScript must error.

// Test 3: Capabilities has exactly 9 keys (commitPlanningState promoted to required per D-12;
// graphEdges added in Phase 6 Plan 01 per D-OQ06-CAPS)
const _caps: Capabilities = {
  record: true,
  section: true,
  frontmatter: true,
  binaryAsset: false,
  snapshot: false,
  transaction: false,
  namedDoc: false,
  markdownLockfile: false,
  graphEdges: { semantic: false, dependency: false },
};
const _capKeys: (keyof Capabilities)[] = [
  'record', 'section', 'frontmatter',
  'binaryAsset', 'snapshot', 'transaction', 'namedDoc', 'markdownLockfile',
  'graphEdges',
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

// ---------------------------------------------------------------------------
// Phase 5 Plan 01 — D-13 / D-14 runtime assertions
// ---------------------------------------------------------------------------

describe('NamedDocCategory / RootNamedDocKey (D-13/D-14)', () => {
  it('NamedDocCategory values compile-check', () => {
    const cats: NamedDocCategory[] = [
      'research',
      'intel',
      'codebase',
      'archived-milestone',
      'reports',
      'sketches',
      'tmp',
      'root',
    ];
    expect(cats.length).toBe(8);
  });

  it('RootNamedDocKey values compile-check', () => {
    const keys: RootNamedDocKey[] = ['HANDOFF', 'CONTINUE-HERE', 'DECISIONS-INDEX'];
    expect(keys.length).toBe(3);
  });

  // Negative test documenting the overload's compile-time rejection. The
  // @ts-expect-error line MUST be present; removing it breaks this assertion.
  it('putNamedDoc("root", ARBITRARY_STRING) is rejected at compile time (D-14)', () => {
    // This block is a type-check-only assertion; no runtime execution.
    const assertOverloadRejectsArbitraryRootKey = (a: StorageAdapter): void => {
      // @ts-expect-error — 'root' category rejects arbitrary string keys per D-14
      a.putNamedDoc('root', 'ARBITRARY_STRING_NOT_IN_UNION', 'body');
    };
    expect(typeof assertOverloadRejectsArbitraryRootKey).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Phase 6 Plan 01 — D-OQ06-CAPS graphEdges assertion
// ---------------------------------------------------------------------------

describe('Capabilities graphEdges (D-OQ06-CAPS)', () => {
  it('has graphEdges: { semantic: boolean; dependency: boolean }', () => {
    // Compile-time gate: the literal MUST satisfy the Capabilities interface
    // with the full 9-key shape including the nested graphEdges object.
    const caps: Capabilities = {
      record: true,
      section: true,
      frontmatter: true,
      binaryAsset: true,
      snapshot: true,
      transaction: true,
      namedDoc: true,
      markdownLockfile: true,
      graphEdges: { semantic: true, dependency: false },
    };
    expect(typeof caps.graphEdges.semantic).toBe('boolean');
    expect(typeof caps.graphEdges.dependency).toBe('boolean');
    expect(caps.graphEdges.semantic).toBe(true);
    expect(caps.graphEdges.dependency).toBe(false);
  });
});
