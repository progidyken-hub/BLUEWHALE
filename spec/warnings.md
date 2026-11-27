# Warning codes

This is the canonical list of warning codes. `spec/schema.json` is the machine-readable source. The TypeScript (`core-ts`), Go (`core-go`) and Dart (`core-dart`) packages must emit these exact strings.

## Codes emitted by all three packages

| Code | Severity | Meaning |
|---|---|---|
| `NON_CANONICAL_ADDRESS` | `warn` | The address was normalized, for example lowercase to uppercase. |
| `NON_CANONICAL_ROUTING_ID` | `warn` | The routing ID had leading zeros and was normalized to canonical decimal. |
| `MEMO_IGNORED_FOR_MUXED` | `info`, `warn` or `error` | A memo was provided but ignored because the M-address already contains an ID. |
| `MEMO_PRESENT_WITH_MUXED` | `info`, `warn` or `error` | Both an M-address and a routing memo were present. |
| `CONTRACT_SENDER_DETECTED` | `info`, `warn` or `error` | The transaction sender is a smart contract. |
| `MEMO_TEXT_UNROUTABLE` | `info`, `warn` or `error` | `MEMO_TEXT` is not a valid numeric uint64. |
| `MEMO_ID_INVALID_FORMAT` | `info`, `warn` or `error` | `MEMO_ID` is malformed or exceeds the uint64 range. |
| `UNSUPPORTED_MEMO_TYPE` | `warn` | The memo type (`hash`, `return` or `unknown`) is not supported for routing. Carries `context.memoType`. |
| `INVALID_DESTINATION` | `error` | The destination is a contract address, which is invalid for classic payments. Carries `context.destinationKind`. |
| `MISSING_REQUIRED_MEMO` | `info`, `warn` or `error` | The destination requires a memo (SEP-0029) but none supplied a routing ID. |

Severity is fixed by the schema only for `NON_CANONICAL_*`, `UNSUPPORTED_MEMO_TYPE` and `INVALID_DESTINATION`. The other codes accept any of the three severities.

## Codes in the schema that the packages do not emit

- `MEMO_TEXT_TOO_LONG` (`error`, with `context.byteLength` and `context.maxByteLength`) is defined in `spec/schema.json`. No package defines it.
- `INVALID_STRKEY` is allowed by the schema's generic warning shape and is not part of the list the Go and Dart packages declare as their warning codes.

## Names in #389

Issue #389 proposes `WARN_NUMERIC_TEXT_MEMO`, `WARN_MEMO_MUXED_CONFLICT` and `WARN_CONTRACT_NO_ROUTING`. None of them exist in the schema or in any package. The three packages already agree on the list above, which the Go test (`packages/core-go/spec/warning_codes_test.go`) and the Dart test (`packages/core-dart/test/warning_code_parity_test.dart`) check. Renaming a code changes the wire format and needs a `spec_version` bump, so this page documents the existing names instead.
