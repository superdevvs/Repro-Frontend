import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GroundwireSmsSettings from './GroundwireSmsSettings';
import { configureSipSms, type SipDevice } from '@/services/voiceSip';
vi.mock('@/services/voiceSip', () => ({ configureSipSms: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
const sms = {number: '+12027803332', available_numbers: ['+12027803332', '+12028681663'], ready: true, phone_connected: true, push_registered: false, last_fetch_at: null, last_send_at: null, setup_url: 'https://reprodashboard.com/api/groundwire/sms/provision'};
const device: SipDevice = {id: 'my-device', creation_key: 'key', label: 'Phone', caller_id: '+12028681663', state: 'ready', enabled: true, registered: true, registration_checked_at: null, sms};
function show(d = device) { return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><GroundwireSmsSettings device={d} /></QueryClientProvider>); }
describe('Groundwire SMS setup', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('locks the SMS sender after phone pairing even when voice caller ID differs', () => {
    show();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(select.value).toBe('+12027803332');
    expect(screen.getByText(/allow notifications and restart Groundwire/)).toBeTruthy();
  });
  it('enables only an explicitly selected SMS line', async () => {
    show({...device, sms: {...sms, number: null, phone_connected: false}});
    fireEvent.change(screen.getByRole('combobox'), {target: {value: '+12028681663'}});
    fireEvent.click(screen.getByRole('button', {name: 'Enable SMS for this number'}));
    await waitFor(() => expect(configureSipSms).toHaveBeenCalledWith('my-device', {number: '+12028681663', reset_pairing: false}));
  });
  it('copies a nonsecret provisioning URL and never reveals a SIP password', async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: copy}});
    show();
    fireEvent.click(screen.getByRole('button', {name: 'Copy Groundwire SMS setup URL'}));
    await waitFor(() => expect(copy).toHaveBeenCalledWith(sms.setup_url));
    expect(document.body.textContent).not.toContain('secret-password');
  });
});
