# Phase 4: Plug workflow leaks (top-10 + `<context>`-block class) - Research

**Researched:** 2026-05-10
**Domain:** Workflow/template/SDK leak elimination, CI gate enforcement, SDK query expansion
**Confidence:** HIGH

## Summary

Phase 4 achieves a full zero-leak state across the entire codebase. The current `leak-grep` tool detects **233 total leaks** across all target zones: 69 in workflows, 5 in templates, 7 in references, 8 in agents, 12 in commands/skills, 102 in SDK production files, and 30 in SDK test files. The workflow leaks are concentrated in files that do direct Read/Write/Edit tool calls, shell cp/mv operations, and `<context>`-block `@.planning/` frontmatter references against `.planning/` paths.

The solution requires three parallel tracks: (1) rewrite workflow/agent/template leak sites to use `gsd-sdk query` calls, (2) migrate remaining SDK production files (`init.ts`, `init-complex.ts`, `config-mutation.ts`, `workstream.ts`, `validate.ts`, `state-mutation.ts` residuals, `commit.ts`, etc.) to route through the adapter, and (3) ship the pre-commit CI gate that enforces zero-tolerance. A significant number of new SDK query verbs are needed for domain-write operations (codebase docs, spikes/sketches, threads, seeds, forensics, debug archive, handoffs) that currently have no SDK surface.

**Primary recommendation:** Structure plans by zone (SDK residuals first, then workflow rewrites by category, then CI gate last) with SDK query creation embedded in the workflow rewrite plans that need them. SDK residuals must be fixed first because workflows depend on those queries existing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Rewrite to SDK queries):** Every workflow leak is fixed by replacing the direct `.planning/` tool call with a `gsd-sdk query` call. The adapter sits inside the SDK.
- **D-02 (Source files in this repo):** Workflow `.md` source files live in `./get-shit-done/workflows/` in this repo.
- **D-03 (Create new SDK queries as needed):** When a workflow needs data that no existing SDK query provides, Phase 4 creates the query.
- **D-04 (SDK handles atomicity internally):** Multi-file writes use `adapter.withTransaction()` inside SDK query verb implementations.
- **D-05 (Orchestrator injects via SDK queries):** `@.planning/...` references in templates replaced with orchestrator-injected content from SDK queries.
- **D-06 (Rewrite templates in Phase 4):** `phase-prompt.md`, `debug-subagent-prompt.md`, `planner-subagent-prompt.md`, `tdd.md`, `planner-antipatterns.md` rewritten.
- **D-07 (Pre-commit hook, zero-tolerance):** No baseline allowlist. Gate enables after all leaks are plugged.
- **D-08 (`verify.fat-skills`):** SDK query lists non-router skills with line-count + leak-count. Pre-commit hook warns.
- **D-09 (Broad definition):** ANY `.planning/` reference outside `adapters/markdown/` is a leak.
- **D-10 (Full zero-leak state):** ALL residuals fixed, not just workflows.

### Claude's Discretion
- Plan count and sequencing (likely 5-7 plans)
- Which new SDK queries to create vs composing existing ones
- Internal naming of new query verbs
- Whether deprecated functions are removed or left as dead code
- How test files route through the adapter test harness
- Ordering of workflow rewrites

### Deferred Ideas (OUT OF SCOPE)
- BeadsAdapter filesystem materialization decision (Phase 6)
- Foundational primitive lift (Phase 5)
- Test infrastructure for non-filesystem adapters (Phase 6/7)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LEAKS-01 | Top-10 leaking workflows refactored to use only adapter calls | Leak inventory below identifies 69 workflow leaks across 30 files; new SDK queries mapped per workflow |
| LEAKS-02 | `<context>`-block leak class mitigated | Context-block register identifies 5 REWRITE-CANDIDATE + 25 EXCEPTION entries; D-05/D-06 resolution strategy documented |
| LEAKS-03 | Two raw-git outliers refactored to `gsd-sdk query commit` | Confirmed at spec-phase.md:220-221 and eval-review.md:141-142 |
| LEAKS-04 | CI gate enforces leak-grep | Pre-commit hook infrastructure researched; no existing hooks; `scripts/build-hooks.js` pattern available |
| LEAKS-05 | `verify.fat-skills` SDK query shipped | Skills discovery via `agentSkills` query exists; new query needs skill-body scanning + leak counting |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Workflow leak rewriting | Workflow .md files | SDK query handlers | Workflows call SDK; SDK routes through adapter |
| New SDK query verbs | SDK (sdk/src/query/) | Adapter (Bin B methods) | SDK query handlers compose adapter primitives |
| Template context injection | Orchestrator code | SDK init bundlers | Orchestrator calls SDK, injects result into prompt |
| Pre-commit CI gate | Git hooks | Scripts (leak-grep.cjs) | Hook invokes leak-grep on staged files |
| verify.fat-skills | SDK query handler | Scripts (leak-grep.cjs) | New query handler reuses leak-grep scanner |
| Context-block mitigation | Templates/references | Orchestrator | Remove @.planning/ from templates; orchestrator injects |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >=22.0.0 | Runtime | Project requirement in package.json engines [VERIFIED: package.json] |
| TypeScript | (SDK) | SDK query handlers | All SDK code is TypeScript [VERIFIED: sdk/tsconfig.json exists] |
| leak-grep.cjs | local | Leak detection engine | Already built in Phase 1, extended in Phases 2/3 [VERIFIED: scripts/leak-grep.cjs] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | (existing) | Test runner | Conformance tests [VERIFIED: adapters/vitest.config.ts exists] |
| audit-context-blocks.cjs | local | Context-block register | Reference for REWRITE-CANDIDATE list [VERIFIED: scripts/audit-context-blocks.cjs] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pre-commit hook (git native) | husky | husky adds dependency; native hook is simpler for single-repo |
| Extending leak-grep.cjs | New scanner | leak-grep already has the patterns; extension is cheaper |

