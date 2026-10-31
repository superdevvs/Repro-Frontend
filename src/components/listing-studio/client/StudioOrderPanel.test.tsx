import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { StudioOrderPanel } from './StudioOrderPanel';
import { listingStudioClient } from '@/services/listingStudioClientService';
import type { StudioOrder } from '@/types/listingStudioClient';
import fixtures from './studioFixtures.test-data.json';

vi.mock('@/services/listingStudioClientService', () => ({ listingStudioClient: { order: vi.fn(), cancelOrder: vi.fn(), preview: vi.fn(), download: vi.fn() } }));
let queryClient: QueryClient; let current: StudioOrder;
function view() { return render(<QueryClientProvider client={queryClient}><StudioOrderPanel accountId="42" orderId={current.id} onCheckout={vi.fn()} onRevision={vi.fn()} checkoutBusy={false} /></QueryClientProvider>); }
beforeEach(() => {
  vi.clearAllMocks(); queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const base = fixtures.order as StudioOrder;
  current = { ...base, funding: { ...base.funding, method: 'card', status: 'pending' }, item: { ...base.item, status: 'awaiting_funding', source: { ...base.item.source, originalPreviewAvailable: false }, previewAvailable: false, error: null }, actions: { ...base.actions, canCheckout: true, canCancel: true, canDownload: false, canRequestRevision: false } };
  vi.mocked(listingStudioClient.order).mockImplementation(async () => current);
});
afterEach(() => { cleanup(); queryClient.clear(); });
describe('order recovery and unpaid cancellation', () => {
  it('shows a structured safe recovery message without rendering its object or enabling checkout', async () => {
    current = { ...current, item: { ...current.item, status: 'needs_attention', error: { code: 'provider_pending', message: 'The original processing request is being checked.' } }, actions: { ...current.actions, canCheckout: false, canCancel: false } };
    view(); await screen.findByText('The original processing request is being checked.');
    expect(screen.queryByRole('button', { name: 'Cancel unpaid order' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pay .* securely/ })).not.toBeInTheDocument();
  });
  it('cancels one eligible unpaid order and uses the returned server state', async () => {
    vi.mocked(listingStudioClient.cancelOrder).mockImplementation(async () => {
      current = { ...current, item: { ...current.item, status: 'cancelled' }, actions: { ...current.actions, canCheckout: false, canCancel: false } }; return current;
    });
    view(); await screen.findByRole('button', { name: 'Cancel unpaid order' });
    await userEvent.dblClick(screen.getByRole('button', { name: 'Cancel unpaid order' }));
    await screen.findByText('Cancelled');
    expect(listingStudioClient.cancelOrder).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Cancel unpaid order' })).not.toBeInTheDocument();
  });
  it('does not imply rendering has started while payment or refund review holds the order', async () => {
    current = { ...current, item: { ...current.item, status: 'needs_attention', error: { code: 'payment_review', message: 'Payment details are being checked.' } }, actions: { ...current.actions, canCheckout: false, canCancel: false } };
    view(); await screen.findByText(/This order is on hold because of its payment or refund status/);
    expect(screen.queryByText(/Its processing request is saved/)).not.toBeInTheDocument();
  });
  it('refreshes a refused cancellation without treating an unresolved payment as cancelled', async () => {
    vi.mocked(listingStudioClient.cancelOrder).mockImplementation(async () => {
      current = { ...current, actions: { ...current.actions, canCheckout: false, canCancel: false } };
      throw { response: { status: 409, data: { code: 'order_cancellation_unavailable', message: 'Payment confirmation is still pending.' } } };
    });
    view(); await screen.findByRole('button', { name: 'Cancel unpaid order' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel unpaid order' }));
    await screen.findByText('Payment confirmation is still pending.');
    expect(screen.queryByText('Cancelled')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel unpaid order' })).not.toBeInTheDocument();
  });
});
