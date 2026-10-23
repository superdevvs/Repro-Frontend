import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import AuthenticatedPaymentReturnPage from './AuthenticatedPaymentReturnPage';
import { PAYMENT_CONFIRMATION_MAX_ATTEMPTS, PAYMENT_CONFIRMATION_RETRY_DELAY_MS } from '@/utils/paymentConfirmationRetry';

const mocks = vi.hoisted(() => ({
  queryClient: { invalidateQueries: vi.fn() },
  dashboard: vi.fn(), invoices: vi.fn(), history: vi.fn(), detail: vi.fn(),
}));
vi.mock('axios', () => ({ default: { post: vi.fn(), isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError) } }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => mocks.queryClient }));
vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://example.test' }));
vi.mock('@/realtime/realtimeRefreshBus', () => ({
  triggerDashboardOverviewRefresh: mocks.dashboard,
  triggerInvoicesRefresh: mocks.invoices,
  triggerShootHistoryRefresh: mocks.history,
  triggerShootDetailRefresh: mocks.detail,
}));

const recorded = (sessionId = 'cs_paid') => ({ data: { outcome: 'already_processed', session_payment_status: 'paid',
  payment_recorded: true, reconciled: false, session_id: sessionId, last_payment_amount: '123.45' } });
const busy = { data: { outcome: 'busy', session_payment_status: 'paid', payment_recorded: false, session_id: 'cs_paid',
  payment_status: 'paid', total_paid: 123.45, remaining_balance: 0 } };

function renderPage(query = '?session_id=cs_paid') {
  return render(<MemoryRouter initialEntries={[`/payment-return/shoot/42${query}`]}>
    <Routes>
      <Route path="/payment-return/shoot/:shootId" element={<AuthenticatedPaymentReturnPage />} />
      <Route path="/dashboard" element={<h1>Dashboard destination</h1>} />
      <Route path="/invoices" element={<h1>Invoices destination</h1>} />
    </Routes>
  </MemoryRouter>);
}

function expectNoRefresh() {
  for (const refresh of [mocks.dashboard, mocks.invoices, mocks.history, mocks.detail, mocks.queryClient.invalidateQueries]) expect(refresh).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.mocked(axios.post).mockReset();
  localStorage.clear();
  localStorage.setItem('authToken', 'test-owner-token');
});
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); });

