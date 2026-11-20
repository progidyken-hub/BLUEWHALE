#!/usr/bin/env node
/**
 * Generate extract_routing test vectors from live Stellar testnet payments.
 *
 * Queries Horizon's /payments endpoint (joined with transactions so memos are
 * included), extracts (destination, memo) pairs, anonymizes them, and writes
 * them as spec cases in the same shape as spec/vectors.json.
 *
 * Usage:
 *   node scripts/generate-vectors-from-horizon.js [options]
 *
 * Options:
 *   --count <n>        Number of unique cases to emit (default 25, max 1000)
 *   --out <file>       Write to <file> instead of stdout
 *   --horizon <url>    Horizon base URL (default https://horizon-testnet.stellar.org)
 *   --cursor <token>   Start paging from this Horizon cursor
 *   --salt <string>    Anonymization salt (default "bluewhale-vectors").
 *                      The same salt and input always give the same output.
 *   --keep-ids         Keep memo IDs and muxed IDs as-is (accounts are still
 *                      anonymized)
 *   --all              Also emit cases whose routing result depends on
 *                      warning logic (text/hash/return memos, M-address +
 *                      memo). Their `expected` holds only the fields this
 *                      script can derive and they carry a `notes` field;
 *                      complete them with a reference implementation before
 *                      committing.
 *   --allow-mainnet    Permit a non-testnet Horizon URL
 *   --self-test        Run offline checks of the encoding and anonymization
 *                      helpers, then exit
 *   --help             Show this help
 *
 * Anonymization:
 *   - Every account key is replaced by SHA-256(salt, key). The same real
 *     account always maps to the same fake one, so relationships between
 *     cases survive; the fake key is re-encoded as a valid G or M strkey.
 *   - Memo IDs, numeric text memos and muxed IDs are replaced by a keyed
 *     hash with the same number of digits (so uint64 range and digit-length
 *     edge cases are kept). 0 and 2^64-1 are kept as-is.
 *   - Non-numeric text memos and hash/return memos are replaced by hashes
 *     of the same length.
 *   - Transaction hashes, ledger numbers, amounts, assets and source
 *     accounts are never written.
 *
 * Requires Node.js 18+ (global fetch). No dependencies.
 */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const TESTNET_HORIZON = "https://horizon-testnet.stellar.org";
const PAGE_LIMIT = 200;
const MAX_PAGES = 50;
const UINT64_MAX = (1n << 64n) - 1n;

const PAYMENT_TYPES = new Set([
  "payment",
  "path_payment_strict_receive",
  "path_payment_strict_send",
]);

// ---------------------------------------------------------------------------
// StrKey encoding (RFC 4648 base32 + CRC16-XModem), self-contained.
// ---------------------------------------------------------------------------

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const VERSION_G = 6 << 3;
const VERSION_M = 12 << 3;

