# Phase 6: BeadsAdapter implementation - Pattern Map

**Mapped:** 2026-05-11
**Files analyzed:** 40 (3 fork-side additive, 14 sibling ports, 12 new sibling authorings, 11 new sibling tests)
**Analogs found:** 40 / 40 (every file has a concrete analog; many share the same dominant analog)

All fork paths rooted at `/Volumes/code/get-shit-done/`. All sibling paths rooted at `/Volumes/code/gsd-beads/`. Sibling's `main @ 5082d45` is read-only for analog extraction; actual writes happen post-reset.

## File Classification

### Fork-side (3 additive; repo = `/Volumes/code/get-shit-done/`)

| Modified File | Role | Data Flow | Closest Analog | Match |
|---------------|------|-----------|----------------|-------|
| `package.json` | config | infrastructure | existing `"exports"` implicit in `"files"` block (lines 10-24) + `scripts.test:conformance` (line 71) | self (in-place addition) |
| `adapters/types.ts` | contract | pure (type-only) | self — `Capabilities` (lines 54-65); `UnsupportedCapabilityError` shape (lines 123-142) | self |
| `adapters/markdown/index.ts` | adapter-compliance | pure (declarative) | self — capabilities literal at line 121-130 | self |

### Sibling-side — `.mjs` → `.ts` ports (14 files)

| Ported File (target `.ts`) | Role | Data Flow | Closest Analog (source) | Match |
|----------------------------|------|-----------|--------------------------|-------|
| `src/bd/findRoot.ts` | primitive | pure fn (fs-read only) | `/Volumes/code/gsd-beads/src/bd/findRoot.mjs` (68 LOC) | exact — direct port |
| `src/bd/helper.ts` | primitive | stateful (spawnSync wrapper) | `/Volumes/code/gsd-beads/src/bd/helper.mjs` (65 LOC) | exact — port + Landmine 3/4 fix |
| `src/bd/errors.ts` | primitive | pure (class hierarchy) | `/Volumes/code/gsd-beads/src/bd/errors.mjs` (73 LOC) + fork `UnsupportedCapabilityError` shape (types.ts:123-142) | dual — port + add `BdManagedMismatchError` |
| `src/helpers/parsePhaseId.ts` | primitive | pure fn | `/Volumes/code/gsd-beads/src/helpers/parsePhaseId.mjs` (17 LOC) | exact — direct port |
| `src/helpers/deriveDiskStatus.ts` | primitive | pure fn | `/Volumes/code/gsd-beads/src/helpers/deriveDiskStatus.mjs` (24 LOC) | exact — direct port |
| `src/helpers/detectDrift.ts` | primitive | pure fn (stderr side-effect) | `/Volumes/code/gsd-beads/src/helpers/detectDrift.mjs` (40 LOC) | exact — direct port |
| `src/helpers/loadMilestoneHeading.ts` | primitive | pure fn | `/Volumes/code/gsd-beads/src/helpers/loadMilestoneHeading.mjs` (25 LOC) | exact — direct port |
| `src/format/phase.ts` | primitive | pure (text transform) | `/Volumes/code/gsd-beads/src/format/phase.mjs` (251 LOC) | exact — direct port, idempotency preserved |
| `src/format/section.ts` | primitive | pure (text transform) | `/Volumes/code/gsd-beads/src/format/section.mjs` (130 LOC) | exact — direct port |
| `src/format/frontmatter.ts` | primitive | pure (text transform) | `/Volumes/code/gsd-beads/src/format/frontmatter.mjs` (107 LOC) | exact — direct port; escalate to js-yaml only if nested surfaces |
| `src/paths.ts` | primitive | pure fn (path→route record) | `/Volumes/code/gsd-beads/src/adapter/pathRouter.mjs` (97 LOC) | exact — direct port + fork canonical-file list extension |
| `src/_atomicWrite.ts` | primitive | stateful (fs-write) | `/Volumes/code/gsd-beads/src/adapter/_atomicWrite.mjs` (30 LOC) | exact — port + WR-05 fix |
| `tests/fixtures/build-seed.sh` | infra | infrastructure (bash) | `/Volumes/code/gsd-beads/tests/fixtures/build-seed.sh` (182 LOC) | exact — kept as-is per whitelist |

### Sibling-side — new authoring (12 files)

| New File | Role | Data Flow | Closest Analog | Match |
|----------|------|-----------|----------------|-------|
| `src/index.ts` (or `src/adapter.ts`) | adapter-compliance | stateful (class scaffold) | `adapters/markdown/index.ts:116-158` (class + capabilities + constructor) + sibling `src/adapter.mjs:21-96` (Object.assign mixin — REJECT: use regular class per Research alt) | dual (shape-from-fork, export-shape-from-sibling) |
| `src/primitives.ts` | adapter-compliance | stateful (Bin A + foundational methods) | sibling `src/adapter/primitives.mjs:68-589` (647-LOC dispatch body) + fork `adapters/markdown/index.ts:189-303` (fork-shape Bin A) | dual — bd behavior from sibling, method signatures from fork |
| `src/events.ts` | adapter-compliance | stateful (3 recordState families) | fork `adapters/markdown/index.ts:699-921` (three family methods with HelperResult → StateWriteOutcome) + sibling `src/adapter/primitives.mjs:366-420` (single `recordStateEvent` — SPLIT into 3) | role-match — split sibling into 3, adopt fork's outcome shape |
| `src/capabilities.ts` | adapter-compliance | pure (declarative) | fork `adapters/markdown/index.ts:121-130` (9-key Capabilities literal) | exact |
| `src/dep-graph.ts` | primitive | stateful (bd export → edge synthesis) | sibling `.planning/spikes/014-bd-blocks-sibling-deps/SPIKE.md` (conceptual) + RESEARCH.md §Pattern 4 (Example) | no-analog — new; use RESEARCH example 4 |
| `src/txn/<A\|B\|C>.ts` (1-2 files, post-spike) | adapter-compliance | stateful (transaction lifecycle) | **Outcome A:** fork `adapters/markdown/index.ts:522-638` (in-memory shadow-dir + _commitShadowDir); **Outcome B:** same (shadow-dir journal 1:1 architectural match); **Outcome C:** sibling `src/adapter/primitives.mjs:435-494` (snapshot/restore via bd export + bd init --from-jsonl) | role-match (depends on spike) |
| `src/init.ts` | adapter-compliance | stateful (probe) | sibling `src/adapter.mjs:37-48` (`_ensureBd()` lazy probe) + RESEARCH.md Example 2 (`BdManagedMismatchError` shape) | dual |
| `package.json` | config | infrastructure | sibling `/Volumes/code/gsd-beads/package.json` (archived) — preserves `type: module`, `exports` shape, `peerDependencies` — but edits per D-TECH-STACK (add `file:../get-shit-done` devDep, drop `node --test` scripts, use `vitest`) | role-match |
| `tsconfig.json` | config | infrastructure | fork `adapters/tsconfig.json` (24 LOC) | exact — extend fork's strict TS config |
| `vitest.config.ts` | config | infrastructure | fork `adapters/vitest.config.ts` (14 LOC) | exact |
| `README.md` / `CLAUDE.md` / `CONTRIBUTING.md` | docs | infrastructure | fork `./CLAUDE.md` (project-instructions shape); sibling archived versions | role-match — wholesale rewrite for v1.0 shape |

### Sibling-side — new test files (11 files, all new post-reset)

