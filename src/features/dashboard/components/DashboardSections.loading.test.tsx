import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDashboardSections } from './DashboardSections';

vi.mock('@/components/dashboard/v2/ShootsTabsCard', () => ({
  ShootsTabsCard: ({ upcomingShoots }: { upcomingShoots: unknown[] }) =>
    <div>{upcomingShoots.length ? 'Loaded shoots' : 'No upcoming shoots'}</div>,
}));
vi.mock('@/components/dashboard/v2/UpcomingShootsCard', () => ({
  UpcomingShootsCard: () => <div>No upcoming shoots</div>,
}));

type Params = Parameters<typeof useDashboardSections>[0];
const noop = vi.fn();
const base: Params = {
  assignPhotographers: [], availablePhotographerIds: [], availabilityError: null,
  availabilityLoading: false, availabilityWindow: { date: '', start_time: '', end_time: '' },
  cancellationShoots: [], clientRequests: [], clientRequestsLoading: false, deliveredShoots: [],
  editingManagerReadyToDeliverShoots: [], editingManagerUpcomingShoots: [], editingManagerUploadedShoots: [],
  editingRequests: [], editingRequestsLoading: false, filteredWorkflow: null, isAdminExperience: true,
  loading: false, shootsLoading: true, overviewDataAvailable: true, pendingReviews: [], pipelineFilter: 'today',
  requestedShoots: [], role: 'admin', shouldLoadEditingRequests: false, upcomingShootsWithoutRequested: [],
  canViewContactActions: false, handleAdvanceStage: noop, handleApproveCancellation: noop,
  handleRejectCancellation: noop, handleSelectShoot: noop, handleViewInvoice: noop, navigate: noop,
  setApprovalModalShoot: noop, setAvailabilityWindow: noop, setDeclineModalShoot: noop,
  setEditModalShoot: noop, setPipelineFilter: noop, setSelectedPhotographer: noop, setSelectedRequestId: noop,
  setSpecialRequestOpen: noop, updateEditingRequest: noop,
};

function Probe({ params = base, section = 'renderShootsTabsCard' }: {
  params?: Params; section?: 'renderShootsTabsCard' | 'renderUpcomingCard' | 'renderEditingManagerShootsTabsCard';
}) {
  return useDashboardSections(params)[section]();
}

afterEach(cleanup);

describe('dashboard shoot hydration', () => {
  it.each(['renderShootsTabsCard', 'renderUpcomingCard', 'renderEditingManagerShootsTabsCard'] as const)(
    'keeps %s skeleton visible when overview finishes before shoots', (section) => {
      render(<Probe section={section} />);
      expect(screen.getByRole('status', { name: 'Loading shoots' })).toBeTruthy();
      expect(screen.queryByText('No upcoming shoots')).toBeNull();
    },
  );

  it('changes from skeleton to real empty state only after shoot hydration', () => {
    const { rerender } = render(<Probe />);
    rerender(<Probe params={{ ...base, shootsLoading: false }} />);
    expect(screen.queryByRole('status', { name: 'Loading shoots' })).toBeNull();
    expect(screen.getByText('No upcoming shoots')).toBeTruthy();
  });

  it('changes from skeleton to loaded shoots without showing an empty state', () => {
    const { rerender } = render(<Probe />);
    rerender(<Probe params={{ ...base, shootsLoading: false, upcomingShootsWithoutRequested: [{ id: 1 } as Params['upcomingShootsWithoutRequested'][number]] }} />);
    expect(screen.queryByRole('status', { name: 'Loading shoots' })).toBeNull();
    expect(screen.getByText('Loaded shoots')).toBeTruthy();
    expect(screen.queryByText('No upcoming shoots')).toBeNull();
  });

  it('does not hide hydrated shoot cards during a background overview refresh', () => {
    render(<Probe params={{ ...base, shootsLoading: false, loading: true }} />);
    expect(screen.queryByRole('status', { name: 'Loading shoots' })).toBeNull();
  });
});
