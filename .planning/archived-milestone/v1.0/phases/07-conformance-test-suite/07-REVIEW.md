---
phase: 07-conformance-test-suite
reviewed: 2026-05-12T00:00:00Z
depth: standard
files_reviewed: 43
files_reviewed_list:
  - adapters/types.ts
  - adapters/markdown/index.ts
  - adapters/markdown/index.test.ts
  - tests/conformance/manifest-types.ts
  - tests/conformance/manifest.ts
  - tests/conformance/test-registry.ts
  - tests/conformance/adapter.conformance.ts
  - tests/conformance/meta-coverage.test.ts
  - tests/conformance/paired-adapters.ts
  - tests/conformance/rollback-diff.ts
  - tests/conformance/tsconfig.json
  - tests/conformance/paired-core-markdown.test.ts
  - tests/conformance/paired-core-beads.test.ts
  - tests/conformance/paired-events-markdown.test.ts
  - tests/conformance/paired-events-beads.test.ts
  - tests/conformance/paired-outcome-markdown.test.ts
  - tests/conformance/paired-outcome-beads.test.ts
  - tests/conformance/paired-transaction-markdown.test.ts
  - tests/conformance/paired-transaction-beads.test.ts
  - tests/conformance/commit-planning-state.test.ts
  - tests/conformance/failure-injection.test.ts
  - tests/conformance/properties.test.ts
  - tests/conformance/init-bundlers.test.ts
  - tests/conformance/write-events.conformance-suite.ts
  - tests/conformance/write-outcome.conformance-suite.ts
  - tests/conformance/write-transaction.conformance-suite.ts
  - tests/conformance/arbitraries/encode.ts
  - tests/conformance/arbitraries/arbPhase.ts
  - tests/conformance/arbitraries/arbPlan.ts
  - tests/conformance/arbitraries/arbSummary.ts
  - tests/conformance/arbitraries/arbUat.ts
  - tests/conformance/arbitraries/arbStateEvent.ts
  - tests/conformance/arbitraries/arbRoadmap.ts
  - tests/conformance/arbitraries/arbDecision.ts
  - tests/conformance/arbitraries/arbBlocker.ts
  - tests/conformance/arbitraries/arbDebugSession.ts
  - tests/conformance/arbitraries/arbProject.ts
  - tests/conformance/arbitraries/arbSpec.ts
  - tests/conformance/arbitraries/arbAiSpec.ts
  - scripts/extract-section-anchors.mjs
  - scripts/install-hooks.sh
  - .github/workflows/test.yml
findings:
  critical: 3
  warning: 5
  info: 4
  total: 12
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-05-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 43
**Status:** issues_found

## Summary

Phase 7 shipped a complete paired conformance suite covering CONFORM-01..04 plus a
property-based round-trip matrix (12 nouns × 2 adapters), meta-coverage bidirectional
invariant, failure-injection/rollback tests, and supporting scripts. The architecture
is sound: file-based registry eliminates the in-process-Set race, `preRegisterTest`
at collection time stabilises meta-coverage, and the D-03 `bdPresent()` skip-with-warning
pattern is applied consistently across all eight beads-guarded test files.

Three blockers were found. The most severe is that `adapters/markdown/index.test.ts`
contains seven stale assertions from the Phase 1 stub era: they assert that capabilities
flags (`binaryAsset`, `snapshot`, `transaction`, `namedDoc`) are `false` and that
`snapshot()`/`writeBinaryAsset()` throw `UnsupportedCapabilityError`, when Phase 5
fully implemented all four capabilities and flipped the flags to `true`. These tests are
not run by CI (the CI `test:coverage` step only runs CJS tests; the vitest adapter project
is not invoked), but any developer running `npx vitest` locally hits seven hard failures
in the adapter project — and the tests assert the opposite of the correct behaviour, so
they actively mislead.

