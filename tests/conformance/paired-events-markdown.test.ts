/**
 * Phase 7 paired-events entry (MarkdownAdapter).
 *
 * Standalone vitest test file — see paired-outcome-markdown.test.ts for the
 * per-adapter split rationale.
 */
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import { runStateEventDispatchSuite } from './write-events.conformance-suite.js';

runStateEventDispatchSuite('markdown', (projectDir) => new MarkdownAdapter(projectDir));
