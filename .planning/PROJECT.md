# Project: get-shit-done (fork — adapter-interface seam)

A fork of `gsd-build/get-shit-done` that adds a `StorageAdapter` interface
seam, so any adapter implementation (markdown by default; bd, sqlite, etc.
as alternates) can be plugged in via config without modifying business logic.

## Architecture (locked 2026-04-30)

```
┌────────────────────────────────────────────────────────────┐
│ This repo: get-shit-done (fork of gsd-build/get-shit-done) │
│  • Adapter interface refactor (StorageAdapter contract)    │
│  • Default MarkdownAdapter (zero behavior change)          │
│  • Capabilities flag for adapter feature negotiation       │
│  • Tracks gsd-build/get-shit-done; periodic rebase         │
│  • Submittable upstream as a PR if accepted                │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Sibling repo: gsd-beads                                    │
│  • BeadsAdapter — implements StorageAdapter against bd      │
│  • Depends on this fork                                    │
│  • Drives the v1.0 milestone's Phase 6                     │
└────────────────────────────────────────────────────────────┘
```

If a user installs this fork without configuring an adapter, behavior is
identical to upstream `gsd-build/get-shit-done`. If they configure
`storage.adapter: beads` (with `gsd-beads` installed), all `.planning/*`
state lives in `bd` instead.

## Origin: why we forked

The fork was motivated by an architectural investigation
(`.planning/research/fork-investigation/SYNTHESIS.md`) that found upstream
GSD has ~334 direct-I/O leaks across workflows, agents, and "fat" skills
that bypass the SDK surface entirely. A new leak class (`<context>`-block
frontmatter `@.planning/...` references) loads files at skill-activation
time, before any runtime hook can intercept.

The conclusion: a clean architectural seam at the storage layer is the
only durable solution. This fork adds that seam.

## Current Milestone: v1.0 — StorageAdapter interface + MarkdownAdapter

**Status:** scoping (just bootstrapped on `feat/storage-adapter` branch)

**Goal:** Ship a fork of upstream GSD that adds a `StorageAdapter`
interface, defaulting to a `MarkdownAdapter` that wraps current behavior.
Verify zero behavior change against upstream's test suite.

**Phase scope** (from `.planning/research/fork-investigation/SYNTHESIS.md` §7):

| # | Phase | Status | Repo |
|---|-------|--------|------|
| 1 | Fork bootstrap + StorageAdapter interface skeleton + MarkdownAdapter scaffold | next | this |
| 2 | Wire core read methods to adapter | pending | this |
| 3 | Wire core write methods + `recordStateEvent` | pending | this |
| 4 | Plug workflow leaks (top 10 + `<context>`-block class) | pending | this |
| 5 | Foundational primitive lift (`updateSection`, `snapshot/restore`, `putNamedDoc`, `writeBinaryAsset`) | pending | this |
| 6 | BeadsAdapter implementation | pending | gsd-beads |
| 7 | Conformance test suite (run against both adapters) | pending | both |
| 8 | Migration + distribution | pending | both |

Phases 1–5 land here on `feat/storage-adapter`. Phase 6 begins in
gsd-beads. Phases 7–8 span both repos.

## Recent upstream signal (2026-04-30 review)

Upstream is actively building seam abstractions:
- `feat(sdk): add durable planning runtime (#2898)`
- `refactor: extract planning-workspace seam from core.cjs (#2901)`
- `refactor(query): manifest-backed routing seam + family adapters (#2908)`
- `test(golden): expand phases/validate/roadmap parity matrix (#2909)`

**Action item for Phase 1:** investigate these PRs before locking the
StorageAdapter contract. Possible upstream foundation we can build on, OR
divergent vision we need to reconcile with. Affects PR strategy.

## Why this exists (the core motivation)

Anyone who wants to build a non-markdown backend for GSD (bd, sqlite,
postgres, REST, embedded) needs a way to plug it in without forking GSD's
business logic. Today that's not possible — direct file I/O is scattered
across ~258 artifacts. This fork adds the one missing seam.

If accepted upstream as a PR, this fork goes away (becomes part of upstream
GSD). Until then, it lives here.

## Audience

Any GSD user who wants pluggable storage. The motivating example is
`gsd-beads` (bd as backend), but the interface is intentionally generic —
sqlite/postgres/REST/etc. adapters are valid and welcome.

## Success criteria

- A user runs `npm install -g <this-fork>` and gets GSD with no behavior
  change vs upstream
- Adding a third-party adapter (`gsd-beads`) and `storage.adapter: beads`
  in `.planning/config.json` switches the storage layer transparently
- Conformance test suite passes for both `MarkdownAdapter` and any
  third-party adapter that claims compatibility
- `git rebase upstream/main` runs without conflicts in business-logic
  code; conflicts only happen in our adapter-interface seam patches
- Existing GSD users have a migration path (markdown → other backends)

## Non-goals

- Modifying upstream GSD's business logic (slug rules, validation,
  state-transition semantics, phase numbering, etc.) — fork only adds
  the adapter-interface seam
- Making the fork incompatible with upstream — strict superset
- Re-implementing GSD ourselves
- Tracking every upstream branch; we track `main` only and rebase against
  releases
- Bundling specific adapter implementations (e.g., bd) into this repo

## Branch strategy

- `main` — mirrors `upstream/main`. Never modified directly. `git pull
  upstream main && git push origin main` keeps it in sync.
- `feat/storage-adapter` — long-lived working branch. All adapter-interface
  work lives here. Rebased periodically against `main` (which itself is
  rebased against `upstream/main`).
- Future feature branches off `feat/storage-adapter` for individual phases
  (`feat/adapter-phase-2-reads`, etc.) — merged back into
  `feat/storage-adapter` when phases ship.

## Carry-forward from prior work

This fork is bootstrapped from a substantial body of work in the sibling
`gsd-beads` repo. The relevant inputs to this fork:

- `.planning/research/fork-investigation/SYNTHESIS.md` — canonical scope
  input. 6500+ words. 8-phase milestone breakdown, 96 deduped adapter
  methods, 6 foundational primitives, 10 open architectural questions,
  9-item risk register.
- `.planning/research/fork-investigation/RUBRIC.md` + `PILOT.md` +
  `BATCH-NN.md` (10 files) — the underlying classification work
  (~258 artifacts) that produced the synthesis.
- `.planning/DECISIONS.md` — 6 locked decisions including:
  - D-2026-04-30-01: pivot from shadow to fork-with-adapter-interface
  - D-2026-04-30-02: two-repo model
  - D-2026-04-30-03: keep `get-shit-done` name
  - D-2026-04-30-04: periodic rebase against upstream
  - D-2026-04-30-05: capabilities flag for negotiation
  - D-2026-04-30-06: SYNTHESIS.md is canonical milestone scope

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase:** Update phase-status table; log decisions in
`.planning/DECISIONS.md`; add risks to the synthesis risk register if
new ones emerge.

**After v1.0 ships:** review for upstream PR submission. If accepted,
this fork archives.

---

*Last updated: 2026-04-30 — fork bootstrap; v1.0 milestone scoping pending.*
*Decision log: `.planning/DECISIONS.md`. Investigation input: `.planning/research/fork-investigation/SYNTHESIS.md`.*
