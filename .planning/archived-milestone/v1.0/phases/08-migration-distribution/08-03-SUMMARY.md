---
phase: 08-migration-distribution
plan: "03"
subsystem: docs
tags: [phase-8, dist-02, migration-docs, fork-side-only]
dependency_graph:
  requires: [08-01]
  provides: [migration-guide, storage-backends-readme]
  affects: [docs/MIGRATION.md, README.md]
tech_stack:
  added: []
  patterns: [markdown-doc-authoring]
key_files:
  created:
    - docs/MIGRATION.md
  modified:
    - README.md
decisions:
  - "D-07 honored: migration implementation lives in sibling gsd-beads, not fork"
  - "D-08 honored: fork-side is docs-only; no pass-through wired (deferred for v1.0)"
  - "D-09 documented: plan-then-apply JSON dry-run shape, same whether dry or applied"
  - "D-10 documented: bd auto-generated ids via bd init --from-jsonl, non-idempotent"
  - "D-11 documented: clean-slate .beads/ requirement + .planning.markdown-backup-<date>/ + rollback procedure"
metrics:
  duration: "~15m"
  completed: "2026-05-13"
  tasks: 2
  files: 2
---

# Phase 8 Plan 3: DIST-02 Migration Documentation Summary

DIST-02 fork-side deliverable: user-facing markdown-to-beads migration guide plus README storage backends section, docs-only, zero implementation code added to fork.

## What Was Built

### Task 1: docs/MIGRATION.md

Created a new 122-line migration guide covering all ten required sections:

1. **Prerequisites** — `gsd-beads` + `bd` v1.0.4 install, clean `.beads/` requirement, committed `.planning/` git state
2. **Command** — `gsd-beads migrate --dry-run` and `gsd-beads migrate` from project root
3. **Dry-run output** — plan-then-apply JSON shape per D-09 (type, source, target_bd_id, frontmatter_preview); same shape in dry and apply modes
4. **Apply behavior** — `bd init --from-jsonl` with bd auto-generated ids; explicit non-idempotent warning per D-10; `.beads/` exists guard
5. **Backup** — `.planning/` renamed to `.planning.markdown-backup-<YYYY-MM-DD>/` on success per D-11
6. **Rollback** — three-step procedure (delete `.beads/`, restore backup, flip `storage.adapter`) per D-11
7. **Post-migration configuration** — JSON config snippet `{ "storage": { "adapter": "beads" } }` with adapter routing explanation
8. **Behavior deviations on BeadsAdapter** — `commitPlanningState` NOOP (D-2026-05-12-OQ01-BEADS); binary asset graceful degradation
9. **Verifying the migration** — `npm run test:conformance:paired` post-migration safety check (D-2026-05-12-CONFORM-MANIFEST)
10. **Troubleshooting** — three common errors: `.beads/ already exists`, `bd: command not found`, `BeadsAdapterUnavailable: missing-package`

**Heading choices:** H1 title (`# Migration: Markdown to Beads`) + H2 per section matches `docs/CONFIGURATION.md` heading depth and code-fence style. Triple-backtick fences for the JSON config example and the `npm run test:conformance:paired` shell command.

### Task 2: README.md — Storage backends section

Added `## Storage backends` H2 section inserted between the `## Configuration` and `## Documentation` sections. This placement is natural because:
- Configuration is the adjacent topic (storage is configured via `.planning/config.json`)
- No existing section headings were modified
- The `---` delimiter convention used between sections was matched

Section content:
- Names both adapters with a one-line description each (MarkdownAdapter default / BeadsAdapter with `gsd-beads`)
- JSON config snippet for opt-in
- Prose sentence naming `gsd-beads migrate`
- Markdown link to `[docs/MIGRATION.md](docs/MIGRATION.md)`

## Verification

### Link: README.md -> docs/MIGRATION.md

`grep "docs/MIGRATION.md" README.md` returns 1 match (the markdown link in the Storage backends section). Link is wired.

### Acceptance criteria results

| Check | Result |
|-------|--------|
| `docs/MIGRATION.md` exists | PASS |
| line count >= 80 | 122 lines — PASS |
| H1 `# Migration: Markdown to Beads` | PASS |
| All 10 H2 headings present | PASS |
| `gsd-beads migrate` >= 2 occurrences | 4 — PASS |
| `storage.adapter` >= 1 | 1 — PASS |
| `"beads"` >= 1 | 1 — PASS |
| `commitPlanningState` >= 1 | 1 — PASS |
| `markdown-backup` >= 1 | 2 — PASS |
| `non-idempotent\|one-time` >= 1 | 3 — PASS |
| `npm run test:conformance:paired` >= 1 | 1 — PASS |
| `TODO\|TBD\|PLACEHOLDER` == 0 | 0 — PASS |
| `## Storage backends` in README == 1 | 1 — PASS |
| `docs/MIGRATION.md` link in README >= 1 | 1 — PASS |
| `gsd-beads migrate` in README >= 1 | 1 — PASS |
| `BeadsAdapter` in README >= 1 | 2 — PASS |
| `MarkdownAdapter` in README >= 1 | 1 — PASS |

## No Implementation Code Added

Only two files were modified across both tasks:
- `docs/MIGRATION.md` — new documentation file (no TypeScript/JavaScript/CJS)
- `README.md` — 25-line addition of a documentation section

Per D-07/D-08: the fork-side DIST-02 deliverable is docs-only. Migration implementation (`gsd-beads migrate` subcommand, `bd init --from-jsonl` logic, JSON report emission) lives in the sibling `gsd-beads` repo.

## Gaps Intentionally Left for Sibling DIST-02

The following are out of scope for this plan per D-07/D-08 and owned by `gsd-beads`:

- **Full dry-run JSON schema** — the exact JSON field shapes (types, nullable fields, error entries) are defined by the sibling's implementation, not this doc. This guide describes the conceptual shape; the sibling's CLI `--help` and `--dry-run` output are the authoritative specification.
- **Migration rollback edge cases** — partial migration failure recovery (e.g., `bd init` fails midway), concurrent-process safety, disk-space checks. These are implementation concerns for the sibling.
- **Mid-phase migration support** — v1.0 explicitly requires a clean boundary; future milestone may relax this.
- **`gsd-sdk query storage.migrate` pass-through** — optional fork-side delegation to `gsd-beads migrate`. Deferred per D-08 (low-value for v1.0).

## Deviations from Plan

None — plan executed exactly as written. The content between `BEGIN/END` markers in the plan was used as the literal source for `docs/MIGRATION.md`, rendered with triple-backtick code fences for the JSON and shell examples as instructed.

## Known Stubs

None. Both files contain concrete, complete documentation referencing locked decisions D-07 through D-11. No placeholder text or TODO markers.

## Threat Flags

Not applicable. Docs-only change with no runtime code paths. No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- `docs/MIGRATION.md` exists: CONFIRMED (122 lines)
- `README.md` has `## Storage backends`: CONFIRMED (1 occurrence)
- Task 1 commit 547aed3d: CONFIRMED (`git log --oneline | grep 547aed3d`)
- Task 2 commit 668e7258: CONFIRMED (`git log --oneline | grep 668e7258`)
- No migration implementation code in fork: CONFIRMED (only docs/*.md and README.md modified)
