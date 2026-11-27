import { crc16xmodem } from "./crc16";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE32_LOOKUP: Record<string, number> = {};
for (let i = 0; i < BASE32_ALPHABET.length; i++) {
  BASE32_LOOKUP[BASE32_ALPHABET[i]] = i;
}

const VERSION_BYTE_ACCOUNT_ID = 6 << 3; // 'G'
const VERSION_BYTE_MUXED_ACCOUNT = 12 << 3; // 'M'
const VERSION_BYTE_SEED = 18 << 3; // 'S'

const ZERO_WIDTH_SPACE = "\u200B";
const ZERO_WIDTH_NO_BREAK_SPACE = "\uFEFF";
const ZERO_WIDTH_JOINER = "\u200D";
const ZERO_WIDTH_NON_JOINER = "\u200C";

const LEADING_TRAILING_STRIP = new RegExp(
  `^[\\s${ZERO_WIDTH_SPACE}${ZERO_WIDTH_NO_BREAK_SPACE}${ZERO_WIDTH_JOINER}${ZERO_WIDTH_NON_JOINER}]+|[\\s${ZERO_WIDTH_SPACE}${ZERO_WIDTH_NO_BREAK_SPACE}${ZERO_WIDTH_JOINER}${ZERO_WIDTH_NON_JOINER}]+$`,
  "g",
);

// Printable ASCII range plus the base32 alphabet; anything else embedded in the
// body is considered a non-printable / invalid character.
const NON_PRINTABLE = /[^\x20-\x7E]/;

export class StrKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StrKeyError";
  }
}

/**
 * Normalizes an input address string by stripping leading/trailing ASCII
 * whitespace and zero-width spaces, then rejects any non-printable characters
 * embedded within the address body.
 */
export function sanitizeAddress(input: string): string {
  if (typeof input !== "string") {
    throw new StrKeyError("address must be a string");
  }

  const trimmed = input.replace(LEADING_TRAILING_STRIP, "");

  if (NON_PRINTABLE.test(trimmed)) {
    throw new StrKeyError(
      "address contains non-printable characters in its body",
    );
  }

  return trimmed;
}

function base32Decode(input: string): Uint8Array {
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of input) {
    const idx = BASE32_LOOKUP[char];
    if (idx === undefined) {
      throw new StrKeyError(`invalid base32 character: ${char}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((value >>> bits) & 0xff);
    }
  }

  return new Uint8Array(output);
}

function base32Encode(input: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return output;
}

function encodeCheck(versionByte: number, payload: Uint8Array): string {
  const data = new Uint8Array(payload.length + 1);
  data[0] = versionByte;
  data.set(payload, 1);

  const checksum = crc16xmodem(data);
  const checksumBytes = new Uint8Array([
    checksum & 0xff,
    (checksum >>> 8) & 0xff,
  ]);

  const full = new Uint8Array(data.length + checksumBytes.length);
  full.set(data, 0);
  full.set(checksumBytes, data.length);

  return base32Encode(full);
}

function decodeCheck(versionByte: number, encoded: string): Uint8Array {
  const raw = base32Decode(encoded);

  if (raw.length < 3) {
    throw new StrKeyError("encoded string is too short");
  }

  const data = raw.subarray(0, raw.length - 2);
  const checksumBytes = raw.subarray(raw.length - 2);

  if (data[0] !== versionByte) {
    throw new StrKeyError("invalid version byte");
  }

  const expected = crc16xmodem(data);
  const actual = checksumBytes[0] | (checksumBytes[1] << 8);

  if (expected !== actual) {
    throw new StrKeyError("invalid checksum");
  }

  return data.subarray(1);
}

export function encodeAccountId(payload: Uint8Array): string {
  return encodeCheck(VERSION_BYTE_ACCOUNT_ID, payload);
}

export function decodeAccountId(address: string): Uint8Array {
  return decodeCheck(VERSION_BYTE_ACCOUNT_ID, sanitizeAddress(address));
}

export function encodeMuxedAccount(payload: Uint8Array): string {
  return encodeCheck(VERSION_BYTE_MUXED_ACCOUNT, payload);
}

export function decodeMuxedAccount(address: string): Uint8Array {
  return decodeCheck(VERSION_BYTE_MUXED_ACCOUNT, sanitizeAddress(address));
}

export function encodeSeed(payload: Uint8Array): string {
  return encodeCheck(VERSION_BYTE_SEED, payload);
}

export function decodeSeed(seed: string): Uint8Array {
  return decodeCheck(VERSION_BYTE_SEED, sanitizeAddress(seed));
}
