import React, { CSSProperties } from 'react';

interface WarningListProps {
  warnings: string[];
  /** Additional CSS class names merged onto the root element. */
  className?: string;
  /** Inline styles applied to the root element. */
  style?: CSSProperties;
}

const containerStyle = {
  backgroundColor: '#fef3c7',
  borderColor: '#fcd34d',
};

export const WarningList: React.FC<WarningListProps> = ({ warnings, className, style }) => {
  if (!warnings || warnings.length === 0) return null;

  const rootClass = ['bw-warning-list', className].filter(Boolean).join(' ');

  return (
    <div
      className={rootClass}
      style={{
        marginTop: '0.5rem',
        padding: '0.75rem',
        backgroundColor: 'var(--bw-bg, #fffbeb)',
        border: '1px solid var(--bw-warning, #fcd34d)',
        borderRadius: '0.375rem',
        color: 'var(--bw-warning, #92400e)',
        fontSize: '0.875rem',
        ...style,
      }}
    >
      <div
        className="bw-warning-list__title"
        style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}
      >
        ⚠️ Warnings:
      </div>
      <ul className="bw-warning-list__items" style={{ margin: 0, paddingLeft: '1.25rem' }}>
        {warnings.map((warning, idx) => (
          <li
            key={idx}
            className="bw-warning-item"
            style={{ marginBottom: '0.25rem' }}
          >
            {warning}
          </li>
        ))}
      </ul>
    </div>
  );
};
