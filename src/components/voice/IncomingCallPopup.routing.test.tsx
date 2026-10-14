import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import IncomingCallPopup from './IncomingCallPopup';
import type { VoiceIncomingOffer } from '@/types/voice';

const mocks = vi.hoisted(() => ({ get: vi.fn(), toast: vi.fn(), phone: { eligible: true, active: null as unknown, answerIncoming: vi.fn() } }));
vi.mock('@/services/voice', () => ({ getIncomingVoiceOffers: mocks.get }));
vi.mock('@/context/BrowserPhoneContext', () => ({ useBrowserPhone: () => mocks.phone }));
vi.mock('@/context/PermissionsContext', () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('./useDismissedIncomingCalls', () => ({ useDismissedIncomingCalls: () => ({ dismissed: [], dismiss: vi.fn() }) }));
vi.mock('./IncomingCallCard', () => ({ default: ({ offer }: { offer: VoiceIncomingOffer }) => <div>{offer.caller_name} ringing</div> }));
const waiting: VoiceIncomingOffer = { id: 'shared', voice_call_id: 42, status: 'waiting', expires_at: new Date(Date.now() + 45000).toISOString(), caller_name: 'Caller', remote_phone: '+12025550123', can_claim: true, phone_available: false, claimed_by: null };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><IncomingCallPopup /></QueryClientProvider></MemoryRouter>);
  return client;
}
describe('Shared invitation closes after another answer', () => {
  beforeEach(() => { mocks.phone.active = null; mocks.get.mockResolvedValue([waiting]); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it('removes the other account invitation and names the winner once', async () => {
    const client = setup();
    await screen.findByText('Caller ringing');
    const claimed = { ...waiting, status: 'claimed' as const, can_claim: false, claimed_by: { id: 377, name: 'Editing Manager' } };
    await act(async () => { client.setQueryData(['voice-incoming-offers'], [claimed]); });
    await waitFor(() => expect(screen.queryByText('Caller ringing')).not.toBeInTheDocument());
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Answered by Editing Manager' }));
    await act(async () => { client.setQueryData(['voice-incoming-offers'], [{ ...claimed }]); });
    expect(mocks.toast).toHaveBeenCalledOnce();
    expect(mocks.phone.answerIncoming).not.toHaveBeenCalled();
  });
  it('closes the invitation when another teammate sends the caller to Robbie', async () => {
    const client = setup();
    await screen.findByText('Caller ringing');
    await act(async () => { client.setQueryData(['voice-incoming-offers'], [{ ...waiting, status: 'robbie_pending', can_claim: false }]); });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Caller sent to Robbie' })));
    expect(screen.queryByText('Caller ringing')).not.toBeInTheDocument();
  });
});