| New Test File | Role | Data Flow | Closest Analog | Match |
|----------|------|-----------|----------------|-------|
| `tests/conformance.test.ts` | test | integration | fork `tests/conformance/markdown.conformance.test.ts` (7 LOC — 2-line invocation shape) | exact |
| `tests/fixture.ts` | test-infra | integration (bd init + chmod) | sibling archived `tests/conformance/fixture.mjs:setupFreshAdapter` (skill conformance.md:115 reference) + `build-seed.sh` (bd init args + BEADS_ACTOR=seed) | role-match |
| `tests/smoke/init.test.ts` | test | integration | fork `tests/conformance/binary-asset.test.ts:1-36` (describe/beforeEach/afterEach shape) | pattern-match |
| `tests/smoke/binary-asset.test.ts` | test | integration | fork `tests/conformance/binary-asset.test.ts:46-60` (capability-lint + UnsupportedCapabilityError throw) | exact |
| `tests/smoke/record-primitives.test.ts` | test | integration | fork `tests/conformance/adapter.conformance.ts:44-82` (Bin A getRecord/stat shape) | pattern-match |
| `tests/smoke/format.test.ts` | test | pure-fn unit | sibling archived `tests/unit/phase-format/*.test.mjs` (11 fixture corpus) | pattern-match |
| `tests/smoke/section-primitives.test.ts` | test | integration | fork `tests/conformance/section-depth.test.ts` (section walker shape) | pattern-match |
| `tests/smoke/frontmatter-primitives.test.ts` | test | integration | fork `tests/conformance/adapter.conformance.ts:44-82` | pattern-match |
| `tests/smoke/transaction.test.ts` | test | integration | fork `tests/conformance/write-transaction.test.ts` | exact |
| `tests/smoke/commit-planning-state.test.ts` | test | integration | fork `tests/conformance/commit-planning-state.test.ts` | exact |
| `tests/smoke/state-events-{append,mutation,signal}.test.ts` × 3 | test | integration | fork `tests/conformance/write-outcome.test.ts` (454 LOC; 16-case matrix) | exact |
| `tests/smoke/named-doc.test.ts` | test | integration | fork `tests/conformance/named-doc.test.ts` | exact |
| `tests/smoke/dep-graph.test.ts` | test | integration | none (new); assert shape from RESEARCH §Pattern 4 | no-analog |

## Pattern Assignments

Each entry below shows the **concrete snippet** to copy or mirror. Entries are grouped by analog so repeated patterns reference the same block.

---

### `package.json` (fork, modify) — add `./conformance` subpath export

**Current shape** (`/Volumes/code/get-shit-done/package.json:7-24`): has a `"files"` whitelist but no `"exports"` map. Must ADD an `"exports"` block that keeps default main unchanged AND adds `./conformance`.

**Target addition** (sketch — exact path adjusts after TS emit config check per Pitfall 5):
```jsonc
{
  // ... existing fields ...
  "exports": {
    ".": "./get-shit-done/index.js",                   // preserve existing main entry if declared
    "./conformance": "./tests/conformance/adapter.conformance.js", // D-CONFORM-EXPORT
    "./package.json": "./package.json"
  }
}
```

**Landmine / Pitfall 5:** TS emit for `tests/conformance/*.ts` is not currently produced by fork's build. Verify emit path (likely `./adapters/dist/tests/conformance/adapter.conformance.js` after extending `adapters/tsconfig.json` `include`, or a new top-level tsconfig) BEFORE declaring the export. Smoke-test with `node -e "import('get-shit-done/conformance').then(m => console.log(Object.keys(m)))"` from a tmp dir.

---

### `adapters/types.ts` (fork, modify) — extend `Capabilities` with `graphEdges`

**Current block** (`adapters/types.ts:54-65`):
```ts
export interface Capabilities {
  record: true;
  section: true;
  frontmatter: true;
  binaryAsset: boolean;
  snapshot: boolean;
  transaction: boolean;
  namedDoc: boolean;
  markdownLockfile: boolean;
}
```

**Target addition** (D-OQ06-CAPS — additive only; all existing MarkdownAdapter and test code compiles unchanged until the adapter literal is extended in the next file):
```ts
export interface Capabilities {
  record: true;
  section: true;
  frontmatter: true;
  binaryAsset: boolean;
  snapshot: boolean;
  transaction: boolean;
  namedDoc: boolean;
  markdownLockfile: boolean;
  graphEdges: { semantic: boolean; dependency: boolean };  // NEW — D-OQ06-CAPS
}
```

