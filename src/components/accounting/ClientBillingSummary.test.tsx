import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { ClientBillingOverviewCards } from './ClientBillingOverviewCards';
import { ClientBillingSidePanel } from './ClientBillingSidePanel';
import type { ClientBillingItem, ClientBillingSummary } from '@/types/clientBilling';

const summary: ClientBillingSummary = { dueNow: { amount: 720, count: 3 }, upcoming: { amount: 400, count: 2 }, paid: { amount: 900, count: 4 }, noPaymentRequired: { amount: 0, count: 1 }, paymentRequiredToReleaseCount: 2 };
const items: ClientBillingItem[] = [
  { id: 'paid-1', number: '1001', source: 'invoice', sourceLabel: 'Invoice', property: 'Paid property', amount: 300, amountPaid: 300, balance: 0, status: 'paid', bucket: 'paid', paymentRequiredToRelease: false, paidAt: '2026-09-10', paymentMethod: 'mixed', paymentDetails: { payment_breakdown: [{ method: 'stripe', amount: 200 }, { method: 'check', amount: 100, details: { check_number: '123' } }] } },
  { id: 'paid-2', number: '1002', source: 'invoice', sourceLabel: 'Invoice', property: 'Newer payment', amount: 500, amountPaid: 500, balance: 0, status: 'paid', bucket: 'paid', paymentRequiredToRelease: false, paidAt: '2026-09-20', paymentMethod: 'stripe', paymentDetails: { brand: 'visa', last4: '4242' } },
];
afterEach(() => cleanup());

describe('client billing summary and activity', () => {
  it('updates paid-period totals without changing current outstanding or upcoming balances', () => {
    const { rerender } = render(<ClientBillingOverviewCards summary={summary} items={items} paidDateRange={{ startDate: '2026-09-01', endDate: '2026-09-15' }} />);
    expect(within(screen.getByRole('region', { name: 'Paid in selected period' })).getByText('$300.00')).toBeInTheDocument();
    rerender(<ClientBillingOverviewCards summary={summary} items={items} paidDateRange={{ startDate: '2026-09-16', endDate: '2026-09-30' }} />);
    expect(within(screen.getByRole('region', { name: 'Paid in selected period' })).getByText('$500.00')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Outstanding balance' })).getByText('$720.00')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Upcoming charges' })).getByText('$400.00')).toBeInTheDocument();
  });

  it('opens recent payment details and retains card, cheque, and split method information', async () => {
    const onView = vi.fn();
    const user = userEvent.setup();
    render(<ClientBillingSidePanel summary={summary} items={items} onView={onView} />);
    const payments = screen.getAllByRole('button', { name: /^View payment/ });
    expect(payments[0]).toHaveAccessibleName('View payment 1002');
    expect(screen.getByText(/Visa - 4242/)).toBeInTheDocument();
    expect(screen.getByText(/Card \+ Cheque/)).toBeInTheDocument();
    await user.click(payments[0]);
    expect(onView).toHaveBeenCalledWith(items[1]);
    await user.click(screen.getByRole('tab', { name: 'Payment methods' }));
    expect(screen.getByText('Card')).toBeInTheDocument();
    expect(screen.getByText('2 payments')).toBeInTheDocument();
    expect(screen.getByText('Cheque')).toBeInTheDocument();
    expect(screen.getByText('1 payment')).toBeInTheDocument();
  });
});
