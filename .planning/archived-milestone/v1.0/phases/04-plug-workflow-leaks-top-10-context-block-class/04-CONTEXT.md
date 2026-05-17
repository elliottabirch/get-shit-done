# Phase 4: Plug workflow leaks (top-10 + `<context>`-block class) — Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 achieves a **full zero-leak state** across the entire codebase. Every
reference to `.planning/` outside of `adapters/markdown/` is eliminated —
workflows, templates, SDK residuals, and tests all route through the adapter
or SDK queries.

Phase 4 owns:
- Rewriting all ~90 leak sites across the 10 heaviest-leaking workflow `.md`
  files to use `gsd-sdk query` calls instead of Read/Write/Edit/cp/mv
- Creating new SDK query verbs as needed to cover operations workflows require
- Rewriting `<context>`-block `@.planning/...` references in templates to use
  orchestrator-injected SDK query output (deterministic, adapter-mediated)
- Fixing the 2 raw-git outliers (OQ-03): `spec-phase.md` Step 7 and
  `eval-review.md` end → `gsd-sdk query commit`
- Shipping the pre-commit hook CI gate (zero-tolerance, no baseline)
- Shipping `verify.fat-skills` SDK query + pre-commit warning integration
- Eliminating ALL remaining `.planning/` references in SDK `.ts` files
  outside `adapters/markdown/` (residuals from Phases 2/3)
- Eliminating `.planning/` references in test files (route through adapter
  test harness)

Phase 4 **does not**:
- Modify CJS files — permanent D-02 (Phase 1)
- Implement foundational primitives (`getSection`/`updateSection` semantic
  modes, `snapshot/restore`, `putNamedDoc`, `writeBinaryAsset`) — Phase 5
- Implement BeadsAdapter — Phase 6
- Decide whether BeadsAdapter materializes a filesystem view — Phase 6

</domain>

<decisions>
## Implementation Decisions

### Leak-plugging strategy

- **D-01 (Rewrite to SDK queries):** Every workflow leak is fixed by replacing
  the direct `.planning/` tool call with a `gsd-sdk query` call. E.g.,
  `Read .planning/STATE.md` → `gsd-sdk query state.json`. The adapter sits
  inside the SDK — workflows never interact with storage directly.

- **D-02 (Source files live in this repo):** The workflow `.md` source files
  live in `./get-shit-done/workflows/` in this repo. Phase 4 patches them
  here. After reinstall, changes take effect on the user's machine.

- **D-03 (Create new SDK queries as needed):** When a workflow needs data
  that no existing SDK query provides, Phase 4 creates the query. The SDK
  grows to cover what workflows require. This is the natural completion of
  the adapter surface.

- **D-04 (SDK handles atomicity internally):** Multi-file writes are handled
  inside SDK query verb implementations using `adapter.withTransaction()`.
  Workflows call high-level verbs (e.g., `state.begin-phase`,
  `phase.complete`). No explicit transaction boundaries exposed to workflows.

### `<context>`-block mitigation (OQ-04 resolution)

- **D-05 (Orchestrator injects via SDK queries — deterministic):**
  `@.planning/...` references in templates are replaced with
  orchestrator-injected content. The orchestrator calls SDK queries
  (e.g., `gsd-sdk query init.execute-phase`) and pastes the result
  directly into the subagent prompt string at construction time. This is
  equally deterministic to `@` — the data is in the prompt before the
  agent starts. Subagents never need to Read `.planning/` files.

- **D-06 (Rewrite templates in Phase 4):** `phase-prompt.md`,
  `debug-subagent-prompt.md`, `tdd.md`, and `planner-antipatterns.md` are
  rewritten now to remove `@.planning/` references. The new pattern uses
  orchestrator-injected `<project_context>` blocks populated via SDK queries.

### CI gate design (LEAKS-04 + LEAKS-05)

- **D-07 (Pre-commit hook, zero-tolerance):** The leak-grep CI gate is a
  git pre-commit hook. It runs `leak-grep` on staged files. Any leak
  (`.planning/` reference outside `adapters/markdown/`) rejects the commit.
  Zero-tolerance from day one — no baseline allowlist. The gate is enabled
  as the final task after all leaks are plugged.

