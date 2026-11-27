import React, { useState, useMemo, useEffect, useCallback, CSSProperties } from 'react';
import { TypeBadge, AddressType } from './components/TypeBadge';
import { WarningList } from './components/WarningList';
import { MemoField } from './components/MemoField';
import { focusRingCss } from './styles/focusRing';

/** Shared focus-ring rules; see styles/focusRing.ts for the contrast rationale. */
const FOCUS_RING_CSS = focusRingCss();

/**
 * A simplified routing result for the UI layer.
 * Mirrors relevant fields from core-ts RoutingResult.
 */
export interface RoutingResult {
  destinationBaseAccount: string | null;
  routingId: string | null;
  warnings: string[];
  isValid: boolean;
}

export interface AddressInputProps {
  /**
   * Fired whenever validation state changes.
   * `isValid` is false when errors exist (e.g. C-address).
   */
  onValidationChange?: (isValid: boolean, result: RoutingResult) => void;

  /**
   * When true, shows copy buttons for the resolved base account and routing ID.
   * @default false
   */
  showCopyButton?: boolean;

  /**
   * Additional CSS class names to merge onto the root element.
   * Allows full Tailwind / custom-CSS overrides.
   */
  className?: string;

  /**
   * Inline styles applied to the root element.
   */
  style?: CSSProperties;

  /** Language used for built-in validation messages. @default "en" */
  locale?: AddressInputLocale;

  /** Override any built-in validation message. */
  translations?: Partial<AddressInputTranslations>;
}

interface CopyState {
  account: boolean;
  routingId: boolean;
}

