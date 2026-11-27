/**
 * Ladle stories for the deposit-form focus ring.
 *
 * Run:  npm run ladle
 *
 * "Focus ring – forced" draws the focused state with static styles from the
 * same FOCUS_RING tokens, so visual-regression screenshots are stable
 * without simulating keyboard input. "Focus ring – keyboard" uses the real
 * :focus-visible rules: Tab through the controls to check them.
 */
import React, { CSSProperties } from 'react';
import type { Story } from '@ladle/react';
import { FOCUS_RING, focusRingCss } from '../styles/focusRing';

const frame: CSSProperties = {
  maxWidth: '32rem',
  padding: '1.5rem',
  fontFamily: 'sans-serif',
  display: 'grid',
  gap: '1.25rem',
};

const inputBase: CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: '0.5rem',
  fontSize: '1rem',
  boxSizing: 'border-box',
  outline: 'none',
};

const forcedFocus: CSSProperties = {
  outline: `${FOCUS_RING.width} solid ${FOCUS_RING.color}`,
  outlineOffset: FOCUS_RING.offset,
  boxShadow: `0 0 0 ${FOCUS_RING.offset} ${FOCUS_RING.haloColor}`,
};

const caption: CSSProperties = { fontSize: '0.8125rem', color: '#475569', marginBottom: '0.35rem' };

export const FocusRingForced: Story = () => (
  <div style={frame}>
    <div>
      <div style={caption}>Resting</div>
      <input readOnly aria-label="Resting address" value="GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI" style={inputBase} />
    </div>
    <div>
      <div style={caption}>Keyboard focus (light background)</div>
      <input readOnly aria-label="Focused address" value="GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI" style={{ ...inputBase, ...forcedFocus }} />
    </div>
    <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem' }}>
      <div style={{ ...caption, color: '#cbd5e1' }}>Keyboard focus (dark background)</div>
      <input readOnly aria-label="Focused address on dark" value="MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQACAAAAAAAAAAAPMATE" style={{ ...inputBase, ...forcedFocus }} />
    </div>
  </div>
);
FocusRingForced.storyName = 'Focus ring – forced (visual regression)';

export const FocusRingKeyboard: Story = () => (
  <div style={frame}>
    <style>{focusRingCss()}</style>
    <p style={{ margin: 0, color: '#475569' }}>Press Tab to move focus through the deposit form controls.</p>
    <input className="bw-address-input__input" aria-label="Stellar address" placeholder="Paste Stellar address" style={inputBase} />
    <input className="bw-memo-field__input" aria-label="Memo" placeholder="Enter memo here" style={inputBase} />
    <button type="button" className="bw-copy-button" style={{ padding: '0.4rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem', background: '#f8fafc', outline: 'none' }}>
      Copy
    </button>
  </div>
);
FocusRingKeyboard.storyName = 'Focus ring – keyboard';