- **D-08 (`verify.fat-skills` with pre-commit warning):**
  `gsd-sdk query verify.fat-skills` lists all non-router skills with
  line-count + leak-count. The pre-commit hook runs this and warns (does
  not block) when a skill exceeds thresholds. Surfaces visibility into
  skill bloat.

### Scope boundary

- **D-09 (Broad definition — any `.planning/` reference outside adapter):**
  A "leak" is any `.planning/` reference in any file outside of
  `adapters/markdown/`. This includes:
  - Workflow `.md` files (Read/Write/Edit/cp/mv instructions)
  - Template `.md` files (`@.planning/` auto-includes)
  - SDK `.ts` files with residual `fs.*` calls against `.planning/`
  - Test files reading `.planning/` fixtures directly
  The only code allowed to touch `.planning/` directly is the
  MarkdownAdapter implementation itself.

- **D-10 (Full zero-leak state):** Phase 4 targets ALL remaining leaks
  across the entire codebase, not just the workflow files. This includes
  residual SDK leaks from Phases 2/3 that weren't fully cleaned, and test
  files. The CI gate activates once everything is zero.

### Claude's Discretion

- Plan count and sequencing (likely 5-7 plans given the scope)
- Which new SDK queries to create vs composing existing ones
- Internal naming of new query verbs
- Whether deprecated functions (`readModifyWriteStateMd`, etc.) are removed
  or left as dead code behind the `@deprecated` marker
- How test files route through the adapter test harness (may reuse
  conformance harness from Phase 1/3)
