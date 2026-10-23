import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { HostedPaymentReturnNotice } from '@/components/payments/HostedPaymentReturnNotice';
import { PAYMENT_CONFIRMATION_MAX_ATTEMPTS, PAYMENT_CONFIRMATION_RETRY_DELAY_MS } from '@/utils/paymentConfirmationRetry';
import { useHostedPaymentReturn } from './useHostedPaymentReturn';

vi.mock('axios', () => ({ default: { post: vi.fn(), isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError) } }));
vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://example.test' }));

const recorded = (sessionId = 'cs_batch') => ({ data: { session_id: sessionId, outcome: 'already_processed',
  session_payment_status: 'paid', payment_recorded: true, reconciled: false, last_payment_amount: 300 } });
const busy = { data: { session_id: 'cs_batch', outcome: 'busy', session_payment_status: 'paid', payment_recorded: false,
  payment_status: 'paid', remaining_balance: 0, total_paid: 300 } };
const refresh = vi.fn();
const notify = vi.fn();

function Harness({ onConfirmed = refresh, onNotice = notify }: { onConfirmed?: () => unknown; onNotice?: typeof notify }) {
  const [params, setParams] = useSearchParams();
  const payment = useHostedPaymentReturn({ searchParams: params, setSearchParams: setParams, onConfirmed, notify: onNotice });
  return <>
    <HostedPaymentReturnNotice state={payment.state} onCheck={payment.checkStatus} />
    <div data-testid="query">{params.toString()}</div>
    <button disabled={payment.blockCheckout}>Pay another invoice</button>
    <button onClick={() => setParams(current => { const next = new URLSearchParams(current); next.set('tab', 'delivered'); return next; })}>Change tab</button>
    <button onClick={() => setParams(current => { const next = new URLSearchParams(current); next.set('session_id', 'cs_next'); return next; })}>Change session</button>
  </>;
}

const page = (props: Parameters<typeof Harness>[0] = {}, query = '?payment=success&session_id=cs_batch&tab=history') =>
  <MemoryRouter initialEntries={[`/shoot-history${query}`]}><Harness {...props} /></MemoryRouter>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.mocked(axios.post).mockReset();
  refresh.mockReset();
  localStorage.setItem('authToken', 'test-owner-token');
});
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); });

