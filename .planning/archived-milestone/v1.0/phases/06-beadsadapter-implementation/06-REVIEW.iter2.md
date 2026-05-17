---
phase: 06-beadsadapter-implementation
reviewed: 2026-05-12T00:00:00Z
depth: standard
files_reviewed: 45
files_reviewed_list:
  - /Volumes/code/gsd-beads/.gitignore
  - /Volumes/code/gsd-beads/CLAUDE.md
  - /Volumes/code/gsd-beads/CONTRIBUTING.md
  - /Volumes/code/gsd-beads/README.md
  - /Volumes/code/gsd-beads/package.json
  - /Volumes/code/gsd-beads/tsconfig.json
  - /Volumes/code/gsd-beads/vitest.config.ts
  - /Volumes/code/gsd-beads/src/_atomicWrite.ts
  - /Volumes/code/gsd-beads/src/bd/errors.ts
  - /Volumes/code/gsd-beads/src/bd/findRoot.ts
  - /Volumes/code/gsd-beads/src/bd/helper.ts
  - /Volumes/code/gsd-beads/src/capabilities.ts
  - /Volumes/code/gsd-beads/src/dep-graph.ts
  - /Volumes/code/gsd-beads/src/errors.ts
  - /Volumes/code/gsd-beads/src/events.ts
  - /Volumes/code/gsd-beads/src/format/frontmatter.ts
  - /Volumes/code/gsd-beads/src/format/phase.ts
  - /Volumes/code/gsd-beads/src/format/schemas/ai-spec.ts
  - /Volumes/code/gsd-beads/src/format/schemas/context.ts
  - /Volumes/code/gsd-beads/src/format/schemas/debug-session.ts
  - /Volumes/code/gsd-beads/src/format/schemas/decisions.ts
  - /Volumes/code/gsd-beads/src/format/schemas/index.ts
  - /Volumes/code/gsd-beads/src/format/schemas/plan.ts
  - /Volumes/code/gsd-beads/src/format/schemas/project.ts
  - /Volumes/code/gsd-beads/src/format/schemas/requirements.ts
  - /Volumes/code/gsd-beads/src/format/schemas/roadmap.ts
  - /Volumes/code/gsd-beads/src/format/schemas/spec.ts
  - /Volumes/code/gsd-beads/src/format/schemas/uat.ts
  - /Volumes/code/gsd-beads/src/format/schemas/verification.ts
  - /Volumes/code/gsd-beads/src/format/section.ts
  - /Volumes/code/gsd-beads/src/format/state.ts
  - /Volumes/code/gsd-beads/src/helpers/deriveDiskStatus.ts
  - /Volumes/code/gsd-beads/src/helpers/detectDrift.ts
  - /Volumes/code/gsd-beads/src/helpers/loadMilestoneHeading.ts
  - /Volumes/code/gsd-beads/src/helpers/parsePhaseId.ts
  - /Volumes/code/gsd-beads/src/index.ts
  - /Volumes/code/gsd-beads/src/init.ts
  - /Volumes/code/gsd-beads/src/paths.ts
  - /Volumes/code/gsd-beads/src/primitives.ts
  - /Volumes/code/gsd-beads/src/txn.ts
  - /Volumes/code/gsd-beads/tests/conformance.test.ts
  - /Volumes/code/gsd-beads/tests/fixture.ts
  - /Volumes/code/get-shit-done/adapters/types.ts
  - /Volumes/code/get-shit-done/adapters/markdown/index.ts
  - /Volumes/code/get-shit-done/package.json
  - /Volumes/code/get-shit-done/tests/conformance/tsconfig.json
  - /Volumes/code/get-shit-done/vitest.config.ts
findings:
  critical: 4
  warning: 9
  info: 6
  total: 19
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-05-12
**Depth:** standard
**Files Reviewed:** 45 (sibling-side + fork-side contract additions)
**Status:** issues_found

## Summary

