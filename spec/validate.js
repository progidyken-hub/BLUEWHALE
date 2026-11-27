const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const { checkVectorFiles } = require("../scripts/check-canonical-json");

const canonicalErrors = checkVectorFiles();
if (canonicalErrors.length > 0) {
  console.error("Spec validation failed (non-canonical JSON formatting):");
  for (const err of canonicalErrors) {
    console.error("  - " + err);
  }
  process.exit(1);
}

const schemaPath = path.join(__dirname, "schema.json");
const vectorsPath = path.join(__dirname, "vectors.json");

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const vectors = JSON.parse(fs.readFileSync(vectorsPath, "utf8"));

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);
const valid = validate(vectors);

if (!valid) {
  console.error("Spec validation failed:");
  console.error(ajv.errorsText(validate.errors, { separator: "\n" }));
  process.exit(1);
}

// --- Issue #180: negative checksum vectors for muxed address decoding ---
//
// Edge cases where both CRC16 checksum bytes are corrupted to 0x0000, or
// where a single checksum bit is flipped, must be covered by deterministic
// negative vectors. Every SDK runner is expected to reject these vectors
// gracefully with INVALID_CHECKSUM and must never throw a runtime panic.

const CHECKSUM_ERROR = "INVALID_CHECKSUM";

// Deterministic muxed-address base used to derive the corrupted variants.
// Fixed inputs only: no randomness, so all SDK runners produce identical
// results for the same vector set.
const MUXED_BASE = {
  hrp: "bc",
  muxed_version: 0,
  address_bytes: [
    0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb,
    0xcc, 0xdd, 0xee, 0xff,
  ],
  checksum: [0x12, 0x34],
};

