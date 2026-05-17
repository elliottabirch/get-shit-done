# Phase 5: Foundational primitive lift - Research

**Researched:** 2026-05-10
**Domain:** Shadow-dir journal transactions, heading-depth markdown parsing, TypeScript discriminated-union overloads, reentrant PID-locking, dry-run pipeline refactor
**Confidence:** HIGH

## Summary

Phase 5 replaces the four remaining `UnsupportedCapabilityError` stubs in `MarkdownAdapter` (`writeBinaryAsset`, `snapshot`, `restore`, `putNamedDoc`/`getNamedDoc`) with real implementations, upgrades `withTransaction` from Phase-3 lock-only to a lock-plus-shadow-dir-journal that supports rollback, rewrites `extractSection`/`replaceSection` to walk heading depth (##/###/####), and hoists `sdk/src/query/pipeline.ts` dry-run off `cp -r` onto `adapter.withTransaction({ dryRun: true })`. The cross-cutting piece is the shadow-dir journal: every mutating adapter method redirects writes to a per-txn tmpdir while reads merge tmpdir-over-real, and commit/rollback are implemented via rename-into-place and `rm -rf` respectively.

Eleven SDK-surface migrations follow: 5 named-docs handlers, 3 codebase-docs handlers, 2 tmp-docs handlers, and 1 sidecar migration at `route-next-action.ts:44` delegate path computation to `putNamedDoc`/`getNamedDoc` with typed `NamedDocCategory` union. Two new SDK query modules land (`sidecar.ts` + `scratch.ts`) wrapping existing `getRecord`/`putRecord` calls behind typed verbs; they add no adapter methods. Three capability flags flip to `true`: `snapshot`, `namedDoc`, `binaryAsset`.

The key technical risks are (1) atomic rename semantics across directories on POSIX (same-filesystem only; the shadow-dir tmpdir must live on the same mount as `.planning/`), (2) reentrancy correctness when `recordStateAppend` (which already wraps `withTransaction`) is called inside an outer dry-run txn, and (3) fenced-code-block and HTML-comment skipping in the heading-depth walker. All three have established patterns (git index transaction, Postgres savepoint nesting, remark/mdast parsers) that map cleanly to this codebase.

**Primary recommendation:** Structure in 5-6 plans — (1) `NamedDocCategory` type + `putNamedDoc`/`getNamedDoc` + capability flip; (2) shadow-dir journal infrastructure + `snapshot`/`restore` + dryRun plumbing; (3) `updateSection` heading-depth walker rewrite + reentrant-lock guard; (4) pipeline.ts refactor + `writeBinaryAsset` + SDK sidecar/scratch modules; (5) SDK-surface migration of 11 handler sites; (6) conformance test extensions + OQ-02/05/07/10 ADRs. Plan 1 and 3 are independent and can run in parallel; plans 2 and 4 are sequential on shadow-dir infra.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Shadow-dir journal (tmpdir + rename-on-commit) | `adapters/markdown/index.ts` | — | Adapter owns all fs operations per Phase 4 zero-leak invariant |
| Transaction context / reentrancy tracking | `adapters/markdown/index.ts` (extended `lockSet`) | — | Adapter-instance state; BeadsAdapter maps to bd native txn (Phase 6) |
| Dry-run orchestration | `sdk/src/query/pipeline.ts` | Adapter `withTransaction({dryRun})` | Pipeline decides what dry-run means (diff shape); adapter provides the shadow-dir mechanism |
| Heading-depth parse | `adapters/markdown/index.ts` helpers | — | Per D-11, Markdown-specific; BeadsAdapter maps updateSection to sub-records |
| `putNamedDoc` path dispatch | `adapters/markdown/index.ts` | — | Adapter owns category → path formula; SDK handlers stay thin |
| Category-to-handler wiring | `sdk/src/query/named-docs.ts` etc. | Adapter `putNamedDoc` | SDK handlers layer workflow concerns (timestamping, fallback) over uniform primitive |
| Sidecar SDK verbs (`next-call-count.*`) | `sdk/src/query/sidecar.ts` (new) | Adapter `getRecord`/`putRecord` | Sidecar stays Bin A per D-19; no new adapter methods |
| Scratch SDK verbs (`discuss.checkpoint.*`, `discuss.questions.*`) | `sdk/src/query/scratch.ts` (new) | Adapter `getRecord`/`putRecord`/`removeRecord` | Scratch stays Bin A per D-20; phase-scoped at `.planning/phases/NN-*/` |
| Binary asset write | `adapters/markdown/index.ts` | — | Per D-17, `fs.writeFile(Buffer)` direct impl; no consumer workflows in Phase 5 |
| Reentrant-lock guard | `adapters/markdown/index.ts` (`acquireAdapterLock`) | — | ~10 LOC extension of existing lockSet tracking |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (withTransaction rollback via shadow-dir journal):** Phase 3's lock-only `withTransaction` is upgraded to a shadow-dir journal. When a txn is active, all mutating adapter methods (`putRecord`, `updateSection`, `updateFrontmatter`, `mergeFrontmatter`, `removeRecord`, `putNamedDoc`, `writeBinaryAsset`) redirect writes to a per-txn tmpdir layered over `projectDir`. All reads (`getRecord`, `getSection`, `getFrontmatter`, `listCollection`, `exists`, `stat`, `getNamedDoc`) merge tmpdir-over-real so a caller sees its own pending writes. Commit renames tmpdir entries into place atomically; rollback `rm -rf`'s the tmpdir. Scoped to touched paths only (smaller tmp footprint).

- **D-02 (Dry-run = withTransaction with rollback):** `pipeline.ts` calls `adapter.withTransaction(fn, { dryRun: true })`. The txn runs the mutation against the shadow dir; pipeline computes diff from the shadow dir's touched paths; the txn unconditionally rolls back. Pipeline no longer calls `cp -r` or `readPlanningState` twice.

- **D-03 (snapshot()/restore() are internal supporting methods):** Shadow-dir journal needs capture-and-reuse. `snapshot()` returns an opaque snapshot id; `restore(id)` is callable but primarily internal to `withTransaction` rollback. Fulfills `capabilities.snapshot` contract but NOT marketed as user-facing checkpoint API in Phase 5.

- **D-04 (Re-entrant txn handling):** Nested `withTransaction` calls must be reentrant-safe: if a txn is already active on the current adapter instance, nested `withTransaction` joins the outer txn (no new tmpdir, no new lock acquire). Outer txn owns commit/rollback. Tracked via `lockSet` extended with `activeTransaction?: TxnCtx` field.

- **D-05 (dryRun flag threading):** `dryRun` flag on outer txn propagates to all nested calls. When `dryRun: true`, `commitPlanningState` inside a txn is a no-op; shadow-dir rollback restores state.

- **D-06 (Heading-depth walking):** `extractSection`/`replaceSection` rewritten from line-scan-for-`## ` to proper heading-depth parser. Anchor syntax: full heading marker passed — `"## Foo"`, `"### Evidence"`, `"#### Sub-point"`. Section terminates at next heading of same-or-shallower depth.

- **D-07 (Anchor disambiguation):** When two subsections share a name, anchor resolution is document-order first-match.

- **D-08 (Edge cases):** Parser must skip headings inside fenced code blocks. Setext-style headings NOT supported (GSD uses ATX only); detected setext raises a warning. Heading-like text inside `<!-- comments -->` is skipped.

- **D-09 (updateSection internally withTransaction-wrapped):** Every `updateSection` call acquires the PID lockfile via an internal `withTransaction` wrap. Parallel callers serialize. Zero caller burden.

- **D-10 (Reentrant-lock guard):** `acquireAdapterLock` extended with a `lockSet` check. When `withTransaction` is called and the current file lock is already held by the same adapter instance, the call joins the outer txn rather than re-acquiring. ~10 LOC addition.

- **D-11 (BeadsAdapter mapping):** `withTransaction` maps to bd's native txn or no-op; `updateSection` dispatches to per-section sub-record updates inheriting bd's per-issue atomicity. Phase 6 ships the mapping.

- **D-12 (Primitive-first framing):** `putNamedDoc(category, key, body)` / `getNamedDoc(category, key)` are the primary named-doc contract. Phase 4 handlers keep typed SDK signatures but delegate path computation to the adapter primitive.

- **D-13 (Category is a typed TypeScript union):** `type NamedDocCategory = 'research' | 'intel' | 'codebase' | 'archived-milestone' | 'reports' | 'sketches' | 'tmp' | 'root'`. Exported from `adapters/types.ts`.

- **D-14 (Root category + fixed-key discriminator):** Category `'root'` reserved for singletons at `.planning/` root. When `category === 'root'`, key typed as literal union: `'HANDOFF' | 'CONTINUE-HERE' | 'DECISIONS-INDEX'`. Discriminated overload signature. Path formula: `category === 'root' ? ${key}.md : ${category}/${key}.md`.

- **D-15 (ROADMAP §142 acceptance):** SDK-surface grep for legacy kind-tagged names (`getResearch`, `putIntelDoc`, `putCodebaseDoc`, `getArchivedMilestoneDoc`) returns zero call-sites after migration.

- **D-16 (capabilities.namedDoc flips to true):** MarkdownAdapter's `Capabilities.namedDoc = true`. `hasNamedDoc` type guard reports true.

- **D-17 (writeBinaryAsset = fs.writeFile(Buffer); flip capabilities.binaryAsset=true):** Interface + MarkdownAdapter only; no consumer workflows in Phase 5.

- **D-18 (Conformance stub for graceful degradation):** Test asserts hypothetical adapter with `binaryAsset: false` triggers documented graceful-degradation (workflow warns + skips write, does not throw). Tested via monkeypatched `capabilities.binaryAsset=false`.

- **D-19 (SDK-typed handlers for sidecars, adapter stays Bin A — OQ-05):** Sidecar paths get dedicated SDK verbs: `next-call-count.get`, `next-call-count.incr`. No new adapter methods.

- **D-20 (Scratch artifacts are first-class noun-catalog types — OQ-07):** `*-DISCUSS-CHECKPOINT.json` and `*-QUESTIONS.json/.html` get SDK verbs: `discuss.checkpoint.put/get/delete`, `discuss.questions.put/get/delete`. Live at `.planning/phases/NN-*/` (not `.planning/tmp/`).

- **D-21 (route-next-action.ts migration):** Existing raw `adapter.getRecord('.next-call-count')` at `sdk/src/query/route-next-action.ts:44` migrated to new `nextCallCountGet` helper. Path literals centralized in `sdk/src/query/sidecar.ts`.

### Claude's Discretion

- Plan count and sequencing (likely 5-7 plans given cross-cutting scope — withTransaction upgrade touches every mutating adapter method).
- Exact module layout for new SDK verbs (one `sidecar.ts` + `scratch.ts` or fold into existing files).
- Tmpdir location for shadow-dir journal (`os.tmpdir()` vs `.planning/.tmp-txn/`).
- Whether shadow-dir journal uses symlinks, hard-links, or copy-on-write for large files — subject to performance testing.
- Whether to ship one-shot `gsd-sdk migrate-named-docs` script or hand-edit per SDK handler.
- Exact text of ADRs appended to `.planning/DECISIONS.md` for OQ-02, OQ-05, OQ-07, OQ-10.
- Conformance test structure — extension of Phase 3's stubs or new test file per primitive.

### Deferred Ideas (OUT OF SCOPE)

- BeadsAdapter `withTransaction` mapping — Phase 6.
- `snapshot()/restore()` as user-facing checkpoint API.
- UI-review screenshots and sketch HTML/CSS/PNG consumer workflows.
- Conformance suite paired tests (MarkdownAdapter + BeadsAdapter) — Phase 7.
- BeadsAdapter sidecar/scratch path-sniff map — Phase 6.
- ROADMAP §142 grep verification script.
- Setext heading support.
- Category-enum growth procedure.
- `commitPlanningState` no-op semantics inside dryRun txns — OQ-01 follow-up ADR.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRIMITIVES-01 | `updateSection(file, sectionId, body, mode)` | Heading-depth walker design in "Architecture Patterns §Pattern 2"; current impl at `adapters/markdown/index.ts:200-241,785-857` |
| PRIMITIVES-02 | `getSection(file, anchor)` | Same walker as PRIMITIVES-01; already stub-implemented for L2-only |
| PRIMITIVES-03 | `snapshot()/restore()` or `withTransaction(fn)` | Shadow-dir journal pattern in "Architecture Patterns §Pattern 1"; current stubs at `adapters/markdown/index.ts:312-319` |
| PRIMITIVES-04 | `putNamedDoc(category, key, body)` / `getNamedDoc` | Typed-union overload pattern in "Architecture Patterns §Pattern 3"; current stubs at `adapters/markdown/index.ts:758-771` |
| PRIMITIVES-05 | `writeBinaryAsset(path, bytes)` | `fs.writeFile(Buffer)` implementation; current stub at `adapters/markdown/index.ts:308-310`; flip `capabilities.binaryAsset` |
| PRIMITIVES-06 | Atomic updateSection under multi-author concurrency | D-09 internal `withTransaction` wrap + D-10 reentrant lock; pattern in "Architecture Patterns §Pattern 4" |
| PRIMITIVES-07 | Section-vs-whole-file granularity locked (resolves OQ-02) | D-06: section IS the unit of write atomicity; depth-walker terminates at same-or-shallower heading. ADR in plan 6 |
| PRIMITIVES-08 | Sidecar paths modeled as named methods (resolves OQ-05) | D-19: SDK-typed verbs in new `sidecar.ts`; `route-next-action.ts:44` migrated per D-21 |
| PRIMITIVES-09 | Scratch record taxonomy (resolves OQ-07) | D-20: SDK verbs in new `scratch.ts`; scratch lives at `.planning/phases/NN-*/` |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Fork branch strategy:** Work on `feat/storage-adapter`; never modify `main` directly; periodic rebase against upstream. Per-phase feature branches off `feat/storage-adapter` as needed.
- **Upstream sync:** `git rebase main`; conflicts should only appear in our adapter-interface seam patches.
- **Strict-superset invariant:** Without adapter configured, behavior is identical to upstream (Phase 5 flips three capability flags but MarkdownAdapter-with-defaults remains the default path).
- **Zero-leak invariant (Phase 4):** Only `adapters/markdown/` touches `.planning/` directly. Phase 5 MUST NOT regress this — `pipeline.ts` stops using `node:fs` for `.planning/` reads/writes. Shadow-dir tmpdir logic uses `node:fs` against `os.tmpdir()` which is outside `.planning/` scope.
- **CJS files stay untouched:** Permanent D-02 from Phase 1. Phase 5 is TypeScript-only in `adapters/markdown/index.ts` + SDK files. No CJS helpers modified.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >=22.0.0 | Runtime | Project requirement [VERIFIED: package.json engines] |
| `node:fs/promises` | built-in | Shadow-dir tmpdir ops, rename, rm | Already used in adapter [VERIFIED: adapters/markdown/index.ts:24] |
| `node:os` `tmpdir` / `mkdtemp` | built-in | Per-txn tmpdir location | Already used in pipeline.ts [VERIFIED: sdk/src/query/pipeline.ts:26] |
| `node:path` `join`, `relative` | built-in | Path composition | Already used [VERIFIED] |
| TypeScript (SDK) | (existing) | Discriminated-union overloads, literal types | Whole SDK is TS [VERIFIED: sdk/tsconfig.json] |
| vitest | (existing) | Unit + conformance test framework | Existing convention [VERIFIED: tests/conformance/*.test.ts, vitest.conformance.config.ts] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `extractSection`/`replaceSection` helpers | local | Starting skeleton for heading-depth walker | Rewrite termination condition; keep line-scan frame [VERIFIED: adapters/markdown/index.ts:785-857] |
| `acquireAdapterLock`/`releaseAdapterLock` / `lockSet` | local | PID-based lockfile with stale-lock detection | Extend `lockSet` with `activeTransaction` field for reentrancy [VERIFIED: adapters/markdown/index.ts:331-375] |
| Pipeline `diffPlanningState` helper | local | Keep; operates on touched-paths set instead of full tree clone | [VERIFIED: sdk/src/query/pipeline.ts:127-141] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shadow-dir with per-file rename-on-commit | Full tmpdir dir-swap (atomic at dir level) | Dir-swap requires stopping all reads during swap; rename-per-file allows concurrent readers during commit. Shadow-dir wins for small diffs; dir-swap wins if the adapter touches ≥100 files per txn (not the typical pattern) |
| `mdast`/`remark` AST parser for updateSection | Line-by-line walker | AST is robust (handles indented code, reference links, etc.) but pulls a dependency tree; line-walker is ~50 LOC, handles the 2 edge cases (fenced code + HTML comments) per D-08, and keeps adapter dependency-free |
| Shadow-dir under `os.tmpdir()` | `.planning/.tmp-txn/` | `.planning/.tmp-txn/` stays on same filesystem → atomic rename works cross-directory. `os.tmpdir()` may be different mount → rename falls back to copy+unlink (NOT atomic). **Recommended: `.planning/.tmp-txn/` under discretion D-02** — verify same-mount invariant in conformance test |
| `putNamedDoc` with plain string category | Typed discriminated union (D-13/D-14) | String arg enables typo-driven drift; union is compile-time gate. Locked. |

**Installation:** No new npm packages. Phase 5 uses only built-in `node:*` modules.

**Version verification:** N/A — no new packages. Existing dependencies verified against current `package.json`.

## Architecture Patterns

### System Architecture Diagram

```
Caller (workflow .md / SDK handler)
  |
  | gsd-sdk query <verb>
  v
SDK Registry Dispatch (sdk/src/query/index.ts)
  |
  | handler(args, projectDir, workstream)
  v
SDK Query Handler (named-docs.ts | codebase-docs.ts | tmp-docs.ts | sidecar.ts | scratch.ts | pipeline.ts)
  |
  | adapter.putNamedDoc(category, key, body) | adapter.withTransaction(fn, opts)
  v
+========================================================================+
| MarkdownAdapter (adapters/markdown/index.ts)                           |
|                                                                        |
|   withTransaction(fn, {dryRun?})                                       |
|    |                                                                   |
|    +-> reentrancy check (lockSet.activeTransaction?)                   |
|    |   YES -> join outer txn, run fn, return (no commit)              |
|    |   NO  -> acquireAdapterLock(lockPath)                             |
|    |         mkdtemp(tmpdir) -> set lockSet.activeTransaction          |
|    |                                                                   |
|    |   fn runs; mutating calls redirect to tmpdir via resolveWrite()   |
|    |           reads merge via resolveRead() (tmpdir-over-real)        |
|    |                                                                   |
|    +-> success + !dryRun: commit (rename tmpdir entries into place)    |
|        success + dryRun: compute diff, rollback (rm -rf tmpdir)        |
|        error: rollback (rm -rf tmpdir)                                 |
|        finally: releaseAdapterLock + clear lockSet.activeTransaction   |
|                                                                        |
|   putRecord/updateSection/updateFrontmatter/writeBinaryAsset/...       |
|    |                                                                   |
|    +-> activeTxn ? writePath = resolveWrite(relPath) : writePath = real|
|        [actual fs op: writeFile/rename/unlink on writePath]            |
|                                                                        |
|   getRecord/getSection/exists/stat/listCollection/...                  |
|    |                                                                   |
|    +-> activeTxn ? readPath = resolveRead(relPath) : readPath = real   |
|        [fs.stat(tmpdir+relPath) || fs.stat(real+relPath)]              |
|                                                                        |
|   updateSection (specifically)                                         |
|    |                                                                   |
|    +-> withTransaction wrap (D-09) — reentrant-safe (D-10)            |
|        heading-depth walker (D-06): parse lines, detect fenced code,   |
|        find anchor at depth N, terminate at next heading <= depth N    |
|                                                                        |
|   putNamedDoc(category, key, body) — discriminated overload            |
|    |                                                                   |
|    +-> category === 'root' ? key.md : `${category}/${key}.md`          |
|        -> delegate to putRecord(path, body)                            |
+========================================================================+
  |
  v
Real filesystem (.planning/) OR shadow-dir tmpdir (.planning/.tmp-txn/<uuid>/)
```

### Recommended Project Structure

No structural changes. Phase 5 extends existing modules and adds two SDK query files.

```
adapters/
├── markdown/
│   └── index.ts              # Shadow-dir journal, heading-depth walker,
│                             # putNamedDoc, writeBinaryAsset, snapshot/restore
│                             # (~400 LOC added, ~60 LOC modified)
└── types.ts                  # Export NamedDocCategory; refine putNamedDoc overload

sdk/src/query/
├── pipeline.ts               # Refactor: cp -r → withTransaction({dryRun:true})
│                             # (~60 LOC removed, ~20 LOC added)
├── named-docs.ts             # Delegate 5 handlers to adapter.putNamedDoc (~15 LOC changed)
├── codebase-docs.ts          # Delegate 3 handlers (~9 LOC changed)
├── tmp-docs.ts               # Delegate 2 handlers (~6 LOC changed)
├── route-next-action.ts      # Migrate line 44 to nextCallCountGet helper
├── sidecar.ts                # NEW — nextCallCountGet/Incr, centralized sidecar path literals
├── scratch.ts                # NEW — discuss.checkpoint.*, discuss.questions.* verbs
└── index.ts                  # Register new SDK verbs

tests/conformance/
├── adapter.conformance.ts                # Extend factory with Phase-5 describe blocks
├── write-transaction.test.ts             # Extend: dryRun, reentrancy, mid-txn-failure
├── named-doc.test.ts                     # NEW — round-trip across all 8 categories
├── section-depth.test.ts                 # NEW — L2/L3/L4 anchors, fenced code, comments
├── binary-asset.test.ts                  # NEW — writeBinaryAsset + graceful degradation
└── pipeline.test.ts (sdk/src/query/)     # Extend: dry-run via withTransaction
```

### Pattern 1: Shadow-Dir Journal Transaction

**What:** `withTransaction(fn, {dryRun?})` creates a per-txn tmpdir. All mutating methods inside `fn` redirect writes to the tmpdir; all reads check tmpdir first, then real fs. Commit renames tmpdir entries into place; rollback removes the tmpdir.

**When to use:** Every mutation `fn` that needs atomic rollback (all pipeline dry-runs, multi-file writes, AI-SPEC three-author concurrency).

**Key atomicity invariant:** The tmpdir MUST live on the same filesystem as `projectDir/.planning/` so that POSIX `rename(2)` is atomic. `os.tmpdir()` may be a different mount (on macOS typically same; on Linux systemd-private-tmpfs can differ). **Use `.planning/.tmp-txn/<uuid>/` to guarantee same-mount** [CITED: POSIX rename(2) — "If oldpath and newpath are on different filesystems, rename() fails with EXDEV"].

**Example:**
```typescript
// adapters/markdown/index.ts (Phase 5 addition)

interface TxnCtx {
  tmpDir: string;                    // e.g., .planning/.tmp-txn/<uuid>/
  touchedPaths: Set<string>;         // planning-relative paths modified in txn
  dryRun: boolean;
  depth: number;                     // reentrancy counter
}

async withTransaction<T>(fn: () => Promise<T>, opts?: { dryRun?: boolean }): Promise<T> {
  const existing = this.activeTxn;
  if (existing) {
    // Reentrant: join outer txn (D-04). Inherit outer's dryRun flag (D-05).
    existing.depth++;
    try {
      return await fn();
    } finally {
      existing.depth--;
    }
  }

  const lockPath = join(this.planningBase, '.adapter.lock');
  await this.acquireAdapterLock(lockPath);
  const tmpDir = await mkdtemp(join(this.planningBase, '.tmp-txn-'));
  const ctx: TxnCtx = {
    tmpDir,
    touchedPaths: new Set(),
    dryRun: opts?.dryRun ?? false,
    depth: 1,
  };
  this.activeTxn = ctx;

  try {
    const result = await fn();
    if (!ctx.dryRun) {
      await this.commitShadowDir(ctx);    // rename tmpdir entries into place
    }
    return result;
  } catch (err) {
    throw err;
  } finally {
    // Rollback always runs if dryRun OR if error thrown before commit:
    await rm(tmpDir, { recursive: true, force: true });
    this.activeTxn = undefined;
    await this.releaseAdapterLock(lockPath);
  }
}

// Write-path resolver: if txn active, redirect to tmpdir; else real path
private resolveWrite(relPath: string): string {
  if (this.activeTxn) {
    this.activeTxn.touchedPaths.add(relPath);
    return join(this.activeTxn.tmpDir, relPath);
  }
  return this.resolve(relPath);
}

// Read-path resolver: tmpdir-over-real merge
private async resolveRead(relPath: string): Promise<string> {
  if (this.activeTxn) {
    const shadowPath = join(this.activeTxn.tmpDir, relPath);
    if (existsSync(shadowPath)) return shadowPath;
  }
  return this.resolve(relPath);
}

private async commitShadowDir(ctx: TxnCtx): Promise<void> {
  for (const relPath of ctx.touchedPaths) {
    const src = join(ctx.tmpDir, relPath);
    const dst = this.resolve(relPath);
    await mkdir(dirname(dst), { recursive: true });
    await rename(src, dst);   // atomic same-mount rename
  }
}
```

**Source:** Pattern derived from git's index-to-working-tree commit (rename per file), SQLite WAL checkpoint ([CITED: https://www.sqlite.org/wal.html]), and Node.js built-in `fs.rename` atomicity guarantees [CITED: https://nodejs.org/api/fs.html#fspromisesrenameoldpath-newpath].

### Pattern 2: Heading-Depth Walker

**What:** Parse markdown line-by-line. Each heading line `^(#+)[ \t]+(.*)$` captures its depth (1-6) and text. When anchor is matched at depth N, consume subsequent lines until another heading of depth ≤ N. Skip lines inside fenced code blocks (```..```) and `<!-- ... -->` comment ranges.

**When to use:** `getSection` / `updateSection` implementations; replaces regex-line-scan for `^## ` at `adapters/markdown/index.ts:785-857`.

**Anchor API:** `anchor` parameter accepts the full heading marker:
- `"## Foo"` → depth=2, text="Foo"
- `"### Evidence"` → depth=3, text="Evidence"
- `"#### Sub-point"` → depth=4

Empirical test: `## Investigation 2026-05-01` containing `### Evidence`, and `## Investigation 2026-05-05` also containing `### Evidence`. Caller passing `"### Evidence"` gets document-order first-match per D-07. To disambiguate, caller passes more specific text (e.g., `"### Evidence 2026-05-05"`).

**Example:**
```typescript
// adapters/markdown/index.ts (Phase 5 replacement for lines 785-857)

interface ParsedAnchor { depth: number; text: string; }

function parseAnchor(anchor: string): ParsedAnchor {
  const m = anchor.match(/^(#{1,6})[ \t]+(.+?)[ \t]*$/);
  if (!m) throw new Error(`Invalid anchor (not ATX heading): ${anchor}`);
  return { depth: m[1].length, text: m[2] };
}

function extractSection(
  text: string,
  anchor: string,
): { found: boolean; body: string | null } {
  const { depth, text: anchorText } = parseAnchor(anchor);
  const lines = text.split('\n');
  const anchorRe = new RegExp(`^#{${depth}}[ \\t]+${escapeRegExp(anchorText)}[ \\t]*$`);

  let inSection = false;
  let inFence = false;
  let inComment = false;
  const bodyLines: string[] = [];

  for (const line of lines) {
    // Fenced-code detection (toggle on ``` at col 0..3)
    if (/^[ ]{0,3}```/.test(line)) inFence = !inFence;
    // HTML-comment detection — cheap: enter on <!-- outside comment, exit on -->
    if (!inFence) {
      if (/<!--/.test(line) && !/-->/.test(line)) inComment = true;
      else if (inComment && /-->/.test(line)) { inComment = false; continue; }
    }

    if (!inSection) {
      if (!inFence && !inComment && anchorRe.test(line)) inSection = true;
      continue;
    }

    // Inside section: detect terminator (heading depth <= anchor depth)
    if (!inFence && !inComment) {
      const hm = line.match(/^(#{1,6})[ \t]+/);
      if (hm && hm[1].length <= depth) break;
    }
    bodyLines.push(line);
  }

  if (!inSection) return { found: false, body: null };
  const raw = bodyLines.join('\n');
  return { found: true, body: raw.replace(/^\n+|\n+$/g, '') };
}
```

Setext detection (trigger D-08 warning): if a non-blank line is followed by `/^=+$/` or `/^-+$/` outside a fenced code block, log a warning and skip. (Setext is GSD-not-supported.)

**Source:** CommonMark 0.31.2 heading-depth spec ([CITED: https://spec.commonmark.org/0.31.2/#atx-headings]). Line-walker frame preserved from current `extractSection`.

### Pattern 3: TypeScript Discriminated Overload for putNamedDoc

**What:** Two overload signatures enforce that `category === 'root'` forces `key` to a literal union, while `category !== 'root'` accepts arbitrary strings.

**When to use:** `adapters/types.ts` interface declaration; MarkdownAdapter impl uses a single body that switches on category.

**Example:**
```typescript
// adapters/types.ts (Phase 5 addition)

export type NamedDocCategory =
  | 'research'
  | 'intel'
  | 'codebase'
  | 'archived-milestone'
  | 'reports'
  | 'sketches'
  | 'tmp'
  | 'root';

export type RootNamedDocKey = 'HANDOFF' | 'CONTINUE-HERE' | 'DECISIONS-INDEX';

export interface StorageAdapter {
  // ... other methods ...

  // Discriminated overload: 'root' narrows key to literal union
  putNamedDoc(category: 'root', key: RootNamedDocKey, body: string): Promise<void>;
  putNamedDoc(category: Exclude<NamedDocCategory, 'root'>, key: string, body: string): Promise<void>;

  getNamedDoc(category: 'root', key: RootNamedDocKey): Promise<string | null>;
  getNamedDoc(category: Exclude<NamedDocCategory, 'root'>, key: string): Promise<string | null>;
}
```

Compile-time rejection verified by negative test:
```typescript
// tests/conformance/named-doc.test.ts — vitest compile assertion
// @ts-expect-error — 'root' category rejects arbitrary string keys
adapter.putNamedDoc('root', 'ARBITRARY_STRING', 'body');
```

**Impl in MarkdownAdapter:**
```typescript
async putNamedDoc(
  category: NamedDocCategory,
  key: string,
  body: string,
): Promise<void> {
  const path = category === 'root' ? `${key}.md` : `${category}/${key}.md`;
  await this.putRecord(path, body);
}
```

Signature declaration uses the discriminated overloads; implementation has a single widened body (TypeScript allows this when overload signatures are declared via interface).

**Source:** TypeScript function overloads spec [CITED: https://www.typescriptlang.org/docs/handbook/2/functions.html#function-overloads].

### Pattern 4: Reentrant PID-Lock Guard

**What:** When a thread already holds the lock (within the same adapter instance), `withTransaction` joins the existing txn instead of re-acquiring. Tracked via `this.activeTxn: TxnCtx | undefined`.

**When to use:** `recordStateAppend`, `recordStateMutation` already wrap `withTransaction`. When Phase 5 `updateSection` (D-09) internally wraps `withTransaction`, and `recordStateAppend` calls `updateSection` internally, we'd get a double-lock deadlock without reentrancy.

**Why PID-based lockfile is safe for same-PID reentrancy:** The existing `acquireAdapterLock` uses `O_EXCL|O_CREAT` on a lockfile containing `process.pid`. A single-process reentrant call would self-deadlock (EEXIST on self's own PID). The fix is to consult `this.activeTxn` (in-memory, same adapter instance) BEFORE attempting to acquire the filesystem lock.

**Key pitfall:** Cross-adapter-instance reentrancy is NOT supported. Two `MarkdownAdapter` instances in the same process would both see `activeTxn === undefined` and race on the lockfile; stale-lock detection handles this by checking PID liveness, but with matching PID both paths enter the "force-break on last retry" branch at line 349. Document this limitation in ADR; conformance tests use a single adapter instance per test.

**Example:**
```typescript
// adapters/markdown/index.ts (Phase 5 replacement for withTransaction)
// Full body shown in Pattern 1 above — the reentrancy branch is:

async withTransaction<T>(fn, opts): Promise<T> {
  const existing = this.activeTxn;
  if (existing) {
    existing.depth++;
    try { return await fn(); }
    finally { existing.depth--; }
  }
  // else: acquire lock + create tmpdir (see Pattern 1)
}
```

~10 LOC addition as specified in CONTEXT.md D-10.

### Anti-Patterns to Avoid

- **Using `os.tmpdir()` for shadow-dir:** If `os.tmpdir()` is on a different filesystem than `projectDir/.planning/`, POSIX `rename()` returns EXDEV and node falls back to copy+unlink — NOT atomic, defeats the rollback guarantee. Use `.planning/.tmp-txn/<uuid>/`.
- **Full tmpdir dir-swap:** Atomic-at-dir-level via `rename(tmpDir, realDir)` sounds simpler but requires moving the ORIGINAL `.planning/` aside first — creates a window where `.planning/` doesn't exist, breaking concurrent readers. Per-file rename on touched-paths only is safer.
- **Walking section via AST parser:** Pulling `remark`/`mdast` for a 2-edge-case parser adds a large dependency tree to `adapters/markdown/`. The 4 edge cases (fenced code, HTML comments, setext rejection, depth tracking) are ~30 LOC of line-walker logic.
- **Changing Phase 3 `commitPlanningState` to be capability-gated:** D-12 made it required per phase 3. Phase 5's D-05 says it's a no-op inside `dryRun` txn but DOES NOT demote it back to optional. The implementation check is `if (this.activeTxn?.dryRun) return;` at the top of `commitPlanningState`.
- **Shared tmpdir across txn lifetimes:** Each `withTransaction` call must create a FRESH `mkdtemp()`. Reusing stale tmpdirs leaks state between txns.
- **Passing `this.activeTxn` mutably into `fn`:** `fn` must not directly touch `activeTxn`. All mutation flows through adapter methods that check `this.activeTxn`.
- **Forgetting to thread `dryRun` into nested calls:** If `withTransaction({dryRun:true})` nests an inner `withTransaction()` without opts, the inner call must inherit `dryRun: true` from outer ctx — tested at `write-transaction.test.ts` new case "nested txn inherits dryRun".

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic cross-file write | Ordered-writes + fsync dance | Shadow-dir + per-file `rename()` | POSIX `rename(2)` is atomic by spec on same filesystem; manual ordering is fragile |
| Cross-directory atomic rename | Cross-filesystem move emulation | Keep tmpdir under `.planning/.tmp-txn/` (same mount) | Node `fs.rename()` returns EXDEV across mounts; falls back to copy+unlink which is NOT atomic |
| Markdown heading parser | Full mdast/remark AST | Line-walker with fence + comment skip | 30 LOC vs 50KB dependency; GSD-controlled content set bounded to ATX-only |
| File lock management | Dual locks per-path | Single `.adapter.lock` + lockSet + reentrant guard | Phase 3 already built the file-lock infra; Phase 5 extends with `activeTransaction` field |
| Named-doc path routing in every handler | Per-handler path formula | Single `putNamedDoc(category, key, body)` primitive | Collapses 11 path-formula duplications; type-safe via discriminated union |
| Dry-run diff computation | Re-read entire tree before+after | Track touched paths in TxnCtx; diff only those | O(touched) instead of O(tree). Also removes need for `copyPlanningTree` |
| Sidecar/scratch as adapter primitives | New `getSidecar`/`putScratch` methods | SDK-typed handlers wrapping `getRecord`/`putRecord` | Adapter surface frozen for Phase 6 BeadsAdapter; sidecar/scratch are workflow concerns |

**Key insight:** The discipline is to add mechanism (shadow-dir journal, depth-walker, typed overloads) to the adapter while keeping policy (named-doc categories, sidecar semantics, dry-run diff shape) in the SDK layer. Phase 5 resists the temptation to add `adapter.startDryRun()` or `adapter.listSidecars()`. All new adapter methods are primitives (`putNamedDoc`, `writeBinaryAsset`, `snapshot`, `restore`, `withTransaction` widening); policy lives upstream.

## Runtime State Inventory

> Phase 5 is a primitive-implementation phase, not a rename/refactor/migration phase. The adapter interface doesn't change name, shape, or contract; it only lifts stubs to real impls. Still, the migration of 11 handler sites away from legacy kind-tagged names (D-15) has runtime-state dimensions.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | **None.** No databases, no ChromaDB, no Mem0. All state is markdown files under `.planning/` already keyed by path. | — |
| Live service config | **None.** No external services (n8n/Datadog/Cloudflare) involved. | — |
| OS-registered state | **None.** No Task Scheduler / launchd / systemd. Adapter is library code, not a service. | — |
| Secrets/env vars | **None.** No secrets; `.planning/` is markdown only. | — |
| Build artifacts | **Yes — `adapters/dist/` contains stale compiled JS after TypeScript source changes.** The `main` entry in `adapters/package.json` points to `dist/types.js`, and SDK files import `'../../adapters/types.js'` which vitest resolves to TypeScript source via config alias (see `vitest.conformance.config.ts`). But production callers that `require('@gsd-build/adapters/markdown')` hit the `dist/`. **Action:** Phase 5 must re-run `npm run build` on the adapter package (or `tsc` in-place) after changes, and all plans that modify `adapters/markdown/index.ts` or `adapters/types.ts` must include a `build` task or a verification step that checks the dist is in sync. | Build task in every adapter-modifying plan |

**Canonical question — "What runtime systems still have the old string cached?":** Legacy kind-tagged SDK names (`getResearch`, `putIntelDoc`, `putCodebaseDoc`, `getArchivedMilestoneDoc`) are NOT adapter methods in the current codebase — they were in the SYNTHESIS §4 draft but never implemented (the Phase 4 handlers use category-naive `adapter.putRecord`/`adapter.getRecord`). D-15's "grep-zero" acceptance therefore targets whether Phase-4 handlers' INTERNAL call shape — `adapter.putRecord(path)` — has been migrated to `adapter.putNamedDoc(category, key)`. There is nothing to "migrate" externally; handler-public SDK verbs retain their external names (`report.put`, `codebase.put`, etc.) for backwards compatibility.

## Common Pitfalls

### Pitfall 1: POSIX rename EXDEV across filesystems

**What goes wrong:** Shadow-dir tmpdir under `os.tmpdir()` → `/tmp` or `/var/folders/...`. On Linux systemd-private-tmp or macOS APFS sandbox, `/tmp` may be a different mount than `/Volumes/code/get-shit-done/.planning/`. Node's `fs.rename` returns `EXDEV`; node's impl does NOT fall back to copy+unlink (it throws). Even if it did, copy+unlink is not atomic.

**Why it happens:** POSIX `rename(2)` atomicity is guaranteed ONLY on same filesystem. Cross-mount rename is undefined behavior.

**How to avoid:** Place tmpdir under `.planning/.tmp-txn/<uuid>/` (same mount as the target). Add a conformance test that asserts `fs.statSync(tmpDir).dev === fs.statSync(planningBase).dev` at transaction setup time. If different, fall back to direct write (non-txn semantics) with a logged warning — or fail fast.

**Warning signs:** CI flakes on `EXDEV` errors; commit step works locally but fails in Docker containers.

### Pitfall 2: Reentrant deadlock on same-PID lockfile

**What goes wrong:** `recordStateAppend` → wraps `withTransaction` → acquires `.adapter.lock` → calls `updateSection` internally → `updateSection` (post-D-09) wraps `withTransaction` → tries to acquire `.adapter.lock` → EEXIST → stale-lock check sees same PID (alive) → spins through 10 retries → force-breaks lock on retry-10 (line 349 "last retry" fallback) → now outer txn's lock is gone, another caller can enter mid-transaction.

**Why it happens:** Current `acquireAdapterLock` (line 331-361) treats same-PID EEXIST as contention, not as reentrancy. The force-break fallback was added for cross-process stale-lock recovery, but it fires on reentrancy too.

**How to avoid:** BEFORE the `O_EXCL|O_CREAT` attempt, check `this.activeTxn`. If set, the current adapter instance already holds the lock in the same process. Return immediately as a reentrant join (D-10). The force-break branch (line 349) remains for cross-process stale-lock recovery but is never hit by legitimate reentrancy.

**Warning signs:** CI timeouts around 2 seconds (10 retries × 200ms delay) on tests that involve nested transactions; STATE.md appears partially written after recordStateAppend.

### Pitfall 3: Fenced-code blocks containing `##` fool the depth walker

**What goes wrong:** An example code block like ` ```markdown\n## Example section\n``` ` inside a document. Naive line-scan treats `## Example section` as a real heading and splits the section boundary.

**Why it happens:** Phase 1's `extractSection` (line 785) uses a simple regex without fence tracking — acceptable for L2-only, but collides with code examples in AI-SPEC.md and research docs that embed markdown samples.

**How to avoid:** Toggle `inFence` on any line matching `/^[ ]{0,3}```/` (CommonMark spec allows up to 3 leading spaces for fence opening). Skip heading detection when `inFence === true`. Test case: `AI-SPEC.md` section "## Three-Author Concurrency" containing a markdown code example that itself has `## Sub-example`.

**Warning signs:** `getSection('## Foo')` returns empty or truncated content when the section body contains a code example with a heading-like line.

### Pitfall 4: `commitPlanningState` executes git commit inside dryRun txn

**What goes wrong:** `pipeline.ts` dry-run calls `fn()` which internally calls `adapter.commitPlanningState(msg)` (e.g., via `phaseComplete` handler). The shadow-dir correctly redirects writes to tmpdir, but `commitPlanningState` calls `git add .planning` which operates on the REAL `.planning/` — so git commits whatever was already there. Worse: any write that happened before the dry-run txn started gets committed, leaking into the real repo.

**Why it happens:** `commitPlanningState` uses `execFileSync('git', ...)` which bypasses the adapter's path resolver. Git is not shadow-dir-aware.

**How to avoid:** Per D-05, check `this.activeTxn?.dryRun` at the top of `commitPlanningState`. If true, return immediately (no-op). Shadow-dir rollback restores state; the commit was never meant to happen in dry-run mode anyway. Conformance test: `dryRun txn that calls commitPlanningState does not produce a git commit`.

**Warning signs:** `git log` shows unexpected commits after running a dry-run; `.planning/` appears unchanged but repo history has new entries.

### Pitfall 5: Setting `capabilities.namedDoc=true` before `putNamedDoc` is implemented

**What goes wrong:** Flipping the capability flag before the method body is lifted from `UnsupportedCapabilityError` throw. `hasNamedDoc(adapter)` returns `true`, caller invokes `putNamedDoc`, gets `UnsupportedCapabilityError`.

**Why it happens:** The capability flag and the method body are in different files (`adapters/markdown/index.ts` lines 85-94 vs lines 758-771). Split commits can land one without the other.

**How to avoid:** Flip each capability flag in the SAME commit that lifts the stub. Plan task ordering: (1) write impl, (2) flip flag, (3) update conformance test that asserts `hasNamedDoc(adapter) === true` AND method returns successfully — both in same task commit.

**Warning signs:** Runtime `UnsupportedCapabilityError` on `putNamedDoc` in a test that passes `hasNamedDoc` type guard.

### Pitfall 6: Binary asset path accepted with no validation leaks outside `.planning/`

**What goes wrong:** `writeBinaryAsset('../outside.png', bytes)` or `writeBinaryAsset('/etc/passwd', bytes)`. The adapter's `resolve()` uses `join(planningBase, path)` which does NOT reject absolute paths or `..` escapes.

**Why it happens:** `resolve()` is trust-caller. Text handlers call `validateName()` in SDK layer (codebase-docs.ts, tmp-docs.ts), but `writeBinaryAsset` is Bin A primitive with no SDK gate.

**How to avoid:** Phase 5 `writeBinaryAsset` implementation adds path-safety validation: reject paths containing `..`, reject absolute paths. Reuse the `validateName` pattern from `named-docs.ts:15-25`. OR: document that writeBinaryAsset is a raw primitive with no validation, and SDK handlers that call it must validate (consistent with text Bin A primitives which also don't validate).

**Warning signs:** CI test `writeBinaryAsset('../../etc/malicious', bytes)` succeeds (or should be a negative test).

## Code Examples

### Shadow-Dir Journal — Commit Phase

```typescript
// adapters/markdown/index.ts (Phase 5 addition)
// Source: derived from git-index commit semantics and SQLite WAL checkpoint

import { rename, mkdir, rm, mkdtemp } from 'node:fs/promises';

private async commitShadowDir(ctx: TxnCtx): Promise<void> {
  // Sort touched paths so parent dirs created before files
  const paths = Array.from(ctx.touchedPaths).sort();
  for (const relPath of paths) {
    const src = join(ctx.tmpDir, relPath);
    const dst = this.resolve(relPath);
    if (!existsSync(src)) continue;  // removeRecord leaves no shadow file
    await mkdir(dirname(dst), { recursive: true });
    await rename(src, dst);          // atomic same-mount rename
  }
  // Handle deletes: for each touched path that was removed, unlink the real.
  // (TxnCtx extended with `removedPaths: Set<string>` for this branch.)
}
```

### Pipeline Refactor — withTransaction Dry-Run

```typescript
// sdk/src/query/pipeline.ts (Phase 5 replacement for lines 180-245)
// Source: CONTEXT.md D-02

export function wrapWithPipeline(
  registry: QueryRegistry,
  mutationCommands: Set<string>,
  options: PipelineOptions,
): void {
  const { dryRun = false, onPrepare, onFinalize } = options;

  const wrapHandler = (cmd: string, isMutation: boolean): void => {
    const original = registry.getHandler(cmd);
    if (!original) return;

    registry.register(cmd, async (args: string[], projectDir: string) => {
      if (onPrepare) await onPrepare(cmd, args, projectDir);

      let result: QueryResult;
      if (dryRun && isMutation) {
        const { adapterFor } = await import('./helpers.js');
        const adapter = await adapterFor(projectDir);

        // Run in dry-run txn; collect diff from touched paths
        const diff: Record<string, { before: string | null; after: string | null }> = {};
        await adapter.withTransaction(async () => {
          // Before-state for each path read before modification
          // Pipeline computes diff via adapter.getTouchedPaths() + pre/post read
          // NOTE: touched-paths diff extraction requires new adapter method
          // adapter.__txnTouchedPaths() (internal, typed loosely) OR expose via
          // the txn callback's ctx parameter. Recommended: callback-param pattern:
          //   await adapter.withTransaction(async (ctx) => { ... }, { dryRun: true });
          // Then diff = await pipeline.computeDiff(adapter, ctx.touchedPaths);
          await original(args, projectDir);
        }, { dryRun: true });

        result = {
          data: {
            dry_run: true,
            command: cmd,
            args,
            diff,
            changes_summary: /* ... */,
          },
        };
      } else {
        result = await original(args, projectDir);
      }

      if (onFinalize) await onFinalize(cmd, args, result);
      return result;
    });
  };

  for (const cmd of mutationCommands) wrapHandler(cmd, true);
}
```

Note: this example surfaces an API-design decision for the planner. The `withTransaction` callback might receive a `ctx` parameter so pipeline can read `touchedPaths` after rollback. Alternatives:
1. **Callback-param pattern** (shown above): `withTransaction(async (ctx) => { ... })` — ctx.touchedPaths exposed. Breaks Phase 3 signature.
2. **Return-value pattern:** `withTransaction` returns `{ result, touchedPaths }` in dry-run mode. Breaks uniformity.
3. **Internal `__txnTouchedPaths()` method:** Typed loosely; only pipeline.ts uses it. Smallest API surface.

Claude's discretion per CONTEXT.md. **Recommendation:** Option 3 — keep Phase 3's `withTransaction(fn)` signature stable; add a non-public `__getTxnContext()` method that pipeline.ts reaches into. Document as pipeline-internal (prefix `__`). Conformance test asserts pipeline's diff matches actual shadow-dir contents.

### SDK Handler Migration — Before/After

```typescript
// sdk/src/query/named-docs.ts reportPut — Phase 4 (current)
export async function reportPut(args, projectDir, workstream) {
  const [name, ...bodyParts] = args;
  validateName(name);
  const adapter = await adapterFor(projectDir);
  const body = bodyParts.join(' ');
  const docPath = planningRelativePath(workstream ?? null, `reports/${name}.md`);
  await adapter.putRecord(docPath, body);  // ← will change
  return { data: { written: docPath, name } };
}

