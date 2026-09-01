import * as React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({ can: () => false }),
}));

vi.mock('@/components/layout/Logo', () => ({
  Logo: () => <div>Repro Photos</div>,
}));

import { InvoiceViewDialog } from './InvoiceViewDialog';

beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.scrollIntoView) proto.scrollIntoView = vi.fn();
  if (!proto.hasPointerCapture) proto.hasPointerCapture = vi.fn(() => false);
  if (!proto.setPointerCapture) proto.setPointerCapture = vi.fn();
  if (!proto.releasePointerCapture) proto.releasePointerCapture = vi.fn();
});

afterEach(() => cleanup());

describe('InvoiceViewDialog complimentary receipt', () => {
  it('uses receipt language and never labels the zero-dollar document as paid or due', () => {
    render(
      <InvoiceViewDialog
        isOpen
        onClose={vi.fn()}
        invoice={{
          id: '44',
          number: 'COMP-44',
          client: 'Client Example',
          property: '10 Main Street',
          status: 'no_payment_required',
          documentType: 'complimentary_receipt',
          paymentRequired: false,
          amount: 0,
          subtotal: 0,
          tax: 0,
          total: 0,
          items: [],
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Complimentary receipt' })).toBeInTheDocument();
    expect(screen.getByText('COMPLIMENTARY — NO PAYMENT REQUIRED')).toBeInTheDocument();
    expect(screen.getByText('Receipt for')).toBeInTheDocument();
    expect(screen.queryByText('Total Due:')).not.toBeInTheDocument();
    expect(screen.queryByText('Amount Paid')).not.toBeInTheDocument();
  });
});
