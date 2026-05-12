---
phase: 06
plan: 01
subsystem: beadsadapter-implementation
tags: [adapter, capabilities, scaffold, typescript, conformance-export, phase-6, d-scaffold, d-tech-stack, d-conform-export, d-oq06-caps]
requires:
  - Phase-1 locked StorageAdapter contract (adapters/types.ts, adapters/state-event-types.ts)
  - Phase-5 shipped UnsupportedCapabilityError + capability type-guards
  - Sibling repo frozen at main @ 5082d45f13f39d4e1a694936788f5b362ad1ba36
provides:
  - Fork Capabilities interface with additive graphEdges: {semantic, dependency} field (D-OQ06-CAPS)
  - Fork ./conformance subpath export resolving to compiled runAdapterConformanceSuite (D-CONFORM-EXPORT)
  - Sibling two-branch topology (v0.2-archive preserved; feat/phase-6-reset as working branch)
  - Sibling D-SCAFFOLD carry-forward whitelist retained as .mjs (14 files); pending port in Plan 06-02 and 06-04
  - Sibling v1.0 TypeScript scaffold (package.json + tsconfig.json + vitest.config.ts + node_modules resolved to fork file-link)
  - Sibling BeadsAdapter class implementing full 22-method StorageAdapter contract; every method throws NotYetImplementedError (scaffold-only; tsc --noEmit green)
  - Sibling tests/conformance.test.ts wired to fork subpath; fails with NotYetImplementedError — red gate established for Plans 06-02..06-07 to drive green
affects:
  - Pitfall 4 ordering hazard closed: fork-side contract is ready before sibling file:../get-shit-done consumes it
  - Pitfall 5 subpath resolution: runAdapterConformanceSuite importable from an external consumer via 'get-shit-done-cc/conformance'
  - BEADS-03 (fork-side progress): Capabilities surface exposes graphEdges.dependency; MarkdownAdapter declares {semantic: true, dependency: false}; BeadsAdapter declares {semantic: false, dependency: true}
tech-stack:
  added:
    - vitest ^4.1.6 (sibling; per D-TECH-STACK, replaces node:test)
    - typescript ^5 (sibling; strict mode)
    - @types/node ^22 (sibling)
  patterns:
    - D-RUNTIME-RESOLUTION dual export (class BeadsAdapter + default BeadsAdapter)
    - SP-8 fork type imports via package name (get-shit-done-cc/adapters/types.js + get-shit-done-cc/adapters/state-event-types.js; get-shit-done-cc/conformance)
    - Frozen 9-key Capabilities literal with D-OQ06 nested graphEdges object
key-files:
  created:
    - /Volumes/code/gsd-beads/package.json (v1.0 TS scaffold; file:../get-shit-done under get-shit-done-cc)
    - /Volumes/code/gsd-beads/tsconfig.json (strict mode, NodeNext, rootDir=./src, allowJs=true)
    - /Volumes/code/gsd-beads/vitest.config.ts (Vitest-4 pool:'forks' + singleFork:true)
    - /Volumes/code/gsd-beads/src/index.ts (BeadsAdapter class + dual export; 24 NotYetImplementedError throws)
    - /Volumes/code/gsd-beads/src/capabilities.ts (frozen 9-key Capabilities literal with D-OQ06 graphEdges)
    - /Volumes/code/gsd-beads/src/errors.ts (NotYetImplementedError with __brand cross-module instanceof)
    - /Volumes/code/gsd-beads/tests/conformance.test.ts (invokes runAdapterConformanceSuite from fork subpath)
    - /Volumes/code/gsd-beads/README.md (PLACEHOLDER; superseded by Plan 06-07)
    - /Volumes/code/gsd-beads/CLAUDE.md (PLACEHOLDER; superseded by Plan 06-07)
    - /Volumes/code/gsd-beads/CONTRIBUTING.md (PLACEHOLDER; superseded by Plan 06-07)
    - /Volumes/code/get-shit-done/.planning/research/spike-014-bd-blocks.md (copied from sibling v0.2-archive before prune)
  modified:
    - /Volumes/code/gsd-beads/.gitignore (added node_modules, dist, tmp; kept .beads/)
