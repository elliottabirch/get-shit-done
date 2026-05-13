/**
 * Phase 7 paired harness entry (split into per-adapter/per-suite files).
 *
 * HISTORY: This file originally invoked runAdapterConformanceSuite for both
 * adapters AND invoked the three migrated suites in a for-loop — keeping all
 * 119+ tests inside a single vitest worker. That blocked parallel forks.
 *
 * CURRENT: Split across 8 per-adapter/per-suite files:
 *   paired-core-{markdown,beads}.test.ts        ← runAdapterConformanceSuite
 *   paired-outcome-{markdown,beads}.test.ts     ← runStateWriteOutcomeSuite
 *   paired-events-{markdown,beads}.test.ts      ← runStateEventDispatchSuite
 *   paired-transaction-{markdown,beads}.test.ts ← runWithTransactionSuite
 *
 * Under `pool: 'forks'` (no singleFork), vitest runs each .test.ts in its
 * own worker, enabling true parallelism. The file-based test-registry
 * (tests/conformance/test-registry.ts) aggregates per-worker registrations
 * for meta-coverage to read after all paired workers exit.
 *
 * This file is retained as an entry-point marker + documentation; it
 * contains no test code so vitest will report an empty file (harmless).
 */
import { describe, it } from 'vitest';

describe('paired harness (split into paired-*-*.test.ts files)', () => {
  it('see paired-core/outcome/events/transaction-*.test.ts files', () => {
    // Intentional no-op. Real tests live in the per-adapter/per-suite splits.
  });
});
