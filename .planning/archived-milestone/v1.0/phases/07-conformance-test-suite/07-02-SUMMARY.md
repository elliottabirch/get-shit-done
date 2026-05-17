---
phase: 07-conformance-test-suite
plan: "02"
subsystem: testing
tags: [conformance, grep-script, meta-coverage, ripgrep, vitest, dynamic-anchors, D-06, D-08]

# Dependency graph
requires:
  - phase: 07-conformance-test-suite/07-01
    provides: manifest-types.ts, manifest.ts, test-registry.ts — the types and helpers meta-coverage imports
provides:
  - scripts/extract-section-anchors.mjs — D-08 ripgrep+grep-fallback section-anchor extractor with dynamic-anchor gate
  - tests/conformance/meta-coverage.test.ts — bidirectional manifest ↔ registeredTests meta-test (D-06)
  - tests/conformance/.generated/.gitignore — git tracking for .generated/ directory
  - package.json#prebuild:conformance — lifecycle hook invoking grep gate before build:conformance
affects: [07-04, 07-05, 07-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-08 ripgrep-with-grep-fallback: rg when available, grep -rE otherwise; pcre2 negative-lookahead only on rg path"
    - "Dynamic-anchor CI gate: exit 1 on any adapter.updateSection(path, variable, ...) call site"
    - "D-06 bidirectional invariant: manifest → registry (gap) + registry → manifest (orphan) checked in 3 it-blocks"

key-files:
  created:
    - scripts/extract-section-anchors.mjs
    - tests/conformance/meta-coverage.test.ts
    - tests/conformance/.generated/.gitignore
  modified:
    - package.json

key-decisions:
  - "Grep script uses rg --pcre2 for negative-lookahead in dynamic-anchor pass; grep fallback widens regex (set-subtract approach)"
  - "Scan paths are sdk/src + adapters only; tests/ excluded — test files may use dynamic anchors for parameterization"
  - "Dynamic-anchor gate exits 1 immediately with no allowlist in Phase 7 (A4: zero dynamic anchors expected)"
  - "vitest.conformance.config.ts glob 'tests/conformance/**/*.test.ts' already covers meta-coverage.test.ts — no config change needed"
  - "sdk/node_modules symlink created in worktree for test execution (worktree-local only, not committed)"

patterns-established:
  - "Pattern: prebuild lifecycle hooks run grep/lint gates before build:conformance via npm lifecycle"
  - "Pattern: .generated/ directory tracked via its own .gitignore ('*\\n!.gitignore'); contents are gitignored"
  - "Pattern: meta-coverage uses expect.soft for non-fatal multi-failure reporting across all manifest×adapter combos"

requirements-completed: [CONFORM-01, CONFORM-03]

# Metrics
duration: 5min
completed: 2026-05-12
---

# Phase 7 Plan 02: Section-Anchor Grep Script + Meta-Coverage Test Summary

**D-08 ripgrep+grep-fallback extractor emitting anchors.json + dynamic-anchor gate; D-06 bidirectional meta-coverage test with 3 it-blocks; first run confirms A4 (0 dynamic anchors in fork SDK)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-12T18:34:16Z
- **Completed:** 2026-05-12T18:39:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Grep script `scripts/extract-section-anchors.mjs` ships with ripgrep-first / POSIX-grep fallback, 3-pass architecture (literal call sites, MarkdownAdapter internal heading literals, dynamic-anchor gate), and deterministic output to `tests/conformance/.generated/`
- First-run results: 6 literal call sites, 15 MarkdownAdapter-internal heading literals, 0 dynamic anchors — A4 hypothesis confirmed
- Meta-coverage test enforces bidirectional manifest ↔ registeredTests invariant: passes trivially with empty manifest (Wave 0 baseline)
- `prebuild:conformance` npm lifecycle hook wires grep gate into CI pipeline before `build:conformance`

## Task Commits

1. **Task 1: D-08 grep script + .generated/.gitignore** — `520b0957` (feat)
2. **Task 2: Meta-coverage test + package.json wiring** — `dfb53e6c` (feat)

## Files Created/Modified

- `scripts/extract-section-anchors.mjs` — D-08 grep script; rg+grep-fallback; exits 0/1/2; writes anchors.json + dynamic-anchors.warn
- `tests/conformance/meta-coverage.test.ts` — D-06 bidirectional invariant; 3 it-blocks (gap, orphan, expected-row-coverage)
- `tests/conformance/.generated/.gitignore` — tracks .generated/ dir; excludes all generated output from git
- `package.json` — added `prebuild:conformance: "node scripts/extract-section-anchors.mjs"`

## Grep Script Details

### Three-pass architecture

**Pass 1 (literal call sites):** Pattern `\.(updateSection|getSection)\(\s*[^,]+,\s*['"x60]([^'"x60]+)['"x60]` against `sdk/src/` + `adapters/`. Finds 6 call sites (all in `adapters/markdown/index.test.ts` — the dedicated updateSection/getSection unit tests).

**Pass 2 (MarkdownAdapter internal heading literals):** Pattern `['"x60](#{2,4} [A-Z][^'"x60]+)['"x60]` against `adapters/markdown/index.ts` only. Finds 15 heading literal strings (e.g. `'## Decisions Made'`, `'## Forensic Sessions'`, `'## Quick Tasks'`, `'## Blockers'`, `'## Performance Metrics'`, `'## Pending todos'`, `'## Deferred Ideas'`, `'## Session Continuity'`, `'### Roadmap Evolution'` + variants) — more than the ~9 estimated in RESEARCH.md Tier 1 table due to additional helper strings.

**Pass 3 (dynamic-anchor gate):** Negative-lookahead `\.(updateSection|getSection)\(\s*[^,]+,\s*(?!['"x60])` on rg path; set-subtract fallback on grep path. Result: 0 dynamic anchors found in current fork SDK. A4 assumption CONFIRMED.

### ripgrep-vs-grep fallback

- `rg` detected via `spawnSync('rg', ['--version']).status === 0`
- `--pcre2` flag used with rg for negative-lookahead in Pass 3; grep fallback widens pattern (may have false positives, acceptable — manifest review stage catches them per RESEARCH.md)
- Exit codes: 0 = success, 1 = dynamic anchor found, 2 = internal error

## Meta-Coverage Test Signature

3 `it` blocks:

1. **`every CONFORMANCE_MANIFEST entry has a registered test on every adapter`** — iterates manifest × `['markdown', 'beads']`, checks `registeredTests.has(manifestKey(adapter, entry.kind, entry.name))`. Trivially passes with empty manifest.

2. **`no registered test exists without a matching CONFORMANCE_MANIFEST entry`** — iterates `registeredTests`, checks each key appears in manifest × adapters cross-product. Trivially passes with empty registeredTests.

3. **`every CONFORMANCE_MANIFEST entry populates expected for every adapter (D-07)`** — checks `entry.expected[adapter] !== undefined` for every manifest entry × adapter. Trivially passes with empty manifest.

All 3 use `expect.soft` for non-fatal multi-failure reporting.

## Decisions Made

- Used `expect.soft` throughout meta-coverage test so a single manifest/registry drift reports ALL gaps at once rather than stopping at the first failure
- Dynamic-anchor gate has no allowlist in Phase 7 (exits 1 immediately) since A4 assumes zero; future plans can add allowlist loading before relaxing this
- `tests/conformance/.generated/` is tracked via its own `.gitignore` file (the `*\n!.gitignore` idiom); `anchors.json` + `dynamic-anchors.warn` are never committed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created sdk/node_modules symlink in worktree**
- **Found during:** Task 2 (running meta-coverage test)
- **Issue:** Worktree doesn't have `sdk/node_modules` installed; `npm run test:conformance` uses `./sdk/node_modules/.bin/vitest`
- **Fix:** Created `sdk/node_modules` symlink pointing to main repo's installed SDK node_modules
- **Files modified:** `sdk/node_modules` (symlink, NOT committed — worktree-local only)
- **Verification:** `npm run test:conformance` succeeds after symlink
- **Note:** This is a worktree-local convenience. The symlink is gitignored (untracked per `git status`). Pre-existing conformance test failures (33) are due to missing `adapters/dist/markdown/index.js` build artifact — unrelated to this plan, pre-existing in worktree environment.

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The symlink fix was a worktree-local infrastructure fix needed to run tests. Not committed. Pre-existing test failures are build-artifact issues out of scope for this plan.

## Issues Encountered

- **Pre-existing conformance test failures:** 33 tests fail with `Cannot find module '../dist/markdown/index.js'` because the adapters TypeScript source hasn't been compiled to `dist/` in this worktree. This is pre-existing (same failure count before and after plan changes). Out of scope. The meta-coverage test (this plan's deliverable) passes 3/3.
- **Worktree NODE_PATH:** `npm run test:conformance` expects `sdk/node_modules` in the worktree. Resolved via symlink (worktree-local, not committed).

## Forward Pointer

Plan 07-04 will:
- Consume `tests/conformance/.generated/anchors.json` to populate the manifest's section-tuple subset
- Add ~16 `recordState*` Bin B entries (StateWriteOutcome matrix) to `CONFORMANCE_MANIFEST`
- The meta-coverage test will then enforce non-trivially: any `assertFromManifest` call missing from the per-adapter test files will surface as a gap

## Self-Check: PASSED

- `scripts/extract-section-anchors.mjs` exists: FOUND
- `tests/conformance/meta-coverage.test.ts` exists: FOUND
- `tests/conformance/.generated/.gitignore` exists: FOUND
- `package.json` contains `prebuild:conformance`: FOUND (1 occurrence)
- Commit `520b0957` exists: VERIFIED
- Commit `dfb53e6c` exists: VERIFIED
- `anchors.json` non-empty after script run: PASS
- `dynamic-anchors.warn` empty: PASS
- Meta-coverage test 3/3 passing: PASS
- Dynamic-anchor gate exits 1 on variable-anchor: VERIFIED

---
*Phase: 07-conformance-test-suite*
*Completed: 2026-05-12*
