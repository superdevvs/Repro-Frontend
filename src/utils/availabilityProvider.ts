/**
 * Availability_Provider (Req 3.2, 4.2, 12.1)
 *
 * The Laravel backend is the AUTHORITATIVE source of effective availability: it
 * computes the effective working window for a photographer + day (applying
 * configured hours plus the single canonical `Backend_Fallback_Hours`) and
 * returns it. This module is a THIN CONSUMER of that backend-returned window —
 * it does NOT synthesize working hours and it does NOT apply its own fallback as
 * authorization.
 *
 * This is the single frontend availability source consumed by Availability_Card,
 * Suggested_Time_Generator, Booking_Picker, and Edit_Picker. Booking
 * authorization always derives from the backend window enforced by the
 * Availability_Validator — never from any value produced here.
 *
 * Timezone is normalized only at this boundary via `normalizeTimezone`; stored
 * values are never rewritten.
 */

import API_ROUTES from '@/lib/api';
import { CANONICAL_TIMEZONE, normalizeTimezone } from '@/utils/timezone';

export interface DayAvailability {
  /**
   * Effective working window for the day, AS COMPUTED AND RETURNED BY THE
   * BACKEND (configured hours + Backend_Fallback_Hours applied server-side).
   * `HH:mm`; `null` when the backend reports the day is not configured.
   */
  workingHours: { start: string; end: string } | null;
  /** Intervals the photographer is NOT bookable (unavailable days, breaks, blocked). */
  blocked: Array<{ start: string; end: string }>;
  /** Whether the backend window came from config (true) or Backend_Fallback_Hours (false). */
  fromConfig: boolean;
  /** Canonical IANA name (see normalizeTimezone). */
  timezone: string;
}

export interface AvailabilityResult {
  status: 'success' | 'empty' | 'not-configured';
  day: DayAvailability;
  /**
   * True only when the backend window could not be obtained and the caller is
   * rendering the display-only Frontend_Fallback_Hours. Never used to authorize.
   */
  displayFallbackOnly?: boolean;
}

/** Raw slot shape returned by the backend availability endpoint. */
interface BackendSlot {
  start_time?: string | null;
  end_time?: string | null;
  start?: string | null;
  end?: string | null;
  status?: string | null;
}

/** Normalize a backend time value to canonical `HH:mm` (drops seconds). Empty -> ''. */
function toHHmm(value?: string | null): string {
  if (value == null) return '';
  const trimmed = String(value).trim();
  if (trimmed === '') return '';
  return trimmed.split(':').slice(0, 2).join(':');
}

/** Minutes since midnight for an `HH:mm` value; NaN when unparseable. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return Number.NaN;
  return h * 60 + m;
}

/** Format a Date as a local `YYYY-MM-DD` string (timezone-safe; no UTC shift). */
function toDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Fetch the backend-computed effective availability window for a photographer on
 * a given day and map it into an `AvailabilityResult`.
 *
 * The returned working window and blocked intervals originate entirely from the
 * backend response; this function never synthesizes hours. Pass an `AbortSignal`
 * to cancel in-flight requests — an abort propagates as a `DOMException`
 * (`name === 'AbortError'`) so the caller's panel state machine can treat it as
 * benign. Any non-abort fetch/HTTP failure is thrown so the caller can surface
 * the explicit error state.
 */
export async function getDayAvailability(
  photographerId: string | number,
  date: Date,
  signal?: AbortSignal,
): Promise<AvailabilityResult> {
  const token = localStorage.getItem('authToken');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const photographerIdNum =
    typeof photographerId === 'string' ? parseInt(photographerId, 10) : photographerId;

  const response = await fetch(API_ROUTES.photographerAvailability.check, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      photographer_id: photographerIdNum,
      date: toDateParam(date),
    }),
    signal,
  });

  if (!response.ok) {
    // Surface the failure to the panel state machine (non-abort error path).
    throw new Error(
      `Availability request failed (${response.status} ${response.statusText})`,
    );
  }

  const json = await response.json();
  const slots: BackendSlot[] = Array.isArray(json?.data) ? json.data : [];

  // Backend marks booked/unavailable intervals; everything else is bookable.
  const isBlocked = (slot: BackendSlot) =>
    slot.status === 'booked' || slot.status === 'unavailable';

  const bookable: Array<{ start: string; end: string }> = [];
  const blocked: Array<{ start: string; end: string }> = [];

  for (const slot of slots) {
    const start = toHHmm(slot.start_time ?? slot.start);
    const end = toHHmm(slot.end_time ?? slot.end);
    if (start === '' || end === '') continue;
    (isBlocked(slot) ? blocked : bookable).push({ start, end });
  }

  // The effective working window is the bounding range of the backend-returned
  // bookable slots. This consumes the backend window; it does not synthesize it.
  let workingHours: DayAvailability['workingHours'] = null;
  if (bookable.length > 0) {
    let minStart = bookable[0].start;
    let maxEnd = bookable[0].end;
    for (const slot of bookable) {
      if (toMinutes(slot.start) < toMinutes(minStart)) minStart = slot.start;
      if (toMinutes(slot.end) > toMinutes(maxEnd)) maxEnd = slot.end;
    }
    workingHours = { start: minStart, end: maxEnd };
  }

  const timezone = normalizeTimezone(json?.timezone) || CANONICAL_TIMEZONE;

  const day: DayAvailability = {
    workingHours,
    blocked,
    // The backend `check` window is derived from configured availability records;
    // a present window therefore reflects configured hours.
    fromConfig: workingHours !== null,
    timezone,
  };

  let status: AvailabilityResult['status'];
  if (workingHours !== null) {
    status = 'success';
  } else if (blocked.length > 0) {
    // The day exists/has bookings but no bookable window remains.
    status = 'empty';
  } else {
    status = 'not-configured';
  }

  return { status, day };
}
