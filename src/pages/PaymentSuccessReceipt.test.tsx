import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import { PaymentSuccessReceipt } from './PaymentSuccessReceipt';
import type { ShootDetails } from './paymentPageModel';

const shoot: ShootDetails = {
  id: 42,
  address: '2 Topwood Court',
  city: 'Parkville',
  state: 'MD',
  zip: '21234',
  total_quote: 100,
  base_quote: 100,
  tax_amount: 0,
  services: [{ name: 'Photography' }],
  receipt: {
    number: 'R-42',
    amount: 75,
    currency: 'USD',
    paid_at: '2026-09-04T08:48:00Z',
    provider: 'stripe',
    status: 'completed',
  },
};

function renderReceipt(overrides: Partial<ComponentProps<typeof PaymentSuccessReceipt>> = {}) {
  const actions = {
    onPrintReceipt: vi.fn(),
    onReturn: vi.fn(),
    onStayHere: vi.fn(),
    onPayRemainingBalance: vi.fn(),
  };

  const view = render(
    <PaymentSuccessReceipt
      shoot={shoot}
      fullAddress="2 Topwood Court, Parkville, MD, 21234"
      scheduledAtLabel="Friday, September 4, 2026 at 8:30 AM"
      amountDue={25}
      lastPaymentAmount={75}
      fallbackPaymentAmount={75}
      subtotalAmount={100}
      invoiceAdjustmentsTotal={0}
      autoReturnCancelled={false}
      isPopup={false}
      countdownSeconds={8}
      autoActionSeconds={8}
      canReturn
      {...actions}
      {...overrides}
    />,
  );

  return { ...view, actions };
}

describe('PaymentSuccessReceipt', () => {
  it('keeps the receipt vertically scrollable within the viewport', () => {
    const { container } = renderReceipt();

    expect(container.firstElementChild).toHaveClass(
      'h-screen',
      'overflow-x-hidden',
      'overflow-y-auto',
    );
    expect(screen.getByText('Success receipt')).toBeInTheDocument();
    expect(screen.getByText('Partial payment applied')).toBeInTheDocument();
  });

  it('forwards receipt actions to the payment page', () => {
    const { actions } = renderReceipt();

    fireEvent.click(screen.getByRole('button', { name: 'Print receipt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Return' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stay here' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pay remaining balance' }));

    expect(actions.onPrintReceipt).toHaveBeenCalledOnce();
    expect(actions.onReturn).toHaveBeenCalledOnce();
    expect(actions.onStayHere).toHaveBeenCalledOnce();
    expect(actions.onPayRemainingBalance).toHaveBeenCalledOnce();
  });
});