The second blocker is a meta-coverage breakage under local dev without `bd`: when
`bdPresent()` returns `false`, all 56 beads-side `preRegisterTest` calls (guarded inside
`if (bdPresent())` blocks in each paired-beads test file) are skipped, but
`meta-coverage.test.ts` unconditionally checks all 56 manifest entries × both adapters.
Running `npm run test:conformance:paired` locally without `bd` produces 56 failures in the
meta-coverage step, making the local dev experience appear broken even though the D-03
design intentionally allows skipping beads tests.

The third blocker is a semantic type mismatch in the manifest: `commitPlanningState:returns-void`,
`stat:file-kind`, `stat:dir-kind`, and `stat:missing-returns-null` are encoded with
`expected: { applied: true }` — the `StateOutcomeExpected` shape — even though those
methods return `void` or `{kind, mtime?} | null`, not `StateWriteOutcome`. Tests cast
around this with `(expected as { applied: boolean }).applied`, bypassing type safety. If
the manifest's `ExpectedOutcome` union is ever narrowed or validated, these entries will
silently corrupt check callbacks.

Five warnings cover: the `adapterName: string` parameter typed wider than `AdapterName` in
`runAdapterConformanceSuite`, duplicate `hashDir` implementations in two test files (risk
of divergence on future filter changes), the `withTransaction:mid-commit-replay`
`assertFromManifest('markdown', ...)` call appearing inside the `if (bdPresent())`
BeadsAdapter block (the markdown key gets registered in the beads worker file when it also
has its own `preRegisterTest` call unconditionally), the CI test pipeline not executing the
adapter vitest project at all, and a `TODO` left live in `extract-section-anchors.mjs` that
documents incomplete allowlist logic.

---

## Critical Issues

### CR-01: `adapters/markdown/index.test.ts` — seven stale Phase 1 capability assertions

**File:** `adapters/markdown/index.test.ts:36-46` and `117-138`

**Issue:** Test 1 (capabilities shape, lines 41–45) asserts `binaryAsset: false`,
`snapshot: false`, `transaction: false`, `namedDoc: false`, and
`commitPlanningState: true` (a field that does not exist on `Capabilities`). Phase 5
Plans 03–04 implemented all four capabilities and flipped their flags to `true` in
`adapters/markdown/index.ts:121-130`. Tests 10 and 11 (lines 117–138) assert that
`snapshot()` and `writeBinaryAsset()` throw `UnsupportedCapabilityError`; both methods
are now fully implemented and succeed. Running `npx vitest run --project adapters`
locally produces seven failing assertions that contradict the correct implementation.

The CI workflow (`test:coverage`) only runs `scripts/run-tests.cjs` (CJS tests) and
`test:conformance:paired` (vitest conformance config). The vitest adapter project defined
in `vitest.config.ts` under `projects[name=adapters]` is never invoked in CI, so these
failures are currently invisible to automated gating.

**Fix:** Update the stale assertions to reflect the post-Phase-5 state:
```typescript
// Test 1: capabilities shape (post-Phase-5 values)
it('capabilities shape matches locked contract', () => {
  const caps = adapter.capabilities;
  expect(caps.record).toBe(true);
  expect(caps.section).toBe(true);
  expect(caps.frontmatter).toBe(true);
  expect(caps.binaryAsset).toBe(true);   // D-17: Phase 5 Plan 04
  expect(caps.snapshot).toBe(true);      // D-03: Phase 5 Plan 03
  expect(caps.transaction).toBe(true);
  expect(caps.namedDoc).toBe(true);      // D-16: Phase 5 Plan 04
  expect(caps.markdownLockfile).toBe(true);
  // commitPlanningState is not a capabilities flag (D-12: promoted to required method)
});

// Remove Test 10 (snapshot no-throw) — replace with:
it('snapshot() returns a non-empty string path (implemented, D-03)', async () => {
  const id = await adapter.snapshot();
  expect(typeof id).toBe('string');
  expect(id.length).toBeGreaterThan(0);
});

// Remove Test 11 (writeBinaryAsset throw) — replace with:
it('writeBinaryAsset() writes bytes to .planning/ (D-17)', async () => {
  await expect(
    adapter.writeBinaryAsset('asset.bin', new Uint8Array([1, 2, 3]))
  ).resolves.not.toThrow();
});
```

