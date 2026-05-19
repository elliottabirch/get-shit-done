# Roadmap: get-shit-done (fork — adapter-interface seam)

**Milestone:** v1.1 — Make the StorageAdapter Seam Real
**Source of truth:** `.planning/REQUIREMENTS.md` (v1.1 section) + `.planning/research/upstream-drift/DELTA.md`
**Branch strategy:** All phases land on `feat/storage-adapter` in this repo. `rebase/onto-upstream-2026-05-16` is the Phase 1 staging branch for cutover. Sibling `~/code/gsd-beads` is out of scope for v1.1 except as a test target in SEAM conformance tests.

## Overview

v1.1 has one headline: make the StorageAdapter seam load-bearing. v1.0 shipped all the architectural machinery — the interface, MarkdownAdapter, BeadsAdapter, conformance suite, migration tooling — but a critical bug survived: `adapterFor()` in `sdk/src/query/helpers.ts` returns `MarkdownAdapter` unconditionally, ignoring `storage.adapter` config. Every one of the 101 migrated handler callsites silently bypasses whatever adapter is configured. Filed as bd `get-shit-done-qt2` (P0). Until SEAM lands, the fork's value proposition ("pluggable storage backends") is false at runtime — writes go to disk, reads from `gsd-sdk query` go to bd, and the drift is silent.

The rest of v1.1 is necessary but secondary. A 351-commit upstream rebase was completed on `rebase/onto-upstream-2026-05-16` (5a063672) and is ready to land on `feat/storage-adapter`. The rebase produced approximately 50 test failures: upstream features the "take-theirs" resolutions dropped (PORT groups 1–7), integration golden divergences (VERIFY), and orthogonal regressions (MISC). Most of these become cleaner to diagnose and fix after SEAM lands, because handlers will actually exercise the configured adapter end-to-end rather than bypassing it. The DIVERGE and DEFECT items — BeadsAdapter contract gaps and the 7 beads/markdown divergences catalogued in the v1.0 audit — resolve largely as SEAM acceptance evidence: they were symptoms of the same root cause.

**Workflow risk note:** Until SEAM-01..03 land, writes to `.planning/` singletons must be manually mirrored to bd via node one-liners. This is because `adapterFor()` still routes all writes to disk regardless of `storage.adapter: beads` config. This is known-broken state that predates v1.1, not a regression — v1.1 is the fix.

## Phases

**Phase Numbering:**

- Integer phases (1–4): canonical scope for v1.1.
- Decimal phases (e.g. 2.1) reserved for urgent insertions during execution via `/gsd-insert-phase`.

- [x] **Phase 1: Land the rebase** — Fast-forward `feat/storage-adapter` to `rebase/onto-upstream-2026-05-16`, read and accept the diff, verify build green + ≥97% test pass rate under default adapter. *(this repo)* (completed 2026-05-18)
- [ ] **Phase 2: Make the seam real** — Replace all 101 `adapterFor(projectDir)` callsites with adapter threaded through handler signatures; delete or stub the shortcut; ship the seam-realness conformance suite under both adapters. *(this repo — bd `get-shit-done-qt2`)*
- [ ] **Phase 3: Port upstream features** — Restore the 7 upstream features dropped during "take-theirs" rebase resolutions: phase_status, mode field, strict argv, curated progress, validate.health rules, archived-dir handling, workstream threading. *(this repo — bd `get-shit-done-s93` for PORT-01)*
- [ ] **Phase 4: Close out defects, divergences, integration parity, and misc** — Diagnose and fix all VERIFY goldens (investigate before regenerating), MISC regressions, and DEFECT/DIVERGE items (most resolve as SEAM acceptance evidence after Phase 2). *(this repo)*

## Phase Details

### Phase 1: Land the rebase

