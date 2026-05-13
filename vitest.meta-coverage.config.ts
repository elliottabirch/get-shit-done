import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Meta-coverage runs as a SEPARATE vitest invocation after the paired suite
// exits. Reads the union of `.vitest-tmp/registry/worker-*.jsonl` files that
// paired workers wrote.
//
// Why a second config: when paired tests run in parallel forks, no single
// "run last" hook can guarantee meta-coverage runs AFTER all workers have
// flushed. A second vitest process is the clean guarantee — the prior
// process has fully exited by the time this starts.
const ROOT = resolve(__dirname);

export default defineConfig({
  resolve: {
    alias: {
      [resolve(ROOT, 'adapters/markdown/index.js')]: resolve(ROOT, 'adapters/markdown/index.ts'),
      [resolve(ROOT, 'adapters/dist/markdown/index.js')]: resolve(ROOT, 'adapters/markdown/index.ts'),
      [resolve(ROOT, 'adapters/types.js')]: resolve(ROOT, 'adapters/types.ts'),
    },
  },
  test: {
    name: 'conformance-meta',
    include: ['tests/conformance/meta-coverage.test.ts'],
    testTimeout: 5_000,
    // Single file, no need for parallelism or special pool config.
  },
});
