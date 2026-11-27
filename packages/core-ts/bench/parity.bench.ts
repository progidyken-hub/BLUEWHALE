/**
 * Cross-language parity benchmarks (TypeScript leg).
 *
 * The workloads, inputs and names here MUST stay identical to:
 *   packages/core-go/{address,muxed,routing}/parity_bench_test.go
 *   packages/core-dart/benchmark/parity_benchmark.dart
 *
 * Run all three on the same host with scripts/run-parity-benchmarks.sh, or
 * this leg alone with:
 *
 *   npx vitest bench --run bench/parity.bench.ts
 *
 * PARITY_BENCH_TIME_MS sets the measured time per workload (default 1000).
 * When PARITY_BENCH_OUTPUT is set, results are also written there as JSON
 * lines: {"workload":"parse_g","opsPerSec":1234567.8}
 */
import { appendFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parse } from "../src/address/parse";
import { decodeMuxed } from "../src/muxed/decode";
import { extractRouting } from "../src/routing/extract";

const G_ADDRESS = "GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI";
const M_ADDRESS =
  "MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQACABAAAAAAAAAAEVIG";
const MEMO_ID = "9007199254740993";

const TIME_MS = Number(process.env.PARITY_BENCH_TIME_MS ?? 1000);
const OUTPUT = process.env.PARITY_BENCH_OUTPUT;

const workloads: [string, () => unknown][] = [
  ["parse_g", () => parse(G_ADDRESS)],
  ["parse_m", () => parse(M_ADDRESS)],
  ["decode_muxed", () => decodeMuxed(M_ADDRESS)],
  [
    "extract_routing_memo_id",
    () =>
      extractRouting({
        destination: G_ADDRESS,
        memoType: "id",
        memoValue: MEMO_ID,
        sourceAccount: null,
      }),
  ],
];

for (const [name, fn] of workloads) {
  test(
    `parity: ${name}`,
    async ({ bench }) => {
      const result = await bench(name, () => {
        fn();
      }).run({ time: TIME_MS, warmupTime: TIME_MS / 4 });

      const opsPerSec = result.throughput.mean;
      expect(opsPerSec).toBeGreaterThan(0);
      if (OUTPUT) {
        appendFileSync(OUTPUT, JSON.stringify({ workload: name, opsPerSec }) + "\n");
      }
    },
    TIME_MS * 4 + 30_000
  );
}
