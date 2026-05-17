---
phase: 03-wire-core-write-methods-recordstateevent
reviewed: 2026-05-10T22:30:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - adapters/types.ts
  - adapters/markdown/index.ts
  - sdk/src/query/state-mutation.ts
  - tests/conformance/write-events.test.ts
  - tests/conformance/write-outcome.test.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
  warning_fixed: 4
  info_fixed: 5
status: fixed
fixed_commits:
  - 8dd1c2be  # WR-01
  - e24c4192  # WR-02
  - 04edcf7a  # WR-03
  - f3838c84  # WR-04
  - 9ba15cd7  # IN-01 + IN-05 (fold-in)
  - 45726cb5  # IN-02
  - 228960a0  # IN-03 + IN-04 (fold-in)
---

# Phase 3 (Gap Plan 03-06): Code Review Report

**Reviewed:** 2026-05-10T22:30:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found
**Scope:** Delta from commit `bcbb1e49^..HEAD` only (03-06 gap closure: `StateWriteOutcome` three-state discriminated union). Prior plans 03-01..05 were reviewed in their own cycle and are out of scope.

## Summary

The discriminated union contract is well-designed and the refactor is methodical: seven internal helpers all return `HelperResult`, three dispatchers translate to `StateWriteOutcome`, and eight SDK callers consume the outcome without silent discards. Exhaustiveness checks (`const _exhaustive: never = event`) are present on all three dispatchers. `tsc` could not be run here, but the shapes line up on inspection.

No **blocker** / critical defects were found — the contract lands cleanly and the happy paths are correct.

Findings concentrate on two areas:

1. **Two unintentional behavior changes** slipped in during the helper refactor that are not documented in the ADR or in-code comments — specifically `updateSessionFields` switching from independent updates to short-circuit evaluation for `Last session`/`Last Date`, and `stateAddRoadmapEvolution` narrowing dedupe scope from whole-file to `### Roadmap Evolution` subsection only.
2. **Test-coverage gaps** in the new `write-outcome.test.ts` file — several outcome variants listed in the header coverage matrix are under-exercised, and three event sub-types (`session`, `forensic_session`, `quick_task`) are not covered by outcome-shape assertions at all. The `blocker_resolved`+section-exists-but-item-absent branch is also untested.

Minor quality items (inconsistent dedupe between append-family helpers, defensive dead-type paths, signal-path TOCTOU + txn-unsafety) are flagged as info.

## Warnings

### WR-01: `updateSessionFields` silently changed `Last session`/`Last Date` from independent updates to short-circuit evaluation

**File:** `adapters/markdown/index.ts:1037-1042`
**Issue:**
Prior behavior (pre-03-06) tried both field names independently:
```ts
result = this.replaceFieldInBody(result, 'Last session', now) ?? result;
result = this.replaceFieldInBody(result, 'Last Date', now) ?? result;
```
If a STATE.md had BOTH `Last session:` and `Last Date:` fields (legacy/unusual but possible), both were refreshed.

New behavior uses `??` to short-circuit:
```ts
const lastSession = this.replaceFieldInBody(working, 'Last session', now)
  ?? this.replaceFieldInBody(working, 'Last Date', now);
```
Only the first match wins; the second field is left stale. This is a silent semantic change with no comment, no ADR note, and no test coverage asserting the new behavior.

The parallel `Stopped At`/`Stopped at` and `Resume File`/`Resume file` paths already used `??` before 03-06, so this change isolates to `Last session`/`Last Date`.

**Fix:** Either (a) revert to independent updates (two statements), or (b) keep the short-circuit and add an inline comment + ADR note documenting the intentional change.

```ts
// Option (a) — preserve prior behavior:
let candidate = this.replaceFieldInBody(working, 'Last session', now);
if (candidate !== null) { working = candidate; anyReplaced = true; }
candidate = this.replaceFieldInBody(working, 'Last Date', now);
if (candidate !== null) { working = candidate; anyReplaced = true; }
```

### WR-02: `stateAddRoadmapEvolution` dedupe scope silently narrowed from whole-file to `### Roadmap Evolution` subsection

**File:** `sdk/src/query/state-mutation.ts:941-990` (caller-side dedupe removed) + `adapters/markdown/index.ts:984-1003` (adapter-side dedupe added)
**Issue:**
The removed caller-side dedupe scanned the ENTIRE STATE.md body:
```ts
const existing = await adapter.getRecord(statePath);
if (existing) {
  const existingLines = existing.split('\n').map(l => l.trim());
  if (existingLines.some(l => l === entry.trim())) { ... duplicate ... }
}
```