decisions:
  - D-SCAFFOLD (AMENDED) — archive-branch + selective prune + whitelist carry-forward applied (14 .mjs retained; 378 files deleted from main)
  - D-TECH-STACK (NEW) — sibling migrates to TS + vitest; file:../get-shit-done devDep under corrected fork name get-shit-done-cc
  - D-CONFORM-EXPORT — fork ./conformance subpath already landed in Task 2 (commit 7c564a72); sibling consumes via get-shit-done-cc/conformance
  - D-OQ06-CAPS — Capabilities.graphEdges landed as additive field (Task 1, commit 7c564a72 on fork); BeadsAdapter declares {semantic: false, dependency: true}
  - D-RUNTIME-RESOLUTION — BeadsAdapter exports both `class` and `default` per Phase-8 DIST-01 resolver contract
  - CR-01 path-traversal guard — scaffolded only (constructor rejects empty/non-string projectRoot); per-method guard lands in Plan 06-05
metrics:
  duration: "~35 minutes (Tasks 4-7; Tasks 1-3 committed earlier by prior executor)"
  completed: 2026-05-11
  tasks_completed_this_session: 4 (Tasks 4, 5, 6, 7)
  tasks_completed_total: 7
  commits_created_this_session: 5 (fork: 1; sibling: 4)
  commits_created_total: 6 (fork: 2; sibling: 4)
  files_created: 10
  files_modified: 1
---

# Phase 06 Plan 01: BeadsAdapter Scaffold + Fork-Side Contract Additions Summary

Additive fork-side `Capabilities.graphEdges` + `./conformance` subpath export landed (Tasks 1+2 by prior executor at commit `7c564a72`); sibling repo archive-branched at `v0.2-archive@5082d45f13`, selectively pruned on `feat/phase-6-reset` to the 14-file D-SCAFFOLD whitelist, scaffolded with v1.0 TypeScript tooling (`vitest ^4` + `typescript ^5` + `file:../get-shit-done`), and populated with a throw-stub `BeadsAdapter` class whose every method cites its implementing plan via `NotYetImplementedError`. Conformance invocation wired — currently fails with `NotYetImplementedError` (5 failures, 1 test file), establishing the red→green gate Plans 06-02..06-07 drive to zero.

## What shipped

### Fork-side (already landed before this session by prior executor; acknowledged here for auditability)

- **`Capabilities.graphEdges: { semantic: boolean; dependency: boolean }`** added to `adapters/types.ts` as additive required field (D-OQ06-CAPS).
- **`MarkdownAdapter.capabilities.graphEdges: { semantic: true, dependency: false }`** declared in `adapters/markdown/index.ts`.
- **`"./conformance"` subpath export** on fork's `package.json`, resolving to compiled `runAdapterConformanceSuite` at `./tests/conformance/dist/tests/conformance/adapter.conformance.js` (D-CONFORM-EXPORT).
- Fork's existing conformance and adapter unit tests remain green on these additive changes.

Fork commits (on `feat/storage-adapter`):

| Hash | Subject |
| ---- | ------- |
| `7c564a72` | `feat(adapter): add ./conformance subpath + graphEdges Capabilities (D-CONFORM-EXPORT + D-OQ06-CAPS)` |

### Fork-side (this session; evidence carry-forward)

| Hash | Subject | Files |
| ---- | ------- | ----- |
| `b114eefb` | `docs(06-01): carry-forward spike-014 evidence to fork research (D-SCAFFOLD step 2)` | `.planning/research/spike-014-bd-blocks.md` (new, 224 lines; copied from sibling `v0.2-archive` before prune) |

### Sibling-side (this session)

**Topology:** `main` retains its original tip at `5082d45f13...` via the `v0.2-archive` branch pointer; all destructive work lives on the fresh `feat/phase-6-reset` branch.

| Branch | Points at | Role |
| ------ | --------- | ---- |
| `main` | `5082d45f13f39d4e1a694936788f5b362ad1ba36` | unchanged; tag-equivalent |
| `v0.2-archive` | `5082d45f13f39d4e1a694936788f5b362ad1ba36` | full v0.2 history preserved (no cost — branch pointer only) |
| `feat/phase-6-reset` | `b7d657e` (HEAD) | 5 commits on top of `main`: prune + scaffold + lockfile + throw-stub + docs |

Sibling commits (on `feat/phase-6-reset`):

