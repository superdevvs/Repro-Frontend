import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioClaimBilling } from '@/services/listingStudioClaimBilling';
import { forgetStudioClaimCheckoutReturn, rememberStudioClaimCheckoutReturn } from '@/lib/listingStudioClaimCheckout';
import { ListingStudioClaimPlans } from './ListingStudioClaimPlans';

const api = vi.hoisted(() => ({ summary: vi.fn(), checkout: vi.fn(), portal: vi.fn() }));
vi.mock('@/services/listingStudioClaimBilling', () => ({ listingStudioClaimBilling: api }));
const plans = [
  { code: 'starter', name: 'Starter', monthlyPriceCents: 4900, monthlyCreditCents: 6000, revisionDiscountPercent: 0 },
  { code: 'pro', name: 'Pro', monthlyPriceCents: 9900, monthlyCreditCents: 13500, revisionDiscountPercent: 20 },
  { code: 'studio', name: 'Studio', monthlyPriceCents: 24900, monthlyCreditCents: 37500, revisionDiscountPercent: 30 },
];
const fixture = () => ({ account: { status: 'ready', subscription: null,
  credits: { availableCents: 0, reservedCents: 0 }, capabilities: { canSubscribe: true, canManageBilling: false }, notice: null },
  catalog: { plans, checkoutAvailable: true }, pendingCheckout: null, confirmationEmail: null }) as StudioClaimBilling;
let client: QueryClient;
function mount() { client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); return render(<QueryClientProvider client={client}><ListingStudioClaimPlans accountId="41" /></QueryClientProvider>); }
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); forgetStudioClaimCheckoutReturn(); api.summary.mockResolvedValue(fixture()); });
afterEach(() => { cleanup(); client?.clear(); });

describe('claim-page subscription choices', () => {
  it('shows all server-owned prices and credits without requiring verification', async () => {
    mount();
    expect(await screen.findByRole('button', { name: 'Subscribe to Starter' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Subscribe to Pro' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Subscribe to Studio' })).toBeEnabled();
    for (const price of ['$49', '$99', '$249', '$60', '$135', '$375']) expect(screen.getByText(price)).toBeVisible();
    expect(screen.queryByText(/verify your email/i)).not.toBeInTheDocument();
    await waitFor(() => expect(client.getQueryData(['studio-client', '41', 'account'])).toMatchObject({ credits: { availableCents: 0 } }));
  });
  it('keeps a recoverable billing failure independent of photo downloads', async () => {
    api.summary.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(fixture()); mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Your photo downloads are still available above');
    fireEvent.click(screen.getByRole('button', { name: 'Retry plans' }));
    expect(await screen.findByRole('button', { name: 'Subscribe to Pro' })).toBeEnabled();
  });
  it('recovers the same owned checkout and prevents duplicate submissions', async () => {
    const data = fixture(); data.pendingCheckout = { planCode: 'pro', status: 'submitting', requestKey: 'owned-request', expiresAt: null };
    api.summary.mockResolvedValue(data);
    let resolve!: (value: unknown) => void; api.checkout.mockImplementation(() => new Promise(done => { resolve = done; })); mount();
    const button = await screen.findByRole('button', { name: 'Subscribe to Pro' });
    expect(screen.getByRole('button', { name: 'Subscribe to Starter' })).toBeDisabled();
    fireEvent.click(button); fireEvent.click(button);
    expect(api.checkout).toHaveBeenCalledExactlyOnceWith('pro', 'owned-request');
    resolve({ status: 'awaiting_webhook' });
    expect(await screen.findByText(/checking your subscription\. your plan/i)).toBeVisible();
    expect(screen.queryByText(/plan is ready/)).not.toBeInTheDocument();
  });
  it('does not grant benefits based on a browser payment return', async () => {
    rememberStudioClaimCheckoutReturn('?checkout=returned'); mount();
    expect(await screen.findByText(/checking your subscription\. your plan/i)).toBeVisible();
    expect(screen.queryByText('Your Pro plan is ready')).not.toBeInTheDocument();
    expect(api.checkout).not.toHaveBeenCalled();
  });
  it('shows the confirmed plan, real balance and email state, with billing management', async () => {
    const data = fixture(); data.account.subscription = { id: '8', planCode: 'pro', status: 'active', periodStart: '2026-11-05T00:00:00Z', periodEnd: '2026-12-05T00:00:00Z', cancelAtPeriodEnd: false };
    data.account.credits.availableCents = 12500; data.account.credits.reservedCents = 1000;
    data.account.capabilities.canManageBilling = true; data.confirmationEmail = { status: 'sent', sentAt: '2026-11-05T00:00:00Z' };
    api.summary.mockResolvedValue(data); api.portal.mockResolvedValue({ status: 'awaiting_reconciliation' }); mount();
    expect(await screen.findByText('Your Pro plan is ready')).toBeVisible();
    expect(screen.getByText('$125')).toBeVisible(); expect(screen.getByText('$10 reserved')).toBeVisible();
    expect(screen.getByText('Your subscription confirmation email has been sent.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Subscribe to Pro' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Manage subscription & invoices' }));
    await waitFor(() => expect(api.portal).toHaveBeenCalledTimes(1));
  });
});
