---
title: "Conformance Testing"
description: "Run the official Bluewhale test vectors against your own implementation in Rust, Python, Ruby or any other language"
---

Bluewhale's behaviour is defined by the test vectors in [`spec/`](../../spec/README.md), not by any one SDK. The conformance suite lets you check your implementation against those vectors, whatever language it's written in.

You write a small **adapter**: a program that reads JSON requests on stdin, calls your library, and writes JSON responses on stdout. The **runner** (`scripts/conformance/runner.mjs`, also packaged as `Dockerfile.conformance`) sends every vector to your adapter, compares the answers, and prints a report.

```text
┌──────────────────────┐   one JSON request per line   ┌───────────────────────┐
│  conformance runner  │ ────────────── stdin ───────▶ │  your adapter         │
│  (vectors + checks)  │ ◀───────────── stdout ─────── │  → your library       │
└──────────────────────┘   one JSON response per line  └───────────────────────┘
```

## Quick start

### With Docker

Build the runner image from the repository root:

```bash
docker build -f Dockerfile.conformance -t bluewhale-conformance .
```

The adapter runs **inside** the container. You can do that in one of two ways.

**Extend the image** with your toolchain and adapter. This works for any language:

```dockerfile
# Dockerfile in your implementation's repository
FROM bluewhale-conformance
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 \
 && rm -rf /var/lib/apt/lists/*
COPY . /impl
CMD ["--", "python3", "/impl/adapter.py"]
```

```bash
docker build -t my-impl-conformance .
docker run --rm my-impl-conformance
```

**Mount a self-contained binary**, for example a statically linked Rust build:

```bash
cargo build --release --target x86_64-unknown-linux-musl
docker run --rm \
  -v "$PWD/target/x86_64-unknown-linux-musl/release:/impl:ro" \
  bluewhale-conformance -- /impl/bluewhale-adapter
```

Everything after `--` is the adapter command. Runner options go before it:

```bash
docker run --rm -v "$PWD/out:/out" my-impl-conformance \
  --verbose --report /out/report.json -- python3 /impl/adapter.py
```

### Without Docker

The runner only needs Node.js 18 or later and has no dependencies:

```bash
node scripts/conformance/runner.mjs -- python3 path/to/adapter.py
node scripts/conformance/runner.mjs -- ruby adapter.rb
node scripts/conformance/runner.mjs -- ./target/release/bluewhale-adapter
```

### Starter adapter

[`scripts/conformance/adapters/template.py`](../../scripts/conformance/adapters/template.py) is a complete Python adapter where every operation is still a TODO. Run it as it is first: all cases should come back `unsupported`, which confirms the protocol plumbing works. Then fill in the operations one at a time.

[`scripts/conformance/adapters/core-ts.mjs`](../../scripts/conformance/adapters/core-ts.mjs) is the reference adapter for core-ts. To run it:

```bash
docker build -f Dockerfile.conformance --target self-test -t bluewhale-conformance:self-test .
docker run --rm bluewhale-conformance:self-test
```

## Protocol: `bluewhale-conformance/1`

### Framing

- The runner writes **one JSON object per line** (UTF-8, `\n`-terminated) to the adapter's stdin.
- The adapter writes **exactly one JSON object per line** to stdout for each request, **in the same order**, and flushes after each line.
- stdout is reserved for responses. Send logs and diagnostics to **stderr**: the runner passes stderr through unchanged.
- Requests are sent one at a time. The runner waits for each response, 10 s by default (`--timeout`), before sending the next request.
- When stdin closes, the adapter should exit. An adapter still running 2 s later is killed.

### Envelope

Request:

```json
{ "id": "vectors.json#3", "op": "muxed_decode", "input": { "mAddress": "MAYC..." } }
```

Success response:

```json
{ "id": "vectors.json#3", "ok": true, "output": { "baseG": "GAYC...", "id": "9007199254740993" } }
```

Error response:

```json
{ "id": "vectors.json#6", "ok": false, "error": { "code": "INVALID_CHECKSUM", "message": "..." } }
```

| Field | Rule |
|---|---|
| `id` | Opaque string. Echo it back unchanged. |
| `ok` | `true` with `output`, or `false` with `error`. |
| `error.code` | Free-form, except for the reserved `UNSUPPORTED_OP`. `message` is optional. |

If your library rejects an input, answer `ok: false`. That is a valid answer, not a crash. If an operation is not implemented, answer `ok: false` with `error.code: "UNSUPPORTED_OP"`. The runner then counts the case as **unsupported**, not failed.

### `hello` (handshake)

The first request is always `hello`:

```json
{ "id": "hello", "op": "hello", "protocol": "bluewhale-conformance/1", "specVersion": "1.2.0" }
```

```json
{
  "id": "hello",
  "ok": true,
  "output": {
    "protocol": "bluewhale-conformance/1",
    "implementation": { "name": "bluewhale-rs", "version": "0.3.0", "language": "rust" },
    "ops": ["detect", "muxed_encode", "muxed_decode", "extract_routing"]
  }
}
```

`protocol` must match exactly, or the runner stops. `ops` lists the operations you implement. Cases for any other operation are reported as unsupported and are never sent to the adapter.

