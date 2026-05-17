# Phase 4: Plug workflow leaks (top-10 + `<context>`-block class) — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 04-plug-workflow-leaks-top-10-context-block-class
**Areas discussed:** Leak-plugging strategy, `<context>`-block mitigation, CI gate design, Scope boundary

---

## Leak-plugging strategy

### Q1: Overall approach

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite to SDK queries | Each workflow's direct .planning/ tool call is replaced with gsd-sdk query call. Adapter sits inside SDK. | ✓ |
| Adapter shim layer | Thin proxy intercepts Read/Write/Edit tool calls targeting .planning/ at runtime. Workflows unchanged. | |
| You decide | Claude picks based on codebase patterns. | |

**User's choice:** Rewrite to SDK queries
**Notes:** User confirmed after clarification that workflow source lives in this repo (`./get-shit-done/workflows/`), not just user settings. Changes tracked via git, take effect on reinstall.

### Q2: Prioritization

| Option | Description | Selected |
|--------|-------------|----------|
| All at once | Plug all ~90 leak sites across all 10 workflows in one phase. | ✓ |
| Top-5 first, rest later | Do top-5 heaviest leakers, defer rest to decimal phase. | |
| You decide | Claude decides based on dependency analysis. | |

**User's choice:** All at once

### Q3: New SDK queries

| Option | Description | Selected |
|--------|-------------|----------|
| Create new SDK queries as needed | If workflow needs data no query provides, Phase 4 creates it. SDK grows to cover workflow needs. | ✓ |
| Adapt workflow to existing queries only | Only use existing queries. Restructure workflow logic if needed. | |
| You decide | Claude decides per-leak. | |

**User's choice:** Create new SDK queries as needed

### Q4: Atomicity for multi-file writes

| Option | Description | Selected |
|--------|-------------|----------|
| SDK calls handle atomicity internally | SDK query verbs use withTransaction internally. Workflows call high-level verbs. No explicit txn from workflow side. | ✓ |
| Workflows use explicit transaction blocks | Workflows coordinate via txn.begin/txn.commit. More control, more complexity. | |
| You decide | Claude decides based on which writes need cross-file atomicity. | |

**User's choice:** SDK handles it internally
**Notes:** User confirmed after clarification that SDK verbs internally wrap withTransaction — workflows just call the high-level verb.

---

## `<context>`-block mitigation

### Q1: Mitigation approach

| Option | Description | Selected |
|--------|-------------|----------|
| Orchestrator injects via SDK queries (deterministic) | Orchestrator calls SDK queries and pastes result into subagent prompt at construction time. Equally deterministic to @ syntax. | ✓ |
| Documented exceptions register | Document as non-leaks since subagent Read tool reads from worktree. | |
| Install-time rewrite hook | Hook scans .md files at install for @.planning/ and rewrites to SDK calls. | |

**User's choice:** Orchestrator injects via SDK queries
**Notes:** User asked about reliability — clarified that orchestrator injection is equally deterministic to @ because data is in the prompt before agent starts. User also asked about whether .planning/ markdown files would need to exist on disk for BeadsAdapter; confirmed they would NOT (bd stores in SQLite + JSONL), which is why SDK injection is needed.

### Q2: Template rewrite timing

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite templates now | Phase 4 updates phase-prompt.md and other templates to remove @.planning/ references. | ✓ |
| Defer to Phase 6 | Leave templates as-is; change when BeadsAdapter forces the issue. | |
| You decide | Claude decides based on scope and dependency analysis. | |

**User's choice:** Rewrite templates now

---

## CI gate design

### Q1: Gate mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-commit hook | Git pre-commit hook runs leak-grep on staged files. Immediate local feedback. | ✓ |
| GitHub Action only | GitHub Actions workflow on PR diffs. Catches at PR time, not commit time. | |
| Both (hook + Action) | Pre-commit for local, Action for authoritative PR gate. | |
| You decide | Claude picks based on project setup. | |

**User's choice:** Pre-commit hook

### Q2: Baseline handling

| Option | Description | Selected |
|--------|-------------|----------|
| Allowlist of known leaks | .leak-baseline file lists known leaks. Hook only fails on NEW leaks not in baseline. | |
| Zero-tolerance from day one | Gate rejects any leak. Must plug ALL leaks before gate enables. Gate is last task. | ✓ |
| You decide | Claude decides gating strategy. | |

**User's choice:** Zero-tolerance from day one

### Q3: verify.fat-skills

| Option | Description | Selected |
|--------|-------------|----------|
| SDK query + pre-commit integration | gsd-sdk query verify.fat-skills lists skills with leaks. Pre-commit warns (not blocks). | ✓ |
| SDK query only (no CI) | Ship query for manual use. No automated enforcement. | |
| You decide | Claude decides integration level. | |

**User's choice:** SDK query + pre-commit integration

---

## Scope boundary

### Q1: Leak definition

| Option | Description | Selected |
|--------|-------------|----------|
| Only tool calls in workflow .md files | Leak = workflow .md instructing Read/Write/Edit against .planning/. SDK internals not a leak. | |
| Broad: any .planning/ reference outside adapter | ANY file referencing .planning/ outside adapters/markdown/ is a leak. Strictest. | ✓ |
| Narrow: only Write/Edit (reads OK) | Only write operations are leaks. Reads from .planning/ acceptable. | |

**User's choice:** Broad — any .planning/ reference outside adapter

### Q2: Scope size

| Option | Description | Selected |
|--------|-------------|----------|
| Workflow .md + templates + gate | Phase 4 handles workflows + templates + CI gate. SDK residuals tracked separately. | |
| Everything — full zero-leak state | Phase 4 handles ALL remaining leaks everywhere. CI gate activates once everything is zero. | ✓ |
| You decide | Claude scopes based on what's actually left. | |

**User's choice:** Everything — full zero-leak state

---

## Claude's Discretion

- Plan count and sequencing
- Which new SDK queries to create vs composing existing ones
- Internal naming of new query verbs
- Whether deprecated functions are removed or left as dead code
- How test files route through adapter test harness
- Ordering of workflow rewrites

## Deferred Ideas

- BeadsAdapter filesystem materialization decision — Phase 6
- Foundational primitive lift — Phase 5
- Test infrastructure for non-filesystem adapters — Phase 6/7
