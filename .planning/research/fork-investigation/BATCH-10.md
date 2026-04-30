# Batch 10 — Workspace + config + util + misc

Date: 2026-04-30
Artifacts assigned: 26 (16 SDK queries · 6 workflows · 4 skills)
Output by: BATCH-10 fork-investigation classifier

## Classification table

| # | Path | Kind | I/O surface | Bin | Use case (≤15 words) | Direct I/O ops | Adapter methods proposed (with Bin) | Notes |
|---|------|------|-------------|-----|----------------------|----------------|-------------------------------------|-------|
| 1 | sdk/dist/query/workspace.js::resolveWorkspaceContext | sdk-query-export | n/a | A | Read GSD_WORKSTREAM/GSD_PROJECT env vars | env read | n/a (env only, no `.planning` I/O) | infra; not adapter concern |
| 2 | sdk/dist/query/workspace.js::workspacePlanningPaths | sdk-query-export | n/a | A | Compute scoped `.planning/` paths for active workspace | path math | n/a (pure path resolver) | infra used by adapter, not exposed |
| 3 | sdk/dist/query/workstream.js::workstreamGet | sdk-query-export | n/a | A | Active workstream + flat/workstream mode flag | reads `active-workstream` file + dir existsSync | `getActiveWorkstream()` (A) | |
| 4 | sdk/dist/query/workstream.js::workstreamList | sdk-query-export | n/a | A | List workstream subdirectories | readdirSync of `.planning/workstreams` | `listWorkstreams()` (A) | |
| 5 | sdk/dist/query/workstream.js::workstreamCreate | sdk-query-export | n/a | B | Create workstream dir + STATE.md template + set active | mkdir + writeFile STATE.md + write active-workstream | `createWorkstream(name)` (B) | structured init: slug+dir+state template+activate |
| 6 | sdk/dist/query/workstream.js::workstreamSet | sdk-query-export | n/a | B | Switch active workstream + mirror STATE.md to root | write active-workstream + copy STATE.md to root | `setActiveWorkstream(name)` (B) | mirror is coordination |
| 7 | sdk/dist/query/workstream.js::workstreamStatus | sdk-query-export | n/a | A | Per-workstream files + phase artifact counts + state fields | readdir phases, readFile STATE.md | `getWorkstreamStatus(name)` (A) | scan+parse aggregator |
| 8 | sdk/dist/query/workstream.js::workstreamComplete | sdk-query-export | n/a | B | Archive workstream into `.planning/milestones/ws-<n>-<date>/` with rollback | rename tree, rmdir, deactivate, possibly drop ws root | `completeWorkstream(name)` (B) | cascade w/ rollback semantics |
| 9 | sdk/dist/query/workstream.js::workstreamProgress | sdk-query-export | n/a | B | Aggregate progress across all workstreams (joins state+roadmap+phases) | readdirs + readFile STATE+ROADMAP per ws | `listWorkstreamProgress()` (B) | multi-source join |
| 10 | sdk/dist/query/config-mutation.js::configSet | sdk-query-export | n/a | B | Validate key + coerce value + atomic write to config.json | lock + read+write config.json | `updateConfig(key, value)` (B) | lock + validate + previousValue tracking |
| 11 | sdk/dist/query/config-mutation.js::configSetModelProfile | sdk-query-export | n/a | B | Set model_profile field; return computed agent→model map | lock + read+write config.json | `updateModelProfile(profile)` (B) | derives agentToModelMap |
| 12 | sdk/dist/query/config-mutation.js::configNewProject | sdk-query-export | n/a | B | Initial config.json with defaults+global+API-key detection | mkdir+write config.json, env+~/.gsd defaults reads | `createInitialConfig(userChoices)` (B) | deep merge + idempotent |
| 13 | sdk/dist/query/config-mutation.js::configEnsureSection | sdk-query-export | n/a | A | Idempotent ensure top-level section exists in config.json | read+write config.json | `ensureConfigSection(name)` (A) | bare conditional shape op |
| 14 | sdk/dist/query/config-mutation.js::isValidConfigKey | sdk-query-export | n/a | C | Internal validation helper (exported) | none | n/a | pure (validation logic, no I/O) — not adapter |
| 15 | sdk/dist/query/config-mutation.js::parseConfigValue | sdk-query-export | n/a | C | Coerce CLI string to native type | none | n/a | pure |
| 16 | sdk/dist/query/config-query.js::configGet | sdk-query-export | n/a | A | Read config.json + dot-traverse | readFile config.json | `getConfig(keyPath)` (A) | bare |
| 17 | sdk/dist/query/config-query.js::configPath | sdk-query-export | n/a | A | Resolved path to config.json | none (path math) | `getConfigPath()` (A) | trivial |
| 18 | sdk/dist/query/config-query.js::resolveModel | sdk-query-export | n/a | B | Model alias for agent, honoring overrides + profile + GSD_RUNTIME | reads via loadConfig | `resolveAgentModel(agent)` (B) | override+profile+runtime branching |
| 19 | sdk/dist/query/config-query.js::MODEL_PROFILES / VALID_PROFILES / getAgentToModelMapForProfile | sdk-query-export | n/a | C | Static profile tables + map generator | none | n/a | pure data; not adapter |
| 20 | sdk/dist/query/config-schema.js::VALID_CONFIG_KEYS / DYNAMIC_KEY_PATTERNS / isValidConfigKeyPath | sdk-query-export | n/a | C | Static schema (allowlist + dynamic regexes) | none | n/a | pure constants |
| 21 | sdk/dist/query/detect-custom-files.js::detectCustomFiles | sdk-query-export | n/a | C | Find user-added files vs. install manifest under runtime config dir | walks runtime configDir + reads manifest.json | n/a | scans **runtime install dir**, not `.planning/` — out of scope |
| 22 | sdk/dist/query/docs-init.js::docsInit + helpers | sdk-query-export | n/a | C/B | Context bundle for docs-update workflow (project-type/tooling/agents) | reads project root .md, package.json, agents dir | `getDocsInitContext()` (B) if kept | scans project root, not `.planning/` — mostly out of scope; the `planning_exists` flag is a single A check |
| 23 | sdk/dist/query/template.js::templateSelect | sdk-query-export | n/a | A | Heuristic plan/summary/verification template choice from phase dir | readdir phase dir | `selectPhaseTemplate(phase)` (A) | bare scan + heuristic |
| 24 | sdk/dist/query/template.js::templateFill | sdk-query-export | n/a | B | Render template with frontmatter overrides + write file | writeFile output path | `fillTemplate(type, path, overrides)` (B) | derived frontmatter+body |
| 25 | sdk/dist/query/pipeline.js::wrapWithPipeline + helpers | sdk-query-export | n/a | C | Registry middleware for dry-run + hooks | clones `.planning/` to tmpdir then reads back | n/a (infra) | adapter must support equivalent dry-run primitive — see cross-cutting |
| 26 | sdk/dist/query/utils.js::generateSlug | sdk-query-export | n/a | C | Pure slug computation | none | n/a | pure (caller responsibility) |
| 27 | sdk/dist/query/utils.js::currentTimestamp | sdk-query-export | n/a | C | Pure ISO timestamp formatter | none | n/a | pure |
| 28 | sdk/dist/query/helpers.js (all exports) | sdk-query-export | n/a | C | Path/regex/phase-name helpers, runtime/agents-dir resolution, normalizeMd, sanitize, findProjectRoot | one `findProjectRoot` walks up reading config.json + `.git` checks | n/a | infra; planning helpers used by adapter, but `findProjectRoot` is bootstrap, not adapter API |
| 29 | sdk/dist/query/registry.js (QueryRegistry, extractField, resolveQueryArgv) | sdk-query-export | n/a | C | Command registry + argv resolver | none | n/a | infra (dispatch plumbing) |
| 30 | sdk/dist/query/normalize-query-command.js::normalizeQueryCommand | sdk-query-export | n/a | C | Map argv to dotted registry keys | none | n/a | pure |
| 31 | sdk/dist/query/schema-detect.js::detectSchemaFiles + checkSchemaDrift | sdk-query-export | n/a | C | ORM/schema-file detection vs. execution log | none (input strings only) | n/a | pure; `verify schema-drift` consumer reads logs elsewhere |
| 32 | sdk/dist/query/commit.js::execGit | sdk-query-export | n/a | C | Spawn git in cwd | shell | n/a | git is non-`.planning`, out of scope |
| 33 | sdk/dist/query/commit.js::sanitizeCommitMessage | sdk-query-export | n/a | C | Pure prompt-injection scrub | none | n/a | pure |
| 34 | sdk/dist/query/commit.js::commit | sdk-query-export | n/a | B | Stage `.planning/` (or paths) + git commit + return hash | reads config + git add+commit+rev-parse | `commitPlanningState({message,files,flags})` (B) | adapter must own commit-vs-no-commit policy; for beads adapter, this is likely a no-op or different transport |
| 35 | sdk/dist/query/commit.js::checkCommit | sdk-query-export | n/a | A | Validate stage state vs. commit_docs config | reads config + `git diff --cached` | `checkCommitReady()` (A) | thin |
| 36 | sdk/dist/query/commit.js::commitToSubrepo | sdk-query-export | n/a | B | Commit to a sub-repo with safety checks | reads config sub_repos + git ops | `commitToSubrepo({message,files})` (B) | sibling of commit |
| 37 | sdk/dist/query/index.js | sdk-query-file | n/a | C | Re-exports + `createRegistry()` factory wiring all handlers + event emission | none directly | n/a | pure plumbing; **note**: this is THE central wiring point — fork must add adapter dispatch here |
| 38 | get-shit-done/workflows/list-workspaces.md | workflow | SDK-only | n/a | List `~/gsd-workspaces/` workspaces | none (sdk init.list-workspaces only) | n/a | pure SDK consumer |
| 39 | get-shit-done/workflows/new-workspace.md | workflow | Mixed | n/a (consumer) | Create workspace dir w/ git worktrees + `.planning/` + WORKSPACE.md | (5 ops enumerated below) | (3 methods proposed below) | git operations are repo-scope, not `.planning/`; WORKSPACE.md and `.planning/` init ARE planning |
| 40 | get-shit-done/workflows/remove-workspace.md | workflow | Direct | n/a (consumer) | Remove workspace dir + clean git worktrees | (3 ops enumerated below) | (1 method proposed below) | rm -rf + worktree cleanup; SDK init.remove-workspace provides safety data only |
| 41 | get-shit-done/workflows/cleanup.md | workflow | Direct | n/a (consumer) | Archive completed-milestone phase dirs to `.planning/milestones/v*-phases/` | (5 ops enumerated below) | (3 methods proposed below) | heaviest direct-I/O leak in this batch |
| 42 | get-shit-done/workflows/inbox.md | workflow | Direct (out-of-scope) | n/a | GitHub issue/PR triage; writes `.planning/INBOX-TRIAGE.md` | gh CLI; one Write to `.planning/INBOX-TRIAGE.md` | `writeInboxTriageReport(content)` (A) | almost entirely github API; only the planning report write is adapter-relevant |
| 43 | get-shit-done/workflows/sync-skills.md | workflow | Direct (out-of-scope) | n/a | Copy gsd-* skill dirs across runtime config dirs | rm/cp/mkdir on `~/.<runtime>/skills/` | n/a | runtime install dir, NOT `.planning/` — out of scope per Rule 6 |
| 44 | commands/gsd/list-workspaces.md | skill | Router | n/a | Router → workflows/list-workspaces.md | none | inherits | one-line router |
| 45 | commands/gsd/new-workspace.md | skill | Router | n/a | Router → workflows/new-workspace.md | none | inherits | one-line router |
| 46 | commands/gsd/remove-workspace.md | skill | Router | n/a | Router → workflows/remove-workspace.md | none | inherits | one-line router |
| 47 | commands/gsd/workstreams.md | skill | SDK-only | n/a (consumer) | Subcommand dispatcher for workstream.* SDK queries | none | inherits SDK queries (#3-9) | NOT a router — has its own subcommand parsing logic, but pure SDK |

## Per-artifact detail

### sdk/dist/query/workspace.js (multiple exports)

Workspace-context resolver. `resolveWorkspaceContext` reads env only (not state). `workspacePlanningPaths` is pure path computation. Neither performs `.planning/` I/O. The adapter doesn't need a method here; instead, **the adapter itself must accept a workspace context** at construction (`new MarkdownAdapter({projectDir, workstream})`) and apply the path scoping internally. So this file becomes adapter-internal infrastructure.

### sdk/dist/query/workstream.js (7 exports)

Heaviest file in this batch. All seven exports operate on `.planning/workstreams/<name>/` and the sentinel `.planning/active-workstream`.

- `workstreamGet`/`workstreamList` — bare scans (Bin A).
- `workstreamCreate` — multi-step creation (mkdir, write STATE.md template, set active). Bin B because the STATE.md template injection is domain logic.
- `workstreamSet` — write active sentinel + copy STATE.md to root mirror. Bin B (mirror is coordination, not pass-through).
- `workstreamStatus` — readdir phases + readFile STATE.md + extract fields. Bin A scan+parse.
- `workstreamComplete` — rename(N) into archive dir with rollback-on-error semantics + cleanup. Bin B (cascade).
- `workstreamProgress` — joins per-ws state + roadmap regex + phase counts. Bin B (multi-source).

For the **beads adapter**, workstreams likely become bd labels or namespaces; the markdown adapter implements them as today. Either way, the adapter interface needs the seven named methods listed in the table.

### sdk/dist/query/config-mutation.js (5 exports)

Three Bin B operations (`configSet`, `configSetModelProfile`, `configNewProject`) all do read-modify-write on `config.json` with locks and atomic temp-file rename. One Bin A (`configEnsureSection`). Two pure helpers (`isValidConfigKey`, `parseConfigValue` — Bin C).

`config.json` is part of `.planning/` so the adapter must own these. For the beads adapter, config likely stays as a markdown/JSON file alongside the bd store (config is meta about the workflow, not project state). Treat `config.json` as a special adapter record type (`getConfig(key)` / `updateConfig(key,value)`) rather than per-method coordination — but the **typed updates** (model profile, new-project init) keep the Bin B coordination logic.

### sdk/dist/query/config-query.js (3 exports + tables)

`configGet` and `configPath` are Bin A. `resolveModel` is Bin B (override + profile + runtime branching). `MODEL_PROFILES` etc. are pure tables (Bin C). The model-resolution logic is **agent infrastructure** more than planning state — but it reads `config.runtime` and `config.model_profile` from `.planning/config.json`, so it depends on the adapter's `getConfig`. It should NOT be a separate adapter method; instead it's a derived utility built on top of `getConfig`.

### sdk/dist/query/config-schema.js

Pure constants and regex predicates. Bin C. Stays in shared SDK code; adapter doesn't see it.

### sdk/dist/query/detect-custom-files.js

Scans the **runtime config dir** (`~/.claude/get-shit-done/`, `~/.claude/commands/gsd/`, etc.) for files not in the install manifest. This is install-tooling, not `.planning/` state. Bin C / out of scope per Rule 6. Keep as-is.

### sdk/dist/query/docs-init.js

Context bundle for `/gsd-docs-update`. Reads project root `.md` files (recursive) and `docs/` for the doc-writer agent. Also calls `loadConfig` and `resolveModel`. **The only `.planning/`-relevant call is `pathExistsInternal(projectDir, '.planning')`** (a one-bit check). The rest scans the user's source tree (`docs/`, `package.json`, `LICENSE`) — out of scope per Rule 6.

If kept as an adapter method, `getDocsInitContext()` would be Bin B because it joins ~6 sources. But the inputs are project source code, not `.planning/`. Recommendation: **leave this as a non-adapter SDK utility** that consumes `adapter.getConfig(...)` for the parts that ARE planning state. The single planning-relevant signal (does `.planning/` exist?) is satisfied by adapter construction.

### sdk/dist/query/template.js (2 exports)

`templateSelect` — Bin A (readdir phase dir + heuristic). `templateFill` — Bin B (frontmatter generation + body composition + atomic write). Both target `.planning/phases/<dir>/...` so they are adapter concerns. For beads, "templates" become issue creation templates (issue body + labels).

### sdk/dist/query/pipeline.js

Dry-run middleware. Clones `.planning/` to a tmpdir, runs the mutation, computes a content diff, and discards. **This is infrastructure that assumes a markdown filesystem**. The fork must replace this with an adapter-level dry-run primitive — e.g., `adapter.beginTransaction()` / `adapter.rollback()` — so beads adapter can implement dry-run without copying issues. Flag this for synthesis: **dry-run is an adapter capability, not a workflow**. Bin C as written; the new design needs a transactional surface.

### sdk/dist/query/utils.js (2 exports)

`generateSlug`, `currentTimestamp` — pure. Bin C. Callers (mostly Bin B SDK methods) inject these themselves; no adapter responsibility.

### sdk/dist/query/helpers.js (many exports)

Pure helpers: `escapeRegex`, `normalizePhaseName`, `comparePhaseNum`, `extractPhaseToken`, `phaseTokenMatches`, `toPosixPath`, `stateExtractField`, `normalizeMd`, `planningPaths`, `sanitizeForPrompt`, `sanitizeForDisplay`. Plus `getRuntimeConfigDir`, `detectRuntime`, `resolveAgentsDir` (env-driven, no `.planning/`). And `findProjectRoot` (walks up reading `.planning/config.json`).

`findProjectRoot` is the only one with state I/O — and it's bootstrap (it determines WHERE the adapter operates). Bin C / out of scope as an adapter method. The markdown adapter should call `findProjectRoot` at construction time; the beads adapter would have its own discovery (probably bd's project root rule).

