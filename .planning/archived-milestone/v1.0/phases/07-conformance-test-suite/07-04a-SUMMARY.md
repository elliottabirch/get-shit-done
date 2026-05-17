---
phase: 07-conformance-test-suite
plan: 04a
subsystem: testing
tags: [conformance, paired, ci, bd-install, vitest, github-actions, beads]

# Dependency graph
requires:
  - phase: 07-03
    provides: gsd-beads testing subpath (createBeadsAdapter) + BeadsAdapter.normalize() fix
  - phase: 07-02
    provides: meta-coverage.test.ts + prebuild:conformance + D-08 section-anchor script
  - phase: 07-01
    provides: adapter.conformance.ts locked harness (runAdapterConformanceSuite)
provides:
  - "tests/conformance/paired.test.ts: paired harness entry point invoking both adapters"
  - "package.json: gsd-beads devDep (file:../gsd-beads) + test:conformance:paired script"
  - ".github/workflows/test.yml: bd install (Linux tarball + macOS Homebrew) + sibling checkout + paired run"
  - "SC#1 baseline: zero failing assertions across MarkdownAdapter + BeadsAdapter on the locked Phase 1 harness"
affects: [07-04b, 07-05a, 07-05b, 07-06]

# Tech tracking
tech-stack:
  added: ["gsd-beads: file:../gsd-beads (devDep)", "GitHub Actions bd install via release tarball"]
  patterns:
    - "bdPresent() probe: spawnSync + regex accepts bd v1.0.4+; skip-with-warning locally, hard-require on CI"
    - "pairedAdapters tuple array: extensible loop pattern for 07-04b additive suites"
    - "CI: sibling checkout before npm ci so file:../gsd-beads path resolves"
    - "CI: paired conformance gated on single matrix slot (ubuntu/node-22) to bound runtime"

key-files:
  created:
    - tests/conformance/paired.test.ts
  modified:
    - package.json
    - package-lock.json
    - .github/workflows/test.yml

key-decisions:
  - "Assumption A1 resolved: bd release org is 'gastownhall'; release asset is beads_1.0.4_linux_amd64.tar.gz (NOT bd-linux-amd64.tar.gz as plan placeholder stated)"
  - "macOS CI uses 'brew install beads' (formula is 'beads', binary is 'bd') — confirmed by checkpoint:decision"
  - "Sibling checkout placed BEFORE npm ci so file:../gsd-beads resolves without errors"
  - "Paired conformance gated on ubuntu-latest/node-22 matrix slot (not node-24) for CI time efficiency"
  - "Merge strategy used (not rebase/cherry-pick) to bring feat/storage-adapter conformance infrastructure into fresh worktree"

patterns-established:
  - "bdPresent(): canonical bd probe function in paired.test.ts; exported for reuse by 07-04b+"
  - "AdapterFactory type + pairedAdapters array: tuple pattern for additive test suite loop"
  - "file:../gsd-beads sibling dependency: resolved via absolute symlink in worktrees; relative symlink is worktree-path-aware"

requirements-completed: [CONFORM-01, CONFORM-03]

# Metrics
duration: 35min
completed: 2026-05-12
---

# Phase 7 Plan 04a: Paired Conformance Harness Summary

**Paired conformance wired end-to-end: gsd-beads devDep + paired.test.ts with bd probe + CI workflow with gastownhall/beads Linux tarball install + macOS Homebrew + sibling checkout; 13/13 baseline tests green locally**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-12T19:04:00Z
- **Completed:** 2026-05-12T19:39:00Z
- **Tasks:** 3 (Tasks 1, 2, 5; Tasks 3-4 in plan are checkpoint tasks)
- **Files modified:** 4

## Accomplishments
- `gsd-beads: file:../gsd-beads` devDep + `test:conformance:paired` script in `package.json`; subpath `gsd-beads/testing` resolves via `createBeadsAdapter` function
- `tests/conformance/paired.test.ts`: invokes `runAdapterConformanceSuite` twice (markdown always + beads when bd v1.0.4+ present); exports `bdPresent()`, `pairedAdapters`, `AdapterFactory` for 07-04b additive loop
- `.github/workflows/test.yml`: bd Linux tarball install from confirmed gastownhall/beads release URL + macOS Homebrew + sibling gsd-beads checkout/build + paired conformance run on ubuntu/node-22 slot
- 10/10 paired tests + 3/3 meta-coverage tests green locally with bd v1.0.4

## Confirmed: bd Release Details (Assumption A1)

- **GitHub org:** `gastownhall`
- **Release asset naming:** `beads_1.0.4_linux_amd64.tar.gz` (NOT `bd-linux-amd64.tar.gz` as plan placeholder)
- **Verified URL:** `https://github.com/gastownhall/beads/releases/download/v1.0.4/beads_1.0.4_linux_amd64.tar.gz` (HTTP 200, 47MB)
- **macOS formula:** `brew install beads` (formula name `beads`, binary `bd`)

## CI Runtime Baseline

- **Local run duration:** ~12.5s (10 paired tests + 3 meta-coverage + vitest setup)
- **CI estimate:** ~40s total delta (bd install ~5-10s + sibling build ~15-20s + paired tests ~12s)
- This establishes the baseline runtime budget for 07-04b/05a/05b/06 to measure against.

