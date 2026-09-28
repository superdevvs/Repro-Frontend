import { describe, expect, it } from 'vitest';
import { compareShootLocalTimes, paginateShootDayGroups } from './shootsTabsCardUtils';
import type { DashboardShootSummary } from '@/types/dashboard';

describe('dashboard day pagination', () => {
  const today = { label: 'Today', isToday: true, shoots: Array.from({ length: 9 }, (_, i) => i + 1) };
  const tomorrow = { label: 'Tomorrow', isToday: false, shoots: [10, 11, 12, 13, 14] };

  it('shows all nine today with a five-card initial budget', () => {
    expect(paginateShootDayGroups([today, tomorrow], 5)).toEqual({
      paginatedGroups: [today], totalShootsCount: 14, hasMore: true,
    });
  });

  it('loads the complete next day instead of labeling a partial slice as its total', () => {
    expect(paginateShootDayGroups([today, tomorrow], 10)).toEqual({
      paginatedGroups: [today, tomorrow], totalShootsCount: 14, hasMore: false,
    });
  });

  it('keeps today visible when previous-day groups consume the initial budget', () => {
    const previous = { label: 'Yesterday', isToday: false, shoots: [20, 21, 22, 23, 24] };
    expect(paginateShootDayGroups([previous, today, tomorrow], 5).paginatedGroups).toEqual([previous, today]);
  });

  it('handles empty lists without a load-more affordance', () => {
    expect(paginateShootDayGroups([], 5)).toEqual({ paginatedGroups: [], totalShootsCount: 0, hasMore: false });
  });

  it('orders existing and migrated appointments by their displayed local times', () => {
    const appointments = [
      { id: 98, startTime: '2026-09-28T10:00:00Z', timeLabel: '10:00' },
      { id: 160, startTime: '2026-09-28T18:00:00Z', timeLabel: '14:00' },
      { id: 155, startTime: '2026-09-28T13:30:00Z', timeLabel: '09:30' },
      { id: 139, startTime: '2026-09-28T14:00:00Z', timeLabel: '10:00' },
      { id: 161, startTime: '2026-09-28T16:00:00Z', timeLabel: '12:00' },
    ] as DashboardShootSummary[];
    expect(appointments.sort(compareShootLocalTimes).map(shoot => shoot.id)).toEqual([155, 98, 139, 161, 160]);
  });
});