`stateExtractField` and `normalizeMd` are markdown-specific helpers. They become **markdown-adapter implementation detail**, not part of the adapter interface.

### sdk/dist/query/registry.js

Pure dispatch infrastructure. `QueryRegistry` is the registration table; `extractField` and `resolveQueryArgv` are pure. Bin C. The fork must keep this layer (it routes to handlers) but **inject the adapter into each handler's closure** so handlers stop reading the filesystem directly.

### sdk/dist/query/normalize-query-command.js

Pure argv normalizer. Bin C.

### sdk/dist/query/schema-detect.js

Pure ORM detection over file lists and exec logs. Bin C. The `verify.schema-drift` consumer reads execution logs elsewhere.

### sdk/dist/query/commit.js (4 exports)

- `execGit` — pure shell wrapper (Bin C, out of scope).
- `sanitizeCommitMessage` — pure (Bin C).
- `commit` — Bin B. Stages `.planning/` (or specified files) and commits. **Two distinct concerns are entangled**: (1) "the adapter persisted state — commit a checkpoint" and (2) "git is the storage backend". For the markdown adapter these collapse. For the beads adapter, "commit" is N/A or means "close the bd transaction". Adapter method: `commitPlanningState({message, files, flags})` (B), where the beads implementation may be a no-op.
- `checkCommit` — Bin A (`git diff --cached` + config check).
- `commitToSubrepo` — Bin B sibling.

