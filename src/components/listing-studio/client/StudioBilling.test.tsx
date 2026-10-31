import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { StudioBilling } from './StudioBilling';
import { listingStudioClient } from '@/services/listingStudioClientService';
import type { StudioAccount, StudioCatalog } from '@/types/listingStudioClient';
import fixtures from './studioFixtures.test-data.json';

vi.mock('@/services/listingStudioClientService', () => ({ listingStudioClient: { transactions: vi.fn(), subscriptionCheckout: vi.fn(), billingPortal: vi.fn() }, studioCheckoutUrl: vi.fn((value: string) => value) }));
let queryClient: QueryClient;
const account = { ...fixtures.account, subscription: null, capabilities: { ...fixtures.account.capabilities, canSubscribe: true } } as StudioAccount;
const catalog = fixtures.catalog as StudioCatalog;
function view(initialPlanCode?: string) { return render(<QueryClientProvider client={queryClient}><StudioBilling accountId="42" account={account} catalog={catalog} initialPlanCode={initialPlanCode} /></QueryClientProvider>); }
beforeEach(() => {
  sessionStorage.clear(); vi.clearAllMocks(); queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(listingStudioClient.transactions).mockResolvedValue({ transactions: [], pagination: { page: 1, perPage: 20, total: 0, hasMore: false } });
  vi.mocked(listingStudioClient.subscriptionCheckout).mockResolvedValue({ status: 'awaiting_webhook', url: null, nextAction: { type: 'await_payment' } });
});
afterEach(() => { cleanup(); queryClient.clear(); });
describe('subscription checkout recovery', () => {
  it('reviews a linked plan without starting checkout, then waits for the verified payment event', async () => {
    view('pro'); await screen.findByRole('dialog');
    expect(listingStudioClient.subscriptionCheckout).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Continue to secure checkout' }));
    await screen.findByText('Your existing checkout is saved. Subscription confirmation will appear here.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it.each([['checkout_failed', true], ['checkout_expired', true], ['checkout_failed', false], ['payment_uncertain', true]])('rotates %s only with definitive retry authorization %s', async (code, retryWithNewKey) => {
    vi.mocked(listingStudioClient.subscriptionCheckout).mockRejectedValueOnce({ response: { status: 409, data: { code, message: 'Checkout needs another check.', data: { retryWithNewKey } } } });
    view('starter'); const user = userEvent.setup(); await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Continue to secure checkout' }));
    await screen.findByRole('alert');
    const firstKey = vi.mocked(listingStudioClient.subscriptionCheckout).mock.calls[0][1];
    await user.click(screen.getByRole('button', { name: 'Continue to secure checkout' }));
    await waitFor(() => expect(listingStudioClient.subscriptionCheckout).toHaveBeenCalledTimes(2));
    const secondKey = vi.mocked(listingStudioClient.subscriptionCheckout).mock.calls[1][1];
    if (retryWithNewKey && ['checkout_failed', 'checkout_expired'].includes(code)) expect(secondKey).not.toBe(firstKey);
    else expect(secondKey).toBe(firstKey);
  });
});
