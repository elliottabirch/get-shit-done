# Phase 8: Migration + distribution — Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 closes v1.0 by shipping the three user-facing deliverables that turn the
adapter seam (Phases 1–7) into a usable product:

1. **Config-driven adapter selection** — `storage.adapter: beads` in
   `.planning/config.json` routes every adapter call through BeadsAdapter;
   default (no setting) preserves byte-identical behavior to upstream GSD.
2. **A migration path** from an existing markdown `.planning/` tree to a bd
   store, implemented in the sibling repo and surfaced from the fork.
3. **A distribution story** — documented rebase playbook against upstream,
   a strict-superset parity gate in CI against upstream's #2909 golden
   suite, and an eventual ADR on PR-vs-long-lived-fork (deferred to
   phase-end, not in initial plan scope).

This phase also carries **Pre-0**: the SDK alias-generator rewrite carried
over from Phase 7 §C.1 (see ROADMAP.md Phase 8 plan list). That is a
standalone, mechanical cleanup that unblocks the `if: false` bypass in
`.github/workflows/test.yml` — prerequisite for the parity CI plan to
land cleanly.

**Out of scope for discussion (defer to phase-end):**
- DIST-05 — PR-vs-fork decision ADR. The inputs (upstream's response to
  #2898 / #2901 / #2908, fork's own Phase 8 execution learnings) aren't
  stable until the rest of Phase 8 lands. The phase plan list will
  include a placeholder DIST-05 plan that writes the ADR at close.

</domain>

<decisions>
## Implementation Decisions

### Plan split (6 plans total)

- **D-01:** One plan per requirement. Pre-0 (alias-generator rewrite) +
  DIST-01..05 = 6 plans. Matches Phase 7's 8-plan structure; atomic
  commits per plan; easier to isolate regressions during execution.
- **D-02:** DIST-05 plan is a placeholder that writes the ADR after the
  other five land. Its input is "how did DIST-01..04 actually land + any
  upstream signals since 2026-05-13." Plan scaffolded now; body filled
  at phase-close.

### DIST-01 — storage.adapter: beads wiring

- **D-03:** Factory lives in a new module `sdk/src/query/adapter-factory.ts`
  exporting `createStorageAdapter(projectDir, opts?)`. Clean separation
  from `helpers.ts` (which already has a markdown-only helper); testable
  in isolation.
- **D-04:** When `storage.adapter: beads` is set but gsd-beads / bd is
  not available → **fail fast** with an actionable error. Error class
  should name the missing piece (npm package vs bd binary) and embed the
  install command. No silent markdown fallback — silent fallback was
  explicitly rejected as a divergence risk (user thinks they're on bd
  but isn't).
- **D-05:** gsd-beads import style: **"both, guarded at runtime."**
  Prefer static top-of-file import for type inference; wrap in a
  try/catch boundary at module-load time so missing gsd-beads surfaces
  as a typed error the factory can handle. Overrides the initial
  recommendation of pure-dynamic import (tradeoff: markdown users pay a
  small resolve cost on startup; accepted for better types + simpler
  error paths).
- **D-06:** Call-site migration lands in the **same plan** as the
  factory creation. All ~10 current `new MarkdownAdapter(projectDir)`
  sites in `sdk/src/` convert to `createStorageAdapter(projectDir)` in
  DIST-01. Plan is green-to-green; no dangling hardcoded sites.

### DIST-02 — migration tool (markdown → bd)

- **D-07:** Migration logic lives in the **sibling repo** as
  `gsd-beads migrate` subcommand (not in the fork). Rationale: the
  migration is adapter-specific; a future sqlite adapter would ship its
  own `gsd-sqlite migrate`. Keeps the fork agnostic to target backends.
- **D-08:** Fork-side DIST-02 plan is **docs + optional pass-through** only:
  (a) fork README + docs/MIGRATION.md describe `gsd-beads migrate` flow;
  (b) optional `gsd-sdk query storage.migrate --adapter beads` pass-through
  that shells out to `gsd-beads migrate`. Implementation plan lands in
  sibling repo (separately).
- **D-09:** Dry-run shape (sibling-owned, captured here for fork-side
  docs consistency): `--dry-run` emits a plan-then-apply JSON report —
  every noun to create listed with (type, source markdown path, target
  bd id, frontmatter preview). Same JSON shape whether dry or applied.
- **D-10:** Seed-id strategy: **bd auto-generates ids.** Call
  `bd init --from-jsonl` and let bd allocate. Simplest; matches Phase 6
  spike-findings patterns. Accepts that re-running migration on the same
  project yields different ids (no idempotency). Documented explicitly;
  acceptable for v1.0 because migration is a one-time operation.
- **D-11:** Backup + rollback: **require clean-slate `.beads/` + archive
  markdown on success.** Migration refuses to run if `.beads/` exists.
  On success, renames `.planning/` → `.planning.markdown-backup-${date}/`
  and regenerates a minimal `.planning/` under bd. Rollback = delete
  `.beads/` + restore backup. Safest of the three proposed policies;
  avoids two-sources-of-truth ambiguity.

### DIST-03 — rebase playbook + leak-grep on rebase

- **D-12:** Ships as **`docs/UPSTREAM-REBASE.md` + helper script**
  (`scripts/sync-upstream.sh`). Prose playbook covers sync→rebase→leak-grep
  →conflict resolution→escalation; script automates the common path.
- **D-13:** Leak-grep on rebase: the helper script runs
  `node scripts/leak-grep.cjs` against the post-rebase diff (vs pre-rebase
  HEAD). Hits surface as a checklist of files needing adapter-routing.
  **Non-blocking**: rebase succeeds regardless; leak list is the dev's
  to-do. Script exit code 0 even when leaks found — the list is advisory,
  not a gate.
- **D-14:** Conflict taxonomy documents **both seam + business-logic**
  conflicts. Seam conflicts (`bin/lib/*.cjs`) are expected on every
  rebase and get pattern-level resolution guidance. Business-logic
  conflicts are red flags and get an INVESTIGATE workflow: inspect for
  missed leak, file upstream issue if appropriate, only then resolve.
- **D-15:** Cadence: **on-demand only.** Dev runs the script when they
  need a new upstream feature or before a release. No GHA cron; no
  triggered-by-upstream-release. Simplest; accepts that divergence can
  grow between runs — first user of a new upstream feature pays the
  catch-up cost.

### DIST-04 — strict-superset parity with upstream

- **D-16:** Upstream pin is a **tag** in
  `.github/workflows/upstream-parity.yml` (e.g., `upstream/v1.39.0`).
  CI checks out upstream at that tag, runs its golden tests against the
  fork. Tag bump is a deliberate PR; reproducible; change requires
  intention. Rejected floating-main (mixes upstream breakage into fork
  CI) and commit-pin (locks test vintage).
- **D-17:** Fork install: **`npm pack` + `npm install <tarball>`.**
  CI packs the fork, installs the tarball in the upstream checkout, runs
  upstream's golden suite. Exercises the real tarball users get; catches
  packaging bugs (the class of issue #2647). Rejected `npm link` for
  missing packaging bugs.
- **D-18:** Zero-diff tolerance: **sanitize before compare**, reusing
  the `init-bundlers.test.ts` `sanitize()` pattern (paths → `<HOME_PATH>`,
  timestamps → `<TIMESTAMP>`, etc.). Proven; known false-positive surface.
  Rejected byte-identical-with-exceptions (noisy on upstream formatting
  changes) and property-based (risks missing subtle divergences).
- **D-19:** Parity CI runs on **every PR** to `feat/storage-adapter` +
  `main` as a required check. Highest confidence; accepts the CI cost
  (few minutes per run). Blocks merge on regression.

### Pre-0 — SDK alias-generator rewrite

- **D-20:** Scope per ROADMAP.md Phase 8 plan list: rewrite
  `sdk/scripts/gen-command-aliases.ts` so its output matches the
  committed `sdk/src/query/command-aliases.generated.ts` shape (typed
  `readonly FamilyCommandAlias[]` + inline single-line entries +
  `FamilyCommandAlias` interface export). Add a CJS writer that emits
  `bin/lib/command-aliases.generated.cjs` from the same manifest.
  Regenerate both artifacts. Remove the `if: false` guard + `TODO(phase-8)`
  marker from `.github/workflows/test.yml`. Pre-0 MUST land before
  DIST-04 because the alias-drift CI check and the parity CI workflow
  share the same `test.yml` job matrix.
- **D-21:** No new decisions for Pre-0 beyond the ROADMAP scope —
  implementation is mechanical. Planner / researcher may surface gray
  areas during planning if they find hidden complexity in the alias
  generator.

### Claude's Discretion

- Exact file path for the helper script (`scripts/sync-upstream.sh` is
  a sensible default; planner may adjust for naming consistency).
- Exact signature of `createStorageAdapter` — sync vs async — to be
  decided in planning based on import-guard approach.
- Whether the parity workflow becomes a separate `.github/workflows/upstream-parity.yml`
  or a new matrix slot in `test.yml`. Planner picks based on CI time
  budget + workflow-file complexity.
- Migration docs location: `README.md` vs `docs/MIGRATION.md` vs inline
  in `.planning/PROJECT.md`. Planner picks based on project doc conventions.
- Exact error class for DIST-01 D-04 (`BeadsAdapterUnavailable` is a
  working name; planner can align with existing error taxonomy in
  `adapters/types.ts`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` §Phase 8 (lines 227–241) — goal, 5 success
  criteria, 5 DIST requirements, Pre-0 plan entry.
- `.planning/REQUIREMENTS.md` lines 80–84 — DIST-01..05 must_haves.
- `.planning/REQUIREMENTS.md` lines 184–188 — DIST traceability rows
  (currently `Pending`; phase-close flips them to `Complete (Phase 8)`).
- `.planning/PROJECT.md` — milestone goal, success criteria, branch
  strategy, two-repo model.
- `.planning/research/fork-investigation/SYNTHESIS.md` §7 (lines 688–691) —
  Phase 8 scope description and carry-forward notes.

### Canonical ADRs (must read before touching related code)
- `.planning/DECISIONS.md` §D-2026-04-30-02 — two-repo model (fork +
  gsd-beads). Informs D-07 (migration lives in sibling).
- `.planning/DECISIONS.md` §D-2026-04-30-04 — upstream-sync model
  (periodic rebase). Informs D-12–D-15 rebase playbook.
- `.planning/DECISIONS.md` §D-2026-04-30-05 — capabilities flag for
  negotiation. Informs D-03 factory design (adapters declare capabilities
  at construction).
- `.planning/DECISIONS.md` §D-2026-04-30-10 — upstream PR #2909 golden
  parity matrix reconciliation. Direct input to DIST-04.
- `.planning/DECISIONS.md` §D-2026-05-12-OQ01-BEADS — BeadsAdapter
  commitPlanningState NOOP. Migration docs must note this deviation.
- `.planning/DECISIONS.md` §D-2026-05-12-CONFORM-MANIFEST — Phase 7
  conformance manifest. Migration verification (post-migrate re-run of
  conformance) uses this manifest.

### Phase 7 artifacts that inform Phase 8
- `.planning/phases/07-conformance-test-suite/07-REVIEW.md` — the
  `adapters` vitest project was wired into CI (run 25780945107); DIST-04
  parity workflow adds a new CI surface that coexists with it.
- `.planning/phases/07-conformance-test-suite/07-VERIFICATION.md` — two
  deferred human-verification items carry into Phase 8: (a) full
  property-suite end-to-end run (runs under `CONFORMANCE_DEEP=1`),
  (b) first green pull_request-trigger CI run.

### Code references for scout findings (current state, to be modified)
- `sdk/src/gsd-tools.ts` lines 25, 134, 170, 630 — hardcoded
  `new MarkdownAdapter(projectDir)`; migrates under DIST-01.
- `sdk/src/cli.ts` lines 22, 356, 412 — hardcoded; migrates under DIST-01.
- `sdk/src/index.ts` lines 36, 131 — hardcoded; migrates under DIST-01.
- `sdk/src/query-gsd-tools-runtime.ts` lines 3, 33 — hardcoded; migrates
  under DIST-01.
- `sdk/src/query/helpers.ts` lines 475–504 — existing
  `openMarkdownAdapter` helper; factory will sit alongside or absorb it.
- `sdk/src/query/query-cli-adapter.ts` lines 6, 25 — hardcoded; migrates
  under DIST-01.
- `sdk/src/query/config-schema.ts` — **no `storage.adapter` key exists yet;**
  DIST-01 adds it.
- `sdk/src/query/pipeline.ts` lines 124, 136 — comments note
  MarkdownAdapter-internal casts; DIST-01 must preserve these contract
  boundaries for adapters that don't implement the pipeline.
- `scripts/leak-grep.cjs` — existing pre-commit leak detector; DIST-03
  helper script reuses it on post-rebase diffs.
- `scripts/install-hooks.sh` — prepare-lifecycle hook that installs the
  pre-commit. DIST-03 doc references this as the single source of truth
  for leak-grep invocation.
- `tests/conformance/init-bundlers.test.ts` — existing `sanitize()`
  pattern (lines 53–94); DIST-04 parity workflow reuses the same pattern.
- `.github/workflows/test.yml` line 179 — the `if: false` guard +
  `TODO(phase-8)` marker on the alias-drift check; Pre-0 removes both.
- `.github/workflows/test.yml` lines 187–193 — existing paired-conformance
  step pattern; DIST-04 parity workflow can mirror its matrix gating.

### Sibling references (for DIST-02 planning)
- `/Volumes/code/gsd-beads/src/index.ts` — current BeadsAdapter
  implementation (exports `createBeadsAdapter` via `./testing`); migrate
  subcommand will reuse this + add bd-init-from-markdown logic.
- `/Volumes/code/gsd-beads/src/testing/conformance-factory.ts` — bd
  seed/init discipline (Landmines 9+11, `BEADS_ACTOR=seed`); migration
  tool inherits these patterns.
- `.claude/skills/spike-findings-gsd-beads/SKILL.md` — pre-reset
  learnings including bd-init-from-jsonl patterns. Migration reads this
  for the auto-id + seed approach.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`sdk/src/query/helpers.ts` `openMarkdownAdapter`** — the precedent
  for a helper that returns a StorageAdapter. DIST-01 factory either
  absorbs this or sits alongside; planner picks.
- **`scripts/leak-grep.cjs`** — self-documenting leak detector with
  file- and line-level allow directives. DIST-03 helper script invokes
  it as-is; no code changes.
- **`tests/conformance/init-bundlers.test.ts` `sanitize()`** — proven
  placeholder-substitution pattern. DIST-04 parity workflow reuses it
  verbatim (possibly extracted to a shared module).
- **Existing `.github/workflows/test.yml` matrix** — Ubuntu 22/24 +
  macOS + Node 22/24. DIST-04 parity workflow can add a matrix slot
  (e.g., `ubuntu-latest / node 22 / with upstream tag v1.39.0`).
- **Paired-conformance test infra** (`vitest.conformance.config.ts` +
  `scripts/clear-registry.mjs`) — if migration verification re-runs
  conformance against the migrated bd store, it uses this entry point.

### Established Patterns

- **Every SDK command construction site builds its own MarkdownAdapter.**
  ~10 sites listed in Canonical refs. DIST-01 plan lands all of them as
  a single atomic commit (D-06) — same shape as Phase 4's leak-plug.
- **Adapter construction is synchronous** — `new MarkdownAdapter(projectDir)`.
  DIST-01 factory should stay sync-callable to minimize call-site
  refactoring; async only if D-05's import guard forces it.
- **Config surface is JSON** (`.planning/config.json`) with a typed schema
  in `sdk/src/query/config-schema.ts`. DIST-01 adds a `storage` key with
  `adapter: 'markdown' | 'beads'` (closed enum). Config migration is
  additive — users without the key get markdown by default.
- **CI uses workflow_dispatch for smokes + automatic triggers for PR
  gating.** DIST-04 parity CI follows the PR-gating pattern
  (`on: pull_request`) per D-19.
- **Pre-commit leak-grep runs via `scripts/install-hooks.sh` prepare
  hook.** DIST-03 script invokes leak-grep programmatically — no hook
  reinstallation needed.
- **Fail-fast error pattern with actionable install hints** — see
  `UnsupportedCapabilityError` (adapters/types.ts) for the shape: typed
  class, `capability` field, adapter name, message with remediation.
  DIST-01 `BeadsAdapterUnavailable` follows this pattern.

### Integration Points

- **DIST-01 factory → every SDK entrypoint** (`gsd-tools.ts`, `cli.ts`,
  `index.ts`, `query-gsd-tools-runtime.ts`, `query-cli-adapter.ts`,
  `helpers.ts`, `golden/registry-canonical-commands.ts`). Single factory,
  N callers.
- **DIST-02 docs → `README.md` + `docs/MIGRATION.md` + sibling's
  `gsd-beads migrate`** binary. Fork docs link out; sibling owns the
  canonical user flow.
- **DIST-03 script → `scripts/leak-grep.cjs`** (invokes) + git (runs
  rebase/diff). Playbook references `scripts/install-hooks.sh` as
  single source of truth for pre-commit leak-grep config.
- **DIST-04 parity workflow → `.github/workflows/test.yml`** matrix slot
  OR new `.github/workflows/upstream-parity.yml` + `npm pack` artifact
  + upstream tag checkout.
- **Pre-0 alias-generator → `sdk/src/query/command-aliases.generated.ts`
  + `bin/lib/command-aliases.generated.cjs`** (both regenerated) +
  `.github/workflows/test.yml` (guard removed).

</code_context>

<specifics>
## Specific Ideas

- **Fork DIST-02 is docs-only by design.** The user explicitly moved the
  implementation to the sibling — this isn't a scope gap, it's a two-repo
  split matching D-2026-04-30-02.
- **D-05's "both, guarded at runtime" import style** is a deliberate
  override of the dynamic-import recommendation. Interpret: planner
  should NOT default to pure-dynamic `await import('gsd-beads')` even
  though it was the recommended option — the user wants static for types
  with runtime guards for missing peer.
- **D-14's business-logic-conflict INVESTIGATE workflow** is a red flag,
  not a normal resolution path. The doc must frame it that way — if
  upstream refactors business logic, the adapter seam missed a leak and
  it's a defect, not a merge.
- **DIST-05's "defer to phase-end" is the plan.** The phase-plan list
  has a DIST-05 placeholder plan; its body is written at phase close
  with the then-current signal (upstream's response to #2898/#2901/#2908;
  fork's own Phase 8 execution retrospective).
- **Pre-0 must land before DIST-04** — both touch `.github/workflows/test.yml`
  and the alias-drift check currently bypassed with `if: false` would
  conflict if DIST-04 adds a matrix slot on top of the bypass.

</specifics>

<deferred>
## Deferred Ideas

- **Additional adapter types** (sqlite, postgres, REST). The DIST-01
  factory is written for a closed enum `'markdown' | 'beads'` in v1.0.
  A future milestone can extend the enum and add a third branch. Out
  of scope for Phase 8.
- **Automated upstream-sync cron / weekly PR-open GHA.** Rejected in
  D-15 for v1.0. Candidate for post-v1.0 if manual on-demand proves
  insufficient.
- **bd cold-start perf dashboard** (PHASE-7-REMAINING.md §F; tracked in
  git but file deleted). Post-v1.0; not Phase 8.
- **Full property-suite nightly CI run** (PHASE-7-REMAINING.md §E;
  `CONFORMANCE_DEEP=1` scheduled workflow). Phase-8 or post-v1.0
  candidate; not in initial DIST scope.
- **Dependency on sibling's `main`** (PHASE-7-REMAINING.md §D; sibling
  is on `feat/phase-6-reset`; graduate to main). Phase 8 consumer of
  sibling via `file:../gsd-beads` dep works today; a later milestone
  flips the ref once sibling cuts v1.0 on main.
- **Migration verification against pre-migration state** (re-run
  conformance suite post-migration). Sibling's DIST-02 plan decides
  whether to include it. Fork-side DIST-02 docs mention it as a safety
  checkpoint but don't gate on it.
- **Migration for partial / in-flight phases.** v1.0 assumes the user
  migrates at a clean boundary (phase N complete, phase N+1 not started).
  Mid-phase migration is out of scope for v1.0.

</deferred>

---

*Phase: 8-migration-distribution*
*Context gathered: 2026-05-13*
