# Roadmap: get-shit-done (fork — adapter-interface seam)

**Milestone:** v1.0 — StorageAdapter interface + MarkdownAdapter
**Source of truth:** `.planning/research/fork-investigation/SYNTHESIS.md` §7 (canonical phase scope), §4 (canonical interface), §6 (open-decisions register), §9 (risk-mitigation success criteria)
**Branch strategy:** Phases 1–5 land on `feat/storage-adapter` in this repo. Phase 6 lands in sibling `~/code/gsd-beads`. Phases 7–8 span both repos.

## Overview

This milestone adds a `StorageAdapter` interface seam to a fork of upstream
`gsd-build/get-shit-done`, defaults it to a `MarkdownAdapter` that wraps current
`node:fs` behavior with zero observable change, then ships a sibling
`BeadsAdapter` (in `~/code/gsd-beads`) and a conformance suite proving both
adapters interchangeable. The fork starts by bootstrapping the interface
skeleton (Phase 1), wires reads (Phase 2) then writes (Phase 3) through the
adapter, plugs the long tail of direct-I/O leaks (Phase 4), lifts the six
foundational primitives — including the dry-run hoist that gates Phase 6
(Phase 5), implements the BeadsAdapter against the primitive-lifted
interface (Phase 6), proves equivalence via conformance tests (Phase 7),
and ships migration + distribution (Phase 8).

## Phases

**Phase Numbering:**
- Integer phases (1–8): canonical scope from SYNTHESIS.md §7.
- Decimal phases (e.g. 4.1) reserved for urgent insertions during execution.

- [ ] **Phase 1: Fork bootstrap + StorageAdapter interface skeleton + MarkdownAdapter scaffold** — Define the adapter contract, scaffold MarkdownAdapter, reconcile with recent upstream seam PRs, lock OQ-08. *(this repo)*
- [ ] **Phase 2: Wire core read methods to adapter** — Route every SDK read query and skill `<context>` `@.planning/...` reference through the adapter. *(this repo)*
- [ ] **Phase 3: Wire core write methods + recordStateEvent** — Migrate `state-mutation.js` + `phase-lifecycle.js` to adapter writes; introduce the discriminated-union event record; resolve OQ-01. *(this repo)*
- [ ] **Phase 4: Plug workflow leaks (top-10 + `<context>`-block class)** — Refactor the 10 heaviest leaking workflows + the new frontmatter `@`-reference leak class; ship the leak-grep CI gate; resolve OQ-03 + OQ-04. *(this repo)*
- [ ] **Phase 5: Foundational primitive lift** — Implement `getSection`/`updateSection`/`snapshot`/`restore`/`putNamedDoc`/`writeBinaryAsset`; hoist `pipeline.js` dry-run off filesystem `cp -r`; resolve OQ-02 + OQ-05 + OQ-07 + OQ-10. *(this repo)*
- [ ] **Phase 6: BeadsAdapter implementation** — Implement the full StorageAdapter against `bd` in the sibling repo, carrying forward 13 spike findings and the JSONL roundtrip pattern; resolve OQ-06. *(sibling repo `gsd-beads`)*
- [ ] **Phase 7: Conformance test suite** — Paired tests run every Bin B method against both adapters, asserting equivalent outcomes; property-based round-trips; mid-transaction failure injection. *(both repos)*
- [ ] **Phase 8: Migration + distribution** — `storage.adapter: beads` opt-in, markdown→bd migration tool, rebase-conflict playbook, strict-superset golden parity validation, distribution decision (PR upstream vs long-lived fork). *(both repos)*

## Phase Details

