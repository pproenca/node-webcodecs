import { defineConfig } from 'vitest/config';

// Reference tests are slow (codec conversion) and should only run on-demand.
// Use INCLUDE_REFERENCE=true to include them, or use npm run test-reference.
// Stress tests are for memory/threading validation and run on-demand.
// Use INCLUDE_STRESS=true to include them.
const includeReference = process.env.INCLUDE_REFERENCE === 'true';
const includeStress = process.env.INCLUDE_STRESS === 'true';

export default defineConfig({
  test: {
    // Disable watch mode - always run once and exit
    watch: false,
    root: './test',
    include: [
      'golden/**/*.test.{ts,js,mjs}',
      'unit/**/*.test.{ts,js,mjs}',
      ...(includeReference ? ['reference/**/*.test.{ts,js,mjs}'] : []),
      ...(includeStress ? ['stress/**/*.test.{ts,js,mjs}'] : []),
    ],
    setupFiles: ['./setup.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    // Fix: Enable isolation to prevent tests from interfering with each other
    // caused by shared global state in test/setup.ts
    isolate: true,
    fileParallelism: true,
    // Use single fork to prevent "Worker exited unexpectedly" crashes during cleanup.
    // Multiple forks with native addons can race during process shutdown.
    // Single fork ensures clean sequential teardown of FFmpeg resources.
    // See: https://github.com/vitest-dev/vitest/discussions/6285
    pool: 'forks',
    forks: {
      singleFork: true,
    },
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
