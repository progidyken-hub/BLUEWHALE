/**
 * SEP-0029 contract deposit routing resolution.
 *
 * SEP-0029 defines standard deposit endpoints and routing descriptors for
 * Soroban smart contracts. A destination may be described either by an HTTP
 * endpoint (classic SEP-0024 style) or by a contract memo descriptor that
 * points at an on-chain contract plus a memo payload.
 */

export type Sep29HttpDestination = {
  kind: "http";
  /** Fully-qualified deposit endpoint URL. */
  url: string;
};

export type Sep29ContractDestination = {
  kind: "contract";
  /** Contract address (C... strkey) that receives the deposit. */
  contract: string;
  /** Memo payload forwarded to the contract, if any. */
  memo?: string;
  /** Memo type hint, e.g. "text" | "id" | "hash". */
  memoType?: string;
};

export type Sep29Destination = Sep29HttpDestination | Sep29ContractDestination;

export type Sep29ResolverConfig = {
  /** Per-attempt timeout in milliseconds. Defaults to 5000. */
  timeoutMs?: number;
  /** Number of retry attempts after the first failure. Defaults to 2. */
  retries?: number;
  /** Base backoff delay in milliseconds between retries. Defaults to 250. */
  retryDelayMs?: number;
  /** Optional fetch implementation (useful for tests / non-browser runtimes). */
  fetch?: typeof fetch;
};

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isHttpDestination(value: unknown): value is Sep29HttpDestination {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.kind === "http" && typeof v.url === "string";
}

function isContractDestination(value: unknown): value is Sep29ContractDestination {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.kind === "contract" && typeof v.contract === "string";
}

/**
 * Normalize a raw routing descriptor into a typed SEP-0029 destination.
 * Supports both the HTTP endpoint format and the contract memo format.
 */
export function parseSep29Destination(raw: unknown): Sep29Destination {
  if (isHttpDestination(raw)) {
    return { kind: "http", url: raw.url };
  }
  if (isContractDestination(raw)) {
    const dest: Sep29ContractDestination = {
      kind: "contract",
      contract: raw.contract,
    };
    if (typeof raw.memo === "string") dest.memo = raw.memo;
    if (typeof raw.memoType === "string") dest.memoType = raw.memoType;
    return dest;
  }
  throw new Error("Unsupported SEP-0029 destination descriptor");
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a SEP-0029 destination.
 *
 * - HTTP descriptors are fetched (with timeout + retry) and the returned
 *   routing descriptor is parsed into a typed destination.
 * - Contract memo descriptors are returned directly without network access.
 */
export async function resolveSep29Destination(
  destination: Sep29Destination | unknown,
  config: Sep29ResolverConfig = {},
): Promise<Sep29Destination> {
  const parsed = parseSep29Destination(destination);

  if (parsed.kind === "contract") {
    return parsed;
  }

  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = config.retries ?? DEFAULT_RETRIES;
  const retryDelayMs = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const fetchImpl = config.fetch ?? fetch;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(parsed.url, timeoutMs, fetchImpl);
      if (!response.ok) {
        throw new Error(`SEP-0029 resolver HTTP ${response.status}`);
      }
      const body = await response.json();
      return parseSep29Destination(body);
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("SEP-0029 destination resolution failed");
}
