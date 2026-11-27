import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddressInput, RoutingResult } from '../AddressInput';

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

  it.each([
    ['en', 'Contract addresses cannot be used for standard payments.'],
    ['es', 'Las direcciones de contrato no se pueden usar para pagos estándar.'],
    ['fr', 'Les adresses de contrat ne peuvent pas être utilisées pour des paiements standard.'],
    ['zh', '合约地址不能用于标准付款。'],
    ['ru', 'Адреса контрактов нельзя использовать для стандартных платежей.'],
  ] as const)('renders validation warnings in %s', async (locale, message) => {
    renderComponent({ locale });
    await userEvent.type(getAddressInput(), 'C');

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('localizes the memo warning for an M-address', async () => {
    const user = userEvent.setup();
    renderComponent({ locale: 'fr' });
    const addressInput = getAddressInput();
    await user.type(addressInput, 'GABCDE12345');
    await user.type(screen.getByRole('textbox', { name: /memo/i }), '123');
    await user.clear(addressInput);
    await user.type(addressInput, 'M');

    expect(screen.getByText("Le mémo est ignoré avec une adresse M (l'identifiant de routage est intégré à l'adresse).")).toBeInTheDocument();
  });

  it('allows custom validation message overrides', async () => {
    renderComponent({
      locale: 'fr',
      translations: { contractAddressWarning: 'Custom contract warning.' },
    });
    await userEvent.type(getAddressInput(), 'C');

    expect(screen.getByText('Custom contract warning.')).toBeInTheDocument();
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
      expect(screen.getByRole('status')).toHaveTextContent('Copied!');
    });
  });

  it('uses the legacy clipboard fallback when the Clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      configurable: true,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    });

    renderComponent({ showCopyButton: true });
    await userEvent.type(getAddressInput(), MOCK_ADDRESS);
    await userEvent.click(screen.getAllByRole('button', { name: /copy/i })[0]);

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(screen.getByRole('status')).toHaveTextContent('Copied!');
  });

  it('shows copy button for routing ID when memo is provided', async () => {
    renderComponent({ showCopyButton: true });
    await userEvent.type(getAddressInput(), MOCK_ADDRESS);

    const memoInput = screen.getByRole('textbox', { name: /memo/i });
    await userEvent.type(memoInput, '99999');

    expect(screen.getAllByRole('button', { name: /copy/i }).length).toBeGreaterThanOrEqual(2);
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

  it('updates the address type badge when the input prefix changes', () => {
    renderComponent();
    const input = getAddressInput();

    fireEvent.change(input, { target: { value: 'G' } });
    expect(screen.getByRole('img', { name: /classic address/i })).toHaveTextContent('Classic');

    fireEvent.change(input, { target: { value: 'M' } });
    expect(screen.getByRole('img', { name: /muxed address/i })).toHaveTextContent('Muxed');

    fireEvent.change(input, { target: { value: 'C' } });
    expect(screen.getByRole('img', { name: /contract address/i })).toHaveTextContent('Contract');
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
