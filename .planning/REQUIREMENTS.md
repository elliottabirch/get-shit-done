# Requirements — Milestone v1.1: Upstream Drift Reconciliation

**Source of truth:** `.planning/research/upstream-drift/DELTA.md`

**Locked invariants** (carried from v1.0):
- Strict-superset of upstream `gsd-build/get-shit-done` when no adapter is configured
- Two-repo model: this fork + sibling `~/code/gsd-beads`
- Periodic rebase against `upstream/main`; conflicts only in adapter-interface seam

**Milestone framing:** Land the 351-commit rebase already completed on `rebase/onto-upstream-2026-05-16`, port the upstream features dropped during "take theirs" resolutions, close out the BeadsAdapter defects uncovered along the way, and reconcile the seven beads-vs-markdown adapter divergences observed during initial beads-mode use.

---

## Active Requirements

### REBASE — Land the rebase work

- [ ] **REBASE-01**: All 351 commits from `rebase/onto-upstream-2026-05-16` land on `feat/storage-adapter` (fast-forward or replace)
- [ ] **REBASE-02**: `feat/storage-adapter` tests run green at ≥97% (currently 2008/2066 = 97.2%; target stays at-or-above this baseline as feature ports land)
- [ ] **REBASE-03**: TypeScript build (`npm run build:sdk-only`) passes with zero errors
- [ ] **REBASE-04**: `git rebase main` from the cutover branch produces no conflicts (clean replayability check)
- [ ] **REBASE-05**: `fork/v1.0-shipped` tag and `rebase/onto-upstream-2026-05-16` checkpoint branch remain in `origin` for safety until milestone closes

### PORT — Restore upstream features dropped during take-theirs

Each bullet maps to a test cluster from `DELTA.md` Group 1-7. Owner is the SDK file where the feature lives.

