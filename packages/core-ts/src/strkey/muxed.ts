import { InvalidArgumentError } from "../errors.js";
import { decodeCheck } from "./decode.js";
import { encodeCheck } from "./encode.js";
import { StrKey } from "./strkey.js";

/**
 * A decoded Med25519 (muxed) strkey.
 */
export interface MuxedAccount {
  /** The underlying ed25519 public key (G-address) as raw bytes. */
  ed25519: Buffer;
  /** The 64-bit subaccount ID. */
  id: bigint;
}

/**
 * Decode a Med25519 (M-address) strkey into its ed25519 key and subaccount ID.
 *
 * @param address - A valid M-address strkey.
 * @returns The decoded ed25519 public key bytes and 64-bit subaccount ID.
 * @throws {InvalidArgumentError} If the address is not a valid M-address.
 */
export function decodeMuxedAddress(address: string): MuxedAccount {
  if (!StrKey.isValidMed25519PublicKey(address)) {
    throw new InvalidArgumentError("address is not a valid M-address");
  }

  const raw = decodeCheck("med25519", address);
  const ed25519 = raw.subarray(0, 32);
  const id = raw.readBigUInt64BE(32);

  return { ed25519, id };
}

/**
 * Extract the 64-bit subaccount ID from a Med25519 (M-address) strkey.
 *
 * This is a convenience helper for inspecting the subaccount portion of a
 * muxed address without manual bit shifts.
 *
 * @param address - A valid M-address strkey.
 * @returns The 64-bit subaccount ID as a bigint.
 * @throws {InvalidArgumentError} If the address is a standard G-address,
 *   a C-address, or otherwise not a valid M-address.
 *
 * @example
 * ```ts
 * const id = getMuxedSubaccountId("MA...");
 * ```
 */
export function getMuxedSubaccountId(address: string): bigint {
  if (!StrKey.isValidMed25519PublicKey(address)) {
    throw new InvalidArgumentError(
      "address must be a valid M-address (Med25519 public key)",
    );
  }

  return decodeMuxedAddress(address).id;
}

/**
 * Encode an ed25519 public key and 64-bit subaccount ID into an M-address.
 *
 * @param ed25519 - The 32-byte ed25519 public key.
 * @param id - The 64-bit subaccount ID.
 * @returns The encoded M-address strkey.
 */
export function encodeMuxedAddress(ed25519: Buffer, id: bigint): string {
  if (ed25519.length !== 32) {
    throw new InvalidArgumentError("ed25519 public key must be 32 bytes");
  }

  const raw = Buffer.alloc(40);
  ed25519.copy(raw, 0);
  raw.writeBigUInt64BE(id, 32);

  return encodeCheck("med25519", raw);
}
