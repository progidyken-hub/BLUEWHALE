import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import React, { useState } from 'react';
import { AddressInput, type RoutingResult } from './AddressInput';

const meta = {
  title: 'Components/AddressInput',
  component: AddressInput,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'AddressInput component for Stellar addresses with built-in validation, type detection (G/M/C), memo field handling, and routing info extraction.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AddressInput>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Default (empty) ──────────────────────────────────────────────────────────

export const Default: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: /stellar address/i });
    await expect(input).toBeInTheDocument();
    await expect(input).toHaveValue('');
  },
};

// ─── G-address ────────────────────────────────────────────────────────────────

export const GAddress: Story = {
  render: () => (
    <div>
      <p style={{ fontFamily: 'sans-serif', marginBottom: '1rem', color: '#475569' }}>
        Classic G-address — memo field is visible.
      </p>
      <AddressInput />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: /stellar address/i });
    
    // Type a valid G-address
    await userEvent.type(
      input,
      'GACCCGPGGEA7FBZ76ZXKXVUMZGSJZ5RUYXY2NLCW2NLCW6TKVFJKPX2G',
      { delay: 20 }
    );
    
    // Verify type badge appears
    await expect(canvas.getByText(/G-address/i)).toBeInTheDocument();
    
    // Verify memo field is visible
    await expect(canvas.getByRole('textbox', { name: /memo/i })).toBeInTheDocument();
  },
};

// ─── M-address (muxed) ────────────────────────────────────────────────────────

export const MAddress: Story = {
  render: () => (
    <div>
      <p style={{ fontFamily: 'sans-serif', marginBottom: '1rem', color: '#475569' }}>
        Muxed M-address — routing ID is encoded in the address; memo field is hidden.
      </p>
      <AddressInput />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: /stellar address/i });
    
    // Type a valid M-address
    await userEvent.type(
      input,
      'MAAAAAAAAAAAAAB7BQ2L7E5NBWMXDUCMZSIPOBKRDSBYVLMXGSSKF6YNPIB7Y77ITKNOG',
      { delay: 20 }
    );
    
    // Verify type badge shows M-address
    await expect(canvas.getByText(/M-address/i)).toBeInTheDocument();
    
    // Verify memo field is NOT visible
    await expect(canvas.queryByRole('textbox', { name: /memo/i })).not.toBeInTheDocument();
  },
};

// ─── C-address (contract - invalid) ───────────────────────────────────────────

export const CAddress: Story = {
  render: () => (
    <div>
      <p style={{ fontFamily: 'sans-serif', marginBottom: '1rem', color: '#475569' }}>
        Contract address — triggers an error warning and marks the input as invalid.
      </p>
      <AddressInput />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: /stellar address/i });
    
    // Type a contract address
    await userEvent.type(
      input,
      'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC5OC',
      { delay: 20 }
    );
    
    // Verify type badge shows C-address
    await expect(canvas.getByText(/C-address/i)).toBeInTheDocument();
    
    // Verify error warning is shown
    await expect(canvas.getByText(/contract.*not supported/i)).toBeInTheDocument();
  },
};

// ─── Memo warnings ────────────────────────────────────────────────────────────

export const MemoWarning: Story = {
  render: () => (
    <div>
      <p style={{ fontFamily: 'sans-serif', marginBottom: '1rem', color: '#475569' }}>
        Enter an M-address, then type something in the memo field to see the memo-ignored warning.
      </p>
      <AddressInput />
    </div>
  ),
  name: 'Memo warning (M-address + memo)',
};

// ─── With copy buttons ────────────────────────────────────────────────────────

export const WithCopyButtons: Story = {
  args: {
    showCopyButton: true,
  },
  render: (args) => (
    <div>
      <p style={{ fontFamily: 'sans-serif', marginBottom: '1rem', color: '#475569' }}>
        <code>showCopyButton=true</code> — one-click copy for base account and routing ID.
      </p>
      <AddressInput {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: /stellar address/i });
    
    // Type a valid G-address
    await userEvent.type(
      input,
      'GACCCGPGGEA7FBZ76ZXKXVUMZGSJZ5RUYXY2NLCW2NLCW6TKVFJKPX2G',
      { delay: 20 }
    );
    
    // Verify copy button appears
    await expect(canvas.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  },
};

// ─── onValidationChange callback ──────────────────────────────────────────────

