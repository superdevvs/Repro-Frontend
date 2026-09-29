/**
 * Format unread/attention counts for notification bell and nav badges.
 * Shows the exact count for 1–999, then "999+".
 */
export function formatBadgeCount(count?: number | null): string | null {
  if (count == null || !Number.isFinite(count) || count <= 0) return null;
  const n = Math.floor(count);
  return n > 999 ? '999+' : String(n);
}
