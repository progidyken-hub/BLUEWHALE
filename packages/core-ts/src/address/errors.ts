/**
 * Canonical address-parse error codes returned in `AddressParseError.code`
 * and `RoutingResult.destinationError.code`.
 *
 * These string literals are part of the cross-SDK contract and must stay
 * identical to Go `address.ErrorCode`, Dart `AddressErrorCode`, and the
 * `errorCode` definition in `spec/schema.json`.
 */
export const ADDRESS_PARSE_ERROR_CODES = [
  "UNKNOWN_PREFIX",
  "INVALID_CHECKSUM",
  "INVALID_LENGTH",
  "INVALID_BASE32",
  "REJECTED_SEED_KEY",
  "REJECTED_PREAUTH",
  "REJECTED_HASH_X",
  "FEDERATION_ADDRESS_NOT_SUPPORTED",
] as const;

export type AddressParseErrorCode = (typeof ADDRESS_PARSE_ERROR_CODES)[number];

/** Alias kept for backwards compatibility; prefer `AddressParseErrorCode`. */
export type ErrorCode = AddressParseErrorCode;

/** Reports whether `value` is one of the canonical address-parse error codes. */
export function isAddressParseErrorCode(
  value: unknown,
): value is AddressParseErrorCode {
  return (
    typeof value === "string" &&
    (ADDRESS_PARSE_ERROR_CODES as readonly string[]).includes(value)
  );
}

/**
 * Represents an error encountered during the parsing of a Stellar address.
 * Includes a machine-readable ErrorCode and the original input string.
 */
export class AddressParseError extends Error {
  code: AddressParseErrorCode;
  readonly input: string;

  constructor(code: AddressParseErrorCode, input: string, message: string) {
    super(message);
    this.name = "AddressParseError";
    this.code = code;
    this.input = input;
    Object.setPrototypeOf(this, AddressParseError.prototype);
  }
}
