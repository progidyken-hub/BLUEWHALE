#!/usr/bin/env node
/**
 * Reference conformance adapter for core-ts (protocol bluewhale-conformance/1).
 *
 * Reads one JSON request per line on stdin and writes one JSON response per
 * line on stdout. See docs/guides/conformance.md.
 *
 *   (cd packages/core-ts && pnpm exec tsup src/index.ts --format cjs)
 *   node scripts/conformance/runner.mjs -- node scripts/conformance/adapters/core-ts.mjs
 *
 * or, with Docker:
 *
 *   docker build -f Dockerfile.conformance --target self-test -t bluewhale-conformance:self-test .
 *   docker run --rm bluewhale-conformance:self-test
 *
 * BLUEWHALE_CORE_TS overrides the module to load (default: the built
 * packages/core-ts/dist/index.js next to this repository).
 */
import { createRequire } from "node:module";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = resolve(here, "../../../packages/core-ts");
const core = require(process.env.BLUEWHALE_CORE_TS ?? resolve(pkgDir, "dist/index.js"));
const { version } = require(resolve(pkgDir, "package.json"));

const PROTOCOL = "bluewhale-conformance/1";
const OPS = ["detect", "muxed_encode", "muxed_decode", "extract_routing"];

const warning = (w) => ({ code: w.code, severity: w.severity, message: w.message });

const handlers = {
  hello: () => ({
    protocol: PROTOCOL,
    implementation: { name: "core-ts", version, language: "typescript" },
    ops: OPS,
  }),

  detect: ({ address }) => {
    const parsed = core.parse(address);
    if (parsed.kind === "invalid") return { kind: "invalid" };
    return { kind: parsed.kind, address: parsed.address, warnings: parsed.warnings.map(warning) };
  },

  muxed_encode: ({ baseG, id }) => ({ mAddress: core.encodeMuxed(baseG, BigInt(id)) }),

  muxed_decode: ({ mAddress }) => {
    const { baseG, id } = core.decodeMuxed(mAddress);
    return { baseG, id: id.toString() };
  },

  extract_routing: (input) => {
    const r = core.extractRouting({
      destination: input.destination,
      memoType: input.memoType,
      memoValue: input.memoValue,
      sourceAccount: input.sourceAccount,
    });
    return {
      destinationBaseAccount: r.destinationBaseAccount,
      routingId: r.routingId === null ? null : String(r.routingId),
      routingSource: r.routingSource,
      warnings: r.warnings.map(warning),
      ...(r.destinationError ? { destinationError: r.destinationError } : {}),
    };
  },
};

const lines = createInterface({ input: process.stdin });
for await (const line of lines) {
  if (!line.trim()) continue;
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    continue; // Not a request; the runner only sends JSON.
  }
  const handler = handlers[req.op];
  let res;
  if (!handler) {
    res = { id: req.id, ok: false, error: { code: "UNSUPPORTED_OP", message: `unsupported op ${req.op}` } };
  } else {
    try {
      res = { id: req.id, ok: true, output: handler(req.input ?? {}) };
    } catch (err) {
      res = { id: req.id, ok: false, error: { code: err?.code ?? "ERROR", message: String(err?.message ?? err) } };
    }
  }
  process.stdout.write(JSON.stringify(res) + "\n");
}
