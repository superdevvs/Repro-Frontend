import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { loadStripe } from '@stripe/stripe-js/pure';
import { SquarePaymentForm } from './SquarePaymentForm';

const mocks = vi.hoisted(() => ({ toast: vi.fn(), dashboard: vi.fn(), invoices: vi.fn(), history: vi.fn(), detail: vi.fn(),
  mount: vi.fn(), destroy: vi.fn(), init: vi.fn(), options: [] as Array<{ onComplete: () => void; clientSecret: string }> }));
vi.mock('axios', () => ({ default: { post: vi.fn(), isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError) } }));
vi.mock('@stripe/stripe-js/pure', () => ({ loadStripe: vi.fn() }));
vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://example.test', STRIPE_PUBLISHABLE_KEY: 'pk_test' }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/realtime/realtimeRefreshBus', () => ({ triggerDashboardOverviewRefresh: mocks.dashboard,
  triggerInvoicesRefresh: mocks.invoices, triggerShootHistoryRefresh: mocks.history, triggerShootDetailRefresh: mocks.detail }));

const busy = (session = 'cs_42') => ({ data: { session_id: session, outcome: 'busy', session_payment_status: 'paid', payment_recorded: false } });
const paid = (session = 'cs_42') => ({ data: { session_id: session, outcome: 'already_processed', session_payment_status: 'paid', payment_recorded: true, last_payment_amount: 100 } });
const confirmationCalls = () => vi.mocked(axios.post).mock.calls.filter(([url]) => String(url).endsWith('/confirm') || String(url).endsWith('/confirm-stripe-session'));
const createCalls = () => vi.mocked(axios.post).mock.calls.filter(call => !confirmationCalls().includes(call));
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

async function openCheckout() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pay $100.00 with Stripe' })); });
  const confirm = screen.getByRole('button', { name: 'Pay with Stripe' });
  await act(async () => { fireEvent.click(confirm); fireEvent.click(confirm); });
  await advance(32);
}

function noPaymentEffects() {
  for (const refresh of [mocks.dashboard, mocks.invoices, mocks.history, mocks.detail]) expect(refresh).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); vi.mocked(axios.post).mockReset(); mocks.options.length = 0;
  localStorage.clear(); localStorage.setItem('authToken', 'test-token');
  mocks.init.mockImplementation(async options => { mocks.options.push(options); return { mount: mocks.mount, destroy: mocks.destroy }; });
  vi.mocked(loadStripe).mockResolvedValue({ initEmbeddedCheckout: mocks.init } as never);
});
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); });