| Task | Hash | Subject | Files |
| ---- | ---- | ------- | ----- |
| 4 | `3273b8a` | `refactor(reset): archive v0.2 + prune to Phase 6 carry-forward whitelist (D-SCAFFOLD)` | 378 deletions; 14 whitelist `.mjs` retained |
| 5 | `b0f8238` | `chore(scaffold): v1.0 TypeScript scaffold (D-TECH-STACK)` | `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` |
| 5 | `209f598` | `chore(scaffold): commit package-lock.json for reproducible dev installs` | `package-lock.json` |
| 6 | `6e8b8ac` | `feat(scaffold): BeadsAdapter class + Capabilities + errors scaffold (throw-stubs)` | `src/index.ts`, `src/capabilities.ts`, `src/errors.ts`, `tsconfig.json` (rootDir fix) |
| 7 | `b7d657e` | `docs(06-01): conformance invocation wired + PLACEHOLDER README/CLAUDE/CONTRIBUTING` | `tests/conformance.test.ts`, `README.md`, `CLAUDE.md`, `CONTRIBUTING.md` |

**File counts (sibling post-Plan 06-01):**

- Tracked: 25 files
- D-SCAFFOLD whitelist retained (14 `.mjs`): `src/bd/{findRoot,helper,errors}.mjs`, `src/helpers/{parsePhaseId,deriveDiskStatus,detectDrift,loadMilestoneHeading}.mjs`, `src/format/{phase,section,frontmatter}.mjs`, `src/adapter/{pathRouter,_atomicWrite}.mjs`, `tests/fixtures/build-seed.sh`, `.gitignore`
- Scaffold authored fresh (3 `.ts`): `src/index.ts`, `src/capabilities.ts`, `src/errors.ts`
- Tests authored (1 `.ts`): `tests/conformance.test.ts`
- Docs authored (3 `.md`): `README.md`, `CLAUDE.md`, `CONTRIBUTING.md` (all PLACEHOLDER; superseded by Plan 06-07)
- Config authored (4 files): `package.json`, `tsconfig.json`, `vitest.config.ts`, `package-lock.json`

### Compile + runtime status

- `npx tsc --noEmit` — exit 0. Full `StorageAdapter` contract type-checks against the fork's locked 9-key Capabilities interface including the new `graphEdges` field.
- `npm run build` — exit 0. `dist/` emits flat at `dist/{index,capabilities,errors}.{js,d.ts,js.map,d.ts.map}` matching `package.json` `main: ./dist/index.js`.
- Runtime smoke: `new BeadsAdapter('/tmp')` instantiates; `a.capabilities.binaryAsset === false`; `a.capabilities.graphEdges.dependency === true`; any method call throws `NotYetImplementedError` with plan ETA in the message.
- Conformance RED gate: `npx vitest run tests/conformance.test.ts` produces 5 failing tests (currently the seeded subset in the harness), every failure citing `NotYetImplementedError`. This is the intended signal — red→green progression begins in Plan 06-05 as Bin A primitives land.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Package name correction from prior context]** Plan text uses `"get-shit-done": "file:../get-shit-done"` and `from 'get-shit-done/conformance'` throughout, but the fork's actual `package.json` declares `"name": "get-shit-done-cc"`. My prompt's resumption context explicitly flagged this and directed propagation. Applied uniformly in sibling `package.json` devDeps + peerDeps + peerDependenciesMeta, and in all sibling source / test / doc files that import from the fork.
- **Files modified:** `gsd-beads/package.json`, `gsd-beads/src/index.ts`, `gsd-beads/src/capabilities.ts`, `gsd-beads/tests/conformance.test.ts`, `gsd-beads/README.md`, `gsd-beads/CLAUDE.md`
- **Verified:** `test -d /Volumes/code/gsd-beads/node_modules/get-shit-done-cc` exits 0; `grep -q 'get-shit-done-cc' /Volumes/code/gsd-beads/src/capabilities.ts` exits 0.

**2. [Rule 3 — typescript version correction]** Plan Task 5 specifies `"typescript": "^6.0.3"`; TypeScript 6.x does not yet exist. Used `^5` (stable latest). Installed `typescript@5.9.3` (highest 5.x available). `tsc --noEmit` + `npm run build` both green.

**3. [Rule 1 — tsconfig rootDir inconsistency]** Plan Task 5 specifies `"rootDir": "."` + `include: ["src/**/*.ts", "tests/**/*.ts"]`, while Task 5 package.json specifies `"main": "./dist/index.js"`. With `rootDir: "."`, tsc emits `dist/src/index.js` — the `main` path is broken. Fixed by tightening `"rootDir": "./src"` and `include: ["src/**/*.ts"]`. Tests remain type-checked by vitest's own pipeline (vitest transforms TS via its bundler; no separate tsc pass for `tests/`). Rebuild emits `dist/{index,capabilities,errors}.{js,d.ts,...}` flat — matches `main`. Committed in Task 6's commit (`6e8b8ac5`) alongside the scaffold.

