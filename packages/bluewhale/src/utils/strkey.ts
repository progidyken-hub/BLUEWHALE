/**
 * Minimal StrKey helpers (SEP-23) for the UI layer.
 *
 * The UI only needs to turn a muxed `M...` address back into its base
 * `G...` account, so this stays dependency-free instead of pulling the full
 * Stellar SDK into the component bundle. Checksums are always verified: a
 * malformed or mistyped address returns `null` rather than a wrong account.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const VERSION_BYTE_ACCOUNT_ID = 6 << 3; // 'G'
const VERSION_BYTE_MUXED_ACCOUNT = 12 << 3; // 'M'

const MUXED_PAYLOAD_LENGTH = 32 + 8; // ed25519 public key + uint64 id

function base32Decode(input: string): Uint8Array | null {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of input) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  // Leftover bits must be zero padding, otherwise the encoding is non-canonical.
  if (bits > 0 && (value & ((1 << bits) - 1)) !== 0) return null;
  return Uint8Array.from(out);
}

function base32Encode(data: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** CRC16-XModem, as used by StrKey checksums. */
function crc16(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function encodeCheck(versionByte: number, payload: Uint8Array): string {
  const body = new Uint8Array(1 + payload.length);
  body[0] = versionByte;
  body.set(payload, 1);
  const checksum = crc16(body);
  const full = new Uint8Array(body.length + 2);
  full.set(body);
  full[body.length] = checksum & 0xff; // little-endian
  full[body.length + 1] = checksum >> 8;
  return base32Encode(full);
}

export interface DecodedMuxedAddress {
  /** The underlying standard `G...` account. */
  baseAccount: string;
  /** The 64-bit muxed ID, as a decimal string. */
  id: string;
}

/**
 * Decode a muxed `M...` address into its base `G...` account and ID.
 * Returns `null` for anything that is not a valid, checksummed M-address.
 */
export function decodeMuxedAddress(address: string): DecodedMuxedAddress | null {
  const trimmed = address.trim().toUpperCase();
  if (!trimmed.startsWith('M')) return null;

  const raw = base32Decode(trimmed);
  if (!raw || raw.length !== 1 + MUXED_PAYLOAD_LENGTH + 2) return null;
  if (raw[0] !== VERSION_BYTE_MUXED_ACCOUNT) return null;

  const body = raw.subarray(0, raw.length - 2);
  const expected = raw[raw.length - 2] | (raw[raw.length - 1] << 8);
  if (crc16(body) !== expected) return null;

  const publicKey = body.subarray(1, 33);
  let id = 0n;
  for (const byte of body.subarray(33, 41)) id = (id << 8n) | BigInt(byte);

  return {
    baseAccount: encodeCheck(VERSION_BYTE_ACCOUNT_ID, publicKey),
    id: id.toString(),
  };
}
