---
phase: 06-beadsadapter-implementation
fixed_at: 2026-05-12T00:00:00Z
review_path: /Volumes/code/get-shit-done/.planning/phases/06-beadsadapter-implementation/06-REVIEW.md
iteration: 1
scope: critical_warning
findings_attempted: 13
findings_fixed: 13
findings_deferred: 6
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-05-12
**Source review:** `.planning/phases/06-beadsadapter-implementation/06-REVIEW.md`
**Iteration:** 1
**Scope:** critical_warning (Info findings deferred to Phase 6.1 / Phase 7)

## Summary

- Findings in scope: 13 (4 critical + 9 warnings)
- Fixed: 13
- Deferred: 6 (all Info — out of scope per `fix_scope: critical_warning`)
- Status: all_fixed

This run resumed a prior interrupted fix session. The prior run
successfully committed CR-01, CR-02, CR-03 and then died before the
cleanup tail ran. The recovery sentinel at
`.planning/phases/06-beadsadapter-implementation/.review-fix-recovery-pending.json`
was detected on startup; the fast-forward + worktree-remove + branch
delete cleanup from the prior run was completed, then a fresh worktree
was established to apply CR-04 + all 9 warnings.

All fix commits land on the sibling repo (`/Volumes/code/gsd-beads`)
branch `feat/phase-6-reset`. The fork repo (`feat/storage-adapter`)
was NOT touched by these fixes — all in-scope findings targeted files
inside `/Volumes/code/gsd-beads/src/`.

## Fixed Issues

### CR-01: Symlink-escape gap in `_abs()` path-traversal guard

**File:** `src/primitives.ts:67-94, 34, 468` (gsd-beads)
**Commit:** `5f22aae` (from prior interrupted run)
**Applied fix:** `realpathSync()` on the deepest existing ancestor of
`abs`, re-check containment against `realpathSync(projectRoot)`. Removed
the unused `pathRelative` breadcrumb import + its `void pathRelative`
suppression. Canonicalization + existsSync walk covers POSIX + macOS
symlink-escape vectors the pre-fix lexical `path.resolve()` check missed.

### CR-02: `_deriveEventId` halved, narrow keyspace for blocker-label identity

**File:** `src/events.ts:117-124` (gsd-beads)
**Commit:** `00100a2` (from prior interrupted run)
**Applied fix:** Replace `Math.abs(h).toString(36)` with
`(h >>> 0).toString(36)`. `>>> 0` unsigned-32-bit coerces the full range,
fixing (a) the `Math.abs(h) === Math.abs(-h)` keyspace halving and (b)
the `Math.abs(-2147483648) === -2147483648` fixed-point `-`-prefix
label fragment. Full SHA-256-truncated upgrade deferred to Phase 6.1 if
blocker volume ever warrants more entropy.

### CR-03: `parseRequirementsBody` placeholder pushes on fence toggle

**File:** `src/format/schemas/requirements.ts:69-78` (gsd-beads)
**Commit:** `1f41985` (from prior interrupted run)
**Applied fix:** Remove the `{} as never` placeholder pushes on fence
open/close. Fence toggles inside a category are now a no-op (not a
requirement item); outside a category, the raw fence line is preserved
in prose for round-trip. Eliminates runtime-heterogeneity in
`current.items` (RequirementItem[]) and `proseLines` (string[]).

### CR-04: `withTransaction` concurrent-caller buffer contamination

**File:** `src/txn.ts:162-250` + new `tests/unit/with-transaction-concurrent.test.ts` (gsd-beads)
**Commit:** `ec39906`
**Applied fix (USER OVERRIDE — AsyncLocalStorage):** REVIEW.md suggested
either (a) an async mutex keyed by BdRunner or (b) a docs-only
"single-flight-only" contract. The user REJECTED both and chose
Option C: AsyncLocalStorage (node:async_hooks).

Rewrote txn context storage from `WeakMap<BdRunner, TxnContext>` to
`AsyncLocalStorage<TxnContext>`. Each `withTransaction` call opens its
own async-hooks context with its own buffer; concurrent callers NEVER
share state. Nested `withTransaction` inside the same async flow still
JOINs the outer buffer (reentrancy semantics preserved via depth
tracking on the ambient context).

Rationale for AsyncLocalStorage over the mutex suggestion:
- correctness by construction (isolation is structural, not after-the-fact)
- preserves parallelism (vs mutex serialization)
- matches Node ecosystem idiom (express/fastify/OpenTelemetry standard)
- Phase 7 conformance parity with MarkdownAdapter's filesystem-lock
  (both isolate correctly, one per-context, one per-PID)

