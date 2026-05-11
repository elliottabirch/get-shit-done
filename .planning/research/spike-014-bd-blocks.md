---
spike: 014-bd-blocks-sibling-deps
status: complete
verdict: option-a-validated
date: 2026-04-30
phase_complete_tag: phase-5-complete
gap_closed: GAP-01
---

# Spike 014: bd blocks-type for Sibling Phase Ordering

## Verdict

**Option (a) — `bd dep add <child> <parent>` (default `blocks` type) — is the
validated path for modeling sibling-phase `depends_on` in `roadmap.analyze`.**

All seven validation questions returned the desired behavior on bd v1.0.3.

## Why this matters

Phase 5 shipped `roadmap.analyze` and `roadmap.get-phase` read handlers, but
both emit `depends_on: null` always (GAP-01). Plan 5.6 (gap-closure) needs a
concrete bd primitive carrying sibling-phase ordering before it can wire field
extraction. Five candidates were on the table:

- (a) `bd dep add` (default `blocks` type) — natural for `bd ready`
- (b) custom `--type depends-on` edge — disambiguates from runtime semantics
- (c) label-based `depends:phase-N`
- (d) description-text `Depends on:` parsing — **rejected by user** (string parsing)
- (e) don't model — emit null forever (loses `bd ready` REQ-08)

This spike validates (a) before Plan 5.6 commits to it.

## Sandbox

- Tempdir: `mktemp -d -t spike-014-XXXXXX`
- bd binary: `bd version 1.0.3 (1b2dd2cb)`
- Isolation: `BEADS_ACTOR=spike014 bd init --prefix sp14 --non-interactive --skip-agents`
- All commands run with explicit `BEADS_ACTOR=spike014` (the v0.2 fixture pattern)

## Question-by-question results

### Q1 — bd ready ordering with blocks ✅ PASS

Setup:
```
A_ID=sp14-cy8 (Phase A: depends on B, gsd:phase)
B_ID=sp14-a80 (Phase B: should run first, gsd:phase)
bd dep add $A_ID $B_ID    # → "depends on ... (blocks)"
```

Observed:
- `bd ready` (both open) returns ONLY B (`sp14-a80`)
- Close B → `bd ready` returns A (`sp14-cy8`)
- `bd list --json` reports `dependency_count: 1` on A and `dependent_count: 1` on B

Verdict: ordering semantics work as advertised. Phase 5 plans where Phase 4
must complete before Phase 5 will route through `bd ready` correctly when
encoded as `bd dep add 5 4`.

### Q2 — blocks edge in `bd export --json` ✅ PASS (with field-shape note)

`bd export` is JSONL (one issue per line). On the bead emitting the
dependency, the array uses these fields:

```json
"dependencies": [
  {
    "issue_id":      "sp14-cy8",
    "depends_on_id": "sp14-a80",
    "type":          "blocks",
    "created_at":    "2026-04-30T09:34:43Z",
    "created_by":    "spike014",
    "metadata":      "{}"
  }
]
```

Critical for read handlers:
- Field name is **`type`** (NOT `dependency_type`). `dependency_type` only
  appears in `bd show <id> --json` output (different shape — embeds the full
  target bead).
- Direction: `depends_on_id` is the BLOCKER (the parent in our ordering).
- Filter pattern for `roadmap.analyze`:
  ```js
  bead.dependencies?.filter(d => d.type === 'blocks').map(d => d.depends_on_id)
  ```
- Single export call surfaces all edges (REQ-QUAL-07 ≤2 spawn budget intact;
  no per-phase `bd deps` round-trip needed).

### Q3 — cascade-loop interference ✅ PASS

Setup: phase A blocked by phase B (blocks edge), with task T1 attached to A
via parent-child edge.

Observed:
1. Close B (A's blocker, NOT A's parent-child child) → run cascade-loop →
   exits at iter=0 with `No epics eligible`. **A stays open.**
