# Phase 8: Migration + distribution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 8-migration-distribution
**Areas discussed:** Scope focus, DIST-01 storage.adapter wiring, DIST-02 migration tool, DIST-03 rebase playbook, DIST-04 strict-superset parity

---

## Scope Focus (pre-discussion meta)

| Question | Options | Selected |
|---|---|---|
| Which DIST requirements to capture in CONTEXT.md? | DIST-01, DIST-02, DIST-03, DIST-04 (multi) | All four selected |
| DIST-05 flow | Defer to phase-end / Discuss now | Defer to phase-end |
| Plan split | One per requirement / Grouped 3-4 / Let planner decide | One plan per requirement |

**Notes:** DIST-05 is a write-ADR task dependent on phase-execution learnings and upstream signals; the phase-plan list has a placeholder plan for it that is filled at close.

---

## DIST-01 — storage.adapter: beads wiring

### Q1: Factory location

| Option | Description | Selected |
|--------|-------------|----------|
| `sdk/src/query/adapter-factory.ts` (new file) | Dedicated module; testable in isolation | ✓ |
| `adapters/index.ts` (fork root) | All adapter wiring in /adapters/ | |
| Inline in `sdk/src/query/helpers.ts` | Extend existing helpers module | |

### Q2: Missing gsd-beads behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Fail fast with actionable error | Throws at factory-call; error names install command | ✓ |
| Fallback to MarkdownAdapter with warning | Silent divergence risk | |
| Fallback only for read-only commands | Middle ground; complicates logic | |

### Q3: gsd-beads import style

| Option | Description | Selected |
|--------|-------------|----------|
| Dynamic `await import('gsd-beads')` inside factory | Lazy; markdown users pay nothing | |
| Static top-of-file import | Pays cost on every startup | |
| Both, guarded at runtime | Static with try/catch at module boundary | ✓ |

**Notes:** User overrode the recommendation (dynamic). They want static-for-types with a runtime guard for missing peer. Planner must respect this — NOT default to pure dynamic.

### Q4: Call-site migration approach

| Option | Description | Selected |
|--------|-------------|----------|
| Convert all sites in one plan (DIST-01) | Atomic; no dangling hardcoded sites | ✓ |
| Factory in DIST-01, migrate sites incrementally | Risks config-honored-some-places-not-others | |
| Leave existing sites alone; factory is new-code-only | Makes `storage.adapter=beads` a lie | |

---

## DIST-02 — migration tool markdown → bd

### Q1: How is the tool invoked?

| Option | Description | Selected |
|--------|-------------|----------|
| `gsd-sdk query storage.migrate` subcommand | Lives in fork SDK surface | |
| Standalone `gsd-migrate` binary | New top-level binary | |
| `gsd-beads migrate` subcommand in sibling | Migration lives in target adapter's repo | ✓ |

**Notes:** This choice moves DIST-02 implementation to the sibling repo. Fork-side DIST-02 becomes docs-only, possibly with a pass-through.

### Q2: Dry-run output shape

| Option | Description | Selected |
|--------|-------------|----------|
| Plan-then-apply JSON report | Same shape dry or applied | ✓ |
| Human-readable diff to stderr + no writes | Easier to skim; harder to automate | |
| Both: default human, `--json` flag | Dual-mode UX | |

### Q3: Seed-id strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Let bd auto-generate | Simplest; not idempotent on re-run | ✓ |
| Derive stable ids from markdown path hash | Idempotent; fights bd's id allocation | |
| Ask bd for ids upfront, then seed | Most auditable; most complex | |

### Q4: Backup + rollback policy

| Option | Description | Selected |
|--------|-------------|----------|
| Require clean-slate `.beads/` + archive markdown on success | Safest; one source of truth post-migration | ✓ |
| Overwrite `.beads/`; leave `.planning/` in place | Two sources of truth risk | |
| In-place transactional (git stash-style) | Crosses adapter boundaries (Deferred-04 lesson) | |

### Follow-up: fork-side DIST-02 scope

| Option | Description | Selected |
|--------|-------------|----------|
| Fork DIST-02 is docs-only; implementation in sibling | Optional pass-through; canonical docs | ✓ |
| Fork DIST-02 is a light wrapper + docs; no pass-through | Zero code; fragmented UX | |
| Rethink — move DIST-02 back to fork | Re-answer Q1 with SDK-subcommand option | |

