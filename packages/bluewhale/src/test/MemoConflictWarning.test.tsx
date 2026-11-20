import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoConflictWarning, hasMemoConflict } from '../MemoConflictWarning';
import { decodeMuxedAddress } from '../utils/strkey';

// Reference vectors generated with @stellar/stellar-sdk MuxedAccount.
const G = 'GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI';
const M_0 = 'MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQACAAAAAAAAAAAAD672';
const M_123 = 'MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQACAAAAAAAAAAAPMATE';
const M_MAX = 'MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQAD7777777777774OFW';

describe('decodeMuxedAddress', () => {
  it.each([
    [M_0, '0'],
    [M_123, '123'],
    [M_MAX, '18446744073709551615'],
  ])('decodes %s to its base G-address and id', (m, id) => {
    expect(decodeMuxedAddress(m)).toEqual({ baseAccount: G, id });
  });

  it('accepts lowercase input', () => {
    expect(decodeMuxedAddress(M_123.toLowerCase())?.baseAccount).toBe(G);
  });

  it('rejects a bad checksum', () => {
    const tampered = M_123.slice(0, -1) + (M_123.endsWith('E') ? 'F' : 'E');
    expect(decodeMuxedAddress(tampered)).toBeNull();
  });

  it('rejects G-addresses and garbage', () => {
    expect(decodeMuxedAddress(G)).toBeNull();
    expect(decodeMuxedAddress('M')).toBeNull();
    expect(decodeMuxedAddress('M!!!')).toBeNull();
    expect(decodeMuxedAddress('')).toBeNull();
  });
});

describe('hasMemoConflict', () => {
  it('is true only for an M-address with a non-blank memo', () => {
    expect(hasMemoConflict(M_123, '42')).toBe(true);
    expect(hasMemoConflict(M_123, '   ')).toBe(false);
    expect(hasMemoConflict(M_123, '')).toBe(false);
    expect(hasMemoConflict(G, '42')).toBe(false);
  });
});

describe('MemoConflictWarning', () => {
  it('renders nothing without a conflict', () => {
    const { container } = render(<MemoConflictWarning address={G} memo="42" onConvert={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an M-address with an empty memo', () => {
    const { container } = render(<MemoConflictWarning address={M_123} memo="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a prominent alert with the embedded id and the memo', () => {
    render(<MemoConflictWarning address={M_123} memo="98765" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/risk of lost funds/i);
    expect(alert).toHaveTextContent('123');
    expect(alert).toHaveTextContent('98765');
  });

  it('hides the convert button when onConvert is not provided', () => {
    render(<MemoConflictWarning address={M_123} memo="98765" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('converts to the standard G-address in one click', async () => {
    const onConvert = vi.fn();
    render(<MemoConflictWarning address={M_123} memo="98765" onConvert={onConvert} />);

    await userEvent.click(screen.getByRole('button', { name: /convert to standard g-address/i }));

    expect(onConvert).toHaveBeenCalledTimes(1);
    expect(onConvert).toHaveBeenCalledWith(G, '123');
  });

  it('keeps the warning but explains why an undecodable M-address cannot be converted', () => {
    render(<MemoConflictWarning address="MBROKEN" memo="98765" onConvert={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be decoded/i);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
