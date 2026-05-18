/**
 * Phase 2 paired-seam entry (MarkdownAdapter).
 *
 * Invokes runSeamRealnessSuite against MarkdownAdapter. Each test exercises
 * a migrated state-mutation handler via full registry dispatch (not direct
 * call) to prove routing reaches the adapter (SEAM-01, SEAM-03, SEAM-05).
 */
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import { runSeamRealnessSuite } from './seam-realness.conformance-suite.js';

runSeamRealnessSuite('markdown', (projectDir) => new MarkdownAdapter(projectDir));
