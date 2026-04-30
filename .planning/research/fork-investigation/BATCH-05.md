# Batch 05 — Verify + check + ship

Date: 2026-04-30
Artifacts assigned: 28
Output by: BATCH-05 agent (10-batch parallel fork-investigation)

## Classification table

| # | Path | Kind | I/O surface | Bin | Use case (≤15 words) | Direct I/O ops | Adapter methods proposed (with Bin) | Notes |
|---|------|------|-------------|-----|----------------------|----------------|-------------------------------------|-------|
| 1 | sdk/dist/query/verify.js::verifyPlanStructure | sdk-query-export | n/a | A | Validate PLAN.md frontmatter + task XML structure | n/a | getPlan(planPath) (A) | Returns parsed structure; validation pure |
| 2 | sdk/dist/query/verify.js::verifyPhaseCompleteness | sdk-query-export | n/a | B | List PLAN/SUMMARY counts, derive incomplete plans | n/a | listPhasePlanSummaryPairs(phase) (B) | Set diff between plan/summary IDs |
| 3 | sdk/dist/query/verify.js::verifyArtifacts | sdk-query-export | n/a | B | Check artifact paths exist + min_lines/contains/exports patterns | n/a | verifyPlanArtifacts(planPath) (B) | Reads plan must_haves + walks code repo files (out-of-scope-ish: code repo, not .planning/) |
| 4 | sdk/dist/query/verify.js::verifyCommits | sdk-query-export | n/a | C | Check commit hashes exist in git | n/a | (eliminate — git, not .planning/) | Out of scope; non-`.planning/` shell-out |
| 5 | sdk/dist/query/verify.js::verifyReferences | sdk-query-export | n/a | A | Resolve `@`-refs and backtick paths in a doc | n/a | verifyDocReferences(docPath) (A) | Reads doc + checks file existence; mostly code-repo paths (Rule 6 borderline) |
| 6 | sdk/dist/query/verify.js::verifySummary | sdk-query-export | n/a | B | Read SUMMARY.md, spot-check files, commits, self-check | n/a | verifySummary(summaryPath) (B) | Joins fs + git; coordinated |
| 7 | sdk/dist/query/verify.js::verifyPathExists | sdk-query-export | n/a | A | Path stat (exists + type) | n/a | (eliminate — generic fs probe) | C: belongs in adapter only if `.planning/` paths; trivial else |
| 8 | sdk/dist/query/verify.js::verifySchemaDrift | sdk-query-export | n/a | C | Detect ORM/schema drift via plan files_modified + git log | n/a | (eliminate — code-repo + git concern) | Reads plan FM (planning) + git log (code); split: plan FM = adapter, git = util |
| 9 | sdk/dist/query/verify.js::verifyCodebaseDrift | sdk-query-export | n/a | C | Spawn child process to gsd-tools.cjs for drift | n/a | (eliminate — codebase concern) | Pure code-repo audit; not `.planning/` |
| 10 | sdk/dist/query/check-completion.js::checkCompletion | sdk-query-export | n/a | B | Roll up plan/summary/VERIFICATION/UAT for phase or milestone | n/a | getPhaseCompletion(phase) (B), getMilestoneCompletion() (B) | Joins findPhase + roadmapAnalyze + reads VERIFICATION/UAT |
| 11 | sdk/dist/query/check-gates.js::checkGates | sdk-query-export | n/a | B | Read .continue-here, STATE error status, VERIFICATION fails | n/a | listSafetyGates(workflow, phase?) (B) | Multi-source coordination |
| 12 | sdk/dist/query/check-ship-ready.js::checkShipReady | sdk-query-export | n/a | B | Verification + git tree/branch/remote/gh preflight | n/a | getShipPreflight(phase) (B) — splits .planning vs git | Most I/O is git/gh (out-of-scope); only verification status is `.planning/` |
| 13 | sdk/dist/query/check-verification-status.js::checkVerificationStatus | sdk-query-export | n/a | B | Parse VERIFICATION.md table → status/gaps/human/deferred | n/a | getVerificationStatus(phase) (B) | Coordinated parse + classify |
| 14 | sdk/dist/query/check-decision-coverage.js::checkDecisionCoveragePlan | sdk-query-export | n/a | B | Plan-phase blocking gate: decisions covered in plans | n/a | checkDecisionCoveragePlan(phase) (B) | Joins CONTEXT.md decisions + plan FM/body |
| 15 | sdk/dist/query/check-decision-coverage.js::checkDecisionCoverageVerify | sdk-query-export | n/a | B | Verify-phase non-blocking: decisions honored in artifacts + commits | n/a | checkDecisionCoverageVerify(phase) (B) | Reads plans, summaries, files_modified, git log |
| 16 | sdk/dist/query/check-auto-mode.js::checkAutoMode | sdk-query-export | n/a | A | Resolve auto_advance/auto_chain_active flags | n/a | getAutoMode() (A) | Pure config read |
| 17 | sdk/dist/query/route-next-action.js::routeNextAction | sdk-query-export | n/a | B | Decide next slash-command from STATE/ROADMAP/phase dir | n/a | routeNextAction() (B) | Heavy multi-source orchestration; reads `.next-call-count` too |
| 18 | sdk/dist/query/detect-phase-type.js::detectPhaseType | sdk-query-export | n/a | B | Detect frontend/schema/api/infra phase type | n/a | detectPhaseType(phase) (B) | Joins ROADMAP heading + dir listing + schema sniffing |
| 19 | sdk/dist/query/config-gates.js::checkConfigGates | sdk-query-export | n/a | A | Batch-read workflow.* config flags | n/a | getConfigGates() (A) | Pure config read |
| 20 | get-shit-done/workflows/verify-phase.md | workflow | Mixed | n/a (consumer) | Goal-backward verification: must-haves, artifacts, wiring, tests | (8 ops below) | (8 methods below) | Heavy direct grep/ls; tests run on code repo (out of scope) |
| 21 | get-shit-done/workflows/verify-work.md | workflow | Mixed | n/a (consumer) | Conversational UAT loop with persistent state | (4 ops below) | (4 methods below) | UAT.md create/update is direct fs |
| 22 | get-shit-done/workflows/validate-phase.md | workflow | Mixed | n/a (consumer) | Audit Nyquist test coverage; create/update VALIDATION.md | (3 ops below) | (3 methods below) | VALIDATION.md write via Write tool; test discovery via find |
| 23 | get-shit-done/workflows/ship.md | workflow | Mixed | n/a (consumer) | Push branch, create PR, optional review, mark shipped | (1 op below) | (1 method below) | Mostly git/gh (out of scope); `cat VERIFICATION.md` direct |
| 24 | get-shit-done/workflows/pr-branch.md | workflow | Direct (git) | n/a (consumer) | Filter `.planning/` from PR branch via cherry-pick | (0 .planning/ ops) | none | All git ops on transient/structural distinction; not adapter-state mutations |
| 25 | get-shit-done/workflows/health.md | workflow | SDK-only | n/a (consumer) | Validate `.planning/` integrity, repair via SDK | n/a | (delegates to validate.health SDK query — not in this batch) | Clean SDK-only |
| 26 | agents/gsd-verifier.md | agent | Direct | n/a (consumer) | Subagent: goal-backward phase verification, writes VERIFICATION.md | (5 ops below) | (5 methods below) | Spawned by verify-phase orchestrator; writes VERIFICATION.md |
| 27 | agents/gsd-doc-verifier.md | agent | Mixed | n/a (consumer) | Subagent: verify factual claims in docs against codebase | (1 op below) | (1 method below) | Writes `.planning/tmp/verify-{doc}.json` (planning state) |
| 28 | agents/gsd-pattern-mapper.md | agent | Direct | n/a (consumer) | Subagent: classify files, find analogs, write PATTERNS.md | (1 op below) | (1 method below) | Writes phase PATTERNS.md (planning state); reads code repo (out of scope) |
| 29 | commands/gsd/verify-work.md | skill | Router | n/a | Router → workflows/verify-work.md | None | inherits | Router |
| 30 | commands/gsd/validate-phase.md | skill | Router | n/a | Router → workflows/validate-phase.md | None | inherits | Router |
| 31 | commands/gsd/ship.md | skill | Router | n/a | Router → workflows/ship.md | None | inherits | Router |
| 32 | commands/gsd/pr-branch.md | skill | Router | n/a | Router → workflows/pr-branch.md | None | inherits | Router |
| 33 | commands/gsd/health.md | skill | Router | n/a | Router → workflows/health.md | None | inherits | Router |
| 34 | commands/gsd/undo.md | skill | Router | n/a | Router → workflows/undo.md | None | inherits | Router (workflow not in this batch) |
| 35 | commands/gsd/check-todos.md | skill | Router | n/a | Router → workflows/check-todos.md | None | inherits | Router (workflow not in this batch) |
| 36 | commands/gsd/cleanup.md | skill | Router | n/a | Router → workflows/cleanup.md | None | inherits | Router (workflow not in this batch) |
| 37 | commands/gsd/inbox.md | skill | Router | n/a | Router → workflows/inbox.md | None | inherits | Router (workflow not in this batch); pure GitHub/gh — orthogonal to adapter |

