---
phase: 06-beadsadapter-implementation
reviewed: 2026-05-12T00:00:00Z
depth: standard
iteration: 2
files_reviewed: 47
files_reviewed_list:
  - /Volumes/code/gsd-beads/.gitignore
  - /Volumes/code/gsd-beads/CLAUDE.md
  - /Volumes/code/gsd-beads/CONTRIBUTING.md
  - /Volumes/code/gsd-beads/README.md
  - /Volumes/code/gsd-beads/package.json
  - /Volumes/code/gsd-beads/tsconfig.json
  - /Volumes/code/gsd-beads/vitest.config.ts
  - /Volumes/code/gsd-beads/src/_atomicWrite.ts
  - /Volumes/code/gsd-beads/src/bd/errors.ts
  - /Volumes/code/gsd-beads/src/bd/findRoot.ts
  - /Volumes/code/gsd-beads/src/bd/helper.ts
  - /Volumes/code/gsd-beads/src/capabilities.ts
  - /Volumes/code/gsd-beads/src/dep-graph.ts
  - /Volumes/code/gsd-beads/src/errors.ts
  - /Volumes/code/gsd-beads/src/events.ts
  - /Volumes/code/gsd-beads/src/format/frontmatter.ts
  - /Volumes/code/gsd-beads/src/format/phase.ts
  - /Volumes/code/gsd-beads/src/format/schemas/ai-spec.ts
  - /Volumes/code/gsd-beads/src/format/schemas/context.ts
  - /Volumes/code/gsd-beads/src/format/schemas/debug-session.ts
  - /Volumes/code/gsd-beads/src/format/schemas/decisions.ts
  - /Volumes/code/gsd-beads/src/format/schemas/index.ts
  - /Volumes/code/gsd-beads/src/format/schemas/plan.ts
  - /Volumes/code/gsd-beads/src/format/schemas/project.ts
  - /Volumes/code/gsd-beads/src/format/schemas/requirements.ts
  - /Volumes/code/gsd-beads/src/format/schemas/roadmap.ts
  - /Volumes/code/gsd-beads/src/format/schemas/spec.ts
  - /Volumes/code/gsd-beads/src/format/schemas/uat.ts
  - /Volumes/code/gsd-beads/src/format/schemas/verification.ts
  - /Volumes/code/gsd-beads/src/format/section.ts
  - /Volumes/code/gsd-beads/src/format/state.ts
  - /Volumes/code/gsd-beads/src/helpers/deriveDiskStatus.ts
  - /Volumes/code/gsd-beads/src/helpers/detectDrift.ts
  - /Volumes/code/gsd-beads/src/helpers/loadMilestoneHeading.ts
  - /Volumes/code/gsd-beads/src/helpers/parsePhaseId.ts
  - /Volumes/code/gsd-beads/src/index.ts
  - /Volumes/code/gsd-beads/src/init.ts
  - /Volumes/code/gsd-beads/src/paths.ts
  - /Volumes/code/gsd-beads/src/primitives.ts
  - /Volumes/code/gsd-beads/src/txn.ts
  - /Volumes/code/gsd-beads/tests/conformance.test.ts
  - /Volumes/code/gsd-beads/tests/fixture.ts
  - /Volumes/code/gsd-beads/tests/unit/with-transaction-concurrent.test.ts
  - /Volumes/code/get-shit-done/adapters/types.ts
  - /Volumes/code/get-shit-done/adapters/markdown/index.ts
  - /Volumes/code/get-shit-done/package.json
  - /Volumes/code/get-shit-done/tests/conformance/tsconfig.json
  - /Volumes/code/get-shit-done/vitest.config.ts
findings:
  critical: 0
  warning: 2
  info: 6
  total: 8
status: issues_found
---

# Phase 6: Code Review Report (Iteration 2)

**Reviewed:** 2026-05-12
**Depth:** standard
**Files Reviewed:** 47 (same 45 from iteration 1 + new tests/unit/with-transaction-concurrent.test.ts + the test was also part of the code-under-review)
**Iteration:** 2 (re-review after fix pass)
**Status:** issues_found (2 warnings; all critical findings from iteration 1 are resolved)

