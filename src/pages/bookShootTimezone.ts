export const NEW_BOOKING_TIMEZONE = 'America/New_York';

/** New picker clocks match photographer availability; edits preserve stored conventions. */
export function resolveBookingTimezone({ isEditMode, storedTimezone }: {
  isEditMode: boolean;
  storedTimezone?: string | null;
  browserTimezone?: string | null;
}): string | null {
  // Null-zone legacy edits use floating local timestamps and must not silently
  // acquire the current operator's timezone.
  if (isEditMode) return storedTimezone ?? null;
  return NEW_BOOKING_TIMEZONE;
}
