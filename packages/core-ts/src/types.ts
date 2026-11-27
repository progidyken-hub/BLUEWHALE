export type MemoType = 'MEMO_NONE' | 'MEMO_TEXT' | 'MEMO_ID' | 'MEMO_HASH' | 'MEMO_RETURN';

export interface Memo {
  type: MemoType;
  value?: string;
}

export interface ParseOptions {
  /**
   * When true, reject MEMO_TEXT values that consist only of digits, since
   * they are likely a MEMO_ID submitted by mistake.
   */
  disallowNumericTextMemo?: boolean;
}

export interface Warning {
  code: string;
  message: string;
}

export interface ParsedResult {
  memo?: Memo;
  warnings: Warning[];
}
