# Phase 7: Conformance test suite - Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 25 (17 new, 8 modified/deleted)
**Analogs found:** 25 / 25

## File Classification

### Fork-side (primary)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `adapters/types.ts` | contract extension | type-declaration | itself (add method to existing interface) | self (modify) |
| `adapters/markdown/index.ts` | adapter impl (normalize) | transform | `adapters/markdown/index.ts:943-953` (`stripFrontmatter`/`normalizeMd` — private helpers; new `normalize` is similarly identity-biased) | exact role |
| `tests/conformance/manifest-types.ts` | types (new) | type-declaration | `adapters/types.ts:50-52` (discriminated-union `StateWriteOutcome` shape) | role-match |
| `tests/conformance/manifest.ts` | typed-const enum (new) | static-data | `adapters/state-event-types.ts:44-104` (discriminated-union `as const`-style enumeration of event families) | role-match |
| `tests/conformance/test-registry.ts` | in-module state + helper (new) | in-memory Set + side-effect | *(no direct analog — simplest possible Set-owner module; idiomatic)* | no analog (trivial) |
| `tests/conformance/meta-coverage.test.ts` | meta/bidirectional test (new) | read-registry + soft-assert | `tests/conformance/markdown.conformance.test.ts` (consumer-of-module pattern) + `tests/conformance/write-outcome.test.ts:42-76` (describe+it shape) | role-match |
| `tests/conformance/paired.test.ts` | test entry-point (new) | harness-invocation x2 | `tests/conformance/markdown.conformance.test.ts` (7-LOC consumer) — **EXACT PATTERN; copy then duplicate invocation** | exact |
| `tests/conformance/rollback-diff.ts` | test helper (new) | hash + json-diff | `tests/conformance/write-transaction.test.ts:14-30` (`hashDir()` helper) + `/Volumes/code/gsd-beads/tests/fixture.ts:59-85` (`spawnSync('bd', ...)` pattern) | exact on markdown half; role-match on beads half |
| `tests/conformance/failure-injection.test.ts` | integration test (new) | throw-inside-fn + snapshot-diff | `tests/conformance/write-transaction.test.ts:141-158` (`mid-txn failure leaves .planning/ byte-identical` — **the direct template**) | exact |
| `tests/conformance/properties.test.ts` | property-based test (new) | generate + adapter-call + assert | `tests/conformance/write-outcome.test.ts:42-76` (describe+it+beforeEach pattern) — wrap `fc.assert` inside; per-test `{ timeout: 90_000 }` | role-match |
| `tests/conformance/arbitraries/arbPhase.ts` | fast-check arbitrary (new) | generator | `adapters/state-event-types.ts:44-104` (union shape to mirror) + RESEARCH.md §"Property-Based Noun Arbitrary Shapes" (explicit `fc.record(...)` skeletons per noun) | role-match |
| `tests/conformance/arbitraries/arbPlan.ts` | fast-check arbitrary (new) | generator | same as `arbPhase.ts` | role-match |
| `tests/conformance/arbitraries/arbSummary.ts` | fast-check arbitrary (new) | generator | same | role-match |
| `tests/conformance/arbitraries/arbUat.ts` | fast-check arbitrary (new) | generator | same | role-match |
| `tests/conformance/arbitraries/arbStateEvent.ts` | fast-check arbitrary (new) | generator | `adapters/state-event-types.ts` (discriminated union source — DIRECT shape reference) + RESEARCH §Example 5 | exact |
| `tests/conformance/arbitraries/arbRoadmap.ts` | fast-check arbitrary (new) | generator | same as `arbPhase.ts` | role-match |
| `tests/conformance/arbitraries/arbDecision.ts` | fast-check arbitrary (new) | generator | same | role-match |
| `tests/conformance/arbitraries/arbBlocker.ts` | fast-check arbitrary (new) | generator | same (trivial — single-field record) | role-match |
| `tests/conformance/arbitraries/arbDebugSession.ts` | fast-check arbitrary (new) | generator | same | role-match |
| `tests/conformance/arbitraries/arbProject.ts` | fast-check arbitrary (new) | generator | same | role-match |
| `tests/conformance/arbitraries/arbSpec.ts` | fast-check arbitrary (new) | generator | same | role-match |
| `tests/conformance/arbitraries/arbAiSpec.ts` | fast-check arbitrary (new) | generator | same | role-match |
| `scripts/extract-section-anchors.mjs` | CI tool script (new) | ripgrep-spawn + write-JSON | `scripts/leak-grep.cjs` (ripgrep-wrapping CI script precedent) + `scripts/audit-workflow-script-paths.cjs` (shape) | role-match |
| `tests/conformance/write-outcome.test.ts` | existing test → harness migration | refactor | itself (lines 42-54 `beforeEach` → accept adapterFactory parameter) | self (refactor) |
| `tests/conformance/write-events.test.ts` | existing test → harness migration | refactor | itself (lines 16-28) | self (refactor) |
| `tests/conformance/write-transaction.test.ts` | existing test → harness migration | refactor | itself (lines 32-44) | self (refactor) |
| `package.json` | config | npm deps + scripts | itself (add `"gsd-beads": "file:../gsd-beads"` + script) — mirrors sibling `package.json:47` pattern | self (modify) |
| `vitest.conformance.config.ts` | config | glob-extension | itself | self (modify) |
| `.github/workflows/test.yml` | CI | install + run | itself (existing) + RESEARCH.md §"bd install CI Patterns" (explicit yaml snippet) | self (modify) |
| `.planning/DECISIONS.md` | ADR (append) | append-only | existing ADR entries (`D-2026-05-10-08`, `D-2026-05-12-OQ06-CAPS`) — precedent for additive-contract ADR | role-match |

