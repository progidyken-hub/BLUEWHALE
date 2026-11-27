import { describe, it, expect } from 'vitest';
import { validateMemoText, MEMO_TEXT_MAX_BYTES } from './memo';

describe('MEMO_TEXT UTF-8 byte length validation', () => {
  it('accepts ASCII text within the 28-byte limit', () => {
    expect(validateMemoText('hello world')).toEqual({ valid: true });
  });

  it('accepts exactly 28 ASCII bytes', () => {
    const memo = 'a'.repeat(MEMO_TEXT_MAX_BYTES);
    expect(validateMemoText(memo)).toEqual({ valid: true });
  });

  it('rejects ASCII text exceeding 28 bytes', () => {
    const memo = 'a'.repeat(MEMO_TEXT_MAX_BYTES + 1);
    const result = validateMemoText(memo);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain(`${MEMO_TEXT_MAX_BYTES + 1} bytes`);
      expect(result.error).toContain(`${MEMO_TEXT_MAX_BYTES + 1} characters`);
    }
  });

  it('accepts a multi-byte emoji string of exactly 28 bytes', () => {
    // Each emoji is 4 UTF-8 bytes; 7 emoji = 28 bytes, 7 characters.
    const memo = '\u{1F600}'.repeat(7);
    expect(new TextEncoder().encode(memo).length).toBe(28);
    expect(validateMemoText(memo)).toEqual({ valid: true });
  });

  it('rejects a multi-byte emoji string exceeding 28 bytes', () => {
    // 8 emoji = 32 bytes but only 8 characters.
    const memo = '\u{1F600}'.repeat(8);
    const byteLength = new TextEncoder().encode(memo).length;
    expect(byteLength).toBe(32);
    const result = validateMemoText(memo);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('32 bytes');
      expect(result.error).toContain('8 characters');
    }
  });

  it('rejects a 28-character string that exceeds 28 bytes', () => {
    // 28 characters but 56 bytes.
    const memo = '\u00e9'.repeat(28);
    expect(memo.length).toBe(28);
    expect(new TextEncoder().encode(memo).length).toBe(56);
    const result = validateMemoText(memo);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('56 bytes');
      expect(result.error).toContain('28 characters');
    }
  });
});
