import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stripeFormSpy = vi.hoisted(() => vi.fn());
const toastSpy = vi.hoisted(() => vi.fn());

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
  useToast: () => ({ toast: toastSpy }),
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
  toastSpy.mockClear();
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

  it('keeps a verified Stripe payment successful when invoice refresh rejects', async () => {
    const onClose = vi.fn();
    const onPaymentComplete = vi.fn().mockRejectedValue(new Error('Invoice refresh failed'));
    render(<PaymentDialog invoice={invoice} isOpen onClose={onClose} shootId="shoot-42" onPaymentComplete={onPaymentComplete} />);
    await screen.findByTestId('stripe-payment-form');
    const props = stripeFormSpy.mock.calls.at(-1)?.[0] as {
      onPaymentSuccess: (payment: { status: 'success'; amount: number }) => Promise<void>;
    };
    await props.onPaymentSuccess({ status: 'success', amount: 40 });

    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment Successful' }));
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Payment confirmed; invoice refresh unavailable',
      description: expect.stringContaining('already recorded'),
    }));
    expect(toastSpy).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment Failed' }));
    expect(onPaymentComplete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each(['resolves', 'rejects'])('does not let an old invoice refresh that %s close a newly opened invoice', async outcome => {
    const onClose = vi.fn();
    let finish!: () => void;
    const onPaymentComplete = vi.fn(() => new Promise<void>((resolve, reject) => {
      finish = () => outcome === 'resolves' ? resolve() : reject(new Error('Old invoice refresh failed'));
    }));
    const page = render(<PaymentDialog invoice={invoice} isOpen onClose={onClose} shootId="shoot-42" onPaymentComplete={onPaymentComplete} />);
    await screen.findByTestId('stripe-payment-form');
    const props = stripeFormSpy.mock.calls.at(-1)?.[0] as {
      onPaymentSuccess: (payment: { status: 'success'; amount: number }) => Promise<void>;
    };
    let completion!: Promise<void>;
    await act(async () => { completion = props.onPaymentSuccess({ status: 'success', amount: 40 }); });
    page.rerender(<PaymentDialog invoice={invoice} isOpen={false} onClose={onClose} />);
    page.rerender(<PaymentDialog invoice={{ ...invoice, id: 'invoice-2' }} isOpen onClose={onClose} shootId="shoot-43" />);
    await act(async () => { finish(); await completion; });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('stripe-payment-form')).toBeInTheDocument();
    expect(stripeFormSpy.mock.calls.at(-1)?.[0]).toMatchObject({ shootId: 'shoot-43' });
    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment Successful' }));
  });
});
