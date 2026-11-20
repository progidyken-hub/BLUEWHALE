import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TruncatedAddress } from '../TruncatedAddress';

const ADDRESS = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';

describe('TruncatedAddress', () => {
  it('shows the default prefix and suffix and reveals the full address on hover', async () => {
    const user = userEvent.setup();
    render(<TruncatedAddress address={ADDRESS} />);

    const trigger = screen.getByRole('button', { name: ADDRESS });
    expect(trigger).toHaveTextContent('GABC...6789');
    await user.hover(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent(ADDRESS);
  });

  it('reveals the full address on tap and supports custom visible lengths', async () => {
    const user = userEvent.setup();
    render(<TruncatedAddress address={ADDRESS} prefixLength={2} suffixLength={3} />);

    const trigger = screen.getByRole('button', { name: ADDRESS });
    expect(trigger).toHaveTextContent('GA...789');
    await user.click(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent(ADDRESS);
  });

  it('does not truncate addresses that fit the configured lengths', () => {
    render(<TruncatedAddress address="GABC" prefixLength={2} suffixLength={2} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('GABC')).toBeInTheDocument();
  });
});
