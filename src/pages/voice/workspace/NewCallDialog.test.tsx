import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NewCallDialog from './NewCallDialog';
import type { BrowserPhoneContextValue } from '@/context/BrowserPhoneContext';

const mocks = vi.hoisted(() => ({ getVoiceNumbers: vi.fn(), getVoiceHealth: vi.fn(), getVoiceDirectory: vi.fn(), placeVoiceCall: vi.fn(), toast: vi.fn(), can: vi.fn(), phone: {} as BrowserPhoneContextValue, startHuman: vi.fn(), cancelPending: vi.fn() }));
vi.mock('@/context/BrowserPhoneContext', () => ({ useBrowserPhone: () => mocks.phone }));
vi.mock('@/context/PermissionsContext', () => ({ usePermissions: () => ({ can: mocks.can, isLoading: false }) }));
vi.mock('@/services/voice', () => mocks);
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
const renderDialog = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><NewCallDialog initialTo="+12025550123" initialFrom="+18888041663" trigger={<button>Open new call</button>} /></QueryClientProvider></MemoryRouter>);
  return client;
};
const open = async () => { const client = renderDialog(); await userEvent.click(screen.getByRole('button', { name: 'Open new call' })); return client; };
const options = async () => userEvent.click(screen.getByRole('button', { name: 'Business line & options' }));
describe('NewCallDialog', () => {
  beforeEach(() => {
    mocks.can.mockReturnValue(true);
    mocks.phone = { eligible: true, status: 'disconnected', configLoading: false, busy: false, active: null, session: null, config: { ready: true, enabled: true, blockers: [], capabilities: { human_outbound: true } }, startHuman: mocks.startHuman, cancelPending: mocks.cancelPending } as unknown as BrowserPhoneContextValue;
    mocks.getVoiceNumbers.mockResolvedValue([{ id: 1, phone_number: '+18888041663', label: 'Main line', is_default: true }]);
    mocks.getVoiceDirectory.mockResolvedValue({ data: [], total: 0, last_page: 1 });
    mocks.getVoiceHealth.mockResolvedValue({ can_place_calls: true, readiness_blockers: [] });
    mocks.placeVoiceCall.mockResolvedValue({ id: 99 });
    mocks.startHuman.mockResolvedValue({ id: 103 });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it('defaults to a one-action human call before the browser is connected', async () => {
    await open();
    const call = await screen.findByRole('button', { name: 'Call +12025550123' });
    await waitFor(() => expect(call).toBeEnabled());
    expect(screen.queryByRole('button', { name: 'Connect phone' })).not.toBeInTheDocument();
    await userEvent.click(call);
    await waitFor(() => expect(mocks.startHuman).toHaveBeenCalledWith({ to: '+12025550123', from: '+18888041663', reason: undefined }));
    expect(mocks.placeVoiceCall).not.toHaveBeenCalled();
  });
  it('only places an AI call after choosing Robbie explicitly', async () => {
    await open(); await userEvent.click(screen.getByRole('button', { name: 'Ask Robbie to call instead' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Robbie call' })).toBeEnabled());
    await userEvent.type(screen.getByLabelText('What should Robbie say?'), 'Confirm access');
    await userEvent.click(screen.getByRole('button', { name: 'Start Robbie call' }));
    await waitFor(() => expect(mocks.placeVoiceCall).toHaveBeenCalledWith(expect.objectContaining({ to: '+12025550123', assistant_mode: 'robbie_ai', dynamic_variables: expect.objectContaining({ reason: 'Confirm access' }) })));
    expect(mocks.startHuman).not.toHaveBeenCalled();
  });
  it('blocks AI outbound when readiness fails without blocking human calling', async () => {
    mocks.getVoiceHealth.mockResolvedValue({ can_place_calls: false, readiness_blockers: ['AI calling paused'] });
    await open();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Call +12025550123' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Ask Robbie to call instead' }));
    expect(await screen.findByText('AI calling paused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Robbie call' })).toBeDisabled();
  });
  it('prevents a viewer from opening or loading the directory', async () => {
    mocks.can.mockReturnValue(false); renderDialog();
    expect(screen.getByRole('button', { name: 'Open new call' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Open new call' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.getVoiceDirectory).not.toHaveBeenCalled();
  });
  it('searches the role directory without SMS permission and selects the actual number', async () => {
    mocks.can.mockImplementation((resource: string) => resource === 'voice-calls');
    mocks.getVoiceDirectory.mockResolvedValue({ data: [{ id: 'user:1', name: 'Casey Photo', role: 'photographer', phone: '+12025550999', callable: true }], total: 1, last_page: 1 });
    await open(); await userEvent.click(await screen.findByRole('button', { name: /Casey Photo/ }));
    expect(screen.getByLabelText('Casey Photo')).toHaveValue('+12025550999');
    await userEvent.click(screen.getByRole('button', { name: 'Photographers' }));
    await waitFor(() => expect(mocks.getVoiceDirectory).toHaveBeenCalledWith(expect.objectContaining({ role: 'photographer' })));
  });
  it('disables invalid legacy business lines', async () => {
    mocks.getVoiceNumbers.mockResolvedValue([{ id: 1, phone_number: '+18888041663', label: 'Main line' }, { id: 2, phone_number: '2028681663', label: 'Legacy line' }]);
    await open(); await options();
    expect(screen.getByRole('option', { name: /Legacy line.*Unavailable/ })).toBeDisabled();
    expect(screen.getByLabelText('Business line')).toHaveValue('+18888041663');
  });
  it('validates and normalizes a typed number', async () => {
    await open();
    const input = screen.getByLabelText('Phone number');
    await userEvent.clear(input); await userEvent.type(input, '1234');
    expect(screen.getByRole('button', { name: 'Call now' })).toBeDisabled();
    await userEvent.clear(input); await userEvent.type(input, '+1 (202) 555-0199');
    await userEvent.click(screen.getByRole('button', { name: 'Call +12025550199' }));
    await waitFor(() => expect(mocks.startHuman).toHaveBeenCalledWith(expect.objectContaining({ to: '+12025550199' })));
  });
  it('keeps the draft if the default line refreshes', async () => {
    const client = await open(); await options();
    const input = screen.getByLabelText('Phone number');
    await userEvent.clear(input); await userEvent.type(input, '+12025550199');
    await userEvent.type(screen.getByLabelText('Private reason (optional)'), 'Confirm access');
    act(() => { client.setQueryData(['voice-numbers'], [{ id: 1, phone_number: '+18888041663' }, { id: 2, phone_number: '+18888041664', is_default: true }]); });
    expect(input).toHaveValue('+12025550199'); expect(screen.getByLabelText('Private reason (optional)')).toHaveValue('Confirm access');
    expect(screen.getByLabelText('Business line')).toHaveValue('+18888041663');
  });
  it('keeps a deliberate cancellation path while connecting', async () => {
    mocks.startHuman.mockImplementation(() => new Promise(() => undefined));
    await open(); await userEvent.click(await screen.findByRole('button', { name: 'Call +12025550123' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel connection' }));
    expect(mocks.cancelPending).toHaveBeenCalledTimes(1);
  });
  it('blocks starting when business lines fail to load', async () => {
    mocks.getVoiceNumbers.mockRejectedValue(new Error('Unavailable')); await open();
    expect(await screen.findByText(/Could not load business lines/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Call +12025550123' })).toBeDisabled();
  });
});
