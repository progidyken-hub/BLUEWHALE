/**
 * Ladle stories for MemoConflictWarning.
 *
 * Run:  npm run ladle
 */
import React, { useState } from 'react';
import type { Story } from '@ladle/react';
import { MemoConflictWarning } from '../MemoConflictWarning';

const M_ADDRESS = 'MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQACAAAAAAAAAAAPMATE';
const G_ADDRESS = 'GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI';

const frame: React.CSSProperties = { maxWidth: '32rem', padding: '1rem', fontFamily: 'sans-serif' };

// ─── Conflict with one-click conversion ───────────────────────────────────────

export const ConflictInteractive: Story = () => {
  const [address, setAddress] = useState(M_ADDRESS);
  const [memo, setMemo] = useState('98765');
  return (
    <div style={frame}>
      <label style={{ display: 'block', fontSize: '0.875rem' }}>
        Address
        <input value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: '100%' }} />
      </label>
      <label style={{ display: 'block', fontSize: '0.875rem', marginTop: '0.5rem' }}>
        Memo
        <input value={memo} onChange={(e) => setMemo(e.target.value)} style={{ width: '100%' }} />
      </label>
      <MemoConflictWarning address={address} memo={memo} onConvert={(g) => setAddress(g)} />
    </div>
  );
};
ConflictInteractive.storyName = 'Conflict – interactive convert';

// ─── Static warning states ────────────────────────────────────────────────────

export const ConflictWithConvert: Story = () => (
  <div style={frame}>
    <MemoConflictWarning address={M_ADDRESS} memo="98765" onConvert={() => {}} />
  </div>
);
ConflictWithConvert.storyName = 'Conflict – with convert button';

export const ConflictWarningOnly: Story = () => (
  <div style={frame}>
    <MemoConflictWarning address={M_ADDRESS} memo="98765" />
  </div>
);
ConflictWarningOnly.storyName = 'Conflict – warning only (no onConvert)';

export const ConflictUndecodable: Story = () => (
  <div style={frame}>
    <MemoConflictWarning address="MINVALIDADDRESS" memo="98765" onConvert={() => {}} />
  </div>
);
ConflictUndecodable.storyName = 'Conflict – undecodable M-address';

export const NoConflictGAddress: Story = () => (
  <div style={frame}>
    <MemoConflictWarning address={G_ADDRESS} memo="98765" onConvert={() => {}} />
    <em style={{ color: '#64748b' }}>G-address with memo — nothing rendered above.</em>
  </div>
);
NoConflictGAddress.storyName = 'No conflict – G-address + memo';

export const NoConflictEmptyMemo: Story = () => (
  <div style={frame}>
    <MemoConflictWarning address={M_ADDRESS} memo="   " onConvert={() => {}} />
    <em style={{ color: '#64748b' }}>M-address with blank memo — nothing rendered above.</em>
  </div>
);
NoConflictEmptyMemo.storyName = 'No conflict – M-address, empty memo';
