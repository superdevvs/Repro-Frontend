// Property-based + unit tests for the Suggested_Time_Generator slot derivation.
//
// Feature: booking-scheduling-fixes, Property 4: Suggested slots lie within
//   effective bounds and avoid blocked intervals.
// Feature: booking-scheduling-fixes, Property 5: Backend-returned window is
//   authoritative; the frontend fallback never authorizes.
//
// These exercise the real wired logic: `SchedulingForm` builds its suggested
// times by composing `buildTimeOptionsForRange` and `isDisabledByWindowOrBlocked`
// from `@/utils/suggestedTimeSlots`, and `deriveSuggestedTimes` composes those
// same primitives. The authoritative working window always originates from the
// backend-computed `DayAvailability.workingHours`; when it is absent no bookable
// slot is generated — the display-only frontend fallback never authorizes.
//
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 4.3, 4.4, 12.2

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { DayAvailability } from '@/utils/availabilityProvider';
import { FRONTEND_FALLBACK_HOURS_DISPLAY_ONLY } from '@/config/availabilityDefaults';
import {
  deriveSuggestedTimes,
  slotTimeToMinutes,
} from '@/utils/suggestedTimeSlots';

const pad2 = (n: number) => String(n).padStart(2, '0');
const hhmm = (minutes: number) =>
  `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;

/** Build a DayAvailability with a backend working window + optional blocked intervals. */
function makeDay(
  startMin: number,
  endMin: number,
  blocked: Array<{ start: number; end: number }> = [],
  fromConfig = true,
): DayAvailability {
  return {
    workingHours: { start: hhmm(startMin), end: hhmm(endMin) },
    blocked: blocked.map((b) => ({ start: hhmm(b.start), end: hhmm(b.end) })),
    fromConfig,
    timezone: 'Asia/Kolkata',
  };
}

describe('Feature: booking-scheduling-fixes, Property 4: Suggested slots lie within effective bounds and avoid blocked intervals', () => {
  it('every suggested slot lies within the backend working window and outside every blocked interval (Req 3.1, 3.2, 3.5)', () => {
    fc.assert(
      fc.property(
        // window start/end in minutes (15-min grid), end strictly after start
        fc.integer({ min: 0, max: 80 }).map((q) => q * 15), // 00:00 .. 20:00
        fc.integer({ min: 1, max: 15 }).map((q) => q * 15), // window length 15..225 min
        // up to 3 blocked intervals expressed as offset+length within the day
        fc.array(
          fc.record({
            startOffset: fc.integer({ min: 0, max: 240 }),
            length: fc.integer({ min: 5, max: 120 }),
          }),
          { maxLength: 3 },
        ),
        fc.constantFrom(5, 15, 30, 60),
        (startMin, length, rawBlocked, interval) => {
          const endMin = Math.min(startMin + length, 23 * 60 + 59);
          fc.pre(endMin > startMin);

          const blocked = rawBlocked.map((b) => {
            const bStart = startMin + b.startOffset;
            return { start: bStart, end: bStart + b.length };
          });

          const day = makeDay(startMin, endMin, blocked);
          const slots = deriveSuggestedTimes(day, interval);

          for (const slot of slots) {
            const minutes = slotTimeToMinutes(slot);
            // Within the effective bounds (inclusive end — the component allows
            // selecting exactly the window end).
            expect(minutes).toBeGreaterThanOrEqual(startMin);
            expect(minutes).toBeLessThanOrEqual(endMin);
            // Outside every blocked interval [start, end).
            for (const b of blocked) {
              const inBlocked = minutes >= b.start && minutes < b.end;
              expect(inBlocked).toBe(false);
            }
          }
        },
      ),
    );
  });

  it('returns no slots when blocked intervals fully cover the working window (Req 3.5)', () => {
    const day = makeDay(9 * 60, 17 * 60, [{ start: 9 * 60, end: 17 * 60 + 1 }]);
    expect(deriveSuggestedTimes(day, 15)).toEqual([]);
  });

  it('produces the expected grid for a simple 09:00-12:00 window with no blocks', () => {
    const day = makeDay(9 * 60, 12 * 60, []);
    const slots = deriveSuggestedTimes(day, 60);
    expect(slots).toEqual(['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM']);
  });
});

describe('Feature: booking-scheduling-fixes, Property 5: Backend-returned window is authoritative; frontend fallback never authorizes', () => {
  it('generates no bookable slots when the backend reports no configured window, regardless of the display-only frontend fallback (Req 3.3, 3.4, 4.3, 4.4, 12.2)', () => {
    fc.assert(
      fc.property(fc.constantFrom(5, 15, 30, 60), (interval) => {
        const notConfigured: DayAvailability = {
          workingHours: null,
          blocked: [],
          fromConfig: false,
          timezone: 'Asia/Kolkata',
        };
        // No backend window => no slots, even though a display-only frontend
        // fallback window exists. The fallback never authorizes a slot.
        expect(deriveSuggestedTimes(notConfigured, interval)).toEqual([]);
      }),
    );
  });

  it('null/undefined day availability yields no slots (the frontend fallback is never substituted)', () => {
    expect(deriveSuggestedTimes(null, 15)).toEqual([]);
    expect(deriveSuggestedTimes(undefined, 15)).toEqual([]);
  });

  it('all generated slots derive from the backend window, never from the frontend fallback window (Req 12.2)', () => {
    const fallbackStart = slotTimeToMinutes(FRONTEND_FALLBACK_HOURS_DISPLAY_ONLY.start);
    const fallbackEnd = slotTimeToMinutes(FRONTEND_FALLBACK_HOURS_DISPLAY_ONLY.end);

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 80 }).map((q) => q * 15),
        fc.integer({ min: 1, max: 12 }).map((q) => q * 15),
        fc.constantFrom(15, 30, 60),
        (startMin, length, interval) => {
          const endMin = Math.min(startMin + length, 23 * 60 + 59);
          fc.pre(endMin > startMin);

          const day = makeDay(startMin, endMin, []);
          const slots = deriveSuggestedTimes(day, interval);

          // Slots are bounded by the backend window. When the backend window is
          // narrower than (or disjoint from) the frontend fallback, slots must
          // NOT spill to the fallback bounds — proving authorization comes from
          // the backend window, not the display-only fallback.
          for (const slot of slots) {
            const minutes = slotTimeToMinutes(slot);
            expect(minutes).toBeGreaterThanOrEqual(startMin);
            expect(minutes).toBeLessThanOrEqual(endMin);
          }

          if (slots.length > 0) {
            const maxSlot = Math.max(...slots.map(slotTimeToMinutes));
            const minSlot = Math.min(...slots.map(slotTimeToMinutes));
            // If the backend window ends before the fallback end, no slot may
            // reach the fallback end (and symmetrically for the start).
            if (endMin < fallbackEnd) expect(maxSlot).toBeLessThanOrEqual(endMin);
            if (startMin > fallbackStart) expect(minSlot).toBeGreaterThanOrEqual(startMin);
          }
        },
      ),
    );
  });

  it('a backend window that differs from the frontend fallback drives the slots (sanity example)', () => {
    // Backend says 14:00-16:00; fallback is 09:00-18:00. Slots must reflect the
    // backend window only.
    const day = makeDay(14 * 60, 16 * 60, []);
    const slots = deriveSuggestedTimes(day, 60);
    expect(slots).toEqual(['2:00 PM', '3:00 PM', '4:00 PM']);
    // None of the fallback-only morning hours appear.
    expect(slots).not.toContain('9:00 AM');
  });
});
