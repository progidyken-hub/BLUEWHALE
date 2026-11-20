import { isValidRfc1035Domain } from "../routing/memoRequirement";

/** Default time a fetched stellar.toml stays fresh: 15 minutes. */
export const DEFAULT_STELLAR_TOML_TTL_MS = 15 * 60 * 1000;

export interface StellarTomlCacheOptions {
  /**
   * How long a fetched stellar.toml is reused when the response carries no
   * usable `Cache-Control: max-age`. Defaults to 15 minutes.
   */
  ttlMs?: number;
  /**
   * Honour the response's `Cache-Control` header: `max-age` replaces
   * `ttlMs`, and `no-store` / `no-cache` / `max-age=0` disable caching for
   * that response. Defaults to true.
   */
  respectCacheControl?: boolean;
  /** Fetch implementation; defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Clock in milliseconds; defaults to `Date.now`. Injectable for tests. */
  now?: () => number;
}

export interface StellarTomlGetOptions {
  /** Aborts the network request. A cache hit returns without fetching. */
  signal?: AbortSignal;
}

interface Entry {
  /** The in-flight or settled fetch. Concurrent callers share it. */
  value: Promise<string>;
  /** Epoch ms after which the entry is stale; Infinity while in flight. */
  expiresAt: number;
}

/**
 * In-memory cache of SEP-1 `stellar.toml` files keyed by home domain, so a
 * burst of deposits to the same anchor does one network round trip instead of
 * one per deposit.
 *
 * Entries stay fresh for `ttlMs` (15 minutes by default), or for the
 * response's `Cache-Control: max-age` when present. Concurrent lookups for a
 * domain share one request, and failed requests are never cached.
 *
 * Create one instance and share it; nothing is cached at module scope.
 */
export class StellarTomlCache {
  private readonly entries = new Map<string, Entry>();
  private readonly ttlMs: number;
  private readonly respectCacheControl: boolean;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(options: StellarTomlCacheOptions = {}) {
    const ttlMs = options.ttlMs ?? DEFAULT_STELLAR_TOML_TTL_MS;
    if (!Number.isFinite(ttlMs) || ttlMs < 0) {
      throw new RangeError(`ttlMs must be a finite, non-negative number, got ${ttlMs}`);
    }
    this.ttlMs = ttlMs;
    this.respectCacheControl = options.respectCacheControl ?? true;
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.now = options.now ?? Date.now;
  }

  /** Number of cached or in-flight domains, including stale ones. */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Returns the stellar.toml text for `domain`, from cache when fresh,
   * otherwise from `https://<domain>/.well-known/stellar.toml`.
   */
  get(domain: string, options: StellarTomlGetOptions = {}): Promise<string> {
    const key = domain.toLowerCase();
    if (!isValidRfc1035Domain(key)) {
      return Promise.reject(new Error(`Invalid stellar.toml home domain: "${domain}"`));
    }

    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > this.now()) {
      return cached.value;
    }

    const entry: Entry = { value: Promise.resolve(""), expiresAt: Infinity };
    entry.value = this.load(key, options.signal).then(
      ({ text, ttlMs }) => {
        // Only touch the map if this entry was not invalidated meanwhile.
        if (this.entries.get(key) === entry) {
          if (ttlMs > 0) entry.expiresAt = this.now() + ttlMs;
          else this.entries.delete(key);
        }
        return text;
      },
      (error: unknown) => {
        if (this.entries.get(key) === entry) this.entries.delete(key);
        throw error;
      },
    );
    this.entries.set(key, entry);
    return entry.value;
  }

  /** Drops the cached entry for `domain`, or every entry when omitted. */
  invalidate(domain?: string): void {
    if (domain === undefined) this.entries.clear();
    else this.entries.delete(domain.toLowerCase());
  }

  private async load(domain: string, signal?: AbortSignal): Promise<{ text: string; ttlMs: number }> {
    const response = await this.fetchImpl(`https://${domain}/.well-known/stellar.toml`, { signal });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch stellar.toml from "${domain}": ${response.status} ${response.statusText}`,
      );
    }
    const text = await response.text();

    let ttlMs = this.ttlMs;
    if (this.respectCacheControl) {
      const fromHeader = cacheControlTtlMs(response.headers?.get("cache-control") ?? null);
      if (fromHeader !== undefined) ttlMs = fromHeader;
    }
    return { text, ttlMs };
  }
}

/**
 * Freshness lifetime, in milliseconds, that a `Cache-Control` header grants a
 * private cache: 0 for `no-store` / `no-cache`, `max-age` seconds otherwise,
 * or undefined when the header says nothing usable.
 */
export function cacheControlTtlMs(header: string | null): number | undefined {
  if (!header) return undefined;

  let maxAge: number | undefined;
  for (const raw of header.split(",")) {
    const [name, value] = raw.trim().split("=", 2);
    const directive = name.toLowerCase();
    if (directive === "no-store" || directive === "no-cache") return 0;
    if (directive === "max-age" && maxAge === undefined && value !== undefined) {
      const unquoted = value.trim().replace(/^"(.*)"$/, "$1");
      if (/^\d+$/.test(unquoted)) maxAge = Number(unquoted) * 1000;
    }
  }
  return maxAge;
}