Additionally, add the vitest adapter project to the CI workflow so future regressions are
caught:
```yaml
- name: Run adapter vitest tests
  shell: bash
  run: NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run --project adapters
```

---

### CR-02: `meta-coverage.test.ts` fails on local dev when `bd` is absent

**File:** `tests/conformance/meta-coverage.test.ts:32-78`

**Issue:** `meta-coverage.test.ts` unconditionally iterates all 56 manifest entries
against `ADAPTERS = ['markdown', 'beads']` (112 expected keys). When `bdPresent()`
returns `false` locally, none of the eight `paired-*-beads.test.ts` files call their
suite's `preRegisterTest` (all are guarded by `if (bdPresent()) { runXxx('beads', ...) }`),
and `properties.test.ts` omits beads from `pairedAdapters`. Result: running
`npm run test:conformance:paired` without `bd` installed produces 56 failures in the
meta-coverage step, even though D-03 explicitly permits skipping beads tests in local
development.

This does not affect CI (paired conformance only runs on `ubuntu-latest / node 22` where
bd is installed), but it breaks the developer experience for contributors without bd and
contradicts the D-03 skip-with-warning design.

**Fix:** Add a `bdPresent()` probe at module scope in `meta-coverage.test.ts` and
conditionally skip the beads direction:
```typescript
import { spawnSync } from 'node:child_process';

function bdPresent(): boolean {
  const r = spawnSync('bd', ['--version'], { encoding: 'utf-8' });
  return r.status === 0 && /^bd version 1\.0\.(4|[5-9]|\d{2,})\b/.test(r.stdout ?? '');
}

const BD_PRESENT = bdPresent();
// OR: import bdPresent from './paired-adapters.js' (already exported there)

const ADAPTERS: readonly AdapterName[] = BD_PRESENT
  ? (['markdown', 'beads'] as const)
  : (['markdown'] as const);
```

Alternatively, import `bdPresent` from `./paired-adapters.js` (it is already exported) to
avoid a third copy of the probe.

---

### CR-03: Manifest `expected` shape semantically wrong for non-event methods

**File:** `tests/conformance/manifest.ts:31-74`, `tests/conformance/commit-planning-state.test.ts:65-67`

**Issue:** Five manifest entries use `{ applied: true }` (the `StateOutcomeExpected`
shape) for methods that do not return `StateWriteOutcome`:

| Entry | Actual return type |
|---|---|
| `getRecord-putRecord:round-trip` | `string \| null` |
| `getRecord:missing-path-returns-null` | `string \| null` |
| `stat:file-kind` | `{kind, mtime?} \| null` |
| `stat:dir-kind` | `{kind, mtime?} \| null` |
| `stat:missing-returns-null` | `{kind, mtime?} \| null` |
| `commitPlanningState:returns-void` | `void` |
| `withTransaction:commit-persists` | `T` (generic) |
| `withTransaction:rollback-on-throw` | `T` (generic) |

The check callbacks in `adapter.conformance.ts` and `commit-planning-state.test.ts` paper
over the mismatch with `(expected as { applied: boolean }).applied`, bypassing the type
system. If `ExpectedOutcome` is ever tightened or if `assertFromManifest` starts narrowing
the `expected` type before passing it to `check`, these cast sites will silently pass the
wrong value.

**Fix:** Add a `presence` marker variant to `ExpectedOutcome` for tests where the manifest
is used only for registration (no behavioral expected value):
```typescript
// In manifest-types.ts
export type PresenceExpected = { kind: 'presence' };  // registration-only marker

export type ExpectedOutcome =
  | StateOutcomeExpected
  | RollbackOutcomeExpected
  | RoundTripOutcomeExpected
  | PresenceExpected;
```

