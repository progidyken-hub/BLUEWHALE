import { DIGITS_ONLY } from "../patterns";

/**
 * Maximum value for a 64-bit unsigned integer (uint64).
 */
export const UINT64_MAX = BigInt("18446744073709551615");

/**
 * Maximum safe integer in JavaScript (2^53 - 1).
 */
export const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Precision-safe wrapper for 64-bit Stellar routing IDs (MEMO_ID and muxed account IDs).
 * Prevents silent truncation and precision loss caused by JavaScript Number semantics above 2^53 - 1.
 */
export class SafeRoutingId {
  private readonly _value: string;
  private readonly _bigint: bigint;

  constructor(value: string | bigint | number) {
    if (typeof value === "bigint") {
      if (value < 0n || value > UINT64_MAX) {
        throw new RangeError(`SafeRoutingId out of uint64 bounds: ${value}`);
      }
      this._bigint = value;
      this._value = value.toString();
    } else if (typeof value === "number") {
      if (!Number.isInteger(value) || value < 0) {
        throw new RangeError(`SafeRoutingId must be a non-negative integer: ${value}`);
      }
      if (value > Number.MAX_SAFE_INTEGER) {
        throw new RangeError(
          `Number ${value} exceeds Number.MAX_SAFE_INTEGER and may have already suffered precision loss. Pass a string or BigInt instead.`
        );
      }
      this._bigint = BigInt(value);
      this._value = this._bigint.toString();
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      if (!DIGITS_ONLY.test(trimmed)) {
        throw new TypeError(`Invalid SafeRoutingId string: "${value}". Must contain only decimal digits.`);
      }
      const b = BigInt(trimmed);
      if (b < 0n || b > UINT64_MAX) {
        throw new RangeError(`SafeRoutingId out of uint64 bounds: ${value}`);
      }
      this._bigint = b;
      this._value = b.toString();
    } else {
      throw new TypeError(`Unsupported type for SafeRoutingId: ${typeof value}`);
    }
  }

  /**
   * Returns the value as a native BigInt.
   */
  public toBigInt(): bigint {
    return this._bigint;
  }

  /**
   * Returns true if the ID is representable without precision loss as a JavaScript Number (<= 2^53 - 1).
   */
  public isSafeInteger(): boolean {
    return this._bigint <= MAX_SAFE_INTEGER;
  }

  /**
   * Returns the canonical decimal string representation.
   */
  public toString(): string {
    return this._value;
  }

  /**
   * Returns the canonical string representation for JSON serialization.
   */
  public toJSON(): string {
    return this._value;
  }

  /**
   * Parses an input into a SafeRoutingId. Throws if invalid or out of bounds.
   */
  public static parse(input: string | bigint | number): SafeRoutingId {
    return new SafeRoutingId(input);
  }

  /**
   * Safely tries to parse an input into a SafeRoutingId. Returns null if invalid.
   */
  public static tryParse(input: string | bigint | number | null | undefined): SafeRoutingId | null {
    if (input === null || input === undefined) return null;
    try {
      return new SafeRoutingId(input);
    } catch {
      return null;
    }
  }

  /**
   * Creates a SafeRoutingId from a string, bigint, or number.
   */
  public static from(input: string | bigint | number): SafeRoutingId {
    return new SafeRoutingId(input);
  }
}
