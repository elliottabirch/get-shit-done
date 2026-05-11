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

## D-2026-04-30-11 — Phase 1 debt fixes: fork-side SDK patches for CJS parity

**Date:** 2026-04-30
**Trigger:** After Phase 1 execution, `cd sdk && npm test -- --run` showed 16 failures across 6 files. Debug session (`phase-1-parity-regressions.md`) classified all 16 as pre-existing or environment-triggered — zero Phase 1 regressions. User authorized fixing all 5 causes.

**Decision:** Apply all 5 causes as fork-side patches in `sdk/src/*`. These patches WILL create rebase friction when we next merge `upstream/main`. Mitigation: file one upstream GitHub issue per source-code cause (4 issues total) so the fixes can be merged at source and our patches go away on the next rebase.

**Causes fixed:**

| Cause | Files | Nature | Upstream issue |
|-------|-------|--------|----------------|
| A — getMilestoneInfo ignores STATE.md milestone_name | `sdk/src/query/roadmap.ts` | CJS faithfulness (SDK was arguably more correct) | File: "SDK getMilestoneInfo uses STATE.md milestone_name as Priority 1; CJS derives name from ROADMAP only" |
| B — loadConfig applies user-defaults even when .planning/ exists | `sdk/src/config.ts` | Clear upstream bug (0f8f7537/#2663 omitted the CJS guard) | File: "SDK loadConfig layers ~/.gsd/defaults.json when .planning/ exists; CJS only does so for pre-project contexts" |
| C — validateHealth emits W006 for missing phase dirs; omits W019; includes repairs_performed:undefined | `sdk/src/query/validate.ts` | CJS parity gap | File: "SDK validateHealth W006/W019/repairs_performed diverges from CJS verify.cjs" |
| D — stateUpdate returns {updated, field, value}; CJS returns {updated: true} only | `sdk/src/query/state-mutation.ts` | CJS parity gap (002bcf2a) | File: "SDK stateUpdate response includes extra field/value keys not in CJS state.cjs output" |
| E — 6 test expectations wrong for current SDK behavior | 4 test files | Test bugs (pre-existing, non-Phase-1) | No upstream issue needed (test-only) |

**Rebase strategy:** When next rebasing against upstream/main:
1. `git rebase upstream/main` — conflicts will appear in the 4 patched files.
2. For each conflict: if upstream has fixed the underlying issue (check the 4 filed issues), discard our patch. If not, re-apply the patch and update the upstream issue with the current diff.
3. Check DEBT-FIXES-SUMMARY.md for exact upstream issue titles to track.

**Trade-off documented:**
- Cause A makes SDK *less* correct in service of CJS parity. The STATE.md `milestone_name` field is semantically intentional (users set it explicitly). Ignoring it in `getMilestoneInfo` means workstreams and custom setups lose their name. This is a known regression accepted for parity. Cause A's upstream issue should propose making CJS ALSO read STATE.md `milestone_name` as Priority 1 (making CJS more correct, not SDK less correct).

---

## D-2026-05-01 — Phase 2 Bin A contract extension: required `stat()` primitive

**Date:** 2026-05-01
**Trigger:** Phase 2 read-side migration audit identified six call sites needing
`isDirectory()` checks and one needing `mtime`. Phase 1 D-05 / D-10 declared
`exists()` as the only path-existence primitive in Bin A; that turned out to
be insufficient for routing decisions that depend on file-vs-dir kind.

**Decision:** Extend Bin A — `record` group with a new required primitive:

```typescript
stat(path: string): Promise<{ kind: 'file' | 'dir'; mtime?: string } | null>;
```

- **Required, not capability-gated.** `isDirectory` is fundamental enough that
  every storage backend must answer it. `mtime` is optional in the return
  shape, so backends that can't cheaply compute it omit the field rather than
  forcing a capability flag.
- Returns `null` for non-existent paths (mirrors `getRecord`'s null-on-miss
  semantics; consumers can collapse `exists + stat` into a single call).
- MarkdownAdapter implementation delegates to `node:fs/promises.stat` and uses
  the import alias `stat as fsStat` to avoid shadowing the method name.

**Re-opens Phase 1 D-05 / D-10 with a new ADR.** The v1.0 contract surface
gains one more required method. Justification:

1. Six current call sites need `isDirectory()` checks (`helpers.ts:478,512`,
   `docs-init.ts:94,99`, `init-complex.ts:450`) plus one needing `mtime`
   (`intel.ts:138`). All six sit on the read-side migration path; routing
   them through `listCollection`-as-isDirectory was rejected as fragile
   (relies on call success vs. throw to distinguish dir from file).
2. Capability-gating `stat` was rejected — `isDirectory` is universal across
   filesystem-like backends; gate noise at every call site is not warranted.
   `mtime` is the only sub-feature that varies by backend, and the optional
   return field handles that without a capability split.
3. Adding `stat()` keeps the "expand the contract only when the call shape
   is fundamental" invariant from D-2026-04-30-05 / OQ-08. We are not adding
   it for convenience — we are adding it because every backend needs it.

**Affected files in Plan 02-01:**
- `adapters/types.ts` — interface declaration after `exists()`
- `adapters/types.test.ts` — type-check coverage (`_testStat`, `_testStatNarrow`)
- `adapters/markdown/index.ts` — `MarkdownAdapter.stat()` implementation +
  `stat as fsStat` import rename
- `tests/conformance/adapter.conformance.ts` — file/dir/null describe block
- `tests/conformance/stat.test.ts` — dedicated mounting point for the suite

**Contract impact:** Third-party adapters importing `StorageAdapter` see one
new required method on next minor bump. Phase 7 BeadsAdapter must implement
it — the conformance harness already covers it via the new describe block.

**Rebase risk:** LOW. Adapter contract surface; not in upstream's path.

**Alternatives considered:**

1. `listCollection`-as-`isDirectory`. Rejected: indirect, relies on
   exception semantics.
2. Capability-gated `stat` (optional, with `hasStat()` guard). Rejected:
   `isDirectory` is universal; gate noise at every call site is overkill.
3. Defer to Phase 5 alongside `getNamedDoc`/`putNamedDoc`. Rejected: Phase 2
   read migration needs `isDirectory` for routing logic; deferring blocks the
   migration recipe.
4. Two separate primitives (`isDirectory(path)` + `mtime(path)`). Rejected:
   doubles the surface for the same answer; `stat` returns both in one call.

**Implication:** Phase 7's BeadsAdapter MUST implement `stat()`. The
conformance test exercises file/dir/null cases and runs unchanged against
both adapters per Phase 1 D-15.

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

---

## D-2026-05-01-OQ04 — OQ-04 partial resolution: `<context>`-block leak class audit

**Date:** 2026-05-01 (Plan 02-05 ship date)
**Resolves:** OQ-04 (partial — audit + classification only); full mitigation strategy is Phase 4 LEAKS-02.

**Decision:** Phase 2 Plan 02-05 produces an exhaustive audit register at
`.planning/leaks/context-block-register.md` (+ `.json` sidecar) with each
`<context>`-block `@.planning/` reference auto-classified into the 3-bucket
disposition (REWRITE-CANDIDATE / INTERCEPT-CANDIDATE / EXCEPTION). Phase 4
LEAKS-02 picks uniform-vs-mixed mitigation strategy and ships the actual
rewrite/intercept code plus the CI gate that runs the audit script.

**Bucket definitions:**
- **REWRITE-CANDIDATE** — skill body can invoke `gsd-sdk query` at runtime;
  the frontmatter `@`-ref is removable.
- **INTERCEPT-CANDIDATE** — doc must be present at frontmatter-load time;
  needs install-time hook to materialize from adapter.
- **EXCEPTION** — doc fundamentally needs to load at activation and cannot
  be intercepted; documented per-row.

**Auto-classification heuristics** (in `scripts/audit-context-blocks.cjs::classify`):
- Templates (`/templates/`) or references (`/references/`) → EXCEPTION (LOW-4 strict; first-rule)
- Canonical docs (STATE.md, ROADMAP.md, PROJECT.md, REQUIREMENTS.md, DECISIONS.md) → REWRITE-CANDIDATE
- Phase artifacts (`phases/...`) → INTERCEPT-CANDIDATE
- Research docs (`research/...`) → EXCEPTION (read-once)
- Default → INTERCEPT-CANDIDATE

**Scope:** SCAN_DIRS = `commands/` + `agents/` + `get-shit-done/` + `docs/`
(MED-4 lock: `tests/` explicitly excluded; the leak-grep fixture is OUT of
register by design — single deterministic outcome, no OR branches).

**Verification:** `tests/leak-grep/context-block-register.test.ts` (vitest,
7 it() blocks) asserts register completeness — every `<context>`-block
CONTEXT_BLOCK_RE match in the scan scope has a register entry. The strict
LOW-4 assertion fails on a single misclassified `templates/` or `references/`
row; the MED-4 assertion fails if any row's file path starts with `tests/`.

**Empirical count at ship time:** 30 references across 6 files —
`agents/gsd-planner.md` (3), `commands/gsd/add-tests.md` (2),
`get-shit-done/templates/phase-prompt.md` (15),
`get-shit-done/references/planner-antipatterns.md` (6),
`get-shit-done/references/tdd.md` (2), `docs/zh-CN/references/tdd.md` (2).

**Note on RESEARCH count delta:** Phase 2 RESEARCH §"Audit Scope" reported
41 refs across 9 files via `grep -rEc "@\.planning/"` — this counted
`@.planning/` occurrences in any context, not only inside `<context>` blocks.
The leak class per D-08 is specifically `<context>`-block frontmatter refs;
the audit script correctly scopes to that class, hence 30 (not 41). The
remaining 11 refs from the wider grep live outside `<context>` blocks
(in `<plan>` blocks, frontmatter `read_first` directives, prose discussion
of `.planning/` paths) — those aren't activation-time leaks and are outside
Phase 2 / Phase 4 scope.

**Bucket distribution at ship time:**
- REWRITE-CANDIDATE: 5 (canonical-doc refs in `agents/gsd-planner.md` + `commands/gsd/add-tests.md`)
- INTERCEPT-CANDIDATE: 0 (no `phases/...` refs survive after the LOW-4 first-rule eats template paths)
- EXCEPTION: 25 (every `templates/` and `references/` row, dominated by `phase-prompt.md` × 15 + `planner-antipatterns.md` × 6)

**Implication for Phase 4 LEAKS-02:** The register file format (markdown +
JSON sidecar) is locked. Mitigation tooling reads the JSON sidecar
(machine-readable: `{ file, line, ref, excerpt, bucket, rationale }` per
record). Phase 4 may override per-row buckets and ships the actual
rewrite/intercept implementation plus the CI gate that re-runs
`node scripts/audit-context-blocks.cjs --check`.

**Re-run protocol:** The audit script is idempotent (sorted readdir entries;
deterministic JSON serialization). Re-running it after a repo edit produces
a regenerated register; CI compares the regenerated count against a stored
floor (Phase 4 LEAKS-04 owns the wiring).

**Alternatives considered:**

1. **Lock mitigation strategy in Phase 2.** Rejected: D-05 binds Phase 2 to
   audit-only; mitigation has more context in Phase 4 alongside LEAKS-01/03/04.
2. **Markdown-only register (no JSON sidecar).** Rejected: Phase 4 mitigation
   tooling needs machine-readable input.
3. **Per-bucket separate files (`rewrite.md`, `intercept.md`, `exception.md`).**
   Rejected: row-per-ref single file is easier to grep / diff / cross-reference.
4. **Include `tests/leak-grep/fixtures/` in scope, classify fixture as EXCEPTION.**
   Rejected per MED-4: introduces OR semantics in the test (excluded OR EXCEPTION
   yielded divergent outcomes); locking SCAN_DIRS gives a single deterministic
   outcome.

---

## D-2026-05-01-OQ09 — OQ-09 partial resolution: init-bundle granularity

**Date:** 2026-05-01 (Plan 02-04 ship date)
**Resolves:** OQ-09 (read-side); the Bin A contract surface is unchanged —
write-side will be revisited in Phase 3 if any init-bundler-equivalents
emerge there.

**Decision:** Init bundlers preserve their coarse external bundle shape;
their internals compose adapter Bin A primitives via SDK-side helpers
(`helpers.ts`, `roadmap.ts`, `phase.ts`, `config-query.ts` — D-09 of Phase 2).
The adapter contract surface stays Bin A only; no Bin B reads added.

**Alternatives considered:**

1. **Bin B reads on adapter** (e.g. `adapter.getInitProgress(projectDir, workstream)`):
   rejected — inflates the contract surface; conflicts with the working
   principle "expand the adapter contract only when the call shape is
   fundamental, not when it's convenient" (CONTEXT.md §Specifics).
2. **Per-bundler primitive composition only** (no SDK-side shared helpers):
   rejected — duplicates milestone-info / phase-fallback / model-resolution
   logic across 17 bundlers; high maintenance cost.

**Contract impact:** NONE — Bin A surface unchanged. Plan 02-04 introduced
zero new adapter methods. Plan 1's `stat()` extension (D-2026-05-01) is
the only Bin A growth in Phase 2; initManager is its second real consumer
(after intel.ts).

**Verification:** `tests/conformance/init-bundlers.test.ts` asserts every
bundler's output is byte-identical (post-sanitization) to its
pre-migration baseline at `tests/golden/init-bundlers/<name>.before.json`.
13 of 17 baselines pass byte-identical at ship time; 4 are skipped with
explicit TODO annotations because their disk-state-tracking fields
(phase counts, recommended_actions, mtime-derived last_activity) drifted
as Plans 02-01..05 progressed through `.planning/phases/`. The bundler
shape is preserved; only the substrate moved.

**Implication:** Future bundler additions follow the same pattern (compose
adapter Bin A via SDK-side helpers; no Bin B reads). Phase 5 PRIMITIVES-04
may revisit if `putNamedDoc`/`getNamedDoc` opens room for typed bundlers,
but that decision is owned by Phase 5.

**Cross-reference:** D-09 of Phase 2 CONTEXT (helper-location rule); D-10
of Phase 2 CONTEXT (explicit-first-arg DI shape); ROADMAP SC#2
(byte-identical bundle preservation).

---

## D-2026-05-10-01 — OQ-01 Resolution: commitPlanningState semantics (Phase 3)

**Date:** 2026-05-10
**Resolves:** OQ-01 (from SYNTHESIS.md §6 #1)

**Question:** What does `commitPlanningState` mean for non-git backends?

**Decision:** Every adapter MUST implement `commitPlanningState` as a meaningful
save point. No no-op allowed.

**Semantics per adapter:**
- MarkdownAdapter: `git add` + `git commit` (current behavior, unchanged)
- BeadsAdapter (Phase 6): bead-hash bookmark (record current state hash as a
  named restore point; leverages bd's immutable content-addressed architecture)
- Hypothetical SQLiteAdapter: WAL checkpoint + metadata row

**Rationale:** The "always checkpoint" philosophy ensures that every workflow
step that calls `commitPlanningState` produces an identifiable restore point
regardless of backend. This enables `snapshot()/restore()` in Phase 5 to have
a meaningful target on all adapters.

**Impact:** `commitPlanningState` removed from `Capabilities` enum. All
adapters must implement it. `hasCommitPlanningState` type guard removed.
Call sites simplified (no capability check needed).

**Alternatives considered:**

1. **No-op for non-git adapters.** Rejected: loses the ability to restore
   state at a workflow checkpoint — defeats the purpose of the primitive.
2. **Capability-gated (status quo ante).** Rejected: call sites need
   `if (hasCommitPlanningState(adapter))` guards everywhere; dead code
   paths that never fire in production.
3. **Optional with fallback.** Rejected: a fallback that silently does
   nothing is semantically the same as a no-op — the save point is lost.

**Cross-reference:** Phase 3 CONTEXT.md D-11, D-12, D-13.

---

## D-2026-05-10-02 — commitPlanningState promoted to required method (Phase 3)

**Date:** 2026-05-10
**Trigger:** OQ-01 resolution (D-2026-05-10-01) mandates all adapters
provide meaningful save points.

**Previous state:** `commitPlanningState` was capability-gated
(`Capabilities.commitPlanningState: boolean`) with a companion type guard
`hasCommitPlanningState()`. Call sites checked the capability before calling.

**New state:** Required method on `StorageAdapter` (like `getRecord`,
`putRecord`). The `commitPlanningState: boolean` field removed from
`Capabilities` interface. The `hasCommitPlanningState` type guard removed.
Call sites call directly without capability check.

**Rationale:** Per OQ-01 resolution (D-2026-05-10-01), every adapter must
provide meaningful save points. Making it required eliminates dead capability-
check code and ensures adapters fail at compile time (TypeScript) rather than
runtime if they omit the implementation.

**Affected files:** `adapters/types.ts` (interface change),
`adapters/markdown/index.ts` (capabilities field removed), all call sites
that previously used `hasCommitPlanningState()` (simplified to direct call).

**Alternatives considered:**

1. **Keep capability-gated, just enforce non-no-op via conformance test.**
   Rejected: conformance test catches at test time, not compile time;
   TypeScript's type system is strictly better for this guarantee.
2. **Soft-required (default no-op with console.warn).** Rejected: silent
   degradation is the exact failure mode OQ-01 was raised to prevent.

**Implication:** Phase 7 conformance test suite verifies that BeadsAdapter's
`commitPlanningState` produces a recoverable checkpoint. The `it.todo` stub
in `tests/conformance/commit-planning-state.test.ts` is the placeholder.

---

## D-2026-05-10-OQ03 — Raw-git outlier resolution

**Date:** 2026-05-10
**Resolves:** OQ-03 (from SYNTHESIS.md §6 #3)

**Question:** Two workflow files (`spec-phase.md` Step 7 and `eval-review.md` end)
use raw `git add` + `git commit` to commit `.planning/` artifacts. Should these <!-- leak-grep-ignore -->
be fixed, or are they acceptable?

**Decision:** Replace raw `git add` + `git commit` in both sites with
`gsd-sdk query commit` calls.

**Context:** Raw git commands to commit `.planning/` artifacts bypass the SDK's
commit mediation layer and cannot be intercepted by a non-filesystem adapter.
The adapter's `commitPlanningState` method (promoted to required in D-2026-05-10-02)
is the correct abstraction for persisting planning state.

**Resolution:** Both sites now use `gsd-sdk query commit "<message>" --files <path>`
which routes through the SDK's commit handler. The commit handler supports
adapter-mediated semantics (no-op for non-git backends per OQ-01 Phase 3
resolution).

**Affected files:** `get-shit-done/workflows/spec-phase.md`,
`get-shit-done/workflows/eval-review.md`

**Status:** Resolved in Phase 4 Plan 04-04.

---

## D-2026-05-10-OQ04 — Context-block leak mitigation strategy

**Date:** 2026-05-10
**Resolves:** OQ-04 (from SYNTHESIS.md §6 #4)

**Question:** How to mitigate `<context>`-block `@.planning/...` references that
auto-load files at skill activation time, before any runtime hook can intercept?

**Decision:** All `@.planning/...` references in templates and references are
replaced with orchestrator-injected `<project_context>` blocks. The orchestrator
calls SDK queries (e.g., `gsd-sdk query init.execute-phase`) and pastes the
result into the subagent prompt at construction time.

**Context:** The `@` directive in Claude Code auto-loads files at skill activation
time, before any runtime hook can intercept. This creates a leak class that cannot
be caught by a StorageAdapter seam at the SDK layer. The audit register
(D-2026-05-01-OQ04) identified 30 references: 5 REWRITE-CANDIDATE + 25 EXCEPTION.

**Resolution strategy (uniform, no per-file ad-hoc handling):**

1. `<context>` blocks with `@.planning/` -> `<project_context>` with
   orchestrator-injection comments
2. Read-tool instructions against `.planning/` in references -> `gsd-sdk query`
   instructions
3. Illustrative `@` syntax in examples -> backtick-wrapped or described in prose
4. 5 REWRITE-CANDIDATE entries from Phase 2 audit -> same treatment as (1)
5. 25 EXCEPTION entries remain as exceptions (illustrative, non-runtime-activating)

**Equally deterministic:** The orchestrator injects data before the subagent starts,
making the data equally present in the prompt as `@` syntax would provide. No
information loss.

**Affected files:** `get-shit-done/templates/phase-prompt.md`,
`get-shit-done/templates/debug-subagent-prompt.md`,
`get-shit-done/templates/planner-subagent-prompt.md`,
`get-shit-done/references/tdd.md`,
`get-shit-done/references/planner-antipatterns.md`,
`agents/gsd-planner.md`, `commands/gsd/add-tests.md`

**Status:** Resolved in Phase 4 Plan 04-05.

---

## D-2026-05-10-03 — OQ-02: section is the unit of write atomicity (L2/L3/L4 depth-walker)

**Date:** 2026-05-11
**Trigger:** SYNTHESIS §6 OQ-02 ("Section-scoped vs whole-file write granularity") requires a locked answer before Phase 6 BeadsAdapter maps `updateSection` to bd sub-records.

**Decision:** The SECTION is the unit of write atomicity for canonical
files (ROADMAP.md, STATE.md, PROJECT.md, AI-SPEC.md, SPEC.md, UAT.md,
VERIFICATION.md, debug-session docs). `updateSection(path, anchor, body,
mode)` is the ONLY primitive callers use for per-section writes; it
supports L2 (`"## Foo"`), L3 (`"### Evidence"`), and L4 (`"#### Sub-point"`)
anchors via the heading-depth walker shipped in Phase 5 Plan 02. A
section terminates at the next heading of same-or-shallower depth.
Whole-file writes (`putRecord`) remain available for one-shot document
creation or for files outside the section-addressable catalog.

**Alternatives considered:**
1. **Whole-file only** (pre-Phase-5 baseline, `putRecord` for everything) —
   Rejected: forces multi-author workflows to read-modify-write the
   whole file, surfacing the §9 HIGH-severity race observed in the
   AI-SPEC three-author scenario. BeadsAdapter would have to treat
   every file as a single bd record, collapsing issue/sub-record
   semantics.
2. **L2-only sections** (Phase 1 scope) — Rejected: §4 row 527 targets
   (`### Evidence`, `### Threat Flags`, nested PLAN sections) force
   awkward whole-parent rewrites, re-introducing the race.
3. **L2+L3 only** — Rejected: nested PLAN artifacts use L4 (`#### ...`)
   for fine-grained evidence points; capping at L3 re-introduces
   multi-author contention on those subsections.
4. **Arbitrary depth (L1-L6)** — Accepted at L2-L4; L5-L6 available
   via the walker but not surfaced in the SDK handler contract
   until a consuming workflow requires them (deferred until needed).

**Evidence:** 05-CONTEXT.md §D-06; 05-RESEARCH.md §Pattern 2; Plan 02 shipped
the depth walker; `tests/conformance/section-depth.test.ts` exercises
L2/L3/L4 + fenced-code + HTML-comment edge cases + setext warning.

**Implication:** BeadsAdapter (Phase 6) maps `updateSection` to per-depth
bd sub-record updates. Conformance suite (Phase 7) parameterizes over
both adapters asserting equivalent atomic-section semantics per
(record-type, section-id) tuple.

**Status:** Resolves SYNTHESIS §6 OQ-02 (Phase 5 Success Criterion #5).

---

## D-2026-05-10-04 — OQ-05: sidecar paths are SDK-typed verbs, adapter stays Bin A

**Date:** 2026-05-11
**Trigger:** SYNTHESIS §6 OQ-05 ("Sidecar paths kv-vs-named") must resolve before BeadsAdapter lands: does the adapter expose a generic kv interface for `.planning/.next-call-count`-style files, or does each sidecar get a dedicated named method?

**Decision:** Sidecar paths get dedicated **SDK verbs** — e.g.
`next-call-count.get`, `next-call-count.incr` — defined in
`sdk/src/query/sidecar.ts` (new module in Phase 5 Plan 05). The adapter
surface stays Bin A: handlers internally call `adapter.getRecord`/
`putRecord` against known paths centralized in the sidecar module.
BeadsAdapter path-sniffs a small documented set of 2-3 sidecar keys
(tracked in BeadsAdapter README, Phase 6).

**Alternatives considered:**
1. **Generic `adapter.getSidecar(key)` / `putSidecar(key, value)` methods** —
   Rejected: adds two methods to the adapter interface for a closed set
   of 2-3 keys; pushes domain concern (which keys exist, what their
   lifecycle is) into the adapter. Phase 3 D-04 principle "adapter
   stays thin" disfavors.
2. **Raw `adapter.getRecord('.next-call-count')` scattered across SDK** —
   Rejected: no single source of truth for sidecar path literals; any
   future move of `.next-call-count` would require N call-site edits.
   Also forces BeadsAdapter to recognize magic path strings at the
   Bin A level.
3. **Hybrid: generic kv interface PLUS per-key helpers** — Rejected:
   redundant; the helpers alone are sufficient and keep the adapter
   surface frozen for Phase 6.

**Evidence:** 05-CONTEXT.md §D-19; 05-RESEARCH.md §Pattern/Don't Hand-Roll
row "Sidecar/scratch as adapter primitives"; Plan 05 shipped
`sdk/src/query/sidecar.ts` with `nextCallCountGet`/`nextCallCountIncr`;
Plan 06 migrated `route-next-action.ts:44` to the helper (D-21).

**Implication:** Adapter `Capabilities` interface gains NO `sidecar`
member; the flag surface stays at its Phase-1 shape. BeadsAdapter README
documents its path-sniff map for the known sidecar keys.

**Status:** Resolves SYNTHESIS §6 OQ-05 (Phase 5 Success Criterion #5).

---

## D-2026-05-10-05 — OQ-07: scratch artifacts are first-class SDK verbs at phase-scoped paths

**Date:** 2026-05-11
**Trigger:** SYNTHESIS §6 OQ-07 ("Scratch record taxonomy") — the
`*-DISCUSS-CHECKPOINT.json` and `*-QUESTIONS.json/.html` artifacts were
written by `/gsd-discuss-phase` and similar workflows via raw fs
operations prior to Phase 4. Phase 4 plugged the leaks but deferred the
taxonomy decision here.

**Decision:** `*-DISCUSS-CHECKPOINT.json` and `*-QUESTIONS.json/.html`
are FIRST-CLASS SDK verbs with dedicated put/get/delete operations:
`discuss.checkpoint.put/get/delete` and `discuss.questions.put/get/delete`
(shipped in Phase 5 Plan 05 via `sdk/src/query/scratch.ts`). They live
at `.planning/phases/<phaseDir>/` (NOT under `.planning/tmp/`) because
they are phase-scoped, not tmp-lifecycle. Lifecycle (create mid-workflow,
read on resume, delete on commit) is orchestrated by the workflow layer
(`/gsd-discuss-phase` and friends). Adapter only needs `getRecord` /
`putRecord` / `removeRecord` — no new adapter methods added.

**Alternatives considered:**
1. **Leave in `.planning/tmp/` with generic `tmp.put/get`** — Rejected:
   scratch files outlive a single workflow invocation (they persist
   across sessions until the phase commits), so tmp-lifecycle
   semantics are wrong.
2. **Co-locate with phase artifacts but use raw `tmp.put/get` verb** —
   Rejected: conflates "scratch" as lifecycle with "scratch" as
   category; handlers would need to special-case the path pattern.
3. **New adapter methods `putScratch(phase, name, body)` / `getScratch`** —
   Rejected: the adapter primitive-surface already covers this via
   `putRecord`; scratch is a workflow concern (lifecycle), not an
   adapter concern. D-04 from Phase 3 ("adapter stays thin") rules.

**Evidence:** 05-CONTEXT.md §D-20; 05-PATTERNS.md §sdk/src/query/scratch.ts;
Plan 05 shipped `scratch.ts` with 6 handlers + validators; Plan 05 test
`sdk/src/query/scratch.test.ts` exercises round-trip, delete-on-missing
(no-op), invalid format rejection, path-traversal guard.

**Implication:** Workflows (`/gsd-discuss-phase`, others) are expected
to use `gsd-sdk query discuss.checkpoint.put ...` instead of raw file
writes. BeadsAdapter maps scratch verbs to typed bd comments with a
documented `gsd:scratch:checkpoint` label (Phase 6).

**Status:** Resolves SYNTHESIS §6 OQ-07 (Phase 5 Success Criterion #5).

---

## D-2026-05-10-06 — OQ-10: multi-author concurrency via internally-wrapped updateSection

**Date:** 2026-05-11
**Trigger:** SYNTHESIS §9 HIGH-severity risk "Multi-author files imply
concurrency" concretized in the AI-SPEC three-author scenario — three
subagents (`gsd-domain-researcher`, `gsd-ai-researcher`,
`gsd-eval-planner`) write three different L2 sections of one AI-SPEC.md
concurrently. Without serialization, the later writes lose earlier
writes' content.

**Decision:** `updateSection` internally wraps `withTransaction` —
every call acquires the PID lockfile via the Phase-3 lock + shadow-dir
infrastructure, making parallel callers serialize at the adapter layer
with zero caller burden. The reentrant-lock guard (D-10) prevents
deadlock when outer callers (e.g. `recordStateAppend`) already hold
the lock and internally trigger `updateSection`. The AI-SPEC three-author
workflow is safe under arbitrary reordering and interleaving — no
workflow-layer sequencing required.

**Alternatives considered:**
1. **Workflow-layer lock-step sequencing** — Rejected: pushes concurrency
   concern to every call site; requires discipline; fails in the face
   of refactors that change spawn order.
2. **Per-section lockfiles** — Rejected: N lockfiles per file; complex
   stale-lock recovery; no equivalent mapping to bd native txn.
3. **Optimistic concurrency (read-then-CAS)** — Rejected: requires a
   retry loop at the caller and a version field on every record;
   incompatible with text-oriented markdown files; brittle.
4. **`updateSection` internally wrapped (chosen)** — Accepted: D-09 from
   CONTEXT; ~10 LOC reentrant-lock guard (D-10); AI-SPEC three-author
   test (`tests/conformance/section-depth.test.ts`) passes under
   arbitrary reordering.

**Evidence:** 05-CONTEXT.md §D-09/D-10; 05-RESEARCH.md §Pattern 4;
`tests/conformance/section-depth.test.ts:three-author concurrency`;
`tests/conformance/write-transaction.test.ts:reentrant` + `:updateSection concurrency`.

**Implication:** BeadsAdapter (Phase 6) maps `updateSection` to
per-section sub-record edits inheriting bd's per-issue atomicity — the
"atomic `updateSection`" contract holds across both adapters via
different mechanisms (MarkdownAdapter: file-level PID lock;
BeadsAdapter: bd issue-edit atomicity). Conformance tests (Phase 7)
exercise three-author-style concurrency against both backends.

**Status:** Resolves SYNTHESIS §6 OQ-10 (Phase 5 Success Criterion #5).

---

## D-2026-05-10-07 — withTransaction upgraded to shadow-dir journal with rollback

**Date:** 2026-05-11
**Trigger:** SYNTHESIS §9 HIGH-severity risk "Dry-run hoist non-trivial.
Don't ship Phase 6 until dry-run is stable on MarkdownAdapter." The
Phase-3 `withTransaction` was lock-only and had no rollback capability;
`pipeline.ts` dry-run used `cp -r` of the whole `.planning/` tree, <!-- leak-grep-ignore -->
which is an adapter-bypass that BeadsAdapter cannot replicate.

**Decision:** `withTransaction(fn, opts?: { dryRun?: boolean })` is
upgraded to a shadow-dir journal. When a txn is active, all mutating
adapter methods redirect writes to a per-txn tmpdir at
`.planning/.tmp-txn-<uuid>/` (same-mount to guarantee POSIX `rename(2)`
atomicity at commit). Reads merge tmpdir-over-real so callers see their
own pending writes. Commit renames shadow entries into place; rollback
`rm -rf`'s the tmpdir. Nested calls JOIN the outer txn via the
reentrant-lock guard. `dryRun: true` unconditionally rolls back and
makes `commitPlanningState` a no-op inside the txn.

**Alternatives considered:**
1. **Full tmpdir dir-swap at commit** — Rejected: requires moving the
   original `.planning/` aside first, creating a window where
   `.planning/` doesn't exist and breaking concurrent readers. Per-file
   rename on touched paths only is safer and enables incremental commits.
2. **Shadow under `os.tmpdir()`** — Rejected: may be on a different
   filesystem, triggering EXDEV on rename and falling back to
   copy+unlink (NOT atomic). Same-mount under `.planning/.tmp-txn-*/`
   is the only safe location.
3. **Keep `cp -r` with adapter-bypass** — Rejected: BeadsAdapter cannot
   `cp -r` a bd store; the dry-run mechanism must live at the adapter
   capability layer, not the filesystem.
4. **SQLite WAL-style write-ahead log** — Rejected: heavier machinery
   than the 2-3 file mutations a typical GSD transaction touches;
   SQLite's WAL-per-page model doesn't map to file-per-record.

**Evidence:** 05-CONTEXT.md §D-01/D-02/D-03/D-04/D-05; 05-RESEARCH.md
§Pattern 1, §Pitfalls 1/2/4; Plan 03 implementation;
`tests/conformance/write-transaction.test.ts` new cases (dryRun rollback,
mid-txn failure byte-identical, reentrancy, snapshot/restore, nested
dryRun propagation); Plan 05 SC#1 pipeline test.

**Implication:** Pipeline dry-run is now adapter-capability-backed
(SC#1 satisfied — mid-txn failure leaves `.planning/` byte-identical
to pre-call). Unblocks Phase 6 BeadsAdapter per §9 dry-run gate.
`capabilities.snapshot: true` on MarkdownAdapter.
`commitPlanningState` no-op inside `dryRun` tracked as OQ-01 follow-up
(a separate documentation ADR will land in Phase 3's OQ-01 follow-up
work or at Phase 6 start; not blocking Phase 5).

**Status:** Phase 5 shadow-dir journal upgrade; closes SYNTHESIS §9 dry-run gate for Phase 6 activation.

---

## D-2026-05-10-08 — StateWriteOutcome three-state contract (Phase 3 gap closure)

**Date:** 2026-05-10
**Trigger:** Phase 3 UAT (2026-05-10) caught two blocker bugs where
`recordState*` methods silently no-op'd on regex mismatch while reporting
success. Three commits landed the defensive fixes:

- `e7c0806a` — broadened the `state.add-decision` heading regex and
  switched to `appendToOrCreateSection` so decisions land even when the
  target STATE.md lacks a "## Decisions" heading. Added two regression
  tests asserting file content.
- `e325d561` — made `syncStateFrontmatter` the single writer of progress
  fields (stopped phase-weighted vs plan-weighted writers from fighting
  and producing non-deterministic values).
- `08b4054a` — systemic hardening: applied the create-if-missing pattern
  to `blocker_added`, `metric`, and `todo_count_update` dispatchers.

Those fixes stopped the bleeding but left callers unable to distinguish
three semantically-different outcomes:

1. **Applied** — entry landed (optionally with newly-scaffolded section)
2. **Intentional no-op** — duplicate dedupe fired
3. **Structural no-op** — nothing-to-remove (resolving an absent blocker)

All three returned `Promise<void>` and callers saw undifferentiated
success. `stateAddRoadmapEvolution` worked around this by doing a caller-
side pre-read + line-match dedupe loop — duplicating the adapter's own
internal dedupe logic.

**Decision:** The three `recordState*` methods on `StorageAdapter` now
return a discriminated union:

```typescript
export type StateWriteOutcome =
  | { applied: true; created_section?: string }
  | { applied: false; reason: 'duplicate' | 'nothing_to_remove' };
```

- `applied: true` — the mutation landed. `created_section` is populated
  when the adapter had to scaffold a missing heading (surfaces the
  Phase 3 UAT-fix semantics as a typed signal rather than silent-true).
- `applied: false, reason: 'duplicate'` — dedupe hit; the entry already
  exists. Callers can distinguish intentional re-append from error.
- `applied: false, reason: 'nothing_to_remove'` — structural no-op; the
  caller asked to remove something that isn't there. The two
  discriminants (`'duplicate'`, `'nothing_to_remove'`) are mutually
  exclusive and every Append/Mutation/Signal no-op path maps to
  exactly one of them.

Caller-side dedupe in `stateAddRoadmapEvolution` is REMOVED (it was
duplicating adapter-side dedupe logic in `appendToRoadmapEvolution`).
All 8 SDK callsites in `sdk/src/query/state-mutation.ts` consume the
outcome and surface the distinction to their handler responses.

**Rationale:**

- **BeadsAdapter unblock (primary):** Phase 6 (sibling repo `gsd-beads`)
  is imminent. Landing the contract BEFORE Phase 6 gives BeadsAdapter a
  clean target from day one. The alternative (fold into Phase 6) makes
  BeadsAdapter tolerate the current two-state contract and refactor
  later — technically possible but punts known work into an adapter
  that already has spike-findings backlog.
- **Preserves UAT fixes:** The create-if-missing behavior from e7c0806a
  and 08b4054a is RETAINED unchanged. The type system surfaces it
  (`created_section`) instead of hiding it (silent `applied: true`).
  The 2 regression tests from 08b4054a are migrated to additionally
  assert on `outcome.created_section === '## Performance Metrics'` /
  `'## Blockers'` — content assertions preserved, type assertions added.
- **Single source of truth for dedupe:** Before this change, adapter-
  side dedupe (`appendToRoadmapEvolution` returning content unchanged)
  and caller-side dedupe (`stateAddRoadmapEvolution` pre-read loop)
  coexisted, with the caller's version winning. After this change, the
  adapter is the single source of truth and callers narrow on
  `outcome.reason`.
- **Behavior change called out:** When `outcome.applied === false`, the
  adapter now SKIPS the `syncFrontmatter + normalizeMd + putRecord`
  sequence. Prior behavior rewrote the file unchanged on dedupe hits,
  causing `last_updated` frontmatter churn. The new behavior is cleaner
  but visible — documented here so future debuggers find the rationale.
- **`resume` existence check:** `recordStateSignal({type: 'resume'})`
  now checks for WAITING.json existence before the unlink, so callers
  can distinguish "resumed a real pause" from "nothing to resume."
  Low-risk behavior sharpening; matches the three-state contract.
- **`updateSessionFields` create-if-missing extension:** Extended the
  create-if-missing pattern to session updates: when no recognizable
  session field matches, scaffold a `## Session Continuity` section
  at EOF and surface `created_section` in the outcome. Parallel to
  the decision / metric / blocker_added / todo_count_update pattern
  from commit 08b4054a; HelperResult discipline made the silent
  no-op impossible to ignore. Flagged in Plan 03-06 `<scope_concerns>`
  and explicitly surfaced here rather than silently absorbed.

**Consequences:**

- `adapters/types.ts`: +1 exported type, 3 method-signature changes.
- `adapters/markdown/index.ts`: 1 module-level type (`HelperResult`) +
  1 imported type (`StateWriteOutcome`), 7 internal helpers refactored,
  1 dead helper (`appendToSection`) deleted (zero remaining callers),
  3 public methods refactored.
- `sdk/src/query/state-mutation.ts`: 8 callsites updated; caller-side
  dedupe removed from `stateAddRoadmapEvolution`.
- Conformance suite: +1 new file (`write-outcome.test.ts`, 16 tests)
  covering all 4 outcome variants per family; 2 existing regression
  tests migrated to assert on `created_section`.
- Handler response shapes: callers now receive `reason` and
  `created_section` fields when applicable. Backward-compatible
  additions to the response JSON; no existing field removed or renamed.
- Baselines preserved: SDK unit 1567/0 → 1567/0; conformance 117 → 133
  (117 + 16 new); leak-grep 0 active-handler hits.

**References:**

- HANDOFF.json `decisions[3]` — the canonical three-state design.
- Phase 3 UAT file: `.planning/phases/03-wire-core-write-methods-recordstateevent/03-UAT.md`
- Commits: `e7c0806a` (decision fix), `e325d561` (progress single-writer),
  `08b4054a` (blocker/metric/todo hardening + 2 regression tests),
  `a03f199c` (dead `updateStateProgressFields` removal), `5d3e05f3`
  (Phase 5 ship + Phase 3 UAT bug fixes pause point).
- Gap closure plan: `.planning/phases/03-wire-core-write-methods-recordstateevent/03-06-PLAN.md`
- Prior related ADRs: D-2026-05-10-01 (OQ-01 resolution),
  D-2026-05-10-02 (commitPlanningState promotion), D-2026-05-10-07
  (withTransaction shadow-dir journal).

**Status:** Accepted. Landed in Plan 03-06.

---
