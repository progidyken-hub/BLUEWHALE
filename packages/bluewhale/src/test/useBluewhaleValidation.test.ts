import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useBluewhaleValidation } from '../hooks/useBluewhaleValidation';

describe('useBluewhaleValidation', () => {
  it('accepts valid G and M destination addresses', () => {
    const { result } = renderHook(() => useBluewhaleValidation());

    expect(result.current('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H')).toBe(true);
    expect(result.current('MBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OAAAAAAAAAAAPOGVY')).toBe(true);
  });

  it('allows blank values for the separate required rule', () => {
    const { result } = renderHook(() => useBluewhaleValidation());

    expect(result.current('  ')).toBe(true);
  });

  it('returns an error for malformed and contract addresses', () => {
    const { result } = renderHook(() => useBluewhaleValidation());

    expect(result.current('Gnot-an-address')).toMatch(/valid stellar/i);
    expect(result.current('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4')).toMatch(/valid stellar/i);
  });

  it('supports a custom error message', () => {
    const { result } = renderHook(() => useBluewhaleValidation('Invalid destination'));

    expect(result.current('Gnot-an-address')).toBe('Invalid destination');
  });
});