describe('authenticated payment return confirmation', () => {
  it('waits for a busy exact session and recognizes the webhook-recorded result, refreshing once', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce(busy).mockResolvedValueOnce(recorded());
    await act(async () => { renderPage(); });
    expect(screen.getByText('Confirming payment...')).toBeInTheDocument();
    expect(screen.queryByText('Payment Successful!')).not.toBeInTheDocument();
    expectNoRefresh();
    await act(async () => { await vi.advanceTimersByTimeAsync(PAYMENT_CONFIRMATION_RETRY_DELAY_MS); });
    expect(screen.getByRole('heading', { name: 'Payment Successful!' })).toBeInTheDocument();
    expect(screen.getByText('Your payment of $123.45 has been processed successfully.')).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(axios.post).mock.calls) {
      expect(call).toEqual(['https://example.test/api/shoots/42/confirm-stripe-session', { session_id: 'cs_paid' }, {
        signal: expect.any(AbortSignal), timeout: 10000,
        headers: { Authorization: 'Bearer test-owner-token', 'Content-Type': 'application/json' },
      }]);
    }
    for (const refresh of [mocks.dashboard, mocks.invoices, mocks.history, mocks.detail, mocks.queryClient.invalidateQueries]) expect(refresh).toHaveBeenCalledTimes(1);
    expect(mocks.detail).toHaveBeenCalledWith('42');
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['clientBilling'] });
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, 408, 429, 500, 503])('retries a transient request failure (%s)', async status => {
    const error = status ? { isAxiosError: true, response: { status } } : new Error('Network interruption');
    vi.mocked(axios.post).mockRejectedValueOnce(error).mockResolvedValueOnce(recorded());
    await act(async () => { renderPage(); });
    expect(screen.getByText('Confirming payment...')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(PAYMENT_CONFIRMATION_RETRY_DELAY_MS); });
    expect(screen.getByRole('heading', { name: 'Payment Successful!' })).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it('shows recoverable pending after bounded retries, then coalesces manual status checks for the same session', async () => {
    vi.mocked(axios.post).mockResolvedValue(busy);
    await act(async () => { renderPage(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(PAYMENT_CONFIRMATION_RETRY_DELAY_MS * (PAYMENT_CONFIRMATION_MAX_ATTEMPTS - 1)); });
    expect(screen.getByRole('heading', { name: 'Payment confirmation pending' })).toBeInTheDocument();
    expect(screen.queryByText('Unable to Confirm Payment')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Payment not completed' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('before making another payment');
    expect(screen.queryByRole('button', { name: /^Pay / })).not.toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(PAYMENT_CONFIRMATION_MAX_ATTEMPTS);
    expectNoRefresh();
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(axios.post).toHaveBeenCalledTimes(PAYMENT_CONFIRMATION_MAX_ATTEMPTS);
    vi.mocked(axios.post).mockResolvedValue(recorded());
    const check = screen.getByRole('button', { name: 'Check payment status' });
    await act(async () => { fireEvent.click(check); fireEvent.click(check); });
    expect(axios.post).toHaveBeenCalledTimes(PAYMENT_CONFIRMATION_MAX_ATTEMPTS + 1);
    expect(screen.getByRole('heading', { name: 'Payment Successful!' })).toBeInTheDocument();
    expect(mocks.dashboard).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403, 404, 422])('does not retry a permanent rejection (%s) or claim payment failure', async status => {
    vi.mocked(axios.post).mockRejectedValue({ isAxiosError: true, response: { status } });
    await act(async () => { renderPage(); });
    expect(screen.getByRole('heading', { name: 'Unable to Confirm Payment' })).toBeInTheDocument();
    expect(screen.queryByText('Payment Successful!')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check payment status' })).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expectNoRefresh();
    fireEvent.click(screen.getByRole('button', { name: 'Go to dashboard' }));
    expect(screen.getByRole('heading', { name: 'Dashboard destination' })).toBeInTheDocument();
  });

  it('reports the exact-session stale refund truthfully without retrying or publishing success', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { session_id: 'cs_paid', outcome: 'refunded_stale',
      session_payment_status: 'paid', payment_recorded: false, payment_refunded: true, message: 'This charge was refunded because the invoice changed.' } });
    await act(async () => { renderPage(); });
    expect(screen.getByRole('heading', { name: 'Payment refunded' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('This charge was refunded');
    expect(axios.post).toHaveBeenCalledTimes(1);
    expectNoRefresh();
  });

  it('reports a definitive unpaid decline without claiming success', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { session_id: 'cs_paid', outcome: 'declined', session_payment_status: 'unpaid', payment_recorded: false } });
    await act(async () => { renderPage(); });
    expect(screen.getByRole('heading', { name: 'Payment not completed' })).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(1);
    expectNoRefresh();
  });

  it('retries a paid session whose backend reconciliation failed, then recognizes its recorded payment', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { session_id: 'cs_paid', outcome: 'failed',
      session_payment_status: 'paid', payment_recorded: false } }).mockResolvedValueOnce(recorded());
    await act(async () => { renderPage(); });
    expect(screen.getByText('Confirming payment...')).toBeInTheDocument();
    expectNoRefresh();
    await act(async () => { await vi.advanceTimersByTimeAsync(PAYMENT_CONFIRMATION_RETRY_DELAY_MS); });
    expect(screen.getByRole('heading', { name: 'Payment Successful!' })).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(mocks.dashboard).toHaveBeenCalledTimes(1);
  });

  it.each(['paid', 'unpaid'])('keeps exhausted processing failures recoverable without asserting a failed charge (%s)', async paymentStatus => {
    vi.mocked(axios.post).mockResolvedValue({ data: { session_id: 'cs_paid', outcome: 'failed',
      session_payment_status: paymentStatus, payment_recorded: false } });
    await act(async () => { renderPage(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(PAYMENT_CONFIRMATION_RETRY_DELAY_MS * (PAYMENT_CONFIRMATION_MAX_ATTEMPTS - 1)); });
    expect(screen.getByRole('heading', { name: 'Payment confirmation pending' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check payment status' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Payment not completed' })).not.toBeInTheDocument();
    expect(screen.queryByText('Payment Successful!')).not.toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(PAYMENT_CONFIRMATION_MAX_ATTEMPTS);
    expectNoRefresh();
  });

  it.each([recorded('cs_other'), { data: '<html>Temporarily unavailable</html>' }, { data: { session_id: 'cs_paid', outcome: {}, reconciled: true } },
    { data: { payment_status: 'paid', total_paid: 123.45, remaining_balance: 0 } }])('rejects mismatched or malformed confirmation without aggregate-balance success', async response => {
    vi.mocked(axios.post).mockResolvedValue(response);
    await act(async () => { renderPage(); });
    expect(screen.getByRole('heading', { name: 'Unable to Confirm Payment' })).toBeInTheDocument();
    expect(screen.queryByText('Payment Successful!')).not.toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(1);
    expectNoRefresh();
  });

  it('cancels retry timers when the page unmounts', async () => {
    vi.mocked(axios.post).mockResolvedValue(busy);
    let page: ReturnType<typeof renderPage>;
    await act(async () => { page = renderPage(); });
    const signal = vi.mocked(axios.post).mock.calls[0][2]?.signal;
    page!.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expectNoRefresh();
  });

  it('keeps one confirmation in flight and ignores a late response after unmount', async () => {
    let finish!: (value: ReturnType<typeof recorded>) => void;
    vi.mocked(axios.post).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    let page: ReturnType<typeof renderPage>;
    await act(async () => { page = renderPage(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Check payment status' })).not.toBeInTheDocument();
    page!.unmount();
    await act(async () => { finish(recorded()); await vi.advanceTimersByTimeAsync(20000); });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expectNoRefresh();
  });

  it('rejects missing session details without a request', async () => {
    await act(async () => { renderPage(''); });
    expect(screen.getByRole('status')).toHaveTextContent('Missing payment session details');
    expect(axios.post).not.toHaveBeenCalled();
    expectNoRefresh();
  });

  it('returns only to a safe relative destination after verified success', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { ...recorded().data, return_to: '/invoices' } });
    await act(async () => { renderPage(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.getByRole('heading', { name: 'Invoices destination' })).toBeInTheDocument();
    expect(mocks.dashboard).toHaveBeenCalledTimes(1);
  });
});
