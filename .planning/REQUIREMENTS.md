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
- [ ] **READS-02**: Workflow init bundlers (~13 `getXxxInit()` Bin B methods) compose adapter primitives internally (resolves OQ-9 by keeping coarse method shape, decomposing internally)
- [x] **READS-03**: Skill frontmatter `<context>`-block `@.planning/...` references audited; each leak is either rewritten through the adapter or documented as out-of-scope for skill activation

### WRITES — Wire SDK write methods + recordStateEvent

- [ ] **WRITES-01**: `state-mutation.js` (18 handlers) migrated to `recordStateEvent({type, payload})` discriminated-union; `type` covers roadmap_evolution, decision, blocker_added, blocker_resolved, metric, session, todo_count_update, deferred_items, forensic_session, quick_task
- [ ] **WRITES-02**: `phase-lifecycle.js` (13 handlers) migrated to call Bin B named methods (`addPhase`, `completePhaseAndCascade`, `recordVerification`, `addSummary`, `createUat`/`updateUat`, etc.) over Bin A primitives
- [ ] **WRITES-03**: ~58 Bin B named methods implemented in MarkdownAdapter on top of Bin A + foundational primitives
- [ ] **WRITES-04**: `commitPlanningState` semantics decided across adapters: no-op for non-git backends or "checkpoint" snapshot (resolves OQ-1)

### LEAKS — Plug workflow leaks (top-10 + `<context>`-block class)

- [ ] **LEAKS-01**: Top-10 leaking workflows refactored to use only adapter calls (no Read/Write/Edit/cp/mv against `.planning/`): `plan-phase` (12 leaks), `execute-phase` (10), `spike` (10), `forensics` (9), `progress` (8), `verify-phase` (8), `sketch` (8), `discuss-phase` (8), `execute-plan` (8), `gsd-debugger` (7+)
- [ ] **LEAKS-02**: `<context>`-block leak class mitigated — skill frontmatter `@.planning/...` references either intercepted at install time, rewritten to SDK calls, or explicitly declared as a documented exception (resolves OQ-4)
- [ ] **LEAKS-03**: Two raw-git outliers (`spec-phase.md` Step 7, `eval-review.md` end) refactored to use `gsd-sdk query commit` instead of raw `git add`/`git commit` (resolves OQ-3; upstream issue filed)
- [ ] **LEAKS-04**: CI gate enforces leak-grep (extended per Rubric R5 to catch `cp`, `mv`, `rm -rf`, `>>` against `.planning/`) so new direct I/O cannot regress
- [ ] **LEAKS-05**: Rule-4 demotion tooling shipped — `verify.fat-skills` SDK query lists all non-router skills with line-count + leak count, surfaced in CI

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

- [ ] **BEADS-01**: `BeadsAdapter` implements all 10 Bin A primitives against `bd` CLI (carries forward 13 spike findings, format module, JSONL roundtrip seed pattern from `gsd-beads` v0.2 work)
- [ ] **BEADS-02**: `BeadsAdapter` implements ~58 Bin B methods with bd-native mappings (`addPhase` → bd issue with `gsd:phase` label; `recordStateEvent` → typed comment or label; `updateSection` → per-section sub-records or comment-with-anchor)
- [ ] **BEADS-03**: Knowledge-graph subsystem scope decided — separate `GraphAdapter` sub-interface or out-of-scope for v1, with `gsd-phase-researcher` and `graphify.md` graceful-degradation path (resolves OQ-6)
- [ ] **BEADS-04**: `BeadsAdapter.init()` validates the store is bd-managed before any read/write (carries forward `project_bd_managed_mismatch.md` memory from spike work)
- [ ] **BEADS-05**: `BeadsAdapter` declares `writeBinaryAsset` capability as unsupported (or routes to external blob store); UI-review and sketch workflows degrade gracefully when running on bd backend

### CONFORM — Conformance test suite (both repos)

- [ ] **CONFORM-01**: Every Bin B method has a paired conformance test that runs against both `MarkdownAdapter` and `BeadsAdapter` and asserts equivalent outcomes
- [ ] **CONFORM-02**: Property-based round-trip tests for all record types in the noun catalog (Phase, Plan, Summary, Uat, StateEvent, Roadmap, Decision, Blocker, DebugSession, Project, Spec, AiSpec, etc.)
- [ ] **CONFORM-03**: Section-scoped semantics (`append` / `overwrite` / `prepend`) defined and tested per (record-type, section-id) tuple; reject any adapter that doesn't define a semantic for each tuple
- [ ] **CONFORM-04**: Dry-run primitive correctness verified on both adapters via deliberate failure injection mid-transaction

### DIST — Migration + distribution (both repos)

- [ ] **DIST-01**: User opts in to alternate adapter via `storage.adapter: beads` in `.planning/config.json`; default behavior (no setting) is identical to upstream
- [ ] **DIST-02**: Migration tool reads existing `.planning/` markdown and seeds bd issues for users adopting the bd backend
- [ ] **DIST-03**: Fork divergence / upstream-patch-reapply workflow documented: how to rebase against `upstream/main`, how leak-grep CI behaves on rebase, conflict resolution playbook
- [ ] **DIST-04**: Strict-superset invariant validated end-to-end — `npm install <fork>` with no adapter config produces identical results to upstream's golden test suite (#2909 parity matrix)
- [ ] **DIST-05**: Distribution decision recorded — submit upstream as PR vs maintain long-lived fork (informed by upstream's reception of #2898/#2901/#2908)

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
| LEAKS-01 | Phase 4 — Plug workflow leaks (top-10 + `<context>`-block class) | this | Pending |
| LEAKS-02 | Phase 4 — Plug workflow leaks (top-10 + `<context>`-block class) | this | Pending |
| LEAKS-03 | Phase 4 — Plug workflow leaks (top-10 + `<context>`-block class) | this | Pending |
| LEAKS-04 | Phase 4 — Plug workflow leaks (top-10 + `<context>`-block class) | this | Pending |
| LEAKS-05 | Phase 4 — Plug workflow leaks (top-10 + `<context>`-block class) | this | Pending |
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
| CONFORM-01 | Phase 7 — Conformance test suite | both | Pending |
| CONFORM-02 | Phase 7 — Conformance test suite | both | Pending |
| CONFORM-03 | Phase 7 — Conformance test suite | both | Pending |
| CONFORM-04 | Phase 7 — Conformance test suite | both | Pending |
| DIST-01 | Phase 8 — Migration + distribution | both | Pending |
| DIST-02 | Phase 8 — Migration + distribution | both | Pending |
| DIST-03 | Phase 8 — Migration + distribution | both | Pending |
| DIST-04 | Phase 8 — Migration + distribution | both | Pending |
| DIST-05 | Phase 8 — Migration + distribution | both | Pending |

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
