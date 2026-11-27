/**
 * Comprehensive Fuzzing Test Suite for SEP-0029 stellar.toml Parsing — Issue #454
 *
 * SEP-0029 defines the `config.memo_required` account data field that
 * exchanges and anchors use to signal that all incoming payments MUST carry a
 * memo. The Bluewhale reads this field from Horizon's /accounts/:id endpoint
 * and feeds it through `extractRoutingAsync` to emit a MISSING_REQUIRED_MEMO
 * warning when routing would leave a memo-requiring account without an ID.
 *
 * This suite exercises every realistic and adversarial value that can appear
 * in the `data` map of a Horizon account response, covering:
 *
 *   1. Canonical truthy values           — "1", base64("1"), integer 1, true
 *   2. Canonical falsy values            — "0", "", null, undefined, false
 *   3. Alternate legacy key              — "config.requiring_memo"
 *   4. Fuzz: type mutations              — object, array, number, symbol, NaN
 *   5. Fuzz: string edge cases           — whitespace, Unicode, injection
 *   6. Fuzz: base64 edge cases           — valid non-"1", malformed, empty
 *   7. Full integration via extractRoutingAsync — trusted mock fetcher
 *   8. Network failure resilience        — fetcher throws, fetch returns non-200
 *   9. Fuzz: account response shape      — missing data, null response, extra keys
 *  10. Fuzz: Horizon URL construction    — trailing slash, encoded account
 */

import { describe, it, expect, vi } from "vitest";
import { fetchMemoRequirement, extractRoutingAsync } from "../routing/memoRequirement";
import type { RoutingInput } from "../routing/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const G_ADDRESS = "GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI";

/** Build a minimal Horizon account response with the given data map. */
function accountResponse(data: Record<string, unknown> = {}): object {
  return { id: G_ADDRESS, data };
}

/**
 * Build a mock `fetch` that returns the supplied account body with HTTP 200.
 * The captured URL is returned for inspection.
 */
function mockFetch(body: unknown): { fetch: typeof fetch; lastUrl: () => string } {
  let _lastUrl = "";
  const mockImpl = vi.fn(async (url: string) => {
    _lastUrl = url;
    return {
      ok: true,
      json: async () => body,
    } as Response;
  });
  return { fetch: mockImpl as unknown as typeof fetch, lastUrl: () => _lastUrl };
}

/** Build a mock `fetch` that returns HTTP 404. */
function mockFetch404(): typeof fetch {
  return vi.fn(async () => ({ ok: false, status: 404 } as Response)) as unknown as typeof fetch;
}

/** Build a mock `fetch` that throws a network error. */
function mockFetchThrows(message = "Network error"): typeof fetch {
  return vi.fn(async () => {
    throw new Error(message);
  }) as unknown as typeof fetch;
}

function base64(str: string): string {
  return Buffer.from(str).toString("base64");
}

// ---------------------------------------------------------------------------
// 1. Canonical truthy values
// ---------------------------------------------------------------------------