**Type guard companion (optional — Claude's discretion):** `hasGraphDependencyEdges(a)` / `hasGraphSemanticEdges(a)` mirroring `hasBinaryAsset` at `types.ts:145-147`.

---

### `adapters/markdown/index.ts` (fork, modify) — declare graphEdges on MarkdownAdapter

**Current literal** (`adapters/markdown/index.ts:121-130`):
```ts
readonly capabilities: Capabilities = {
  record: true,
  section: true,
  frontmatter: true,
  binaryAsset: true,
  snapshot: true,
  transaction: true,
  namedDoc: true,
  markdownLockfile: true,
};
```

**Target addition** — add one line:
```ts
readonly capabilities: Capabilities = {
  record: true,
  section: true,
  frontmatter: true,
  binaryAsset: true,
  snapshot: true,
  transaction: true,
  namedDoc: true,
  markdownLockfile: true,
  graphEdges: { semantic: true, dependency: false },  // D-OQ06 — MarkdownAdapter owns semantic edges via graphify.cjs
};
```

No other MarkdownAdapter behavior change. Fork's existing conformance tests (`tests/conformance/markdown.conformance.test.ts`, `write-outcome.test.ts`) still pass because graphEdges is not exercised.

---

### `src/bd/findRoot.ts` — PORT from `src/bd/findRoot.mjs` (68 LOC, 4 topology cases)

**Source signature** (sibling `findRoot.mjs:22`):
```js
export function findBeadsRoot(start) { ... }   // returns string | null
```

**Target signature** (TS):
```ts
import { existsSync, realpathSync, statSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

export function findBeadsRoot(start: string): string | null {
  // Port body verbatim from findRoot.mjs:22-67 — the 4 topology cases
  // (BEADS_DIR env / parent-walk / .git-as-file worktree / regular git repo)
  // are load-bearing. Do NOT simplify.
}
```

**Amendments during port:** NONE. Direct port. The `git mv findRoot.mjs findRoot.ts` → in-place edit discipline preserves `git log --follow` per RESEARCH Open Question #5.

---

### `src/bd/helper.ts` — PORT from `src/bd/helper.mjs` (65 LOC) + Landmine 3/4 fixes

**Source signature** (sibling `helper.mjs:21`):
```js
export function bd(args, { cwd, parseJson = true } = {}) { ... }
```

**Current bug** (`helper.mjs:22`): `spawnSync('bd', args, { cwd, encoding: 'utf-8' })` — `env` is NOT threaded, even if caller passes `opts.env`. Primitives work around by passing `env` explicitly and relying on `process.env` inheritance when omitted. Landmine 4.

**Target shape (adapter-context-bound wrapper per RESEARCH Pattern 2):**
```ts
import { spawnSync } from 'node:child_process';
import { BeadsNotInstalled, BeadsCorrupt, BeadsEmpty } from './errors.js';

export class BdRunner {
  constructor(
    private readonly cwd: string,                                 // baked — Landmine 3 fix
    private readonly baseEnv: NodeJS.ProcessEnv = { ...process.env, BEADS_ACTOR: 'seed' },  // Landmine 11
  ) {}

  run(args: string[], opts?: { parseJson?: boolean; env?: Record<string, string> }): unknown {
    const env = { ...this.baseEnv, ...opts?.env };                // Landmine 4 fix — forward env
    const result = spawnSync('bd', args, { cwd: this.cwd, env, encoding: 'utf-8' });
    // ... port JSONL-fallback + sentinel dispatch verbatim from helper.mjs:24-63
  }

  show(id: string): Record<string, unknown> {
    const r = this.run(['show', id, '--json']);
    return Array.isArray(r) ? r[0] : (r as Record<string, unknown>);  // Landmine 5
  }
}
```

**Sibling's error-detection blocks to port VERBATIM:** `helper.mjs:24-35` (ENOENT → BeadsNotInstalled; stderr regex → BeadsCorrupt), `helper.mjs:41-56` (JSONL fallback), `helper.mjs:58-61` (`{error, schema_version}` → BeadsEmpty). These encode Landmines 6/7/8.

---

### `src/bd/errors.ts` — PORT from `src/bd/errors.mjs` (73 LOC) + add `BdManagedMismatchError`

**Source** (`errors.mjs:10-73`): `BeadsCause` enum; `BeadsUnavailableError` base + 5 subclasses (`BeadsNotInstalled`, `BeadsCorrupt`, `BeadsVersionMismatch`, `BeadsEmpty`, `UnsupportedOperationError`).

**Port shape** (TS — direct translation; each class keeps `this.name = '...'` for cross-module `instanceof` fallback):
```ts
export const BeadsCause = Object.freeze({
  NotInstalled: 'not-installed', Corrupt: 'corrupt', VersionMismatch: 'version-mismatch',
  Empty: 'empty', Unknown: 'unknown', Unsupported: 'unsupported',
} as const);
export type BeadsCauseValue = typeof BeadsCause[keyof typeof BeadsCause];

export class BeadsUnavailableError extends Error {
  override readonly name: string = 'BeadsUnavailableError';
  readonly cause: BeadsCauseValue;
  readonly originalError?: Error;
  constructor(message: string, opts?: { cause?: BeadsCauseValue; originalError?: Error }) { ... }
}
// 5 subclasses follow same pattern as errors.mjs:30-73
```

**NEW class `BdManagedMismatchError`** (D-INIT-ERR; mirrors fork's `UnsupportedCapabilityError` shape at `types.ts:123-142`):
```ts
export class BdManagedMismatchError extends Error {
  override readonly name = 'BdManagedMismatchError';
  readonly code = 'PROJECT_BD_MANAGED_MISMATCH' as const;
  readonly projectDir: string;
  readonly hint: string;
  readonly __brand = 'BdManagedMismatchError' as const;         // cross-module instanceof per types.ts:128

  constructor(projectDir: string, hint: string) {
    super(`Project directory '${projectDir}' is not bd-managed. ${hint}`);
    this.projectDir = projectDir;
    this.hint = hint;
  }

  static [Symbol.hasInstance](instance: unknown): boolean {     // mirrors types.ts:135-141
    return instance != null && typeof instance === 'object' &&
      (instance as Record<string, unknown>).__brand === 'BdManagedMismatchError';
  }
}
```

**Delete `UnsupportedOperationError`** (`errors.mjs:58-73`) — BeadsAdapter uses fork's `UnsupportedCapabilityError` (imported from `get-shit-done`) per D-BINARY. Leave a comment breadcrumb explaining the replacement.

---

### `src/helpers/parsePhaseId.ts` (and `deriveDiskStatus.ts`, `loadMilestoneHeading.ts`) — trivial direct ports

**`parsePhaseId.mjs:14-17`** (port target):
```js
export function parsePhaseId(label) {
  if (!label) return null;
  return label.replace(/^phase-id:/, '').replace(/^0+(\d)/, '$1');
}
```

Target TS: `export function parsePhaseId(label: string | null | undefined): string | null { ... }`.

**`deriveDiskStatus.mjs:16-24`** — 7-branch priority chain. Port signature:
```ts
export function deriveDiskStatus(opts: {
  planCount: number; summaryCount: number;
  hasContext: boolean; hasResearch: boolean; dirExists: boolean;
}): 'complete'|'partial'|'planned'|'researched'|'discussed'|'empty'|'no_directory' { ... }
```

**`loadMilestoneHeading.mjs:17-25`** — key-lookup + stderr fallback. Port with `Record<string,string>` input.

No landmine fixes; all three pure-fn.

---

### `src/helpers/detectDrift.ts` — direct port with stderr side-effect preserved

**Source signature** (`detectDrift.mjs:25`):
```js
export function detectDrift(phase, bdState, diskState) { ... }
```

**TS target**:
```ts
interface BdState { plan_count: number; summary_count: number; bd_status: string }
interface DiskState { disk_plan_count: number; disk_summary_count: number }
interface DriftEntry { phase: string; kind: 'plan_count'|'summary_count'|'closed_without_summary'; bd_value: number|string; disk_value: number }

export function detectDrift(phase: string, bdState: BdState, diskState: DiskState): DriftEntry[] { ... }
```

Preserve `console.error(...)` calls verbatim (`detectDrift.mjs:28,32,36`) — drift events are dual-channel (stderr + return array) by contract.

---

### `src/format/phase.ts` — PORT from `src/format/phase.mjs` (251 LOC; idempotency contract)

**Source exports** (`phase.mjs:34,50,97,217`): `parsePhaseTitle`, `formatPhaseTitle`, `parsePhaseDescription`, `formatPhaseDescription`.

**Idempotency contract** (phase.mjs:5 D-15): `parse(format(parse(x))) === parse(x)` — NOT byte-equality. Format() may normalize whitespace, label style, blank-line conventions. Port preserves this.

**Regex triplet to carry verbatim** (phase.mjs:25, 73-74, 80, 83):
```ts
const TITLE_RE = /^Phase\s+(\d+(?:\.\d+)?)\s*:\s*(.+?)\s*$/;
const LABEL_RE = /^\*\*([A-Za-z][A-Za-z ]*?)(?:\*\*\s*(?:\([^)]*\)\s*)?:|\:\s*\*\*)\s*(.*)$/;
const TAIL_RE = /^\s*\*\*Plans\b/;
const SC_ITEM_RE = /^\s*(\d+)\.\s+(.*)$/;
```

**Target signatures** (TS):
```ts
export function parsePhaseTitle(line: string): { number: string; name: string };
export function formatPhaseTitle(parsed: { number: string; name: string }): string;
export interface PhaseDescription { goal: string; depends_on: string; requirements: string; success_criteria: string[]; tail: string; }
export function parsePhaseDescription(body: string): PhaseDescription;
export function formatPhaseDescription(parsed: PhaseDescription): string;
```

**Fixture corpus:** sibling's `tests/unit/fixtures/phase-format/` (11 files, RESEARCH-cited); re-host under `tests/smoke/format.fixtures/` if porting the unit tests; otherwise test idempotency via property-style.

---

### `src/format/section.ts` — PORT from `src/format/section.mjs` (130 LOC)

**Source exports** (`section.mjs:21,51,106`): `slugify`, `locateSection`, `rewriteSection`.

**Port in full.** TS signatures:
```ts
export function slugify(text: string): string;
export interface SectionLoc { headingLine: number; headingLevel: number; bodyStart: number; bodyEnd: number; bodyText: string; }
export function locateSection(text: string, anchor: string): SectionLoc | null;
export function rewriteSection(text: string, anchor: string, body: string, mode: 'overwrite'|'append'|'prepend'): string;
```

**Code-fence guard** (`section.mjs:36,60-63,80-82`) is load-bearing — preserves `inFence` boolean across heading scan. Do not replace with simpler regex.

---

### `src/format/frontmatter.ts` — PORT from `src/format/frontmatter.mjs` (107 LOC)

**Source exports** (`frontmatter.mjs:24,79,104`): `parseFrontmatter`, `formatFrontmatter`, `mergeFrontmatter`.

**Regex** (`frontmatter.mjs:16`):
```ts
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
```

**TS signatures**:
```ts
type FrontmatterValue = string | number | boolean | null | string[];
export function parseFrontmatter(text: string): { frontmatter: Record<string, FrontmatterValue>; body: string };
export function formatFrontmatter(fm: Record<string, FrontmatterValue> | null | undefined, body: string): string;
export function mergeFrontmatter(base: Record<string, unknown> | null, patch: Record<string, unknown> | null): Record<string, unknown>;
```

**Conditional escalation (D-SCAFFOLD):** If a `.planning/` file in fork's corpus has nested-object frontmatter (e.g., `must_haves:\n  truths: [...]`), swap to `js-yaml@4.1.1` during port. Scan fork `.planning/**/*.md` for nesting BEFORE authoring the hand-rolled port.

---

### `src/paths.ts` — PORT from `src/adapter/pathRouter.mjs` (97 LOC) + fork canonical-file extension

**Source shape** (`pathRouter.mjs:37-97`): 7 patterns (static singletons, plan, collections, named-doc) + fall-through `{kind: 'opaque', tier: 'disk'}`.

**Port signature**:
```ts
export type Tier = 'bd' | 'disk' | 'hybrid';
export interface Route { kind: string; tier: Tier; label?: string; singleton?: boolean; collection?: boolean; phase?: string; plan?: string; category?: string; key?: string; }
export function resolve(path: string): Route;
export const NAMED_DOC_CATEGORIES: readonly string[];
```

**Amendments during port (fork-specific extensions):**
1. Align `NAMED_DOC_CATEGORIES` with fork's closed union (`adapters/types.ts:15-23`: `'research'|'intel'|'codebase'|'archived-milestone'|'reports'|'sketches'|'tmp'|'root'`). Sibling's list (`pathRouter.mjs:17-25`: intel, codebase, research, archived-milestone, debug-knowledge-base, learnings, methodology, discussion-log, discovery) diverges — replace with fork's.
2. Add `root`-category handling per fork D-14 (`RootNamedDocKey = 'HANDOFF'|'CONTINUE-HERE'|'DECISIONS-INDEX'`).
3. **Resolve CR-02 BLOCKER hybrid tier:** sibling's `pathRouter.mjs:76` emits `tier: 'hybrid'` for named-docs, but putRecord (sibling `primitives.mjs:104-119`) throws on bd-tier without any dispatch for hybrid — writes fall through to disk bypassing the dual-write D-10 contract. Per Landmine 2: either delete `'hybrid'` tier and route named-docs to `'disk'` (with separate bd-memory index as a post-write step inside the adapter method), OR force hybrid paths through a named-doc-specific dispatcher. Planner's call.
4. Extend `PATTERNS` for fork canonical files not present in sibling list — consult `.planning/` directory scan (REQUIREMENTS, DECISIONS, PROJECT, STATE singletons, `phases/*/PLAN.md`, `summaries/`, etc.).

**Path-traversal guard (Landmine 1 / CR-01 BLOCKER):** Router itself is not the enforcement point; `_abs(adapter, path)` in the adapter method body must reject `..` / absolute / symlink-escape. Port once at `primitives.ts:64` equivalent with `startsWith(resolve(projectRoot) + sep)` guard + throw `TypeError` on violation.

---

### `src/_atomicWrite.ts` — PORT from `src/adapter/_atomicWrite.mjs` (30 LOC) + WR-05 fix

**Current body** (`_atomicWrite.mjs:20-29`):
```js
export function atomicWriteFile(absPath, body) {
  const dir = dirname(absPath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = resolve(dir, `.${basename(absPath)}.tmp.${process.pid}.${Date.now()}`);
  writeFileSync(tmpPath, body);
  renameSync(tmpPath, absPath);
}
```

**Landmine 15 / WR-05:** `${process.pid}.${Date.now()}` collides under concurrent ms-resolution writers.

**Fixed TS target:**
```ts
import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { randomBytes } from 'node:crypto';

export function atomicWriteFile(absPath: string, body: string | Buffer): void {
  const dir = dirname(absPath);
  mkdirSync(dir, { recursive: true });
  const suffix = `${process.pid}.${randomBytes(6).toString('hex')}`;   // WR-05 fix
  const tmpPath = resolve(dir, `.${basename(absPath)}.tmp.${suffix}`);
  writeFileSync(tmpPath, body);
  renameSync(tmpPath, absPath);                                         // POSIX-atomic (same-dir rename)
}
```

Alternative: `open(...O_EXCL | O_CREAT, ...)` loop. `randomBytes` is simpler and matches sibling conventions.

---

### `tests/fixtures/build-seed.sh` — kept as `.sh` per whitelist

`build-seed.sh` is byte-preserved. No port. Regenerates `seed.jsonl` with `BEADS_ACTOR=seed` discipline (Landmine 11). Milestone bead creation (`build-seed.sh:103-119`) is the substrate for `recordStateAppend` COMMENT_EVENT_TYPES dispatch — milestone beads labeled `gsd:milestone` + `version:<v>` are required for `_resolveMilestoneBead` lookup in primitives.

---

### `src/index.ts` (or `src/adapter.ts`) — NEW BeadsAdapter class scaffold

**Export-shape analog** (sibling `src/adapter.mjs:21-96`) — preserve dual class + default export shape per D-RUNTIME-RESOLUTION:
```ts
export class BeadsAdapter implements StorageAdapter {
  readonly name = 'beads' as const;
  readonly capabilities: Capabilities;   // imported from ./capabilities

  constructor(public readonly projectRoot: string) {
    if (typeof projectRoot !== 'string' || projectRoot.length === 0) {
      throw new TypeError('BeadsAdapter: projectRoot must be a non-empty string');
    }
  }
  // method bodies imported from ./primitives, ./events, ./init, ./dep-graph (planner's decomposition)
}
export default BeadsAdapter;
```

**DIVERGENCE from sibling:** Sibling uses `Object.assign(prototype, cluster1, cluster2, ...)` mixin (`adapter.mjs:84-94`) across 8 `.mjs` cluster files (discussTodos/initBundlers/longTail/etc.). **REJECT the mixin pattern** per RESEARCH §"Alternatives Considered" — fork's surface is only 22 methods; regular class with method bodies imported from a small number of modules (primitives.ts, events.ts, init.ts, dep-graph.ts) is simpler and TS-friendlier. Sibling's 7 of 8 cluster files are domain-logic (addPhase, etc.) that DO NOT carry forward per Phase 3 D-04 "adapter stays thin."

**Class-body shape analog** — fork `adapters/markdown/index.ts:116-187` (constructor + resolve helpers). Constructor is sync per Phase 1 D-03. `_ensureBd()` is lazy per sibling D-02.

---

### `src/primitives.ts` — NEW; Bin A + foundational method bodies

**Dominant analog:** sibling `src/adapter/primitives.mjs:68-589` (647 LOC). This file **is** the port's intellectual target — it contains every bd-routed primitive behavior already hardened against bd v1.0.3 through 71 conformance tests.

**Key sibling patterns to carry (each with explicit line refs):**

1. **Router-first dispatch** (primitives.mjs:73-102 for `getRecord`):
   ```js
   const route = routerResolve(path);
   if (route.tier === 'bd') {
     this._ensureBd();
     const items = bd(['list', '-l', route.label, '--json', '--all', '-n', '0'], { cwd: this._beadsRoot });
     if (route.singleton) return Array.isArray(items) && items.length ? items[0] : null;
     throw new Error(...);
   }
   // disk-routed fallthrough
   const abs = _abs(this, path);
   if (!existsSync(abs)) return null;
   return readFileSync(abs, 'utf-8');
   ```
   Port as-is to TS. Replace `bd(...)` with `this._bd.run(...)` (BdRunner instance per RESEARCH Pattern 2).

2. **`bd list` args canonical** (primitives.mjs:83,146,188,211,234,264,296 — 7 call sites): always `['list', '-l', route.label, '--json', '--all', '-n', '0']`. The `--all` is Landmine 1 fix (default excludes closed issues); `-n 0` is Landmine "50-row default limit." Do not drop either.

3. **BEADS_ACTOR=seed on every write-side bd call** (primitives.mjs:245,309,316,397,412,441,487,541). Sibling passes explicit `env: { ...process.env, BEADS_ACTOR: 'seed' }` per call; the BdRunner adapter-context pattern (RESEARCH Pattern 2) bakes this into the base env, eliminating per-call discipline.

4. **Array-unwrap on `bd show`** (RESEARCH Pattern 2; not in primitives.mjs — sibling never called `bd show` because `bd list -l <label> --json` returns an array directly). The BdRunner's `show(id)` helper owns this.

5. **`_abs(adapter, path)` — MUST ADD path-traversal guard** (primitives.mjs:64-66 current is unguarded — CR-01 BLOCKER). Port with guard:
   ```ts
   function _abs(adapter: BeadsAdapter, path: string): string {
     const abs = pathResolve(adapter.projectRoot, path);
     const root = pathResolve(adapter.projectRoot);
     if (!abs.startsWith(root + pathSep) && abs !== root) {
       throw new TypeError(`BeadsAdapter: path '${path}' escapes projectRoot`);
     }
     return abs;
   }
   ```

6. **`putRecord` refuses bd-tier writes** (primitives.mjs:104-119): only Bin B domain methods write bd; generic putRecord throws on bd-tier. Fork's contract expects consumers to only call putRecord on disk paths. Port as-is; handle CR-02 hybrid tier per `src/paths.ts` amendment.

7. **`updateSection` round-trip for bd paths** (primitives.mjs:226-255): `bd list` → description body → `rewriteSection(text, anchor, body, mode)` (from format/section) → `bd update <id> --description <newText>`. 2 spawns; within budget.

8. **`_labelsToFrontmatter`** (primitives.mjs:610-622): converts `bd` issue labels (`key:value` or bare) into flat frontmatter object, hyphens-to-underscores on key. This is the D-MAPPING Outcome-B materializer — port verbatim.

9. **`_resolveMilestoneBead`** (primitives.mjs:632-647): `bd list -l gsd:milestone -l version:<v> --json --all -n 0` → `items[0].id`. Required for COMMENT_EVENT_TYPES dispatch.

10. **`snapshot` / `restore`** (primitives.mjs:435-494): IF txn spike outcome = C. Landmine 12 WR-04 fix: derive `--prefix` from snapshot metadata (e.g., first issue's id prefix via regex) instead of hardcoded `'sd'`.

**NEW methods to author from scratch (not in sibling):** `stat`, `removeCollection`. Per RESEARCH Pitfall 8:
- `stat(path)` — disk-tier: `fs.stat` + `{kind: 'file'|'dir', mtime: st.mtime.toISOString()}`. bd-tier: `bd show <resolved-id>` + array-unwrap + `{kind: 'file'}`. Null on miss.
- `removeCollection(prefix)` — disk-tier: `fs.rm(path, {recursive, force})`. bd-tier: `listCollection` + per-issue `bd delete`. Check bd v1.0.3 for `bd delete --cascade` primitive in Plan 06-03 spike (RESEARCH Open Question #2).

**Methods that can DELEGATE to MarkdownAdapter-style body** (disk-tier paths mirror `adapters/markdown/index.ts:191-303` line-for-line): plan/opaque/root named-doc reads and writes.

---

### `src/events.ts` — NEW; 3 `recordState*` family methods returning `StateWriteOutcome`

**Split sibling's single method into 3 families.** Sibling's monolithic `recordStateEvent({type, payload})` (primitives.mjs:366-420) dispatches memory vs comment based on a `type`-presence check in `MEMORY_EVENT_TYPES` / `COMMENT_EVENT_TYPES` sets (primitives.mjs:36-50). Return shape is `{storage, key}` or `{storage, bead, author}` — **informational, NOT StateWriteOutcome**.

**Target: 3 methods, each returning `Promise<StateWriteOutcome>`.** Shape per fork `adapters/markdown/index.ts:699-921`:

```ts
async recordStateAppend(event: AppendEvent): Promise<StateWriteOutcome> {
  return this.withTransaction(async () => {
    const bd = await this._ensureBd();
    switch (event.type) {
      case 'session':
      case 'quick_task':
      case 'forensic_session': {
        // High-frequency → bd comments add --author gsd:event:<type> (Landmine 4 — --author, NOT --label)
        const milestoneBead = await _resolveMilestoneBead(this);
        const existing = bd.run(['comments', milestoneBead, '--json']) as Array<{ author: string; text: string }>;
        const dupe = existing.find(c => c.author === `gsd:event:${event.type}` && _payloadMatches(JSON.parse(c.text), event.payload));
        if (dupe) return { applied: false, reason: 'duplicate' };
        bd.run(['comments', 'add', milestoneBead, '--author', `gsd:event:${event.type}`, JSON.stringify(event.payload)]);
        return { applied: true };
      }
      case 'decision':
      case 'metric':
      case 'roadmap_evolution': {
        // Low-frequency → bd remember <json> --key <milestone>:<type>:<id>
        const key = `${this._currentMilestone()}:${event.type}:${_deriveId(event.payload)}`;
        const existing = bd.run(['recall', key], { parseJson: false });
        if (existing !== null) return { applied: false, reason: 'duplicate' };
        bd.run(['remember', JSON.stringify(event.payload), '--key', key], { parseJson: false });
        return { applied: true };
      }
      default: {
        const _: never = event;
        throw new Error(`unhandled AppendEvent: ${(event as { type: string }).type}`);
      }
    }
  });
}
```

**`recordStateMutation`** — blocker_added / blocker_resolved / todo_count_update / deferred_items. Per D-MAPPING outcome:
- Outcome A (sub-records): mutate sub-record arrays on the milestone issue.
- Outcome B (labels-first): label add/remove OR memory-key update.

**`recordStateSignal`** — waiting / resume. Same Outcome-A-vs-B split. Sibling did not implement these; authoring from scratch with the fork MarkdownAdapter shape at `adapters/markdown/index.ts:889-921` as structural reference.

**Pitfall 7 handling (`created_section` in Outcome B):** BeadsAdapter's labels-first model has no discrete sub-record to scaffold. Return `{ applied: true }` bare in every case — NEVER emit `created_section`. Document as ADR inside Plan 06-06. Update write-outcome conformance for BeadsAdapter to accept bare on cases where MarkdownAdapter scaffolds.

**Import union types from fork:** `import type { AppendEvent, MutationEvent, SignalEvent } from 'get-shit-done/adapters/state-event-types.js'` (exact import path depends on fork's emit). Fork's `state-event-types.ts` (105 LOC, read above) lists 6 AppendEvent types, 4 MutationEvent types, 2 SignalEvent types — exhaustive dispatch enforced at compile time via `never` check.

---

### `src/capabilities.ts` — NEW; `Capabilities` declaration

**Analog:** fork `adapters/markdown/index.ts:121-130` (exact shape).

**Target BeadsAdapter literal:**
```ts
import type { Capabilities } from 'get-shit-done/adapters/types.js';

export const beadsCapabilities: Capabilities = Object.freeze({
  record: true,
  section: true,
  frontmatter: true,
  binaryAsset: false,                                  // D-BINARY
  snapshot: /* true for Outcome B or C, false for A */,
  transaction: true,                                   // D-TXN-CAPS all outcomes
  namedDoc: true,
  markdownLockfile: false,                             // bd is not markdown-lockfile
  graphEdges: { semantic: false, dependency: true },   // D-OQ06
});
```

Freeze per Phase-1 D-08 precedent. Declare `as const` on inner `graphEdges` if strict literal types matter.

---

### `src/dep-graph.ts` — NEW; dep-edge synthesizer

**No direct sibling analog.** Conceptual basis: sibling `.planning/spikes/014-bd-blocks-sibling-deps/SPIKE.md` (VALIDATED: `bd dep add` default type is `blocks`; field name in `bd export --json` is `type`; `depends_on_id` is blocker direction; cascade-loop ignores blocks edges).

**Target shape** (RESEARCH §Pattern 4 worked example):
```ts
export async function materializeGraphJson(bd: BdRunner, adapter: BeadsAdapter): Promise<string> {
  const beads = bd.run(['export', '--json']) as Array<{
    _type: string; id: string;
    dependencies?: Array<{ depends_on_id: string; type: string }>;
  }>;
  const issues = beads.filter(b => b._type === 'issue');
  const depEdges = issues.flatMap(issue =>
    (issue.dependencies ?? [])
      .filter(d => d.type === 'blocks')                                // spike-014: field is `type`, value `blocks`
      .map(d => ({
        from: d.depends_on_id,                                          // blocker direction
        to: issue.id,
        type: 'dependency' as const,
        confidence: 1.0,
      }))
  );
  const existing = await adapter._diskGetRecord('graphs/graph.json');
  const existingGraph = existing ? JSON.parse(existing) : { edges: [] };
  const semanticEdges = (existingGraph.edges ?? []).filter((e: { type: string }) => e.type === 'semantic');
  return JSON.stringify({ ...existingGraph, edges: [...semanticEdges, ...depEdges] });
}
```

**Invocation point:** special-case `getRecord('graphs/graph.json')` in `primitives.ts` at the top of the method body (before router dispatch). Lazy-with-memoization-within-txn is recommended (RESEARCH Pattern 4 "Claude's discretion" note).

---

### `src/txn/<A|B|C>.ts` — NEW; withTransaction implementation (post-spike)

Implementation path decided by Plan 06-01 spike. Three outcomes, three analogs:

**Outcome A (in-memory write buffer).** ~150 LOC. Analog: fork's `adapters/markdown/index.ts:522-561` (withTransaction top-level) — but without shadow-dir writes; instead, a `mutations: Array<BdWrite>` buffer; reads merge buffer-over-bd; commit replays sequentially; rollback discards. `capabilities.snapshot: false`.

**Outcome B (staging bd store + bead-hash bookmark cutover).** Analog: fork `adapters/markdown/index.ts:522-638` — architecturally 1:1. Shadow-dir → staging bd store; `_commitShadowDir` → bookmark swap; `rm -rf tmpDir` → drop staging store. Copy:
- Lock acquire (`adapters/markdown/index.ts:563-598`): `.adapter.lock` with `O_EXCL | O_CREAT | O_WRONLY`; 10 retries, 200ms + jitter; PID-staleness check via `process.kill(pid, 0)`.
- Reentrant join (`adapters/markdown/index.ts:523-532`): `this.activeTxn.depth++`; no new lock.
- Staging dir allocation (line 538): `mkdtemp(join(planningBase, '.tmp-txn-'))` → substitute `mkdtemp(join(beadsRoot, '.tmp-txn-bd-'))` with bd-store clone.
- Commit pass (line 614-638): apply removes first, then writes sorted parent-first via `rename`.
- Rollback in `finally` (line 554-559): `rm(tmpDir, {recursive: true, force: true})`.

**Outcome C (file-snapshot restore).** Analog: sibling `src/adapter/primitives.mjs:435-494`. Port `snapshot()` (435-445) and `restore()` (463-494). Apply Landmine 12 fix (derive `--prefix` from snapshot — examine first issue id's prefix via regex). POSIX atomic via `fs-level .beads/ directory rename`. 400-700ms cold-start per rollback accepted. `capabilities.snapshot: true`.

**All three outcomes:** `capabilities.transaction: true` per D-TXN-CAPS.

---

### `src/init.ts` — NEW; BeadsAdapter init / lazy `_ensureBd()`

**Primary analog:** sibling `src/adapter.mjs:37-48`:
```js
_ensureBd() {
  if (this._beadsValidated) return this._beadsRoot;
  const root = findBeadsRoot(this.projectRoot);
  if (!root) throw new BeadsEmpty('BeadsAdapter: project at ' + this.projectRoot + ' is not bd-managed');
  this._beadsRoot = root;
  this._beadsValidated = true;
  return root;
}
```

**TS port + D-INIT-ERR error class swap** — replace `BeadsEmpty` with `BdManagedMismatchError`:
```ts
async _ensureBd(): Promise<BdRunner> {
  if (this._bd) return this._bd;
  const root = findBeadsRoot(this.projectRoot);
  if (!root) {
    throw new BdManagedMismatchError(this.projectRoot,
      'Expected .beads/metadata.json at or above projectRoot. Run `bd init` or set BEADS_DIR.');
  }
  this._beadsRoot = root;
  this._bd = new BdRunner(root);                                // bakes cwd + BEADS_ACTOR=seed (RESEARCH Pattern 2)
  return this._bd;
}
```

**Harness-compatibility open question (RESEARCH §Open Questions #1, Pitfall 5 + A3):** fork's harness does `mkdtemp + mkdir .planning + new Adapter(tmpDir)` — it does NOT run `bd init`. BeadsAdapter's `_ensureBd()` must either (a) tolerate uninitialized bd and lazy-init from seed fixture, or (b) harness needs an adapter-provided fixture callback. Plan 06-07 resolves. Document whichever path ships.

---

### `package.json` (sibling, NEW post-reset)

**Analog:** archived `/Volumes/code/gsd-beads/package.json` (40 LOC).

**Preserve** (archived lines 2, 4, 5, 7-15, 19-25):
- `"name": "gsd-beads"` (unchanged; no rename)
- `"description"` (updated for v1.0 shape)
- `"type": "module"`
- `"exports"` map — add subpaths for ported modules' compiled JS (`.ts → .js` after emit)
- `"peerDependencies": { "get-shit-done-cc": "*" }` + `"peerDependenciesMeta"` (optional flag)

**Replace** (archived lines 6, 17, 27-31):
- `"main": "./src/adapter.mjs"` → `"main": "./dist/index.js"` (per tsconfig emit)
- `"engines.node": ">=20"` → `">=22"` (match fork)
- `"scripts"` — drop all `node --test` paths; new shape:
  ```json
  {
    "scripts": {
      "build": "tsc",
      "test": "vitest run",
      "test:unit": "vitest run tests/smoke",
      "test:conformance": "vitest run tests/conformance.test.ts"
    }
  }
  ```

**Add** (new per D-TECH-STACK):
- `"devDependencies": { "get-shit-done": "file:../get-shit-done", "vitest": "^4", "typescript": "^6", "@types/node": "^22" }` (conditional: add `js-yaml` + `@types/js-yaml` only if frontmatter escalation lands).

---

### `tsconfig.json` (sibling, NEW) — extends fork

**Analog:** fork `adapters/tsconfig.json` (24 LOC, above). Copy shape:
```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"],
  "exclude": ["**/*.test.ts", "vitest.config.ts", "dist", "node_modules"]
}
```

---

### `vitest.config.ts` (sibling, NEW)

**Analog:** fork `adapters/vitest.config.ts` (14 LOC, above).

**Target with sibling additions** (thread serialization for bd spawns — Dolt locks the bd store):
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'gsd-beads',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    // bd spawns serialize on dolt's exclusive write-lock; running parallel
    // vitest workers against a shared .beads/ causes Dolt deadlocks.
    // Force single-worker execution per .beads/ root.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 10_000,                                         // 400-700ms bd cold-start × several spawns per test
  },
});
```

---

### `README.md` / `CLAUDE.md` / `CONTRIBUTING.md` (sibling, NEW; wholesale rewrite)

**Analog:** fork `./CLAUDE.md` (project-instructions shape — branch strategy, upstream sync, sibling-repo callout). Archived sibling versions are shadow-era narrative; discard.

**Target content outlines:**
- `README.md`: one-paragraph pitch + installation (`npm i gsd-beads`) + usage (`new BeadsAdapter(projectDir)`) + D-TXN shipped variant (A/B/C) + D-MAPPING outcome (A/B) + capabilities rationale (`binaryAsset: false`; `graphEdges: {semantic: false, dependency: true}`) + `gsd:*` label namespace table + sidecar path-sniff map (per Phase 5 D-19) + export shape (`export class BeadsAdapter` + `export default`) + known limitations + bd v1.0.3 pin rationale.
- `CLAUDE.md`: mirror fork's shape. Declare two-repo model (sibling depends on fork via `file:../get-shit-done`). Branch strategy for sibling (`main` vs per-plan feature branches). Landmine summary (1-item per line pointing at `landmines.md` in skill).
- `CONTRIBUTING.md`: seed-regeneration protocol (`BEADS_ACTOR=seed`); bd pin policy; conformance-test-authoring conventions.

---

### `tests/conformance.test.ts` — NEW

**Exact analog:** fork `tests/conformance/markdown.conformance.test.ts` (7 LOC):
```ts
import { runAdapterConformanceSuite } from './adapter.conformance.js';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';

runAdapterConformanceSuite(
  'markdown',
  (projectDir) => new MarkdownAdapter(projectDir),
);
```

**Target shape** (RESEARCH Code Example 3):
```ts
import { runAdapterConformanceSuite } from 'get-shit-done/conformance';
import { BeadsAdapter } from '../src/index.js';
import { setupFreshAdapter } from './fixture.js';

runAdapterConformanceSuite('beads', (projectDir: string) => {
  // Either: construct BeadsAdapter that lazy-inits via _ensureBd (if bd seed
  // is acceptable to create on first method call). Or: wrap in setupFreshAdapter
  // pattern. Decided in Plan 06-07 per RESEARCH Open Q #1.
  return new BeadsAdapter(projectDir);
});
```

---

### `tests/fixture.ts` — NEW (shared bd-init-from-seed helper)

**Analog:** sibling archived `tests/conformance/fixture.mjs:setupFreshAdapter` (per skill `conformance.md:115`).

**Target shape:**
```ts
import { mkdtemp, mkdir, copyFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { BeadsAdapter } from '../src/index.js';

export async function setupFreshAdapter(): Promise<{ projectDir: string; adapter: BeadsAdapter }> {
  const projectDir = await mkdtemp(join(tmpdir(), 'gsd-beads-test-'));
  await mkdir(join(projectDir, '.planning'), { recursive: true });

  // git init — required by bd init's pre-check
  spawnSync('git', ['init', '-q'], { cwd: projectDir, stdio: 'ignore' });

  // bd init from committed seed.jsonl. BEADS_ACTOR=seed for byte-identity.
  await mkdir(join(projectDir, '.beads'), { recursive: true });
  await copyFile(
    join(__dirname, 'fixtures/seed.jsonl'),
    join(projectDir, '.beads/issues.jsonl'),
  );
  spawnSync('bd', [
    'init', '--from-jsonl', '--prefix', 'sd',
    '--non-interactive', '--skip-agents', '--skip-hooks', '--quiet',
  ], {
    cwd: projectDir,
    env: { ...process.env, BEADS_ACTOR: 'seed' },
    stdio: 'ignore',
  });
  await chmod(join(projectDir, '.beads'), 0o700);   // Landmine 9 — bd warns on wider modes

  return { projectDir, adapter: new BeadsAdapter(projectDir) };
}
```

Landmine 9 (`.beads/` 0o700), Landmine 11 (BEADS_ACTOR=seed), RESEARCH Pattern 5 (init flags) all encoded here.

---

### `tests/smoke/*.test.ts` (11 files) — NEW

**Dominant shape analog:** fork `tests/conformance/binary-asset.test.ts:1-36` (imports + describe/beforeEach/afterEach) and `tests/conformance/write-outcome.test.ts:31-72` (seedStateMd helper + per-outcome tests).

**Canonical shape for every smoke test:**
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm } from 'node:fs/promises';
import { setupFreshAdapter } from '../fixture.js';
import { BeadsAdapter } from '../../src/index.js';
import { BdManagedMismatchError } from '../../src/bd/errors.js';

describe('<bin-b-category> smoke (SC#3)', () => {
  let projectDir: string;
  let adapter: BeadsAdapter;

  beforeEach(async () => {
    ({ projectDir, adapter } = await setupFreshAdapter());
  });
  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('<behavior>', async () => {
    // exercise one primitive workflow per Bin B category
  });
});
```

**Per-file analogs and hooks:**

| File | Analog | Key patterns |
|------|--------|--------------|
| `init.test.ts` | findRoot.mjs's 4-case test table (archived) | 4 topology cases: bd-managed root, BEADS_DIR env, symlink, non-bd dir. Non-bd asserts `BdManagedMismatchError` with `code === 'PROJECT_BD_MANAGED_MISMATCH'`. |
| `binary-asset.test.ts` | fork `binary-asset.test.ts:46-60` | Assert `capabilities.binaryAsset === false`; `hasBinaryAsset(adapter) === false`; `writeBinaryAsset` throws `UnsupportedCapabilityError` (from fork). Port sibling's 4-test capability-lint. |
| `record-primitives.test.ts` | fork `adapter.conformance.ts:44-82` | Bin A: putRecord/getRecord/exists/stat/listCollection/removeRecord round-trips on disk-tier. Plus one bd-tier `listCollection` against seeded `gsd:phase` issues. |
| `section-primitives.test.ts` | fork `section-depth.test.ts` | getSection/updateSection modes overwrite/append/prepend. bd-tier path: update description via `rewriteSection` round-trip. |
| `frontmatter-primitives.test.ts` | fork `adapter.conformance.ts` (frontmatter tests) | updateFrontmatter on disk and bd-tier. Per D-MAPPING Outcome B, bd-tier: label add/remove via `_labelsToFrontmatter` materialization round-trip. |
| `format.test.ts` | sibling's archived 11-fixture corpus | Idempotency: `parse(format(parse(x))) === parse(x)` on each fixture. Pure unit; no bd; no setupFreshAdapter. |
| `transaction.test.ts` | fork `write-transaction.test.ts` | withTransaction commit + rollback + reentrancy. Assert `capabilities.transaction === true`; `capabilities.snapshot` matches shipped outcome. |
| `commit-planning-state.test.ts` | fork `commit-planning-state.test.ts` | Per Phase 5 D-12 contract. Noop on bd (no git integration needed from adapter) OR delegate to caller's git state. Planner decides; mirror fork's expectation. |
| `state-events-append.test.ts` | fork `write-outcome.test.ts:42-223` | 5 `recordStateAppend` cases (decision, metric, roadmap_evolution, session, quick_task, forensic_session) × outcome variants. Per Pitfall 7, adjust `created_section` assertions for Outcome B (never emitted). |
| `state-events-mutation.test.ts` | fork `write-outcome.test.ts:225-401` | 4 types × outcome variants. Same Pitfall 7 adjustment. |
| `state-events-signal.test.ts` | fork `write-outcome.test.ts:403-453` | waiting + resume × outcome variants. |
| `named-doc.test.ts` | fork `named-doc.test.ts` | putNamedDoc/getNamedDoc round-trip for each NamedDocCategory. Honor D-14 'root' discriminator. |
| `dep-graph.test.ts` | none (new) | Seed bd with `bd dep add <id1> <id2>` → `getRecord('graphs/graph.json')` returns edges `[{from, to, type: 'dependency', confidence: 1.0}]`. Per RESEARCH §Pattern 4. |

---

## Shared Patterns

These cross-cutting patterns apply to multiple files. Plans reference them by ID.

### SP-1: Router-first dispatch on every Bin A method

**Source:** sibling `src/adapter/primitives.mjs:73-102` (template applied to 11 Bin A methods).
**Applies to:** every method in `src/primitives.ts`.

```ts
const route = resolveRoute(path);                       // from src/paths.ts
if (route.tier === 'bd') {
  const bd = await this._ensureBd();
  // bd-tier branch: always include --all and -n 0 on list (Landmine 1)
  const items = bd.run(['list', '-l', route.label!, '--json', '--all', '-n', '0']);
  // ...
}
// disk-tier fallthrough — use _abs(this, path) with traversal guard (CR-01)
```

### SP-2: BdRunner adapter-context-bound bd wrapper (Landmines 3 + 4 + 11)

**Source:** RESEARCH Pattern 2 + sibling `helper.mjs:22` (baseline). See `src/bd/helper.ts` entry above.
**Applies to:** every bd-tier invocation in `src/primitives.ts`, `src/events.ts`, `src/dep-graph.ts`, `src/txn/*`, `src/init.ts`.

Construction: `new BdRunner(beadsRoot, { ...process.env, BEADS_ACTOR: 'seed' })`. Caches cwd + env; `run(args, opts)` forwards. `show(id)` unwraps array per Landmine 5.

### SP-3: Path-traversal guard on `_abs()` (CR-01 BLOCKER fix)

**Source:** fork `adapters/types.ts` precedent + RESEARCH Pitfall "Anti-patterns."
**Applies to:** every `pathResolve(projectRoot, relPath)` call in `src/primitives.ts`.

```ts
function _abs(adapter: BeadsAdapter, path: string): string {
  const abs = pathResolve(adapter.projectRoot, path);
  const root = pathResolve(adapter.projectRoot);
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new TypeError(`BeadsAdapter: path '${path}' escapes projectRoot`);
  }
  return abs;
}
```

Add negative conformance tests in `tests/smoke/record-primitives.test.ts`: `expect(adapter.getRecord('../../../etc/passwd')).rejects.toThrow(TypeError)` (and similar for put/remove/list/exists/stat).

### SP-4: `StateWriteOutcome` three-state dispatch (D-2026-05-10-08)

**Source:** fork `adapters/types.ts:28-52` + `adapters/markdown/index.ts:699-921` + RESEARCH Pattern 3.
**Applies to:** `src/events.ts` × 3 methods. Exhaustive `never` check on event.type at end of switch. In Outcome B, `created_section` variant NEVER emitted — ADR documents.

### SP-5: Closed-union exhaustive dispatch via `never`

**Source:** fork `adapters/markdown/index.ts:350-352` (SectionMode) + `:762-764` (AppendEvent).
**Applies to:** every `switch(event.type)` in `src/events.ts`; every `switch(mode)` in `src/primitives.ts` (for `SectionMode` cases); every `switch(route.tier)`.

```ts
default: {
  const _exhaustive: never = event;
  throw new Error(`Unknown ...: ${(event as { type: string }).type}`);
}
```

Compile-time exhaustiveness enforcement is a primary D-TECH-STACK motivation.

### SP-6: Atomic write via tmpfile + rename (WR-05 fixed)

**Source:** `src/_atomicWrite.ts` entry above.
**Applies to:** every disk-tier write in `src/primitives.ts` (putRecord, updateSection disk path, updateFrontmatter disk path, mergeFrontmatter disk path, putNamedDoc disk body).

Replace `writeFile` direct calls with `atomicWriteFile`.

### SP-7: Conformance test skeleton (vitest)

**Source:** fork `tests/conformance/binary-asset.test.ts:1-36`.
**Applies to:** all 11 new `tests/smoke/*.test.ts` files.

Skeleton: `import { describe, it, expect, beforeEach, afterEach } from 'vitest'` → beforeEach sets up fresh adapter via `setupFreshAdapter()` → afterEach `rm -rf` cleanup.

### SP-8: Import fork types via `get-shit-done` package name (not relative)

**Source:** D-TECH-STACK + RESEARCH Code Example 3.
**Applies to:** all `src/**/*.ts` and `tests/**/*.ts` in sibling.

```ts
import type { StorageAdapter, Capabilities, StateWriteOutcome } from 'get-shit-done/adapters/types.js';
import type { AppendEvent, MutationEvent, SignalEvent } from 'get-shit-done/adapters/state-event-types.js';
import { UnsupportedCapabilityError } from 'get-shit-done/adapters/types.js';
import { runAdapterConformanceSuite } from 'get-shit-done/conformance';
```

Exact subpath depends on fork's `exports` resolution — verify in Plan 06-01 fork-side task.

---

## No Analog Found

| File | Reason | Fallback |
|------|--------|----------|
| `src/dep-graph.ts` | No dep-edge synthesizer exists in fork; sibling never authored one (only spike-014 SPIKE.md proof-of-concept) | Use RESEARCH Pattern 4 (Example) as canonical shape; spike-014 for field-name + direction semantics |
| `tests/smoke/dep-graph.test.ts` | First-of-kind test against `{type: 'dependency'}` edges | Shape from RESEARCH Pattern 4; seed bd with `bd dep add` then assert output shape |

---

## Metadata

**Analog search scope:**
- `/Volumes/code/get-shit-done/adapters/**` (fork — 1452 LOC MarkdownAdapter + 160 LOC types + harness)
- `/Volumes/code/get-shit-done/tests/conformance/**` (fork — 14 test files)
- `/Volumes/code/gsd-beads/src/**` (sibling — 10 `.mjs` cluster files + 3 format + 3 bd + 5 helpers + 1 adapter shell + 1 _atomicWrite + 1 pathRouter)
- `/Volumes/code/gsd-beads/tests/fixtures/build-seed.sh` (sibling — seed generator)
- `/Volumes/code/get-shit-done/.claude/skills/spike-findings-gsd-beads/**` (canonical skill reference; cited via 06-RESEARCH.md)

**Files read:** 16 (fork: types.ts, adapter.conformance.ts, markdown.conformance.test.ts, markdown/index.ts [3 spans], write-outcome.test.ts, binary-asset.test.ts, state-event-types.ts, package.json, adapters/tsconfig.json, adapters/vitest.config.ts; sibling: findRoot.mjs, helper.mjs, errors.mjs, parsePhaseId.mjs, deriveDiskStatus.mjs, detectDrift.mjs, loadMilestoneHeading.mjs, _atomicWrite.mjs, pathRouter.mjs, frontmatter.mjs, section.mjs, phase.mjs, adapter.mjs, primitives.mjs, state.mjs, package.json, build-seed.sh)

**Pattern extraction date:** 2026-05-11