**Repo:** this repo (`feat/storage-adapter` ← `rebase/onto-upstream-2026-05-16`)
**Goal:** The 351-commit upstream rebase lives on `feat/storage-adapter`. The diff has been read and accepted — no surprises swept under the rug. TypeScript build is clean. Tests pass at ≥97% under the default markdown adapter. The staging branch and v1.0 tag are preserved for rollback safety.
**Depends on:** Nothing (first phase; the rebase work already exists on `rebase/onto-upstream-2026-05-16` at 5a063672)
**Requirements:** REBASE-01, REBASE-02, REBASE-03, REBASE-04, REBASE-05
**Resolves open questions:** N/A
**Success Criteria** (what must be TRUE):

  1. `git log feat/storage-adapter` includes the full 351-commit upstream window (`4029d103` → `ae63cbe5`). The branch tip is either a direct fast-forward or a merge that preserves all 351 commits without squash. A brief written note confirms the diff was reviewed, not just applied.
  2. `npm run build:sdk-only` exits zero with no TypeScript errors on the landed branch.
  3. The unit test suite reports ≥97% pass rate with `storage.adapter` unconfigured (default markdown path). Every failure is categorized: known PORT-group items (DELTA.md Groups 1–7), known VERIFY/MISC items, or unexplained — no unexplained failures pass silently.
  4. `git rebase main` from the landed `feat/storage-adapter` tip completes with conflicts only in adapter-interface seam files; zero conflicts in pure business-logic files.
  5. Both `fork/v1.0-shipped` tag and `rebase/onto-upstream-2026-05-16` checkpoint branch remain present on `origin` throughout this phase — confirmed via `git ls-remote origin` before closing Phase 1.

**Plans:** 2/2 plans complete
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Wave 0/1: setup (staging branch, baseline capture, set-difference gate, cherry-pick audit) + automated verification gates (REBASE-02 test, REBASE-03 build, REBASE-04 dry-run rebase)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Wave 2/3: human-gated diff review (01-REVIEW-NOTES.md) + force-push cutover + post-cutover REBASE-05 safety-ref confirmation

### Phase 2: Make the seam real

**Repo:** this repo (`feat/storage-adapter`)
**Goal:** The adapter configured at `storage.adapter` in `.planning/config.json` is the adapter that ALL handler callsites actually use at runtime. `adapterFor(projectDir)` no longer returns a live adapter. A round-trip write under `adapter: "beads"` reaches bd. A round-trip write under `adapter: "markdown"` (or no config) is byte-identical to upstream. A conformance suite "seam-realness" entry proves both paths across every state-mutation handler, including a large-body (>64KB) singleton round-trip.
**Depends on:** Phase 1 (the rebase must be landed before seam surgery begins — replacing 101 callsites on top of an unresolved staging diff would produce unresolvable merge chaos)
**Requirements:** SEAM-01, SEAM-02, SEAM-03, SEAM-04, SEAM-05, SEAM-06, DEFECT-02
**Resolves open questions:** N/A
**Cross-references:** bd `get-shit-done-qt2` (P0 — root cause for SEAM-01..03); DEFECT-02 is the large-body conformance case subsumed into the SEAM-06 suite
**Success Criteria** (what must be TRUE):

  1. `grep -rn "adapterFor(projectDir)" sdk/src/query/ | wc -l` returns 0 on the merged branch. Every replaced callsite threads the adapter argument through its handler signature — verifiable by scanning the PR diff for the replacement pattern, not by manual re-count.
  2. Configure `storage.adapter: "beads"` in `.planning/config.json`, run `gsd-sdk query state.milestone-switch --milestone vTest --name "SeamTest"` end-to-end: the bd-tier STATE.md singleton receives the write. Verify via `bd show` that the stored content matches what MarkdownAdapter would have written to disk under the same call.
  3. Configure `storage.adapter: "markdown"` (or remove the config key entirely), run the same `state.milestone-switch` command: `.planning/STATE.md` on disk is byte-identical to what upstream GSD would produce. The default path is a regression-free transition, not a rewrite.
  4. The conformance suite "seam-realness" manifest entry runs ALL migrated state-mutation handlers against MarkdownAdapter AND BeadsAdapter; pass rate ≥ 95% at merge. Any sub-95% handler is enumerated by name in a failure manifest file — not silently skipped or counted as "flaky." The large-body singleton test (DEFECT-02 / SEAM-06) is one of these entries and asserts byte-identical round-trip for bodies > 64KB against both adapters.
  5. `adapterFor` is either deleted from `helpers.ts` or present only as a documented deprecation stub that throws `NotYetMigratedError` at call time — it does not silently return a live adapter under any code path reachable from the SDK query registry.

