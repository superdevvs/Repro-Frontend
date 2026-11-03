import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { PendingReviewsCard } from '@/components/dashboard/v2/PendingReviewsCard';
import { RequestManagerProvider } from '@/context/RequestManagerContext';
import { RequestManagerModal } from './RequestManagerModal';
import type { AryeoRequestsState } from '@/features/dashboard/hooks/useAryeoRequests';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate, Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: 'admin', user: { id: 1 } }) }));
const state: AryeoRequestsState = {
  requests: [{ id: 13, address: '6 S Antietam St', requesterName: 'Dan Hozhabri', requesterEmail: 'dan@example.test', receivedAt: '', required: null, status: 'matched', providerCheckedAt: null, shoot: { id: 5910, address: '6 S Antietam Street', clientName: 'Dan Hozhabri', workflowStatus: 'delivered', scheduledDate: '2026-11-02' } }],
  pendingCount: 1, total: 1, page: 1, lastPage: 1, loading: false, error: null, history: false,
  connections: [{ id: 1, name: 'Mac mini', online: true, processingEnabled: true, executorReady: false, lastSeenAt: null }],
  refresh: vi.fn(), setPage: vi.fn(), setHistory: vi.fn(),
};
function Queue({ enabled = true, revised = false, manage = true }) {
  return <RequestManagerProvider><PendingReviewsCard reviews={[]} issues={[]} onSelect={vi.fn()} showClientTab
    aryeoRequests={enabled ? { ...state, requests: revised ? [] : state.requests, pendingCount: revised ? 0 : 1 } : undefined} canManageAryeo={manage} />
    <RequestManagerModal /></RequestManagerProvider>;
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('opens Aryeo inside Request Manager, reflects live updates, and keeps the delivery worker status distinct', () => {
  const view = render(<Queue />);
  fireEvent.click(screen.getByRole('button', { name: 'Aryeo (1)' }));
  expect(screen.getByText('Mac mini: Connected · Delivery worker unavailable')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'View all aryeo' }));
  const manager = within(screen.getByRole('dialog', { name: 'Request Manager' }));
  expect(manager.getByRole('tab', { name: /^Aryeo/ })).toHaveAttribute('aria-selected', 'true');
  expect(manager.getByText('6 S Antietam St')).toBeVisible();
  view.rerender(<Queue revised />);
  expect(manager.queryByText('6 S Antietam St')).not.toBeInTheDocument();
  expect(manager.getByText('No pending Aryeo requests.')).toBeVisible();
});

it.each([true, false])('opens the existing scoped shoot workflow with staff access %s', manage => {
  render(<Queue manage={manage} />);
  fireEvent.click(screen.getByRole('button', { name: 'Aryeo (1)' }));
  fireEvent.click(screen.getByRole('button', { name: manage ? 'Open Tours' : 'Open shoot' }));
  expect(navigate).toHaveBeenCalledWith('/dashboard', { state: { openShootId: 5910, openShootTab: manage ? 'tours' : 'overview' } });
});

it('omits the Aryeo category for unauthorized viewers', () => {
  render(<Queue enabled={false} />);
  expect(screen.queryByRole('button', { name: /Aryeo/ })).not.toBeInTheDocument();
});
