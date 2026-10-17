import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SmsThreadDetail, SmsThreadSummary } from '@/types/messaging';
import type { SmsSendResult } from '@/services/messaging';
import SmsCenter from './SmsCenter';

const state = vi.hoisted(() => ({
  role: 'admin',
  user: { id: 1 },
  mobile: false,
  realtimeThreadId: null as string | null,
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: state.role, user: state.user }) }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => state.mobile }));
vi.mock('@/hooks/use-page-loading', () => ({ usePageLoading: () => false }));
vi.mock('@/hooks/use-sms-realtime', () => ({
  useSmsRealtime: (options: { threadId: string | null }) => { state.realtimeThreadId = options.threadId; },
}));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/services/messaging', () => ({
  getSmsThreads: vi.fn(), getSmsThread: vi.fn(), markSmsThreadRead: vi.fn(),
  getSmsSenders: vi.fn(), resumeSmsThreadAi: vi.fn(), sendSms: vi.fn(), sendSmsMessageToThread: vi.fn(),
  getSmsGroups: vi.fn(), getSmsRecipients: vi.fn(), saveSmsGroup: vi.fn(), deleteSmsGroup: vi.fn(),
  updateSmsContact: vi.fn(), updateSmsContactComment: vi.fn(), getTemplates: vi.fn(),
}));
import {
  getSmsGroups, getSmsRecipients, getSmsSenders, getSmsThread, getSmsThreads, getTemplates,
  markSmsThreadRead, sendSms,
} from '@/services/messaging';

const makeThread = (id: string, name: string, inboxScope: 'inbox' | 'system' = 'inbox'): SmsThreadSummary => ({
  id, unread: false, inboxScope, businessNumber: '+12025550101',
  contact: { id: `contact-${id}`, name, primaryNumber: '+17035550100', numbers: [] },
});
const lee = makeThread('lee', 'Lee Gedansky');
const alex = makeThread('alex', 'Alex Morgan');
const system = makeThread('system', 'Automated reminder', 'system');
const sentThread = makeThread('canonical', 'New recipient');
const detail = (thread: SmsThreadSummary): SmsThreadDetail => ({ thread, contact: thread.contact!, messages: [] });
const clients: QueryClient[] = [];

function NavigationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="sms-location">{location.pathname}{location.search}</output><button onClick={() => navigate(-1)}>Browser back</button></>;
}

function mount(path = '/messaging/sms') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  const app = () => <MemoryRouter initialEntries={[path]}><QueryClientProvider client={client}><NavigationProbe /><SmsCenter /></QueryClientProvider></MemoryRouter>;
  const view = render(app());
  return { client, rerenderActor: () => view.rerender(app()) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(finish => { resolve = finish; });
  return { promise, resolve };
}