Update the baseline entries:
```typescript
// In manifest.ts — baseline binB entries
expected: {
  markdown: { kind: 'presence' },
  beads:    { kind: 'presence' },
},
```

Update `adapter.conformance.ts` and `commit-planning-state.test.ts` checks to use the
presence marker:
```typescript
assertFromManifest(adapterName as AdapterName, 'getRecord-putRecord:round-trip', 'binB', (expected) => {
  expect((expected as PresenceExpected).kind).toBe('presence');
});
```

---

## Warnings

### WR-01: `adapter.conformance.ts` — `adapterName: string` parameter bypasses `AdapterName` type

**File:** `tests/conformance/adapter.conformance.ts:27`

**Issue:** `runAdapterConformanceSuite(adapterName: string, ...)` accepts any string but
internally casts to `AdapterName` nine times via `adapterName as AdapterName`. If a caller
passes `'foo'`, the cast silences the compiler and `assertFromManifest` / `preRegisterTest`
will throw at runtime with a "no manifest entry" error rather than a compile-time type
error.

**Fix:**
```typescript
export function runAdapterConformanceSuite(
  adapterName: AdapterName,  // was: string
  adapterFactory: (projectDir: string) => StorageAdapter,
): void {
```

Remove the nine `as AdapterName` casts that become unnecessary. The two call sites
(`paired-core-markdown.test.ts:13` and `paired-core-beads.test.ts:10`) pass string
literals `'markdown'` and `'beads'` respectively — both are valid `AdapterName` values
and the cast can be dropped entirely.

---

### WR-02: `hashDir` function duplicated across `rollback-diff.ts` and `write-transaction.conformance-suite.ts`

**File:** `tests/conformance/rollback-diff.ts:31-58` and `tests/conformance/write-transaction.conformance-suite.ts:24-40`

**Issue:** An identical (except for import style) `hashDir` function exists in both files.
The exclusion filter `['.tmp-txn-', '.tmp-snap-', '.adapter.lock']` must be kept in sync
manually. The versions currently agree, but a future change (e.g., adding a new transient
artifact prefix) applied to one file and missed in the other would cause `failure-injection.test.ts`
and `write-transaction.conformance-suite.ts` to disagree on the "before" snapshot hash,
producing spurious rollback failures.

`rollback-diff.ts` already exists as the canonical home for rollback snapshot utilities.
`write-transaction.conformance-suite.ts` should import `markdownSnapshot` from there.

**Fix:** In `write-transaction.conformance-suite.ts`:
```typescript
// Remove the local hashDir function (lines 24-40).
// Replace with:
import { markdownSnapshot } from './rollback-diff.js';
```

Then replace the `hashDir(join(tmpDir, '.planning'))` call at line 191 with
`markdownSnapshot(tmpDir)`.

---

### WR-03: `failure-injection.test.ts` — `bdPresent()` re-declared locally instead of imported

**File:** `tests/conformance/failure-injection.test.ts:32-35`

**Issue:** `failure-injection.test.ts` declares a local `bdPresent()` function
(lines 32–35) that duplicates the implementation already exported from
`tests/conformance/paired-adapters.ts`. The regex inside is identical, but two independent
copies mean a future version bump (e.g., `bd v1.0.5+` acceptance) requires updating both
files. The existing paired-beads test files all import `bdPresent` from `./paired-adapters.js`.

**Fix:**
```typescript
// Remove lines 32-35 (local function).
import { bdPresent } from './paired-adapters.js';  // already exported
```

---

### WR-04: meta-coverage test silently skips 56 beads keys when `bdPresent()` is false (local dev)

**File:** `tests/conformance/meta-coverage.test.ts:38-77`

*(See also CR-02 above — this Warning elaborates on a secondary consequence.)*

