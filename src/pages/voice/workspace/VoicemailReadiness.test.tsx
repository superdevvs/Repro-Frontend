import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VoiceCall, VoiceNumberConfig } from '@/types/voice';
import VoiceLinePolicyEditor from './VoiceLinePolicyEditor';
import VoicemailPanel from './VoicemailPanel';
import PrivateVoiceAudio from './PrivateVoiceAudio';

const mocks = vi.hoisted(() => ({ updateVoiceNumber: vi.fn(), uploadVoiceGreeting: vi.fn(), updateVoicemail: vi.fn(), getPrivateVoiceAudio: vi.fn(), toast: vi.fn() }));
vi.mock('@/services/voice', () => mocks);
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
const wrap = (component: React.ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })}>{component}</QueryClientProvider>);
const number: VoiceNumberConfig = { id: 4, phone_number: '+12027803332', line_policy: { mode: 'staff_voicemail', recipient_role: 'editing_manager', recipient_ids: [], timezone: 'Asia/Kolkata', weekly_hours: { mon: [{ start: '09:00', end: '18:00' }], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] }, greetings: { office_greeting: true, closed_greeting: true }, readiness: { recipients: true, device_registration: false } } };
const call = { id: 12, direction: 'INBOUND', status: 'completed', voicemail: { id: 2, phone_number: '+12027803332', state: 'saved', duration_seconds: 15, failure: null, read_at: null, resolved_at: null, saved_at: '2026-10-14T10:00:00Z', expires_at: '2099-01-01T00:00:00Z' } } as VoiceCall;

describe('Voicemail readiness and authenticated playback', () => {
  beforeEach(() => {
    mocks.updateVoiceNumber.mockResolvedValue(number);
    mocks.updateVoicemail.mockResolvedValue(call);
    mocks.getPrivateVoiceAudio.mockResolvedValue(new Blob(['audio'], { type: 'audio/mpeg' }));
    URL.createObjectURL = vi.fn(() => 'blob:private-audio');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('saves the line timezone, role and weekly closure without enabling AI', async () => {
    wrap(<VoiceLinePolicyEditor number={number} staff={[]} canManage />);
    expect(screen.getByText('Needs attention: Registered device')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Configure routing' }));
    await userEvent.selectOptions(screen.getByLabelText(/Timezone/), 'Europe/London');
    await userEvent.click(screen.getByLabelText('MON'));
    await userEvent.click(screen.getByRole('button', { name: 'Save routing' }));
    await waitFor(() => expect(mocks.updateVoiceNumber).toHaveBeenCalledWith(4, { line_policy: expect.objectContaining({ timezone: 'Europe/London', recipient_role: 'editing_manager', weekly_hours: expect.objectContaining({ mon: [] }) }) }));
  });

  it('creates only a manual callback task and resolves without scheduling a call', async () => {
    wrap(<VoicemailPanel call={call} canOperate />);
    await userEvent.click(screen.getByRole('button', { name: 'Create callback task' }));
    await waitFor(() => expect(mocks.updateVoicemail).toHaveBeenCalledWith(12, { callback_task: true }));
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    await waitFor(() => expect(mocks.updateVoicemail).toHaveBeenCalledWith(12, { resolved: true }));
    expect(mocks.getPrivateVoiceAudio).not.toHaveBeenCalled();
  });

  it('fetches audio through the authenticated API only on demand and revokes the local URL', async () => {
    const view = wrap(<PrivateVoiceAudio path="/voice/calls/12/voicemail/audio" />);
    expect(mocks.getPrivateVoiceAudio).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Play recording' }));
    await waitFor(() => expect(mocks.getPrivateVoiceAudio).toHaveBeenCalledWith('/voice/calls/12/voicemail/audio'));
    const audio = await screen.findByLabelText('Play recording');
    expect(audio).toHaveAttribute('src', 'blob:private-audio');
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-audio');
  });

  it('disables voicemail mutations for viewers and keeps failed recordings visible', () => {
    wrap(<VoicemailPanel call={{ ...call, voicemail: { ...call.voicemail!, state: 'failed', failure: 'Recording failed. A callback is required.' } }} canOperate={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Recording failed');
    expect(screen.getByRole('button', { name: 'Create callback task' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Play recording' })).not.toBeInTheDocument();
  });

  it('ignores audio responses that arrive after the selected voicemail changes', async () => {
    let resolve!: (blob: Blob) => void;
    mocks.getPrivateVoiceAudio.mockReturnValueOnce(new Promise<Blob>(done => { resolve = done; }));
    const client = new QueryClient();
    const view = render(<QueryClientProvider client={client}><PrivateVoiceAudio path="/voice/calls/12/voicemail/audio" /></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Play recording' }));
    view.rerender(<QueryClientProvider client={client}><PrivateVoiceAudio path="/voice/calls/13/voicemail/audio" /></QueryClientProvider>);
    resolve(new Blob(['stale-audio']));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play recording' })).toBeEnabled());
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