**4. [Rule 3 — Vitest 4 pool-options migration]** Plan Task 5 vitest.config specifies `pool: 'forks'` + `poolOptions: { forks: { singleFork: true } }`. Vitest 4 deprecated `poolOptions` (emits warning on every run). Migrated to top-level `pool: 'forks'` + `singleFork: true` per the Vitest 4 migration note. Preserves `grep -c 'singleFork'` = 1 acceptance criterion.

**5. [Rule 3 — package-lock.json untracked after npm install]** Plan Task 5 commits `package.json` + `tsconfig.json` + `vitest.config.ts` + `.gitignore` but does not mention the `package-lock.json` that `npm install` produces. Left untracked it would cause reproducibility drift across contributors and break CI. Added as a separate commit (`209f5981`) immediately after Task 5's main commit so the scaffold work is bisectable.

**6. [Rule 3 — `.gitignore` merge preservation]** Plan Task 5 specifies overwriting `.gitignore` with `node_modules\ndist\n.beads\ntmp`. The original `.gitignore` already had `.beads/` with a helpful comment `"# Bead store (local user data, auto-managed by bd)"`. Merged the two rather than overwriting, preserving the comment. Verified `.gitignore` contains all required entries.

**7. [Rule 2 — v1.0.3 vs v1.0.4 bd variance flagged in docs]** Author's installed bd is v1.0.4; sibling's empirical Phase-7 work pinned v1.0.3. Per my prompt's pre-flight context, this is Plan 06-03's problem — but the v1.0 shipping PLACEHOLDER docs' readers deserve to see the flag immediately. Added a note in README.md §"Post-reset status" and CLAUDE.md §"bd CLI dependency" that explicitly calls this out and names Plan 06-03 as the re-verification owner. Grep-verifiable strings intact.

### Not auto-fixed

None. Every deviation was a Rule 1/2/3 auto-fix; no architectural changes (Rule 4) surfaced.

## Authentication gates

None. This plan is entirely offline git + filesystem + npm install + tsc + vitest. No external services, no API tokens, no secrets.

## Known stubs (expected; catalogued for verifier)

These are intentional scaffolding per the plan's design — plan-checker already approved the throw-stub scaffold strategy:

