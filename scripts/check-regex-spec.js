#!/usr/bin/env node
/**
 * Validates spec/regex.json.
 *
 *   1. Structural portability / ReDoS rules for every pattern (no flags,
 *      anchored, bounded quantifiers on single atoms only, no shorthand
 *      classes, no backreferences or lookaround, no quantified groups).
 *   2. `pcre_pattern` is exactly `pattern` with ^ -> \A and $ -> \z.
 *   3. Every case produces the expected result in ECMAScript RegExp.
 *   4. Every case produces the same result in Perl (PCRE semantics) when
 *      `perl` is installed. Set REGEX_SPEC_REQUIRE_PERL=1 to make that fatal.
 *   5. Adversarial inputs of `redos.adversarial_input_length` characters
 *      complete within `redos.max_match_ms`.
 *   6. Every checksum-valid StrKey found in spec/vectors.json matches the
 *      pattern for its kind (when @stellar/stellar-sdk is resolvable).
 *
 * Go (RE2) and Dart run the same cases in
 *   packages/core-go/address/regex_spec_test.go
 *   packages/core-dart/test/regex_spec_test.dart
 * and core-ts in packages/core-ts/src/test/regex-spec.test.ts.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const spec = JSON.parse(fs.readFileSync(path.join(rootDir, "spec", "regex.json"), "utf8"));

const errors = [];
const fail = (msg) => errors.push(msg);

// ---------------------------------------------------------------------------
// 1 + 2. Structural rules.
// ---------------------------------------------------------------------------
function lintPattern(name, src) {
  if (!src.startsWith("^") || !src.endsWith("$")) {
    fail(`${name}: pattern must be anchored with ^...$`);
  }
  const body = src.slice(1, -1);
  if (/[\^$]/.test(body.replace(/\[[^\]]*\]/g, ""))) {
    fail(`${name}: anchors are only allowed at the very start and end`);
  }
  if (/\\[dDwWsSbB]/.test(src)) fail(`${name}: shorthand classes (\\d \\w \\s \\b) are forbidden`);
  if (/\\[1-9]|\\k</.test(src)) fail(`${name}: backreferences are forbidden`);
  if (/\(\?(?:[=!]|<[=!])/.test(src)) fail(`${name}: lookaround is forbidden`);
  if (/\((?!\?:)/.test(src)) fail(`${name}: only non-capturing groups (?:...) are allowed`);
  // `.` outside a character class.
  if (/(^|[^\\])\./.test(src.replace(/\[[^\]]*\]/g, ""))) fail(`${name}: '.' is forbidden`);
  // Unbounded quantifiers.
  if (/(^|[^\\])[*+]/.test(src.replace(/\[[^\]]*\]/g, ""))) fail(`${name}: * and + are forbidden`);
  if (/\{\d+,\}/.test(src)) fail(`${name}: unbounded {m,} is forbidden`);
  // Quantified groups: `)` followed by any quantifier.
  if (/\)[?*+{]/.test(src)) fail(`${name}: quantified groups are forbidden`);
}

for (const [name, def] of Object.entries(spec.patterns)) {
  lintPattern(name, def.pattern);
  const expectedPcre = "\\A" + def.pattern.slice(1, -1) + "\\z";
  if (def.pcre_pattern !== expectedPcre) {
    fail(`${name}: pcre_pattern must be ${JSON.stringify(expectedPcre)}, got ${JSON.stringify(def.pcre_pattern)}`);
  }
  try {
    new RegExp(def.pattern);
  } catch (e) {
    fail(`${name}: invalid ECMAScript pattern: ${e.message}`);
  }
}

function report() {
  console.error("Regex spec validation failed:");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

// Stop before executing anything: a pattern that breaks the structural rules
// may backtrack catastrophically and hang the case / timing stages below.
if (errors.length) report();

// ---------------------------------------------------------------------------
// 3. ECMAScript cases.
// ---------------------------------------------------------------------------
const compiled = Object.fromEntries(
  Object.entries(spec.patterns).map(([name, def]) => [name, new RegExp(def.pattern)]),
);
const coverage = new Set();

spec.cases.forEach((c, i) => {
  const re = compiled[c.pattern];
  if (!re) {
    fail(`case ${i}: unknown pattern ${c.pattern}`);
    return;
  }
  coverage.add(c.pattern);
  const got = re.test(c.input);
  if (got !== c.match) {
    fail(`case ${i} [${c.pattern}] ${c.description}: JS matched=${got}, want ${c.match}`);
  }
});

for (const name of Object.keys(spec.patterns)) {
  if (!coverage.has(name)) fail(`${name}: has no test cases`);
}

// ---------------------------------------------------------------------------
// 4. Perl / PCRE cases.
// ---------------------------------------------------------------------------
const perlScript = `
use strict; use warnings; use JSON::PP;
binmode STDIN, ':raw';
local $/; my $spec = JSON::PP->new->utf8->decode(<STDIN>);
my @out;
for my $c (@{$spec->{cases}}) {
  my $p = $spec->{patterns}{$c->{pattern}}{pcre_pattern};
  push @out, ($c->{input} =~ /$p/) ? 1 : 0;
}
print join(",", @out);
`;
const perl = spawnSync("perl", ["-e", perlScript], {
  input: JSON.stringify(spec),
  encoding: "utf8",
});
let perlRan = false;
if (perl.error || perl.status !== 0) {
  const msg = `perl unavailable or failed, skipping PCRE parity: ${perl.error ? perl.error.message : perl.stderr}`;
  if (process.env.REGEX_SPEC_REQUIRE_PERL === "1") fail(msg);
  else console.warn(msg);
} else {
  perlRan = true;
  const results = perl.stdout.trim().split(",").map((v) => v === "1");
  spec.cases.forEach((c, i) => {
    if (results[i] !== c.match) {
      fail(`case ${i} [${c.pattern}] ${c.description}: PCRE matched=${results[i]}, want ${c.match}`);
    }
  });
}

// ---------------------------------------------------------------------------
// 5. ReDoS timing.
// ---------------------------------------------------------------------------
const N = spec.redos.adversarial_input_length;
const adversarial = [
  "G" + "A".repeat(N) + "!",
  "M" + "A".repeat(N) + "1",
  "C" + "A".repeat(N) + "\n",
  "1".repeat(N) + "a",
  "0".repeat(N),
  "GA".repeat(N / 2),
  " ".repeat(N),
  "\n".repeat(N),
];
for (const [name, re] of Object.entries(compiled)) {
  for (const input of adversarial) {
    const start = process.hrtime.bigint();
    re.test(input);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (ms > spec.redos.max_match_ms) {
      fail(`${name}: adversarial input took ${ms.toFixed(1)}ms (> ${spec.redos.max_match_ms}ms)`);
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Cross-check against real StrKeys in spec/vectors.json.
// ---------------------------------------------------------------------------
let StrKey = null;
for (const from of [rootDir, path.join(rootDir, "packages", "core-ts")]) {
  try {
    StrKey = require(require.resolve("@stellar/stellar-sdk", { paths: [from] })).StrKey;
    break;
  } catch {}
}
let crossChecked = 0;
if (StrKey) {
  const vectorsText = fs.readFileSync(path.join(rootDir, "spec", "vectors.json"), "utf8");
  const candidates = new Set(vectorsText.match(/\b[GMC][A-Z2-7]{55,68}\b/g) || []);
  for (const addr of candidates) {
    let kind = null;
    if (StrKey.isValidEd25519PublicKey(addr)) kind = "account_id";
    else if (StrKey.isValidMed25519PublicKey(addr)) kind = "muxed_account";
    else if (StrKey.isValidContract(addr)) kind = "contract_id";
    if (!kind) continue;
    crossChecked++;
    if (!compiled[kind].test(addr)) fail(`${kind}: valid StrKey ${addr} from vectors.json does not match`);
  }
} else {
  console.warn("@stellar/stellar-sdk not resolvable, skipping vectors.json cross-check");
}

if (errors.length) report();

console.log(
  `Regex spec validation passed (regex_version: ${spec.regex_version}, ` +
    `patterns: ${Object.keys(spec.patterns).length}, cases: ${spec.cases.length}, ` +
    `pcre: ${perlRan ? "checked" : "skipped"}, vector StrKeys cross-checked: ${crossChecked})`,
);
