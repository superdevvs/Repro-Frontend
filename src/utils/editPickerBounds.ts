/**
 * Edit_Picker bounds + inline-422 helpers (Req 2.1, 2.4)
 *
 * Pure, side-effect-free cores extracted from `ShootEditModal` so the Edit_Picker
 * enforcement behavior can be exercised at the smallest accessible seam:
 *
 *  - `isTimeOutsideDayAvailability` is the disabling predicate. It mirrors the
 *    backend-authoritative bounds the Availability_Validator enforces: a time is
 *    "out of bounds" when it falls outside the effective `workingHours` window or
 *    within any `blocked` interval supplied by the Availability_Provider. When no
 *    bounds are available (`day === null`) nothing is disabled client-side — the
 *    backend validator stays authoritative and the frontend never authorizes from
 *    a local value.
 *
 *  - `extractStartTimeScheduleError` maps a shoot-update response into the inline
 *    schedule error string. It returns the structured `errors.start_time` message
 *    on a 422 and `null` otherwise. It is a pure read of `(status, body)` — it
 *    never mutates its inputs and never touches edit state, so surfacing the error
 *    is an additive operation that preserves the user's other unsaved edits.
 */

import type { DayAvailability } from '@/utils/availabilityProvider';

/** Default message used when a 422 names `start_time` without a usable string. */
export const DEFAULT_START_TIME_ERROR =
  "The selected time is outside the photographer's available hours.";

/** Minutes since midnight for an `HH:mm` (or `HH:mm:ss`) value; NaN when unparseable. */
function toMinutes(hhmm: string): number {
  const [h, m] = String(hhmm).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.NaN;
  return h * 60 + m;
}

/**
 * True when `value` (an `HH:mm` time) must be disabled in the Edit_Picker for the
 * given day's availability. Returns `false` when `day` is null (no client-side
 * bounds) or when `value` is unparseable (the backend validator remains the
 * authority and rejects bad input).
 */
export function isTimeOutsideDayAvailability(
  day: DayAvailability | null,
  value: string,
): boolean {
  if (!day) return false;

  const minutes = toMinutes(value);
  if (Number.isNaN(minutes)) return false;

  if (day.workingHours) {
    const startMin = toMinutes(day.workingHours.start);
    const endMin = toMinutes(day.workingHours.end);
    if (!Number.isNaN(startMin) && minutes < startMin) return true;
    if (!Number.isNaN(endMin) && minutes > endMin) return true;
  }

  for (const interval of day.blocked) {
    const blockStart = toMinutes(interval.start);
    const blockEnd = toMinutes(interval.end);
    if (
      !Number.isNaN(blockStart) &&
      !Number.isNaN(blockEnd) &&
      minutes >= blockStart &&
      minutes < blockEnd
    ) {
      return true;
    }
  }

  return false;
}

/** Shape of the (best-effort parsed) error body returned by the shoot-update API. */
export interface ShootUpdateErrorBody {
  message?: string;
  errors?: Record<string, string[] | string>;
}

/**
 * Map a shoot-update response into the inline schedule error message.
 *
 * Returns the structured `errors.start_time` message (first entry when it is an
 * array) for an HTTP 422, falling back to `DEFAULT_START_TIME_ERROR` when the key
 * is present but empty. Returns `null` for any non-422 status or when the body
 * does not name `start_time` — those cases are not inline schedule errors and the
 * caller surfaces them through its normal error path. The input `body` is never
 * mutated.
 */
export function extractStartTimeScheduleError(
  status: number,
  body: ShootUpdateErrorBody | null | undefined,
): string | null {
  if (status !== 422) return null;
  const startTimeError = body?.errors?.start_time;
  if (startTimeError == null) return null;
  const message = Array.isArray(startTimeError)
    ? startTimeError[0]
    : String(startTimeError);
  return message || DEFAULT_START_TIME_ERROR;
}
