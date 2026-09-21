import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NewCallDialog from './NewCallDialog';
import type { BrowserPhoneContextValue } from '@/context/BrowserPhoneContext';

const mocks = vi.hoisted(() => ({
  getVoiceNumbers: vi.fn(),
  getScheduleState: vi.fn(),
  getVoiceHealth: vi.fn(),
  getSmsThreads: vi.fn(),
  placeVoiceCall: vi.fn(),
  toast: vi.fn(),
  can: vi.fn(),
  phone: {} as BrowserPhoneContextValue,
  startHuman: vi.fn(),
}));
vi.mock('@/context/BrowserPhoneContext', () => ({ useBrowserPhone: () => mocks.phone }));

vi.mock('@/context/PermissionsContext', () => ({ usePermissions: () => ({ can: mocks.can, isLoading: false }) }));

vi.mock('@/services/voice', () => ({
  getVoiceNumbers: mocks.getVoiceNumbers,
  getScheduleState: mocks.getScheduleState,
  getVoiceHealth: mocks.getVoiceHealth,
  placeVoiceCall: mocks.placeVoiceCall,
}));

vi.mock('@/services/messaging', () => ({
  getSmsThreads: mocks.getSmsThreads,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

const renderDialog = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const rendered = render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <NewCallDialog initialTo="+12025550123" initialFrom="+18888041663" trigger={<button type="button">Open new call</button>} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...rendered, client };
};

describe('NewCallDialog', () => {
  beforeEach(() => {
    mocks.can.mockReturnValue(true);
    mocks.phone = { eligible: true, status: 'disconnected', configLoading: false, busy: false, active: null, session: null, config: { ready: true, enabled: true, blockers: [], capabilities: { human_outbound: true, receive_calls: true, takeover: true, monitor: true, whisper: true, barge: true } }, startHuman: mocks.startHuman } as unknown as BrowserPhoneContextValue;
    mocks.startHuman.mockResolvedValue({ id: 103, status: 'queued' });
    mocks.getVoiceNumbers.mockResolvedValue([{ id: 1, phone_number: '+18888041663', label: 'Main line', is_default: true }]);
    mocks.getScheduleState.mockResolvedValue({ state: { state: 'team_open' } });
    mocks.getVoiceHealth.mockResolvedValue({ can_place_calls: true, readiness_blockers: [] });
    mocks.getSmsThreads.mockResolvedValue({ data: [] });
    mocks.placeVoiceCall.mockResolvedValue({ id: 99, status: 'queued' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('blocks the start button when outbound is not ready', async () => {
    mocks.getVoiceHealth.mockResolvedValue({ can_place_calls: false, readiness_blockers: ['No voice numbers are ready.'] });
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Open new call' }));
    expect(await screen.findByText(/No voice numbers are ready/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start call/i })).toBeDisabled();
  });

  it('places a real outbound call', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Open new call' }));
    const start = await screen.findByRole('button', { name: /Start call/i });
    await waitFor(() => expect(start).toBeEnabled());
    await user.click(start);
    await waitFor(() => {
      expect(mocks.placeVoiceCall).toHaveBeenCalledWith(expect.objectContaining({
        to: '+12025550123',
        from: '+18888041663',
        source: 'new_call_dialog',
      }));
    });
  });

  it('prevents viewers from opening a call dialog', async () => {
    mocks.can.mockReturnValue(false);
    const user = userEvent.setup();
    renderDialog();
    expect(screen.getByRole('button', { name: 'Open new call' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Open new call' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.placeVoiceCall).not.toHaveBeenCalled();
  });

  it('marks a non-E164 legacy source unavailable while keeping the valid default usable', async () => {
    mocks.getVoiceNumbers.mockResolvedValue([
      { id: 1, phone_number: '+18888041663', label: 'Main line', is_default: true },
      { id: 2, phone_number: '2028681663', label: 'Legacy line', is_default: false },
    ]);
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Open new call' }));
    expect(await screen.findByRole('option', { name: 'Legacy line · 2028681663 · Unavailable for calling' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Main line · +18888041663' })).toBeEnabled();
    expect(screen.getByLabelText('From')).toHaveValue('+18888041663');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start call' })).toBeEnabled());
  });

  it('requires a registered browser phone for Me mode', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Open new call' }));
    await userEvent.click(screen.getByRole('button', { name: 'Me · browser phone' }));
    expect(screen.getByRole('button', { name: 'Start call' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Connect phone' })).toBeEnabled();
    expect(mocks.startHuman).not.toHaveBeenCalled();
  });

  it('starts a staff call through the server when Me is selected even if AI calling is paused', async () => {
    mocks.phone.status = 'ready';
    mocks.phone.session = { id: 'session-1', device_id: 'device-1', status: 'ready', registered: true, expires_at: '', offers: [] };
    mocks.getVoiceHealth.mockResolvedValue({ can_place_calls: false, readiness_blockers: ['AI calling paused'] });
    const user = userEvent.setup(); renderDialog();
    await user.click(screen.getByRole('button', { name: 'Open new call' }));
    await user.click(screen.getByRole('button', { name: 'Me · browser phone' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start call' })).toBeEnabled());
    await user.type(screen.getByLabelText('Why you’re calling'), 'Confirm property access');
    await user.click(screen.getByRole('button', { name: 'Start call' }));
    await waitFor(() => expect(mocks.startHuman).toHaveBeenCalledWith({ to: '+12025550123', from: '+18888041663', reason: 'Confirm property access' }));
    expect(mocks.placeVoiceCall).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Answer your browser phone' }));
  });

  it('rejects non-E164 destinations and sends normalized formatted numbers', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Open new call' }));
    const number = await screen.findByLabelText('Number');
    await user.clear(number);
    await user.type(number, '1234');
    expect(screen.getByRole('button', { name: 'Start call' })).toBeDisabled();
    await user.clear(number);
    await user.type(number, '+1 (202) 555-0199');
    await user.click(screen.getByRole('button', { name: 'Start call' }));
    await waitFor(() => expect(mocks.placeVoiceCall).toHaveBeenCalledWith(expect.objectContaining({ to: '+12025550199' })));
  });

  it('blocks calls when business lines fail to load', async () => {
    mocks.getVoiceNumbers.mockRejectedValue(new Error('Unavailable'));
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Open new call' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not check calling readiness');
    expect(screen.getByRole('button', { name: 'Start call' })).toBeDisabled();
  });

  it('preserves typed call details when the default business line changes', async () => {
    const user = userEvent.setup();
    const { client } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Open new call' }));
    const number = await screen.findByLabelText('Number');
    await user.clear(number);
    await user.type(number, '+12025550199');
    await user.type(screen.getByLabelText('Why you’re calling'), 'Confirm access');
    act(() => {
      client.setQueryData(['voice-numbers'], [
        { id: 1, phone_number: '+18888041663', label: 'Main line', is_default: false },
        { id: 2, phone_number: '+18888041664', label: 'Second line', is_default: true },
      ]);
    });
    expect(number).toHaveValue('+12025550199');
    expect(screen.getByLabelText('Why you’re calling')).toHaveValue('Confirm access');
    expect(screen.getByLabelText('From')).toHaveValue('+18888041663');
  });

  it('requires an available line even when initialFrom is supplied', async () => {
    mocks.getVoiceNumbers.mockResolvedValue([{ id: 2, phone_number: '+18888041664', label: 'Second line', is_default: true }]);
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Open new call' }));
    expect(await screen.findByText('Select an available business line.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start call' })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('From'), '+18888041664');
    expect(screen.getByRole('button', { name: 'Start call' })).toBeEnabled();
  });
});