Added `tests/unit/with-transaction-concurrent.test.ts` (4 tests) locking
in the regression: concurrent-isolation, reentrancy-still-joins,
concurrent rollback independence, isTxnActive false outside the
callback. All 4 pass. All 9 existing `tests/smoke/transaction.test.ts`
tests continue to pass. All 18 `state-events-{append,mutation,signal}`
smoke tests continue to pass.

### WR-01: `_resolveMilestoneBead` AND-semantics assumption on `bd list -l`

**File:** `src/events.ts:83-105` (gsd-beads)
**Commit:** `3bc3a97`
**Applied fix:** Single `-l gsd:milestone` query + in-process post-filter
on `labels[]` for `version:<key>`. Avoids the undocumented-AND-vs-OR
risk for `bd list -l A -l B`. Same spawn count (1); AND guarantee is now
explicit in JS.

### WR-02: `formatState` tautological trailing-newline expression

**File:** `src/format/state.ts:255` (gsd-beads)
**Commit:** `eee002a`
**Applied fix:** Replace `(body.endsWith('\n') ? '' : '')` (both arms '')
with `(body.endsWith('\n') ? '\n' : '')`. Preserves trailing newline on
section-append — eliminates round-trip byte drift for STATE.md files
ending in '\n'.

### WR-03: `removeRecord` / `removeCollection` phantom-persistence on phase-addressed bd paths

**File:** `src/primitives.ts:195-301` (gsd-beads)
**Commit:** `6b23351`
**Applied fix:** Add explicit `throw new Error(...)` guard for
`route.tier === 'bd' && !route.label` in both `removeRecord` and
`removeCollection`, mirroring the existing `putRecord` guard. All three
Bin A write-side ops now surface the Plan 06-06 scope boundary
consistently; read-side (`getRecord`) already handled phase-addressed
bd paths.

### WR-04: `_bufferContainsRememberKey` indexOf-without-guard hazard

**File:** `src/events.ts:162-166, 397-401` (gsd-beads)
**Commit:** `51e2420`
**Applied fix:** Extract shared `_rememberOpMatchesKey(op, key)` helper.
Both the `_bufferContainsRememberKey` check AND the `todo_count_update`
inline filter now route through it. Eliminates the latent trap where
the inline filter silently decayed to matching `op.args[0]` (the
literal `'remember'` string) when `--key` was absent.

### WR-05: `atomicWriteFile` fsync tmpfile before rename

**File:** `src/_atomicWrite.ts:42-49` (gsd-beads)
**Commit:** `8956d1d`
**Applied fix:** Open tmpfile via `openSync('w')` + `writeFileSync(fd,body)`
+ `fsyncSync(fd)` + `closeSync(fd)` BEFORE rename. Data pages are
durably flushed before the directory-entry swap commits the replacement;
system crash between write and flush can no longer fsck-recover an
empty inode at the target. Directory-level fsync (ext4/xfs rename-entry
durability) intentionally NOT added — matches MarkdownAdapter
Pitfall-7 triage.

### WR-06: `updateFrontmatter` / `mergeFrontmatter` runtime serializability guard

**File:** `src/primitives.ts:390` (gsd-beads)
**Commit:** `df6757b`
**Applied fix:** Added `_assertFrontmatterSerializable(value, context)`
helper that `JSON.stringify`-round-trips the value before handing it to
`formatFrontmatter` / js-yaml's `dump`. Rejects functions, Symbols, and
circular refs with a typed `TypeError` instead of allowing a mid-write
js-yaml crash or unparseable `!!js/function` YAML tags.

### WR-07: `findBeadsRoot` silent fall-through on invalid `BEADS_DIR`

**File:** `src/bd/findRoot.ts:37-48` + `tests/unit/findRoot.test.ts` (gsd-beads)
**Commit:** `4b58a52`
**Applied fix:** Throw `BdManagedMismatchError` when `BEADS_DIR` is set
but points at a directory without `metadata.json`. Previously fell
through silently to parent-walk, masking user configuration errors.
Also updated `tests/unit/findRoot.test.ts::case 1b` — previously
asserted the silent fallthrough; now asserts the throw.

### WR-08: `deriveDiskStatus` orphan-summary semantic lock via unit test

**File:** `src/helpers/deriveDiskStatus.ts:41-43` + new `tests/unit/deriveDiskStatus.test.ts` (gsd-beads)
**Commit:** `5d71d41`
**Applied fix:** Added 8 unit tests locking in the D-07 priority chain,
specifically the WR-08 orphan-summary case (`summaryCount > 0 &&
planCount === 0` → `'partial'`). Expanded JSDoc to spell out the two
distinct caller-semantics that both collapse to `'partial'` today, with
a Phase 7 CONFORM-04 follow-up note for future
`'orphan-summary'` enum split.

