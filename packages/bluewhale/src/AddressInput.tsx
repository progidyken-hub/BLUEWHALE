import React, { useState, useMemo, useEffect, useCallback, CSSProperties, useRef } from 'react';
import { TypeBadge, AddressType } from './components/TypeBadge';
import { WarningList, WarningItem } from './components/WarningList';
import { MemoField } from './components/MemoField';

// ─── SEP-0007 helpers ──────────────────────────────────────────────────────────

const SEP7_SCHEME = 'web+stellar:';

function isSep7URI(input: string): boolean {
  return input.trim().toLowerCase().startsWith(SEP7_SCHEME);
}

type Sep7ParseResult =
  | {
      success: true;
      destination: string;
      memo: string | null;
      warnings: string[];
    }
  | {
      success: false;
      error: string;
    };

function parseSep7URI(uriString: string): Sep7ParseResult {
  if (!uriString.startsWith(SEP7_SCHEME)) {
    return { success: false, error: "URI must use 'web+stellar:' scheme" };
  }
  const withoutScheme = uriString.slice(SEP7_SCHEME.length);
  const questionIndex = withoutScheme.indexOf('?');
  const operation = questionIndex === -1 ? withoutScheme : withoutScheme.slice(0, questionIndex);
  const queryString = questionIndex === -1 ? '' : withoutScheme.slice(questionIndex + 1);

  if (operation !== 'pay') {
    return { success: false, error: `Unsupported operation: '${operation}'. Only 'pay' is supported.` };
  }

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(queryString);
  } catch {
    return { success: false, error: 'Failed to parse URI query parameters' };
  }

  const destination = params.get('destination');
  if (!destination || destination.trim() === '') {
    return { success: false, error: "Missing required 'destination' parameter" };
  }

  return {
    success: true,
    destination: destination.trim(),
    memo: params.get('memo'),
    warnings: [],
  };
}

// ─── Stable ID hook ────────────────────────────────────────────────────────────

let _idCounter = 0;
function useStableId(prefix: string): string {
  const ref = useRef<string | null>(null);
  if (ref.current === null) {
    ref.current = `${prefix}-${++_idCounter}`;
  }
  return ref.current;
}

// ─── Constant empty array (stable reference) ──────────────────────────────────

const EMPTY_WARNINGS: WarningItem[] = [];

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
}

interface CopyState {
  account: boolean;
  routingId: boolean;
}

function CopyButton({
  value,
  label,
  copiedKey,
  onCopy,
}: {
  value: string;
  label: string;
  copiedKey: keyof CopyState;
  onCopy: (key: keyof CopyState) => void;
}) {
  const handleClick = useCallback(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback for non-secure contexts
        const el = document.createElement('textarea');
        el.value = value;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      onCopy(copiedKey);
    } catch {
      // silently fail – clipboard unavailable
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
        border: '1px solid #cbd5e1',
        borderRadius: '0.25rem',
        backgroundColor: '#f8fafc',
        color: '#475569',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background-color 0.15s ease',
      }}
    >
      {label}
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
        backgroundColor: '#f1f5f9',
        border: '1px solid #e2e8f0',
        borderRadius: '0.375rem',
        fontSize: '0.8125rem',
        color: '#334155',
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
}) => {
  const [address, setAddress] = useState('');
  const [memo, setMemo] = useState('');
  // Set when the current address/memo came from a decoded SEP-0007 URI.
  const [decodedFromURI, setDecodedFromURI] = useState(false);
  const [uriWarnings, setUriWarnings] = useState<WarningItem[]>(EMPTY_WARNINGS);

  /**
   * Handle raw input. A pasted/scanned `web+stellar:pay?...` URI is parsed
   * with extractRoutingFromURI and its destination and memo populate the
   * fields; anything else is taken as a plain address.
   */
  const handleInput = (raw: string) => {
    if (!isSep7URI(raw)) {
      setAddress(raw);
      setDecodedFromURI(false);
      setUriWarnings(EMPTY_WARNINGS);
      return;
    }

    const trimmed = raw.trim();
    // The core parser matches the scheme case-sensitively; normalize it.
    const result = parseSep7URI(SEP7_SCHEME + trimmed.slice(SEP7_SCHEME.length));
    if (result.success) {
      setAddress(result.destination);
      setMemo(result.memo ?? '');
      setDecodedFromURI(true);
      setUriWarnings(result.warnings);
    } else {
      // Error text is already sanitized of sensitive query values.
      setAddress(trimmed);
      setDecodedFromURI(false);
      setUriWarnings([`Could not decode Stellar URI: ${result.error}`]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (isSep7URI(pasted)) {
      e.preventDefault();
      handleInput(pasted);
    }
  };

  const baseId = useStableId('bluewhale-address');
  const inputId = `${baseId}-input`;
  const warningsId = `${baseId}-warnings`;
  const statusId = `${baseId}-status`;

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
    const list: WarningItem[] = [];
    if (type === 'C') {
      list.push('Contract addresses cannot be used for standard payments.');
    }
    if (type === 'M' && memo) {
      list.push('Memo is ignored when using an M-address (routing ID is encoded in the address).');
    }
    return list;
  }, [type, memo]);

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
          id={inputId}
          type="text"
          placeholder="Paste Stellar address (G..., M..., C...)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          aria-label="Stellar address"
          className="bw-address-input__input"
          style={{
            width: '100%',
            padding: `0.75rem 0.75rem 0.75rem ${type !== 'UNKNOWN' ? '3rem' : '0.75rem'}`,
            border: `1px solid ${type === 'C' ? '#f87171' : '#cbd5e1'}`,
            borderRadius: '0.5rem',
            fontSize: '1rem',
            boxSizing: 'border-box',
            outline: 'none',
            transition: 'padding 0.2s ease, border-color 0.2s ease',
          }}
        />
      </div>

      {/* Memo field (G-address only) */}
      <MemoField isVisible={showMemo && !!address} value={memo} onChange={setMemo} />

      {/* Warnings */}
      <WarningList warnings={warnings} />

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
