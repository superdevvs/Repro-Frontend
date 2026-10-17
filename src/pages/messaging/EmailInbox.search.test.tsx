import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import EmailInbox from './EmailInbox';
import type { Message } from '@/types/messaging';

const state = vi.hoisted(() => ({ mobile: false, list: vi.fn(), detail: vi.fn(), read: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: 'admin', user: { id: 5 } }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => state.mobile }));
vi.mock('@/hooks/use-page-loading', () => ({ usePageLoading: () => undefined }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/messaging/email/EmailNavigation', () => ({ EmailNavigation: () => null }));
vi.mock('@/components/messaging/email/EmailMessageDetail', () => ({ EmailMessageDetail: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>Close message</button> }));
vi.mock('@/services/messaging', () => ({ getEmailMessages: state.list, getEmailMessage: state.detail, markEmailThreadRead: state.read }));

function message(id: number, subject: string): Message {
  return { id, subject, channel: 'EMAIL', direction: 'OUTBOUND', from_address: 'office@example.test', to_address: 'client@example.test', body_text: 'Older message text', status: 'SENT', send_source: 'MANUAL', created_at: '2026-10-15T00:00:00Z', updated_at: '2026-10-15T00:00:00Z' };
}

beforeEach(() => {
  state.mobile = false;
  Object.values(state).forEach(value => { if (typeof value === 'function') value.mockReset(); });
  state.list.mockImplementation(({ page, search, status }) => Promise.resolve({
    data: [message(page, search ? `Found ${search}` : status ? `Status ${status}` : `Page ${page} message`)],
    current_page: page, last_page: 2, total: 26,
  }));
  state.read.mockResolvedValue({});
});
afterEach(cleanup);

function view() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const app = <QueryClientProvider client={client}><MemoryRouter initialEntries={['/messaging/email/inbox']}><EmailInbox /></MemoryRouter></QueryClientProvider>;
  const result = render(app);
  return { ...result, app };
}

it('searches while typing across older results, restarts at page one and restores all messages when cleared', async () => {
  view();
  await screen.findByText('Page 1 message');
  const pages = screen.getByRole('navigation', { name: 'Email message pages' });
  fireEvent.click(within(pages).getByRole('button', { name: 'Next' }));
  await screen.findByText('Page 2 message');
  fireEvent.change(screen.getByLabelText('Search email messages'), { target: { value: '  historical window  ' } });
  await screen.findByText('Found historical window');
  expect(state.list).toHaveBeenLastCalledWith({ page: 1, per_page: 25, search: 'historical window', status: undefined });
  fireEvent.click(screen.getByRole('button', { name: 'Clear email search' }));
  await screen.findByText('Page 1 message');
  expect(screen.getByLabelText('Search email messages')).toHaveValue('');
  expect(screen.queryByRole('button', { name: 'Clear email search' })).not.toBeInTheDocument();
});

it('keeps the search input and focus during loading and surfaces failures with retry', async () => {
  view();
  await screen.findByText('Page 1 message');
  let finish!: (value: unknown) => void;
  state.list.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const input = screen.getByLabelText('Search email messages');
  input.focus();
  fireEvent.change(input, { target: { value: 'window' } });
  await screen.findByRole('status', { name: 'Loading email messages' });
  expect(screen.getByLabelText('Search email messages')).toBe(input);
  expect(input).toHaveFocus();
  await act(async () => { finish({ data: [], last_page: 1, current_page: 1, total: 0 }); });
  expect(await screen.findByText('No matching messages')).toBeVisible();
  state.list.mockRejectedValue(new Error('Request failed'));
  fireEvent.change(input, { target: { value: 'other' } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Messages could not be loaded');
  state.list.mockResolvedValue({ data: [message(2, 'Recovered result')], current_page: 1, last_page: 1, total: 1 });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Recovered result')).toBeVisible();
});

it('combines status filters with search and resets pagination when the status changes', async () => {
  view();
  await screen.findByText('Page 1 message');
  fireEvent.change(screen.getByLabelText('Search email messages'), { target: { value: 'window' } });
  await screen.findByText('Found window');
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Email message pages' })).getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(state.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, search: 'window' })));
  fireEvent.click(screen.getByRole('button', { name: 'All Messages' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Failed' }));
  await waitFor(() => expect(state.list).toHaveBeenLastCalledWith({ page: 1, per_page: 25, search: 'window', status: 'FAILED' }));
});

it('retains the search text and status after opening and closing a message on mobile', async () => {
  state.mobile = true;
  view();
  await screen.findByText('Page 1 message');
  fireEvent.change(screen.getByLabelText('Search email messages'), { target: { value: 'window' } });
  fireEvent.click(await screen.findByText('Found window'));
  expect(screen.queryByLabelText('Search email messages')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close message' }));
  expect(screen.getByLabelText('Search email messages')).toHaveValue('window');
  expect(screen.getByText('Found window')).toBeVisible();
});