Phase 6 ships a substantial, well-documented BeadsAdapter implementation with
clear landmine-fix discipline. However, the CR-01 path-traversal guard has a
genuine symlink-escape gap, the blocker-label dedupe keyspace is halved by
`Math.abs` and narrow by design (32-bit djb2), `parseRequirementsBody` pushes
placeholder objects into typed arrays on every fence toggle, `formatState`
contains a tautological trailing-newline expression, and a concurrent-caller
interleaving hazard exists in `withTransaction`. The Bin A contract asymmetry
for phase-addressed writes (getRecord handles; putRecord throws) and the
`_resolveMilestoneBead` reliance on multi-`-l` AND semantics round out the
high-signal findings.

Focus-area verification matrix (from CONTEXT):

| Focus area | Finding |
|---|---|
| CR-01 path-traversal guard | **Partial** — symlink-escape gap confirmed (CR-01-A) |
| StateWriteOutcome three-state discipline | **OK** — all branches return valid discriminants |
| BdRunner shell-injection | **OK** — `spawnSync(bd, args, ...)` with no `shell: true`; argv-based |
| Exhaustive `never` switches | **OK** — all three event families + SectionMode |
| Dep-graph synthesizer edge validation | **OK** — filters by `type === 'blocks'` per Spike 014 |

## Critical Issues

### CR-01: Symlink-escape gap in `_abs()` path-traversal guard

**File:** `/Volumes/code/gsd-beads/src/primitives.ts:67-94`
**Issue:** The CR-01 guard uses `path.resolve()` which does NOT follow symlinks.
If any directory inside `projectRoot` is (or becomes) a symlink pointing outside
the root, a caller passing a path like `my-symlink/target.md` will pass the
`startsWith(root + pathSep)` check (because the resolved path is lexically
`projectRoot/my-symlink/target.md`) but the actual `writeFileSync`/`readFileSync`
syscall follows the symlink and touches a file OUTSIDE the sandbox. The guard's
own comment claims coverage for "any symlink-resolved path that escapes root"
but no `realpathSync` is ever invoked on intermediate components. The unused
import `pathRelative` (line 34, line 468 `void pathRelative`) is reserved for
"Plan 06-07 hardening" per the trailing comment — this hardening has not
shipped. On macOS/Linux the attack surface is real: an attacker who can place
a symlink anywhere under `.planning/` (or any ancestor the adapter touches)
can use the disk-tier primitives to read or clobber arbitrary filesystem
paths.

