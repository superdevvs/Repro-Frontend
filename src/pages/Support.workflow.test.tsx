import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Support from './Support';
import type { SupportTicket, TicketDetail } from '@/services/supportTickets';

const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), create: vi.fn(), reply: vi.fn(), assignees: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: '17', role: 'photographer' } }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/services/supportTickets', async original => ({ ...await original<typeof import('@/services/supportTickets')>(), listSupportTickets: api.list, getSupportTicket: api.detail, createSupportTicket: api.create, replySupportTicket: api.reply, listSupportAssignees: api.assignees }));
const ticket: SupportTicket = { id: 3, reference: 'SUP-000003', subject: 'Upload question', category: 'uploads', status: 'open', priority: 'normal', page_path: null, version: 1, requester: { id: 17, name: 'Photographer', role: 'photographer' }, assignee: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', can_manage: false };
const detail: TicketDetail = { data: ticket, messages: [{ id: 1, body: 'Initial request from photographer', internal: false, kind: 'opened', author: { id: 17, name: 'Photographer' }, created_at: ticket.created_at }], meta: { current_page: 1, last_page: 2, total: 21 } };
beforeEach(() => {
  Object.values(api).forEach(mock => mock.mockReset()); auth.user = { id: '17', role: 'photographer' };
  api.list.mockImplementation(({ page }) => Promise.resolve({ data: page === 1 ? [ticket] : [{ ...ticket, id: 4, subject: 'Second page request' }], meta: { can_manage: false, categories: [], statuses: [], pagination: { current_page: page, last_page: 2, total: 21, per_page: 20 } } }));
  api.detail.mockResolvedValue(detail); api.assignees.mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
function view(path = '/messaging/email/inbox?tab=support', state?: unknown) {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><MemoryRouter initialEntries={[{ pathname: path.split('?')[0], search: `?${path.split('?')[1]}`, state }]}><Support /></MemoryRouter></QueryClientProvider>);
  return query;
}
it('pages requests and restarts search on page one without an initial empty-search pagination reset', async () => {
  view(); await screen.findByRole('heading', { name: 'Upload question' });
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Support request pages' })).getByRole('button', { name: 'Next' }));
  expect(await screen.findByRole('heading', { name: 'Second page request' })).toBeVisible();
  fireEvent.change(screen.getByLabelText('Search support requests'), { target: { value: 'Upload' } });
  await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ page: 1, query: 'Upload', status: undefined }, expect.any(AbortSignal)));
});
it('shows incoming request and conversation updates without replacing a typed reply', async () => {
  const query = view('/messaging/email/inbox?tab=support&ticket=3');
  await screen.findByText('Initial request from photographer');
  fireEvent.change(screen.getByLabelText('Reply'), { target: { value: 'I am still writing this reply.' } });
  api.list.mockResolvedValue({ data: [ticket, { ...ticket, id: 5, subject: 'New editor question' }], meta: { can_manage: false, categories: [], statuses: [], pagination: { current_page: 1, last_page: 1, total: 2, per_page: 20 } } });
  api.detail.mockResolvedValue({ ...detail, messages: [...detail.messages, { ...detail.messages[0], id: 2, body: 'Support just replied', author: { id: 1, name: 'Support agent' } }] });
  await act(async () => { await Promise.all([query.invalidateQueries({ queryKey: ['support-tickets'] }), query.invalidateQueries({ queryKey: ['support-ticket'] })]); });
  expect(await screen.findByRole('heading', { name: 'New editor question' })).toBeInTheDocument();
  expect(screen.getByText('Support just replied')).toBeInTheDocument(); expect(screen.getByLabelText('Reply')).toHaveValue('I am still writing this reply.');
  fireEvent.click(screen.getByRole('button', { name: 'Older messages' }));
  await waitFor(() => expect(api.detail).toHaveBeenLastCalledWith(3, 2, expect.any(AbortSignal)));
  expect(screen.getByLabelText('Reply')).toHaveValue('I am still writing this reply.');
});
it('keeps a failed request and its attachments for retry, with no client/account identity override', async () => {
  api.create.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValueOnce(ticket);
  view('/messaging/email/inbox?tab=support&new=1');
  fireEvent.change(screen.getByLabelText('Request subject'), { target: { value: 'Upload question' } });
  fireEvent.change(screen.getByLabelText('Request details'), { target: { value: 'My photographer upload needs help.' } });
  const file = new File(['screen'], 'screen.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Attach files'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your draft is still here');
  expect(screen.getByLabelText('Request details')).toHaveValue('My photographer upload needs help.');
  expect(screen.getByRole('list', { name: 'Files to attach' })).toHaveTextContent('screen.png');
  fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));
  await waitFor(() => expect(api.create).toHaveBeenCalledTimes(2));
  const first = api.create.mock.calls[0][0]; const second = api.create.mock.calls[1][0];
  expect(second.request_key).toBe(first.request_key);
  expect(second).toEqual({ request_key: expect.any(String), subject: 'Upload question', body: 'My photographer upload needs help.', category: 'other', attachments: [file] });
  expect(await screen.findByText('Initial request from photographer')).toBeInTheDocument();
});
it('retains a failed reply and sends the same request key on retry', async () => {
  api.reply.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValueOnce(ticket);
  view('/messaging/email/inbox?tab=support&ticket=3'); await screen.findByText('Initial request from photographer');
  fireEvent.change(screen.getByLabelText('Reply'), { target: { value: 'My update' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your draft is still here');
  expect(screen.getByLabelText('Reply')).toHaveValue('My update');
  fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
  await waitFor(() => expect(api.reply).toHaveBeenCalledTimes(2));
  expect(api.reply.mock.calls[0][1].request_key).toBe(api.reply.mock.calls[1][1].request_key);
  await waitFor(() => expect(screen.getByLabelText('Reply')).toHaveValue(''));
});
it('opens a legacy reply prefill for its owner without sending or showing another account draft', async () => {
  const state = { supportReplyPrefill: { ticketId: 3, ownerId: '17', subject: 'Upload question', body: 'Preserved reply', attachmentNames: [] } };
  view('/messaging/email/inbox?tab=support&ticket=3', state); await screen.findByText('Initial request from photographer');
  expect(screen.getByLabelText('Reply')).toHaveValue('Preserved reply'); expect(api.reply).not.toHaveBeenCalled();
});
