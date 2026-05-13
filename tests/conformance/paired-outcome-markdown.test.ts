/**
 * Phase 7 paired-outcome entry (MarkdownAdapter).
 *
 * Standalone vitest test file that invokes runStateWriteOutcomeSuite against
 * MarkdownAdapter. Split from paired.test.ts so vitest's parallel forks can
 * run each adapter/suite pair in its own worker.
 */
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import { runStateWriteOutcomeSuite } from './write-outcome.conformance-suite.js';

runStateWriteOutcomeSuite('markdown', (projectDir) => new MarkdownAdapter(projectDir));
