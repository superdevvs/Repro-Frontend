import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { BrowserPhoneProvider } from './BrowserPhoneProvider';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';
import type { VoiceBrowserOffer } from '@/types/voiceBrowser';

const mocks = vi.hoisted(() => ({
  can: vi.fn(), gum: vi.fn(), stop: vi.fn(), constructor: vi.fn<(options: unknown) => void>(), connect: vi.fn(), disconnect: vi.fn(), login: vi.fn(), registered: vi.fn(),
  getVoiceBrowserConfig: vi.fn(), createVoiceBrowserSession: vi.fn(), getVoiceBrowserSession: vi.fn(), heartbeatVoiceBrowserSession: vi.fn(), deleteVoiceBrowserSession: vi.fn(), refreshVoiceBrowserToken: vi.fn(),
  getVoiceBrowserCallState: vi.fn(), startHumanVoiceCall: vi.fn(), takeOverVoiceCall: vi.fn(), superviseVoiceCall: vi.fn(), changeVoiceSupervision: vi.fn(), leaveVoiceSupervision: vi.fn(), performVoiceBrowserAction: vi.fn(), setVoiceBrowserConsent: vi.fn(),
  handlers: {} as Record<string, (event?: unknown) => void>,
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 9 }, isAuthenticated: true, isImpersonating: false }) }));
vi.mock('@/context/PermissionsContext', () => ({ usePermissions: () => ({ can: mocks.can }) }));
vi.mock('@/services/voiceBrowser', () => mocks);
vi.mock('@telnyx/webrtc', () => ({ TelnyxRTC: class {
  constructor(options: unknown) { mocks.constructor(options); }
  on(name: string, handler: (event?: unknown) => void) { mocks.handlers[name] = handler; }
  off(name: string) { delete mocks.handlers[name]; }
  async connect() { mocks.connect(); mocks.handlers['telnyx.ready']?.(); }
  getIsRegistered = mocks.registered;
  disconnect = mocks.disconnect;
  login = mocks.login;
  async getAudioInDevices() { return [{ deviceId: 'mic-1', label: 'USB headset' }]; }
  async getAudioOutDevices() { return [{ deviceId: 'speaker-1', label: 'USB speaker' }]; }
  async setAudioSettings() { return undefined; }
} }));

let offers: VoiceBrowserOffer[] = [];
const session = () => ({ id: 'session-1', device_id: 'device-1', status: 'ready', expires_at: new Date(Date.now() + 3600000).toISOString(), registered: true, offers });
const capabilities = { can_takeover: true, can_monitor: true, can_whisper: true, can_barge: true, can_control: true, can_end: true, can_transfer: true, can_record: true };
const state = () => ({ voice_call_id: 12, state: 'active', capabilities, recording: { consent_given: false, active: false } });
function Harness() {
  const phone = useBrowserPhone();
  const run = (fn: () => Promise<unknown>) => { void fn().catch(() => undefined); };
  return <><p data-testid="phone-status">{phone.status}</p><button onClick={() => run(phone.connect)}>Connect test phone</button><button onClick={() => run(() => phone.startHuman({ to: '+12025550123' }))}>Start human</button><button onClick={() => run(() => phone.takeOver(12))}>Take over test call</button><button onClick={() => run(() => phone.control('unmute'))}>Force unmute</button><Link to="/settings">Navigate away</Link><Routes><Route path="*" element={<p>Page content</p>} /></Routes></>;
}
function renderPhone() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const result = render(<MemoryRouter initialEntries={['/calls/live']}><QueryClientProvider client={client}><BrowserPhoneProvider><Harness /></BrowserPhoneProvider></QueryClientProvider></MemoryRouter>);
  return { ...result, client };
}
async function connectPhone() {
  const user = userEvent.setup();
  await waitFor(() => expect(mocks.getVoiceBrowserConfig).toHaveBeenCalled());
  await user.click(screen.getByText('Connect test phone'));
  await waitFor(() => expect(screen.getByTestId('phone-status')).toHaveTextContent('ready'));
  await waitFor(() => expect(mocks.heartbeatVoiceBrowserSession).toHaveBeenCalledWith('session-1', true));
  return user;
}
function makeCall(id = 'agent-leg') {
  const call = {
    state: 'ringing', telnyxIDs: { telnyxCallControlId: id }, isAudioMuted: false,
    answer: vi.fn(async () => { call.state = 'active'; mocks.handlers['telnyx.notification']?.({ type: 'callUpdate', call }); }),
    hangup: vi.fn(async () => { call.state = 'hangup'; mocks.handlers['telnyx.notification']?.({ type: 'callUpdate', call }); }),
    muteAudio: vi.fn(() => { call.isAudioMuted = true; }), unmuteAudio: vi.fn(() => { call.isAudioMuted = false; }),
    hold: vi.fn(), dtmf: vi.fn(), setAudioInDevice: vi.fn().mockResolvedValue(undefined), setAudioOutDevice: vi.fn().mockResolvedValue(true),
  };
  return call;
}
async function incoming(role: VoiceBrowserOffer['role'] = 'agent', mode?: VoiceBrowserOffer['mode']) {
  const call = makeCall();
  offers = [{ voice_call_id: 12, agent_call_control_id: 'agent-leg', role, mode, state: 'ringing', caller_name: 'Jamie Parker' }];
  act(() => { mocks.handlers['telnyx.notification']?.({ type: 'callUpdate', call }); });
  await screen.findByRole('button', { name: role === 'supervisor' ? 'Join supervision' : 'Answer' });
  return call;
}

