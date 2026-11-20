import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_STELLAR_TOML_TTL_MS,
  StellarTomlCache,
  cacheControlTtlMs,
} from "../sep0029/cache";

const TOML = 'FEDERATION_SERVER="https://anchor.example/federation"\n';

/** A fetch stub answering every request with `body` and `headers`. */
function tomlServer(body = TOML, headers: Record<string, string> = {}, status = 200) {
  return vi.fn(async (_url: string, _init?: RequestInit) =>
    new Response(body, { status, statusText: status === 200 ? "OK" : "Not Found", headers }),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

/** A manually advanced clock. */
function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("StellarTomlCache", () => {
  it("serves a cache hit without a network call", async () => {
    const fetchImpl = tomlServer();
    const cache = new StellarTomlCache({ fetch: fetchImpl });

    expect(await cache.get("anchor.example")).toBe(TOML);
    expect(await cache.get("anchor.example")).toBe(TOML);
    expect(await cache.get("ANCHOR.example")).toBe(TOML);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith("https://anchor.example/.well-known/stellar.toml", {
      signal: undefined,
    });
  });

  it("defaults to a 15 minute TTL", async () => {
    expect(DEFAULT_STELLAR_TOML_TTL_MS).toBe(15 * 60 * 1000);
    const fetchImpl = tomlServer();
    const c = clock();
    const cache = new StellarTomlCache({ fetch: fetchImpl, now: c.now });

    await cache.get("anchor.example");
    c.advance(DEFAULT_STELLAR_TOML_TTL_MS - 1);
    await cache.get("anchor.example");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    c.advance(1);
    await cache.get("anchor.example");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("uses a configurable TTL", async () => {
    const fetchImpl = tomlServer();
    const c = clock();
    const cache = new StellarTomlCache({ fetch: fetchImpl, now: c.now, ttlMs: 1000 });

    await cache.get("anchor.example");
    c.advance(999);
    await cache.get("anchor.example");
    c.advance(1);
    await cache.get("anchor.example");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not cache when ttlMs is 0", async () => {
    const fetchImpl = tomlServer();
    const cache = new StellarTomlCache({ fetch: fetchImpl, ttlMs: 0 });
    await cache.get("anchor.example");
    await cache.get("anchor.example");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(0);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects ttlMs %s", (ttlMs) => {
    expect(() => new StellarTomlCache({ ttlMs })).toThrow(RangeError);
  });

  it("lets Cache-Control max-age override the TTL", async () => {
    const fetchImpl = tomlServer(TOML, { "Cache-Control": "public, max-age=60" });
    const c = clock();
    const cache = new StellarTomlCache({ fetch: fetchImpl, now: c.now });

    await cache.get("anchor.example");
    c.advance(59_999);
    await cache.get("anchor.example");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    c.advance(1);
    await cache.get("anchor.example");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each(["no-store", "no-cache", "max-age=0"])("does not cache a %s response", async (cc) => {
    const fetchImpl = tomlServer(TOML, { "Cache-Control": cc });
    const cache = new StellarTomlCache({ fetch: fetchImpl });
    await cache.get("anchor.example");
    await cache.get("anchor.example");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("ignores Cache-Control when respectCacheControl is false", async () => {
    const fetchImpl = tomlServer(TOML, { "Cache-Control": "no-store" });
    const cache = new StellarTomlCache({ fetch: fetchImpl, respectCacheControl: false });
    await cache.get("anchor.example");
    await cache.get("anchor.example");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("shares one request between concurrent lookups", async () => {
    const fetchImpl = tomlServer();
    const cache = new StellarTomlCache({ fetch: fetchImpl });
    const results = await Promise.all([1, 2, 3].map(() => cache.get("anchor.example")));
    expect(results).toEqual([TOML, TOML, TOML]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not cache failed requests", async () => {
    const fetchImpl = tomlServer("missing", {}, 404);
    const cache = new StellarTomlCache({ fetch: fetchImpl });
    await expect(cache.get("anchor.example")).rejects.toThrow(
      'Failed to fetch stellar.toml from "anchor.example": 404 Not Found',
    );
    expect(cache.size).toBe(0);
    await expect(cache.get("anchor.example")).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not cache network errors", async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new TypeError("network down"));
    fetchImpl.mockImplementation(async () => new Response(TOML));
    const cache = new StellarTomlCache({ fetch: fetchImpl as unknown as typeof fetch });
    await expect(cache.get("anchor.example")).rejects.toThrow("network down");
    expect(await cache.get("anchor.example")).toBe(TOML);
  });

  it("passes the abort signal to fetch", async () => {
    const fetchImpl = tomlServer();
    const cache = new StellarTomlCache({ fetch: fetchImpl });
    const { signal } = new AbortController();
    await cache.get("anchor.example", { signal });
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(String), { signal });
  });

  it.each(["", "localhost", "anchor.example/evil", "anchor.example:8443", "a..b"])(
    "rejects invalid domain %j without fetching",
    async (domain) => {
      const fetchImpl = tomlServer();
      const cache = new StellarTomlCache({ fetch: fetchImpl });
      await expect(cache.get(domain)).rejects.toThrow("Invalid stellar.toml home domain");
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it("invalidates one domain or all domains", async () => {
    const fetchImpl = tomlServer();
    const cache = new StellarTomlCache({ fetch: fetchImpl });
    await cache.get("a.example");
    await cache.get("b.example");
    expect(cache.size).toBe(2);

    cache.invalidate("A.example");
    expect(cache.size).toBe(1);
    await cache.get("a.example");
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    cache.invalidate();
    expect(cache.size).toBe(0);
  });

  it("keeps an invalidation that happens while a request is in flight", async () => {
    const fetchImpl = tomlServer();
    const cache = new StellarTomlCache({ fetch: fetchImpl });
    const pending = cache.get("anchor.example");
    cache.invalidate("anchor.example");
    await pending;
    expect(cache.size).toBe(0);
  });

  it("falls back to the global fetch", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(TOML));
    try {
      const cache = new StellarTomlCache();
      expect(await cache.get("anchor.example")).toBe(TOML);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("cacheControlTtlMs", () => {
  it.each([
    [null, undefined],
    ["", undefined],
    ["public", undefined],
    ["max-age=300", 300_000],
    ["public, MAX-AGE=120, must-revalidate", 120_000],
    ['max-age="30"', 30_000],
    ["max-age=0", 0],
    ["max-age=abc", undefined],
    ["max-age=-5", undefined],
    ["max-age", undefined],
    ["max-age=10, max-age=99", 10_000],
    ["no-store", 0],
    ["max-age=600, no-cache", 0],
    ["s-maxage=600", undefined],
  ])("%j -> %j", (header, expected) => {
    expect(cacheControlTtlMs(header)).toBe(expected);
  });
});
