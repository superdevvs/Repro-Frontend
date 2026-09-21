import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CallsWrapUp from './CallsWrapUp';

const mocks = vi.hoisted(() => ({
  getVoiceCall: vi.fn(),
  getVoiceCallRecordingUrl: vi.fn(),
  wrapUpVoiceCall: vi.fn(),
  toast: vi.fn(),
  can: vi.fn(),
}));

vi.mock('@/context/PermissionsContext', () => ({ usePermissions: () => ({ can: mocks.can, isLoading: false }) }));

vi.mock('@/services/voice', () => ({
  getVoiceCall: mocks.getVoiceCall,
  getVoiceCallRecordingUrl: mocks.getVoiceCallRecordingUrl,
  wrapUpVoiceCall: mocks.wrapUpVoiceCall,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/hooks/use-page-loading', () => ({
  usePageLoading: () => false,
}));

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { name: 'Jamie Stone' } }),
}));

const renderWrapUp = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/calls/inbox/12/wrap-up']}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/calls/inbox/:id/wrap-up" element={<CallsWrapUp />} />
          <Route path="/calls/inbox/:id" element={<div>Inbox</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

describe('CallsWrapUp', () => {
  beforeEach(() => {
    mocks.can.mockReturnValue(true);
    mocks.getVoiceCall.mockResolvedValue({
      id: 12,
      direction: 'INBOUND',
      status: 'completed',
      from_phone: '+12025550124',
      caller_contact: { name: 'Alex Morgan' },
      duration_seconds: 252,
      ended_at: '2026-09-20T14:58:00.000Z',
      summary: 'Alex’s gate code no longer works.',
      needs_follow_up: true,
      related_shoot: { id: 8, address: '124 Cedar Lane' },
      metadata: {},
    });
    mocks.getVoiceCallRecordingUrl.mockResolvedValue(null);
    mocks.wrapUpVoiceCall.mockResolvedValue({ id: 12 });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('saves wrap-up without sending SMS', async () => {
    const user = userEvent.setup();
    renderWrapUp();
    expect(await screen.findByText(/A good conversation/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Save without sending/i }));
    await waitFor(() => {
      expect(mocks.wrapUpVoiceCall).toHaveBeenCalledWith(12, expect.objectContaining({
        send_sms: false,
        create_task: false,
      }));
    });
  });

  it('does not let a viewer edit or submit a wrap-up', async () => {
    mocks.can.mockImplementation((_resource: string, action: string) => action === 'view');
    renderWrapUp();
    expect(await screen.findByText('You have read-only Calls access.')).toBeInTheDocument();
    for (const name of ['Edit recap', 'Edit message', 'Save without sending', 'Save & send follow-up']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Create a follow-up task' })).toBeDisabled();
    expect(mocks.wrapUpVoiceCall).not.toHaveBeenCalled();
  });

  it('allows saving a wrap-up while SMS permission is denied', async () => {
    mocks.can.mockImplementation((resource: string) => resource === 'voice-calls');
    const user = userEvent.setup();
    renderWrapUp();
    expect(await screen.findByRole('button', { name: 'Save & send follow-up' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save without sending' }));
    await waitFor(() => expect(mocks.wrapUpVoiceCall).toHaveBeenCalledWith(12, expect.objectContaining({ send_sms: false })));
  });

  it('sends the follow-up when requested', async () => {
    const user = userEvent.setup();
    renderWrapUp();
    await screen.findByText(/A good conversation/i);
    await user.click(screen.getByRole('button', { name: /Save & send follow-up/i }));
    await waitFor(() => {
      expect(mocks.wrapUpVoiceCall).toHaveBeenCalledWith(12, expect.objectContaining({ send_sms: true }));
    });
  });

  it('creates a task only after explicit selection', async () => {
    const user = userEvent.setup();
    renderWrapUp();
    await user.click(await screen.findByRole('checkbox', { name: 'Create a follow-up task' }));
    await user.click(screen.getByRole('button', { name: 'Save without sending' }));
    await waitFor(() => expect(mocks.wrapUpVoiceCall).toHaveBeenCalledWith(12, expect.objectContaining({ create_task: true, task_title: 'Follow up on 124 Cedar Lane', idempotency_key: expect.any(String) })));
  });

  it('reuses the same operation key after an uncertain network response', async () => {
    mocks.wrapUpVoiceCall.mockRejectedValue(new Error('Network disconnected'));
    const user = userEvent.setup();
    renderWrapUp();
    const save = await screen.findByRole('button', { name: /Save & send follow-up/i });
    await user.click(save);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Could not confirm wrap-up' })));
    await user.click(save);
    await waitFor(() => expect(mocks.wrapUpVoiceCall).toHaveBeenCalledTimes(2));
    const first = mocks.wrapUpVoiceCall.mock.calls[0][1];
    expect(mocks.wrapUpVoiceCall.mock.calls[1][1]).toEqual(first);
  });

  it('keeps partial saves visible and does not announce an uncertain message as sent', async () => {
    mocks.wrapUpVoiceCall.mockResolvedValue({ id: 12, metadata: { wrap_up: { sms_sent: true, sms: { status: 'sent', sent_at: '2026-09-20T12:00:00Z' } } }, wrap_up_result: { operation_id: 4, sms_status: 'uncertain', sms_sent: false } });
    const user = userEvent.setup();
    renderWrapUp();
    await user.click(await screen.findByRole('button', { name: /Save & send follow-up/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Message delivery is uncertain');
    expect(screen.queryByText('Inbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save & send follow-up/i })).toBeDisabled();
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Follow-up sent' }));
  });

  it('preserves an existing task due date and can complete it without a duplicate', async () => {
    const existing = await mocks.getVoiceCall();
    mocks.getVoiceCall.mockResolvedValue({ ...existing, metadata: { wrap_up: { task: { id: 7, title: 'Confirm access', due_at: '2026-09-22T14:00:00Z', status: 'open' } } } });
    const user = userEvent.setup();
    renderWrapUp();
    await user.click(await screen.findByRole('checkbox', { name: 'Task completed' }));
    await user.click(screen.getByRole('button', { name: 'Save without sending' }));
    await waitFor(() => expect(mocks.wrapUpVoiceCall).toHaveBeenCalledWith(12, expect.objectContaining({ task_status: 'completed', task_due_at: '2026-09-22T14:00:00.000Z', task_title: 'Confirm access' })));
  });

  it('refreshes an expired audio URL using the retained carrier recording ID', async () => {
    const existing = await mocks.getVoiceCall();
    mocks.getVoiceCall.mockResolvedValue({ ...existing, recording_consent_given: true, metadata: { recording_id: 'recording-12' } });
    mocks.getVoiceCallRecordingUrl.mockResolvedValueOnce('https://recordings.example/expired.mp3').mockResolvedValue('https://recordings.example/refreshed.mp3');
    const user = userEvent.setup();
    const { container } = renderWrapUp();
    await waitFor(() => expect(container.querySelector('audio')).toHaveAttribute('src', 'https://recordings.example/expired.mp3'));
    fireEvent.error(container.querySelector('audio')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Refresh its link');
    await user.click(screen.getByRole('button', { name: 'Retry recording' }));
    await waitFor(() => expect(container.querySelector('audio')).toHaveAttribute('src', 'https://recordings.example/refreshed.mp3'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
