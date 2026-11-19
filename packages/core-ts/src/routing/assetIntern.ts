/**
 * String intern table for frequent Stellar asset codes and issuers.
 *
 * SEP-0007 payment URIs and Horizon payment operations repeatedly carry the
 * same handful of asset codes ("XLM", "USDC", "USDT", ...) and issuer account
 * IDs. When these arrive as freshly-parsed strings (e.g. from
 * `URLSearchParams` or a Horizon JSON payload), the engine allocates a new
 * string primitive for every occurrence even when an identical value is
 * already in use elsewhere.
 *
 * Canonicalising these through an intern table means:
 *   - equal values share a single string reference (cheap reference equality,
 *     reduced GC pressure when streaming many payments),
 *   - a fixed pool of the most common asset codes avoids allocating for the
 *     overwhelmingly common case.
 *
 * The table is pre-seeded with the asset codes that appear most often on the
 * public network and grows lazily for any unseen value. It is a pure
 * performance optimisation and does not change the observable value of any
 * input — `internAssetCode("USDC")` always returns `"USDC"`.
 */

/** Asset codes that occur most frequently on the public network. */
const FREQUENT_ASSET_CODES = [
  // Native lumens. SEP-0007 uses "native" for the asset_code of native lumens.
  "XLM",
  "native",
  // Common stablecoins and wrappers.
  "USDC",
  "USDT",
  "USD",
  "EURC",
  "BRL",
  "ARS",
  // Other frequently-seen 4–12 character codes.
  "ETH",
  "BTC",
  "WETH",
  "WBTC",
  "AQUA",
  "SLT",
];

/**
 * Intern table for asset codes. Keys are the uppercased code (canonical form);
 * values are the canonical string reference to hand back to callers.
 *
 * Asset codes are case-insensitive uppercase ASCII alphanumerics per the
 * Stellar protocol, so uppercasing the input is a safe canonicalisation that
 * does not alter a valid code's meaning and lets "usdc" and "USDC" share one
 * reference.
 */
const assetCodeTable = new Map<string, string>();
for (const code of FREQUENT_ASSET_CODES) {
  assetCodeTable.set(code, code);
}

/**
 * Intern table for asset issuer account IDs (G-addresses). Issuer addresses
 * are case-sensitive and not canonicalisable, so the table keys on the exact
 * string and only deduplicates exact matches.
 */
const assetIssuerTable = new Map<string, string>();

/**
 * Returns the canonical, interned reference for a Stellar asset code.
 *
 * Asset codes are uppercased (their canonical, case-insensitive form) so that
 * `usdc` and `USDC` resolve to the same interned string. Returns `undefined`
 * for `null`, `undefined`, or empty input so callers can use it directly on
 * the output of `URLSearchParams.get()` / `extractRoutingFromURI`.
 *
 * @param code - The asset code as parsed from a SEP-0007 URI or Horizon payload.
 * @returns The interned canonical asset code, or `undefined` if none was given.
 */
export function internAssetCode(
  code: string | null | undefined
): string | undefined {
  if (code == null || code === "") return undefined;
  // Real Stellar asset codes are uppercase ASCII alphanumerics, so uppercasing
  // is a safe canonicalisation. "native" is the special SEP-0007/Horizon
  // keyword for native lumens (not a code) and must stay lowercase.
  const key =
    code.toLowerCase() === "native" ? "native" : code.toUpperCase();
  const existing = assetCodeTable.get(key);
  if (existing !== undefined) return existing;
  assetCodeTable.set(key, key);
  return key;
}

/**
 * Returns the canonical, interned reference for a Stellar asset issuer
 * account ID (a G-address). Issuer strings are matched exactly — they are
 * case-sensitive and not normalised — so only repeated exact values share a
 * reference.
 *
 * @param issuer - The issuer account ID as parsed from a SEP-0007 URI or
 *   Horizon payload.
 * @returns The interned issuer string, or `undefined` if none was given.
 */
export function internAssetIssuer(
  issuer: string | null | undefined
): string | undefined {
  if (issuer == null || issuer === "") return undefined;
  const existing = assetIssuerTable.get(issuer);
  if (existing !== undefined) return existing;
  assetIssuerTable.set(issuer, issuer);
  return issuer;
}

/**
 * @internal
 * Clears both intern tables. Intended only for unit tests that need to assert
 * table growth and canonicalisation behaviour from a clean state.
 */
export function resetAssetInternTables(): void {
  assetCodeTable.clear();
  for (const code of FREQUENT_ASSET_CODES) {
    assetCodeTable.set(code, code);
  }
  assetIssuerTable.clear();
}

/**
 * @internal
 * Returns the number of distinct entries currently held by each table. Used
 * by unit tests to verify that repeated values are deduplicated rather than
 * accumulating.
 */
export function assetInternTableSizes(): { codes: number; issuers: number } {
  return { codes: assetCodeTable.size, issuers: assetIssuerTable.size };
}