### Operations

All IDs (muxed IDs and routing IDs) are **decimal strings**, both in requests and in responses. Never round-trip them through a float or a 53-bit integer, because the vectors include `2^53 + 1` and `2^64 - 1`.

#### `detect`

Classify and canonicalize an address.

| Request `input` | Response `output` |
|---|---|
| `address`: string | `kind`: `"G"`, `"M"`, `"C"` or `"invalid"` |
| | `address`: canonical (uppercase, trimmed) address |
| | `warnings`: `[{ "code", "severity", ... }]` |

#### `muxed_encode`

| Request `input` | Response `output` |
|---|---|
| `baseG`: G address | `mAddress`: M address |
| `id`: decimal string (uint64) | |

#### `muxed_decode`

| Request `input` | Response `output` |
|---|---|
| `mAddress`: M address | `baseG`: G address |
| | `id`: decimal string |

Some vectors expect a failure, such as an invalid encoding or non-zero padding bits. For those, any `ok: false` passes. Error messages differ between languages, so the runner does not compare them.

#### `extract_routing`

| Request `input` | Response `output` |
|---|---|
| `destination`: string | `destinationBaseAccount`: string or `null` |
| `memoType`: `"none"`, `"id"`, `"text"`, `"hash"`, `"return"` or another string | `routingId`: decimal string or `null` |
| `memoValue`: string or `null` | `routingSource`: `"muxed"`, `"memo"` or `"none"` |
| `sourceAccount`: string or `null` | `warnings`: `[{ "code", "severity", ... }]` |
| | `destinationError` (optional): `{ "code", "message" }` |

If your language has no null string (Go, for example), treat a `null` `memoValue` or `sourceAccount` as `""`.

### How results are compared

| Op | Compared |
|---|---|
| `detect` | `kind`, plus `address` and `warnings` when the vector specifies them |
| `muxed_encode` | `mAddress` |
| `muxed_decode` | `baseG` and `id`, or "is an error" for failure vectors |
| `extract_routing` | each of `destinationBaseAccount`, `routingId`, `routingSource`, `warnings` and `destinationError.code` that the vector specifies |

Warnings are compared **by `code` and `severity`, in order**. `message`, `normalization` and `context` are not compared, so you can word messages however you like. Codes and severities are normative and come from [`spec/schema.json`](../../spec/schema.json).

### Which vectors run

The runner loads:

- `spec/vectors.json`. Each case's `module` is the operation.
- Every `spec/vectors/*.json` file with a `cases` array of routing cases, such as `empty-memos.json`. These run as `extract_routing`.

Some cases are **skipped**, and the report says why:

- Modules outside protocol v1, such as `toml_lookup` (SEP-0029 network resolution).
- Vectors that still use the legacy 50-character placeholder addresses, which no implementation can parse. core-go skips these too.

## Reading the report

```text
Bluewhale conformance (bluewhale-conformance/1, spec 1.2.0) against bluewhale-rs 0.3.0 (rust)

FAIL  [detect] vectors.json#12 lowercase G accepted with normalization warning
        warnings: got [], want [{"code":"NON_CANONICAL_ADDRESS","severity":"warn"}]

op                 passed  failed  unsupported  skipped
muxed_encode            5       0            0        0
muxed_decode            7       0            0        0
detect                  0       1            0        0
extract_routing        17       0            0        3
toml_lookup             0       0            0       14

Total: 29 passed, 1 failed, 0 unsupported, 17 skipped
```

| Option | Effect |
|---|---|
| `--verbose` | List every case, not just failures |
| `--report FILE` | Also write a JSON report: `{ summary, results[] }` |
| `--only detect,extract_routing` | Run a subset of operations |
| `--strict` | Count `unsupported` cases as failures. Use this once you claim full coverage. |
| `--timeout MS` | Per-request timeout (default `10000`) |
| `--spec-dir DIR` | Use vectors from another checkout (`BLUEWHALE_SPEC_DIR` also works) |

| Exit code | Meaning |
|---|---|
| `0` | No failures |
| `1` | At least one case failed (or was unsupported, with `--strict`) |
| `2` | Usage or protocol error: the adapter crashed, timed out, wrote a non-JSON line, echoed the wrong `id`, or spoke another protocol version |

## Running in CI

```yaml
# .github/workflows/conformance.yml in your implementation's repository
jobs:
  conformance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/checkout@v4
        with:
          repository: progidyken-hub/BLUEWHALE
          path: bluewhale
      - run: docker build -f bluewhale/Dockerfile.conformance -t bluewhale-conformance bluewhale
      - run: docker build -t my-impl-conformance .   # FROM bluewhale-conformance
      - run: docker run --rm my-impl-conformance --strict -- python3 /impl/adapter.py
```

Pin the Bluewhale checkout to a tag so that new vectors don't break your build unexpectedly. Then bump the tag on purpose when you adopt a new `spec_version`.

## Versioning

The protocol name carries a major version (`/1`). Additive changes keep the same name: a new operation that adapters may report as unsupported, or a new optional output field. Any change that would break an existing adapter bumps the version, and the runner refuses adapters that speak a different one.
