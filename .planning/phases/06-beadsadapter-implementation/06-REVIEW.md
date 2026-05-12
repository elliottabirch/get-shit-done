---
phase: 06-beadsadapter-implementation
reviewed: 2026-05-12T00:00:00Z
depth: standard
iteration: 3-final
files_reviewed: 11
files_reviewed_list:
  - /Volumes/code/gsd-beads/src/primitives.ts
  - /Volumes/code/gsd-beads/src/txn.ts
  - /Volumes/code/gsd-beads/src/events.ts
  - /Volumes/code/gsd-beads/src/_atomicWrite.ts
  - /Volumes/code/gsd-beads/src/bd/findRoot.ts
  - /Volumes/code/gsd-beads/src/dep-graph.ts
  - /Volumes/code/gsd-beads/src/format/state.ts
  - /Volumes/code/gsd-beads/src/format/schemas/requirements.ts
  - /Volumes/code/gsd-beads/src/helpers/deriveDiskStatus.ts
  - /Volumes/code/gsd-beads/tests/unit/with-transaction-concurrent.test.ts
  - /Volumes/code/gsd-beads/tests/unit/assert-frontmatter-serializable.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 6: Code Review Report (Iteration 3 — Final)

**Reviewed:** 2026-05-12
**Depth:** standard
**Iteration:** 3-final (post-iter-2 warning fixes)
**Files Reviewed:** 11 (narrowed per config: 9 src + 2 regression tests)
**Status:** clean

## Summary

Final adversarial re-review of iteration 3 fixes for Phase 6
BeadsAdapter. Scope was narrowed by config to the files touched by the
iter-3 fix pass: the 9 source files previously modified in iter 1 (with
2 — `primitives.ts` and `txn.ts` — receiving the iter-3 patches) and 2
regression test files.

**Both iter-2 warnings resolved. No new critical or warning issues
surfaced. Unit suite reports 131/131 green per fixer report.**

Iter-3 fix verification matrix:

| Finding | iter 2 | iter 3 |
|---|---|---|
| WR-1 (iter-2) `_assertFrontmatterSerializable` does not reject functions / Symbols | Warning | **Resolved** — explicit object-tree walker + TypeError on function/symbol at any depth; 10 regression tests (commit e532aed) |
| WR-2 (iter-2) nested `{ dryRun: true }` silently ignored | Warning | **Resolved** — nested-dryRun-inside-non-dryRun rejected with TypeError; 4 regression tests (commit 460cdb5) |
| All iter-1 CR-01..04 / WR-01..09 fixes | Resolved | **Still resolved** — no regressions detected |

## Critical Issues

None.

## Warnings

None.

## Verification details

### WR-1 (iter-2) resolution — `_assertFrontmatterSerializable` hardening

**File:** `/Volumes/code/gsd-beads/src/primitives.ts:468-509`

The fixer replaced the `JSON.stringify`-only probe with an explicit
object-tree walker that throws `TypeError` on any `function` or
`symbol` value at any depth, then retains the `JSON.stringify` probe
as defense-in-depth for circular refs + BigInt.

Correctness traced:

- Walker is **iterative** (heap-allocated worklist), not recursive.
  Pathological deep-nesting input cannot blow the JS call stack before
  the circular-ref check fires.
- `WeakSet` visited-tracking (line 487-488) prevents the walker itself
  from looping on circular structures. The subsequent `JSON.stringify`
  probe (line 503) surfaces the circular-ref as a TypeError with a
  diagnostic message — verified by the `a.self = a` regression test.
- Order of checks is correct: walker runs BEFORE `JSON.stringify`.
  An input that is BOTH circular AND contains a function → the walker
  throws the function error first (walker stops at the function node;
  circular detection by `seen` keeps the walker bounded). Verified by
  tracing: `{fn: () => 1, self: self}` → worklist pops obj → adds to
  `seen` → pushes `[fn, obj]` → pops obj (seen → skip) → pops fn →
  throws. No stack overflow risk.
- Array handling uses `for (const entry of cur)` — correct for arrays
  of primitives, arrays of objects, sparse arrays (undefined slots
  are `typeof === 'undefined'` and bypass the function/symbol check,
  matching `JSON.stringify` semantics).
