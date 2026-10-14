import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GroundwireSettings from './GroundwireSettings';
import { createSipDevice, getSipDevices, revealSipCredentials, revokeSipDevice } from '@/services/voiceSip';
vi.mock('@/services/voiceSip', () => ({getSipDevices: vi.fn(), createSipDevice: vi.fn(), revealSipCredentials: vi.fn(), updateSipDevice: vi.fn(), revokeSipDevice: vi.fn()}));
vi.mock('@/context/PermissionsContext', () => ({usePermissions: () => ({can: () => true})}));
vi.mock('@/hooks/use-toast', () => ({useToast: () => ({toast: vi.fn()})}));
const line={number: '+12027803332', label: 'Editing', receives_calls: true, timezone: 'Asia/Kolkata', weekly_hours: {}};
const device={id: 'device-one', creation_key:'key-one', label:'My phone', caller_id:line.number, state:'ready', enabled:true, registered:false, registration_checked_at:null};
function show() { return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><GroundwireSettings /></QueryClientProvider>); }
describe('Groundwire setup', () => {
  beforeEach(() => {vi.clearAllMocks(); vi.mocked(getSipDevices).mockResolvedValue({configured:true,lines:[line],devices:[device]});});
  it('keeps credentials out of ordinary device loading', async () => {
    show(); await screen.findByText('My phone');
    expect(revealSipCredentials).not.toHaveBeenCalled();
    expect(screen.getByText('Waiting for app registration')).toBeTruthy();
    expect(screen.queryByRole('region',{name:'Private Groundwire SIP login'})).toBeNull();
  });
  it('reveals privately on request and hides again', async () => {
    vi.mocked(revealSipCredentials).mockResolvedValue({title:'REPro',username:'private-user',password:'private-pass',domain:'sip.telnyx.com',port:5061,transport:'TLS (sip)',media:'SRTP',caller_id:line.number});
    show(); fireEvent.click(await screen.findByRole('button',{name:'Show my SIP login'}));
    await screen.findByText('private-pass');
    fireEvent.click(screen.getByRole('button',{name:'Hide SIP login'}));
    await waitFor(() => expect(screen.queryByText('private-pass')).toBeNull());
  });
  it('retries uncertain enrolment with its saved identity', async () => {
    vi.mocked(getSipDevices).mockResolvedValue({configured:true,lines:[line],devices:[{...device,state:'uncertain'}]});
    vi.mocked(createSipDevice).mockResolvedValue(device);
    show(); fireEvent.click(await screen.findByRole('button',{name:'Retry same setup'}));
    await waitFor(() => expect(createSipDevice).toHaveBeenCalledWith({label:device.label,caller_id:device.caller_id,creation_key:device.creation_key}));
    expect(revealSipCredentials).not.toHaveBeenCalled();
  });
  it('revokes only the current user device', async () => {
    show(); fireEvent.click(await screen.findByRole('button',{name:'Revoke device'}));
    await waitFor(() => expect(revokeSipDevice).toHaveBeenCalledWith(device.id));
  });
});
