/**
 * Timezone-safe date helpers used by the Schedule_View and any other view
 * that renders a shoot's scheduled day.
 *
 * Backend stores `scheduled_at` as an absolute instant plus an explicit
 * `timezone` (IANA, e.g. "America/New_York"), and `scheduled_date` as the
 * shoot's local calendar day (`YYYY-MM-DD`). The two helpers here keep that
 * contract intact in the browser:
 *
 * - `formatInZone` formats an absolute instant in the shoot's own timezone
 *   so the displayed wall-clock time matches the shoot's location, not the
 *   viewer's machine.
 * - `calendarDay` parses a `YYYY-MM-DD` string as LOCAL midnight. Using
 *   `new Date('YYYY-MM-DD')` is unsafe — JS interprets that as UTC midnight,
 *   which can render as the previous calendar day for viewers west of UTC.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */

/**
 * Format an absolute instant in the supplied IANA timezone.
 *
 * The shoot's `timezone` field is authoritative — pass it in so the rendered
 * day always equals the shoot's local calendar day, regardless of the
 * viewer's machine timezone.
 *
 * @param iso       ISO-8601 instant (typically `shoot.scheduled_at`).
 * @param timeZone  IANA timezone name (typically `shoot.timezone`).
 * @param options   Optional overrides for the underlying `Intl.DateTimeFormat`
 *                  options. Defaults to `{ dateStyle: 'medium' }`.
 */
export function formatInZone(
  iso: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(date);
  } catch {
    // Fallback if the runtime rejects the timezone (very old engines).
    return new Intl.DateTimeFormat('en-US', options).format(date);
  }
}

/**
 * Parse a `YYYY-MM-DD` calendar day as LOCAL midnight so it never shifts a
 * day in either direction.
 *
 * Use this for `scheduled_date` values — they are already a wall-clock day
 * in the shoot's own timezone and must not be re-interpreted as UTC.
 */
export function calendarDay(ymd: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd ?? '').trim());
  if (!match) return new Date(NaN);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day);
}
