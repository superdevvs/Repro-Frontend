/**
 * Availability panel state machine (Req 5, 6).
 *
 * The booking availability panel was previously driven by a single
 * `isLoadingAvailability` boolean that could not distinguish a genuine error
 * from an empty day, a not-configured photographer, or an in-flight request.
 * This module replaces that boolean with an explicit discriminated union and a
 * PURE mapping function so the transition logic can be unit/property tested
 * independently of React (tasks 5.6 / 5.7 depend on it).
 *
 * Rules (see design "4. Availability panel state machine"):
 *  - `loading` while a request is in flight (distinct state — Req 5.3).
 *  - aborted requests never produce `error` and never overwrite a newer result
 *    (Req 6.1, 6.2) — they resolve to the benign `loading` state.
 *  - a non-abort `error` => `{ kind: 'error' }` (Req 5/6.3); the "no
 *    availability" panel is NOT shown for errors.
 *  - `result.status === 'not-configured'` => `{ kind: 'not-configured' }`
 *    (Req 5.2).
 *  - `result.status === 'empty'` => `{ kind: 'empty' }`, distinct from
 *    loading/error (Req 5.4).
 *  - otherwise `{ kind: 'success' }`; the "no availability" panel is hidden
 *    whenever hours apply (Req 5.1).
 */

import type { AvailabilityResult, DayAvailability } from '@/utils/availabilityProvider';

export type AvailabilityPanelState =
  /** A request is in flight (Req 5.3). */
  | { kind: 'loading' }
  /** Effective hours apply (config or fallback) — hide the "no availability" panel (Req 5.1). */
  | { kind: 'success'; day: DayAvailability }
  /** Fetched successfully but zero bookable slots that day (Req 5.4). */
  | { kind: 'empty' }
  /** Neither configured hours nor a fallback window apply (Req 5.2). */
  | { kind: 'not-configured' }
  /** A genuine non-abort failure (Req 6.3). */
  | { kind: 'error'; message: string };

export interface DerivePanelStateInput {
  /** True while a request is in flight. */
  loading: boolean;
  /** True when the settled request was aborted/cancelled (benign — Req 6.1). */
  aborted: boolean;
  /** A non-abort error only; aborts must never be passed here (Req 6.1). */
  error: Error | null;
  /** The most-recent (non-stale) availability result, or null when none yet. */
  result: AvailabilityResult | null;
}

/** Default message used when a non-abort error carries no message. */
export const DEFAULT_AVAILABILITY_ERROR_MESSAGE =
  'Unable to load availability. Please try again.';

/**
 * Pure mapping from raw request signals to a single `AvailabilityPanelState`.
 *
 * Deterministic and side-effect free: the same input always yields the same
 * state, so it can be exhaustively property-tested. Aborts are benign and
 * resolve to `loading` (they never produce an error and never overwrite a newer
 * result — the caller drops stale/aborted responses before rendering).
 */
export function derivePanelState(input: DerivePanelStateInput): AvailabilityPanelState {
  const { loading, aborted, error, result } = input;

  // In-flight requests render the distinct loading state (Req 5.3).
  if (loading) return { kind: 'loading' };

  // Aborted requests are benign: never an error, never overwrite newer data
  // (Req 6.1, 6.2). Treat as still-loading rather than surfacing a failure.
  if (aborted) return { kind: 'loading' };

  // Genuine non-abort failures surface the explicit error state (Req 6.3).
  if (error) {
    const message = error.message?.trim() ? error.message : DEFAULT_AVAILABILITY_ERROR_MESSAGE;
    return { kind: 'error', message };
  }

  // No result yet and not loading/aborted/errored: keep the benign loading
  // state rather than fabricating an empty/not-configured panel.
  if (result == null) return { kind: 'loading' };

  if (result.status === 'not-configured') return { kind: 'not-configured' };
  if (result.status === 'empty') return { kind: 'empty' };

  // success: effective hours apply — hide the "no availability" panel (Req 5.1).
  return { kind: 'success', day: result.day };
}