## Architecture Patterns

### System Architecture Diagram

```
Workflow .md file                    SDK query registry
  |                                      |
  | "gsd-sdk query <verb> <args>"        |
  +------------------------------------->|
                                         | dispatch to handler
                                         v
                                    Query handler (sdk/src/query/*.ts)
                                         |
                                         | adapter = await adapterFor(projectDir)
                                         v
                                    StorageAdapter interface
                                         |
                                         v
                                    MarkdownAdapter (adapters/markdown/)
                                         |
                                         | node:fs against .planning/
                                         v
                                    .planning/ filesystem
```

```
Pre-commit hook flow:
  git commit
    |
    v
  .git/hooks/pre-commit (or scripts/pre-commit.sh)
    |
    | git diff --cached --name-only
    v
  Filter staged files (*.md in get-shit-done/, *.ts in sdk/)
    |
    | node scripts/leak-grep.cjs <staged-files>
    v
  Exit 0 (clean) or Exit 1 (reject commit)
```

### Recommended Project Structure (new files Phase 4 creates)
```
sdk/src/query/
├── codebase-docs.ts        # putCodebaseDoc, getCodebaseDoc, listCodebaseDocs
├── named-docs.ts           # putNamedDoc, getNamedDoc (generic; forensics, reports, etc.)
├── debug-session.ts        # addDebugSession, archiveDebugSession, etc.
├── spike-sketch.ts         # spike/sketch MANIFEST, CONVENTIONS, scaffold ops
├── thread.ts               # addThread
├── seed.ts                 # addSeed (or compose into named-docs)
├── verify-fat-skills.ts    # verify.fat-skills query handler
├── ...existing files...
scripts/
├── leak-grep.cjs           # Extended with additional shell patterns
├── pre-commit-leak-gate.sh # Pre-commit hook script
```

### Pattern 1: Workflow Leak Rewrite (D-01 canonical pattern)

**What:** Replace direct `.planning/` tool calls with `gsd-sdk query` calls
**When to use:** Every workflow/agent/template leak site
**Example:**
```markdown
# BEFORE (leak):
Read `.planning/STATE.md`

# AFTER (clean):
gsd-sdk query state.load
```

```markdown
# BEFORE (leak):
Write `.planning/codebase/STACK.md`:
[content]

# AFTER (clean):
gsd-sdk query codebase.put "STACK" --body "[content]"
```

### Pattern 2: Template Context-Block Mitigation (D-05/D-06)

**What:** Remove `@.planning/` from templates; orchestrator injects content
**When to use:** Templates in `get-shit-done/templates/` and `get-shit-done/references/`
**Example:**
```markdown
# BEFORE (leak in template):
<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
</context>

# AFTER (orchestrator-injected):
<project_context>
{orchestrator injects result of: gsd-sdk query state.load + gsd-sdk query roadmap + gsd-sdk query init.phase-op}
</project_context>
```

### Pattern 3: SDK Production File Migration

**What:** Replace `node:fs` calls with adapter method calls
**When to use:** SDK .ts files that still use readFileSync/writeFileSync/etc.
**Example:**
```typescript
// BEFORE (leak):
import { readFileSync, existsSync } from 'node:fs';
const content = readFileSync(join(projectDir, '.planning', 'STATE.md'), 'utf-8');

// AFTER (clean):
const adapter = await adapterFor(projectDir);
const content = await adapter.getRecord('STATE.md');
```

### Pattern 4: Pre-commit Hook Gate (D-07)

**What:** Git hook that runs leak-grep on staged files and rejects if leaks found
**When to use:** Every commit (zero-tolerance)
**Example:**
```bash
#!/bin/sh
# scripts/pre-commit-leak-gate.sh
STAGED=$(git diff --cached --name-only --diff-filter=ACM)
SCAN_FILES=$(echo "$STAGED" | grep -E '\.(md|ts|js|cjs|mjs)$' | grep -v 'adapters/markdown/')
if [ -z "$SCAN_FILES" ]; then exit 0; fi
echo "$SCAN_FILES" | xargs node scripts/leak-grep.cjs
```

