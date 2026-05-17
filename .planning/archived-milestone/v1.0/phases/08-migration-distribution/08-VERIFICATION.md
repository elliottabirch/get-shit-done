---
phase: 08-migration-distribution
verified: 2026-05-13T23:30:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
re_verification: false
deferred:
  - truth: "First green pull_request-trigger CI run demonstrates parity (DIST-04 checkpoint)"
    addressed_in: "Phase 8.x or post-v1.0"
    evidence: "08-05-SUMMARY.md explicitly documents this as human-verification debt; upstream-parity.yml exists and triggered draft PR #2 (run surfaced 2 design findings, not a code regression). Workflow file is wired; first clean green run requires fixture follow-up."
  - truth: "gsd-beads migrate end-to-end live test"
    addressed_in: "sibling repo gsd-beads Phase 8"
    evidence: "Fork DIST-02 is docs-only per D-07/D-08. Migration implementation is sibling-owned. No fork-side implementation was planned or expected."
  - truth: "Sibling gsd-beads graduation to main"
    addressed_in: "post-v1.0"
    evidence: "08-06-SUMMARY.md and ADR D-2026-05-13-DIST-05 Consequences: sibling stays on feat/phase-6-reset; graduation is explicitly post-v1.0."
  - truth: "External adopter signal (NPM-01)"
    addressed_in: "Future Requirements"
    evidence: "REQUIREMENTS.md §Future Requirements contains NPM-01; DIST-05 ADR cites zero adopters as input to option-b decision. Not a Phase 8 blocker."
human_verification:
  - test: "Confirm upstream-parity.yml first green CI run"
    expected: "A real PR to feat/storage-adapter triggers the upstream-parity workflow; the 'Run upstream golden suite against fork' step passes green. Two known fixture issues need resolution first: (1) verify.commits git-history seeding in upstream-checkout, (2) STATE.md fixture missing in upstream-checkout."
    why_human: "Cannot verify CI run outcome programmatically without a live PR. Workflow file is in place and wired; correctness of parity-check data assumptions requires a real run plus fixture follow-up."
---

# Phase 8: Migration + Distribution Verification Report

**Phase Goal:** Existing markdown-backed users have a working migration path to bd and a documented distribution story (fork rebase, leak-grep CI behavior on rebase, conflict playbook, PR-vs-long-lived-fork decision).
**Verified:** 2026-05-13T23:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pre-0: gen-command-aliases.ts writes BOTH typed-TS + CJS artifacts; if: false bypass removed | VERIFIED | Generator has 2 `writeFile` calls; `check-command-aliases-fresh.mjs` exits 0 with "command alias artifacts are fresh"; no `if: false`, `TODO(phase-8)`, or `TEMPORARILY DISABLED` in test.yml; alias drift check step present at line 163 |
| 2 | DIST-01: Adapter factory exists, BeadsAdapterUnavailable exported, all hardcoded MarkdownAdapter sites migrated | VERIFIED | `sdk/src/query/adapter-factory.ts` (77 LOC); exports `createStorageAdapter`, `BeadsAdapterUnavailable`, `StorageAdapterName`, `CreateStorageAdapterOpts`; zero orphan `new MarkdownAdapter()` outside factory + helpers.ts; `storage.adapter` in both config-schema.ts and config-schema.cjs; `GSDConfig.storage?` typed in config.ts |
| 3 | DIST-02: docs/MIGRATION.md covers markdown→bd path; README links to it; no impl code in fork | VERIFIED | `docs/MIGRATION.md` exists (122 lines); all 10 H2 sections present; references `gsd-beads migrate` (4×), `storage.adapter` (1×), `commitPlanningState` NOOP (1×), `markdown-backup` (2×); `README.md` has `## Storage backends` linking to `docs/MIGRATION.md`; no TS/JS code added to fork |
| 4 | DIST-03: docs/UPSTREAM-REBASE.md + scripts/sync-upstream.sh with POSIX sh, leak-grep advisory, D-14 taxonomy | VERIFIED | `scripts/sync-upstream.sh` (36 lines, executable, `#!/bin/sh`, `bash -n` clean); invokes `leak-grep.cjs` with `\|\| true`; `docs/UPSTREAM-REBASE.md` (178 lines); 3-category taxonomy with H3 headings including "RED FLAG - INVESTIGATE"; 2× INVESTIGATE, 2× RED FLAG, 2× advisory/non-blocking, 2× on-demand |
| 5 | DIST-04: tests/shared/sanitize.ts extracted; upstream-parity.yml valid, pinned SHAs, npm pack, triggers correct | VERIFIED | `tests/shared/sanitize.ts` (57 lines, `export function sanitize`, 19 `.replace()` calls); `init-bundlers.test.ts` imports from shared, no local declaration; `upstream-parity.yml` (65 lines, YAML valid, 2× checkout SHA, 1× setup-node SHA, `feat/storage-adapter` trigger, `v1.42.0` tag, no floating refs) |
| 6 | DIST-05: ADR D-2026-05-13-DIST-05 with all 4 subheadings, cites #2898/#2901/#2908; all DIST rows Complete | VERIFIED | `DECISIONS.md` has `## D-2026-05-13-DIST-05` with Context/Decision/Rationale/Consequences; cites all three PRs (#2898, #2901, #2908); no TODO/PLACEHOLDER; `REQUIREMENTS.md` shows all 5 DIST rows `Complete (Phase 8)` and `[x]` checkboxes; zero Pending in DIST rows |

