/**
 * Suggested_Time_Generator pure helpers (Req 3.1, 3.2, 3.4, 3.5).
 *
 * These are the slot-derivation primitives used by `SchedulingForm` to build
 * suggested booking times. They are extracted here as PURE functions so the
 * derivation can be unit/property tested directly on the real wired logic
 * (SchedulingForm imports `buildTimeOptionsForRange` and
 * `isDisabledByWindowOrBlocked` from this module).
 *
 * The authoritative working window always originates from the backend-computed
 * `DayAvailability.workingHours` returned by the Availability_Provider. The
 * frontend NEVER synthesizes a window from a hard-coded / display-only value to
 * authorize or generate bookable slots (Req 3.3, 3.4, 4.3, 4.4, 12.2): when the
 * backend window is absent, `deriveSuggestedTimes` yields no slots.
 */

import { to12Hour, to24Hour } from '@/utils/availabilityUtils';
import type { DayAvailability } from '@/utils/availabilityProvider';

export interface WorkingWindowMinutes {
  start: number;
  end: number;
}

/**
 * Normalize a time value to canonical `HH:mm`. Mirrors
 * `SchedulingForm.normalizeSlotTime`: accepts 12-hour (`AM`/`PM`) or 24-hour
 * input and pads to two-digit fields.
 */
export function normalizeSlotTime(value?: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  const converted = to24Hour(trimmed);
  const [hours, minutes] = converted.split(':');
  if (!hours || !minutes) return converted;
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

/**
 * Minutes since midnight for a time value. Mirrors
 * `SchedulingForm.timeToMinutes`: defaults a non-finite hour to 0 and a
 * non-finite minute to 0.
 */
export function slotTimeToMinutes(value: string): number {
  const normalized = normalizeSlotTime(value);
  const [hours, minutes] = normalized.split(':').map(Number);
  if (!Number.isFinite(hours)) return 0;
  return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

/** `HH:mm` label for minutes since midnight. Mirrors `SchedulingForm.minutesToTime`. */
export function minutesToTimeLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Build 12-hour time-option labels across an inclusive [start, end] window at a
 * fixed interval. Mirrors `SchedulingForm.buildTimeOptionsForRange`.
 *
 * Returns an empty list when the bounds are missing or non-positive — the
 * caller never synthesizes a range from a frontend value (Req 3.4).
 */
export function buildTimeOptionsForRange(
  intervalMinutes = 5,
  startMinutes?: number | null,
  endMinutes?: number | null,
): string[] {
  if (
    startMinutes == null ||
    endMinutes == null ||
    endMinutes <= startMinutes
  ) {
    return [];
  }
  const options: string[] = [];
  for (let minutes = startMinutes; minutes <= endMinutes; minutes += intervalMinutes) {
    options.push(to12Hour(minutesToTimeLabel(minutes)));
  }
  return options;
}

/**
 * The backend-computed effective working window in minutes, derived solely from
 * `DayAvailability.workingHours`. Mirrors the `dayAvailability` branch of
 * `SchedulingForm.workingWindowMinutes`.
 *
 * Returns `null` when the backend reports no configured window — there is no
 * frontend fallback here, so no bookable slots can be generated (Req 3.3, 3.4).
 */
export function deriveWorkingWindowMinutes(
  day: DayAvailability | null | undefined,
): WorkingWindowMinutes | null {
  const workingHours = day?.workingHours;
  if (workingHours) {
    const start = slotTimeToMinutes(workingHours.start);
    const end = slotTimeToMinutes(workingHours.end);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return { start, end };
    }
  }
  return null;
}

/**
 * Whether a candidate time is disabled by the working-window bound or a
 * backend-reported blocked interval. Mirrors the window + `dayAvailability.blocked`
 * portion of `SchedulingForm.isPhotographerTimeDisabled` (Req 3.1, 3.2, 3.5).
 *
 * A time outside `[window.start, window.end]` is disabled; a time within any
 * `[blocked.start, blocked.end)` interval is disabled.
 */
export function isDisabledByWindowOrBlocked(
  value: string,
  window: WorkingWindowMinutes | null,
  blocked: Array<{ start: string; end: string }> = [],
): boolean {
  const minutes = slotTimeToMinutes(value);

  if (window) {
    if (minutes < window.start || minutes > window.end) return true;
  }

  const intervals = Array.isArray(blocked) ? blocked : [];
  return intervals.some((interval) => {
    const start = slotTimeToMinutes(interval.start);
    const end = slotTimeToMinutes(interval.end);
    return minutes >= start && minutes < end;
  });
}

/**
 * Derive the suggested booking slots for a day strictly from the backend-computed
 * `DayAvailability` (Req 3.1, 3.2, 3.4, 3.5). Composes the same primitives
 * `SchedulingForm` uses: it builds options across the backend working window and
 * excludes the window-bound/blocked intervals.
 *
 * When the backend window is absent the result is empty — the display-only
 * frontend fallback is NEVER used to authorize or generate slots (Req 3.3, 3.4,
 * 4.3, 4.4, 12.2).
 */
export function deriveSuggestedTimes(
  day: DayAvailability | null | undefined,
  intervalMinutes = 15,
): string[] {
  const window = deriveWorkingWindowMinutes(day);
  if (!window) return [];
  const blocked = Array.isArray(day?.blocked) ? day!.blocked : [];
  return buildTimeOptionsForRange(intervalMinutes, window.start, window.end).filter(
    (option) => !isDisabledByWindowOrBlocked(option, window, blocked),
  );
}
