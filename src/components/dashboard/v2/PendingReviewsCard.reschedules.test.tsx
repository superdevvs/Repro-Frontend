import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRescheduleRequests } from '@/features/dashboard/hooks/useRescheduleRequests';
import { triggerDashboardOverviewRefresh } from '@/realtime/realtimeRefreshBus';
import { PendingReviewsCard } from './PendingReviewsCard';

vi.mock('@/context/RequestManagerContext', () => ({ useRequestManager: () => ({ openModal: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({ role: 'admin', user: { id: 1, name: 'AJ' } }),
}));

const request = {
  id: 11,
  shoot_id: 104,
  status: 'pending',
  original_date: '2026-09-10',
  original_time: '10:00 AM',
  requested_date: '2026-09-24',
  requested_time: '02:30 PM',
  reason: 'Sellers need another week.',
  requester: { id: 3, name: 'Test Client' },
  location: { fullAddress: '108 Example Street' },
  client: { name: 'Client' },
};

const rejectedHistory = {
  id: 12,
  shoot_id: 112,
  status: 'rejected',
  original_date: '2026-09-01',
  original_time: '09:00 AM',
  requested_date: '2026-09-15',
  requested_time: '11:00 AM',
  reason: 'Conflict with open house.',
  review_notes: 'Photographer unavailable that day.',
  reviewed_at: '2026-09-20T15:00:00Z',
  requester: { id: 4, name: 'History Client' },
  approver: { id: 1, name: 'AJ Admin' },
  location: { fullAddress: '112 History Lane' },
  client: { name: 'History Client' },
};

const response = (data: unknown, ok = true) => ({ ok, json: async () => data }) as Response;

function Queue() {
  const reschedules = useRescheduleRequests(true, 'admin:1');
  return (
    <PendingReviewsCard
      reviews={[]}
      issues={[]}
      onSelect={vi.fn()}
      showClientTab
      rescheduleRequests={reschedules}
    />
  );
}

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Queue />
    </QueryClientProvider>,
  );
  return client;
}

describe('reschedule request dashboard queue', () => {
  beforeEach(() => {
    localStorage.setItem('authToken', 'test-token');
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it.each(['approved', 'rejected'] as const)(
    'shows the pending request and %ss it through the review endpoint',
    async (decision) => {
      let pending = true;
      const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
        if (String(url).includes('/reschedule-requests/') && init?.method === 'PATCH') {
          pending = false;
          return response({ message: `Reschedule request ${decision}.` });
        }
        return response({ data: pending ? [request] : [] });
      });
      vi.stubGlobal('fetch', fetchMock);
      const client = mount();
      fireEvent.click(await screen.findByRole('button', { name: 'Reschedule (1)' }));
      expect(screen.getByText('108 Example Street')).toBeInTheDocument();
      expect(screen.getByText('108 Example Street')).toHaveClass('select-text');
      expect(screen.getByText('Pending review')).toBeInTheDocument();
      expect(screen.getByText(/Sep 10, 2026 10:00 AM → Sep 24, 2026 02:30 PM/)).toBeInTheDocument();
      expect(screen.getByText('Sellers need another week.')).toBeInTheDocument();
      expect(screen.getByText('Requested by Test Client')).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole('button', {
          name: decision === 'approved' ? 'Approve reschedule' : 'Reject reschedule',
        }),
      );
      await screen.findByText('No reschedule requests.');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/shoots/reschedule-requests/11'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: decision }),
        }),
      );
      client.clear();
    },
  );

  it('lists pending plus history, badges status, and keeps tab count pending-only', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ data: [request, rejectedHistory] })),
    );
    const client = mount();
    // Pending-only badge: 1 pending + 1 rejected history => (1), not (2).
    fireEvent.click(await screen.findByRole('button', { name: 'Reschedule (1)' }));
    expect(screen.getByText('108 Example Street')).toBeInTheDocument();
    expect(screen.getByText('112 History Lane')).toBeInTheDocument();
    expect(screen.getByText('Pending review')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('Photographer unavailable that day.')).toBeInTheDocument();
    expect(screen.getByText(/AJ Admin/)).toBeInTheDocument();

    const pendingCard = screen.getByTestId('reschedule-request-11');
    const historyCard = screen.getByTestId('reschedule-request-12');
    expect(pendingCard).toHaveAttribute('data-status', 'pending');
    expect(historyCard).toHaveAttribute('data-status', 'rejected');
    expect(within(pendingCard).getByRole('button', { name: 'Approve reschedule' })).toBeInTheDocument();
    expect(within(historyCard).queryByRole('button', { name: 'Approve reschedule' })).not.toBeInTheDocument();
    expect(within(historyCard).queryByRole('button', { name: 'Reject reschedule' })).not.toBeInTheDocument();
    client.clear();
  });

  it('tolerates pending-only payloads that omit status', async () => {
    const { status: _omit, ...legacy } = request;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ data: [legacy] })),
    );
    const client = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Reschedule (1)' }));
    expect(screen.getByTestId('reschedule-request-11')).toHaveAttribute('data-status', 'pending');
    expect(screen.getByRole('button', { name: 'Approve reschedule' })).toBeInTheDocument();
    client.clear();
  });

  it('shows retry when the pending-reschedules endpoint fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ message: 'Not found' }, false)),
    );
    const client = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Reschedule' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Unable to load reschedule requests/i);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    client.clear();
  });

  it('keeps a request visible after a failed decision and refreshes on overview events', async () => {
    let pending = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PATCH') return response({ message: 'Could not approve' }, false);
        return response({ data: pending ? [request] : [] });
      }),
    );
    const client = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule' }));
    await screen.findByText('No reschedule requests.');
    pending = true;
    act(() => triggerDashboardOverviewRefresh());
    await screen.findByText('108 Example Street');
    fireEvent.click(screen.getByRole('button', { name: 'Approve reschedule' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve reschedule' })).toBeEnabled());
    expect(screen.getByText('108 Example Street')).toBeInTheDocument();
    client.clear();
  });
});