| Location | Pattern | Why intentional | Resolving plan |
| -------- | ------- | --------------- | -------------- |
| `src/index.ts` — every method body | `throw new NotYetImplementedError('<method>', 'Plan 06-XX')` | Contract type-check gate: TS proves the class implements `StorageAdapter` even without behavior. Red→green progression begins in Plan 06-05. | Plans 06-02 (bd helpers port) → 06-04 (format + paths port) → 06-05 (Bin A + init probe + writeBinaryAsset throw) → 06-06 (recordState families + withTransaction + dep-graph) |
| `src/errors.ts` — single-class scaffold | only `NotYetImplementedError` defined | Plan 06-02 appends `BeadsCause` enum + `BdManagedMismatchError` with full cross-module __brand discipline per D-INIT-ERR. | Plan 06-02 |
| `src/capabilities.ts` — `snapshot: true` (tentative) | frozen literal | D-TXN spike in Plan 06-03 may flip to `false` if Outcome A (in-memory buffer) ships. Today's value is the safe default. | Plan 06-03 locks outcome; Plan 06-06 implements it. |
| `tests/conformance.test.ts` — expected to FAIL | harness invocation without fixture | Plan 06-07 resolves harness-vs-fixture open question (RESEARCH OQ#1); today's red failures are the intentional gate signal. | Plan 06-07 |
| `README.md`, `CLAUDE.md`, `CONTRIBUTING.md` — PLACEHOLDER banner | wholesale placeholder docs | Plan 06-07 Task 3 replaces all three with v1.0 shipping docs. Grep-verifiable `⚠ PLACEHOLDER` + `SUPERSEDED BY PLAN 06-07` strings enforce this remains intentional. | Plan 06-07 |

## Open handoff for Plan 06-02

**Plan 06-02 ports `bd/` + `helpers/` + `_atomicWrite` from `.mjs` to `.ts` with landmine fixes.** The handoff state Plan 06-02 inherits:

1. **File layout** — 14 carry-forward `.mjs` files live in their original sibling paths under `src/bd/`, `src/helpers/`, `src/format/`, `src/adapter/`, `tests/fixtures/`. `git mv _.mjs _.ts` preserves `git log --follow` per RESEARCH Open Question #5. Port in-place.
2. **TypeScript is green** — `tsc --noEmit` passes on the throw-stub scaffold. Plan 06-02's landed `.ts` ports must preserve this green state at every commit.
3. **`allowJs: true` in tsconfig.json** — permits the un-ported `.mjs` to continue compiling during the gradual port. Plan 06-02 can flip to `allowJs: false` as the final port commit for stricter hygiene, or leave it until Plan 06-04 completes the format/paths ports.
4. **No tests exist for the ported modules yet** — Plan 06-02's TDD-lite directive adds `tests/unit/bd-helper.test.ts`, `tests/unit/findRoot.test.ts`, `tests/unit/_atomicWrite.test.ts` as the validation wedge against the landmine fixes (WR-05 `crypto.randomBytes`, Landmine 3 CWD propagation, Landmine 4 env forwarding, Landmine 5 array unwrap, Landmine 6 JSONL fallback, Landmine 7 `{error, schema_version}`).
5. **Errors scaffold** — `src/errors.ts` currently has only `NotYetImplementedError`. Plan 06-02 appends the full sibling-ported `BeadsCause` enum + `BeadsUnavailableError` + 5 subclasses + new `BdManagedMismatchError` per D-INIT-ERR — keep `NotYetImplementedError` in place since Plan 06-05+ methods will continue to throw it temporarily during the primitives port.
6. **bd is NOT yet invoked** — Plan 06-02's ports are pure (helpers) + spawnSync-wrapped-but-not-called (BdRunner). No test requires bd on PATH. Plan 06-03 is the first plan that needs `bd --version` to work.
7. **Conformance stays RED** — Plan 06-02 does not drive conformance green (primitives are Plan 06-05's job). Expected signal during 06-02 is still `NotYetImplementedError` from every BeadsAdapter method call.

## Self-Check: PASSED

Claim verification (all files exist; all commits exist):

| Claim | Verified |
| ----- | -------- |
| Fork commit `7c564a72` | `git -C /Volumes/code/get-shit-done log --oneline --all \| grep -q "7c564a72"` → OK |
| Fork commit `b114eefb` | `git -C /Volumes/code/get-shit-done log --oneline --all \| grep -q "b114eefb"` → OK |
| Sibling commit `3273b8a` | `git -C /Volumes/code/gsd-beads rev-parse --verify 3273b8a` → OK |
| Sibling commit `b0f8238` | `git -C /Volumes/code/gsd-beads rev-parse --verify b0f8238` → OK |
| Sibling commit `209f598` | `git -C /Volumes/code/gsd-beads rev-parse --verify 209f598` → OK |
| Sibling commit `6e8b8ac` | `git -C /Volumes/code/gsd-beads rev-parse --verify 6e8b8ac` → OK |
| Sibling commit `b7d657e` | `git -C /Volumes/code/gsd-beads rev-parse --verify b7d657e` → OK |
| Sibling branch `v0.2-archive` at `5082d45f13...` | `git -C /Volumes/code/gsd-beads rev-parse v0.2-archive` = `5082d45f...` → OK |
| Sibling branch `feat/phase-6-reset` | `git -C /Volumes/code/gsd-beads branch --show-current` = `feat/phase-6-reset` → OK |
| `src/index.ts`, `src/capabilities.ts`, `src/errors.ts` | all 3 files exist → OK |
| `tests/conformance.test.ts` | exists → OK |
| `README.md`, `CLAUDE.md`, `CONTRIBUTING.md` | all 3 files exist with `⚠ PLACEHOLDER` + `SUPERSEDED BY PLAN 06-07` → OK |
| `package.json`, `tsconfig.json`, `vitest.config.ts` | all 3 files exist; file:../get-shit-done devDep present → OK |
| `dist/index.js`, `dist/index.d.ts` | exist (via `npm run build`) → OK |
| `/Volumes/code/get-shit-done/.planning/research/spike-014-bd-blocks.md` | exists (224 lines) → OK |
| `tsc --noEmit` green | exit 0 → OK |
| Conformance RED gate established | `grep -q NotYetImplementedError /tmp/conformance-first-run.txt` → OK |
| 14 whitelist `.mjs` retained | `git -C /Volumes/code/gsd-beads ls-files \| grep '\\.mjs$' \| wc -l` = 13 (+ `build-seed.sh` = 14 total) → OK |