**Plans:** 3/7 plans executed
Plans:

**Wave 1**

- [x] 02-01-PLAN.md — Wave 0/1: getTouchedPaths interface + sibling BeadsAdapter impl + conformance schema extension (kind:'seam-realness') + paired-seam test scaffolds [SEAM-06, DEFECT-02]

**Wave 2** *(blocked on Wave 1)*

- [x] 02-02-PLAN.md — pipeline.ts refactor: snapshot/getTouchedPaths/restore + hasSnapshot capability guard; pipeline.test.ts cleanup [SEAM-01, SEAM-02, SEAM-03]

**Wave 3** *(blocked on Wave 2)*

- [x] 02-03-PLAN.md — state-mutation.ts (23 callsites) — TWO atomic commits per D-15: thread adapter + propagate StateWriteOutcome [SEAM-01, SEAM-03]

**Wave 4** *(blocked on Wave 3)*

- [ ] 02-04-PLAN.md — phase-lifecycle.ts (10) + spike-sketch.ts (7) + scratch.ts (6) — 3 atomic per-file commits [SEAM-01, SEAM-03]

**Wave 5** *(blocked on Wave 4)*

- [ ] 02-05-PLAN.md — named-docs.ts (6) + workstream.ts (4) + progress.ts (4) + config-mutation.ts (4) — 4 atomic per-file commits [SEAM-01, SEAM-03]

**Wave 6** *(blocked on Wave 5)*

- [ ] 02-06-PLAN.md — long-tail (20 files, 1-3 callsites each) grouped into 3 atomic commits by callsite count; CUMULATIVE GREP GATE proves all 28 handler-family files migrated [SEAM-01, SEAM-03]

**Wave 7** *(blocked on Wave 6)*

- [ ] 02-07-PLAN.md — closure: delete adapterFor + _adapterCache; fill ~30 seam-realness manifest bodies; DEFECT-02 large-body fixture; SEAM-04/SEAM-05 manual verification; phase gate [SEAM-01, SEAM-02, SEAM-04, SEAM-05, SEAM-06, DEFECT-02]

### Phase 3: Port upstream features

**Repo:** this repo (`feat/storage-adapter`)
**Goal:** The 7 upstream features lost during "take-theirs" rebase resolutions are restored. The test suite passes all formerly-failing PORT-group tests (approximately 25 tests across Groups 1–7 per DELTA.md). The fork is feature-complete relative to the upstream commit window landed in Phase 1.
**Depends on:** Phase 1 (the rebase must be landed — porting against the pre-rebase branch would immediately conflict). Phase 2 is not a hard prerequisite for PORT; these features are adapter-clean. However, sequencing PORT after SEAM avoids callsite confusion and means any PORT test that happens to exercise adapter routing verifies the real seam, not the shortcut.
**Requirements:** PORT-01, PORT-02, PORT-03, PORT-04, PORT-05, PORT-06, PORT-07
**Resolves open questions:** N/A
**Cross-references:** bd `get-shit-done-s93` (PORT-01 — phase_status field, already filed)
**Success Criteria** (what must be TRUE):

  1. All 4 `phase_status` field tests pass: `initPlanPhase` and `initVerifyWork` output includes `phase_status` ∈ `Pending` / `Planned` / `Executed` / `Complete`, derived from the presence/absence of plan files, summary files, and VERIFICATION.md `status:` field. Verified against a fixture directory that contains one example of each state.
  2. All 3 `roadmap.get-phase` mode-field tests pass: `**Mode:** mvp` parses to `"mvp"`, absent mode returns `null`, unrecognized mode value passes through verbatim without coercion.
  3. All 9 strict argv tests pass across phase-lifecycle handlers: `--dry-run` accepted, `--force` accepted, any unknown `--flag` rejected with non-zero exit + descriptive error message, `--help` in `milestoneComplete` does not get interpreted as a version string.
  4. All 3 curated-progress preservation tests pass: a `stateUpdate` call whose payload does not include `Progress` leaves `progress.*` frontmatter values untouched on disk; an explicit `Progress` payload triggers a full `progress.*` recompute; workstream-scoped STATE.md frontmatter syncs correctly.
  5. All remaining PORT-group test regressions reach zero: the 3 validate.health rule fixes (Group 5 — 999.X backlog phase naming, no-aliasing W006 suppression, descriptor-vs-canonical plan matching), the 1 archived-dir fix (Group 6 — same-milestone archived dir preserved not nulled), and the 1 workstream-scoped `initVerifyWork` fix (Group 7). Total PORT-group failure count after this phase: 0.

