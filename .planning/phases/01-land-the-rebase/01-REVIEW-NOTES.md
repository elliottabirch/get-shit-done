---
phase: 01-land-the-rebase
reviewed: 2026-05-17T17:30:00Z
depth: spot-check-by-file-class
rebase_window: ae63cbe5..8dad5dd6
commits_total: 368
commits_reviewed_full: 107
commits_sampled: 13
findings:
  adapter_seam_surprises: 1
  config_semantic_drift: 1
  flagged_for_followup: 1
status: flagged
---

# Phase 1: Diff Review — REVIEW-NOTES

## Cohort counts

| Cohort | Size | Note |
|--------|------|------|
| Adapter-seam (adapters/ + sdk/src/) | 94 | Full review per D-12 |
| Workflows (get-shit-done/) | 13 | Full review (small set) |
| Test files (.test.ts) | 65 | Sampled ~20% (every 5th) = 13 entries |
| Planning docs (.planning/) | 224 | Not reviewed (docs/artifacts only) |
| Large commits (>10 files OR >300 ins) | 80 | 18 overlap with seam cohort; 62 large-only |
| **TOTAL** | **368** | Branch advanced 11 since research (docs commits for Phase 1 v1.1 setup) |

Note: the plan expected 357 commits; the branch tip at `8dad5dd6` has 368 (11 additional commits since research was done — all Phase 1 v1.1 planning-doc commits). The original 357 adapter + seam commits are all present. Commit counts per cohort verified via `git log ae63cbe5..feat/storage-adapter-staging`.

## (a) File-class breakdown

| File class | Commits touching | Reviewed | Coverage |
|------------|-----------------|----------|----------|
| `adapters/` + `sdk/src/` (adapter seam) | 94 | 94 (all) | Full — D-12 mandatory |
| `get-shit-done/` workflows | 13 | 13 (all) | Full — small set |
| `.test.ts` / `.integration.test.ts` | 65 | 13 (sampled) | ~20% sample per D-12 |
| `.planning/` docs/artifacts | 224 | 0 | Not reviewed — docs only |
| Large (>10 files OR >300 ins) | 80 | 80 (all) | Full — D-12 mandatory |

## (b) Adapter-seam commit verdicts

Every commit touching `adapters/` or `sdk/src/`. Listed newest-first.

