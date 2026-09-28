import { describe, expect, it } from 'vitest';
import { isBookingTimeAvailable } from './bookShootAvailability';

describe('booking availability windows', () => {
  const workday = [{ start_time: '09:00:00', end_time: '19:00:00', status: 'available' }];

  it.each(['4:00 PM', '16:00', '16:00:00'])('allows %s within a workday, not just at its start', time => {
    expect(isBookingTimeAvailable(time, workday)).toBe(true);
  });

  it('keeps closed hours and the end of a window unavailable', () => {
    expect(isBookingTimeAvailable('08:59', workday)).toBe(false);
    expect(isBookingTimeAvailable('19:00', workday)).toBe(false);
    expect(isBookingTimeAvailable('invalid', workday)).toBe(false);
  });

  it.each(['booked', 'unavailable'])('does not treat a %s row as an available start', status => {
    const occupied = { start_time: '16:00', end_time: '17:00', status };
    expect(isBookingTimeAvailable('4:00 PM', [occupied])).toBe(false);
    expect(isBookingTimeAvailable('4:00 PM', [...workday, occupied])).toBe(false);
    expect(isBookingTimeAvailable('5:00 PM', [...workday, occupied])).toBe(true);
  });

  it('preserves gaps between separately returned ranges', () => {
    const slots = [{ start_time: '09:00', end_time: '12:00' }, { start_time: '14:00', end_time: '19:00' }];
    expect(isBookingTimeAvailable('12:00 PM', slots)).toBe(false);
    expect(isBookingTimeAvailable('02:00 PM', slots)).toBe(true);
  });
});
