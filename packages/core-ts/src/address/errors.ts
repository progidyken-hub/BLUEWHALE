import { ANSI_ESCAPE_G, CONTROL_CHARS_G } from "../patterns";

export type ErrorCode =
  | "INVALID_CHECKSUM"
  | "INVALID_LENGTH"
  | "INVALID_BASE32"
  | "REJECTED_SEED_KEY"
  | "REJECTED_PREAUTH"
  | "REJECTED_HASH_X"
  | "FEDERATION_ADDRESS_NOT_SUPPORTED"
  | "MAX_INPUT_EXCEEDED"
  | "UNKNOWN_PREFIX";

/**
 * Sanitizes control characters and ANSI escape sequences in error messages (Issue #294).
 */
export function sanitizeErrorMessage(msg: string): string {
  return msg
    .replace(ANSI_ESCAPE_G, "")
    .replace(CONTROL_CHARS_G, "");
}

/**
 * Represents an error encountered during the parsing of a Stellar address.
 * Includes a machine-readable ErrorCode and the original input string.
 */
export class AddressParseError extends Error {
  code: ErrorCode;
  readonly input: string;

  constructor(code: ErrorCode, input: string, message: string) {
    super(sanitizeErrorMessage(message));
    this.name = "AddressParseError";
    this.code = code;
    this.input = sanitizeErrorMessage(input);
    Object.setPrototypeOf(this, AddressParseError.prototype);
  }

  /**
   * Serializes the error to the canonical cross-SDK error message structure
   * `{ code, input, message }` shared with core-go (`RoutingError`) and
   * core-dart (`AddressError`).
   */
  toJSON(): { code: ErrorCode; input: string; message: string } {
    return {
      code: this.code,
      input: this.input,
      message: this.message,
    };
  }
}
