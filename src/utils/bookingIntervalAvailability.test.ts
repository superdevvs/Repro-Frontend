import { describe, expect, it } from 'vitest';
import { isBookingIntervalDisabled } from './bookingIntervalAvailability';

describe('whole-appointment availability', () => {
  it.each([30, 60, 90, 120])('checks %i minutes against a one-hour noon opening', durationMinutes => {
    expect(isBookingIntervalDisabled({ time: '12:00 PM', durationMinutes,
      availableSlots: [{ start_time: '12:00', end_time: '13:00' }],
    })).toBe(durationMinutes > 60);
  });

  it('keeps travel time on both sides of booked work and allows the exact boundary', () => {
    const bookedSlots = [{ start_time: '14:00', end_time: '15:00' }];
    expect(isBookingIntervalDisabled({ time: '12:00', durationMinutes: 90, bookedSlots })).toBe(false);
    expect(isBookingIntervalDisabled({ time: '12:00', durationMinutes: 120, bookedSlots })).toBe(true);
    expect(isBookingIntervalDisabled({ time: '15:15', durationMinutes: 30, bookedSlots })).toBe(true);
    expect(isBookingIntervalDisabled({ time: '15:30', durationMinutes: 30, bookedSlots })).toBe(false);
  });

  it('rejects an interval crossing a break or ending after working hours', () => {
    expect(isBookingIntervalDisabled({ time: '12:00', durationMinutes: 90,
      blocked: [{ start: '13:00', end: '14:00' }] })).toBe(true);
    expect(isBookingIntervalDisabled({ time: '16:00', durationMinutes: 90,
      workingWindow: { start: 9 * 60, end: 17 * 60 } })).toBe(true);
    expect(isBookingIntervalDisabled({ time: '12:00', durationMinutes: 60,
      unavailableSlots: [{ start_time: '13:00', end_time: '14:00' }] })).toBe(false);
  });
});
