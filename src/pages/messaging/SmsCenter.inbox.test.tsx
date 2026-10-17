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
  resumeSmsThreadAi: vi.fn(), sendSms: vi.fn(), sendSmsMessageToThread: vi.fn(),
  getSmsGroups: vi.fn().mockResolvedValue([]), getSmsRecipients: vi.fn().mockResolvedValue([]),
  saveSmsGroup: vi.fn(), deleteSmsGroup: vi.fn(), updateSmsContact: vi.fn(), updateSmsContactComment: vi.fn(),
  getTemplates: vi.fn().mockResolvedValue([]),
}));
import { getSmsThread, getSmsThreads } from '@/services/messaging';

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
  it.each([true, false])('opens automated-only messages through the admin menu and returns to Inbox (mobile: %s)', async mobile => {
    state.mobile = mobile;
    const user = userEvent.setup(); mount();
    await screen.findByRole('button', { name: /Client conversation/ });
    await user.click(screen.getByRole('button', { name: 'Conversation actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'System SMS' }));
    expect(await screen.findByRole('button', { name: /Automated reminder/ })).toBeInTheDocument();
    expect(getSmsThreads).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'system', page: 1 }));
    expect(screen.queryByRole('button', { name: /Client conversation/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to inbox' }));
    expect(await screen.findByRole('button', { name: /Client conversation/ })).toBeInTheDocument();
    expect(getSmsThreads).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'inbox' }));
  });

  it.each(['editing_manager', 'salesRep', 'photographer'])('keeps System SMS out of the %s menu and query', async role => {
    state.role = role; const user = userEvent.setup(); mount('/messaging/sms?scope=system');
    await screen.findByRole('button', { name: /Client conversation/ });
    await user.click(screen.getByRole('button', { name: 'Conversation actions' }));
    expect(screen.queryByRole('menuitem', { name: 'System SMS' })).not.toBeInTheDocument();
    expect(getSmsThreads).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'inbox' }));
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
