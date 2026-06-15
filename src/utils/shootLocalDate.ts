/**
 * Timezone-safe sourcing of a shoot's intended LOCAL calendar day.
 *
 * The backend serializes a stable, never-shifting local day as `scheduledDate`
 * (`scheduled_date->toDateString()`, e.g. "2026-06-15") alongside the absolute
 * `scheduledAt` instant and an IANA `timezone`. Rendering the day from the
 * absolute instant via `new Date(...)` + local getters causes the calendar date
 * to drift across browser timezones (Item #9, Suite B7).
 *
 * These helpers extract / format the local Y-m-d directly, never converting an
 * instant to the viewer's timezone, so the displayed date matches the shoot's
 * intended local day everywhere.
 */

const YMD_RE = /(\d{4})-(\d{2})-(\d{2})/;

/**
 * Pull the leading `YYYY-MM-DD` out of any string (date-only, `T`-instant, or
 * space-separated datetime) WITHOUT constructing a UTC `Date`.
 *
 * Returns `null` when no Y-m-d prefix is present.
 */
export function extractLocalYmd(value?: string | number | null): string | null {
  if (value == null) return null;
  const match = YMD_RE.exec(String(value).trim());
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

interface ServiceItemLike {
  scheduled_at?: string | null;
  scheduledAt?: string | null;
}

interface ShootLike {
  scheduledDate?: string | null;
  scheduled_date?: string | null;
  scheduledAt?: string | null;
  scheduled_at?: string | null;
  serviceObjects?: ServiceItemLike[] | null;
  serviceItems?: ServiceItemLike[] | null;
  service_items?: ServiceItemLike[] | null;
}

/**
 * Resolve the shoot's intended local calendar day as `YYYY-MM-DD`.
 *
 * Preference order keeps the never-shifting local day authoritative:
 * 1. `scheduledDate` / `scheduled_date` (already a local Y-m-d).
 * 2. Y-m-d portion of `scheduledAt` / `scheduled_at` (string-extracted, NOT
 *    instant-converted, so it does not drift).
 * 3. Y-m-d portion of the first service item's `scheduled_at`.
 *
 * Returns `null` when no usable date is present.
 */
export function getShootLocalDate(shoot?: ShootLike | null): string | null {
  if (!shoot) return null;

  const direct =
    extractLocalYmd(shoot.scheduledDate) ?? extractLocalYmd(shoot.scheduled_date);
  if (direct) return direct;

  const fromInstant =
    extractLocalYmd(shoot.scheduledAt) ?? extractLocalYmd(shoot.scheduled_at);
  if (fromInstant) return fromInstant;

  const serviceLists = [shoot.serviceObjects, shoot.serviceItems, shoot.service_items];
  for (const list of serviceLists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const ymd =
        extractLocalYmd(item?.scheduled_at) ?? extractLocalYmd(item?.scheduledAt);
      if (ymd) return ymd;
    }
  }

  return null;
}

/**
 * Build a LOCAL `Date` anchored at noon for a `YYYY-MM-DD` string so date-fns /
 * locale formatting renders the intended day and never crosses a day boundary
 * due to timezone offsets. Accepts any string `extractLocalYmd` can parse.
 *
 * Returns an invalid `Date` (NaN) for unparseable input so callers can guard.
 */
export function parseLocalYmd(ymd?: string | null): Date {
  const normalized = extractLocalYmd(ymd);
  if (!normalized) return new Date(NaN);
  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}
