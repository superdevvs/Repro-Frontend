import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardShootSummary } from '@/types/dashboard';
import { isEarlierUnfinishedShoot, partitionEarlierShoots, useEarlierShoots } from './earlierUnfinishedShoots';

const now = new Date('2026-10-01T16:00:00Z');
const shoot = (overrides: Partial<DashboardShootSummary> = {}): DashboardShootSummary => ({
  id: 1, dayLabel: 'Sep 30', scheduledLocalDate: '2026-09-30', scheduleTimezone: 'America/New_York',
  timeLabel: '14:00', startTime: null, addressLine: '10 Cedar Lane', cityStateZip: 'Baltimore, MD',
  status: 'scheduled', workflowStatus: 'scheduled', clientName: null, services: [], isFlagged: false, ...overrides,
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('earlier unfinished dashboard work', () => {
  it.each(['admin', 'super_admin', 'editing_manager', 'salesRep', 'photographer', 'editor'])('retains past work for %s until finalized', role => {
    expect(isEarlierUnfinishedShoot(shoot(), role, now)).toBe(true);
    expect(isEarlierUnfinishedShoot(shoot({ workflowStatus: 'completed' }), role, now)).toBe(true);
    expect(isEarlierUnfinishedShoot(shoot({ workflowStatus: 'ready', completedAt: '2026-09-30T19:00:00Z' }), role, now)).toBe(true);
    expect(isEarlierUnfinishedShoot(shoot({ scheduledLocalDate: '2025-01-01' }), role, now)).toBe(true);
  });
  it.each(['client', undefined, 'unknown'])('does not change %s visibility', role => {
    const items = [shoot()];
    expect(partitionEarlierShoots(items, role, now)).toEqual({ earlier: [], remaining: items });
  });
  it.each(['delivered', 'delivered_to_client', 'ready_for_client', 'admin_verified', 'client_delivered', 'workflow_completed', 'cancelled', 'canceled', 'declined', 'finalized', 'requested', 'draft'])('excludes %s', workflowStatus => {
    expect(isEarlierUnfinishedShoot(shoot({ workflowStatus }), 'admin', now)).toBe(false);
  });
  it('keeps only the assigned unfinished editor lane after partial delivery', () => {
    const partial = shoot({ workflowStatus: 'delivered', hasPendingEditorWork: true });
    expect(isEarlierUnfinishedShoot(partial, 'editor', now)).toBe(true);
    expect(isEarlierUnfinishedShoot(partial, 'admin', now)).toBe(false);
    expect(isEarlierUnfinishedShoot({ ...partial, hasPendingEditorWork: false }, 'editor', now)).toBe(false);
    expect(isEarlierUnfinishedShoot({ ...partial, workflowStatus: 'ready_for_client' }, 'editor', now)).toBe(true);
    expect(isEarlierUnfinishedShoot({ ...partial, workflowStatus: 'cancelled' }, 'editor', now)).toBe(false);
  });
  it('uses the booked market day even when UTC has crossed midnight', () => {
    const midnightUtc = new Date('2026-10-01T02:00:00Z');
    expect(isEarlierUnfinishedShoot(shoot(), 'admin', midnightUtc)).toBe(false);
    expect(isEarlierUnfinishedShoot(shoot({ scheduledLocalDate: '2026-09-29' }), 'admin', midnightUtc)).toBe(true);
    expect(isEarlierUnfinishedShoot(shoot({ scheduledLocalDate: '2026-10-01' }), 'admin', now)).toBe(false);
  });
  it('partitions without duplicates and orders recent days first', () => {
    const items = [shoot({ id: 2, scheduledLocalDate: '2026-09-20' }), shoot(), shoot({ id: 3, scheduledLocalDate: '2026-10-01' })];
    const result = partitionEarlierShoots(items, 'admin', now);
    expect(result.earlier.map(item => item.id)).toEqual([1, 2]);
    expect(result.remaining.map(item => item.id)).toEqual([3]);
    expect(items.map(item => item.id)).toEqual([2, 1, 3]);
  });
  it('moves yesterday work automatically at market midnight without a new API response', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T03:59:30Z'));
    const items = [shoot()];
    const { result } = renderHook(() => useEarlierShoots(items, 'admin'));
    expect(result.current.earlier).toHaveLength(0);
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.earlier).toHaveLength(1);
  });
});