describe('hosted batch payment return', () => {
  it('waits for exact-session evidence, refreshes once, and removes only payment parameters', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce(busy).mockResolvedValueOnce(recorded());
    await act(async () => { render(page()); });
    expect(screen.getByRole('heading', { name: 'Confirming payment…' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay another invoice' })).toBeDisabled();
    expect(refresh).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(PAYMENT_CONFIRMATION_RETRY_DELAY_MS); });
    expect(screen.getByRole('heading', { name: 'Payment confirmed' })).toBeInTheDocument();
    expect(screen.getByTestId('query')).toHaveTextContent('tab=history');
    expect(screen.getByTestId('query')).not.toHaveTextContent('session_id');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Pay another invoice' })).toBeEnabled();
    for (const call of vi.mocked(axios.post).mock.calls) expect(call).toEqual([
      'https://example.test/api/payments/stripe-session/confirm', { session_id: 'cs_batch' }, {
        signal: expect.any(AbortSignal), timeout: 10000,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer test-owner-token' },
      },
    ]);
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, 408, 429, 500, 503])('retries a transient request failure (%s) for the same session', async status => {
    vi.mocked(axios.post).mockRejectedValueOnce(status ? { isAxiosError: true, response: { status } } : new Error('network'))
      .mockResolvedValueOnce(recorded());
    await act(async () => { render(page()); });
    await act(async () => { await vi.advanceTimersByTimeAsync(PAYMENT_CONFIRMATION_RETRY_DELAY_MS); });
    expect(screen.getByRole('heading', { name: 'Payment confirmed' })).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it('retries local reconciliation failure without treating a collected Stripe payment as failed', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { session_id: 'cs_batch', outcome: 'failed', session_payment_status: 'paid', payment_recorded: false } })
      .mockResolvedValueOnce(recorded());
    await act(async () => { render(page()); });
    expect(notify).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(PAYMENT_CONFIRMATION_RETRY_DELAY_MS); });
    expect(screen.getByRole('heading', { name: 'Payment confirmed' })).toBeInTheDocument();
  });

  it('retains a recoverable pending notice and blocks another checkout until a manual status check succeeds', async () => {
    vi.mocked(axios.post).mockResolvedValue(busy);
    await act(async () => { render(page()); });
    await act(async () => { await vi.advanceTimersByTimeAsync(PAYMENT_CONFIRMATION_RETRY_DELAY_MS * (PAYMENT_CONFIRMATION_MAX_ATTEMPTS - 1)); });
    expect(screen.getByRole('heading', { name: 'Payment confirmation pending' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('before making another payment');
    expect(screen.getByTestId('query')).toHaveTextContent('session_id=cs_batch');
    expect(screen.getByRole('button', { name: 'Pay another invoice' })).toBeDisabled();
    expect(refresh).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(axios.post).toHaveBeenCalledTimes(PAYMENT_CONFIRMATION_MAX_ATTEMPTS);
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(axios.post).toHaveBeenCalledTimes(PAYMENT_CONFIRMATION_MAX_ATTEMPTS);
    vi.mocked(axios.post).mockResolvedValue(recorded());
    await act(async () => {
      const button = screen.getByRole('button', { name: 'Check payment status' });
      fireEvent.click(button); fireEvent.click(button);
    });
    expect(axios.post).toHaveBeenCalledTimes(PAYMENT_CONFIRMATION_MAX_ATTEMPTS + 1);
    expect(screen.getByRole('heading', { name: 'Payment confirmed' })).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403, 404, 422])('does not retry permanent rejection (%s), clear the session, or offer another payment', async status => {
    vi.mocked(axios.post).mockRejectedValue({ isAxiosError: true, response: { status } });
    await act(async () => { render(page()); });
    expect(screen.getByRole('heading', { name: 'Payment confirmation unavailable' })).toBeInTheDocument();
    expect(screen.getByTestId('query')).toHaveTextContent('session_id=cs_batch');
    expect(screen.getByRole('button', { name: 'Pay another invoice' })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it.each([recorded('cs_other'), { data: '<html>Unavailable</html>' },
    { data: { session_id: 'cs_batch', outcome: {}, reconciled: true } },
    { data: { payment_status: 'paid', remaining_balance: 0, total_paid: 300 } }])('rejects mismatched or malformed responses without aggregate payment success', async response => {
    vi.mocked(axios.post).mockResolvedValue(response);
    await act(async () => { render(page()); });
    expect(screen.getByRole('heading', { name: 'Payment confirmation unavailable' })).toBeInTheDocument();
    expect(screen.getByTestId('query')).toHaveTextContent('session_id=cs_batch');
    expect(refresh).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('keeps the active attempt across callback and unrelated query changes and uses the latest refresh callback', async () => {
    let finish!: (value: ReturnType<typeof recorded>) => void;
    vi.mocked(axios.post).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(page()); });
    const signal = vi.mocked(axios.post).mock.calls[0][2]?.signal;
    const latestRefresh = vi.fn();
    await act(async () => { view.rerender(page({ onConfirmed: latestRefresh })); fireEvent.click(screen.getByRole('button', { name: 'Change tab' })); });
    expect(signal?.aborted).toBe(false);
    expect(axios.post).toHaveBeenCalledTimes(1);
    await act(async () => { finish(recorded()); });
    expect(latestRefresh).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByTestId('query')).toHaveTextContent('tab=delivered');
    expect(screen.getByTestId('query')).not.toHaveTextContent('session_id');
  });

  it('keeps one request in flight and ignores late completion after unmount', async () => {
    let finish!: (value: ReturnType<typeof recorded>) => void;
    vi.mocked(axios.post).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(page()); });
    const signal = vi.mocked(axios.post).mock.calls[0][2]?.signal;
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(axios.post).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => { finish(recorded()); await vi.advanceTimersByTimeAsync(20000); });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('cancels retry timers when the route is left', async () => {
    vi.mocked(axios.post).mockResolvedValue(busy);
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(page()); });
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('cannot publish or erase a newer checkout from an older in-flight response', async () => {
    let finishOld!: (value: ReturnType<typeof recorded>) => void;
    let finishNew!: (value: ReturnType<typeof recorded>) => void;
    vi.mocked(axios.post).mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }))
      .mockReturnValueOnce(new Promise(resolve => { finishNew = resolve; }));
    await act(async () => { render(page()); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Change session' })); });
    await act(async () => { finishOld(recorded()); });
    expect(screen.getByTestId('query')).toHaveTextContent('session_id=cs_next');
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => { finishNew(recorded('cs_next')); });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('shows a verified stale refund without publishing payment success', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { session_id: 'cs_batch', outcome: 'refunded_stale',
      session_payment_status: 'paid', payment_recorded: false, payment_refunded: true, message: 'This charge was refunded.' } });
    await act(async () => { render(page()); });
    expect(screen.getByRole('heading', { name: 'Payment refunded' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('This charge was refunded');
    expect(screen.getByTestId('query')).not.toHaveTextContent('session_id');
    expect(refresh).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('truthfully closes a definitively unpaid decline', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { session_id: 'cs_batch', outcome: 'declined', session_payment_status: 'unpaid', payment_recorded: false } });
    await act(async () => { render(page()); });
    expect(screen.getByRole('heading', { name: 'Checkout not completed' })).toBeInTheDocument();
    expect(screen.getByTestId('query')).not.toHaveTextContent('session_id');
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not turn a refresh failure into a payment failure or a second confirmation', async () => {
    refresh.mockRejectedValue(new Error('refresh unavailable'));
    vi.mocked(axios.post).mockResolvedValue(recorded());
    await act(async () => { render(page()); });
    expect(screen.getByRole('heading', { name: 'Payment confirmed' })).toBeInTheDocument();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment successful' }));
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('preserves confirmed payment and refreshes once if the notification callback throws', async () => {
    const brokenNotice = vi.fn(() => { throw new Error('notification unavailable'); });
    vi.mocked(axios.post).mockResolvedValue(recorded());
    await act(async () => { render(page({ onNotice: brokenNotice })); });
    expect(screen.getByRole('heading', { name: 'Payment confirmed' })).toBeInTheDocument();
    expect(screen.getByTestId('query')).not.toHaveTextContent('session_id');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(brokenNotice).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('can confirm a returned session without the optional success flag', async () => {
    vi.mocked(axios.post).mockResolvedValue(recorded());
    await act(async () => { render(page({}, '?session_id=cs_batch')); });
    expect(screen.getByRole('heading', { name: 'Payment confirmed' })).toBeInTheDocument();
  });

  it('does nothing when there is no checkout session', async () => {
    await act(async () => { render(page({}, '?tab=history')); });
    expect(screen.queryByRole('region', { name: 'Payment confirmation' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay another invoice' })).toBeEnabled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('keeps a success return with missing session details from reopening checkout', async () => {
    await act(async () => { render(page({}, '?payment=success')); });
    expect(screen.getByRole('heading', { name: 'Payment confirmation unavailable' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Missing checkout session details');
    expect(screen.getByRole('button', { name: 'Pay another invoice' })).toBeDisabled();
    expect(axios.post).not.toHaveBeenCalled();
  });
});
