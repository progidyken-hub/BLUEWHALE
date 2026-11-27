/**
 * Warning flags surfaced by the core-ts parser.
 *
 * Warnings are non-fatal: parsing still succeeds, but callers can inspect
 * `result.warnings` to detect suspicious input (e.g. a numeric MEMO_TEXT that
 * was probably meant to be a MEMO_ID).
 */

/**
 * Emitted when a MEMO_TEXT memo contains only digits.
 *
 * A numeric string such as `"12345"` is a common mistake: the user likely
 * intended a MEMO_ID. Callers can either surface this to the user or, when
 * strict validation is enabled, reject the transaction outright.
 */
export const AmbiguousNumericMemoWarning = 'AmbiguousNumericMemoWarning' as const;

export type WarningFlag = typeof AmbiguousNumericMemoWarning;

/**
 * Options controlling strict validation behaviour.
 */
export interface StrictValidationOptions {
  /**
   * When `true`, a MEMO_TEXT consisting solely of digits is rejected instead
   * of merely producing an {@link AmbiguousNumericMemoWarning}.
   *
   * Defaults to `false`.
   */
  disallowNumericTextMemo?: boolean;
}

/**
 * Returns `true` when `memoText` is non-empty and contains only ASCII digits.
 */
export function isNumericMemoText(memoText: string): boolean {
  return memoText.length > 0 && /^[0-9]+$/.test(memoText);
}

/**
 * Collects warning flags for a parsed memo.
 *
 * @param memoText The decoded MEMO_TEXT value, if any.
 * @param options Strict validation options.
 * @returns The list of warning flags (empty when nothing is suspicious).
 * @throws {Error} When `disallowNumericTextMemo` is enabled and the memo text
 *   is numeric.
 */
export function collectMemoWarnings(
  memoText: string | undefined,
  options: StrictValidationOptions = {},
): WarningFlag[] {
  if (memoText === undefined || !isNumericMemoText(memoText)) {
    return [];
  }

  if (options.disallowNumericTextMemo) {
    throw new Error(
      'MEMO_TEXT contains only digits; use MEMO_ID instead or disable strict validation',
    );
  }

  return [AmbiguousNumericMemoWarning];
}