function toHex(bytes) {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Build the 15 deterministic corrupted-checksum variants:
//  - 1 variant with both checksum bytes zeroed (0x0000)
//  - 14 variants flipping a single bit across the two checksum bytes
function buildCorruptedChecksumVectors() {
  const variants = [];

  // Both checksum bytes corrupted to 0x0000.
  variants.push({
    id: "muxed-checksum-zeroed",
    description: "both CRC16 checksum bytes corrupted to 0x0000",
    checksum: [0x00, 0x00],
  });

  // Single-bit differences: 8 bits per byte, 2 bytes => 16 possible flips.
  // Take the first 14 to reach the required 15 total variants.
  const bitFlips = [];
  for (let byteIndex = 0; byteIndex < 2; byteIndex++) {
    for (let bit = 0; bit < 8; bit++) {
      bitFlips.push({ byteIndex, bit });
    }
  }

  for (const { byteIndex, bit } of bitFlips.slice(0, 14)) {
    const checksum = MUXED_BASE.checksum.slice();
    checksum[byteIndex] = checksum[byteIndex] ^ (1 << bit);
    variants.push({
      id: `muxed-checksum-bitflip-${byteIndex}-${bit}`,
      description: `single-bit flip in checksum byte ${byteIndex} at bit ${bit}`,
      checksum,
    });
  }

  return variants;
}

const corruptedChecksumVectors = buildCorruptedChecksumVectors();

if (corruptedChecksumVectors.length !== 15) {
  console.error(
    "Spec validation failed: expected 15 corrupted-checksum vectors, got " +
      corruptedChecksumVectors.length,
  );
  process.exit(1);
}

// Verify each corrupted vector is deterministic and distinct from the base
// checksum, and that the expected error code is INVALID_CHECKSUM.
const seenChecksums = new Set();
for (const vector of corruptedChecksumVectors) {
  const checksumHex = toHex(vector.checksum);
  if (seenChecksums.has(checksumHex)) {
    console.error(
      "Spec validation failed: duplicate corrupted checksum " + checksumHex,
    );
    process.exit(1);
  }
  seenChecksums.add(checksumHex);

  if (checksumHex === toHex(MUXED_BASE.checksum)) {
    console.error(
      "Spec validation failed: vector " +
        vector.id +
        " did not corrupt the checksum",
    );
    process.exit(1);
  }

  if (vector.expected_error !== undefined && vector.expected_error !== CHECKSUM_ERROR) {
    console.error(
      "Spec validation failed: vector " +
        vector.id +
        " expected " +
        vector.expected_error +
        ", want " +
        CHECKSUM_ERROR,
    );
    process.exit(1);
  }
}

// Assert that every SDK runner fails gracefully with INVALID_CHECKSUM and
// never throws a runtime panic when processing the corrupted vectors.
function assertRunnerFailsGracefully(runnerName, run) {
  for (const vector of corruptedChecksumVectors) {
    let result;
    try {
      result = run(vector);
    } catch (err) {
      console.error(
        "Spec validation failed: runner " +
          runnerName +
          " threw a runtime panic on vector " +
          vector.id +
          ": " +
          (err && err.message ? err.message : String(err)),
      );
      process.exit(1);
    }

    if (!result || result.error !== CHECKSUM_ERROR) {
      console.error(
        "Spec validation failed: runner " +
          runnerName +
          " did not return " +
          CHECKSUM_ERROR +
          " for vector " +
          vector.id,
      );
      process.exit(1);
    }
  }
}

// SDK runners are registered here as they become available. Each runner is a
// pure function that decodes a muxed address and returns { error } on failure.
const sdkRunners = vectors.sdk_runners || {};

for (const [runnerName, run] of Object.entries(sdkRunners)) {
  if (typeof run !== "function") {
    continue;
  }
  assertRunnerFailsGracefully(runnerName, run);
}

// --- Empty MEMO_TEXT vectors (spec/vectors/empty-memos.json) ---
//
// A MEMO_TEXT that is omitted, null, "" or only ASCII whitespace (space, tab,
// LF, CR) MUST resolve to memo type "none": no routing ID from the memo and
// no warnings. Every SDK runs this file; here we check it is well formed and
// that each expectation agrees with that rule.
const emptyMemosPath = path.join(__dirname, "vectors", "empty-memos.json");
const emptyMemos = JSON.parse(fs.readFileSync(emptyMemosPath, "utf8"));

function failEmptyMemo(id, message) {
  console.error("Spec validation failed: empty-memos.json [" + id + "]: " + message);
  process.exit(1);
}

if (!Array.isArray(emptyMemos.cases) || emptyMemos.cases.length === 0) {
  failEmptyMemo("-", "cases must be a non-empty array");
}

const isBlankMemoText = (v) => v === undefined || v === null || /^[ \t\n\r]*$/.test(v);
const emptyMemoIds = new Set();
let blankMemoCases = 0;

for (const c of emptyMemos.cases) {
  const id = c.id;
  if (typeof id !== "string" || id === "") failEmptyMemo("?", "every case needs an id");
  if (emptyMemoIds.has(id)) failEmptyMemo(id, "duplicate id");
  emptyMemoIds.add(id);

  const { input, expected } = c;
  if (!input || typeof input.destination !== "string" || typeof input.memoType !== "string") {
    failEmptyMemo(id, "input.destination and input.memoType must be strings");
  }
  if ("memoValue" in input && input.memoValue !== null && typeof input.memoValue !== "string") {
    failEmptyMemo(id, "input.memoValue must be a string, null or omitted");
  }
  if (!expected || !Array.isArray(expected.warnings)) {
    failEmptyMemo(id, "expected.warnings must be an array");
  }
  for (const key of ["effectiveMemoType", "routingSource"]) {
    if (typeof expected[key] !== "string") failEmptyMemo(id, "expected." + key + " must be a string");
  }
  for (const key of ["destinationBaseAccount", "routingId"]) {
    if (expected[key] !== null && typeof expected[key] !== "string") {
      failEmptyMemo(id, "expected." + key + " must be a string or null");
    }
  }

  const blank = input.memoType === "text" && isBlankMemoText(input.memoValue);
  const wantEffective = blank ? "none" : input.memoType;
  if (expected.effectiveMemoType !== wantEffective) {
    failEmptyMemo(id, "effectiveMemoType must be " + wantEffective + ", got " + expected.effectiveMemoType);
  }
  if (expected.effectiveMemoType === "none") {
    if (expected.warnings.length !== 0) failEmptyMemo(id, "memo type none must not produce warnings");
    if (expected.routingSource === "memo") failEmptyMemo(id, "memo type none cannot route from the memo");
  }
  if (blank) blankMemoCases++;
}

// The acceptance criteria require "", " " and null to be covered.
for (const required of ["", " ", null]) {
  const covered = emptyMemos.cases.some(
    (c) => c.input.memoType === "text" && "memoValue" in c.input && c.input.memoValue === required,
  );
  if (!covered) failEmptyMemo("-", "missing MEMO_TEXT case for " + JSON.stringify(required));
}

console.log(
  "Spec validation passed (spec_version: " +
    vectors.spec_version +
    ", corrupted-checksum vectors: " +
    corruptedChecksumVectors.length +
    ", empty-memo vectors: " +
    emptyMemos.cases.length +
    " (" +
    blankMemoCases +
    " blank)" +
    ")",
);
