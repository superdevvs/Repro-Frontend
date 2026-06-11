// Property-based test for the multi-service Booking_Summary schedule labels.
//
// Feature: booking-scheduling-fixes, Property 12: Multi-service summary shows
// each service's formatted date and time.
// Validates: Requirements 9.1, 9.2
//
// For an arbitrary set of selected services each carrying its own per-service
// schedule, the Booking_Summary renders, for every service, that service's own
// date and its 12-hour-formatted time. Each service's time is preserved
// independently of the others (no cross-contamination between rows).

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { format } from 'date-fns';

import { getServiceScheduleLabel, type ServiceScheduleMap } from './serviceScheduleLabel';
import { formatTimeForDisplay } from './availabilityUtils';

// Canonical "HH:mm" from minutes-since-midnight (0..1439).
function minutesToCanonical(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// A date string with no " at " token so the label can be split unambiguously.
const dateArb = fc
  .date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-12-31T00:00:00Z'), noInvalidDate: true })
  .map((d) => format(d, 'yyyy-MM-dd'));

// A set of services, each with a UNIQUE minute-of-day so distinct services have
// distinct formatted times — this makes cross-contamination observable.
const serviceSetArb = fc
  .uniqueArray(fc.integer({ min: 0, max: 1439 }), { minLength: 1, maxLength: 8 })
  .chain((minutes) =>
    fc.tuple(
      ...minutes.map((minuteOfDay, index) =>
        dateArb.map((date) => ({
          id: `svc-${index}`,
          date,
          time: minutesToCanonical(minuteOfDay),
        })),
      ),
    ),
  );

describe('Feature: booking-scheduling-fixes, Property 12: Multi-service summary shows each service formatted date and time', () => {
  it('renders every service own date and Time_Formatter-formatted time with no cross-contamination', () => {
    fc.assert(
      fc.property(serviceSetArb, dateArb, fc.constantFrom('08:00', '10:15', '13:45'), (services, fallbackDate, fallbackTime) => {
        const schedules: ServiceScheduleMap = {};
        for (const svc of services) {
          schedules[svc.id] = { date: svc.date, time: svc.time };
        }

        for (const svc of services) {
          const label = getServiceScheduleLabel(svc.id, schedules, fallbackDate, fallbackTime);
          const expectedTime = formatTimeForDisplay(svc.time);

          // The label shows this service's own date and 12-hour time.
          expect(label).toBe(`${svc.date} at ${expectedTime}`);

          // Structurally: date part and time part are this service's own values,
          // never another service's (independent preservation).
          const [datePart, timePart] = label.split(' at ');
          expect(datePart).toBe(svc.date);
          expect(timePart).toBe(expectedTime);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('falls back to the booking-level date/time only when a service has no own schedule', () => {
    fc.assert(
      fc.property(serviceSetArb, dateArb, fc.constantFrom('07:00', '09:30', '11:30'), (services, fallbackDate, fallbackTime) => {
        // No per-service schedules: every service must surface the booking-level
        // (fallback) date and formatted time.
        const emptySchedules: ServiceScheduleMap = {};
        const expectedTime = formatTimeForDisplay(fallbackTime);
        for (const svc of services) {
          const label = getServiceScheduleLabel(svc.id, emptySchedules, fallbackDate, fallbackTime);
          expect(label).toBe(`${fallbackDate} at ${expectedTime}`);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('matches the Shoot #2 canonical example (2D Floor Plan 09:30 -> 9:30 AM, HDR 11:30 -> 11:30 AM)', () => {
    const schedules: ServiceScheduleMap = {
      'floor-plan': { date: '2026-05-19', time: '09:30' },
      hdr: { date: '2026-05-19', time: '11:30' },
    };
    expect(getServiceScheduleLabel('floor-plan', schedules)).toBe('2026-05-19 at 9:30 AM');
    expect(getServiceScheduleLabel('hdr', schedules)).toBe('2026-05-19 at 11:30 AM');
  });
});
