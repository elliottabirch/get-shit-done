import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// __dirname is the config file's directory (repo root under vitest/vite CJS transformation).
// Alias keys must be ABSOLUTE paths (resolved form) so vitest intercepts the barrel file
// regardless of the relative depth of the importing module. Using '../../adapters/...'
// only intercepts imports with that exact specifier string; absolute keys intercept ANY
// import that resolves to the same path (the barrel re-exporting from dist/markdown/).
const ROOT = resolve(__dirname);

export default defineConfig({
  resolve: {
    alias: {
      // Resolve adapter barrel/dist imports to TypeScript source.
      // Absolute key intercepts both '../../adapters/markdown/index.js' (from test files)
      // AND the resolved absolute path (from any other importer in the module graph).
      //
      // Two keys for the markdown adapter: the barrel file and the compiled dist.
      // The barrel (adapters/markdown/index.js) re-exports from dist/markdown/index.js.
      // In vitest's forks pool, the barrel's re-export can bypass the first alias when a
      // stale dist exists on disk — the second alias catches that path and routes it to
      // the TypeScript source so normalize() (added post-build) is always available.
      [resolve(ROOT, 'adapters/markdown/index.js')]: resolve(ROOT, 'adapters/markdown/index.ts'),
      [resolve(ROOT, 'adapters/dist/markdown/index.js')]: resolve(ROOT, 'adapters/markdown/index.ts'),
      [resolve(ROOT, 'adapters/types.js')]: resolve(ROOT, 'adapters/types.ts'),
    },
  },
  test: {
    name: 'conformance',
    // All conformance test files EXCEPT meta-coverage. Meta-coverage is invoked
    // separately (after paired workers exit + flush their registry files) via
    // vitest.meta-coverage.config.ts. This avoids the "meta starts last but
    // others haven't flushed yet" race that singleFork was previously solving
    // at the cost of all-sequential runs.
    include: ['tests/conformance/**/*.test.ts'],
    exclude: ['tests/conformance/meta-coverage.test.ts', '**/node_modules/**'],
    testTimeout: 30_000,
    // Parallel forks for speed. Cross-process state is published via
    // `.vitest-tmp/registry/` — each worker appends its own JSONL file.
    // See tests/conformance/test-registry.ts.
    pool: 'forks',
    // No singleFork, no isolate:false, no custom sequencer — all three were
    // workarounds for the in-memory Set limitation. File-based registry
    // makes them unnecessary.
  },
});