---

## DIST-03 — rebase playbook + leak-grep on rebase

### Q1: Playbook form

| Option | Description | Selected |
|--------|-------------|----------|
| `docs/UPSTREAM-REBASE.md` + helper script | Prose + automation | ✓ |
| `docs/UPSTREAM-REBASE.md` only | Pure doc; no magic | |
| Script only | Heavy inline comments; fights discoverability | |

### Q2: Leak-grep on rebase

| Option | Description | Selected |
|--------|-------------|----------|
| Rebase script runs leak-grep against post-rebase diff | Advisory checklist; non-blocking | ✓ |
| Dedicated CI job on rebase PRs | More visibility; more CI surface | |
| Both: script for local, CI for PR enforcement | Belt-and-suspenders | |

### Q3: Conflict taxonomy scope

| Option | Description | Selected |
|--------|-------------|----------|
| Adapter-seam files only | Expected path | |
| Both seam + business-logic | Includes INVESTIGATE workflow for business-logic | ✓ |
| Skip taxonomy — link to examples | Pragmatic; requires rebase history | |

**Notes:** Documenting both types intentionally — business-logic conflicts are red flags, not normal resolutions, but the doc must explain the INVESTIGATE workflow.

### Q4: Rebase cadence + automation

| Option | Description | Selected |
|--------|-------------|----------|
| Manual, triggered by upstream release tags | Batches conflicts; matches D-2026-04-30-04 | |
| Weekly GHA cron that opens rebase PR | Never falls behind; noisy | |
| On-demand only — dev runs when they need upstream feature | Minimalist; divergence can grow | ✓ |

---

## DIST-04 — strict-superset parity with upstream

### Q1: Upstream ref pinning

| Option | Description | Selected |
|--------|-------------|----------|
| Tag pin in `.github/workflows/upstream-parity.yml` | Reproducible; deliberate bumps | ✓ |
| Track upstream/main (floating) | Mixes upstream breakage into fork CI | |
| Mirror upstream's own test commit | Locks test vintage | |

### Q2: Fork install for the parity test

| Option | Description | Selected |
|--------|-------------|----------|
| `npm pack` + `npm install <tarball>` | Exercises real tarball; catches packaging bugs | ✓ |
| `npm link` (dev install) | Misses packaging bugs | |
| Both — tarball on PR, link on local | Dev ergonomics + CI rigor | |

### Q3: Zero-diff tolerance

| Option | Description | Selected |
|--------|-------------|----------|
| Sanitize before compare (init-bundlers pattern) | Proven; known false-positive surface | ✓ |
| Byte-identical with documented exceptions | Noisy on upstream formatting changes | |
| Property-based parity | Risks missing subtle divergences | |

### Q4: Parity CI cadence

| Option | Description | Selected |
|--------|-------------|----------|
| Every PR to feat/storage-adapter + main | Highest confidence; blocks regression | ✓ |
| Nightly scheduled workflow | Catches upstream drift | |
| Both — PR gate + nightly signal | Most protection | |

---

## Claude's Discretion

Noted in CONTEXT.md §Decisions → Claude's Discretion. Summary:

- Exact file path for the helper script (`scripts/sync-upstream.sh` sensible default)
- Sync vs async signature for `createStorageAdapter`
- Separate `.github/workflows/upstream-parity.yml` vs matrix slot in `test.yml`
- Migration docs location (README vs docs/MIGRATION.md vs inline)
- Exact error class name for DIST-01 missing-beads error
- Whether migration verification re-runs conformance post-migrate (sibling decides)

## Deferred Ideas

Noted in CONTEXT.md §Deferred Ideas. Summary:

- Additional adapter types (sqlite, postgres, REST) — closed enum for v1.0
- Automated upstream-sync cron — rejected in D-15; post-v1.0 candidate
- bd cold-start perf dashboard — post-v1.0
- Full property-suite nightly CI run (`CONFORMANCE_DEEP=1`) — Phase 8 or post-v1.0
- Sibling main graduation (currently on feat/phase-6-reset)
- Migration verification against pre-migration state (sibling-owned)
- Mid-phase migration support (v1.0 assumes clean-boundary migration only)
