import { BASE32_CHARS } from "./base32";
import { verifyCrc16Checksum } from "./crc16";

/** Error codes {@link decodeStrKey} can report. */
export type StrKeyDecodeErrorCode =
  | "INVALID_LENGTH"
  | "INVALID_BASE32"
  | "INVALID_CHECKSUM"
  | "UNKNOWN_PREFIX";

/** Address kinds {@link decodeStrKey} accepts. */
export type StrKeyKind = "G" | "M" | "C";

/** Result of {@link decodeStrKey}. Never thrown, always returned. */
export type StrKeyDecodeResult =
  | {
      ok: true;
      kind: StrKeyKind;
      /** Canonical (uppercase) address. */
      address: string;
      /** True when lowercase input was normalized (only with `allowLowercase`). */
      normalized: boolean;
      /** Version byte as found in the decoded strkey. */
      versionByte: number;
      /** Decoded payload without version byte or checksum. */
      payload: Uint8Array;
    }
  | { ok: false; error: StrKeyDecodeErrorCode };

/**
 * Exact encoded length, in characters, of every strkey kind:
 * G/C = 1 version byte + 32-byte key + 2-byte CRC16 = 35 bytes = 56 chars;
 * M   = 1 version byte + 32-byte key + 8-byte id + 2-byte CRC16 = 43 bytes = 69 chars.
 */
export const STRKEY_ENCODED_LENGTH: Readonly<Record<StrKeyKind, number>> = Object.freeze({
  G: 56,
  M: 69,
  C: 56,
});

const VERSION_BYTE: Readonly<Record<StrKeyKind, number>> = Object.freeze({
  G: 6 << 3,
  M: 12 << 3,
  C: 2 << 3,
});

/** Options for {@link decodeStrKey}. */
export interface StrKeyDecodeOptions {
  /**
   * Accept lowercase or mixed-case input and normalize it to uppercase.
   * Off by default: StrKeys are uppercase and lowercase input is rejected
   * with `INVALID_BASE32`.
   */
  allowLowercase?: boolean;
}

const LOWERCASE = /[a-z]/;
/** Base32 alphabet plus ASCII lowercase; nothing else may ever be uppercased. */
const ASCII_STRKEY_CHARS = /^[A-Za-z2-7]*$/;

function fail(error: StrKeyDecodeErrorCode): StrKeyDecodeResult {
  return { ok: false, error };
}

/**
 * Strictly decodes a G, M or C strkey without ever throwing.
 *
 * Checks run in a fixed order shared with core-go and core-dart, so every
 * implementation reports the same error code for the same input:
 *
 * 1. non-string or empty input           -> `INVALID_LENGTH`
 * 2. first character not G/M/C/g/m/c     -> `UNKNOWN_PREFIX`
 * 3. any ASCII lowercase letter, unless `allowLowercase` is set
 *                                        -> `INVALID_BASE32`
 * 4. character outside A-Z, a-z, 2-7     -> `INVALID_BASE32`
 *    (checked before uppercasing, so non-ASCII letters such as U+017F,
 *    which `toUpperCase()` folds to "S", can never become valid)
 * 5. length differs from the kind's size -> `INVALID_LENGTH`
 *    (truncated or over-long input is rejected here, before any slicing)
 * 6. non-zero trailing bits              -> `INVALID_BASE32`
 * 7. CRC16 mismatch                      -> `INVALID_CHECKSUM`
 *
 * See spec/vectors/truncated-addresses.json and
 * spec/vectors/case-sensitivity.json.
 */
export function decodeStrKey(input: unknown, options: StrKeyDecodeOptions = {}): StrKeyDecodeResult {
  if (typeof input !== "string" || input.length === 0) return fail("INVALID_LENGTH");

  const prefix = input[0];
  if (!"GMCgmc".includes(prefix)) return fail("UNKNOWN_PREFIX");
  const kind = prefix.toUpperCase() as StrKeyKind;

  const hasLowercase = LOWERCASE.test(input);
  if (hasLowercase && !options.allowLowercase) return fail("INVALID_BASE32");
  if (!ASCII_STRKEY_CHARS.test(input)) return fail("INVALID_BASE32");
  const address = hasLowercase ? input.toUpperCase() : input;
  if (address.length !== STRKEY_ENCODED_LENGTH[kind]) return fail("INVALID_LENGTH");

  const byteCount = Math.floor((address.length * 5) / 8);
  const bytes = new Uint8Array(byteCount);
  let buffer = 0;
  let bits = 0;
  let n = 0;
  for (let i = 0; i < address.length; i++) {
    const value = BASE32_CHARS.indexOf(address[i]);
    if (value < 0) return fail("INVALID_BASE32");
    buffer = ((buffer << 5) | value) & 0xfff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes[n++] = (buffer >> bits) & 0xff;
    }
  }
  // Leftover bits must be zero, otherwise one payload has several encodings.
  if ((buffer & ((1 << bits) - 1)) !== 0) return fail("INVALID_BASE32");

  if (bytes[0] !== VERSION_BYTE[kind]) return fail("UNKNOWN_PREFIX");
  if (!verifyCrc16Checksum(bytes.subarray(0, n - 2), bytes.subarray(n - 2))) {
    return fail("INVALID_CHECKSUM");
  }

  return {
    ok: true,
    kind,
    address,
    normalized: hasLowercase,
    versionByte: bytes[0],
    payload: bytes.slice(1, n - 2),
  };
}
