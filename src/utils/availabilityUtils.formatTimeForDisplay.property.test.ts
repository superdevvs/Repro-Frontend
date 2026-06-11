// Property-based + unit test for `formatTimeForDisplay` (the Time_Formatter).
//
// Feature: booking-scheduling-fixes, Property 1: Canonical time formats to
// 12-hour wall clock.
//
// Asserts that canonical `HH:mm` and `HH:mm:ss` inputs format to the correct
// 12-hour wall-clock string regardless of host timezone, including the known
// persisted Shoot #1 canonical time `07:00:00` -> `7:00 AM`.
//
// The formatter is string-based and never constructs a Date, so the wall-clock
// hour/minute is preserved no matter what timezone the host runs in. The tests
// below exercise that contract directly (pure string reference) and pin the
// midnight/noon boundaries where a Date-based formatter would drift across
// timezones.
//
// Validates: Requirements 1.2, 1.3, 1.6, 1.8

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { formatTimeForDisplay } from '@/utils/availabilityUtils';

/**
 * Pure, timezone-independent reference: the wall-clock 12-hour rendering of a
 * 24-hour hour/minute pair. Mirrors the wall-clock semantics the Time_Formatter
 * must preserve without ever consulting a timezone.
 */
function expected12Hour(hours: number, minutes: number): string {
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

describe('Feature: booking-scheduling-fixes, Property 1: Canonical time formats to 12-hour wall clock', () => {
  it('formats every canonical HH:mm value to the correct 12-hour wall-clock string', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        (hours, minutes) => {
          const canonical = `${pad2(hours)}:${pad2(minutes)}`;
          expect(formatTimeForDisplay(canonical)).toBe(expected12Hour(hours, minutes));
        },
      ),
    );
  });

  it('formats every canonical HH:mm:ss value to the same 12-hour string as its HH:mm prefix (seconds are wall-clock irrelevant)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 }),
        (hours, minutes, seconds) => {
          const canonical = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
          expect(formatTimeForDisplay(canonical)).toBe(expected12Hour(hours, minutes));
        },
      ),
    );
  });

  it('preserves the wall-clock hour at the midnight/noon boundaries where a Date-based formatter would drift across timezones', () => {
    // A timezone-shifting (Date-based) implementation would render these
    // differently depending on the host TZ. A string-based formatter is stable.
    expect(formatTimeForDisplay('00:00')).toBe('12:00 AM');
    expect(formatTimeForDisplay('00:00:00')).toBe('12:00 AM');
    expect(formatTimeForDisplay('12:00')).toBe('12:00 PM');
    expect(formatTimeForDisplay('12:00:00')).toBe('12:00 PM');
    expect(formatTimeForDisplay('23:59')).toBe('11:59 PM');
    expect(formatTimeForDisplay('23:59:59')).toBe('11:59 PM');
  });

  it('displays the known persisted Shoot #1 canonical time 07:00:00 as 7:00 AM (Req 1.8)', () => {
    expect(formatTimeForDisplay('07:00:00')).toBe('7:00 AM');
    expect(formatTimeForDisplay('07:00')).toBe('7:00 AM');
  });

  it('displays the known persisted Shoot #2 per-service canonical times in 12-hour form', () => {
    expect(formatTimeForDisplay('09:30')).toBe('9:30 AM');
    expect(formatTimeForDisplay('09:30:00')).toBe('9:30 AM');
    expect(formatTimeForDisplay('11:30')).toBe('11:30 AM');
    expect(formatTimeForDisplay('11:30:00')).toBe('11:30 AM');
  });
});