CONTEXT explicitly calls this out as a focus area ("verify the guard
runtime-active + covers POSIX + Windows + symlink escapes"); the guard does
NOT cover symlink escapes.

**Fix:** Apply `realpathSync` to the parent directory of `abs` (or to `abs`
itself if it exists) and re-check containment. For write paths where the
target may not yet exist, realpath the deepest existing ancestor and verify
the canonical path of each intermediate component stays inside
`realpathSync(projectRoot)`. Minimum viable patch:

```ts
import { realpathSync, existsSync } from 'node:fs';

export function _abs(projectRoot: string, relPath: string): string {
  // ... existing length/absolute-path guards unchanged ...
  const root = realpathSync(pathResolve(projectRoot));
  const abs = pathResolve(projectRoot, relPath);
  // Walk up from abs to the deepest existing component and realpath it.
  let probe = abs;
  while (probe !== dirname(probe) && !existsSync(probe)) {
    probe = dirname(probe);
  }
  const canonical = existsSync(probe) ? realpathSync(probe) : probe;
  if (canonical !== root && !canonical.startsWith(root + pathSep)) {
    throw new TypeError(
      `BeadsAdapter: path '${relPath}' resolves via symlink outside projectRoot`,
    );
  }
  // The rest of abs (post-probe) is guaranteed non-existent so no symlinks
  // can be introduced below it at this instant. (TOCTOU race remains; the
  // actual write should be at a component that was realpath-verified.)
  return abs;
}
```

---

### CR-02: `_deriveEventId` produces halved, narrow keyspace for blocker-label identity

**File:** `/Volumes/code/gsd-beads/src/events.ts:117-124`
**Issue:** `_deriveEventId` is used to derive the LABEL suffix for
`blocker_added`/`blocker_resolved` mutation events (lines 350, 370):

```ts
const label = `gsd:blocker:${_deriveEventId({ text: event.payload.text })}`;
```

The hash is a 32-bit signed djb2 (`h | 0`) folded through `Math.abs()` and
rendered as base-36. Two independent issues:

1. `Math.abs(h)` over a signed 32-bit int collapses `h` and `-h` to the same
   key — blocker text `A` and blocker text `B` where `hash(A) === -hash(B)`
   produce IDENTICAL labels. This halves the effective keyspace below the
   already-narrow 31 bits.
2. `Math.abs(-2147483648) === -2147483648` in JS (JS integer-abs doesn't
   promote to BigInt) — the most-negative value is a fixed point; `(-2^31)
   .toString(36)` produces a negative string containing '-' which becomes an
   invalid/ambiguous label fragment if it ever lands there.

Consequences under `recordStateMutation`:

- Two distinct blockers with colliding hashes → second `blocker_added` returns
  `{ applied: false, reason: 'duplicate' }` silently — the blocker is
  SILENTLY LOST.
- `blocker_resolved` on blocker A removes label `gsd:blocker:X`; if blocker B
  hashed to the same X, bloker B's label is ALSO removed silently —
  RESOLVING-THE-WRONG-BLOCKER.

The JSDoc for `_deriveEventId` acknowledges collision false-positives as
"dedupe duplicate" (line 116), but that reasoning applies to APPEND semantics
where duplicate is benign. For mutation labels — where the label IS the
dedupe primary key — silent loss is a correctness failure.

**Fix:** Use a full cryptographic or 128-bit hash. Cheapest option:

```ts
import { createHash } from 'node:crypto';
function _deriveEventId(payload: unknown): string {
  const json = JSON.stringify(payload) ?? '';
  return createHash('sha256').update(json).digest('hex').slice(0, 16);
}
```

64 bits of entropy (16 hex chars) gives birthday-collision probability < 1
per ~4 billion distinct events — safe for human-generated blocker counts. If
label length matters, use base-64url or base-36 of 10 bytes. Also: SHA-256 is
not the bottleneck; bd spawns dominate wall time.

---

### CR-03: `parseRequirementsBody` pushes `{}` placeholder into typed arrays on fence toggle

**File:** `/Volumes/code/gsd-beads/src/format/schemas/requirements.ts:69-78`
**Issue:**

```ts
if (/^```/.test(line)) {
  inFence = !inFence;
  (current ? current.items : proseLines).push({} as never); // no-op marker placeholder
  if (!current) proseLines.push(line);
  continue;
}
```

Every time a fenced code block opens or closes while inside a category, an
EMPTY OBJECT `{}` is cast `as never` and pushed into `current.items`. The
cast silences the type checker; the runtime array now contains heterogeneous
entries (real `RequirementItem`s + bogus `{}` placeholders). Any downstream
consumer iterating `.items` will trip on entries with no `done`/`id`/`description`
fields.

When not inside a category (`!current`), the code pushes `{} as never` into
`proseLines` (a `string[]`) — then in the next statement pushes the actual
line. Result: `proseLines` contains an empty object followed by the fence
line, polluting string-join operations like `proseLines.join('\n').trim()`
with `[object Object]` fragments.

The `// no-op marker placeholder` comment suggests a scaffold that was
abandoned. The entire placeholder push is dead-wrong; the intended behavior
is "toggle `inFence` and preserve the fence line in prose if outside a
category."

**Fix:**

