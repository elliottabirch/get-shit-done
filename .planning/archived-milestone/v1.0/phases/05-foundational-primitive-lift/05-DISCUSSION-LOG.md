# Phase 5: Foundational primitive lift - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 05-foundational-primitive-lift
**Areas discussed:** Dry-run hoist + anchor depth, Multi-author concurrency (OQ-10), putNamedDoc vs per-category modules (PRIMITIVES-04), Sidecar + scratch taxonomy (OQ-05 + OQ-07)

**Mode:** Advisor (calibration tier: `standard`, vendor philosophy: `pragmatic`). Four parallel `gsd-advisor-researcher` agents produced comparison tables before presentation.

---

## Dry-run primitive shape

| Option | Description | Selected |
|--------|-------------|----------|
| snapshot()/restore() primitives | Opaque snapshotId; pipeline snapshots real dir, runs mutation, diffs, always restores. Matches cp -r semantics. ~40 LOC pipeline rewrite. | |
| withTransaction rollback | Upgrade Phase 3's lock-only withTransaction to journal-and-rollback. Dry-run = run in txn, rollback. Tight beads-native fit. | ✓ |
| Hybrid (snapshot internal, withTransaction public) | pipeline calls withTransaction({dryRun:true}); markdown uses snapshot/restore internally; beads uses savepoints. Three primitives. | |

**User's choice:** withTransaction rollback
**Notes:** Agent recommendation was snapshot/restore (simpler); user chose the one-primitive path to keep the adapter surface tight and mirror SQLite txn semantics. Trade-off accepted: every mutating adapter method gains shadow-dir awareness.

---

## withTransaction journal mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Inverse-op journal | Each mutation pushes inverse op; rollback replays inverses in reverse. In-memory, no tmpdir. | |
| Copy-on-write journal | First-write captures pre-state; rollback restores. Equivalent to snapshot scoped to touched paths. | |
| Shadow-dir journal | Txn writes go to tmpdir layered over real; commit = rename into place, rollback = rm tmpdir. Closest to today's cp -r but scoped. | ✓ |

**User's choice:** Shadow-dir journal
**Notes:** Preserves today's cp -r mental model while getting rid of the full-tree copy. Reads inside an active txn must merge tmpdir-over-real so updateSection sees its own pending writes.

---

## Level-3+ anchor support in updateSection

| Option | Description | Selected |
|--------|-------------|----------|
| Walk heading depth — support ###/#### | Anchor can be ## Foo, ### Bar, #### Baz; section terminates at same-or-shallower depth. Rewrite extractSection/replaceSection ~80→~150 LOC. | ✓ |
| Stay ## only; L3+ via whole-parent write | Caller of ### Evidence grabs whole ## parent, rewrites child, writes back. Zero new regex but drifts across adapters. | |

**User's choice:** Walk heading depth
**Notes:** Keeps MarkdownAdapter and BeadsAdapter atomicity units aligned. Mitigates §9 HIGH-severity "section semantics differ across adapters" risk.

---

## Multi-author concurrency contract (OQ-10)

| Option | Description | Selected |
|--------|-------------|----------|
| updateSection internally withTransaction-wrapped | Zero caller burden; reentrant-lock guard (~10 LOC) so nested calls don't deadlock. Satisfies SC§2 AI-SPEC 3-author reordering. | ✓ |
| Caller responsibility | Explicit concurrency at workflow layer; AI-SPEC 3-author orchestrator MUST stay sequential. Easy to forget wrapping → silent lost-update bugs. | |
| Per-(file, sectionId) lock | Max parallelism; markdown putRecord writes whole file so per-section lock needs merge logic; deadlock risk; violates Phase 3 D-08. | |

**User's choice:** updateSection internally withTransaction-wrapped
**Notes:** Matches Phase 3 D-08 (withTransaction = single concurrency primitive). BeadsAdapter maps trivially via bd issue-edit atomicity.

---

