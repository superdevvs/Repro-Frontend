import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';

vi.mock('recharts', () => ({
  AreaChart: ({ data }: { data: unknown }) => <pre data-testid="revenue-data">{JSON.stringify(data)}</pre>,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  LineChart: () => null,
  Line: () => null,
  Tooltip: () => null,
}));
vi.mock('framer-motion', () => ({
  motion: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
}));

import { RevenueOverview } from './RevenueOverview';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('revenue booked-month aggregation', () => {
  it('keeps midnight bookings in their booked month and year west of UTC', () => {
    vi.stubEnv('TZ', 'America/New_York');
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 9, 12));
    const shoots = [
      { scheduledDate: '2026-01-01T00:00:00Z', payment: { totalPaid: 150 } },
      { scheduledDate: '2026-09-01T00:00:00Z', payment: { totalPaid: 100 } },
    ] as ShootData[];

    render(<RevenueOverview shoots={shoots} timeRange="year" />);
    const data = JSON.parse(screen.getByTestId('revenue-data').textContent || '[]');

    expect(data.find((month: { name: string }) => month.name === 'Jan').revenue).toBe(150);
    expect(data.find((month: { name: string }) => month.name === 'Sep').revenue).toBe(100);
    expect(data.find((month: { name: string }) => month.name === 'Aug').revenue).toBe(0);
  });
});
