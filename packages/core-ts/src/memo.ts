import { StrKey } from "./strkey";
import { UnsignedHyper } from "@stellar/js-xdr";

/**
 * The maximum value of a uint64, as a BigInt.
 */
export const MAX_UINT64 = 18446744073709551615n;

/**
 * The maximum safe integer representable by a JavaScript Number.
 */
export const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * The maximum number of UTF-8 bytes allowed in a MEMO_TEXT entry.
 */
export const MAX_MEMO_TEXT_BYTES = 28;

/**
 * Parses a memo ID payload into a BigInt, enforcing strict uint64 semantics.
 *
 * Accepts `bigint`, `string`, and `number` inputs. Raw `number` literals above
 * `Number.MAX_SAFE_INTEGER` are rejected because they may already have lost
 * precision (53-bit truncation).
 *
 * @throws {RangeError} if the value is out of the uint64 range or a raw number
 *   literal exceeds `Number.MAX_SAFE_INTEGER`.
 */
export function parseMemoId(value: bigint | string | number): bigint {
  let id: bigint;

  if (typeof value === "bigint") {
    id = value;
  } else if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new RangeError(
        `Memo ID must be an integer, received non-integer number: ${value}`,
      );
    }
    if (BigInt(value) > MAX_SAFE_INTEGER) {
      throw new RangeError(
        `Memo ID ${value} exceeds Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}); ` +
          "pass a bigint or string to preserve full uint64 precision",
      );
    }
    id = BigInt(value);
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^[0-9]+$/.test(trimmed)) {
      throw new RangeError(
        `Memo ID must be a non-negative integer string, received: ${value}`,
      );
    }
    id = BigInt(trimmed);
  } else {
    throw new RangeError(
      `Memo ID must be a bigint, string, or number, received: ${typeof value}`,
    );
  }

  if (id < 0n) {
    throw new RangeError(`Memo ID must be non-negative, received: ${id}`);
  }
  if (id > MAX_UINT64) {
    throw new RangeError(
      `Memo ID ${id} exceeds maximum uint64 value ${MAX_UINT64}`,
    );
  }

  return id;
}

/**
 * Serializes a memo ID BigInt into its uint64 XDR representation.
 */
export function memoIdToXdr(id: bigint): UnsignedHyper {
  return UnsignedHyper.fromString(parseMemoId(id).toString());
}

/**
 * Validates a MEMO_TEXT payload against the protocol's 28 UTF-8 byte limit.
 *
 * The limit is measured in UTF-8 bytes, not characters, so multi-byte
 * characters (e.g. emoji) can exceed it even when the character count is
 * within 28.
 *
 * @throws {RangeError} if the UTF-8 byte length exceeds 28.
 */
export function validateMemoText(text: string): string {
  const byteLength = new TextEncoder().encode(text).length;
  if (byteLength > MAX_MEMO_TEXT_BYTES) {
    throw new RangeError(
      `Memo text exceeds maximum of ${MAX_MEMO_TEXT_BYTES} UTF-8 bytes: ` +
        `received ${byteLength} bytes (${text.length} characters)`,
    );
  }
  return text;
}

export type MemoType = "none" | "id" | "text" | "hash" | "return";

export type Memo = {
  type: MemoType;
  value?: bigint | string | Buffer;
};

export type MemoValue = null | bigint | string | Buffer;

export class MemoNone {
  type: "none" = "none";
  value: null = null;
}

export class MemoID {
  type: "id" = "id";
  value: bigint;

  constructor(id: bigint | string | number) {
    this.value = parseMemoId(id);
  }
}

export class MemoText {
  type: "text" = "text";
  value: string;

  constructor(text: string) {
    this.value = validateMemoText(text);
  }
}

export class MemoHash {
  type: "hash" = "hash";
  value: Buffer;

  constructor(hash: Buffer) {
    this.value = hash;
  }
}

export class MemoReturn {
  type: "return" = "return";
  value: Buffer;

  constructor(hash: Buffer) {
    this.value = hash;
  }
}

export function parseMemo(memo: Memo): MemoNone | MemoID | MemoText | MemoHash | MemoReturn {
  switch (memo.type) {
    case "none":
      return new MemoNone();
    case "id":
      return new MemoID(memo.value as bigint | string | number);
    case "text":
      return new MemoText(memo.value as string);
    case "hash":
      return new MemoHash(memo.value as Buffer);
    case "return":
      return new MemoReturn(memo.value as Buffer);
    default:
      throw new RangeError(`Unknown memo type: ${(memo as Memo).type}`);
  }
}
