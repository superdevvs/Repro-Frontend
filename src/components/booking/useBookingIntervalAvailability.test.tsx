import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useBookingIntervalAvailability } from './useBookingIntervalAvailability';

afterEach(cleanup);
type Options = Parameters<typeof useBookingIntervalAvailability>[0];
const service = (id: string, duration: number) => ({ id, name: id, price: 100, shoot_duration_minutes: duration });
const options = (overrides: Partial<Options> = {}): Options => ({
  selectedServices: [service('exterior', 15)], serviceSchedules: {}, servicePhotographers: {}, sqft: 1000,
  photographer: '9', defaultServiceDate: '2026-10-05', defaultServiceTime: '09:00',
  bookingAvailabilityDate: '2026-10-05', bookingAvailabilityTime: '09:00', availabilityDataDate: '2026-10-05',
  dayAvailability: null, workingWindowMinutes: null,
  getPhotographerScheduleData: () => ({ id: '9', name: 'Pat', availabilitySlots: [{ start_time: '09:00', end_time: '10:45' }] }),
  ...overrides,
});
describe('prospective capture duration for booking availability', () => {
  it('uses the exterior catalog15 and sums distinct services without multiplying packages or digital work', () => {
    const { result, rerender } = renderHook(useBookingIntervalAvailability, { initialProps: options() });
    expect(result.current.bookingAvailabilityDuration).toBe(15);
    rerender(options({ selectedServices: [service('exterior', 15), service('video', 30), { ...service('digital', 60), photographer_required: false }] }));
    expect(result.current.bookingAvailabilityDuration).toBe(45);
    rerender(options({ selectedServices: [service('package', 90), service('package', 90)] }));
    expect(result.current.bookingAvailabilityDuration).toBe(90);
  });
  it('joins the destination services when moving one service without carrying source-time peers', () => {
    const base = options({ selectedServices: [service('moving', 15), service('old-peer', 90), service('destination', 30)],
      serviceSchedules: { moving: { time: '09:00' }, 'old-peer': { time: '09:00' }, destination: { time: '10:00' } } });
    const { result, rerender } = renderHook(useBookingIntervalAvailability, { initialProps: base });
    expect(result.current.isPhotographerTimeDisabled('9', '10:00', 'moving')).toBe(false); // 15 + 30 fits exactly.
    rerender({ ...base, getPhotographerScheduleData: () => ({ id: '9', name: 'Pat', availabilitySlots: [{ start_time: '09:00', end_time: '10:40' }] }) });
    expect(result.current.isPhotographerTimeDisabled('9', '10:00', 'moving')).toBe(true); // The moving15 alone would fit.
    rerender({ ...base, pickerServiceId: 'moving', bookingAvailabilityTime: '10:00', serviceSchedules: { ...base.serviceSchedules, moving: { time: '10:00' } } });
    expect(result.current.bookingAvailabilityDuration).toBe(45); // Same value sent to availability API after selection.
  });
  it('moves inherited main-slot services together while explicit schedules and other photographers stay separate', () => {
    const props = options({ selectedServices: [service('first', 15), service('second', 15), service('explicit-old', 90), service('explicit-new', 15), service('other-photo', 90)],
      serviceSchedules: { 'explicit-old': { time: '09:00' }, 'explicit-new': { time: '10:00' } },
      servicePhotographers: { 'other-photo': '10' } });
    const { result } = renderHook(() => useBookingIntervalAvailability(props));
    expect(result.current.isPhotographerTimeDisabled('9', '10:00')).toBe(false);
    expect(result.current.isPhotographerTimeDisabled('9', '10:20')).toBe(true); // inherited30 no longer fits the opening.
  });
});
