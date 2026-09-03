import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import { ClientInvoicesCard } from './ClientInvoicesCard';

describe('ClientInvoicesCard', () => {
  it('fills its desktop column and keeps payment actions anchored to the bottom', () => {
    render(
      <ClientInvoicesCard
        summary={{
          dueNow: { amount: 0, count: 0 },
          upcoming: { amount: 0, count: 0 },
          paid: { amount: 0, count: 0 },
          noPaymentRequired: { amount: 0, count: 0 },
          paymentRequiredToReleaseCount: 0,
        }}
        onViewAll={vi.fn()}
        onPay={vi.fn()}
      />,
    );

    const card = screen.getByRole('heading', { name: 'Invoices & payments' }).parentElement?.parentElement;
    const actions = screen.getByRole('button', { name: 'View all invoices' }).parentElement;

    expect(card).toHaveClass('h-full', 'min-h-0');
    expect(actions).toHaveClass('mt-auto');
  });
});
