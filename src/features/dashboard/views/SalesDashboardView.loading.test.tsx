import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SalesDashboardView } from './SalesDashboardView';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '7', role: 'salesRep' } }) }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => true }));
vi.mock('../hooks/useDashboardOnboarding', () => ({ useDashboardOnboarding: () => ({ onboardingState: {} }) }));
vi.mock('../components/DashboardOnboarding', () => ({ DashboardOnboarding: () => null }));
vi.mock('@/components/dashboard/v2/PendingReviewsCard', () => ({ PendingReviewsCard: () => null }));
vi.mock('@/components/dashboard/v2/ShootsTabsCard', () => ({
  ShootsTabsCard: ({ upcomingShoots }: { upcomingShoots: unknown[] }) => <div>{upcomingShoots.length ? 'Loaded shoots' : 'No upcoming shoots'}</div>,
}));
vi.mock('../components/RoleDashboardLayout', () => ({
  RoleDashboardLayout: ({ upcomingCard }: { upcomingCard: React.ReactNode }) => <>{upcomingCard}</>,
}));

type Props = React.ComponentProps<typeof SalesDashboardView>;
const noop = vi.fn();
const base = {
  availablePhotographerIds: [], availabilityError: null, availabilityLoading: false,
  availabilityWindow: { date: '', start_time: '', end_time: '' }, cancellationShoots: [],
  clientRequests: [], clientRequestsLoading: false, editingRequests: [], editingRequestsLoading: false,
  greetingTitleFullName: 'Good morning', photographers: [], pendingReviews: [],
  repDelivered: [], repPendingReviews: [], repUpcoming: [], requestedShoots: [],
  requestedShootsLoading: false, onReloadRequestedShoots: noop, requestedShootModals: null,
  onApproveShoot: noop, onDeclineShoot: noop, onModifyShoot: noop, salesMetricTiles: [], shootDetailsModal: null,
  shouldLoadEditingRequests: false, onApproveCancellation: noop, onRejectCancellation: noop,
  onSelectShoot: noop, onSetAvailabilityWindow: noop, onSetSelectedPhotographer: noop,
  onCreateEditingRequest: noop, onEditingRequestClick: noop,
} satisfies Props;

afterEach(cleanup);

describe('sales dashboard shoot hydration', () => {
  it('does not claim there are no shoots while the first sales-rep request is pending', () => {
    render(<SalesDashboardView {...base} shootsLoading />);
    expect(screen.queryByText('No upcoming shoots')).toBeNull();
    expect(screen.getByRole('status', { name: 'Loading shoots' })).toBeTruthy();
  });

  it('shows loaded shoots as soon as the schedule arrives while other sections finish', () => {
    render(<SalesDashboardView {...base} shootsLoading repUpcoming={[{ id: 1 } as Props['repUpcoming'][number]]} />);
    expect(screen.getByText('Loaded shoots')).toBeTruthy();
    expect(screen.queryByRole('status', { name: 'Loading shoots' })).toBeNull();
  });

  it('only shows the empty state after initial shoot hydration completes', () => {
    const { rerender } = render(<SalesDashboardView {...base} shootsLoading />);
    rerender(<SalesDashboardView {...base} shootsLoading={false} />);
    expect(screen.getByText('No upcoming shoots')).toBeTruthy();
    expect(screen.queryByRole('status', { name: 'Loading shoots' })).toBeNull();
  });
});