describe('real embedded payment form session lifecycle', () => {
  it.each([false, true])('serializes slow single/bulk confirmation and publishes success only once (bulk=%s)', async bulk => {
    let finish!: (value: ReturnType<typeof busy>) => void;
    let checks = 0;
    vi.mocked(axios.post).mockImplementation(async url => {
      if (!String(url).includes('confirm')) return { data: { sessionId: 'cs_42', clientSecret: 'secret_42' } };
      checks += 1;
      if (checks === 1) return new Promise(resolve => { finish = resolve; });
      return paid();
    });
    const success = vi.fn();
    render(<SquarePaymentForm amount={100} {...(bulk ? { shootIds: ['42', '43'] } : { shootId: '42' })} onPaymentSuccess={success} />);
    await openCheckout();
    expect(createCalls()).toHaveLength(1);
    await advance(3000); await advance(15000);
    expect(confirmationCalls()).toHaveLength(1); expect(success).not.toHaveBeenCalled(); noPaymentEffects();
    const [, body, config] = confirmationCalls()[0];
    expect(body).toEqual({ session_id: 'cs_42' }); expect(config).toMatchObject({ timeout: 10000, signal: expect.any(AbortSignal) });
    await act(async () => { finish(busy()); });
    await advance(2999); expect(confirmationCalls()).toHaveLength(1);
    await advance(1);
    expect(success).toHaveBeenCalledTimes(1); expect(success).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', amount: 100 }));
    expect(mocks.dashboard).toHaveBeenCalledTimes(1); expect(mocks.invoices).toHaveBeenCalledTimes(1); expect(mocks.history).toHaveBeenCalledTimes(1);
    expect(mocks.detail.mock.calls).toEqual(bulk ? [['42'], ['43']] : [['42']]);
    await act(async () => { mocks.options[0].onComplete(); mocks.options[0].onComplete(); });
    await advance(30000); expect(confirmationCalls()).toHaveLength(2); expect(success).toHaveBeenCalledTimes(1);
  });

  it('treats duplicate Stripe completion callbacks as a check hint, with bounded recoverable pending', async () => {
    let recorded = false;
    vi.mocked(axios.post).mockImplementation(async url => !String(url).includes('confirm')
      ? { data: { sessionId: 'cs_42', clientSecret: 'secret_42' } } : recorded ? paid() : busy());
    const success = vi.fn(); render(<SquarePaymentForm amount={100} shootId="42" onPaymentSuccess={success} />);
    await openCheckout();
    await act(async () => { mocks.options[0].onComplete(); mocks.options[0].onComplete(); });
    await advance(18000);
    expect(confirmationCalls()).toHaveLength(6); expect(success).not.toHaveBeenCalled(); noPaymentEffects();
    expect(screen.getByRole('status')).toHaveTextContent('confirmation is pending');
    expect(screen.getByRole('button', { name: 'Pay $100.00 with Stripe' })).toBeDisabled();
    await advance(10000); expect(confirmationCalls()).toHaveLength(6);
    recorded = true;
    await act(async () => { const button = screen.getByRole('button', { name: 'Check payment status' }); fireEvent.click(button); fireEvent.click(button); });
    await advance(3000); expect(confirmationCalls()).toHaveLength(7); expect(success).toHaveBeenCalledTimes(1); expect(createCalls()).toHaveLength(1);
  });

  it('retains a closed uncertain checkout for checking instead of creating a second one', async () => {
    let recorded = false;
    vi.mocked(axios.post).mockImplementation(async url => !String(url).includes('confirm')
      ? { data: { sessionId: 'cs_42', clientSecret: 'secret_42' } } : recorded ? paid() : busy());
    const success = vi.fn(); render(<SquarePaymentForm amount={100} shootId="42" onPaymentSuccess={success} />);
    await openCheckout(); fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); await advance(10000);
    const calls = confirmationCalls().length; await advance(20000); expect(confirmationCalls()).toHaveLength(calls);
    expect(screen.getByRole('button', { name: 'Pay $100.00 with Stripe' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Resume secure checkout' })).toBeInTheDocument();
    recorded = true; fireEvent.click(screen.getByRole('button', { name: 'Check payment status' })); await advance(3000);
    expect(success).toHaveBeenCalledTimes(1); expect(createCalls()).toHaveLength(1);
  });

  it('resumes the same checkout without allowing its old close timer to stop confirmation', async () => {
    let recorded = false;
    vi.mocked(axios.post).mockImplementation(async url => !String(url).includes('confirm')
      ? { data: { sessionId: 'cs_42', clientSecret: 'secret_42' } } : recorded ? paid() : busy());
    const success = vi.fn(); render(<SquarePaymentForm amount={100} shootId="42" onPaymentSuccess={success} />);
    await openCheckout(); fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); await advance(1000);
    fireEvent.click(screen.getByRole('button', { name: 'Resume secure checkout' })); await advance(32); await advance(10000);
    expect(mocks.init).toHaveBeenCalledTimes(2); expect(createCalls()).toHaveLength(1);
    expect(mocks.options.map(option => option.clientSecret)).toEqual(['secret_42', 'secret_42']);
    recorded = true; await advance(3000); expect(success).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('aborts on unmount and ignores late single/bulk proof (bulk=%s)', async bulk => {
    let finish!: (value: ReturnType<typeof paid>) => void;
    vi.mocked(axios.post).mockImplementation(async url => !String(url).includes('confirm')
      ? { data: { sessionId: 'cs_42', clientSecret: 'secret_42' } } : new Promise(resolve => { finish = resolve; }));
    const success = vi.fn(); const error = vi.fn();
    const view = render(<SquarePaymentForm amount={100} {...(bulk ? { shootIds: ['42', '43'] } : { shootId: '42' })} onPaymentSuccess={success} onPaymentError={error} />);
    await openCheckout(); await advance(3000);
    const signal = confirmationCalls()[0][2]?.signal;
    view.unmount(); expect(signal?.aborted).toBe(true);
    await act(async () => { finish(paid()); mocks.options[0].onComplete(); }); await advance(20000);
    expect(success).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled(); noPaymentEffects(); expect(confirmationCalls()).toHaveLength(1);
  });

  it('ignores the replaced shoot session and its close timer while confirming the new one', async () => {
    let oldFinish!: (value: ReturnType<typeof paid>) => void;
    vi.mocked(axios.post).mockImplementation(async (url, body) => {
      if (!String(url).includes('confirm')) return { data: String(url).includes('/77/') ? { sessionId: 'cs_77', clientSecret: 'secret_77' } : { sessionId: 'cs_42', clientSecret: 'secret_42' } };
      return (body as { session_id: string }).session_id === 'cs_42' ? new Promise(resolve => { oldFinish = resolve; }) : paid('cs_77');
    });
    const success = vi.fn(); const view = render(<SquarePaymentForm amount={100} shootId="42" onPaymentSuccess={success} />);
    await openCheckout(); await advance(3000); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    view.rerender(<SquarePaymentForm amount={100} shootId="77" onPaymentSuccess={success} />);
    await openCheckout(); await act(async () => { oldFinish(paid()); mocks.options[0].onComplete(); });
    expect(success).not.toHaveBeenCalled(); noPaymentEffects(); await advance(3000); await advance(10000);
    expect(success).toHaveBeenCalledTimes(1); expect(mocks.detail.mock.calls).toEqual([['77']]); expect(createCalls()).toHaveLength(2);
  });

  it('settles an exact stale refund once and never emits success', async () => {
    vi.mocked(axios.post).mockImplementation(async url => !String(url).includes('confirm')
      ? { data: { sessionId: 'cs_42', clientSecret: 'secret_42' } } : { data: { ...busy().data, outcome: 'refunded_stale', payment_refunded: true } });
    const success = vi.fn(); const error = vi.fn(); render(<SquarePaymentForm amount={100} shootId="42" onPaymentSuccess={success} onPaymentError={error} />);
    await openCheckout(); await advance(3000); await act(async () => { mocks.options[0].onComplete(); mocks.options[0].onComplete(); }); await advance(20000);
    expect(error).toHaveBeenCalledTimes(1); expect(success).not.toHaveBeenCalled(); noPaymentEffects(); expect(confirmationCalls()).toHaveLength(1);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment refunded' }));
  });

  it('does not relabel a recorded charge when a consumer refresh callback rejects', async () => {
    vi.mocked(axios.post).mockImplementation(async url => !String(url).includes('confirm')
      ? { data: { sessionId: 'cs_42', clientSecret: 'secret_42' } } : paid());
    const error = vi.fn(); render(<SquarePaymentForm amount={100} shootId="42" onPaymentSuccess={async () => { throw new Error('Refresh unavailable'); }} onPaymentError={error} />);
    await openCheckout(); await advance(3000);
    expect(error).not.toHaveBeenCalled(); expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment Failed' }));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment received' })); expect(mocks.dashboard).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('recovers from network and processing failures without offering a new checkout (bulk=%s)', async bulk => {
    let checks = 0;
    vi.mocked(axios.post).mockImplementation(async url => {
      if (!String(url).includes('confirm')) return { data: { sessionId: 'cs_42', clientSecret: 'secret_42' } };
      checks += 1;
      if (checks === 1) throw new Error('Network unavailable');
      if (checks === 2) throw { isAxiosError: true, response: { status: 503 } };
      if (checks === 3) return { data: { ...busy().data, outcome: 'failed' } };
      return paid();
    });
    const success = vi.fn(); const error = vi.fn();
    render(<SquarePaymentForm amount={100} {...(bulk ? { shootIds: ['42', '43'] } : { shootId: '42' })} onPaymentSuccess={success} onPaymentError={error} />);
    await openCheckout(); await act(async () => { mocks.options[0].onComplete(); });
    await advance(9000);
    expect(success).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled(); noPaymentEffects();
    expect(screen.getByRole('button', { name: 'Pay $100.00 with Stripe' })).toBeDisabled();
    await advance(3000); expect(success).toHaveBeenCalledTimes(1); expect(error).not.toHaveBeenCalled(); expect(createCalls()).toHaveLength(1);
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment Failed' }));
  });

  it.each([
    { label: 'different session proof', response: paid('cs_unrelated') },
    { label: 'malformed proof', response: { data: { ...paid().data, payment_recorded: 'true' } } },
    { label: 'permanent authorization failure', response: null },
  ])('pauses $label without success and permits only same-session status recovery', async ({ response }) => {
    let recovered = false;
    vi.mocked(axios.post).mockImplementation(async url => {
      if (!String(url).includes('confirm')) return { data: { sessionId: 'cs_42', clientSecret: 'secret_42' } };
      if (recovered) return paid();
      if (!response) throw { isAxiosError: true, response: { status: 403 } };
      return response;
    });
    const success = vi.fn(); const error = vi.fn(); render(<SquarePaymentForm amount={100} shootId="42" onPaymentSuccess={success} onPaymentError={error} />);
    await openCheckout(); await advance(30000);
    expect(confirmationCalls()).toHaveLength(1); expect(success).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled(); noPaymentEffects();
    expect(screen.getByRole('status')).toHaveTextContent(/could not verify|unavailable/);
    expect(screen.getByRole('button', { name: 'Pay $100.00 with Stripe' })).toBeDisabled();
    recovered = true; fireEvent.click(screen.getByRole('button', { name: 'Check payment status' })); await advance(3000);
    expect(success).toHaveBeenCalledTimes(1); expect(createCalls()).toHaveLength(1);
    expect(confirmationCalls().map(call => call[1])).toEqual([{ session_id: 'cs_42' }, { session_id: 'cs_42' }]);
  });

  it('retains the session after Stripe fails to mount and resumes its existing secret', async () => {
    let recorded = false;
    mocks.init.mockRejectedValueOnce(new Error('SDK unavailable'));
    vi.mocked(axios.post).mockImplementation(async url => !String(url).includes('confirm')
      ? { data: { sessionId: 'cs_42', clientSecret: 'secret_42' } } : recorded ? paid() : busy());
    const success = vi.fn(); const error = vi.fn(); render(<SquarePaymentForm amount={100} shootId="42" onPaymentSuccess={success} onPaymentError={error} />);
    await openCheckout();
    expect(screen.getByRole('status')).toHaveTextContent('Checkout could not be displayed');
    expect(error).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Pay $100.00 with Stripe' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Resume secure checkout' })); await advance(32);
    expect(mocks.init).toHaveBeenCalledTimes(2); expect(createCalls()).toHaveLength(1);
    expect(mocks.options[0].clientSecret).toBe('secret_42');
    recorded = true; await advance(3000); expect(success).toHaveBeenCalledTimes(1);
  });

  it.each(['throw', 'reject'])('preserves recorded success when the checkout UI callback fails (%s)', async failure => {
    vi.mocked(axios.post).mockImplementation(async url => !String(url).includes('confirm')
      ? { data: { sessionId: 'cs_42', clientSecret: 'secret_42' } } : paid());
    const success = vi.fn(); const error = vi.fn();
    const activeChange = vi.fn((active: boolean) => {
      if (active) return;
      if (failure === 'throw') throw new Error('Consumer UI unavailable');
      return Promise.reject(new Error('Consumer UI unavailable'));
    });
    render(<SquarePaymentForm amount={100} shootId="42" onPaymentSuccess={success} onPaymentError={error} onCheckoutActiveChange={activeChange} />);
    await openCheckout(); await advance(3000);
    expect(activeChange).toHaveBeenCalledWith(false); expect(success).toHaveBeenCalledTimes(1); expect(error).not.toHaveBeenCalled();
    expect(mocks.dashboard).toHaveBeenCalledTimes(1); expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment Successful' }));
  });

  it.each(['close', 'unmount'])('destroys a late SDK instance after %s without mounting or notifying', async cancellation => {
    let finishMount!: (value: { mount: typeof mocks.mount; destroy: typeof mocks.destroy }) => void;
    mocks.init.mockImplementationOnce(async options => {
      mocks.options.push(options);
      return new Promise(resolve => { finishMount = resolve; });
    });
    vi.mocked(axios.post).mockImplementation(async url => !String(url).includes('confirm')
      ? { data: { sessionId: 'cs_42', clientSecret: 'secret_42' } } : busy());
    const success = vi.fn(); const error = vi.fn(); const mounted = vi.fn();
    const view = render(<SquarePaymentForm amount={100} shootId="42" onPaymentSuccess={success} onPaymentError={error} onCheckoutMounted={mounted} />);
    await openCheckout();
    if (cancellation === 'close') fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    else view.unmount();
    await act(async () => { finishMount({ mount: mocks.mount, destroy: mocks.destroy }); mocks.options[0].onComplete(); });
    expect(mocks.destroy).toHaveBeenCalledTimes(1); expect(mocks.mount).not.toHaveBeenCalled(); expect(mounted).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled(); noPaymentEffects();
  });
});