describe('browser phone lifecycle and customer controls', () => {
  beforeEach(() => {
    vi.clearAllMocks(); offers = []; mocks.handlers = {}; sessionStorage.clear();
    mocks.can.mockReturnValue(true);
    mocks.registered.mockResolvedValue(true);
    mocks.refreshVoiceBrowserToken.mockImplementation(async () => ({ ...session(), token: 'refreshed-transient-jwt' }));
    mocks.login.mockResolvedValue(undefined);
    mocks.gum.mockResolvedValue({ getTracks: () => [{ stop: mocks.stop }] });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: mocks.gum, addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    mocks.getVoiceBrowserConfig.mockResolvedValue({ enabled: true, ready: true, blockers: [], capabilities: { human_outbound: true, receive_calls: true, takeover: true, monitor: true, whisper: true, barge: true } });
    mocks.createVoiceBrowserSession.mockImplementation(async () => ({ ...session(), token: 'transient-secret-jwt', registration_delay_ms: 0 }));
    mocks.getVoiceBrowserSession.mockImplementation(async () => session());
    mocks.heartbeatVoiceBrowserSession.mockImplementation(async () => session());
    mocks.deleteVoiceBrowserSession.mockResolvedValue(undefined); mocks.disconnect.mockResolvedValue(undefined);
    mocks.getVoiceBrowserCallState.mockImplementation(async () => state());
    mocks.performVoiceBrowserAction.mockImplementation(async () => state());
    mocks.startHumanVoiceCall.mockResolvedValue({ id: 12, status: 'queued' });
    mocks.leaveVoiceSupervision.mockResolvedValue(undefined); mocks.changeVoiceSupervision.mockResolvedValue(state()); mocks.setVoiceBrowserConsent.mockResolvedValue(state());
    mocks.takeOverVoiceCall.mockResolvedValue(state());
  });
  afterEach(() => { cleanup(); });

  it('waits for a gesture, keeps JWTs transient, and retains the phone across navigation', async () => {
    const { client } = renderPhone();
    await waitFor(() => expect(mocks.getVoiceBrowserConfig).toHaveBeenCalled());
    expect(mocks.gum).not.toHaveBeenCalled(); expect(mocks.constructor).not.toHaveBeenCalled();
    const user = await connectPhone();
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(mocks.constructor).toHaveBeenCalledWith(expect.objectContaining({ login_token: 'transient-secret-jwt', enableCallReports: false }));
    expect(JSON.stringify(sessionStorage)).not.toContain('transient-secret-jwt');
    expect(JSON.stringify(client.getQueryCache().getAll().map((query) => query.state.data))).not.toContain('transient-secret-jwt');
    await user.click(screen.getByText('Navigate away'));
    expect(screen.getByTestId('phone-status')).toHaveTextContent('ready'); expect(mocks.disconnect).not.toHaveBeenCalled();
  });

  it('does not create credentials after microphone permission is denied', async () => {
    mocks.gum.mockRejectedValue(new Error('Microphone permission denied'));
    renderPhone(); await waitFor(() => expect(mocks.getVoiceBrowserConfig).toHaveBeenCalled());
    await userEvent.click(screen.getByText('Connect test phone'));
    expect(await screen.findByText('Microphone permission denied')).toBeInTheDocument();
    expect(screen.getByText('Your browser phone')).toBeInTheDocument();
    expect(mocks.createVoiceBrowserSession).not.toHaveBeenCalled(); expect(mocks.constructor).not.toHaveBeenCalled();
  });

  it('keeps an idle phone to one status row with expandable audio and a direct disconnect', async () => {
    renderPhone(); const user = await connectPhone();
    expect(await screen.findByText('Phone ready')).toBeInTheDocument();
    expect(screen.queryByText('Your browser phone')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Phone connected' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Call microphone')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Audio' }));
    expect(screen.getByLabelText('Call microphone')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Audio' }));
    expect(screen.queryByLabelText('Call microphone')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Disconnect phone' }));
    await waitFor(() => expect(mocks.deleteVoiceBrowserSession).toHaveBeenCalledWith('session-1'));
    expect(screen.queryByRole('complementary', { name: 'Browser phone' })).not.toBeInTheDocument();
  });

  it('rejects unknown carrier legs instead of accepting arbitrary browser calls', async () => {
    renderPhone(); await connectPhone(); const call = makeCall('unknown-leg');
    act(() => { mocks.handlers['telnyx.notification']?.({ type: 'callUpdate', call }); });
    await waitFor(() => expect(call.hangup).toHaveBeenCalled(), { timeout: 10000 });
    expect(call.answer).not.toHaveBeenCalled();
  }, 12000);

  it('answers an authenticated offer and targets hold and keypad only through the customer API', async () => {
    renderPhone(); const user = await connectPhone(); const call = await incoming();
    expect(call.answer).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    await user.click(await screen.findByRole('button', { name: 'Hold caller' }));
    await waitFor(() => expect(mocks.performVoiceBrowserAction).toHaveBeenCalledWith(12, 'hold', {}));
    await user.click(screen.getByRole('button', { name: 'Keypad' }));
    await user.click(screen.getByRole('button', { name: '5' }));
    await waitFor(() => expect(mocks.performVoiceBrowserAction).toHaveBeenCalledWith(12, 'dtmf', { digits: '5' }));
    expect(call.hold).not.toHaveBeenCalled(); expect(call.dtmf).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'End call' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'End call' })).not.toBeInTheDocument());
  });

  it('accepts a receiving SIP leg only through its server-authorized peer alias', async () => {
    renderPhone(); const user = await connectPhone();
    offers = [{ voice_call_id: 12, agent_call_control_id: 'originating-leg', browser_call_control_id: 'browser-peer-leg', role: 'agent', state: 'ringing' }];
    const call = makeCall('browser-peer-leg');
    act(() => { mocks.handlers['telnyx.notification']?.({ type: 'callUpdate', call }); });
    await user.click(await screen.findByRole('button', { name: 'Answer' }));
    await waitFor(() => expect(call.answer).toHaveBeenCalled());
    await user.click(await screen.findByRole('button', { name: 'Mute' }));
    await waitFor(() => expect(mocks.performVoiceBrowserAction).toHaveBeenCalledWith(12, 'mute', {}));
    expect(call.hangup).not.toHaveBeenCalled();
  });

  it('validates transfer numbers and starts a conference transfer with idempotency', async () => {
    renderPhone(); const user = await connectPhone(); await incoming();
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    await user.click(await screen.findByRole('button', { name: 'Transfer' }));
    await user.type(screen.getByLabelText('Transfer to'), '123');
    expect(screen.getByRole('button', { name: 'Start transfer' })).toBeDisabled();
    await user.clear(screen.getByLabelText('Transfer to'));
    await user.type(screen.getByLabelText('Transfer to'), '+1 (202) 555-0177');
    await user.click(screen.getByRole('button', { name: 'Start transfer' }));
    await waitFor(() => expect(mocks.performVoiceBrowserAction).toHaveBeenCalledWith(12, 'transfer', { to: '+12025550177', idempotency_key: expect.any(String) }));
  });

  it('keeps a supervisor muted until the server acknowledges a switch to coaching', async () => {
    renderPhone(); const user = await connectPhone(); const call = await incoming('supervisor', 'monitor');
    await user.click(screen.getByRole('button', { name: 'Join supervision' }));
    mocks.changeVoiceSupervision.mockRejectedValueOnce(new Error('Coaching is unavailable'));
    await user.click(await screen.findByRole('button', { name: 'Coach staff only' }));
    await screen.findByText('Coaching is unavailable');
    expect(call.unmuteAudio).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Coach staff only' }));
    await waitFor(() => expect(call.unmuteAudio).toHaveBeenCalledOnce());
    expect(mocks.changeVoiceSupervision).toHaveBeenLastCalledWith(12, 'whisper');
  });

  it('keeps listeners muted and leaving supervision ends only the supervisor leg', async () => {
    renderPhone(); const user = await connectPhone(); const call = await incoming('supervisor', 'monitor');
    await user.click(screen.getByRole('button', { name: 'Join supervision' }));
    expect(await screen.findByRole('button', { name: 'Listening · mic off' })).toBeDisabled();
    await user.click(screen.getByText('Force unmute'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Listen mode keeps your microphone muted.'));
    expect(call.unmuteAudio).not.toHaveBeenCalled(); expect(mocks.performVoiceBrowserAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Leave supervision' }));
    await waitFor(() => expect(mocks.leaveVoiceSupervision).toHaveBeenCalledWith(12));
    expect(mocks.performVoiceBrowserAction).not.toHaveBeenCalled();
  });

  it('retries the same human dial with the same idempotency key after an uncertain response', async () => {
    mocks.startHumanVoiceCall.mockRejectedValueOnce(new Error('Network interrupted')).mockResolvedValueOnce({ id: 12 });
    renderPhone(); const user = await connectPhone();
    await user.click(screen.getByText('Start human'));
    await screen.findByText('Network interrupted');
    await user.click(screen.getByText('Start human'));
    await waitFor(() => expect(mocks.startHumanVoiceCall).toHaveBeenCalledTimes(2));
    expect(mocks.startHumanVoiceCall.mock.calls[0][0].idempotency_key).toBe(mocks.startHumanVoiceCall.mock.calls[1][0].idempotency_key);
    expect(mocks.startHumanVoiceCall.mock.calls[0][0]).toMatchObject({ session_id: 'session-1', to: '+12025550123' });
  });

  it('requires explicit verbal-consent confirmation before recording consent is saved', async () => {
    renderPhone(); const user = await connectPhone(); await incoming();
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    await user.click(await screen.findByRole('button', { name: 'Record caller consent' }));
    expect(mocks.setVoiceBrowserConsent).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Caller gave consent' }));
    await waitFor(() => expect(mocks.setVoiceBrowserConsent).toHaveBeenCalledWith(12, true));
    expect(mocks.performVoiceBrowserAction).not.toHaveBeenCalled();
  });

  it('can end through the server after the signaling connection drops', async () => {
    renderPhone(); const user = await connectPhone(); const call = await incoming();
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    await screen.findByRole('button', { name: 'End call' });
    act(() => { mocks.handlers['telnyx.socket.close']?.(); });
    await waitFor(() => expect(screen.getByTestId('phone-status')).toHaveTextContent('reconnecting'));
    call.hangup.mockRejectedValueOnce(new Error('Socket unavailable'));
    await user.click(screen.getByRole('button', { name: 'End call' }));
    await waitFor(() => expect(mocks.performVoiceBrowserAction).toHaveBeenCalledWith(12, 'end', {}));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'End call' })).not.toBeInTheDocument());
  });

  it('recreates an idle failed connection before registering again', async () => {
    renderPhone(); const user = await connectPhone();
    act(() => { mocks.handlers['telnyx.error']?.(); });
    await waitFor(() => expect(screen.getByTestId('phone-status')).toHaveTextContent('reconnecting'));
    await user.click(screen.getByText('Connect test phone'));
    await waitFor(() => expect(mocks.createVoiceBrowserSession).toHaveBeenCalledTimes(2));
    expect(mocks.deleteVoiceBrowserSession).toHaveBeenCalledWith('session-1');
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByTestId('phone-status')).toHaveTextContent('ready'));
  });

  it('recovers registration on visibility without a new SDK ready event or credentials', async () => {
    renderPhone(); await connectPhone();
    mocks.registered.mockResolvedValueOnce(false).mockResolvedValue(true);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(screen.getByTestId('phone-status')).toHaveTextContent('reconnecting'));
    expect(mocks.heartbeatVoiceBrowserSession).toHaveBeenLastCalledWith('session-1', false);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(screen.getByTestId('phone-status')).toHaveTextContent('ready'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mocks.heartbeatVoiceBrowserSession).toHaveBeenLastCalledWith('session-1', true);
    expect(mocks.createVoiceBrowserSession).toHaveBeenCalledOnce();
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('keeps polling through a hung registration check and config cache updates without reauthenticating', async () => {
    vi.useFakeTimers();
    try {
      const { client } = renderPhone();
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      await act(async () => {
        screen.getByText('Connect test phone').click();
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByTestId('phone-status')).toHaveTextContent('ready');
      expect(mocks.registered).toHaveBeenCalledOnce();
      mocks.registered.mockReturnValueOnce(new Promise(() => undefined));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
        client.setQueryData(['voice-browser-config', 9], { ...client.getQueryData<object>(['voice-browser-config', 9]), blockers: [] });
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(mocks.registered).toHaveBeenCalledTimes(2);
      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
      expect(screen.getByTestId('phone-status')).toHaveTextContent('reconnecting');
      expect(mocks.heartbeatVoiceBrowserSession).toHaveBeenLastCalledWith('session-1', false);
      await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
      expect(screen.getByTestId('phone-status')).toHaveTextContent('ready');
      expect(mocks.heartbeatVoiceBrowserSession).toHaveBeenLastCalledWith('session-1', true);
      expect(mocks.registered).toHaveBeenCalledTimes(3);
      expect(mocks.createVoiceBrowserSession).toHaveBeenCalledOnce();
      expect(mocks.constructor).toHaveBeenCalledOnce();
      expect(mocks.login).not.toHaveBeenCalled();
    } finally { cleanup(); vi.useRealTimers(); }
  });

  it('refreshes short-lived credentials without persisting the new token or replacing the phone', async () => {
    const expiring = { ...session(), expires_at: new Date(Date.now() + 121100).toISOString() };
    mocks.createVoiceBrowserSession.mockResolvedValue({ ...expiring, token: 'transient-secret-jwt', registration_delay_ms: 0 });
    mocks.getVoiceBrowserSession.mockResolvedValue(expiring);
    mocks.heartbeatVoiceBrowserSession.mockResolvedValue(expiring);
    renderPhone(); await connectPhone();
    await waitFor(() => expect(mocks.refreshVoiceBrowserToken).toHaveBeenCalledWith('session-1', 'device-1'), { timeout: 2500 });
    expect(mocks.login).toHaveBeenCalledWith({ creds: { login_token: 'refreshed-transient-jwt' } });
    expect(mocks.createVoiceBrowserSession).toHaveBeenCalledOnce();
    expect(JSON.stringify(sessionStorage)).not.toContain('refreshed-transient-jwt');
  });

  it('keeps retry stop available after consent is revoked while capture stop is unconfirmed', async () => {
    mocks.getVoiceBrowserCallState.mockImplementation(async () => ({ ...state(), capabilities: { ...capabilities, can_record: false }, recording: { consent_given: false, active: true, stop_pending: true } }));
    renderPhone(); const user = await connectPhone(); await incoming();
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    await user.click(await screen.findByRole('button', { name: 'Retry stop recording' }));
    await waitFor(() => expect(mocks.performVoiceBrowserAction).toHaveBeenCalledWith(12, 'recording_stop', {}));
    expect(screen.queryByRole('button', { name: 'Start recording' })).not.toBeInTheDocument();
  });

  it('starts takeover only after a fresh server capability check', async () => {
    renderPhone(); const user = await connectPhone();
    mocks.getVoiceBrowserCallState.mockResolvedValueOnce({ ...state(), capabilities: { ...capabilities, can_takeover: false } });
    await user.click(screen.getByText('Take over test call'));
    await screen.findByText('Takeover is not available for this call.');
    expect(mocks.takeOverVoiceCall).not.toHaveBeenCalled();
    await user.click(screen.getByText('Take over test call'));
    await waitFor(() => expect(mocks.takeOverVoiceCall).toHaveBeenCalledWith(12, 'session-1', expect.any(String)));
  });

  it('allows a coach to mute locally while keeping customer controls unavailable', async () => {
    mocks.getVoiceBrowserCallState.mockImplementation(async () => ({ ...state(), capabilities: { ...capabilities, can_control: false, can_end: false } }));
    renderPhone(); const user = await connectPhone(); const call = await incoming('supervisor', 'whisper');
    await user.click(screen.getByRole('button', { name: 'Join supervision' }));
    await user.click(await screen.findByRole('button', { name: 'Mute' }));
    await waitFor(() => expect(call.muteAudio).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'Unmute' }));
    await waitFor(() => expect(call.unmuteAudio).toHaveBeenCalled());
    expect(mocks.performVoiceBrowserAction).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Hold caller' })).not.toBeInTheDocument();
  });

  it('reports recording and transcription separately after a partial start', async () => {
    mocks.getVoiceBrowserCallState.mockImplementation(async () => ({ ...state(), recording: { consent_given: true, active: true, transcription_active: false, transcription_pending: true } }));
    renderPhone(); const user = await connectPhone(); await incoming();
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(await screen.findByText(/Recording active · Transcription not confirmed/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry transcription' }));
    await waitFor(() => expect(mocks.performVoiceBrowserAction).toHaveBeenCalledWith(12, 'recording_start', {}));
  });
});