// sdk/src/query/named-docs.ts reportPut — Phase 5 (after D-12)
export async function reportPut(args, projectDir, workstream) {
  const [name, ...bodyParts] = args;
  validateName(name);
  const adapter = await adapterFor(projectDir);
  const body = bodyParts.join(' ');
  // Delegate path computation to adapter primitive
  await adapter.putNamedDoc('reports', name, body);
  // For workstream-prefixed callers: the workstream dimension lives in path
  // resolution, not in the category enum. MarkdownAdapter's putNamedDoc must
  // be workstream-aware OR the SDK handler passes pre-resolved path via a
  // wrapper method. Recommended: adapter.putNamedDoc is .planning/-relative
  // and SDK handler passes `${workstream_prefix}${category}` — Claude's
  // discretion per CONTEXT.md; locked by planner.
  return { data: { written: /* path */, name } };
}
```

The workstream dimension is NOT in D-13's `NamedDocCategory` union. The planner resolves this gap: either (a) the adapter's `putNamedDoc` takes an optional `workstream` parameter, or (b) SDK handlers compose `category` as `workstreams/<ws>/reports` before calling. Option (b) pushes workstream-logic into SDK (matches the Phase-5 "adapter stays thin" principle).

### Reentrant Lock Guard

```typescript
// adapters/markdown/index.ts acquireAdapterLock — Phase 5 extension (~10 LOC)

