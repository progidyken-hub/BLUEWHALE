import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AddressInput } from '../AddressInput';

describe('AddressInput feedback layout', () => {
  it('reserves and animates a feedback slot when there are no warnings', () => {
    const { container } = render(<AddressInput />);
    const feedback = container.querySelector('.bw-address-input__feedback') as HTMLElement;

    expect(feedback.style.minHeight).toBe('6rem');
    expect(feedback.style.transition).toContain('opacity');
    expect(feedback).toHaveAttribute('aria-hidden', 'true');
  });

});
