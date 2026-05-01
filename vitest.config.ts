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
      {
        // Phase 2 Plan 02-05: register-completeness test for the
        // <context>-block @.planning/ leak class (READS-03 / OQ-04 partial).
        // The test runs the audit script and the leak-grep engine, then
        // cross-references the generated register.
        test: {
          name: 'leak-grep',
          root: './tests/leak-grep',
          include: ['**/*.test.ts'],
          exclude: ['fixtures/**'],
        },
      },
    ],
  },
});
