import { describe, expect, it } from 'vitest';
import { bookingTimeToMinutes, slotCoversBookingTime } from './bookShootAvailabilityMatch';

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
