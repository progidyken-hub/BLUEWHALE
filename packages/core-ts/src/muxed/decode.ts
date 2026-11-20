import { MuxedAccount } from "@stellar/stellar-sdk";
import { AddressParseError } from "../address/errors";
import { STRKEY_ENCODED_LENGTH } from "../strkey/decode";

/**
 * Decodes a muxed Stellar address (SEP-23) into its base account and ID.
 * Uses the official Stellar SDK MuxedAccount parser to ensure specification compliance.
 * 
 * @param mAddress - The muxed address string starting with 'M'.
 * @returns Metadata containing the base G address and the 64-bit BigInt ID.
 * @throws {AddressParseError} `INVALID_LENGTH` if the input is not exactly
 *   69 characters (e.g. a truncated M-address).
 * @throws {Error} If the address is otherwise not a valid muxed address.
 */
export function decodeMuxed(mAddress: string): { baseG: string; id: bigint } {
  if (typeof mAddress !== "string" || mAddress.length !== STRKEY_ENCODED_LENGTH.M) {
    throw new AddressParseError(
      "INVALID_LENGTH",
      typeof mAddress === "string" ? mAddress : "",
      `Muxed address must be ${STRKEY_ENCODED_LENGTH.M} characters`
    );
  }

  // MuxedAccount.fromAddress requires a sequence number. Since this is an
  // offline decoding of the address parts, we provide a placeholder.
  const muxed = MuxedAccount.fromAddress(mAddress, "0");

  return {
    baseG: muxed.baseAccount().accountId(),
    id: BigInt(muxed.id()),
  };
}