## Summary

Iteration-1 fix verification: all 4 CRITICAL findings (CR-01 symlink guard, CR-02
32-bit hash keyspace, CR-03 `{} as never` placeholder, CR-04 withTransaction
concurrency) and all 9 WARNING findings land cleanly. The CR-04 rewrite from a
WeakMap-keyed txn store to `AsyncLocalStorage` is the biggest change and is
executed well — no stale `state.activeTransaction` references remain in src/,
all call sites (primitives.ts and events.ts) consume the context exclusively
through `isTxnActive`, `peekBuffer`, `queueOrRun`, and the ALS-scoped `withTransaction`
entry point; the companion test `tests/unit/with-transaction-concurrent.test.ts`
directly exercises concurrent-isolation, intra-flow reentry, and rollback
isolation. CR-01's `realpathSync` hardening correctly walks up to the deepest
existing ancestor before canonicalizing (the off-by-one "probe doesn't exist
but its parent does" case is handled). CR-02's `h >>> 0` coercion preserves
the full 32-bit unsigned keyspace and never emits a `-`-prefixed fragment —
though the underlying 32-bit djb2 collision surface is itself a design
tradeoff, not a bug (doc'd as Phase 6.1 scope for escalation to SHA).

Two residual warnings remain after re-review:

- **WR-1 (iter-2):** `_assertFrontmatterSerializable` (WR-06 fix) does NOT
  reject functions or Symbols — `JSON.stringify(function(){})` returns
  `undefined` (does not throw), and Symbols / function values inside objects
  are silently stripped. The fix's JSDoc claims it rejects "functions /
  Symbols / circular refs"; only circular refs are actually rejected. The
  broken-YAML path through `js-yaml.dump` that WR-06 sought to prevent is
  only PARTIALLY closed.
- **WR-2 (iter-2):** `withTransaction` silently swallows an inner `dryRun:
  true` opt when the inner call JOINs an outer (non-dry-run) context. This
  is not documented and can surprise callers composing dry-run helpers with
  outer real transactions — the inner's ops still commit.

Both iteration-1 IN-{1,2,3,4,5,6} info findings are still present
(expected — info-tier was out of fixer scope). None has escalated to
warning/critical; reclassification unchanged.

Focus-area verification matrix:

| Focus area | Iter 1 | Iter 2 |
|---|---|---|
| CR-01 path-traversal + symlink guard | Partial | **Resolved** — realpathSync probe + deepest-existing-ancestor walk implemented in `_abs()` |
| CR-02 `_deriveEventId` halved keyspace | Blocker | **Resolved** — `h >>> 0` gives full 32-bit unsigned range, no `-`-prefix edge case |
| CR-03 `{} as never` placeholder | Blocker | **Resolved** — placeholder pushes deleted; fence toggles are pure `inFence` flips + conditional prose preservation |
| CR-04 withTransaction concurrency | Blocker | **Resolved** — AsyncLocalStorage-scoped txn context; concurrent callers get isolated buffers; nested reentry in same flow joins (test-verified) |
| All WR-01..WR-09 iteration-1 fixes | N/A | **Resolved** |
| No regressions introduced by ALS rewrite | — | **Confirmed** — no `state.activeTransaction`, no `WeakMap<BdRunner, TxnContext>` references remain in src/ |

## Critical Issues

None. All 4 iteration-1 BLOCKER findings verify resolved.

## Warnings

### WR-1 (iter-2): `_assertFrontmatterSerializable` does not reject the two shapes its JSDoc claims to reject

**File:** `/Volumes/code/gsd-beads/src/primitives.ts:460-468`
**Issue:** The iteration-1 WR-06 fix introduced this guard and claims (in
JSDoc):

```
a cheap, battle-tested way to reject functions, Symbols, and circulars
before they reach the YAML serializer
```

But `JSON.stringify` does NOT throw on functions or Symbols — it either
silently returns `undefined` (when the top-level value is a function /
Symbol / undefined) or silently DROPS them from object/array entries:

```ts
JSON.stringify(() => 'a')                    // 'undefined' (not thrown)
JSON.stringify({fn: () => 'a'})              // '{}'         (silent drop)
JSON.stringify({sym: Symbol('x')})           // '{}'         (silent drop)
JSON.stringify({nested: [Symbol('x'), 1]})   // '{"nested":[null,1]}'
```

`JSON.stringify` only THROWS on:
- circular references (`TypeError: Converting circular structure to JSON`)
- `BigInt` values (`TypeError: Do not know how to serialize a BigInt`)

Therefore the guard catches (a) circular refs and (b) BigInt — useful but
narrower than advertised. A caller passing `updateFrontmatter(path, 'foo',
function(){})` will PASS the guard (value is `function`, top-level stringify
returns `undefined` silently), hit `js-yaml.dump`, which may emit a
`!!js/function` tag, half-writing a file that subsequent `load` calls reject
as unparseable — exactly the WR-06 failure mode the guard was supposed to
block.

**Fix:** Either (a) tighten the assertion to explicitly reject functions and
Symbols pre-stringify:

```ts
function _assertFrontmatterSerializable(v: unknown, context: string): void {
  const t = typeof v;
  if (t === 'function' || t === 'symbol') {
    throw new TypeError(
      `BeadsAdapter.${context}: value of type ${t} is not YAML-serializable`,
    );
  }
  // Recurse into objects/arrays to catch embedded functions/symbols.
  if (v && typeof v === 'object') {
    for (const entry of Object.values(v as Record<string, unknown>)) {
      _assertFrontmatterSerializable(entry, context);
    }
  }
  try {
    JSON.stringify(v);
  } catch (e) {
    throw new TypeError(
      `BeadsAdapter.${context}: value is not JSON-serializable: ${String(e)}`,
    );
  }
}
```

Or (b) relax the JSDoc to match the actual behavior ("rejects circular
references and BigInt; functions and Symbols pass through silently, relying
on js-yaml.dump to raise or emit `!!js/...` tag"). The mismatch between
promise and behavior is the bug — a future maintainer reading the guard's
comment will incorrectly conclude that `updateFrontmatter(path, f, () => 1)`
is safe.

---

### WR-2 (iter-2): Inner `withTransaction` ignores `opts.dryRun` when JOINing outer context

**File:** `/Volumes/code/gsd-beads/src/txn.ts:200-219`
**Issue:** When `withTransaction` is called re-entrantly within the same
async flow (outer's `fn()` calls another helper that also wraps
`withTransaction`), the inner path enters the branch at lines 212-219:

```ts
if (existing && existing.bd === bd && !existing.finalizing) {
  existing.depth++;
  try {
    return await fn();
  } finally {
    existing.depth--;
  }
}
```

The inner call's `opts?.dryRun` is NEVER consulted. If a library author
writes `adapter.withTransaction(async () => { /* ... */ }, { dryRun: true })`
inside another running (non-dry) transaction, the dry-run semantic the
caller asked for is silently ignored — all the inner ops queue onto the
outer buffer and COMMIT when the outer commits. That is the opposite of
what `{ dryRun: true }` asks for.

Real scenarios:
- A validation helper that does "let me try these writes in dry-run mode to
  check for partial-commit errors" — gets real writes if called inside
  another transaction.
- A conformance assertion that wraps `withTransaction(fn, { dryRun: true })`
  around code that may itself internally transact — the inner ops commit.

Options:

1. **Reject inner `dryRun` with a clear error** — `if (opts?.dryRun &&
   existing) throw new Error('dryRun withTransaction cannot be nested inside
   a non-dryRun parent — call dryRun at the outermost only')`. Fails loud.
2. **Honor the inner `dryRun`** — track dryRun at each depth level and
   DISCARD inner ops on successful return. Much more complex; would require
   per-depth buffer partitioning.
3. **Document + enforce "dryRun only at root"** — current behavior but
   explicitly surface via a dev-mode warning when `opts?.dryRun` is passed
   into a nested call.

Option 1 is the safest minimal fix given Plan 06-06 / Outcome A already
requires callers to own dry-run semantics at the pipeline layer. At minimum
the current behavior should be explicit in the JSDoc (lines 200-204) — the
`opts` comment says `discards the buffer unconditionally on exit — never
replays` which is untrue for nested calls.

**Fix:**

```ts
if (existing && existing.bd === bd && !existing.finalizing) {
  if (opts?.dryRun) {
    throw new Error(
      'BeadsAdapter.withTransaction: { dryRun: true } is only honored at the ' +
      'outermost call. This call is nested inside an active transaction on the ' +
      'same BdRunner and would silently commit. Move dryRun to the outer call ' +
      'or split the logic.',
    );
  }
  existing.depth++;
  // ... rest unchanged ...
}
```

## Info (carry-over from iteration 1 — unchanged severity)

These were identified in iteration 1 and expected to remain. Listed here for
completeness; none has escalated to warning/critical severity.

### IN-01 (carry): Unused import `pathRelative` kept deliberately

Status: **RESOLVED in iter 1 fix pass.** Grep confirms `pathRelative` import
and `void pathRelative` pattern are no longer present in src/primitives.ts.
Finding is downgraded: no residual info.

### IN-02 (carry): `updateSection` round-trips through `getRecord`/`putRecord`

**File:** `/Volumes/code/gsd-beads/src/primitives.ts:417-428`
**Issue:** Unchanged from iteration 1. Out-of-scope for v1 per performance
exclusion; flagged for Phase 6.1 coalescing.

---

### IN-03 (carry): `BdRunner` corruption heuristic over-matches "database" and "dolt"

**File:** `/Volumes/code/gsd-beads/src/bd/helper.ts:107`
**Issue:** Unchanged from iteration 1 — regex still reads:

```ts
/database is locked|schema mismatch|corrupt|database|dolt|metadata\.json/i
```

Bare `database` and `dolt` match any bd error mentioning those tokens (e.g.
permission denials, "dolt table not found") and route them to `BeadsCorrupt`.
The recovery path for `BeadsCorrupt` is aggressive — flag for Phase 6.1.

---

### IN-04 (carry): `parseState` silently skips events with malformed JSON payload

**File:** `/Volumes/code/gsd-beads/src/format/state.ts:202-209`
**Issue:** Unchanged from iteration 1. Malformed payload `continue` with no
`console.warn`; hand-edited STATE.md typos lose events silently on round-trip.

---

### IN-05 (carry): `stat` omits `mtime` for bd-tier paths — asymmetry with MarkdownAdapter

**File:** `/Volumes/code/gsd-beads/src/primitives.ts:384-401`
**Issue:** Unchanged from iteration 1. `stat()` returns `{ kind: 'file' }`
(no `mtime`) for bd-tier records while MarkdownAdapter always emits
`mtime`. Documented asymmetry; bd's `updated_at` could fill in.

---

### IN-06 (carry): `RequirementCategory` type flattens L2/L3 hierarchy

**File:** `/Volumes/code/gsd-beads/src/format/schemas/requirements.ts:30-36`
**Issue:** Unchanged from iteration 1. Flat `categories` array with
`level: 2 | 3` loses parent-child relationships; follow-up.

## Verification observations (iteration 1 fixes re-checked)

### CR-01 fix verification (symlink hardening)

**File:** `/Volumes/code/gsd-beads/src/primitives.ts:79-137`

The fix correctly:
- realpath's `projectRoot` into `canonicalRoot` (with safe try/catch fallback
  to lexical root when the root itself doesn't exist yet)
- walks upward from `abs` until it finds an existing ancestor (`probe`)
- realpath's the deepest existing ancestor; unresolved tail is treated as-is
- asserts `canonical === canonicalRoot || canonical.startsWith(canonicalRoot + sep)`

Edge cases handled:
- `projectRoot` doesn't exist (mkdtemp-style) — falls back to lexical root
- `abs` doesn't exist — walks up, realpath's parent
- `probe === '/'` — loop terminates at root (`probe !== pathDirname(probe)`)
- Cross-platform abs rejection is still lexical: unchanged `looksAbsolute`
  block at lines 89-96

TOCTOU window between `_abs()` check and subsequent syscall is acknowledged
in JSDoc ("same window MarkdownAdapter accepts"). Acceptable tradeoff.

### CR-02 fix verification (event-id keyspace)

**File:** `/Volumes/code/gsd-beads/src/events.ts:138-147`

`(h >>> 0).toString(36)` gives 0..4294967295 range (~7 base-36 chars max),
never collapses `h` and `-h`, and never emits `-`-prefixed fragments. The
fix correctly resolves both issues flagged in iteration 1. The underlying
32-bit djb2 collision surface remains (birthday collisions at ~65k distinct
payloads) but is now honestly documented; SHA-256 escalation deferred to
Phase 6.1.

### CR-03 fix verification (`{} as never` deletion)

**File:** `/Volumes/code/gsd-beads/src/format/schemas/requirements.ts:69-85`

Placeholder pushes into `current.items` / `proseLines` are both removed.
Fence-toggle path now correctly:
- flips `inFence`
- preserves fence-line in `proseLines` IF outside a category (round-trip
  preservation of leading fences)
- no side-effects on `current.items` (would pollute `RequirementItem[]`)

Confirmed via grep: no remaining `as never` pushes in src/.

### CR-04 fix verification (AsyncLocalStorage rewrite)

**File:** `/Volumes/code/gsd-beads/src/txn.ts:132-280`

The rewrite is executed cleanly:
- `txnStorage = new AsyncLocalStorage<TxnContext>()` is the single source of
  truth for txn state.
- `TxnContext` now includes `{ depth, buffer, dryRun, finalizing, bd }` —
  the `bd` field enables the stray-context guard at `_currentCtxFor`.
- `withTransaction` root-path wraps the body in `txnStorage.run(ctx, async
  () => { ... })`, scoping the context to that async flow only.
- Reentry path (existing context found AND same BdRunner AND !finalizing)
  JOINs and increments depth.
- Test coverage: `tests/unit/with-transaction-concurrent.test.ts` asserts:
  1. Two concurrent `withTransaction` callers do NOT share buffer (smoking-
     gun regression test for the pre-fix WeakMap contamination).
  2. Nested-in-same-flow calls DO join buffer (reentry preserved).
  3. Concurrent rollback on one txn does not affect the other.
  4. `isTxnActive` is false outside the callback.

Grep confirmed no stale `state.activeTransaction`, `WeakMap<BdRunner,
TxnContext>`, or `getCurrentTxn` references anywhere in src/ or tests/.
All event-family helpers in events.ts consume the txn state exclusively
through the public `isTxnActive` / `peekBuffer` / `queueOrRun` surface.

### Landmines / pre-existing behavior re-verified (NOT new bugs)

- `removeRecord` / `removeCollection` bd-tier paths call `bd.run()` DIRECTLY
  (not via `queueOrRun`), so cascade deletes are EAGER and bypass
  `withTransaction`. This is pre-existing behavior not claimed to be fixed
  in iteration 1; consistent with the "disk-tier writes pass through"
  tradeoff called out in txn.ts JSDoc. Phase 6.1 can address if needed.
- `getRecord` for phase-addressed paths (`phases/NN-foo/*`) silently falls
  through to disk when `route.tier==='bd' && !route.label`. The iter-1 WR-03
  fix only hardened `removeRecord` and `removeCollection` to throw on the
  same case; `getRecord` still reads from disk. The remaining asymmetry is
  "reads fall back to disk; writes/removes throw." Arguably cohesive under
  D-MAPPING Outcome A (Plan 06-06 scope boundary) — not a new bug.
- `parseRequirementsBody` after the CR-03 fix still always pushes the
  fence-delim line into `proseLines` at the END of the conditional, even
  when inside a category (line 78-79). Cross-checked: the `!current` guard
  there means "only preserve fence line in prose when we're outside a
  category." Inside a category the fence content is lost — which may be
  intentional (fences inside category bodies are not requirement items).
  No observable regression; possibly surprising round-trip drift for mixed
  category-prose-with-fence authoring.

---

_Reviewed: 2026-05-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
