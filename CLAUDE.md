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
