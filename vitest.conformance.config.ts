import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'conformance',
    include: ['tests/conformance/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
