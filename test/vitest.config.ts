import { defineConfig } from 'vitest/config';

// Reference tests are slow (codec conversion) and should only run on-demand.
// Use INCLUDE_REFERENCE=true to include them, or use npm run test-reference.
const includeReference = process.env.INCLUDE_REFERENCE === 'true';

export default defineConfig({
  test: {
    root: './test',
    include: includeReference
      ? ['golden/**/*.test.{ts,js,mjs}', 'reference/**/*.test.{ts,js,mjs}', 'unit/**/*.test.{ts,js,mjs}']
      : ['golden/**/*.test.{ts,js,mjs}', 'unit/**/*.test.{ts,js,mjs}'],
    setupFiles: ['./setup.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    // Fix: Enable isolation to prevent tests from interfering with each other
    // caused by shared global state in test/setup.ts
    isolate: true,
    fileParallelism: true,
    coverage: {
      enabled: process.env.CI === 'true',
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/*.d.ts', 'lib/types.ts'],
      thresholds: {
        lines: 70,
        branches: 60,
        functions: 70,
        statements: 70,
      },
    },
  },
});