```ts
if (/^```/.test(line)) {
  inFence = !inFence;
  if (!current) proseLines.push(line);
  continue;
}
```

Delete the placeholder push. Also: `current.items` loses nothing from this
fix — a fence-delimiting line is not a requirement item and has no place in
the typed array anyway.

---

### CR-04: `withTransaction` concurrent-caller interleaving contaminates shared buffer

**File:** `/Volumes/code/gsd-beads/src/txn.ts:162-250`
**Issue:** `withTransaction` treats re-entry and concurrency as the same
case. When depth is already > 0, a new call JOINs the existing buffer. JS is
single-threaded but `async` awaits interleave freely; any two unrelated
`adapter.recordStateAppend(...)` / `adapter.recordStateMutation(...)` calls
issued WITHOUT awaiting the first will both see `depth > 0` (the second
runs during the first's await) and SHARE the buffer.

Scenario:

```ts
const a = adapter.recordStateAppend(sessionEvent);   // starts, awaits bd
const b = adapter.recordStateMutation(blockerEvent); // starts during a's await
await Promise.all([a, b]);
```

1. `a` opens outer txn, `depth=1`, allocates `ctx.buffer = []`.
2. `a` awaits `_getCurrentMilestone` / `_resolveMilestoneBead` (bd spawn).
3. `b` enters `withTransaction`, sees `depth=1`, treats as nested, JOINS
   buffer, `depth=2`.
4. `b` queues its label op → lands in `a`'s buffer.
5. `b`'s fn resolves → `depth=1`, `b` awaits its outer `return { applied: true }`.
6. `a`'s fn resolves → `b`'s buffered op gets committed as part of `a`'s
   commit phase, but `a` will THROW BeadsPartialCommitError if any of those
   ops fail — callers see the failure attributed to the wrong event.

Worse: if `b` had thrown (e.g., `BeadsEmpty`), the catch handler in the inner
`fn()` path does NOT clear the buffer — `ctx.depth--` runs in finally, and
`a`'s ops can still land on commit. But `b` reports `applied: false`
semantically even though buffered ops may already be in `ctx.buffer` from
`b`'s pre-throw work.

The MarkdownAdapter shadow-dir analog explicitly states "reentrant — join
outer txn" (index.ts:523-533) and holds a single adapter-lock (EEXCL
filesystem lock) to serialize across PIDs. BeadsAdapter has NO equivalent
mutual-exclusion primitive for INTRA-process concurrent callers and relies
on them to await sequentially. This invariant is NOT documented and NOT
enforced by the type system.

**Fix:** Either (a) serialize with an async mutex (keyed by BdRunner
instance) so concurrent `withTransaction` entries await each other and behave
like two sequential transactions, or (b) document that BeadsAdapter method
calls MUST NOT interleave at await points and fail-fast if a second txn
starts while one is already open from a DIFFERENT call stack. Minimal (a):

```ts
const txnLocks = new WeakMap<BdRunner, Promise<void>>();

