import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stripeFormSpy = vi.hoisted(() => vi.fn());

vi.mock('@/components/payments/StripePaymentForm', () => ({
  StripePaymentForm: (props: Record<string, unknown>) => {
    stripeFormSpy(props);
    return <div data-testid="stripe-payment-form">Stripe form</div>;
  },
}));

vi.mock('@/components/payments/MarkAsPaidDialog', () => ({
  MarkAsPaidDialog: () => null,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { PaymentDialog } from './PaymentDialog';

const invoice = {
  id: 'invoice-1',
  number: 'INV-1',
  client: 'Client',
  property: '100 Main St',
  date: '2026-09-04',
  dueDate: '2026-09-10',
  amount: 200,
  amountPaid: 50,
  balance: 150,
  status: 'pending' as const,
  services: ['Photos'],
  paymentMethod: '',
};

beforeEach(() => {
  stripeFormSpy.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('PaymentDialog Stripe wiring', () => {
  it('opens on Stripe and passes the canonical shoot id into checkout', async () => {
    render(
      <PaymentDialog
        invoice={invoice}
        isOpen
        onClose={vi.fn()}
        shootId="shoot-42"
      />,
    );

    expect(await screen.findByTestId('stripe-payment-form')).toBeInTheDocument();
    expect(stripeFormSpy.mock.calls.at(-1)?.[0]).toMatchObject({
      shootId: 'shoot-42',
      amount: 150,
    });
  });

  it('reports the amount confirmed by the Stripe form instead of the full invoice balance', async () => {
    const onPaymentComplete = vi.fn();
    render(
      <PaymentDialog
        invoice={invoice}
        isOpen
        onClose={vi.fn()}
        shootId="shoot-42"
        onPaymentComplete={onPaymentComplete}
      />,
    );

    await screen.findByTestId('stripe-payment-form');
    const props = stripeFormSpy.mock.calls.at(-1)?.[0] as {
      onPaymentSuccess: (payment: { status: 'success'; amount: number }) => Promise<void>;
    };
    await props.onPaymentSuccess({ status: 'success', amount: 40 });

    await waitFor(() => expect(onPaymentComplete).toHaveBeenCalledWith({
      invoiceId: 'invoice-1',
      paymentMethod: 'stripe',
      amount: 40,
    }));
  });
});
