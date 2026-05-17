# Phase 1: Fork bootstrap + StorageAdapter interface skeleton + MarkdownAdapter scaffold - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 01-fork-bootstrap-storageadapter-interface-skeleton-markdownada
**Areas discussed:** Scaffold strategy, Capabilities flag shape, Interface visibility, Phase 1 deliverables

---

## Scaffold strategy

### Q1 — Module layout: where does StorageAdapter live?

| Option | Description | Selected |
|--------|-------------|----------|
| `sdk/src/storage/` | Sibling to `sdk/src/query/`. Adapter is part of SDK surface. Matches PR #2901's seam direction. | |
| `sdk/src/adapters/` | Plural-named under SDK. Signals 'pluggable strategies'. | |
| Top-level `adapters/` | Outside `sdk/`. Maximizes separation; clean import path for third-party adapters. | ✓ |
| `sdk/src/query/storage/` | Nested under existing query layer. Smallest diff. | |

**User's choice:** Top-level `adapters/`
**Notes:** Trade-off accepted: higher rebase risk vs upstream's seam work happening under `sdk/`, in exchange for a clean public seam at repo root that third-party adapters can import without depending on internal SDK shapes.

---

### Q2 — MarkdownAdapter scaffold delegation strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap existing CJS | Methods import and call helpers from `get-shit-done/bin/lib/*.cjs` via `createRequire`. Smallest Phase 1 diff; rebase-safe. | ✓ |
| Re-export bindings | Adapter is mostly `export const getRecord = require('.../core.cjs').readRecord`. Even smaller; weakest type safety. | |
| Extract from CJS | Rip filesystem code OUT of `core.cjs` into the adapter; existing CJS callers re-route through adapter. Big Phase 1; risky on rebase. | |
| Parallel TS impl | Fresh TS using `node:fs/promises` directly; ignores existing CJS. Risks divergence. | |

**User's choice:** Wrap existing CJS
**Notes:** Phase 1 stays minimal; CJS files untouched for rebase ergonomics. Cost paid in Phase 2/3/4 as handlers migrate.

---

### Q3 — Adapter lifecycle contract

| Option | Description | Selected |
|--------|-------------|----------|
| Async `init()` required | createRegistry awaits `adapter.init()` before returning. BeadsAdapter runs bd-managed check. Fast/explicit failure. | |
| Sync constructor + lazy init | First call triggers initialization. Errors surface mid-workflow. | |
| Sync constructor only | No init/teardown. Minimal interface. Validation happens externally. | ✓ (Claude rec.) |
| init + teardown pair | Required pair; clean shutdown semantics. Most relevant for BeadsAdapter. | |

**User's choice:** Deferred to Claude's recommendation. User explicitly said "don't implement anything around the beads adapter yet. we need to get the markdownadapter working first... im not sure about the init(), just choose your recommendation."
**Notes:** Sync constructor only chosen — minimal interface, MarkdownAdapter has nothing to init, future adapters can add lifecycle as a non-breaking capability-gated extension.

---

### Q4 — Path shape across the interface

| Option | Description | Selected |
|--------|-------------|----------|
| `.planning/`-relative | Methods take paths like `phases/01-foo/PLAN.md`. Adapter holds projectDir internally. | ✓ |
| Absolute paths | Cheapest wrap; leaks filesystem semantics into callers. | |
| Logical refs (typed) | Methods take `{kind, phase, planId}` records. Most adapter-agnostic; non-trivial Phase 1. | |
| Mixed | Bin A for `.planning/` only; other code uses plain fs. | |

**User's choice:** `.planning/`-relative for v1.0
**Notes:** User explicitly stated: "i want to use logical refs eventually, so lets defer the implementation of that till later. for now, lets go with .planning/-relative." Captured as deferred idea for future evolution.

---

## Capabilities flag shape

### Q5 — Required capability groups

| Option | Description | Selected |
|--------|-------------|----------|
| record + section + frontmatter (3 required) | All Bin A primitives required. Closed contract. | ✓ |
| record + section (2 required, per D-05) | Frontmatter capability-gated. Maximum forward-compat. | |
| record only (1 required) | Most flexible; most consumer-side checks. | |
| All Bin A required | Capabilities only gates foundational primitives. Tightest constraint. | |

**User's choice:** record + section + frontmatter (3 required)
**Notes:** Pragmatic — every workflow today touches frontmatter, no realistic adapter would skip it.

---

### Q6 — Adapter identity field