export async function withTransaction<T>(
  state: BeadsRuntimeState,
  fn: () => Promise<T>,
  opts?: { dryRun?: boolean },
): Promise<T> {
  const bd = state.bd;
  const existing = txnLocks.get(bd);
  let release: () => void = () => {};
  const next = new Promise<void>(r => (release = r));
  txnLocks.set(bd, (existing ?? Promise.resolve()).then(() => next));
  if (existing) await existing;
  try {
    // ... existing body here (buffer / replay / discard) ...
  } finally {
    release();
  }
}
```

This serializes concurrent callers while preserving the intra-call reentrant
semantics (a `withTransaction` nested inside an already-running `withTransaction`
must still JOIN — detect via a separate call-stack-scoped flag if the
existing runner matches).

## Warnings

### WR-01: `_resolveMilestoneBead` assumes `bd list -l A -l B` is AND semantics

**File:** `/Volumes/code/gsd-beads/src/events.ts:87-104`
**Issue:** The resolver passes TWO `-l` flags (`gsd:milestone` AND
`version:v1.0`) expecting `bd` to intersect. Nothing in CLAUDE.md, the
README, or the bd-primitive spike documentation confirms `bd list` performs
AND across repeated `-l`. If `bd` treats repeated `-l` as OR (union), every
milestone bead across all versions is returned and `items[0]` is arbitrary —
subsequent `recordStateAppend` / `recordStateMutation` calls could append to
the WRONG milestone. This is a one-line unit test ("`bd list -l A -l B`
against a seed with two distinct `A`-labeled beads with distinct `B` values
returns intersection") that is not documented as covered.

**Fix:** Add an explicit smoke test asserting AND semantics against live bd
v1.0.4; OR fall back to a post-filter:

```ts
const raw = state.bd.run(['list', '-l', 'gsd:milestone', '--json', '--all', '-n', '0']);
const items = (Array.isArray(raw) ? raw : []) as Array<{ id: string; labels?: string[] }>;
const match = items.find(it => (it.labels ?? []).includes(`version:${milestoneKey}`));
return match ? match.id : null;
```

Post-filter is 1 spawn, same as current; the guarantee is explicit.

---

### WR-02: `formatState` contains tautologically-empty expression

**File:** `/Volumes/code/gsd-beads/src/format/state.ts:255`
**Issue:**

```ts
return appended.join('\n') + (body.endsWith('\n') ? '' : '');
```

Both ternary branches return `''`. Intent appears inverted: the trailing
newline SHOULD be preserved when the original body had one. As written, no
trailing newline is ever appended. This will cause round-trip byte drift for
any STATE.md that originally ended with `\n` — the rewritten file omits the
final newline, and subsequent parsers that require trailing-newline
discipline (many unix tools, git diffs) will flag it.

**Fix:**

```ts
return appended.join('\n') + (body.endsWith('\n') ? '\n' : '');
```

---

### WR-03: `removeRecord`/`removeCollection` bd-tier ignore `route.phase`/`route.plan`

**File:** `/Volumes/code/gsd-beads/src/primitives.ts:195-258`
**Issue:** For phase-addressed paths (e.g. `phases/06-foo/06-01-PLAN.md`),
`resolveRoute` returns `{ tier: 'bd', label: undefined /* or gsd:plan */,
phase: '06-foo', plan: '01' }`. But `removeRecord` and `removeCollection`
only guard on `route.tier === 'bd' && route.label` — for phase-document
kinds (`phase-context`, `phase-plan`, etc.), `route.label` is undefined, so
these fall through to `_abs(...) + unlinkSync/rmSync` on the disk side. If
the file happens not to exist on disk (because the body was stored in bd),
the remove silently succeeds even though the bd record is untouched. This
creates a phantom-persistence bug: "I removed the phase but the bead is
still there."

Cross-reference: the SAME contract on `putRecord` explicitly throws
`"phase-addressed bd writes not implemented in Bin A (Plan 06-06)"` —
creating a DIFFERENT contract asymmetry. Reads work (getRecord finds the
bd bead); writes and removes do different things.

**Fix:** Make the three ops consistent. Either implement phase-addressed bd
writes/removes (route on `route.kind === 'phase-*'` and dispatch to bd list
with the phase/plan label match) or throw on the read path too so callers
see a unified UnsupportedCapabilityError pattern. Until implemented:

```ts
if (route.tier === 'bd' && !route.label) {
  throw new Error(
    `BeadsAdapter.removeRecord: phase-addressed bd removes not implemented (Plan 06-06 scope). Path: ${path}`,
  );
}
```

Parallels the putRecord guard and surfaces the gap loudly instead of
silently no-op'ing.

---

### WR-04: `_bufferContainsRememberKey` indexOf-without-guard logic hazard

**File:** `/Volumes/code/gsd-beads/src/events.ts:162-166, 397-401`
**Issue:**

```ts
const keyIdx = op.args.indexOf('--key');
if (keyIdx === -1 || keyIdx + 1 >= op.args.length) return false;
return op.args[keyIdx + 1] === key;
```

The first `_bufferContainsRememberKey` call-site guards correctly. But line
398-401:

```ts
const bufOps = peekBuffer(state.bd).filter(
  (op) =>
    op.kind === 'remember' &&
    op.args.length >= 4 &&
    op.args[op.args.indexOf('--key') + 1] === key,
);
```

When `indexOf('--key') === -1`, expression evaluates `op.args[0] === key`.
`op.args[0]` for a `'remember'` op is literally the string `"remember"`. As
long as the dedupe key doesn't equal `"remember"` this is safe, but the
inconsistency with the guarded variant is a latent trap — if someone adds a
new buffered-op kind that happens to not have `--key`, the check silently
decays. The inline filter should reuse the same guard (or extract a helper):

**Fix:** Extract a single `hasKeyArg(op: BufferedOp, key: string)` helper
and call it in both places. Or at minimum:

```ts
const bufOps = peekBuffer(state.bd).filter((op) => {
  if (op.kind !== 'remember') return false;
  const idx = op.args.indexOf('--key');
  if (idx === -1 || idx + 1 >= op.args.length) return false;
  return op.args[idx + 1] === key;
});
```

---

### WR-05: `atomicWriteFile` does not `fsync` before rename; crash-window gap on non-journaled FS

**File:** `/Volumes/code/gsd-beads/src/_atomicWrite.ts:42-49`
**Issue:** The POSIX-rename atomicity comment holds for CONCURRENT READERS
but not for CRASH RECOVERY. If the process dies between `writeFileSync(tmp)`
and `renameSync(tmp, abs)`, the tmpfile is leaked. Worse: if the system
crashes before the tmpfile's data pages are flushed to disk (not merely
after rename), fsck can recover an EMPTY file at the target — the rename
atomic-replaced an empty inode. The sibling's v0.2 code made the same
tradeoff and CONTEXT notes Pitfall 7 was inherited.

For bd store parity this is probably tolerable (bd itself uses SQLite/Dolt
which have their own WAL discipline); for disk-tier `STATE.md` / `ROADMAP.md`
writes this matches MarkdownAdapter Pitfall-7 status. Flag-only; not a
regression from v0.2.

**Fix (if elevated priority later):**

```ts
import { writeFileSync, renameSync, mkdirSync, openSync, fsyncSync, closeSync } from 'node:fs';

