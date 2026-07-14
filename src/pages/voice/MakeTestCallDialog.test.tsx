import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MakeTestCallDialog from './MakeTestCallDialog';

const mocks = vi.hoisted(() => ({
  getScheduleState: vi.fn(),
  getVoiceHealth: vi.fn(),
  placeVoiceCall: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/services/voice', () => ({
  getScheduleState: mocks.getScheduleState,
  getVoiceHealth: mocks.getVoiceHealth,
  placeVoiceCall: mocks.placeVoiceCall,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

const renderDialog = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MakeTestCallDialog
        initialTo="+12025550123"
        initialFrom="+18888041663"
        initialContext="Canary verification"
        trigger={<button type="button">Open test call</button>}
      />
    </QueryClientProvider>,
  );
};

describe('MakeTestCallDialog', () => {
  beforeEach(() => {
    mocks.getScheduleState.mockResolvedValue({ state: { state: 'open' } });
    mocks.getVoiceHealth.mockResolvedValue({
      provider: 'telnyx',
      can_place_calls: true,
      readiness_blockers: [],
    });
    mocks.placeVoiceCall.mockResolvedValue({ id: 42, provider: 'telnyx', status: 'queued' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders direct Telnyx readiness blockers and prevents a test call', async () => {
    mocks.getVoiceHealth.mockResolvedValue({
      provider: 'telnyx',
      can_place_calls: false,
      readiness_blockers: ['No VOICE_CANARY_NUMBERS are configured.'],
    });
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Open test call' }));

    expect(await screen.findByText(/direct Telnyx Call Control/i)).toBeInTheDocument();
    expect(await screen.findByText(/No VOICE_CANARY_NUMBERS are configured/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start AI call/i })).toBeDisabled();
    expect(mocks.placeVoiceCall).not.toHaveBeenCalled();
  });

  it('submits the Robbie Telnyx payload only after readiness succeeds', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Open test call' }));
    const start = await screen.findByRole('button', { name: /Start AI call/i });
    await waitFor(() => expect(start).toBeEnabled());
    await user.click(start);

    await waitFor(() => {
      expect(mocks.placeVoiceCall).toHaveBeenCalledWith({
        to: '+12025550123',
        from: '+18888041663',
        assistant_mode: 'robbie_ai',
        source: 'test_call_dialog',
        dynamic_variables: {
          reason: 'Canary verification',
          source: 'calls_dashboard_test_call',
        },
      });
    });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Test call started' }));
  });
});
