#!/usr/bin/env node
/**
 * Bluewhale conformance runner.
 *
 * Drives any implementation, in any language, through the official test
 * vectors over the stdin/stdout JSON-lines protocol documented in
 * docs/guides/conformance.md (protocol "bluewhale-conformance/1").
 *
 *   node runner.mjs [options] -- <adapter command> [args...]
 *
 * Options:
 *   --spec-dir DIR   Directory holding vectors.json and vectors/ (default:
 *                    $BLUEWHALE_SPEC_DIR, else ../../spec relative to this file)
 *   --report FILE    Also write a machine-readable JSON report to FILE
 *   --only OPS       Comma-separated ops to run (default: all)
 *   --timeout MS     Per-request timeout in milliseconds (default: 10000)
 *   --strict         Count cases the adapter reports as unsupported as failures
 *   --verbose        Print every case, not just failures
 *
 * Exit status: 0 when no case failed, 1 on failures, 2 on usage or protocol
 * errors (adapter crashed, timed out, or broke the protocol).
 *
 * Zero dependencies: Node.js >= 18 only.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const PROTOCOL = "bluewhale-conformance/1";
const OPS = ["detect", "muxed_encode", "muxed_decode", "extract_routing"];

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function usage(code, message) {
  if (message) console.error(`error: ${message}\n`);
  const help = readFileSync(fileURLToPath(import.meta.url), "utf8")
    .split("\n")
    .slice(2, 22)
    .map((l) => l.replace(/^ \* ?/, ""))
    .join("\n");
  (code === 0 ? console.log : console.error)(help);
  process.exit(code);
}

const argv = process.argv.slice(2);
const sep = argv.indexOf("--");
const flags = sep === -1 ? argv : argv.slice(0, sep);
const command = sep === -1 ? [] : argv.slice(sep + 1);

const opts = {
  specDir:
    process.env.BLUEWHALE_SPEC_DIR ||
    resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "spec"),
  report: null,
  only: null,
  timeout: 10_000,
  strict: false,
  verbose: false,
};

for (let i = 0; i < flags.length; i++) {
  const f = flags[i];
  const value = () => {
    if (i + 1 >= flags.length) usage(2, `${f} needs a value`);
    return flags[++i];
  };
  switch (f) {
    case "-h":
    case "--help":
      usage(0);
      break;
    case "--spec-dir":
      opts.specDir = resolve(value());
      break;
    case "--report":
      opts.report = resolve(value());
      break;
    case "--only":
      opts.only = new Set(value().split(",").map((s) => s.trim()).filter(Boolean));
      for (const op of opts.only) if (!OPS.includes(op)) usage(2, `unknown op ${op}`);
      break;
    case "--timeout":
      opts.timeout = Number(value());
      if (!(opts.timeout > 0)) usage(2, "--timeout must be a positive number");
      break;
    case "--strict":
      opts.strict = true;
      break;
    case "--verbose":
      opts.verbose = true;
      break;
    default:
      usage(2, `unknown option ${f}`);
  }
}

if (command.length === 0) usage(2, "missing adapter command after --");

// ---------------------------------------------------------------------------
// Load vectors and turn them into protocol requests.
// ---------------------------------------------------------------------------

// Pre-checksum placeholders in spec/vectors.json (50 characters). No
// implementation can parse them; core-go skips them, so the runner does too.
const LEGACY_PLACEHOLDER = /^[GMC]A7QYNF7SZFX4X7X5JFZZ3UQ6BXHDSY2RKVKZKX5FFQJ1ZMZX1/;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadCases(specDir) {
  const vectorsPath = join(specDir, "vectors.json");
  if (!existsSync(vectorsPath)) usage(2, `no vectors.json in ${specDir}`);

  const cases = [];
  const main = readJson(vectorsPath);
  main.cases.forEach((c, i) => {
    cases.push({
      id: `vectors.json#${i}`,
      source: "vectors.json",
      op: c.module,
      description: c.description,
      input: c.input,
      expected: c.expected,
    });
  });

  // Additional vector sets: spec/vectors/*.json with a `cases` array whose
  // entries describe extract_routing behaviour (e.g. empty-memos.json).
  const extraDir = join(specDir, "vectors");
  if (existsSync(extraDir)) {
    for (const file of readdirSync(extraDir).filter((f) => f.endsWith(".json")).sort()) {
      const doc = readJson(join(extraDir, file));
      if (!Array.isArray(doc.cases)) continue;
      doc.cases.forEach((c, i) => {
        if (!c || !c.input || !c.expected || typeof c.input.destination !== "string") return;
        cases.push({
          id: `vectors/${file}#${c.id ?? i}`,
          source: `vectors/${file}`,
          op: "extract_routing",
          description: c.description ?? c.id ?? "",
          input: c.input,
          expected: c.expected,
        });
      });
    }
  }
  return { specVersion: main.spec_version, cases };
}

function skipReason(c) {
  if (!OPS.includes(c.op)) return `module ${c.op} is not part of ${PROTOCOL}`;
  if (opts.only && !opts.only.has(c.op)) return "excluded by --only";
  const values = JSON.stringify(c.input);
  if (LEGACY_PLACEHOLDER.test(c.input?.destination ?? "") || /A7QYNF7SZFX4X7X5JFZZ3UQ6BXHDSY2RKVKZKX5FFQJ1ZMZX1/.test(values)) {
    return "legacy pre-checksum placeholder address";
  }
  return null;
}

/** Normalizes vector inputs to the protocol's request shape. */
function requestInput(c) {
  const i = c.input;
  switch (c.op) {
    case "detect":
      return { address: i.address };
    case "muxed_encode":
      return { baseG: i.base_g ?? i.baseG ?? i.gAddress, id: String(i.id) };
    case "muxed_decode":
      return { mAddress: i.mAddress };
    case "extract_routing": {
      const out = { destination: i.destination, memoType: i.memoType ?? "none" };
      out.memoValue = i.memoValue === undefined ? null : i.memoValue;
      out.sourceAccount = i.sourceAccount ?? null;
      return out;
    }
  }
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------
const warningKey = (w) => ({ code: w?.code, severity: w?.severity });

function compare(c, response) {
  const e = c.expected;
  const problems = [];
  const eq = (field, got, want) => {
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      problems.push(`${field}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    }
  };

  const wantsError = e.expected_error !== undefined;
  if (wantsError) {
    if (response.ok) problems.push(`expected an error (${e.expected_error}), got ok`);
    return problems;
  }
  if (!response.ok) {
    problems.push(`unexpected error ${JSON.stringify(response.error)}`);
    return problems;
  }

  const out = response.output ?? {};
  switch (c.op) {
    case "detect":
      eq("kind", out.kind, e.kind);
      if (e.address !== undefined) eq("address", out.address, e.address);
      if (e.warnings !== undefined) {
        eq("warnings", (out.warnings ?? []).map(warningKey), e.warnings.map(warningKey));
      }
      break;
    case "muxed_encode":
      eq("mAddress", out.mAddress, e.mAddress);
      break;
    case "muxed_decode":
      eq("baseG", out.baseG, e.baseG ?? e.base_g);
      eq("id", out.id, String(e.id));
      break;
    case "extract_routing":
      if (e.destinationBaseAccount !== undefined) {
        eq("destinationBaseAccount", out.destinationBaseAccount ?? null, e.destinationBaseAccount);
      }
      if (e.routingId !== undefined) {
        eq("routingId", out.routingId ?? null, e.routingId === null ? null : String(e.routingId));
      }
      if (e.routingSource !== undefined) eq("routingSource", out.routingSource, e.routingSource);
      if (e.warnings !== undefined) {
        eq("warnings", (out.warnings ?? []).map(warningKey), e.warnings.map(warningKey));
      }
      if (e.destinationError !== undefined) {
        eq("destinationError.code", out.destinationError?.code ?? null, e.destinationError?.code ?? null);
      }
      break;
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Adapter process
// ---------------------------------------------------------------------------
class ProtocolError extends Error {}

function startAdapter(cmd) {
  const child = spawn(cmd[0], cmd.slice(1), { stdio: ["pipe", "pipe", "inherit"] });
  const lines = createInterface({ input: child.stdout });
  const queue = [];
  const waiters = [];
  let exited = null;

  lines.on("line", (line) => {
    if (line.trim() === "") return;
    if (waiters.length) waiters.shift().resolve(line);
    else queue.push(line);
  });
  child.on("exit", (code, signal) => {
    exited = signal ? `signal ${signal}` : `exit code ${code}`;
    while (waiters.length) waiters.shift().reject(new ProtocolError(`adapter exited (${exited})`));
  });
  child.on("error", (err) => {
    exited = err.message;
    while (waiters.length) waiters.shift().reject(new ProtocolError(`cannot start adapter: ${err.message}`));
  });
  child.stdin.on("error", () => {}); // EPIPE is reported through "exit".

  async function request(req) {
    if (exited) throw new ProtocolError(`adapter exited (${exited})`);
    child.stdin.write(JSON.stringify(req) + "\n");
    const line = await new Promise((resolve, reject) => {
      if (queue.length) return resolve(queue.shift());
      const timer = setTimeout(() => {
        const idx = waiters.indexOf(w);
        if (idx !== -1) waiters.splice(idx, 1);
        reject(new ProtocolError(`timed out after ${opts.timeout}ms waiting for ${req.id}`));
      }, opts.timeout);
      const w = {
        resolve: (l) => (clearTimeout(timer), resolve(l)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      };
      waiters.push(w);
    });
    let res;
    try {
      res = JSON.parse(line);
    } catch {
      throw new ProtocolError(`adapter wrote a non-JSON line: ${line.slice(0, 200)}`);
    }
    if (res === null || typeof res !== "object" || res.id !== req.id) {
      throw new ProtocolError(`response id ${JSON.stringify(res?.id)} does not match request ${req.id}`);
    }
    if (typeof res.ok !== "boolean") throw new ProtocolError(`response ${req.id} has no boolean "ok"`);
    return res;
  }

  // Closing stdin is the normal shutdown signal. After a protocol error the
  // adapter may be hung, so it is killed rather than left orphaned.
  function stop(force) {
    if (exited) return;
    child.stdin.end();
    if (force) child.kill();
    else setTimeout(() => !exited && child.kill(), 2000).unref();
  }

  return { request, stop };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const { specVersion, cases } = loadCases(opts.specDir);
const adapter = startAdapter(command);
const results = [];
let implementation = null;
let supportedOps = OPS;
let protocolError = null;

try {
  const hello = await adapter.request({ id: "hello", op: "hello", protocol: PROTOCOL, specVersion });
  if (!hello.ok) throw new ProtocolError(`hello failed: ${JSON.stringify(hello.error)}`);
  const out = hello.output ?? {};
  if (out.protocol !== PROTOCOL) {
    throw new ProtocolError(`adapter speaks ${JSON.stringify(out.protocol)}, runner speaks ${PROTOCOL}`);
  }
  implementation = out.implementation ?? null;
  if (Array.isArray(out.ops)) supportedOps = out.ops;

  for (const c of cases) {
    const reason = skipReason(c);
    if (reason) {
      results.push({ id: c.id, op: c.op, description: c.description, status: "skipped", reason });
      continue;
    }
    if (!supportedOps.includes(c.op)) {
      results.push({ id: c.id, op: c.op, description: c.description, status: "unsupported" });
      continue;
    }
    const res = await adapter.request({ id: c.id, op: c.op, input: requestInput(c) });
    if (!res.ok && res.error?.code === "UNSUPPORTED_OP") {
      results.push({ id: c.id, op: c.op, description: c.description, status: "unsupported" });
      continue;
    }
    const problems = compare(c, res);
    results.push({
      id: c.id,
      op: c.op,
      description: c.description,
      status: problems.length ? "failed" : "passed",
      problems,
    });
  }
} catch (err) {
  if (!(err instanceof ProtocolError)) throw err;
  protocolError = err.message;
} finally {
  adapter.stop(protocolError !== null);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const count = (s) => results.filter((r) => r.status === s).length;
const summary = {
  protocol: PROTOCOL,
  specVersion,
  implementation,
  passed: count("passed"),
  failed: count("failed"),
  unsupported: count("unsupported"),
  skipped: count("skipped"),
  protocolError,
};

const label = implementation
  ? `${implementation.name ?? "?"} ${implementation.version ?? ""} (${implementation.language ?? "?"})`.trim()
  : "adapter";
console.log(`Bluewhale conformance (${PROTOCOL}, spec ${specVersion}) against ${label}\n`);
for (const r of results) {
  if (r.status === "failed") {
    console.log(`FAIL  [${r.op}] ${r.id} ${r.description}`);
    for (const p of r.problems) console.log(`        ${p}`);
  } else if (opts.verbose) {
    const tag = { passed: "ok  ", unsupported: "unsp", skipped: "skip" }[r.status];
    console.log(`${tag}  [${r.op}] ${r.id} ${r.description}${r.reason ? ` (${r.reason})` : ""}`);
  }
}

const byOp = {};
for (const r of results) {
  const o = (byOp[r.op] ??= { passed: 0, failed: 0, unsupported: 0, skipped: 0 });
  o[r.status]++;
}
console.log("\nop                 passed  failed  unsupported  skipped");
for (const [op, o] of Object.entries(byOp)) {
  console.log(
    `${op.padEnd(18)} ${String(o.passed).padStart(6)}  ${String(o.failed).padStart(6)}  ` +
      `${String(o.unsupported).padStart(11)}  ${String(o.skipped).padStart(7)}`,
  );
}
console.log(
  `\nTotal: ${summary.passed} passed, ${summary.failed} failed, ` +
    `${summary.unsupported} unsupported, ${summary.skipped} skipped`,
);
if (protocolError) console.error(`\nProtocol error: ${protocolError}`);

if (opts.report) writeFileSync(opts.report, JSON.stringify({ summary, results }, null, 2) + "\n");

if (protocolError) process.exit(2);
const strictFailures = opts.strict ? summary.unsupported : 0;
process.exit(summary.failed + strictFailures > 0 ? 1 : 0);
