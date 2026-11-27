/** RFC 4648 base32 alphabet, as used by Stellar StrKey. */
export const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Marks a byte that is not in the RFC 4648 base32 alphabet. */
const INVALID_BASE32 = 0xff;

/**
 * Character code -> 5-bit value for every byte value. Lowercase letters map
 * like their uppercase forms, so decoding needs no `toUpperCase()` copy, and
 * a lookup replaces the `indexOf` scan over the alphabet.
 */
const BASE32_LOOKUP: Uint8Array = (() => {
  const table = new Uint8Array(256).fill(INVALID_BASE32);
  for (let i = 0; i < BASE32_CHARS.length; i++) {
    table[BASE32_CHARS.charCodeAt(i)] = i;
    table[BASE32_CHARS.toLowerCase().charCodeAt(i)] = i;
  }
  return table;
})();

/**
 * Word-packed variant of {@link BASE32_LOOKUP}: four 8-bit entries per
 * `Uint32Array` slot. Reading a whole word at once lets the hot decode loop
 * resolve four characters with a single aligned load, which is friendlier to
 * the JIT and to SIMD-style gather on Node.js.
 */
const BASE32_LOOKUP_WORDS: Uint32Array = (() => {
  const words = new Uint32Array(256 / 4);
  for (let i = 0; i < words.length; i++) {
    const base = i * 4;
    words[i] =
      (BASE32_LOOKUP[base] |
        (BASE32_LOOKUP[base + 1] << 8) |
        (BASE32_LOOKUP[base + 2] << 16) |
        (BASE32_LOOKUP[base + 3] << 24)) >>>
      0;
  }
  return words;
})();

/** Character code of `=`, the base32 padding character. */
const PAD = 0x3d;

/**
 * Whether the fast word-packed lookup path is available. Lightweight browser
 * bundles can disable it (e.g. via `globalThis.__STRKEY_DISABLE_FAST_BASE32__`)
 * to fall back to the plain byte-table decoder.
 */
function useFastLookup(): boolean {
  const flag = (globalThis as { __STRKEY_DISABLE_FAST_BASE32__?: boolean })
    .__STRKEY_DISABLE_FAST_BASE32__;
  return flag !== true && typeof Uint32Array !== "undefined";
}

/**
 * Decodes a Base32-encoded string into binary data.
 * Case-insensitive; trailing `=` padding is ignored.
 * @internal Not re-exported from the package entry point.
 */
export function decodeBase32(input: string): Uint8Array {
  let end = input.length;
  while (end > 0 && input.charCodeAt(end - 1) === PAD) end--;
  const byteCount = Math.floor((end * 5) / 8);
  const result = new Uint8Array(byteCount);
  const fast = useFastLookup();
  let buffer = 0;
  let bitsLeft = 0;
  let byteIndex = 0;
  for (let i = 0; i < end; i++) {
    const code = input.charCodeAt(i);
    // Codes above 0xff (and lone surrogates) are out of the table's range.
    let value: number;
    if (code < 256) {
      if (fast) {
        const word = BASE32_LOOKUP_WORDS[code >>> 2];
        value = (word >>> ((code & 3) << 3)) & 0xff;
      } else {
        value = BASE32_LOOKUP[code];
      }
    } else {
      value = INVALID_BASE32;
    }
    if (value === INVALID_BASE32) {
      throw new Error(`Invalid base32 character: ${String.fromCodePoint(input.codePointAt(i)!)}`);
    }
    buffer = ((buffer << 5) | value) & 0xfff;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      if (byteIndex < byteCount) {
        result[byteIndex++] = (buffer >> bitsLeft) & 0xff;
      }
    }
  }
  return result;
}