### Sibling-side (`/Volumes/code/gsd-beads`)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/testing/conformance-factory.ts` | factory export (new) | extracted from existing file | `/Volumes/code/gsd-beads/tests/conformance.test.ts:37-96` — **EXACT EXTRACT** | exact (extract) |
| `src/index.ts` | adapter method addition | transform (compose existing) | `/Volumes/code/gsd-beads/src/format/frontmatter.ts:46-91` (`parseFrontmatter` + `formatFrontmatter` — what `normalize()` composes) | role-match |
| `package.json` | subpath export (modify) | config | self — add `"./testing"` entry mirroring fork's `./conformance` pattern at `/Volumes/code/get-shit-done/package.json:27` | role-match |
| `tests/conformance.test.ts` | DELETE | — | — | — |
| `tests/smoke/normalize.test.ts` | smoke test (new; optional) | setupFreshAdapter + assert | `/Volumes/code/gsd-beads/tests/smoke/section-primitives.test.ts:8-36` | exact |

## Pattern Assignments

### `tests/conformance/paired.test.ts` (NEW — test entry-point, D-01)

**Analog:** `tests/conformance/markdown.conformance.test.ts` (entire file, 7 LOC).

**Imports pattern** (`markdown.conformance.test.ts:1-2`):
```typescript
import { runAdapterConformanceSuite } from './adapter.conformance.js';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
```

**Core harness invocation** (`markdown.conformance.test.ts:4-7`):
```typescript
runAdapterConformanceSuite(
  'markdown',
  (projectDir) => new MarkdownAdapter(projectDir),
);
```

**Phase 7 duplication pattern** (from RESEARCH §Pattern 2, D-03 bd probe):
```typescript
// paired.test.ts — new file
import { runAdapterConformanceSuite } from './adapter.conformance.js';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import { createBeadsAdapter } from 'gsd-beads/testing';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'vitest';

function bdPresent(): boolean {
  const r = spawnSync('bd', ['--version'], { encoding: 'utf-8' });
  return r.status === 0 && /^bd version 1\.0\.[4-9]/.test(r.stdout ?? '');
}

runAdapterConformanceSuite('markdown', (dir) => new MarkdownAdapter(dir));

if (bdPresent()) {
  runAdapterConformanceSuite('beads', createBeadsAdapter);
} else {
  describe.skip('StorageAdapter conformance: beads', () => {
    it.skip('bd v1.0.4+ not available — install bd to run paired conformance', () => {});
  });
}
```

**Key takeaway for planner:** `read_first` must include `tests/conformance/markdown.conformance.test.ts` (whole 7 lines) and `tests/conformance/adapter.conformance.ts:24-27` (the locked signature).

---

### `tests/conformance/failure-injection.test.ts` (NEW — D-10 + D-11)

**Analog:** `tests/conformance/write-transaction.test.ts:141-158` — the **exact template** for throw-inside-fn + snapshot-before/after.

