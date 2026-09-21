import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CallsSettings from './CallsSettings';
import CallsSchedule from './CallsSchedule';
import CallsAutomations from './CallsAutomations';
import CallLiveCockpit from './CallLiveCockpit';

const mocks = vi.hoisted(() => ({
  can: vi.fn(), getVoiceSettings: vi.fn(), getVoiceNumbers: vi.fn(), getVoiceLlmUsage: vi.fn(),
  getScheduleOverrides: vi.fn(), getScheduledVoiceCalls: vi.fn(), getVoiceCall: vi.fn(),
  updateVoiceSettings: vi.fn(), updateVoiceNumber: vi.fn(), createScheduleOverride: vi.fn(), deleteScheduleOverride: vi.fn(),
  retryScheduledVoiceCall: vi.fn(), cancelScheduledVoiceCall: vi.fn(), createScheduledVoiceCall: vi.fn(),
  addVoiceCallNote: vi.fn(), markCockpitOpened: vi.fn(), hangupVoiceCall: vi.fn(), transferVoiceCall: vi.fn(), wrapUpVoiceCall: vi.fn(),
}));
vi.mock('@/context/PermissionsContext', () => ({ usePermissions: () => ({ can: mocks.can, isLoading: false }) }));
vi.mock('@/services/voice', () => mocks);
vi.mock('@/services/voiceAutomations', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/services/voiceAutomations')>(),
  getVoiceAutomationRules: vi.fn().mockResolvedValue({ rules: [], managed_triggers: [], assignees: [] }),
  getVoiceAutomationRuns: vi.fn().mockResolvedValue({ data: [], current_page: 1, last_page: 1, total: 0 }),
}));
vi.mock('@/hooks/use-page-loading', () => ({ usePageLoading: () => false }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/voice/ScheduleBadge', () => ({ default: () => <span>Team hours</span> }));
vi.mock('@/components/voice/MemoryDrawer', () => ({ default: () => <span>Customer history</span> }));
vi.mock('@/hooks/useCallLiveStream', () => ({ useCallLiveStream: () => ({ connected: true, transcript: [], insights: { next_best_action: 'Confirm access' }, memory: null }) }));

const renderPage = (page: ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<MemoryRouter initialEntries={['/calls/live/12']}><QueryClientProvider client={client}><Routes><Route path="/calls/live/:id" element={page} /></Routes></QueryClientProvider></MemoryRouter>);
};

describe('Calls permission boundaries', () => {
  beforeEach(() => {
    mocks.can.mockImplementation((_resource: string, action: string) => action === 'view');
    mocks.getVoiceSettings.mockResolvedValue({ enabled: true, outbound_mode: 'all', support_handoff_number: '+12025550100', business_hours: { timezone: 'America/New_York', weekly: {} }, holidays: [], quiet_hours: { enabled: false }, automation_toggles: {} });
    mocks.getVoiceNumbers.mockResolvedValue([{ id: 1, phone_number: '+12025550100', label: 'Main line', voice_ai_enabled: true }]);
    mocks.getVoiceLlmUsage.mockResolvedValue({ spend_usd: 1, budget_usd: 50 });
    mocks.getScheduleOverrides.mockResolvedValue([]);
    mocks.getScheduledVoiceCalls.mockResolvedValue({ data: [{ id: 3, status: 'failed', target_phone: '+12025550124', attempts: 1, max_attempts: 3 }] });
    mocks.getVoiceCall.mockResolvedValue({ id: 12, provider: 'telnyx', direction: 'INBOUND', status: 'active', call_control_id: 'customer-leg', from_phone: '+12025550124' });
    mocks.markCockpitOpened.mockResolvedValue({});
    mocks.cancelScheduledVoiceCall.mockResolvedValue({ id: 3, status: 'cancelled' });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('disables number controls and every settings field for a viewer', async () => {
    const user = userEvent.setup();
    renderPage(<CallsSettings />);
    expect(await screen.findByRole('button', { name: 'Save settings' })).toBeDisabled();
    for (const control of [...screen.getAllByRole('textbox'), ...screen.getAllByRole('switch')]) expect(control).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Allow all/i }));
    await user.click(screen.getAllByRole('switch')[0]);
    expect(mocks.updateVoiceNumber).not.toHaveBeenCalled();
    expect(mocks.updateVoiceSettings).not.toHaveBeenCalled();
  });

  it('disables editable coverage fields and override shortcuts for an operator', async () => {
    mocks.can.mockImplementation((_resource: string, action: string) => action !== 'manage');
    renderPage(<CallsSchedule />);
    expect(await screen.findByRole('button', { name: 'Save hours' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save holidays' })).toBeDisabled();
    expect(screen.getByPlaceholderText('America/New_York')).toBeDisabled();
    for (const control of screen.getAllByRole('button')) expect(control).toBeDisabled();
  });

  it('allows a manager to edit configuration', async () => {
    mocks.can.mockImplementation((_resource: string, action: string) => action === 'view' || action === 'manage');
    renderPage(<CallsSettings />);
    expect(await screen.findByRole('button', { name: 'Save settings' })).toBeEnabled();
    expect(screen.getByPlaceholderText('+12025550100')).toBeEnabled();
    for (const control of screen.getAllByRole('switch')) expect(control).toBeEnabled();
  });

  it('allows an operator to cancel callbacks without editing automation rules', async () => {
    mocks.can.mockImplementation((_resource: string, action: string) => action !== 'manage');
    const user = userEvent.setup();
    renderPage(<CallsAutomations />);
    expect(await screen.findByRole('switch', { name: 'Missed call callback' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Schedule callback' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(mocks.cancelScheduledVoiceCall).toHaveBeenCalledWith(3));
    expect(mocks.updateVoiceSettings).not.toHaveBeenCalled();
  });

  it('does not let a configuration manager operate callbacks', async () => {
    mocks.can.mockImplementation((_resource: string, action: string) => action !== 'operate');
    renderPage(<CallsAutomations />);
    expect(await screen.findByRole('switch', { name: 'Missed call callback' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Schedule callback' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('allows live transcript review without triggering intelligence or call mutations', async () => {
    renderPage(<CallLiveCockpit />);
    expect(await screen.findByText('You have read-only Calls access.')).toBeInTheDocument();
    for (const name of ['Add note', 'Bookmark moment', 'Transfer', 'End call']) expect(screen.getByRole('button', { name })).toBeDisabled();
    expect(screen.getByPlaceholderText('Private note for this call…')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'View full customer history' })).toBeEnabled();
    expect(mocks.markCockpitOpened).not.toHaveBeenCalled();
    expect(mocks.hangupVoiceCall).not.toHaveBeenCalled();
  });
});