### Anti-Patterns to Avoid
- **Partial migration:** Leaving a mix of raw-fs and adapter calls in the same handler (confuses future maintainers)
- **Over-broad leak-grep patterns:** Matching `.planning/` in comments or documentation prose (causes false positives)
- **New query verbs that duplicate existing ones:** Check the manifest before creating a new verb (e.g., `init.map-codebase` already exists for reads)
- **Workflow-embedded adapter calls:** Workflows should NEVER import adapter directly; always go through `gsd-sdk query`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Leak detection | New regex scanner | Extend `scripts/leak-grep.cjs` | Already has 7 pattern categories, tested, reusable |
| Git hook wiring | Manual `.git/hooks/` setup | `scripts/pre-commit-leak-gate.sh` + install script | Portable, documented, follows `build-hooks.js` pattern |
| Context-block audit | Manual grep | `scripts/audit-context-blocks.cjs` | Already classifies into 3 buckets with JSON output |
| File path computation | Inline path joins in new queries | `planningPaths()` from `helpers.ts` | Centralized, workstream-aware path resolution |
| Adapter resolution | Direct import | `adapterFor(projectDir)` from `helpers.ts` | Handles config lookup, caching, factory |

**Key insight:** The existing SDK infrastructure (`helpers.ts`, `phase-helpers.ts`, adapter factory, command manifest) already has the patterns Phase 4 needs. New query verbs are thin handlers that compose adapter primitives using these established helpers.

## Current Leak Inventory (Verified 2026-05-10)

### By Zone (leak-grep detected)

| Zone | Files Scanned | Leaks Found | Top Contributors |
|------|--------------|-------------|-----------------|
| Workflows | 101 | 69 | map-codebase(7), execute-phase(7), quick(5), docs-update(4), import(4) |
| Templates | 45 | 5 | phase-prompt.md(5) — all context-block |
| References | 54 | 7 | planner-antipatterns(2), tdd(1), context-budget(2), scout-codebase(1), universal-anti-patterns(1) |
| Agents | 33 | 8 | gsd-debugger(3), gsd-planner(2), gsd-codebase-mapper(1), gsd-project-researcher(1), gsd-research-synthesizer(1) |
| Commands | 65 | 12 | graphify(4), add-tests(1), audit-milestone(1), debug(1), forensics(1), map-codebase(1), etc. |
| SDK production | 187 (filtered) | 102 | state-mutation(18), init(16), config-mutation(13), workstream(10), init-complex(10), validate(9) |
| SDK tests | (in SDK scan) | 30 | state-mutation.test(5), decisions.test(5), summary.test(6), init.test(2), etc. |
| **TOTAL** | **387** (workflow+template+ref+agent+cmd) + 187 (SDK) | **233** | |

[VERIFIED: node scripts/leak-grep.cjs run on 2026-05-10]

### Workflow Leaks — Full Manifest

| File | Leaks | Categories | SDK Query Needed |
|------|------:|-----------|-----------------|
| map-codebase.md | 7 | Write-tool | `codebase.put` (new) |
| execute-phase.md | 7 | cp-shell(5), mv-shell(1), Read-tool(1) | `snapshot/restore` (adapter has it), `debug.archive` (new) |
| quick.md | 5 | cp-shell(5) | `snapshot/restore` (adapter has it) |
| docs-update.md | 4 | Read-tool(4) | `tmp.get` / `tmp.put` (temp artifact, new) |
| import.md | 4 | Read-tool(4) | `state.load`, `roadmap`, `requirements.get` (exists via init) |
| spike.md | 3 | Read-tool(3) | `spike.get-conventions`, `spike.get-manifest` (new) |
| spike-wrap-up.md | 3 | Write-tool(2), Read-tool(1) | `spike.put-wrap-up`, `spike.put-conventions` (new) |
| session-report.md | 3 | Read-tool(2), Write-tool(1) | `state.load` (exists), `report.put` (new) |
| graduation.md | 3 | Read-tool(1), Write-tool(2) | `state.get-section` (exists), `state.update-section` (new) |
| undo.md | 2 | Read-tool(2) | `phase.get-manifest` (new), `roadmap` (exists) |
| sketch.md | 2 | Read-tool(2) | `sketch.get-manifest`, `sketch.get-conventions` (new) |
| sketch-wrap-up.md | 2 | Read-tool(1), Write-tool(1) | `sketch.put-wrap-up` (new) |
| pause-work.md | 2 | Write-tool(2) | `handoff.put`, `continue-here.put` (new) |
| help.md | 2 | Read-tool(2) | `state.load`, `init.*` (exists) |
| forensics.md | 2 | Read-tool(1), Write-tool(1) | `report.get`, `forensics.put` (new) |
| cleanup.md | 2 | Read-tool(1), mv-shell(1) | `milestone.archive-phases` (new) |
| verify-work.md | 1 | Write-tool | `uat.create` (adapter has method) |
| thread.md | 1 | Write-tool | `thread.add` (new) |
| settings.md | 1 | Write-tool | `config-set` (exists) |
| plant-seed.md | 1 | Write-tool | `seed.add` (new) |
| new-project.md | 1 | Read-tool | `codebase.get` (new) |
| milestone-summary.md | 1 | Write-tool | `report.put` (new) |
| ingest-docs.md | 1 | Read-tool | `ingest-conflicts.get` (new or compose) |
| inbox.md | 1 | Write-tool | `report.put` or adapter (new) |
| fast.md | 1 | append-shell | `state.record-quick-task` (exists as event) |
| discuss-phase.md | 1 | Read-tool | `decisions-index.get` or `init.plan-phase` (exists) |
| discovery-phase.md | 1 | Write-tool | `phase.scaffold` (exists) or `named-doc.put` |
| complete-milestone.md | 1 | mv-shell | `milestone.archive-phases` (new) |
| check-todos.md | 1 | mv-shell | `todo.complete` (exists but has raw-fs leak internally) |
| analyze-dependencies.md | 1 | Read-tool | `roadmap` (exists) |
| add-phase.md | 1 | Read-tool | `state.load` (exists) — likely redundant with init |
| add-todo.md | 1 | Write-tool | `todo.add` (new) |
| **TOTAL** | **69** | | |

