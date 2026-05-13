/**
 * Phase 7 paired-core entry (MarkdownAdapter).
 *
 * Standalone vitest test file that invokes the locked Phase 1 D-15
 * `runAdapterConformanceSuite` harness against MarkdownAdapter. Split from
 * paired.test.ts so vitest's parallel forks can run MarkdownAdapter and
 * BeadsAdapter core suites concurrently.
 */
import { runAdapterConformanceSuite } from './adapter.conformance.js';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';

runAdapterConformanceSuite(
  'markdown',
  (projectDir) => new MarkdownAdapter(projectDir),
);