**Imports pattern** (`write-transaction.test.ts:7-12`):
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../adapters/types.js';
```

**Core test pattern — SC#1 byte-identity rollback** (`write-transaction.test.ts:141-158`):
```typescript
it('mid-txn failure leaves .planning/ byte-identical to pre-txn state (SC#1)', async () => {
  await adapter.putRecord('STATE.md', '# pre-state\n');
  await adapter.putRecord('PROJECT.md', '# pre-project\n');
  const beforeHash = await hashDir(join(tmpDir, '.planning'));

  await expect(
    adapter.withTransaction(async () => {
      await adapter.putRecord('STATE.md', '# mutated\n');
      await adapter.putRecord('PROJECT.md', '# also mutated\n');
      throw new Error('intentional mid-txn failure');
    }),
  ).rejects.toThrow('intentional mid-txn failure');

  const afterHash = await hashDir(join(tmpDir, '.planning'));
  expect(afterHash).toBe(beforeHash);
  expect(await adapter.getRecord('STATE.md')).toBe('# pre-state\n');
  expect(await adapter.getRecord('PROJECT.md')).toBe('# pre-project\n');
});
```

**hashDir helper to extract to `rollback-diff.ts`** (`write-transaction.test.ts:14-30`):
```typescript
async function hashDir(dir: string): Promise<string> {
  const crypto = await import('node:crypto');
  const { readdir: rd, readFile: rf } = await import('node:fs/promises');
  let entries: import('node:fs').Dirent[];
  try { entries = await rd(dir, { withFileTypes: true }); }
  catch { return '<missing>'; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const h = crypto.createHash('sha256');
  for (const e of entries) {
    if (e.name.startsWith('.tmp-txn-') || e.name.startsWith('.tmp-snap-') || e.name === '.adapter.lock') continue;
    const p = join(dir, e.name);
    h.update(e.name);
    if (e.isFile()) h.update(await rf(p));
    else if (e.isDirectory()) h.update(await hashDir(p));
  }
  return h.digest('hex');
}
```

**Key takeaway for planner:** `read_first` MUST include `tests/conformance/write-transaction.test.ts:141-158` (template) and `:14-30` (hashDir). The BeadsAdapter variant composes hashDir equivalent using `spawnSync('bd', ['export', '--json'], ...)` from `/Volumes/code/gsd-beads/tests/fixture.ts:59-74` (below).

---

### `tests/conformance/rollback-diff.ts` (NEW — D-11 helper)

**Analog (markdown half):** `tests/conformance/write-transaction.test.ts:14-30` (copy hashDir verbatim; add wrapper `markdownSnapshot`).

**Analog (beads half):** `/Volumes/code/gsd-beads/tests/fixture.ts:59-74` (the `spawnSync('bd', ...)` + `BEADS_ACTOR=seed` env pattern).

**bd spawn pattern** (`fixture.ts:59-74`):
```typescript
const init = spawnSync(
  'bd',
  [
    'init',
    '--from-jsonl',
    '--non-interactive',
    '--skip-agents',
    '--skip-hooks',
    '--quiet',
  ],
  {
    cwd: projectDir,
    env: { ...process.env, BEADS_ACTOR: 'seed' },
    encoding: 'utf-8',
  },
);
```

**Phase 7 beads snapshot pattern** (from RESEARCH §Example 3, lines 1119-1151):
```typescript
export function beadsSnapshot(projectDir: string): unknown[] {
  const r = spawnSync(
    'bd',
    ['export', '--json'],
    {
      cwd: projectDir,
      env: { ...process.env, BEADS_ACTOR: 'seed' },
      encoding: 'utf-8',
    },
  );
  if (r.status !== 0) throw new Error(`bd export failed: ${r.stderr}`);
  let records: unknown[];
  try {
    const parsed = JSON.parse(r.stdout);
    records = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    records = r.stdout.split('\n').filter(Boolean).map(l => JSON.parse(l));
  }
  return records.map(stripNonSemantic).sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function stripNonSemantic(record: unknown): unknown {
  if (!record || typeof record !== 'object') return record;
  const r = record as Record<string, unknown>;
  // Strip: updated_at, last_modified. Keep: id, labels, description,
  // dependencies, memories, comments, created_at, created_by.
  const { updated_at, last_modified, ...rest } = r;
  return rest;
}
```

**Key takeaway for planner:** `read_first` includes `tests/conformance/write-transaction.test.ts:14-30` AND `/Volumes/code/gsd-beads/tests/fixture.ts:59-85` — combined, they cover both snapshot sides.

---

### `tests/conformance/properties.test.ts` (NEW — D-12, D-14)

**Analog:** `tests/conformance/write-outcome.test.ts:42-65` (describe+beforeEach+afterEach+it pattern).

**Imports + setup** (`write-outcome.test.ts:31-54`):
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../adapters/types.js';

describe('recordStateAppend outcomes', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-write-outcome-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });
  // ... it blocks
});
```

**fast-check adaptive-budget wrapper pattern** (from RESEARCH §Pattern 4):
```typescript
// properties.test.ts — new; wraps the above with fc.assert
import fc from 'fast-check';
// ...arbs...
it(`${nounName} round-trips under normalize() (${adapterName})`, async () => {
  registeredTests.add(`${adapterName}:noun-roundtrip:${nounName}`);
  await fc.assert(
    fc.asyncProperty(arb, async (value) => {
      const bodyIn = encode(value);  // noun → markdown body
      await adapter.putRecord(path, bodyIn);
      const bodyOut = await adapter.getRecord(path);
      expect(bodyOut).toBe(adapter.normalize(bodyIn));
    }),
    {
      numRuns: Number.POSITIVE_INFINITY,
      endOnFailure: true,
      interruptAfterTimeLimit: 60_000,
      markInterruptAsFailure: false,
      verbose: true,
    },
  );
}, { timeout: 90_000 });  // MUST be > interruptAfterTimeLimit + 10s
```

**Key takeaway for planner:** `read_first` includes `tests/conformance/write-outcome.test.ts:42-54`. Also cite RESEARCH.md §Pitfall 2 (vitest testTimeout > fc budget).

---

### `tests/conformance/arbitraries/arbStateEvent.ts` (NEW — D-12)

**Analog:** `adapters/state-event-types.ts:44-104` — **the union shape to mirror field-for-field**.

**Union source** (`state-event-types.ts:44-50`):
```typescript
export type AppendEvent =
  | { type: 'decision'; payload: DecisionPayload }
  | { type: 'metric'; payload: MetricPayload }
  | { type: 'roadmap_evolution'; payload: RoadmapEvolutionPayload }
  | { type: 'session'; payload: SessionPayload }
  | { type: 'forensic_session'; payload: ForensicSessionPayload }
  | { type: 'quick_task'; payload: QuickTaskPayload };
```

**Arbitrary mirror pattern** (from RESEARCH §Example 5):
```typescript
// tests/conformance/arbitraries/arbStateEvent.ts
import fc from 'fast-check';
import type {
  AppendEvent, MutationEvent, SignalEvent,
} from '../../../adapters/state-event-types.js';

const arbDecisionPayload = fc.record({
  phase: fc.string({ minLength: 1, maxLength: 3 }).map(s => s.padStart(2, '0')),
  summary: fc.string({ minLength: 1, maxLength: 200 }),
  rationale: fc.option(fc.string({ maxLength: 500 })),
});
// ... one payload arb per variant

export const arbAppendEvent: fc.Arbitrary<AppendEvent> = fc.oneof(
  fc.record({ type: fc.constant('decision' as const), payload: arbDecisionPayload }),
  fc.record({ type: fc.constant('metric' as const), payload: arbMetricPayload }),
  // ...4 more variants
);
```

**Key takeaway for planner:** `read_first` includes `adapters/state-event-types.ts:44-104` for every `arb*.ts` file touching state events. Other arbitraries (arbPhase, arbPlan, etc.) have their `fc.record(...)` skeletons pre-authored in RESEARCH.md §"Property-Based Noun Arbitrary Shapes" table — copy those verbatim.

---

### `tests/conformance/manifest.ts` (NEW — D-06)

**Analog (typed-const-enumeration shape):** `adapters/state-event-types.ts:44-104` (discriminated-union-of-records pattern).

**Analog (discriminated `expected` shape):** `adapters/types.ts:50-52` (StateWriteOutcome union).

**Shape from RESEARCH §Pattern 1 + CONTEXT D-06/D-07:**
```typescript
// tests/conformance/manifest-types.ts
export type AdapterName = 'markdown' | 'beads';

export type StateOutcomeExpected =
  | { applied: true; created_section?: string | null }
  | { applied: false; reason: 'duplicate' | 'nothing_to_remove' };

export type RollbackOutcomeExpected =
  | { kind: 'byte-identical' }
  | { kind: 'record-identical' }
  | { kind: 'incomplete-per-Deferred-04'; adr: 'D-2026-05-12-OQ06-TXN' };

export type RoundTripOutcomeExpected =
  | { kind: 'normalize-modulo-equal' }
  | { kind: 'identity-equal' };

export type ExpectedOutcome =
  | StateOutcomeExpected
  | RollbackOutcomeExpected
  | RoundTripOutcomeExpected;

export interface ManifestEntry {
  kind: 'binB' | 'section-tuple' | 'noun-roundtrip' | 'rollback';
  name: string;
  description?: string;
  expected: Record<AdapterName, ExpectedOutcome>;
  adr?: string;
}

// tests/conformance/manifest.ts
export const CONFORMANCE_MANIFEST: readonly ManifestEntry[] = [
  {
    kind: 'binB',
    name: 'recordStateAppend:decision:existing-section',
    description: 'decision: applied:true bare when Decisions section exists',
    expected: {
      markdown: { applied: true },
      beads:    { applied: true },
    },
  },
  // Deviation (D-2026-05-12-OQ06-CREATED-SECTION):
  {
    kind: 'binB',
    name: 'recordStateAppend:decision:scaffold',
    description: 'decision: applied:true + created_section when no Decisions heading',
    expected: {
      markdown: { applied: true, created_section: '## Decisions Made' },
      beads:    { applied: true, created_section: null },
    },
    adr: 'D-2026-05-12-OQ06-CREATED-SECTION',
  },
  // CONFORM-04 known-gap (D-09):
  {
    kind: 'rollback',
    name: 'withTransaction:mid-txn-failure-3-of-3-writes',
    expected: {
      markdown: { kind: 'byte-identical' },
      beads:    { kind: 'incomplete-per-Deferred-04', adr: 'D-2026-05-12-OQ06-TXN' },
    },
    adr: 'D-2026-05-12-OQ06-TXN',
  },
] as const;
```

**Populate from `write-outcome.test.ts:9-29` (existing 16-case matrix header comment):**
```
 *   Append/decision            → applied:true bare
 *   Append/decision            → applied:true + created_section (scaffolded)
 *   Append/metric              → applied:true + created_section
 *   Append/roadmap_evolution   → applied:false + reason:'duplicate'
 *   ... (16 cases total, already enumerated by Plan 03-06)
```
Each of these 16 cases → one manifest entry with markdown expected; BeadsAdapter expected either mirrors or documents a D-07 deviation.

**Key takeaway for planner:** `read_first` includes `adapters/state-event-types.ts:44-104` AND `adapters/types.ts:50-52` AND `tests/conformance/write-outcome.test.ts:1-29` (the 16-case matrix header). The existing matrix is the primary source for the Bin B manifest subset.

---

### `tests/conformance/meta-coverage.test.ts` (NEW — D-06)

**Analog:** `tests/conformance/markdown.conformance.test.ts` (consumer-of-module pattern) + vitest `expect.soft` API.

**Shape from RESEARCH §Pattern 3:**
```typescript
// tests/conformance/meta-coverage.test.ts
import { describe, it, expect } from 'vitest';
import { CONFORMANCE_MANIFEST } from './manifest.js';
import { registeredTests } from './test-registry.js';

describe('Phase 7 meta-coverage', () => {
  it('every CONFORMANCE_MANIFEST entry has a corresponding describe/it (both adapters)', () => {
    const adapters = ['markdown', 'beads'] as const;
    for (const adapter of adapters) {
      for (const entry of CONFORMANCE_MANIFEST) {
        const key = `${adapter}:${entry.kind}:${entry.name}`;
        expect.soft(
          registeredTests.has(key),
          `manifest entry ${entry.name} has no ${adapter} test registration`,
        ).toBe(true);
      }
    }
  });

  it('no describe/it block registers a case absent from CONFORMANCE_MANIFEST', () => {
    const manifestKeys = new Set(
      CONFORMANCE_MANIFEST.flatMap((e) => [
        `markdown:${e.kind}:${e.name}`,
        `beads:${e.kind}:${e.name}`,
      ]),
    );
    for (const key of registeredTests) {
      expect.soft(manifestKeys.has(key), `orphan test registration: ${key}`).toBe(true);
    }
  });
});
```

**Key takeaway for planner:** no new analog to read — shape is self-contained. Cite RESEARCH §Pattern 3 verbatim.

---

### `tests/conformance/test-registry.ts` (NEW — support for D-06)

No analog — trivial module-scoped Set. Shape from RESEARCH §Pattern 3:

```typescript
import { CONFORMANCE_MANIFEST, type ManifestEntry } from './manifest.js';

export const registeredTests = new Set<string>();

export function assertFromManifest(
  adapterName: 'markdown' | 'beads',
  entryName: string,
  kind: ManifestEntry['kind'],
  check: (expected: unknown) => void,
): void {
  const key = `${adapterName}:${kind}:${entryName}`;
  registeredTests.add(key);
  const entry = CONFORMANCE_MANIFEST.find((e) => e.kind === kind && e.name === entryName);
  if (!entry) throw new Error(`assertFromManifest: no manifest entry for ${key}`);
  check(entry.expected[adapterName]);
}
```

---

### `adapters/types.ts` (MODIFY — D-13 additive contract)

**Analog:** itself — add a new method to the existing locked interface, mirroring precedent for `graphEdges` in `Capabilities` at `types.ts:66-72` (D-OQ06-CAPS additive pattern).

**Existing interface body** (`types.ts:74-128`, method list):
```typescript
export interface StorageAdapter {
  readonly name: string;
  readonly capabilities: Capabilities;
  getRecord(path: string): Promise<string | null>;
  putRecord(path: string, body: string): Promise<void>;
  // ... ~30 methods
  recordStateSignal(event: SignalEvent): Promise<StateWriteOutcome>;
}
```

**Add after `recordStateSignal` (last method)** (D-13):
```typescript
  /**
   * D-13 (Phase 7, ADR D-2026-05-12-NORMALIZE):
   * Canonicalize body per the adapter's storage normalization.
   * MarkdownAdapter returns body unchanged.
   * BeadsAdapter applies frontmatter + section round-trip.
   *
   * Used by property-based round-trip tests:
   *   expect(await adapter.getRecord(p)).toBe(adapter.normalize(input))
   *
   * Also enables Phase 8 migration tool (pre-seed normalize pass).
   *
   * `category` is forward-compatible for adapters that dispatch by
   * NamedDocCategory; currently unused by both ship-Phase-7 adapters.
   */
  normalize(body: string, category?: string): string;
```

**Key takeaway for planner:** `read_first` is `adapters/types.ts:1-128` (whole file); the additive D-OQ06-CAPS precedent at `:66-72` teaches the style.

---

### `adapters/markdown/index.ts` (MODIFY — D-13 identity impl)

**Analog:** itself — existing `stripFrontmatter` + `normalizeMd` private helpers at `adapters/markdown/index.ts:942-953` show the "pure string-transform method" style. The new `normalize` is public and trivial.

**Existing private helper pattern** (`markdown/index.ts:948-953`):
```typescript
/** Normalize markdown: collapse 3+ consecutive blank lines to 2, ensure trailing newline. */
private normalizeMd(content: string): string {
  let result = content.replace(/\n{3,}/g, '\n\n');
  if (!result.endsWith('\n')) result += '\n';
  return result;
}
```

**Phase 7 addition (public, single-line identity):**
```typescript
// Add as a public method on the class, e.g. after recordStateSignal
// (which ends around line ~940 before the private helpers).
normalize(body: string, _category?: string): string {
  // MarkdownAdapter storage is byte-preserving; normalize is identity.
  return body;
}
```

**Key takeaway for planner:** `read_first` is `adapters/markdown/index.ts:940-953` (private-helper block) for style reference; the impl is literally one return statement. Also flag not to conflate with `normalizeMd` — that's MarkdownAdapter-internal content shaping, not the StorageAdapter contract.

---

### `/Volumes/code/gsd-beads/src/testing/conformance-factory.ts` (NEW — D-04 extract)

**Analog:** `/Volumes/code/gsd-beads/tests/conformance.test.ts:37-96` — **VERBATIM EXTRACT**. The factory arrow function is already isolated.

**Source to extract** (`gsd-beads/tests/conformance.test.ts:37-96`):
```typescript
runAdapterConformanceSuite('beads', (projectDir: string) => {
  // 1. git init — bd init v1.0.4 expects a git repo at projectRoot.
  const gitInit = spawnSync('git', ['init', '-q'], {
    cwd: projectDir,
    encoding: 'utf-8',
  });
  if (gitInit.status !== 0) {
    throw new Error(
      `conformance factory: git init failed: ${gitInit.stderr}`,
    );
  }
  spawnSync('git', ['config', 'user.email', 'seed@test.local'], {
    cwd: projectDir,
  });
  spawnSync('git', ['config', 'user.name', 'Seed Test'], {
    cwd: projectDir,
  });

  // 2. bd v1.0.4: --from-jsonl is boolean; seed must pre-exist at
  //    .beads/issues.jsonl before `bd init` runs.
  const beadsDir = join(projectDir, '.beads');
  mkdirSync(beadsDir, { recursive: true });
  copyFileSync(SEED_PATH, join(beadsDir, 'issues.jsonl'));

  // 3. bd init --from-jsonl with BEADS_ACTOR=seed (Landmine 11).
  const bdInit = spawnSync(
    'bd',
    ['init', '--from-jsonl', '--non-interactive',
     '--skip-agents', '--skip-hooks', '--quiet'],
    {
      cwd: projectDir,
      env: { ...process.env, BEADS_ACTOR: 'seed' },
      encoding: 'utf-8',
    },
  );
  if (bdInit.status !== 0) {
    throw new Error(
      `conformance factory: bd init failed (status=${bdInit.status}): ${bdInit.stderr}\n\nSTDOUT:\n${bdInit.stdout}`,
    );
  }

  // 4. Landmine 9: chmod 0o700 on .beads/
  try { chmodSync(join(projectDir, '.beads'), 0o700); } catch { /* non-fatal */ }

  return new BeadsAdapter(projectDir);
});
```

**Phase 7 extracted form** — hoist the arrow function to a named export:
```typescript
// /Volumes/code/gsd-beads/src/testing/conformance-factory.ts
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chmodSync, copyFileSync, mkdirSync } from 'node:fs';
import { BeadsAdapter } from '../index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// NOTE: seed.jsonl relocates from tests/fixtures/ → src/testing/fixtures/
// (so it ships with the npm tarball). Planner verify npm pack --dry-run.
const SEED_PATH = join(__dirname, 'fixtures/seed.jsonl');

export function createBeadsAdapter(projectDir: string): BeadsAdapter {
  // ...body identical to lines 38-95 above...
  return new BeadsAdapter(projectDir);
}
```

**Key takeaway for planner:** `read_first` is `/Volumes/code/gsd-beads/tests/conformance.test.ts:1-96` (the entire existing file — it's the canonical source). Also flag **seed.jsonl must relocate** from `tests/fixtures/seed.jsonl` to `src/testing/fixtures/seed.jsonl` (or equivalent) so the factory ships with the npm `dist/testing/` subpath.

---

### `/Volumes/code/gsd-beads/src/index.ts` (MODIFY — D-13 normalize)

**Analog:** `/Volumes/code/gsd-beads/src/format/frontmatter.ts:46-91` (the `parseFrontmatter` + `formatFrontmatter` pair that `normalize()` composes).

**Existing method tail** (`gsd-beads/src/index.ts:193-197`):
```typescript
async recordStateSignal(event: SignalEvent): Promise<StateWriteOutcome> {
  const state = await this._ensureBd();
  return E.recordStateSignal(state, event);
}
// ← ADD normalize() here, before closing brace
}
```

**Add-after-recordStateSignal** (from RESEARCH §Example 2):
```typescript
import {
  parseFrontmatter,
  formatFrontmatter,
} from './format/frontmatter.js';

// inside the class, after recordStateSignal:
/**
 * D-13 (ADR D-2026-05-12-NORMALIZE): canonicalize body as BeadsAdapter
 * would after a putRecord → getRecord round-trip. Composes frontmatter
 * parse/format (js-yaml.dump normalizes quote style + key ordering).
 *
 * Pure — output depends only on input. Second application is identity:
 *   normalize(normalize(x)) === normalize(x)
 * (idempotency; Pitfall 3 in RESEARCH).
 */
normalize(body: string, _category?: string): string {
  const { frontmatter, body: rest } = parseFrontmatter(body);
  return formatFrontmatter(frontmatter, rest);
}
```

**Key takeaway for planner:** `read_first` is `/Volumes/code/gsd-beads/src/index.ts:180-200` (full class tail) AND `/Volumes/code/gsd-beads/src/format/frontmatter.ts:46-91` (the composition pieces).

---

### `scripts/extract-section-anchors.mjs` (NEW — D-08)

**Analog:** `scripts/leak-grep.cjs` (existing CI script that wraps grep/rg and writes generated output) + `scripts/audit-workflow-script-paths.cjs` (node-script shape + process.exit contract).

**Shape from RESEARCH §Example 1:**
```javascript
#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'tests/conformance/.generated');
mkdirSync(OUT_DIR, { recursive: true });

// Auto-detect rg vs grep fallback
const hasRg = spawnSync('rg', ['--version'], { encoding: 'utf-8' }).status === 0;
const gr = hasRg ? 'rg' : 'grep';

// Pass 1: string-literal anchors in public adapter API call sites (SDK + workflows)
const literalPass = spawnSync(gr, [
  '-n', '--pcre2',
  `\\.(updateSection|getSection)\\(\\s*[^,]+,\\s*['"\`]([^'"\`]+)['"\`]`,
  'sdk/src', 'adapters',
], { encoding: 'utf-8' });

// Pass 2: internal MarkdownAdapter section literals (Tier 1 per RESEARCH)
const internalPass = spawnSync(gr, [
  '-n',
  `['"\`](#{2,4}\\s[A-Z][^'"\`]+)['"\`]`,
  'adapters/markdown/index.ts',
], { encoding: 'utf-8' });

// Pass 3: dynamic-anchor gate — second arg NOT string literal
const dynamicPass = spawnSync(gr, [
  '-n', '--pcre2',
  `\\.(updateSection|getSection)\\(\\s*[^,]+,\\s*(?!['"\`])`,
  'sdk/src', 'adapters',
], { encoding: 'utf-8' });

writeFileSync(join(OUT_DIR, 'anchors.json'), JSON.stringify({ literals: [], internal: [] }, null, 2));
writeFileSync(join(OUT_DIR, 'dynamic-anchors.warn'), dynamicPass.stdout || '');

// CI gate: non-empty dynamic-anchors.warn → failure unless allowlisted in manifest
if (dynamicPass.stdout?.trim()) {
  console.error('dynamic-anchor callers found:');
  console.error(dynamicPass.stdout);
  process.exit(1);
}
```

**Key takeaway for planner:** `read_first` is `scripts/leak-grep.cjs` (for existing ripgrep-wrapper style) AND RESEARCH §Example 1. Expected first-run output: **zero dynamic anchors** (RESEARCH §Assumption A4) — that's a pass.

---

### `tests/conformance/write-outcome.test.ts` (REFACTOR into harness — Pitfall 7)

**Analog:** itself — lines 42-54 show the current `beforeEach(... MarkdownAdapter ...)` that needs to move up to a harness parameter.

**Current shape** (`write-outcome.test.ts:42-54`):
```typescript
describe('recordStateAppend outcomes', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-write-outcome-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);  // ← hard-coded
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });
```

**Phase 7 migrated shape** (fold the entire describe tree into a function called from `runAdapterConformanceSuite`):
```typescript
// Option A (recommended per RESEARCH Pitfall 7): move the describe blocks
// INSIDE adapter.conformance.ts, consuming the harness's adapterFactory.
// OR author a parallel function exported for the harness to call.
export function runStateWriteOutcomeSuite(
  adapterName: string,
  adapterFactory: (projectDir: string) => StorageAdapter,
): void {
  describe(`recordStateAppend outcomes (${adapterName})`, () => {
    let tmpDir: string;
    let adapter: StorageAdapter;
    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'gsd-write-outcome-'));
      await mkdir(join(tmpDir, '.planning'), { recursive: true });
      adapter = adapterFactory(tmpDir);  // ← parameterized
    });
    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });
    // ... all existing it() blocks unchanged
  });
}
```

**Key takeaway for planner:** `read_first` is `tests/conformance/write-outcome.test.ts:1-80` (header + first describe). Also include `tests/conformance/adapter.conformance.ts:24-89` (harness signature + pattern for how runAdapterConformanceSuite embeds its nested describes). **Migration rule:** every `beforeEach { adapter = new MarkdownAdapter(tmpDir) }` becomes `adapter = adapterFactory(tmpDir)`; the enclosing describe takes the adapterName as suffix.

Same rule applies to `tests/conformance/write-events.test.ts:16-28` and `tests/conformance/write-transaction.test.ts:32-44`.

---

### `package.json` (MODIFY — D-02 devDep + test script)

**Analog:** sibling `/Volumes/code/gsd-beads/package.json:47` (mirror pattern for `file:../` link).

**Sibling existing pattern** (`gsd-beads/package.json:44-50`):
```json
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22",
    "get-shit-done-cc": "file:../get-shit-done",
    "typescript": "^5",
    "vitest": "^4.1.6"
  },