The **commit_docs config** belongs to the adapter; **git operations** belong to a separate `gitBackend` utility orthogonal to the adapter. Flag this split for synthesis.

### sdk/dist/query/index.js

Re-export hub + `createRegistry()` factory. **This is the surgical insertion point for the fork**: today it imports concrete handlers; the fork should pass an `adapter` into `createRegistry({adapter, eventStream, ...})` and the handlers should call adapter methods instead of `node:fs`. Bin C as a file, but architecturally critical.

### get-shit-done/workflows/list-workspaces.md

Pure SDK consumer (`gsd-sdk query init.list-workspaces`). No leaks. Inherits init handler classification. Routing/display logic stays in workflow.

### get-shit-done/workflows/new-workspace.md

- **Direct I/O ops enumerated:**
  1. `mkdir -p "$TARGET_PATH"` — workspace root creation (NOT `.planning/`).
  2. `git worktree add` / `git clone` per repo — git on user code, out of scope per Rule 6.
  3. `Write` of `$TARGET_PATH/WORKSPACE.md` — workspace manifest at workspace root, in scope (workspace meta).
  4. `mkdir -p "$TARGET_PATH/.planning"` — initialize the workspace's planning dir.
  5. `gsd-sdk query init.new-workspace` — SDK init bundle (parses args, detects child repos, etc.).