function CopyButton({
  value,
  label,
  copiedKey,
  copied,
  onCopy,
}: {
  value: string;
  label: string;
  copiedKey: keyof CopyState;
  copied: boolean;
  onCopy: (key: keyof CopyState) => void;
}) {
  const [copyFailed, setCopyFailed] = useState(false);
  const handleClick = useCallback(async () => {
    setCopyFailed(false);
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const el = document.createElement('textarea');
        el.value = value;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        let copied = false;
        try {
          el.focus();
          el.select();
          copied = document.execCommand('copy');
        } finally {
          document.body.removeChild(el);
        }
        if (!copied) throw new Error('Clipboard copy was rejected');
      }
      onCopy(copiedKey);
    } catch {
      setCopyFailed(true);
    }
  }, [value, copiedKey, onCopy]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Copy ${copiedKey === 'account' ? 'base account' : 'routing ID'}`}
      className="bw-copy-button"
      style={{
        marginLeft: '0.5rem',
        padding: '0.2rem 0.5rem',
        fontSize: '0.75rem',
        border: '1px solid var(--bw-border, #cbd5e1)',
        borderRadius: '0.25rem',
        backgroundColor: 'var(--bw-bg, #f8fafc)',
        color: 'var(--bw-text, #475569)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background-color 0.15s ease',
      }}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="8" y="8" width="13" height="13" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </svg>
      {label}
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {copied ? 'Copied!' : copyFailed ? 'Copy failed.' : ''}
      </span>
    </button>
  );
}

function RoutingSummary({
  type,
  address,
  memo,
  showCopyButton,
}: {
  type: AddressType;
  address: string;
  memo: string;
  showCopyButton?: boolean;
}) {
  const [copied, setCopied] = useState<CopyState>({ account: false, routingId: false });

  const baseAccount = type === 'M'
    ? null // In a real integration we'd decode the M-address; display address as-is
    : address;
  const displayAccount = address;
  const routingId = type === 'M' ? '(encoded in address)' : (memo || null);

  const handleCopy = useCallback((key: keyof CopyState) => {
    setCopied((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => setCopied((prev) => ({ ...prev, [key]: false })), 2000);
  }, []);

  if (!address) return null;

  return (
    <div
      className="bw-routing-summary"
      style={{
        marginTop: '0.5rem',
        padding: '0.5rem 0.75rem',
        backgroundColor: 'var(--bw-bg, #f1f5f9)',
        border: '1px solid var(--bw-border, #e2e8f0)',
        borderRadius: '0.375rem',
        fontSize: '0.8125rem',
        color: 'var(--bw-text, #334155)',
      }}
    >
      <div
        className="bw-routing-summary__row"
        style={{ display: 'flex', alignItems: 'center', marginBottom: routingId ? '0.35rem' : 0 }}
      >
        <span style={{ fontWeight: 500, minWidth: '7rem', color: '#64748b' }}>Base account:</span>
        <span
          className="bw-routing-summary__value"
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={displayAccount}
        >
          {displayAccount}
        </span>
        {showCopyButton && (
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <CopyButton
              value={baseAccount ?? displayAccount}
              label={copied.account ? '✓ Copied!' : 'Copy'}
              copiedKey="account"
              copied={copied.account}
              onCopy={handleCopy}
            />
          </div>
        )}
      </div>

      {routingId && (
        <div
          className="bw-routing-summary__row"
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <span style={{ fontWeight: 500, minWidth: '7rem', color: '#64748b' }}>Routing ID:</span>
          <span
            className="bw-routing-summary__value"
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={routingId}
          >
            {routingId}
          </span>
          {showCopyButton && memo && (
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <CopyButton
                value={memo}
                label={copied.routingId ? '✓ Copied!' : 'Copy'}
                copiedKey="routingId"
                copied={copied.routingId}
                onCopy={handleCopy}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const AddressInput: React.FC<AddressInputProps> = ({
  onValidationChange,
  showCopyButton = false,
  className,
  style,
  locale = 'en',
  translations,
}) => {
  const [address, setAddress] = useState('');
  const [memo, setMemo] = useState('');
  const messages = useMemo(
    () => getAddressInputTranslations(locale, translations),
    [locale, translations],
  );

  const type = useMemo<AddressType>(() => {
    if (!address) return 'UNKNOWN';
    const firstChar = address.charAt(0).toUpperCase();
    if (firstChar === 'M') return 'M';
    if (firstChar === 'G') return 'G';
    if (firstChar === 'C') return 'C';
    return 'UNKNOWN';
  }, [address]);

  const showMemo = type === 'G' || type === 'UNKNOWN';

  const warnings = useMemo(() => {
    const list: string[] = [];
    if (type === 'C') {
      list.push(messages.contractAddressWarning);
    }
    if (type === 'M' && memo) {
      list.push(messages.muxedAddressMemoWarning);
    }
    return list;
  }, [type, memo, messages]);

  const routingResult = useMemo<RoutingResult>(() => {
    const isValid = address.length > 0 && type !== 'C' && type !== 'UNKNOWN';
    return {
      destinationBaseAccount: isValid ? address : null,
      routingId: isValid && memo ? memo : null,
      warnings,
      isValid,
    };
  }, [address, type, memo, warnings]);

  // Fire onValidationChange whenever the result changes
  useEffect(() => {
    if (address === '') return; // don't fire before any input
    onValidationChange?.(routingResult.isValid, routingResult);
  }, [address, routingResult, onValidationChange]);

  const rootClass = ['bw-address-input', className].filter(Boolean).join(' ');

  return (
    <div
      className={rootClass}
      style={{ maxWidth: '32rem', margin: '0 auto', fontFamily: 'sans-serif', ...style }}
    >
      {/* High-contrast :focus-visible ring for keyboard and screen-reader users. */}
      <style data-bw-focus-ring="">{FOCUS_RING_CSS}</style>

      {/* Address field */}
      <div
        className="bw-address-input__field-wrap"
        style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
      >
        {type !== 'UNKNOWN' && (
          <div
            className="bw-address-input__badge"
            style={{ position: 'absolute', left: '0.5rem' }}
          >
            <TypeBadge type={type} />
          </div>
        )}
        <input
          type="text"
          placeholder="Paste Stellar address (G..., M..., C...)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          aria-label="Stellar address"
          className="bw-address-input__input"
          style={{
            width: '100%',
            padding: `0.75rem 0.75rem 0.75rem ${type !== 'UNKNOWN' ? '3rem' : '0.75rem'}`,
            border: `1px solid ${type === 'C' ? '#f87171' : 'var(--bw-border, #cbd5e1)'}`,
            backgroundColor: 'var(--bw-bg, #ffffff)',
            color: 'var(--bw-text, #1e293b)',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            boxSizing: 'border-box',
            // No `outline: none` here: the visible focus ring comes from FOCUS_RING_CSS.
            transition: 'padding 0.2s ease, border-color 0.2s ease',
          }}
        />
      </div>

      {/* Memo field (G-address only) */}
      <MemoField isVisible={showMemo && !!address} value={memo} onChange={setMemo} />

      {/* Keep feedback in a reserved slot so it does not move later fields. */}
      <div
        className="bw-address-input__feedback"
        aria-hidden={warnings.length === 0}
        style={{
          minHeight: '6rem',
          opacity: warnings.length > 0 ? 1 : 0,
          transform: warnings.length > 0 ? 'translateY(0)' : 'translateY(-0.25rem)',
          transition: 'opacity 0.18s ease, transform 0.18s ease',
        }}
      >
        <WarningList warnings={warnings} />
      </div>

      {/* Routing summary with optional copy buttons */}
      {type !== 'C' && address && (
        <RoutingSummary
          type={type}
          address={address}
          memo={memo}
          showCopyButton={showCopyButton}
        />
      )}
    </div>
  );
};