**Score:** 6/6 truths verified

---

### Deferred Items

Items not yet met but explicitly addressed in later phases or explicitly out of scope.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | First green upstream-parity CI run | Phase 8.x / post-v1.0 | 08-05-SUMMARY.md documents as human-verification debt; workflow triggered draft PR #2 and surfaced 2 fixture design findings (not code regressions) |
| 2 | `gsd-beads migrate` end-to-end live test | sibling gsd-beads Phase 8 | Fork DIST-02 is docs-only per D-07/D-08; implementation is sibling-owned |
| 3 | Sibling `gsd-beads` graduation to `main` | post-v1.0 | DIST-05 ADR Consequences: explicitly post-v1.0 |
| 4 | External adopter signal (NPM-01) | Future Requirements | Recorded in REQUIREMENTS.md §Future Requirements; DIST-05 ADR cites zero adopters as input |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `sdk/scripts/gen-command-aliases.ts` | Dual-file writer (TS + CJS) | VERIFIED | 3× `writeFile` imports/calls; formatTs + formatCjs; both path references |
| `sdk/src/query/command-aliases.generated.ts` | Typed TS artifact with FamilyCommandAlias | VERIFIED | 8× `FamilyCommandAlias`, 7× `readonly`, 7× `as const`, 7× `Set<string>` |
| `get-shit-done/bin/lib/command-aliases.generated.cjs` | CJS artifact with module.exports | VERIFIED | `module.exports` present |
| `.github/workflows/test.yml` | No `if: false` bypass | VERIFIED | 0 occurrences of `if: false`, `TODO(phase-8)`, `TEMPORARILY DISABLED`; alias drift check step at line 163 |
| `sdk/src/query/adapter-factory.ts` | createStorageAdapter + BeadsAdapterUnavailable | VERIFIED | 77 LOC; all 4 exports; `createRequire`, `Symbol.hasInstance`, `__brand` field |
| `sdk/src/query/adapter-factory.test.ts` | Unit tests (≥4 it() blocks) | VERIFIED | 5 test cases; all cover BeadsAdapterUnavailable |
| `sdk/src/query/config-schema.ts` | VALID_CONFIG_KEYS has `storage.adapter` | VERIFIED | 2 occurrences (comment + string) |
| `get-shit-done/bin/lib/config-schema.cjs` | CJS mirror has `storage.adapter` | VERIFIED | 2 occurrences |
| `docs/MIGRATION.md` | User-facing migration guide (≥80 lines) | VERIFIED | 122 lines; all 10 H2 sections; all D-07..D-11 decisions covered |
| `README.md` | Storage backends section linking to MIGRATION.md | VERIFIED | 1× `## Storage backends`; 1× `docs/MIGRATION.md` link; gsd-beads migrate present |
| `scripts/sync-upstream.sh` | POSIX sh, executable, ≥20 lines | VERIFIED | 36 lines; `#!/bin/sh`; executable; `bash -n` clean; `\|\| true` on leak-grep |
| `docs/UPSTREAM-REBASE.md` | Playbook with conflict taxonomy (≥60 lines) | VERIFIED | 178 lines; H3 taxonomy with all 3 categories; INVESTIGATE workflow present |
| `tests/shared/sanitize.ts` | Extracted sanitize() export (≥25 lines) | VERIFIED | 57 lines; `export function sanitize`; 19 `.replace()` calls |
| `.github/workflows/upstream-parity.yml` | Valid YAML parity workflow (≥40 lines) | VERIFIED | 65 lines; YAML valid; pinned SHAs; npm pack; v1.42.0 tag; correct triggers |
| `.planning/DECISIONS.md` | DIST-05 ADR appended | VERIFIED | `## D-2026-05-13-DIST-05` at line 1596; all 4 subheadings; #2898/#2901/#2908 cited |
| `.planning/REQUIREMENTS.md` | All 5 DIST rows Complete, all [x] checkboxes | VERIFIED | Lines 80-84: `[x]` for DIST-01..05; lines 184-188: `Complete (Phase 8)` for all 5 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `gen-command-aliases.ts` | `command-aliases.generated.ts` | `writeFile` with TS path | WIRED | Line 140: `await writeFile(tsOutPath, formatTs(families), 'utf-8')` |
| `gen-command-aliases.ts` | `command-aliases.generated.cjs` | `writeFile` with CJS path | WIRED | Line 141: `await writeFile(cjsOutPath, formatCjs(families), 'utf-8')` |
| `adapter-factory.ts` | `adapters/markdown/index.ts` | static import | WIRED | Line 14: `import { MarkdownAdapter } from '../../../adapters/markdown/index.js'` |
| `adapter-factory.ts` | `gsd-beads` peer | `createRequire(import.meta.url)('gsd-beads')` | WIRED | Line 66: `const mod = _require('gsd-beads')` in try/catch |
| call sites (7 files) | `adapter-factory.ts` | `import { createStorageAdapter }` | WIRED | Verified in gsd-tools.ts, cli.ts, index.ts, query-gsd-tools-runtime.ts, query-cli-adapter.ts, commands-list.ts, index.ts (query), golden/registry-canonical-commands.ts |
| `README.md` | `docs/MIGRATION.md` | `[docs/MIGRATION.md](docs/MIGRATION.md)` | WIRED | 1 match in Storage backends section |
| `docs/MIGRATION.md` | `gsd-beads migrate` (sibling CLI) | prose reference | WIRED | 4 occurrences |
| `docs/MIGRATION.md` | `.planning/config.json storage.adapter` | config snippet | WIRED | `storage.adapter` present with `"beads"` value |
| `scripts/sync-upstream.sh` | `scripts/leak-grep.cjs` | `xargs node "$SCRIPT_DIR/leak-grep.cjs"` | WIRED | 1 occurrence with `\|\| true` |
| `scripts/sync-upstream.sh` | `git rebase upstream/main` | `git rebase "$UPSTREAM_REF"` | WIRED | 1 occurrence |
| `docs/UPSTREAM-REBASE.md` | `scripts/sync-upstream.sh` | Quick path reference | WIRED | 2 occurrences |
| `upstream-parity.yml` | `gsd-build/get-shit-done` at pinned tag | second `actions/checkout` | WIRED | `repository: gsd-build/get-shit-done`, `ref: v1.42.0` |
| `upstream-parity.yml` | fork tarball | `npm pack` + `npm install ../*.tgz` | WIRED | `npm pack --silent` + `steps.pack.outputs.tarball` |
| `tests/conformance/init-bundlers.test.ts` | `tests/shared/sanitize.ts` | `import { sanitize } from '../shared/sanitize.js'` | WIRED | 1 occurrence; local declaration removed |
| `DECISIONS.md DIST-05 ADR` | upstream PRs #2898/#2901/#2908 | prose citation | WIRED | Both Context and Rationale sections cite all 3 PRs |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `adapter-factory.ts` | `BeadsAdapterCtor` | `_require('gsd-beads')` with try/catch | Yes — live require at runtime | FLOWING |
| `adapter-factory.ts` | `MarkdownAdapter` | static import, `new MarkdownAdapter(projectDir)` | Yes — direct construction | FLOWING |
| call sites (e.g. cli.ts) | `cliConfig.storage?.adapter` | `loadConfig()` result | Yes — reads `.planning/config.json` | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Alias artifacts are fresh | `node sdk/scripts/check-command-aliases-fresh.mjs` | "command alias artifacts are fresh" | PASS |
| `if: false` bypass removed | `grep "if: false" .github/workflows/test.yml` | 0 matches | PASS |
| Zero orphan MarkdownAdapter sites | `grep -rn "new MarkdownAdapter(" sdk/src/ \| grep -v factory \| grep -v helpers` | 0 matches | PASS |
| DIST-05 no Pending rows | `grep "DIST-0.*Pending" .planning/REQUIREMENTS.md` | 0 matches | PASS |
| upstream-parity.yml YAML valid | `python3 -c "import yaml; yaml.safe_load(...)"` | exits 0 | PASS |
| sync-upstream.sh syntax | `bash -n scripts/sync-upstream.sh` | exits 0 | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DIST-01 | 08-02-PLAN.md | User opts in to alternate adapter via `storage.adapter: beads` | SATISFIED | adapter-factory.ts + config-schema extension + 9 call-site migrations verified |
| DIST-02 | 08-03-PLAN.md | Migration tool docs for markdown→bd path | SATISFIED | docs/MIGRATION.md (122 lines, all decisions covered) + README storage backends section |
| DIST-03 | 08-04-PLAN.md | Fork divergence workflow documented + leak-grep on rebase | SATISFIED | sync-upstream.sh + docs/UPSTREAM-REBASE.md both verified |
| DIST-04 | 08-05-PLAN.md | Strict-superset invariant validated via parity CI | SATISFIED (with human-verify debt) | upstream-parity.yml wired; first green run deferred per known_deferred |
| DIST-05 | 08-06-PLAN.md | Distribution decision recorded | SATISFIED | ADR D-2026-05-13-DIST-05 present with option-b (long-lived fork); all DIST rows Complete |
| Pre-0 | 08-01-PLAN.md | SDK alias generator dual-file write + CI bypass removed | SATISFIED | Generator verified; check-command-aliases-fresh.mjs green; test.yml bypass removed |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Scanned: `sdk/src/query/adapter-factory.ts`, `sdk/src/query/adapter-factory.test.ts`, `.github/workflows/upstream-parity.yml`, `docs/MIGRATION.md`, `docs/UPSTREAM-REBASE.md`, `.planning/DECISIONS.md`. No TODO, FIXME, PLACEHOLDER, `return null`, `return {}`, or stub patterns found.

