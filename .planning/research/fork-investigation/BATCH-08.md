# Batch 08 — Spike + sketch + learnings + tests

Date: 2026-04-30
Artifacts assigned: 24
Output by: BATCH-08 fork-investigation classifier

## Classification table

| # | Path | Kind | I/O surface | Bin | Use case (≤15 words) | Direct I/O ops | Adapter methods proposed (with Bin) | Notes |
|---|------|------|-------------|-----|----------------------|----------------|-------------------------------------|-------|
| 1 | sdk/dist/query/frontmatter.js::extractFrontmatter | sdk-query-export | n/a | A | Pure parser of YAML frontmatter from a string | n/a | (utility, not adapter) | Pure function; no I/O |
| 2 | sdk/dist/query/frontmatter.js::extractFrontmatterLeading | sdk-query-export | n/a | A | Parse only first ---…--- block | n/a | (utility) | Pure function |
| 3 | sdk/dist/query/frontmatter.js::stripFrontmatter | sdk-query-export | n/a | A | Strip frontmatter blocks from content | n/a | (utility) | Pure function |
| 4 | sdk/dist/query/frontmatter.js::splitInlineArray | sdk-query-export | n/a | A | Split YAML inline array string | n/a | (utility) | Pure function |
| 5 | sdk/dist/query/frontmatter.js::parseMustHavesBlock | sdk-query-export | n/a | A | Parse must_haves nested YAML block | n/a | (utility) | Pure function |
| 6 | sdk/dist/query/frontmatter.js::frontmatterGet | sdk-query-export | n/a | A | Read file + return parsed frontmatter (or one field) | readFile | getRecordFrontmatter(path, field?) (A) | Bare read; trivially adapter-shimmable |
| 7 | sdk/dist/query/frontmatter-mutation.js::reconstructFrontmatter | sdk-query-export | n/a | A | Serialize obj to YAML lines | n/a | (utility) | Pure function |
| 8 | sdk/dist/query/frontmatter-mutation.js::spliceFrontmatter | sdk-query-export | n/a | A | Replace/prepend frontmatter in content | n/a | (utility) | Pure function |
| 9 | sdk/dist/query/frontmatter-mutation.js::frontmatterSet | sdk-query-export | n/a | B | Read file → set one FM field → write back normalized | readFile + writeFile | updateRecordFrontmatter(path, field, value) (B) | Domain logic: parse, type-coerce, splice, normalize |
| 10 | sdk/dist/query/frontmatter-mutation.js::frontmatterMerge | sdk-query-export | n/a | B | Read file → JSON-merge into FM → write back | readFile + writeFile | mergeRecordFrontmatter(path, patch) (B) | Coordination: parse JSON, merge, splice |
| 11 | sdk/dist/query/frontmatter-mutation.js::frontmatterValidate | sdk-query-export | n/a | A | Read file → validate FM against named schema | readFile | validateRecordFrontmatter(path, schema) (A) | Read + pure logic; could decompose to A get + pure validate |
| 12 | sdk/dist/query/frontmatter-mutation.js::FRONTMATTER_SCHEMAS | sdk-query-export | n/a | A | Static schema constants | n/a | (constants) | Data only |
| 13 | sdk/dist/query/websearch.js::websearch | sdk-query-export | n/a | n/a | Brave Search API call (network, not planning state) | network fetch | (out of scope — non-`.planning/`) | External system; per Rule 6 not an adapter concern |
| 14 | get-shit-done/workflows/spike.md | workflow | Direct (heavy) | n/a (consumer) | Build experiential spike experiments under .planning/spikes/ | 8 ops enumerated below | 8 methods proposed below | Directly creates/reads/writes spike directory artifacts |
| 15 | get-shit-done/workflows/spike-wrap-up.md | workflow | Direct (heavy) | n/a (consumer) | Bundle spike findings into a project skill | 6 ops enumerated below | 6 methods proposed below | Reads spikes/ + writes WRAP-UP-SUMMARY.md, CONVENTIONS.md, edits CLAUDE.md |
| 16 | get-shit-done/workflows/sketch.md | workflow | Direct (heavy) | n/a (consumer) | Throwaway HTML design mockups under .planning/sketches/ | 8 ops enumerated below | 8 methods proposed below | Mirror of spike workflow for design |
| 17 | get-shit-done/workflows/sketch-wrap-up.md | workflow | Direct (heavy) | n/a (consumer) | Bundle sketch findings into a project skill | 5 ops enumerated below | 5 methods proposed below | Mirror of spike-wrap-up for design |
| 18 | get-shit-done/workflows/profile-user.md | workflow | Mixed | n/a (consumer) | Build USER-PROFILE.md from sessions/questionnaire | 3 ops enumerated below | 3 methods proposed below | Mostly SDK-driven; profile artifact lives in $HOME, not `.planning/` |
| 19 | get-shit-done/workflows/extract_learnings.md | workflow | Mixed | n/a (consumer) | Extract decisions/lessons/patterns/surprises from a phase | 4 ops enumerated below | 4 methods proposed below | Phase artifact reads + LEARNINGS.md write are direct |
| 20 | get-shit-done/workflows/add-tests.md | workflow | Mixed | n/a (consumer) | Generate unit/E2E tests for a completed phase | 2 planning-state ops enumerated below | 2 methods proposed below | Test files & repo greps are out-of-scope (code, not planning) |
| 21 | agents/gsd-codebase-mapper.md | agent | Direct | n/a (consumer) | Subagent: write codebase analysis docs to `.planning/codebase/` | 7 file Writes enumerated below | 1 method proposed below | All writes go to `.planning/codebase/{NAME}.md`; uniform shape |
| 22 | agents/gsd-intel-updater.md | agent | Direct | n/a (consumer) | Subagent: write JSON intel to `.planning/intel/` | 5 Writes + 5 SDK calls enumerated below | 2 methods proposed below | Mostly Direct file writes; SDK call only patches metadata |
| 23 | commands/gsd/spike.md | skill | Router | n/a | Entrypoint for /gsd-spike | None | (inherits from spike.md workflow) | Pure router |
| 24 | commands/gsd/spike-wrap-up.md | skill | Router | n/a | Entrypoint for /gsd-spike-wrap-up | None | (inherits) | Pure router |
| 25 | commands/gsd/sketch.md | skill | Router | n/a | Entrypoint for /gsd-sketch | None | (inherits) | Pure router |
| 26 | commands/gsd/sketch-wrap-up.md | skill | Router | n/a | Entrypoint for /gsd-sketch-wrap-up | None | (inherits) | Pure router |
| 27 | commands/gsd/profile-user.md | skill | Router | n/a | Entrypoint for /gsd-profile-user | None | (inherits) | Pure router |
| 28 | commands/gsd/extract_learnings.md | skill | Router | n/a | Entrypoint for /gsd-extract-learnings | None | (inherits) | Pure router |
| 29 | commands/gsd/add-tests.md | skill | Router | n/a | Entrypoint for /gsd-add-tests | None | (inherits) | Pure router; injects @.planning/STATE.md & @.planning/ROADMAP.md as context — NB |
| 30 | commands/gsd/sync-skills.md | skill | Router | n/a | Sync managed gsd-* skill dirs across runtime roots | None | (out of scope — non-`.planning/`) | Operates on runtime skills root, not planning state |
| 31 | commands/gsd/update.md | skill | Router | n/a | Update GSD package | None | (out of scope) | npm/runtime concerns, not planning |
| 32 | commands/gsd/reapply-patches.md | skill | Direct (full inline) | n/a (out of scope) | Three-way merge of `gsd-local-patches/` after update | Read/Write of `gsd-local-patches/` only | (out of scope — non-`.planning/`) | All I/O is on runtime config dir, not planning state |
| 33 | commands/gsd/graphify.md | skill | Mixed (inline+spawn) | n/a (consumer) | Build/query knowledge graph in `.planning/graphs/` | 1 direct Read of `.planning/config.json` + 4 Bash CLI shell-outs to gsd-tools.cjs | 2 methods proposed below | Direct config Read is the leak; the graphify CLI is itself a state-coupled tool |
| 34 | commands/gsd/from-gsd2.md | skill | Direct (inline) | n/a (consumer) | Import GSD-2 .gsd/ project to GSD v1 .planning/ | Bash shell-out to gsd-tools.cjs which writes `.planning/` | 1 method proposed below | The migration tool itself produces the entire `.planning/` tree |