The new adapter-side dedupe only scans the `### Roadmap Evolution` subsection captured by `subsectionPattern`:
```ts
const existingLines = sectionBody.split('\n').map(l => l.trim());
if (existingLines.some(l => l === entry.trim())) { ... duplicate ... }
```

**Observable impact:** If an identical bullet line `- Phase 3 added: foo` appears elsewhere in STATE.md (e.g., in `## Decisions Made` or a prose bullet), the old handler would refuse the write and report `{added: false, reason: 'duplicate'}`. The new handler accepts it. The new scope is arguably *more correct* (different sections should have independent dedupe), but it is still a visible contract change with no test, no ADR note, and no mention in the commit message.

**Fix:** Add an outcome test that seeds a STATE.md where an identical line exists OUTSIDE `### Roadmap Evolution` and asserts the write now succeeds. Document the scope change in ADR D-2026-05-10-08. If the old whole-file behavior was actually load-bearing for any workflow, restore it via a secondary check in `appendToRoadmapEvolution`.

### WR-03: Resume path's `.gsd/WAITING.json` cleanup produces a misleading outcome when only the `.gsd/` copy exists

**File:** `adapters/markdown/index.ts:872-884`
**Issue:**
The resume handler checks only `.planning/WAITING.json`:
```ts
const existed = (await this.getRecord('WAITING.json')) !== null;
if (!existed) {
  try { unlinkSync(join(this.projectDir, '.gsd', 'WAITING.json')); } catch { /* ENOENT OK */ }
  return { applied: false, reason: 'nothing_to_remove' };
}
```

In the drift case where `.planning/WAITING.json` is absent but `.gsd/WAITING.json` exists, the handler successfully unlinks the `.gsd/` copy AND returns `{applied: false, reason: 'nothing_to_remove'}`. The caller (`stateSignalResume`) translates this to `{resumed: false, removed: false}` — but a file WAS removed. The outcome and the side effect disagree.

This is a pre-existing contract mismatch brought into sharper relief by the new three-state contract. Since the dual-write to `.gsd/` is `applied:true`-equivalent from the user's perspective (a pause WAS cleared), the outcome should reflect that.

**Fix:** Check existence of either location before returning `nothing_to_remove`, or scope the `applied:false` return strictly to the "both locations absent" case.

```ts
const planningExisted = (await this.getRecord('WAITING.json')) !== null;
const gsdPath = join(this.projectDir, '.gsd', 'WAITING.json');
const gsdExisted = existsSync(gsdPath);
if (!planningExisted && !gsdExisted) {
  return { applied: false, reason: 'nothing_to_remove' };
}
if (planningExisted) await this.removeRecord('WAITING.json');
try { unlinkSync(gsdPath); } catch { /* ENOENT OK */ }
return { applied: true };
```

### WR-04: `write-outcome.test.ts` coverage matrix does not match the coverage claimed in its header

**File:** `tests/conformance/write-outcome.test.ts:10-27`
**Issue:**
The file-header comment advertises a coverage matrix but several high-value cells are missing. Outcome-shape tests are absent for:

- **`Append/session`** (no tests at all in `write-outcome.test.ts`). Both `applied:true` and `applied:true + created_section` paths of the scaffold added in `updateSessionFields` are unverified by outcome assertions.
- **`Append/forensic_session`** — no `created_section` outcome test.
- **`Append/quick_task`** — no `created_section` outcome test (`write-events.test.ts:237-260` verifies body-level side effects but not the outcome shape).
- **`Append/metric`** applied:true **bare** (when the table already exists) is missing — only the `created_section` scaffold path is asserted.
- **`Mutation/todo_count_update`** applied:true **bare** (when section exists) is missing.
- **`Mutation/deferred_items`** applied:true + **created_section** (add against STATE.md without a Deferred Ideas section) is missing.
- **`Mutation/blocker_resolved`** — only the "no Blockers section" branch of `nothing_to_remove` is tested. The second branch in `removeFromBlockersList` (`filtered.length === lines.length` — section exists but the named blocker is not in the list) at `adapters/markdown/index.ts:1130-1133` is never exercised. Same omission for `mutateDeferredItems` remove at line 1197-1200.

**Fix:** Add the missing outcome tests so the coverage matrix is truthful. In particular, the `blocker_resolved` and `deferred_items` remove second-branch tests defend against future regressions in the helper short-circuit.