private activeTxn: TxnCtx | undefined;   // new instance field

private async acquireAdapterLock(lockPath: string): Promise<void> {
  // D-10: reentrant guard — in-memory check BEFORE filesystem lock
  if (this.activeTxn) return;  // same instance, same process — join

  const maxRetries = 10;
  const retryDelay = 200;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const fd = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
      await fd.writeFile(String(process.pid));
      await fd.close();
      this.lockSet.add(lockPath);
      return;
    } catch (err) {
      /* unchanged stale-lock detection + retry logic */
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pipeline.ts` clones `.planning/` via `cp -r` and diffs by re-reading | `pipeline.ts` uses `adapter.withTransaction({dryRun:true})` with shadow-dir tmpdir | Phase 5 Plan 2/4 | Removes full-tree copy; diff is O(touched) not O(tree). Enables BeadsAdapter dry-run (Phase 6) |
| `extractSection` line-scan for `^## ` at depth 2 only | Heading-depth walker (L2/L3/L4) with fenced-code + HTML-comment skipping | Phase 5 Plan 3 | AI-SPEC `### Evidence`, `### Threat Flags`, `#### Sub-point` anchors become addressable; Pattern 2 |
| `putNamedDoc` throws `UnsupportedCapabilityError` | `putNamedDoc(category, key, body)` with typed discriminated overload | Phase 5 Plan 1 | 11 SDK call-sites delegate path computation; D-15 grep-zero acceptance |
| `withTransaction` is lock-only (Phase 3) | `withTransaction` is lock + shadow-dir journal + rollback | Phase 5 Plan 2 | Pipeline dry-run hoists off fs; conformance dry-run test possible; BeadsAdapter maps to bd txn (Phase 6) |
| Sidecar paths read via raw `adapter.getRecord('.next-call-count')` | SDK verb `nextCallCountGet(adapter, workstream)` | Phase 5 Plan 4/5 | Sidecar lifecycle centralized; BeadsAdapter path-sniffs a closed set (Phase 6) |
| `*-DISCUSS-CHECKPOINT.json` and `*-QUESTIONS.json` owned by workflow md | First-class SDK verbs `discuss.checkpoint.*` + `discuss.questions.*` | Phase 5 Plan 4 | Noun-catalog complete per D-20; workflow tests use SDK verbs instead of raw paths |

**Deprecated/outdated:**

- `sdk/src/query/pipeline.ts:55-122` `collectFiles`, `copyPlanningTree`, `readPlanningState` — Phase 5 removes these in favor of shadow-dir touched-paths diff. Verify no other callers via grep; if any, migrate first.

## Assumptions Log

> All Phase 5 claims are verified against existing code (grep/read) or CITED from POSIX/CommonMark/TypeScript specs. The planner should still review the items below before locking plan-level decisions.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | [ASSUMED] `.planning/.tmp-txn/` is always on the same filesystem as `.planning/` (same-mount). True on all macOS/Linux setups where users run `gsd` inside a single repo. | Pattern 1, Pitfall 1 | Rename fails with EXDEV → txn loses atomicity. Mitigation: add conformance test asserting `fs.statSync(tmpdir).dev === fs.statSync(planningBase).dev` |
| A2 | [ASSUMED] No existing test in `tests/conformance/` monkeypatches `capabilities.*` fields. Based on grep of `tests/conformance/*.test.ts` for `capabilities\.`. | Pattern 1, D-18 graceful-degradation test | If monkeypatching pattern is absent, Plan 4 must establish it. Low risk (standard vitest mockInstance pattern). |
| A3 | [ASSUMED] Workstream-dimension is NOT a `NamedDocCategory` member. D-13 union doesn't mention workstreams. SDK handlers currently use `planningRelativePath(workstream, ...)` to prefix paths. | Pattern 3 TypeScript overload, Code Example "SDK Handler Migration" | If workstream needs to be in the category union, the overload + MarkdownAdapter path formula change. Recommend Plan 1 explicitly decides: category enum + separate workstream parameter OR compound category string `workstreams/<ws>/reports`. |
| A4 | [ASSUMED] BeadsAdapter does not exist in this repo as a stub. The Phase 6 code lives in sibling `~/code/gsd-beads`. | Don't Hand-Roll table, Architectural Responsibility Map | If bd adapter stubs are present, Phase 5 capability-flag flips might affect their tests. Verify with `find . -name 'beads' -type d`. Not critical — Phase 5 targets MarkdownAdapter only. |
| A5 | [ASSUMED] `mkdtemp` under `.planning/.tmp-txn/` doesn't get swept by other tooling (linters, git). git tracks `.planning/`; `.tmp-txn/*` names starting with `.` are git-ignored by default only if `.gitignore` is configured. | Pattern 1, Pitfall 4 | Stale tmpdir contents get committed. Mitigation: add `.planning/.tmp-txn/` to `.gitignore` in Plan 2. |
| A6 | [ASSUMED] `writeBinaryAsset` Bin-A-primitive style (no path validation) matches text primitive style. `putRecord` doesn't validate against `..` either; SDK handlers do via `validateName`. | Pitfall 6 | If security requires validation in the primitive, add it — but that's inconsistent with `putRecord`. Recommend consistency: no primitive-level validation; SDK-handler-level where needed. |
| A7 | [ASSUMED] There are no active spike branches or worktrees currently modifying `adapters/markdown/index.ts`. `git status` shows clean working tree; `.claude/worktrees/` contains vitest configs but their git state is unclear. | Runtime State Inventory | If a worktree has uncommitted changes to index.ts, Phase 5 plans may conflict. Verify before starting Plan 1. |

## Open Questions (RESOLVED)

1. **Should `withTransaction` callback receive a `TxnCtx` parameter, or should pipeline.ts use an internal `__getTxnContext()` method to fetch touched paths?**
   - What we know: Pipeline needs touched-paths set to compute diff in dry-run mode. Phase 3 locked `withTransaction(fn)` signature with no ctx param.
   - What's unclear: Breaking Phase 3's signature widens risk of downstream test churn; internal method is ugly but contained.
   - **RESOLVED:** Internal `__getTxnContext()` or `adapter.__currentTxn` property (underscore-prefix = pipeline-only). Ship in Plan 2; revisit if Phase 6 BeadsAdapter needs the ctx.

2. **Does `putNamedDoc` take a workstream parameter, or do SDK handlers pre-compose `workstreams/<ws>/<category>` as the category string?**
   - What we know: D-13 union is `'research'|'intel'|...|'root'`. Current SDK handlers call `planningRelativePath(workstream, path)`.
   - What's unclear: Adapter's `putNamedDoc('reports', name, body)` where workstream is active — path must include workstream prefix. Either (a) adapter accepts workstream as optional third arg, or (b) SDK handler passes `('workstreams/<ws>/reports' as any)` which defeats the union type.
   - **RESOLVED:** Plan 1 locks this. Preferred: (a) `putNamedDoc(category, key, body, opts?: { workstream?: string })`. Keeps category typed; workstream is an adapter-internal path concern.

3. **Should `.planning/.tmp-txn/` be created lazily on first txn, or eagerly at adapter construction?**
   - What we know: Adapter constructor is sync (D-03 from Phase 1). `mkdtemp` is async. Lazy creation on first `withTransaction` call avoids pre-creating when not needed.
   - **RESOLVED:** Lazy. Add `.planning/.tmp-txn/` to `.gitignore` eagerly.

4. **Is setext heading detection in D-08 a hard warning or just documented-behavior?**
   - What we know: D-08 says "detected setext raises a warning." Unclear whether that's `console.warn` or a thrown GSDError.
   - **RESOLVED:** `console.warn` (warn without interrupting). GSD repo content is author-controlled; drift to setext unlikely.

5. **How are existing Phase-3 `write-transaction.test.ts` cases affected by the reentrancy guard?**
   - What we know: Current test "concurrent transactions serialize" uses two separate `withTransaction` calls. Phase 5's reentrancy guard operates on same-instance; two calls from the same test are sequential, not concurrent.
   - **RESOLVED:** Verify current test still passes after D-10 addition. The test's second `withTransaction` starts AFTER the first resolves — not a reentrancy case. Should be green without modification.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | >=22.0.0 per engines | — |
| TypeScript (SDK compiler) | SDK build | ✓ | via `sdk/node_modules` | — |
| vitest | Conformance tests | ✓ | via `sdk/node_modules/.bin/vitest` | — |
| `node:fs/promises` `rename`, `rm`, `mkdtemp` | Shadow-dir impl | ✓ | Built-in | — |
| POSIX `rename(2)` same-mount atomicity | Shadow-dir commit correctness | ✓ | OS-level guarantee | Fail fast with error on `EXDEV` (see A1) |
| git | `commitPlanningState` (Phase 3 existing) | ✓ (verified via `package.json` scripts) | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (from `sdk/node_modules`) |
| Config file | `vitest.conformance.config.ts` (conformance); `adapters/vitest.config.ts` (unit); `sdk/vitest.config.ts` (sdk unit) |
| Quick run command | `cd sdk && npm run test` (SDK unit tests; ~30s) |
| Full suite command | `npm run test:conformance` (conformance tests) + `cd sdk && npm run test` + `npm run test:coverage` |
| Phase commit gate | `npm run test:conformance` green + `cd sdk && npm test` green |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRIMITIVES-01 | `updateSection` heading-depth walker writes at L2/L3/L4 | unit | `cd sdk && npx vitest run ../tests/conformance/section-depth.test.ts` | ❌ Wave 0 (new file) |
| PRIMITIVES-01 | `updateSection` under fenced code block | unit | same | ❌ Wave 0 |
| PRIMITIVES-01 | `updateSection` with three-author reordering (AI-SPEC) stays atomic | integration | `cd sdk && npx vitest run ../tests/conformance/section-depth.test.ts -t "three-author"` | ❌ Wave 0 |
| PRIMITIVES-02 | `getSection` returns body at L3/L4 anchors | unit | `cd sdk && npx vitest run ../tests/conformance/section-depth.test.ts -t "getSection L3"` | ❌ Wave 0 |
| PRIMITIVES-02 | `getSection` returns null when anchor missing | unit | same | ❌ Wave 0 |
| PRIMITIVES-03 | `withTransaction({dryRun:true})` rolls back all writes | unit | `npx vitest run tests/conformance/write-transaction.test.ts -t "dryRun rollback"` | ⚠️ extend existing |
| PRIMITIVES-03 | mid-txn failure leaves `.planning/` byte-identical | integration | `npx vitest run tests/conformance/write-transaction.test.ts -t "mid-txn failure"` | ⚠️ extend existing |
| PRIMITIVES-03 | nested `withTransaction` joins outer txn (reentrancy) | unit | `npx vitest run tests/conformance/write-transaction.test.ts -t "reentrant"` | ⚠️ extend existing |
| PRIMITIVES-03 | `snapshot()` returns opaque id; `restore(id)` rolls back | unit | `npx vitest run tests/conformance/write-transaction.test.ts -t "snapshot restore"` | ⚠️ extend existing |
| PRIMITIVES-04 | `putNamedDoc('research', 'foo', body)` then `getNamedDoc('research', 'foo')` round-trip | unit | `npx vitest run tests/conformance/named-doc.test.ts` | ❌ Wave 0 |
| PRIMITIVES-04 | `putNamedDoc('root', 'HANDOFF', body)` writes to `.planning/HANDOFF.md` | unit | same | ❌ Wave 0 |
| PRIMITIVES-04 | `@ts-expect-error` — `putNamedDoc('root', 'ARBITRARY', ...)` rejected at compile | static | `cd sdk && tsc --noEmit` inside test file | ❌ Wave 0 |
| PRIMITIVES-04 | All 8 categories round-trip; D-15 grep-zero for legacy kind-tagged names | unit + grep | above + `! grep -rn "getResearch\|putIntelDoc\|putCodebaseDoc\|getArchivedMilestoneDoc" sdk/src/ adapters/` | ❌ Wave 0 |
| PRIMITIVES-05 | `writeBinaryAsset('foo.png', bytes)` writes bytes verbatim | unit | `npx vitest run tests/conformance/binary-asset.test.ts` | ❌ Wave 0 |
| PRIMITIVES-05 | `capabilities.binaryAsset === true` after Phase 5 | unit | same | ❌ Wave 0 |
| PRIMITIVES-05 | Graceful-degradation when `capabilities.binaryAsset=false` (monkeypatch) | unit | `npx vitest run tests/conformance/binary-asset.test.ts -t "graceful"` | ❌ Wave 0 |
| PRIMITIVES-06 | Multi-author `updateSection` under concurrent writes serializes | integration | `npx vitest run tests/conformance/write-transaction.test.ts -t "updateSection concurrency"` | ⚠️ extend existing |
| PRIMITIVES-07 | ADR in `.planning/DECISIONS.md` records OQ-02 resolution | manual | grep: `grep -n "OQ-02" .planning/DECISIONS.md` | N/A (doc artifact) |
| PRIMITIVES-08 | `nextCallCountGet` reads `.next-call-count`; `route-next-action.ts:44` uses helper | unit | `cd sdk && npx vitest run src/query/sidecar.test.ts` + grep | ❌ Wave 0 (new file) |
| PRIMITIVES-09 | `discuss.checkpoint.put/get/delete` + `discuss.questions.put/get/delete` round-trip | unit | `cd sdk && npx vitest run src/query/scratch.test.ts` | ❌ Wave 0 (new file) |
| SC #1 (dry-run byte-identical) | `pipeline.ts` dry-run with mid-txn failure leaves `.planning/` byte-identical | integration | `cd sdk && npx vitest run src/query/pipeline.test.ts -t "mid-txn failure byte-identical"` | ⚠️ extend existing |
| SC #2 (AI-SPEC three-author) | Three concurrent updateSection calls serialize and all complete | integration | `npx vitest run tests/conformance/section-depth.test.ts -t "three-author"` | ❌ Wave 0 |
| SC #3 (putNamedDoc grep-zero) | Grep for legacy kind-tagged names returns empty | grep | `! grep -rn "getResearch\|putIntelDoc\|putCodebaseDoc\|getArchivedMilestoneDoc" sdk/src/ adapters/` | N/A (CI gate) |
| SC #4 (binaryAsset capability + graceful deg) | `capabilities.binaryAsset=true` AND monkeypatched-false graceful path works | unit | `npx vitest run tests/conformance/binary-asset.test.ts` | ❌ Wave 0 |
| SC #5 (OQ ADRs recorded) | DECISIONS.md contains ADRs for OQ-02, OQ-05, OQ-07, OQ-10 | manual | `grep -n "OQ-02\|OQ-05\|OQ-07\|OQ-10" .planning/DECISIONS.md` | N/A (doc artifact) |

### Sampling Rate

- **Per task commit:** `cd sdk && npm run test` (SDK unit tests, ~30s)
- **Per wave merge:** `npm run test:conformance && cd sdk && npm run test` (full suite, ~60-90s)
- **Phase gate:** Full suite green + `grep` gates for D-15 and OQ-ADR presence before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/conformance/section-depth.test.ts` — covers PRIMITIVES-01, PRIMITIVES-02, SC#2 (L2/L3/L4 anchors, fenced-code, HTML-comment, three-author concurrency)
- [ ] `tests/conformance/named-doc.test.ts` — covers PRIMITIVES-04, SC#3 (8-category round-trip, typed-overload compile assertion)
- [ ] `tests/conformance/binary-asset.test.ts` — covers PRIMITIVES-05, SC#4 (write, capability flip, graceful degradation)
- [ ] `sdk/src/query/sidecar.test.ts` — covers PRIMITIVES-08 (nextCallCountGet/Incr)
- [ ] `sdk/src/query/scratch.test.ts` — covers PRIMITIVES-09 (discuss.checkpoint.*, discuss.questions.*)
- [ ] **Extend** `tests/conformance/write-transaction.test.ts` — cases: dryRun rollback, mid-txn failure byte-identical, reentrancy, snapshot/restore, updateSection concurrency, nested dryRun propagation
- [ ] **Extend** `sdk/src/query/pipeline.test.ts` — dryRun via withTransaction, mid-txn failure byte-identical SC#1
- [ ] No new framework install needed — vitest already configured
- [ ] ADR template for OQ-02/05/07/10 in `.planning/DECISIONS.md` (final plan)

**Mid-transaction failure injection — concrete pattern:**

```typescript
// tests/conformance/write-transaction.test.ts — new case
it('mid-txn failure leaves .planning/ byte-identical to pre-txn state', async () => {
  // Seed: write STATE.md + PROJECT.md
  await adapter.putRecord('STATE.md', '# pre-txn state\n');
  await adapter.putRecord('PROJECT.md', '# pre-txn project\n');
  const beforeState = await readFile(join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
  const beforeProject = await readFile(join(tmpDir, '.planning', 'PROJECT.md'), 'utf-8');

  // Compute SHA of the whole .planning/ directory tree as canonical byte-identity marker
  const beforeHash = await hashDir(join(tmpDir, '.planning'));

  // Run txn that writes two files then throws mid-way
  await expect(
    adapter.withTransaction(async () => {
      await adapter.putRecord('STATE.md', '# mutated\n');
      await adapter.putRecord('PROJECT.md', '# also mutated\n');
      throw new Error('intentional mid-txn failure');
    })
  ).rejects.toThrow('intentional mid-txn failure');

  // Verify byte-identical
  const afterHash = await hashDir(join(tmpDir, '.planning'));
  expect(afterHash).toBe(beforeHash);
  expect(await readFile(join(tmpDir, '.planning', 'STATE.md'), 'utf-8')).toBe(beforeState);
  expect(await readFile(join(tmpDir, '.planning', 'PROJECT.md'), 'utf-8')).toBe(beforeProject);

  // And the shadow-dir tmpdir is cleaned up
  const tmpTxnEntries = await readdir(join(tmpDir, '.planning'), { withFileTypes: true });
  expect(tmpTxnEntries.filter(e => e.name.startsWith('.tmp-txn')).length).toBe(0);
});

// Helper: recursively hash a directory tree
async function hashDir(dir: string): Promise<string> {
  const crypto = await import('node:crypto');
  const { readdir, readFile, stat } = await import('node:fs/promises');
  const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
  const h = crypto.createHash('sha256');
  for (const e of entries) {
    const p = join(dir, e.name);
    h.update(e.name);
    if (e.isFile()) h.update(await readFile(p));
    else if (e.isDirectory()) h.update(await hashDir(p));
  }
  return h.digest('hex');
}
```

This pattern (hash-based byte-identity assertion) is the canonical test for SC#1 and applies to any rollback scenario.

## Security Domain

> `security_enforcement` config key not set in `.planning/config.json`. Treating as enabled per Nyquist default. Phase 5's security surface is narrow: path-safety and filesystem isolation.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not applicable — local-filesystem library |
| V3 Session Management | no | Not applicable |
| V4 Access Control | partial | Shadow-dir tmpdir directory permissions (see below) |
| V5 Input Validation | yes | Path-traversal checks on `putNamedDoc`/`writeBinaryAsset` arguments; reject `..` and absolute paths |
| V6 Cryptography | no | No crypto operations. sha256 for test hashing only, not security. |

### Known Threat Patterns for adapter/filesystem stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `..` in `putNamedDoc(category, '../../etc/passwd', body)` | Tampering | Validate `key` against `[A-Za-z0-9._-]+` at adapter level, or reuse SDK `validateName` pattern. Recommended: adapter-level for `putNamedDoc` since it's the "named" primitive; raw `putRecord` stays unvalidated (caller's responsibility) consistent with existing Bin A primitives. |
| Absolute path injection in `writeBinaryAsset('/etc/passwd', bytes)` | Tampering | Same validation pattern. Reject paths starting with `/` or `~`. |
| Symbolic-link attack in shadow-dir tmpdir (`.planning/.tmp-txn/`) | Tampering | Use `mkdtemp()` which creates with mode `0o700`. Never follow symlinks during commit — `fs.rename` on a symlink renames the symlink, not its target, which is the desired behavior here. |
| Shadow-dir lingering after crash | Info Disclosure | Plans 2 adds `.planning/.tmp-txn/` to `.gitignore`. Adapter's next `withTransaction` call sweeps any stale `.tmp-txn-*` subdirectories (skip PIDs that still map to live processes — reuse `isLockStale` pattern from line 368-375). |
| Race between `acquireAdapterLock` and reentrancy check | TOCTOU | Reentrancy check is pure in-memory `this.activeTxn` read — no race since JS is single-threaded. Cross-process race is still handled by `O_EXCL|O_CREAT` on `.adapter.lock`. |

## Sources

### Primary (HIGH confidence)

- **Current Phase-4-shipped codebase state** — verified via file reads:
  - `/Volumes/code/get-shit-done/adapters/markdown/index.ts` (857 lines)
  - `/Volumes/code/get-shit-done/adapters/types.ts` (105 lines)
  - `/Volumes/code/get-shit-done/sdk/src/query/pipeline.ts` (255 lines)
  - `/Volumes/code/get-shit-done/sdk/src/query/named-docs.ts` (171 lines)
  - `/Volumes/code/get-shit-done/sdk/src/query/codebase-docs.ts` (96 lines)
  - `/Volumes/code/get-shit-done/sdk/src/query/tmp-docs.ts` (82 lines)
  - `/Volumes/code/get-shit-done/sdk/src/query/route-next-action.ts` (379 lines)
  - `/Volumes/code/get-shit-done/tests/conformance/write-transaction.test.ts` (111 lines)
  - `/Volumes/code/get-shit-done/tests/conformance/adapter.conformance.ts` (89 lines)

- **CONTEXT.md (D-01 through D-21)** — 21 locked decisions verbatim copied above.

- **`.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/DECISIONS.md`** — project state and locked decisions.

- **POSIX `rename(2)` specification** — atomicity guarantees [CITED: https://pubs.opengroup.org/onlinepubs/9699919799/functions/rename.html]

- **CommonMark 0.31.2 ATX-heading spec** — heading depth parsing rules [CITED: https://spec.commonmark.org/0.31.2/#atx-headings]

- **TypeScript function overloads handbook** — discriminated overload signature pattern [CITED: https://www.typescriptlang.org/docs/handbook/2/functions.html#function-overloads]

- **Node.js `fs.rename` documentation** — platform atomicity behavior [CITED: https://nodejs.org/api/fs.html#fspromisesrenameoldpath-newpath]

### Secondary (MEDIUM confidence)

- **SQLite WAL checkpoint pattern** — inspired the touched-paths-only commit [CITED: https://www.sqlite.org/wal.html]. Not directly applicable (WAL is more complex) but the "shadow writes merged into main on commit" pattern maps closely.

- **Phase 3 RESEARCH.md** — carries forward lock-file and `withTransaction` design language.

### Tertiary (LOW confidence)

- None. All claims tracked to primary or secondary sources; assumptions tagged explicitly in Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are built-in Node; versions verified in package.json
- Architecture (shadow-dir journal): HIGH — pattern derived from POSIX rename + SQLite WAL; test plan covers atomicity
- Architecture (heading-depth walker): HIGH — CommonMark spec + line-walker frame already exists
- Architecture (discriminated overloads): HIGH — TypeScript standard pattern
- Reentrant lock: HIGH — in-memory flag check is trivially race-free in single-threaded JS
- Pipeline refactor: MEDIUM — API shape for touched-paths exposure is an open question (OQ-1 above)
- SDK handler migration: HIGH — 11 call sites enumerated; mechanical transformation
- Conformance test extensions: MEDIUM — byte-identity hash helper needs Plan 2 to implement and verify

**Research date:** 2026-05-10
**Valid until:** 2026-06-09 (30 days — stable technology, no fast-moving dependencies)
