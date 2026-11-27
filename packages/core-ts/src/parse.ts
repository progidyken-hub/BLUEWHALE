import { StrKey } from "./strkey";
import { MemoType, Memo, MemoText, MemoId, MemoHash, MemoReturn } from "./memo";
import { Asset } from "./asset";
import { AmbiguousNumericMemoWarning } from "./warnings";

export interface ParseOptions {
  /**
   * When true, MEMO_TEXT values that contain only digits are rejected with an
   * error instead of merely emitting an AmbiguousNumericMemoWarning. This
   * guards against users accidentally submitting a numeric string as
   * MEMO_TEXT when they meant MEMO_ID.
   */
  disallowNumericTextMemo?: boolean;
}

export interface ParsedMemo {
  memo: Memo;
  warnings: AmbiguousNumericMemoWarning[];
}

function isAllDigits(value: string): boolean {
  return value.length > 0 && /^[0-9]+$/.test(value);
}

/**
 * Parse a raw memo type/value pair, surfacing an AmbiguousNumericMemoWarning
 * when a MEMO_TEXT value is purely numeric (and optionally rejecting it when
 * strict validation is enabled via options).
 */
export function parseMemo(
  type: MemoType,
  value: string,
  options: ParseOptions = {},
): ParsedMemo {
  const warnings: AmbiguousNumericMemoWarning[] = [];

  if (type === MemoType.MEMO_TEXT && isAllDigits(value)) {
    if (options.disallowNumericTextMemo) {
      throw new Error(
        `MEMO_TEXT value "${value}" is purely numeric; use MEMO_ID if an id was intended`,
      );
    }
    warnings.push(new AmbiguousNumericMemoWarning(value));
  }

  let memo: Memo;
  switch (type) {
    case MemoType.MEMO_TEXT:
      memo = MemoText.fromString(value);
      break;
    case MemoType.MEMO_ID:
      memo = MemoId.fromString(value);
      break;
    case MemoType.MEMO_HASH:
      memo = MemoHash.fromString(value);
      break;
    case MemoType.MEMO_RETURN:
      memo = MemoReturn.fromString(value);
      break;
    default:
      memo = Memo.none();
  }

  return { memo, warnings };
}

export { StrKey, Asset };
