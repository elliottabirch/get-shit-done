# Phase 06 — Deferred Items

Items discovered during execution that are out of scope for the current plan. Documented
here instead of fixing inline (per executor Scope Boundary — only fix issues directly
caused by the current task's changes).

---

## Deferred-01: Pre-existing `markdown/index.test.ts` failures (Phase 1 RED stale)

**Discovered:** Plan 06-01 Task 1 verification pass (2026-05-11)
**File:** `adapters/markdown/index.test.ts`
**Count:** 6 failing tests
**Failures:**
- `capabilities shape matches locked contract` — asserts `binaryAsset: false`, `snapshot: false`, `namedDoc: false`, and `caps.commitPlanningState` (the last was removed from Capabilities per D-12); all stale vs. current MarkdownAdapter literal.
- `getSection extracts body of named ## heading` — passes plain "Anchor" instead of full ATX marker `## Anchor`; Phase 5 D-06 changed parseAnchor to require ATX markers.
- `updateSection overwrite replaces section, leaves siblings intact` — same ATX-anchor issue.
- `updateSection append adds content after existing body` — same ATX-anchor issue.
- `snapshot() throws UnsupportedCapabilityError` — stale; Phase 5 Plan 03 implemented snapshot (caps.snapshot flipped to true).
- `writeBinaryAsset() throws UnsupportedCapabilityError` — stale; Phase 5 Plan 04 implemented binaryAsset (caps.binaryAsset flipped to true).

**Root cause:** `markdown/index.test.ts` was written for Phase 1 RED (Plan 01-03) when
the optional capabilities were all `false` and the foundational primitives were
defensive throws. Phase 5 implemented snapshot + binaryAsset + namedDoc and changed
section-anchor parsing to require ATX markers, but this test file was never updated.

**Verified pre-existing:** reproduced on a clean `feat/storage-adapter @ 1e4b9d1b` with
Plan 06-01 changes stashed — same 6 failures. NOT caused by Plan 06-01 (Task 1 only
added `graphEdges` to the Capabilities interface and literal; it did not touch binaryAsset,
snapshot, namedDoc, writeBinaryAsset, updateSection, or getSection).

**Impact on Plan 06-01:** zero. Plan 06-01 adds `graphEdges`, does not regress any of
these pre-existing failures, and the new D-OQ06-CAPS assertion in `types.test.ts`
passes cleanly.

**Proposed owner:** post-Phase-6 cleanup plan or Phase 5 debt-sweep. Fix is mechanical:
update expected capability values to match D-03/D-16/D-17, update section-anchor
arguments to include the ATX `##` prefix, and replace `snapshot`/`writeBinaryAsset`
defensive-throw assertions with the Phase 5 behavior.

---

## Deferred-02: Pre-existing `init-bundlers.test.ts` failures

**Discovered:** Plan 06-01 Task 1 verification pass (2026-05-11)
**File:** `tests/conformance/init-bundlers.test.ts`
**Count:** 2 failing tests
**Failures:**
- `init bundler: init-new-milestone.before.json > produces byte-identical output to baseline (post-sanitization)` — diff shows `recent: [...]` entries drifted from the baseline JSON.
- `init bundler: init-todos.before.json > produces byte-identical output to baseline (post-sanitization)` — diff shows a `todos: []` → `todos: [{...cjs-sdk-golden-parity-failures...}]` drift plus `todos_dir_exists: false → true` and `pending_dir_exists: false → true`.

**Root cause (hypothesis):** baseline JSONs are stale relative to current
STATE.md contents or fixture layout. The drift appears to be test-data hygiene,
not a behavioral regression.

**Verified pre-existing:** reproduced on a clean `feat/storage-adapter @ 1e4b9d1b` with
Plan 06-01 changes stashed — same 2 failures.

**Impact on Plan 06-01:** zero. Plan 06-01 does not touch init-bundlers code or
STATE.md content.

**Proposed owner:** post-Phase-6 cleanup plan; regenerate baselines via
`npm run test:conformance -- -u` (if vitest's update-snapshot is wired) or manual
baseline refresh once STATE.md content stabilizes.

---

## Deferred-03: BdRunner (Plan 06-02 commit `6ce2329`) needs v1.0.4 empty-store shape detection

**Discovered:** Plan 06-03 Task 3 spike execution (2026-05-12) + Task 4
human-verify checkpoint (2026-05-12). See `06-03-SPIKE-RESULTS.md §8.3`.

**File:** `/Volumes/code/gsd-beads/src/bd/helper.ts` (the `BdRunner` class
ported in Plan 06-02, sibling commit `6ce2329`).

**Issue:** bd's "no issues found" empty-store sentinel changed shape between
v1.0.3 and v1.0.4:

| bd version | `bd list --json --all` on empty store | Exit code |
|:-----------|:--------------------------------------|:---------:|
| v1.0.3     | `{"error":"no issues found","schema_version":"..."}` | 0 |
| v1.0.4     | `[]`                                  | 0 |

`BdRunner`'s Landmine-7 detection as shipped in Plan 06-02 pattern-matches
the v1.0.3 `{error, schema_version}` shape and maps it to the `BeadsEmpty`
sentinel. On v1.0.4 (which is now the `engines.bd` minimum per Plan 06-03
outcomes), the `[]` response is not recognized as "empty store via
sentinel" — it's recognized as "valid empty collection" by the
JSON-array-unwrap fallback. Functionally, both result in "no issues to
return", so downstream consumers that branch on `BeadsEmpty` vs. regular
empty-array behavior MAY observe semantic drift.

**Reproducer:**

```bash
# Requires bd v1.0.4+ on PATH
T=$(mktemp -d) && cd "$T"
git init -q
bd init --non-interactive --quiet
bd list -l nonexistent-label --json --all  # emits "[]" exit 0 (v1.0.4)
                                            # v1.0.3 would emit the sentinel object
```

`BdRunner.list(...)` on v1.0.4 returns `[]` (array) rather than throwing
`BeadsEmpty`. Any caller that explicitly catches `BeadsEmpty` to distinguish
"store missing from disk" vs. "store exists but collection is empty" will
lose that signal.

**Impact assessment:** LOW for v1.0 ship. The D-MAPPING Outcome A event-
family dispatch in Plan 06-06 does NOT branch on `BeadsEmpty` vs. empty
array — both paths return `[]` to the adapter contract's `listCollection`
return. Downstream primitive consumers (pipeline.ts / graphify.cjs)
treat the two identically. This is a latent gap, not an active regression.

**Proposed fix (Plan 06-05+ OR Phase 6.1):**

Option A — detect bd version at `BeadsAdapter.init()` and switch:
```ts
// In BdRunner constructor or init:
const version = await detectBdVersion(); // runs `bd --version`
this._emptyStoreDetector =
  version.startsWith('1.0.3')
    ? isV103EmptySentinel      // { error, schema_version }
    : isV104EmptyArray;         // []
```

Option B — handle both shapes in the fallback:
```ts
// In BdRunner.list() or the shared parse path:
if (isV103EmptySentinel(raw) || isV104EmptyArray(raw)) {
  throw new BeadsEmpty(...);
}
```

Option B is simpler and matches the "defensive fallback" pattern of
Landmines 5/6. Option A is more principled (version-gated behavior) but
adds a bd-version-probe to the init path.

**Proposed owner:** Plan 06-05 (`_ensureBd()` / `BeadsAdapter.init()` —
ideal: bundle with the v1.0.4+ runtime version probe) OR Phase 6.1 if
06-05 ships without this fix. Either way, SPIKE-RESULTS.md §8.3 evidence
serves as the reproducer.

**Cross-references:**
- `06-03-SPIKE-RESULTS.md §8.3` (empirical FAIL verdict against v1.0.4).
- `D-2026-05-12-OQ06-MAPPING` ADR, Consequences block, "Landmine 7 changed
  in v1.0.4" bullet.
- Plan 06-02 (already-landed sibling commit `6ce2329` is where the
  detection code currently lives).

---

## Deferred-04: D-TXN Outcome A mid-txn commit atomicity gap (Phase 6.1 follow-up)

**Discovered:** Plan 06-03 Task 4 human-verify checkpoint (2026-05-12) —
user override of Task-3's Outcome-C proposal to ship Outcome A instead.
See `D-2026-05-12-OQ06-TXN` ADR and `06-03-SPIKE-RESULTS.md §7 (D-TXN)`.

**Issue:** D-TXN Outcome A (in-memory write-buffer + replay on commit,
discard on rollback) does NOT provide snapshot semantics. If a buffered
op fails mid-replay (e.g., bd crashes on op #N of K during commit), bd is
left with ops 1..(N-1) committed and ops (N+1)..K unapplied. Outcome A
cannot roll back ops 1..(N-1) because no snapshot was taken — the
transaction's pre-commit state is not preserved anywhere.

**Impact assessment:** MEDIUM-LOW for v1.0 ship:
- Mid-replay crashes are rare (bd invocations are typically stable).
- The partial-commit state is SURFACED to the caller (via a structured
  error — Plan 06-06 decides the exact shape, e.g., `BeadsPartialCommitError`
  with `{committedOps, failedOp, remainingOps}`), so downstream callers
  CAN implement compensating logic at the application layer.
- `capabilities.snapshot: false` is advertised honestly, so Phase 7
  CONFORM-04 failure-injection test EXPECTS to fail on BeadsAdapter
  (tracked separately as Deferred-05).

**Proposed fix (Phase 6.1 migration path):**

Swap `src/txn/buffer.ts` (Outcome A) → `src/txn/snapshot.ts` (Outcome C)
using the invocation pattern + fixes documented in `06-03-SPIKE-RESULTS.md`
§7 "Outcomes not chosen" block:

1. Snapshot on txn entry: `mkdir -p <stagingDir>/.beads && bd -C <projectDir>
   export --json -o <stagingDir>/.beads/issues.jsonl`.
2. Restore on rollback: `cd <stagingDir> && bd init --from-jsonl
   .beads/issues.jsonl --non-interactive --quiet`.
3. fs-level POSIX atomic cutover via `.beads/` rename for rollback commit.
4. Apply Landmine-12 (WR-04) fix: derive `--prefix` from snapshot metadata,
   NOT hardcoded `'sd'`.
5. Handle v1.0.4 `bd init` side-effects (Claude Code hooks installation,
   `CLAUDE.md` writes, `.claude/settings.json`) via strict tmpdir
   discipline — snapshot/restore must NEVER run in the project root.

Estimated LOC delta: ~+150 LOC (Outcome C implementation) — ~150 LOC
(Outcome A removal) = ~+0 LOC net, but ~+300 LOC of new code to review.

**Migration trigger:** Revisit Outcome C if any of the following become
true:
- Phase 7 CONFORM-04 failure-injection becomes mandatory for BeadsAdapter
  (Plan 06-07 may surface this).
- bd upstream ships `bd init --no-install-hooks` (or equivalent) flag that
  neutralizes the v1.0.4 side-effect surface.
- User feedback: observed mid-txn-crash incidents that leave partial
  state the caller cannot compensate for.

**Proposed owner:** Phase 6.1 (or earlier if a CONFORM-04 blocker
surfaces).

**Cross-references:**
- `D-2026-05-12-OQ06-TXN` ADR — full user rationale for the Outcome-A
  override.
- `06-03-SPIKE-RESULTS.md §7 (D-TXN) "Outcomes not chosen"` — preserved
  Outcome C invocation + fixes ready to drop in.
- Deferred-05 (CONFORM-04 known-gap) — paired tracker for the test-suite
  surface.

---

## Deferred-05: Phase 7 CONFORM-04 known-gap on BeadsAdapter (D-TXN Outcome A consequence)

**Discovered:** Plan 06-03 Task 4 human-verify checkpoint (2026-05-12)
— consequence of the D-TXN Outcome A pick. See
`D-2026-05-12-OQ06-TXN` ADR.

**Issue:** Phase 7 CONFORM-04 is the conformance-suite failure-injection
test that exercises mid-txn crash + snapshot rollback. BeadsAdapter
shipping D-TXN Outcome A (in-memory buffer, `capabilities.snapshot: false`)
cannot pass CONFORM-04 by design — it has no snapshot to roll back to.

**Impact assessment:** EXPECTED, NOT A REGRESSION. Tracked here so that:
- Phase 7 plan authoring is aware the test must be capability-gated OR
  marked as a known-failure disposition for BeadsAdapter.
- The Phase 6.1 D-TXN Outcome-C migration (Deferred-04) is the canonical
  fix path — shipping Outcome C flips `capabilities.snapshot: true` and
  CONFORM-04 passes.

**Proposed fix (Plan 06-07 OR Phase 7):**

Option A — capability-gated test selection. Conformance suite honors
`adapter.capabilities.snapshot === false` by SKIPPING CONFORM-04 with a
"snapshot capability absent" disposition. This is the cleanest integration
and matches the pattern used for `binaryAsset: false` on BeadsAdapter
(Plan 06-05 `writeBinaryAsset` throws `UnsupportedCapabilityError`).

Option B — known-failure expectation. CONFORM-04 runs but the suite
expects it to fail on adapters with `snapshot: false`. Brittle; rejected
in favor of Option A.

**Proposed owner:** Plan 06-07 (smoke + conformance wiring) surfaces the
gap; Phase 7 plan authoring decides the final integration.

**Cross-references:**
- `D-2026-05-12-OQ06-TXN` ADR, Consequences block, "Phase 7 CONFORM-04
  known-gap flag" bullet.
- Deferred-04 (mid-txn-commit-gap) — the Phase 6.1 Outcome-C migration is
  the permanent fix that closes this gap.
