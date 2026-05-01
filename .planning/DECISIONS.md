---
title: gsd-beads architectural decision log
last_updated: 2026-04-30
---

# Decisions

Decisions get captured here at the moment they're made. Each entry
preserves the alternatives considered + rationale so future-you (or future
contributors) can audit the call without re-litigating.

---

## D-2026-04-30-01 — Architectural pivot: shadow → fork-with-adapter-interface

**Date:** 2026-04-30
**Trigger:** v0.2 Phase 5.6 design conversation surfaced that the shadow
architecture cannot capture goal/dep/criteria writes because vanilla GSD
writes them via Write/Edit tools, not through `gsd-sdk query` mutations.

**Decision:** Abandon the shadow architecture. Fork upstream
`gsd-build/get-shit-done`, add a `StorageAdapter` interface to the fork,
ship a default `MarkdownAdapter` (zero behavior change vs upstream), and
rebuild gsd-beads as a `BeadsAdapter` implementation against that interface.

**Alternatives considered:**

1. **Continue with shadow (status quo).** Rejected: ~334 enumerated
   direct-I/O leaks across upstream bypass the SDK; shadow has a hard ceiling.
2. **Skill-level shadowing** (override `~/.claude/skills/gsd-*` to wrap
   upstream workflows). Rejected: no agent-level `@`-delegation means
   maintaining parallel agent implementations; brittle against upstream
   updates; doesn't fix the `<context>`-block leak class.
3. **Submit upstream PRs for missing mutations** (`phase.set-goal` etc.).
   Rejected: doesn't solve the broader pattern; one mutation at a time
   is glacial; we'd still need shadow infra in the meantime.
4. **Fork and modify upstream directly** (no adapter layer). Rejected:
   maintenance forever, no upstream contribution path, ecosystem split.

**Evidence:** `.planning/research/fork-investigation/SYNTHESIS.md`
- ~258 artifacts classified
- ~334 direct-I/O leaks across 70 workflows + 25 agents + 13 fat skills
- 6 foundational primitives identified
- ~96 deduped adapter methods proposed
- 12+ confirmed fat skills (Rule 4 demoted to heuristic)
- New `<context>`-block leak class discovered

**Carry-forward:** v0.1 + v0.2 work translates directly into BeadsAdapter
implementation (Phase 6 of new v1.0 milestone). See PROJECT.md
"Carry-forward" section.

---

## D-2026-04-30-02 — Two-repo model

**Date:** 2026-04-30
**Decision:** Two repos:
- **Repo 1: `<user>/get-shit-done`** — the fork. Contains adapter interface
  refactor + default `MarkdownAdapter`. Behaves identically to upstream
  when no adapter is configured. Submittable upstream as a PR if accepted.
- **Repo 2: `gsd-beads`** (this repo, evolved) — `BeadsAdapter` implementation
  + bd-specific helpers + spike findings + test fixtures. Depends on Repo 1.

**Alternatives considered:**

1. **Monorepo** (fork + adapter together). Rejected: couples fork to
   bd-specific code; harder to upstream the fork; mixing concerns.
2. **Fork-only** (BeadsAdapter inside the fork as `packages/beads/`).
   Rejected: gsd-beads has its own release cadence and history; bundling
   blocks "anyone can write their own adapter" pattern.
3. **Three repos** (fork + gsd-beads + a separate `gsd-adapter-spec`
   package for the interface alone). Rejected: over-engineering for v1.0.

**Implication:** During development, gsd-beads links to the fork via
local symlink (`npm link`); at release, it depends via npm version range.

---

## D-2026-04-30-03 — Fork name: `get-shit-done` (no rename)

**Date:** 2026-04-30
**Decision:** The fork lives at `<user>/get-shit-done`. Same package name
(`get-shit-done-cc` or whatever upstream uses).

**Alternatives considered:**

1. **Rename to `get-shit-done-pluggable`/`gsd-fork`/etc.** Rejected:
   breaks `npm install -g get-shit-done-cc` muscle memory for users
   trying the fork; clearer scope is not worth the friction.
2. **Different name entirely.** Rejected: makes the fork feel like a
   separate project, undermining "drop-in compatible" framing.

**Implication:** Distribution probably requires a private npm registry
or scoped package (`@user/get-shit-done`) to avoid namespace collision
with upstream until a PR is upstreamed.

---

## D-2026-04-30-04 — Upstream-sync model: periodic rebase

**Date:** 2026-04-30
**Decision:** The fork tracks `gsd-build/get-shit-done` as a remote and
periodically rebases against `upstream/main`. Conflicts resolve in our
adapter-interface patches.

**Alternatives considered:**

1. **Cherry-pick model.** Rejected: forces us to triage every upstream
   commit; high ongoing overhead; fork drifts from upstream invisibly.
2. **Fork-and-forget** (initial baseline only). Rejected: upstream's
   business-logic improvements (slug rules, validation, etc.) are
   exactly what we want; freezing forfeits the contributor relationship.