const fd = openSync(tmpPath, 'w');
try {
  writeFileSync(fd, body);
  fsyncSync(fd);
} finally {
  closeSync(fd);
}
renameSync(tmpPath, absPath);
```

Add fsync of the containing DIRECTORY too on Linux for full crash-safety;
skipped in MarkdownAdapter as well per v0.2 Pitfall-7 triage.

---

### WR-06: `formatFrontmatter` double-casts unknown to FrontmatterValue without runtime validation

**File:** `/Volumes/code/gsd-beads/src/primitives.ts:390`
**Issue:**

```ts
(frontmatter as Record<string, FrontmatterValue>)[field] = value as FrontmatterValue;
```

`updateFrontmatter(path, field, value)` takes `value: unknown`. The cast
`value as FrontmatterValue` silences TypeScript but offers no runtime
guarantee. If a caller passes a non-YAML-serializable value (a function, a
Symbol, a class instance), js-yaml's `dump` will throw or (worse) emit a
`!!js/function` tag that subsequent `load` calls reject. Callers with
user-controlled frontmatter payloads can crash the write or produce
unparseable YAML.

**Fix:** Add a runtime guard or a structured-clone check:

```ts
function assertFrontmatterValue(v: unknown): asserts v is FrontmatterValue {
  // Cheap check: JSON.stringify round-trip rejects functions and symbols
  try { JSON.stringify(v); }
  catch (e) { throw new TypeError(`updateFrontmatter: value is not JSON-serializable: ${String(e)}`); }
}
```

Alternatively, narrow the public signature to `value: FrontmatterValue` on
the adapter method so callers get a compile-time error.

---

### WR-07: `findBeadsRoot` skips realpath on `BEADS_DIR` path when metadata.json missing

**File:** `/Volumes/code/gsd-beads/src/bd/findRoot.ts:37-48`
**Issue:** If `BEADS_DIR` is set but points to a directory without
`metadata.json`, the function silently falls through to the parent-walk
(line 49) using `start` not `envDir`. This masks configuration errors — a
user who misconfigures `BEADS_DIR` (typo, stale) gets silent wrong-root
resolution instead of a "BEADS_DIR invalid" signal. `BeadsAdapter.init()`
has no visibility into this because it only sees the final resolved root.

**Fix:** When `BEADS_DIR` is set but invalid, throw an explicit error
rather than falling through. Matches the fail-loud pattern of the
BdManagedMismatchError elsewhere.

```ts
if (envDir) {
  const resolved = (() => { try { return realpathSync(resolve(envDir)); } catch { return null; } })();
  if (!resolved || !existsSync(join(resolved, 'metadata.json'))) {
    throw new BdManagedMismatchError(envDir, 'BEADS_DIR is set but does not point to a bd-managed directory.');
  }
  return dirname(resolved);
}
```

---

### WR-08: `deriveDiskStatus` priority-chain: `summaryCount > 0` without `planCount > 0` returns 'partial'

**File:** `/Volumes/code/gsd-beads/src/helpers/deriveDiskStatus.ts:41-43`
**Issue:** The docstring acknowledges this is intentional ("`summaryCount > 0`
alone (without planCount > 0) still returns 'partial', matching sibling's
behavior for orphan-summary detection"), but no caller-side test asserts
this is observed correctly as "orphan summary detected" vs. flagged as a
bug. If downstream consumers interpret `partial` as "plans exist and some
are complete," orphan-summary triggers the wrong workflow. Behavioral
preservation from v0.2 is clear; downstream semantic alignment is not
defensively verified.

**Fix:** Either add a distinct enum value `'orphan-summary'` and update
callers, or add a smoke test at the adapter boundary asserting the orphan
case is surfaced to callers as orphan rather than "partial." Out-of-scope
for v1.0 per the sibling-carry-forward policy, but flag for Phase 7
CONFORM-04.

---

### WR-09: `dep-graph.ts` does not handle self-blocks edges (`from === to`)

**File:** `/Volumes/code/gsd-beads/src/dep-graph.ts:96-110`
**Issue:** The synthesizer emits every `blocks`-type edge verbatim with no
guard against `depends_on_id === issue.id` (a self-loop). Spike 014 says
cascade walks IGNORE `blocks` edges so a self-loop on `blocks` won't wedge
cascade; but the emitted `graphs/graph.json` contains the self-loop and any
downstream consumer (graphify.cjs for MarkdownAdapter, pipeline dry-run) may
choke on it. Current tooling may not care, but the absence of a defensive
filter is a time bomb.

**Fix:**

```ts
if (d.depends_on_id === issue.id) continue; // self-block → skip
```

Add to the filter chain on line 102.

## Info

### IN-01: Unused import `pathRelative` kept deliberately

**File:** `/Volumes/code/gsd-beads/src/primitives.ts:34, 468`
**Issue:** `pathRelative` is imported from `node:path` solely to preserve an
unused import for future symlink-boundary checks (per the line-468 comment).
The `void pathRelative` pattern silences the no-unused-vars check but leaves
a dead symbol in the bundle. Better to either delete until needed or move
to a `// @ts-expect-error` comment on the eventual usage site.

