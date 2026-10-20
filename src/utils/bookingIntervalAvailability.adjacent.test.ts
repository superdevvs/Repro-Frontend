import { expect, it } from 'vitest';
import { isBookingIntervalDisabled } from './bookingIntervalAvailability';
const slots = [{ start_time: '17:00', end_time: '18:00' }, { start_time: '09:00', end_time: '17:00' }];
it('allows a 35 minute appointment crossing adjacent working-hour rows', () => {
  expect(isBookingIntervalDisabled({ time: '16:30', durationMinutes: 35, availableSlots: slots })).toBe(false);
});
it('retains actual gaps, unavailable blocks and existing bookings', () => {
  expect(isBookingIntervalDisabled({ time: '16:30', durationMinutes: 35, availableSlots: [{ start_time: '09:00', end_time: '17:00' }, { start_time: '17:01', end_time: '18:00' }] })).toBe(true);
  expect(isBookingIntervalDisabled({ time: '16:30', durationMinutes: 35, availableSlots: slots, unavailableSlots: [{ start_time: '17:00', end_time: '17:01' }] })).toBe(true);
  expect(isBookingIntervalDisabled({ time: '16:30', durationMinutes: 35, availableSlots: slots, bookedSlots: [{ start_time: '17:00', end_time: '17:35' }], travelBufferMinutes: 0 })).toBe(true);
});
