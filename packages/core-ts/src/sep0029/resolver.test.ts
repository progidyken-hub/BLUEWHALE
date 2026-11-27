import { describe, it, expect, vi } from "vitest";
import {
  parseSep29Destination,
  resolveSep29Destination,
  type Sep29ResolverConfig,
} from "./resolver";

function mockFetch(handler: (url: string) => Promise<Response>): typeof fetch {
  return vi.fn((input: RequestInfo | URL) =>
    handler(typeof input === "string" ? input : input.toString()),
  ) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("parseSep29Destination", () => {
  it("parses HTTP descriptors", () => {
    expect(parseSep29Destination({ kind: "http", url: "https://example.com/deposit" })).toEqual({
      kind: "http",
      url: "https://example.com/deposit",
    });
  });

  it("parses contract memo descriptors", () => {
    expect(
      parseSep29Destination({
        kind: "contract",
        contract: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
        memo: "12345",
        memoType: "id",
      }),
    ).toEqual({
      kind: "contract",
      contract: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
      memo: "12345",
      memoType: "id",
    });
  });

  it("rejects unknown descriptors", () => {
    expect(() => parseSep29Destination({ kind: "bogus" })).toThrow();
  });
});

describe("resolveSep29Destination", () => {
  it("returns contract destinations without network access", async () => {
    const fetchImpl = mockFetch(async () => jsonResponse({}));
    const result = await resolveSep29Destination(
      { kind: "contract", contract: "CABC", memo: "m" },
      { fetch: fetchImpl },
    );
    expect(result).toEqual({ kind: "contract", contract: "CABC", memo: "m" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("resolves HTTP descriptors via fetch", async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse({ kind: "contract", contract: "CXYZ", memoType: "text" }),
    );
    const result = await resolveSep29Destination(
      { kind: "http", url: "https://example.com/deposit" },
      { fetch: fetchImpl },
    );
    expect(result).toEqual({ kind: "contract", contract: "CXYZ", memoType: "text" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and eventually succeeds", async () => {
    let calls = 0;
    const fetchImpl = mockFetch(async () => {
      calls += 1;
      if (calls < 3) return jsonResponse({ error: "nope" }, 500);
      return jsonResponse({ kind: "http", url: "https://example.com/next" });
    });
    const config: Sep29ResolverConfig = {
      fetch: fetchImpl,
      retries: 2,
      retryDelayMs: 1,
    };
    const result = await resolveSep29Destination(
      { kind: "http", url: "https://example.com/deposit" },
      config,
    );
    expect(result).toEqual({ kind: "http", url: "https://example.com/next" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting retries", async () => {
    const fetchImpl = mockFetch(async () => jsonResponse({ error: "nope" }, 500));
    await expect(
      resolveSep29Destination(
        { kind: "http", url: "https://example.com/deposit" },
        { fetch: fetchImpl, retries: 1, retryDelayMs: 1 },
      ),
    ).rejects.toThrow(/HTTP 500/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
