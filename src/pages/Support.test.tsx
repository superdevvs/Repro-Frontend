import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Support from './Support';
import type { TicketDetail, TicketList } from '@/services/supportTickets';

const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), assignees: vi.fn(), create: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 77, role: 'admin' } }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/services/supportTickets', async (original) => ({
  ...await original<typeof import('@/services/supportTickets')>(),
  listSupportTickets: api.list, getSupportTicket: api.detail, listSupportAssignees: api.assignees, createSupportTicket: api.create,
}));
afterEach(cleanup);
beforeEach(() => { auth.user = { id: 77, role: 'admin' }; Object.values(api).forEach(mock => mock.mockReset()); });

function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }

describe('Support permission revocation', () => {
  it('removes cached cross-account subjects and private messages when access is revoked', async () => {
    const ticket: TicketDetail['data'] = { id: 9, reference: 'SUP-000009', subject: 'Confidential customer issue', category: 'other', status: 'open', priority: 'normal', version: 1, page_path: null, requester: { id: 12, name: 'Private customer', role: 'client' }, assignee: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', can_manage: true };
    const detail: TicketDetail = { data: ticket, messages: [{ id: 1, body: 'Private internal investigation', internal: true, kind: 'note', author: { id: 77, name: 'Admin' }, created_at: ticket.created_at }], meta: { current_page: 1, last_page: 1, total: 1 } };
    const list: TicketList = { data: [ticket], meta: { can_manage: true, categories: [], statuses: [], pagination: { current_page: 1, last_page: 1, total: 1, per_page: 20 } } };
    api.list.mockResolvedValue(list); api.detail.mockResolvedValue(detail); api.assignees.mockResolvedValue([]);
    const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={query}><MemoryRouter initialEntries={['/messaging/email/inbox?tab=support&ticket=9']}><Support /><Location /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText('Private internal investigation')).toBeInTheDocument();
    api.detail.mockRejectedValue({ response: { status: 404 } });
    api.list.mockRejectedValue({ response: { status: 403 } });
    await act(async () => { await Promise.all([query.invalidateQueries({ queryKey: ['support-ticket'] }), query.invalidateQueries({ queryKey: ['support-tickets'] })]); });
    await waitFor(() => expect(screen.queryByText('Private internal investigation')).not.toBeInTheDocument());
    expect(screen.queryAllByText('Confidential customer issue')).toHaveLength(0);
    expect(screen.queryAllByText('Private customer')).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Request unavailable' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All requests' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/messaging/email/inbox?tab=support');
    query.clear();
  });

  it('isolates drafts and ignores a previous account’s delayed submission after switching accounts', async () => {
    api.list.mockResolvedValue({ data: [], meta: { can_manage: false, categories: [], statuses: [], pagination: { current_page: 1, last_page: 1, total: 0, per_page: 20 } } });
    let finish!: (ticket: Partial<TicketDetail['data']>) => void;
    api.create.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const app = <QueryClientProvider client={query}><MemoryRouter initialEntries={['/support?new=1']}><Support /><Location /></MemoryRouter></QueryClientProvider>;
    const view = render(app);
    fireEvent.change(screen.getByLabelText('Request subject'), { target: { value: 'Private first account draft' } });
    fireEvent.change(screen.getByLabelText('Request details'), { target: { value: 'First account private support description.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledOnce());
    auth.user = { id: 88, role: 'client' };
    view.rerender(<QueryClientProvider client={query}><MemoryRouter initialEntries={['/support?new=1']}><Support /><Location /></MemoryRouter></QueryClientProvider>);
    expect(screen.getByLabelText('Request subject')).toHaveValue('');
    expect(screen.getByLabelText('Request details')).toHaveValue('');
    await act(async () => { finish({ id: 99 }); });
    expect(screen.getByTestId('location')).toHaveTextContent('/support?new=1');
    expect(screen.getByLabelText('Request subject')).toHaveValue('');
    expect(screen.queryByText('Private first account draft')).not.toBeInTheDocument();
    query.clear();
  });
});