function crc16xmodem(bytes) {
  let crc = 0;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function base32Encode(bytes) {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const b of bytes) {
    buffer = (buffer << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(buffer >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(buffer << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const out = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of str) {
    const v = BASE32.indexOf(ch);
    if (v < 0) throw new Error(`invalid base32 character ${JSON.stringify(ch)}`);
    buffer = ((buffer << 5) | v) & 0xfff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

function encodeStrKey(version, payload) {
  const body = Buffer.concat([Buffer.from([version]), payload]);
  const crc = crc16xmodem(body);
  return base32Encode(Buffer.concat([body, Buffer.from([crc & 0xff, crc >> 8])]));
}

function decodeStrKey(address, expectedVersion) {
  const raw = base32Decode(address);
  const body = raw.subarray(0, raw.length - 2);
  const crc = crc16xmodem(body);
  if (raw[raw.length - 2] !== (crc & 0xff) || raw[raw.length - 1] !== crc >> 8) {
    throw new Error(`bad checksum in ${address}`);
  }
  if (body[0] !== expectedVersion) throw new Error(`unexpected version byte in ${address}`);
  return body.subarray(1);
}

function encodeG(key) {
  return encodeStrKey(VERSION_G, key);
}

function encodeM(key, id) {
  const idBytes = Buffer.alloc(8);
  idBytes.writeBigUInt64BE(BigInt(id));
  return encodeStrKey(VERSION_M, Buffer.concat([key, idBytes]));
}

/** Splits an M-address into its 32-byte key and decimal uint64 ID. */
function decodeM(address) {
  const payload = decodeStrKey(address, VERSION_M);
  if (payload.length !== 40) throw new Error(`bad muxed payload length in ${address}`);
  return { key: payload.subarray(0, 32), id: payload.readBigUInt64BE(32).toString() };
}

// ---------------------------------------------------------------------------
// Anonymization
// ---------------------------------------------------------------------------

function createAnonymizer({ salt, keepIds }) {
  const digest = (label, value) =>
    crypto.createHash("sha256").update(`${salt}\0${label}\0`).update(value).digest();

  /** Real 32-byte account key -> stable fake 32-byte key. */
  const key = (realKey) => digest("account", realKey);

  /**
   * Decimal uint64 string -> keyed replacement with the same digit count,
   * still within uint64. Boundary values carry no identity and are kept.
   */
  const uint64 = (decimal, label) => {
    if (keepIds) return decimal;
    const value = BigInt(decimal);
    if (value === 0n || value === UINT64_MAX) return decimal;
    const digits = decimal.length;
    const lo = digits === 1 ? 0n : 10n ** BigInt(digits - 1);
    let hi = 10n ** BigInt(digits) - 1n;
    if (hi > UINT64_MAX) hi = UINT64_MAX;
    const h = digest(label, decimal).readBigUInt64BE(0);
    return (lo + (h % (hi - lo + 1n))).toString();
  };

  const memo = (type, value) => {
    switch (type) {
      case "id":
        return uint64(value, "memo-id");
      case "text": {
        if (/^\d+$/.test(value)) {
          // Keep leading zeros: they change routing (NON_CANONICAL_ROUTING_ID).
          const zeros = value.match(/^0*/)[0];
          const rest = value.slice(zeros.length);
          if (rest === "") return value;
          // Out of uint64 range (20+ digits): all nines of the same length
          // stays out of range and reveals nothing but the length.
          if (BigInt(rest) > UINT64_MAX) return zeros + "9".repeat(rest.length);
          return zeros + uint64(rest, "memo-text");
        }
        const len = Buffer.byteLength(value, "utf8");
        return digest("memo-text", value).toString("hex").padEnd(len, "0").slice(0, Math.max(1, len));
      }
      case "hash":
      case "return":
        return digest(`memo-${type}`, value).toString("base64");
      default:
        return value;
    }
  };

  return {
    /** Anonymizes a G or M destination, keeping its kind. */
    destination(address) {
      if (address.startsWith("M")) {
        const { key: realKey, id } = decodeM(address);
        const fakeKey = key(realKey);
        const fakeId = uint64(id, "muxed-id");
        return { destination: encodeM(fakeKey, fakeId), baseG: encodeG(fakeKey), muxedId: fakeId };
      }
      const fakeKey = key(decodeStrKey(address, VERSION_G));
      return { destination: encodeG(fakeKey), baseG: encodeG(fakeKey), muxedId: null };
    },
    memo,
  };
}

// ---------------------------------------------------------------------------
// Horizon
// ---------------------------------------------------------------------------

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/hal+json" } });
  if (!res.ok) throw new Error(`Horizon ${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/** Yields payment operation records joined with their transaction. */
async function* paymentRecords(horizon, cursor) {
  const params = new URLSearchParams({
    limit: String(PAGE_LIMIT),
    order: "desc",
    join: "transactions",
    include_failed: "false",
  });
  if (cursor) params.set("cursor", cursor);
  let url = `${horizon.replace(/\/+$/, "")}/payments?${params}`;

  for (let page = 0; page < MAX_PAGES && url; page++) {
    const body = await fetchJson(url);
    const records = (body._embedded && body._embedded.records) || [];
    if (records.length === 0) return;
    yield* records;
    url = body._links && body._links.next && body._links.next.href;
  }
}

/** Normalizes Horizon's memo fields to the spec's memoType / memoValue. */
function memoOf(tx) {
  const type = (tx && tx.memo_type) || "none";
  if (type === "none") return { memoType: "none", memoValue: null };
  return { memoType: type, memoValue: tx.memo == null ? "" : String(tx.memo) };
}

/** Extracts the (destination, memo) pair of a payment record, or null. */
function extractPair(record) {
  if (!PAYMENT_TYPES.has(record.type)) return null;
  if (record.transaction_successful === false) return null;
  const destination = record.to_muxed || record.to;
  if (typeof destination !== "string" || !/^[GM]/.test(destination)) return null;
  return { opType: record.type, destination, ...memoOf(record.transaction) };
}

// ---------------------------------------------------------------------------
// Vector construction
// ---------------------------------------------------------------------------

/**
 * Builds a spec case. Returns { case, verified } where verified means every
 * expected field follows directly from the spec without warning logic.
 */
function buildCase(pair, anon) {
  const dest = anon.destination(pair.destination);
  const memoValue = pair.memoType === "none" ? null : anon.memo(pair.memoType, pair.memoValue);
  const kind = dest.muxedId === null ? "G" : "M";

  const input = { destination: dest.destination, memoType: pair.memoType };
  if (memoValue !== null) input.memoValue = memoValue;

  const description = `Horizon testnet ${pair.opType} to ${kind}-address with memo type ${pair.memoType}`;
  const base = { module: "extract_routing", description, input };

  if (kind === "M" && pair.memoType === "none") {
    return {
      verified: true,
      case: {
        ...base,
        expected: { destinationBaseAccount: dest.baseG, routingId: dest.muxedId, routingSource: "muxed", warnings: [] },
        tags: ["positive", "interop"],
      },
    };
  }
  if (kind === "G" && pair.memoType === "none") {
    return {
      verified: true,
      case: {
        ...base,
        expected: { destinationBaseAccount: dest.baseG, routingId: null, routingSource: "none", warnings: [] },
        tags: ["positive", "interop"],
      },
    };
  }
  if (kind === "G" && pair.memoType === "id" && /^(0|[1-9]\d*)$/.test(memoValue)) {
    return {
      verified: true,
      case: {
        ...base,
        expected: { destinationBaseAccount: dest.baseG, routingId: memoValue, routingSource: "memo", warnings: [] },
        tags: ["positive", "interop"],
      },
    };
  }

  return {
    verified: false,
    case: {
      ...base,
      expected: { destinationBaseAccount: dest.baseG },
      tags: ["interop"],
      notes:
        "UNVERIFIED: routingId, routingSource and warnings depend on memo/warning rules. " +
        "Fill them in from a reference implementation before committing.",
    },
  };
}

async function generate(opts) {
  const anon = createAnonymizer(opts);
  const seen = new Set();
  const cases = [];
  let scanned = 0;
  let skippedUnverified = 0;

  for await (const record of paymentRecords(opts.horizon, opts.cursor)) {
    scanned++;
    const pair = extractPair(record);
    if (!pair) continue;

    let built;
    try {
      built = buildCase(pair, anon);
    } catch (err) {
      process.stderr.write(`skipping malformed record ${record.id}: ${err.message}\n`);
      continue;
    }
    if (!built.verified && !opts.all) {
      skippedUnverified++;
      continue;
    }

    const key = JSON.stringify(built.case.input);
    if (seen.has(key)) continue;
    seen.add(key);
    cases.push(built.case);
    if (cases.length >= opts.count) break;
  }

  process.stderr.write(
    `scanned ${scanned} payment records, emitted ${cases.length} cases` +
      (skippedUnverified ? `, skipped ${skippedUnverified} needing --all` : "") +
      "\n"
  );

  return {
    description:
      "extract_routing vectors generated from Stellar testnet payments by " +
      "scripts/generate-vectors-from-horizon.js. All accounts, IDs and memos are anonymized.",
    source: {
      horizon: opts.horizon,
      endpoint: "/payments?join=transactions",
      anonymized: true,
      keepIds: Boolean(opts.keepIds),
    },
    cases,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage() {
  const src = fs.readFileSync(__filename, "utf8");
  return src.slice(src.indexOf("Usage:"), src.indexOf("Anonymization:")).replace(/^ \* ?/gm, "");
}

function parseArgs(argv) {
  const opts = {
    count: 25,
    out: null,
    horizon: TESTNET_HORIZON,
    cursor: null,
    salt: "bluewhale-vectors",
    keepIds: false,
    all: false,
    allowMainnet: false,
    selfTest: false,
    help: false,
  };
  const takesValue = { "--count": "count", "--out": "out", "--horizon": "horizon", "--cursor": "cursor", "--salt": "salt" };
  const flags = {
    "--keep-ids": "keepIds",
    "--all": "all",
    "--allow-mainnet": "allowMainnet",
    "--self-test": "selfTest",
    "--help": "help",
    "-h": "help",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (takesValue[arg]) {
      if (i + 1 >= argv.length) throw new Error(`${arg} requires a value`);
      opts[takesValue[arg]] = argv[++i];
    } else if (flags[arg]) {
      opts[flags[arg]] = true;
    } else {
      throw new Error(`unknown argument ${arg}`);
    }
  }

  opts.count = Number(opts.count);
  if (!Number.isInteger(opts.count) || opts.count < 1 || opts.count > 1000) {
    throw new Error("--count must be an integer between 1 and 1000");
  }
  if (!/^https?:\/\//.test(opts.horizon)) throw new Error("--horizon must be an http(s) URL");
  if (!/testnet/i.test(opts.horizon) && !opts.allowMainnet) {
    throw new Error(`refusing non-testnet Horizon ${opts.horizon} without --allow-mainnet`);
  }
  return opts;
}

function selfTest() {
  const assert = require("assert");
  const G = "GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI";
  const M = "MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQAD7777777777774OFW";

  // StrKey round trips against known spec vectors.
  const key = decodeStrKey(G, VERSION_G);
  assert.strictEqual(encodeG(key), G);
  assert.deepStrictEqual(decodeM(M), { key, id: "18446744073709551615" });
  assert.strictEqual(encodeM(key, "18446744073709551615"), M);
  assert.strictEqual(
    encodeM(key, "9007199254740993"),
    "MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQACABAAAAAAAAAAEVIG"
  );

  // Anonymization is deterministic, salt-dependent and kind-preserving.
  const a = createAnonymizer({ salt: "s1", keepIds: false });
  const b = createAnonymizer({ salt: "s2", keepIds: false });
  const g1 = a.destination(G);
  assert.deepStrictEqual(a.destination(G), g1);
  assert.notStrictEqual(g1.destination, G);
  assert.notStrictEqual(b.destination(G).destination, g1.destination);
  assert.match(g1.destination, /^G[A-Z2-7]{55}$/);
  assert.strictEqual(encodeG(decodeStrKey(g1.destination, VERSION_G)), g1.destination);

  const m1 = a.destination("MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQACABAAAAAAAAAAEVIG");
  assert.match(m1.destination, /^M[A-Z2-7]{68}$/);
  assert.strictEqual(m1.baseG, g1.baseG, "same account maps to the same fake base account");
  assert.strictEqual(m1.muxedId.length, "9007199254740993".length);
  assert.notStrictEqual(m1.muxedId, "9007199254740993");
  assert.deepStrictEqual(decodeM(m1.destination).id, m1.muxedId);

  // Uint64 boundaries are kept; other IDs keep their digit count and range.
  assert.strictEqual(a.memo("id", "0"), "0");
  assert.strictEqual(a.memo("id", "18446744073709551615"), "18446744073709551615");
  for (const v of ["7", "42", "123456", "18446744073709551614", "10000000000000000000"]) {
    const out = a.memo("id", v);
    assert.strictEqual(out.length, v.length, `digit count kept for ${v}`);
    assert.ok(BigInt(out) <= UINT64_MAX, `${out} within uint64`);
    assert.match(out, v.length === 1 ? /^\d$/ : /^[1-9]\d*$/);
  }
  assert.strictEqual(createAnonymizer({ salt: "s1", keepIds: true }).memo("id", "42"), "42");

  // Text memos: numeric keeps leading zeros and digit count; others keep length.
  const zero = a.memo("text", "000123");
  assert.match(zero, /^000[1-9]\d{2}$/);
  assert.strictEqual(a.memo("text", "hello world").length, "hello world".length);
  assert.notStrictEqual(a.memo("text", "hello world"), "hello world");
  assert.strictEqual(Buffer.from(a.memo("hash", "AAAA"), "base64").length, 32);

  // Case construction.
  const verified = buildCase({ opType: "payment", destination: G, memoType: "id", memoValue: "42" }, a);
  assert.ok(verified.verified);
  assert.strictEqual(verified.case.expected.routingSource, "memo");
  assert.strictEqual(verified.case.expected.routingId, verified.case.input.memoValue);
  const muxed = buildCase({ opType: "payment", destination: M, memoType: "none", memoValue: null }, a);
  assert.strictEqual(muxed.case.expected.routingId, "18446744073709551615");
  assert.ok(!("memoValue" in muxed.case.input));
  const unverified = buildCase({ opType: "payment", destination: M, memoType: "text", memoValue: "hi" }, a);
  assert.ok(!unverified.verified && unverified.case.notes.startsWith("UNVERIFIED"));

  // Record filtering.
  assert.strictEqual(extractPair({ type: "create_account", account: G }), null);
  assert.strictEqual(extractPair({ type: "payment", to: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" }), null);
  assert.deepStrictEqual(
    extractPair({ type: "payment", to: G, to_muxed: M, transaction: { memo_type: "id", memo: "5" } }),
    { opType: "payment", destination: M, memoType: "id", memoValue: "5" }
  );

  // CLI guard.
  assert.throws(() => parseArgs(["--horizon", "https://horizon.stellar.org"]), /--allow-mainnet/);

  process.stdout.write("self-test passed\n");
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n\n${usage()}`);
    process.exit(2);
  }
  if (opts.help) {
    process.stdout.write(usage());
    return;
  }
  if (opts.selfTest) {
    selfTest();
    return;
  }
  if (typeof fetch !== "function") {
    throw new Error("Node.js 18+ is required (global fetch)");
  }

  const doc = await generate(opts);
  const json = `${JSON.stringify(doc, null, 2)}\n`;
  if (opts.out) {
    const out = path.resolve(opts.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, json);
    process.stderr.write(`wrote ${out}\n`);
  } else {
    process.stdout.write(json);
  }
}

module.exports = {
  createAnonymizer,
  buildCase,
  extractPair,
  encodeG,
  encodeM,
  decodeM,
  parseArgs,
};

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`${err.stack || err}\n`);
    process.exit(1);
  });
}