## putNamedDoc scope vs Phase 4 per-category handlers (PRIMITIVES-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Additive primitive; Phase 4 handlers delegate | adapter.putNamedDoc(category, key, body) added; handlers swap putRecord→putNamedDoc internally. | |
| Primitive-first framing (same runtime, different framing) | Phase 4 handlers explicitly framed as wrappers-over-primitive. Category becomes a typed union. Defensible against future workflow additions. | ✓ |
| Pure adapter primitive, no SDK consolidation | Add to interface but handlers keep calling putRecord(path). Fails ROADMAP §142 grep AC; primitive is dead code. | |

**User's choice:** Primitive-first framing (Option D)
**Notes:** Free-text response was "let do D". Same runtime as additive (Option A); framing makes the primitive the primary contract and aligns with SYNTHESIS §4 "thin wrappers over 6 primitives".

---

## Root-level singletons (HANDOFF, CONTINUE-HERE, DECISIONS-INDEX)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep on raw putRecord | Root singletons stay outside the primitive; category enum only covers real collections. | |
| Synthetic category 'root' with fixed keys | adapter.putNamedDoc('root', 'HANDOFF' \| 'CONTINUE-HERE' \| 'DECISIONS-INDEX', body). Unified contract; literal-union key preserves grep-zero. | ✓ |

**User's choice:** Synthetic category 'root' with fixed keys
**Notes:** Everything goes through the primitive. Key for 'root' is a TypeScript literal union, not an arbitrary string — discriminated overload in adapters/types.ts.

---

## Sidecar + scratch taxonomy (OQ-05 + OQ-07)

| Option | Description | Selected |
|--------|-------------|----------|
| SDK-typed handlers, adapter stays Bin A | New SDK verbs (next-call-count.*, discuss.checkpoint.*, discuss.questions.*); adapter unchanged. BeadsAdapter path-sniffs a small closed set. | ✓ |
| Adapter-level sidecar primitive | 3 adapter methods + typed key enum. Closed-enum prevents typo drift. Contradicts §6 #4 recommendation; inflates interface. | |
| Stay generic | Raw getRecord/putRecord; path is convention. Beads must sniff; re-opens Rule-4 leak pattern. | |

**User's choice:** SDK-typed handlers, adapter stays Bin A
**Notes:** Phase 6 BeadsAdapter contract stays frozen. Follows Phase 4 tmp-docs.ts precedent. Lifecycle stays at workflow layer.

---

## Scratch lifecycle location

| Option | Description | Selected |
|--------|-------------|----------|
| First-class types with dedicated SDK verbs | discuss.checkpoint.* and discuss.questions.* get their own verbs; artifacts live at .planning/phases/NN-*/ (not .planning/tmp/). | ✓ |
| Fold into existing tmp-docs | Checkpoints become tmpPut entries. Reuses Phase 4 machinery but phase-scoped vs tmp-lifecycle semantics differ. | |

**User's choice:** First-class types with dedicated SDK verbs
**Notes:** Checkpoints are phase-scoped, co-located with canonical phase artifacts. OQ-07 resolved by first-class naming.

---

## Claude's Discretion

User delegated the following to planner/executor:

- Plan count and sequencing (likely 5-7 plans given cross-cutting scope)
- Exact module layout for new SDK verbs (separate sidecar.ts/scratch.ts vs fold-in)
- Tmpdir location for shadow-dir journal (os.tmpdir() vs .planning/.tmp-txn/)
- Whether shadow-dir uses symlinks/hard-links/cow for large files
- Whether to ship a one-shot migrate-named-docs script or hand-edit per handler
- Exact ADR text for OQ-02, OQ-05, OQ-07, OQ-10 resolutions
- Conformance test structure (extension of Phase 3 stubs vs new files)

## Deferred Ideas

- BeadsAdapter withTransaction mapping — Phase 6
- snapshot()/restore() as user-facing checkpoint API — post-v1.0
- UI-review screenshots + sketch asset consumer workflows — separate phases
- Conformance paired tests (both adapters) — Phase 7
- BeadsAdapter sidecar/scratch path-sniff map — Phase 6 README
- ROADMAP §142 grep verification script — planner's call
- Setext heading support (currently warned against) — future migration
- Category-enum growth registration procedure — v1.0 keeps intentional friction
- commitPlanningState no-op semantics inside dryRun txns — ADR follow-up
