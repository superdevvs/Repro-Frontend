// Property-based + unit tests for canonical time round-tripping through the
// display layer.
//
// Feature: booking-scheduling-fixes, Property 15: Stored times round-trip in
// canonical form.
//
// Validates: Requirements 12.3
//
// Design intent (Property 15): canonical times are stored UNFORMATTED
// (`HH:mm` or `HH:mm:ss`) and are only formatted at display via
// `formatTimeForDisplay`. No formatted (12-hour) string is ever persisted. This
// test exercises the round-trip at the display boundary: a canonical stored
// time, when formatted for display (`formatTimeForDisplay`) and then parsed back
// to 24-hour form (`to24Hour`), returns the SAME canonical wall-clock value with
// no drift.
//
//   - For arbitrary canonical `HH:mm`: format -> to24Hour === the same `HH:mm`.
//   - For arbitrary canonical `HH:mm:ss`: format -> to24Hour === its `HH:mm`
//     wall-clock prefix (seconds are presentation-irrelevant and truncate
//     cleanly, never shifting the hour/minute).
//
// The helpers are string-based and timezone-safe (they never construct a Date),
// so the wall-clock value is preserved regardless of host timezone.
//
// This lives in a DISTINCT file from the Property 1/2/3 formatter tests so the
// task outputs never overwrite one another.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { formatTimeForDisplay, to24Hour } from '@/utils/availabilityUtils';

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Round-trip a canonical wall-clock time through the display layer:
 * canonical -> formatted (12-hour) -> back to canonical 24-hour `HH:mm`.
 */
function roundTrip(canonical: string): string {
  return to24Hour(formatTimeForDisplay(canonical));
}

describe('Feature: booking-scheduling-fixes, Property 15: Stored times round-trip in canonical form', () => {
  it('round-trips every canonical HH:mm value back to the identical HH:mm (no drift)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        (hours, minutes) => {
          const canonical = `${pad2(hours)}:${pad2(minutes)}`;
          expect(roundTrip(canonical)).toBe(canonical);
        },
      ),
    );
  });

  it('round-trips every canonical HH:mm:ss value to its HH:mm wall-clock prefix (seconds truncate without drift)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 }),
        (hours, minutes, seconds) => {
          const wallClock = `${pad2(hours)}:${pad2(minutes)}`;
          const canonical = `${wallClock}:${pad2(seconds)}`;
          // The seconds component is presentation-irrelevant: formatting and
          // parsing back must yield the same HH:mm wall clock, never shifting it.
          expect(roundTrip(canonical)).toBe(wallClock);
        },
      ),
    );
  });

  it('round-trips the known persisted Shoot #1 canonical time 07:00:00 without drift', () => {
    expect(roundTrip('07:00:00')).toBe('07:00');
    expect(roundTrip('07:00')).toBe('07:00');
  });

  it('round-trips the known persisted Shoot #2 per-service canonical times without drift', () => {
    expect(roundTrip('09:30')).toBe('09:30');
    expect(roundTrip('09:30:00')).toBe('09:30');
    expect(roundTrip('11:30')).toBe('11:30');
    expect(roundTrip('11:30:00')).toBe('11:30');
  });

  it('preserves the wall-clock value at the midnight/noon boundaries where a Date-based round-trip would drift across timezones', () => {
    expect(roundTrip('00:00')).toBe('00:00');
    expect(roundTrip('00:00:00')).toBe('00:00');
    expect(roundTrip('12:00')).toBe('12:00');
    expect(roundTrip('12:00:00')).toBe('12:00');
    expect(roundTrip('23:59')).toBe('23:59');
    expect(roundTrip('23:59:59')).toBe('23:59');
  });

  it('never persists a formatted (12-hour) string: the formatted output is purely a display projection', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        (hours, minutes) => {
          const canonical = `${pad2(hours)}:${pad2(minutes)}`;
          const formatted = formatTimeForDisplay(canonical);
          // The display projection contains an AM/PM marker; the canonical
          // stored form never does. They are distinct representations.
          expect(/\s(AM|PM)$/.test(formatted)).toBe(true);
          expect(/\s(AM|PM)$/.test(canonical)).toBe(false);
          // And the projection is reversible back to the canonical wall clock.
          expect(to24Hour(formatted)).toBe(canonical);
        },
      ),
    );
  });
});