**Fix:** Delete the import until Plan 06-07 hardening actually uses it.

---

### IN-02: `updateSection` round-trips through `getRecord`/`putRecord` and re-parses text

**File:** `/Volumes/code/gsd-beads/src/primitives.ts:353-364`
**Issue:** `updateSection` calls `getRecord` (reads full body), calls
`rewriteSection` (full-body parse), then `putRecord` (writes full body back
including ALL sections). For a STATE.md with dozens of sections, this is an
O(N) read + O(N) write per section update — the generic section primitive
is inefficient but correct. The D-TXN Outcome A in-memory buffer does NOT
coalesce successive updateSection calls on the same file; two updates to
different sections of STATE.md in the same transaction each create a full
write op. Not a correctness bug; flag for Phase 6.1 coalescing.

**Fix:** Out of v1 scope (performance); note for Phase 6.1.

---

### IN-03: `BdRunner` corruption heuristic over-matches "database" and "dolt"

**File:** `/Volumes/code/gsd-beads/src/bd/helper.ts:107`
**Issue:**

```ts
if (/database is locked|schema mismatch|corrupt|database|dolt|metadata\.json/i.test(stderr)) {
  throw new BeadsCorrupt(...)
}
```

The lone tokens `database` and `dolt` match ANY error mentioning those
words — e.g., a bd error about "database permissions denied" or "dolt table
not found" surface as `BeadsCorrupt` when they're neither corruption nor
schema drift. The recovery path for BeadsCorrupt is aggressive (re-init from
jsonl); triggering it on a permissions error wipes the user's store. The
sentinel dispatch is too eager.

