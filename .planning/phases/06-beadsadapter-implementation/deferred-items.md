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