(Row count exceeds 28 because per-export tabling expands SDK queries — 19 export rows for 10 SDK files + 6 workflows + 3 agents + 9 skill routers = 37.)

## Per-artifact detail

### sdk/dist/query/verify.js (8 exports)

- `verifyPlanStructure` (A): bare read+regex over a single PLAN.md. Pass-through `getPlan(path) -> {content}` is enough; structural validation is pure logic on top.
- `verifyPhaseCompleteness` (B): scans phase dir, computes set diff between plan IDs and summary IDs. Coordination = the diff.
- `verifyArtifacts` (B): reads plan must_haves THEN walks code-repo files for min_lines/contains/exports. Most I/O targets the **code repo, not `.planning/`** — by Rule 6 the artifact-file checks are out of scope; only the must_haves read is `.planning/`.
- `verifyCommits` (C): purely git `cat-file -t`. Eliminate.
- `verifyReferences` (A → C edge): reads doc + `existsSync` on resolved paths; refs are mostly to code-repo files. Treat as utility, not adapter method.
- `verifySummary` (B): joins SUMMARY read + file existence checks (code repo) + git `cat-file` + self-check parse. Adapter only owns the SUMMARY read; rest is util.
- `verifyPathExists` (C): generic fs stat. Not an adapter concern unless restricted to `.planning/`.
- `verifySchemaDrift` / `verifyCodebaseDrift` (C): code-repo concerns; only the plan FM read is `.planning/` (already covered by `getPlan`).