- **Adapter methods needed:**
  1. `createWorkspaceShell({path, repos, strategy, branch})` (B) — owns `WORKSPACE.md` write + `.planning/` initialization. (Git worktree creation stays in workflow as out-of-scope-per-rule-6 source-code I/O.)
  2. (Already covered) `createWorkstream(name)` is a sibling concept; **flag for synthesis**: workspace vs. workstream nomenclature collision.
  3. (Already covered by SDK init) `getNewWorkspaceContext()` for the init bundle.
- **Notes:** Most of this workflow operates on the user's code repos; only the WORKSPACE.md write and `.planning/` init are adapter concerns.

### get-shit-done/workflows/remove-workspace.md

- **Direct I/O ops enumerated:**
  1. `git worktree remove "$WORKSPACE_PATH/$REPO_NAME"` per repo — out of scope (git on user code).
  2. `rm -rf "$WORKSPACE_PATH"` — deletes workspace tree including `WORKSPACE.md` AND `.planning/` recursively.
  3. `gsd-sdk query init.remove-workspace "$WORKSPACE_NAME"` — SDK safety data.
- **Adapter methods needed:**
  1. `removeWorkspaceShell(name)` (B) — adapter-owned tear-down of `WORKSPACE.md` + the workspace's `.planning/` tree. Markdown adapter does `rm -rf` of the planning subtree; beads adapter prunes its store entries.
