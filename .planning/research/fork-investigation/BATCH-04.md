# Batch 04 — Progress + audit + intel

Date: 2026-04-30
Artifacts assigned: 24
Output by: BATCH-04 agent

## Classification table

| # | Path | Kind | I/O surface | Bin | Use case (≤15 words) | Direct I/O ops | Adapter methods proposed (with Bin) | Notes |
|---|------|------|-------------|-----|----------------------|----------------|-------------------------------------|-------|
| 1 | sdk/dist/query/progress.js::progressJson | sdk-query-export | n/a | A | List per-phase plan/summary counts + status | n/a | listPhaseProgress() (A) | Pilot reused/verified |
| 2 | sdk/dist/query/progress.js::progressBar | sdk-query-export | n/a | D | Format `progressJson` as ASCII bar | n/a | (presentation; consumes listPhaseProgress) | Pure formatter |
| 3 | sdk/dist/query/progress.js::progressTable | sdk-query-export | n/a | D | Format `progressJson` as markdown table | n/a | (presentation; consumes listPhaseProgress) | Pure formatter |
| 4 | sdk/dist/query/progress.js::determinePhaseStatus | sdk-query-internal | n/a | A | Read VERIFICATION.md → status string | n/a | getPhaseVerificationStatus(phase) (A) | Internal helper; surface to adapter |
| 5 | sdk/dist/query/progress.js::statsJson | sdk-query-export | n/a | B | Joins ROADMAP+disk+REQUIREMENTS+STATE+git for stats | n/a | getMilestoneStats() (B) | Multi-source coordinated read |
| 6 | sdk/dist/query/progress.js::statsTable | sdk-query-export | n/a | D | statsJson rendered as markdown | n/a | (presentation) | Delegates to statsJson |
| 7 | sdk/dist/query/progress.js::todoMatchPhase | sdk-query-export | n/a | B | Score pending todos against phase keywords/files | n/a | matchTodosToPhase(phase) (B) | Cross-source scoring |
| 8 | sdk/dist/query/progress.js::listTodos | sdk-query-export | n/a | A | List pending todos, optional area filter | n/a | listTodos(area?) (A) | Bare scan |
| 9 | sdk/dist/query/progress.js::todoComplete | sdk-query-export | n/a | B | Move todo pending→completed with timestamp | n/a | completeTodo(filename) (B) | Inject completed timestamp |
| 10 | sdk/dist/query/uat.js::uatRenderCheckpoint | sdk-query-export | n/a | A | Read UAT.md, parse Current Test, render checkpoint | n/a | getUatCurrentTest(file) (A) + view-format | Parse-only; checkpoint string is presentation |
| 11 | sdk/dist/query/uat.js::auditUat | sdk-query-export | n/a | B | Cross-phase scan of UAT/VERIFICATION outstanding items | n/a | listOutstandingUat() (B) | Joins fm.status across files; categorizes |
| 12 | sdk/dist/query/validate.js::regexForKeyLinkPattern | sdk-query-helper | n/a | n/a | Pure function — regex builder, no I/O | n/a | (none — pure utility) | Out of adapter scope |
| 13 | sdk/dist/query/validate.js::verifyKeyLinks | sdk-query-export | n/a | B | Verify must_haves.key_links by pattern across files | n/a | verifyKeyLinks(planFile) (B) | Reads plan + source + target; coordinated |
| 14 | sdk/dist/query/validate.js::validateConsistency | sdk-query-export | n/a | B | Check ROADMAP/disk/plan-fm consistency | n/a | validateConsistency() (B) | Multi-source diff |
| 15 | sdk/dist/query/validate.js::validateHealth | sdk-query-export | n/a | B | 10+ checks of .planning/ + optional repair | n/a | runHealthCheck(repair?) (B) | Includes WRITE on repair (createConfig/regenerateState) |
| 16 | sdk/dist/query/validate.js::validateAgents | sdk-query-export | n/a | C | Check agents/*.md installed under managed dir | n/a | (eliminate — non-`.planning/`) | Out of scope; targets ~/.claude/agents/ |
| 17 | sdk/dist/query/intel.js::intelStatus | sdk-query-export | n/a | A | Status of .planning/intel/ files (stale?) | n/a | getIntelStatus() (A) | Stat+read meta |
| 18 | sdk/dist/query/intel.js::intelDiff | sdk-query-export | n/a | A | Diff intel files vs last snapshot hashes | n/a | getIntelDiff() (A) | Hash compare |
| 19 | sdk/dist/query/intel.js::intelSnapshot | sdk-query-export | n/a | A | Save current intel hashes to .last-refresh.json | n/a | snapshotIntel() (A) | Bare put |
| 20 | sdk/dist/query/intel.js::intelValidate | sdk-query-export | n/a | A | Validate intel JSON + meta + freshness | n/a | validateIntel() (A) | Bare check |
| 21 | sdk/dist/query/intel.js::intelQuery | sdk-query-export | n/a | A | Search intel files for a term | n/a | queryIntel(term) (A) | Filtered scan |
| 22 | sdk/dist/query/intel.js::intelExtractExports | sdk-query-export | n/a | C | Parse JS file for exports (source code, not planning) | n/a | (eliminate — non-`.planning/`) | Targets repo source |
| 23 | sdk/dist/query/intel.js::intelPatchMeta | sdk-query-export | n/a | B | Patch _meta.updated_at + version on intel JSON | n/a | patchIntelMeta(file) (B) | Read+mutate+write with version bump |
| 24 | sdk/dist/query/intel.js::intelUpdate | sdk-query-export | n/a | C | Stub returning "spawn agent" message | n/a | (eliminate — agent dispatcher) | Not state I/O |
| 25 | get-shit-done/workflows/progress.md | workflow | Mixed | n/a (consumer) | Status report + smart route + optional forensic audit | (8 ops below) | (8 methods below) | Pilot reused; verified |
| 26 | get-shit-done/workflows/audit-uat.md | workflow | SDK-only | n/a (consumer) | Cross-phase UAT audit; categorize testable-now vs blocked | (1 op: Grep/Read codebase for stale features) | listOutstandingUat() (B from #11) + non-scope codebase grep | Stale-check is on source, not `.planning/` |
| 27 | get-shit-done/workflows/audit-fix.md | workflow | Mixed | n/a (consumer) | Run audit-uat, classify, fix via gsd-executor, commit | (2 ops below) | listOutstandingUat() (B) + listUatVerificationFiles() (A) | Tests + git commit are non-`.planning/` |
| 28 | get-shit-done/workflows/forensics.md | workflow | Direct | n/a (consumer) | Post-mortem investigation; write report under `.planning/forensics/` | (10 ops below) | (10 methods below) | Heavy direct I/O — many leaks |
| 29 | get-shit-done/workflows/stats.md | workflow | SDK-only | n/a (consumer) | Show project statistics | None | (consumes statsJson #5) | Clean SDK consumer |
| 30 | get-shit-done/workflows/list-phase-assumptions.md | workflow | Direct | n/a (consumer) | Surface Claude's pre-plan assumptions for a phase | (1 op: cat ROADMAP.md) | findPhase(num) (A) | One leak: `cat .planning/ROADMAP.md` |
| 31 | get-shit-done/workflows/scan.md | workflow | Mixed | n/a (consumer) | Spawn 1 mapper agent for codebase docs | (1 op: ls .planning/codebase/) | listCodebaseDocs() (A) | Mapper writes to `.planning/codebase/` (out-of-batch) |
| 32 | get-shit-done/workflows/health.md | workflow | SDK-only | n/a (consumer) | Run validate.health and present results; offer repair | None | (consumes validateHealth #15) | Plus non-scope: ~/.claude/tasks/ stale-cleanup grep |
| 33 | agents/gsd-eval-auditor.md | agent | Direct | n/a (consumer) | Score AI eval coverage; write EVAL-REVIEW.md | (4 ops below) | (4 methods below) | Writes under `.planning/phases/<n>/` |
| 34 | agents/gsd-nyquist-auditor.md | agent | Mixed | n/a (consumer) | Fill phase Nyquist validation gaps; write tests + VALIDATION.md | (3 ops below) | (3 methods below) | Test-file writes are non-scope |
| 35 | agents/gsd-integration-checker.md | agent | Direct | n/a (consumer) | Verify cross-phase wiring + E2E flows | (1 op: grep SUMMARY.md) | listPhaseSummaries(milestone) (A) | Bulk of work is on source code |
| 36 | agents/gsd-security-auditor.md | agent | Direct | n/a (consumer) | Verify threat mitigations; write SECURITY.md | (3 ops below) | (3 methods below) | PLAN/SUMMARY reads + SECURITY.md write |
| 37 | commands/gsd/progress.md | skill | n/a (router) | n/a | Router → workflows/progress.md | None | (inherits #25) | One-line router |
| 38 | commands/gsd/audit-uat.md | skill | n/a (router) | n/a | Router → workflows/audit-uat.md | None | (inherits #26) | One-line router |
| 39 | commands/gsd/audit-fix.md | skill | n/a (router) | n/a | Router → workflows/audit-fix.md | None | (inherits #27) | One-line router |
| 40 | commands/gsd/forensics.md | skill | n/a (router) | n/a | Router → workflows/forensics.md | None | (inherits #28) | One-line router |
| 41 | commands/gsd/stats.md | skill | n/a (router) | n/a | Router → workflows/stats.md | None | (inherits #29) | One-line router |
| 42 | commands/gsd/list-phase-assumptions.md | skill | n/a (router) | n/a | Router → workflows/list-phase-assumptions.md | None | (inherits #30) | One-line router |
| 43 | commands/gsd/scan.md | skill | n/a (router) | n/a | Router → workflows/scan.md | None | (inherits #31) | One-line router |
| 44 | commands/gsd/intel.md | skill | Mixed | n/a (consumer) | Query/status/diff inline; spawn agent for refresh | (1 op: Read .planning/config.json) | getConfig(key) (A) | Inline Read of config.json bypasses SDK by design |

## Per-artifact detail

### sdk/dist/query/progress.js (verified against pilot)

Pilot classifications stand. Reusing per-export rows (#1–#9). One refinement: `progressTable` is properly Bin D (presentation), not Bin A — the pilot already noted this in prose.

### sdk/dist/query/uat.js

- **uatRenderCheckpoint** — A: reads one UAT file, parses "Current Test" section, returns a formatted checkpoint string. The string assembly is presentation but the parse logic (regex extract `number/name/expected`) is data extraction. Adapter exposes parsed test record; checkpoint string formatting is view layer.
- **auditUat** — B: scans phases dir, filters by milestone, parses two file types (`*-UAT.md` `*-VERIFICATION.md`), categorizes items into 8 categories (`server_blocked`, `device_needed`, etc.), aggregates by-phase + by-category. Multi-source + categorization = Bin B.

### sdk/dist/query/validate.js

- **regexForKeyLinkPattern** — pure function, no I/O, no adapter method needed (callers' utility).
- **verifyKeyLinks** — B: reads plan frontmatter, then conditionally reads source + target files, runs regex, joins results. 3-source coordination.
- **validateConsistency** — B: reads ROADMAP, scans phases dir, reads each plan's frontmatter, computes warnings across (a) roadmap-vs-disk diff, (b) sequential numbering, (c) plan-numbering gaps, (d) summary orphans, (e) frontmatter completeness. Five check categories joined.
- **validateHealth** — B: 10 distinct checks plus optional **WRITE** repairs (`createConfig`, `resetConfig`, `regenerateState`, `addNyquistKey`). The repair branch alone makes this Bin B (multi-write coordination). The beads adapter would implement repairs via bd issue mutations / config writes.
- **validateAgents** — C: targets `~/.claude/agents/` (or `$GSD_AGENTS_DIR`), not `.planning/`. This is dev-toolchain inventory, not project state. Eliminate from adapter interface.

### sdk/dist/query/intel.js

`.planning/intel/` IS planning state (it lives under `.planning/`), so most exports are adapter concerns.

- **intelStatus, intelDiff, intelSnapshot, intelValidate, intelQuery** — A: bare reads/scans/hash-writes over the fixed set of `INTEL_FILES`. No coordination logic between operations.
- **intelExtractExports** — C: scans repo SOURCE files (not `.planning/`). Out of scope per Rule 6.
- **intelPatchMeta** — B: read JSON → mutate `_meta.updated_at` + bump version → write. Timestamp/version injection between read and write = Bin B.
- **intelUpdate** — C: stub that returns `{action: 'spawn_agent'}` — does no real I/O, just dispatches an agent. Eliminate as adapter method.

Note: there's an `isIntelEnabled()` helper that reads `config.json`. That's a config-read concern shared with batch handling `config-query.js` (likely batch-01); flag for synthesis dedup as `getConfig(key)`.

### get-shit-done/workflows/progress.md (pilot reused/verified)

Pilot's 7-leak enumeration verified accurate. **One additional leak found** at line 159: the UAT-gap `grep -l "status: diagnosed\|status: partial"` is inside the `route` step, not the forensic block — it always runs, not just under `--forensic`. So **8 leaks total**, not 7.

- **Direct I/O ops enumerated:**
  1. `ls .planning/phases/<dir>/*-PLAN.md|*-SUMMARY.md|*-UAT.md` — count phase artifacts (Step 1).
  2. `grep -l "status: diagnosed\|status: partial" .planning/phases/<dir>/*-UAT.md` — UAT gap routing (Step 1.5).
  3. `ls .planning/debug/*.md | grep -v resolved | wc -l` — active debug count (position step).
  4. `ls .planning/HANDOFF.json .planning/phases/*/.continue-here.md .planning/phases/*/*HANDOFF*.md` — orphan handoffs (forensic 2).
  5. `grep -rl "defer to Phase\|future phase|out of scope Phase|deferred to Phase" .planning/phases/` (forensic 3).
  6. `ls .planning/MEMORY.md .planning/memory/*.md` + grep keywords (forensic 4).
  7. `ls .planning/todos/pending/*.md` + keyword scan (forensic 5).
  8. `git status --porcelain` (forensic 6 — non-scope).
- **Adapter methods needed:** `countPhaseArtifacts(phase)` (A); `listUat(phase, status)` (A); `listDebugSessions(active?)` (A); `listOrphanedHandoffs()` (A); `findDeferredScopeRefs()` (B — joins phase artifacts vs roadmap); `listMemoryEntries(filter)` (A); `listPendingTodos(filter?)` (A); `gitStatusForCode()` is non-scope.

### get-shit-done/workflows/audit-uat.md

- **Direct I/O ops enumerated:** Step 2 says "use Grep/Read to check if the underlying feature still exists in the codebase" — this is grep against **source code**, not `.planning/`. Per Rule 6, non-scope. The cross-phase UAT scan itself is via `gsd-sdk query audit-uat`.
- **Adapter methods needed:** `listOutstandingUat()` (B from #11) — already exists. The codebase staleness check is a separate concern.
- **Notes:** Otherwise SDK-only.

### get-shit-done/workflows/audit-fix.md

- **Direct I/O ops enumerated:**
  1. Glob `.planning/phases/*/*-UAT.md` (parse findings).
  2. Glob `.planning/phases/*/*-VERIFICATION.md` (parse findings).
  - All other ops are git/test invocations on source code (Rule 6 — non-scope).
- **Adapter methods needed:** `listUatVerificationFiles()` (A) — exposes parsed findings list; alternatively use `auditUat` data directly from #11. The fix-and-commit pipeline operates on source, not planning state.
- **Notes:** Recommend reusing #11's `listOutstandingUat()` instead of re-globbing.

### get-shit-done/workflows/forensics.md

Heaviest direct-I/O workflow in this batch. Many leaks.

- **Direct I/O ops enumerated:**
  1. Read `.planning/STATE.md` (Step 2b).
  2. Read `.planning/ROADMAP.md` (Step 2b).
  3. Read `.planning/config.json` (Step 2b).
  4. `ls .planning/phases/*/` (Step 2c) → enumerate phase dirs.
  5. Per-phase artifact existence check for `{padded}-PLAN/SUMMARY/VERIFICATION/CONTEXT/RESEARCH.md` (Step 2c).
  6. Read `.planning/reports/SESSION_REPORT.md` (Step 2d).
  7. `mkdir -p .planning/forensics` (Step 4).
  8. **Write** `.planning/forensics/report-{ts}.md` (Step 4) — new artifact class.
  9. `gsd-sdk query state.record-session ...` (Step 8) — SDK call (good).
  - Plus non-scope ops: `git log`, `git status`, `git worktree list`, `gh issue create`.
- **Adapter methods needed:**
  1. `getState()` (A) — STATE.md.
  2. `getRoadmap()` (A) — ROADMAP.md (raw — already a candidate from other batches).
  3. `getConfig()` (A) — config.json.
  4. `listPhaseArtifacts(phase)` (A) — superset of pilot's `countPhaseArtifacts`; returns existence-map across 5 artifact types.
  5. `getSessionReport()` (A) — `.planning/reports/SESSION_REPORT.md`.
  6. `addForensicReport({timestamp, body})` (B) — domain event with timestamped slug, structured under `.planning/forensics/`.
  7. `recordStateEvent({type:"forensic_session", text, link})` (B from pilot) — already needed; verifies pilot's recordStateEvent.
- **Notes:** `.planning/forensics/` and `.planning/reports/` are new noun families. Flag for synthesis: `ForensicReport`, `SessionReport`. The git/gh ops are out-of-scope but fundamental to the forensic process — keep as separate utilities.

### get-shit-done/workflows/stats.md

- **Direct I/O ops enumerated:** None. Pure SDK consumer of `gsd-sdk query stats.json`.
- **Adapter methods needed:** None new (consumes `getMilestoneStats()` from #5).

### get-shit-done/workflows/list-phase-assumptions.md

- **Direct I/O ops enumerated:** Step `validate_phase` runs `cat .planning/ROADMAP.md | grep -i "Phase ${PHASE}"`. **One leak.**
- **Adapter methods needed:** `findPhase(num)` (A) — already exists in SDK as `phase.find` / `roadmapGetPhase`. Workflow should call `gsd-sdk query roadmap.get-phase` instead of cat/grep.
- **Notes:** Trivial leak, fixable inside workflow without adapter changes; but the fork's adapter must surface this for hookability.

### get-shit-done/workflows/scan.md

- **Direct I/O ops enumerated:**
  1. `ls -la .planning/codebase/{DOCUMENT}.md` — existence + mtime check before overwrite.
  2. `mkdir -p .planning/codebase` (Step 3).
  - Mapper agent itself writes to `.planning/codebase/` — out of this batch (handled by the agent classification).
- **Adapter methods needed:** `listCodebaseDocs()` (A) — returns `{name, mtime}[]` for `.planning/codebase/*`. Plus the agent-spawn write path needs `addCodebaseDoc(name, body)` (B), which I flag for the batch covering codebase mapper.
- **Notes:** `Codebase` is a new noun (`.planning/codebase/*.md`).

### get-shit-done/workflows/health.md

- **Direct I/O ops enumerated:** None on `.planning/`. The workflow is a pure consumer of `gsd-sdk query validate.health`. Tail block has `find $HOME/.claude/tasks` — non-scope (Rule 6).
- **Adapter methods needed:** `runHealthCheck(repair?, backfill?)` (B from #15). Already covered.

### agents/gsd-eval-auditor.md

- **Direct I/O ops enumerated:**
  1. Read AI-SPEC.md (`{phase_dir}/AI-SPEC.md`).
  2. Read all SUMMARY.md files in phase dir.
  3. Read PLAN.md files.
  4. **Write** `{phase_dir}/{padded_phase}-EVAL-REVIEW.md`.
  - Plus non-scope: codebase scans (`find . -name "*.test.*"`, `grep -r "langfuse..."`, etc.).
- **Adapter methods needed:**
  1. `getPhaseAiSpec(phase)` (A).
  2. `listPhaseSummaries(phase)` (A).
  3. `listPhasePlans(phase)` (A).
  4. `addEvalReview(phase, body)` (B) — new artifact type with phase-padded slug.
- **Notes:** Adversarial-stance prose is process; only the file ops bind the adapter. `EvalReview` is a new noun.

### agents/gsd-nyquist-auditor.md

- **Direct I/O ops enumerated:**
  1. Reads listed in `<required_reading>`: PLAN.md, SUMMARY.md, VALIDATION.md (existing).
  2. **Write** test files (non-scope — they live in source tree, not `.planning/`).
  3. **Write/Edit** `{phase_dir}/{padded}-VALIDATION.md`.
- **Adapter methods needed:**
  1. `listPhasePlans(phase)` (A — same as eval-auditor).
  2. `listPhaseSummaries(phase)` (A).
  3. `getValidationMap(phase)` (A) + `updateValidationMap(phase, entries)` (B — appends mapping rows).
- **Notes:** Test-file writes are source-tree, not state. The VALIDATION.md is an existing GSD artifact (Bin B because the file has structured "verification map" sections the adapter must understand).

### agents/gsd-integration-checker.md

- **Direct I/O ops enumerated:**
  1. `grep -A 10 "Key Files\|Exports\|Provides" .planning/phases/*/*-SUMMARY.md` (Step 1).
  - All other ops are codebase grep/find — non-scope (Rule 6).
- **Adapter methods needed:** `listPhaseSummaries(milestone?)` (A) — already needed by other agents; one shared method serves all callers.
- **Notes:** Bulk of agent operates on source code (Rule 6). Only summary discovery touches `.planning/`. tools=Read/Bash/Grep/Glob (no Write).

### agents/gsd-security-auditor.md

- **Direct I/O ops enumerated:**
  1. Read PLAN.md `<threat_model>` block (`.planning/phases/<n>/*-PLAN.md`).
  2. Read SUMMARY.md `## Threat Flags` section.
  3. **Write** `{phase_dir}/SECURITY.md` (or padded variant).
- **Adapter methods needed:**
  1. `getPlanThreatModel(phase, planId)` (B — section extraction with structured-data parse from PLAN.md frontmatter / fenced block).
  2. `getSummaryThreatFlags(phase)` (A — section extraction).
  3. `addSecurityReview(phase, body)` (B — new artifact type).
- **Notes:** PLAN.md `<threat_model>` and SUMMARY.md `## Threat Flags` are subsections of larger artifacts — possibly best modeled as `getPhase().threatModel` rather than a top-level adapter call. Flag for synthesis: PLAN section extractors may be a recurring pattern.

### Skills (routers, #37–#43)

All seven skills (`progress`, `audit-uat`, `audit-fix`, `forensics`, `stats`, `list-phase-assumptions`, `scan`) are pure routers: frontmatter + objective + `<execution_context>@~/.claude/get-shit-done/workflows/X.md</execution_context>` + a 1-3 line `<process>` directive. Auto-classified as `Router`; inherit workflow classification.

### commands/gsd/intel.md (#44 — NOT a pure router)

- **I/O surface:** **Mixed.** This skill is unusual — it has inline orchestration logic (banner, config-gate, mode dispatch) and only spawns an agent for the `refresh` mode. Query/status/diff modes are inline `gsd-sdk query intel.X` calls. Crucially, **Step 1 instructs Claude to use the Read tool directly on `.planning/config.json`** (and explicitly forbids `gsd-sdk query config get-value`). This is a deliberate direct-I/O leak.
- **Direct I/O ops enumerated:**
  1. Read `.planning/config.json` (Step 1 config gate).
- **Adapter methods needed:** `getConfig(key)` (A) — likely already needed by many other workflows. Should NOT bypass the SDK; the workflow's "DO NOT use the gsd-tools config get-value" instruction is a workaround for a CLI behavior bug, not a fundamental adapter concern. Once the adapter exposes `getConfig`, this leak goes away.
- **Notes:** This is the most surprising classification in the batch — a `commands/gsd/*.md` file that would normally be auto-classified as Router contains direct I/O instructions and an inline orchestration flow. **The auto-classification rule (Rule 4) DOES NOT APPLY here.**

## Cross-cutting observations from this batch

1. **Rule 4 (auto-classify routers) has an exception.** `commands/gsd/intel.md` is NOT a thin router despite living in the routers directory. It contains inline config-gate logic with an explicit Read-tool direct-I/O instruction. Synthesizers should skim every skill body even when most look identical — `intel.md` proves at least one is different. Recommend rubric refinement: "scan skill body length / look for `## Step` headings vs single `<execution_context>` line."

2. **New artifact noun families surfaced.** This batch introduces several artifact classes not in the pilot's noun table:
   - `ForensicReport` (`.planning/forensics/report-*.md`)
   - `SessionReport` (`.planning/reports/SESSION_REPORT.md`)
   - `EvalReview` (`{phase}/...-EVAL-REVIEW.md`)
   - `SecurityReview` (`{phase}/SECURITY.md`)
   - `ValidationMap` (`{phase}/...-VALIDATION.md`)
   - `IntelFile` (`.planning/intel/*.json|md`)
   - `CodebaseDoc` (`.planning/codebase/*.md`)
   - `DebugSession` (`.planning/debug/*.md`)
   These should be added to the convention-sheet noun column.

3. **Non-scope categories well-represented here.** Validation `validateAgents` checks `~/.claude/agents/`; intel `intelExtractExports` parses repo source code; forensics + audit-fix lean heavily on git + test runners. Bin C ("eliminate") fits the SDK-export cases; the workflow non-scope ops correctly stay un-binned per Rule 6.

4. **Section-extraction is a recurring pattern.** PLAN.md `<threat_model>`, SUMMARY.md `## Threat Flags`, UAT.md `## Current Test`, MEMORY.md by-keyword. These suggest the adapter may need a generic `getSection(file, anchor)` (A) primitive — flag for synthesis. Otherwise we'll proliferate Bin B methods that are 90% the same parser.

5. **Verification of pilot.** Reused `progressJson`, `progressBar`, `progressTable`, `statsJson`, `todoMatchPhase`, `listTodos`, `todoComplete` classifications — all stand. Found one additional leak in `progress.md` (UAT-status grep at line 159 runs unconditionally, not just under `--forensic`); pilot's count of 7 leaks should be 8.

6. **Naming overlaps to dedupe with other batches:**
   - `getConfig(key)` — used here (intel.md, forensics.md) and certainly elsewhere.
   - `listPhaseSummaries` / `listPhasePlans` / `listPhaseArtifacts` — eval-auditor, nyquist-auditor, security-auditor, integration-checker, forensics, progress all need variants.
   - `getRoadmap()` — forensics + list-phase-assumptions + many others.
   - `recordStateEvent` — pilot already proposed; forensics reuses.
   Synthesis pass should consolidate.

7. **`validateHealth` is the largest single-method Bin B in this batch.** It bundles 10+ checks AND repairs (writes config.json, regenerates STATE.md, patches workflow.nyquist_validation key). For the beads adapter this becomes substantial: `bd init`-style scaffolding, validation against bd schema, label normalization. Consider splitting into `runHealthCheck()` (read-only) + `repairPlanning(actions)` for cleaner adapter contract.

## Bin-by-bin counts

- Bin A: 18 operations
- Bin B: 16 operations
- Bin C: 4 operations (validateAgents, intelExtractExports, intelUpdate, plus regexForKeyLinkPattern as pure-utility n/a)
- Bin D: 3 operations (progressBar, progressTable, statsTable)
- Direct I/O leaks found in workflows/agents: ~25 (forensics 9, progress 8, eval-auditor 4, security-auditor 3, nyquist-auditor 3, intel-skill 1, list-phase-assumptions 1, scan 1, audit-fix 2, integration-checker 1, audit-uat 0)
- Routers auto-classified: 7 (one skill — `intel.md` — overrode auto-classification)
