/**
 * Stryker Mutation Testing Configuration — Issue #453
 *
 * Measures the quality of the test suite by injecting surviving mutants into
 * the core source files and verifying that the test suite kills them.
 *
 * Run:
 *   pnpm mutation            # local run with clear-text reporter
 *   pnpm mutation:ci         # CI run with progress + HTML + JSON reporters
 *
 * Generated reports land in:
 *   reports/mutation/html/   — browsable HTML mutation report
 *   reports/mutation/json/   — machine-readable JSON for CI thresholds
 *
 * Mutation score thresholds (enforced; CI fails below these):
 *   break  : 60  — hard stop, build marked failed
 *   low    : 70  — warning, build marked degraded
 *   high   : 80  — badge goes orange below this
 *
 * Mutant exclusions:
 *   - cli.ts        — CLI entry-point; side-effect code not unit-tested
 *   - *.test.ts     — test files must never be mutated
 *   - *.stories.tsx — Ladle stories are not part of the test harness
 *
 * @see https://stryker-mutator.io/docs/stryker-js/configuration/
 */

/** @type {import('@stryker-mutator/core').PartialStrykerOptions} */
export default {
  // ── Test runner ───────────────────────────────────────────────────────────
  testRunner: "vitest",
  testRunnerNodeArgs: [],

  // ── TypeScript type-checking (catches type errors introduced by mutants) ──
  checkers: ["typescript"],
  tsconfigFile: "tsconfig.json",

  // ── Source files to mutate ────────────────────────────────────────────────
  mutate: [
    "src/**/*.ts",
    // Exclusions: CLI entry, test files, story files, type-only declarations.
    "!src/cli.ts",
    "!src/**/*.test.ts",
    "!src/**/*.stories.tsx",
    "!src/types/**/*.ts",
  ],

  // ── Mutation operators ────────────────────────────────────────────────────
  // Using the full default set. The most impactful mutators for this codebase:
  //   ArithmeticOperator   — catches off-by-one in BigInt range checks
  //   BooleanLiteral       — catches truthy/falsy short-circuits in decodeDataValue
  //   ConditionalExpression — catches inverted guards in extractRouting
  //   LogicalOperator      — catches || vs && in warning accumulators
  //   StringLiteral        — catches warning code typos
  //   BlockStatement       — catches missing return paths

  // ── Reporters ─────────────────────────────────────────────────────────────
  reporters: ["progress", "html", "json", "clear-text"],
  htmlReporter: {
    fileName: "reports/mutation/html/index.html",
  },
  jsonReporter: {
    fileName: "reports/mutation/json/mutation-report.json",
  },

  // ── Mutation score thresholds ─────────────────────────────────────────────
  thresholds: {
    high: 80,
    low: 70,
    break: 60,
  },

  // ── Performance ───────────────────────────────────────────────────────────
  // Run at most concurrentRunners in parallel. Default is CPU count - 1.
  // Explicitly cap at 4 so CI runners with many cores don't OOM.
  concurrency: 4,

  // Increase timeout for async tests (SEP-0029 fetcher mocks may be slow).
  timeoutMS: 10000,
  timeoutFactor: 1.5,

  // ── Incremental mode ─────────────────────────────────────────────────────
  // On subsequent runs only re-test mutants whose source file changed.
  // The baseline is stored in .stryker-tmp/incremental.json.
  incremental: true,
  incrementalFile: ".stryker-tmp/incremental.json",

  // ── Miscellaneous ─────────────────────────────────────────────────────────
  // Discard temp files after each run to keep the workspace clean.
  cleanTempDir: "always",

  // Log level: "off" | "fatal" | "error" | "warn" | "info" | "debug" | "trace"
  logLevel: "info",

  // Ignore static mutations that cannot be killed by any unit test
  // (e.g. error message strings are intentionally not asserted verbatim).
  ignoreStatic: true,
};