- Object handling uses `Object.values(cur as Record<string, unknown>)`.
  Null-prototype objects: `Object.values(Object.create(null))` returns
  `[]` — safe. Class instances: walked by enumerable-own-values only,
  which matches what `JSON.stringify` sees — consistent semantic.
- Map/Set edge case: `Object.values(new Map([[1, () => 2]]))` returns
  `[]` because Map internals are not enumerable-own-properties. A
  caller passing `new Map()` containing functions would bypass the
  walker — but `JSON.stringify` also silently strips Map contents
  (`JSON.stringify(new Map([[1,2]])) === '{}'`), so js-yaml never
  sees the bad value either. No silent-bypass regression vs the
  stated guard contract.

Error messages are distinct and prescriptive:
- function/symbol: `"value of type function is not YAML-serializable (functions and Symbols are silently dropped by JSON.stringify and would produce malformed YAML via js-yaml's \`!!js/function\` tag)."`
- circular/BigInt: `"value is not JSON-serializable (circular references or BigInt): ..."`

Regression coverage at `tests/unit/assert-frontmatter-serializable.test.ts`
(10 cases):

1. Top-level function (line 39-49)
2. Top-level Symbol (line 51-61)
3. Nested function inside object (line 63-69)
4. Nested Symbol inside array (line 71-77)
5. `mergeFrontmatterFn` patch-level function (line 79-86)
6. `mergeFrontmatterFn` deep-nested Symbol (line 88-94)
7. Circular reference (line 96-108)
8. BigInt (line 110-120)
9. Diamond shared-ref (benign — walker must not false-reject) (line 122-140)
10. Clean nested object (walker passes clean) (line 142-159)

The negative-case tests (9, 10) use `.rejects.not.toThrow(/is not
YAML-serializable/)` — a loose regex-negation assertion. The positive
tests (1-8) with their specific regex patterns anchor the guard
contract; the negative tests only verify absence of the guard's own
TypeError. This is defensible — ANY downstream rejection (from
`_abs`, `existsSync`, `atomicWriteFile`) satisfies the "guard did not
false-reject" requirement. Noted for completeness but NOT flagged as a
regression.

The `ensureStub` pattern (`throw new Error('ensure() called — guard
did not reject')`) correctly proves that the guard fires BEFORE any IO
attempt — the tests fail with a diagnostic message if the guard is
bypassed.

### WR-2 (iter-2) resolution — nested-dryRun rejection

**File:** `/Volumes/code/gsd-beads/src/txn.ts:228-255`

The fixer added a TypeError throw when `opts?.dryRun && !existing.dryRun`
inside the reentry branch. Silent ignore is replaced with fail-loud.

Correctness traced:

- Throw is positioned INSIDE the join branch (after confirming outer
  context exists, matches same `BdRunner`, and is not finalizing).
  Prevents false-positives from stray ALS contexts belonging to
  unrelated adapter instances.
- Throw fires BEFORE `existing.depth++` (line 249). The outer's depth
  counter is not polluted even if the TypeError is caught somewhere
  up the chain.
