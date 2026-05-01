import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'adapters',
    // types.test.ts is a compile-time-only type assertion file (no vitest describe/it blocks)
    include: ['markdown/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
});
