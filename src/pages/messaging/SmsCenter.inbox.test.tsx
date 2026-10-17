import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SmsThreadSummary } from '@/types/messaging';
import SmsCenter from './SmsCenter';

const state = vi.hoisted(() => ({ role: 'admin', mobile: true, onThreadUpdated: undefined as ((thread: SmsThreadSummary) => void) | undefined }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: state.role }) }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => state.mobile }));
vi.mock('@/hooks/use-page-loading', () => ({ usePageLoading: () => false }));
vi.mock('@/hooks/use-sms-realtime', () => ({
  useSmsRealtime: (options: { onThreadUpdated: typeof state.onThreadUpdated }) => { state.onThreadUpdated = options.onThreadUpdated; },
}));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/services/messaging', () => ({
  getSmsThreads: vi.fn(), getSmsThread: vi.fn(), markSmsThreadRead: vi.fn().mockResolvedValue(undefined),
  getSmsSenders: vi.fn().mockResolvedValue([]),
  resumeSmsThreadAi: vi.fn(), sendSms: vi.fn(), sendSmsMessageToThread: vi.fn(),
  getSmsGroups: vi.fn().mockResolvedValue([]), getSmsRecipients: vi.fn().mockResolvedValue([]),
  saveSmsGroup: vi.fn(), deleteSmsGroup: vi.fn(), updateSmsContact: vi.fn(), updateSmsContactComment: vi.fn(),
  getTemplates: vi.fn().mockResolvedValue([]),
}));
import { getSmsSenders, getSmsThread, getSmsThreads, sendSmsMessageToThread } from '@/services/messaging';

