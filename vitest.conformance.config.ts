import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      // Resolve adapter imports to TypeScript source (avoids dist path-depth mismatch)
      '../../adapters/markdown/index.js': resolve(__dirname, 'adapters/markdown/index.ts'),
      '../../adapters/types.js': resolve(__dirname, 'adapters/types.ts'),
    },
  },
  test: {
    name: 'conformance',
    include: ['tests/conformance/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