**Issue:** Beyond the meta-coverage *failures* (CR-02), there is a subtler side-effect:
`failure-injection.test.ts` calls `preRegisterTest('markdown', 'withTransaction:mid-commit-replay', 'rollback')`
unconditionally at module scope (line 43), but the parallel
`preRegisterTest('beads', 'withTransaction:mid-commit-replay', 'rollback')` call is guarded
inside `if (bdPresent())` (line 93). When `bdPresent()` is `false`, the `beads` key for
`mid-commit-replay` is never registered anywhere (the `assertFromManifest` calls at lines
150–151 that would write it are also inside the `if` block).

If meta-coverage ever runs locally *with* `--reporter verbose` on a bd-absent machine, the
gap between line-43 markdown registration and the absent beads registration produces a
confusing asymmetric failure with no accompanying skip message.

**Fix:** Apply the same guard consistently: either wrap both `preRegisterTest` calls in
`if (bdPresent())`, or extract a helper that registers both directions atomically:
```typescript
// Option A: guard both directions
if (bdPresent()) {
  preRegisterTest('markdown', 'withTransaction:mid-commit-replay', 'rollback');
  preRegisterTest('beads', 'withTransaction:mid-commit-replay', 'rollback');
}
// markdown throw-before-commit registration (unconditional) stays at line 42
```

---

### WR-05: CI vitest adapter project (`adapters`) never executed; Phase 5+ test drift not caught

**File:** `.github/workflows/test.yml` (no adapter vitest step present)

**Issue:** `vitest.config.ts` defines three test projects: `unit` (sdk), `integration`
(sdk), and `adapters` (markdown adapter). CI runs `test:coverage` (CJS runner only) and
`test:conformance:paired` (conformance config). The `adapters` project is never invoked by
any CI step. The seven stale assertions found in CR-01 are invisible to CI precisely because
of this gap. Any future regression in `adapters/markdown/index.ts` that breaks
`index.test.ts` will go undetected until a developer runs vitest locally.

**Fix:** Add an adapter vitest step to the workflow (suggested placement: after the
SDK seam coverage step, before the main test run):
```yaml
- name: Run adapter vitest tests
  if: matrix.os == 'ubuntu-latest' && matrix.node-version == 24
  shell: bash
  run: |
    NODE_PATH=./sdk/node_modules \
      ./sdk/node_modules/.bin/vitest run \
      --config vitest.config.ts \
      --project adapters
```

---

## Info

### IN-01: `extract-section-anchors.mjs` — live `TODO` for incomplete allowlist logic

**File:** `scripts/extract-section-anchors.mjs:131-133`

**Issue:**
```javascript
// TODO (future): load CONFORMANCE_MANIFEST and filter out allowlisted
// callers. For Phase 7 ship, zero dynamic anchors expected (A4);
// any find is a hard failure until explicitly registered.
```

The dynamic-anchor gate currently fails on ANY dynamic anchor with no allowlist path. The
`TODO` documents the intended Phase 8+ flow (load manifest, check `kind:"section-tuple"`
with `name` prefix `"dynamic:"`). Until the allowlist is wired, adding a legitimately
dynamic anchor requires hacking the gate script directly.

**Fix:** Either promote to a tracked work item (add to PHASE-7-REMAINING.md or create a
follow-up plan), or document in a comment that `process.exit(1)` is intentional for v1.0
and the TODO is for v1.1. A bare TODO without a tracking link creates confusion about
whether the gap is intentional or forgotten.

---

### IN-02: `manifest.ts` — `commitPlanningState:returns-void` entry `adr` field references wrong ADR

**File:** `tests/conformance/manifest.ts:393`

**Issue:**
```typescript
adr: 'D-2026-05-12-OQ01-BEADS',
```

The `adr` field on this entry names `D-2026-05-12-OQ01-BEADS` (the "BeadsAdapter
commitPlanningState is NOOP" decision). The entry's description says "markdown: git commit;
beads: NOOP" — but there is no behavioral divergence in `expected` outcomes (both adapters
get `{ applied: true }` per the presence-only pattern). The ADR field is used by the
conformance harness to explain *why* adapters legitimately differ. Using it for a "both
are fine" entry is noise that may confuse a reader of the manifest.