## Per-artifact detail

### sdk/dist/query/frontmatter.js (multiple exports)

The file is dominated by pure parsing utilities (Bin A, no I/O) plus the I/O-bound `frontmatterGet`. The I/O is a bare `readFile` of an arbitrary `.planning/`-relative path (resolved via `resolvePathUnderProject`). For an adapter, this is the canonical bare-read primitive: `getRecordFrontmatter(path, field?) -> object` (A). The beads adapter would synthesize the YAML view from issue body / labels.

### sdk/dist/query/frontmatter-mutation.js (multiple exports)

Three handlers do disk I/O. `frontmatterSet` and `frontmatterMerge` are Bin B because they coordinate read → mutate → splice → normalize → write into a single semantically-named operation (per Rule 5: derived/coerced data injected between read and write — `parseSimpleValue`, schema-aware splice, line-ending normalization). `frontmatterValidate` is Bin A (read + pure check). `reconstructFrontmatter`, `spliceFrontmatter`, `FRONTMATTER_SCHEMAS` are pure utilities, not adapter concerns. Proposed adapter methods: `updateRecordFrontmatter(path, field, value)` (B), `mergeRecordFrontmatter(path, patch)` (B), `validateRecordFrontmatter(path, schemaName)` (A).

### sdk/dist/query/websearch.js