- **Notes:** The git worktree cleanup is correctly out-of-scope. The `rm -rf` of the whole workspace dir is a leak that crosses both `.planning/` and source-code territory; the adapter should own only the `.planning/` subtree deletion, with the workflow handling the surrounding directory removal.

### get-shit-done/workflows/cleanup.md

- **Direct I/O ops enumerated:**
  1. `cat .planning/MILESTONES.md` — read milestone version list. **Leak.**
  2. `ls -d .planning/milestones/v*-phases 2>/dev/null` — detect existing archive dirs. **Leak.**
  3. `cat .planning/milestones/v{X.Y}-ROADMAP.md` — read archived roadmap to determine phase membership. **Leak.**
  4. `ls -d .planning/phases/*/` — list current phase directories. **Leak.**
  5. `mkdir -p .planning/milestones/v{X.Y}-phases` then `mv .planning/phases/{dir} .planning/milestones/v{X.Y}-phases/` — bulk rename. **Leak.**
  6. `gsd-sdk query commit "..." .planning/milestones/ .planning/phases/` — final commit (not a leak; SDK commit handler).
- **Adapter methods needed:**
  1. `listMilestones()` (A) — replaces `cat MILESTONES.md` parse.
  2. `listMilestoneArchives()` (A) — replaces `ls .planning/milestones/v*-phases` filter.
  3. `getArchivedMilestoneRoadmap(version)` (A) — replaces archived ROADMAP read.
  4. `archivePhasesToMilestone({version, phases})` (B) — replaces the mkdir+mv loop; for beads adapter this becomes an issue-label/state mutation. Coordination logic.