---

### Human Verification Required

#### 1. First Green upstream-parity CI Run

**Test:** Open a PR against `feat/storage-adapter`, wait for the `upstream-parity` workflow to trigger, and verify the "Run upstream golden suite against fork" step passes green.

**Expected:** The parity workflow completes successfully, confirming that upstream's golden suite (`sdk/src/golden/`) passes when run against the fork's packed tarball at upstream tag `v1.42.0`.

**Known pre-conditions to fix before green run is achievable:**
- `verify.commits` step in upstream's golden suite expects git history that is not present in the upstream-checkout (fixture needs seeding or the parity workflow step needs scoping).
- `STATE.md` fixture may be absent in the upstream-checkout. Both findings were surfaced by draft PR #2 on 2026-05-13 and documented in `08-05-SUMMARY.md`.

**Why human:** Cannot programmatically verify a CI run outcome. The workflow file is syntactically valid, wired correctly, and triggered once — the outstanding item is the two fixture design issues that prevented the first run from going fully green.

---

### Gaps Summary

No blocking gaps. All 6 must-haves are verified against the codebase. The single `human_needed` item (DIST-04 first green CI run) is explicitly documented in the `known_deferred` list in the verification objective and tracked in `08-05-SUMMARY.md`. The upstream-parity workflow is structurally correct; the gap is fixture-level correctness of the parity check, not the plumbing.

---

_Verified: 2026-05-13T23:30:00Z_
_Verifier: Claude (gsd-verifier)_
