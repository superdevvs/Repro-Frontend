import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DashboardShootSummary } from '@/types/dashboard';

import { filterEditingManagerUpcomingShoots } from './dashboardDerivedUtils';

afterEach(() => {
  vi.useRealTimers();
});

const shoot = (overrides: Partial<DashboardShootSummary>): DashboardShootSummary =>
  ({
    id: 63,
    addressLine: '11 Wall Street',
    status: 'editing',
    workflowStatus: 'editing',
    scheduledLocalDate: '2026-07-01',
    startTime: '2026-07-01T14:30:00Z',
    services: [],
    isFlagged: false,
    ...overrides,
  }) as DashboardShootSummary;

describe('filterEditingManagerUpcomingShoots', () => {
  it('matches the superadmin upcoming list: today or future active shoots', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 21, 12));

    const shoots = [
      shoot({
        id: 91,
        addressLine: '5629 Herberts Crossing Drive',
        status: 'scheduled',
        workflowStatus: 'scheduled',
        scheduledLocalDate: '2026-10-05',
        startTime: '2026-10-05T14:00:00Z',
      }),
      shoot({
        id: 63,
        status: 'editing',
        workflowStatus: 'editing',
        scheduledLocalDate: '2026-07-01',
        startTime: '2026-07-01T14:30:00Z',
      }),
      shoot({
        id: 89,
        status: 'delivered',
        workflowStatus: 'delivered',
        scheduledLocalDate: '2026-09-14',
        startTime: '2026-09-14T12:00:00Z',
      }),
    ];

    expect(filterEditingManagerUpcomingShoots(shoots).map((item) => item.id)).toEqual([91]);
  });

  it('keeps a shoot booked for today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 21, 8));

    const todayShoot = shoot({
      id: 95,
      status: 'scheduled',
      workflowStatus: 'scheduled',
      scheduledLocalDate: '2026-09-21',
      startTime: '2026-09-21T16:00:00Z',
    });

    expect(filterEditingManagerUpcomingShoots([todayShoot]).map((item) => item.id)).toEqual([95]);
  });

  it('excludes requested and cancelled shoots even if they are in the future', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 21, 12));

    const shoots = [
      shoot({
        id: 96,
        status: 'requested',
        workflowStatus: 'requested',
        scheduledLocalDate: '2026-10-10',
        startTime: '2026-10-10T14:00:00Z',
      }),
      shoot({
        id: 97,
        status: 'cancelled',
        workflowStatus: 'cancelled',
        scheduledLocalDate: '2026-10-12',
        startTime: '2026-10-12T14:00:00Z',
      }),
    ];

    expect(filterEditingManagerUpcomingShoots(shoots)).toEqual([]);
  });
});
