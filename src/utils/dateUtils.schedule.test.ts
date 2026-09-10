import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { filterShootsByDateRange, getScheduledTodayShoots } from './dateUtils';

describe('booked calendar day filters', () => {
  afterEach(() => vi.useRealTimers());

  it('includes today even when the API date has a UTC midnight suffix', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 9, 12));
    const shoots = [
      { id: 'today', scheduledDate: '2026-09-09T00:00:00.000000Z' },
      { id: 'tomorrow', scheduledDate: '2026-09-10T00:00:00.000000Z' },
    ] as ShootData[];
    expect(getScheduledTodayShoots(shoots).map(shoot => shoot.id)).toEqual(['today']);
    expect(filterShootsByDateRange(shoots, 'day').map(shoot => shoot.id)).toEqual(['today']);
  });
});