Out of scope (Rule 6). It is a network call to Brave Search; no planning-state read or write occurs. Adapter interface should not include this.

### get-shit-done/workflows/spike.md

- **Direct I/O ops enumerated:**
  1. `mkdir -p .planning/spikes` — bootstrap directory
  2. `ls -d .planning/spikes/[0-9][0-9][0-9]-*` — discover next spike number
  3. Read `.planning/spikes/MANIFEST.md` (idea, requirements, table) — repeat
  4. Read `.planning/spikes/CONVENTIONS.md` — re-grounding
  5. Glob+Read `.planning/spikes/*/README.md` — prior-context load and frontier mode
  6. Create `.planning/spikes/NNN-name/` directory + spike code files (Write)
  7. Write `.planning/spikes/NNN-name/README.md` with YAML frontmatter (verdict, related, tags)
  8. Write/Update `.planning/spikes/MANIFEST.md` row
  9. Write/Update `.planning/spikes/CONVENTIONS.md`
  10. (Bash) `gsd-sdk query commit "docs(spike-NNN)…"` — SDK-mediated (not a leak)
- **Adapter methods needed:**
  1. `addSpike({number, name, type, validates, tags}) -> SpikeRef` (B) — directory create + numbering + scaffold
  2. `listSpikes(filter?) -> Spike[]` (A) — replaces glob + frontmatter parse
  3. `getSpikeManifest() -> Manifest` (A)
  4. `updateSpikeManifest({entry}) -> void` (B) — table-row insert/update
  5. `getSpikeConventions() -> Conventions` (A)
  6. `updateSpikeConventions(patch) -> void` (B) — section-aware merge
  7. `recordSpikeResult({number, verdict, evidence}) -> void` (B) — README frontmatter mutation + body update
  8. `addSpikeRequirement(text) -> void` (B) — append to MANIFEST Requirements section
- **Notes:** `.planning/spikes/` parallels `.planning/phases/` as a first-class collection. Beads adapter would create `gsd:spike` issues with `verdict:VALIDATED|PARTIAL|INVALIDATED` labels and a `manifest` parent issue.

### get-shit-done/workflows/spike-wrap-up.md

- **Direct I/O ops enumerated:**
  1. Read `.planning/spikes/MANIFEST.md`
  2. Glob+Read `.planning/spikes/*/README.md`
  3. Glob+Read `./.claude/skills/spike-findings-*/SKILL.md` — skill artifact (out of scope per Rule 6 — these live under `.claude/`, not `.planning/`)
  4. Copy core source files into `./.claude/skills/spike-findings-[project]/sources/` (out of scope)
  5. Write `./.claude/skills/spike-findings-[project]/references/*.md` (out of scope)
  6. Write `./.claude/skills/spike-findings-[project]/SKILL.md` (out of scope)
  7. **Write `.planning/spikes/WRAP-UP-SUMMARY.md`** — IN scope
  8. **Write `.planning/spikes/CONVENTIONS.md`** — IN scope
  9. Append routing line to project `CLAUDE.md` — out of scope (project root, not `.planning/`)
