/**
 * Phase 7 Plan 07-05b: property-based round-trip tests (CONFORM-02, D-12, D-14).
 *
 * For every noun in the catalog, generate values via its fc.Arbitrary and assert:
 *
 *   adapter.getRecord(path) === adapter.normalize(encode(value))
 *
 * Runs against both adapters. MarkdownAdapter's normalize is identity
 * (byte-preserving); BeadsAdapter's normalize composes frontmatter
 * parse/format. Modulo-normalize equality is the correct contract per D-13.
 *
 * Adaptive budget (D-14): numRuns: Infinity + interruptAfterTimeLimit:
 * 60_000 ms per (noun × adapter). Vitest per-test timeout: 90_000 ms
 * (Pitfall 2 headroom). Property tests register with assertFromManifest
 * for bidirectional meta-coverage.
 *
 * Registration discipline: preRegisterTest() is called at COLLECTION time
 * (outside it()) so that meta-coverage.test.ts reads a fully-populated
 * registeredTests Set regardless of file-execution order.
 */
import { describe, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fc from 'fast-check';
import type { StorageAdapter } from '../../adapters/types.js';
import { assertFromManifest, preRegisterTest } from './test-registry.js';
import type { AdapterName } from './manifest-types.js';
// Reuse the adapter-tuple + bd probe from paired.test.ts (07-04a).
import { pairedAdapters } from './paired.test.js';

// --- arbitraries ---
import { arbPhase } from './arbitraries/arbPhase.js';
import { arbPlan } from './arbitraries/arbPlan.js';
import { arbSummary } from './arbitraries/arbSummary.js';
import { arbUat } from './arbitraries/arbUat.js';
import { arbStateEvent } from './arbitraries/arbStateEvent.js';
import { arbRoadmap } from './arbitraries/arbRoadmap.js';
import { arbDecision } from './arbitraries/arbDecision.js';
import { arbBlocker } from './arbitraries/arbBlocker.js';
import { arbDebugSession } from './arbitraries/arbDebugSession.js';
import { arbProject } from './arbitraries/arbProject.js';
import { arbSpec } from './arbitraries/arbSpec.js';
import { arbAiSpec } from './arbitraries/arbAiSpec.js';
import { encodeFrontmatterDoc } from './arbitraries/encode.js';

/** Noun catalog: name → (arbitrary, relative path for putRecord). */
const NOUNS: Array<{ name: string; arb: fc.Arbitrary<unknown>; path: string }> = [
  { name: 'Phase',        arb: arbPhase,        path: 'prop/phase.md' },
  { name: 'Plan',         arb: arbPlan,         path: 'prop/plan.md' },
  { name: 'Summary',      arb: arbSummary,      path: 'prop/summary.md' },
  { name: 'Uat',          arb: arbUat,          path: 'prop/uat.md' },
  { name: 'StateEvent',   arb: arbStateEvent,   path: 'prop/state-event.md' },
  { name: 'Roadmap',      arb: arbRoadmap,      path: 'prop/roadmap.md' },
  { name: 'Decision',     arb: arbDecision,     path: 'prop/decision.md' },
  { name: 'Blocker',      arb: arbBlocker,      path: 'prop/blocker.md' },
  { name: 'DebugSession', arb: arbDebugSession, path: 'prop/debug-session.md' },
  { name: 'Project',      arb: arbProject,      path: 'prop/project.md' },
  { name: 'Spec',         arb: arbSpec,         path: 'prop/spec.md' },
  { name: 'AiSpec',       arb: arbAiSpec,       path: 'prop/ai-spec.md' },
];

for (const [adapterName, adapterFactory] of pairedAdapters) {
  // Pre-register all noun-roundtrip keys at COLLECTION time so meta-coverage
  // sees a fully-populated registeredTests before any it() runs.
  for (const { name } of NOUNS) {
    preRegisterTest(adapterName as AdapterName, name, 'noun-roundtrip');
  }

  describe(`noun round-trips under normalize() (${adapterName})`, () => {
    let tmpDir: string;
    let adapter: StorageAdapter;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'gsd-prop-'));
      // Pre-create .planning/ so MarkdownAdapter constructor resolves planningDir.
      await mkdir(join(tmpDir, '.planning'), { recursive: true });
      adapter = adapterFactory(tmpDir);
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    for (const { name, arb, path } of NOUNS) {
      it(
        `${name}: getRecord(p) === normalize(encode(value))`,
        async () => {
          // assertFromManifest at run-time (safety guard — collection-time
          // preRegisterTest above is the primary registration point).
          assertFromManifest(
            adapterName as AdapterName,
            name,
            'noun-roundtrip',
            (_expected) => {
              // Manifest presence validated by assertFromManifest itself.
              // Actual round-trip assertion is the fc.assert below.
            },
          );

          await fc.assert(
            fc.asyncProperty(arb, async (value) => {
              // Pre-normalize so that the written form is already in the
              // adapter's canonical representation. For MarkdownAdapter,
              // normalize() is identity (byte-preserving), so this is a
              // no-op. For BeadsAdapter, normalize() applies a frontmatter
              // parse→format round-trip (js-yaml normalization), ensuring
              // disk-tier paths round-trip correctly (D-13).
              const rawBody = encodeFrontmatterDoc(
                { noun: name },
                JSON.stringify(value),
              );
              const body = adapter.normalize(rawBody);
              await adapter.putRecord(path, body);
              const retrieved = await adapter.getRecord(path);
              const expected = adapter.normalize(body); // idempotent: normalize(normalize(x)) === normalize(x)
              if (retrieved !== expected) {
                throw new Error(
                  `round-trip mismatch for ${adapterName}/${name}:\n` +
                  `  expected (normalize(body)): ${JSON.stringify(expected?.slice(0, 200))}\n` +
                  `  actual   (getRecord result): ${JSON.stringify(retrieved?.slice(0, 200))}`,
                );
              }
            }),
            {
              numRuns: Number.POSITIVE_INFINITY,
              endOnFailure: true,
              interruptAfterTimeLimit: 60_000,
              markInterruptAsFailure: false,
              verbose: true,
            },
          );
        },
        90_000,
      );
    }
  });
}