**Plans:** TBD (filled by /gsd-plan-phase)

### Phase 4: Close out defects, divergences, integration parity, and misc

**Repo:** this repo (`feat/storage-adapter`)
**Goal:** The test suite is green, or every remaining failure is a documented intentional skip with a tracking issue. Every VERIFY golden was investigated before any decision to regenerate. Every DIVERGE item is either verified-closed by SEAM's now-real adapter routing, or explicitly resolved as a standalone fix with a written rationale. MISC regressions are fixed. The milestone closes with a clean conformance suite and no unaddressed P0/P1 defects.
**Depends on:** Phase 2 (most DIVERGE items are SEAM acceptance evidence — they can only be confirmed closed once the seam is real and adapter routing is verified); Phase 3 (PORT must complete before VERIFY goldens are regenerated, so goldens capture the fully-ported output rather than an intermediate partial state)
**Requirements:** DEFECT-01, DIVERGE-01, DIVERGE-02, DIVERGE-03, DIVERGE-04, DIVERGE-05, DIVERGE-06, DIVERGE-07, VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04, VERIFY-05, VERIFY-06, VERIFY-07, MISC-01, MISC-02, MISC-03
**Resolves open questions:** N/A
**Cross-references:** bd `get-shit-done-qjk` (DEFECT-01 / DIVERGE-03 — >64KB singleton body limit); DIVERGE-03 is the same physical defect as DEFECT-01 (one fix, two traceability IDs); DIVERGE-04 resolves via Phase 2 SEAM work — this phase verifies the resolution, it does not do new callsite work
**Success Criteria** (what must be TRUE):

  1. All 7 VERIFY goldens are resolved with a recorded investigation verdict before any regeneration. Each verdict names the root cause and the chosen fix or rationale for regeneration. `verify.codebase-drift` golden is updated to reflect the intentional SDK removal per ADR D-2026-05-13-3524 (CJS-only seam). No golden is regenerated with only "output changed" as justification.
  2. All 3 MISC regressions are fixed and their own test cases pass: `loadConfig` returns `false` (not `undefined`) for boolean fields with a `false` default; `MarkdownAdapter.readModifyWriteRoadmapMd` no longer throws `core.atomicWriteFileSync is not a function`; `runtime-bridge-sync` correctly classifies `native_failure` events.
  3. DIVERGE-01 is resolved: stub SDK handlers (`thread-seed.list-seeds`, `workspace.ensure-dir`) are either given a minimal real implementation or removed from the workflow call sites that reach them — no normal workflow execution returns `{"error": "stub"}` at a documented call site.
  4. DIVERGE-04 (disk/bd dual-write divergence trap) is verified closed by evidence: running the SEAM-04..06 acceptance tests configured for `adapter: "beads"` produces no writes to `.planning/` disk files (except explicitly carved-out CJS-only paths per ADR D-2026-05-13-3524). The confirmation is an observable side-effect check in the test output, not a documentation assertion.
  5. The conformance suite passes at ≥ 98% across MarkdownAdapter and BeadsAdapter, with the one known-gap entry (`withTransaction:mid-commit-replay` / incomplete-per-Deferred-04) explicitly listed in the manifest as an acknowledged gap. DEFECT-01 (>64KB singleton body) has a recorded resolution path — either the SEAM-02 disk-tier carve-out for ADR logs (routing decision) or a column-widening fix in BeadsAdapter — and the conformance large-body test result matches that recorded decision.

**Plans:** TBD (filled by /gsd-plan-phase)

