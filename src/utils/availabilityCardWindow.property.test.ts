// Property-based + unit test for the Availability_Card window derivation.
//
// Feature: booking-scheduling-fixes, Property 6: Availability card reflects the
// provider and formats via Time_Formatter.
//
// Asserts that the Availability_Card scale window:
//   1. reflects the provider's (backend-computed) workingHours when present and
//      is NOT a hard-coded 8 AM / 8 PM (08:00–20:00) window (Req 4.1, 4.2),
//   2. produces its bound labels via the Time_Formatter `formatTimeForDisplay`
//      (Req 4.5),
//   3. falls back to the display-only Frontend_Fallback_Hours and marks it
//      NON-AUTHORITATIVE (`displayFallbackOnly: true`) when the backend window
//      is unavailable (Req 4.4).
//
// The derivation is pure and string-based (never constructs a Date), so the
// rendered window is stable regardless of host timezone.
//
// Validates: Requirements 4.1, 4.2, 4.4

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  deriveAvailabilityCardWindow,
  formatCardBoundLabel,
  minutesToTime,
} from '@/utils/availabilityCardWindow';
import { FRONTEND_FALLBACK_HOURS_DISPLAY_ONLY } from '@/config/availabilityDefaults';
import { formatTimeForDisplay } from '@/utils/availabilityUtils';

const pad2 = (n: number) => String(n).padStart(2, '0');
const hhmm = (h: number, m: number) => `${pad2(h)}:${pad2(m)}`;

// The legacy hard-coded window the fix removes: 08:00–20:00.
const LEGACY_START_MINUTES = 8 * 60;
const LEGACY_END_MINUTES = 20 * 60;

describe('Feature: booking-scheduling-fixes, Property 6: Availability card reflects the provider and formats via Time_Formatter', () => {
  it('reflects the provider workingHours window for any valid backend window (not a hard-coded 8/20) (Req 4.1, 4.2)', () => {
    fc.assert(
      fc.property(
        // A valid backend window: start strictly before end, on minute granularity.
        fc.integer({ min: 0, max: 23 * 60 + 58 }),
        fc.integer({ min: 1, max: 23 * 60 + 59 }),
        (startMin, span) => {
          const endMin = Math.min(startMin + span, 24 * 60 - 1);
          fc.pre(endMin > startMin);

          const workingHours = {
            start: hhmm(Math.floor(startMin / 60), startMin % 60),
            end: hhmm(Math.floor(endMin / 60), endMin % 60),
          };

          const card = deriveAvailabilityCardWindow(workingHours);

          // The card reflects the provider's window exactly...
          expect(card.startMinutes).toBe(startMin);
          expect(card.endMinutes).toBe(endMin);
          // ...and is authoritative (sourced from the backend window).
          expect(card.displayFallbackOnly).toBe(false);
        },
      ),
    );
  });

  it('does not collapse provider windows onto the removed hard-coded 08:00–20:00 window (Req 4.1)', () => {
    // A provider window that differs from the legacy 8/20 must be honored, proving
    // the card no longer renders a hard-coded 8 AM / 8 PM scale.
    const card = deriveAvailabilityCardWindow({ start: '10:00', end: '16:00' });
    expect(card.startMinutes).toBe(10 * 60);
    expect(card.endMinutes).toBe(16 * 60);
    expect(card.displayFallbackOnly).toBe(false);
    expect(
      card.startMinutes === LEGACY_START_MINUTES && card.endMinutes === LEGACY_END_MINUTES,
    ).toBe(false);
  });

  it('renders the Backend_Fallback_Hours window (09:00–18:00) authoritatively when the backend returns it (Req 4.3)', () => {
    const card = deriveAvailabilityCardWindow({ start: '09:00', end: '18:00' });
    expect(card.startMinutes).toBe(9 * 60);
    expect(card.endMinutes).toBe(18 * 60);
    // A real backend-returned window is authoritative, even when it coincides
    // with the fallback hours.
    expect(card.displayFallbackOnly).toBe(false);
  });

  it('formats card bound labels via the Time_Formatter for any window (Req 4.5)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        (sh, sm, eh, em) => {
          const startMin = sh * 60 + sm;
          const endMin = eh * 60 + em;
          fc.pre(endMin > startMin);

          const card = deriveAvailabilityCardWindow({
            start: hhmm(sh, sm),
            end: hhmm(eh, em),
          });

          // Bound labels are exactly what the Time_Formatter produces for the
          // window minutes — never inline/hard-coded strings.
          expect(formatCardBoundLabel(card.startMinutes)).toBe(
            formatTimeForDisplay(minutesToTime(card.startMinutes)),
          );
          expect(formatCardBoundLabel(card.endMinutes)).toBe(
            formatTimeForDisplay(minutesToTime(card.endMinutes)),
          );
        },
      ),
    );
  });

  it('formats known provider windows into 12-hour wall-clock labels via the Time_Formatter (Req 4.2, 4.5)', () => {
    const card = deriveAvailabilityCardWindow({ start: '10:00', end: '16:00' });
    expect(formatCardBoundLabel(card.startMinutes)).toBe('10:00 AM');
    expect(formatCardBoundLabel(card.endMinutes)).toBe('4:00 PM');
  });
});

describe('Feature: booking-scheduling-fixes, Property 6: display-only fallback is non-authoritative', () => {
  it('uses the display-only Frontend_Fallback_Hours and marks it non-authoritative when no backend window exists (Req 4.4)', () => {
    for (const missing of [null, undefined] as const) {
      const card = deriveAvailabilityCardWindow(missing);
      expect(card.startMinutes).toBe(timeOf(FRONTEND_FALLBACK_HOURS_DISPLAY_ONLY.start));
      expect(card.endMinutes).toBe(timeOf(FRONTEND_FALLBACK_HOURS_DISPLAY_ONLY.end));
      // The fallback window is DISPLAY-ONLY and must be flagged non-authoritative.
      expect(card.displayFallbackOnly).toBe(true);
    }
  });

  it('treats a degenerate/invalid backend window (end <= start) as no window and falls back non-authoritatively (Req 4.4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        (h, m) => {
          // start === end (and any end < start) is not a usable window.
          const card = deriveAvailabilityCardWindow({ start: hhmm(h, m), end: hhmm(h, m) });
          expect(card.displayFallbackOnly).toBe(true);
          expect(card.startMinutes).toBe(timeOf(FRONTEND_FALLBACK_HOURS_DISPLAY_ONLY.start));
          expect(card.endMinutes).toBe(timeOf(FRONTEND_FALLBACK_HOURS_DISPLAY_ONLY.end));
        },
      ),
    );
  });
});

/** Minutes since midnight for an `HH:mm` literal (test-local reference). */
function timeOf(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}
