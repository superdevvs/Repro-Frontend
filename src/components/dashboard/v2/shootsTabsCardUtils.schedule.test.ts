import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardShootSummary } from '@/types/dashboard';
import { defaultFilters, isShootInPast, matchesDateRange } from './shootsTabsCardUtils';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('dashboard scheduled-day filtering', () => {
  it('keeps a legacy midnight booking on its booked day in a western viewer timezone', () => {
    vi.stubEnv('TZ', 'America/New_York');
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 9, 15));
    const shoot = { startTime: '2026-09-09T00:30:00Z' } as DashboardShootSummary;

    expect(matchesDateRange(shoot, { ...defaultFilters, dateRange: 'today' })).toBe(true);
    expect(matchesDateRange(shoot, { ...defaultFilters, dateRange: 'next7' })).toBe(true);
    expect(isShootInPast(shoot)).toBe(false);
  });

  it('uses the New York market day when a shoot has no zone of its own', () => {
    vi.stubEnv('TZ', 'Asia/Kolkata');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-29T01:30:00+05:30'));

    expect(isShootInPast({
      scheduledLocalDate: '2026-09-28',
      startTime: '2026-09-28T14:00:00.000000Z',
    } as DashboardShootSummary)).toBe(false);
  });

  it('keeps today in the shoot timezone on the photographer dashboard after the viewer date rolls over', () => {
    vi.stubEnv('TZ', 'Asia/Kolkata');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-29T01:30:00+05:30'));

    expect(isShootInPast({
      scheduledLocalDate: '2026-09-28',
      scheduleTimezone: 'America/New_York',
      startTime: '2026-09-28T14:00:00.000000Z',
    } as DashboardShootSummary)).toBe(false);
  });

  it('includes the entire last booked day of a custom range', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    const shoot = {
      scheduledLocalDate: '2026-09-09',
      timeLabel: '23:30',
      startTime: '2026-09-10T03:30:00Z',
    } as DashboardShootSummary;

    expect(matchesDateRange(shoot, {
      ...defaultFilters,
      dateRange: 'custom',
      customRange: { from: '2026-09-09', to: '2026-09-09' },
    })).toBe(true);
  });
});