3. **Cherry-pick from a CI-curated subset** (only "stable" upstream
   commits). Rejected: needs CI infrastructure we don't have.

**Implication:** Our adapter-interface changes must be structured as
clean topical patches that survive rebase. If upstream introduces a new
SDK query that does direct I/O, our rebase catches it via the leak-grep
rule (R3 + R5 in Rubric v2) and we route it through the adapter as
part of the rebase.

**Tooling needed (Phase 1 deliverable):** a `make rebase` script that
runs leak-grep over the post-rebase diff and flags new direct-I/O
operations needing adapter routing.

---

## D-2026-04-30-05 — Adapter capability negotiation: capabilities flag

**Date:** 2026-04-30
**Decision:** Adapters declare supported features via a static
`capabilities` flag on the adapter object. Callers query it before
invoking optional methods.

**Sketch:**
```ts
interface StorageAdapter {
  capabilities: {
    // Core (always required)
    record: true;
    section: true;

    // Optional
    binaryAsset: boolean;     // writeBinaryAsset
    snapshot: boolean;        // snapshot()/restore()
    transaction: boolean;     // withTransaction(fn)
    namedDoc: boolean;        // putNamedDoc/getNamedDoc
    commitPlanningState: boolean;  // git commit semantics
  };
  // ... methods
}
```

Workflows that need an optional capability check first:
```ts
if (!adapter.capabilities.binaryAsset) {
  log.warn(`UI screenshots unavailable on ${adapter.name}`);
  return;
}
```

**Alternatives considered:**

1. **Optional methods** (`adapter.snapshot?: () => Promise<...>`).
   Rejected: `if (typeof adapter.snapshot === 'function')` works but
   loses static information about what the adapter supports without
   probing every method.
2. **Stub-with-throw** (`UnsupportedOperationError`). Rejected: failure
   is at call time; consumers can't degrade gracefully without a
   try/catch on every potentially-unsupported call.
3. **Mixed: required core + optional methods + `name` for known
   adapters** (`if (adapter.name === 'beads') skip()`). Rejected:
   couples consumers to adapter identity instead of capabilities.

**Implication:** Phase 1's adapter interface skeleton must define the
capabilities surface upfront. Adding a capability later without breaking
existing adapters is the supported migration path.

---

## D-2026-04-30-06 — Synthesis output is canonical input for v1.0 milestone scoping

**Date:** 2026-04-30
**Decision:** `.planning/research/fork-investigation/SYNTHESIS.md` is the
single source of truth for v1.0 milestone phase decomposition,
adapter-method enumeration, and risk register. The 10 batch reports
(`BATCH-NN.md`) and the rubric (`RUBRIC.md`) are preserved for traceability
but not the canonical reference.

**Implication:** When v1.0 milestone scoping happens (in the fork repo),
the milestone's `ROADMAP.md` derives from SYNTHESIS.md §7 (8-phase scope),
its `REQUIREMENTS.md` derives from §4 (adapter interface) + §6 (open
questions), and its risk register derives from §9.

---

## D-2026-04-30-07 — Upstream PR #2898 reconciliation (durable planning runtime)

**Date:** 2026-04-30
**Decision:** **IRRELEVANT** to the StorageAdapter contract. PR #2898 lands `PlanningRuntime`, `PlanningJournal`, `RuntimeGate` classes that append JSONL events to `.planning/.journal/` for plan-execution event sourcing. This is a different layer (plan lifecycle events, not planning content) and operates on a separate path tree (`.planning/.journal/`).

**Contract impact:** NONE. The journal does not touch STATE.md, ROADMAP.md, or any document the StorageAdapter owns.

**Rebase risk:** LOW. Separate files, separate directory.

**Alternatives considered:** Should journal writes eventually flow through `adapter.putRecord`? Deferred — append-only JSONL semantics do not fit `putRecord/getRecord` cleanly. PR #2898's design explicitly chose a separate `PlanningJournal` class.

**Implication:** No changes needed to the StorageAdapter interface or MarkdownAdapter scaffold as a result of this PR. Monitor on rebase — if upstream routes journal writes through a storage seam in a future PR, reassess.

---

## D-2026-04-30-08 — Upstream PR #2901 reconciliation (planning-workspace seam)

**Date:** 2026-04-30
**Decision:** **REUSE**. PR #2901 extracts `planning-workspace.cjs` exposing `planningDir(cwd)`, `planningRoot()`, `planningPaths()`, `withPlanningLock()` from core.cjs. This is exactly the path-resolution seam MarkdownAdapter (Plan 03) needs. We import `planningDir` directly inside MarkdownAdapter to resolve `.planning/`-relative paths.

**Contract impact:** NONE on the StorageAdapter type signature. Implementation impact: MarkdownAdapter constructor calls `planningDir(projectDir)` to compute its path base.

