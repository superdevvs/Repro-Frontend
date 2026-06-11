/**
 * Frontend availability defaults.
 *
 * The Laravel backend is the AUTHORITATIVE source of effective working hours.
 * It computes the effective availability window (configured hours plus the
 * single canonical `Backend_Fallback_Hours` defined in
 * `backend/config/availability.php`) and returns that window to the frontend.
 *
 * The value below exists ONLY as a display-only resilience value used to
 * render an approximate window when the backend window is temporarily
 * unavailable. It is gated behind `displayFallbackOnly` and:
 *   - MUST NEVER be passed to slot generation,
 *   - MUST NEVER be used to authorize or validate a booking.
 *
 * It intentionally mirrors the backend fallback (09:00–18:00) for visual
 * consistency, but the backend value remains the single source of truth.
 */

export interface WorkingWindow {
  /** Start time in canonical 24-hour `HH:mm` form. */
  start: string;
  /** End time in canonical 24-hour `HH:mm` form. */
  end: string;
}

/**
 * DISPLAY-ONLY resilience window. NOT authoritative. NEVER used to generate
 * bookable or authorized slots — used only to render an approximate window
 * when the backend-computed window is temporarily unavailable.
 */
export const FRONTEND_FALLBACK_HOURS_DISPLAY_ONLY: Readonly<WorkingWindow> = {
  start: '09:00',
  end: '18:00',
} as const;
