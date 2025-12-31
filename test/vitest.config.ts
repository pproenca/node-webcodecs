import { defineConfig } from 'vitest/config';

// Skip slow reference tests in CI - they require longer timeouts and more resources
const isCI = process.env.CI === 'true';

export default defineConfig({
  test: {
    root: './test',
    include: isCI
      ? ['golden/**/*.test.{ts,js}', 'unit/**/*.test.{ts,js}']
      : ['golden/**/*.test.{ts,js}', 'reference/**/*.test.{ts,js}', 'unit/**/*.test.{ts,js}'],
    setupFiles: ['./setup.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    isolate: false,
    fileParallelism: true,
  },
});
