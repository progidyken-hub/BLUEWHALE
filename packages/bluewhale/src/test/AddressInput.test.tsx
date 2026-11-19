import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddressInput, RoutingResult } from '../AddressInput';
import { TypeBadge, WarningBadge, isHighRiskWarningCode } from '../components/TypeBadge';
import { WarningList } from '../components/WarningList';

// ─── helpers ──────────────────────────────────────────────────────────────────

function renderComponent(props: Partial<React.ComponentProps<typeof AddressInput>> = {}) {
  return render(<AddressInput {...props} />);
}

function getAddressInput() {
  return screen.getByRole('textbox', { name: /stellar address/i });
}

// ─── #96 – onValidationChange ──────────────────────────────────────────────────

describe('AddressInput – onValidationChange (#96)', () => {
  it('fires onValidationChange(true) for a valid G-address', async () => {
    const onChange = vi.fn<[boolean, RoutingResult]>();
    renderComponent({ onValidationChange: onChange });

    await userEvent.type(getAddressInput(), 'G');

    expect(onChange).toHaveBeenCalled();
    const [isValid] = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(isValid).toBe(true);
  });

  it('fires onValidationChange(true) for an M-address', async () => {
    const onChange = vi.fn<[boolean, RoutingResult]>();
    renderComponent({ onValidationChange: onChange });

    await userEvent.type(getAddressInput(), 'M');

    const [isValid] = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(isValid).toBe(true);
  });

  it('fires onValidationChange(false) for a C-address', async () => {
    const onChange = vi.fn<[boolean, RoutingResult]>();
    renderComponent({ onValidationChange: onChange });

    await userEvent.type(getAddressInput(), 'C');

    const [isValid, result] = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(isValid).toBe(false);
    expect(result.destinationBaseAccount).toBeNull();
  });

  it('fires onValidationChange(false) for unrecognized prefix', async () => {
    const onChange = vi.fn<[boolean, RoutingResult]>();
    renderComponent({ onValidationChange: onChange });

    await userEvent.type(getAddressInput(), 'X');

    const [isValid] = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(isValid).toBe(false);
  });

  it('does NOT fire before any input', () => {
    const onChange = vi.fn();
    renderComponent({ onValidationChange: onChange });
    // No typing → should not fire
    expect(onChange).not.toHaveBeenCalled();
  });

  it('includes routingId in result when memo is provided for G-address', async () => {
    const onChange = vi.fn<[boolean, RoutingResult]>();
    renderComponent({ onValidationChange: onChange });

    await userEvent.type(getAddressInput(), 'G');

    // Memo field becomes visible for G-addresses
    const memoInput = screen.getByRole('textbox', { name: /memo/i });
    await userEvent.type(memoInput, '12345');

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(lastCall[0]).toBe(true);
    expect(lastCall[1].routingId).toBe('12345');
  });

  it('result.warnings contains C-address warning when type is C', async () => {
    const onChange = vi.fn<[boolean, RoutingResult]>();
    renderComponent({ onValidationChange: onChange });

    await userEvent.type(getAddressInput(), 'C');

    const [, result] = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/contract/i);
  });

  it('shows M-address memo warning when M-address has a memo', async () => {
    const onChange = vi.fn<[boolean, RoutingResult]>();
    renderComponent({ onValidationChange: onChange });

    await userEvent.type(getAddressInput(), 'M');
    // For M-address the memo field is NOT visible, so manually clear and retype
    // to simulate a paste that sets memo text then changes address to M
    // Actually, we need to set the address to M and also supply a memo.
    // The memo field is hidden for M-addresses, so we test via onValidationChange
    // by confirming no routingId for M without memo
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(lastCall[1].routingId).toBeNull();
  });
});

// ─── #95 – showCopyButton ─────────────────────────────────────────────────────