| Option | Description | Selected |
|--------|-------------|----------|
| `name` only | Diagnostic logging only; never used for behavior branching. | ✓ |
| `name + version` | Helps conformance suite report adapter versions. | |
| Capabilities only (no identity) | Strictest; consumers thread name through themselves. | |
| `name + version + sdkApiVersion` | Reject mismatched-version adapters at construct time. | |

**User's choice:** `name` only
**Notes:** Minimal addition; D-2026-04-30-05's explicit rejection of `if (adapter.name === 'beads') ...` keeps it strictly diagnostic.

---

### Q7 — `createRegistry({adapter})` DI signature

| Option | Description | Selected |
|--------|-------------|----------|
| Optional, defaults to MarkdownAdapter | Existing zero-arg callers keep working. | |
| Required, no default | Every caller updates. Big Phase 1 diff; no implicit footgun. | ✓ |
| Optional, fallback to config-resolved | Look at `.planning/config.json`; bigger Phase 1. | |
| Two factory functions | Backward-compat zero-arg + new explicit factory. | |

**User's choice:** Required, no default
**Notes:** Tighter contract; strict-superset invariant held at the install-wiring layer (CI/tests construct `new MarkdownAdapter(projectDir)` explicitly).

---

### Q8 — Closed enum of optional capabilities

| Option | Description | Selected |
|--------|-------------|----------|
| Exactly D-05's 5 | `binaryAsset \| snapshot \| transaction \| namedDoc \| commitPlanningState`. Closed. | ✓ |
| D-05 + forward slots | Pre-declare `concurrentSection`, `graph`, `migration` even if unimplemented. | |
| Open record, string-keyed | `Record<string, boolean>`. Maximum flexibility; loses TS exhaustiveness. | |
| D-05 + per-method gates | Capabilities scale 1:1 with methods. Most precise; biggest interface. | |

**User's choice:** Exactly D-05's 5
**Notes:** Forces deliberate evolution; future caps require an interface bump. (Implicitly extended to 6 in Q9 with `markdownLockfile` joining the enum.)

---

## Interface visibility

### Q9 — OQ-08 resolution: where do `replaceInCurrentMilestone` and `readModifyWriteRoadmapMd` live?

| Option | Description | Selected |
|--------|-------------|----------|
| Private to MarkdownAdapter | SYNTHESIS §6 #1 recommendation. Absent from public interface. | |
| Public on StorageAdapter (required) | Every adapter implements its own. BeadsAdapter forced to implement markdown-lockfile semantics. | |
| Public, capability-gated | Methods on the interface; gated by `capabilities.markdownLockfile: boolean`. | ✓ |
| Eliminate as obsolete (Bin C1) | Per SYNTHESIS §5 C1. Bigger Phase 1 refactor. | |

**User's choice:** Public, capability-gated by `markdownLockfile`
**Notes:** Diverges from SYNTHESIS recommendation. Implicitly extends Q8's optional-capability enum from 5 to 6 (markdownLockfile added). User prefers an explicit uniform contract surface that future adapters can opt into vs. an implementation-private workaround.

---

### Q10 — Phase 1 interface: declare full v1.0 surface or strictly Bin A?

| Option | Description | Selected |
|--------|-------------|----------|
| Declare all v1.0 signatures now | Bin A + 2 markdownLockfile + ~9 foundational. MarkdownAdapter throws `UnsupportedCapabilityError` for unimplemented. | ✓ |
| Strictly Bin A + markdownLockfile | Foundational signatures land in Phase 5. Re-locks contract twice. | |
| Bin A + capability flags (no method sigs) | Capabilities flag predicts the future; methods follow later. Awkward. | |
| Bin A + commitPlanningState only | Defer most foundationals to Phase 5; keep what's actively used. | |

**User's choice:** Declare all v1.0 signatures now
**Notes:** One breaking interface change in Phase 1, not three across phases. Matches SYNTHESIS §7 Phase 1 description ("Bin A + foundational primitives only").

---

### Q11 — Optional method structural shape

| Option | Description | Selected |
|--------|-------------|----------|
| Method always present, throws if disabled | Uniform shape; misuse fails fast at runtime. | |
| TypeScript optional `?:` | `snapshot?(): Promise<...>`. Misuse is a TYPE error. Doesn't pair cleanly with capability flags. | |
| Hybrid — required prop, throws | No `?:` on interface; bodies throw. D-05's rejected pattern, sort of. | |
| Companion type guard | Required on interface; `hasSnapshot(adapter)` narrows. Most ergonomic for consumers; biggest authoring effort. | ✓ |

