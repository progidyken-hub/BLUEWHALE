import { Warning } from "../address/types";

export type NormalizeResult = {
  normalized: string | null;
  warnings: Warning[];
};

/**
 * Maximum value for a 64-bit unsigned integer (uint64).
 */
const UINT64_MAX = BigInt("18446744073709551615");

/**
 * Normalizes a numeric string into a canonical uint64 representation.
 * Strips leading zeros and validates that the value is within uint64 boundaries.
 *
 * Cross-SDK contract (identical in Go `NormalizeMemoTextID` and Dart
 * `normalizeMemoTextId`, enforced by `spec/memo_text_normalization.json`):
 * - The input is never trimmed. Surrounding or embedded whitespace
 *   (e.g. `" 123 "`) makes the memo unroutable: `normalized` is null and no
 *   warning is emitted.
 * - Only ASCII digits `0-9` are accepted (no sign, exponent, separators or
 *   non-ASCII digits).
 * - Leading zeros (e.g. `"00123"`) are stripped to the canonical form
 *   (`"123"`, or `"0"` for all zeros) and a single `NON_CANONICAL_ROUTING_ID`
 *   warning is emitted with `normalization.original` set to the raw input and
 *   `normalization.normalized` set to the stripped value.
 * - Values above uint64 max are unroutable; any leading-zero warning is kept.
 *

 * @param s - The numeric string to normalize.
 * @returns Result containing the normalized string (or null if invalid) and any warnings.
 */
export function normalizeMemoTextId(s: string): NormalizeResult {
  const warnings: Warning[] = [];

  if (s.length === 0 || !/^\d+$/.test(s)) {
    return { normalized: null, warnings };
  }

  let normalized = s.replace(/^0+/, "");
  if (normalized === "") {
    normalized = "0";
  }

  if (normalized !== s) {
    warnings.push({
      code: "NON_CANONICAL_ROUTING_ID",
      severity: "warn",
      message:
        "Memo routing ID had leading zeros. Normalized to canonical decimal.",
      normalization: { original: s, normalized },
    });
  }

  // Validate that normalized contains only decimal digits before BigInt conversion
  if (!/^\d+$/.test(normalized)) {
    return { normalized: null, warnings };
  }

  try {
    const val = BigInt(normalized);
    if (val > UINT64_MAX) {
      return { normalized: null, warnings };
    }
  } catch {
    return { normalized: null, warnings };
  }

  return { normalized, warnings };
}