**Fix:** Remove the `adr` field from this entry (it belongs only on entries where adapters
produce observably different outcomes), or change it to a documentation-only comment:
```typescript
{
  kind: 'binB',
  name: 'commitPlanningState:returns-void',
  description:
    'commitPlanningState resolves with no observable adapter difference ' +
    '(markdown: git commit; beads: NOOP per D-OQ01-BEADS)',
  expected: {
    markdown: { kind: 'presence' },  // after CR-03 fix
    beads:    { kind: 'presence' },
  },
  // adr omitted: no behavioral divergence in expected outcomes.
},
```

---

### IN-03: `write-events.conformance-suite.ts` and `write-outcome.conformance-suite.ts` both register the same two binB keys

**File:** `tests/conformance/write-events.conformance-suite.ts:66-67`, `tests/conformance/write-outcome.conformance-suite.ts:100,108`

**Issue:** Both suites call `preRegisterTest(adapterName, 'recordStateAppend:metric:scaffold', 'binB')`
and `preRegisterTest(adapterName, 'recordStateMutation:blocker_added:scaffold', 'binB')`.
Under `vitest pool:forks`, each suite runs in a different worker with its own registry
file; `readRegisteredTests()` uses `Set.add()`, so the duplicate lines cause no
correctness problem today. But if the pool configuration ever changes to `singleFork` or
`threads`, both suites would share a module context and the double-registration would write
the same key twice to the same file (still harmless, but confusing in debug output).

The comment on lines 63–65 of `write-events.conformance-suite.ts` acknowledges the sharing
but does not describe the rationale for why write-events needs to call preRegisterTest for
entries that are already fully owned by write-outcome.

**Fix:** Remove the two `preRegisterTest` calls from `write-events.conformance-suite.ts`
(lines 66–67 and the corresponding comment on lines 63–65). The `assertFromManifest` calls
at lines 243 and 456 also append-register, so those are already redundant once
write-outcome's `preRegisterTest` fires. Keep the `assertFromManifest` calls for their
manifest-lookup validation function.

---

### IN-04: `encode.ts` — frontmatter YAML serialisation uses `JSON.stringify` for values, producing non-idiomatic YAML

**File:** `tests/conformance/arbitraries/encode.ts:18`

**Issue:**
```typescript
yamlLines.push(`${key}: ${JSON.stringify(value)}`);
```

`JSON.stringify` produces JSON-literal strings (e.g., `noun: "Phase"`, `count: 3`,
`flag: true`). These are valid YAML scalars, but they use JSON-style double-quoted strings
rather than YAML's unquoted or single-quoted idioms. BeadsAdapter's `normalize()` applies
a `parseFrontmatter + formatFrontmatter` round-trip (using `js-yaml.dump`). If `js-yaml`
normalises the quote style differently (e.g., `noun: Phase` unquoted), the
`adapter.normalize(rawBody)` call before `putRecord` will reformat the frontmatter and the
subsequent `getRecord === normalize(body)` assertion will pass. However, the
`encodeFrontmatterDoc` output is not directly human-readable in test failure messages
because YAML string values are wrapped in JSON double-quotes.

More importantly, if any generated value contains a YAML-significant character (`:` in a
string, `#` in a comment position, a leading `{`), the unescaped JSON-string embed is
valid YAML only because it is double-quoted by JSON.stringify. This is correct but fragile
— a future reader may accidentally replace `JSON.stringify(value)` with `String(value)`
and introduce real YAML parse failures.

**Fix:** Add a comment documenting the intentional JSON-as-YAML-scalar encoding:
```typescript
// Values are JSON.stringify'd to produce YAML-safe double-quoted scalars.
// This is intentional: JSON strings are valid YAML double-quoted scalars and
// survive any YAML-significant character in the generated value without
// additional escaping. Do NOT replace with String(value).
yamlLines.push(`${key}: ${JSON.stringify(value)}`);
```

---

_Reviewed: 2026-05-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
