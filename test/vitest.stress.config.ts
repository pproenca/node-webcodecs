import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: './test',
    include: ['stress/**/*.test.{ts,js,mjs}'],
    setupFiles: ['./setup.ts'],
    testTimeout: 60000, // Stress tests may take longer
    hookTimeout: 30000,
    isolate: true,
    fileParallelism: false, // Run stress tests sequentially to avoid resource contention
    // Use single fork to prevent "Worker exited unexpectedly" crashes during cleanup.
    // See vitest.config.ts for details.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
