import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { loadStripe } from '@stripe/stripe-js/pure';
import PaymentPage from './PaymentPage';
import { PAYMENT_CONFIRMATION_MAX_ATTEMPTS, PAYMENT_CONFIRMATION_RETRY_DELAY_MS } from '@/utils/paymentConfirmationRetry';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError),
  },
}));
vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://example.test', STRIPE_PUBLISHABLE_KEY: 'pk_test' }));
vi.mock('@/components/layout/Logo', () => ({ Logo: () => <span>RE Pro</span> }));
vi.mock('@stripe/stripe-js/pure', () => ({ loadStripe: vi.fn() }));

const shoot = {
  id: 42,
  address: '100 Test Street',
  total_quote: 100,
  base_quote: 100,
  tax_amount: 0,
  services: [{ name: 'Photography' }],
  payments: [],
};

function confirmation(amount = 100, sessionId = 'cs_paid') {
  return {
    data: {
      outcome: 'already_processed',
      session_payment_status: 'paid',
      payment_recorded: true,
      session_id: sessionId,
      last_payment_amount: amount,
      shoot: {
        ...shoot,
        payments: [{ amount, status: 'completed' }],
        receipt: {
          number: 'R-42', amount, currency: 'USD', paid_at: null,
          provider: 'stripe', status: 'completed',
        },
      },
    },
  };
}

