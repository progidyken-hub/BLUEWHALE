/**
 * String intern table for frequent Stellar asset codes and issuer addresses.
 *
 * In a high-throughput payment stream the same short strings — "XLM", "USDC",
 * "EURC", and their issuer G-addresses — appear in thousands of consecutive
 * operations. Each new call to `extractRoutingFromURI` or any asset-aware
 * downstream code would otherwise allocate a fresh string object for every
 * occurrence even though the value is identical.
 *
 * `internAssetString` returns the *same* string reference for equal inputs,
 * so the engine can share one heap object instead of creating duplicates.
 * The table is bounded to `MAX_ENTRIES` to prevent unbounded growth when
 * callers pass arbitrary user-supplied values.
 *
 * Usage:
 * ```ts
 * import { internAssetString } from "./intern";
 * const code   = internAssetString(params.get("asset_code")   ?? "");
 * const issuer = internAssetString(params.get("asset_issuer") ?? "");
 * ```
 */

/** Maximum number of distinct entries kept in the intern table. */
const MAX_ENTRIES = 512;

/**
 * Insertion-ordered map of interned strings. When the table reaches
 * MAX_ENTRIES the oldest quarter of entries is evicted so the table
 * stays bounded without a full clear that would defeat the purpose.
 */
const _table = new Map<string, string>();

/**
 * Returns an interned reference for `value`. Subsequent calls with
 * an equal string return the exact same string reference from the
 * table, eliminating duplicate heap allocations for repeated asset
 * codes and issuer addresses.
 *
 * Empty strings are returned as-is without being stored.
 *
 * @param value - A Stellar asset code (e.g. "XLM", "USDC") or issuer
 *   address (G-address) to intern.
 * @returns The canonical interned string reference.
 */
export function internAssetString(value: string): string {
  if (value === "") return value;

  const cached = _table.get(value);
  if (cached !== undefined) return cached;

  // Evict oldest quarter when the table is full.
  if (_table.size >= MAX_ENTRIES) {
    const evictCount = MAX_ENTRIES >> 2; // integer divide by 4
    let count = 0;
    for (const key of _table.keys()) {
      _table.delete(key);
      if (++count >= evictCount) break;
    }
  }

  _table.set(value, value);
  return value;
}

/**
 * Returns the current number of entries in the intern table.
 * Primarily useful in tests to verify eviction behaviour.
 */
export function internTableSize(): number {
  return _table.size;
}

/**
 * Clears all entries from the intern table.
 * Call this in test tear-downs to avoid cross-test state leakage.
 */
export function clearInternTable(): void {
  _table.clear();
}