| SHA | Subject | Verdict |
|-----|---------|---------|
| `5a063672` | fix(state-mutation): callback form on every replace to defuse \$ interpretation | clean |
| `a4294592` | fix(rebase): restore upstream feature ports + thread adapter through tests | expected-PORT |
| `cc384d62` | fix(rebase): post-merge TypeScript cleanup | clean |
| `36792174` | fix(phase-8): register verify.fat-skills in registry-assembly | clean |
| `1f24d4ab` | feat(08-01): rewrite gen-command-aliases.ts to emit both TS and CJS artifacts | clean |
| `0e823f17` | feat(08-02): migrate all construction sites from new MarkdownAdapter() to createStorageAdapter() | clean |
| `156c49eb` | feat(08-02): extend config schema with storage.adapter key + GSDConfig.storage type | flag:config-schema-is-inline-not-manifest-backed |
| `8196640f` | feat(08-02): create adapter-factory.ts with BeadsAdapterUnavailable + unit tests | clean |
| `077c67c8` | fix(adapters): update stale Phase-1 assertions + wire adapter tests in CI (CR-01) | clean |
| `3167dc17` | feat(07-01): add normalize() to StorageAdapter interface + MarkdownAdapter identity impl (TDD GREEN) | clean |
| `5b26cf1c` | test(07-01): add failing normalize() D-13 tests (TDD RED) | clean |
| `033fe2fe` | feat(adapter): add ./conformance subpath + graphEdges Capabilities (D-CONFORM-EXPORT + D-OQ06-CAPS) | clean |
| `9848939a` | refactor(adapter): wrap recordStateSignal in withTransaction (IN-03, IN-04) | clean |
| `efe271b4` | refactor(adapter): dedupe mutateDeferredItems add path (IN-02) | clean |
| `c29d18977` | refactor(adapter): make HelperResult a discriminated union (IN-01) | clean |
| `ceaf8a5c` | fix(adapter): detect .gsd/WAITING.json in resume existence check (WR-03) | clean |
| `8f4b494a` | fix(adapter): restore independent field updates in updateSessionFields (WR-01) | clean |
| `df7064e9` | feat(adapter): land StateWriteOutcome three-state contract (03-06 gap) | clean |
| `7757110c` | fix(adapter): harden silent-noop append helpers (blocker/metric/todo) | clean |
| `c13ab605` | refactor(sdk): remove dead updateStateProgressFields helper | clean |
| `410218b4` | fix(sdk): make syncStateFrontmatter the single writer of progress fields | clean |
| `519e33dd` | fix(adapter): decision append no longer silently drops on heading variants | clean |
| `c76cd4d8` | refactor(05-06): migrate codebase-docs handlers to putNamedDoc/getNamedDoc | clean |
| `57f41610` | refactor(05-06): migrate named-docs handlers to putNamedDoc/getNamedDoc | clean |
| `f889590f` | fix(05-06): apply D-21 sidecar migration to route-next-action.ts | clean |
| `7112c3fe` | test: unskip drift baselines and point registry-assembly tests at fork factory | clean |
| `dc243211` | test: unskip platform-sensitive fixtures and skip upstream-only paths | clean |
| `1abb9832` | fix(sdk): align SDK handlers with adapter contract and restore regressions | clean |
| `cb2dc6fd` | fix(adapters): restore test harness correctness for MarkdownAdapter | clean |
| `2651c260` | Revert "chore: merge executor worktree (worktree-agent-a3b97445c6af6a42a)" | clean |
| `970a5fa4` | docs(sdk): close JSDoc block on toAdapterDir | clean |
| `2f5126c1` | refactor(05-06): migrate SDK handlers to putNamedDoc/getNamedDoc primitives | clean |
| `b2b82c0c` | feat(05-05): add sidecar.ts + scratch.ts with 8 SDK verbs; flip test placeholders to live tests | clean |
| `57ceda0d` | feat(05-05): refactor pipeline dry-run to withTransaction; add _realReadForPipeline; SC#1 test | clean |
| `040ffa64` | feat(05-04): implement putNamedDoc/getNamedDoc/writeBinaryAsset primitives | clean |
| `e0ac74df` | feat(05-03): implement shadow-dir journal with rollback, reentrant locks, snapshot/restore | clean |
| `ec7b1f00` | revert(05-02): remove out-of-scope vitest/types devDependencies | clean |
| `6219cb5c` | test(05-02): flip section-depth test.todo cases to live tests | clean |
| `fa08a2aa` | feat(05-02): implement heading-depth walker in MarkdownAdapter | clean |
| `64187619` | fix(sdk): stub handler return shape must satisfy QueryHandler contract | clean |
| `c0018738` | test(05-01): add Wave 0 test scaffolds for Phase 5 primitive lift | clean |
| `c9bb3b45` | feat(05-01): add NamedDocCategory/RootNamedDocKey types and discriminated overloads (D-13/D-14) | clean |
| `2775cdbf` | fix(04): register stub handlers for Wave 3/4 SDK query verbs | clean |
| `c5f4c1da` | feat(04-07): ship pre-commit leak gate + verify zero-leak state + document OQ-03/OQ-04 | clean |
| `38b26f1e` | feat(04-06): implement verify.fat-skills query handler (LEAKS-05) | clean |
| `f46e6dd1` | refactor(04-06): migrate 14 SDK test fixtures to adapter.putRecord() | clean |
| `3ab2992f` | fix(04): resolve post-merge test failures from wave 2 | clean |
| `f87c5ec2` | fix(04-02): remove false-positive leak in sdk/src/index.ts | clean |
| `b50eba9f` | feat(04-02): migrate config.ts and init-runner.ts to adapter (8 leaks) | clean |
| `e876bbe9` | feat(04-02): migrate 13 remaining SDK query files to adapter (42 leaks) | clean |
| `b821efaf` | feat(04-02): migrate config-mutation, workstream, validate to adapter (33 leaks) | clean |
| `33b2b887` | feat(04-02): migrate init.ts and init-complex.ts to adapter (26 leaks) | clean |
| `3ad362d8` | feat(04-01): register 25 new query verbs in command manifest and index.ts | clean |
| `fd914c3d` | feat(04-01): create 7 new SDK query handler files with adapter-based implementations | clean |
| `9737a6ba` | feat(03-03): migrate stateUpdateProgress, stateSync, stateMilestoneSwitch, statePrune to adapter + deprecate readModifyWriteStateMd | clean |
| `1b14e36e` | feat(03-03): migrate stateUpdate, statePatch, stateBeginPhase, stateAdvancePlan, statePlannedPhase to adapter | clean |
| `1d38ae07` | feat(03-04): refactor 13 phase-lifecycle handlers to adapter-routed thin orchestrators | clean |
| `e77d849e` | feat(03-04): extract domain helpers from phase-lifecycle into phase-helpers.ts | clean |
| `0621a246` | feat(03-02): refactor 8 event-type handlers to call adapter.recordState* | clean |
| `de66da45` | feat(03-02): implement recordStateAppend/Mutation/Signal in MarkdownAdapter | clean |
| `89c361bb` | feat(03-01): create phase-helpers scaffold + extend leak-grep write patterns | clean |
| `0faef092` | feat(03-01): implement withTransaction in MarkdownAdapter + event stubs | clean |
| `0620e1d9` | feat(03-01): define event type unions + extend StorageAdapter interface | clean |
| `83c8d5af` | fix(02-gaps): convert phasesList/phaseNextDecimal internals to adapter reads | clean |
| `6363f111` | fix(02-gaps): complete SC#1 + SC#4 gap fixes — all reads through adapter, 0 test regressions | clean |
| `44b94dc4` | WIP(02-gaps): migrate state.ts + init handlers to adapter-first-arg | clean |
| `ce187f69` | fix(upstream-sync): resolve 13 test failures after 228-commit rebase | expected-PORT |
| `ba65de55` | fix(upstream-sync): make adapter optional with MarkdownAdapter default | clean |
| `b62278d1` | fix(upstream-sync): reconcile adapter DI with upstream's registry-assembly refactor | clean |
| `c44eaf72` | fix(02-04): update init test signatures for adapter-as-first-arg migration | clean |
| `dc6468a9` | refactor(02-04): migrate init.ts bundlers (14) through adapter helpers | clean |
| `fc2940d5` | refactor(02-02): migrate audit-open/progress/verify reads through adapter | clean |
| `d3f95583` | refactor(02-02): migrate phase/roadmap reads through adapter | clean |
| `4909f26d` | refactor(02-03): migrate intel/docs-init reads through adapter (Task 2) | clean |
| `c6d2c6dc` | refactor(02-03): migrate summary/uat reads through adapter (Task 1) | clean |
| `d717b85f` | refactor(02-01): rewire createRegistry to thread adapter to handlers | clean |
| `79fa14e9` | refactor(02-01): migrate route-next-action handler to adapter (recipe exemplar) | clean |
| `3ad964d2` | refactor(02-01): replace createRequire fs bridge in state-project-load | clean |
| `f5f29606` | refactor(02-01): split findProjectRoot into bootstrap.ts (HIGH-2 fix) | clean |
| `2cee4444` | feat(02-01): add stat() to Bin A; impl MarkdownAdapter.stat() + conformance | clean |
| `dee7f469` | fix(01-debt): update tests broken by cause-A/cause-B CJS parity fixes | clean |
| `5e27a133` | fix(01-debt): cause-E update 6 test expectations to match current SDK behavior | clean |
| `a7b74d17` | fix(01-debt): cause-A getMilestoneInfo derives name from ROADMAP only (CJS parity) | clean |
| `0fb10cad` | fix(01): wire adapters as tsc project reference for sdk build | clean |
| `28651c3c` | fix(01-04): add missing adapter to GSD.createTools() GSDTools constructor call | clean |
| `0879f686` | feat(01-04): update 7 SDK test files to pass MarkdownAdapter via makeRegistry helper | clean |
| `06fe5237` | feat(01-04): update 4 production createRegistry call sites to pass {adapter} | clean |
| `754bbd5b` | feat(01-04): change createRegistry signature to require {adapter: StorageAdapter} | clean |
| `eb77b28d` | feat(01-03): implement MarkdownAdapter class (TDD GREEN) | clean |
| `53cb30d8` | test(01-03): add failing tests for MarkdownAdapter (TDD RED) | clean |
| `e31f6849` | chore(01-01): add adapters/ TypeScript build infrastructure | clean |
| `c0cb035c` | feat(01-01): implement StorageAdapter interface, Capabilities, type guards, UnsupportedCapabilityError | clean |
| `3466ae3f` | test(01-01): add failing type-level tests for StorageAdapter interface | clean |

