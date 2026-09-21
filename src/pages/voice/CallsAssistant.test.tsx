import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CallsAssistant from './CallsAssistant';

const mocks = vi.hoisted(() => ({
  getVoiceSettings: vi.fn(),
  getVoiceHealth: vi.fn(),
  getVoiceLlmUsage: vi.fn(),
  updateVoiceSettings: vi.fn(),
  syncVoiceAssistant: vi.fn(),
  can: vi.fn(),
}));

vi.mock('@/context/PermissionsContext', () => ({ usePermissions: () => ({ can: mocks.can, isLoading: false }) }));

vi.mock('@/services/voice', () => ({
  getVoiceSettings: mocks.getVoiceSettings,
  getVoiceHealth: mocks.getVoiceHealth,
  getVoiceLlmUsage: mocks.getVoiceLlmUsage,
  updateVoiceSettings: mocks.updateVoiceSettings,
  syncVoiceAssistant: mocks.syncVoiceAssistant,
  getVoiceNumbers: vi.fn().mockResolvedValue([]),
  getScheduleState: vi.fn().mockResolvedValue({ state: { state: 'team_open' } }),
  placeVoiceCall: vi.fn(),
}));

vi.mock('@/services/messaging', () => ({
  getSmsThreads: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/use-page-loading', () => ({
  usePageLoading: () => false,
}));

describe('CallsAssistant', () => {
  beforeEach(() => {
    mocks.can.mockReturnValue(true);
    mocks.getVoiceSettings.mockResolvedValue({
      enabled: true,
      outbound_mode: 'canary',
      canary_numbers: ['+12025550123'],
      greeting_text: 'Hi, this is Robbie.',
      disclosure_text: 'This call may be recorded.',
      tool_allowlist: ['verify_caller'],
    });
    mocks.getVoiceHealth.mockResolvedValue({
      can_place_calls: false,
      outbound_mode: 'canary',
      readiness_blockers: ['No canary numbers are allowlisted.'],
      assistant_sync: { status: 'drifted', missing_tools: ['get_shoot_details', 'set_recording_consent'] },
    });
    mocks.getVoiceLlmUsage.mockResolvedValue({ spend_usd: 1, budget_usd: 50 });
    mocks.updateVoiceSettings.mockResolvedValue({ outbound_mode: 'all', canary_mode: false });
    mocks.syncVoiceAssistant.mockResolvedValue({ applied: true, promote_to_main: true, missing_tools: [] });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('lets an admin switch outbound to all, canary, or none', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <CallsAssistant />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /allow all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^canary$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^none$/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /allow all/i }));
    expect(mocks.updateVoiceSettings).toHaveBeenCalledWith(expect.objectContaining({ outbound_mode: 'all' }));
  });

  it('shows readable tool names and can sync missing Telnyx tools', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <CallsAssistant />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Verify caller')).toBeInTheDocument();
    expect(screen.getByText(/Missing on Telnyx/i)).toHaveTextContent('Get shoot details');
    expect(screen.getByText(/Missing on Telnyx/i)).toHaveTextContent('Set recording consent');

    await user.click(screen.getByRole('button', { name: /sync tools to telnyx/i }));
    expect(mocks.syncVoiceAssistant).toHaveBeenCalledWith({ promote_to_main: true });
  });

  it('keeps assistant settings read-only for a call operator', async () => {
    mocks.can.mockImplementation((_resource: string, action: string) => action !== 'manage');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<MemoryRouter><QueryClientProvider client={client}><CallsAssistant /></QueryClientProvider></MemoryRouter>);
    expect(await screen.findByRole('button', { name: /allow all/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save copy' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sync tools to Telnyx' })).toBeDisabled();
    for (const field of screen.getAllByRole('textbox')) expect(field).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Test with a real call' })).toBeEnabled();
    expect(mocks.updateVoiceSettings).not.toHaveBeenCalled();
    expect(mocks.syncVoiceAssistant).not.toHaveBeenCalled();
  });
});