- **Notes:** Heaviest direct-I/O leak in this batch. Five separate `.planning/`-touching ops, all bypassing the SDK. Critical for the fork.

### get-shit-done/workflows/inbox.md

- **Direct I/O ops enumerated:**
  1. `gh issue list` / `gh pr list` etc. — GitHub API, out of scope per Rule 6.
  2. `gh issue/pr edit/close` — GitHub API mutations, out of scope.
  3. `Write` of `.planning/INBOX-TRIAGE.md` (only if `.planning/` exists) — **Leak.**
- **Adapter methods needed:**
  1. `writeInboxTriageReport(content)` (A) — bare put for the report file. (Could also be modeled as a `record`-style append for beads, but the workflow always overwrites the full report.)
- **Notes:** 99% of this workflow is GitHub API consumption. Only one planning write. The adapter's role is minimal.

### get-shit-done/workflows/sync-skills.md

- **Direct I/O ops enumerated:** `mkdir -p`, `cp -r`, `rm -rf` operations under `~/.<runtime>/skills/` (e.g. `~/.claude/skills/`, `~/.codex/skills/`). **None target `.planning/`.**
- **Adapter methods needed:** None.
- **Notes:** Entirely runtime-install-dir manipulation; out of scope per Rule 6. The workflow is about distributing GSD skills across multiple AI runtimes after a `gsd-update` — orthogonal to project planning state. **Recommend explicitly excluding from the adapter interface.**