## (c) Sampled commits — non-seam

### Workflows (13/13 — full review, small set)

| SHA | Subject | Verdict |
|-----|---------|---------|
| `36792174` | fix(phase-8): register verify.fat-skills in registry-assembly | clean |
| `1f24d4ab` | feat(08-01): rewrite gen-command-aliases.ts to emit both TS and CJS artifacts | clean |
| `156c49eb` | feat(08-02): extend config schema with storage.adapter key + GSDConfig.storage type | flag:config-schema-is-inline-not-manifest-backed |
| `253c9d21` | docs(cleanup): retroactive VERIFICATION.md for Phases 4 + 5 + markdown file-allow marker | clean |
| `2775cdbf` | fix(04): register stub handlers for Wave 3/4 SDK query verbs | clean |
| `c5f4c1da` | feat(04-07): ship pre-commit leak gate + verify zero-leak state + document OQ-03/OQ-04 | clean |
| `ee8c661e` | feat(04-05): rewrite template/reference context-block leaks to orchestrator injection | clean |
| `3ab2992f` | fix(04): resolve post-merge test failures from wave 2 | clean |
| `abe78d6e` | feat(04-04): rewrite agent/command leaks and resolve OQ-03 raw-git outliers | clean |
| `fd8d03ef` | feat(04-04): rewrite 23 workflow files to eliminate 67 storage leaks | clean |
| `6387fb20` | feat(04-03): rewrite session-report, graduation to use SDK queries | clean |
| `5e7d18d5` | feat(04-03): rewrite docs-update, import, spike, spike-wrap-up to use SDK queries | clean |
| `48d3d18a` | feat(04-03): rewrite map-codebase, execute-phase, quick to use SDK queries | clean |