- **Adapter methods needed (planning-state only):**
  1. `recordSpikeWrapUp({date, processedSpikes, areas}) -> void` (B) — writes WRAP-UP-SUMMARY.md
  2. `updateSpikeConventions(patch)` (B) — already proposed in spike.md
  3. `listSpikes()` (A) — reuse
  4. `getSpikeManifest()` (A) — reuse
  5. `markSpikeProcessed(number)` (B) — domain transition (so wrap-up doesn't re-process)
- **Notes:** Most file writes target `./.claude/skills/`, which is the runtime skill registry — orthogonal to planning state per Rule 6. Only WRAP-UP-SUMMARY.md and CONVENTIONS.md updates are adapter concerns.

### get-shit-done/workflows/sketch.md

- **Direct I/O ops enumerated:**
  1. `mkdir -p .planning/sketches/themes` — bootstrap
  2. `ls -d .planning/sketches/[0-9][0-9][0-9]-*` — discover next number
  3. Read `.planning/sketches/MANIFEST.md`
  4. Glob+Read `.planning/sketches/*/README.md`
  5. Read `.planning/spikes/MANIFEST.md` — cross-collection borrow
  6. Read `.planning/spikes/CONVENTIONS.md` — cross-collection borrow
  7. Glob+Read `./.claude/skills/spike-findings-*/SKILL.md` — out of scope (Rule 6)
  8. Create `.planning/sketches/NNN-name/index.html` (Write)
  9. Write `.planning/sketches/themes/default.css`
  10. Write `.planning/sketches/NNN-name/README.md` with frontmatter (winner, tags)
  11. Write/Update `.planning/sketches/MANIFEST.md` row
  12. (Bash) `gsd-sdk query commit "docs(sketch-NNN)…"` — SDK-mediated
- **Adapter methods needed:**
  1. `addSketch({number, name, question, tags}) -> SketchRef` (B)
  2. `listSketches(filter?) -> Sketch[]` (A)
  3. `getSketchManifest() -> Manifest` (A)
  4. `updateSketchManifest({entry}) -> void` (B)
  5. `recordSketchWinner({number, variant}) -> void` (B) — frontmatter mutation
  6. `getSketchTheme(name?) -> ThemeBytes` (A)
  7. `putSketchTheme(name, bytes) -> void` (A)
  8. `putSketchAsset({sketchNumber, file, bytes}) -> void` (A) — index.html, etc.
- **Notes:** Sketch HTML/CSS files are still planning artifacts (under `.planning/sketches/`), so Bin A `putSketchAsset` is the right shape — bytes-in/bytes-out. The beads adapter likely doesn't model sketches in bd; it would defer to the markdown adapter for this collection or store as bd attachment-style records.

### get-shit-done/workflows/sketch-wrap-up.md

- **Direct I/O ops enumerated:**
  1. Read `.planning/sketches/MANIFEST.md`
  2. Glob+Read `.planning/sketches/*/README.md`
  3. Skill writes to `./.claude/skills/sketch-findings-[project]/` — out of scope (Rule 6)
  4. **Write `.planning/sketches/WRAP-UP-SUMMARY.md`** — IN scope
  5. Append routing line to project `CLAUDE.md` — out of scope
- **Adapter methods needed (planning-state only):**
  1. `recordSketchWrapUp({date, included, excluded, areas}) -> void` (B)
  2. `markSketchProcessed(number)` (B)
  3. `listSketches()` (A) — reuse
  4. `getSketchManifest()` (A) — reuse
- **Notes:** Same pattern as spike-wrap-up; bulk of writes are skill-runtime, not planning state.

### get-shit-done/workflows/profile-user.md

- **Direct I/O ops enumerated:**
  1. `[ -f "$HOME/.claude/get-shit-done/USER-PROFILE.md" ]` — out of scope (lives in $HOME, not `.planning/`)
  2. `cp` USER-PROFILE.md to backup — out of scope
  3. Temp file Read/Write under `/tmp` — out of scope (transient)
  4. Read `./CLAUDE.md` (project root) — borderline; project root not `.planning/`
- **Adapter methods needed:**
  1. None for `.planning/` — this workflow's persistent state lives in `$HOME/.claude/get-shit-done/USER-PROFILE.md`, which is per-developer global, not per-project planning. Treat as out-of-scope per Rule 6.
- **Notes:** This is the only workflow in the batch that does NOT principally read/write `.planning/`. All heavy lifting is `gsd-sdk query` (`scan-sessions`, `profile-sample`, `profile-questionnaire`, `write-profile`, `generate-dev-preferences`, `generate-claude-profile`). Mark surface as Mixed only because of the project-CLAUDE.md edit; that is debatable.

### get-shit-done/workflows/extract_learnings.md

- **Direct I/O ops enumerated:**
  1. Read `${PHASE_DIR}/*-PLAN.md` (required) — direct phase artifact read
  2. Read `${PHASE_DIR}/*-SUMMARY.md` (required) — direct
  3. Read `${PHASE_DIR}/*-VERIFICATION.md` (optional) — direct
  4. Read `${PHASE_DIR}/*-UAT.md` (optional) — direct
  5. Read `.planning/STATE.md` (optional) — direct
  6. **Write `${PHASE_DIR}/${PADDED_PHASE}-LEARNINGS.md`** with frontmatter — direct
  7. (Optional) `capture_thought` MCP call — out of scope (external MCP)
  8. `gsd-sdk query state.update "Last Activity"` — SDK-mediated (not a leak)
  9. `gsd-sdk query init.phase-op` — SDK-mediated
- **Adapter methods needed:**
  1. `getPhaseArtifacts(phase, kinds: ('plan'|'summary'|'verification'|'uat')[]) -> Artifact[]` (A) — replaces direct phase-dir reads
  2. `getStateSnapshot() -> State` (A) — replaces direct STATE.md read (already exists in SDK as state-snapshot; adapter shim)
  3. `recordLearnings({phase, decisions, lessons, patterns, surprises, missing}) -> void` (B) — coordinated structured write of LEARNINGS.md with computed counts in frontmatter; cleanly maps to a domain method (timestamp + counts injected)
  4. `markGraduated({phase, item, target, date})` (B) — for the optional `graduated:` annotation flow (not done in this workflow but structurally adjacent)
- **Notes:** The four phase-artifact reads share a pattern with other workflows (forensic audit, summary-extract). One adapter method — `getPhaseArtifacts` — could subsume them. `recordLearnings` is Bin B because the schema (counts + missing_artifacts) is computed from inputs.

### get-shit-done/workflows/add-tests.md

- **Direct I/O ops enumerated (planning-state only):**
  1. Read `${phase_dir}/*-SUMMARY.md` (required)
  2. Read `${phase_dir}/CONTEXT.md`
  3. Read `${phase_dir}/*-VERIFICATION.md` (optional)
  4. `gsd-sdk query state-snapshot` — SDK-mediated
- **Out-of-scope ops (per Rule 6 — code repo, not planning):**
  - `find . -type d -name "*test*"…` — repo test-structure discovery
  - Read of arbitrary source files for classification
  - `git add` / `git commit` of test files
  - `grep -r "{scenario keyword}" {e2e test directory}` — code grep
- **Adapter methods needed:**
  1. `getPhaseArtifacts(phase, kinds)` (A) — same as extract_learnings
  2. `recordTestPlan({phase, classifications, results, gaps, bugs}) -> void` (B) — if results need persistence; current workflow only commits test files (out of scope) — minimal planning-state write
- **Notes:** Almost all of this workflow's I/O is on the application code repository, not planning state. Only the phase-artifact reads matter for the adapter; all test generation, execution, and commits are repo-side.

### agents/gsd-codebase-mapper.md

- **Direct I/O ops enumerated:**
  1. **Write `.planning/codebase/STACK.md`** (focus=tech)
  2. **Write `.planning/codebase/INTEGRATIONS.md`** (focus=tech)
  3. **Write `.planning/codebase/ARCHITECTURE.md`** (focus=arch)
  4. **Write `.planning/codebase/STRUCTURE.md`** (focus=arch)
  5. **Write `.planning/codebase/CONVENTIONS.md`** (focus=quality)
  6. **Write `.planning/codebase/TESTING.md`** (focus=quality)
  7. **Write `.planning/codebase/CONCERNS.md`** (focus=concerns)
  - Plus many Reads of repo source/config — out of scope (code, not planning)
- **Adapter methods needed:**
  1. `putCodebaseDoc(name, body) -> void` (A) — bare typed write to `.planning/codebase/{NAME}.md`
  2. `listCodebaseDocs() -> {name, mtime}[]` (A) — for downstream consumers (`/gsd-plan-phase` reads these by phase keyword)
  3. `getCodebaseDoc(name) -> string` (A) — bare read for consumers
- **Notes:** All seven writes share the same shape — fixed UPPERCASE.md filename in `.planning/codebase/`. One Bin A method handles them all. The "named" doc set is a closed enum (STACK/INTEGRATIONS/ARCHITECTURE/STRUCTURE/CONVENTIONS/TESTING/CONCERNS), so a slightly stricter adapter could expose `putCodebaseDoc(kind: 'stack'|'integrations'|...)` for type safety. Beads adapter would create issues labeled `gsd:codebase-doc kind:stack` etc.

### agents/gsd-intel-updater.md

- **Direct I/O ops enumerated:**
  1. **Write `.planning/intel/stack.json`** (Step 2)
  2. **Write `.planning/intel/files.json`** (Step 3)
  3. **Write `.planning/intel/apis.json`** (Step 4)
  4. **Write `.planning/intel/deps.json`** (Step 5)
  5. **Write `.planning/intel/arch.md`** (Step 6)
  6. Many Glob/Read of repo source — out of scope (code)
  7. `gsd-sdk query intel.patch-meta .planning/intel/{file}.json` — SDK-mediated metadata patch (5 calls — Steps 2-5)
  8. `gsd-sdk query intel.validate` — SDK-mediated
  9. `gsd-sdk query intel.snapshot` — SDK-mediated; writes `.last-refresh.json`
  10. `gsd-sdk query intel.extract-exports <file>` — SDK utility for symbol extraction
- **Adapter methods needed:**
  1. `putIntelDoc(name, body) -> void` (A) — bare typed write to `.planning/intel/{name}.json|md`
  2. `getIntelDoc(name) -> string` (A) — for partial-update merging (the agent reads the existing file before merging)
  3. `patchIntelMeta(name) -> void` (B) — already an SDK query; surface as named adapter method (timestamp injection + version bump → Bin B per Rule 5)
  4. `recordIntelSnapshot({hashes}) -> void` (B) — already an SDK query; structured write of `.last-refresh.json`
- **Notes:** Five intel files (4 JSON + 1 MD) all live in `.planning/intel/` and are bare bytes from the adapter's perspective. The metadata-patching is the Bin B coordination layer that the existing SDK provides; preserve that as `patchIntelMeta`. Beads adapter would store these as project-meta records / bd issues with structured payloads.

### commands/gsd/*.md (10 router skills + 2 inline skills)

| Skill | Routes to | Classification |
|-------|-----------|----------------|
| spike.md | workflows/spike.md | Router |
| spike-wrap-up.md | workflows/spike-wrap-up.md | Router |
| sketch.md | workflows/sketch.md | Router |
| sketch-wrap-up.md | workflows/sketch-wrap-up.md | Router |
| profile-user.md | workflows/profile-user.md | Router |
| extract_learnings.md | workflows/extract_learnings.md | Router |
| add-tests.md | workflows/add-tests.md | Router (with `@.planning/STATE.md` and `@.planning/ROADMAP.md` in `<context>` — see note) |
| sync-skills.md | (workflow only described inline) | Router; **out of scope** — operates on runtime skills root |
| update.md | workflows/update.md | Router; **out of scope** — npm package update |
| from-gsd2.md | inline (calls `gsd-tools.cjs from-gsd2`) | Inline; **out of scope** at the surface (the migrator itself writes `.planning/` but it's invoked via Bash, so the tool — not the skill — is the adapter touchpoint) |
| reapply-patches.md | inline (full body) | Inline; **out of scope** — operates on `gsd-local-patches/` under config dir, not `.planning/` |
| graphify.md | inline + spawns graphify-builder agent | Inline; partial scope — see below |

#### add-tests.md context-injection note

`commands/gsd/add-tests.md` declares `@.planning/STATE.md` and `@.planning/ROADMAP.md` in its `<context>` block. This causes Claude to **load** those files at skill activation time — which counts as a Read of `.planning/*` in the sense of needing adapter mediation. Several other GSD skills do this too (the synthesizer should look for this pattern across batches). Adapter methods needed: `getStateSnapshot()` (A) and `getRoadmap()` (A) — these are likely already proposed by other batches.

#### graphify.md detail

- **Direct I/O ops enumerated:**
  1. **Read `.planning/config.json`** — explicit "Read tool" (Step 1, not via SDK because `gsd-tools config get-value` exits on missing keys)
  2. `node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs graphify query|status|diff|build` — Bash CLI calls; the CLI itself does the `.planning/graphs/` I/O
  3. Spawns `graphify-builder` agent (Task) — out of this batch's scope
- **Adapter methods needed:**
  1. `getConfig(key?) -> Config | unknown` (A) — replace the direct `.planning/config.json` Read; the leak occurs because the existing CLI hard-exits on missing keys, so the workaround bypasses SDK. Adapter must support a soft-default get.
  2. (graphify build/query/status/diff) — these target `.planning/graphs/*` and should be exposed as named adapter methods if the graph subsystem is in scope, but the I/O is encapsulated inside `gsd-tools.cjs` rather than this skill. Likely tracked by a different batch covering `graphify` SDK/CLI.
- **Notes:** The direct `.planning/config.json` Read is a textbook leak — exactly the pattern that motivates the fork. The skill author explicitly chose Read over SDK to avoid an unrelated CLI bug. Worth flagging in synthesis.

#### from-gsd2.md detail

- **Direct I/O ops enumerated:**
  1. Bash shell-out to `gsd-tools.cjs from-gsd2 --dry-run` then `from-gsd2`
  2. The `gsd-tools.cjs from-gsd2` subcommand internally writes the entire `.planning/` directory tree — this is the I/O, but it's inside the CLI binary, not the skill prompt
- **Adapter methods needed:**
  1. `bootstrapFromGsd2(sourceDir, options) -> ImportResult` (B) — this would be the right named method for the migrator; massive coordinated structured write of the entire planning tree from a foreign format
- **Notes:** Whether this is in scope depends on whether the synthesizer treats `gsd-tools.cjs` subcommands as adapter surface. If yes, this is a heavy Bin B method. If the migrator stays as a one-shot tool that writes raw markdown directly (and post-import is handled normally), it can stay outside the adapter interface.

#### sync-skills.md, update.md, reapply-patches.md detail

All three operate on the GSD installation itself — runtime skill directories under `~/.claude/skills/` or `~/.claude/get-shit-done/`, npm packages, and `gsd-local-patches/` under the runtime config dir. Per Rule 6, none of these touch `.planning/` and none belong in the adapter interface. Documented for completeness; no methods proposed.

## Cross-cutting observations from this batch

1. **Spike and sketch are first-class collections that mirror phase/plan in structure.** Both have MANIFEST.md, NNN-named subdirectories with READMEs that carry frontmatter (verdict/winner), and a CONVENTIONS.md side-document. The adapter likely needs the same noun shape for both: `add{Spike,Sketch}`, `list{Spikes,Sketches}`, `update{Spike,Sketch}Manifest`, `record{Spike,Sketch}{Result,Winner}`, `update{Spike,Sketch}Conventions`. Synthesis should consolidate these into a shared abstract collection or accept the duplication as noun-disjoint.

2. **Frontmatter mutation is a shared verb across the entire codebase.** `frontmatterSet`, `frontmatterMerge`, and `frontmatterValidate` are generic over file path. Many workflows in this batch (and beyond) ultimately funnel updates through these handlers (e.g., spike "verdict" updates, sketch "winner" updates). The adapter could expose the generic primitives (`updateRecordFrontmatter`, `mergeRecordFrontmatter`) AND domain-typed wrappers (`recordSpikeResult`, `recordSketchWinner`) that internally delegate. Generic Bin B + named Bin B.

3. **Wrap-up workflows write THREE artifacts but only TWO live in `.planning/`.** Spike-wrap-up and sketch-wrap-up both write a project-local skill (under `./.claude/skills/`), a planning summary (under `.planning/spikes/` or `.planning/sketches/`), and a project CLAUDE.md routing line. Only the planning summary and the CONVENTIONS.md update belong to the adapter. The skill-write and CLAUDE.md-edit are runtime/project-root concerns.

4. **Two skills declare `.planning/*` in their `<context>` block, causing implicit Reads.** `commands/gsd/add-tests.md` injects `@.planning/STATE.md` and `@.planning/ROADMAP.md`. This is a different leak shape than direct Reads in workflow prose — it happens at skill activation time before any workflow logic runs. The hook layer needs to handle context-block expansion as well as Read-tool calls. Worth flagging across batches.

5. **`graphify.md` deliberately bypasses the SDK** for `.planning/config.json` because the existing config-get CLI exits on missing keys. This is exactly the trigger pattern that motivated the fork — a skill author chose Read over the SDK for a defensible reason, breaking hookability. The adapter's `getConfig(key?, default?)` must explicitly support a soft-default mode.

6. **Codebase-mapper and intel-updater both write fixed-set typed documents under `.planning/codebase/` and `.planning/intel/`.** Good adapter primitive shape: `put{Codebase,Intel}Doc(kind, body)` (A) where `kind` is a closed enum. Beads adapter would label issues with `kind:stack`, `kind:concerns`, etc.

7. **Naming clashes:** None against the convention sheet. New nouns proposed that may overlap with other batches: `Spike`, `Sketch`, `SpikeManifest`, `SketchManifest`, `SpikeConventions`, `SketchConventions`, `CodebaseDoc`, `IntelDoc`, `Learnings`. Verbs all from the convention sheet (`add`, `list`, `get`, `update`, `record`, `put`, `merge`, `validate`, `mark`).

8. **`websearch`, `update`, `sync-skills`, `reapply-patches` are entirely out of scope.** Network calls, npm package management, and runtime config-dir merges are orthogonal to planning state. Including them in the adapter would over-broaden the interface.

9. **Possible Bin C (eliminate) candidate: `frontmatterValidate`.** Once an adapter exists, schema validation can move into the adapter constructor / a typed read return value rather than a separate query. Flagged for synthesis to consider.

## Bin-by-bin counts

- Bin A: 17 operations (10 pure utilities + 7 bare reads/writes/listings)
- Bin B: 18 operations (frontmatterSet, frontmatterMerge, addSpike, updateSpikeManifest, updateSpikeConventions, recordSpikeResult, addSpikeRequirement, recordSpikeWrapUp, markSpikeProcessed, addSketch, updateSketchManifest, recordSketchWinner, recordSketchWrapUp, markSketchProcessed, recordLearnings, markGraduated, patchIntelMeta, recordIntelSnapshot, bootstrapFromGsd2)
- Bin C: 1 candidate flagged (`frontmatterValidate` could become moot)
- Bin D: 0 (no presentation-only operations in this batch)
- Direct I/O leaks found across workflows + agents + skills: ~45 total enumerated above (spike.md ~10, spike-wrap-up.md ~9, sketch.md ~12, sketch-wrap-up.md ~5, extract_learnings.md ~6, add-tests.md ~3, codebase-mapper ~7, intel-updater ~5, graphify.md 1, add-tests.md context-block 2)
- Routers auto-classified: 10 of 12 skills (sync-skills, update, spike, spike-wrap-up, sketch, sketch-wrap-up, profile-user, extract_learnings, add-tests, plus the 10th is `sync-skills`); 2 are inline (reapply-patches and graphify, plus from-gsd2 — but from-gsd2 is so thin it nearly qualifies as router; counted as inline because it embeds the Bash invocation and dry-run protocol)
- Out-of-scope artifacts (no adapter methods proposed): websearch, profile-user (mostly), sync-skills, update, reapply-patches
