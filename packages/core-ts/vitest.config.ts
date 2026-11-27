import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Distribute test files across worker threads to utilise available CPU
    // cores. Each worker gets its own module registry so tests are isolated.
    pool: "threads",
    poolOptions: {
      threads: {
        // Let Vitest decide the thread count based on available CPUs.
        // Set singleThread: false explicitly to opt into parallel execution.
        singleThread: false,
      },
    },
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 90,
      },
    },
  },
});
