import { describe, expect, it } from 'vitest';
import { getShootSchedule } from './shootSchedule';

describe('getShootSchedule', () => {
  it('keeps shoot 86 at its booked local day and 10 AM despite UTC casts', () => {
    expect(getShootSchedule({
      scheduled_date: '2026-09-09T00:00:00.000000Z', time: '10:00:00',
      scheduled_at: '2026-09-09T10:00:00.000000Z', timezone: null,
    })).toEqual({ date: '2026-09-09', time: '10:00' });
  });

  it.each(['2026-09-09T10:00:00.000000Z', '2026-09-09 10:00:00', '2026-09-09T10:00:00-04:00'])(
    'preserves legacy clock fields when only scheduled_at is available: %s', scheduled_at => {
      expect(getShootSchedule({ scheduled_at })).toEqual({ date: '2026-09-09', time: '10:00' });
    },
  );

  it.each([
    ['2026-09-09T14:00:00Z', 'America/New_York', '2026-09-09', '10:00'],
    ['2026-01-09T15:00:00Z', 'America/New_York', '2026-01-09', '10:00'],
    ['2026-09-10T02:30:00Z', 'America/Los_Angeles', '2026-09-09', '19:30'],
    ['2026-09-09T18:30:00Z', 'Asia/Kolkata', '2026-09-10', '00:00'],
    ['2026-09-09 14:00:00', 'America/New_York', '2026-09-09', '10:00'],
  ])('resolves zoned bookings in their own zone (%s, %s)', (scheduledAt, timezone, date, time) => {
    expect(getShootSchedule({ scheduledAt, timezone })).toEqual({ date, time });
  });

  it('preserves canonical fields over a stale timestamp', () => {
    expect(getShootSchedule({
      scheduledDate: '2026-09-10', time: '12:30 PM',
      scheduledAt: '2026-09-09T14:00:00Z', timezone: 'America/New_York',
    })).toEqual({ date: '2026-09-10', time: '12:30' });
  });

  it('keeps midnight and handles missing or invalid data without inventing noon', () => {
    expect(getShootSchedule({ scheduledDate: '2026-09-09', time: '12:00 AM' }))
      .toEqual({ date: '2026-09-09', time: '00:00' });
    expect(getShootSchedule({ time: '25:75' })).toEqual({ date: '', time: '' });
    expect(getShootSchedule({ scheduledAt: 'invalid' })).toEqual({ date: '', time: '' });
    expect(getShootSchedule()).toEqual({ date: '', time: '' });
  });

  it('does not fall back to viewer conversion for an invalid zone', () => {
    expect(getShootSchedule({ scheduledAt: '2026-09-09T10:00:00Z', timezone: 'Invalid/Zone' }))
      .toEqual({ date: '2026-09-09', time: '10:00' });
  });
});