**Rebase risk:** LOW. We consume the existing module, do not modify it.

**Alternatives considered:** Implement custom path-resolution logic inside MarkdownAdapter. Rejected — `planning-workspace.cjs` already handles workstream routing, project root detection, and path normalization. Wrapping avoids re-implementing battle-tested logic.

**Implication:** MarkdownAdapter (Plan 03) imports `planningDir` from `planning-workspace.cjs` via `createRequire`. No new dependency; the module is already present in the fork's working tree.

---

## D-2026-04-30-09 — Upstream PR #2908 reconciliation (manifest-backed routing seam)

**Date:** 2026-04-30
**Decision:** **COORDINATE**. PR #2908 adds `CommandManifestEntry` types, `COMMAND_MANIFEST` array, and `command-seam-coverage.test.ts`. The manifest covers command-routing inspection (`state | verify | init | phase | phases | validate | roadmap` families); our adapter seam covers storage pluggability. They are complementary, not competing.

**Contract impact:** NONE on the StorageAdapter shape. Plan 04 must update the one site (`registry-canonical-commands.ts:10`) where the manifest coverage test calls `createRegistry()` — no semantic change, just signature update.

**Rebase risk:** LOW-MEDIUM. Future upstream may add new manifest entries that need monitoring via leak-grep (this plan's deliverable).

**Alternatives considered:** Treat as IRRELEVANT and skip the `registry-canonical-commands.ts` update. Rejected — the test file calls `createRegistry()` and will fail to compile after Plan 04's signature change; updating it is mandatory to keep the suite green.

**Implication:** Plan 04 patches the single `registry-canonical-commands.ts` call site as part of the `createRegistry({adapter})` signature sweep. Future upstream manifest expansions are caught by leak-grep on rebase.

---

## D-2026-04-30-10 — Upstream PR #2909 reconciliation (golden parity matrix)

**Date:** 2026-04-30
**Decision:** **COORDINATE**. PR #2909 adds golden integration tests comparing SDK registry dispatch to CJS gsd-tools.cjs output for `phases.*`, `validate.*`, `roadmap.*`. Per CONTEXT.md D-13, Phase 1's CI does NOT need to pass the #2909 parity matrix — that is **Phase 8 (DIST-04)**. Phase 1 only updates the `createRegistry()` call signatures inside these tests via Plan 04.

**Contract impact:** NONE on the StorageAdapter type signature.

**Rebase risk:** MEDIUM. Future #2909 expansions add more `createRegistry()` call sites that need adapter injection. Plan 04 establishes the pattern; the rebase script (D-14, this plan) catches new call sites.

**Alternatives considered:** Defer ALL #2909 changes to Phase 8 (DIST-04). Rejected — the signature change in Plan 04 (`createRegistry({adapter})`) breaks these tests immediately; call-site updates are mandatory in Phase 1. What IS deferred is achieving empirical output parity with the golden matrix.

**Note:** This entry locks D-13's deferral. The empirical match against #2909's parity matrix is owned by Phase 8 (DIST-04).

**Implication:** Plan 04 updates all `createRegistry()` call sites in `golden.integration.test.ts` to pass `{adapter: new MarkdownAdapter(projectDir)}`. The tests may still fail due to parity gaps — that is acceptable in Phase 1. Phase 8 achieves full parity.

---

# Open questions deferred to v1.0 milestone phases

These were identified in SYNTHESIS.md §6 but are NOT blocking for Phase 1.
Each gets resolved when the relevant phase approaches.

| ID | Question | Phase that decides |
|----|----------|-------------------|
| OQ-01 | `commitPlanningState` semantics across adapters (no-op? checkpoint? transaction-close?) | Phase 3 (write methods) |
| OQ-02 | Section-scoped vs whole-file write granularity for canonical files | Phase 5 (foundational primitives) |
| OQ-03 | 2 raw-git outliers (`spec-phase`, `eval-review`) — fix vs leave | Phase 4 (workflow leaks) |
| OQ-04 | `<context>`-block leak mitigation (rewrite frontmatter at install? document constraint? force SDK route?) | Phase 4 (workflow leaks) |
| OQ-05 | Sidecar paths (`.next-call-count`, `tmp/*`) — generic kv or named methods | Phase 5 |
| OQ-06 | Knowledge-graph subsystem (`graph.json`) — separate `GraphAdapter`, sub-interface, or out-of-scope v1 | Phase 5/6 boundary |
| OQ-07 | "Scratch" record taxonomy — first-class types or generic kv | Phase 5 |
| OQ-08 | Markdown-and-lockfile helpers visibility — public interface or private to MarkdownAdapter | Phase 1 design call |
| OQ-09 | Init-bundle granularity — keep coarse Bin B methods or decompose | Phase 2 |
| OQ-10 | Multi-author file (AI-SPEC) concurrency — atomic `updateSection` enough or need locks | Phase 5 |

Each open question gets its own decision entry above when answered.
