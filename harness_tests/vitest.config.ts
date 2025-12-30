import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/node-webcodecs/**/*.test.{ts,js}'],
  },
})
