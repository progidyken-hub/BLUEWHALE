import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoField } from '../components/MemoField';
import { AddressInput } from '../AddressInput';

const M_PREFIX = 'M';

describe('MemoField', () => {
  it('renders nothing when isVisible is false', () => {
    const { container } = render(<MemoField isVisible={false} value="" onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the labelled input when isVisible is true', () => {
    render(<MemoField isVisible value="abc" onChange={() => {}} />);
    const input = screen.getByLabelText(/memo \(optional\)/i);
    expect(input).toHaveValue('abc');
  });

  it('calls onChange with the typed value', async () => {
    const onChange = vi.fn();
    render(<MemoField isVisible value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText(/memo/i), '7');
    expect(onChange).toHaveBeenCalledWith('7');
  });

  it('merges className onto the root element', () => {
    const { container } = render(
      <MemoField isVisible value="" onChange={() => {}} className="custom" />,
    );
    expect(container.firstElementChild).toHaveClass('bw-memo-field', 'custom');
  });
});

describe('MemoField inside AddressInput', () => {
  it('is hidden until an M-address prefix is detected', async () => {
    render(<AddressInput />);
    expect(screen.queryByLabelText(/memo/i)).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: /stellar address/i }), M_PREFIX);
    expect(screen.queryByLabelText(/memo/i)).toBeInTheDocument();
  });
});
