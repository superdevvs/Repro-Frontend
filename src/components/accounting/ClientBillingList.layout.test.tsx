import * as React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { ClientBillingList } from './ClientBillingList';
import type { ClientBillingItem } from '@/types/clientBilling';

beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.scrollIntoView) proto.scrollIntoView = vi.fn();
  if (!proto.hasPointerCapture) proto.hasPointerCapture = vi.fn(() => false);
  if (!proto.setPointerCapture) proto.setPointerCapture = vi.fn();
  if (!proto.releasePointerCapture) proto.releasePointerCapture = vi.fn();
});

afterEach(() => cleanup());

describe('ClientBillingList controls layout', () => {
  it('keeps the date filters, result count, and export action in the first row with the billing tabs', () => {
    render(<ClientBillingList items={[]} onView={vi.fn()} />);

    const firstRow = screen.getByRole('tablist').closest('.border-b');

    expect(firstRow).not.toBeNull();
    expect(firstRow).toHaveClass('lg:flex-row', 'lg:justify-between');
    expect(firstRow).toContainElement(
      screen.getByRole('group', { name: 'Filter billing items by date' }),
    );
    expect(firstRow).toContainElement(screen.getByText('0 billing items'));
    expect(firstRow).toContainElement(screen.getByRole('button', { name: 'Export billing items' }));
  });

  it('renders a complimentary receipt as no payment required rather than paid', () => {
    const item: ClientBillingItem = {
      id: 'invoice-44',
      source: 'invoice',
      sourceLabel: 'Invoice',
      documentType: 'complimentary_receipt',
      paymentRequired: false,
      property: '10 Main Street',
      amount: 0,
      amountPaid: 0,
      balance: 0,
      status: 'no_payment_required',
      bucket: 'no_payment_required',
      paymentRequiredToRelease: false,
    };

    render(<ClientBillingList items={[item]} onView={vi.fn()} onPay={vi.fn()} />);

    expect(screen.getByText('Complimentary receipt')).toBeInTheDocument();
    expect(screen.getAllByText('No payment required').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Pay / })).not.toBeInTheDocument();
  });
});