### commands/gsd/list-workspaces.md (skill)

Router — `<execution_context>@~/.claude/get-shit-done/workflows/list-workspaces.md</execution_context>` + tells Claude to execute the workflow. Inherits SDK-only classification.

### commands/gsd/new-workspace.md (skill)

Router → workflows/new-workspace.md. Inherits Mixed classification.

### commands/gsd/remove-workspace.md (skill)

Router → workflows/remove-workspace.md. Inherits Direct classification.

### commands/gsd/workstreams.md (skill)

Not a pure router — this skill contains its own subcommand-dispatch logic (`list`/`create`/`status`/`switch`/`progress`/`complete`/`resume`) and shells out to `gsd-sdk query workstream.<sub> ... --raw --cwd "$CWD"`. It does NOT reference an `<execution_context>` workflow. **However, all its operations are pure SDK calls** — every subcommand becomes a `gsd-sdk query workstream.X` invocation. So I/O surface = SDK-only, and it inherits the per-export classifications from workstream.js (rows 3–9).

## Cross-cutting observations from this batch

1. **Workspaces vs. workstreams collision.** Two distinct concepts share most of the verb space:
   - **Workspace** = a physical directory (`~/gsd-workspaces/<name>/`) containing git worktrees + an independent `.planning/`. NOT under `.planning/`.
   - **Workstream** = a logical scope INSIDE `.planning/workstreams/<name>/` for parallel milestone work.

   Both have list/create/status/complete operations. The convention sheet has neither noun. Recommend adding both to synthesis: `Workspace` (= shell directory, mostly out-of-scope filesystem) and `Workstream` (= planning subtree, fully adapter-owned).

2. **Dry-run is an adapter capability, not a workflow.** `pipeline.js` clones `.planning/` to a tmpdir for dry-runs. This assumes a markdown filesystem. The fork must hoist dry-run to the adapter interface — e.g., `adapter.snapshot()` / `adapter.restore(snapshotId)` or `adapter.beginTransaction()` / `adapter.rollback()` — so beads-adapter dry-runs work without filesystem cloning. Flag for synthesis.

