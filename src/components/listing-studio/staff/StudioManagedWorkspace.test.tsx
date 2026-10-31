import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { StudioManagedWorkspace } from './StudioManagedWorkspace';
import { billingRequest, managedAccount } from './staffFixtures.test-data';
import fixtures from '../client/studioFixtures.test-data.json';
import { listingStudioStaff } from '@/services/listingStudioStaffService';
import { useStudioAccount } from '@/hooks/useStudioAccount';
import type { StudioCatalog } from '@/types/listingStudioClient';

vi.mock('@/hooks/useStudioAccount', () => ({ useStudioAccount: vi.fn() }));
vi.mock('@/services/listingStudioStaffService', () => ({ listingStudioStaff: { catalog: vi.fn(), orders: vi.fn(), requests: vi.fn(), request: vi.fn(), createRequest: vi.fn(), emailRequest: vi.fn(), upload: vi.fn(), quote: vi.fn(), createOrder: vi.fn() } }));
vi.mock('../client/StudioNewEdit', () => ({ StudioNewEdit: () => <p>Existing photo editor</p> }));
vi.mock('./StudioSubscriptionManagement', () => ({ StudioSubscriptionManagement: () => <p>Subscription controls</p> }));
const page = { page: 1, perPage: 12, total: 0, hasMore: false };
function view() { const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); return render(<QueryClientProvider client={client}><MemoryRouter><StudioManagedWorkspace actorId="9" clientId="42" /></MemoryRouter></QueryClientProvider>); }
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  vi.mocked(useStudioAccount, { partial: true }).mockReturnValue({ data: managedAccount, isPending: false });
  vi.mocked(listingStudioStaff.catalog).mockResolvedValue(fixtures.catalog as StudioCatalog);
  vi.mocked(listingStudioStaff.orders).mockResolvedValue({ orders: [], pagination: page });
  vi.mocked(listingStudioStaff.requests).mockResolvedValue({ requests: [], pagination: page });
  vi.mocked(listingStudioStaff.request).mockResolvedValue(billingRequest);
}); afterEach(cleanup);
describe('selected-client billing workspace', () => {
  it('shows the beneficiary identity and limits private history to initiated purchases', async () => { view(); await screen.findByRole('heading', { name: 'Jane Client' }); expect(useStudioAccount).toHaveBeenCalledWith('42'); expect(listingStudioStaff.catalog).toHaveBeenCalledWith('42', expect.any(AbortSignal)); const user = userEvent.setup(); await user.click(screen.getByRole('tab', { name: 'Your purchases' })); await screen.findByText('You have not created any purchases for this client.'); expect(listingStudioStaff.orders).toHaveBeenCalledWith('42', 1, expect.any(AbortSignal)); });
  it('creates an upgrade review link only after confirmation and never sends email automatically', async () => {
    const request = { ...billingRequest, kind: 'subscription_upgrade' as const, planCode: 'studio', amountCents: 24900 }; vi.mocked(listingStudioStaff.createRequest).mockResolvedValue({ request, created: true }); vi.mocked(listingStudioStaff.request).mockResolvedValue(request);
    view(); const user = userEvent.setup(); await user.click(await screen.findByRole('button', { name: 'Request upgrade payment' })); expect(listingStudioStaff.createRequest).not.toHaveBeenCalled(); await user.click(screen.getByRole('button', { name: 'Create review link' }));
    await screen.findByRole('button', { name: 'Copy client review link' }); expect(listingStudioStaff.createRequest).toHaveBeenCalledWith('42', { kind: 'subscription_upgrade', planCode: 'studio' }, expect.stringMatching(/^[0-9a-f-]{36}$/)); expect(listingStudioStaff.emailRequest).not.toHaveBeenCalled();
  });
  it('recovers an uncertain local request using the same key and target plan', async () => {
    vi.mocked(useStudioAccount, { partial: true }).mockReturnValue({ data: { ...managedAccount, subscription: null, capabilities: { ...managedAccount.capabilities, canSubscribe: true } }, isPending: false });
    const request = { ...billingRequest, kind: 'subscription_purchase' as const, planCode: 'starter', amountCents: 4900 }; vi.mocked(listingStudioStaff.createRequest).mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ request, created: false }); vi.mocked(listingStudioStaff.request).mockResolvedValue(request);
    view(); const user = userEvent.setup(); const heading = await screen.findByRole('heading', { name: 'Starter' }); await user.click(within(heading.closest('article')!).getByRole('button', { name: 'Create payment request' })); await user.click(screen.getByRole('button', { name: 'Create review link' })); await waitFor(() => expect(listingStudioStaff.createRequest).toHaveBeenCalledTimes(1)); const first = vi.mocked(listingStudioStaff.createRequest).mock.calls[0];
    await user.click(screen.getByRole('button', { name: 'Create review link' })); await screen.findByRole('button', { name: 'Copy client review link' }); expect(vi.mocked(listingStudioStaff.createRequest).mock.calls[1]).toEqual(first); expect(listingStudioStaff.emailRequest).not.toHaveBeenCalled();
  });
  it('keeps purchase actions disabled when delegated billing is unavailable', async () => { const blockedAccount = { ...managedAccount, management: { ...managedAccount.management, canPurchase: false } }; vi.mocked(useStudioAccount, { partial: true }).mockReturnValue({ data: blockedAccount, isPending: false }); view(); await screen.findByRole('heading', { name: 'Jane Client' }); expect(screen.getByRole('button', { name: 'Request upgrade payment' })).toBeDisabled(); expect(listingStudioStaff.createRequest).not.toHaveBeenCalled(); });
});