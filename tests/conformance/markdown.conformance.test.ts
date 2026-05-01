import { runAdapterConformanceSuite } from './adapter.conformance.js';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';

runAdapterConformanceSuite(
  'markdown',
  (projectDir) => new MarkdownAdapter(projectDir),
);