- Asymmetric acceptance handled correctly: the condition `opts?.dryRun
  && !existing.dryRun` means nested dryRun is accepted silently ONLY
  when the outer is ALSO dryRun (redundant but compatible — inner ops
  discard with outer's on commit). Matches the comment rationale at
  lines 236-248.
- Error message is prescriptive: tells callers to "Move `dryRun:
  true` to the outermost withTransaction call, or restructure so the
  inner logic runs outside the outer transaction." This is strictly
  better than a bare "cannot nest" string — it tells the reader the
  two resolution paths.
- Failure propagation: the TypeError thrown inside nested
  `withTransaction` surfaces from the inner call into the outer's
  `fn()` body. The outer's try/catch at `src/txn.ts:268-276` catches
  it, sets `finalizing=true`, clears buffer, resets depth to 0, and
  re-throws. Outer's buffer is fully discarded — no partial-commit
  hazard. The regression test at line 198-200 asserts `recorded ===
  []` post-throw.

Regression coverage at
`tests/unit/with-transaction-concurrent.test.ts:170-267` (4 cases):

1. Reject on non-dryRun outer (line 171-201) — asserts `innerEntered
   === false` (rejected BEFORE inner body) and `recorded === []`
   (outer rollback discarded its own queued op).
2. Accept on dryRun outer (line 203-230) — redundant-but-compatible
   path; asserts inner ran and nothing replayed.
3. Unaffected non-dryRun join (line 232-250) — regression check
   against over-broad fix that might reject ALL nested calls.
4. Root-level dryRun regression (line 252-266) — ensures the
   common case still works.

Together with the 4 existing concurrency-isolation tests in the same
file (from iter-2 CR-04 coverage), the ALS-scoped txn semantics +
WR-2 nesting guard are now covered end-to-end.

### Regression scan across all 11 reviewed files

Traced for new bugs introduced during iter-3 fix cycle:

- **`_abs` symlink hardening** (`primitives.ts:79-137`) — probe-walk
  loop terminates correctly at filesystem root
  (`probe !== pathDirname(probe)` guard). `realpathSync` fallbacks
  (try/catch at lines 110-117 and 126-130) are safe — they degrade
  to the lexical form without weakening containment. No iter-3 change;
  no regression.
- **`atomicWriteFile`** (`_atomicWrite.ts`) — `randomBytes(6)` (48-bit)
  entropy + `fsyncSync(fd)` before rename, `openSync` fd properly
  released in `finally`. Clean. No iter-3 change.
- **`findBeadsRoot`** (`bd/findRoot.ts`) — BEADS_DIR authoritative with
  fail-loud `BdManagedMismatchError`; worktree `.git`-file resolution
  preserved. No iter-3 change.
- **`materializeGraphJson`** (`dep-graph.ts`) — spike-014 filters
  (`type === 'blocks'`, NOT `dependency_type`) + WR-09 self-loop
  filter + BeadsEmpty → `{edges:[]}` identity preserved. No iter-3
  change.
- **`parseState` / `formatState`** (`format/state.ts`) — WR-02
  trailing-newline preservation + code-fence bypass in section scan.
  No iter-3 change.
- **`parseRequirementsBody`** (`format/schemas/requirements.ts`) —
  CR-03 fence-toggle no-op preserved. No iter-3 change.
- **`deriveDiskStatus`** (`helpers/deriveDiskStatus.ts`) — priority
  chain preserved; WR-08 orphan-summary collapse documented as Phase
  7 deferred. No iter-3 change.
- **`events.ts` recordState families** — `_rememberOpMatchesKey`
  shared helper remains; dedupe guards consult both bd state AND
  buffer for own-writes-visible invariant; CR-02 unsigned-hash
  coercion `h >>> 0` preserved. No iter-3 change.
- **`primitives.ts` non-guard regions** — `getRecord` / `putRecord` /
  `removeRecord` / `removeCollection` / `listCollection` / `exists` /
  `stat` / `getSection` / `updateSection` / named-doc helpers all
  unchanged relative to iter 2. The only iter-3 delta is
  `_assertFrontmatterSerializable`.
- **`txn.ts` non-guard regions** — `BeadsPartialCommitError`,
  `txnStorage`, `_currentCtxFor`, `isTxnActive`, `peekBuffer`,
  `queueOrRun`, commit-phase replay loop, snapshot/restore stubs all
  unchanged relative to iter 2. The only iter-3 delta is the nested-
  dryRun throw at lines 238-248.

No cross-file type-contract drift. All public exports from
`primitives.ts` / `txn.ts` / `events.ts` retain the same signatures;
the iter-3 changes are strictly additive (new throws surfacing
previously-silent misuse).

## Info

None in scope. The 5 info-tier carry-overs from iter 1 (IN-02..IN-06)
are explicitly out-of-scope per review config (critical+warning only).

## Known-deferred items (NOT flagged — per review config)

- IN-02..IN-06 info-tier carry-overs from iter 1
- Deferred-04: D-TXN Outcome A mid-txn partial-commit gap → Phase 6.1
- Deferred-05: Phase 7 CONFORM-04 `created_section` relaxation

---

_Reviewed: 2026-05-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 3-final_
