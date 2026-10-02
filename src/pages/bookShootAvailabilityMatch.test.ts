import { describe, expect, it } from 'vitest';
import { bookingTimeToMinutes, slotCoversBookingTime, resolveBookingAvailabilityRows } from './bookShootAvailabilityMatch';

describe('bookShootAvailabilityMatch', () => {
  it('parses 12h and 24h booking times', () => {
    expect(bookingTimeToMinutes('10:00 AM')).toBe(600);
    expect(bookingTimeToMinutes('10:00')).toBe(600);
    expect(bookingTimeToMinutes('2:30 PM')).toBe(870);
    expect(bookingTimeToMinutes('bogus')).toBeNull();
  });

  it('treats Lee-style morning window as covering 10:00 (not only exact start)', () => {
    const leeThursday = { start_time: '08:00', end_time: '16:30', status: 'available' };
    expect(slotCoversBookingTime(leeThursday, bookingTimeToMinutes('10:00 AM')!)).toBe(true);
    expect(slotCoversBookingTime(leeThursday, bookingTimeToMinutes('08:00')!)).toBe(true);
    expect(slotCoversBookingTime(leeThursday, bookingTimeToMinutes('16:30')!)).toBe(false);
    expect(slotCoversBookingTime(leeThursday, bookingTimeToMinutes('07:59')!)).toBe(false);
  });

  it('ignores unavailable overrides', () => {
    expect(slotCoversBookingTime(
      { start_time: '08:00', end_time: '16:30', status: 'unavailable' },
      600,
    )).toBe(false);
  });
});


describe('resolveBookingAvailabilityRows', () => {
  it('falls back to weekly when dated rows are only unavailable overrides', () => {
    const rows = [
      { date: '2026-10-07', day_of_week: 'wednesday', start_time: '09:00', end_time: '12:30', status: 'unavailable' },
      { date: null, day_of_week: 'wednesday', start_time: '09:00', end_time: '17:00', status: 'available' },
    ];
    const resolved = resolveBookingAvailabilityRows(rows, '2026-10-07', 'wednesday');
    expect(resolved.some((r) => (r.status ?? 'available') === 'available' && r.start_time === '09:00' && r.end_time === '17:00')).toBe(true);
    expect(resolved.some((r) => r.status === 'unavailable')).toBe(true);
  });

  it('prefers dated available windows over weekly', () => {
    const rows = [
      { date: '2026-10-06', day_of_week: 'tuesday', start_time: '10:00', end_time: '14:00', status: 'available' },
      { date: null, day_of_week: 'tuesday', start_time: '09:00', end_time: '17:00', status: 'available' },
    ];
    const resolved = resolveBookingAvailabilityRows(rows, '2026-10-06', 'tuesday');
    const available = resolved.filter((r) => (r.status ?? 'available') === 'available');
    expect(available).toHaveLength(1);
    expect(available[0].start_time).toBe('10:00');
  });
});
