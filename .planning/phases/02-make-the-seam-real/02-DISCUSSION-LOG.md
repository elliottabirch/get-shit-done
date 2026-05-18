# Phase 2: Make the seam real - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 02-make-the-seam-real
**Areas discussed:** adapterFor disposition + dry-run diff, Handler signature & adapter threading, Conformance suite shape (SEAM-06), StateWriteOutcome contract — now or later
**Mode:** advisor (USER-PROFILE.md present, calibration tier: standard, vendor philosophy: pragmatic)

---

## adapterFor disposition + dry-run diff introspection

**Initial researcher framing was incorrect** — claimed dry-run was MarkdownAdapter-only. User pushed back ("why isn't dry run supported? i thought that we support dry run?"). Verification confirmed:

- `withTransaction` is first-class on the StorageAdapter interface (types.ts:113); both adapters support transactional rollback.
- `_txnContextForPipeline` / `_realReadForPipeline` (underscore-prefixed) are MarkdownAdapter-private escape hatches NOT on the interface; pipeline.ts casts to `unknown as { ... }` to access them.
- `snapshot()` / `restore()` ARE first-class on the interface (types.ts:111-112) with `capabilities.snapshot` flag; both adapters implement them. Bd's impl uses `bd export --json` + `bd init --from-jsonl`.

After correction, four refined options were presented:

| Option | Description | Selected |
|--------|-------------|----------|
| A. Delete + diff markdown-only (capabilities flag) | Delete adapterFor; pipeline gets adapter via registry. Add capabilities.dryRunDiff. withTransaction works on both; diff returns null on bd with reason='diff_introspection_unsupported'. Defers bd-diff. | |
| B. Delete + diff generic via snapshot/restore | Delete adapterFor. Add getTransactionDiff() to interface OR refactor pipeline.ts to use snapshot()→mutate→restore() — both adapters already implement these. Diff works on bd, but bd snapshot is bd export --json (expensive). | ✓ |
| C. Stub-throw adapterFor | adapterFor becomes throw NotYetMigratedError stub. Pipeline crashes if invoked, forcing migration. In practice degenerates to A or B. | |
| D. Config-driven adapterFor (escape hatch) | adapterFor reads config and dispatches. Pipeline keeps using it with adapter.kind guard. SEAM-02 grep technically fails. Transitional only. | |

**User's choice:** B (delete + generic diff via snapshot/restore).

**Follow-up sub-decision: bd impl scope for getTouchedPaths**

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 2 ships interface + markdown only | Add getTouchedPaths to interface; markdown impl only; bd throws or returns empty with known-gap manifest entry. Bd impl filed as Phase 4 / sibling-repo. | |
| Phase 2 ships full bd impl too | Interface + markdown + beads in one phase; bd impl tracks touched paths via bd label/comment hooks. Higher cost; sibling-repo work; conformance asserts real diffs on bd. | |
| Phase 2 ships interface + markdown + bd best-effort | Bd implements via "enumerate-all-records" fallback. Diff correct but coarse-grained. No sibling-repo dep. Conformance asserts diff non-empty on bd, exact path set on markdown. | ✓ |

**User's choice:** best-effort bd impl. Phase 2 ships interface + markdown + bd-best-effort. No sibling-repo blocker.

**Notes:** The user's pushback on the original framing was the highest-leverage moment of the discussion — it changed the answer from "bd doesn't get dry-run diff" to "both adapters get dry-run diff via snapshot/restore." Underscore-prefixed escape-hatch methods are deleted as a side effect (D-02).

---

## Handler signature & adapter threading

Researcher reported a critical fact: **Option A is already partially implemented.** `createRegistry` in `index.ts` (lines 282-722) already wraps ~40 handlers via closures `(args, projectDir, ws) => handlerFn(adapter, args, projectDir, ws)`. The migration is in flight, not zero.

| Option | Description | Selected |
|--------|-------------|----------|
| A. Complete closure-wrapper (current path) | Finish Option A: every handler gets (adapter, args, projectDir, workstream). createRegistry closures thread adapter. QueryHandler type unchanged. Lowest blast radius. ~40 handlers migrated, ~60 to go. | ✓ |
| B. Pivot to context object (ctx, args) | QueryContext = { adapter, projectDir, workstream }. tRPC/Hono pattern. Future-proof. But: breaks every handler + tests + registry + pipeline at once. ~35-file PR. | |
| C. Factory pattern (makeHandler(adapter)) | Each handler exports makeHandler(adapter) => QueryHandler. Clean files, no closure noise. But adds indirection per handler; lazy-init discipline required. Researcher rated lowest. | |
| D. Registry-level adapter constructor arg | QueryRegistry(adapter) on construction. Breaks new QueryRegistry() callsites in tests. Doesn't buy anything over A given multi-projectDir reality. | |

**User's choice:** "do whatever fits" — Claude locked Option A.

**Notes:** Recommendation rationale (recorded in CONTEXT.md D-06/D-07): (1) migration is in-flight, not zero — pivoting unwinds 40 working handlers; (2) the bug is silent-routing, not signature shape — switching shapes adds risk without addressing the bug; (3) anti-pattern 2 (bundled-corruption) cuts hard against B's 35-file simultaneous-break PR; (4) "Phase 3 wants dryRun/logger" is hypothetical — none of open Phase 3/4 REQs require richer handler context; (5) pipeline.ts integration is identical under A vs B. The closure-wrapper is itself the migration path if a future phase needs richer context — change the wrapper, not the handlers.

