import React, { CSSProperties } from 'react';

export type AddressType = 'G' | 'M' | 'C' | 'UNKNOWN';

/**
 * Warning codes emitted by @redishfish/bluewhale-core that get dedicated
 * styling because ignoring them can lead to lost funds.
 */
export type HighRiskWarningCode = 'CONTRACT_SENDER_DETECTED' | 'MISSING_REQUIRED_MEMO';

interface WarningStyle {
  label: string;
  advice: string;
  backgroundColor: string;
  borderColor: string;
  color: string;
}

export const WARNING_STYLES: Record<HighRiskWarningCode, WarningStyle> = {
  CONTRACT_SENDER_DETECTED: {
    label: 'Contract sender',
    advice:
      'The sender is a smart contract (C-address). Contracts cannot attach memos, so exchange deposits from it may not be credited. Double-check the sending wallet before transferring.',
    backgroundColor: '#fee2e2', // red
    borderColor: '#fca5a5',
    color: '#991b1b',
  },
  MISSING_REQUIRED_MEMO: {
    label: 'Memo required',
    advice:
      'Exchange deposit requires memo. Enter the memo or deposit ID given by the recipient, or the funds may be lost.',
    backgroundColor: '#fef3c7', // amber
    borderColor: '#fcd34d',
    color: '#92400e',
  },
};

export const isHighRiskWarningCode = (code: string | undefined): code is HighRiskWarningCode =>
  !!code && Object.prototype.hasOwnProperty.call(WARNING_STYLES, code);

interface WarningBadgeProps {
  code: HighRiskWarningCode;
}

/** Small colored pill flagging a high-risk warning (red for contract sender, amber for memo). */
export const WarningBadge: React.FC<WarningBadgeProps> = ({ code }) => {
  const style = WARNING_STYLES[code];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.125rem 0.5rem',
        borderRadius: '9999px',
        backgroundColor: style.backgroundColor,
        border: `1px solid ${style.borderColor}`,
        color: style.color,
        fontWeight: 'bold',
        fontSize: '0.75rem',
        whiteSpace: 'nowrap',
      }}
      data-warning-code={code}
    >
      {style.label}
    </span>
  );
};

interface TypeBadgeProps {
  type: AddressType;
  /** Additional CSS class names merged onto the root element. */
  className?: string;
  /** Inline styles applied to the root element. */
  style?: CSSProperties;
}

export const TypeBadge: React.FC<TypeBadgeProps> = ({ type, className, style }) => {
  if (type === 'UNKNOWN') return null;

  let backgroundColor = '#e2e8f0'; // default gray
  let color = '#1e293b';
  let label = '';
  let description = '';

  switch (type) {
    case 'M':
      backgroundColor = '#bfdbfe';
      color = '#1e3a8a';
      label = 'Muxed';
      description = 'A classic account with its routing ID encoded in the address.';
      break;
    case 'G':
      backgroundColor = '#bbf7d0';
      color = '#166534';
      label = 'Classic';
      description = 'A standard Stellar account. A memo may be needed for routing.';
      break;
    case 'C':
      backgroundColor = '#e9d5ff';
      color = '#6b21a8';
      label = 'Contract';
      description = 'A smart contract address, not a standard account payment destination.';
      break;
  }

  const rootClass = ['bw-type-badge', `bw-type-badge--${type.toLowerCase()}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={rootClass}
      role="img"
      aria-label={`${label} address. ${description}`}
      title={description}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.25rem 0.5rem',
        borderRadius: '0.375rem',
        backgroundColor,
        color,
        fontWeight: 'bold',
        fontSize: '0.875rem',
        marginRight: '0.5rem',
        minWidth: '2rem',
        userSelect: 'none',
        ...style,
      }}
    >
      {label}
    </span>
  );
};
