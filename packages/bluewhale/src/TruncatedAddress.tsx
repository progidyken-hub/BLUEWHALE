import React, { useState, CSSProperties } from 'react';

export interface TruncatedAddressProps {
  address: string;
  prefixLength?: number;
  suffixLength?: number;
  className?: string;
  style?: CSSProperties;
}

export const TruncatedAddress: React.FC<TruncatedAddressProps> = ({
  address,
  prefixLength = 4,
  suffixLength = 4,
  className,
  style,
}) => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const prefix = Math.max(0, Math.floor(prefixLength));
  const suffix = Math.max(0, Math.floor(suffixLength));
  const isTruncated = address.length > prefix + suffix;
  const visibleAddress = isTruncated
    ? `${address.slice(0, prefix)}...${suffix ? address.slice(-suffix) : ''}`
    : address;
  const tooltipVisible = isTruncated && (hovered || focused || pinned);
  const rootClass = ['bw-truncated-address', className].filter(Boolean).join(' ');

  if (!isTruncated) {
    return (
      <span className={rootClass} style={style}>
        {address}
      </span>
    );
  }

  return (
    <span
      className={rootClass}
      style={{ position: 'relative', display: 'inline-flex', ...style }}
    >
      <button
        type="button"
        title={address}
        aria-label={address}
        aria-expanded={tooltipVisible}
        className="bw-truncated-address__trigger"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={() => setPinned((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setPinned(false);
        }}
        style={{
          border: 0,
          padding: 0,
          background: 'transparent',
          color: 'inherit',
          font: 'inherit',
          textAlign: 'inherit',
          cursor: 'pointer',
        }}
      >
        {visibleAddress}
      </button>
      {tooltipVisible && (
        <span
          role="tooltip"
          className="bw-truncated-address__tooltip"
          style={{
            position: 'absolute',
            zIndex: 1,
            top: '100%',
            left: 0,
            maxWidth: 'min(90vw, 32rem)',
            padding: '0.375rem 0.5rem',
            border: '1px solid var(--bw-border, #cbd5e1)',
            borderRadius: '0.25rem',
            backgroundColor: 'var(--bw-bg, #ffffff)',
            color: 'var(--bw-text, #1e293b)',
            overflowWrap: 'anywhere',
            whiteSpace: 'normal',
          }}
        >
          {address}
        </span>
      )}
    </span>
  );
};