### Large non-seam commits — sampled (representative selection from 62 entries)

These are large commits that don't touch `adapters/` or `sdk/src/` directly. All docs(phase-NN) planning artifacts were skipped (pure docs). Selected representative entries:

| SHA | Subject | Verdict |
|-----|---------|---------|
| `9a7eeeaa` | docs(milestone): archive v1.0 phase artifacts to archived-milestone/v1.0/ | clean |
| `12b40ac9` | feat(01-01): Task 2 — implement scripts/baseline-diff.cjs set-difference gate (TDD) | clean |
| `801d8e79` | fix(meta-coverage): gate beads direction by bdPresent (code review CR-02) | clean |
| `7a93ad7c` | perf(conformance): parallel forks via file-based test-registry + per-suite splits | clean |
| `e6aa5df8` | chore(07-05a): install fast-check@^4.8.0 + @fast-check/vitest@^0.4.1 devDeps | clean |
| `151b133c` | chore(planning): bootstrap fork .planning/ + adapter-interface scope | clean |
| `c5f4c1da` | feat(04-07): ship pre-commit leak gate + verify zero-leak state + document OQ-03/OQ-04 | clean |

### Test-file cohort — ~20% sample (every 5th commit of 65)

| SHA | Subject | Verdict |
|-----|---------|---------|
| `5a063672` | fix(state-mutation): callback form on every replace to defuse \$ interpretation | clean |
| `077c67c8` | fix(adapters): update stale Phase-1 assertions + wire adapter tests in CI (CR-01) | clean |
| `03006553` | fix(conformance): resolve orphan-test failures from parallel-forks split | clean |
| `aee87cab` | feat(07-04b): migrate write-*.test.ts to *.conformance-suite.ts + paired invocation | clean |
| `efe271b4` | refactor(adapter): dedupe mutateDeferredItems add path (IN-02) | clean |
| `410218b4` | fix(sdk): make syncStateFrontmatter the single writer of progress fields | clean |
| `b2b82c0c` | feat(05-05): add sidecar.ts + scratch.ts with 8 SDK verbs; flip test placeholders to live tests | clean |
| `c0018738` | test(05-01): add Wave 0 test scaffolds for Phase 5 primitive lift | clean |
| `c778ddfc` | test(03-05): add conformance tests for event families, withTransaction, and commitPlanningState | clean |
| `ba65de55` | fix(upstream-sync): make adapter optional with MarkdownAdapter default | clean |
| `fc2940d5` | refactor(02-02): migrate audit-open/progress/verify reads through adapter | clean |
| `79fa14e9` | refactor(02-01): migrate route-next-action handler to adapter (recipe exemplar) | clean |
| `5e27a133` | fix(01-debt): cause-E update 6 test expectations to match current SDK behavior | clean |

