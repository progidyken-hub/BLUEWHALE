/**
 * Machine-readable error codes for the core-ts package.
 *
 * Consumers should branch on `error.code` rather than matching on
 * human-readable messages.
 */
export enum BluewhaleErrorCode {
  InvalidChecksum = "INVALID_CHECKSUM",
  UnknownAddressVersion = "UNKNOWN_ADDRESS_VERSION",
  MuxedMemoConflict = "MUXED_MEMO_CONFLICT",
}

/**
 * Base class for all Bluewhale errors. Carries a machine-readable `code`
 * so callers can distinguish failure reasons without regex matching.
 */
export class BluewhaleError extends Error {
  readonly code: BluewhaleErrorCode;

  constructor(code: BluewhaleErrorCode, message: string) {
    super(message);
    this.name = "BluewhaleError";
    this.code = code;
    // Restore prototype chain for transpiled targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when an address fails its checksum validation. */
export class InvalidChecksumError extends BluewhaleError {
  constructor(message = "Invalid checksum") {
    super(BluewhaleErrorCode.InvalidChecksum, message);
    this.name = "InvalidChecksumError";
  }
}

/** Thrown when an address uses an unrecognized version byte. */
export class UnknownAddressVersionError extends BluewhaleError {
  constructor(message = "Unknown address version") {
    super(BluewhaleErrorCode.UnknownAddressVersion, message);
    this.name = "UnknownAddressVersionError";
  }
}

/** Thrown when a muxed address conflicts with an explicit memo. */
export class MuxedMemoConflictError extends BluewhaleError {
  constructor(message = "Muxed address conflicts with provided memo") {
    super(BluewhaleErrorCode.MuxedMemoConflict, message);
    this.name = "MuxedMemoConflictError";
  }
}

/**
 * Table mapping each error code to its corresponding error class.
 * Useful for reconstructing typed errors from a serialized code.
 */
export const BluewhaleErrorCodes: Record<BluewhaleErrorCode, typeof BluewhaleError> = {
  [BluewhaleErrorCode.InvalidChecksum]: InvalidChecksumError,
  [BluewhaleErrorCode.UnknownAddressVersion]: UnknownAddressVersionError,
  [BluewhaleErrorCode.MuxedMemoConflict]: MuxedMemoConflictError,
};
