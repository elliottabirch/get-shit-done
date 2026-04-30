# Batch 07 — Discuss + spec + research + AI

Date: 2026-04-30
Artifacts assigned: 26 (11 workflows, 7 agents, 8 skill routers)
Output by: BATCH-07 fork-investigation classifier

## Classification table

| # | Path | Kind | I/O surface | Bin | Use case (≤15 words) | Direct I/O ops | Adapter methods proposed (with Bin) | Notes |
|---|------|------|-------------|-----|----------------------|----------------|-------------------------------------|-------|
| 1 | workflows/discuss-phase.md | workflow | Mixed | n/a (consumer) | Capture phase implementation decisions into CONTEXT.md | 8 (see detail) | listPriorPhaseContexts, getDecisionsIndex, listSpikeFindings, getCheckpoint, putCheckpoint, removeCheckpoint, getSpec, putContext, putDiscussionLog, listCodebaseMaps, listContinueHere | Heavy direct I/O around CONTEXT.md, prior CONTEXT scan, checkpoint files |
| 2 | workflows/discuss-phase-power.md | workflow | Direct | n/a (consumer) | Generate question pack as JSON+HTML, finalize CONTEXT.md | 4 (see detail) | putQuestionsState, getQuestionsState, putQuestionsCompanion, putContext | JSON/HTML companion pair is novel artifact class |
| 3 | workflows/discuss-phase-assumptions.md | workflow | Mixed | n/a (consumer) | Codebase-first assumption surfacing produces CONTEXT.md | 7 (see detail) | listPriorPhaseContexts, getMethodology, listCodebaseMaps, putContext, putDiscussionLog (same as #1 + getMethodology) | Mirrors #1 but no checkpoint; adds METHODOLOGY.md read |
| 4 | workflows/spec-phase.md | workflow | Mixed | n/a (consumer) | Socratic ambiguity-scored interview producing SPEC.md | 4 (see detail) | getSpec, putSpec, listPhaseArtifacts (PLAN/SUMMARY/VERIFICATION lookups), getRequirements, getRoadmap | SPEC.md is new artifact type — need `Spec` noun |
| 5 | workflows/research-phase.md | workflow | SDK-only | n/a (consumer) | Spawn researcher subagent producing RESEARCH.md | 1 (existence ls) | listPhaseArtifacts(phase, "RESEARCH") (A) | Lightest workflow; mostly SDK + Task spawn |
| 6 | workflows/discovery-phase.md | workflow | Direct | n/a (consumer) | Tiered Context7-driven discovery producing DISCOVERY.md | 1 (write file) | putDiscovery(phase, body) (B) | DISCOVERY.md is new noun; write goes through Write tool |
| 7 | workflows/ai-integration-phase.md | workflow | Mixed | n/a (consumer) | Orchestrate 4 AI subagents to produce AI-SPEC.md | 4 (see detail) | listAiSpec, copyAiSpecTemplate, putAiSpec, getContext, getRequirements, validateAiSpec | Template-copy via cp is direct I/O |
| 8 | workflows/ultraplan-phase.md | workflow | Direct | n/a (consumer) | Build prompt from artifacts, hand to remote ultraplan | 3 (see detail) | getRoadmap (phase scope), getRequirements, getResearch | Read-only direct I/O for prompt construction |
| 9 | workflows/secure-phase.md | workflow | Mixed | n/a (consumer) | Audit threat mitigations, produce SECURITY.md | 6 (see detail) | listPhaseArtifacts(phase, "SECURITY"), listPhaseArtifacts(phase, "PLAN"), listPhaseArtifacts(phase, "SUMMARY"), getThreatRegister(phase) (B), putSecurity (B), updateSecurityAuditTrail (B) | Threat register parsing is Bin B (cross-artifact join) |
| 10 | workflows/analyze-dependencies.md | workflow | Direct | n/a (consumer) | Suggest Depends-on edges and patch ROADMAP.md | 2 (read+edit ROADMAP) | getRoadmap (A), updateRoadmapDependencies(edits) (B) | Edits ROADMAP.md inline — strong Bin B target |
| 11 | workflows/explore.md | workflow | Direct | n/a (consumer) | Socratic ideation routing outputs to multiple artifact types | 6 (see detail) | addNote, addTodo, addSeed, appendResearchQuestion, appendRequirement, addPhase | Five+ artifact write paths in one workflow |
| 12 | agents/gsd-assumptions-analyzer.md | agent | Direct | n/a (consumer) | Read codebase + prior CONTEXT files, return structured assumptions | 2 (see detail) | getRoadmap, listPriorPhaseContexts | Returns structured output to caller — no .planning writes itself |
| 13 | agents/gsd-advisor-researcher.md | agent | n/a (no .planning I/O) | n/a | Research one gray area, return comparison table | 0 | (none — non-`.planning` I/O only: Web/Context7) | Pure outbound research; not adapter concern |
| 14 | agents/gsd-phase-researcher.md | agent | Direct | n/a (consumer) | Produce RESEARCH.md with verified stack/patterns/pitfalls | 5 (see detail) | getContext, getConfig, getGraphSnapshot, putResearch (B), getProjectClaudeMd | Knowledge-graph queries via gsd-tools graphify (separate concern) |
| 15 | agents/gsd-domain-researcher.md | agent | Direct | n/a (consumer) | Write Section 1b of AI-SPEC.md (domain context) | 2 (see detail) | getAiSpec, updateAiSpecSection(name, body) (B) | Section-scoped write to existing AI-SPEC |
| 16 | agents/gsd-ai-researcher.md | agent | Direct | n/a (consumer) | Write Sections 3–4b of AI-SPEC.md (framework guidance) | 2 (see detail) | getAiSpec, updateAiSpecSection (B) | Same surface as #15, different sections |
| 17 | agents/gsd-eval-planner.md | agent | Direct | n/a (consumer) | Write Sections 5–7 of AI-SPEC.md (eval strategy) | 2 (see detail) | getAiSpec, updateAiSpecSection (B), grepObservabilityTooling | Greps source for tracing libs (non-`.planning`, out of scope) |
| 18 | agents/gsd-framework-selector.md | agent | n/a (no .planning I/O) | n/a | Interactive decision matrix selecting AI framework | 0 | (none — only AskUserQuestion + WebSearch + package.json scan, non-`.planning`) | Pure interview; recommendation returned via prompt |
| 19 | commands/gsd/discuss-phase.md | skill | Router | n/a | Routes to discuss-phase / discuss-phase-assumptions / -power | 0 | (inherits #1, #3, #2) | Router checks `workflow.discuss_mode` config — inherits all three workflows |
| 20 | commands/gsd/spec-phase.md | skill | Router | n/a | Routes to spec-phase workflow | 0 | (inherits #4) | Pure router |
| 21 | commands/gsd/research-phase.md | skill | Mixed | n/a | Router with inline init+validate+ls before spawning | 1 (ls .../RESEARCH.md) | listPhaseArtifacts(phase, "RESEARCH") (A) | Not a pure router — inlines Step 0–6 |
| 22 | commands/gsd/ai-integration-phase.md | skill | Router | n/a | Routes to ai-integration-phase workflow | 0 | (inherits #7) | Pure router |
| 23 | commands/gsd/ultraplan-phase.md | skill | Router | n/a | Routes to ultraplan-phase workflow | 0 | (inherits #8) | Pure router |
| 24 | commands/gsd/secure-phase.md | skill | Router | n/a | Routes to secure-phase workflow | 0 | (inherits #9) | Pure router |
| 25 | commands/gsd/analyze-dependencies.md | skill | Router | n/a | Routes to analyze-dependencies workflow | 0 | (inherits #10) | Pure router |
| 26 | commands/gsd/explore.md | skill | Router | n/a | Routes to explore workflow | 0 | (inherits #11) | Pure router |

## Per-artifact detail

### 1. workflows/discuss-phase.md
- **Direct I/O ops enumerated:**
  1. `cat .planning/PROJECT.md`, `cat .planning/REQUIREMENTS.md`, `cat .planning/STATE.md` — load_prior_context
  2. `find .planning/phases -name "*-CONTEXT.md" | sort -r` then read up to 3 — load_prior_context
  3. Conditional `cat .planning/DECISIONS-INDEX.md` — load_prior_context
  4. `ls ./.claude/skills/spike-findings-*/SKILL.md`, `ls ./.claude/skills/sketch-findings-*/SKILL.md`, `ls .planning/spikes/MANIFEST.md`, `ls .planning/sketches/MANIFEST.md` (read-if-found) — load_prior_context
  5. `ls ${phase_dir}/*-CONTEXT.md`, `ls ${phase_dir}/*-DISCUSS-CHECKPOINT.json`, `ls ${phase_dir}/.continue-here.md`, `ls ${phase_dir}/*-SPEC.md` — check_existing/check_spec/check_blocking_antipatterns
  6. `ls .planning/codebase/*.md` and Read selected maps — scout_codebase
  7. `Write ${phase_dir}/${padded_phase}-CONTEXT.md` — write_context
  8. `Write ${phase_dir}/${padded_phase}-DISCUSS-CHECKPOINT.json` (per area) and `rm` it on success — checkpoint mgmt
  9. `Write ${phase_dir}/${padded_phase}-DISCUSSION-LOG.md` — git_commit step
- **Adapter methods needed:**
  - `getProject()`, `getRequirements()`, `getStateSnapshot()` (A) — already covered by SDK in pilot
  - `listPriorPhaseContexts(currentPhase, limit=3)` (A) — bounded list
  - `getDecisionsIndex()` (A) — single doc
  - `listSpikeFindings()` / `listSketchFindings()` (A) — return manifest + skill paths
  - `getContinueHere(phase)` (A) — fetch blocking-antipattern doc
  - `getSpec(phase)` (A) — fetch SPEC.md if present
  - `getContext(phase)` (A) and `putContext(phase, body)` (B) — main artifact; B because content is structured (decisions/canonical_refs/code_context sections derived during write)
  - `getCheckpoint(phase)` / `putCheckpoint(phase, json)` / `removeCheckpoint(phase)` (A each — bare blob storage)
  - `putDiscussionLog(phase, body)` (B) — structured log, paired with putContext
  - `listCodebaseMaps()` + `getCodebaseMap(name)` (A)
- **Notes:** The `gsd-sdk query commit` and `gsd-sdk query state.record-session` calls already pass through SDK — keep. Mode-file Reads (`workflows/discuss-phase/modes/*.md`) are non-`.planning/` and out of scope.

### 2. workflows/discuss-phase-power.md
- **Direct I/O ops enumerated:**
  1. `Write {phase_dir}/{padded_phase}-QUESTIONS.json` — generate_json
  2. `Write {phase_dir}/{padded_phase}-QUESTIONS.html` — generate_html
  3. `Read {phase_dir}/{padded_phase}-QUESTIONS.json` (refresh + finalize) — wait_loop
  4. `Write {phase_dir}/{padded_phase}-CONTEXT.md` — finalize
- **Adapter methods needed:**
  - `putQuestionsState(phase, json)` / `getQuestionsState(phase)` (A) — JSON pass-through
  - `putQuestionsCompanion(phase, html)` (A) — HTML pass-through; for beads adapter, this could become a no-op or live in `.beads/` cache
  - `putContext(phase, body)` (B) — same method as #1
- **Notes:** QUESTIONS.json+QUESTIONS.html are a NEW artifact pair not seen in pilot. They are author-side scratch state; bd adapter likely keeps them as flat-file cache rather than translating to issues. Flag for synthesis.

### 3. workflows/discuss-phase-assumptions.md
- **Direct I/O ops enumerated:**
  1. `cat PROJECT.md / REQUIREMENTS.md / STATE.md` — load_prior_context
  2. `find .planning/phases -name "*-CONTEXT.md"` — load_prior_context
  3. `cat .planning/METHODOLOGY.md` — load_methodology
  4. `ls .planning/codebase/*.md` — scout_codebase
  5. `ls ${phase_dir}/*-CONTEXT.md` — check_existing
  6. `Write ${phase_dir}/${padded_phase}-CONTEXT.md` — write_context
  7. `Write ${phase_dir}/${padded_phase}-DISCUSSION-LOG.md` — write_discussion_log
- **Adapter methods needed:**
  - All from #1 plus `getMethodology()` (A) — single optional doc
- **Notes:** No checkpoint file in this mode. Otherwise functionally a sibling of #1.

### 4. workflows/spec-phase.md
- **Direct I/O ops enumerated:**
  1. `ls ${phase_dir}/*-SPEC.md | grep -v AI-SPEC` — Step 1
  2. Read `${requirements_path}`, `${state_path}`, ROADMAP.md phase entry — Step 2
  3. Grep for prior phase artifacts (SUMMARY.md, VERIFICATION.md) relevant to current state — Step 2
  4. `git add` + `git commit` of SPEC.md — Step 7 (passes through git, not SDK)
  5. Write SPEC.md — Step 6
- **Adapter methods needed:**
  - `getSpec(phase)` / `putSpec(phase, body)` (B — structured: requirements list, boundaries, acceptance criteria)
  - `getRequirements()` (A), `getStateSnapshot()` (A), `getRoadmapPhase(phase)` (A) — already covered
  - `listPhaseArtifacts(phase, kind)` (A) for SUMMARY/VERIFICATION lookup
- **Notes:** Step 7 commits via raw `git`; should also flow through `gsd-sdk query commit` for consistency. SPEC.md introduces `Spec` as a new domain noun.

### 5. workflows/research-phase.md
- **Direct I/O ops enumerated:**
  1. `ls .planning/phases/${PHASE}-*/RESEARCH.md` — Step 2
- **Adapter methods needed:**
  - `listPhaseArtifacts(phase, "RESEARCH")` (A) — existence check
- **Notes:** Researcher subagent itself does the heavy writes (see #14). Workflow body is mostly SDK init + Task spawn.

### 6. workflows/discovery-phase.md
- **Direct I/O ops enumerated:**
  1. Write `.planning/phases/XX-name/DISCOVERY.md` (Levels 2 & 3) — create_discovery_output
- **Adapter methods needed:**
  - `putDiscovery(phase, body)` (B) — structured (summary/findings/code-examples/metadata sections)
  - `getDiscovery(phase)` (A) for re-runs
- **Notes:** Adds `Discovery` as new domain noun. Level 1 produces no file (verbal only — out of adapter scope).

### 7. workflows/ai-integration-phase.md
- **Direct I/O ops enumerated:**
  1. `ls "${PHASE_DIR}"/*-AI-SPEC.md` — Step 4
  2. `cp "$HOME/.claude/get-shit-done/templates/AI-SPEC.md" "${PHASE_DIR}/${PADDED_PHASE}-AI-SPEC.md"` — Step 6 (this is a Read+Write pair via cp shell-out)
  3. Read completed AI-SPEC.md for validation — Step 10
  4. `git add` + `git commit` AI-SPEC.md — Step 11
- **Adapter methods needed:**
  - `listAiSpec(phase)` (A) — existence
  - `getAiSpecTemplate()` (A) — fetch template body
  - `putAiSpec(phase, body)` (B) — initial copy
  - `getAiSpec(phase)` (A) — for validation read
  - `validateAiSpec(phase)` (B) — structural completeness check (Section presence)
- **Notes:** `cp` for template seeding is the kind of op that hides behind shell — must be made an adapter method or the bd adapter will miss it. Subagents handle section-scoped updates (see #15–17).

### 8. workflows/ultraplan-phase.md
- **Direct I/O ops enumerated:**
  1. Read ROADMAP.md phase scope — build_prompt
  2. Read REQUIREMENTS.md (if `requirements_path`) — build_prompt
  3. Read RESEARCH.md (if `research_path`) — build_prompt
- **Adapter methods needed:**
  - `getRoadmapPhase(phase)` (A), `getRequirements()` (A), `getResearch(phase)` (A)
- **Notes:** All read-only; no `.planning/` writes. The remote `/ultraplan` invocation produces a file outside `.planning/` — out of adapter scope.

### 9. workflows/secure-phase.md
- **Direct I/O ops enumerated:**
  1. `ls "${PHASE_DIR}"/*-SECURITY.md` — Step 1
  2. `ls "${PHASE_DIR}"/*-PLAN.md` — Step 1
  3. `ls "${PHASE_DIR}"/*-SUMMARY.md` — Step 1
  4. Read PLAN.md `<threat_model>` block — Step 2a
  5. Read SUMMARY.md `## Threat Flags` — Step 2b
  6. Read template `~/.claude/get-shit-done/templates/SECURITY.md` (non-`.planning/` — out of scope) and Write `${PHASE_DIR}/${PADDED_PHASE}-SECURITY.md` — Step 6
- **Adapter methods needed:**
  - `listPhaseArtifacts(phase, kind)` (A) — covers SECURITY/PLAN/SUMMARY existence
  - `getPlan(phase)` (A) — fetch plan; threat-model parsing happens in workflow
  - `getSummary(phase)` (A) — fetch summary
  - `getSecurity(phase)` (A) / `putSecurity(phase, body)` (B) / `updateSecurityAuditTrail(phase, audit)` (B) — security artifact lifecycle
  - `getThreatRegister(phase)` (B) — joins PLAN.md `<threat_model>` + SUMMARY.md `## Threat Flags` into a single typed register; classic Bin B coordination
- **Notes:** Adds `Security` and `ThreatRegister` as new domain nouns. Auditor subagent (gsd-security-auditor — out of this batch) will need same `Security` accessors.

### 10. workflows/analyze-dependencies.md
- **Direct I/O ops enumerated:**
  1. Read `.planning/ROADMAP.md` — Step 1
  2. Edit ROADMAP.md to add/update `Depends on:` lines — Step 6 "Apply"
- **Adapter methods needed:**
  - `getRoadmap()` (A) — already exists
  - `updateRoadmapDependencies(edits: {phase, dependsOn[]}[])` (B) — structured per-phase patch; for beads adapter this becomes `bd dep add` calls
- **Notes:** Strongly Bin B — pure raw rewrites of ROADMAP.md would lose semantic meaning when translated to bd dep graph. Must be a typed call.

### 11. workflows/explore.md
- **Direct I/O ops enumerated:**
  1. `Write .planning/notes/{slug}.md`
  2. `Write .planning/todos/pending/{slug}.md`
  3. `Write .planning/seeds/{slug}.md`
  4. `Append .planning/research/questions.md`
  5. `Append .planning/REQUIREMENTS.md`
  6. SlashCommand `/gsd-add-phase` (delegates — not direct, but emits side-effect via that workflow)
- **Adapter methods needed:**
  - `addNote({slug, title, body})` (B) — frontmatter-injection
  - `addTodo({slug, title, priority, area?})` (B) — already partly exists in pilot's listTodos; needs a creator
  - `addSeed({slug, title, triggerCondition})` (B) — new noun `Seed` per convention
  - `appendResearchQuestion(text)` (B) — append to single doc
  - `appendRequirement({reqId, text})` (B) — auto-allocates next REQ ID; multi-write
  - `addPhase(...)` (B) — already named in pilot
- **Notes:** Heaviest write-fan-out workflow in batch. `Note` and `Seed` are new domain nouns not in convention sheet — flagging.

### 12. agents/gsd-assumptions-analyzer.md
- **Direct I/O ops enumerated:**
  1. Read ROADMAP.md
  2. `find .planning/phases -name "*-CONTEXT.md"` then per-file Read
- **Adapter methods needed:**
  - `getRoadmap()` (A), `listPriorPhaseContexts(currentPhase?)` (A)
- **Notes:** Tools list is `Read, Bash, Grep, Glob` — no Write. Returns structured output to caller. Direct surface, but read-only.

### 13. agents/gsd-advisor-researcher.md
- **Direct I/O ops enumerated:** None on `.planning/`. Tools include WebSearch/WebFetch/Context7 + Bash for npx ctx7 fallback.
- **Adapter methods needed:** None.
- **Notes:** Pure outbound research agent. Out of adapter scope per Rule 6.

### 14. agents/gsd-phase-researcher.md
- **Direct I/O ops enumerated:**
  1. Read `./CLAUDE.md` (project root, non-`.planning` — out of scope per Rule 6)
  2. Read `${phase_dir}/*-CONTEXT.md` — Step 1
  3. Read `.planning/config.json` — Step 1
  4. `ls .planning/graphs/graph.json` + `gsd-tools.cjs graphify status` + `gsd-tools.cjs graphify query` — Step 1.3 (tooling, not raw fs)
  5. Write `$PHASE_DIR/$PADDED_PHASE-RESEARCH.md` — Step 6
  6. `gsd-sdk query commit ...` — Step 7 (already SDK)
- **Adapter methods needed:**
  - `getContext(phase)` (A) — already in #1's set
  - `getConfig()` (A) — already covered by SDK config-get
  - `getGraphSnapshot()` / `queryGraph(term, budget)` (B) — knowledge graph is its own subsystem; flagging for synthesis (likely a separate adapter or sub-interface)
  - `putResearch(phase, body)` (B) — large structured artifact (15+ sections, conditional sub-sections); strongly Bin B
- **Notes:** `Research` is a new domain noun. Knowledge-graph queries (`graphify`) are a parallel concern — recommend a separate `GraphAdapter` or treat as out of scope for the Storage adapter.

### 15. agents/gsd-domain-researcher.md
- **Direct I/O ops enumerated:**
  1. Read AI-SPEC.md, CONTEXT.md, REQUIREMENTS.md
  2. Write/update AI-SPEC.md (Section 1b only)
- **Adapter methods needed:**
  - `getAiSpec(phase)` (A), `getContext(phase)` (A), `getRequirements()` (A)
  - `updateAiSpecSection(phase, sectionId, body)` (B) — section-scoped patch over a structured doc; for beads adapter likely becomes a per-section sub-record
- **Notes:** Section-scoped writes are a new pattern. Need synthesis dedup with #16 and #17 (same method, different sections).

### 16. agents/gsd-ai-researcher.md
- **Direct I/O ops enumerated:**
  1. Read AI-SPEC.md, CONTEXT.md
  2. Write/update AI-SPEC.md (Sections 3, 4, 4b)
- **Adapter methods needed:** Same as #15.
- **Notes:** Tooling: WebFetch/WebSearch/Context7 — out of adapter scope. Three concurrent agents (#15, #16, #17) writing different sections of one file is a contention pattern bd adapter must handle (probably via per-section issues).

### 17. agents/gsd-eval-planner.md
- **Direct I/O ops enumerated:**
  1. Read AI-SPEC.md, CONTEXT.md, REQUIREMENTS.md
  2. Write/update AI-SPEC.md (Sections 5, 6, 7)
  3. `grep -r "langfuse|langsmith|arize|..." --include="*.py" --include="*.ts" ...` against source code (NON-`.planning/` — out of scope per Rule 6)
- **Adapter methods needed:** Same as #15/#16.
- **Notes:** The grep is over source code (eval tooling detection); leave external.

### 18. agents/gsd-framework-selector.md
- **Direct I/O ops enumerated:**
  1. `find . -maxdepth 2 -name "package.json" -o -name "pyproject.toml" -o -name "requirements*.txt"` (project root, NON-`.planning/`)
  2. Read those manifest files (NON-`.planning/`)
- **Adapter methods needed:** None (manifest scan is source-code, not planning state).
- **Notes:** Recommendation flows back through prompt return value, not file write. Out of adapter scope.

### 19. commands/gsd/discuss-phase.md (router — but multi-target)
- **I/O surface:** Router. Reads `gsd-sdk query config-get workflow.discuss_mode` and routes to discuss-phase or discuss-phase-assumptions; also references discuss-phase-power. Inherits from #1, #2, #3.

### 20–26. Pure routers
All seven (`spec-phase.md` (#20), `ai-integration-phase.md` (#22), `ultraplan-phase.md` (#23), `secure-phase.md` (#24), `analyze-dependencies.md` (#25), `explore.md` (#26)) are thin shells of `<execution_context>@~/.claude/...workflows/X.md</execution_context>` plus a `Execute @workflow.md end-to-end` paragraph. Inherit their workflow's classification. **Exception:** `commands/gsd/research-phase.md` (#21) is NOT a pure router — it inlines steps 0–6 with its own `gsd-sdk query init.phase-op`, `ls .planning/phases/${PHASE}-*/RESEARCH.md`, and `Task(...)` spawn. Its single direct-I/O op (the `ls`) maps to `listPhaseArtifacts(phase, "RESEARCH")` (A).

## Cross-cutting observations from this batch

1. **AI-SPEC.md is a multi-author file.** Three subagents (`gsd-domain-researcher`, `gsd-ai-researcher`, `gsd-eval-planner`) sequentially write different sections of the same AI-SPEC.md. The adapter needs `updateAiSpecSection(phase, sectionId, body)` rather than full-file `putAiSpec` for these calls — otherwise concurrent writes (and the bd-adapter translation to per-issue records) will collide. This is a stronger pattern than ROADMAP/STATE which each have a single canonical author.

2. **CONTEXT.md has at least three writer paths** (discuss-phase default, discuss-phase-assumptions, discuss-phase-power) all producing the same artifact via different upstream interview shapes. Single `putContext(phase, body)` is fine — all three converge on the same template. But the *intermediate* state files differ: default uses `*-DISCUSS-CHECKPOINT.json`, power uses `*-QUESTIONS.json` + `*-QUESTIONS.html`. These are author-side scratch state that exist only in the markdown adapter. **Recommend:** treat them as `Scratch` records (`putScratch(phase, key, body)`) so the bd adapter can implement them as bd artifacts or a flat-file cache.

3. **Phase-artifact existence checks recur in every workflow.** Patterns like `ls ${phase_dir}/*-{KIND}.md` appear in 6+ workflows. Strong case for `listPhaseArtifacts(phase, kind?) -> ArtifactRef[]` as a Bin A primitive — pilot already proposed similar for `progress.md`. Synthesis should dedup.

4. **New domain nouns introduced by this batch:** `Spec` (SPEC.md), `AiSpec` (AI-SPEC.md), `Discovery` (DISCOVERY.md), `Security` (SECURITY.md), `Research` (RESEARCH.md), `Note` (notes/*.md), `Seed` (seeds/*.md), `ResearchQuestion` (research/questions.md entries), `Methodology` (METHODOLOGY.md), `Checkpoint` (*-DISCUSS-CHECKPOINT.json), `QuestionsState` (*-QUESTIONS.json + .html), `ThreatRegister` (derived view from PLAN+SUMMARY), `DecisionsIndex` (DECISIONS-INDEX.md), `ContinueHere` (.continue-here.md), `CodebaseMap` (.planning/codebase/*.md), `SpikeFindings` / `SketchFindings` (project-local skills + manifests). **Convention sheet currently covers only Phase/Plan/Summary/Uat/Todo/Memory/Handoff/StateEvent/Roadmap/Requirement/Milestone/Decision/Blocker/DebugSession.** Major expansion needed.

5. **METHODOLOGY.md, DECISIONS-INDEX.md, .continue-here.md, codebase/*.md** are read by multiple workflows but written by none in this batch — they must come from other batches' workflows (or from external user authoring). Synthesis should confirm writers exist; if not, they're read-only conventions.

6. **`cp` for template seeding (ai-integration-phase.md Step 6)** is a hidden Read+Write pair that pure grep for `Read|Write|Edit` would miss. Recommend rubric extension: also flag `cp ... .planning/` and `mv ... .planning/` as direct I/O.

7. **Knowledge graph (`gsd-tools.cjs graphify`) is a parallel I/O subsystem** invoked by `gsd-phase-researcher`. It has its own storage (`.planning/graphs/graph.json`) and CLI surface. **Recommend:** declare graph access as a separate adapter (or out of scope for the v1 fork) — bundling it into the storage adapter would explode scope.

8. **`spec-phase.md` Step 7 commits via raw `git add`/`git commit`** instead of `gsd-sdk query commit`. Inconsistent with rest of GSD. Likely an upstream bug — flag for synthesis.

9. **Naming clashes with convention sheet:** none of the batch-07 nouns (Spec, AiSpec, Discovery, Security, Research, Note, Seed, Methodology, Checkpoint, QuestionsState, ThreatRegister, DecisionsIndex, ContinueHere, CodebaseMap) appear on the convention sheet. Verbs all conform (`list`, `get`, `put`, `add`, `update`, `append`).

10. **Likely overlap with other batches (flag for synthesis dedup):**
    - `getRoadmap()`, `getRoadmapPhase(phase)` — pilot already had `roadmap.get-phase` SDK; many batches will reuse
    - `getRequirements()`, `getStateSnapshot()`, `getProject()` — universal
    - `listPhaseArtifacts(phase, kind)` — pilot's `countPhaseArtifacts` is the count variant; same backing op
    - `addPhase(...)` — pilot has it
    - `addTodo(...)` — pilot's `listTodos` and `todoComplete` exist; create-side missing
    - `appendStateEvent(...)` — pilot's `recordStateEvent` likely covers our `appendRequirement`/`appendResearchQuestion` if generalized
    - `putResearch`, `putContext`, `putSpec`, `putAiSpec`, `putSecurity`, `putDiscovery` — distinct artifacts; no overlap expected
    - `updateAiSpecSection` is unique to AI-SPEC three-author flow

## Bin-by-bin counts

- Bin A: 22 distinct operations (existence checks, single-doc reads, bare scratch puts)
- Bin B: 18 distinct operations (structured artifact writes, section-scoped updates, joined-view derivations, dependency-graph patches)
- Bin C: 0 (no operations identified as obsolete in this batch)
- Bin D: 0 (no presentation/formatter operations in this batch)
- Direct I/O leaks found: 47 enumerated across 11 workflows + 6 agents (many are duplicates of "list/get phase artifact" pattern — distinct ops below)
- Routers auto-classified: 7 (research-phase.md was the one not-quite-router)
