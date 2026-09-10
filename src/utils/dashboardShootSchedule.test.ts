import { afterEach, describe, expect, it, vi } from 'vitest';
import { format } from 'date-fns';
import { transformDashboardOverview } from './dashboardTransformers';
import {
  formatDashboardShootSchedule,
  getDashboardShootDisplayDate,
  getDashboardShootDisplayTime,
  getDashboardShootStartInstantMs,
} from './dashboardShootSchedule';

afterEach(() => vi.unstubAllEnvs());

describe('dashboard booked schedule display', () => {
  it.each(['America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'UTC'])(
    'preserves the booked date and 10 AM time in %s',
    (timezone) => {
      vi.stubEnv('TZ', timezone);
      const summary = {
        scheduledLocalDate: '2026-09-09',
        timeLabel: '10:00:00',
        startTime: '2026-09-09T10:00:00.000000Z',
      };

      expect(formatDashboardShootSchedule(summary)).toBe('Sep 9 • 10:00 AM');
      expect(summary.startTime).toBe('2026-09-09T10:00:00.000000Z');
    },
  );

  it('prefers explicit local fields when an absolute instant has a different day and hour', () => {
    expect(formatDashboardShootSchedule({
      scheduledLocalDate: '2026-09-09',
      timeLabel: '8:30 PM',
      startTime: '2026-09-10T00:30:00Z',
    })).toBe('Sep 9 • 8:30 PM');
  });

  it.each(['America/New_York', 'Asia/Kolkata'])(
    'preserves literal legacy timestamp fields when labels are missing in %s',
    (timezone) => {
      vi.stubEnv('TZ', timezone);
      const summary = { startTime: '2026-09-09T00:30:00.000000Z' };

      expect(formatDashboardShootSchedule(summary)).toBe('Sep 9 • 12:30 AM');
      expect(getDashboardShootDisplayTime({ ...summary, scheduledLocalDate: '2026-09-09' })).toBe('00:30');
    },
  );

  it('does not invent a noon or midnight time when only the calendar day is known', () => {
    const summary = { scheduledLocalDate: '2026-09-09' };
    expect(getDashboardShootDisplayTime(summary)).toBeNull();
    expect(formatDashboardShootSchedule(summary)).toBe('Sep 9');
  });

  it('supports explicit labels without an absolute start timestamp', () => {
    expect(formatDashboardShootSchedule({ scheduledLocalDate: '2026-09-09', timeLabel: '15:45' }))
      .toBe('Sep 9 • 3:45 PM');
    expect(formatDashboardShootSchedule({ timeLabel: '10:00' })).toBe('10:00 AM');
  });

  it('rejects malformed schedules without throwing or displaying Invalid Date', () => {
    expect(formatDashboardShootSchedule({ startTime: 'not-a-date' })).toBeNull();
    expect(getDashboardShootDisplayDate({ scheduledLocalDate: '2026-02-30' })).toBeNull();
    expect(getDashboardShootDisplayTime({ startTime: '2026-09-09T25:70:00Z' })).toBeNull();
    const date = getDashboardShootDisplayDate({ scheduledLocalDate: '2026-09-09' });
    expect(date && format(date, 'yyyy-MM-dd')).toBe('2026-09-09');
  });

  it('uses the resolved instant for timed windows while preserving the booked display clock', () => {
    const summary = transformDashboardOverview({
      stats: { total_shoots: 1, scheduled_today: 0, flagged_shoots: 0, pending_reviews: 0 },
      upcoming_shoots: [{
        id: 86,
        time_label: '10:00',
        start_time: '2026-09-09T10:00:00Z',
        scheduled_instant: '2026-09-09T14:00:00Z',
        services: [],
        is_flagged: false,
      }],
      photographers: [],
      pending_reviews: [],
      activity_log: [],
      issues: [],
      workflow: { columns: [] },
    }).upcomingShoots[0];

    expect(getDashboardShootStartInstantMs(summary)).toBe(Date.parse('2026-09-09T14:00:00Z'));
    expect(formatDashboardShootSchedule(summary)).toBe('Sep 9 • 10:00 AM');
  });

  it('retains the old startTime fallback when the server has no resolved instant', () => {
    expect(getDashboardShootStartInstantMs({ startTime: '2026-09-09T14:00:00Z' }))
      .toBe(Date.parse('2026-09-09T14:00:00Z'));
    expect(getDashboardShootStartInstantMs({})).toBeNull();
  });
});
