import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canViewOverdueClients, useOverdueClients } from '@/features/dashboard/hooks/useOverdueClients';
import { triggerDashboardOverviewRefresh } from '@/realtime/realtimeRefreshBus';
import { PendingReviewsCard } from './PendingReviewsCard';

vi.mock('@/context/RequestManagerContext', () => ({ useRequestManager: () => ({ openModal: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({ Authorization: 'Bearer test-token' }) }));

const client = {
  id: 20, name: 'Client One', email: 'client@example.test', phone: '555-0100', balanceDue: 425, oldestDays: 40,
  shoots: [{ id: 101, address: '123 Maryland Street, MD', completedAt: '2026-08-21T12:00:00Z', daysSinceCompletion: 40, balanceDue: 425 }],
};
const response = (data: unknown, ok = true) => ({ ok, json: async () => data }) as Response;

function Queue({ role = 'superadmin', id = 1 }: { role?: string; id?: number }) {
  const enabled = canViewOverdueClients(role);
  const overdue = useOverdueClients(enabled, `${role}:${id}`);
  return <>
    <button onClick={overdue.refresh}>Refresh balances</button>
    <PendingReviewsCard reviews={[]} issues={[]} onSelect={vi.fn()} showClientTab overdueClients={enabled ? overdue : undefined} />
  </>;
}

function mount(role = 'superadmin') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (nextRole: string, id = 1) => (
    <MemoryRouter><QueryClientProvider client={queryClient}><Queue role={nextRole} id={id} /></QueryClientProvider></MemoryRouter>
  );
  const rendered = render(ui(role));
  return { ...rendered, queryClient, ui };
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Overdue clients in Requests', () => {
  it('expands the overdue category and client balances with the correct shoot link', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ data: [client], meta: { total: 1, page: 1, lastPage: 1 } })));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Overdue (1)' }));
    const summary = screen.getByText('Client One').closest('summary')!;
    expect(summary.parentElement).not.toHaveAttribute('open');
    fireEvent.click(summary);
    expect(summary.parentElement).toHaveAttribute('open');
    expect(screen.getByRole('link', { name: '123 Maryland Street, MD' })).toHaveAttribute('href', '/shoots/101');
    expect(screen.getByText('$425.00 due')).toBeVisible();
    expect(screen.getByRole('link', { name: 'client@example.test' })).toHaveAttribute('href', 'mailto:client@example.test');
    fireEvent.click(screen.getByRole('button', { name: 'Back to Requests' }));
    expect(screen.getByRole('button', { name: 'Overdue (1)' })).toBeVisible();
  });

  it.each(['admin', 'editing_manager', 'photographer', 'editor', 'client'])('does not fetch, refetch, or show overdue for %s', async (role) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    mount(role);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh balances' }));
    await act(async () => { triggerDashboardOverviewRefresh(); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Overdue/ })).not.toBeInTheDocument();
  });

  it('paginates clients and refreshes after payment changes', async () => {
    let paid = false;
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => response({
      data: paid ? [] : String(url).endsWith('page=2') ? [{ ...client, id: 21, name: 'Client Two' }] : [client],
      meta: { total: paid ? 0 : 16, page: String(url).endsWith('page=2') ? 2 : 1, lastPage: paid ? 1 : 2 },
    }));
    vi.stubGlobal('fetch', fetchMock);
    mount('salesRep');
    fireEvent.click(await screen.findByRole('button', { name: 'Overdue (16)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Client Two');
    expect(screen.queryByText('Client One')).not.toBeInTheDocument();
    paid = true;
    await act(async () => { triggerDashboardOverviewRefresh(); });
    await screen.findByText('No overdue clients.');
    expect(screen.queryByText('Client Two')).not.toBeInTheDocument();
  });

  it('does not retain another viewer balances when switching accounts', async () => {
    let resolveSecond: (value: Response) => void = () => undefined;
    const second = new Promise<Response>((resolve) => { resolveSecond = resolve; });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ data: [client], meta: { total: 1, page: 1, lastPage: 1 } })).mockReturnValueOnce(second));
    const mounted = mount('salesRep');
    fireEvent.click(await screen.findByRole('button', { name: 'Overdue (1)' }));
    await screen.findByText('Client One');
    mounted.rerender(mounted.ui('salesRep', 2));
    expect(screen.queryByText('Client One')).not.toBeInTheDocument();
    await act(async () => { resolveSecond(response({ data: [], meta: { total: 0, page: 1, lastPage: 1 } })); });
    await screen.findByText('No overdue clients.');
  });

  it('shows a retry action for failed loading', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({}, false)).mockResolvedValueOnce(response({ data: [], meta: { total: 0, page: 1, lastPage: 1 } }));
    vi.stubGlobal('fetch', fetchMock);
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Overdue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load overdue clients');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('No overdue clients.')).toBeVisible());
  });
});
