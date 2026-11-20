import React, { CSSProperties } from 'react';
import { decodeMuxedAddress } from './utils/strkey';

export interface MemoConflictWarningProps {
  /** The destination address currently entered by the user. */
  address: string;
  /** The memo currently entered by the user. */
  memo: string;
  /**
   * Called when the user clicks "Convert to standard G-address".
   * Receives the base `G...` account and the muxed ID that the M-address
   * carried, so the caller can replace the address (and keep or drop the memo).
   * When omitted, the convert button is not rendered.
   */
  onConvert?: (baseAccount: string, muxedId: string) => void;
  /** Additional CSS class names merged onto the root element. */
  className?: string;
  /** Inline styles applied to the root element. */
  style?: CSSProperties;
}

/** True when the inputs combine a muxed M-address with a non-empty memo. */
export function hasMemoConflict(address: string, memo: string): boolean {
  return address.trim().toUpperCase().startsWith('M') && memo.trim().length > 0;
}

/**
 * Prominent warning shown when a muxed (M...) address and a memo are both
 * present. The M-address already encodes a routing ID, so the receiving
 * service may ignore the memo or credit a different sub-account, and funds
 * can be lost. Renders nothing when there is no conflict.
 */
export const MemoConflictWarning: React.FC<MemoConflictWarningProps> = ({
  address,
  memo,
  onConvert,
  className,
  style,
}) => {
  if (!hasMemoConflict(address, memo)) return null;

  const decoded = decodeMuxedAddress(address);
  const rootClass = ['bw-memo-conflict', className].filter(Boolean).join(' ');

  return (
    <div
      role="alert"
      className={rootClass}
      data-testid="memo-conflict-warning"
      style={{
        marginTop: '0.75rem',
        padding: '0.875rem 1rem',
        backgroundColor: '#fef2f2',
        border: '2px solid #dc2626',
        borderLeftWidth: '6px',
        borderRadius: '0.5rem',
        color: '#7f1d1d',
        fontSize: '0.875rem',
        lineHeight: 1.45,
        ...style,
      }}
    >
      <div
        className="bw-memo-conflict__title"
        style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem' }}
      >
        ⚠️ Risk of lost funds: M-address and memo used together
      </div>
      <p className="bw-memo-conflict__body" style={{ margin: 0 }}>
        Muxed (M…) addresses already contain a routing ID
        {decoded ? (
          <>
            {' '}(<strong>{decoded.id}</strong>)
          </>
        ) : null}
        . Many services ignore the memo <strong>“{memo.trim()}”</strong> or credit the
        wrong account when both are sent. Use the standard G-address with your memo,
        or remove the memo.
      </p>

      {onConvert && decoded && (
        <button
          type="button"
          className="bw-memo-conflict__convert"
          onClick={() => onConvert(decoded.baseAccount, decoded.id)}
          style={{
            marginTop: '0.75rem',
            minHeight: '44px',
            padding: '0.5rem 1rem',
            border: '1px solid #991b1b',
            borderRadius: '0.375rem',
            backgroundColor: '#b91c1c',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Convert to standard G-address
        </button>
      )}

      {onConvert && !decoded && (
        <p
          className="bw-memo-conflict__invalid"
          style={{ margin: '0.5rem 0 0', fontStyle: 'italic' }}
        >
          This M-address could not be decoded, so it cannot be converted. Check it for typos.
        </p>
      )}
    </div>
  );
};