- Ordering of workflow rewrites (by leak count, by dependency, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-locked architecture

- `.planning/PROJECT.md` — Fork architecture, two-repo model, strict-superset
  invariant, branch strategy.
- `.planning/DECISIONS.md` — All locked decisions including Phase 3 ADRs
  (OQ-01 resolution, commitPlanningState promotion).
- `.planning/STATE.md` — Current state.

### Prior phase outputs (locked, treat as carry-forward facts)

- `.planning/phases/01-fork-bootstrap-storageadapter-interface-skeleton-markdownada/01-CONTEXT.md`
  — D-02 (CJS stays untouched), D-07 (createRegistry DI), D-10 (full v1.0
  surface declared).
- `.planning/phases/02-wire-core-read-methods-to-adapter/02-CONTEXT.md`
  — D-10 (explicit adapter first parameter), D-12 (CJS bridge pattern),
  D-14 (per-line read-only discipline).
- `.planning/phases/03-wire-core-write-methods-recordstateevent/03-CONTEXT.md`
  — D-01 (3 event families), D-04 (adapter interface stays thin),
  D-05 (shared SDK helper layer), D-07 (withTransaction).

### Milestone scope

- `.planning/REQUIREMENTS.md` §"LEAKS" — LEAKS-01 through LEAKS-05.
- `.planning/ROADMAP.md` §"Phase 4" — Goal, Depends on, Resolves OQ-03 +
  OQ-04, 5 Success Criteria.

### Architectural source-of-truth

- `.planning/research/fork-investigation/SYNTHESIS.md`
  - **§3** — Leak counts per workflow (the top-10 list).
  - **§6 #3 (OQ-03)** — Raw-git outliers.
  - **§6 #4 (OQ-04)** — `<context>`-block leak class.
  - **§9** — Risk register (Rule 4 demotion, `<context>`-block evasion).

### Code surfaces Phase 4 touches

- **Workflow source files:**
  - `get-shit-done/workflows/plan-phase.md` (12 leaks)
  - `get-shit-done/workflows/execute-phase.md` (10 leaks)
  - `get-shit-done/workflows/spike.md` (10 leaks)
  - `get-shit-done/workflows/debug.md` (7+ leaks — `gsd-debugger`)
  - `get-shit-done/workflows/progress.md` or equivalent (8 leaks)
  - `get-shit-done/workflows/verify-phase.md` or equivalent (8 leaks)
  - `get-shit-done/workflows/sketch.md` (8 leaks)
  - `get-shit-done/workflows/discuss-phase.md` (8 leaks)
  - `get-shit-done/workflows/execute-plan.md` (8 leaks)
  - `get-shit-done/workflows/forensics.md` or equivalent (9 leaks)

- **Templates:**
  - `get-shit-done/templates/phase-prompt.md`
  - `get-shit-done/templates/debug-subagent-prompt.md`
  - `get-shit-done/templates/planner-subagent-prompt.md`
  - `get-shit-done/references/tdd.md`
  - `get-shit-done/references/planner-antipatterns.md`

- **SDK residuals (verify/fix):**
  - `sdk/src/query/validate.ts` (8 leaks)
  - `sdk/src/query/workstream.ts` (8 leaks)
  - Any other residual `fs.*` calls in `sdk/src/query/*.ts`

- **CI gate:**
  - `scripts/leak-grep.cjs` — extend to cover workflow `.md` patterns
  - `.husky/pre-commit` or `scripts/pre-commit` — new hook
  - `sdk/src/query/verify-fat-skills.ts` — new query verb

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`scripts/leak-grep.cjs`** — Already covers SDK read-side and write-side
  patterns (Phases 2/3 extended it). Phase 4 extends it further to cover
  workflow `.md` file patterns (Read/Write/Edit tool calls, `@.planning/`
  references, cp/mv/rm against `.planning/`).

- **`gsd-sdk query` verbs** — Many already exist from Phase 2/3 work:
  `state.json`, `state.begin-phase`, `phase.complete`,
  `roadmap.update-plan-progress`, `init.execute-phase`, etc. Phase 4 adds
  missing verbs that workflows currently get by raw-reading files.

- **`scripts/build-hooks.js`** — Existing hook build infrastructure. Phase 4
  can extend this for the pre-commit leak-grep hook.

- **Phase 2's `<context>`-block audit register** (READS-03) — Already
  identified which skills have `@.planning/` references. Phase 4 uses
  this as the work list for the `<context>`-block mitigation.

### Established Patterns

- **SDK query handler signature:** `async function handler(args, projectDir)`
  with adapter via registry closure. New query verbs follow the same pattern.

- **`adapterFor(projectDir)` pattern** — Used in all SDK handlers for
  routing reads/writes through the adapter.

- **Phase 2/3's explicit adapter first parameter** for helpers:
  `(adapter: StorageAdapter, ...rest)`.

### Integration Points

- **`sdk/src/query/index.ts` registry** — New query verbs register here.
- **`scripts/leak-grep.cjs`** — Extended with new patterns.
- **Git hooks** — New pre-commit hook wired via package.json or `.husky/`.
- **Workflow `.md` files** — Every workflow that currently references
  `.planning/` directly will call `gsd-sdk query` instead.

</code_context>

<specifics>
## Specific Ideas

- User chose **broad leak definition** (any `.planning/` reference outside
  adapter is a leak) and **full zero-leak state** (all residuals fixed,
  not just workflows). This is the strictest interpretation of LEAKS-01..05.

- User chose **orchestrator-injected SDK output** for `<context>`-block
  mitigation because it's equally deterministic to `@` syntax — data is
  in the prompt before the agent starts. The `@` directive auto-loads via
  Claude Code runtime; SDK injection loads via orchestrator prompt
  construction. Both guarantee the data is present.

- User chose **zero-tolerance CI gate from day one** — no baseline
  allowlist, no gradual phase-in. The gate enables only after all leaks
  are plugged (logically the last task in execution).

- User chose **pre-commit hook** over GitHub Actions — immediate local
  feedback, no external CI dependency.

</specifics>

<deferred>
## Deferred Ideas

- **BeadsAdapter filesystem materialization decision** — Whether BeadsAdapter
  provides a read-only `.planning/` filesystem view or requires all access
  through SDK queries. Phase 6 decides.

- **Foundational primitive lift** (`getSection`/`updateSection` modes,
  `snapshot/restore`, `putNamedDoc`, `writeBinaryAsset`) — Phase 5.

- **Test infrastructure for non-filesystem adapters** — How the test harness
  works when `.planning/` files don't exist on disk. Phase 6/7.

</deferred>

---

*Phase: 04-plug-workflow-leaks-top-10-context-block-class*
*Context gathered: 2026-05-10*
