import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    root: './test',
    include: [
      'golden/**/*.test.{ts,js}',
      'reference/**/*.test.{ts,js}',
    ],
    setupFiles: ['./setup.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    isolate: false,
    fileParallelism: false,
  },
});