## test:conformance:paired Script (D-02 locked value)

```
NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run --config vitest.conformance.config.ts tests/conformance/paired.test.ts tests/conformance/meta-coverage.test.ts
```

Plans 07-04b/05a/05b/06 extend the file list at the end (`tests/conformance/write-outcome.test.ts`, etc.).

## Task Commits

Each task was committed atomically:

1. **Task 1: Fork devDeps + test:conformance:paired script** - `9d5ec203` (feat)
2. **Task 2: Author paired.test.ts** - `38bb4fc5` (feat)
3. **Task 5: CI workflow bd install + sibling checkout + paired run** - `e2c8bf5a` (feat)

**Plan metadata:** (pending final docs commit)

## Files Created/Modified
- `tests/conformance/paired.test.ts` - Paired harness entry point; D-01 + D-03; exports bdPresent/pairedAdapters/AdapterFactory
- `package.json` - gsd-beads devDep + test:conformance:paired script
- `package-lock.json` - Updated for gsd-beads file-link
- `.github/workflows/test.yml` - bd install (Linux + macOS) + sibling checkout/build + paired conformance step

## Decisions Made
- **bd org = gastownhall**: Confirmed via checkpoint:decision user input + verified HTTP 200 on release URL
- **Release asset = beads_1.0.4_linux_amd64.tar.gz**: Actual filename confirmed (plan had placeholder `bd-linux-amd64.tar.gz`)
- **Sibling checkout before npm ci**: Required so `file:../gsd-beads` path resolves during `npm ci`
- **Paired run on ubuntu/node-22**: One matrix slot keeps CI budget bounded; beads is Linux-primary

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree path prevented cherry-pick + symlink of file:../gsd-beads devDep**
- **Found during:** Setup / Task 1
- **Issue:** This fresh worktree lives at `.claude/worktrees/agent-a5e4641b059f9e498/`, so `npm install`'s relative symlink `../../gsd-beads` resolves to `.claude/gsd-beads` (nonexistent) instead of `/Volumes/code/gsd-beads`
- **Fix:** Created absolute symlink `node_modules/gsd-beads -> /Volumes/code/gsd-beads` after npm install; node import resolves correctly
- **Files modified:** `node_modules/gsd-beads` (symlink only; not committed)
- **Verification:** `node -e "import('gsd-beads/testing').then(m => console.log(typeof m.createBeadsAdapter))"` prints `function`
- **Committed in:** Not committed (node_modules are gitignored; CI will symlink correctly because `../gsd-beads` resolves properly in a standard non-nested working tree checkout)

**2. [Rule 3 - Blocking] feat/storage-adapter conformance infrastructure absent from fresh worktree**
- **Found during:** Pre-task setup
- **Issue:** This worktree was branched from `main` (not `feat/storage-adapter`), so `tests/conformance/`, `vitest.conformance.config.ts`, and adapter seam files were absent
- **Fix:** Merged `feat/storage-adapter` into this worktree branch (`git merge feat/storage-adapter --no-edit`); cherry-pick was blocked due to divergent package.json history
- **Files modified:** All conformance infrastructure files (created by prior plans)
- **Verification:** `ls tests/conformance/` shows all conformance files; `vitest.conformance.config.ts` present

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking, worktree-specific path issues)
**Impact on plan:** Both fixes necessary for the worktree context; no scope creep; artifact content unchanged from plan spec.

## Issues Encountered
- Cherry-pick of prior agent commits (f545f05a, ad358ef5) failed due to divergent package.json history; resolved by merging feat/storage-adapter directly
- gsd-beads symlink path resolution is worktree-depth-specific; documented in known patterns

## Next Phase Readiness

**Plan 07-04b can now extend `test:conformance:paired`:**
- Add `write-outcome.test.ts`, `write-events.test.ts`, `write-transaction.test.ts` to the script file list
- Import `runStateWriteOutcomeSuite` / `runStateEventDispatchSuite` / `runWithTransactionSuite` in `paired.test.ts`
- Use the exported `pairedAdapters` loop pattern (already in place)

**CI baseline established:** ~40s total delta for reference. Downstream plans should flag regressions above ~90s.

## Forward Pointer

Plan 07-04b migrates write-*.test.ts files into the harness + populates manifest with ≥30 entries (StateWriteOutcome 16-case matrix + 9 section-tuple + baseline binB). The `pairedAdapters` array and `AdapterFactory` type in `paired.test.ts` are ready to receive the loop.

## Self-Check: PASSED

- FOUND: `tests/conformance/paired.test.ts`
- FOUND: `gsd-beads` devDep in `package.json`
- FOUND: `test:conformance:paired` script in `package.json`
- FOUND: `gastownhall` CI URL in `.github/workflows/test.yml`
- FOUND: commit `9d5ec203` (Task 1)
- FOUND: commit `38bb4fc5` (Task 2)
- FOUND: commit `e2c8bf5a` (Task 5)
- FOUND: `07-04a-SUMMARY.md`

---
*Phase: 07-conformance-test-suite*
*Completed: 2026-05-12*
