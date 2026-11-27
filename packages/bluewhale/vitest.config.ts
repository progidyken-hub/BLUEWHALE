import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Distribute test files across worker threads to use available CPU cores.
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
});
