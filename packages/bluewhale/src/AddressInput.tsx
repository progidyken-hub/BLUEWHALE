import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  CSSProperties,
  memo,
} from 'react';
import { TypeBadge, AddressType } from './components/TypeBadge';
import { WarningList, WarningItem } from './components/WarningList';
import { MemoField } from './components/MemoField';

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

// ─── Constants ────────────────────────────────────────────────────────────────

const SEP7_SCHEME = 'web+stellar:';
/** Stable empty array reference — avoids new array on every render. */
const EMPTY_WARNINGS: WarningItem[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSep7URI(raw: string): boolean {
  return raw.trimStart().toLowerCase().startsWith(SEP7_SCHEME);
}

/**
 * Lightweight stable-ID hook so the component works without an external
 * id-generation library. The value is generated once on mount and never
 * changes, preventing unnecessary re-renders from unstable keys.
 */
function useStableId(prefix: string): string {
  const idRef = useRef<string | null>(null);
  if (idRef.current === null) {
    idRef.current = `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  }
  return idRef.current;
}

/**
 * Minimal SEP-0007 URI parser used by the UI layer.
 * Returns a structured result with destination + memo, or an error.
 */
function extractRoutingFromURI(uri: string): {
  success: true;
  rawParams: { destination: string; memo?: string };
  routing: { warnings: WarningItem[] };
} | {
  success: false;
  code: string;
  error: string;
} {
  try {
    const withoutScheme = uri.slice(SEP7_SCHEME.length);
    const qIdx = withoutScheme.indexOf('?');
    const operation = qIdx === -1 ? withoutScheme : withoutScheme.slice(0, qIdx);
    if (operation !== 'pay') {
      return { success: false, code: 'UNSUPPORTED_OPERATION', error: `Unsupported operation: ${operation}` };
    }
    const params = new URLSearchParams(qIdx === -1 ? '' : withoutScheme.slice(qIdx + 1));
    const destination = params.get('destination')?.trim() ?? '';
    if (!destination) {
      return { success: false, code: 'MISSING_DESTINATION', error: 'Missing destination' };
    }
    const memo = params.get('memo') ?? undefined;
    return {
      success: true,
      rawParams: { destination, memo },
      routing: { warnings: EMPTY_WARNINGS },
    };
  } catch (err) {
    return { success: false, code: 'INVALID_URI', error: String(err) };
  }
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

interface CopyState {
  account: boolean;
  routingId: boolean;
}

interface CopyButtonProps {
  value: string;
  label: string;
  copiedKey: keyof CopyState;
  onCopy: (key: keyof CopyState) => void;
}

/**
 * Memoized copy-to-clipboard button.
 * Re-renders only when `label` or `value` change — not on every parent render.
 */
const CopyButton = memo(function CopyButton({
  value,
  label,
  copiedKey,
  onCopy,
}: CopyButtonProps) {
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
});

// ─── RoutingSummary ───────────────────────────────────────────────────────────

interface RoutingSummaryProps {
  type: AddressType;
  address: string;
  memo: string;
  showCopyButton?: boolean;
}

/**
 * Memoized routing summary panel.
 * Skips re-render unless type, address, memo, or showCopyButton change.
 */
const RoutingSummary = memo(function RoutingSummary({
  type,
  address,
  memo,
  showCopyButton,
}: RoutingSummaryProps) {
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
});

// ─── AddressInput ─────────────────────────────────────────────────────────────

/**
 * AddressInput component.
 *
 * Wrapped in React.memo so parent re-renders that pass the same props do not
 * cause the component tree to re-render. Internally, all event callbacks are
 * stabilized with useCallback and expensive derived values are gated by
 * useMemo, minimizing child re-renders.
 */
export const AddressInput: React.FC<AddressInputProps> = memo(function AddressInput({
  onValidationChange,
  showCopyButton = false,
  className,
  style,
}) {
  const [address, setAddress] = useState('');
  const [memo, setMemo] = useState('');
  // Set when the current address/memo came from a decoded SEP-0007 URI.
  const [decodedFromURI, setDecodedFromURI] = useState(false);
  const [uriWarnings, setUriWarnings] = useState<WarningItem[]>(EMPTY_WARNINGS);

  /**
   * Handle raw input. A pasted/scanned `web+stellar:pay?...` URI is parsed
   * and its destination and memo populate the fields; anything else is taken
   * as a plain address.
   */
  const handleInput = useCallback((raw: string) => {
    if (!isSep7URI(raw)) {
      setAddress(raw);
      setDecodedFromURI(false);
      setUriWarnings(EMPTY_WARNINGS);
      return;
    }

    const trimmed = raw.trim();
    // The core parser matches the scheme case-sensitively; normalize it.
    const result = extractRoutingFromURI(SEP7_SCHEME + trimmed.slice(SEP7_SCHEME.length));
    if (result.success) {
      setAddress(result.rawParams.destination);
      setMemo(result.rawParams.memo ?? '');
      setDecodedFromURI(true);
      setUriWarnings(result.routing.warnings);
    } else {
      setAddress(trimmed);
      setDecodedFromURI(false);
      setUriWarnings([{
        code: result.code,
        message: `Could not decode Stellar URI: ${result.error}`,
        severity: 'error',
      }]);
    }
  }, []);

  const handleAddressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (isSep7URI(pasted)) {
      e.preventDefault();
      handleInput(pasted);
    }
  }, [handleInput]);

  const handleMemoChange = useCallback((value: string) => {
    setMemo(value);
  }, []);

  const baseId = useStableId('bluewhale-address');
  const inputId = `${baseId}-input`;

  const type = useMemo<AddressType>(() => {
    if (!address) return 'UNKNOWN';
    const firstChar = address.charAt(0).toUpperCase();
    if (firstChar === 'M') return 'M';
    if (firstChar === 'G') return 'G';
    if (firstChar === 'C') return 'C';
    return 'UNKNOWN';
  }, [address]);

  const showMemo = type === 'G' || type === 'UNKNOWN';

  const warnings = useMemo<string[]>(() => {
    const list: string[] = [];
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
          onChange={handleAddressChange}
          onPaste={handlePaste}
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
      <MemoField isVisible={showMemo && !!address} value={memo} onChange={handleMemoChange} />

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
});
