---
purpose: Classification rubric for fork-investigation batch agents
date: 2026-04-30
input_to: BATCH-01.md ... BATCH-10.md
synthesized_by: SYNTHESIS.md
---

# Fork-Investigation Classification Rubric

Read this top-to-bottom before classifying. Refined from PILOT.md findings (2026-04-30).

## Context

The project is forking upstream `get-shit-done-cc` (GSD) to add a pluggable
**StorageAdapter** interface. The default adapter wraps current markdown
behavior (zero behavior change). A second adapter (gsd-beads) implements
the same interface against the `bd` issue tracker.

Your job: classify every artifact in your batch so we can synthesize the
adapter interface.

The TRIGGER for forking was that `/gsd-progress` reads `.planning/STATE.md`
etc. directly via the Read tool — bypassing the SDK entirely. The shadow
architecture cannot intercept this. **The fork must surface every such
direct-I/O operation as a hookable adapter call.**

The pilot found this leak pattern is BROADER than `/gsd-progress` —
even nominally SDK-only workflows have hidden `Read .planning/STATE.md`
operations. Find them all.

## Two classification dimensions

### Dimension 1 — I/O surface (for SKILLS, AGENTS, WORKFLOWS)

| Value | Meaning |
|-------|---------|
| `SDK-only` | All state reads/writes go through `gsd-sdk query <name>` calls |
| `Direct` | Reads/writes files via Read/Write/Bash/Edit tools — **the un-hookable case; this is what motivates the fork** |
| `Mixed` | Both |
| `Router` | Skill is a thin `<execution_context>@workflow.md</execution_context>` reference; inherits its workflow's classification |
| `n/a` | SDK queries themselves (this is the I/O implementation, not a consumer) |

### Dimension 2 — Bin (for SDK QUERIES + every direct-I/O operation surfaced from skills/workflows/agents)

| Bin | Meaning |
|-----|---------|
| **A** (bare IO) | Operation's semantics ARE the I/O. No coordination logic between I/O and result. Maps cleanly to `getRecord(path)`/`putRecord(path, body)`/`listCollection(filter)` over a generic adapter. Pure pass-through. |
| **B** (named adapter method) | Operation requires coordination across multiple I/Os, OR has domain logic (slug generation, phase number computation, derivation, cascade, timestamp injection) between I/O and result. Adapter authors implement this as a specific named method like `addPhase` or `closePhaseAndCascade`. |
| **C** (eliminate) | Operation is obsolete in the new architecture. Examples: regen-helpers that become moot when the adapter writes canonical markdown directly; queries that exist only to work around the lack of an adapter interface. Justify why. |
| **D** (presentation/out-of-scope) | Pure formatters that consume adapter data for display (e.g., `progressBar`/`progressTable`). NOT adapter methods — they live in business-logic / view layer. Note adapter data they consume. |

## Classification rules (REFINED FROM PILOT)

### Rule 1 — Read the actual implementation, not just the signature

Function signatures and skill descriptions are insufficient. Open the file with the Read tool.

For workflows and agents, **read the body line-by-line.** That's where the leaks hide.

### Rule 2 — Operation-level, not file-level (for SDK queries)

A single SDK file (e.g., `progress.js`) can contain BOTH Bin A operations
(`progressJson`, `listTodos`) AND Bin B operations (`statsJson`, `todoComplete`).
**Classify per export, one row per export.** Group the rows under the
filename header.

### Rule 3 — The "leak grep" rule (MANDATORY for workflows/agents)

For every workflow and agent, explicitly grep / scan for:
- `Read .planning/`
- `Write .planning/`
- `Edit .planning/`
- `ls .planning/`
- `grep ... .planning/`
- `bash` commands touching `.planning/*`
- "Read STATE.md", "Read ROADMAP.md", "Update STATE.md", etc. in workflow prose

**Every hit is a direct-I/O operation that must become an adapter method.**
Enumerate each one; don't summarize. The pilot found 7 in `progress.md`,
1 hidden in `add-phase.md`, 3 in `gsd-roadmapper.md`. Hidden leaks are
common — look for them.

### Rule 4 — Skills are usually thin routers (auto-classify)

If the skill body is essentially:
```
<execution_context>@$HOME/.claude/get-shit-done/workflows/X.md</execution_context>

Follow workflow at @$HOME/.claude/get-shit-done/workflows/X.md
```
…then mark as `Router` and inherit its workflow's classification. Don't
reanalyze the skill's I/O — there isn't any. One-line entry per router skill.

### Rule 5 — Bin B trigger: domain logic between I/O and result

If the operation injects derived data (timestamps, computed slugs, phase
numbers, IDs from external systems) between read and write — it's Bin B.

If the operation joins multiple sources to compute a derived view — it's Bin B.

If the operation cascades through related records (e.g., closing a phase
also closes its child plans) — it's Bin B.

If the operation just shovels bytes from one place to another — Bin A.

### Rule 6 — Non-`.planning/` shell-outs are NOT adapter concerns

`git status` of source code, file existence checks for non-planning paths,
network calls, etc. are orthogonal to the adapter interface. Note them as
"out of scope" if they appear, but don't propose adapter methods for them.

The adapter interface is for **planning state** (`.planning/*`, the bd store
when bd-managed). Code repo state and external systems stay external.

## Convention sheet (USE EXACT VERBS AND NOUNS)

To keep 10 agents producing consistent method names, follow this convention.

