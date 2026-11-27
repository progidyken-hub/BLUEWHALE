import { describe, it, expect } from 'vitest';
import { parse, Warning, AmbiguousNumericMemoWarning } from '../src/index';

describe('parse', () => {
  it('parses a valid address', () => {
    const result = parse('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
    expect(result.address).toBe('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
    expect(result.warnings).toEqual([]);
  });

  it('parses a memo id', () => {
    const result = parse('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', {
      memo: { type: 'id', value: '12345' },
    });
    expect(result.memo).toEqual({ type: 'id', value: '12345' });
    expect(result.warnings).toEqual([]);
  });

  it('parses a non-numeric text memo without warnings', () => {
    const result = parse('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', {
      memo: { type: 'text', value: 'hello' },
    });
    expect(result.memo).toEqual({ type: 'text', value: 'hello' });
    expect(result.warnings).toEqual([]);
  });

  it('warns when a text memo contains only digits', () => {
    const result = parse('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', {
      memo: { type: 'text', value: '12345' },
    });
    expect(result.memo).toEqual({ type: 'text', value: '12345' });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toBeInstanceOf(AmbiguousNumericMemoWarning);
    expect(result.warnings[0]).toBeInstanceOf(Warning);
  });

  it('does not warn for numeric text memo when strict numeric memo is disabled', () => {
    const result = parse('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', {
      memo: { type: 'text', value: '12345' },
      strictNumericMemo: false,
    });
    expect(result.warnings).toEqual([]);
  });

  it('throws when strict numeric memo is enabled and text memo is numeric', () => {
    expect(() =>
      parse('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', {
        memo: { type: 'text', value: '12345' },
        strictNumericMemo: true,
      }),
    ).toThrow(AmbiguousNumericMemoWarning);
  });

  it('does not throw for numeric text memo under strict mode when memo is an id', () => {
    const result = parse('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', {
      memo: { type: 'id', value: '12345' },
      strictNumericMemo: true,
    });
    expect(result.memo).toEqual({ type: 'id', value: '12345' });
    expect(result.warnings).toEqual([]);
  });
});
