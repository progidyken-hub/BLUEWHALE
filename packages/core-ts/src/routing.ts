import { StrKey } from "./strkey";

export interface DepositDestination {
  address: string;
  memo?: string;
  memoType?: "text" | "id" | "hash" | "return";
  route?: DepositRoute[];
}

export interface DepositRoute {
  anchorId: string;
  memo?: string;
  memoType?: "text" | "id" | "hash" | "return";
  route?: DepositRoute[];
}

export interface ParseConfig {
  /**
   * When true, the parsed destination record (including deeply nested memo
   * and route objects) is recursively frozen with `Object.freeze`.
   */
  immutable?: boolean;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

export function parseDepositDestination(
  input: string,
  config: ParseConfig = {},
): DepositDestination {
  const parsed = parseRaw(input);
  return config.immutable ? deepFreeze(parsed) : parsed;
}

function parseRaw(input: string): DepositDestination {
  const trimmed = input.trim();
  if (!StrKey.isValidEd25519PublicKey(trimmed)) {
    throw new Error(`Invalid deposit destination: ${input}`);
  }
  return { address: trimmed };
}