### Phase 1: Fork bootstrap + StorageAdapter interface skeleton + MarkdownAdapter scaffold
**Repo:** this repo (`feat/storage-adapter`)
**Goal:** A locked StorageAdapter TypeScript contract exists, with a MarkdownAdapter scaffold that delegates to today's `node:fs` code, wired into `index.js` via dependency injection — and we know how that contract relates to upstream's recent seam work before we commit.
**Depends on:** Nothing (first phase)
**Requirements:** ADAPTER-01, ADAPTER-02, ADAPTER-03, ADAPTER-04, ADAPTER-05, ADAPTER-06, ADAPTER-07
**Resolves open questions:** OQ-08 (markdown-and-lockfile helpers visibility)
**Success Criteria** (what must be TRUE):
  1. Upstream's existing test suite (#2909 golden parity matrix) runs against the fork with zero diffs when no adapter is configured (strict-superset invariant verified empirically, not just asserted).
  2. A developer importing `createRegistry({adapter})` from the SDK gets a working registry whose every storage call goes through `adapter.*` rather than `node:fs` (no global module-state filesystem coupling remains in the registry constructor).
  3. The `StorageAdapter` interface file declares all 10 Bin A primitives plus the static `capabilities` flag exactly as agreed in DECISIONS D-2026-04-30-05; an adapter missing any required capability fails type-checking, not runtime.
  4. A written reconciliation note records, for each of upstream PRs #2898 / #2901 / #2908 / #2909, whether the seam they introduce is (a) reusable foundation we build on, (b) parallel work to coordinate, or (c) divergent vision requiring a fork-side adaptation — and the locked contract reflects that judgement.
  5. OQ-08 is resolved: `replaceInCurrentMilestone` and `readModifyWriteRoadmapMd` are explicitly inside MarkdownAdapter as private helpers and absent from the public StorageAdapter type signature.
  *Note: SC#1 and SC#5 are SUPERSEDED by CONTEXT.md D-13 and D-09 respectively. Plans implement the locked decisions: D-13 defers #2909 parity to Phase 8, D-09 makes markdownLockfile helpers PUBLIC + capability-gated.*
