import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const paymentDialogSpy = vi.hoisted(() => vi.fn());
const toastSpy = vi.hoisted(() => vi.fn());

vi.mock('@/components/payments/StripePaymentDialog', () => ({
  StripePaymentDialog: (props: Record<string, unknown>) => {
    paymentDialogSpy(props);
    return props.isOpen ? <div data-testid="payment-dialog">Payment dialog open</div> : null;
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}));

import { BookingComplete } from './BookingComplete';

const pricing = {
  serviceSubtotal: 125,
  discountType: null,
  discountValue: null,
  discountAmount: 0,
  discountedSubtotal: 125,
  taxAmount: 0,
  totalQuote: 125,
};

const resourceShoot = {
  id: '17',
  status: 'requested',
  location: { fullAddress: '17 Booking Way, Fairfax, VA 22030' },
  client: { name: 'Client', email: 'client@example.test' },
  serviceItems: [{
    id: '4',
    shoot_service_id: '91',
    name: 'Photos',
    subtotal: 125,
    paid_amount: 25,
    balance_due: 100,
  }],
  payment: {
    serviceSubtotal: 125,
    discountedSubtotal: 125,
    taxAmount: 0,
    totalQuote: 125,
    totalPaid: 25,
    remainingBalance: 100,
  },
};

const renderComplete = (props: Partial<React.ComponentProps<typeof BookingComplete>> = {}) => render(
  <MemoryRouter>
    <BookingComplete
      date={new Date(2026, 8, 15)}
      time="1:00 PM"
      resetForm={vi.fn()}
      isClientRequest
      shootId="17"
      totalAmount={125}
      pricing={pricing}
      {...props}
    />
  </MemoryRouter>,
);

beforeEach(() => {
  paymentDialogSpy.mockClear();
  toastSpy.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('BookingComplete canonical payment handoff', () => {
  it('opens requested-shoot payment with the canonical remaining balance and service rows', () => {
    renderComplete({ shoot: resourceShoot });

    fireEvent.click(screen.getByRole('button', { name: 'Pay Now - $100.00' }));

    expect(screen.getByTestId('payment-dialog')).toBeInTheDocument();
    const props = paymentDialogSpy.mock.calls.at(-1)?.[0];
    expect(props).toMatchObject({
      amount: 100,
      shootId: '17',
      totalQuote: 125,
      totalPaid: 25,
      clientCanSubmitOfflineIntent: true,
    });
    expect(props.serviceItems).toHaveLength(1);
    expect(props.serviceItems[0].id).toBe('91');
  });

  it('refetches a missing creation snapshot before payment can open', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          id: '17',
          address: '17 Booking Way',
          city: 'Fairfax',
          state: 'VA',
          zip: '22030',
          total_quote: 125,
          total_paid: 25,
          remaining_balance: 100,
          service_items: resourceShoot.serviceItems,
        },
      }),
    } as Response));
    vi.stubGlobal('fetch', fetchMock);

    renderComplete({ shoot: { id: '17' } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const payButton = await screen.findByRole('button', { name: 'Pay Now - $100.00' });
    fireEvent.click(payButton);

    expect(screen.getByTestId('payment-dialog')).toBeInTheDocument();
  });

  it('never opens payment without a valid created shoot id', () => {
    renderComplete({ shootId: undefined, shoot: undefined });

    const payButton = screen.getByRole('button', { name: /Pay Now/ });
    expect(payButton).toBeDisabled();
    expect(screen.queryByTestId('payment-dialog')).toBeNull();
  });
});
