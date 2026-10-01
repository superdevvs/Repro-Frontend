import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DashboardShootSummary } from '@/types/dashboard';

import { filterEditingManagerUpcomingShoots, filterReadyToDeliverShoots, filterUploadedShoots } from './dashboardDerivedUtils';

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
  it('carries earlier unbucketed work while leaving uploaded and ready work in their own workflow buckets', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T16:00:00Z'));
    const items = ['scheduled', 'booked', 'confirmed', 'in_field', 'raw_upload_pending', 'uploaded', 'editing', 'ready', 'delivered', 'cancelled']
      .map((status, index) => shoot({ id: index + 1, status, workflowStatus: status, scheduledLocalDate: '2026-09-30' }));
    expect(filterEditingManagerUpcomingShoots(items).map((item) => item.workflowStatus))
      .toEqual(['scheduled', 'booked', 'confirmed', 'in_field', 'raw_upload_pending', 'editing']);
  });

  it('keeps older open editing work alongside future shoots while excluding past delivery', () => {
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

    expect(filterEditingManagerUpcomingShoots(shoots).map((item) => item.id)).toEqual([63, 91]);
  });

  it('keeps every earlier unfinished stage in exactly one of the three workflow buckets', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T16:00:00Z'));
    const open = ['scheduled', 'booked', 'confirmed', 'in_field', 'raw_upload_pending', 'editing', 'review', 'qc', 'pending_review', 'awaiting_review', 'ready_for_review', 'on_hold', 'raw_issue', 'editing_issue', 'uploaded', 'photos_uploaded', 'raw_uploaded', 'completed', 'editing_complete', 'ready'];
    const closed = ['delivered', 'finalized', 'ready_for_client', 'client_delivered', 'delivered_to_client', 'admin_verified', 'workflow_completed', 'archived', 'cancelled', 'canceled', 'declined', 'requested', 'no_show'];
    const items = [...open, ...closed].map((status, index) => shoot({ id: index + 1, status, workflowStatus: status, scheduledLocalDate: '2026-09-30' }));
    const upcoming = filterEditingManagerUpcomingShoots(items);
    const uploaded = filterUploadedShoots(items);
    const ready = filterReadyToDeliverShoots(items);
    const union = [...upcoming, ...uploaded, ...ready];
    expect(union.map((item) => item.workflowStatus).sort()).toEqual([...open].sort());
    expect(new Set(union.map((item) => item.id)).size).toBe(union.length);
    expect(upcoming.map((item) => item.workflowStatus)).toEqual(expect.arrayContaining(['editing', 'review', 'qc', 'pending_review', 'on_hold']));
    expect(uploaded.map((item) => item.workflowStatus)).toEqual(['uploaded', 'photos_uploaded', 'raw_uploaded', 'completed', 'editing_complete']);
    expect(ready.map((item) => item.workflowStatus)).toEqual(['ready']);
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
