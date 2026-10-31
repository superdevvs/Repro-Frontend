import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { StudioSubscriptionManagement } from './StudioSubscriptionManagement';
import { managedAccount } from './staffFixtures.test-data';
import fixtures from '../client/studioFixtures.test-data.json';
import type { StudioPlan } from '@/types/listingStudioClient';
import { listingStudioStaff } from '@/services/listingStudioStaffService';
vi.mock('@/services/listingStudioStaffService', () => ({ listingStudioStaff: { subscriptionAction: vi.fn() } }));
function view(account = managedAccount) { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><StudioSubscriptionManagement actorId="9" clientId="42" account={account} plans={fixtures.catalog.plans as StudioPlan[]} onChanged={vi.fn()} /></QueryClientProvider>); }
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); }); afterEach(cleanup);
describe('superadmin subscription controls', () => {
  it('does not show controls without the server management capability', () => { view({ ...managedAccount, management: { ...managedAccount.management, canManageSubscription: false } }); expect(screen.queryByRole('heading', { name: 'Subscription controls' })).not.toBeInTheDocument(); });
  it('requires a second confirmation and recovers the same change after an uncertain response', async () => {
    vi.mocked(listingStudioStaff.subscriptionAction).mockRejectedValueOnce(new Error('Response lost')).mockResolvedValueOnce({ status: 'scheduled', action: { id: 'action-id', type: 'cancel_renewal', status: 'scheduled', currentPlanCode: 'pro', planCode: null, effectiveAt: '2050-01-01', errorCode: null }, nextAction: { type: 'none' } });
    const first = view(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Cancel renewal' })); expect(listingStudioStaff.subscriptionAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm change' })); await waitFor(() => expect(listingStudioStaff.subscriptionAction).toHaveBeenCalledTimes(1));
    const firstArgs = vi.mocked(listingStudioStaff.subscriptionAction).mock.calls[0]; first.unmount(); view();
    await user.click(screen.getByRole('button', { name: 'Check existing change' })); await waitFor(() => expect(listingStudioStaff.subscriptionAction).toHaveBeenCalledTimes(2));
    expect(vi.mocked(listingStudioStaff.subscriptionAction).mock.calls[1]).toEqual(firstArgs); expect(firstArgs.slice(0, 2)).toEqual(['42', { action: 'cancel_renewal' }]);
  });
  it('shows the scheduled state and only server-authorized undo controls', () => { view({ ...managedAccount, management: { ...managedAccount.management, subscription: { pendingChange: { id: 'action-id', type: 'cancel_renewal', status: 'scheduled', currentPlanCode: 'pro', planCode: null, effectiveAt: '2050-01-01', errorCode: null }, capabilities: { canScheduleDowngrade: false, canCancelRenewal: false, canUndoCancel: true, canUndoDowngrade: false } } } }); expect(screen.getByRole('status')).toHaveTextContent('scheduled'); expect(screen.getByRole('button', { name: 'Keep subscription renewing' })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Cancel renewal' })).not.toBeInTheDocument(); });
});
