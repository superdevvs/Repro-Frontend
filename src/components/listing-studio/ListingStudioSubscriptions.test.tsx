import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { ListingStudioSubscriptions } from './ListingStudioSubscriptions';
import { listingStudioService, type ListingStudioSubscription, type ListingStudioSubscriptionPage } from '@/services/listingStudioService';

vi.mock('@/services/listingStudioService', () => ({ listingStudioService: { subscriptions: vi.fn() } }));
const subscription: ListingStudioSubscription = {
  id: 3, client_id: 12, client: { id: 12, name: 'Jordan Client', email: 'jordan@example.test' },
  customer: { name: 'Jordan Client', email: 'jordan@example.test' }, plan_code: 'pro', plan_name: 'Pro',
  status: 'active', sync_status: 'synced', attention_reason: null, amount_cents: 9900, currency: 'usd',
  billing_interval: 'month', billing_interval_count: 1, current_period_start: '2026-09-28T12:00:00Z',
  current_period_end: '2026-10-28T12:00:00Z', cancel_at_period_end: false, canceled_at: null,
  latest_invoice_status: 'paid', last_paid_at: '2026-09-28T12:00:00Z', account_created: true,
  account_setup_status: 'sent', account_setup_attention: null,
  latest_refund: null,
  credits: null,
  created_at: '2026-09-28T12:00:00Z', updated_at: '2026-09-28T12:00:00Z',
};
const page = (items: ListingStudioSubscription[], overrides: Partial<ListingStudioSubscriptionPage['meta']> = {}): ListingStudioSubscriptionPage => ({
  data: items, meta: { current_page: 1, last_page: 1, total: items.length, per_page: 20, ...overrides },
});
const mount = (canReview = true) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ListingStudioSubscriptions identity="1:admin" canReview={canReview} /></QueryClientProvider>);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listingStudioService.subscriptions).mockResolvedValue(page([subscription]));
});
afterEach(cleanup);