### WR-09: `dep-graph.ts` self-blocks edges

**File:** `src/dep-graph.ts:96-110` (gsd-beads)
**Commit:** `97069bf`
**Applied fix:** Added `if (d.depends_on_id === issue.id) continue;`
defensive filter. Spike-014 protects cascade walks from self-loops, but
`graphify.cjs` and pipeline dry-run may not — filter at the synthesizer
tier so downstream consumers never see one.

## Deferred Issues

All 6 Info findings are deferred per `fix_scope: critical_warning`:

- **IN-01** (`src/primitives.ts:34, 468` — unused `pathRelative` import):
  Addressed as part of CR-01 fix; the breadcrumb import was deleted when
  CR-01 landed the actual symlink-escape hardening. Effectively already
  resolved.
- **IN-02** (`src/primitives.ts:353-364` — `updateSection` round-trip
  O(N) per call): Performance, not correctness. Deferred to Phase 6.1
  (coalescing pass).
- **IN-03** (`src/bd/helper.ts:107` — `BdRunner` corruption heuristic
  over-matches `database`/`dolt`): Tightening the regex + routing
  permissions errors to `BeadsUnavailableError` rather than `BeadsCorrupt`.
  Deferred; low real-world hit rate, flagged for a follow-up.
- **IN-04** (`src/format/state.ts:200-208` — silent skip on malformed
  JSON payload in parseState): Surface errors via log or accumulated
  error array. Deferred; out of critical_warning scope.
- **IN-05** (`src/primitives.ts:320-337` — `stat` omits `mtime` for
  bd-tier): Documentation-only; contract marks `mtime?` as optional.
  Deferred to README capability table.
- **IN-06** (`src/format/schemas/requirements.ts:30-36` — flat
  categories lose nested H2/H3): Out of v1 scope per sibling-carry-
  forward policy.

## Verification

- Type check (tsc --noEmit) clean after every commit (all 10 fresh
  commits validated; 3 prior-run commits also validated as part of the
  resume).
- Affected unit + smoke tests run after each fix; all pass.
- Full `tests/unit` suite run at end: 117/117 passing across 11 files.
- Concurrent-isolation regression test (`with-transaction-concurrent`)
  added for CR-04; 4 tests covering isolation, reentrancy-still-joins,
  concurrent rollback independence, and `isTxnActive` lifecycle.
- Existing 9 `transaction.test.ts` smoke tests still pass after ALS
  rewrite (reentrancy + rollback semantics preserved).
- Existing 18 `state-events-{append,mutation,signal}` tests still pass
  (withTransaction integration verified).
- Existing 16 `record-primitives` + `named-doc` smoke tests still pass
  after WR-03 throw-on-phase-addressed-bd changes.

## Commit Log (sibling: `/Volumes/code/gsd-beads`, branch `feat/phase-6-reset`)

| ID | Severity | File | Commit | Outcome |
|---|---|---|---|---|
| CR-01 | Critical | `src/primitives.ts:67-94` | `5f22aae` | fixed (prior run) |
| CR-02 | Critical | `src/events.ts:117-124` | `00100a2` | fixed (prior run) |
| CR-03 | Critical | `src/format/schemas/requirements.ts:69-78` | `1f41985` | fixed (prior run) |
| CR-04 | Critical | `src/txn.ts:162-250` | `ec39906` | fixed (AsyncLocalStorage per user override of REVIEW.md mutex suggestion) |
| WR-01 | Warning | `src/events.ts:83-105` | `3bc3a97` | fixed |
| WR-02 | Warning | `src/format/state.ts:255` | `eee002a` | fixed |
| WR-03 | Warning | `src/primitives.ts:195-301` | `6b23351` | fixed |
| WR-04 | Warning | `src/events.ts:162-166,397-401` | `51e2420` | fixed |
| WR-05 | Warning | `src/_atomicWrite.ts:42-49` | `8956d1d` | fixed |
| WR-06 | Warning | `src/primitives.ts:390` | `df6757b` | fixed |
| WR-07 | Warning | `src/bd/findRoot.ts:37-48` | `4b58a52` | fixed |
| WR-08 | Warning | `src/helpers/deriveDiskStatus.ts:41-43` | `5d71d41` | fixed |
| WR-09 | Warning | `src/dep-graph.ts:96-110` | `97069bf` | fixed |

---

_Fixed: 2026-05-12_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