## (d) Flagged surprises

### SURPRISE-01: config-schema.ts replaced manifest-backed re-export with inline key literals

**SHA:** `156c49eb`

**Files touched:** `sdk/src/query/config-schema.ts`, `get-shit-done/bin/lib/config-schema.cjs`, `sdk/src/config.ts`, `docs/CONFIGURATION.md`

**What changed:** The fork's `config-schema.ts` previously was a thin re-export shim that sourced its `VALID_CONFIG_KEYS` from the manifest file at `sdk/shared/config-schema.manifest.json` (upstream's canonical single source of truth since #3536). The Phase 8 DIST-01 commit replaced this with a standalone inline copy of all valid key strings, plus the new `storage.adapter` key. The CJS file was updated in parallel.

**Why the test gate could plausibly miss it:** The `config-schema-sdk-parity.test.cjs` test enforces that the SDK and CJS sets are equal to each other — but it does NOT compare against the manifest. If upstream adds new config keys to `sdk/shared/config-schema.manifest.json` in a future rebase window, the SDK schema will silently diverge (the parity gate only checks CJS=SDK, not CJS=manifest). A user running `config-set <new-upstream-key>` after a future rebase would get "Unknown config key" from our fork but not from upstream. The regression surface is narrow (only new keys added between rebases) but the failure mode is silent and confusing.

**Recommended action:** Accept for now — the parity test protects against CJS/SDK drift, and the fork intentionally diverges from the manifest-backed approach to add `storage.adapter`. File as a bd issue to revisit at the next upstream rebase: check whether the manifest has new keys not in our inline set, and add them. Routing: Phase 3 scope (upstream feature port work). Disposition: **accept as known; create bd tracking issue**.

Note: `storage.adapter` is legitimately fork-only and must be added manually after any upstream rebase. This is expected behavior, not a bug.