**User's choice:** Companion type guard
**Notes:** Cleanest consumer experience. MarkdownAdapter still throws `UnsupportedCapabilityError` defensively if cap=false; ergonomic path is type-guard-then-call.

---

## Phase 1 deliverables

### Q12 — ADAPTER-05 reconciliation artifact

| Option | Description | Selected |
|--------|-------------|----------|
| Single reconciliation note | `.planning/research/upstream-prs-reconciliation.md`, four sections. | |
| Per-PR ADRs in DECISIONS.md | D-XX-07 thru -10. Surfaces in existing decisions log. | ✓ |
| Inline annotations | JSDoc tags on interface methods. No standalone doc. | |
| Note + DECISIONS.md summary | Both. Best discoverability; more authoring work. | |

**User's choice:** Per-PR ADRs in DECISIONS.md
**Notes:** Each PR (#2898, #2901, #2908, #2909) gets a dated decision entry with verdict (REUSE/COORDINATE/DIVERGE/IRRELEVANT) and contract impact.

---

### Q13 — Strict-superset validation method (Phase 1 SC#1)

| Option | Description | Selected |
|--------|-------------|----------|
| Local CI run, no upstream coupling | Run fork's existing tests with MarkdownAdapter wired. Defer #2909 to Phase 8. | ✓ |
| Pull #2909 fixtures explicitly | Cherry-pick #2909's matrix into the fork. Couples to PR status. | |
| Snapshot diff vs upstream HEAD | Run upstream/main vs fork; assert byte-identical. Slightly more CI plumbing. | |
| Defer to Phase 8 entirely | Phase 1 SC#1 weakens to "tests pass with no observable change." | |

**User's choice:** Local CI run, no upstream coupling
**Notes:** Pragmatic — doesn't block Phase 1 on PR #2909's merge timing. Phase 8 (DIST-04) revisits with actual upstream matrix.

---

### Q14 — Leak-grep rebase script scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full Rubric R5 patterns | All R5 patterns; comprehensive. | |
| R5 + `<context>`-block detector | R5 patterns + skill frontmatter scan for the new leak class. | ✓ |
| Minimal — Read/Write/Edit only | Original 3 patterns; defer rest to Phase 4. | |
| Defer entirely to Phase 4 | Phase 1 ships nothing; rebases proceed manually. | |

**User's choice:** R5 + `<context>`-block detector
**Notes:** Catches OQ-04's leak class at rebase time. Phase 1 ships the engine; Phase 4 wires the CI gate (LEAKS-04).

---

### Q15 — Conformance test harness scope

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton + 1 sample test | Harness shape + `getRecord` round-trip. Phase 2-5 fill in. | ✓ |
| Skeleton only, no tests | Harness shape only; first test exposes its viability. | |
| Defer entirely to Phase 7 | Smallest Phase 1; biggest Phase 7 sprint. | |
| Property-based skeleton | Ship fast-check + harness shape; more upfront effort. | |

**User's choice:** Skeleton + 1 sample test
**Notes:** Incremental coverage instead of one giant Phase 7 sprint. Phase 7 adds BeadsAdapter to the matrix.

---

## Claude's Discretion

- `capabilities` is an instance property (not static) per D-05's sketch — gives forward flexibility for runtime-detected caps without overriding user intent.
- Internal layout under `adapters/markdown/` (single file vs. one file per capability group).
- Exact `UnsupportedCapabilityError` shape and inheritance chain.
- TypeScript type-guard authoring style (named functions vs. inline predicates).
- Leak-grep script extension (`.mjs` vs `.cjs` vs shell) — match existing `scripts/` style.
- Conformance test framework wiring details (vitest config additions).

## Deferred Ideas

- **Logical-ref shape for Bin A methods** — user explicitly wants this eventually; deferred to Phase 5 or v1.1.
- **BeadsAdapter shape & capability mapping** — Phase 6 owns end-to-end; user explicitly excluded from this discussion.
- **Empirical strict-superset proof against upstream's #2909 golden parity matrix** — Phase 8 (DIST-04) revisits.
- **Lifecycle methods (`init()`/`teardown()`)** — capability-gated extension if a future adapter needs them.
- **Open-record/string-keyed capabilities** — rejected at Q8; revisit only if real third-party need emerges.
- **Bin B method signatures on the v1.0 interface** — Phase 2 (reads) and Phase 3 (writes) own these.
- **CI gate enforcement for the leak-grep script** — Phase 4 (LEAKS-04).
- **PR-vs-long-lived-fork distribution decision (DIST-05)** — Phase 8.