[VERIFIED: node scripts/leak-grep.cjs get-shit-done/workflows/ on 2026-05-10]

### Template/Reference Context-Block Leaks

| File | Leaks | Specific Refs |
|------|------:|--------------|
| templates/phase-prompt.md | 5 (context-block) | @.planning/PROJECT.md (x4 in different examples), @.planning/phases/*/SUMMARY.md |
| references/planner-antipatterns.md | 2 (context-block) | @.planning/phases/*/SUMMARY.md, @.planning/PROJECT.md |
| references/tdd.md | 1 (context-block) | @.planning/PROJECT.md, @.planning/ROADMAP.md |
| references/context-budget.md | 2 (Read-tool) | `.planning/config.json` |
| references/scout-codebase.md | 1 (Read-tool) | `.planning/codebase/*.md` |
| references/universal-anti-patterns.md | 1 (Read-tool) | `.planning/config.json` |

**Resolution per D-05/D-06:** Templates get `<project_context>` blocks injected by orchestrator. References that are purely illustrative (showing examples of `@` syntax) may be classified as EXCEPTION if they don't cause runtime file loading.

### Context-Block Register (Phase 2 audit)

| Bucket | Count | Files |
|--------|------:|-------|
| REWRITE-CANDIDATE | 5 | commands/gsd/add-tests.md (2), agents/gsd-planner.md (3) |
| EXCEPTION | 25 | templates/*, references/* (illustrative, not runtime activation) |
| TOTAL | 30 | |

[VERIFIED: .planning/leaks/context-block-register.json dated 2026-05-06]

### SDK Production File Leaks (Phase 2/3 Residuals)

| File | Leaks | Uses Adapter? | Migration Status |
|------|------:|:---:|-----------------|
| state-mutation.ts | 18 | Yes (partial, 36 adapter refs) | Partially migrated Phase 3; deprecated helpers remain with raw fs |
| init.ts | 16 | No (0 adapter refs) | Unmigrated; all init bundlers still use raw existsSync/readFileSync |
| config-mutation.ts | 13 | No (0 adapter refs) | Unmigrated; config operations use raw fs |
| workstream.ts | 10 | No (0 adapter refs) | Unmigrated; workstream ops all raw fs |
| init-complex.ts | 10 | No (0 adapter refs) | Unmigrated; complex init bundlers raw fs |
| validate.ts | 9 | No (0 adapter refs) | Unmigrated; validation reads use raw fs |
| commit.ts | 4 | No | Reads config.json via raw fs (the git ops are its job) |
| phase-lifecycle.ts | 3 | Yes (uses adapter) | Partially migrated; residual fs imports |
| check-gates.ts | 3 | Yes | Partially migrated |
| template.ts | 2 | No | Raw readdir for template selection |
| requirements-extract-from-plans.ts | 2 | No | Raw readdir for plan scanning |
| profile.ts | 2 | No | Reads config; likely C2 (orthogonal) |
| phase-list-queries.ts | 2 | No | Phase listing via raw readdir |
| check-completion.ts | 2 | Yes | Partially migrated |
| bootstrap.ts | 2 | No | pathExists helper uses raw existsSync |
| roadmap.ts | 1 | Yes | Mostly migrated; 1 residual |
| roadmap-update-plan-progress.ts | 1 | Yes | Mostly migrated; 1 residual |
| pipeline.ts | 1 | No | Dry-run middleware (Phase 5 scope) |
| config-query.ts | 1 | No | Config read via raw fs |
| **TOTAL** | **102** | | |

[VERIFIED: node scripts/leak-grep.cjs sdk/src/query/ filtered to non-test files]

### SDK Test File Leaks

| File | Leaks | Nature |
|------|------:|--------|
| summary.test.ts | 6 | Fixture setup (mkdir, writeFile for test dirs) |
| decisions.test.ts | 5 | Fixture setup |
| state-mutation.test.ts | 5 | Fixture setup |
| commit.test.ts | 4 | Fixture setup |
| skills.test.ts | 3 | Fixture setup |
| init-complex.test.ts | 2 | Fixture setup + cleanup |
| init.test.ts | 2 | Fixture setup |
| decomposed-handlers.test.ts | 1 | Fixture setup |
| phase.test.ts | 1 | Fixture setup |
| sub-repos-root.integration.test.ts | 1 | Fixture setup |
| **TOTAL** | **30** | All fixture setup — need adapter test harness |

### Raw-Git Outliers (OQ-03)

| File | Lines | Current Code | Fix |
|------|-------|-------------|-----|
| workflows/spec-phase.md | 220-221 | `git add "${phase_dir}/${padded_phase}-SPEC.md"` + `git commit -m "spec(...)"` | Replace with `gsd-sdk query commit "spec(...)" --files ...` |
| workflows/eval-review.md | 141-142 | `git add "${EVAL_REVIEW_FILE}"` + `git commit -m "docs(...)"` | Replace with `gsd-sdk query commit "docs(...)" --files ...` |

[VERIFIED: grep confirms exact lines in both files]

## New SDK Queries Needed

Based on the leak inventory, these new SDK query verbs are required to replace direct `.planning/` operations:

### High-Priority (cover multiple workflow leaks)

| Query Verb | Covers | Operations |
|-----------|--------|-----------|
| `codebase.put` | map-codebase(7), gsd-codebase-mapper(1) | Write codebase doc by name (STACK, ARCHITECTURE, etc.) |
| `codebase.get` | new-project(1), scout-codebase(1) | Read codebase doc by name |
| `report.put` | session-report(1), milestone-summary(1), forensics(1), inbox(1) | Write report to .planning/reports/ |
| `report.get` | forensics(1) | Read report (SESSION_REPORT) |
| `debug.archive` | execute-phase(1), gsd-debugger(3) | mv debug session to resolved/ |
| `tmp.put` / `tmp.get` | docs-update(4) | Read/write temp verification artifacts |
| `handoff.put` / `continue-here.put` | pause-work(2) | Write structured handoff/continue docs |

### Medium-Priority (cover 2-3 leaks each)

| Query Verb | Covers | Operations |
|-----------|--------|-----------|
| `spike.get-manifest` / `spike.get-conventions` | spike(3), spike-wrap-up(1) | Read spike MANIFEST/CONVENTIONS |
| `spike.put-wrap-up` / `spike.put-conventions` | spike-wrap-up(2) | Write spike WRAP-UP-SUMMARY, CONVENTIONS |
| `sketch.get-manifest` / `sketch.get-conventions` | sketch(2) | Read sketch MANIFEST/CONVENTIONS |
| `sketch.put-wrap-up` | sketch-wrap-up(1) | Write sketch WRAP-UP-SUMMARY |
| `todo.add` | add-todo(1) | Write new todo file |
| `thread.add` | thread(1) | Write thread doc |
| `seed.add` | plant-seed(1) | Write seed doc |
| `milestone.archive-phases` | cleanup(1), complete-milestone(1) | mv phases to milestones/ dir |
| `phase.get-manifest` | undo(1) | Read .phase-manifest.json |
| `decisions-index.get` | discuss-phase(1) | Read DECISIONS-INDEX.md |

### Low-Priority (single leak or compose from existing)

| Query Verb | Covers | Notes |
|-----------|--------|-------|
| `graphify.store` | graphify(3 cp commands) | Copy graph artifacts to .planning/graphs/ |
| `ingest-conflicts.get` | ingest-docs(1) | May compose from getRecord |
| `graduation.update` | graduation(3) | STATE section manipulation — may use state.update-section |

### Already Exists (no creation needed)

These SDK queries already handle the operations some workflows need:
- `state.load` / `state.json` / `state.get` — STATE reads
- `roadmap` / `roadmap.analyze` / `roadmap.get-phase` — ROADMAP reads
- `config-get` — config reads
- `commit` — git commit (already SDK-mediated)
- `init.*` bundlers — workflow context loading
- `todo.complete` — todo completion (but has internal raw-fs leak to fix)
- `phase.scaffold` — phase directory creation
- `state.record-session` / `state.add-decision` etc. — state mutations

## Pre-Commit Hook Infrastructure

### Current State
- **No pre-commit hook exists** (verified: no `.git/hooks/pre-commit`, no `.husky/pre-commit`) [VERIFIED]
- **No husky dependency** in package.json [VERIFIED]
- **`scripts/build-hooks.js` exists** — copies JS hooks to `hooks/dist/` for Claude Code integration (PostToolUse hooks, not git hooks) [VERIFIED]
- **Community hooks exist** (`gsd-validate-commit.sh`, `gsd-phase-boundary.sh`) — bash scripts for Claude Code hook system, not git hooks [VERIFIED]

### Recommended Implementation
- **Simple shell script** at `scripts/pre-commit-leak-gate.sh`
- **Install via** package.json `prepare` script or manual symlink (no husky dependency)
- **Logic:** Filter staged files by scannable extensions, exclude `adapters/markdown/`, run `node scripts/leak-grep.cjs`
- **verify.fat-skills** integration: run after leak-grep, warn (not block) on threshold violations

### leak-grep Extension Needed

The current `leak-grep.cjs` catches Tool patterns (Read/Write/Edit), Shell patterns (cp/mv/rm/>>) and context-block patterns. For zero-tolerance per D-09, it needs additional patterns:

| Pattern | Current Status | Action |
|---------|---------------|--------|
| Read/Write/Edit tool | Caught | Keep |
| cp/mv/rm/>> shell | Caught | Keep |
| `<context>`-block @.planning/ | Caught | Keep |
| SDK fs-read/write (*.ts only) | Caught (Stage-2 scope filter) | Keep |
| mkdir .planning/ | NOT caught | Add |
| ls .planning/ | Debatable | Add for workflows/agents only (not templates) |
| git add/commit .planning/ | NOT caught | Add (except inside gsd-sdk query commit calls) |
| find .planning/ | NOT caught | Add for workflows/agents only |
| cat .planning/ | NOT caught | Add |

**Note on false positives:** Many `.planning/` references in workflow prose are informational (describing what SDK queries return, documenting paths). The leak-grep extension must be pattern-specific (shell command followed by .planning/ path) not a blanket `.planning/` string match. The existing heuristic approach (tool keyword + path within 200 chars) is the right pattern.

## Common Pitfalls

### Pitfall 1: False Positives from Documentation Prose
**What goes wrong:** leak-grep flags `.planning/` references in markdown comments, explanatory text, or gsd-sdk query commit --files arguments
**Why it happens:** Over-broad regex matches any `.planning/` occurrence
**How to avoid:** Keep pattern-specific detection (tool/shell keyword + path). Ensure `gsd-sdk query commit --files .planning/...` is NOT flagged (the SDK mediates this)
**Warning signs:** Leak-grep count inflates dramatically when adding `mkdir`/`ls` patterns without scope filtering

### Pitfall 2: SDK Query Creation Without Adapter Routing
**What goes wrong:** New SDK query handlers use raw `node:fs` instead of adapter
**Why it happens:** Copy-pasting from unmigrated handlers (init.ts, workstream.ts still raw)
**How to avoid:** All new query handlers MUST use `adapterFor(projectDir)` pattern from `helpers.ts`. Use `phase-helpers.ts` for read-modify-write patterns
**Warning signs:** leak-grep detects new leaks in recently-created files

### Pitfall 3: Template Rewrite Breaking Runtime Behavior
**What goes wrong:** Removing `@.planning/...` from templates without ensuring orchestrator injects equivalent data
**Why it happens:** `@` syntax auto-loads files at Claude Code activation time. Removing without replacement means subagent loses context
**How to avoid:** Every removed `@.planning/` reference must have a corresponding orchestrator injection point. Test by running workflow end-to-end
**Warning signs:** Workflows that previously worked start failing with "file not found" or missing context

### Pitfall 4: Breaking State-Mutation Deprecated Helpers
**What goes wrong:** Removing deprecated `readModifyWriteStateMd` breaks external callers
**Why it happens:** Phase 3 marked helpers as `@deprecated` with "will be removed in Phase 4" but external consumers may still reference them
**How to avoid:** Check import references across the codebase before removal. If external callers exist, keep with deprecation warning for one more phase
**Warning signs:** Build failures in files not under Phase 4's direct modification

### Pitfall 5: Pre-commit Hook That Blocks Normal Development
**What goes wrong:** Hook prevents legitimate commits during development iteration
**Why it happens:** Gate activated before ALL leaks are plugged (violates D-07 "enables after all leaks are plugged")
**How to avoid:** Hook is the LAST task. Enable only after verification that leak-grep returns 0 across the full codebase
**Warning signs:** Developer frustration; hook disabled manually

### Pitfall 6: Test File Migration Without Adapter Harness
**What goes wrong:** Test files rewritten to use adapter but no test adapter factory exists
**Why it happens:** Tests create tmpdir fixtures with raw fs. Replacing with adapter calls requires a test adapter instance
**How to avoid:** Reuse conformance test harness from Phase 1/3 (`tests/conformance/adapter.conformance.ts`). Create test utility that provides a MarkdownAdapter pointed at a tmpdir
**Warning signs:** Tests require complex setup just to create fixture files

## Code Examples

### New SDK Query Handler (follows established pattern)

```typescript
// Source: established pattern from sdk/src/query/phase-helpers.ts
import { adapterFor, planningPaths } from './helpers.js';
import type { QueryHandler } from './types.js';

export const codebasePut: QueryHandler = async (args, projectDir) => {
  const [name] = args;
  if (!name) throw new GSDError('name required', ErrorClassification.Validation);

  const adapter = await adapterFor(projectDir);
  const body = args.slice(1).join(' '); // or parse --body flag

  await adapter.putRecord(`codebase/${name}.md`, body);
  return { data: { written: `codebase/${name}.md` } };
};
```

### Workflow Rewrite Example (map-codebase.md)

```markdown
# BEFORE:
- Write `.planning/codebase/STACK.md` -- Languages, runtime, frameworks...

# AFTER:
gsd-sdk query codebase.put "STACK" --stdin <<'BODY'
# Stack
[content generated by agent]
BODY
```

### Pre-commit Hook Script

```bash
#!/bin/sh
# scripts/pre-commit-leak-gate.sh
set -e

STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(md|ts|js|cjs|mjs)$' || true)
if [ -z "$STAGED" ]; then exit 0; fi

# Exclude adapter implementation (the ONE place allowed to touch .planning/)
SCAN=$(echo "$STAGED" | grep -v '^adapters/markdown/' || true)
if [ -z "$SCAN" ]; then exit 0; fi

# Run leak-grep
echo "$SCAN" | xargs node scripts/leak-grep.cjs
EXIT=$?

if [ $EXIT -ne 0 ]; then
  echo ""
  echo "BLOCKED: Direct .planning/ references detected in staged files."
  echo "Route all storage through gsd-sdk query calls."
  exit 1
fi

# Optional: verify.fat-skills warning (non-blocking)
node -e "require('./sdk/dist/query/index.js')" 2>/dev/null && \
  gsd-sdk query verify.fat-skills 2>/dev/null || true
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct Read/Write against .planning/ | gsd-sdk query calls | Phase 4 (this phase) | Workflows become adapter-agnostic |
| @.planning/ in templates | Orchestrator-injected `<project_context>` | Phase 4 (this phase) | Templates work without filesystem |
| No CI enforcement | Pre-commit hook leak-grep | Phase 4 (this phase) | Zero-regression guarantee |
| ad-hoc state mutation | recordStateEvent discriminated union | Phase 3 (shipped) | Clean event semantics |

**Deprecated/outdated:**
- `readModifyWriteStateMd` (state-mutation.ts): replaced by `readModifyWriteState` from phase-helpers.ts — can be removed in Phase 4
- Raw fs imports in init.ts, init-complex.ts, config-mutation.ts, workstream.ts, validate.ts: should route through adapter

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | gsd-sdk query commit --files .planning/... is NOT a leak (SDK mediates) | Leak inventory | If it IS a leak, 42 additional refs in workflows need rewriting |
| A2 | Test fixture setup with raw fs can use adapter test harness from Phase 1 conformance | Test leaks | If harness insufficient, need new test utilities |
| A3 | Template EXCEPTION entries (25 illustrative context-blocks) don't need rewriting | Context-block | If D-09 is truly "ANY reference", 25 more rewrites needed in templates |
| A4 | config-mutation.ts and commit.ts config reads are legitimate (config lives in .planning/) | SDK residuals | These files may need different treatment since config IS a .planning/ file |
| A5 | pipeline.ts (1 leak) is Phase 5 scope (dry-run hoist) not Phase 4 | SDK residuals | If Phase 4 must fix it, adds complexity |

## Open Questions

1. **Scope of "informational" .planning/ references in workflow prose**
   - What we know: D-09 says "ANY reference outside adapter" is a leak. But workflows must describe what SDK queries DO (e.g., "this returns data from STATE.md")
   - What's unclear: Are path references in markdown comments/descriptions leaks? (e.g., "Output: .planning/codebase/ folder")
   - Recommendation: These are NOT leaks if they describe what the SDK produces internally. Only tool-call instructions (Read/Write/Edit/shell commands) and runtime file-loading references (@) are actionable leaks. The leak-grep tool already implements this distinction via pattern-specific matching.

2. **SDK test file treatment**
   - What we know: 30 test file leaks are all fixture setup (mkdir + writeFile to create test data)
   - What's unclear: Should tests create fixtures via adapter, or is raw fs acceptable for test setup?
   - Recommendation: Create a test utility (`createTestAdapter(tmpDir)`) that returns a MarkdownAdapter pointed at a temp directory. Tests call adapter methods for fixture creation. This validates the adapter AND eliminates leaks.

3. **init.ts / init-complex.ts scope**
   - What we know: These have 26 combined leaks and 0 adapter usage. They were out of scope in Phase 2/3.
   - What's unclear: Are they "SDK residuals" (D-10 scope) or "init bundler refinement" (different scope)?
   - Recommendation: They ARE D-10 scope. Phase 4 migrates them to adapter. The init bundlers in Phase 2 Plan 02-04 covered the bundler SHAPE (byte-identical output), but the internal implementation still uses raw fs.

4. **config-mutation.ts treatment**
   - What we know: 13 leaks, reads/writes .planning/config.json via raw fs.
   - What's unclear: Config operations are the adapter's job (config lives in .planning/). But config-mutation creates .planning/ itself on first run.
   - Recommendation: Migrate reads to `adapter.getRecord('config.json')`. The `config-new-project` handler that creates .planning/ may need special treatment (it bootstraps the adapter's storage directory).

5. **workstream.ts and validate.ts adapter migration complexity**
   - What we know: workstream.ts (10 leaks) manages workstream subdirectories. validate.ts (9 leaks) does cross-file consistency checks.
   - What's unclear: These do complex multi-file operations. Is adapter.listCollection sufficient?
   - Recommendation: Yes. Both use patterns already proven in Phase 2/3 (listCollection + getRecord compose into directory scanning). Follow the phase-helpers.ts patterns.

## Recommended Plan Structure

Based on the leak inventory, complexity analysis, and dependency ordering:

### Wave 1: Foundation + SDK Residuals (must ship first; workflows depend on these)

**Plan 1: leak-grep extension + new SDK query scaffold**
- Extend leak-grep.cjs with mkdir/ls/find/cat/git-add patterns (scoped to avoid false positives)
- Scaffold new query handler files (codebase-docs.ts, named-docs.ts, etc.)
- Register new query verbs in command manifest + index.ts
- Estimated: ~15 tasks

**Plan 2: SDK production file migration (high-leak files)**
- Migrate init.ts (16 leaks) and init-complex.ts (10 leaks) to adapter
- Migrate config-mutation.ts (13 leaks) to adapter
- Migrate workstream.ts (10 leaks) to adapter
- Migrate validate.ts (9 leaks) to adapter
- Clean state-mutation.ts residuals (18 leaks, partially migrated)
- Fix remaining small files (commit.ts, template.ts, etc.)
- Estimated: ~25 tasks

### Wave 2: Workflow Rewrites (depends on SDK queries existing)

**Plan 3: Heavy-leaker workflow rewrites (map-codebase, execute-phase, quick)**
- map-codebase.md: 7 leaks -> codebase.put calls
- execute-phase.md: 7 leaks -> snapshot/restore + debug.archive
- quick.md: 5 leaks -> snapshot/restore
- docs-update.md: 4 leaks -> tmp.get/tmp.put
- import.md: 4 leaks -> existing SDK reads
- Estimated: ~15 tasks

**Plan 4: Remaining workflow + agent rewrites**
- All remaining 37 workflow leaks across 26 files
- Agent leaks: gsd-debugger(3), gsd-planner(1 Read), gsd-codebase-mapper(1), gsd-project-researcher(1), gsd-research-synthesizer(1)
- Command/skill leaks: graphify(4), add-tests context-block
- Raw-git outliers: spec-phase.md, eval-review.md (OQ-03)
- Estimated: ~20 tasks

### Wave 3: Templates + Context-Block + Tests

**Plan 5: Template/reference rewrites + context-block mitigation (LEAKS-02)**
- Rewrite phase-prompt.md (remove 5 context-block @.planning/ refs)
- Rewrite planner-subagent-prompt.md (10 @.planning/ refs)
- Rewrite debug-subagent-prompt.md (1 @.planning/ ref)
- Rewrite tdd.md, planner-antipatterns.md
- Rewrite context-budget.md, scout-codebase.md, universal-anti-patterns.md (Read-tool refs)
- Mitigate 5 REWRITE-CANDIDATE context-block entries (add-tests.md, gsd-planner.md)
- Estimated: ~12 tasks

**Plan 6: SDK test migration + verify.fat-skills**
- Migrate 30 test file leaks to use adapter test harness
- Implement verify.fat-skills SDK query handler
- Estimated: ~12 tasks

### Wave 4: CI Gate (LAST, after zero-leak verified)

**Plan 7: Pre-commit hook + final verification**
- Create pre-commit-leak-gate.sh
- Wire into git hooks (install script or prepare)
- Integrate verify.fat-skills warning
- Run full-codebase leak-grep to verify zero
- Enable hook
- Estimated: ~8 tasks

**Total estimated:** ~107 tasks across 7 plans (large phase commensurate with 233 leaks)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime, leak-grep | Yes | >=22.0.0 (per engines) | -- |
| Git | Pre-commit hook | Yes | (system) | -- |
| TypeScript | SDK query compilation | Yes | (via sdk build) | -- |
| vitest | Test execution | Yes | (existing config) | -- |

**Missing dependencies with no fallback:** None
**Missing dependencies with fallback:** None

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A (adapter controls file access) |
| V5 Input Validation | Yes (query args) | TypeScript types + GSDError validation |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious .planning/ path in query args (path traversal) | Tampering | planningPaths() helper validates relative paths |
| Pre-commit hook bypass (--no-verify) | Elevation of Privilege | Document; CI also runs leak-grep in separate check |
| Workflow prompt injection via .planning/ content | Information Disclosure | Adapter sanitizes on read (existing pattern) |

## Sources

### Primary (HIGH confidence)
- `scripts/leak-grep.cjs` — source code reviewed, executed against codebase
- `sdk/src/query/index.ts` — all 180 registered query verbs enumerated
- `.planning/leaks/context-block-register.json` — Phase 2 audit output
- `.planning/phases/04-*/04-CONTEXT.md` — locked decisions
- `adapters/types.ts` — current StorageAdapter interface
- `sdk/src/query/helpers.ts` — adapterFor() pattern
- `sdk/src/query/phase-helpers.ts` — readModifyWriteState pattern

### Secondary (MEDIUM confidence)
- Workflow file grep counts (verified via multiple grep runs)
- SDK file adapter usage counts (verified via grep)

### Tertiary (LOW confidence)
- Task count estimates (will be refined during planning)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all tools already exist in repo, verified
- Architecture: HIGH - patterns established in Phases 1-3, verified in code
- Pitfalls: HIGH - derived from actual Phase 2/3 migration experience
- Leak inventory: HIGH - tool-verified counts with exact file:line output
- New SDK queries: MEDIUM - query naming and grouping is Claude's discretion per CONTEXT.md

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (stable — codebase is under our control; upstream rebases may shift counts slightly)
