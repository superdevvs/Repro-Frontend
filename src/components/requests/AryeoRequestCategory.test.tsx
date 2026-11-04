import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  viewerScope: 'admin:1',
  requests: [{ id: 13, address: '6 S Antietam St', requesterName: 'Dan Hozhabri', requesterEmail: 'dan@example.test', receivedAt: '', required: null, status: 'matched', providerCheckedAt: null, shoot: { id: 5910, address: '6 S Antietam Street', clientName: 'Dan Hozhabri', workflowStatus: 'delivered', scheduledDate: '2026-11-02' } }],
  pendingCount: 1, total: 1, page: 1, lastPage: 1, loading: false, error: null, history: false,
  connections: [{ id: 1, name: 'Mac mini', online: true, processingEnabled: true, executorReady: false, lastSeenAt: null }],
  refresh: vi.fn(), setPage: vi.fn(),
};
function Queue({ enabled = true, revised = false, manage = true }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }));
  return <QueryClientProvider client={client}><RequestManagerProvider><PendingReviewsCard reviews={[]} issues={[]} onSelect={vi.fn()} showClientTab
    aryeoRequests={enabled ? { ...state, requests: revised ? [] : state.requests, pendingCount: revised ? 0 : 1 } : undefined} canManageAryeo={manage} />
    <RequestManagerModal /></RequestManagerProvider></QueryClientProvider>;
}
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it('keeps open requests and counts while separately expanding delivered history, and reflects live updates', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    data: [{ ...state.requests[0], id: 5, address: '13405 Windsor Dr', status: 'delivered' }],
    meta: { total: 1, pendingCount: 1, page: 1, lastPage: 1 }, connections: [],
  }) });
  vi.stubGlobal('fetch', fetcher);
  const view = render(<Queue />);
  fireEvent.click(screen.getByRole('button', { name: 'Aryeo (1)' }));
  expect(screen.getByText('Mac mini: Connected · Delivery worker unavailable')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'View all aryeo' }));
  const manager = within(screen.getByRole('dialog', { name: 'Request Manager' }));
  expect(manager.getByRole('tab', { name: /^Aryeo/ })).toHaveAttribute('aria-selected', 'true');
  expect(manager.getByText('6 S Antietam St')).toBeVisible();
  expect(fetcher).not.toHaveBeenCalled();
  expect(manager.queryByText('13405 Windsor Dr')).not.toBeInTheDocument();
  fireEvent.click(manager.getByRole('button', { name: 'View older requests' }));
  expect(await manager.findByText('13405 Windsor Dr')).toBeVisible();
  expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('history=1'), expect.anything());
  expect(manager.getByText('6 S Antietam St')).toBeVisible();
  expect(manager.getByRole('tab', { name: /^Aryeo/ })).toHaveTextContent('1');
  expect(screen.getAllByTestId('aryeo-request-5')).toHaveLength(1);
  fireEvent.click(manager.getByRole('button', { name: 'Hide older requests' }));
  expect(manager.queryByText('13405 Windsor Dr')).not.toBeInTheDocument();
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