```

**Fork Phase 7 additions** (`package.json:62-64` extension):
```json
  "devDependencies": {
    "c8": "^11.0.0",
    "fast-check": "^4.8.0",
    "@fast-check/vitest": "^0.4.1",
    "gsd-beads": "file:../gsd-beads"
  },
```

**Script addition** (`package.json:80` extension):
```json
    "test:conformance": "NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run --config vitest.conformance.config.ts",
    "test:conformance:paired": "NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run --config vitest.conformance.config.ts tests/conformance/paired.test.ts tests/conformance/properties.test.ts tests/conformance/failure-injection.test.ts tests/conformance/meta-coverage.test.ts",
    "prebuild:conformance": "node scripts/extract-section-anchors.mjs"
```

**Key takeaway for planner:** `read_first` is `package.json:58-82` (deps + scripts). Mirror sibling's file-link style verbatim.

---

### `/Volumes/code/gsd-beads/package.json` (MODIFY — D-04 subpath export)

**Analog:** fork `/Volumes/code/get-shit-done/package.json:26-32` (the `./conformance` subpath export — direct parallel).

**Fork existing pattern** (`get-shit-done/package.json:26-32`):
```json
  "exports": {
    "./conformance": "./tests/conformance/dist/tests/conformance/adapter.conformance.js",
    "./adapters/types.js": "./adapters/dist/types.js",
    "./adapters/state-event-types.js": "./adapters/dist/state-event-types.js",
    "./adapters/markdown": "./adapters/dist/markdown/index.js",
    "./package.json": "./package.json"
  },
