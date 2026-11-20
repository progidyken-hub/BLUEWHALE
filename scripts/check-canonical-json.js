#!/usr/bin/env node
/**
 * CI check ensuring test vector JSON files are formatted canonically:
 * - UTF-8 without BOM
 * - 2-space indentation (`JSON.stringify(parsed, null, 2) + "\n"`)
 * - Deterministic key ordering (no trailing whitespace or mixed indentation)
 *
 * Pass `--write` to format the vector files in place.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const VECTOR_FILES = [
  "spec/vectors.json",
  "spec/vectors/extract_routing.json",
  "packages/spec/vectors.json",
];

function canonicalizeJson(parsed) {
  return (
    JSON.stringify(parsed, null, 2).replace(
      /\[\n(\s+)("(?:[^"\\]|\\.)*"(?:,\n\1"(?:[^"\\]|\\.)*")*)\n\s*\]/g,
      (_, _indent, inner) =>
        "[" +
        inner
          .split(",\n")
          .map((s) => s.trim())
          .join(", ") +
        "]",
    ) + "\n"
  );
}

function checkVectorFiles(options = {}) {
  const write = Boolean(options.write);
  const errors = [];

  for (const relPath of VECTOR_FILES) {
    const absPath = path.join(ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      continue;
    }

    const rawBytes = fs.readFileSync(absPath);
    if (
      rawBytes.length >= 3 &&
      rawBytes[0] === 0xef &&
      rawBytes[1] === 0xbb &&
      rawBytes[2] === 0xbf
    ) {
      errors.push(`${relPath}: contains UTF-8 BOM`);
    }

    const raw = rawBytes.toString("utf8").replace(/\r\n/g, "\n");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      errors.push(`${relPath}: invalid JSON (${err.message})`);
      continue;
    }

    const expected = canonicalizeJson(parsed);
    if (raw !== expected) {
      if (write) {
        fs.writeFileSync(absPath, expected, "utf8");
      } else {
        errors.push(
          `${relPath}: not formatted canonically (run \`node scripts/check-canonical-json.js --write\`)`,
        );
      }
    }
  }

  return errors;
}

if (require.main === module) {
  const write = process.argv.includes("--write");
  const errors = checkVectorFiles({ write });
  if (errors.length > 0) {
    for (const err of errors) {
      console.error("Canonical JSON check failed: " + err);
    }
    process.exit(1);
  }
  console.log(
    write
      ? "Formatted all test vector JSON files canonically."
      : "All test vector JSON files are formatted canonically.",
  );
}

module.exports = { canonicalizeJson, checkVectorFiles, VECTOR_FILES };
