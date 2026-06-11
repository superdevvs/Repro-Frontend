/**
 * Availability_Card window derivation (Req 4.1–4.4).
 *
 * Pure extraction of the `availabilityCardWindow` selection that drives the
 * Availability_Card timeline scale in `SchedulingForm`. The card scale is
 * sourced — in priority order — from:
 *   1. The backend-computed working window for the selected photographer + day
 *      (Availability_Provider / `DayAvailability.workingHours`). This is the
 *      AUTHORITATIVE source for what the card shows (Req 4.1, 4.2, 4.3).
 *   2. The display-only `FRONTEND_FALLBACK_HOURS_DISPLAY_ONLY` window, used only
 *      for visual resilience when the backend window is unavailable. It is
 *      marked NON-AUTHORITATIVE via `displayFallbackOnly` and is NEVER used to
 *      authorize or generate bookable slots (Req 4.4, 12.2).
 *
 * Scale bound labels are formatted via the Time_Formatter (`formatTimeForDisplay`)
 * so the card never renders a hard-coded `8 AM`/`8 PM` window (Req 4.1, 4.5).
 *
 * This module is string-based and timezone-safe: it never constructs a Date.
 */

import { to24Hour, formatTimeForDisplay } from '@/utils/availabilityUtils';
import { FRONTEND_FALLBACK_HOURS_DISPLAY_ONLY } from '@/config/availabilityDefaults';

/** A working window expressed in canonical `HH:mm` (24-hour) form. */
export interface WorkingHours {
  start: string;
  end: string;
}

/**
 * The resolved Availability_Card scale window, in minutes since midnight.
 * `displayFallbackOnly` is `true` only when the backend window was unavailable
 * and the display-only frontend fallback is rendered for resilience — that
 * window is never authoritative.
 */
export interface AvailabilityCardWindow {
  startMinutes: number;
  endMinutes: number;
  displayFallbackOnly: boolean;
}

/**
 * Normalize a time value to canonical zero-padded `HH:mm`. Mirrors the
 * `normalizeSlotTime` helper in `SchedulingForm` so derivation matches the
 * component exactly. Empty/unset values yield `''`.
 */
function normalizeSlotTime(value?: string | null): string {
  if (!value) return '';
  const trimmed = String(value).trim();
  const converted = to24Hour(trimmed);
  const [hours, minutes] = converted.split(':');
  if (!hours || !minutes) return converted;
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

/** Minutes since midnight for a canonical time value; `0` when unparseable. */
export function timeToMinutes(value: string): number {
  const normalized = normalizeSlotTime(value);
  const [hours, minutes] = normalized.split(':').map(Number);
  if (!Number.isFinite(hours)) return 0;
  return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

/** Canonical zero-padded `HH:mm` for a minutes-since-midnight value. */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Derive the Availability_Card scale window from the backend-computed working
 * window. When a valid backend window is present (`end > start`), the card
 * reflects the provider's hours and is authoritative (`displayFallbackOnly:
 * false`). Otherwise the display-only frontend fallback is used and marked
 * non-authoritative (`displayFallbackOnly: true`).
 *
 * @param workingHours The backend-supplied `DayAvailability.workingHours`
 *   (`null`/`undefined` when the backend window is unavailable).
 */
export function deriveAvailabilityCardWindow(
  workingHours: WorkingHours | null | undefined,
): AvailabilityCardWindow {
  if (workingHours) {
    const start = timeToMinutes(workingHours.start);
    const end = timeToMinutes(workingHours.end);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return { startMinutes: start, endMinutes: end, displayFallbackOnly: false };
    }
  }

  return {
    startMinutes: timeToMinutes(FRONTEND_FALLBACK_HOURS_DISPLAY_ONLY.start),
    endMinutes: timeToMinutes(FRONTEND_FALLBACK_HOURS_DISPLAY_ONLY.end),
    displayFallbackOnly: true,
  };
}

/**
 * Format an Availability_Card scale bound (minutes since midnight) for display
 * via the Time_Formatter. This is the same transform the card applies to its
 * start/end labels: `formatTimeForDisplay(minutesToTime(minutes))`.
 */
export function formatCardBoundLabel(minutes: number): string {
  return formatTimeForDisplay(minutesToTime(minutes));
}