const thread = (id: string, name: string): SmsThreadSummary => ({
  id, unread: false, inboxScope: 'inbox',
  contact: { id, name, primaryNumber: '+17035550100', numbers: [] },
});
const active = thread('active', 'Client conversation');
const system = { ...thread('system', 'Automated reminder'), inboxScope: 'system' as const };
const clients: QueryClient[] = [];
function mount(path = '/messaging/sms') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={client}><SmsCenter /></QueryClientProvider></MemoryRouter>);
  return client;
}
beforeEach(() => {
  state.role = 'admin';
  state.mobile = true;
  state.onThreadUpdated = undefined;
  vi.mocked(getSmsThreads).mockReset().mockImplementation(async (params) => ({
    data: params?.scope === 'system' ? [system] : [active],
    meta: { current_page: params?.page ?? 1, last_page: 2, per_page: 50, total: 51 },
  }));
  vi.mocked(getSmsThread).mockImplementation(async id => {
    const selected = id === system.id ? system : active;
    return { thread: selected, contact: selected.contact!, messages: [] };
  });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

describe('SMS inbox scopes and search', () => {
  it('preserves the conversation sender and opens the returned pair when superadmin changes From', async () => {
    state.role = 'superadmin';
    const user = userEvent.setup();
    const alternate = { ...active, id: 'alternate-line', businessNumber: '+12025550102' };
    const main = { ...active, id: 'main-line', businessNumber: '+12025550101' };
    vi.mocked(getSmsSenders).mockResolvedValue([
      { id: 1, phone_number: main.businessNumber, label: 'Main', is_default: true },
      { id: 2, phone_number: alternate.businessNumber, label: 'Operations' },
    ]);
    vi.mocked(getSmsThreads).mockResolvedValue({ data: [alternate], meta: {} });
    vi.mocked(getSmsThread).mockImplementation(async id => {
      const selected = id === main.id ? main : alternate;
      return { thread: selected, contact: selected.contact!, messages: [] };
    });
    vi.mocked(sendSmsMessageToThread).mockResolvedValue({
      thread: main, message: { id: 'sent', threadId: main.id, direction: 'OUTBOUND', body: 'Hello from main' },
    });
    const client = mount();
    client.setQueryData(['sms-thread', main.id, undefined, 'superadmin'], { thread: main, contact: main.contact!, messages: [] });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await user.click(await screen.findByRole('button', { name: /Client conversation/ }));
    expect(await screen.findByRole('combobox', { name: 'SMS sender number' })).toHaveValue('2');
    await user.selectOptions(screen.getByRole('combobox', { name: 'SMS sender number' }), '1');
    await user.type(screen.getByPlaceholderText('Write a message to Client conversation'), 'Hello from main');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(sendSmsMessageToThread).toHaveBeenCalledWith(alternate.id, { body: 'Hello from main', sms_number_id: 1 }));
    await waitFor(() => expect(getSmsThread).toHaveBeenLastCalledWith(main.id));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sms-thread', main.id] });
    expect(await screen.findByRole('combobox', { name: 'SMS sender number' })).toHaveValue('1');
    expect(screen.getByPlaceholderText('Write a message to Client conversation')).toHaveValue('');
  });

  it.each(['admin', 'superadmin'])('orders Inbox first for %s and moves System out of the actions menu', async role => {
    state.role = role;
    const user = userEvent.setup(); mount();
    await screen.findByRole('button', { name: /Client conversation/ });
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Inbox', 'Unanswered', 'Mine', 'System']);
    expect(screen.getByRole('tab', { name: 'Inbox' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'Clients' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Conversation actions' }));
    expect(screen.queryByRole('menuitem', { name: /System|Back to inbox/ })).not.toBeInTheDocument();
  });

  it.each([true, false])('opens automated-only messages through the System tab and returns to Inbox (mobile: %s)', async mobile => {
    state.mobile = mobile;
    const user = userEvent.setup(); mount();
    await screen.findByRole('button', { name: /Client conversation/ });
    await user.click(screen.getByRole('tab', { name: 'System' }));
    expect(await screen.findByRole('button', { name: /Automated reminder/ })).toBeInTheDocument();
    expect(getSmsThreads).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'system', page: 1 }));
    expect(screen.queryByRole('button', { name: /Client conversation/ })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'System' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: 'Back to inbox' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Conversation actions' }));
    expect(screen.queryByRole('menuitem', { name: /System|Back to inbox/ })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('tab', { name: 'Inbox' }));
    expect(await screen.findByRole('button', { name: /Client conversation/ })).toBeInTheDocument();
    expect(getSmsThreads).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'inbox' }));
  });

  it.each(['editing_manager', 'salesRep', 'photographer'])('keeps only Inbox, Unanswered, and Mine for %s and rejects a System deep link', async role => {
    state.role = role; const user = userEvent.setup(); mount('/messaging/sms?scope=system');
    await screen.findByRole('button', { name: /Client conversation/ });
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Inbox', 'Unanswered', 'Mine']);
    expect(screen.queryByRole('tab', { name: 'Clients' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'System' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Conversation actions' }));
    expect(screen.queryByRole('menuitem', { name: /System|Back to inbox/ })).not.toBeInTheDocument();
    expect(getSmsThreads).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'inbox' }));
  });

  it.each([
    { tab: 'Inbox', filter: undefined },
    { tab: 'Unanswered', filter: 'unanswered' },
    { tab: 'Mine', filter: 'my_recents' },
  ])('switches System to $tab on page one and clears the selected conversation', async ({ tab, filter }) => {
    state.mobile = false;
    const user = userEvent.setup(); mount('/messaging/sms?scope=system&thread=system');
    await screen.findByPlaceholderText('Write a message to Automated reminder');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(getSmsThreads).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'system', page: 2 })));
    vi.mocked(getSmsThread).mockClear();

    await user.click(screen.getByRole('tab', { name: tab }));

    await waitFor(() => expect(getSmsThreads).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'inbox', filter, page: 1 })));
    expect(await screen.findByRole('button', { name: /Client conversation/ })).toHaveAttribute('data-active', 'false');
    expect(screen.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Select a conversation')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Write a message to Automated reminder')).not.toBeInTheDocument();
    expect(getSmsThread).not.toHaveBeenCalled();
  });

  it('searches trimmed historical text from page one and clears back to the full inbox', async () => {
    const user = userEvent.setup(); mount();
    await screen.findByRole('button', { name: /Client conversation/ });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(getSmsThreads).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    await user.type(screen.getByRole('textbox', { name: 'Search SMS' }), '  missing kitchen photos  ');
    await waitFor(() => expect(getSmsThreads).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'missing kitchen photos', page: 1 })));
    await user.click(screen.getByRole('button', { name: 'Clear SMS search' }));
    await waitFor(() => expect(getSmsThreads).toHaveBeenLastCalledWith(expect.objectContaining({ search: undefined, page: 1 })));
    expect(screen.getByRole('textbox', { name: 'Search SMS' })).toHaveValue('');
  });

  it('reapplies server scope and search when a nonmatching live thread arrives', async () => {
    const client = mount();
    await screen.findByRole('button', { name: /Client conversation/ });
    const before = vi.mocked(getSmsThreads).mock.calls.length;
    act(() => state.onThreadUpdated?.(system));
    await waitFor(() => expect(vi.mocked(getSmsThreads).mock.calls.length).toBeGreaterThan(before));
    expect(screen.queryByRole('button', { name: /Automated reminder/ })).not.toBeInTheDocument();
    expect(client.getQueriesData<{ data: SmsThreadSummary[] }>({ queryKey: ['sms-threads'] })[0][1]?.data).toEqual([active]);
  });
});