```ts
// Example: cover the section-exists-but-blocker-absent branch.
it('blocker_resolved: nothing_to_remove when section exists but blocker absent', async () => {
  await seedStateMd(adapter, '# State\n\n## Blockers\n\n- Other blocker\n');
  const outcome = await adapter.recordStateMutation({
    type: 'blocker_resolved',
    payload: { text: 'Does not exist' },
  });
  expect(outcome).toEqual({ applied: false, reason: 'nothing_to_remove' });
  // And the existing blocker must still be present (no accidental clobber).
  const content = await adapter.getRecord('STATE.md');
  expect(content).toContain('- Other blocker');
});
```

## Info

### IN-01: `HelperResult.body` semantics are asymmetric between applied:true and applied:false paths

**File:** `adapters/markdown/index.ts:107-112`
**Issue:** The helper type allows `body` to be any string on `applied:false` paths, but the dispatchers only use `body` when `applied:true`. Helpers currently always set `body: content` (unchanged) on `applied:false`, which is correct by convention but not enforced by the type system. A future contributor could set `body` to a partially-modified string on an applied:false path and cause silent data loss.

**Fix:** Consider making the type discriminated-union style to match `StateWriteOutcome`:
```ts
type HelperResult =
  | { applied: true; body: string; created_section?: string }
  | { applied: false; reason: 'duplicate' | 'nothing_to_remove' };
```
This makes it impossible to leak a half-baked `body` on no-op paths.

### IN-02: `mutateDeferredItems` add path lacks dedupe (asymmetric with `appendToRoadmapEvolution`)

**File:** `adapters/markdown/index.ts:1168-1182`
**Issue:** `appendToRoadmapEvolution` dedupes on exact-line match and returns `applied:false, reason:'duplicate'`. `mutateDeferredItems` with `action: 'add'` happily appends duplicate items. The three-state contract advertises `duplicate` as a canonical outcome for "caller's intent to add an entry already present", so the asymmetry is a contract-surface-area inconsistency. May or may not be intentional — worth a design decision note either way.

**Fix:** Either add dedupe to the add path (matching roadmap_evolution semantics), or document in the helper comment why deferred_items permits duplicates.

### IN-03: `recordStateSignal` is not wrapped in `withTransaction` — `.gsd/` writes cannot be rolled back

**File:** `adapters/markdown/index.ts:852-890`
**Issue:** `recordStateAppend` and `recordStateMutation` both wrap in `this.withTransaction(...)`. `recordStateSignal` does not. The dual-write to `.gsd/WAITING.json` uses direct `writeFileSync` / `unlinkSync`, which bypass the shadow-dir. If a caller wraps `recordStateSignal` in an outer `adapter.withTransaction(...)`, the `.planning/` side lands in the shadow (rollable) but the `.gsd/` side lands on real disk immediately (unrollable). This is pre-existing (not a 03-06 regression), but the new contract's "applied:true means data landed" claim is weaker for signals than for append/mutation.

**Fix:** Either wrap the signal handler in `withTransaction` and route `.gsd/` through a shadow-aware helper, or document the limitation in the `recordStateSignal` JSDoc.

### IN-04: The `resume` existence check has a TOCTOU window (pre-existing, not a 03-06 regression)

**File:** `adapters/markdown/index.ts:875-881`
**Issue:**
```ts
const existed = (await this.getRecord('WAITING.json')) !== null;
if (!existed) { ... return nothing_to_remove ... }
await this.removeRecord('WAITING.json');
```
If another process removes `WAITING.json` between `getRecord` and `removeRecord`, the second call is still idempotent (adapter's `removeRecord` silently swallows ENOENT). Functional impact is zero, but the outcome string could be inaccurate in a rare multi-writer scenario. Documented here for completeness.

**Fix:** No action required in v1 — idempotence absorbs the race. Consider noting in the JSDoc that `recordStateSignal` is not multi-writer-safe.

### IN-05: `applied:false` dispatcher path still acquires lock + creates tmp-txn directory for a no-op

**File:** `adapters/markdown/index.ts:697-782` (and the `recordStateMutation` analog at 789-846)
**Issue:** On dedupe / nothing_to_remove paths, the outer `withTransaction` still runs `acquireAdapterLock`, `mkdtemp('.tmp-txn-*')`, and `_commitShadowDir` (which walks empty sets). The lock + tmpdir cost is paid for a pure read. This is a perf concern only (out of v1 scope per the code-review guardrails), noted here for future optimization.

**Fix:** None required in v1. A future optimization could short-circuit the transaction wrap when the helper returns `applied:false` — but that would require reading STATE.md outside the lock first, which trades correctness for speed and is likely not worth it.

---

_Reviewed: 2026-05-10T22:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
