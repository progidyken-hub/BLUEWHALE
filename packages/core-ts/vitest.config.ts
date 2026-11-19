import { defineConfig } from "vitest/config";
import os from "node:os";

// Number of worker threads used to run test files in parallel across CPU
// cores (issue #452). Evaluated on the host that runs the tests rather than
// committed as a fixed literal, so a 4-core laptop and a 32-core CI runner
// each use their full core count. The normative vector suite is split into
// one file per module (vectors.<module>.test.ts) so the pool distributes the
// vector modules across these cores instead of running the whole suite on a
// single core.
const cpuCount = Math.max(
  1,
  os.availableParallelism?.() ?? os.cpus().length ?? 1
);

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Run test files in a thread pool sized to the host CPU count so test
    // execution — including the per-module vector runners — is parallelized
    // across CPU cores.
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: cpuCount,
      },
    },
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // The normative vector runners are data-driven: a module with no vectors
    // in the shared spec package (currently extract_from_uri, which the
    // @redishfish/bluewhale-spec package does not yet carry) yields a file with
    // no tests. Treat that as a pass rather than a failure so the per-module
    // runners stay structurally complete.
    passWithNoTests: true,
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
