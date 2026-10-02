/** Pure helpers for Book Shoot staff availability pre-filter (salesRep/etc.). */

export function bookingTimeToMinutes(time: string): number | null {
  const trimmed = (time || '').trim();
  if (!trimmed) return null;

  const twelve = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelve) {
    let hours = parseInt(twelve[1], 10);
    const minutes = parseInt(twelve[2], 10);
    const mer = twelve[3].toUpperCase();
    if (mer === 'PM' && hours !== 12) hours += 12;
    if (mer === 'AM' && hours === 12) hours = 0;
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
  }

  const twentyFour = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (twentyFour) {
    const hours = parseInt(twentyFour[1], 10);
    const minutes = parseInt(twentyFour[2], 10);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  return null;
}

export function normalizeSlotClock(raw: unknown): string {
  const text = (raw ?? '').toString();
  return text.includes(':') ? text.slice(0, 5) : text;
}

/**
 * True when booking start falls inside an available window.
 * Inclusive start, exclusive end — matches scheduling net-slot checks.
 * (Previously compared only slot start_time === booking time, which hid
 * photographers whose day started earlier, e.g. Lee 08:00–16:30 for a 10:00 book.)
 */
export function slotCoversBookingTime(
  row: { start_time?: unknown; end_time?: unknown; status?: unknown },
  bookingStartMinutes: number,
): boolean {
  if ((row?.status ?? 'available') === 'unavailable') return false;
  const start = bookingTimeToMinutes(normalizeSlotClock(row?.start_time));
  const end = bookingTimeToMinutes(normalizeSlotClock(row?.end_time));
  if (start === null || end === null || end <= start) return false;
  return bookingStartMinutes >= start && bookingStartMinutes < end;
}


export type AvailabilityRow = { start_time?: unknown; end_time?: unknown; status?: unknown; date?: unknown; day_of_week?: unknown };

/**
 * Align with PhotographerAvailabilityController::getPhotographersForBooking:
 * dated *available* windows override weekly; dated *unavailable* alone must not
 * wipe weekly/fallback hours for the rest of the day.
 */
export function resolveBookingAvailabilityRows<T extends AvailabilityRow>(
  rows: T[],
  dateStr: string,
  dayName: string,
): T[] {
  const isAvailable = (row: AvailabilityRow) => (row?.status ?? 'available') === 'available';
  const specific = rows.filter((row) => String(row?.date ?? '').slice(0, 10) === dateStr);
  const weekly = rows.filter((row) => {
    const date = String(row?.date ?? '').trim();
    return !date && String(row?.day_of_week ?? '').toLowerCase() === dayName;
  });
  const specificAvailable = specific.filter(isAvailable);
  const windows = specificAvailable.length > 0 ? specificAvailable : weekly.filter(isAvailable);
  const blocked = [...specific, ...weekly].filter((row) => !isAvailable(row));
  return [...windows, ...blocked];
}
