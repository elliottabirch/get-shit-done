# Phase 3: Wire core write methods + recordStateEvent — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 03-wire-core-write-methods-recordstateevent
**Areas discussed:** recordStateEvent design, Bin B write method surface, readModifyWrite migration, OQ-01 commitPlanningState semantics

---

## recordStateEvent design

### Q1: Overall approach

| Option | Description | Selected |
|--------|-------------|----------|
| Single monolithic | One recordStateEvent({type, payload}) with discriminated union over 10+ types. Matches ROADMAP SC#2 literally. | |
| 2-3 event families | Split into separate methods by mutation semantics — tighter per-family types but 3 adapter methods. | ✓ |
| You decide | Claude picks based on research and codebase patterns. | |

**User's choice:** 2-3 event families
**Notes:** User wanted to understand how the grouping maps to BeadsAdapter's bd primitives.

### Q2: Family grouping strategy

| Option | Description | Selected |
|--------|-------------|----------|
| By mutation semantics | recordStateAppend (append-only), recordStateMutation (list add/remove), recordStateSignal (flags/control) | ✓ |
| By target artifact | recordStateBodyEvent (STATE.md body), recordStateFrontmatter (YAML), recordStateExternal (WAITING.json) | |
| By frequency/weight | recordStateEvent (high-frequency hot path), recordStateLifecycle (rare ops) | |

**User's choice:** By mutation semantics
**Notes:** User asked for beads-mapping analysis first. After analysis showing mutation semantics maps cleanest to bd primitives (append→comment, mutation→sub-record update, signal→sidecar), user confirmed this grouping.

---

## Bin B write method surface

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid layered | Adapter interface stays thin (Bin A + foundational ~16 methods). Shared SDK helpers (~30 functions) compose primitives. Handlers call helpers. BeadsAdapter only implements primitives. | ✓ |
| Thick adapters | Named domain methods on the adapter (~58 Bin B methods). Handlers become thin routers. BeadsAdapter must re-implement all GSD phase semantics. | |
| Thin adapters | Handlers call Bin A directly. No helper layer. Handlers stay verbose but adapters are maximally simple. | |

**User's choice:** Hybrid layered
**Notes:** None — straightforward selection of recommended option.

---

## readModifyWrite migration

| Option | Description | Selected |
|--------|-------------|----------|
| withTransaction(fn) | Implement the Phase-1-declared primitive now. Callers use explicit transaction blocks. MarkdownAdapter wraps acquireStateLock. Aligns with Phase 5 dry-run. Composable across multiple files. | ✓ |
| Adapter-owned readModifyWrite(path, fn) | Adapter exposes readModifyWrite as convenience. Minimal caller refactor but leaks callback pattern into interface permanently. | |
| Hybrid (both) | Ship readModifyWrite now, implement withTransaction alongside. Phase 5 migrates callers. Two overlapping primitives. | |

**User's choice:** withTransaction(fn)
**Notes:** None — straightforward selection of recommended option.

---

## OQ-01: commitPlanningState semantics

### Q1: Non-git backend behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Capability-gated behavior | If cap is true → real commit or native equivalent. If false → silent no-op. Each adapter declares honestly. | |
| Always checkpoint/snapshot | All adapters must implement as meaningful save point. No no-op allowed. Every adapter provides restore capability. | ✓ |
| Silent no-op for non-git | Only MarkdownAdapter does real commits. All others return void immediately. | |

**User's choice:** Always checkpoint/snapshot
**Notes:** User selected mandatory implementation across all adapters.

### Q2: Capability flag disposition

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the capability flag | commitPlanningState stays gated. v1.0 adapters both set true. Future read-only adapter could set false. | |
| Make it required (remove cap gate) | Drop from capabilities enum. Required method like getRecord. All adapters must implement. Simpler contract. | ✓ |

**User's choice:** Make it required (remove cap gate)
**Notes:** None — straightforward selection. OQ-01 fully resolved.

---

## Claude's Discretion

- Internal naming for shared SDK helper module
- Exact payload type names and field shapes per event family
- Whether withTransaction capability flag is renamed
- Plan count and sequencing
- Conformance test structure
- Whether readModifyWriteStateMd/readModifyWriteRoadmapMd kept as deprecated aliases

## Deferred Ideas

- Foundational primitives (snapshot/restore, putNamedDoc, etc.) — Phase 5
- getSection/updateSection semantic upgrade — Phase 5
- Workflow leak plugging — Phase 4
- BeadsAdapter implementation — Phase 6
- Transaction nesting/savepoint semantics — future if needed