describe('Listing Studio synced subscriptions', () => {
  it('shows the synced client, actual plan price, successful payment and auto-created account', async () => {
    mount();
    expect(screen.getByText('Loading subscriptions…')).toBeInTheDocument();
    expect(await screen.findByRole('article', { name: 'Subscription for Jordan Client' })).toBeInTheDocument();
    expect(screen.getByText('jordan@example.test')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('$99.00 / month')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Created automatically')).toBeInTheDocument();
    expect(screen.getByText('Account setup email')).toBeInTheDocument();
    expect(screen.getByText('Sent', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('1 subscription')).toBeInTheDocument();
    expect(screen.queryByText('Needs attention', { selector: 'p' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Latest refund' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Studio credits' })).not.toBeInTheDocument();
  });

  it('shows server-calculated available and prorated credits separately from the monthly allowance', async () => {
    vi.mocked(listingStudioService.subscriptions).mockResolvedValue(page([{
      ...subscription, credits: { currency: 'usd', available_cents: 6750, earned_cents: 7750, used_cents: 1000, expires_at: '2026-10-28T12:00:00Z', monthly_allowance_cents: 13500 },
    }]));
    mount();
    const credits = await screen.findByRole('region', { name: 'Studio credits' });
    expect(within(credits).getByText('Available Studio credits')).toBeInTheDocument();
    expect(within(credits).getByText('$67.50')).toBeInTheDocument();
    expect(within(credits).getByText('Monthly allowance: $135.00')).toBeInTheDocument();
    expect(within(credits).queryByText('Granted this period')).not.toBeInTheDocument();
    expect(within(credits).queryByText('Used this period')).not.toBeInTheDocument();
    expect(within(credits).getByText(/Expires .+\. Unused credits do not roll over\./)).toBeInTheDocument();
  });

  it('shows an expired zero balance without replacing it with the plan allowance', async () => {
    vi.mocked(listingStudioService.subscriptions).mockResolvedValue(page([{
      ...subscription, credits: { currency: 'usd', available_cents: 0, earned_cents: 6000, used_cents: 0, expires_at: '2020-09-28T12:00:00Z', monthly_allowance_cents: 6000 },
    }]));
    mount();
    const credits = await screen.findByRole('region', { name: 'Studio credits' });
    expect(within(credits).getByText('$0.00', { selector: 'p' })).toBeInTheDocument();
    expect(within(credits).getByText('Monthly allowance: $60.00')).toBeInTheDocument();
    expect(within(credits).getByText(/Unused credits do not roll over/)).toBeInTheDocument();
  });

  it('does not invent credits before the server reports an activated allowance', async () => {
    vi.mocked(listingStudioService.subscriptions).mockResolvedValue(page([{ ...subscription, status: 'incomplete', sync_status: 'awaiting_payment', credits: null }]));
    mount();
    await screen.findByRole('article');
    expect(screen.queryByText('Available Studio credits')).not.toBeInTheDocument();
    expect(screen.queryByText(/Monthly allowance:/)).not.toBeInTheDocument();
  });

  it.each(['pending', 'succeeded', 'failed'])('shows a %s refund independently of the active subscription', async status => {
    vi.mocked(listingStudioService.subscriptions).mockResolvedValue(page([{
      ...subscription, latest_refund: { status, amount_cents: 2500, currency: 'usd', created_at: '2026-09-28T12:00:00Z' },
    }]));
    mount();
    const refund = await screen.findByRole('region', { name: 'Latest refund' });
    expect(within(refund).getByText(status.charAt(0).toUpperCase() + status.slice(1))).toBeInTheDocument();
    expect(within(refund).getByText('$25.00')).toBeInTheDocument();
    expect(within(screen.getByRole('article')).getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.queryByText(/Cancellation scheduled/)).not.toBeInTheDocument();
  });

  it('shows account setup pending separately from a successfully synced paid subscription', async () => {
    vi.mocked(listingStudioService.subscriptions).mockResolvedValue(page([{ ...subscription, account_setup_status: 'pending' }]));
    mount();
    await screen.findByRole('article');
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Created automatically')).toBeInTheDocument();
    expect(screen.getByText('Pending send')).toBeInTheDocument();
    expect(screen.queryByText('Sent', { selector: 'dd' })).not.toBeInTheDocument();
  });

  it('highlights a setup email failure even when the subscription and account are synced', async () => {
    vi.mocked(listingStudioService.subscriptions).mockResolvedValue(page([{
      ...subscription, account_setup_status: 'needs_attention', account_setup_attention: 'The setup email could not be sent. An admin must review delivery.',
    }]));
    mount();
    expect(await screen.findByText('Account setup email needs attention')).toBeInTheDocument();
    expect(screen.getByText('Needs attention', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText(/An admin must review delivery/)).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Created automatically')).toBeInTheDocument();
  });

  it('omits account setup delivery when the API has no setup email record', async () => {
    vi.mocked(listingStudioService.subscriptions).mockResolvedValue(page([{ ...subscription, account_created: false, account_setup_status: null }]));
    mount();
    await screen.findByRole('article');
    expect(screen.getByText('Linked')).toBeInTheDocument();
    expect(screen.queryByText('Account setup email')).not.toBeInTheDocument();
    expect(screen.queryByText('Sent', { selector: 'dd' })).not.toBeInTheDocument();
  });

  it('shows payment problems and account-link issues without claiming activation or a successful payment', async () => {
    vi.mocked(listingStudioService.subscriptions).mockResolvedValue(page([{
      ...subscription, client: null, client_id: null, account_created: false, status: 'past_due', sync_status: 'needs_attention',
      attention_reason: 'The customer email belongs to a staff account. An admin must review the account match.',
      latest_invoice_status: 'open', last_paid_at: null,
    }]));
    mount();
    await screen.findByRole('article');
    expect(screen.getByText('Past due', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('Needs attention', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(/An admin must review the account match/)).toBeInTheDocument();
    expect(screen.getByText('Awaiting payment', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('No payment recorded')).toBeInTheDocument();
    expect(screen.getByText('Not linked')).toBeInTheDocument();
    expect(screen.queryByText('Created automatically')).not.toBeInTheDocument();
  });

  it('explains scheduled cancellation and waits for payment confirmation', async () => {
    vi.mocked(listingStudioService.subscriptions).mockResolvedValue(page([{
      ...subscription, status: 'incomplete', sync_status: 'awaiting_payment', cancel_at_period_end: true,
      latest_invoice_status: null, last_paid_at: null,
    }]));
    mount();
    expect(await screen.findByText(/Cancellation scheduled for/)).toBeInTheDocument();
    expect(screen.getByText('Waiting for payment confirmation.')).toBeInTheDocument();
    expect(screen.getByText('No invoice yet')).toBeInTheDocument();
  });

  it('shows a completed cancellation without also saying it is scheduled', async () => {
    vi.mocked(listingStudioService.subscriptions).mockResolvedValue(page([{
      ...subscription, status: 'canceled', cancel_at_period_end: true, canceled_at: '2026-09-28T12:00:00Z',
    }]));
    mount();
    await screen.findByRole('article');
    expect(screen.getByText(/^Canceled .+\./, { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByText(/Cancellation scheduled/)).not.toBeInTheDocument();
  });

  it('paginates on the server and resets to page one when searching or filtering', async () => {
    vi.mocked(listingStudioService.subscriptions).mockImplementation(async (currentPage = 1, search = '', status = '') =>
      page([{ ...subscription, id: currentPage }], { current_page: currentPage, last_page: search || status ? 1 : 3, total: 42 }));
    mount();
    await screen.findByRole('button', { name: 'Next' });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(listingStudioService.subscriptions).toHaveBeenLastCalledWith(2, '', ''));
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search subscriptions'), { target: { value: '  Jordan  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(listingStudioService.subscriptions).toHaveBeenLastCalledWith(1, 'Jordan', ''));
    fireEvent.change(screen.getByLabelText('Subscription status'), { target: { value: 'needs_attention' } });
    await waitFor(() => expect(listingStudioService.subscriptions).toHaveBeenLastCalledWith(1, 'Jordan', 'needs_attention'));
  });

  it('retries a failed subscription fetch and clears the error after recovery', async () => {
    vi.mocked(listingStudioService.subscriptions).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(page([subscription]));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load subscriptions.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('article')).toBeInTheDocument();
    expect(listingStudioService.subscriptions).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps Previous and retry available when a later subscription page fails', async () => {
    vi.mocked(listingStudioService.subscriptions).mockImplementation(async (currentPage = 1) => {
      if (currentPage === 2) throw new Error('Page unavailable');
      return page([subscription], { last_page: 2, total: 26 });
    });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load subscriptions.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByRole('article', { name: 'Subscription for Jordan Client' })).toBeInTheDocument();
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('distinguishes an empty rep scope from a search with no matches', async () => {
    vi.mocked(listingStudioService.subscriptions).mockResolvedValue(page([]));
    mount(false);
    expect(await screen.findByText('No subscriptions yet')).toBeInTheDocument();
    expect(screen.getByText(/linked to one of your assigned clients/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search subscriptions'), { target: { value: 'nobody' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('No matching subscriptions')).toBeInTheDocument();
    expect(screen.getByText('0 subscriptions matching your filters')).toBeInTheDocument();
  });

  it('refreshes the current scope without clearing search filters', async () => {
    mount();
    await screen.findByRole('article');
    fireEvent.change(screen.getByLabelText('Subscription status'), { target: { value: 'active' } });
    await waitFor(() => expect(listingStudioService.subscriptions).toHaveBeenLastCalledWith(1, '', 'active'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh subscriptions' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Refresh subscriptions' }));
    await waitFor(() => expect(listingStudioService.subscriptions).toHaveBeenCalledTimes(3));
    expect(listingStudioService.subscriptions).toHaveBeenLastCalledWith(1, '', 'active');
  });
});
