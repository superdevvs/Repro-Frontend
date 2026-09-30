import { describe, expect, it } from 'vitest';

import { nextAutoFilledBookingTime } from './suggestedTimeSlots';

describe('nextAutoFilledBookingTime', () => {
  const suggested = ['9:00 AM', '9:15 AM', '12:00 PM'];

  it('fills an empty booking with the first suggested slot', () => {
    expect(nextAutoFilledBookingTime('', suggested)).toBe('9:00 AM');
    expect(nextAutoFilledBookingTime('   ', suggested)).toBe('9:00 AM');
    expect(nextAutoFilledBookingTime(null, suggested)).toBe('9:00 AM');
    expect(nextAutoFilledBookingTime(undefined, suggested)).toBe('9:00 AM');
  });

  it('does not replace a chosen time with 9:00 AM', () => {
    expect(nextAutoFilledBookingTime('11:50 PM', suggested)).toBeNull();
    expect(nextAutoFilledBookingTime('12:00 PM', suggested)).toBeNull();
    expect(nextAutoFilledBookingTime('23:50', suggested)).toBeNull();
  });

  it('does not invent a time when nothing is suggested', () => {
    expect(nextAutoFilledBookingTime('', [])).toBeNull();
    expect(nextAutoFilledBookingTime('', ['', '   '])).toBeNull();
  });
});
