/**
 * SEP-0029 contract deposit routing types.
 *
 * SEP-0029 defines standard deposit endpoints and routing descriptors for
 * Soroban smart contracts. A destination may be expressed either as an HTTP
 * endpoint (which is queried for routing info) or as a contract memo that is
 * passed directly to the contract.
 */

/** Routing descriptor returned by an HTTP SEP-0029 deposit endpoint. */
export interface Sep29HttpRouting {
  /** Discriminator for HTTP-based routing. */
  type: "http";
  /** Fully-qualified URL of the deposit endpoint. */
  url: string;
  /** Optional memo to attach to the resulting Stellar payment. */
  memo?: string;
  /** Optional memo type (e.g. "text", "id", "hash"). */
  memoType?: string;
}

/** Routing descriptor for a contract memo passed directly to the contract. */
export interface Sep29ContractMemoRouting {
  /** Discriminator for contract-memo-based routing. */
  type: "contract_memo";
  /** Contract address (C... StrKey) that receives the deposit. */
  contract: string;
  /** Raw memo payload forwarded to the contract. */
  memo: string;
}

/** Union of all supported SEP-0029 routing descriptors. */
export type Sep29Routing = Sep29HttpRouting | Sep29ContractMemoRouting;

/** Resolved destination produced by `resolveSep29Destination`. */
export interface Sep29ResolvedDestination {
  /** The routing descriptor that was resolved. */
  routing: Sep29Routing;
  /** Normalized destination address (account or contract StrKey). */
  destination: string;
  /** Optional memo to attach to the payment, if any. */
  memo?: string;
  /** Optional memo type, if any. */
  memoType?: string;
}

/** Configuration for the SEP-0029 resolver. */
export interface Sep29ResolverConfig {
  /** Per-request timeout in milliseconds. Defaults to 10_000. */
  timeoutMs?: number;
  /** Maximum number of retry attempts for transient failures. Defaults to 2. */
  retries?: number;
  /** Base delay between retries in milliseconds. Defaults to 250. */
  retryDelayMs?: number;
  /** Optional fetch implementation (useful for testing / custom runtimes). */
  fetch?: typeof fetch;
}

/** Error raised when a SEP-0029 destination cannot be resolved. */
export class Sep29ResolutionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "Sep29ResolutionError";
  }
}