- [ ] **PORT-01** (Group 1): Restore `phase_status` field (#3569) on `initPlanPhase`/`initVerifyWork` output. Maps disk + VERIFICATION.md state → `Pending`/`Planned`/`Executed`/`Complete`. Already filed: bd `get-shit-done-s93`. (4 tests)
- [ ] **PORT-02** (Group 2): Restore `mode` field extraction in `roadmap.get-phase` (`**Mode:** mvp` parsing). (3 tests)
- [ ] **PORT-03** (Group 3): Restore strict argv parsing in phase-lifecycle handlers — `--dry-run`, `--force`, unknown-flag rejection, `--help` defense in milestoneComplete. (9 tests)
- [ ] **PORT-04** (Group 4): Restore curated-progress preservation in `stateUpdate` — body-only updates must not stomp progress frontmatter; explicit Progress updates must recompute. Honor `options.preserveExistingProgress`. (3 tests)
- [ ] **PORT-05** (Group 5): Restore three validate.health rule fixes — `#3473` 999.X backlog phase recognition; `#3565` no-aliasing of phase variants; `#3473` descriptor-vs-canonical plan-file matching. (3 tests)
- [ ] **PORT-06** (Group 6): Fix `shouldDropArchivedPhaseMatch` (#3469) so same-milestone archived dirs are kept, not nulled. (1 test)
- [ ] **PORT-07** (Group 7): Thread `workstream` through `initVerifyWork` so verify-work resolves workstream-scoped phases. (1 test)

### VERIFY — Integration test parity (Group 8)

- [ ] **VERIFY-01**: `validate.health` SDK ↔ CJS golden — investigate divergence root cause; fix or regenerate per investigation.
- [ ] **VERIFY-02**: `docs-init` SDK ↔ CJS golden — same investigate-then-decide.
- [ ] **VERIFY-03**: `verify.codebase-drift` golden — update to reflect intentional SDK removal (CJS-only per ADR D-2026-05-13-3524).
- [ ] **VERIFY-04**: `audit-uat` JSON parity — investigate.
- [ ] **VERIFY-05**: `state.load` payload parity — investigate.
- [ ] **VERIFY-06**: `state.get` no-field full-content parity — investigate.
- [ ] **VERIFY-07**: All other unintentional regressions surfaced by the integration test suite are diagnosed and fixed before milestone close (catch-all for tests not currently listed).

### MISC — Orthogonal regressions (Group 9)

- [ ] **MISC-01**: `loadConfig` defaults parity — fields that should default `false` currently return `undefined`.
- [ ] **MISC-02**: `MarkdownAdapter.readModifyWriteRoadmapMd` — `core.atomicWriteFileSync is not a function`. Implementation gap.
- [ ] **MISC-03**: `runtime-bridge-sync` `native_failure` classification regression.

### DEFECT — BeadsAdapter contract gaps

- [ ] **DEFECT-01**: BeadsAdapter handles singleton bodies > 64KB (DECISIONS.md class). Already filed: bd `get-shit-done-qjk`. Add conformance test for ≥1MB round-trip; update path router or column type per chosen approach.
- [ ] **DEFECT-02**: Conformance suite includes a large-body singleton test that asserts byte-identical round-trip; runs against MarkdownAdapter and BeadsAdapter both.

### DIVERGE — Beads/markdown adapter divergences (all 7 from session-end audit)

- [ ] **DIVERGE-01**: Stub SDK handlers (`thread-seed.list-seeds`, `workspace.ensure-dir`) — implement or remove from workflows that call them. Currently return `{"error": "stub"}`.
- [ ] **DIVERGE-02**: `init.new-milestone` `current_milestone_name` returns placeholder `"milestone"` instead of parsing real name from PROJECT.md or STATE.md.
- [ ] **DIVERGE-03**: BeadsAdapter `>64KB` singleton fix — same as DEFECT-01 above (cross-referenced).
- [ ] **DIVERGE-04**: **Disk/bd dual-write divergence trap** — when `adapter: "beads"` is configured, `.planning/PROJECT.md`/`STATE.md`/etc. exist on disk AND in bd. They drift if not manually synced. Resolution required: either (a) BeadsAdapter mirrors to disk on putRecord; (b) the disk copies are deleted for migrated singletons; (c) explicit dual-storage adapter mode. **High severity — silent drift trap.**
- [ ] **DIVERGE-05**: `phases.clear` SDK handler — untested under BeadsAdapter; verify it doesn't either no-op silently or delete bd-tier phase data unintentionally.
- [ ] **DIVERGE-06**: STATE.md "Reference" section preserved across milestone-switch but `state.milestone-switch` doesn't reset milestone-scoped Reference content. Polish.
- [ ] **DIVERGE-07**: Conformance / contract test that proves identical observable behavior of init.new-milestone + state.milestone-switch under MarkdownAdapter and BeadsAdapter (catch-all for divergences we haven't found yet).

---

## v1.1 Requirements summary

**Total active:** 30 (5 REBASE + 7 PORT + 7 VERIFY + 3 MISC + 2 DEFECT + 7 DIVERGE — minus 1 cross-reference = 30 unique)

**Scope rationale:**
- REBASE class is small but load-bearing — cutover work and verification
- PORT class restores feature parity lost during the rebase resolution
- VERIFY/MISC class closes the integration-test-suite gap to a known-green state
- DEFECT class fixes the adapter-contract violation that blocked DECISIONS.md migration
- DIVERGE class addresses the beads-mode bugs surfaced by actually USING the adapter (which v1.0 didn't fully do — v1.0 shipped the adapter; v1.1 surfaces what real use revealed)

---

## Future Requirements (deferred)

None at this point — all known v1.1 work is captured above. Add deferred items here as they arise during execution.

## Out of Scope

- Sibling `gsd-beads` work beyond what cross-references PORT/DEFECT/DIVERGE here
- New StorageAdapter capabilities or methods (purely reconciliation milestone)
- Phase 8 distribution rework (DIST-04 first-green parity-CI on a real PR is a v1.0 closeout item, separately tracked)
- Any feature additions not strictly required to land the rebase + restore parity

---

## v1.1 Traceability

(Filled in by roadmap step — maps each REQ-ID to a phase + plan.)

---

# Requirements — Milestone v1.0: StorageAdapter interface + MarkdownAdapter

**Source of truth:** `.planning/research/fork-investigation/SYNTHESIS.md`
- §4 — Adapter interface draft (Bin A primitives + foundational primitives + Bin B named methods)
- §7 — Suggested next-milestone scope (8 phases)
- §6 — 10 open architectural questions (this milestone's open-decisions register)

**Locked invariants** (from `.planning/DECISIONS.md`):
- Strict-superset of upstream `gsd-build/get-shit-done` when no adapter is configured
- Two-repo model: this fork + sibling `~/code/gsd-beads`
- Periodic rebase against `upstream/main`; conflicts only in adapter-interface seam
- SYNTHESIS.md §7 is canonical scope; §4 is canonical interface; §6 is open-decisions register

**Note on scope partition:** Phases 1–5 land here on `feat/storage-adapter`. Phase 6 lands in sibling `gsd-beads`. Phases 7–8 span both repos. REQ-IDs prefixed with `BEADS-` are tracked here for completeness but executed in the sibling repo.

---

## Active Requirements

### ADAPTER — StorageAdapter interface + MarkdownAdapter scaffold

- [ ] **ADAPTER-01**: StorageAdapter TypeScript interface defines 10 Bin A primitives (`getRecord`, `putRecord`, `removeRecord`, `listCollection`, `exists`, `getSection`, `updateSection`, `getFrontmatter`, `updateFrontmatter`, `mergeFrontmatter`)
- [ ] **ADAPTER-02**: Adapter exposes a `capabilities` flag (per OQ-2 resolution) so adapters can declare optional method support without throwing at runtime
- [ ] **ADAPTER-03**: `MarkdownAdapter` scaffold implements the interface by delegating to today's `node:fs` code, producing zero behavior change against upstream's test suite
- [ ] **ADAPTER-04**: `createRegistry({adapter})` is wired in `index.js` so the SDK takes its adapter via dependency injection (no global module-state filesystem coupling)
- [ ] **ADAPTER-05**: Recent upstream PRs (#2898 durable planning runtime, #2901 planning-workspace seam, #2908 manifest-backed routing seam, #2909 golden parity matrix) are investigated and reconciled with this interface design before the contract is locked
- [ ] **ADAPTER-06**: Module layout decided — where `StorageAdapter` lives in upstream's tree (e.g. `sdk/dist/storage/` vs top-level `adapters/`)
- [ ] **ADAPTER-07**: Markdown-and-lockfile helpers (`replaceInCurrentMilestone`, `readModifyWriteRoadmapMd`) decision locked: private to MarkdownAdapter or part of public interface (resolves OQ-8)

### READS — Wire SDK read queries to adapter

- [ ] **READS-01**: All ~40 SDK read queries call `adapter.*` instead of `node:fs` directly (`progressJson`, `roadmapAnalyze`, `stateJson`, `findPhase`, `phasesList`, `phasePlanIndex`, `summaryExtract`, etc.) — _Plan 02-02 covered ~50 read sites in 8 files; Plans 02-03/04 cover the remaining document/init reads before this completes._
- [x] **READS-02**: Workflow init bundlers (~13 `getXxxInit()` Bin B methods) compose adapter primitives internally (resolves OQ-9 by keeping coarse method shape, decomposing internally)
- [x] **READS-03**: Skill frontmatter `<context>`-block `@.planning/...` references audited; each leak is either rewritten through the adapter or documented as out-of-scope for skill activation

### WRITES — Wire SDK write methods + recordStateEvent

- [ ] **WRITES-01**: `state-mutation.js` (18 handlers) migrated to `recordStateEvent({type, payload})` discriminated-union; `type` covers roadmap_evolution, decision, blocker_added, blocker_resolved, metric, session, todo_count_update, deferred_items, forensic_session, quick_task
- [ ] **WRITES-02**: `phase-lifecycle.js` (13 handlers) migrated to call Bin B named methods (`addPhase`, `completePhaseAndCascade`, `recordVerification`, `addSummary`, `createUat`/`updateUat`, etc.) over Bin A primitives
- [ ] **WRITES-03**: ~58 Bin B named methods implemented in MarkdownAdapter on top of Bin A + foundational primitives
- [ ] **WRITES-04**: `commitPlanningState` semantics decided across adapters: no-op for non-git backends or "checkpoint" snapshot (resolves OQ-1)

### LEAKS — Plug workflow leaks (top-10 + `<context>`-block class)

- [x] **LEAKS-01**: Top-10 leaking workflows refactored to use only adapter calls (no Read/Write/Edit/cp/mv against `.planning/`): `plan-phase` (12 leaks), `execute-phase` (10), `spike` (10), `forensics` (9), `progress` (8), `verify-phase` (8), `sketch` (8), `discuss-phase` (8), `execute-plan` (8), `gsd-debugger` (7+) (completed 2026-05-10, Plans 04-03/04-04/04-07) <!-- leak-grep-ignore — describes past leak-grep rules -->.
- [x] **LEAKS-02**: `<context>`-block leak class mitigated — skill frontmatter `@.planning/...` references either intercepted at install time, rewritten to SDK calls, or explicitly declared as a documented exception (resolves OQ-4) (completed 2026-05-10, Plan 04-05)
- [x] **LEAKS-03**: Two raw-git outliers (`spec-phase.md` Step 7, `eval-review.md` end) refactored to use `gsd-sdk query commit` instead of raw `git add`/`git commit` (resolves OQ-3) (completed 2026-05-10, Plan 04-04)
- [x] **LEAKS-04**: CI gate enforces leak-grep (extended per Rubric R5 to catch `cp`, `mv`, `rm -rf`, `>>` against `.planning/`) so new direct I/O cannot regress (completed 2026-05-10, Plan 04-07) <!-- leak-grep-ignore — meta-describes the leak-grep shell patterns -->.
- [x] **LEAKS-05**: Rule-4 demotion tooling shipped — `verify.fat-skills` SDK query lists all non-router skills with line-count + leak count, surfaced in CI (completed 2026-05-10, Plans 04-06/04-07)

### PRIMITIVES — Foundational primitive lift

- [ ] **PRIMITIVES-01**: `updateSection(file, sectionId, body, mode)` implemented (mode ∈ overwrite|append|prepend); replaces ~30 ad-hoc section mutators across STATE.md, PROJECT.md, AI-SPEC.md, SPEC.md, UAT.md, VERIFICATION.md, debug session files
- [ ] **PRIMITIVES-02**: `getSection(file, anchor)` implemented; replaces recurring extraction patterns (UAT "Current Test", SUMMARY "Threat Flags", PLAN `<threat_model>`, STATE "Pending Todos", debug "Evidence")
- [ ] **PRIMITIVES-03**: `snapshot()/restore()` (or `withTransaction(fn)`) implemented; hoists `pipeline.js` dry-run middleware off filesystem-only `cp -r` to a real adapter capability
- [ ] **PRIMITIVES-04**: `putNamedDoc(category, key, body)` / `getNamedDoc(category, key)` replaces kind-tagged getter/writer pairs (`getResearch(kind)`, `putIntelDoc(name)`, `putCodebaseDoc(name)`, `getArchivedMilestoneDoc(milestone, kind)`)
- [ ] **PRIMITIVES-05**: `writeBinaryAsset(path, bytes)` implemented in MarkdownAdapter; supports UI-review screenshots and sketch HTML/CSS/PNG assets
- [ ] **PRIMITIVES-06**: Section-scoped writes are atomic across writers; AI-SPEC.md three-author concurrency works without per-section locking at the workflow layer (resolves OQ-10)
- [ ] **PRIMITIVES-07**: Section-vs-whole-file write granularity locked for ROADMAP.md / STATE.md / PROJECT.md — section is the unit of write atomicity for canonical files (resolves OQ-2)
- [ ] **PRIMITIVES-08**: Sidecar paths (`.planning/.next-call-count`, `.planning/tmp/*`) modeled as named methods, not generic kv (resolves OQ-5)
- [ ] **PRIMITIVES-09**: "Scratch" record taxonomy (`*-DISCUSS-CHECKPOINT.json`, `*-QUESTIONS.json`, `*-QUESTIONS.html`, `.planning/tmp/*`) lifted to first-class types in the noun catalog (resolves OQ-7)

### BEADS — BeadsAdapter implementation (sibling repo `~/code/gsd-beads`)

- [x] **BEADS-01**: `BeadsAdapter` implements all 10 Bin A primitives against `bd` CLI (carries forward 13 spike findings, format module, JSONL roundtrip seed pattern from `gsd-beads` v0.2 work)
- [x] **BEADS-02**: `BeadsAdapter` implements 3 `recordState*` families (`AppendEvent`/`MutationEvent`/`SignalEvent` discriminated-union dispatch, returning `StateWriteOutcome` three-state contract) + Bin A primitives + foundational primitives against `bd` CLI with native mappings (event types → typed comments via `--author gsd:event:<type>` or memories via `bd remember --key`; `updateSection` → bd description-blob rewrite via `format/section.ts` anchor rewriter). Per Phase 3 D-04 "adapter stays thin", the ~58 Bin B domain methods (`addPhase`, `completePhaseAndCascade`, `addSummary`, etc.) live in fork's SDK helpers composing Bin A + foundational primitives — NOT on the BeadsAdapter surface. Phase 6 SC#3 smoke-tests one workflow per Bin B category (phase, plan, summary, uat, state-event, debug, intel, learnings) end-to-end through fork helpers against live bd.
- [x] **BEADS-03**: Knowledge-graph subsystem scope decided — separate `GraphAdapter` sub-interface or out-of-scope for v1, with `gsd-phase-researcher` and `graphify.md` graceful-degradation path (resolves OQ-6)
- [x] **BEADS-04**: `BeadsAdapter.init()` validates the store is bd-managed before any read/write (carries forward `project_bd_managed_mismatch.md` memory from spike work)
- [x] **BEADS-05**: `BeadsAdapter` declares `writeBinaryAsset` capability as unsupported (or routes to external blob store); UI-review and sketch workflows degrade gracefully when running on bd backend

### CONFORM — Conformance test suite (both repos)

- [x] **CONFORM-01**: Every Bin B method has a paired conformance test that runs against both `MarkdownAdapter` and `BeadsAdapter` and asserts equivalent outcomes
- [x] **CONFORM-02**: Property-based round-trip tests for all record types in the noun catalog (Phase, Plan, Summary, Uat, StateEvent, Roadmap, Decision, Blocker, DebugSession, Project, Spec, AiSpec, etc.)
- [x] **CONFORM-03**: Section-scoped semantics (`append` / `overwrite` / `prepend`) defined and tested per (record-type, section-id) tuple; reject any adapter that doesn't define a semantic for each tuple
- [x] **CONFORM-04**: Dry-run primitive correctness verified on both adapters via deliberate failure injection mid-transaction

### DIST — Migration + distribution (both repos)

- [x] **DIST-01**: User opts in to alternate adapter via `storage.adapter: beads` in `.planning/config.json`; default behavior (no setting) is identical to upstream
- [x] **DIST-02**: Migration tool reads existing `.planning/` markdown and seeds bd issues for users adopting the bd backend
- [x] **DIST-03**: Fork divergence / upstream-patch-reapply workflow documented: how to rebase against `upstream/main`, how leak-grep CI behaves on rebase, conflict resolution playbook
- [x] **DIST-04**: Strict-superset invariant validated end-to-end — `npm install <fork>` with no adapter config produces identical results to upstream's golden test suite (#2909 parity matrix)
- [x] **DIST-05**: Distribution decision recorded — submit upstream as PR vs maintain long-lived fork (informed by upstream's reception of #2898/#2901/#2908)

---

## Open-decisions register (deferred from SYNTHESIS.md §6)

These are NOT blockers for milestone start. Each is owned by the phase that has the most context to decide it. They surface during that phase's `/gsd-discuss-phase` step.

| ID | Question | Owning phase | Resolves requirement |
|----|----------|-------------|---------------------|
| OQ-01 | `commitPlanningState` semantics across adapters | Phase 3 (writes) | WRITES-04 |
| OQ-02 | Section-scoped vs whole-file write granularity | Phase 5 (primitives) | PRIMITIVES-07 |
| OQ-03 | 2 raw-git outliers (spec-phase, eval-review) | Phase 4 (leaks) | LEAKS-03 |
| OQ-04 | `<context>`-block leak mitigation strategy | Phase 4 (leaks) | LEAKS-02 |
| OQ-05 | Sidecar paths kv-vs-named | Phase 5 (primitives) | PRIMITIVES-08 |
| OQ-06 | Knowledge-graph subsystem scope | Phase 6 (beads) | BEADS-03 |
| OQ-07 | "Scratch" record taxonomy | Phase 5 (primitives) | PRIMITIVES-09 |
| OQ-08 | Markdown-and-lockfile helpers visibility | Phase 1 (adapter) | ADAPTER-07 |
| OQ-09 | Init-bundle granularity | Phase 2 (reads) | READS-02 |
| OQ-10 | Multi-author file (AI-SPEC) concurrency | Phase 5 (primitives) | PRIMITIVES-06 |

---

## Future Requirements (deferred to later milestones)

- **NPM-01**: Publish `gsd-beads` to npm registry as `@<scope>/gsd-beads` (deferred per 2026-04-30 user decision — keep at `~/code/gsd-beads` for v1.0; publish only if external adopters appear)
- **OTHER-ADAPTERS-01**: Reference adapters for sqlite, postgres, REST (out of scope for v1.0; community-contributed; conformance suite supports them)
- **GRAPH-ADAPTER-01**: First-class `GraphAdapter` sub-interface for knowledge-graph subsystem (deferred unless OQ-6 lands "separate adapter" verdict in Phase 6)

---

## Out of Scope (explicit exclusions, per SYNTHESIS.md §5 C2)

The following operations are *orthogonal* — they touch storage outside `.planning/` and remain plain SDK utilities under both adapters. They are NOT adapter responsibilities:

- All `learnings*` exports (live under `~/.gsd/knowledge/`)
- `extractMessages`, `scanSessions`, `profileSample` (live under `~/.claude/projects/`)
- `writeProfile`, `generateDevPreferences`, `generateClaudeProfile`, `generateClaudeMd` (write side) (live under `~/.claude/...` and project root `CLAUDE.md`)
- `init{New,List,Remove}Workspace` (live under `~/gsd-workspaces/`)
- `detectCustomFiles`, `agentSkills`, `skillManifest` (read side) (runtime install dirs and skill roots)
- `sync-skills.md`, `update.md`, `reapply-patches.md` (runtime install dir)
- `inbox.md` GitHub triage, `pr-branch.md` git-history rewrite, `ship.md` git+gh+REVIEW pipeline
- `code-review-fix` source edits, `gsd-codebase-mapper` upstream reads, `intel-updater` upstream reads, anti-pattern grep, test runners (target source code, not planning)

The following operations are *obsolete* under the new architecture (SYNTHESIS.md §5 C1) and will be eliminated, not adapted:

- `replaceInCurrentMilestone`, `readModifyWriteRoadmapMd` — markdown lock-string-replace primitives
- `intelUpdate` stub — agent-spawn dispatcher with no real I/O
- `validateAgents` — checks `~/.claude/agents/` install state
- `frontmatterValidate` — redundant once typed reads return validated records
- Worktree-merge protect logic in `quick.md` — assumes git tracks `.planning/`
- `verifyCommits`, `verifySchemaDrift`, `verifyCodebaseDrift`, `verifyPathExists` — git/code-repo concerns
- `intelExtractExports` — parses repo source code, not planning

---

## Traceability

Every v1.0 REQ-ID maps to exactly one phase. Coverage: 42/42 (100%).
Source phase scope: SYNTHESIS.md §7 (canonical, locked).

| REQ-ID | Phase | Repo | Status |
|--------|-------|------|--------|
| ADAPTER-01 | Phase 1 — Fork bootstrap + StorageAdapter interface skeleton + MarkdownAdapter scaffold | this | Pending |
| ADAPTER-02 | Phase 1 — Fork bootstrap + StorageAdapter interface skeleton + MarkdownAdapter scaffold | this | Pending |
| ADAPTER-03 | Phase 1 — Fork bootstrap + StorageAdapter interface skeleton + MarkdownAdapter scaffold | this | Pending |
| ADAPTER-04 | Phase 1 — Fork bootstrap + StorageAdapter interface skeleton + MarkdownAdapter scaffold | this | Pending |
| ADAPTER-05 | Phase 1 — Fork bootstrap + StorageAdapter interface skeleton + MarkdownAdapter scaffold | this | Pending |
| ADAPTER-06 | Phase 1 — Fork bootstrap + StorageAdapter interface skeleton + MarkdownAdapter scaffold | this | Pending |
| ADAPTER-07 | Phase 1 — Fork bootstrap + StorageAdapter interface skeleton + MarkdownAdapter scaffold | this | Pending |
| READS-01 | Phase 2 — Wire core read methods to adapter | this | Pending |
| READS-02 | Phase 2 — Wire core read methods to adapter | this | Pending |
| READS-03 | Phase 2 — Wire core read methods to adapter | this | Pending |
| WRITES-01 | Phase 3 — Wire core write methods + recordStateEvent | this | Pending |
| WRITES-02 | Phase 3 — Wire core write methods + recordStateEvent | this | Pending |
| WRITES-03 | Phase 3 — Wire core write methods + recordStateEvent | this | Pending |
| WRITES-04 | Phase 3 — Wire core write methods + recordStateEvent | this | Pending |
| LEAKS-01 | Phase 4 — Plug workflow leaks (top-10 + `<context>`-block class) | this | Complete (Plans 04-03/04-04/04-07) |
| LEAKS-02 | Phase 4 — Plug workflow leaks (top-10 + `<context>`-block class) | this | Pending |
| LEAKS-03 | Phase 4 — Plug workflow leaks (top-10 + `<context>`-block class) | this | Pending |
| LEAKS-04 | Phase 4 — Plug workflow leaks (top-10 + `<context>`-block class) | this | Complete (Plan 04-07) |
| LEAKS-05 | Phase 4 — Plug workflow leaks (top-10 + `<context>`-block class) | this | Complete (Plans 04-06/04-07) |
| PRIMITIVES-01 | Phase 5 — Foundational primitive lift | this | Pending |
| PRIMITIVES-02 | Phase 5 — Foundational primitive lift | this | Pending |
| PRIMITIVES-03 | Phase 5 — Foundational primitive lift | this | Pending |
| PRIMITIVES-04 | Phase 5 — Foundational primitive lift | this | Pending |
| PRIMITIVES-05 | Phase 5 — Foundational primitive lift | this | Pending |
| PRIMITIVES-06 | Phase 5 — Foundational primitive lift | this | Pending |
| PRIMITIVES-07 | Phase 5 — Foundational primitive lift | this | Pending |
| PRIMITIVES-08 | Phase 5 — Foundational primitive lift | this | Pending |
| PRIMITIVES-09 | Phase 5 — Foundational primitive lift | this | Pending |
| BEADS-01 | Phase 6 — BeadsAdapter implementation | gsd-beads | Pending |
| BEADS-02 | Phase 6 — BeadsAdapter implementation | gsd-beads | Pending |
| BEADS-03 | Phase 6 — BeadsAdapter implementation | gsd-beads | Pending |
| BEADS-04 | Phase 6 — BeadsAdapter implementation | gsd-beads | Pending |
| BEADS-05 | Phase 6 — BeadsAdapter implementation | gsd-beads | Pending |
| CONFORM-01 | Phase 7 — Conformance test suite | both | Complete (Phase 7) |
| CONFORM-02 | Phase 7 — Conformance test suite | both | Complete (Phase 7) |
| CONFORM-03 | Phase 7 — Conformance test suite | both | Complete (Phase 7) |
| CONFORM-04 | Phase 7 — Conformance test suite | both | Complete (Phase 7) |
| DIST-01 | Phase 8 — Migration + distribution | both | Complete (Phase 8) |
| DIST-02 | Phase 8 — Migration + distribution | both | Complete (Phase 8) |
| DIST-03 | Phase 8 — Migration + distribution | both | Complete (Phase 8) |
| DIST-04 | Phase 8 — Migration + distribution | both | Complete (Phase 8) |
| DIST-05 | Phase 8 — Migration + distribution | both | Complete (Phase 8) |

**Coverage by phase:**

| Phase | REQ count | REQ-IDs |
|-------|-----------|---------|
| 1 | 7 | ADAPTER-01..07 |
| 2 | 3 | READS-01..03 |
| 3 | 4 | WRITES-01..04 |
| 4 | 5 | LEAKS-01..05 |
| 5 | 9 | PRIMITIVES-01..09 |
| 6 | 5 | BEADS-01..05 |
| 7 | 4 | CONFORM-01..04 |
| 8 | 5 | DIST-01..05 |
| **Total** | **42** | — |

---

*Last updated: 2026-04-30 — milestone v1.0 requirements defined from SYNTHESIS.md §4/§7/§6; traceability filled by gsd-roadmapper after roadmap creation.*
