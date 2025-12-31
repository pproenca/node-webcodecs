import { defineConfig } from 'vitest/config';

// Skip slow reference tests in CI - they require longer timeouts and more resources
const isCI = process.env.CI === 'true';

export default defineConfig({
  test: {
    root: './test',
    include: isCI
      ? ['golden/**/*.test.{ts,js,mjs}', 'unit/**/*.test.{ts,js,mjs}']
      : ['golden/**/*.test.{ts,js,mjs}', 'reference/**/*.test.{ts,js,mjs}', 'unit/**/*.test.{ts,js,mjs}'],
    setupFiles: ['./setup.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    isolate: false,
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
