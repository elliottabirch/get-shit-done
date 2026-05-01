import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          root: './sdk',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.integration.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          root: './sdk',
          include: ['src/**/*.integration.test.ts'],
          testTimeout: 120_000,
        },
      },
      {
        test: {
          name: 'adapters',
          root: './adapters',
          // types.test.ts is compile-time only (no vitest describe/it blocks)
          include: ['markdown/**/*.test.ts'],
          exclude: ['dist/**'],
        },
      },
    ],
  },
});
