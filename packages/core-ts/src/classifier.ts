/**
 * Zero-allocation address prefix classifier.
 *
 * Determines the probable Stellar address type (G, M, or C) by inspecting
 * only the first character and the total length of the input. This avoids
 * allocating buffers or performing full base32 decoding when the input is
 * obviously malformed.
 */

export type AddressType = "G" | "M" | "C";

/** StrKey version byte for ed25519 public keys (G...). */
const ED25519_PUBLIC_KEY_LENGTH = 56;
/** StrKey version byte for muxed accounts (M...). */
const MUXED_ACCOUNT_LENGTH = 69;
/** StrKey version byte for contract addresses (C...). */
const CONTRACT_LENGTH = 56;

/**
 * Base32 alphabet used by StrKey. Indexed lookup avoids regex allocation.
 * Returns true when `code` is a valid base32 character code.
 */
function isBase32Code(code: number): boolean {
  // 'A'-'Z' => 65-90
  if (code >= 65 && code <= 90) return true;
  // '2'-'7' => 50-55
  if (code >= 50 && code <= 55) return true;
  return false;
}

/**
 * Cheaply validates that a string is composed solely of base32 characters
 * without allocating any intermediate buffers.
 */
function isBase32String(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (!isBase32Code(value.charCodeAt(i))) return false;
  }
  return true;
}

/**
 * Classify an address by its prefix and length.
 *
 * Returns the probable address type, or `null` when the input cannot be a
 * valid Stellar address. No buffers are allocated for malformed inputs.
 */
export function classifyAddress(address: string): AddressType | null {
  if (typeof address !== "string" || address.length === 0) return null;

  const first = address.charCodeAt(0);
  const length = address.length;

  // Fast path: reject on prefix/length mismatch before any scanning.
  switch (first) {
    case 71: // 'G'
      if (length !== ED25519_PUBLIC_KEY_LENGTH) return null;
      break;
    case 77: // 'M'
      if (length !== MUXED_ACCOUNT_LENGTH) return null;
      break;
    case 67: // 'C'
      if (length !== CONTRACT_LENGTH) return null;
      break;
    default:
      return null;
  }

  // Early validation short-circuit: avoid decoding obviously malformed input.
  if (!isBase32String(address)) return null;

  return String.fromCharCode(first) as AddressType;
}

/**
 * Returns true when the address is a probable G, M, or C address.
 */
export function isProbableAddress(address: string): boolean {
  return classifyAddress(address) !== null;
}
