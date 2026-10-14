import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import IncomingCallCard from './IncomingCallCard';
import type { VoiceIncomingOffer } from '@/types/voice';

const mocks = vi.hoisted(() => ({ send: vi.fn(), phone: { busy: false, active: null as unknown }, toast: vi.fn() }));
vi.mock('@/context/BrowserPhoneContext', () => ({ useBrowserPhone: () => mocks.phone }));
vi.mock('@/services/voice', () => ({ sendIncomingCallToRobbie: mocks.send }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
const offer = (): VoiceIncomingOffer => ({ id: 'offer-1', voice_call_id: 3, status: 'waiting', expires_at: new Date(Date.now() + 45000).toISOString(), caller_name: 'Angela Campbell', remote_phone: '+12025550123', business_phone: '+12027803332', line_label: 'Editing', caller_company: 'Icecap', caller_role: 'client', can_claim: true, can_send_robbie: true, phone_available: false, claimed_by: null });
function card(data = offer()) {
  const dismiss = vi.fn(), answer = vi.fn();
  render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><IncomingCallCard offer={data} onDismiss={dismiss} onAnswer={answer} /></QueryClientProvider></MemoryRouter>);
  return { dismiss, answer };
}
describe('Incoming business call actions', () => {
  beforeEach(() => { mocks.phone.busy = false; mocks.phone.active = null; mocks.send.mockResolvedValue({ status: 'robbie_pending', voice_call_id: 3 }); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it('shows real caller and line identity and only answers after a click', async () => {
    const { answer } = card();
    expect(screen.getByText('Angela Campbell')).toBeVisible();
    expect(screen.getByText('Icecap')).toBeVisible();
    expect(screen.getByText('+12027803332')).toBeVisible();
    expect(answer).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Answer in browser' }));
    expect(answer).toHaveBeenCalledOnce();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('declines only this invitation without ending or handing off the customer', async () => {
    const { dismiss, answer } = card();
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(dismiss).toHaveBeenCalledOnce();
    expect(answer).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('sends to Robbie explicitly and retains its idempotency key after an uncertain response', async () => {
    mocks.send.mockRejectedValueOnce(new Error('Provider response pending'));
    card();
    await userEvent.click(screen.getByRole('button', { name: 'Send to Robbie' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Could not send to Robbie' })));
    await userEvent.click(screen.getByRole('button', { name: 'Send to Robbie' }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
    expect(mocks.send.mock.calls[0][1]).toBe(mocks.send.mock.calls[1][1]);
  });
  it('blocks expired invitations and unavailable Robbie', () => {
    card({ ...offer(), expires_at: new Date(Date.now() - 1000).toISOString(), can_send_robbie: false });
    expect(screen.getByRole('button', { name: 'Answer in browser' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send to Robbie' })).toBeDisabled();
  });
  it('prevents a handoff while this device is already on a call', () => {
    mocks.phone.active = { state: 'active' };
    card();
    expect(screen.getByRole('button', { name: 'Send to Robbie' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Answer in browser' })).toBeDisabled();
  });
});
