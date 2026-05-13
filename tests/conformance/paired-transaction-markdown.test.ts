/**
 * Phase 7 paired-transaction entry (MarkdownAdapter).
 */
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import { runWithTransactionSuite } from './write-transaction.conformance-suite.js';

runWithTransactionSuite('markdown', (projectDir) => new MarkdownAdapter(projectDir));
