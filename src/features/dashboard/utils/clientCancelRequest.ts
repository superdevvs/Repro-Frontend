/**
 * Client dashboard cancel routing.
 * Unapproved bookings withdraw immediately; already-scheduled (and similar)
 * shoots submit a cancellation request for staff approval.
 */
export type ClientCancelEndpoint = "withdraw-request" | "request-cancellation";

const CANCELLATION_REQUEST_STATUSES = new Set([
  "scheduled",
  "booked",
  "on_hold",
  "editing",
  "uploaded",
]);

export function resolveClientCancelEndpoint(
  status?: string | null,
): ClientCancelEndpoint | null {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "requested") return "withdraw-request";
  if (CANCELLATION_REQUEST_STATUSES.has(normalized)) return "request-cancellation";
  return null;
}
