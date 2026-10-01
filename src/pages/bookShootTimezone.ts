/** Preserve an existing shoot's storage convention; new bookings declare their zone. */
export function resolveBookingTimezone({ isEditMode, storedTimezone, browserTimezone }: {
  isEditMode: boolean;
  storedTimezone?: string | null;
  browserTimezone?: string | null;
}): string | null {
  // Null-zone legacy edits use floating local timestamps and must not silently
  // acquire the current operator's timezone.
  if (isEditMode) return storedTimezone ?? null;
  return storedTimezone || browserTimezone || 'America/New_York';
}
