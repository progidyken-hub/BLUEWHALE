// destinationError / address error code taxonomy parity suite.
//
// The same literals are asserted in core-go (address/error_code_parity_test.go)
// and core-dart (test/error_code_parity_test.dart), and must match the
// `errorCode` enum in spec/schema.json.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AddressParseError, ErrorCode } from "../address/errors";

const CODES: ErrorCode[] = [
  "INVALID_CHECKSUM",
  "INVALID_LENGTH",
  "INVALID_BASE32",
  "UNKNOWN_PREFIX",
  "REJECTED_SEED_KEY",
  "REJECTED_PREAUTH",
  "REJECTED_HASH_X",
  "FEDERATION_ADDRESS_NOT_SUPPORTED",
];

describe("address error code taxonomy", () => {
  it("matches the errorCode enum in spec/schema.json", () => {
    const schema = JSON.parse(
      readFileSync(resolve(__dirname, "../../../../spec/schema.json"), "utf8"),
    );
    expect([...schema.definitions.errorCode.enum].sort()).toEqual([...CODES].sort());
  });

  it("carries the code string verbatim on AddressParseError", () => {
    for (const code of CODES) {
      expect(new AddressParseError(code, "x", "m").code).toBe(code);
    }
  });
});