async function addressAndWrite(user: ReturnType<typeof userEvent.setup>, body = 'A fresh SMS') {
  await user.type(screen.getByRole('textbox', { name: 'To' }), '+12025550117{Enter}');
  await user.type(screen.getByRole('textbox', { name: 'Message' }), body);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.role = 'admin'; state.user = { id: 1 }; state.mobile = false; state.realtimeThreadId = null;
  vi.mocked(getSmsThreads).mockImplementation(async params => ({
    data: params?.scope === 'system' ? [system] : [lee, alex],
    meta: { current_page: 1, last_page: 1, per_page: 50, total: params?.scope === 'system' ? 1 : 2 },
  }));
  vi.mocked(getSmsThread).mockImplementation(async id => detail([lee, alex, system, sentThread].find(thread => thread.id === id) ?? lee));
  vi.mocked(markSmsThreadRead).mockResolvedValue(undefined);
  vi.mocked(getSmsGroups).mockResolvedValue([]);
  vi.mocked(getSmsRecipients).mockResolvedValue([]);
  vi.mocked(getTemplates).mockResolvedValue([]);
  vi.mocked(getSmsSenders).mockResolvedValue([
    { id: 1, label: 'Main', phone_number: '+12025550101', is_default: true },
    { id: 2, label: 'Operations', phone_number: '+12025550102' },
  ]);
  vi.mocked(sendSms).mockReset().mockResolvedValue({ thread: sentThread, sent: 1 });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

describe('SMS compose in the conversation pane', () => {
  it.each([false, true])('starts a new, unselected compose pane without fetching or reading another thread (mobile: %s)', async mobile => {
    state.mobile = mobile;
    const user = userEvent.setup(); mount();
    await screen.findByRole('button', { name: /Lee Gedansky/ });
    if (!mobile) await screen.findByPlaceholderText('Write a message to Lee Gedansky');
    vi.mocked(getSmsThread).mockClear(); vi.mocked(markSmsThreadRead).mockClear();

    await user.click(screen.getByRole('button', { name: 'Send new message' }));

    expect(await screen.findByRole('region', { name: 'New SMS' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'New SMS' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'To' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('');
    expect(screen.getByTestId('sms-location')).toHaveTextContent('/messaging/sms?compose=new');
    expect(state.realtimeThreadId).toBeNull();
    expect(getSmsThread).not.toHaveBeenCalled();
    expect(markSmsThreadRead).not.toHaveBeenCalled();
    if (mobile) expect(screen.queryByRole('button', { name: /Lee Gedansky/ })).not.toBeInTheDocument();
    else {
      expect(screen.getByRole('button', { name: /Lee Gedansky/ })).toHaveAttribute('data-active', 'false');
      expect(screen.getByRole('button', { name: /Alex Morgan/ })).toHaveAttribute('data-active', 'false');
    }
  });

  it.each([false, true])('opens a compose deep link immediately and cancels to no selected conversation (mobile: %s)', async mobile => {
    state.mobile = mobile;
    const user = userEvent.setup(); mount('/messaging/sms?compose=new');
    expect(await screen.findByRole('region', { name: 'New SMS' })).toBeInTheDocument();
    expect(getSmsThread).not.toHaveBeenCalled(); expect(markSmsThreadRead).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region', { name: 'New SMS' })).not.toBeInTheDocument();
    expect(screen.getByTestId('sms-location')).toHaveTextContent('/messaging/sms');
    expect(screen.getByTestId('sms-location')).not.toHaveTextContent('compose=');
    expect(await screen.findByRole('button', { name: /Lee Gedansky/ })).toHaveAttribute('data-active', 'false');
    if (!mobile) expect(screen.getByText('Select a conversation')).toBeInTheDocument();
    expect(getSmsThread).not.toHaveBeenCalled(); expect(markSmsThreadRead).not.toHaveBeenCalled();
  });

  it('closes compose without restoring the previously selected desktop thread', async () => {
    const user = userEvent.setup(); mount('/messaging/sms?thread=alex');
    await screen.findByPlaceholderText('Write a message to Alex Morgan');
    await user.click(screen.getByRole('button', { name: 'Send new message' }));
    await user.click(screen.getByRole('button', { name: 'Close new SMS' }));
    expect(screen.getByText('Select a conversation')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Write a message to Alex Morgan')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alex Morgan/ })).toHaveAttribute('data-active', 'false');
    expect(screen.getByTestId('sms-location').textContent).toBe('/messaging/sms');
  });

  it('exits compose when a left conversation is selected and preserves each reply draft', async () => {
    const user = userEvent.setup(); mount('/messaging/sms?thread=lee');
    await user.type(await screen.findByPlaceholderText('Write a message to Lee Gedansky'), 'Existing Lee reply draft');
    await user.click(screen.getByRole('button', { name: 'Send new message' }));
    await addressAndWrite(user, 'Independent new message');
    await user.click(screen.getByRole('button', { name: /Alex Morgan/ }));
    expect(screen.queryByRole('region', { name: 'New SMS' })).not.toBeInTheDocument();
    expect(await screen.findByPlaceholderText('Write a message to Alex Morgan')).toHaveValue('');
    expect(screen.getByTestId('sms-location')).not.toHaveTextContent('compose=');
    await user.click(screen.getByRole('button', { name: /Lee Gedansky/ }));
    expect(await screen.findByPlaceholderText('Write a message to Lee Gedansky')).toHaveValue('Existing Lee reply draft');
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('sends a new recipient using the chosen From number and opens the returned canonical Inbox thread', async () => {
    state.role = 'superadmin';
    const user = userEvent.setup(); mount('/messaging/sms?scope=system&compose=new');
    const pane = await screen.findByRole('region', { name: 'New SMS' });
    expect(within(pane).getByRole('textbox', { name: 'To' })).toHaveValue('');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'SMS sender number' })).toHaveValue('1'));
    await user.selectOptions(screen.getByRole('combobox', { name: 'SMS sender number' }), '2');
    await addressAndWrite(user, 'New conversation from Operations');
    await user.click(screen.getByRole('button', { name: 'Send to 1 person' }));

    await waitFor(() => expect(sendSms).toHaveBeenCalledWith({
      to: '+12025550117', recipients: undefined, group_ids: undefined,
      body_text: 'New conversation from Operations', sms_number_id: 2,
    }));
    await screen.findByPlaceholderText('Write a message to New recipient');
    expect(screen.queryByRole('region', { name: 'New SMS' })).not.toBeInTheDocument();
    expect(screen.getByTestId('sms-location').textContent).toBe('/messaging/sms?thread=canonical');
    expect(getSmsThread).toHaveBeenCalledWith(sentThread.id);
    expect(getSmsThreads).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'inbox', page: 1 }));
  });

  it.each([false, true])('browser Back from new compose returns to the list without auto-opening a conversation (mobile: %s)', async mobile => {
    state.mobile = mobile;
    const user = userEvent.setup(); mount();
    await screen.findByRole('button', { name: /Lee Gedansky/ });
    if (!mobile) await screen.findByPlaceholderText('Write a message to Lee Gedansky');
    await user.click(screen.getByRole('button', { name: 'Send new message' }));
    await screen.findByRole('region', { name: 'New SMS' });
    vi.mocked(getSmsThread).mockClear(); vi.mocked(markSmsThreadRead).mockClear();
    await user.click(screen.getByRole('button', { name: 'Browser back' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'New SMS' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Lee Gedansky/ })).toHaveAttribute('data-active', 'false');
    expect(screen.queryByPlaceholderText('Write a message to Lee Gedansky')).not.toBeInTheDocument();
    expect(getSmsThread).not.toHaveBeenCalled(); expect(markSmsThreadRead).not.toHaveBeenCalled();
  });

  it('browser Back restores an explicitly opened conversation and its reply draft', async () => {
    const user = userEvent.setup(); mount('/messaging/sms?thread=alex');
    await user.type(await screen.findByPlaceholderText('Write a message to Alex Morgan'), 'Alex reply draft');
    await user.click(screen.getByRole('button', { name: 'Send new message' }));
    await screen.findByRole('region', { name: 'New SMS' });
    await user.click(screen.getByRole('button', { name: 'Browser back' }));
    expect(await screen.findByPlaceholderText('Write a message to Alex Morgan')).toHaveValue('Alex reply draft');
    expect(screen.getByTestId('sms-location').textContent).toBe('/messaging/sms?thread=alex');
  });

  it.each([
    { id: 2, role: 'superadmin', reason: 'user changes' },
    { id: 1, role: 'editing_manager', reason: 'role changes' },
  ])('clears the new-message recipient, text, and sender when the authenticated $reason', async ({ id, role }) => {
    state.role = 'superadmin';
    const user = userEvent.setup(); const view = mount('/messaging/sms?compose=new');
    await screen.findByRole('region', { name: 'New SMS' });
    await addressAndWrite(user, 'Private administrator draft');
    await user.selectOptions(screen.getByRole('combobox', { name: 'SMS sender number' }), '2');
    state.user = { id }; state.role = role; view.rerenderActor();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'To' })).toHaveValue('');
    expect(screen.queryByText('+12025550117')).not.toBeInTheDocument();
    if (role === 'superadmin') {
      await waitFor(() => expect(screen.getByRole('combobox', { name: 'SMS sender number' })).toHaveValue('1'));
    } else expect(screen.queryByRole('combobox', { name: 'SMS sender number' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(sendSms).not.toHaveBeenCalled();
    expect(getSmsThread).not.toHaveBeenCalled();
  });

  it('preserves the compose draft and selected recipients after a send error', async () => {
    state.role = 'superadmin';
    vi.mocked(sendSms).mockRejectedValueOnce(new Error('Provider unavailable'));
    const user = userEvent.setup(); mount('/messaging/sms?compose=new');
    await screen.findByRole('region', { name: 'New SMS' });
    await addressAndWrite(user, 'Keep this draft for retry');
    await user.selectOptions(screen.getByRole('combobox', { name: 'SMS sender number' }), '2');
    await user.click(screen.getByRole('button', { name: 'Send to 1 person' }));
    await waitFor(() => expect(sendSms).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send to 1 person' })).toBeEnabled());
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Keep this draft for retry');
    expect(screen.getByRole('button', { name: 'Remove +12025550117' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'SMS sender number' })).toHaveValue('2');
    expect(screen.getByTestId('sms-location')).toHaveTextContent('compose=new');
    expect(getSmsThread).not.toHaveBeenCalled();
  });

  it('keeps a new actor’s compose usable and ignores the previous actor’s delayed send completion', async () => {
    const oldSend = deferred<SmsSendResult>();
    vi.mocked(sendSms).mockReturnValueOnce(oldSend.promise);
    const user = userEvent.setup(); const view = mount('/messaging/sms?compose=new');
    await screen.findByRole('region', { name: 'New SMS' });
    await addressAndWrite(user, 'Previous administrator message');
    await user.click(screen.getByRole('button', { name: 'Send to 1 person' }));
    await waitFor(() => expect(sendSms).toHaveBeenCalledTimes(1));

    state.user = { id: 2 }; state.role = 'editing_manager'; view.rerenderActor();
    expect(screen.getByRole('textbox', { name: 'To' })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('');
    await user.type(screen.getByRole('textbox', { name: 'To' }), '+12025550118{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Current manager draft');
    expect(screen.getByRole('button', { name: 'Send to 1 person' })).toBeEnabled();

    await act(async () => { oldSend.resolve({ thread: sentThread, sent: 1 }); });
    expect(screen.getByRole('region', { name: 'New SMS' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Current manager draft');
    expect(screen.getByRole('button', { name: 'Remove +12025550118' })).toBeInTheDocument();
    expect(screen.getByTestId('sms-location').textContent).toBe('/messaging/sms?compose=new');
    expect(getSmsThread).not.toHaveBeenCalled();
    expect(markSmsThreadRead).not.toHaveBeenCalled();
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it('keeps a fresh compose draft after browser Back when the previous send completes', async () => {
    const pending = deferred<SmsSendResult>();
    vi.mocked(sendSms).mockReturnValueOnce(pending.promise);
    const user = userEvent.setup(); mount();
    await screen.findByPlaceholderText('Write a message to Lee Gedansky');
    await user.click(screen.getByRole('button', { name: 'Send new message' }));
    await screen.findByRole('region', { name: 'New SMS' });
    await addressAndWrite(user, 'Sending before browser Back');
    await user.click(screen.getByRole('button', { name: 'Send to 1 person' }));
    await waitFor(() => expect(sendSms).toHaveBeenCalledTimes(1));
    vi.mocked(getSmsThread).mockClear(); vi.mocked(markSmsThreadRead).mockClear();

    await user.click(screen.getByRole('button', { name: 'Browser back' }));
    expect(screen.queryByRole('region', { name: 'New SMS' })).not.toBeInTheDocument();
    expect(screen.getByText('Select a conversation')).toBeInTheDocument();
    expect(screen.getByTestId('sms-location').textContent).toBe('/messaging/sms');
    expect(screen.getByRole('button', { name: 'Send new message' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Alex Morgan/ })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Send new message' }));
    expect(await screen.findByRole('region', { name: 'New SMS' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'To' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'To' })).toBeEnabled();
    await user.type(screen.getByRole('textbox', { name: 'To' }), '+12025550118{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Fresh compose draft after Back');
    expect(screen.getByRole('button', { name: 'Send to 1 person' })).toBeEnabled();

    await act(async () => { pending.resolve({ thread: sentThread, sent: 1 }); });
    expect(screen.getByRole('region', { name: 'New SMS' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Fresh compose draft after Back');
    expect(screen.getByRole('button', { name: 'Remove +12025550118' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to 1 person' })).toBeEnabled();
    expect(screen.getByTestId('sms-location').textContent).toBe('/messaging/sms?compose=new');
    expect(screen.queryByPlaceholderText('Write a message to New recipient')).not.toBeInTheDocument();
    expect(getSmsThread).not.toHaveBeenCalled(); expect(markSmsThreadRead).not.toHaveBeenCalled();
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it('keeps compose in place while sending so a conversation click cannot discard the pending draft', async () => {
    const pending = deferred<SmsSendResult>();
    vi.mocked(sendSms).mockReturnValueOnce(pending.promise);
    const user = userEvent.setup(); mount('/messaging/sms?compose=new');
    await screen.findByRole('region', { name: 'New SMS' });
    await addressAndWrite(user, 'Pending new message');
    await user.click(screen.getByRole('button', { name: 'Send to 1 person' }));
    await waitFor(() => expect(sendSms).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close new SMS' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Alex Morgan/ }));
    await user.click(screen.getByRole('button', { name: 'Send new message' }));
    expect(screen.getByRole('region', { name: 'New SMS' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Pending new message');
    expect(getSmsThread).not.toHaveBeenCalled();
    await act(async () => { pending.resolve({ thread: sentThread, sent: 1 }); });
    expect(await screen.findByPlaceholderText('Write a message to New recipient')).toBeInTheDocument();
    expect(sendSms).toHaveBeenCalledTimes(1);
  });
});