**Fix:** Tighten patterns to phrase-match ("dolt: corrupt", "database is
locked", "schema version mismatch"). Route "permissions denied" to
`BeadsUnavailableError` instead.

---

### IN-04: `parseState` silently skips events with malformed JSON payload

**File:** `/Volumes/code/gsd-beads/src/format/state.ts:200-208`
**Issue:** When `JSON.parse(payloadJson)` throws, the event is silently
skipped (`continue`) with no log, no counter, no surface. A user editing
STATE.md by hand who introduces a JSON typo loses that event on next
round-trip with no diagnostic. MarkdownAdapter's state handling surfaces
malformed events via the CJS normalize layer; BeadsAdapter's
bd-tier-singleton reads bypass this path entirely. Silent-drop + transparent
format-round-trip = data-loss-on-save.

**Fix:** Log a `console.warn` (consistent with
`helpers/loadMilestoneHeading.ts`'s `[gsd-shadow] note:` pattern) or
accumulate errors into the ParsedState for caller visibility.

---

### IN-05: `primitives.ts` `stat` returns `{ kind: 'file' }` without `mtime` for bd-tier paths

**File:** `/Volumes/code/gsd-beads/src/primitives.ts:320-337`
**Issue:** For bd-tier records, `stat()` omits `mtime` because bd doesn't
track per-bead modification time in a way the adapter exposes. Consumers
using `stat().mtime` to detect drift (e.g., "has STATE.md changed since
last check?") will always see `undefined` on bd-tier and either treat it as
"unknown" or falsely as "no mtime means unchanged." The interface documents
`mtime?` as optional, so this is correct per contract — but the asymmetry
between MarkdownAdapter (always emits) and BeadsAdapter (never emits) is a
semantic landmine.

**Fix:** Document the asymmetry in README capabilities table or in the
StorageAdapter contract docs. bd's `updated_at` field on the bead would map
cleanly; currently unused.

---

### IN-06: `schemas/requirements.ts` `RequirementCategory` type permits cross-level ambiguity

**File:** `/Volumes/code/gsd-beads/src/format/schemas/requirements.ts:30-36`
**Issue:** `level: 2 | 3` and flat `categories` array means a consumer cannot
distinguish "H3 under an H2" from "H3 top-level" — both appear as flat peers.
Given REQUIREMENTS.md corpus uses nested H2/H3, this flattening loses
parent-child relationships that the markdown presentation conveys.
MarkdownAdapter's section walker preserves depth natively; the bd-tier
typed record shape flattens.

**Fix:** Out of v1 scope per the sibling-carry-forward policy. Flag for a
follow-up nested-category refactor if downstream consumers need the
hierarchy.

---

_Reviewed: 2026-05-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