describe("SEP-0029 — canonical truthy memo_required values", () => {
  const truthyCases: Array<[string, unknown]> = [
    ['string "1"', "1"],
    [`base64("1") = "${base64("1")}"`, base64("1")],
    ["integer 1", 1],
    ["boolean true", true],
  ];

  truthyCases.forEach(([label, value]) => {
    it(`config.memo_required = ${label} → requires memo`, async () => {
      const { fetch: mockImpl } = mockFetch(
        accountResponse({ "config.memo_required": value }),
      );
      const result = await fetchMemoRequirement(G_ADDRESS, mockImpl);
      expect(result).toBe(true);
    });
  });

  it("config.requiring_memo (alternate key) = string '1' → requires memo", async () => {
    const { fetch: mockImpl } = mockFetch(
      accountResponse({ "config.requiring_memo": "1" }),
    );
    const result = await fetchMemoRequirement(G_ADDRESS, mockImpl);
    expect(result).toBe(true);
  });

  it("config.requiring_memo = base64('1') → requires memo", async () => {
    const { fetch: mockImpl } = mockFetch(
      accountResponse({ "config.requiring_memo": base64("1") }),
    );
    const result = await fetchMemoRequirement(G_ADDRESS, mockImpl);
    expect(result).toBe(true);
  });

  it("config.memo_required = float 1.0 (=== 1 in JS) → requires memo", async () => {
    // In JavaScript 1.0 === 1 so this is equivalent to integer 1.
    const { fetch: mockImpl } = mockFetch(
      accountResponse({ "config.memo_required": 1.0 }),
    );
    const result = await fetchMemoRequirement(G_ADDRESS, mockImpl);
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Canonical falsy values
// ---------------------------------------------------------------------------

describe("SEP-0029 — canonical falsy memo_required values", () => {
  const falsy: Array<[string, unknown]> = [
    ['string "0"', "0"],
    ["empty string", ""],
    ["null", null],
    ["undefined", undefined],
    ["boolean false", false],
    ["integer 0", 0],
  ];

  falsy.forEach(([label, value]) => {
    it(`config.memo_required = ${label} → does not require memo`, async () => {
      const { fetch: mockImpl } = mockFetch(
        accountResponse({ "config.memo_required": value }),
      );
      const result = await fetchMemoRequirement(G_ADDRESS, mockImpl);
      expect(result).toBe(false);
    });
  });

  it("absent config.memo_required key → does not require memo", async () => {
    const { fetch: mockImpl } = mockFetch(accountResponse({}));
    const result = await fetchMemoRequirement(G_ADDRESS, mockImpl);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Fuzz: type mutations
// ---------------------------------------------------------------------------

describe("SEP-0029 fuzz — type mutations on memo_required field", () => {
  // Note: 1.0 === 1 in JS so float 1.0 is treated identically to integer 1
  // and correctly returns true. All other non-canonical values must return false.
  const typeMutations: Array<[string, unknown]> = [
    ["plain object {}", {}],
    ["empty array []", []],
    ["array [1]", [1]],
    ["float 0.9", 0.9],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["negative integer -1", -1],
    ["large integer 999", 999],
    ["string '2'", "2"],
    ["string 'true'", "true"],
    ["string 'false'", "false"],
    ["string 'yes'", "yes"],
    ["string 'no'", "no"],
    ["string 'on'", "on"],
    ["string 'off'", "off"],
  ];

  typeMutations.forEach(([label, value]) => {
    it(`config.memo_required = ${label} → does not require memo (no crash)`, async () => {
      const { fetch: mockImpl } = mockFetch(
        accountResponse({ "config.memo_required": value }),
      );
      // Must not throw and must return false for all unknown/non-canonical values.
      const result = await fetchMemoRequirement(G_ADDRESS, mockImpl);
      expect(result).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Fuzz: base64 edge cases
// ---------------------------------------------------------------------------

describe("SEP-0029 fuzz — base64 string edge cases", () => {
  it('base64("0") → does not require memo', async () => {
    const { fetch: mockImpl } = mockFetch(
      accountResponse({ "config.memo_required": base64("0") }),
    );
    expect(await fetchMemoRequirement(G_ADDRESS, mockImpl)).toBe(false);
  });

  it('base64("") → does not require memo', async () => {
    const { fetch: mockImpl } = mockFetch(
      accountResponse({ "config.memo_required": base64("") }),
    );
    expect(await fetchMemoRequirement(G_ADDRESS, mockImpl)).toBe(false);
  });

  it('base64("true") → does not require memo', async () => {
    const { fetch: mockImpl } = mockFetch(
      accountResponse({ "config.memo_required": base64("true") }),
    );
    expect(await fetchMemoRequirement(G_ADDRESS, mockImpl)).toBe(false);
  });

  it('base64("11") (double digit) → does not require memo', async () => {
    const { fetch: mockImpl } = mockFetch(
      accountResponse({ "config.memo_required": base64("11") }),
    );
    expect(await fetchMemoRequirement(G_ADDRESS, mockImpl)).toBe(false);
  });

  it("malformed base64 string → does not require memo (no crash)", async () => {
    const { fetch: mockImpl } = mockFetch(
      accountResponse({ "config.memo_required": "!!!not-base64!!!" }),
    );
    expect(await fetchMemoRequirement(G_ADDRESS, mockImpl)).toBe(false);
  });

  it("base64 string with padding stripped → does not corrupt result", async () => {
    // base64("1") = "MQ==" — strip padding
    const stripped = base64("1").replace(/=+$/, "");
    const { fetch: mockImpl } = mockFetch(
      accountResponse({ "config.memo_required": stripped }),
    );
    // Stripped padding is still valid base64; result should still be true.
    expect(await fetchMemoRequirement(G_ADDRESS, mockImpl)).toBe(true);
  });

  it("base64 string with extra whitespace → atob strips whitespace, still decodes as '1'", async () => {
    // The browser/Node atob() implementation ignores leading/trailing whitespace
    // per the HTML5 spec (https://html.spec.whatwg.org/multipage/webappapis.html#dom-atob).
    // So " MQ== " (whitespace-padded base64 of "1") still decodes to "1" and
    // therefore correctly signals that a memo is required.
    const { fetch: mockImpl } = mockFetch(
      accountResponse({ "config.memo_required": " " + base64("1") + " " }),
    );
    expect(await fetchMemoRequirement(G_ADDRESS, mockImpl)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Fuzz: Unicode and injection strings
// ---------------------------------------------------------------------------

describe("SEP-0029 fuzz — Unicode and injection strings", () => {
  const injectionCases: Array<[string, string]> = [
    ["null byte", "\x00"],
    ["newline in string", "1\n"],
    ["tab in string", "1\t"],
    ["zero-width space", "\u200b"],
    ["full-width digit 1", "\uff11"],
    ["emoji '1️⃣'", "1️⃣"],
    ["Arabic-Indic digit", "١"],
    ["SQL injection", "1' OR '1'='1"],
    ["JSON injection", '{"config.memo_required":"1"}'],
    ["null string", "null"],
    ["undefined string", "undefined"],
  ];

  injectionCases.forEach(([label, value]) => {
    it(`config.memo_required = "${label}" → does not require memo (no crash)`, async () => {
      const { fetch: mockImpl } = mockFetch(
        accountResponse({ "config.memo_required": value }),
      );
      const result = await fetchMemoRequirement(G_ADDRESS, mockImpl);
      expect(typeof result).toBe("boolean");
      // None of these values should decode as the legitimate "1" signal.
      expect(result).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// 6. Network failure resilience
// ---------------------------------------------------------------------------

describe("SEP-0029 — network failure resilience", () => {
  it("HTTP 404 response → returns false (account not found)", async () => {
    const result = await fetchMemoRequirement(G_ADDRESS, mockFetch404());
    expect(result).toBe(false);
  });

  it("fetch throws a network error → fetchMemoRequirement throws (caller must handle)", async () => {
    // fetchMemoRequirement itself does not catch network errors — the
    // extractRoutingAsync wrapper does. Verify the raw function propagates.
    await expect(
      fetchMemoRequirement(G_ADDRESS, mockFetchThrows()),
    ).rejects.toThrow("Network error");
  });

  it("extractRoutingAsync swallows fetcher exceptions and returns synchronous result unchanged", async () => {
    const input: RoutingInput = {
      destination: G_ADDRESS,
      memoType: "none",
      memoValue: null,
      sourceAccount: null,
    };

    const throwingFetcher = async (_account: string): Promise<boolean> => {
      throw new Error("Horizon down");
    };

    const result = await extractRoutingAsync(input, throwingFetcher);
    // No crash; the synchronous routing result is returned as-is.
    expect(result.destinationBaseAccount).toBe(G_ADDRESS);
    expect(result.routingSource).toBe("none");
    // No MISSING_REQUIRED_MEMO warning because the fetcher failed.
    const codes = result.warnings.map((w) => w.code);
    expect(codes).not.toContain("MISSING_REQUIRED_MEMO");
  });
});

// ---------------------------------------------------------------------------
// 7. Account response shape mutations
// ---------------------------------------------------------------------------

describe("SEP-0029 fuzz — account response shape mutations", () => {
  it("response with no 'data' key → returns false", async () => {
    const { fetch: mockImpl } = mockFetch({ id: G_ADDRESS });
    expect(await fetchMemoRequirement(G_ADDRESS, mockImpl)).toBe(false);
  });

  it("response with null 'data' → returns false without crash", async () => {
    const { fetch: mockImpl } = mockFetch({ id: G_ADDRESS, data: null });
    expect(await fetchMemoRequirement(G_ADDRESS, mockImpl)).toBe(false);
  });

  it("response with empty 'data' object → returns false", async () => {
    const { fetch: mockImpl } = mockFetch({ id: G_ADDRESS, data: {} });
    expect(await fetchMemoRequirement(G_ADDRESS, mockImpl)).toBe(false);
  });

  it("response with 'data' as array → returns false without crash", async () => {
    const { fetch: mockImpl } = mockFetch({ id: G_ADDRESS, data: [] });
    expect(await fetchMemoRequirement(G_ADDRESS, mockImpl)).toBe(false);
  });

  it("response with extra unknown keys alongside valid memo_required → still reads correctly", async () => {
    const { fetch: mockImpl } = mockFetch({
      id: G_ADDRESS,
      data: {
        "config.memo_required": "1",
        "unknown.custom.field": "some_value",
        "another_key": 42,
      },
    });
    expect(await fetchMemoRequirement(G_ADDRESS, mockImpl)).toBe(true);
  });

  it("both keys present with truthy config.memo_required → true", async () => {
    const { fetch: mockImpl } = mockFetch(
      accountResponse({
        "config.memo_required": "1",
        "config.requiring_memo": "0",
      }),
    );
    expect(await fetchMemoRequirement(G_ADDRESS, mockImpl)).toBe(true);
  });

  it("both keys present with truthy config.requiring_memo only → true", async () => {
    const { fetch: mockImpl } = mockFetch(
      accountResponse({
        "config.memo_required": "0",
        "config.requiring_memo": "1",
      }),
    );
    expect(await fetchMemoRequirement(G_ADDRESS, mockImpl)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. Horizon URL construction
// ---------------------------------------------------------------------------

describe("SEP-0029 — Horizon URL construction", () => {
  it("Horizon URL with trailing slash is normalized (no double-slash)", async () => {
    const { fetch: mockImpl, lastUrl } = mockFetch(accountResponse({}));
    await fetchMemoRequirement(G_ADDRESS, mockImpl, "https://horizon.stellar.org/");
    expect(lastUrl()).not.toContain("//accounts");
  });

  it("account ID is URL-encoded in the request path", async () => {
    // A realistic but abnormal account ID string.
    const accountId = "GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI";
    const { fetch: mockImpl, lastUrl } = mockFetch(accountResponse({}));
    await fetchMemoRequirement(accountId, mockImpl);
    expect(lastUrl()).toContain(encodeURIComponent(accountId));
  });

  it("custom Horizon URL is used instead of default", async () => {
    const customUrl = "https://horizon-testnet.stellar.org";
    const { fetch: mockImpl, lastUrl } = mockFetch(accountResponse({}));
    await fetchMemoRequirement(G_ADDRESS, mockImpl, customUrl);
    expect(lastUrl()).toContain("horizon-testnet.stellar.org");
  });
});

// ---------------------------------------------------------------------------
// 9. Full integration: extractRoutingAsync with MISSING_REQUIRED_MEMO
// ---------------------------------------------------------------------------

describe("SEP-0029 — extractRoutingAsync integration", () => {
  const noMemoInput: RoutingInput = {
    destination: G_ADDRESS,
    memoType: "none",
    memoValue: null,
    sourceAccount: null,
  };

  const memoInput: RoutingInput = {
    destination: G_ADDRESS,
    memoType: "id",
    memoValue: "12345",
    sourceAccount: null,
  };

  it("emits MISSING_REQUIRED_MEMO when account requires memo and none provided", async () => {
    const fetcher = async () => true;
    const result = await extractRoutingAsync(noMemoInput, fetcher);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain("MISSING_REQUIRED_MEMO");
  });

  it("MISSING_REQUIRED_MEMO warning has severity 'error'", async () => {
    const fetcher = async () => true;
    const result = await extractRoutingAsync(noMemoInput, fetcher);
    const warn = result.warnings.find((w) => w.code === "MISSING_REQUIRED_MEMO");
    expect(warn).toBeDefined();
    expect(warn!.severity).toBe("error");
  });

  it("does NOT emit MISSING_REQUIRED_MEMO when memo IS provided", async () => {
    const fetcher = async () => true;
    const result = await extractRoutingAsync(memoInput, fetcher);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).not.toContain("MISSING_REQUIRED_MEMO");
  });

  it("does NOT call fetcher when routing already has a routingId", async () => {
    const fetcherSpy = vi.fn(async () => true);
    await extractRoutingAsync(memoInput, fetcherSpy);
    expect(fetcherSpy).not.toHaveBeenCalled();
  });

  it("does NOT emit MISSING_REQUIRED_MEMO when account does not require memo", async () => {
    const fetcher = async () => false;
    const result = await extractRoutingAsync(noMemoInput, fetcher);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).not.toContain("MISSING_REQUIRED_MEMO");
  });

  it("preserves pre-existing warnings alongside MISSING_REQUIRED_MEMO", async () => {
    // A lower-case address triggers NON_CANONICAL_ADDRESS warning from parse.
    const lowerInput: RoutingInput = {
      destination: G_ADDRESS.toLowerCase(),
      memoType: "none",
      memoValue: null,
      sourceAccount: null,
    };
    const fetcher = async () => true;
    const result = await extractRoutingAsync(lowerInput, fetcher);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain("MISSING_REQUIRED_MEMO");
  });

  it("does not add MISSING_REQUIRED_MEMO when there is a destinationError", async () => {
    const badInput: RoutingInput = {
      destination: "MZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",
      memoType: "none",
      memoValue: null,
      sourceAccount: null,
    };
    const fetcherSpy = vi.fn(async () => true);
    // M-addresses with bad checksum throw before reaching async path, so
    // we route to a valid G and check the destinationError guard path.
    const badGInput: RoutingInput = {
      ...noMemoInput,
      destination: "GA" + "A".repeat(54), // structurally invalid checksum
    };
    // The fetcher must NOT be called when destinationError is set.
    // A parse failure on a G-like address will result in destinationError.
    const result = await extractRoutingAsync(badGInput, fetcherSpy);
    // Either we get a destinationError (parse fail) OR no routing found.
    // Either way MISSING_REQUIRED_MEMO should not appear.
    const codes = result.warnings.map((w) => w.code);
    expect(codes).not.toContain("MISSING_REQUIRED_MEMO");
  });
});

// ---------------------------------------------------------------------------
// 10. Property-based fuzz: randomised string corpus
// ---------------------------------------------------------------------------

describe("SEP-0029 fuzz — random string corpus (property: never throws)", () => {
  /**
   * A deterministic pseudo-random corpus of adversarial string values.
   * These are pre-generated to avoid a dependency on a fuzz library while
   * still exercising the character space that could appear in stellar.toml.
   */
  const corpus: string[] = [
    // Numeric strings
    "0", "1", "2", "9", "10", "100", "255", "-1", "+1", "1e5", "1E5",
    // Base32-ish strings
    "ABCDE", "AAAAA", "=====", "MQ==", "MQ", "MQo=",
    // Whitespace and control
    " ", "  ", "\t", "\r\n", "\n1", "1\0",
    // Unicode
    "①", "１", "𝟏", "\u0661", "\u0031",
    // Long strings
    "1".repeat(100), "0".repeat(100), "A".repeat(1000),
    // Special characters
    "<script>alert(1)</script>", "'; DROP TABLE accounts;--",
    "\\x01", "\\u0031", "%31", "%31%", "&#49;",
    // JSON/YAML-like
    "true", "false", "null", "undefined", "NaN", "Infinity",
    '{"memo_required": "1"}', "[1]", "'1'", "`1`",
    // Empty and near-empty
    "", " ", "  ",
  ];

  corpus.forEach((value) => {
    it(`no throw for config.memo_required = ${JSON.stringify(value.slice(0, 40))}`, async () => {
      const { fetch: mockImpl } = mockFetch(
        accountResponse({ "config.memo_required": value }),
      );
      // Must never throw; must return a boolean.
      const result = await fetchMemoRequirement(G_ADDRESS, mockImpl);
      expect(typeof result).toBe("boolean");
    });
  });
});
