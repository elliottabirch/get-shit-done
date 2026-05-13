<!-- leak-grep-allow file — this doc describes leak patterns for documentation purposes; matches are intentional prose, not I/O leaks -->
# Upstream Rebase Playbook

This fork (`feat/storage-adapter`) tracks upstream
`gsd-build/get-shit-done` via periodic rebase. This playbook documents
the on-demand sync flow, the expected conflict surface, and the
post-rebase leak-scan step that catches new direct-I/O introductions.

## When to sync

On-demand only. There is no cron schedule and no GitHub Actions
trigger on upstream releases (decision `D-2026-05-13-D-15`). Sync
when:

- You need a new upstream feature
- Before cutting a release of the fork
- After an upstream security or correctness fix landed

The first user of a new upstream feature pays the catch-up cost.
Divergence can grow between runs; the conflict taxonomy below scales
roughly linearly with the commit count.

## Quick path

From the fork root, with a clean working tree and `feat/storage-adapter`
(or a feature branch) checked out:

`./scripts/sync-upstream.sh`

This runs `git fetch upstream`, rebases onto `upstream/main`, then
runs `scripts/leak-grep.cjs` over the post-rebase changed files as an
advisory scan (exit 0 even if leaks found, per
`D-2026-05-13-D-13`).

To pin against a specific upstream ref instead of `upstream/main`:

`./scripts/sync-upstream.sh upstream/release/v1.40.0`

## Manual path

If the script fails partway (e.g. rebase conflicts), finish manually:

```sh
# 1. Save pre-rebase HEAD for the leak scan
PRE_REBASE=$(git rev-parse HEAD)

# 2. Fetch + rebase
git fetch upstream
git rebase upstream/main

# 3. Resolve conflicts per the taxonomy below, then:
git rebase --continue

# 4. Run the leak scan over changed files
git diff --name-only "${PRE_REBASE}..HEAD" | xargs node scripts/leak-grep.cjs || true
```

## Conflict taxonomy

Conflicts fall into three categories. Only categories 1 and 3 are
routine. Category 2 is a red flag.

### 1. Seam conflicts (expected, mechanical)

**Files typically affected**:
- `sdk/src/gsd-tools.ts`
- `sdk/src/cli.ts`
- `sdk/src/index.ts`
- `sdk/src/query/query-cli-adapter.ts`
- `sdk/src/query-gsd-tools-runtime.ts`
- `sdk/src/golden/registry-canonical-commands.ts`
- Any new file upstream adds that calls `createRegistry()`

**What happens**: Upstream modifies a function signature or adds a
new `createRegistry()` call site without our adapter-injection
parameter. Our fork requires either `adapter:` passed through or the
factory called.

**Resolution pattern**: Accept upstream's new arguments AND inject
our adapter construction on top. Example:

- Upstream adds: `createRegistry({ newParam: 'x' })`
- Fork resolution: `createRegistry({ newParam: 'x', adapter: createStorageAdapter(projectDir, { adapter: config.storage?.adapter }) })`

If upstream adds a direct `new MarkdownAdapter(...)` construction in
core code (a NEW I/O leak), that is NOT a seam conflict — it is a
business-logic conflict (category 2).

### 2. Business-logic conflicts (RED FLAG - INVESTIGATE)

**Trigger**: Upstream modifies a file that our leak-grep would flag
(e.g. a new `readFileSync('.planning/...')` in SDK core, a new
`gsd-tools.cjs` handler that bypasses the adapter, a new direct
`fs.writeFile` in state-mutation).

**This is not a routine conflict**. If business logic conflicts
appear, it means either:

a) Our adapter seam is incomplete (the I/O leak should have been
   adapter-routed when the seam was designed), OR
b) Upstream has introduced a new I/O surface that should go through
   adapter dispatch.

Either way, this is a defect in the fork's adapter coverage, not a
merge event.

**INVESTIGATE workflow**:

1. Inspect the conflict site carefully. Is it a new adapter route
   that should go through `adapter.*`?
2. If yes: route through the adapter, document the routing in the
   commit message. Consider filing an upstream issue pointing out
   that this new surface is adapter-relevant and proposing a
   reusable injection point.
3. If no (e.g. it is truly not a `.planning/` path, or it is a
   genuinely-orthogonal concern that the fork is out of scope for):
   resolve normally and note in the commit message why the path
   is not adapter-relevant.
4. Do NOT blindly accept upstream's change. A business-logic
   conflict is the ONLY place where the mechanical rebase discipline
   breaks down.

### 3. CJS binary conflicts (expected, mechanical)

**Files affected**: `get-shit-done/bin/lib/*.cjs` — compiled CJS
routing layer outputs.

**Resolution pattern**: Always take the upstream version, then
re-apply any fork-side CJS patches on top. The alias-generator and
config-schema mirrors are regenerated rather than hand-merged.

## Leak-grep output interpretation

`scripts/leak-grep.cjs` scans file content for direct-I/O patterns
(`Read`, `Write`, `Edit`, `fs.readFileSync`, `fs.writeFile`, `cp`,
`mv`, `rm -rf` targeting `.planning/`). Its output after a rebase is
a checklist:

- Each match is a site that may need adapter routing
- Sites inside `sdk/src/` or workflow sources are most likely to
  actually need routing
- Sites inside `get-shit-done/bin/lib/*.cjs` are usually compiled
  output of routed SDK code — treat as informational, not actionable
- Sites inside documentation, tests, or explicitly-allowed files
  (see `leak-grep-ignore` directives in the allowlist) are noise

The list is advisory. The script exits 0 regardless. Convert the
actionable items into a follow-up plan (see
`.planning/phases/*/XX-PLAN.md` naming) or file issues.

## Prior rebase history

The fork has been rebased against upstream once (a 228-commit batch),
producing three fixup commits visible in `git log`:

- `6d5889a9` — fix 13 test failures after the rebase
- `970d1ab7` — make adapter optional with MarkdownAdapter default
- `be8cdae6` — reconcile adapter DI with upstream's registry-assembly refactor

No business-logic conflicts were observed in that rebase, consistent
with the adapter-seam architecture. Future rebases are expected to
show similar shapes: seam + test-expectation + CJS-binary. If a
business-logic conflict DOES appear, treat it with the category 2
workflow.

## Troubleshooting

- **Merge conflict markers remain after `--continue`**: Run
  `git status` to find unresolved files; they were not staged.
- **Leak scan shows hundreds of matches**: Likely a large upstream
  batch. Filter to `sdk/src/` first (these are most action-relevant);
  ignore `get-shit-done/bin/lib/*.cjs` compiled output unless it
  shows an unusual pattern.
- **Script exits with `upstream: not found`**: The `upstream` remote
  is not configured. Run `git remote add upstream https://github.com/gsd-build/get-shit-done.git`.
- **Script exits after rebase without running leak scan**: The
  `git diff --name-only` produced no output (empty rebase) and the
  `|| true` short-circuited. This is normal.