## Traceability

Every v1.1 REQ-ID maps to exactly one phase. Coverage: 33/33 unique requirements (35 table rows; DEFECT-01/DIVERGE-03 are the same physical defect with two IDs, and SEAM-06/DEFECT-02 are the same conformance suite entry approached from two angles — each pair has one phase home, noted in the cross-reference column).

| REQ-ID | Phase | Status | Notes |
|--------|-------|--------|-------|
| REBASE-01 | Phase 1 — Land the rebase | Pending | |
| REBASE-02 | Phase 1 — Land the rebase | Pending | |
| REBASE-03 | Phase 1 — Land the rebase | Pending | |
| REBASE-04 | Phase 1 — Land the rebase | Pending | |
| REBASE-05 | Phase 1 — Land the rebase | Pending | |
| SEAM-01 | Phase 2 — Make the seam real | Pending | bd `get-shit-done-qt2` |
| SEAM-02 | Phase 2 — Make the seam real | Pending | bd `get-shit-done-qt2` |
| SEAM-03 | Phase 2 — Make the seam real | Pending | bd `get-shit-done-qt2` |
| SEAM-04 | Phase 2 — Make the seam real | Pending | |
| SEAM-05 | Phase 2 — Make the seam real | Pending | |
| SEAM-06 | Phase 2 — Make the seam real | Pending | cross-ref: DEFECT-02 (large-body case is one entry in this suite) |
| DEFECT-02 | Phase 2 — Make the seam real | Pending | cross-ref: SEAM-06 (this is the large-body singleton test within the SEAM-06 suite) |
| PORT-01 | Phase 3 — Port upstream features | Pending | bd `get-shit-done-s93` |
| PORT-02 | Phase 3 — Port upstream features | Pending | |
| PORT-03 | Phase 3 — Port upstream features | Pending | |
| PORT-04 | Phase 3 — Port upstream features | Pending | |
| PORT-05 | Phase 3 — Port upstream features | Pending | |
| PORT-06 | Phase 3 — Port upstream features | Pending | |
| PORT-07 | Phase 3 — Port upstream features | Pending | |
| DEFECT-01 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | bd `get-shit-done-qjk`; cross-ref: DIVERGE-03 (same >64KB defect) |
| DIVERGE-01 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | |
| DIVERGE-02 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | |
| DIVERGE-03 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | cross-ref: DEFECT-01 (same physical defect; bd `get-shit-done-qjk`) |
| DIVERGE-04 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | resolves via Phase 2 SEAM; Phase 4 verifies the resolution |
| DIVERGE-05 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | |
| DIVERGE-06 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | |
| DIVERGE-07 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | |
| VERIFY-01 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | investigate before regenerating |
| VERIFY-02 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | investigate before regenerating |
| VERIFY-03 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | intentional SDK removal — update golden per ADR D-2026-05-13-3524 |
| VERIFY-04 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | investigate before regenerating |
| VERIFY-05 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | investigate before regenerating |
| VERIFY-06 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | investigate before regenerating |
| VERIFY-07 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | catch-all for unintentional regressions surfaced by suite |
| MISC-01 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | |
| MISC-02 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | |
| MISC-03 | Phase 4 — Close out defects, divergences, integration parity, and misc | Pending | |

## Coverage by phase

| Phase | REQ count (unique) | REQ-IDs |
|-------|--------------------|---------|
| 1 — Land the rebase | 5 | REBASE-01..05 |
| 2 — Make the seam real | 7 | SEAM-01..06, DEFECT-02 |
| 3 — Port upstream features | 7 | PORT-01..07 |
| 4 — Close out defects, divergences, integration parity, and misc | 14 | DEFECT-01, DIVERGE-01..07, VERIFY-01..07, MISC-01..03 |
| **Total unique** | **33** | — |

---

*Last updated: 2026-05-17 — Milestone v1.1 roadmap created. Phase strategy: 4 batched phases (REBASE → SEAM → PORT → CLOSE). Headline: SEAM is P0 (bd `get-shit-done-qt2`). Coverage: 33/33 unique requirements mapped across 35 traceability rows.*