function renderPage(query = '') {
  return render(
    <MemoryRouter initialEntries={[`/payment/test-token${query}`]}>
      <Routes><Route path="/payment/:token" element={<PaymentPage />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(axios.get).mockReset();
  vi.mocked(axios.post).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('public payment status recovery', () => {
  it('recovers the signed-in owner receipt when the original payment link is reopened', async () => {
    localStorage.setItem('authToken', 'test-owner');
    vi.mocked(axios.get).mockRejectedValueOnce({ isAxiosError: true, response: { status: 410 } })
      .mockResolvedValueOnce({ data: { data: confirmation().data.shoot } });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Already Paid' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(axios.get).toHaveBeenLastCalledWith('https://example.test/api/payments/receipt/test-token', { timeout: 10000 });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it.each([404, 409])('does not claim success if receipt recovery is rejected (%s)', async (status) => {
    localStorage.setItem('authToken', 'test-other');
    vi.mocked(axios.get).mockRejectedValueOnce({ isAxiosError: true, response: { status: 410 } })
      .mockRejectedValueOnce({ isAxiosError: true, response: { status } });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Unable to Load Payment' })).toBeInTheDocument();
    expect(screen.queryByText('Already Paid')).not.toBeInTheDocument();
  });

  it('does not treat an unexpected receipt response as a paid bill', async () => {
    localStorage.setItem('authToken', 'test-owner');
    vi.mocked(axios.get).mockRejectedValueOnce({ isAxiosError: true, response: { status: 410 } })
      .mockResolvedValueOnce({ data: '<html>Unavailable</html>' });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Unable to Load Payment' })).toBeInTheDocument();
    expect(screen.queryByText('Already Paid')).not.toBeInTheDocument();
  });

  it('polls only the exact checkout session, without refetching the closing public link', async () => {
    vi.useFakeTimers();
    vi.mocked(axios.get).mockResolvedValue({ data: shoot });
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { clientSecret: 'test-secret', sessionId: 'cs_paid' } })
      .mockResolvedValueOnce({ data: { outcome: 'busy', session_id: 'cs_paid', payment_recorded: false } })
      .mockResolvedValueOnce(confirmation());
    vi.mocked(loadStripe).mockResolvedValue({ initEmbeddedCheckout: vi.fn().mockResolvedValue({ mount: vi.fn(), destroy: vi.fn() }) } as never);
    await act(async () => { renderPage(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pay $100.00' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(screen.getByText('Payment received')).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(9000); });
    expect(axios.post).toHaveBeenCalledTimes(3);
  });
  it.each([403, 404, 410])('explains an unavailable link (HTTP %s) without a generic 404', async (status) => {
    vi.mocked(axios.get).mockRejectedValue({ isAxiosError: true, response: { status } });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Unable to Load Payment' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('If you just submitted a payment, check its status before paying again.');
    expect(screen.getByRole('link', { name: 'Go to login' })).toHaveAttribute('href', '/login');
    expect(screen.queryByText('This page is under a different plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment received')).not.toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('clears a temporary load error when the user retries', async () => {
    vi.mocked(axios.get)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: shoot });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Review & pay' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rechecks only the existing session after a confirmation failure, then shows its receipt', async () => {
    vi.useFakeTimers();
    vi.mocked(axios.post)
      .mockRejectedValue({ isAxiosError: true, response: { status: 500 } });
    await act(async () => { renderPage('?success=true&session_id=cs_paid'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(PAYMENT_CONFIRMATION_RETRY_DELAY_MS * (PAYMENT_CONFIRMATION_MAX_ATTEMPTS - 1)); });

    expect(screen.getByRole('heading', { name: 'Payment confirmation pending' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Pay \$/ })).not.toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
    vi.mocked(axios.post).mockResolvedValue(confirmation());
    const check = screen.getByRole('button', { name: 'Check payment status' });
    await act(async () => { fireEvent.click(check); fireEvent.click(check); });

    expect(screen.getByText('Payment received')).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(PAYMENT_CONFIRMATION_MAX_ATTEMPTS + 1);
    for (const call of vi.mocked(axios.post).mock.calls) {
      expect(call).toEqual(['https://example.test/api/public/payments/test-token/confirm', { session_id: 'cs_paid' }, { timeout: 10000, signal: expect.any(AbortSignal) }]);
    }
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('confirms a returned session even when the success flag is absent', async () => {
    vi.mocked(axios.post).mockResolvedValue(confirmation());
    renderPage('?session_id=cs_paid');
    expect(await screen.findByText('Payment received')).toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('does not accept confirmation for a different session', async () => {
    vi.mocked(axios.post).mockResolvedValue(confirmation(100, 'cs_other'));
    renderPage('?success=true&session_id=cs_paid');
    expect(await screen.findByRole('heading', { name: 'Unable to Confirm Payment' })).toBeInTheDocument();
    expect(screen.queryByText('Payment received')).not.toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('automatically rechecks the exact session while another request holds the reconciliation lock', async () => {
    vi.useFakeTimers();
    vi.mocked(axios.post)
      .mockResolvedValueOnce({ data: {
        outcome: 'busy', payment_status: 'paid', remaining_balance: 0,
        session_payment_status: 'paid', session_id: 'cs_paid', payment_recorded: false,
      } })
      .mockResolvedValueOnce(confirmation());
    await act(async () => { renderPage('?success=true&session_id=cs_paid'); });

    expect(screen.getByText('Confirming payment...')).toBeInTheDocument();
    expect(screen.queryByText('Payment received')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Pay \$/ })).not.toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(PAYMENT_CONFIRMATION_RETRY_DELAY_MS); });
    expect(screen.getByText('Payment received')).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post).toHaveBeenLastCalledWith('https://example.test/api/public/payments/test-token/confirm', { session_id: 'cs_paid' }, { timeout: 10000, signal: expect.any(AbortSignal) });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('stops automatic retries after the lock window and allows another exact-session check', async () => {
    vi.useFakeTimers();
    vi.mocked(axios.post).mockResolvedValue({ data: {
      outcome: 'pending', session_payment_status: 'unpaid', session_id: 'cs_paid', payment_recorded: false,
    } });
    await act(async () => { renderPage('?success=true&session_id=cs_paid'); });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_CONFIRMATION_RETRY_DELAY_MS * (PAYMENT_CONFIRMATION_MAX_ATTEMPTS - 1));
    });
    expect(screen.getByRole('heading', { name: 'Payment confirmation pending' })).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(PAYMENT_CONFIRMATION_MAX_ATTEMPTS);
    await act(async () => { await vi.advanceTimersByTimeAsync(PAYMENT_CONFIRMATION_RETRY_DELAY_MS * 2); });
    expect(axios.post).toHaveBeenCalledTimes(PAYMENT_CONFIRMATION_MAX_ATTEMPTS);
    expect(axios.get).not.toHaveBeenCalled();

    vi.mocked(axios.post).mockResolvedValue(confirmation());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check payment status' })); });
    expect(screen.getByText('Payment received')).toBeInTheDocument();
    expect(axios.post).toHaveBeenLastCalledWith('https://example.test/api/public/payments/test-token/confirm', { session_id: 'cs_paid' }, { timeout: 10000, signal: expect.any(AbortSignal) });
  });

  it('cancels retry timers when the payment page closes', async () => {
    vi.useFakeTimers();
    vi.mocked(axios.post).mockRejectedValue(new Error('Network timeout'));
    let view: ReturnType<typeof renderPage>;
    await act(async () => { view = renderPage('?success=true&session_id=cs_paid'); });
    view!.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('does not automatically retry a rejected ownership check', async () => {
    vi.useFakeTimers();
    vi.mocked(axios.post).mockRejectedValue({ isAxiosError: true, response: { status: 403 } });
    await act(async () => { renderPage('?success=true&session_id=cs_paid'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(screen.getByRole('heading', { name: 'Unable to Confirm Payment' })).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('still allows paying a confirmed partial payment balance', async () => {
    vi.mocked(axios.post).mockResolvedValue(confirmation(40));
    renderPage('?success=true&session_id=cs_paid');
    fireEvent.click(await screen.findByRole('button', { name: 'Pay remaining balance' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pay $60.00' })).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Unable to Confirm Payment' })).not.toBeInTheDocument();
  });

  it.each([408, 429, 500, 503])('automatically recovers a temporary HTTP %s without asking for a second payment', async status => {
    vi.useFakeTimers();
    vi.mocked(axios.post).mockRejectedValueOnce({ isAxiosError: true, response: { status } })
      .mockResolvedValueOnce(confirmation());
    await act(async () => { renderPage('?session_id=cs_paid'); });
    expect(screen.getByText('Confirming payment...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Pay \$/ })).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(PAYMENT_CONFIRMATION_RETRY_DELAY_MS); });
    expect(screen.getByText('Payment received')).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('recovers a paid session after a reconciliation failure', async () => {
    vi.useFakeTimers();
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { session_id: 'cs_paid', outcome: 'failed', session_payment_status: 'paid', payment_recorded: false } })
      .mockResolvedValueOnce(confirmation());
    await act(async () => { renderPage('?session_id=cs_paid'); });
    expect(screen.getByText('Confirming payment...')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(PAYMENT_CONFIRMATION_RETRY_DELAY_MS); });
    expect(screen.getByText('Payment received')).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it('uses embedded completion to confirm the same session, without treating the SDK callback as payment proof', async () => {
    vi.useFakeTimers();
    let onComplete!: () => void;
    vi.mocked(axios.get).mockResolvedValue({ data: shoot });
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { clientSecret: 'test-secret', sessionId: 'cs_paid' } })
      .mockResolvedValueOnce({ data: { session_id: 'cs_paid', outcome: 'busy', payment_recorded: false } })
      .mockResolvedValueOnce(confirmation());
    const initEmbeddedCheckout = vi.fn().mockImplementation(async options => {
      onComplete = options.onComplete;
      return { mount: vi.fn(), destroy: vi.fn() };
    });
    vi.mocked(loadStripe).mockResolvedValue({ initEmbeddedCheckout } as never);
    await act(async () => { renderPage(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pay $100.00' })); await vi.advanceTimersByTimeAsync(20); });
    expect(onComplete).toEqual(expect.any(Function));
    await act(async () => { onComplete(); onComplete(); });
    expect(screen.getByText('Confirming payment...')).toBeInTheDocument();
    expect(screen.queryByText('Payment received')).not.toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(PAYMENT_CONFIRMATION_RETRY_DELAY_MS); });
    expect(screen.getByText('Payment received')).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(3);
    expect(vi.mocked(axios.post).mock.calls.filter(call => String(call[0]).endsWith('/checkout'))).toHaveLength(1);
  });

  it('aborts an in-flight returned confirmation and ignores its result after unmount', async () => {
    let finish!: (value: ReturnType<typeof confirmation>) => void;
    vi.mocked(axios.post).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    let view!: ReturnType<typeof renderPage>;
    await act(async () => { view = renderPage('?session_id=cs_paid'); });
    const signal = vi.mocked(axios.post).mock.calls[0][2]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => { finish(confirmation()); });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('reports an exact-session refund truthfully without payment success or another checkout', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { session_id: 'cs_paid', outcome: 'refunded_stale', session_payment_status: 'paid',
      payment_recorded: false, payment_refunded: true, message: 'This charge was refunded because the invoice changed.' } });
    renderPage('?session_id=cs_paid');
    expect(await screen.findByRole('heading', { name: 'Payment refunded' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('This charge was refunded');
    expect(screen.queryByText('Payment received')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Pay \$/ })).not.toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it.each(['true', '1'])('blocks a success return without checkout details (%s) instead of offering another payment', async success => {
    renderPage(`?success=${success}`);
    expect(await screen.findByRole('heading', { name: 'Unable to Confirm Payment' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Missing checkout session details');
    expect(screen.queryByRole('button', { name: /^Pay \$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check payment status' })).not.toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });
});
