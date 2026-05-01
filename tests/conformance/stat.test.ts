// tests/conformance/stat.test.ts
// Phase 2 Plan 1 D-11: dedicated entry point for stat conformance.
//
// Mounts the standard adapter conformance suite against MarkdownAdapter so
// the new stat() describe block (file/dir/null) runs as part of the per-plan
// exit gate. Phase 7 will mount the same suite against BeadsAdapter unchanged.
import { runAdapterConformanceSuite } from './adapter.conformance.js';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
runAdapterConformanceSuite('markdown-stat-only', (dir) => new MarkdownAdapter(dir));
