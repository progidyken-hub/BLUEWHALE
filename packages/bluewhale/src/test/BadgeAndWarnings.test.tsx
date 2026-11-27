import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TypeBadge, isHighRiskWarningCode, WARNING_STYLES } from '../components/TypeBadge';
import { WarningList } from '../components/WarningList';

describe('TypeBadge', () => {
  it('renders nothing for UNKNOWN', () => {
    const { container } = render(<TypeBadge type="UNKNOWN" />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['G', 'Classic', 'rgb(187, 247, 208)', /standard stellar account/i],
    ['M', 'Muxed', 'rgb(191, 219, 254)', /routing ID encoded/i],
    ['C', 'Contract', 'rgb(233, 213, 255)', /smart contract address/i],
  ] as const)('describes the %s address type accessibly', (type, label, backgroundColor, description) => {
    const { getByRole } = render(<TypeBadge type={type} />);
    const badge = getByRole('img', { name: new RegExp(label) });

    expect(badge).toHaveTextContent(label);
    expect(badge.getAttribute('title')).toMatch(description);
    expect((badge as HTMLElement).style.backgroundColor).toBe(backgroundColor);
  });
});

describe('isHighRiskWarningCode', () => {
  it('recognises the styled high-risk codes only', () => {
    for (const code of Object.keys(WARNING_STYLES)) {
      expect(isHighRiskWarningCode(code)).toBe(true);
    }
    expect(isHighRiskWarningCode('NON_CANONICAL_ROUTING_ID')).toBe(false);
    expect(isHighRiskWarningCode(undefined)).toBe(false);
  });
});

describe('WarningList', () => {
  it('renders nothing for an empty list', () => {
    const { container } = render(<WarningList warnings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
