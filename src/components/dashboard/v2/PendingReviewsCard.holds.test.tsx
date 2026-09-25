import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHoldRequests } from '@/features/dashboard/hooks/useHoldRequests';
import { triggerDashboardOverviewRefresh } from '@/realtime/realtimeRefreshBus';
import { PendingReviewsCard } from './PendingReviewsCard';

vi.mock('@/context/RequestManagerContext', () => ({ useRequestManager: () => ({ openModal: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const request = { id: 104, location: { fullAddress: '108 Example Street' }, client: { name: 'Client' }, holdReason: 'Waiting for staging' };
const response = (data: unknown, ok = true) => ({ ok, json: async () => data }) as Response;
function Queue() {
  const holds = useHoldRequests(true, 'admin:1');
  return <PendingReviewsCard reviews={[]} issues={[]} onSelect={vi.fn()} showClientTab holdRequests={holds} />;
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><Queue /></QueryClientProvider>);
  return client;
}

describe('hold request dashboard queue', () => {
  beforeEach(() => { localStorage.setItem('authToken', 'test-token'); });
  afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

  it.each(['approve', 'reject'] as const)('shows the saved request and %ss it through the hold endpoint', async (decision) => {
    let pending = true;
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
      if (String(url).endsWith(`/${decision}-hold`)) { pending = false; return response({}); }
      return response({ data: pending ? [request] : [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Hold (1)' }));
    expect(screen.getByText('108 Example Street')).toBeInTheDocument();
    expect(screen.getByText('Waiting for staging')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: decision === 'approve' ? 'Approve hold' : 'Reject hold' }));
    await screen.findByText('No pending hold requests.');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/shoots/104/${decision}-hold`), expect.objectContaining({ method: 'POST' }));
    client.clear();
  });

  it('keeps a request visible after a failed decision and refreshes when a shoot event arrives', async () => {
    let pending = false;
    vi.stubGlobal('fetch', vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') return response({ message: 'Could not approve' }, false);
      return response({ data: pending ? [request] : [] });
    }));
    const client = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Hold' }));
    await screen.findByText('No pending hold requests.');
    pending = true;
    act(() => triggerDashboardOverviewRefresh());
    await screen.findByText('108 Example Street');
    fireEvent.click(screen.getByRole('button', { name: 'Approve hold' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve hold' })).toBeEnabled());
    expect(screen.getByText('108 Example Street')).toBeInTheDocument();
    client.clear();
  });
});