---

## Conformance suite shape (SEAM-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Manifest-listed (extend v1.0 manifest) | Add ~30 kind: 'seam-realness' entries to tests/conformance/manifest.ts, one per migrated state-mutation handler. Reuses bidirectional meta-coverage invariant. DEFECT-02 becomes one entry. Per-handler ADR deviations via 'adr:' field. Researcher's strong recommendation. | ✓ |
| Discovery-driven (walk registry at test time) | At runtime, import FAMILY_HANDLERS, generate one paired test per handler against both adapters. Coverage scales automatically. Risk: vacuous pass on ill-behaved handlers; semantics-different handlers get same uniform fixture. | |
| Hybrid (manifest enumeration + templated fixtures) | Manifest lists every handler by name (subset check enforces enumeration); test bodies generated from parameterized template. Closes silent-omission gap. Risk: template generality vs per-handler semantics tension. | |

**User's choice:** Manifest-listed (extend v1.0 manifest).

**Notes:** v1.0 already shipped a 56-entry manifest with `kind: 'binA'/'binB'/'known-gap'` + `adr:` field for divergences. The pattern handles per-adapter outcome divergence cleanly (e.g. existing `recordStateMutation:blocker_resolved:existing` entry where markdown returns `applied: true` and bd returns `nothing_to_remove`). DEFECT-02 (>64KB body) drops in as one `kind: 'seam-realness'` entry with a buffer-size fixture. The 95% gate is computed as `(entries where kind !== 'known-gap') / total entries`. Sub-95% handlers are enumerated by name with required `adr:` reference — silent skip impossible.

---

## StateWriteOutcome contract — now or later

Researcher's important correction: **the contract is already implemented at the adapter layer.** Both MarkdownAdapter and BeadsAdapter return `StateWriteOutcome` from `recordState*` methods. The gap is that SDK handler functions (e.g. `stateAddDecision`, `stateAddRoadmapEvolution`) discard the outcome and return `Promise<void>`. The "implement" decision is purely about handler-layer propagation timing.

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to Phase 2.1 (file bd issue now) | Phase 2 threads adapter only. Handler return types stay Promise<void>. File P1 bd issue NOW for Phase 2.1. Phase 2 stays disciplined. Researcher's recommendation. | |
| Implement alongside (in Phase 2) | Both signature changes in Phase 2: adapter threading AND return type Promise<void> → Promise<StateWriteOutcome>. One signature pass. Requires (a) atomic-commit separation, (b) pre-audit of workflow/skill callsites for void-discard. Doubles scope; recreates Wave 6 risk if discipline slips. | ✓ |
| Fold-light (thread adapter, no propagation plan) | Thread adapter only; no Phase 2.1 commitment. Adapter contract exists at interface but invisible at handler layer. Researcher: not recommended terminal state. | |

**User's choice:** Implement alongside.

**Notes:** Researcher's two preconditions are non-negotiable and recorded as D-15 + D-16:

- **D-15 (atomic-commit separation):** Per handler family, two atomic commits: commit 1 = "thread adapter through X", commit 2 = "propagate StateWriteOutcome through X". Build+test gate between each. NEVER bundled. Direct mitigation of v1.0 Wave 6 anti-pattern.
- **D-16 (pre-flight callsite audit):** Before changing return types, audit every caller of every state-mutation handler. `grep -rn "await state[A-Z][a-zA-Z]*(" sdk/src/ workflows/ .claude/`. Confirm every match is unbound. If any caller branches on the value today, that caller must be updated in lockstep — file as planning-time finding, not execution surprise. Planner-agent runs this audit during plan-phase.

The conformance suite's per-adapter `StateWriteOutcome` assertions (D-13) become richer because of this choice: manifest entries can assert on outcome shape, not just "no throw."

---

## Migration staging strategy (implied — not separately discussed)

Constrained by D-15 (atomic-commit separation) + blocking anti-pattern 2 (bundled-corruption commit). Locked in CONTEXT.md as D-17/D-18/D-19 without separate user input — the constraints made the choice deterministic:

- **Per-handler-family commit pairs.** ~14-18 atomic commits across the migration, with build+test gate after each.
- **Per-phase staging branch.** Reuse Phase 1's pattern (D-04).

If the user disagrees with the staging strategy, this is a planning-time pivot; the planner-agent should surface the choice as a planning-stage gray area.

---

## Claude's Discretion

- Exact ordering of handler-family migrations within Phase 2 plans.
- Whether `getTouchedPaths` goes through `withTransaction`'s callback context or as a direct method.
- Test fixture shape for new `kind: 'seam-realness'` entries (within DEFECT-02 buffer-size fixture constraint).
- Whether the pre-flight callsite audit is a separate bd issue or rolled into Phase 2 planning notes.
- Bd-mirror discipline for STATE.md updates during this phase.

## Deferred Ideas

- Bd-native diff primitive (cheaper than `bd export --json` + re-init) — sibling-repo or Phase 4+.
- Workflow/skill-layer consumption of `StateWriteOutcome` (vs just propagating it through handlers) — future phase or bd issue.
- `registeredTests` discovery automation in conformance (hybrid option) — revisit if silent-omission becomes a real risk in Phase 3/4.
- Underscore-prefix audit across the broader codebase — Phase 2 removes the two known instances; broader audit deferred.
