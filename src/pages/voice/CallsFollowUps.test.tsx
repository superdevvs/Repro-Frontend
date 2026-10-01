import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import CallsFollowUps from './CallsFollowUps';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ getScheduledVoiceCalls: vi.fn(), cancelScheduledVoiceCall: vi.fn(), retryScheduledVoiceCall: vi.fn(), can: vi.fn() }));
vi.mock('@/services/voice', () => ({
  ...mocks,
  getVoiceSettings: vi.fn().mockResolvedValue({ automation_toggles: {}, quiet_hours: { enabled: false } }),
  updateVoiceSettings: vi.fn(),
}));
vi.mock('@/services/voiceAutomations', () => ({ getVoiceAutomationRules: vi.fn().mockResolvedValue({ rules: [], managed_triggers: [], assignees: [] }) }));
vi.mock('@/context/PermissionsContext', () => ({ usePermissions: () => ({ can: mocks.can, isLoading: false }) }));
vi.mock('@/hooks/use-page-loading', () => ({ usePageLoading: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('./workspace/VoiceAutomationBuilder', () => ({ VoiceAutomationBuilder: () => null }));
vi.mock('./ScheduleVoiceCallDialog', () => ({ default: () => null }));

function renderAutomations() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={client}><CallsFollowUps /></QueryClientProvider></MemoryRouter>);
}

describe('scheduled callback pagination', () => {
  beforeEach(() => {
    mocks.can.mockImplementation((_resource: string, action: string) => action !== 'manage');
    mocks.getScheduledVoiceCalls.mockImplementation(async ({ page }: { page: number }) => ({
      current_page: page, last_page: 2, total: 41,
      data: [{ id: page === 1 ? 41 : 1, target_phone: page === 1 ? '+12025550041' : '+12025550001', status: 'failed', attempts: 1, max_attempts: 3, automation_type: 'missed_call_callback' }],
    }));
    mocks.cancelScheduledVoiceCall.mockResolvedValue({ status: 'cancelled' });
    mocks.retryScheduledVoiceCall.mockResolvedValue({ status: 'scheduled' });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('reaches older callbacks and targets the selected page for retry or cancellation', async () => {
    const user = userEvent.setup(); renderAutomations();
    expect(await screen.findByText('+12025550041')).toBeInTheDocument();
    expect(screen.getByText('1–1 of 41')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous follow-ups' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next follow-ups' }));
    expect(await screen.findByText('+12025550001')).toBeInTheDocument();
    expect(screen.queryByText('+12025550041')).not.toBeInTheDocument();
    expect(mocks.getScheduledVoiceCalls).toHaveBeenCalledWith(expect.objectContaining({ per_page: 20, page: 2 }));
    expect(screen.getByRole('button', { name: 'Next follow-ups' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Retry callback' }));
    await waitFor(() => expect(mocks.retryScheduledVoiceCall.mock.calls[0]?.[0]).toBe(1));
    await user.click(screen.getByRole('button', { name: 'Cancel callback' }));
    await waitFor(() => expect(mocks.cancelScheduledVoiceCall.mock.calls[0]?.[0]).toBe(1));
    await user.click(screen.getByRole('button', { name: 'Previous follow-ups' }));
    expect(await screen.findByText('+12025550041')).toBeInTheDocument();
  });

  it('lets viewers page through callbacks without operating them', async () => {
    mocks.can.mockImplementation((_resource: string, action: string) => action === 'view');
    const user = userEvent.setup(); renderAutomations();
    await screen.findByText('+12025550041');
    await user.click(screen.getByRole('button', { name: 'Next follow-ups' }));
    await screen.findByText('+12025550001');
    expect(screen.getByRole('button', { name: 'Retry callback' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel callback' })).toBeDisabled();
  });

  it('keeps a way back when loading an older page fails', async () => {
    mocks.getScheduledVoiceCalls.mockImplementation(async ({ page }: { page: number }) => {
      if (page === 2) throw new Error('Unavailable');
      return { current_page: 1, last_page: 2, total: 41, data: [] };
    });
    const user = userEvent.setup(); renderAutomations();
    await screen.findByText('0–0 of 41');
    await user.click(screen.getByRole('button', { name: 'Next follow-ups' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load follow-ups.');
    expect(screen.getByRole('button', { name: 'Previous follow-ups' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next follow-ups' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Previous follow-ups' }));
    expect(await screen.findByText('0–0 of 41')).toBeInTheDocument();
  });
});
