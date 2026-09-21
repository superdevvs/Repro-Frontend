import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CallsInsights from './CallsInsights';

const mocks = vi.hoisted(() => ({
  getVoiceInsights: vi.fn(),
}));

vi.mock('@/services/voice', () => ({
  getVoiceInsights: mocks.getVoiceInsights,
}));

vi.mock('@/hooks/use-page-loading', () => ({
  usePageLoading: () => false,
}));

describe('CallsInsights', () => {
  beforeEach(() => {
    mocks.getVoiceInsights.mockResolvedValue({
      range: '7d',
      answered_rate: 66.7,
      answered_rate_delta: null,
      median_answer_seconds: 18,
      median_answer_delta: null,
      bookings_from_calls: 2,
      bookings_delta: null,
      missed_recovered_rate: 100,
      missed_recovered_delta: null,
      inbound_total: 3,
      volume_by_day: [{ date: '2026-09-20', label: 'Sun', team: 1, ai: 1, missed: 1, total: 3 }],
      intents: [{ key: 'new_booking', label: 'new booking', count: 2, pct: 67 }],
      handoff_connected_rate: null,
      handoffs_needing_callback: 0,
      opportunity: { title: 'Most common caller need this period', detail: '2 callers were tagged “new booking”.' },
      updated_at: '2026-09-20T12:00:00.000Z',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders stored counts and hides invented comparisons', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <CallsInsights />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('66.7%')).toBeInTheDocument();
    expect(screen.getAllByText('No prior period to compare').length).toBeGreaterThan(0);
    expect(screen.getByText('2 callers were tagged “new booking”.')).toBeInTheDocument();
    expect(screen.queryByText(/4 of 7/)).not.toBeInTheDocument();
  });

  it('treats a reduced answer time as an improvement and labels chart counts accessibly', async () => {
    const data = await mocks.getVoiceInsights();
    mocks.getVoiceInsights.mockResolvedValue({ ...data, median_answer_delta: -8 });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CallsInsights /></QueryClientProvider>);
    expect(await screen.findByText('-8s · faster')).toHaveClass('text-[var(--calls-brand)]');
    expect(screen.getByRole('img', { name: '2026-09-20: 1 team, 1 Robbie, 1 missed, 3 total' })).toBeInTheDocument();
  });
});
