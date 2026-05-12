import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'adapters',
    // Phase 5 Plan 01: types.test.ts now contains a runtime describe block for
    // D-13/D-14 (NamedDocCategory / RootNamedDocKey) in addition to the
    // pre-existing compile-time-only type assertions. Include it so the new
    // runtime assertions are exercised alongside the markdown adapter suite.
    include: ['markdown/**/*.test.ts', 'types.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
});
