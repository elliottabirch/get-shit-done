# Batch 09 — Profile + init + skill management + docs

Date: 2026-04-30
Artifacts assigned: 25 (24 unique; `gsd-doc-classifier`/`gsd-doc-synthesizer` covered by batch 02; `gsd-doc-writer` listed twice in spec — classified once)
Output by: BATCH-09 fork-investigation classifier

## Classification table

| # | Path | Kind | I/O surface | Bin | Use case (≤15 words) | Direct I/O ops | Adapter methods proposed (with Bin) | Notes |
|---|------|------|-------------|-----|----------------------|----------------|-------------------------------------|-------|
| 1 | sdk/dist/query/profile.js::learningsListHandler | sdk-query-export | n/a | C | List `~/.gsd/knowledge/` learnings | n/a | (eliminate — global store) | Out-of-`.planning/`; user-global, not project-state. |
| 2 | sdk/dist/query/profile.js::learningsQuery | sdk-query-export | n/a | C | Filter learnings by tag from global store | n/a | (eliminate) | Same as #1 — `~/.gsd/knowledge/`. |
| 3 | sdk/dist/query/profile.js::learningsCopy | sdk-query-export | n/a | B | Copy `.planning/LEARNINGS.md` sections into `~/.gsd/knowledge/` | reads `.planning/LEARNINGS.md` | `listLearningSections()` (A) + global-store write (out of scope) | Bridge between `.planning/` and global. Adapter exposes the read; write side is out of adapter scope. |
| 4 | sdk/dist/query/profile.js::learningsPrune | sdk-query-export | n/a | C | Prune old global-store learnings by age | n/a | (eliminate) | Global store only. |
| 5 | sdk/dist/query/profile.js::learningsDelete | sdk-query-export | n/a | C | Delete one global-store learning by ID | n/a | (eliminate) | Global store only. |
| 6 | sdk/dist/query/profile.js::extractMessages | sdk-query-export | n/a | C | Extract user messages from `~/.claude/projects/*` session JSONL | n/a | (eliminate) | Reads Claude Code's own session log; not planning state. |
| 7 | sdk/dist/query/profile.js::scanSessions | sdk-query-export | n/a | C | List `~/.claude/projects/` session metadata | n/a | (eliminate) | Same — Claude Code session storage, not adapter concern. |
| 8 | sdk/dist/query/profile.js::profileSample | sdk-query-export | n/a | C | Sample messages across projects for profiling | n/a | (eliminate) | Same as #7. |
| 9 | sdk/dist/query/profile.js::profileQuestionnaire | sdk-query-export | n/a | D | Static questionnaire data + answer-to-rating mapping | n/a | (presentation/data — not adapter) | Pure CPU; no I/O. |
| 10 | sdk/dist/query/profile-extract-messages.js (helpers) | sdk-query-helper | n/a | C | Internals for #6 | n/a | (eliminate w/ #6) | Filesystem reads of `~/.claude/projects/`. |
| 11 | sdk/dist/query/profile-output.js::writeProfile | sdk-query-export | n/a | C | Render USER-PROFILE.md to `~/.claude/get-shit-done/` | n/a | (eliminate) | Default output is `~/.claude/...`; not `.planning/`. |
| 12 | sdk/dist/query/profile-output.js::generateDevPreferences | sdk-query-export | n/a | C | Render dev-preferences.md to `~/.claude/commands/gsd/` | n/a | (eliminate) | User-global slash command, not project state. |
| 13 | sdk/dist/query/profile-output.js::generateClaudeProfile | sdk-query-export | Mixed | B | Inject `<!-- GSD:profile -->` block into project or global CLAUDE.md | reads/writes `<projectDir>/CLAUDE.md` (or `~/.claude/CLAUDE.md` w/ `--global`) | `updateClaudeMdSection({section:"profile", content})` (B) | CLAUDE.md is at project root, not under `.planning/`. Treat as **out-of-scope** for adapter (project-root file), but flag — see cross-cutting. |
| 14 | sdk/dist/query/profile-output.js::generateClaudeMd | sdk-query-export | Mixed | B | Generate full CLAUDE.md from `.planning/PROJECT.md`, `codebase/*`, skills | Reads `.planning/PROJECT.md`, `.planning/codebase/STACK.md`, `research/STACK.md`, `codebase/CONVENTIONS.md`, `codebase/ARCHITECTURE.md`; reads `.claude/skills/`, `.agents/skills/`, etc.; writes project-root `CLAUDE.md` | `getProjectMd()` (A), `getCodebaseDoc(name)` (A), `listProjectSkills()` (A) — all read-side; write-side is project-root CLAUDE.md (out of scope) | Reads ARE planning-state; write target is project root. Adapter exposes read methods; write stays outside. |
| 15 | sdk/dist/query/profile-questionnaire-data.js | sdk-query-data | n/a | D | Static questionnaire + instruction tables | n/a | (no adapter — static data) | Const tables only. |
| 16 | sdk/dist/query/profile-sample.js (helper) | sdk-query-helper | n/a | C | Internals for #8 | n/a | (eliminate w/ #8) | Reads `~/.claude/projects/`. |
| 17 | sdk/dist/query/profile-scan-sessions.js (helpers) | sdk-query-helper | n/a | C | Internals for #7 | n/a | (eliminate w/ #7) | Reads `~/.claude/projects/`. |
| 18 | sdk/dist/query/init.js::withProjectRoot | sdk-helper | n/a | A | Inject project_root + agent install + project_title | reads `.planning/PROJECT.md` (h1), agent dirs | `getProjectTitle()` (A), `listInstalledAgents()` (A out-of-`.planning/`) | Agent-dir check is `~/.claude/agents` etc. — out of scope. |
| 19 | sdk/dist/query/init.js::initExecutePhase | sdk-query-export | n/a | B | Build flat-JSON bundle for /gsd-execute-phase init | reads ROADMAP, STATE, config, phase dir | `getExecutePhaseInit(phase)` (B) | Composite: model resolution + phase fallback + branch-name compute. |
| 20 | sdk/dist/query/init.js::initPlanPhase | sdk-query-export | n/a | B | Build flat-JSON bundle for /gsd-plan-phase init | reads phase dir + ROADMAP + config | `getPlanPhaseInit(phase)` (B) | Composite read + artifact-path discovery. |
| 21 | sdk/dist/query/init.js::initNewMilestone | sdk-query-export | n/a | B | Build flat-JSON bundle for /gsd-new-milestone init | reads MILESTONES.md, ROADMAP, phases dir | `getNewMilestoneInit()` (B) | Composite: latest-completed regex + phase-dir count + 3 model resolves. |
| 22 | sdk/dist/query/init.js::initQuick | sdk-query-export | n/a | B | Build flat-JSON for /gsd-quick init (id + slug + branch) | reads ROADMAP, planning dir | `getQuickInit(description)` (B) | Generates collision-resistant ID + branch name. |
| 23 | sdk/dist/query/init.js::initResume | sdk-query-export | n/a | A | Build flat-JSON for /gsd-resume-work init | reads `.planning/current-agent-id.txt`, STATE, ROADMAP, PROJECT.md existence | `getResumeInit()` (A) | Mostly existence checks + one read. |
| 24 | sdk/dist/query/init.js::initVerifyWork | sdk-query-export | n/a | B | Build flat-JSON for /gsd-verify-work init | reads phase dir + ROADMAP fallback | `getVerifyWorkInit(phase)` (B) | Phase-fallback coordination. |
| 25 | sdk/dist/query/init.js::initPhaseOp | sdk-query-export | n/a | B | Build flat-JSON for discuss-phase + similar | reads phase dir + ROADMAP fallback + artifact discovery | `getPhaseOpInit(phase)` (B) | Same shape as initPlanPhase. |
| 26 | sdk/dist/query/init.js::initTodos | sdk-query-export | n/a | A | List pending todos with frontmatter parsed + counts | reads `.planning/todos/pending/*.md` | `listTodos(area?)` (A) — DUP with batch covering todos.js | Already-named operation; flag for dedup. |
| 27 | sdk/dist/query/init.js::initMilestoneOp | sdk-query-export | n/a | B | Build init for complete-milestone/audit-milestone | reads ROADMAP, phases dir, archive dir | `getMilestoneOpInit()` (B) | Has the canonicalize-phase logic for ROADMAP-vs-disk reconciliation — Bin B. |
| 28 | sdk/dist/query/init.js::initMapCodebase | sdk-query-export | n/a | A | Build init for /gsd-map-codebase | reads `.planning/codebase/*.md` listing | `listCodebaseMaps()` (A) | Bare scan + count. |
| 29 | sdk/dist/query/init.js::initNewWorkspace | sdk-query-export | n/a | C | Detect child git repos for workspace creation | reads project tree (one level) + `git status` | (eliminate from adapter — code-repo concern, not planning-state) | Workspaces are filesystem layout outside `.planning/`. |
| 30 | sdk/dist/query/init.js::initListWorkspaces | sdk-query-export | n/a | C | List `~/gsd-workspaces/*/WORKSPACE.md` | n/a | (eliminate) | Workspace base is `~/gsd-workspaces/`, not `.planning/`. |
| 31 | sdk/dist/query/init.js::initRemoveWorkspace | sdk-query-export | n/a | C | Manifest-driven workspace deletion check | n/a | (eliminate) | Same as #30. |
| 32 | sdk/dist/query/init.js::initIngestDocs | sdk-query-export | n/a | A | Build init for /gsd-ingest-docs | existsSync `.planning/PROJECT.md`, `.planning/`, `.git` | `getProjectExistence()` (A) | Tiny existence-check bundle. |
| 33 | sdk/dist/query/init-complex.js::initNewProject | sdk-query-export | n/a | B | Build init for /gsd-new-project (brownfield detect + search APIs) | reads project tree (depth-3 code scan), `~/.gsd/*_api_key`, `.planning/codebase/`, `.planning/PROJECT.md` | `getNewProjectInit()` (B) — but brownfield detect is code-repo (out of scope) | Brownfield detection is non-`.planning/` and stays external. The `.planning/` parts go in adapter. |
| 34 | sdk/dist/query/init-complex.js::initProgress | sdk-query-export | n/a | B | Phase list with disk + ROADMAP-checkbox reconciliation + paused-state | reads ROADMAP, phases dir, STATE | `getProgressInit()` (B) | Heavyweight — same data as listPhaseProgress + paused state. May overlap with batch 01 `progress.js`. |
| 35 | sdk/dist/query/init-complex.js::initManager | sdk-query-export | n/a | B | Phase grid with deps, recommended actions, queued-milestone preview | reads ROADMAP, phases dir, WAITING.json, config | `getManagerInit()` (B) | Cascading: dependency graph + sliding window + recommendation routing. Pure Bin B. |
| 36 | sdk/dist/query/skills.js::agentSkills | sdk-query-export | n/a | C | Emit `<agent_skills>` XML block from `config.agent_skills` + `.claude/skills/` paths | reads project `config.json` agent_skills, validates `<path>/SKILL.md` existence | (eliminate from adapter) | Agent-skill injection is project-root/`.claude/` config concern, not planning state. |
| 37 | sdk/dist/query/skill-manifest.js::skillManifest / buildSkillManifest | sdk-query-export | Mixed | C | Multi-root skill discovery scan + manifest write to `.planning/skill-manifest.json` | reads `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, `.codex/skills/`, `~/.claude/skills/`, `~/.codex/skills/`, `~/.claude/get-shit-done/skills/`, `~/.claude/commands/gsd/`; writes `.planning/skill-manifest.json` | `writeSkillManifest(manifest)` (A — bare put for the cached file) | Read side is out-of-`.planning/` (skill discovery). The cached manifest write IS planning state. |
| 38 | get-shit-done/workflows/help.md | workflow | SDK-only | n/a | Static reference dump of GSD command list | none — pure text | none | No adapter needs. The skill router copies the `<reference>` block. |
| 39 | get-shit-done/workflows/note.md | workflow | Direct | n/a | Append/list/promote notes (project or global scope) | `Glob .planning/notes/*.md`, `Glob ~/.claude/notes/*.md`, `Read` each note's frontmatter, `Write` new note `.planning/notes/{date}-{slug}.md` (or global), `Edit` source frontmatter `promoted: true`, scan `.planning/todos/{pending,completed}/` for next-id, `Write .planning/todos/pending/{id}.md` | `listNotes(scope)` (A), `addNote({date, slug, body, scope})` (B), `markNotePromoted(id)` (B), `findNextTodoId()` (A), `addTodo({title, ...})` (B — DUP w/ todos batch) | Two scopes: project (`.planning/notes/`) is adapter; global (`~/.claude/notes/`) is out of scope. The `Glob` and `Read` of every note's frontmatter is a real direct-I/O leak. |
| 40 | get-shit-done/workflows/plant-seed.md | workflow | Direct | n/a | Capture forward-looking idea as `.planning/seeds/SEED-NNN-slug.md` | `mkdir -p .planning/seeds`, `ls .planning/seeds/SEED-*.md` for next-id, `grep -rl "$KEYWORD" --include=*.ts` (codebase, out of scope), `Read .planning/STATE.md`, `Read .planning/ROADMAP.md`, `Read .planning/todos/`, `Write .planning/seeds/SEED-{NNN}-{slug}.md`, `gsd-sdk query commit` | `findNextSeedId()` (A), `listSeeds()` (A), `addSeed({trigger, why, scope, breadcrumbs})` (B), `getCurrentMilestone()` (A — DUP), `findRelatedTodos(keyword)` (A — overlaps with `listTodos` filter) | Codebase grep is out-of-scope. Seeds are a new domain noun: `Seed`. |
| 41 | get-shit-done/workflows/check-todos.md | workflow | Mixed | n/a | List pending todos + select + load context + route to action | `gsd-sdk query init.todos`; `Read` selected todo file (path from init); `Read .planning/ROADMAP.md` for phase match; `mv .planning/todos/pending/X.md .planning/todos/completed/`; `Read/Write .planning/STATE.md` "### Pending Todos" section; `git rm --cached`, `gsd-sdk query commit` | `listTodos(area?)` (A — DUP), `getTodo(id)` (A), `findRoadmapPhaseByArea(area)` (B), `completeTodo(id)` (B — DUP w/ progress.js), `recordStateEvent({type:"todo_count_update", count})` (B — DUP w/ batch 02 add-phase) | Routing logic stays in workflow; STATE.md update is the leak — already named in pilot. |
| 42 | agents/gsd-doc-writer.md | agent | Mixed | n/a | Subagent that writes/updates project docs (README, ARCHITECTURE, etc.) | `Read .claude/skills/`, `.agents/skills/` SKILL.md (skill loading); `Read package.json`, `LICENSE`, `src/index.*` etc. (codebase — out of scope); `Read .planning/codebase/CONVENTIONS.md` (referenced for terminology); `Write` doc files at project root or `docs/` (out of scope); `Read` `existing_content` from caller (passed-in, no I/O) | `listProjectSkills()` (A — DUP w/ generateClaudeMd), `getCodebaseConventions()` (A — DUP) | Almost entirely out-of-`.planning/`: writes README/ARCHITECTURE/etc. at project root, reads codebase. The only `.planning/` touches are skill discovery + codebase doc reads. Most behavior is orthogonal to adapter. |

(Skills 43–52 are routers — see one-line entries in the auto-classify section below.)

### Routers (auto-classified — Rule 4)

| # | Path | Inherits from |
|---|------|----------------|
| 43 | commands/gsd/help.md | workflow help.md (SDK-only) |
| 44 | commands/gsd/note.md | workflow note.md (Direct) |
| 45 | commands/gsd/plant-seed.md | workflow plant-seed.md (Direct) |
| 46 | commands/gsd/check-todos.md | workflow check-todos.md (Mixed) |
| 47 | commands/gsd/add-todo.md | workflow add-todo.md (not in this batch — see batch 02/03) |
| 48 | commands/gsd/docs-update.md | workflow docs-update.md (not in this batch) |
| 49 | commands/gsd/settings.md | workflow settings.md (not in this batch) |
| 50 | commands/gsd/settings-advanced.md | workflow settings-advanced.md (not in this batch) |
| 51 | commands/gsd/settings-integrations.md | workflow settings-integrations.md (not in this batch) |
| 52 | commands/gsd/join-discord.md | n/a — pure static output, **no I/O at all** |

All 10 are thin `<execution_context>@~/.claude/get-shit-done/workflows/X.md</execution_context>` routers. `join-discord.md` is the one outlier — it has zero I/O, just emits a Discord URL inline.

## Per-artifact detail

### sdk/dist/query/profile.js (multiple exports)

Single file, 9 exports. The 5 `learnings*` exports operate on `~/.gsd/knowledge/` (user-global), the 4 profile/session exports operate on `~/.claude/projects/` (Claude Code's session log). **None of these are `.planning/` state.** Per Rule 6, they are out-of-scope for the adapter.

Exception: `learningsCopy` reads `.planning/LEARNINGS.md` and writes to the global store. The read side IS adapter concern (`listLearningSections()` Bin A); the global-store write stays orthogonal.

### sdk/dist/query/profile-output.js

Two exports straddle the line:
- `generateClaudeProfile` and `generateClaudeMd` write to `<projectDir>/CLAUDE.md` (project root, **not under `.planning/`**). Per Rule 6, project-root files outside `.planning/` are not adapter concerns. **However**, the source data they consume IS planning state: `PROJECT.md`, `codebase/STACK.md`, `codebase/CONVENTIONS.md`, `codebase/ARCHITECTURE.md`. So we propose adapter read methods (`getProjectMd`, `getCodebaseDoc(name)`, `listProjectSkills`) and leave the CLAUDE.md write as a non-adapter renderer.
- `writeProfile` and `generateDevPreferences` write to `~/.claude/...` global paths — fully out of scope.

### sdk/dist/query/init.js + init-complex.js (16 exports)

These are workflow-init bundlers. Each one reads multiple sources (config, ROADMAP, phases dir, STATE, REQUIREMENTS, MILESTONES, archive) and emits a flat JSON pre-bundled for the workflow. **Each is one Bin B method per workflow** — the coordination IS the operation:
- Phase resolution with archived/roadmap fallback
- Multi-model resolution via `Promise.all` (config-derived, not state-derived)
- Branch-name templating with project_code/slug/version interpolation
- Milestone-aware progress reconciliation (the canonicalize-phase + checkbox-vs-disk logic in `initManager`/`initProgress`/`initMilestoneOp` is the most coordination-heavy code in this batch)

Three (`initNewWorkspace`, `initListWorkspaces`, `initRemoveWorkspace`) operate entirely on `~/gsd-workspaces/` and are out of scope. Two (`initResume`, `initIngestDocs`, `initMapCodebase`) are pure existence-check bundles → Bin A. `initTodos` duplicates the standalone `listTodos` SDK query and should consolidate.

### sdk/dist/query/skills.js + skill-manifest.js

`agentSkills` reads `config.agent_skills` and validates that `<projectDir>/<entry>/SKILL.md` exists for each. The data lives in `.planning/config.json` (which IS adapter concern, covered separately) but the targets are `.claude/skills/`, `.agents/skills/`, etc. — project-root config dirs, not `.planning/`. Per Rule 6, the validation walk is out of scope.

`skillManifest` is a multi-root scan across 9 canonical skill roots (5 project-relative, 2 user-global, 2 deprecated). The scan itself is out of scope. The **only** `.planning/` touch is `--write` mode caching the manifest to `.planning/skill-manifest.json`. That single write is `writeSkillManifest(manifest)` Bin A.

### get-shit-done/workflows/help.md

Pure static text — no I/O at all. The workflow body IS the reference. Confirms there are leak-free workflows.

### get-shit-done/workflows/note.md

- **Direct I/O ops enumerated:**
  1. `Glob .planning/notes/*.md` — list project notes
  2. `Glob ~/.claude/notes/*.md` — list global notes (out of scope)
  3. `Read` frontmatter of every note file (project + global)
  4. `Write .planning/notes/{YYYY-MM-DD}-{slug}.md` (or global path) — append subcommand
  5. `Edit` source note's frontmatter to set `promoted: true` (read+write pair)
  6. `mkdir .planning/notes/` and `mkdir .planning/todos/pending/` if missing
  7. Scan `.planning/todos/pending/` AND `.planning/todos/completed/` for max ID
  8. `Write .planning/todos/pending/{NNN}-{slug}.md` (promote subcommand)
- **Adapter methods needed:**
  1. `listNotes(scope)` (A) — replaces 1+3
  2. `addNote({body, scope, date})` (B) — slug computation + collision-resistant filename + frontmatter injection
  3. `markNotePromoted(noteId)` (B) — find file, edit frontmatter
  4. `findNextTodoId()` (A) — DUP w/ /gsd-add-todo batch
  5. `addTodo({title, ...})` (B) — DUP w/ todos batch
- **Notes:** Two-scope (project vs global) means adapter only handles project; global path stays in workflow as a fallback.

### get-shit-done/workflows/plant-seed.md

- **Direct I/O ops enumerated:**
  1. `mkdir -p .planning/seeds` — directory ensure
  2. `ls .planning/seeds/SEED-*.md | wc -l` — next-id compute
  3. `Read .planning/STATE.md` — for `planted_during` field
  4. `Read .planning/ROADMAP.md` — for related-phase context (informational)
  5. `Read .planning/todos/` — for related-idea breadcrumbs
  6. `grep -rl "$KEYWORD" --include="*.ts"` — codebase scan (out of scope)
  7. `Write .planning/seeds/SEED-{NNN}-{slug}.md` — final artifact
  8. `gsd-sdk query commit` — already SDK
- **Adapter methods needed:**
  1. `findNextSeedId()` (A) — replaces ls+wc
  2. `addSeed({idea, trigger, why, scope, breadcrumbs, planted_during})` (B) — slug + frontmatter + commit-message wiring
  3. `listSeeds()` (A) — for `/gsd-new-milestone` consumer (cross-batch reference)
  4. `getCurrentMilestone()` (A) — DUP, used by many workflows
  5. `findRelatedTodos(keyword)` (B if cross-references with code-grep, A if just `listTodos` + filter)
- **Notes:** Introduces a new domain noun: `Seed`. Add to convention sheet (see cross-cutting). `mkdir -p` is unusual — adapter should handle directory existence implicitly.

### get-shit-done/workflows/check-todos.md

- **Direct I/O ops enumerated:**
  1. `gsd-sdk query init.todos` — SDK call (init bundle)
  2. `Read` selected todo file (full content) — by path from init
  3. `Read` each `files:` referenced by todo (codebase — out of scope)
  4. `Read .planning/ROADMAP.md` — for phase-area match
  5. `mv .planning/todos/pending/X.md .planning/todos/completed/X.md` — completion
  6. `Read .planning/STATE.md` then `Edit` "### Pending Todos" section
  7. `git rm --cached` + `gsd-sdk query commit` — already SDK
- **Adapter methods needed:**
  1. `listTodos(area?)` (A) — DUP, already named
  2. `getTodo(id)` (A) — full record by id
  3. `findRoadmapPhaseByArea(area)` (B) — joins ROADMAP phases with todo area; coordination
  4. `completeTodo(id)` (B) — DUP w/ progress.js, already named in pilot
  5. `recordStateEvent({type:"todo_count_update", count})` (B) — DUP w/ pilot's add-phase finding
- **Notes:** Routing logic (Action options) stays in workflow. `mv` + frontmatter timestamp is the same coordination class as `todoComplete` in the pilot — adapter ownership of the timestamp injection is mandatory.

### agents/gsd-doc-writer.md

- **Direct I/O ops enumerated:**
  1. `Read` codebase: `package.json`, `LICENSE`, `src/index.*`, `bin/`, `examples/`, etc. (out of scope)
  2. `Read .claude/skills/SKILL.md` and `.agents/skills/SKILL.md` (project-root skill dirs — out of scope)
  3. `Read .planning/codebase/CONVENTIONS.md` and other `codebase/` docs (when applicable as style reference)
  4. `Write` doc files: README.md (root), ARCHITECTURE.md (`docs/` or root), etc. — **all project-root or `docs/`, not `.planning/`**
  5. Reads `existing_content` from caller's prompt (no actual I/O)
- **Adapter methods needed:**
  1. `listProjectSkills()` (A) — DUP w/ generateClaudeMd
  2. `getCodebaseDoc(name)` (A) — DUP w/ generateClaudeMd
- **Notes:** This agent is **almost entirely out of `.planning/` scope**. It writes project documentation at project root or `docs/`, not adapter state. Adapter only needs to expose the `.planning/codebase/*` reads. The agent's tool list (`Read, Bash, Grep, Glob, Write`) including `Write` to project root means hooks must be very careful not to intercept its codebase writes. Flag for synthesis: agent kind = "doc-writer subagent, project-root I/O".

## Cross-cutting observations from this batch

1. **The bulk of profile/* SDK queries are out of `.planning/` scope.** `~/.gsd/knowledge/`, `~/.claude/projects/`, `~/.claude/get-shit-done/`, and project-root `CLAUDE.md` are NOT planning state. We classified 11 exports as Bin C "eliminate" not because they're obsolete but because they're **orthogonal to the adapter interface entirely**. The fork can keep them as standalone utilities without adapter mediation. Recommend the rubric add a sub-bin or note: **"out-of-`.planning/` SDK queries"** distinct from "obsolete in new architecture" — both are currently lumped under Bin C.

2. **`generateClaudeMd` is the most surprising find.** It reads 5+ `.planning/` files (`PROJECT.md`, `codebase/{STACK,CONVENTIONS,ARCHITECTURE}.md`, skill SKILL.md files) and writes to project-root `CLAUDE.md`. The READS are real adapter concerns; the WRITE is project-root. This split-personality op is unusual — synthesizer should decide whether the adapter-read+external-write pattern needs a special "consumer of adapter, writer outside" classification.

3. **Init queries are uniformly Bin B.** All 13 non-skipped `init*` exports are coordinated multi-source bundles. They cleanly map to one Bin B method per workflow. Consolidation opportunity: many compute the same primitives (model resolution, milestone info, phase fallback). The adapter can stay coarse-grained at the workflow level, but the **primitives** (model resolve, milestone get, phase fallback) are reused across batches and should be Bin A in their own right.

4. **Workflow leaks confirm the pilot pattern.** `note.md`, `plant-seed.md`, and `check-todos.md` all have direct `Read/Write/Edit/mv/grep` of `.planning/*` outside `gsd-sdk query` calls. Total leaks in this batch: 18 distinct ops across 3 workflows + 1 agent.

5. **New domain nouns introduced — flag for convention sheet:**
   - `Seed` (gsd-seeds, future-looking idea with trigger conditions) — used in `plant-seed.md`. Add to convention sheet alongside `Phase`/`Plan`/`Todo`.
   - `Note` (gsd-notes, zero-friction capture) — used in `note.md`. Add to convention sheet.
   - `Learning` (`.planning/LEARNINGS.md` sections) — exists but only one read site (`learningsCopy`). Probably stays as `LearningSection` rather than full noun.
   - `SkillManifest` (cached `.planning/skill-manifest.json`) — single noun, single op.

6. **DUP methods (flag for synthesizer dedup):**
   - `listTodos(area?)` — appears in initTodos, check-todos workflow, note.md (promote), plant-seed.md (related)
   - `completeTodo(id)` — appears in check-todos.md AND batch 01 progress.js todoComplete
   - `recordStateEvent({type, ...})` — appears in check-todos.md AND pilot add-phase + many others (broadly used)
   - `getCurrentMilestone()` / `getMilestoneInfo()` — used by every init* export
   - `listProjectSkills()` and `getCodebaseDoc(name)` — used by generateClaudeMd, gsd-doc-writer, and probably others

7. **The doc-writer agent's adapter footprint is minimal because most of its work is outside `.planning/`.** This is an important architectural observation: not every agent needs heavy adapter wiring. Some agents legitimately operate on the code repo, not on planning state. Hook strategy should differentiate.

8. **Naming clash candidates:** I used `getProjectMd()` in passing for reading `.planning/PROJECT.md`. Pilot uses no such name; convention sheet has no `Project` noun. Either add `Project` as a domain noun (covers PROJECT.md) or rename to `getProjectVision()` / `getProjectMeta()`. Flag for synthesis.

9. **Rubric gap — static-data SDK queries.** `profile-questionnaire-data.js` is a constant-table module with no I/O. There's no Bin assignment that fits cleanly; I used D (presentation/data) but it's not really presentation. Recommend adding **Bin E: "no-I/O / pure data"** for static modules, distinct from D's "presentation/formatter" semantic.

## Bin-by-bin counts

- Bin A: **13** operations proposed (`listLearningSections`, `getProjectTitle`, `getResumeInit`, `getProjectExistence`, `listCodebaseMaps`, `findNextSeedId`, `listSeeds`, `listNotes`, `getTodo`, `listTodos`, `getProjectMd`, `getCodebaseDoc`, `listProjectSkills`, `writeSkillManifest`)
- Bin B: **13** operations proposed (all `getXxxInit()` composite bundlers (8) + `addNote`, `markNotePromoted`, `addSeed`, `findRoadmapPhaseByArea`, `updateClaudeMdSection`, `addTodo`, `completeTodo`, `recordStateEvent` — several DUP across workflows)
- Bin C (eliminate): **17 SDK queries** marked out-of-`.planning/` and 3 workflow-internal ops (codebase grep, agent-dir scan, workspace ops) — most are not "eliminated" so much as "outside adapter scope"
- Bin D (presentation/static-data): **2** (`profileQuestionnaire`, `profile-questionnaire-data`)
- Direct I/O leaks found: **18** across 3 workflows + 1 agent
- Routers auto-classified: **10** (all in `commands/gsd/`)