```

**Sibling Phase 7 addition** (`gsd-beads/package.json:8-15` extension):
```json
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./testing": {
      "import": "./dist/testing/conformance-factory.js",
      "types": "./dist/testing/conformance-factory.d.ts",
      "default": "./dist/testing/conformance-factory.js"
    },
    "./package.json": "./package.json"
  },
```

**Key takeaway for planner:** `read_first` is `/Volumes/code/get-shit-done/package.json:26-32` (fork's precedent) AND `/Volumes/code/gsd-beads/package.json:8-15` (sibling's existing shape to extend). Also verify `tsconfig.json` `include: ["src/**/*.ts"]` covers `src/testing/`.

---

### `.github/workflows/test.yml` (MODIFY — D-03 bd install)

**Analog:** itself — existing `test.yml:54-108` shows the fork's GitHub Actions discipline (pinned action SHAs, matrix strategy, conditional steps).

**Existing style** (`test.yml:82-93`):
```yaml
- name: Set up Node.js ${{ matrix.node-version }}
  uses: actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f  # v6.3.0
  with:
    node-version: ${{ matrix.node-version }}
    cache: 'npm'

- name: Install dependencies
  run: npm ci

- name: Build SDK dist (required by installer)
  run: npm run build:sdk
```

**Phase 7 additions** (from RESEARCH §"bd install CI Patterns"):
```yaml
- name: Install bd (release tarball)
  if: runner.os == 'Linux'
  run: |
    BD_VERSION=1.0.4
    BD_URL="https://github.com/<bd-org>/beads/releases/download/v${BD_VERSION}/bd-linux-amd64.tar.gz"
    curl -L -o /tmp/bd.tar.gz "$BD_URL"
    sudo tar -xzf /tmp/bd.tar.gz -C /usr/local/bin
    bd --version