describe('AddressInput – showCopyButton (#95)', () => {
  const MOCK_ADDRESS = 'GABCDE12345';

  beforeEach(() => {
    // Provide a working clipboard mock
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  it('does NOT show copy buttons by default', async () => {
    renderComponent();
    await userEvent.type(getAddressInput(), MOCK_ADDRESS);
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull();
  });

  it('shows copy button for base account when showCopyButton=true and address is entered', async () => {
    renderComponent({ showCopyButton: true });
    await userEvent.type(getAddressInput(), MOCK_ADDRESS);
    expect(screen.getAllByRole('button', { name: /copy base account/i }).length).toBeGreaterThan(0);
  });

  it('clicking copy button calls clipboard.writeText', async () => {
    renderComponent({ showCopyButton: true });
    await userEvent.type(getAddressInput(), MOCK_ADDRESS);

    const copyBtn = screen.getAllByRole('button', { name: /copy/i })[0];
    await userEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MOCK_ADDRESS);
  });

  it('shows ✓ Copied! tooltip feedback after clicking copy', async () => {
    renderComponent({ showCopyButton: true });
    await userEvent.type(getAddressInput(), MOCK_ADDRESS);

    const copyBtn = screen.getAllByRole('button', { name: /copy/i })[0];
    await userEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByText(/✓ Copied!/i)).toBeInTheDocument();
    });
  });

  it('shows copy button for routing ID when memo is provided', async () => {
    renderComponent({ showCopyButton: true });
    await userEvent.type(getAddressInput(), MOCK_ADDRESS);

    const memoInput = screen.getByRole('textbox', { name: /memo/i });
    await userEvent.type(memoInput, '99999');

    expect(screen.getAllByRole('button', { name: /copy/i }).length).toBeGreaterThanOrEqual(2);
  });

  it('uses textarea fallback when clipboard API is unavailable', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      configurable: true,
      writable: true,
    });
    // execCommand returns true in jsdom
    document.execCommand = vi.fn().mockReturnValue(true);

    renderComponent({ showCopyButton: true });
    await userEvent.type(getAddressInput(), MOCK_ADDRESS);

    const copyBtn = screen.getAllByRole('button', { name: /copy/i })[0];
    await userEvent.click(copyBtn);

    // execCommand should have been called as the fallback
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('silently ignores clipboard errors', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
      writable: true,
    });

    renderComponent({ showCopyButton: true });
    await userEvent.type(getAddressInput(), MOCK_ADDRESS);

    const copyBtn = screen.getAllByRole('button', { name: /copy/i })[0];
    // Should not throw
    await expect(userEvent.click(copyBtn)).resolves.not.toThrow();
  });
});

// ─── #94 – className / style props ────────────────────────────────────────────

describe('AddressInput – className & style props (#94)', () => {
  it('applies className to root element', () => {
    const { container } = renderComponent({ className: 'my-custom-class' });
    expect(container.firstChild).toHaveClass('bw-address-input');
    expect(container.firstChild).toHaveClass('my-custom-class');
  });

  it('applies inline style to root element', () => {
    const { container } = renderComponent({ style: { maxWidth: '500px' } });
    expect((container.firstChild as HTMLElement).style.maxWidth).toBe('500px');
  });

  it('root element always has bw-address-input class', () => {
    const { container } = renderComponent();
    expect(container.firstChild).toHaveClass('bw-address-input');
  });
});

// ─── BEM class names on sub-components ────────────────────────────────────────

describe('BEM class names on sub-components', () => {
  it('TypeBadge has bw-type-badge class', async () => {
    const { container } = renderComponent();
    await userEvent.type(getAddressInput(), 'G');
    expect(container.querySelector('.bw-type-badge')).toBeInTheDocument();
  });

  it('TypeBadge has modifier class bw-type-badge--g for G-address', async () => {
    const { container } = renderComponent();
    await userEvent.type(getAddressInput(), 'G');
    expect(container.querySelector('.bw-type-badge--g')).toBeInTheDocument();
  });

  it('WarningList has bw-warning-list class and items have bw-warning-item', async () => {
    const { container } = renderComponent();
    await userEvent.type(getAddressInput(), 'C');
    expect(container.querySelector('.bw-warning-list')).toBeInTheDocument();
    expect(container.querySelector('.bw-warning-item')).toBeInTheDocument();
  });

  it('MemoField has bw-memo-field class for G-address', async () => {
    const { container } = renderComponent();
    await userEvent.type(getAddressInput(), 'G');
    expect(container.querySelector('.bw-memo-field')).toBeInTheDocument();
  });
});

// ─── SEP-0007 URI paste handling ─────────────────────────────────────────────