### Verbs (pick one — most specific to the operation)

| Verb | When |
|------|------|
| `list` | Return many records, optionally filtered |
| `count` | Return a number; faster path than `list().length` |
| `get` | Return one record by ID/key |
| `find` | Search by criteria; may return null/empty |
| `add` | Create a new record (system assigns ID) |
| `create` | Initialize a structured composite (e.g., `createRoadmap` builds a multi-section structure) |
| `update` | Modify existing record |
| `record` | Append a domain event (`recordStateEvent`, `recordDecision`) |
| `complete` | State transition to "done" |
| `remove` | Delete a record |
| `archive` | Move to historical/archived state |

### Domain nouns (use these exact spellings)

| Noun | Refers to |
|------|-----------|
| `Phase` | A milestone phase (`gsd:phase`) |
| `Plan` | A plan inside a phase (`gsd:plan`) |
| `Summary` | A `*-SUMMARY.md` artifact |
| `Uat` | UAT artifact (status: diagnosed/partial/etc.) |
| `Todo` | Pending or completed todo |
| `Memory` | A memory entry |
| `Handoff` | A handoff artifact (`HANDOFF.json`, `.continue-here.md`) |
| `StateEvent` | A typed entry appended to STATE.md (e.g., "roadmap_evolution") |
| `Roadmap` | The full ROADMAP.md document |
| `Requirement` | A requirement (`gsd:requirement`) |
| `Milestone` | A milestone (`v0.X` collection) |
| `Decision` | An ADR-style decision |
| `Blocker` | A current blocker |
| `DebugSession` | A debug session artifact |

### Examples (modeled from pilot)

```
adapter.listPhaseProgress() -> PhaseProgress[]      // verb=list, noun=PhaseProgress
adapter.countPhaseArtifacts(phase) -> Counts        // verb=count, noun=PhaseArtifacts
adapter.addPhase(description) -> { ... }             // verb=add, noun=Phase
adapter.recordStateEvent({ type, text }) -> void     // verb=record, noun=StateEvent
adapter.findDeferredScopeRefs() -> DeferredRef[]     // verb=find, noun=DeferredScopeRefs
adapter.completeTodo(id) -> void                     // verb=complete, noun=Todo
adapter.createRoadmap({ phases }) -> void            // verb=create, noun=Roadmap
```

## Output format (per batch)

Each batch agent writes ONE file: `.planning/research/fork-investigation/BATCH-NN.md`.

Required structure:

```markdown
# Batch NN — <theme name>

Date: 2026-04-30
Artifacts assigned: <count>
Output by: <agent invocation>

## Classification table

| # | Path | Kind | I/O surface | Bin | Use case (≤15 words) | Direct I/O ops | Adapter methods proposed (with Bin) | Notes |
|---|------|------|-------------|-----|----------------------|----------------|-------------------------------------|-------|
| 1 | sdk/dist/query/progress.js::progressJson | sdk-query-export | n/a | A | List per-phase plan/summary counts + status | n/a | listPhaseProgress() (A) | |
| 2 | get-shit-done/workflows/progress.md | workflow | Mixed | n/a (consumer) | Status report + smart route | (7 ops enumerated below) | (7 methods proposed below) | |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

## Per-artifact detail

### sdk/dist/query/progress.js (multiple exports — table above is per-export)

(prose if anything notable about the file as a whole)

### get-shit-done/workflows/progress.md

- **Direct I/O ops enumerated:**
  1. `ls .planning/phases/<dir>/*-PLAN.md` — counts plans per phase
  2. `grep -l "status: diagnosed\|status: partial" .planning/phases/<dir>/*-UAT.md` — UAT gap detection
  3. (etc., every leak)
- **Adapter methods needed:**
  1. `listPhaseProgress()` (A) — replaces direct ls scan
  2. `listUat(phase, status)` (A) — replaces grep filtering
  3. (etc.)
- **Notes:** Routing logic (A/B/C/D/E branches) stays in workflow; adapter only provides data.

(repeat per artifact in batch)

## Cross-cutting observations from this batch

- Patterns noticed
- Hard-to-classify edges
- Naming clashes with the convention sheet (if any)
- Adapter methods this batch proposed that overlap with other batches (flag for synthesis dedup)

## Bin-by-bin counts

- Bin A: <n> operations
- Bin B: <n> operations
- Bin C: <n> operations
- Bin D: <n> operations
- Direct I/O leaks found: <n>
- Routers auto-classified: <n>
```

## Limits & anti-patterns

- **DO NOT** propose adapter methods for non-`.planning/` operations (git status of source code, external API calls, etc.)
- **DO NOT** classify a workflow as `SDK-only` without grep'ing for direct I/O. Do the grep. Read the body.
- **DO NOT** invent verbs/nouns outside the convention sheet without flagging in cross-cutting observations
- **DO NOT** classify SDK files at the file level. One row per export.
- **STAY UNDER 4000 words per BATCH-NN.md.** Brevity. The synthesizer will merge tables and read selectively.
- **Be honest.** If something is genuinely unclear or doesn't fit the rubric, flag it in cross-cutting observations. The synthesis pass will resolve.

## Reading order for batch agents

1. Read this RUBRIC.md fully
2. Read PILOT.md (for an example of expected output quality and a calibration point)
3. Open each artifact in your batch with the Read tool
4. Apply the rubric per artifact
5. Write your BATCH-NN.md
6. Return a brief summary
