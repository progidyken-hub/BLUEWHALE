# Bluewhale Specification

**The normative source of truth for cross-language Stellar address routing and interop.**

This directory contains the formal definition of the Bluewhale's behavior. It ensures that any compliant implementation (TypeScript, Go, Dart, etc.) produces bit-identical results for the same input, regardless of platform or language-specific quirks.

---

## 📂 Spec Structure

```text
spec/
├── schema.json      # Formal JSON Schema enforcing output structures
├── vectors.json     # The master test suite (positive/negative/edge cases)
├── vectors/
│   └── empty-memos.json  # Normative empty MEMO_TEXT handling
├── regex.json       # Normative, engine-portable address / routing-ID regexes
├── validate.js      # Reference validator for the specification itself
└── README.md        # This document (Normative Design Rules)
```

---

## 🏛️ Normative Design Rules

### 1. "Never Throw" Contract

Every public function in every implementation MUST be non-throwing for any arbitrary string input. Errors must be returned as structured data within the result object.

### 2. Error vs. Warning Ontology

- **ErrorCode**: Used when the input **could not be parsed** (e.g., `INVALID_CHECKSUM`). Carried in `destinationError`.
- **WarningCode**: Used when the input was **successfully parsed** but is operationally notable (e.g., `NON_CANONICAL_ADDRESS`). Carried in `warnings[]`.

### 3. Canonicalization Invariants

- **Uppercase Primary**: All address fields in output objects MUST be uppercase.
- **Decimal Strings**: Routing IDs MUST be returned as decimal strings.
- **Leading Zeros**: Routing IDs MUST have leading zeros stripped (except for the value `"0"`), and a `NON_CANONICAL_ROUTING_ID` warning MUST be emitted.

### 4. C-Address Safety

Contract addresses (`C...`) are valid StrKeys but are **invalid destinations** for classic payment routing. Any `extractRouting` implementation MUST emit an `INVALID_DESTINATION` warning with `severity: 'error'` if a C-address is provided as the destination.

### 5. Whitespace Handling (Normative)

Implementations MUST handle leading and trailing whitespace in address inputs consistently. The normative behavior is:

- **Trim, then parse**: Implementations MUST trim leading and trailing ASCII whitespace (space `U+0020`, tab `U+0009`, newline `U+000A`, carriage return `U+000D`) from the input string before parsing.
- **Emit a warning**: When trimming occurs, the implementation MUST emit a `NON_CANONICAL_ADDRESS` warning (severity `warning`) in `warnings[]`. The parsed address MUST still be returned in `destination`.
- **Never error on whitespace alone**: Whitespace MUST NOT cause an `INVALID_CHECKSUM` or any other `ErrorCode`. Only the trimmed content is validated.
- **Interior whitespace is invalid**: Whitespace between characters of an address (e.g. `G... A...`) is NOT trimmed and MUST result in an `INVALID_CHECKSUM` error.

This rule applies uniformly to `G...` (account), `M...` (muxed account), and `C...` (contract) StrKeys. For `C...` addresses, the `INVALID_DESTINATION` warning (severity `error`) is emitted in addition to the `NON_CANONICAL_ADDRESS` warning when trimming occurred.

### 6. Empty MEMO_TEXT

A `MEMO_TEXT` whose value is omitted, `null`, `""` or only ASCII whitespace (space, tab, LF, CR) carries no routing information and MUST be treated exactly like memo type `none`:

- No routing ID is taken from the memo, and no `MEMO_TEXT_UNROUTABLE` or `MEMO_IGNORED_FOR_MUXED` warning is emitted, for G and M destinations alike.
- Non-ASCII whitespace (e.g. U+00A0) is content: such a memo stays `text` and is reported as unroutable.
- Each SDK exposes the rule as `effectiveMemoType` / `EffectiveMemoType` (Go returns `MemoTypeNone`).

Cases live in [`vectors/empty-memos.json`](./vectors/empty-memos.json); core-ts, core-go and core-dart all run them, and `validate.js` checks every expectation against this rule.

