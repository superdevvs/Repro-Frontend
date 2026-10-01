import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CallsInbox from './CallsInbox';

const mocks = vi.hoisted(() => ({
  getVoiceCalls: vi.fn(),
  getVoiceCall: vi.fn(),
  addVoiceCallNote: vi.fn(),
  sendSms: vi.fn(),
  toast: vi.fn(),
  can: vi.fn(),
}));

vi.mock('@/context/PermissionsContext', () => ({ usePermissions: () => ({ can: mocks.can, isLoading: false }) }));

vi.mock('@/services/voice', () => ({
  getVoiceCalls: mocks.getVoiceCalls,
  getVoiceCall: mocks.getVoiceCall,
  addVoiceCallNote: mocks.addVoiceCallNote,
  getVoiceNumbers: vi.fn().mockResolvedValue([]),
  getScheduleState: vi.fn().mockResolvedValue({ state: { state: 'team_open' } }),
  getVoiceHealth: vi.fn().mockResolvedValue({ can_place_calls: true, readiness_blockers: [] }),
  placeVoiceCall: vi.fn(),
  createScheduledVoiceCall: vi.fn(),
  updateScheduledVoiceCall: vi.fn(),
  getVoiceTranscript: vi.fn().mockResolvedValue({ transcript: '', state: 'ready', message: 'Saved' }),
  reconcileVoiceTranscript: vi.fn(),
}));

vi.mock('@/services/messaging', () => ({
  sendSms: mocks.sendSms,
  getSmsThreads: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/hooks/use-page-loading', () => ({
  usePageLoading: () => false,
}));

const sample = {
  id: 12,
  direction: 'INBOUND',
  status: 'completed',
  from_phone: '+12025550124',
  caller_contact: { name: 'Alex Morgan' },
  needs_follow_up: true,
  related_shoot: { id: 8, address: '124 Cedar Lane', status: 'scheduled' },
  summary: 'The gate code no longer works.',
  metadata: {},
};

const renderInbox = (path = '/calls/inbox/12') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/calls/inbox" element={<CallsInbox />} />
          <Route path="/calls/inbox/:id" element={<CallsInbox />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

describe('CallsInbox', () => {
  beforeEach(() => {
    mocks.can.mockReturnValue(true);
    mocks.getVoiceCalls.mockImplementation((params?: { filter?: string }) => {
      if (params?.filter === 'live') return Promise.resolve({ data: [], total: 0 });
      return Promise.resolve({ data: [sample], total: 1 });
    });
    mocks.getVoiceCall.mockResolvedValue(sample);
    mocks.sendSms.mockResolvedValue({ message: { id: 1 } });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the selected conversation and wrap-up path', async () => {
    renderInbox();
    expect(await screen.findAllByText('Alex Morgan')).not.toHaveLength(0);
    expect(await screen.findAllByText(/124 Cedar Lane/)).not.toHaveLength(0);
    expect(screen.getByRole('link', { name: /Wrap up this conversation/i })).toHaveAttribute('href', '/calls/inbox/12/wrap-up');
  });

  it('sends an SMS from the composer', async () => {
    const user = userEvent.setup();
    renderInbox();
    await user.click(await screen.findByRole('button', { name: 'Message' }));
    const send = await screen.findByRole('button', { name: 'Send' });
    await user.click(send);
    expect(mocks.sendSms).toHaveBeenCalledWith(expect.objectContaining({ to: '+12025550124' }));
  });

  it('keeps a viewer read-only while allowing conversation review', async () => {
    mocks.can.mockImplementation((_resource: string, action: string) => action === 'view');
    const user = userEvent.setup();
    renderInbox();
    expect(await screen.findByText('You have read-only Calls access.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schedule callback' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Call now Alex Morgan' })).toBeDisabled();
    expect(screen.getByPlaceholderText('Add a private note…')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save note' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Review wrap-up' })).toBeInTheDocument();
    expect(mocks.sendSms).not.toHaveBeenCalled();
    expect(mocks.addVoiceCallNote).not.toHaveBeenCalled();
  });

  it('allows an operator to add notes when SMS access is denied', async () => {
    mocks.can.mockImplementation((resource: string) => resource === 'voice-calls');
    mocks.addVoiceCallNote.mockResolvedValue(sample);
    const user = userEvent.setup();
    renderInbox();
    await screen.findByRole('button', { name: 'Save note' });
    await user.type(screen.getByPlaceholderText('Add a private note…'), 'Confirmed access');
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(mocks.addVoiceCallNote).toHaveBeenCalledWith(12, 'Confirmed access'));
    expect(mocks.sendSms).not.toHaveBeenCalled();
  });

  it('preserves a new note draft while the previous note finishes saving', async () => {
    let resolveSave: (value: typeof sample) => void = () => undefined;
    mocks.addVoiceCallNote.mockReturnValue(new Promise<typeof sample>((resolve) => { resolveSave = resolve; }));
    const user = userEvent.setup();
    renderInbox();
    const composer = await screen.findByPlaceholderText('Add a private note…');
    await user.type(composer, 'First note');
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(mocks.addVoiceCallNote).toHaveBeenCalledWith(12, 'First note'));
    await user.clear(composer);
    await user.type(composer, 'New note still being written');
    await act(async () => { resolveSave({ ...sample }); });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: 'Note saved' }));
    expect(composer).toHaveValue('New note still being written');
  });

  it('replies to the outbound recipient and labels the device call link accurately', async () => {
    mocks.getVoiceCall.mockResolvedValue({ ...sample, direction: 'OUTBOUND', from_phone: '+12025550000', to_phone: '+12025550199' });
    const user = userEvent.setup();
    renderInbox();
    await screen.findByText('Outbound');
    expect(screen.getByRole('button', { name: 'Call now Alex Morgan' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Message' }));
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(mocks.sendSms).toHaveBeenCalledWith(expect.objectContaining({ to: '+12025550199' }));
  });

  it('opens the requested transcript tab and does not call an answered call missed', async () => {
    mocks.getVoiceCall.mockResolvedValue({ ...sample, transcript: 'A real recorded conversation.', answered_at: '2026-09-20T14:00:00Z', ended_at: '2026-09-20T14:02:00Z' });
    renderInbox('/calls/inbox/12?tab=transcript');
    expect(await screen.findByText('Incoming')).toBeInTheDocument();
    expect(screen.getByText('A real recorded conversation.')).toBeInTheDocument();
    expect(screen.queryByText('Missed incoming')).not.toBeInTheDocument();
  });

  it('paginates older calls rather than stopping at the first forty', async () => {
    mocks.getVoiceCalls.mockResolvedValue({ data: [sample], total: 50, last_page: 2 });
    const user = userEvent.setup();
    renderInbox('/calls/inbox');
    await user.click(await screen.findByRole('button', { name: 'Next conversations' }));
    await waitFor(() => expect(mocks.getVoiceCalls).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));
  });
});