3. **Config is .planning state.** `.planning/config.json` is touched by 4 mutation handlers and 2 query handlers. The convention sheet is missing a `Config` noun. Recommend adding: `getConfig(key)` (A), `updateConfig(key,value)` (B), `ensureConfigSection(name)` (A), `createInitialConfig(choices)` (B), `updateModelProfile(profile)` (B).

4. **Commit is split.** `commit.js` entangles "commit planning state" and "shell to git". The fork should keep these orthogonal: adapter persists state (markdown adapter writes files; beads adapter writes to bd) and a separate `gitBackend` decides whether to also git-commit. For beads, `commitPlanningState` becomes a no-op or batches a set of bd transitions. Flag for synthesis.

5. **Two workflow categories where Rule 6 applies cleanly:**
   - Pure runtime/install dir: `sync-skills.md`, `detect-custom-files.js` — out of scope.
   - User code repos (git, packages): `new-workspace.md` git ops, `remove-workspace.md` worktree ops, `commit.js execGit`, `docs-init.js` source scan — out of scope.

   Only the planning-state pieces (`WORKSPACE.md` write, `.planning/` init/teardown, `INBOX-TRIAGE.md` write) come into the adapter interface from these workflows. The leak here is small but real.

6. **`docs-init.js` is mostly out-of-scope** — it's a project-source scanner, not a `.planning/` reader. Only one `.planning/` existsSync. Don't promote to adapter; leave as a utility that calls `adapter.getConfig` and runs source-tree scans inline.

7. **Pure helpers / static data dominate the helpers and schema files.** ~50% of the SDK exports in this batch (helpers.js, registry.js, normalize-query-command.js, schema-detect.js, utils.js, config-schema.js, MODEL_PROFILES) are pure functions/constants with no I/O. They stay in shared SDK code, not the adapter interface.

8. **Naming clash flagged:** "complete" verb is overloaded — `workstream.complete` (archive), `phase.complete` (state transition), `milestone.complete` (archive). For convention-sheet alignment, prefer `archive` for terminal/move-to-historical operations and reserve `complete` for state-transitions on still-active records. Recommend `archiveWorkstream(name)`, `archiveMilestone(version)` to better fit the convention's `archive` verb. Flagged for synthesizer dedup.

9. **`commands/gsd/workstreams.md` is the only non-router skill in this batch.** It's a self-contained subcommand dispatcher. Treat as a degenerate workflow rather than a router — its classification matches the workstream.js exports it dispatches to.

## Bin-by-bin counts

- Bin A: 11 operations (workstreamGet, workstreamList, workstreamStatus, configEnsureSection, configGet, configPath, templateSelect, checkCommit, listMilestones, listMilestoneArchives, getArchivedMilestoneRoadmap, writeInboxTriageReport, plus the 2 workspace.js infra rows that don't yield adapter methods)
- Bin B: 14 operations (workstreamCreate, workstreamSet, workstreamComplete, workstreamProgress, configSet, configSetModelProfile, configNewProject, resolveModel, templateFill, commit, commitToSubrepo, archivePhasesToMilestone, createWorkspaceShell, removeWorkspaceShell)
- Bin C: 17 (pure helpers, registry infra, pipeline middleware, schema constants, runtime/install-dir scanners, docs-init out-of-scope, normalize-query-command)
- Bin D: 0 (no presentation-layer formatters in this batch — workspace skill renders tables but inline in the workflow)
- Direct I/O leaks found: 13 (5 in cleanup.md, 1 in inbox.md, 4 in new-workspace.md, 2 in remove-workspace.md, 1 in workspace.js' findProjectRoot bootstrap)
- Routers auto-classified: 3 (commands/gsd/list-workspaces.md, commands/gsd/new-workspace.md, commands/gsd/remove-workspace.md). One non-router skill (commands/gsd/workstreams.md) classified as SDK-only.