**Plans:** 2/5 plans executed
Plans:
- [x] 01-01-PLAN.md — StorageAdapter interface + Capabilities + UnsupportedCapabilityError + 6 type guards (adapters/types.ts) + adapters/tsconfig.json + project reference
- [x] 01-02-PLAN.md — Per-PR ADRs in DECISIONS.md (#2898/#2901/#2908/#2909) + scripts/leak-grep.cjs + R5/<context>-block fixtures + test
- [ ] 01-03-PLAN.md — MarkdownAdapter scaffold via createRequire wrap (Bin A + markdownLockfile + commitPlanningState; foundationals throw UnsupportedCapabilityError)
- [ ] 01-04-PLAN.md — createRegistry({adapter}) DI signature change + 4 production sites + 7 SDK test files updated
- [ ] 01-05-PLAN.md — Conformance harness factory (tests/conformance/) + sample MarkdownAdapter test + vitest config + npm script

### Phase 2: Wire core read methods to adapter
**Repo:** this repo (`feat/storage-adapter`)
**Goal:** Every SDK read query — including the ~13 workflow init bundlers and every skill frontmatter `@.planning/...` reference — flows through the adapter, not direct `node:fs`.
**Depends on:** Phase 1 (the interface must exist before reads can route through it)
**Requirements:** READS-01, READS-02, READS-03
**Resolves open questions:** OQ-09 (init-bundle granularity)
**Success Criteria** (what must be TRUE):
  1. A grep for `node:fs` / `fs.readFile` / `fs.readFileSync` / `readFileSync` in the SDK read surface (`progressJson`, `roadmapAnalyze`, `stateJson`, `findPhase`, `phasesList`, `phasePlanIndex`, `summaryExtract`, and the ~40 sibling read queries) returns zero matches; every read goes through `adapter.getRecord` / `adapter.getSection` / `adapter.getFrontmatter` / `adapter.listCollection`.
  2. The ~13 `getXxxInit()` Bin B methods (per OQ-09 resolution) keep their coarse external shape but their internals compose adapter primitives only; swapping the adapter under them changes the data source without changing the bundle shape.
  3. Every skill frontmatter `<context>` block's `@.planning/...` reference is either (a) rewritten to an SDK-mediated read, (b) intercepted by the install-time hook, or (c) explicitly listed in a documented exceptions register — no orphan references survive an audit grep.
  4. Upstream's read-side test fixtures continue to pass against the fork with the MarkdownAdapter mounted (regression budget: zero failing tests).
**Plans:** TBD

### Phase 3: Wire core write methods + recordStateEvent
**Repo:** this repo (`feat/storage-adapter`)
**Goal:** Every SDK write goes through the adapter; the 10+ ad-hoc state-mutation handlers collapse into one `recordStateEvent({type, payload})` discriminated-union call, and `phase-lifecycle.js`'s 13 handlers route through Bin B named methods over Bin A primitives.
**Depends on:** Phase 1 (interface) and Phase 2 (read patterns inform write patterns and a routed read surface is needed to verify writes round-trip correctly)
**Requirements:** WRITES-01, WRITES-02, WRITES-03, WRITES-04
**Resolves open questions:** OQ-01 (`commitPlanningState` semantics across adapters)
**Success Criteria** (what must be TRUE):
  1. A grep for `Write`/`Edit`/`fs.writeFile`/`fs.appendFile` against `.planning/` in `state-mutation.js`, `phase-lifecycle.js`, and the SDK write surface returns zero matches; every write goes through `adapter.*`.
  2. Recording a STATE.md event from a workflow uses exactly one call shape — `recordStateEvent({type, payload})` with `type` ∈ `roadmap_evolution | decision | blocker_added | blocker_resolved | metric | session | todo_count_update | deferred_items | forensic_session | quick_task` — and the same call shape works against any adapter that satisfies the interface.
  3. A user running any workflow that performs a write (e.g. `addPhase`, `completePhaseAndCascade`, `recordVerification`, `addSummary`, `createUat`/`updateUat`) observes byte-identical `.planning/` output to upstream when MarkdownAdapter is mounted (golden-file diff = empty).
  4. OQ-01 is resolved: `commitPlanningState` semantics for non-git backends are documented (no-op vs checkpoint snapshot) and adapter implementations match the documented behavior; the conformance harness has a stub test that will be filled in Phase 7.
**Plans:** TBD

### Phase 4: Plug workflow leaks (top-10 + `<context>`-block class)
**Repo:** this repo (`feat/storage-adapter`)
**Goal:** The 10 heaviest leaking workflows + the new `<context>`-block frontmatter leak class no longer touch `.planning/` directly; a CI gate prevents regression; the two raw-git outliers are fixed.
**Depends on:** Phase 3 (writes must already route through the adapter so leaks can be replaced cleanly)
**Requirements:** LEAKS-01, LEAKS-02, LEAKS-03, LEAKS-04, LEAKS-05
**Resolves open questions:** OQ-03 (raw-git outliers), OQ-04 (`<context>`-block leak mitigation strategy)
**Success Criteria** (what must be TRUE):
  1. Running the workflow-level leak-grep (extended per Rubric R5: `Read`, `Write`, `Edit`, `cp ... .planning/`, `mv ... .planning/`, `rm -rf .planning/`, `>> .planning/`) over `plan-phase`, `execute-phase`, `spike`, `forensics`, `progress`, `verify-phase`, `sketch`, `discuss-phase`, `execute-plan`, `gsd-debugger` returns zero matches.
  2. The leak-grep CI gate fails on a deliberately-introduced regression PR that adds a single direct `Write` against `.planning/` from any workflow or agent (the gate is observable to PR authors, not just maintainers).
  3. OQ-04 is resolved: every skill frontmatter `<context>` `@.planning/...` reference is either rewritten through the adapter, intercepted at install time by a documented hook, or explicitly declared in an exceptions register — and the resolution strategy is uniform across the affected skills (no per-skill ad-hoc handling).
  4. OQ-03 is resolved: `spec-phase.md` Step 7 and `eval-review.md` end use `gsd-sdk query commit` instead of raw `git add`/`git commit`; an upstream issue is filed referencing the inconsistency.
  5. The `verify.fat-skills` SDK query lists every non-router skill with line-count + leak-count and is wired into CI as an authoritative list (Rule 4 demotion tooling per SYNTHESIS §9 risk).
**Plans:** TBD

### Phase 5: Foundational primitive lift
**Repo:** this repo (`feat/storage-adapter`)
**Goal:** The six foundational primitives are implemented and adopted, and the dry-run pipeline is hoisted off the filesystem so it works on any adapter — gating BeadsAdapter readiness per the SYNTHESIS §9 high-severity risk.
**Depends on:** Phase 3 (write surface must be stable before primitive lift refactors it)
**Requirements:** PRIMITIVES-01, PRIMITIVES-02, PRIMITIVES-03, PRIMITIVES-04, PRIMITIVES-05, PRIMITIVES-06, PRIMITIVES-07, PRIMITIVES-08, PRIMITIVES-09
**Resolves open questions:** OQ-02 (section-vs-whole-file write granularity), OQ-05 (sidecar paths kv-vs-named), OQ-07 (scratch record taxonomy), OQ-10 (multi-author concurrency)
**Success Criteria** (what must be TRUE):
  1. Running `gsd-sdk query` with `--dry-run` against the MarkdownAdapter completes a multi-write transaction, then a deliberately-injected mid-transaction failure leaves `.planning/` byte-identical to its pre-call state — proving the dry-run hoist off `cp -r` to `snapshot()/restore()` (or `withTransaction`) works on a real adapter capability, not the filesystem-only middleware (SYNTHESIS §9 high-severity risk mitigated).
  2. Three subagents (`gsd-domain-researcher`, `gsd-ai-researcher`, `gsd-eval-planner`) writing three different sections of one AI-SPEC.md sequentially observe atomic, non-interfering section writes; running the same workflow with `updateSection` calls reordered or interleaved still produces a valid AI-SPEC.md (OQ-10 resolved by primitive design, not workflow lock-step).
  3. Every `.planning/` mutation that previously used a kind-tagged getter/writer pair (`getResearch(kind)`, `putIntelDoc(name)`, `putCodebaseDoc(name)`, `getArchivedMilestoneDoc(milestone, kind)`) now routes through `putNamedDoc(category, key, body)` / `getNamedDoc(category, key)` with closed-enum categories — verified by SDK-surface grep for the old method names returning zero call-sites.
  4. UI-review screenshots and sketch HTML/CSS/PNG assets write through `writeBinaryAsset(path, bytes)` against the MarkdownAdapter, and the capabilities flag correctly reports `binaryAsset: true`; the same call against a hypothetical adapter declaring `binaryAsset: false` triggers documented graceful degradation (workflow logs warn + skip, no exception).
  5. OQ-02, OQ-05, OQ-07 are resolved: ROADMAP.md / STATE.md / PROJECT.md write atomicity unit is "section"; sidecar paths (`.next-call-count`, `tmp/*`) are named methods not generic kv; scratch artifacts (`*-DISCUSS-CHECKPOINT.json`, `*-QUESTIONS.json`, `*-QUESTIONS.html`, `tmp/*`) are first-class types in the noun catalog. Each resolution is recorded in `.planning/DECISIONS.md`.
**Plans:** TBD

### Phase 6: BeadsAdapter implementation
**Repo:** sibling `~/code/gsd-beads`
**Goal:** A complete `BeadsAdapter` implementation against `bd` exists in the sibling repo, built against the *primitive-lifted* StorageAdapter interface (post-Phase 5), with the knowledge-graph-subsystem scope decision resolved.
**Depends on:** Phase 5 (BeadsAdapter is implemented against the primitive-lifted interface, not the pre-lift one — per SYNTHESIS §9 high-severity risk: "Don't ship Phase 6 until dry-run is stable on MarkdownAdapter")
**Requirements:** BEADS-01, BEADS-02, BEADS-03, BEADS-04, BEADS-05
**Resolves open questions:** OQ-06 (knowledge-graph subsystem scope)
**Success Criteria** (what must be TRUE):
  1. `BeadsAdapter` declared `capabilities` matches its actual implementation surface (e.g. `binaryAsset: false`, `commitPlanningState: false` or "checkpoint", graph capability per OQ-06 resolution); a developer querying the capabilities flag at runtime gets accurate answers, not a stub-throw.
  2. Running `BeadsAdapter.init()` against a non-bd-managed directory fails fast with the documented `project_bd_managed_mismatch` diagnostic (not a generic I/O error) — the spike-era memory carried forward, not regressed.
  3. Every Bin B method has an implementation that maps to a bd-native shape (issue + label, typed comment, sub-record, or `updateSection`-style anchor); a smoke test exercising one workflow per Bin B method category (phase, plan, summary, uat, state-event, debug, intel, learnings, etc.) succeeds end-to-end against a real `bd` store.
  4. OQ-06 is resolved: the knowledge-graph subsystem scope decision is recorded in DECISIONS.md (separate `GraphAdapter` sub-interface OR out-of-scope for v1.0 with documented graceful degradation in `gsd-phase-researcher` and `graphify.md`); the BeadsAdapter behavior matches the recorded decision.
  5. UI-review and sketch workflows running against `BeadsAdapter` degrade gracefully (per BEADS-05) when `writeBinaryAsset` is unsupported — they log a warning and skip the binary write rather than crashing or corrupting state.
**Plans:** TBD
**UI hint:** yes

### Phase 7: Conformance test suite
**Repo:** both (test harness in this repo, adapter implementations in both)
**Goal:** A conformance test suite asserts MarkdownAdapter and BeadsAdapter produce equivalent outcomes for every Bin B method, every record-type round-trip, every section-mode semantic, and every dry-run failure-injection scenario.
**Depends on:** Phase 6 (need both adapter implementations to run conformance against)
**Requirements:** CONFORM-01, CONFORM-02, CONFORM-03, CONFORM-04
**Success Criteria** (what must be TRUE):
  1. Running the conformance suite against MarkdownAdapter and BeadsAdapter produces zero failing assertions; every Bin B method has at least one paired test that asserts equivalent outcomes (call → assert observable adapter state matches across both backends).
  2. Property-based round-trip tests (`putRecord(x); getRecord(...) === x` modulo adapter-defined normalization) pass for every record type in the noun catalog: Phase, Plan, Summary, Uat, StateEvent, Roadmap, Decision, Blocker, DebugSession, Project, Spec, AiSpec — and any new noun added to the catalog requires a passing round-trip test before merge (CI gate).
  3. The section-semantics matrix is complete: for every (record-type, section-id) tuple in the codebase, the suite asserts `append` / `overwrite` / `prepend` produce defined outcomes on both adapters, and the test harness rejects any future adapter PR that lacks a defined semantic for any tuple (SYNTHESIS §9 high-severity "section semantics differ across adapters" risk mitigated by enforcement, not just convention).
  4. A deliberate failure injection mid-transaction (e.g. throw after the second of three writes) causes both adapters' `restore()` / rollback to leave their respective stores byte-identical (or record-identical, for bd) to the pre-transaction state — verified by snapshot diff on each adapter.
**Plans:** TBD

### Phase 8: Migration + distribution
**Repo:** both
**Goal:** Existing markdown-backed users have a working migration path to bd and a documented distribution story (fork rebase, leak-grep CI behavior on rebase, conflict playbook, PR-vs-long-lived-fork decision).
**Depends on:** Phase 7 (the migration tool needs a conformance-validated adapter pair so users can trust the round-trip)
**Requirements:** DIST-01, DIST-02, DIST-03, DIST-04, DIST-05
**Success Criteria** (what must be TRUE):
  1. A user with an existing `.planning/` markdown tree runs the migration tool and ends up with a populated `bd` store whose conformance-suite assertions pass against the original markdown tree's read outputs (no data loss, no semantic drift).
  2. Setting `storage.adapter: beads` in `.planning/config.json` (with `gsd-beads` installed) routes every adapter call through BeadsAdapter; setting nothing (or `storage.adapter: markdown`) preserves byte-identical behavior to upstream — both observable by running the same workflow command and comparing stdout + `.planning/` (or bd store) effects.
  3. Running `git rebase upstream/main` against a representative recent upstream batch (e.g. the next 10 upstream commits after 2026-04-30) succeeds with conflicts only in the documented adapter-interface seam files, never in pure business-logic files; the rebase script runs leak-grep over the post-rebase diff and surfaces any new direct-I/O introduced upstream as PR-blocking findings (per D-2026-04-30-04 implication).
  4. Upstream's golden-test parity matrix (#2909) runs against the fork with `npm install <fork>` and no adapter config and produces zero diffs — the strict-superset invariant from PROJECT.md is validated by an external test, not just asserted in docs.
  5. DIST-05 is resolved: the distribution decision (submit upstream as PR vs maintain long-lived fork) is recorded in DECISIONS.md with the rationale referencing upstream's reception of #2898 / #2901 / #2908; the recorded decision drives the actual repo state at milestone close (PR opened, or fork-maintenance playbook published).
**Plans:** TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.
Phase 6 begins in sibling repo `~/code/gsd-beads` only after Phase 5 ships in this repo (per SYNTHESIS §9 dry-run gate).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fork bootstrap + StorageAdapter interface skeleton + MarkdownAdapter scaffold | 2/5 | In Progress|  |
| 2. Wire core read methods to adapter | 0/TBD | Not started | - |
| 3. Wire core write methods + recordStateEvent | 0/TBD | Not started | - |
| 4. Plug workflow leaks (top-10 + `<context>`-block class) | 0/TBD | Not started | - |
| 5. Foundational primitive lift | 0/TBD | Not started | - |
| 6. BeadsAdapter implementation | 0/TBD | Not started | - |
| 7. Conformance test suite | 0/TBD | Not started | - |
| 8. Migration + distribution | 0/TBD | Not started | - |
