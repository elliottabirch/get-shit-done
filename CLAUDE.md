# get-shit-done (fork) — Project Context

A fork of `gsd-build/get-shit-done` that adds a `StorageAdapter` interface
seam, allowing pluggable storage backends (markdown default; bd, sqlite,
etc. as alternates) without modifying business logic.

See `.planning/PROJECT.md` for full architecture.
See `.planning/research/fork-investigation/SYNTHESIS.md` for canonical
milestone scope (8 phases, ~96 adapter methods, 10 open architectural
questions).

## Sibling repos

- `~/code/gsd-beads` — the BeadsAdapter implementation (depends on this fork)

## Branch strategy

- `main` — mirrors `upstream/main`. Never modify directly.
- `feat/storage-adapter` — long-lived working branch for v1.0 milestone.
- Per-phase feature branches off `feat/storage-adapter` as needed.

## Upstream sync

```
git checkout main && git pull upstream main && git push origin main
git checkout feat/storage-adapter && git rebase main
```

Conflicts should only happen in our adapter-interface seam patches.
Business-logic conflicts indicate a leak we missed — investigate, route
through the adapter.

## Recent upstream activity to investigate (Phase 1)

- `feat(sdk): add durable planning runtime (#2898)`
- `refactor: extract planning-workspace seam from core.cjs (#2901)`
- `refactor(query): manifest-backed routing seam + family adapters (#2908)`

These may overlap with our adapter-interface work; investigate before
locking the contract.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
