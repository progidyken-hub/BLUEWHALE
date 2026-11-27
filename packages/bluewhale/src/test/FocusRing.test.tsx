import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  FOCUS_RING,
  FOCUS_RING_ADJACENT_COLORS,
  FOCUS_RING_SELECTORS,
  contrastRatio,
  focusRingCss,
} from '../styles/focusRing';

describe('contrastRatio', () => {
  it('matches known WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });
});

describe('focus ring – contrast (WCAG 1.4.11 / 2.4.13)', () => {
  it.each(Object.entries(FOCUS_RING_ADJACENT_COLORS))(
    'ring colour has at least 3:1 contrast against %s',
    (_name, color) => {
      expect(contrastRatio(FOCUS_RING.color, color)).toBeGreaterThanOrEqual(3);
    },
  );

  it('the white halo has at least 3:1 contrast against the ring', () => {
    expect(contrastRatio(FOCUS_RING.haloColor, FOCUS_RING.color)).toBeGreaterThanOrEqual(3);
  });
});

describe('focus ring – not colour alone', () => {
  it('is thicker than the 1px resting border and drawn outside the control', () => {
    expect(parseFloat(FOCUS_RING.width)).toBeGreaterThanOrEqual(2);
    expect(parseFloat(FOCUS_RING.offset)).toBeGreaterThan(0);
  });
});

describe('focusRingCss', () => {
  const css = focusRingCss();

  it('targets :focus-visible on every deposit-form control', () => {
    for (const selector of FOCUS_RING_SELECTORS) {
      expect(css).toContain(`${selector}:focus-visible`);
    }
  });

  it('overrides inline `outline: none` defaults', () => {
    expect(css).toMatch(/outline: 3px solid #1d4ed8 !important;/);
  });

  it('supports forced-colors mode', () => {
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('Highlight');
  });

  it('stays visually stable (regression snapshot)', () => {
    expect(css).toMatchSnapshot();
  });
});

describe('AddressInput', () => {
  const source = readFileSync(resolve(__dirname, '../AddressInput.tsx'), 'utf8');

  it('does not suppress the native focus outline inline', () => {
    expect(source).not.toMatch(/outline:\s*'none'/);
  });

  it('renders the focus-ring stylesheet', () => {
    expect(source).toContain('focusRingCss()');
    expect(source).toContain('{FOCUS_RING_CSS}');
  });
});
