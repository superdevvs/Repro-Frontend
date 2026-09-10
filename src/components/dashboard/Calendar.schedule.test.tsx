import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Calendar } from './Calendar';

const state = vi.hoisted(() => ({ shoots: [] as unknown[] }));
vi.mock('@/context/shootsContextState', () => ({ useShoots: () => state }));
vi.mock('./ShootDetail', () => ({ ShootDetail: () => null }));

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('calendar scheduled slot', () => {
  it.each([
    { scheduledDate: '2026-09-09T00:00:00Z', time: '10:00:00', timezone: null },
    { scheduled_at: '2026-09-09T14:00:00Z', timezone: 'America/New_York' },
  ])('uses the shoot schedule for the day and time slot', (schedule) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T16:00:00Z'));
    state.shoots = [{ id: '86', status: 'scheduled', client: { name: 'Golden Horseshoe Client' },
      photographer: { name: 'Photographer' }, location: { address: '7319 Golden Horseshoe Court' }, ...schedule }];
    render(<Calendar />);
    expect(screen.getByText('Golden Horseshoe Client')).toBeInTheDocument();
    expect(screen.getByText('10:00 AM')).toBeInTheDocument();
  });
});
