import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CallsLive from './CallsLive';

const mocks = vi.hoisted(() => ({
  getVoiceCalls: vi.fn(),
  getScheduleState: vi.fn(),
  getVoiceSettings: vi.fn(),
  getVoiceHealth: vi.fn(),
}));

vi.mock('@/services/voice', () => ({
  getVoiceCalls: mocks.getVoiceCalls,
  getScheduleState: mocks.getScheduleState,
  getVoiceSettings: mocks.getVoiceSettings,
  getVoiceHealth: mocks.getVoiceHealth,
}));

vi.mock('@/hooks/use-page-loading', () => ({
  usePageLoading: () => false,
}));

describe('CallsLive', () => {
  beforeEach(() => {
    mocks.getVoiceCalls.mockResolvedValue({
      data: [{ id: 21, direction: 'INBOUND', status: 'in_progress', handled_by: 'ai', from_phone: '+12025550124', caller_contact: { name: 'Alex Morgan' }, live_transcript_preview: 'The gate code is not working.' }],
      total: 1,
    });
    mocks.getScheduleState.mockResolvedValue({ state: { state: 'team_open', label: 'Team hours' } });
    mocks.getVoiceSettings.mockResolvedValue({ support_handoff_number: '+12025550100', quiet_hours: { enabled: false } });
    mocks.getVoiceHealth.mockResolvedValue({ can_place_calls: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('lists a live call and hides supervision without a browser phone capability', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <CallsLive />
        </QueryClientProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Alex Morgan')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/calls/live/21');
    expect(screen.queryByRole('button', { name: 'Listen' })).not.toBeInTheDocument();
    expect(screen.queryByText(/4 of 7/)).not.toBeInTheDocument();
  });
});
