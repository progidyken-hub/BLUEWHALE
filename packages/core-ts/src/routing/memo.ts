import { Warning } from "../address/types";
import { DIGITS_ONLY, LEADING_ZEROS } from "../patterns";

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
 * @param s - The numeric string to normalize.
 * @returns Result containing the normalized string (or null if invalid) and any warnings.
 */
export function normalizeMemoTextId(s: string): NormalizeResult {
  const warnings: Warning[] = [];

  if (s.length === 0 || !DIGITS_ONLY.test(s)) {
    return { normalized: null, warnings };
  }

  let normalized = s.replace(LEADING_ZEROS, "");
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
  // Unreachable today (`s` was checked above and only zeros were stripped);
  // kept as a guard in case that check changes. Excluded from coverage.
  /* v8 ignore next 3 */
  if (!DIGITS_ONLY.test(normalized)) {
    return { normalized: null, warnings };
  }

  try {
    const val = BigInt(normalized);
    if (val > UINT64_MAX) {
      return { normalized: null, warnings };
    }
    /* v8 ignore start */
  } catch {
    // BigInt() cannot throw on a digits-only string.
    return { normalized: null, warnings };
  }
  /* v8 ignore stop */

  return { normalized, warnings };
}

/** ASCII whitespace per spec/README.md rule 5: space, tab, LF, CR. */
const ASCII_WHITESPACE_ONLY = /^[ \t\n\r]*$/;

/**
 * Reports whether a MEMO_TEXT value carries no content: `null`, `undefined`,
 * `""`, or only ASCII whitespace (space, tab, LF, CR).
 *
 * Non-ASCII whitespace such as U+00A0 is content, not blank, so it is still
 * reported as an unroutable MEMO_TEXT. Shared with core-go
 * (`routing.IsBlankMemoText`) and core-dart (`isBlankMemoText`).
 */
export function isBlankMemoText(value: string | null | undefined): boolean {
  return value === null || value === undefined || ASCII_WHITESPACE_ONLY.test(value);
}

/**
 * Resolves the memo type routing actually acts on. A blank MEMO_TEXT (see
 * {@link isBlankMemoText}) is the same as no memo, so it resolves to
 * `"none"`: no routing ID and no memo warnings, for G and M destinations
 * alike. Every other memo type is returned unchanged.
 *
 * Normative cases live in spec/vectors/empty-memos.json.
 */
export function effectiveMemoType(
  memoType: string,
  memoValue: string | null | undefined
): string {
  return memoType === "text" && isBlankMemoText(memoValue) ? "none" : memoType;
}