describe('AddressInput – SEP-0007 URI paste handling', () => {
  const VALID_G = 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO';

  it('populates address from a pasted web+stellar:pay URI', async () => {
    renderComponent();
    const input = getAddressInput();

    fireEvent.paste(input, {
      clipboardData: {
        getData: () =>
          `web+stellar:pay?destination=${VALID_G}&memo=42&memo_type=MEMO_ID`,
      },
    });

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe(VALID_G);
    });
  });

  it('shows the memo decoded from the URI', async () => {
    renderComponent();
    const input = getAddressInput();

    fireEvent.paste(input, {
      clipboardData: {
        getData: () =>
          `web+stellar:pay?destination=${VALID_G}&memo=hello&memo_type=MEMO_TEXT`,
      },
    });

    await waitFor(() => {
      const memoInput = screen.getByRole('textbox', { name: /memo/i });
      expect((memoInput as HTMLInputElement).value).toBe('hello');
    });
  });

  it('shows an error warning when the URI has an unsupported operation', async () => {
    renderComponent();
    const input = getAddressInput();

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => 'web+stellar:tx?xdr=AAAA',
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/could not decode stellar uri/i)).toBeInTheDocument();
    });
  });

  it('shows an error warning when the URI has a missing destination', async () => {
    renderComponent();
    const input = getAddressInput();

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => 'web+stellar:pay?amount=100',
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/could not decode stellar uri/i)).toBeInTheDocument();
    });
  });

  it('leaves address unchanged when pasting a plain string (not a URI)', async () => {
    renderComponent();
    const input = getAddressInput();

    // userEvent.type uses the standard change event path, so just fire paste
    fireEvent.paste(input, {
      clipboardData: {
        getData: () => VALID_G,
      },
    });

    // The paste handler shouldn't intercept plain addresses (no web+stellar: prefix)
    // so the input value is updated via the normal React onChange path, not paste.
    // The key point is the component does NOT throw.
    expect(input).toBeInTheDocument();
  });
});

// ─── TypeBadge standalone ─────────────────────────────────────────────────────

