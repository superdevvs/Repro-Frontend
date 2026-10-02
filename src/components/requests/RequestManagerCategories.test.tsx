import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestManagerProvider } from '@/context/RequestManagerContext';
import { PendingReviewsCard } from '@/components/dashboard/v2/PendingReviewsCard';
import { RequestManagerModal } from './RequestManagerModal';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: 'admin', user: { id: 1 } }) }));
vi.mock('@/components/shoots/details/useHoldNotifications', () => ({ useHoldNotifications: () => ({}) }));

const reschedules = {
  requests: [{ id: 1, shootId: 104, status: 'rejected' as const, address: '108 Example Street', originalDate: '2026-10-07', originalTime: '10:00:00', requestedDate: '2026-10-08', requestedTime: '13:00:00', reason: 'Client needs another day.', reviewNotes: 'Photographer unavailable.' }],
  pendingCount: 0, loading: false, error: null, actioning: null, refresh: vi.fn(), decide: vi.fn(),
};
const hold = { shoots: [], loading: false, error: null, actioning: null, refresh: vi.fn(), decide: vi.fn() };
const overdue = { clients: [], total: 0, page: 1, lastPage: 1, loading: false, error: null, refresh: vi.fn(), setPage: vi.fn() };

function Queue({ revised = false }: { revised?: boolean }) {
  return <RequestManagerProvider>
    <PendingReviewsCard reviews={[]} issues={[]} onSelect={vi.fn()} showClientTab showEditingTab showCancellationTab holdRequests={hold} rescheduleRequests={revised ? { ...reschedules, requests: [] } : reschedules} overdueClients={overdue} />
    <RequestManagerModal />
  </RequestManagerProvider>;
}

afterEach(cleanup);
describe('request category manager', () => {
  it.each(['Client', 'Editing', 'Cancellation', 'Hold', 'Reschedule', 'Overdue'])('opens View all %s in its own manager tab', (category) => {
    render(<Queue />);
    fireEvent.click(screen.getByRole('button', { name: category }));
    fireEvent.click(screen.getByRole('button', { name: `View all ${category.toLowerCase()}` }));
    const manager = screen.getByRole('dialog', { name: 'Request Manager' });
    expect(within(manager).getAllByRole('tab')).toHaveLength(6);
    expect(within(manager).getByRole('tab', { name: new RegExp(`^${category}`) })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(within(manager).getByRole('tab', { name: /^Reschedule/ }));
    const request = within(manager).getByTestId('reschedule-request-1');
    expect(request).not.toHaveAttribute('open');
    expect(request).toHaveTextContent('Oct 7, 2026 10:00 AM → Oct 8, 2026 1:00 PM');
    fireEvent.click(within(request).getByLabelText('Reschedule details for 108 Example Street'));
    expect(request).toHaveAttribute('open');
    expect(within(request).getByText('Photographer unavailable.')).toBeVisible();
  });

  it('updates an open category when the dashboard queue refreshes', () => {
    const view = render(<Queue />);
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule' }));
    fireEvent.click(screen.getByRole('button', { name: 'View all reschedule' }));
    expect(within(screen.getByRole('dialog')).getByText('108 Example Street')).toBeVisible();
    view.rerender(<Queue revised />);
    expect(within(screen.getByRole('dialog')).queryByText('108 Example Street')).not.toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText('No reschedule requests.')).toBeVisible();
  });
});
