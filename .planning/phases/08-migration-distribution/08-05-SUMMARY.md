---
phase: 08-migration-distribution
plan: "05"
subsystem: ci/parity
tags: [phase-8, dist-04, parity-ci, npm-pack, strict-superset, github-actions]
dependency_graph:
  requires: [08-01]
  provides: [upstream-parity-ci-gate, shared-sanitize-module]
  affects: [tests/conformance/init-bundlers.test.ts, .github/workflows/]
tech_stack:
  added: []
  patterns: [npm-pack-tarball-install, pinned-action-shas, upstream-checkout-at-tag]
key_files:
  created:
    - tests/shared/sanitize.ts
    - .github/workflows/upstream-parity.yml
  modified:
    - tests/conformance/init-bundlers.test.ts
decisions:
  - "Upstream pin: v1.42.0 — most recent stable tag from git ls-remote upstream (v1.50.0-canary.{1,2} filtered as unstable)"
  - "Tarball naming: dynamic via steps.pack.outputs.tarball (npm pack --silent output) for version-change resilience"
  - "No bd install in parity job — golden suite uses no-adapter-config path (MarkdownAdapter default only)"
  - "checkpoint:human-verify auto-approved per --auto contract; live PR-trigger run is human-verification debt"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-13T22:52:44Z"
  tasks_completed: 3
  files_changed: 3
---

# Phase 8 Plan 05: DIST-04 Upstream Parity CI Gate Summary

Strict-superset parity CI gate that runs upstream gsd-build/get-shit-done's
golden test suite against the fork's packed tarball, via shared sanitize module.

## What Was Built

### Task 1: Extract tests/shared/sanitize.ts (commit bc5d4b76)

Created `tests/shared/sanitize.ts` by verbatim extraction of the `sanitize()`
function from `tests/conformance/init-bundlers.test.ts` lines 53-95. The
function body (19 chained `.replace()` calls) is reproduced without
reordering or simplification — order matters because some later regexes
assume earlier substitutions have already run.

Updated `tests/conformance/init-bundlers.test.ts` to import from the shared
module (`import { sanitize } from '../shared/sanitize.js'`) and removed the
local function declaration. Net effect: -52 lines (local declaration removed)
+1 line (import added). All existing init-bundlers tests continue to pass.

### Task 2: Create .github/workflows/upstream-parity.yml (commit d3d5f6fc)

New workflow `upstream-parity` that:
1. Checks out the fork, installs deps, builds adapters + SDK
2. Packs a tarball via `npm pack --silent`; captures filename via
   `steps.pack.outputs.tarball` for version-change resilience
3. Checks out `gsd-build/get-shit-done` at pinned tag `v1.42.0`
4. Installs the fork tarball into the upstream checkout via
   `npm install "../${{ steps.pack.outputs.tarball }}"`
5. Builds upstream SDK dist (`npm ci && npm run build`)
6. Runs upstream golden suite (`npx vitest run src/golden/`)

Triggers: `pull_request` to `[feat/storage-adapter, main]`, `push` to `main`,
`workflow_dispatch`.

### Task 3: Checkpoint auto-approved (--auto contract)

Per the orchestrator's `--auto` contract, the `checkpoint:human-verify` for
the first green PR-trigger CI run is auto-approved.

**Human-verification debt:** The workflow file is in place and committed, but
no pull request has triggered it yet. The first green run will occur when a
real PR is opened against `feat/storage-adapter` or `main`. At that point:

1. Open a PR against `feat/storage-adapter`
2. The `upstream-parity` workflow auto-triggers
3. Wait for the "Run upstream golden suite against fork" step to go green
4. Record the run URL and tested SHA in this SUMMARY

**Expected run URL template:** `https://github.com/elliottabirch/get-shit-done/actions/runs/<RUN_ID>`

**First green run:** DEFERRED — to be recorded after the first real PR.

## Upstream Tag Rationale

`git ls-remote upstream 'refs/tags/*'` returned (last 5, filtered for stable):

```
v1.41.1
v1.41.2
v1.42.0
v1.50.0-canary.1  (filtered — canary)
v1.50.0-canary.2  (filtered — canary)
```

Selected `v1.42.0` as the most recent stable (non-rc, non-alpha, non-canary)
tag. This is the version the parity workflow will use as the upstream baseline.

Tag bump in `upstream-parity.yml` is a deliberate PR (per D-16); reproducible;
requires intention to change.

## Acceptance Criteria Verification

| Criterion | Result |
|-----------|--------|
| `tests/shared/sanitize.ts` exists (>=25 lines) | PASS — 57 lines |
| `grep -c "export function sanitize" tests/shared/sanitize.ts` == 1 | PASS |
| `grep -c "\.replace(" tests/shared/sanitize.ts` >= 18 | PASS — 19 |
| `grep -c "^function sanitize" tests/conformance/init-bundlers.test.ts` == 0 | PASS |
| `grep -c "from '../shared/sanitize" tests/conformance/init-bundlers.test.ts` == 1 | PASS |
| `.github/workflows/upstream-parity.yml` exists (>=40 lines) | PASS — 59 lines |
| YAML valid (yaml.safe_load) | PASS |
| checkout SHA `de0fac2e...` count >= 2 | PASS — 2 |
| setup-node SHA `53b83947...` count >= 1 | PASS — 1 |
| `gsd-build/get-shit-done` reference >= 1 | PASS |
| `npm pack` reference >= 1 | PASS |
| `src/golden/` reference >= 1 | PASS |
| `feat/storage-adapter` reference >= 1 | PASS |
| `<UPSTREAM_TAG>` placeholder == 0 | PASS — replaced with v1.42.0 |
| No floating @v4/@v3/@v2 refs | PASS — 0 |
| `workflow_dispatch` trigger present | PASS |
| `concurrency:` block present | PASS |
| First green PR-trigger CI run | DEFERRED — human-verification debt |

## Deviations from Plan

None — plan executed exactly as written. The checkpoint:human-verify was
auto-approved per the orchestrator's `--auto` contract. The live PR-trigger
green run is the only deferred item, documented as human-verification debt above.

## Known Stubs

None. The parity workflow is fully wired; the only gap is the first real
execution (awaiting a PR trigger).

## Threat Flags

None. The workflow:
- Pins upstream at a tag (not floating main) — no supply-chain drift risk
- Uses no `${{ secrets.* }}` references — no secret exposure
- `npm pack` surface is identical to existing `npm ci` in test.yml
- Second `actions/checkout` for upstream uses the same pinned SHA as the
  first — no action-version divergence

## Self-Check: PASSED

Files exist:
- tests/shared/sanitize.ts: FOUND
- tests/conformance/init-bundlers.test.ts (modified): FOUND
- .github/workflows/upstream-parity.yml: FOUND

Commits exist:
- bc5d4b76 (Task 1 — sanitize extraction): FOUND
- d3d5f6fc (Task 2 — upstream-parity workflow): FOUND
