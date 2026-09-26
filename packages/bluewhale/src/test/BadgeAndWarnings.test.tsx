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