### 7. Portable Regular Expressions

Address and routing-ID shape checks are standardized in [`regex.json`](./regex.json). Every pattern is written in the common subset of ECMAScript, Dart, Go (RE2) and PCRE, and every case in the file MUST produce the same result in all of them:

- **No flags, explicit ASCII classes.** `\d`, `\w`, `\s`, `\b` and `.` are forbidden because their meaning varies by engine and Unicode mode.
- **End-of-input anchoring.** In PCRE, Perl and Python `$` also matches before a trailing newline. Those engines MUST use the `pcre_pattern` form (`\A...\z`) or a full-match API. A trailing newline is never accepted.
- **ReDoS-safe by construction.** Only bounded quantifiers on single atoms; no `*`, `+`, quantified groups, backreferences or lookaround.
- **Shape only.** A match never replaces StrKey decoding and CRC16 checksum verification.

`node scripts/check-regex-spec.js` enforces these rules, runs the cases under ECMAScript and Perl, and times 100k-character adversarial inputs. core-go, core-dart and core-ts each run the same cases in their native engine.

---

## 🧪 Testing & Compliance

### The Canary Vector

To protect against JavaScript's 53-bit integer precision loss, the spec includes a **2^53+1 canary** (`id: "9007199254740993"`). Any implementation using float-based numbers internally will fail this test.

### Whitespace Vectors

The suite includes vectors covering leading and trailing spaces, tabs, newlines, and carriage returns around `G`, `M`, and `C` addresses. Each such vector asserts:

- `destination` equals the trimmed, canonical address.
- `warnings[]` contains `NON_CANONICAL_ADDRESS`.
- `destinationError` is absent.

### Focused Vector Files (`spec/vectors/`)

Alongside the master suite, `spec/vectors/` holds focused vector files that each package's test suite loads directly:

| File | Covers |
|------|--------|
| `truncated-addresses.json` | M-addresses truncated to 10–68 characters MUST fail with `INVALID_LENGTH`, never panic or throw a range error. |
| `subaccount-formatting.json` | uint64 muxed IDs up to 2^64-1 MUST format as plain decimal strings (`BigInt.toString()` / `strconv.FormatUint` / Dart `BigInt.toString()`), never through float64. |
| `case-sensitivity.json` | Lowercase or mixed-case `g…`/`m…`/`c…` strkeys MUST be rejected with `INVALID_BASE32` by the strict decoder unless `allowLowercase` is set. |

### Generating Vectors from Testnet

`scripts/generate-vectors-from-horizon.js` builds anonymized `extract_routing` cases from live Stellar testnet payments:

```bash
node scripts/generate-vectors-from-horizon.js --count 25 --out spec/vectors/horizon-testnet.json
node scripts/generate-vectors-from-horizon.js --self-test   # offline checks
```

Accounts, memo IDs, muxed IDs and memos are replaced deterministically (see `--salt`), so the output never contains real testnet data. By default only cases whose expected result follows directly from the spec are emitted; `--all` also emits memo/warning-dependent cases marked `UNVERIFIED` in `notes`, which must be completed before committing.

### Running Validation

Before contributing logic changes, ensure the specification itself remains valid:

```bash
pnpm spec:validate
```

---

## 🤝 Contribution Workflow

The Bluewhale follows a **Spec-First** model:

1. **Vector Addition**: New behaviors or bug fixes must start by adding a case to [`vectors.json`](./vectors.json).
2. **Structural Validation**: Ensure the new vector passes the schema defined in `schema.json`.
3. **Cross-Language Parity**: Implement the change in all supported languages (TS, Go, Dart) until all tests pass the new vector suite.

---

## 📜 Versioning

The `spec_version` field in `vectors.json` coordinates the ecosystem:

- **Patch**: New tests for existing behavior.
- **Minor**: New codes or optional fields.
- **Major**: Structural changes to `RoutingInput` or `RoutingResult`.