**Net adapter methods from verify.js:** `getPlan(path)` (A), `listPhasePlanSummaryPairs(phase)` (B), `verifyPlanArtifacts(planPath)` (B — but flag: most reads target code repo), `verifySummary(summaryPath)` (B). Drop commit/path/drift — non-`.planning/`.

### sdk/dist/query/check-completion.js — `checkCompletion`

- Joins `findPhase` + `roadmapAnalyze` + reads `VERIFICATION.md`/`UAT.md` to derive `complete`, `verification_status`, `uat_status`, `debt`.
- **Bin B.** Two adapter shapes: `getPhaseCompletion(phase) -> {complete, plans_total, missing_summaries, verification_status, uat_status, debt}`, `getMilestoneCompletion() -> {complete, phase_count, phases_complete, phases_incomplete, blockers}`.

### sdk/dist/query/check-gates.js — `checkGates`

- Reads `.continue-here.md` (existence), `STATE.md` (status field), `VERIFICATION.md` for FAIL rows.
- **Bin B** — coordinated multi-gate. Adapter: `listSafetyGates(workflow, phase?) -> {passed, blockers, warnings}`.

### sdk/dist/query/check-ship-ready.js — `checkShipReady`

- Almost entirely git/gh (porcelain, branch, remote, gh availability). Only the verification status check is `.planning/`.
- **Bin B** for the orchestration. Adapter contributes only `getVerificationStatus(phase)` (already covered by #13). Git/gh probes belong in a separate `gitPreflight()` utility — flag as out-of-scope per Rule 6.

### sdk/dist/query/check-verification-status.js — `checkVerificationStatus`

- Parses `VERIFICATION.md` table: PASS/FAIL counts, gaps, human items, deferred items.
- **Bin B** — table parsing + classification + frontmatter fallback. Adapter: `getVerificationStatus(phase) -> {status, score, gaps, human_items, deferred}`. For beads adapter, this maps to issue-comment scan + label aggregation.

### sdk/dist/query/check-decision-coverage.js (2 exports)

- `checkDecisionCoveragePlan` (B): reads CONTEXT.md decisions + plan FM/body, computes coverage. **Blocking** gate.
- `checkDecisionCoverageVerify` (B): reads plans + summaries + files_modified contents + recent commit subjects → fuzzy match. **Non-blocking**.
- Both Bin B (coordinated multi-source). Adapter methods: `checkDecisionCoveragePlan(phase) -> {passed, total, covered, uncovered}`, `checkDecisionCoverageVerify(phase) -> {total, honored, not_honored}`. Git log + code-repo file reads inside verify variant are utility (out of scope) — adapter just supplies decisions, plans, summaries.

### sdk/dist/query/check-auto-mode.js — `checkAutoMode`

- Pure config read. **Bin A.** Adapter: `getAutoMode() -> {active, source, auto_chain_active, auto_advance}`. (Could fold into `getConfigGates`.)

### sdk/dist/query/route-next-action.js — `routeNextAction`

- Reads `.next-call-count` (planning); calls `stateJson`, `roadmapAnalyze`, `findPhase`, scans phases dir, parses VERIFICATION.md status.
- **Bin B** — heavy decision tree over many adapter primitives. Adapter: `routeNextAction() -> {command, args, reason, current_phase, gates, context}`. Beads adapter implements via bd queries against milestone/phase/plan issues.
- One direct touch worth noting: reads `.planning/.next-call-count` — a sidecar counter file. Consider adapter primitive `getNextCallCount() -> number` (A) and `incrementNextCallCount() -> void` (B) so beads can store it as an issue field or kv pair.

### sdk/dist/query/detect-phase-type.js — `detectPhaseType`

- Reads ROADMAP heading for phase, scans phase dir for UI-SPEC files, runs `detectSchemaFiles` over dir + 1-deep subdirs.
- **Bin B.** Adapter: `detectPhaseType(phase) -> {has_frontend, frontend_indicators, has_schema, schema_orm, schema_files, has_api, has_infra}`.

### sdk/dist/query/config-gates.js — `checkConfigGates`

- Pure config merge with defaults. **Bin A.** Adapter: `getConfigGates() -> ConfigGates` (or single `getConfig()` that returns the full object).

### get-shit-done/workflows/verify-phase.md

Direct I/O ops enumerated (leak grep):
1. `grep -E "^| ${phase_number}" .planning/REQUIREMENTS.md` — requirement rows for phase.
2. `ls "$phase_dir"/*-SUMMARY.md "$phase_dir"/*-PLAN.md` — list phase artifacts (also leaks via shell).
3. `for plan in "$PHASE_DIR"/*-PLAN.md` — directly iterates plans.
4. Glob expansion `for f in "${PHASE_DIR}"/*-CONTEXT.md` — find phase CONTEXT.md.
5. Test runner discovery (Makefile, package.json, Cargo.toml, etc.) — **code-repo, out of scope**.
6. `timeout 300 bash -c "$TEST_CMD"` — runs project test suite (out of scope).
7. CLI command runs against `templates/`, `fixtures/`, etc. (out of scope).
8. Anti-pattern grep across files modified (out of scope — code repo).

Adapter methods needed:
1. `listRequirementsForPhase(phase) -> Requirement[]` (A) — replaces REQUIREMENTS.md grep.
2. `listPhaseArtifacts(phase) -> {plans, summaries, contexts, verification, uat, validation, security, uiSpec}` (A) — broad listing.
3. `getPlan(path) -> {frontmatter, body}` (A) — replaces direct PLAN.md read.
4. `getContext(phase) -> {decisions, content}` (A) — replaces CONTEXT.md glob.
5. `recordVerification(phase, report)` (B) — replaces VERIFICATION.md Write (the report has structured frontmatter the adapter must serialize natively).

Test suite + CLI + anti-pattern scan are **code-repo concerns** — not adapter methods (Rule 6).

### get-shit-done/workflows/verify-work.md

Direct I/O ops enumerated:
1. `find .planning/phases -name "*-UAT.md" -type f` — discover active UAT sessions.
2. `ls "$phase_dir"/*-SUMMARY.md` — list summaries to extract testable deliverables.
3. `mkdir -p "$PHASE_DIR"` then write `.planning/phases/XX-name/{phase_num}-UAT.md` — initial UAT.md authoring.
4. Repeated UAT.md updates via Edit/Write (frontmatter status, Tests rows, Gaps APPEND, Summary OVERWRITE).
5. `ls "${PHASE_DIR}"/*-UI-SPEC.md` and `ls "${PHASE_DIR}"/*-SECURITY.md` — feature-flag file probes.
6. SECURITY.md frontmatter `threats_open` read.

Adapter methods needed:
1. `listActiveUat() -> Uat[]` (A) — replaces find scan.
2. `getSummary(path) -> {frontmatter, content}` (A) — replaces summary read.
3. `createUat(phase, {tests, source, status, started, updated})` (B) — multi-section structured create.
4. `updateUat(phase, {currentTest?, tests?, gaps?, summary?, status?})` (B) — partial update with timestamp injection (rule 5 — derived data between read/write).
5. `getSecurityStatus(phase) -> {file, threats_open}` (A) — replaces SECURITY.md probe.

The UAT lifecycle (create/append/checkpoint) is the canonical Bin B candidate: timestamps injected, sections OVERWRITE vs APPEND have rule semantics, and "complete vs partial" status is derived.

### get-shit-done/workflows/validate-phase.md

Direct I/O ops enumerated:
1. `ls "${PHASE_DIR}"/*-VALIDATION.md` and `ls "${PHASE_DIR}"/*-SUMMARY.md` — input state detection.
2. `find . -name "pytest.ini" -o ...` — code-repo test infra detection (**out of scope**).
3. Write/Edit `${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md` — create or update with audit trail append.

Adapter methods needed:
1. `getValidation(phase) -> Validation | null` (A) — replaces ls+read.
2. `recordValidation(phase, {testInfra, perTaskMap, manualOnly, signoff})` (B) — initial create.
3. `appendValidationAudit(phase, {date, gapsFound, resolved, escalated})` (B) — domain event append (rule 5).

Test infra detection (`find pytest.ini ...`) is code-repo (Rule 6 — orthogonal).

### get-shit-done/workflows/ship.md

Direct I/O ops enumerated:
1. `cat ${PHASE_DIR}/*-VERIFICATION.md` — direct read of VERIFICATION (covered by `getVerificationStatus`).
- All other steps are git, gh CLI, or `gsd-sdk query state.update` / `state.load` / `commit`.

Adapter method needed:
1. `getVerificationStatus(phase)` (B) — already covered by #13.

`STATE.md` writes go through `gsd-sdk query state.update` (clean). **No fresh leaks** beyond #1. Almost everything else (push, gh pr create, gh pr edit, REVIEW_CMD pipeline) is code-repo / external — out of scope.

### get-shit-done/workflows/pr-branch.md

Direct I/O ops enumerated:
- ZERO `.planning/` writes through tools other than `git`. All ops are `git log`, `git diff-tree`, `git checkout -b`, `git cherry-pick`, `git rm -r --cached`. The workflow's whole job is rewriting git history, not mutating planning state.

Adapter methods needed: **none.** The workflow's domain is git, not planning storage. It's interesting because it's the one workflow in this batch with NO adapter implication — note it for synthesis (the "adapter is irrelevant here" pattern).

Caveat: `git rm -r --cached ".planning/$dir/"` is a side effect on the staged tree that DOES touch `.planning/` paths, but only as transient git index manipulation — not an adapter concern. The adapter doesn't model "what's currently staged".

### get-shit-done/workflows/health.md

- Single command: `gsd-sdk query validate.health [--repair] [--backfill]`. Pure SDK delegation, ZERO direct I/O.
- The `validate.health` query itself is **out of this batch** (likely BATCH-04 or similar). Inherits its classification.
- One non-`.planning/` shell-out: `find "$TASKS_DIR" -maxdepth 1 -type d -mtime +1` against `~/.claude/tasks/` — out of scope (Rule 6, OS-level cleanup).

### agents/gsd-verifier.md

Direct I/O ops enumerated (leak grep — agent body line-by-line):
1. `cat "$PHASE_DIR"/*-VERIFICATION.md` — Step 0 previous-verification check.
2. `ls "$PHASE_DIR"/*-PLAN.md` and `ls "$PHASE_DIR"/*-SUMMARY.md` — Step 1 context load.
3. `grep -E "^| $PHASE_NUM" .planning/REQUIREMENTS.md` and `grep -E "Phase $PHASE_NUM" .planning/REQUIREMENTS.md` — Step 1 + Step 6 requirement extraction.
4. `grep -l "must_haves:" "$PHASE_DIR"/*-PLAN.md` — Step 2b PLAN frontmatter scan.
5. **Write VERIFICATION.md** via Write tool (explicit "ALWAYS use the Write tool to create files" instruction) at `.planning/phases/{phase_dir}/{phase_num}-VERIFICATION.md`.

(Steps 4–7 also include grep across code-repo source files, behavioral spot-checks, anti-pattern scans — these are code-repo and out of scope per Rule 6.)

Adapter methods needed:
1. `getVerification(phase) -> Verification | null` (A) — replaces VERIFICATION.md read.
2. `listPhaseArtifacts(phase) -> {plans, summaries, ...}` (A) — replaces ls.
3. `listRequirementsForPhase(phase) -> Requirement[]` (A) — replaces REQUIREMENTS grep.
4. `findPlansWithMustHaves(phase) -> Plan[]` (A) — replaces grep -l.
5. `recordVerification(phase, {status, score, gaps, deferred, humanVerification, overrides, ...})` (B) — replaces Write tool write; adapter must serialize the structured YAML frontmatter natively (for beads: write to issue body + status label + custom fields).

This agent IS the heavy write path for the verify pipeline. `recordVerification` is the canonical Bin B; carries timestamps, score derivation, and re-verification metadata.

### agents/gsd-doc-verifier.md

Direct I/O ops enumerated:
1. **Write `.planning/tmp/verify-{doc_filename}.json`** — explicit `mkdir -p .planning/tmp` then Write. Agent's only write.

(All other I/O — Read of doc file, Read of `package.json`, Glob/Grep of `src/`, `routes/`, `api/`, `server/`, `app/` — is **code-repo / source content**. Rule 6: out of scope.)

Adapter methods needed:
1. `recordDocVerification(docPath, {claimsChecked, claimsPassed, claimsFailed, failures})` (B) — replaces JSON Write to `.planning/tmp/`. Bin B because: (a) the path is derived (`verify-{basename}.json`), (b) the JSON shape is a domain-typed event, (c) for beads adapter this becomes either an attached artifact on a doc-verify issue or a kv entry under a "doc verification" namespace.

The "tmp" subdirectory pattern is interesting — flag for synthesis: do other agents/workflows use `.planning/tmp/` as a scratch area? If so, propose `recordTempArtifact(name, body)` / `getTempArtifact(name)` as a bare A/A pair, and let domain-typed wrappers (like `recordDocVerification`) sit on top.

### agents/gsd-pattern-mapper.md

Direct I/O ops enumerated:
1. **Write PATTERNS.md** at `$PHASE_DIR/$PADDED_PHASE-PATTERNS.md` — explicit "ALWAYS use the Write tool" mandate.

(Reads of CONTEXT.md and RESEARCH.md are `.planning/`-state — covered by `getContext`/`getResearch`. Glob/Grep of code-repo source for analog discovery is out of scope per Rule 6.)

Adapter methods needed:
1. `recordPatterns(phase, {fileClassification, patternAssignments, sharedPatterns, noAnalog, metadata})` (B) — replaces Write PATTERNS.md. Multi-section structured artifact.

Adapter contributions for upstream reads: `getContext(phase)` and `getResearch(phase)` — both Bin A (single-record reads). These are likely owned by other batches; flag for synthesis dedup.

### Skills 29–37 (routers — auto-classified)

All nine skill files match the router pattern:
- `verify-work.md`, `validate-phase.md`, `ship.md`, `pr-branch.md`, `health.md`, `undo.md`, `check-todos.md`, `cleanup.md`, `inbox.md` — each is a thin shell with `<execution_context>@~/.claude/get-shit-done/workflows/X.md</execution_context>` and a "Execute the workflow end-to-end" process block.
- `allowed-tools` lists declare capability surface (Read, Bash, Edit, Write, Task, etc.) but the file itself does no I/O.

Per Rule 4: `Router` classification, inherits from workflow. No further adapter analysis. Note that `inbox.md` and `pr-branch.md` workflows are mostly **out-of-scope** (GitHub API + git history rewrite), so their routers contribute zero adapter methods.

## Cross-cutting observations from this batch

1. **The verify pipeline is heavily SDK-fronted, but the WRITE side is direct.** Most read paths (`check.completion`, `check.gates`, `check.verification-status`, `detect.phase-type`, `route.next-action`, `config-gates`) are clean SDK queries. But the **canonical writes** for VERIFICATION.md, UAT.md, VALIDATION.md, PATTERNS.md, and `.planning/tmp/verify-*.json` happen via the Write tool inside agents/workflows. **This is the leak pattern in this batch.** Adapter must surface five `record*`/`update*` methods (Bin B): `recordVerification`, `createUat`/`updateUat`, `recordValidation`/`appendValidationAudit`, `recordPatterns`, `recordDocVerification`.

2. **`check.ship-ready` is ~90% out of scope.** Only `verification_passed` is `.planning/`. Everything else (clean tree, branch, remote, gh) is code-repo + external. The adapter's role here is small; flag for synthesis to NOT propose `getShipPreflight()` as an adapter method — it's a thin orchestration over `getVerificationStatus()` plus a generic git utility.

3. **`pr-branch` workflow is a clean negative example.** Zero adapter implications despite living in the planning workflow tree, because its domain is git history. Useful calibration for the synthesizer: presence-in-`.planning/`-tree ≠ adapter-relevance.

4. **`.planning/.next-call-count` and `.planning/tmp/` are sidecar paths** that don't fit the "PLAN/SUMMARY/UAT/VERIFICATION" canonical artifact taxonomy. Two paths to consider:
   - Treat them as adapter-owned key/value (`getCounter(name)`, `setCounter(name, n)`, `recordTempArtifact(name, body)`) — Bin A primitives.
   - Treat them as implementation details inside named methods (`incrementNextCallCount()` Bin B, `recordDocVerification(...)` Bin B) and never expose generic kv.
   - Recommend the latter for cleaner adapter API; flag for synthesis decision.

5. **Decision-coverage gates (#14, #15) cite git log** for the verify-side haystack. The git log read is a code-repo concern, but it's wrapped INSIDE a Bin B query that also reads plans + summaries + files_modified content. Recommend the adapter expose `checkDecisionCoverageVerify(phase)` as the named method and have it internally compose the planning reads with a passed-in `gitLogProvider` callable, so the beads adapter can implement decision coverage without git involvement.

6. **`verify-work.md` UAT lifecycle is the densest Bin B target in this batch.** Eight distinct write triggers (initial create, current-test overwrite, test-row update, gaps APPEND, summary recompute, frontmatter timestamp, status transition, completion). For markdown adapter: serialize sections per the update_rules table. For beads adapter: probably becomes a single `gsd:uat` issue with comments-as-tests + status label transitions. Worth a detailed sub-spec; flag for synthesis.

7. **Naming uniformity check (convention sheet):** Used `record*` for write-domain-event ops, `get*` for single-record reads, `list*` for collections, `check*` for boolean/coverage gates. Two spots may collide:
   - `getVerificationStatus` vs upstream `getVerification` — recommend keeping both: `getVerification(phase)` returns full record (frontmatter + body), `getVerificationStatus(phase)` returns the parsed-status summary. Different consumers want different shapes.
   - `recordPatterns` is a new noun (`Patterns`). Domain-noun sheet doesn't list `Patterns`. **Flag for synthesis dedup / convention extension.**

## Bin-by-bin counts

- Bin A: 11 operations (`getPlan`, `verifyDocReferences`, `verifyPathExists`(eliminated → C), `getAutoMode`, `getConfigGates`, `getVerification`, `listActiveUat`, `getSummary`, `getSecurityStatus`, `getValidation`, `getContext`, `getResearch`, `findPlansWithMustHaves`, `listPhaseArtifacts`, `listRequirementsForPhase`) — net counted ≈11 unique
- Bin B: 14 operations (`listPhasePlanSummaryPairs`, `verifyPlanArtifacts`, `verifySummary`, `getPhaseCompletion`, `getMilestoneCompletion`, `listSafetyGates`, `getVerificationStatus`, `checkDecisionCoveragePlan`, `checkDecisionCoverageVerify`, `routeNextAction`, `detectPhaseType`, `createUat`, `updateUat`, `recordValidation`, `appendValidationAudit`, `recordVerification`, `recordPatterns`, `recordDocVerification`, plus `incrementNextCallCount` if adopted) — ≈18 unique with sidecar
- Bin C: 5 operations eliminated (`verifyCommits`, `verifySchemaDrift`, `verifyCodebaseDrift`, `verifyPathExists`, `getShipPreflight`-as-monolith)
- Bin D: 0 (no presentation-only exports in this batch)
- Direct I/O leaks found in workflows/agents: 22 (verify-phase: 8 enumerated of which ~5 in scope; verify-work: 6; validate-phase: 3; ship: 1; pr-branch: 0; health: 0; gsd-verifier: 5; gsd-doc-verifier: 1; gsd-pattern-mapper: 1)
- Routers auto-classified: 9