- name: Install bd (Homebrew on macOS)
  if: runner.os == 'macOS'
  run: |
    brew install bd || brew upgrade bd
    bd --version

- name: Checkout sibling gsd-beads
  uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd  # v6.0.2
  with:
    repository: <org>/gsd-beads
    path: ../gsd-beads   # Required by package.json "file:../gsd-beads"

- name: Run paired conformance
  if: matrix.os == 'ubuntu-latest' && matrix.node-version == 24
  run: npm run test:conformance:paired
```

**Key takeaway for planner:** `read_first` is `.github/workflows/test.yml:1-109` (whole file for style). The bd URL template is **Assumption A1** in RESEARCH — planner must `curl -I` to verify before Plan 07-04 lands.

---

## Shared Patterns

### Test Setup (`beforeEach` + `afterEach` mkdtemp/rm/mkdir)

**Source:** `tests/conformance/write-outcome.test.ts:42-54` (and identical in write-events, write-transaction, binary-asset, etc.)

**Apply to:** Every new test file that instantiates an adapter directly.
**EXCEPTION:** Tests running under `runAdapterConformanceSuite` inherit setup from `adapter.conformance.ts:32-42`.

```typescript
let tmpDir: string;
let adapter: StorageAdapter;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-<file-prefix>-'));
  await mkdir(join(tmpDir, '.planning'), { recursive: true });
  adapter = new MarkdownAdapter(tmpDir);  // or adapterFactory
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});
```

### bd Spawn Discipline (Landmine 9 + 11)

**Source:** `/Volumes/code/gsd-beads/tests/fixture.ts:42-91` (`setupFreshAdapter`).
**Apply to:** Any test/helper that invokes `bd` directly (rollback-diff.ts `beadsSnapshot`, smoke tests that don't use fixture).

```typescript
spawnSync('bd', [...args], {
  cwd: projectDir,
  env: { ...process.env, BEADS_ACTOR: 'seed' },  // Landmine 11
  encoding: 'utf-8',
});
// After init: chmod 0o700 on .beads/ (Landmine 9)
```

**Critical:** D-11 rollback-diff pattern REQUIRES `BEADS_ACTOR=seed` on EVERY bd invocation, not just init (RESEARCH §Pitfall 4) — otherwise `created_by` drifts between snapshots.

### Harness Invocation Signature (Phase 1 D-15 locked)

**Source:** `tests/conformance/adapter.conformance.ts:24-27`.
**Apply to:** `paired.test.ts` (twice) and any refactored write-*.test.ts files.

```typescript
export function runAdapterConformanceSuite(
  adapterName: string,
  adapterFactory: (projectDir: string) => StorageAdapter,
): void { /* ... */ }
```

**LOCKED** — do not modify signature; author parallel exports if new shapes needed.

### StateWriteOutcome 3-State Assertion Discipline (D-2026-05-10-08)

**Source:** `adapters/types.ts:50-52` (type) + `tests/conformance/write-outcome.test.ts:56-76` (example assertions).
**Apply to:** Every manifest entry for `recordState*` methods; every paired test for these methods.

```typescript
// Three variants:
expect(outcome).toEqual({ applied: true });
expect(outcome).toEqual({ applied: true, created_section: '## Decisions Made' });
expect(outcome).toEqual({ applied: false, reason: 'duplicate' /* | 'nothing_to_remove' */ });
```

Manifest must encode per-adapter `created_section` deviation (D-07, BeadsAdapter → `null`).

### Throw-Inside-withTransaction-fn (D-10)

**Source:** `tests/conformance/write-transaction.test.ts:141-158`.
**Apply to:** `failure-injection.test.ts` (both markdown and beads tests).

```typescript
await expect(
  adapter.withTransaction(async () => {
    await adapter.putRecord('a.md', 'x');
    await adapter.putRecord('b.md', 'y');
    throw new Error('boom');
  }),
).rejects.toThrow('boom');
```

### CJS Path Resolution (dist/src ambiguity)

**Source:** `adapters/markdown/index.ts:44-65` (three-candidate probe).
**Apply to:** Any new TypeScript file in `adapters/` that imports a bundled runtime asset. (Phase 7 tests do NOT need this — test code runs under vitest source mode only.)

## No Analog Found

None — every Phase 7 file has at least a role-match analog in the existing codebase, RESEARCH.md, or sibling repo. Low-risk pattern inventory.

## Metadata

**Analog search scope:**
- Fork: `adapters/`, `tests/conformance/`, `scripts/`, `.github/workflows/`, `package.json`, `vitest.conformance.config.ts`
- Sibling: `/Volumes/code/gsd-beads/src/`, `/Volumes/code/gsd-beads/tests/`, `/Volumes/code/gsd-beads/package.json`

**Files scanned (read in full or targeted):**
- `tests/conformance/adapter.conformance.ts` (89 LOC)
- `tests/conformance/markdown.conformance.test.ts` (7 LOC)
- `tests/conformance/write-transaction.test.ts` (224 LOC)
- `tests/conformance/write-outcome.test.ts` (header+first 80 LOC of 453)
- `tests/conformance/write-events.test.ts` (header+first 80 LOC of 480)
- `adapters/types.ts` (167 LOC)
- `adapters/state-event-types.ts` (105 LOC)
- `adapters/markdown/index.ts` (lines 1-80, 940-1010 of 1452)
- `package.json`, `vitest.conformance.config.ts`, `.github/workflows/test.yml`
- `/Volumes/code/gsd-beads/tests/conformance.test.ts` (96 LOC)
- `/Volumes/code/gsd-beads/tests/fixture.ts` (105 LOC)
- `/Volumes/code/gsd-beads/src/index.ts` (lines 1-80, 180-200 of 200)
- `/Volumes/code/gsd-beads/src/format/frontmatter.ts` (105 LOC)
- `/Volumes/code/gsd-beads/src/format/section.ts` (first 60 LOC of ~142)
- `/Volumes/code/gsd-beads/tests/smoke/section-primitives.test.ts` (first 50 LOC)
- `/Volumes/code/gsd-beads/package.json`

**Pattern extraction date:** 2026-05-12
