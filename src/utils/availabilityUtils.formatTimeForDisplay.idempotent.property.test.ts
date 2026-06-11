// Property-based + unit tests for `formatTimeForDisplay` (the Time_Formatter).
//
// Feature: booking-scheduling-fixes, Property 2: Formatting is idempotent and
// non-corrupting.
// Feature: booking-scheduling-fixes, Property 3: Empty/undefined times yield the
// placeholder.
//
// Property 2 (Validates: Requirements 1.4): feeding an already-formatted
// 12-hour string back through the Time_Formatter returns an equivalent 12-hour
// string without corrupting it. More strongly, the formatter is idempotent:
// applying it twice yields the same result as applying it once, so re-rendering
// a value that has already been formatted never drifts or double-formats.
//
// Property 3 (Validates: Requirements 1.5): null, undefined, empty, and
// whitespace-only inputs all return the defined NO_TIME_PLACEHOLDER rather than
// throwing.
//
// These properties live in a DISTINCT file from Property 1
// (availabilityUtils.formatTimeForDisplay.property.test.ts) so the two task
// outputs do not overwrite one another.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { NO_TIME_PLACEHOLDER, formatTimeForDisplay } from '@/utils/availabilityUtils';

const pad2 = (n: number) => String(n).padStart(2, '0');

describe('Feature: booking-scheduling-fixes, Property 2: Formatting is idempotent and non-corrupting', () => {
  it('is idempotent: formatting an already-formatted value yields the same value (canonical HH:mm inputs)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        (hours, minutes) => {
          const canonical = `${pad2(hours)}:${pad2(minutes)}`;
          const once = formatTimeForDisplay(canonical);
          const twice = formatTimeForDisplay(once);
          expect(twice).toBe(once);
        },
      ),
    );
  });

  it('is idempotent: formatting an already-formatted value yields the same value (canonical HH:mm:ss inputs)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 }),
        (hours, minutes, seconds) => {
          const canonical = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
          const once = formatTimeForDisplay(canonical);
          const twice = formatTimeForDisplay(once);
          expect(twice).toBe(once);
        },
      ),
    );
  });

  it('does not corrupt a value already in 12-hour form: it is returned unchanged (Req 1.4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        (hours, minutes) => {
          const period = hours >= 12 ? 'PM' : 'AM';
          const hours12 = hours % 12 || 12;
          const formatted = `${hours12}:${pad2(minutes)} ${period}`;
          // An already-formatted 12-hour string must pass through unchanged.
          expect(formatTimeForDisplay(formatted)).toBe(formatted);
        },
      ),
    );
  });

  it('keeps the known persisted display values stable under re-formatting', () => {
    // Shoot #1 07:00:00 -> 7:00 AM; Shoot #2 09:30/11:30.
    for (const formatted of ['7:00 AM', '9:30 AM', '11:30 AM', '12:00 PM', '12:00 AM']) {
      expect(formatTimeForDisplay(formatted)).toBe(formatted);
    }
  });
});

describe('Feature: booking-scheduling-fixes, Property 3: Empty/undefined times yield the placeholder', () => {
  it('returns the placeholder for null and undefined (Req 1.5)', () => {
    expect(formatTimeForDisplay(null)).toBe(NO_TIME_PLACEHOLDER);
    expect(formatTimeForDisplay(undefined)).toBe(NO_TIME_PLACEHOLDER);
    expect(formatTimeForDisplay()).toBe(NO_TIME_PLACEHOLDER);
  });

  it('returns the placeholder for any empty or whitespace-only string without throwing', () => {
    fc.assert(
      fc.property(
        // Strings made purely of whitespace characters (including the empty string).
        fc
          .array(fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v'), { minLength: 0, maxLength: 10 })
          .map((chars) => chars.join('')),
        (whitespace) => {
          expect(formatTimeForDisplay(whitespace)).toBe(NO_TIME_PLACEHOLDER);
        },
      ),
    );
  });

  it('never throws and always returns a non-empty string for arbitrary input', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)), (value) => {
        const result = formatTimeForDisplay(value as string | null | undefined);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      }),
    );
  });
});
