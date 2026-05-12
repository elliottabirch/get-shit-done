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
      [resolve(ROOT, 'adapters/markdown/index.js')]: resolve(ROOT, 'adapters/markdown/index.ts'),
      [resolve(ROOT, 'adapters/types.js')]: resolve(ROOT, 'adapters/types.ts'),
    },
  },
  test: {
    name: 'conformance',
    include: ['tests/conformance/**/*.test.ts'],
    testTimeout: 30_000,
    // Required for meta-coverage: registeredTests (test-registry.ts) is a
    // module-level singleton. Without isolate:false, each test file gets its
    // own module instance and registeredTests in meta-coverage.test.ts would
    // be empty. isolate:false shares module instances across test files so
    // assertFromManifest() calls in paired.test.ts populate the same Set
    // that meta-coverage.test.ts reads.
    isolate: false,
    // Pool: singleFork ensures all test files run in the SAME process sequentially.
    // Without this, isolate:false still allows concurrent forked workers — each
    // file gets its own process and registeredTests is reset. singleFork uses a
    // single child process that processes files one at a time.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Sequence is critical: paired.test.ts must run before meta-coverage.test.ts
    // reads registeredTests. The sequencer pins meta-coverage last.
    sequence: {
      concurrent: false,
      sequencer: class {
        ctx: unknown;
        constructor(ctx: unknown) { this.ctx = ctx; }
        async sort(files: unknown[]): Promise<unknown[]> {
          const isMetaCoverage = (f: unknown): boolean =>
            String((f as Record<string, unknown>)?.moduleId ?? '').includes('meta-coverage');
          const metaCoverage = files.filter(isMetaCoverage);
          const rest = files.filter(f => !isMetaCoverage(f));
          return [...rest, ...metaCoverage];
        }
        async shard(files: unknown[]): Promise<unknown[]> {
          return files;
        }
      },
    },
  },
});