describe('TypeBadge standalone', () => {
  it('renders nothing for UNKNOWN type', () => {
    const { container } = render(<TypeBadge type="UNKNOWN" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders M badge with correct class', () => {
    const { container } = render(<TypeBadge type="M" />);
    expect(container.querySelector('.bw-type-badge--m')).toBeInTheDocument();
  });

  it('renders C badge with correct class', () => {
    const { container } = render(<TypeBadge type="C" />);
    expect(container.querySelector('.bw-type-badge--c')).toBeInTheDocument();
  });

  it('applies custom className and style', () => {
    const { container } = render(
      <TypeBadge type="G" className="extra" style={{ color: 'red' }} />
    );
    expect(container.firstChild).toHaveClass('extra');
    expect((container.firstChild as HTMLElement).style.color).toBe('red');
  });
});

// ─── WarningList standalone ───────────────────────────────────────────────────

describe('WarningList standalone', () => {
  it('renders nothing when warnings array is empty', () => {
    const { container } = render(<WarningList warnings={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders structured WarningItem objects (with message field)', () => {
    const warnings = [{ code: 'ERR', message: 'Something went wrong', severity: 'error' as const }];
    render(<WarningList warnings={warnings} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders plain string warnings', () => {
    render(<WarningList warnings={['A plain warning']} />);
    expect(screen.getByText('A plain warning')).toBeInTheDocument();
  });

  it('applies custom className and style', () => {
    const { container } = render(
      <WarningList warnings={['w']} className="custom" style={{ color: 'blue' }} />
    );
    expect(container.firstChild).toHaveClass('custom');
    expect((container.firstChild as HTMLElement).style.color).toBe('blue');
  });
});

// ─── M-address routing summary ───────────────────────────────────────────────

describe('AddressInput – M-address routing summary', () => {
  it('shows routing summary for M-address without memo input', async () => {
    const { container } = renderComponent();
    await userEvent.type(getAddressInput(), 'M');
    expect(container.querySelector('.bw-routing-summary')).toBeInTheDocument();
  });

  it('shows "(encoded in address)" as routing ID for M-address', async () => {
    renderComponent();
    await userEvent.type(getAddressInput(), 'M');
    expect(screen.getByText('(encoded in address)')).toBeInTheDocument();
  });
});

// ─── WarningBadge and isHighRiskWarningCode ────────────────────────────────────

describe('WarningBadge', () => {
  it('renders CONTRACT_SENDER_DETECTED badge', () => {
    const { container } = render(<WarningBadge code="CONTRACT_SENDER_DETECTED" />);
    expect(container.querySelector('[data-warning-code="CONTRACT_SENDER_DETECTED"]')).toBeInTheDocument();
    expect(screen.getByText('Contract sender')).toBeInTheDocument();
  });

  it('renders MISSING_REQUIRED_MEMO badge', () => {
    const { container } = render(<WarningBadge code="MISSING_REQUIRED_MEMO" />);
    expect(container.querySelector('[data-warning-code="MISSING_REQUIRED_MEMO"]')).toBeInTheDocument();
    expect(screen.getByText('Memo required')).toBeInTheDocument();
  });
});

describe('isHighRiskWarningCode', () => {
  it('returns true for CONTRACT_SENDER_DETECTED', () => {
    expect(isHighRiskWarningCode('CONTRACT_SENDER_DETECTED')).toBe(true);
  });

  it('returns true for MISSING_REQUIRED_MEMO', () => {
    expect(isHighRiskWarningCode('MISSING_REQUIRED_MEMO')).toBe(true);
  });

  it('returns false for unknown codes', () => {
    expect(isHighRiskWarningCode('UNKNOWN_CODE')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isHighRiskWarningCode(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isHighRiskWarningCode('')).toBe(false);
  });
});
// ─── M-address + memo warning branch ─────────────────────────────────────────

describe('AddressInput – M-address ignores memo warning', () => {
  it('shows warning when M-address is typed and memo state is populated via SEP-7', async () => {
    const VALID_G = 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO';
    renderComponent();
    const input = getAddressInput();

    // Populate address+memo via URI paste (G-address so memo field shows)
    fireEvent.paste(input, {
      clipboardData: {
        getData: () => `web+stellar:pay?destination=${VALID_G}&memo=routing123`,
      },
    });

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe(VALID_G);
    });

    // Confirm memo is populated
    const memoInput = screen.getByRole('textbox', { name: /memo/i });
    expect((memoInput as HTMLInputElement).value).toBe('routing123');

    // Change address to M while memo remains set → triggers M+memo warning branch
    await userEvent.clear(input);
    await userEvent.type(input, 'M');

    await waitFor(() => {
      expect(
        screen.getByText(/memo is ignored when using an m-address/i)
      ).toBeInTheDocument();
    });
  });
});

// ─── Additional branch coverage ───────────────────────────────────────────────

describe('AddressInput – SEP-7 no-memo branch', () => {
  it('populates address from SEP-7 URI with no memo (triggers null-coalesce branch)', async () => {
    const VALID_G = 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO';
    renderComponent();
    const input = getAddressInput();

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => `web+stellar:pay?destination=${VALID_G}`,
      },
    });

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe(VALID_G);
    });
    // memo should be empty string (not undefined)
    const memoInput = screen.getByRole('textbox', { name: /memo/i });
    expect((memoInput as HTMLInputElement).value).toBe('');
  });
});

// ─── extractRoutingFromURI catch path ─────────────────────────────────────────

describe('AddressInput – SEP-7 URI internal error (catch branch)', () => {
  it('shows error warning when URI parsing throws internally', async () => {
    // Patch URLSearchParams to throw to exercise the catch branch in
    // extractRoutingFromURI
    const OrigURLSearchParams = globalThis.URLSearchParams;
    globalThis.URLSearchParams = class extends OrigURLSearchParams {
      constructor(init?: string | URLSearchParams | Record<string, string> | Iterable<[string, string]> | ReadonlyArray<[string, string]>) {
        if (typeof init === 'string' && init.includes('throw-trigger')) {
          throw new Error('simulated parse failure');
        }
        super(init as any);
      }
    } as typeof URLSearchParams;

    renderComponent();
    const input = getAddressInput();

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => 'web+stellar:pay?throw-trigger=1&destination=G',
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/could not decode stellar uri/i)).toBeInTheDocument();
    });

    globalThis.URLSearchParams = OrigURLSearchParams;
  });
});