2. Close T1 (A's parent-child child) → run cascade-loop → cascade closes A at
   iter=1 with `Closed 1 epic(s) - sp14-cy8`.

Verdict: `bd epic close-eligible` walks parent-child only. `blocks` edges are
inert to cascade. Confirms the spike-002 finding extends to the v0.2 sibling
ordering use case.

### Q4 — JSONL roundtrip preservation ✅ PASS (with actor caveat)

`bd export` → `bd init --from-jsonl` (different tempdir) → re-export → diff:
- Bead-level fields **byte-identical** (id, title, status, timestamps, labels,
  dependency_count, dependent_count).
- `dependencies[]` array structure preserved (issue_id, depends_on_id, type,
  created_at, metadata) **byte-identical**.
- Only delta: edge `created_by` flips from original actor (`spike014`) to
  reseed actor (`seed`) — the `BEADS_ACTOR` override at reseed time. This
  matches the existing `seed-fixture.sh` convention and is benign for field
  extraction (read handlers don't read `created_by`).

### Q5 — determinism across reseeds ✅ PASS

Two reseeds from the same JSONL with `BEADS_ACTOR=seed` for both:
- Full `bd export` outputs **byte-identical** (`diff` returns empty).
- `dependencies[]` field ordering, formatting, and timestamps stable across
  reseeds.

Verdict: existing `tests/shadow-tests/seed-determinism.test.sh` will continue
to pass when v0.2 seeds add `bd dep add` invocations to `build-seed.sh`.

### Q6 (optional) — bd dep tree visualization ✅ Confirmed

- `bd dep tree A` renders the blocks chain (A → B). Walks `blocks` deps. Useful
  for debugging dep ordering.
- `bd children A` renders parent-child only (T1, NOT B). Confirms tool
  partitioning matches spike-findings reference doc.

### Q7 (added during critique) — multi-blocker semantics ✅ PASS

A blocked by both B and C:
- `bd ready` (all open) returns ONLY B and C (A correctly hidden).
- Close B only → `bd ready` returns ONLY C (A still blocked).
- Close C → `bd ready` returns A.
- `bd export` for A surfaces BOTH blocks edges in `dependencies[]` array.

Verdict: multi-blocker is fully captured. Real-world phases with two upstream
deps (e.g., Phase 11 depending on both Phase 9 and Phase 10) will be encoded
and read correctly.

## Implications for Plan 5.6 (GAP-01 closure)

### What Plan 5.6 must do

1. **`build-seed.sh` extension:** add a `bd dep add <child> <parent>` invocation
   for each sibling-phase ordering edge in the seed (e.g., Phase 5 depends on
   Phase 4 → `bd dep add <phase-5-id> <phase-4-id>`). The seeder records the
   edge; reseed via `bd init --from-jsonl` preserves it byte-identically.

2. **`roadmap.analyze` handler extension:** in the per-phase loop within
   `bin/gsd-sdk-shadow.mjs::beadsRoadmapAnalyze`, replace the hardcoded
   `depends_on: null` with:
   ```js
   const depEdges = bead.dependencies?.filter(d => d.type === 'blocks') ?? [];
   const depPhaseIds = depEdges.map(d => {
     const targetBead = beadById.get(d.depends_on_id);
     return targetBead ? extractPhaseId(targetBead.title) : null;
   }).filter(Boolean);
   const depends_on = depPhaseIds.length ? depPhaseIds : null;
   ```
   Reuses the existing per-call export already loaded; no extra `bd` spawn.

3. **Per-handler parity snapshot test:** Phase 5 fixture currently has no
   `blocks` edges (Phase 5's parent was Phase 4 in the v0.1 placeholder, but
   `regen-roadmap.sh:178-180` literally emits `(none)`). Plan 5.6 either:
   (a) extends the fixture seed to add the cross-phase blocks edges, then
       re-captures the parity snapshot to expect populated `depends_on` arrays;
   (b) adds a NEW test bead pair to the seed for the explicit blocks-edge case
       and leaves the existing v0.1 phases with `depends_on: null`.

   Option (a) is cleaner — the fixture should reflect production reality where
   real phases carry blocks edges. **Recommendation:** option (a).

### What Plan 5.6 does NOT need

- Custom edge type — `--type depends-on` was option (b); not needed since
  default `blocks` works cleanly.
- Label-based encoding — `depends:phase-N` was option (c); not needed.
- Separate `bd deps` query — `bd export` already surfaces the full array.

### Non-blocking follow-ups for v0.3

- `bd ready` integration is an REQ-08 deliverable (not v0.2 scope). When v0.3
  adds the `bd-ready`-backed "what's next" surfaces, no further validation is
  needed — Q1 already proved the semantics work.
- `bd dep tree` could be a debugging surface in `/gsd-progress` later; not
  required for v0.2.

## HANDOFF.json `open_gaps[0]` update

```json
"GAP-01": {
  "status": "RESOLVED — option (a) validated by spike 014",
  "decision": "Use bd dep add (default blocks type) for sibling-phase depends_on",
  "evidence": ".planning/spikes/014-bd-blocks-sibling-deps/SPIKE.md",
  "next_step": "Plan 5.6 — extend build-seed.sh + beadsRoadmapAnalyze + parity snapshot per Plan 5.6 spec section above"
}
```

## Files

- `tests/fixtures/seed-fixture.sh` — confirmed BEADS_ACTOR=seed pattern works
  with blocks edges (Q4/Q5).
- `bin/gsd-sdk-shadow.mjs::beadsRoadmapAnalyze` — Plan 5.6 wires depends_on
  extraction here.
- `scripts/build-seed.sh` — Plan 5.6 adds `bd dep add` calls during fixture
  build.
- `scripts/regen-roadmap.sh:178-180` — v0.1 placeholder (`(none)`); Plan 5.6
  doesn't touch this file (regen scripts are out of v0.2 read-handler scope).

## Constraints

- bd v1.0.3 (pinned). Behaviors above may shift on future bd majors.
- All blocks edges must be added AFTER beads are created (Q1 setup pattern).
  Order in `build-seed.sh`: create all phases → create all plans →
  `bd dep add` for sibling ordering → cascade-loop close.
- The v0.1 `regen-roadmap.sh` placeholder is not blocked by this spike; v0.2
  reads run through `roadmap.analyze` shadow handler, not the regen script.