export const ValidationCallback: Story = {
  render: () => {
    const [status, setStatus] = useState<{ valid: boolean; result: RoutingResult } | null>(null);

    return (
      <div style={{ fontFamily: 'sans-serif' }}>
        <p style={{ marginBottom: '1rem', color: '#475569' }}>
          Type an address to see the <code>onValidationChange</code> callback fire in real-time.
        </p>
        <AddressInput
          onValidationChange={(isValid, result) => setStatus({ valid: isValid, result })}
        />
        {status && (
          <pre
            style={{
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: status.valid ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${status.valid ? '#86efac' : '#fca5a5'}`,
              borderRadius: '0.375rem',
              fontSize: '0.8125rem',
              color: '#1e293b',
              overflow: 'auto',
            }}
          >
            {JSON.stringify({ isValid: status.valid, ...status.result }, null, 2)}
          </pre>
        )}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: /stellar address/i });
    
    // Type a valid address and verify callback output appears
    await userEvent.type(
      input,
      'GACCCGPGGEA7FBZ76ZXKXVUMZGSJZ5RUYXY2NLCW2NLCW6TKVFJKPX2G',
      { delay: 20 }
    );
    
    // Verify JSON output is displayed
    await expect(canvas.getByText(/"isValid":/)).toBeInTheDocument();
  },
};

// ─── Custom className / style ─────────────────────────────────────────────────

export const CustomStyling: Story = {
  args: {
    className: 'demo-custom',
    style: { maxWidth: '28rem' },
  },
  render: (args) => (
    <div>
      <p style={{ fontFamily: 'sans-serif', marginBottom: '1rem', color: '#475569' }}>
        Custom <code>className</code> and <code>style</code> override via BEM class hooks.
      </p>
      <style>{`
        .demo-custom {
          border: 2px dashed #6366f1;
          border-radius: 1rem;
          padding: 1rem;
          background: #f5f3ff;
        }
      `}</style>
      <AddressInput {...args} />
    </div>
  ),
};

// ─── Dark mode ────────────────────────────────────────────────────────────────

export const DarkMode: Story = {
  args: {
    showCopyButton: true,
    className: 'bw-dark',
    style: { maxWidth: '30rem' },
  },
  render: (args) => (
    <div
      style={{
        backgroundColor: '#0f172a',
        padding: '2rem',
        borderRadius: '0.75rem',
        minHeight: '200px',
      }}
    >
      <p style={{ fontFamily: 'sans-serif', marginBottom: '1rem', color: '#94a3b8' }}>
        Dark mode layout — override inline styles via <code>style</code> prop or CSS classes.
      </p>
      <AddressInput {...args} />
      <style>{`
        .bw-dark .bw-address-input__input {
          background-color: #1e293b;
          color: #e2e8f0;
          border-color: #334155;
        }
        .bw-dark .bw-memo-field__input {
          background-color: #1e293b;
          color: #e2e8f0;
          border-color: #334155;
        }
        .bw-dark .bw-routing-summary {
          background-color: #1e293b;
          border-color: #334155;
          color: #e2e8f0;
        }
      `}</style>
    </div>
  ),
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

// ─── Error States Gallery ─────────────────────────────────────────────────────

export const ErrorStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h3 style={{ fontFamily: 'sans-serif', marginBottom: '0.5rem' }}>Invalid Checksum</h3>
        <AddressInput />
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>
          Try entering: GACCCGPGGEA7FBZ76ZXKXVUMZGSJZ5RUYXY2NLCW2NLCW6TKVFJKPX2X
        </p>
      </div>
      
      <div>
        <h3 style={{ fontFamily: 'sans-serif', marginBottom: '0.5rem' }}>Contract Address</h3>
        <AddressInput />
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>
          Try entering: CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC5OC
        </p>
      </div>
      
      <div>
        <h3 style={{ fontFamily: 'sans-serif', marginBottom: '0.5rem' }}>Too Short</h3>
        <AddressInput />
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>
          Try entering: GA
        </p>
      </div>
    </div>
  ),
};

// ─── All Address Variants ─────────────────────────────────────────────────────

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h3 style={{ fontFamily: 'sans-serif', marginBottom: '0.5rem', color: '#1e293b' }}>
          G-address (Classic)
        </h3>
        <AddressInput />
      </div>
      
      <div>
        <h3 style={{ fontFamily: 'sans-serif', marginBottom: '0.5rem', color: '#1e293b' }}>
          M-address (Muxed)
        </h3>
        <AddressInput />
      </div>
      
      <div>
        <h3 style={{ fontFamily: 'sans-serif', marginBottom: '0.5rem', color: '#1e293b' }}>
          With Copy Button
        </h3>
        <AddressInput showCopyButton />
      </div>
    </div>
  ),
};
