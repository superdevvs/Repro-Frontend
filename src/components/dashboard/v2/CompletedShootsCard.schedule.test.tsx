import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardShootSummary } from '@/types/dashboard';
import { CompletedShootsCard } from './CompletedShootsCard';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const shoot = (overrides: Partial<DashboardShootSummary> = {}): DashboardShootSummary => ({
  id: 86,
  addressLine: '7319 Golden Horseshoe Court',
  clientName: 'Client',
  scheduledLocalDate: '2026-09-09',
  timeLabel: '10:00 AM',
  startTime: '2026-09-09T10:00:00.000000Z',
  ...overrides,
} as DashboardShootSummary);

describe('delivered shoot appointment label', () => {
  it.each(['America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'UTC'])(
    'renders the booked 10 AM time in %s',
    (timezone) => {
      vi.stubEnv('TZ', timezone);
      render(<CompletedShootsCard shoots={[shoot()]} />);

      expect(screen.getByText('Sep 9 • 10:00 AM')).toBeVisible();
      expect(screen.queryByText(/6:00 AM/)).not.toBeInTheDocument();
    },
  );

  it('renders explicit date/time labels even when startTime is absent', () => {
    render(<CompletedShootsCard shoots={[shoot({ startTime: null })]} />);
    expect(screen.getByText('Sep 9 • 10:00 AM')).toBeVisible();
  });

  it('keeps the booked day when the absolute instant crosses midnight', () => {
    render(<CompletedShootsCard shoots={[shoot({ timeLabel: '8:30 PM', startTime: '2026-09-10T00:30:00Z' })]} />);
    expect(screen.getByText('Sep 9 • 8:30 PM')).toBeVisible();
  });
});
